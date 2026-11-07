/**
 * @fileoverview Non-invasive telemetry collector for Antigravity conversations.
 * Aggregates token usage, `gen_metadata` model/endpoint mappings, dual-mode
 * `tok/s` throughput metrics, and `contextWindow` state across multi-level
 * subagent session trees (`scope: 'tree' | 'root' | '<subagentId>'`).
 */

import { homedir } from 'node:os';
import { normalizeStepRecord } from './proto_decoder.mjs';
import { collectRuntimeEnvironment, detectHostLocale } from './runtime_env.mjs';
import {
  listAvailableConversations,
  resolveConversationLifecycleStatus,
  resolveWorkspaceScopedConversations,
} from './session_tree.mjs';
import {
  callLanguageServerRpc,
  findConversationDbOnDisk,
  getGeminiRootDir,
  readGeneratorMetadataFromSqlite,
  readStepTimestampsFromTranscript,
} from './sqlite_rpc.mjs';

export {
  callLanguageServerRpc,
  collectRuntimeEnvironment,
  detectHostLocale,
  listAvailableConversations,
  readGeneratorMetadataFromSqlite,
  resolveConversationLifecycleStatus,
  resolveWorkspaceScopedConversations,
};

const DEFAULT_RECENT_SAMPLE_WINDOW = 5;
const GLOBAL_REGISTRY_CACHE_TTL_MS = 5000;
const globalRegistryCache = new Map();

/**
 * Computes throughput summary (`tok/s`) for a given slice of valid step records.
 */
export function computeThroughputWindowSummary(validSteps) {
  if (!Array.isArray(validSteps) || validSteps.length === 0) {
    return {
      sampleCount: 0,
      totalOutputTokens: 0,
      totalThinkingOutputTokens: 0,
      totalResponseOutputTokens: 0,
      totalStreamingDurationSec: 0,
      totalE2EDurationSec: 0,
      weightedStreamingTokPerSec: 0,
      meanStreamingTokPerSec: 0,
      weightedE2ETokPerSec: 0,
      meanE2ETokPerSec: 0,
      meanTtftSec: 0,
      peakStreamingTokPerSec: 0,
      peakE2ETokPerSec: 0,
    };
  }

  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalStreamingDurationSec = 0;
  let totalE2EDurationSec = 0;
  let totalTtftSec = 0;
  let sumStreamingRates = 0;
  let sumE2ERates = 0;
  let peakStreamingTokPerSec = 0;
  let peakE2ETokPerSec = 0;

  for (const step of validSteps) {
    totalOutputTokens += step.outputTokens;
    totalThinkingOutputTokens += step.thinkingOutputTokens;
    totalResponseOutputTokens += step.responseOutputTokens;
    totalStreamingDurationSec += step.streamingDurationSec;
    totalE2EDurationSec += step.totalDurationSec;
    totalTtftSec += step.timeToFirstTokenSec;
    sumStreamingRates += step.streamingTokPerSec;
    sumE2ERates += step.e2eTokPerSec;
    if (step.streamingTokPerSec > peakStreamingTokPerSec) {
      peakStreamingTokPerSec = step.streamingTokPerSec;
    }
    if (step.e2eTokPerSec > peakE2ETokPerSec) {
      peakE2ETokPerSec = step.e2eTokPerSec;
    }
  }

  const count = validSteps.length;
  return {
    sampleCount: count,
    totalOutputTokens,
    totalThinkingOutputTokens,
    totalResponseOutputTokens,
    totalStreamingDurationSec,
    totalE2EDurationSec,
    weightedStreamingTokPerSec:
      totalStreamingDurationSec > 0
        ? totalOutputTokens / totalStreamingDurationSec
        : 0,
    meanStreamingTokPerSec: sumStreamingRates / count,
    weightedE2ETokPerSec:
      totalE2EDurationSec > 0 ? totalOutputTokens / totalE2EDurationSec : 0,
    meanE2ETokPerSec: sumE2ERates / count,
    meanTtftSec: totalTtftSec / count,
    peakStreamingTokPerSec,
    peakE2ETokPerSec,
  };
}

