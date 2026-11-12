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
  readLatestCheckpointFromSqlite,
  readStepTimestampsFromTranscript,
} from './sqlite_rpc.mjs';
import {
  accumulateStepIntoModelGroup,
  aggregateScopedTokensAndModels,
  buildThroughputPayload,
  computeThroughputWindowSummary,
  finalizeModelGroupEntries,
  isStepValidForE2E,
  sumThroughputWindowSummaries,
} from './throughput_aggregator.mjs';

export {
  callLanguageServerRpc,
  collectRuntimeEnvironment,
  computeThroughputWindowSummary,
  detectHostLocale,
  listAvailableConversations,
  readGeneratorMetadataFromSqlite,
  resolveConversationLifecycleStatus,
  resolveWorkspaceScopedConversations,
  sumThroughputWindowSummaries,
};

const DEFAULT_RECENT_SAMPLE_WINDOW = 5;
const GLOBAL_REGISTRY_CACHE_TTL_MS = 5000;
const globalRegistryCache = new Map();

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

  let activeScope = 'root';
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
  let nodeFirstContextStep = null;
  let nodeLatestContextStep = null;
  let nodeLatestCompletedPromptStep = null;
  let nodeLatestBreakdownGroups = [];
  let maxCoveredStepIndex = -1;
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

    // Skip empty canceled pre-compact generator metadata records that executed no steps
    if (
      rec.stepIndices.length === 0 &&
      rec.inputTokens === 0 &&
      rec.cacheReadTokens === 0 &&
      rec.outputTokens === 0 &&
      rec.responseModel === 'unspecified'
    ) {
      continue;
    }

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

    const stepMaxIdx = Math.max(
      enrichedStep.lastStepIndex,
      Number(enrichedStep.customMetadata?.last_step_index || -1)
    );
    if (stepMaxIdx > maxCoveredStepIndex) {
      maxCoveredStepIndex = stepMaxIdx;
    }

    if (enrichedStep.totalPromptTokens > 0) {
      nodeLatestCompletedPromptStep = enrichedStep;
    }

    if (
      enrichedStep.maxContextTokens > 0 ||
      enrichedStep.estimatedTokensUsed > 0 ||
      enrichedStep.totalPromptTokens > 0
    ) {
      if (
        !nodeFirstContextStep &&
        (enrichedStep.totalPromptTokens > 0 ||
          enrichedStep.estimatedTokensUsed > 0)
      ) {
        nodeFirstContextStep = enrichedStep;
      }
      nodeLatestContextStep = enrichedStep;
      if (enrichedStep.breakdownGroups?.length > 0) {
        nodeLatestBreakdownGroups = enrichedStep.breakdownGroups;
      }
    }
    if (isStepValidForE2E(enrichedStep)) {
      nodeValidSteps.push(enrichedStep);
    }
  }

  if (nodeLatestContextStep) {
    const rawHeuristic = nodeLatestContextStep.estimatedTokensUsed || 0;
    let calibratedUsed = rawHeuristic;
    if (nodeLatestContextStep.totalPromptTokens > 0) {
      calibratedUsed = nodeLatestContextStep.totalPromptTokens;
    } else if (nodeLatestCompletedPromptStep) {
      const prevHeuristic =
        nodeLatestCompletedPromptStep.estimatedTokensUsed || 0;
      const heuristicDelta =
        rawHeuristic > 0 && prevHeuristic > 0
          ? Math.max(0, rawHeuristic - prevHeuristic)
          : 0;
      calibratedUsed =
        nodeLatestCompletedPromptStep.totalPromptTokens + heuristicDelta;
    }
    nodeLatestContextStep = {
      ...nodeLatestContextStep,
      contextTokensUsed: calibratedUsed,
      heuristicTokensUsed: rawHeuristic,
    };
  }

  const latestCheckpoint = readLatestCheckpointFromSqlite(
    node.dbPath,
    geminiRoot,
    node.conversationId
  );
  if (latestCheckpoint && latestCheckpoint.stepIndex > maxCoveredStepIndex) {
    const maxContextTokens = nodeLatestContextStep?.maxContextTokens || 256000;
    const nonChatGroups = (nodeLatestBreakdownGroups || []).filter(
      (g) => g.name !== 'Chat Messages' && g.totalTokens > 0
    );
    const baseNonChatTokens =
      nonChatGroups.length > 0
        ? nonChatGroups.reduce((sum, g) => sum + g.totalTokens, 0)
        : Math.max(
            0,
            (nodeFirstContextStep?.estimatedTokensUsed ||
              nodeFirstContextStep?.totalPromptTokens ||
              24000) - 1000
          );
    const checkpointChatTokens =
      (latestCheckpoint.responseOutputTokens ||
        latestCheckpoint.outputTokens ||
        4500) + 1800;
    const postCompactEstimatedTokens = Math.min(
      maxContextTokens,
      baseNonChatTokens + checkpointChatTokens
    );

    const updatedBreakdown =
      nonChatGroups.length > 0
        ? [
            ...nonChatGroups,
            { name: 'Chat Messages', totalTokens: checkpointChatTokens },
          ]
        : nodeLatestContextStep?.breakdownGroups || [];

    nodeLatestContextStep = {
      ...(nodeLatestContextStep || {}),
      contextTokensUsed: postCompactEstimatedTokens,
      estimatedTokensUsed: postCompactEstimatedTokens,
      heuristicTokensUsed: postCompactEstimatedTokens,
      maxContextTokens,
      breakdownGroups: updatedBreakdown,
      compactedAtStepIndex: latestCheckpoint.stepIndex,
    };
  }

  const nodeTp = computeThroughputWindowSummary(nodeValidSteps);
  const nodePromptTokens = nodeInputTokens + nodeCacheReadTokens;

  return {
    source,
    entry: {
      node,
      chatStepRecords: nodeChatSteps,
      validStepRecords: nodeValidSteps,
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
        contextTokensUsed:
          nodeLatestContextStep?.contextTokensUsed ??
          nodeLatestContextStep?.estimatedTokensUsed ??
          0,
        estimatedTokensUsed:
          nodeLatestContextStep?.contextTokensUsed ??
          nodeLatestContextStep?.estimatedTokensUsed ??
          0,
        heuristicTokensUsed:
          nodeLatestContextStep?.heuristicTokensUsed ??
          nodeLatestContextStep?.estimatedTokensUsed ??
          0,
        maxContextTokens: nodeLatestContextStep?.maxContextTokens || 0,
      },
    },
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
    if (activeScope === 'tree') {
      plannerMaxOutputTokens += entry.plannerMaxOutputTokens || 0;
    } else if (entry.plannerMaxOutputTokens > plannerMaxOutputTokens) {
      plannerMaxOutputTokens = entry.plannerMaxOutputTokens;
    }
    chatStepRecords.push(...entry.chatStepRecords);
  }

  if (activeScope === 'tree' && selectedNodeEntries.length > 1) {
    chatStepRecords.sort((a, b) => {
      if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return (a.firstStepIndex || 0) - (b.firstStepIndex || 0);
    });
  }

  if (activeScope === 'tree') {
    const rootCtxStep = nodeDataById.get(rootConv.conversationId)?.latestContextStep;
    const defaultMaxCtx = rootCtxStep?.maxContextTokens || 256000;
    let sumUsedCtx = 0;
    let sumHeuristicCtx = 0;
    let sumMaxCtx = 0;
    const breakdownMap = new Map();

    for (const entry of selectedNodeEntries) {
      const ctxStep = entry.latestContextStep;
      if (!ctxStep && entry.chatStepRecords.length === 0) continue;
      sumUsedCtx +=
        ctxStep?.contextTokensUsed ?? ctxStep?.estimatedTokensUsed ?? 0;
      sumHeuristicCtx +=
        ctxStep?.heuristicTokensUsed ?? ctxStep?.estimatedTokensUsed ?? 0;
      sumMaxCtx += ctxStep?.maxContextTokens || defaultMaxCtx;
      for (const g of ctxStep?.breakdownGroups || []) {
        if (!g?.name) continue;
        breakdownMap.set(
          g.name,
          (breakdownMap.get(g.name) || 0) + (g.totalTokens || 0)
        );
      }
    }

    return {
      selectedNodeEntries,
      plannerMaxOutputTokens,
      chatStepRecords,
      latestContextStep: {
        contextTokensUsed: sumUsedCtx,
        estimatedTokensUsed: sumUsedCtx,
        heuristicTokensUsed: sumHeuristicCtx,
        maxContextTokens: sumMaxCtx || defaultMaxCtx,
        breakdownGroups: Array.from(breakdownMap.entries()).map(
          ([name, totalTokens]) => ({ name, totalTokens })
        ),
      },
    };
  }

  const contextTargetEntry =
    activeScope !== 'root' && nodeDataById.has(activeScope)
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

  return {
    selectedNodeEntries,
    plannerMaxOutputTokens,
    chatStepRecords,
    latestContextStep,
  };
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
      activeScope: 'root',
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

  const {
    selectedNodeEntries,
    plannerMaxOutputTokens,
    chatStepRecords,
    latestContextStep,
  } = selectScopedNodeEntries(
    activeScope,
    rootConv,
    allHierarchyNodes,
    nodeDataById
  );

  const validThroughputSteps = chatStepRecords.filter(isStepValidForE2E);
  const { tokenTotals, modelsUsed } = aggregateScopedTokensAndModels(
    chatStepRecords,
    validThroughputSteps,
    { sumAcrossNodes: activeScope === 'tree' }
  );

  const maxContextTokens = latestContextStep?.maxContextTokens || 0;
  const contextTokensUsed =
    latestContextStep?.contextTokensUsed ??
    latestContextStep?.estimatedTokensUsed ??
    0;
  const heuristicTokensUsed =
    latestContextStep?.heuristicTokensUsed ??
    latestContextStep?.estimatedTokensUsed ??
    0;
  const contextUsageRatio =
    maxContextTokens > 0 ? contextTokensUsed / maxContextTokens : 0;

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
      contextTokensUsed,
      estimatedTokensUsed: contextTokensUsed,
      heuristicTokensUsed,
      maxContextTokens,
      plannerMaxOutputTokens,
      usageRatio: contextUsageRatio,
      remainingContextTokens: Math.max(0, maxContextTokens - contextTokensUsed),
      breakdownGroups: latestContextStep?.breakdownGroups || [],
    },
    throughput: buildThroughputPayload(validThroughputSteps, recentWindowSize, {
      activeScope,
      selectedNodeEntries,
    }),
    modelsUsed,
    globalModelRegistry: collectGlobalModelRegistry({
      homeDirPath,
      maxConversations: 60,
    }),
    stepRecords: chatStepRecords,
  };
}