function accumulateStepIntoModelGroup(map, step, conversationId = '') {
  const key = `${step.modelDisplayName}||${step.responseModel}||${step.modelEnum}`;
  if (!map.has(key)) {
    map.set(key, {
      modelDisplayName: step.modelDisplayName,
      responseModel: step.responseModel,
      configuredModelId: step.configuredModelId || '',
      modelEnum: step.modelEnum,
      apiProvider: step.apiProvider,
      remainingQuotaFraction:
        step.remainingQuotaFraction !== undefined
          ? step.remainingQuotaFraction
          : null,
      quotaResetTime: step.quotaResetTime || '',
      maxContextTokens: step.maxContextTokens || 0,
      requestCount: 0,
      conversationIds: new Set(),
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      thinkingOutputTokens: 0,
      responseOutputTokens: 0,
      validSteps: [],
    });
  }

  const group = map.get(key);
  group.requestCount += 1;
  if (conversationId) {
    group.conversationIds.add(conversationId);
  }
  if (step.maxContextTokens > group.maxContextTokens) {
    group.maxContextTokens = step.maxContextTokens;
  }
  group.inputTokens += step.inputTokens;
  group.cacheReadTokens += step.cacheReadTokens;
  group.outputTokens += step.outputTokens;
  group.thinkingOutputTokens += step.thinkingOutputTokens;
  group.responseOutputTokens += step.responseOutputTokens;
  if (step.isValidThroughputSample) {
    group.validSteps.push(step);
  }
}

function finalizeModelGroupEntries(map) {
  return Array.from(map.values())
    .map((g) => {
      const tp = computeThroughputWindowSummary(g.validSteps);
      const totalPrompt = g.inputTokens + g.cacheReadTokens;
      return {
        modelDisplayName: g.modelDisplayName,
        responseModel: g.responseModel,
        configuredModelId: g.configuredModelId,
        modelEnum: g.modelEnum,
        apiProvider: g.apiProvider,
        remainingQuotaFraction: g.remainingQuotaFraction,
        quotaResetTime: g.quotaResetTime,
        maxContextTokens: g.maxContextTokens,
        requestCount: g.requestCount,
        conversationCount: g.conversationIds.size,
        validSampleCount: tp.sampleCount,
        inputTokens: g.inputTokens,
        cacheReadTokens: g.cacheReadTokens,
        totalPromptTokens: totalPrompt,
        cacheHitRate: totalPrompt > 0 ? g.cacheReadTokens / totalPrompt : 0,
        outputTokens: g.outputTokens,
        thinkingOutputTokens: g.thinkingOutputTokens,
        responseOutputTokens: g.responseOutputTokens,
        weightedStreamingTokPerSec: tp.weightedStreamingTokPerSec,
        meanStreamingTokPerSec: tp.meanStreamingTokPerSec,
        weightedE2ETokPerSec: tp.weightedE2ETokPerSec,
        meanE2ETokPerSec: tp.meanE2ETokPerSec,
        meanTtftSec: tp.meanTtftSec,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

/**
 * Aggregates a global registry of all `gen_metadata` model display names,
 * underlying endpoint identifiers (`responseModel`), enum IDs, providers,
 * observed contextWindow limits, and throughput across local conversations.
 */
export function collectGlobalModelRegistry({
  homeDirPath = homedir(),
  maxConversations = 60,
} = {}) {
  const cacheKey = `${homeDirPath}:${maxConversations}`;
  const now = Date.now();
  const cached = globalRegistryCache.get(cacheKey);
  if (cached && now - cached.timestamp < GLOBAL_REGISTRY_CACHE_TTL_MS) {
    return cached.payload;
  }

  const conversations = listAvailableConversations({
    homeDirPath,
    limit: maxConversations,
  });
  const registryMap = new Map();
  let totalGlobalInputTokens = 0;
  let totalGlobalCacheReadTokens = 0;
  let totalGlobalOutputTokens = 0;
  let totalGlobalThinkingTokens = 0;
  let totalGlobalResponseTokens = 0;
  let totalGlobalRequests = 0;

  for (const rootConv of conversations) {
    const allNodes = [rootConv, ...(rootConv.subagents || [])];
    for (const conv of allNodes) {
      const records = readGeneratorMetadataFromSqlite(conv.dbPath);
      for (const step of records) {
        if (!step.hasChatModel) continue;
        if (step.responseModel === 'unspecified' && step.outputTokens === 0) {
          continue;
        }
        totalGlobalRequests += 1;
        totalGlobalInputTokens += step.inputTokens;
        totalGlobalCacheReadTokens += step.cacheReadTokens;
        totalGlobalOutputTokens += step.outputTokens;
        totalGlobalThinkingTokens += step.thinkingOutputTokens;
        totalGlobalResponseTokens += step.responseOutputTokens;
        accumulateStepIntoModelGroup(registryMap, step, rootConv.conversationId);
      }
    }
  }

  const entries = finalizeModelGroupEntries(registryMap);
  const totalGlobalPromptTokens =
    totalGlobalInputTokens + totalGlobalCacheReadTokens;

  const payload = {
    scannedConversations: conversations.length,
    totalGlobalRequests,
    totalGlobalInputTokens,
    totalGlobalCacheReadTokens,
    totalGlobalPromptTokens,
    globalCacheHitRate:
      totalGlobalPromptTokens > 0
        ? totalGlobalCacheReadTokens / totalGlobalPromptTokens
        : 0,
    totalGlobalOutputTokens,
    totalGlobalThinkingTokens,
    totalGlobalResponseTokens,
    grandTotalGlobalTokens: totalGlobalPromptTokens + totalGlobalOutputTokens,
    entries,
  };
  globalRegistryCache.set(cacheKey, { timestamp: now, payload });
  return payload;
}

function resolveTargetRootAndScope(
  rawRequestedId,
  scope,
  availableConversations,
  geminiRoot
) {
  let rootConv =
    availableConversations.find((c) => c.conversationId === rawRequestedId) ||
    null;
  let matchedSubagent = null;

  if (!rootConv) {
    for (const candidateRoot of availableConversations) {
      const sub = (candidateRoot.subagents || []).find(
        (s) => s.conversationId === rawRequestedId
      );
      if (sub) {
        rootConv = candidateRoot;
        matchedSubagent = sub;
        break;
      }
    }
  }

  if (!rootConv) {
    const diskInfo = findConversationDbOnDisk(geminiRoot, rawRequestedId);
    rootConv = {
      conversationId: rawRequestedId,
      title: `会话 ${rawRequestedId.slice(0, 8)}`,
      displayTitle: `会话 ${rawRequestedId.slice(0, 8)}`,
      surfaceId: diskInfo?.surfaceId || 'antigravity',
      surfaceLabel: diskInfo?.surfaceLabel || 'Antigravity 2.0 (App)',
      dbPath: diskInfo?.dbPath || '',
      isSubagent: false,
      nestingDepth: 0,
      parentConversationId: '',
      rootConversationId: rawRequestedId,
      agentName: '',
      agentRole: '',
      subagentCount: 0,
      maxNestingDepth: 0,
      subagents: [],
    };
  }

  const normalizedScopeParam = String(scope || '').trim();
  const subagentsList = Array.isArray(rootConv.subagents)
    ? rootConv.subagents
    : [];
  const subagentById = new Map(
    subagentsList.map((s) => [s.conversationId, s])
  );

  let activeScope = 'tree';
  if (normalizedScopeParam === 'root') {
    activeScope = 'root';
  } else if (normalizedScopeParam === 'tree') {
    activeScope = 'tree';
  } else if (
    normalizedScopeParam &&
    subagentById.has(normalizedScopeParam)
  ) {
    activeScope = normalizedScopeParam;
  } else if (matchedSubagent && !normalizedScopeParam) {
    activeScope = matchedSubagent.conversationId;
  }

  return { rootConv, subagentsList, activeScope };
}

async function collectNodeTelemetryEntry({
  node,
  rootConv,
  rawRequestedId,
  geminiRoot,
  env,
  modelCatalogByLabel,
  modelCatalogByEnum,
}) {
  let rawStepRecords = [];
  let source = '';

  if (node.conversationId === rawRequestedId) {
    const rpcData = await callLanguageServerRpc(
      'GetCascadeTrajectoryGeneratorMetadata',
      { cascadeId: node.conversationId },
      env
    );
    if (
      Array.isArray(rpcData?.generatorMetadata) &&
      rpcData.generatorMetadata.length > 0
    ) {
      rawStepRecords = rpcData.generatorMetadata.map((item, idx) => {
        const normalized = normalizeStepRecord(item);
        normalized.metadataIndex = idx;
        return normalized;
      });
      source = 'language_server_rpc';
    }
  }

  if (rawStepRecords.length === 0 && node.dbPath) {
    rawStepRecords = readGeneratorMetadataFromSqlite(node.dbPath);
    if (rawStepRecords.length > 0) {
      source = `sqlite_gen_metadata (${node.surfaceId})`;
    }
  }

  const timestampsByStep = readStepTimestampsFromTranscript(
    geminiRoot,
    node.conversationId
  );

  let nodePlannerMaxOutputTokens = 0;
  let nodeLatestContextStep = null;
  let nodeInputTokens = 0;
  let nodeCacheReadTokens = 0;
  let nodeOutputTokens = 0;
  const nodeChatSteps = [];
  const nodeValidSteps = [];

  for (const rec of rawStepRecords) {
    if (rec.plannerMaxOutputTokens > nodePlannerMaxOutputTokens) {
      nodePlannerMaxOutputTokens = rec.plannerMaxOutputTokens;
    }
    if (!rec.hasChatModel) continue;

    const catalogEntry =
      modelCatalogByLabel.get(rec.modelDisplayName) ||
      modelCatalogByEnum.get(rec.modelEnum) ||
      null;

    const timestamp =
      timestampsByStep.get(rec.firstStepIndex) ||
      timestampsByStep.get(rec.lastStepIndex) ||
      '';

    const enrichedStep = {
      ...rec,
      trajectoryId: node.conversationId,
      isSubagent: Boolean(node.isSubagent),
      nestingDepth: Number(node.nestingDepth || 0),
      agentName: String(node.agentName || ''),
      agentRole: String(node.agentRole || ''),
      trajectoryDisplayTitle: String(node.displayTitle || node.title || ''),
      configuredModelId: catalogEntry?.modelId || '',
      remainingQuotaFraction:
        catalogEntry?.remainingFraction !== undefined
          ? catalogEntry.remainingFraction
          : null,
      quotaResetTime: catalogEntry?.resetTime || '',
      createdAt: timestamp,
    };

    nodeChatSteps.push(enrichedStep);
    nodeInputTokens += enrichedStep.inputTokens;
    nodeCacheReadTokens += enrichedStep.cacheReadTokens;
    nodeOutputTokens += enrichedStep.outputTokens;

    if (
      enrichedStep.maxContextTokens > 0 ||
      enrichedStep.estimatedTokensUsed > 0
    ) {
      nodeLatestContextStep = enrichedStep;
    }
    if (enrichedStep.isValidThroughputSample) {
      nodeValidSteps.push(enrichedStep);
    }
  }

  const nodeTp = computeThroughputWindowSummary(nodeValidSteps);
  const nodePromptTokens = nodeInputTokens + nodeCacheReadTokens;

  return {
    source,
    entry: {
      node,
      chatStepRecords: nodeChatSteps,
      plannerMaxOutputTokens: nodePlannerMaxOutputTokens,
      latestContextStep: nodeLatestContextStep,
      summary: {
        conversationId: node.conversationId,
        parentConversationId: node.parentConversationId || '',
        rootConversationId: rootConv.conversationId,
        nestingDepth: Number(node.nestingDepth || 0),
        isSubagent: Boolean(node.isSubagent),
        title: node.title,
        displayTitle: node.displayTitle || node.title,
        agentName: node.agentName || '',
        agentRole: node.agentRole || '',
        status: node.status || '',
        lifecycleStatus: resolveConversationLifecycleStatus({
          ...node,
          requestCount: nodeChatSteps.length,
        }),
        lastModifiedTime: node.lastModifiedTime || '',
        requestCount: nodeChatSteps.length,
        totalPromptTokens: nodePromptTokens,
        outputTokens: nodeOutputTokens,
        grandTotalTokens: nodePromptTokens + nodeOutputTokens,
        weightedE2ETokPerSec: nodeTp.weightedE2ETokPerSec,
        estimatedTokensUsed: nodeLatestContextStep?.estimatedTokensUsed || 0,
        maxContextTokens: nodeLatestContextStep?.maxContextTokens || 0,
      },
    },
  };
}

function aggregateScopedTokensAndModels(chatStepRecords, validThroughputSteps) {
  let totalInputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalRetryCount = 0;
  const modelGroupsMap = new Map();

  for (const step of chatStepRecords) {
    totalInputTokens += step.inputTokens;
    totalCacheReadTokens += step.cacheReadTokens;
    totalCacheWriteTokens += step.cacheWriteTokens;
    totalOutputTokens += step.outputTokens;
    totalThinkingOutputTokens += step.thinkingOutputTokens;
    totalResponseOutputTokens += step.responseOutputTokens;
    totalRetryCount += step.retryCount;

    if (
      step.responseModel === 'unspecified' &&
      step.inputTokens === 0 &&
      step.outputTokens === 0
    ) {
      continue;
    }

    accumulateStepIntoModelGroup(modelGroupsMap, step);
  }

  const totalPromptTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalPromptTokens > 0 ? totalCacheReadTokens / totalPromptTokens : 0;
  const modelsUsed = finalizeModelGroupEntries(modelGroupsMap);

  return {
    tokenTotals: {
      totalRequests: chatStepRecords.length,
      validThroughputRequests: validThroughputSteps.length,
      totalRetryCount,
      totalInputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalPromptTokens,
      cacheHitRate,
      totalOutputTokens,
      totalThinkingOutputTokens,
      totalResponseOutputTokens,
      grandTotalTokens: totalPromptTokens + totalOutputTokens,
    },
    modelsUsed,
  };
}

function selectScopedNodeEntries(
  activeScope,
  rootConv,
  allHierarchyNodes,
  nodeDataById
) {
  let selectedNodeEntries = [];
  if (activeScope === 'root') {
    const rootEntry = nodeDataById.get(rootConv.conversationId);
    if (rootEntry) selectedNodeEntries = [rootEntry];
  } else if (activeScope !== 'tree' && nodeDataById.has(activeScope)) {
    selectedNodeEntries = [nodeDataById.get(activeScope)];
  } else {
    selectedNodeEntries = allHierarchyNodes
      .map((n) => nodeDataById.get(n.conversationId))
      .filter(Boolean);
  }

  let plannerMaxOutputTokens = 0;
  const chatStepRecords = [];
  for (const entry of selectedNodeEntries) {
    if (entry.plannerMaxOutputTokens > plannerMaxOutputTokens) {
      plannerMaxOutputTokens = entry.plannerMaxOutputTokens;
    }
    chatStepRecords.push(...entry.chatStepRecords);
  }

  const contextTargetEntry =
    activeScope !== 'tree' &&
    activeScope !== 'root' &&
    nodeDataById.has(activeScope)
      ? nodeDataById.get(activeScope)
      : nodeDataById.get(rootConv.conversationId);
  let latestContextStep = contextTargetEntry?.latestContextStep || null;
  if (!latestContextStep) {
    for (const entry of selectedNodeEntries) {
      if (entry.latestContextStep) {
        latestContextStep = entry.latestContextStep;
      }
    }
  }

  return { plannerMaxOutputTokens, chatStepRecords, latestContextStep };
}

function buildSessionHierarchySummary(
  rootConv,
  subagentsList,
  activeScope,
  allHierarchyNodes,
  nodeDataById
) {
  const hierarchyNodeSummaries = allHierarchyNodes
    .map((n) => nodeDataById.get(n.conversationId)?.summary)
    .filter(Boolean);
  const rootNodeSummary = nodeDataById.get(rootConv.conversationId)?.summary || {
    requestCount: 0,
    totalPromptTokens: 0,
    outputTokens: 0,
    grandTotalTokens: 0,
  };
  const treeTotals = hierarchyNodeSummaries.reduce(
    (acc, item) => {
      acc.requestCount += item.requestCount;
      acc.totalPromptTokens += item.totalPromptTokens;
      acc.outputTokens += item.outputTokens;
      acc.grandTotalTokens += item.grandTotalTokens;
      return acc;
    },
    {
      requestCount: 0,
      totalPromptTokens: 0,
      outputTokens: 0,
      grandTotalTokens: 0,
    }
  );

  return {
    rootConversationId: rootConv.conversationId,
    rootTitle: rootConv.title,
    rootLifecycleStatus:
      rootNodeSummary.lifecycleStatus ||
      rootConv.rootOwnLifecycleStatus ||
      rootConv.lifecycleStatus ||
      'inactive',
    treeLifecycleStatus:
      rootConv.treeLifecycleStatus || rootConv.lifecycleStatus || 'inactive',
    activeScope,
    subagentCount: subagentsList.length,
    maxNestingDepth: rootConv.maxNestingDepth || 0,
    treeTotals,
    rootTotals: {
      requestCount: rootNodeSummary.requestCount,
      totalPromptTokens: rootNodeSummary.totalPromptTokens,
      outputTokens: rootNodeSummary.outputTokens,
      grandTotalTokens: rootNodeSummary.grandTotalTokens,
    },
    nodes: hierarchyNodeSummaries,
  };
}

function buildThroughputPayload(validThroughputSteps, recentWindowSize) {
  const latestValidStep =
    validThroughputSteps.length > 0
      ? validThroughputSteps[validThroughputSteps.length - 1]
      : null;
  const recentValidSteps = validThroughputSteps.slice(-recentWindowSize);

  return {
    recentWindowSize,
    latest: latestValidStep
      ? {
          stepIndices: latestValidStep.stepIndices,
          trajectoryId: latestValidStep.trajectoryId,
          isSubagent: latestValidStep.isSubagent,
          nestingDepth: latestValidStep.nestingDepth,
          agentName: latestValidStep.agentName,
          agentRole: latestValidStep.agentRole,
          modelDisplayName: latestValidStep.modelDisplayName,
          responseModel: latestValidStep.responseModel,
          outputTokens: latestValidStep.outputTokens,
          thinkingOutputTokens: latestValidStep.thinkingOutputTokens,
          responseOutputTokens: latestValidStep.responseOutputTokens,
          timeToFirstTokenSec: latestValidStep.timeToFirstTokenSec,
          streamingDurationSec: latestValidStep.streamingDurationSec,
          totalDurationSec: latestValidStep.totalDurationSec,
          streamingTokPerSec: latestValidStep.streamingTokPerSec,
          e2eTokPerSec: latestValidStep.e2eTokPerSec,
        }
      : null,
    recentWindow: computeThroughputWindowSummary(recentValidSteps),
    sessionOverall: computeThroughputWindowSummary(validThroughputSteps),
  };
}

/**
 * Collects full token usage, `gen_metadata` model/endpoint mappings, dual-mode
 * `tok/s` throughput, and contextWindow metrics for a conversation or its
 * multi-level subagent session tree (`scope: 'tree' | 'root' | '<subagentId>'`).
 */
export async function collectConversationTelemetry(
  conversationId,
  {
    homeDirPath = homedir(),
    env = process.env,
    recentWindowSize = DEFAULT_RECENT_SAMPLE_WINDOW,
    scope = '',
    workspaceUris = [],
  } = {}
) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const globalConversations = listAvailableConversations({
    homeDirPath,
    limit: 60,
  });

  const explicitConvId = conversationId || env.ANTIGRAVITY_CONVERSATION_ID || '';
  const {
    currentWorkspace,
    workspaceConversations: availableConversations,
    defaultConversationId: rawRequestedId,
  } = resolveWorkspaceScopedConversations(globalConversations, {
    workspaceUris: workspaceUris?.length
      ? workspaceUris
      : env.ANTIGRAVITY_WORKSPACE_URI || [],
    requestedConversationId: explicitConvId,
  });

  const runtimeEnv = await collectRuntimeEnvironment({ homeDirPath, env });
  const modelCatalogByEnum = new Map();
  const modelCatalogByLabel = new Map();
  for (const m of runtimeEnv.clientModelConfigs) {
    if (m.modelEnum) modelCatalogByEnum.set(m.modelEnum, m);
    if (m.label) modelCatalogByLabel.set(m.label, m);
  }

  if (!rawRequestedId) {
    return {
      conversationId: '',
      activeScope: 'tree',
      scopedConversationId: '',
      conversationMeta: null,
      sessionHierarchy: null,
      dataSource: 'none',
      collectedAt: new Date().toISOString(),
      runtimeEnv,
      currentWorkspace,
      availableConversations,
      globalConversations,
      tokenTotals: null,
      contextWindowState: null,
      throughput: null,
      modelsUsed: [],
      stepRecords: [],
    };
  }

  const { rootConv, subagentsList, activeScope } = resolveTargetRootAndScope(
    rawRequestedId,
    scope,
    globalConversations,
    geminiRoot
  );

  const allHierarchyNodes = [rootConv, ...subagentsList];
  const nodeDataById = new Map();
  let dataSource = 'none';

  for (const node of allHierarchyNodes) {
    const { source, entry } = await collectNodeTelemetryEntry({
      node,
      rootConv,
      rawRequestedId,
      geminiRoot,
      env,
      modelCatalogByLabel,
      modelCatalogByEnum,
    });
    if (source && (dataSource === 'none' || source === 'language_server_rpc')) {
      dataSource = source;
    }
    nodeDataById.set(node.conversationId, entry);
  }

  const { plannerMaxOutputTokens, chatStepRecords, latestContextStep } =
    selectScopedNodeEntries(
      activeScope,
      rootConv,
      allHierarchyNodes,
      nodeDataById
    );

  const validThroughputSteps = chatStepRecords.filter(
    (s) => s.isValidThroughputSample
  );
  const { tokenTotals, modelsUsed } = aggregateScopedTokensAndModels(
    chatStepRecords,
    validThroughputSteps
  );

  const maxContextTokens = latestContextStep?.maxContextTokens || 0;
  const estimatedTokensUsed = latestContextStep?.estimatedTokensUsed || 0;
  const contextUsageRatio =
    maxContextTokens > 0 ? estimatedTokensUsed / maxContextTokens : 0;

  return {
    conversationId: rootConv.conversationId,
    activeScope,
    scopedConversationId:
      activeScope === 'tree' || activeScope === 'root'
        ? rootConv.conversationId
        : activeScope,
    conversationMeta: rootConv,
    sessionHierarchy: buildSessionHierarchySummary(
      rootConv,
      subagentsList,
      activeScope,
      allHierarchyNodes,
      nodeDataById
    ),
    dataSource,
    collectedAt: new Date().toISOString(),
    runtimeEnv,
    currentWorkspace,
    availableConversations,
    globalConversations,
    tokenTotals,
    contextWindowState: {
      cliConfiguredValue: runtimeEnv.contextWindowConfig.configuredValue,
      cliDisplayValue: runtimeEnv.contextWindowConfig.displayValue,
      estimatedTokensUsed,
      maxContextTokens,
      plannerMaxOutputTokens,
      usageRatio: contextUsageRatio,
      remainingContextTokens: Math.max(
        0,
        maxContextTokens - estimatedTokensUsed
      ),
      breakdownGroups: latestContextStep?.breakdownGroups || [],
    },
    throughput: buildThroughputPayload(validThroughputSteps, recentWindowSize),
    modelsUsed,
    globalModelRegistry: collectGlobalModelRegistry({
      homeDirPath,
      maxConversations: 60,
    }),
    stepRecords: chatStepRecords,
  };
}
