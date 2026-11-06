/**
 * @fileoverview Non-invasive telemetry collector for Antigravity conversations.
 * Reads generator metadata (`gen_metadata`), token usage, dual-mode `tok/s`
 * throughput metrics, and runtime configuration (`AGY_CLI_AUTO_COMPACT_OVERRIDE`,
 * `contextWindow`, model endpoint mappings) from read-only Language Server RPCs
 * and local conversation data files.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import {
  decodeGeneratorMetadataProto,
  normalizeStepRecord,
} from './proto_decoder.mjs';

const RPC_TIMEOUT_MS = 4000;
const SQLITE_TIMEOUT_MS = 5000;
const DEFAULT_RECENT_SAMPLE_WINDOW = 5;

const APP_SURFACES = Object.freeze([
  { id: 'antigravity', label: 'Antigravity 2.0 (App)' },
  { id: 'antigravity-cli', label: 'Antigravity CLI (agy)' },
]);

const sqliteFileCache = new Map();

function getGeminiRootDir(customHomeDir) {
  return join(customHomeDir || homedir(), '.gemini');
}

function readJsonFileSafe(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Builds a safe read-only SQLite URI.
 * - If `<dbPath>-wal` exists, uses `?mode=ro` so uncommitted WAL frames are visible.
 * - If `<dbPath>-wal` does not exist, uses `?immutable=1` so SQLite does not fail
 *   with SQLITE_CANTOPEN (14) trying to create `-shm` on a WAL-flagged database.
 */
function buildReadOnlySqliteUri(dbPath) {
  const hasWal = existsSync(`${dbPath}-wal`);
  return hasWal ? `file:${dbPath}?mode=ro` : `file:${dbPath}?immutable=1`;
}

function runSqliteJsonQuery(dbPath, sqlQuery) {
  if (!existsSync(dbPath)) {
    return [];
  }
  const uri = buildReadOnlySqliteUri(dbPath);
  try {
    const out = execFileSync(
      'sqlite3',
      ['-cmd', '.timeout 2000', '-json', uri, sqlQuery],
      {
        encoding: 'utf-8',
        timeout: SQLITE_TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024,
      }
    );
    const trimmed = out.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback to immutable=1 if mode=ro encountered locking contention
    try {
      const fallbackOut = execFileSync(
        'sqlite3',
        ['-json', `file:${dbPath}?immutable=1`, sqlQuery],
        {
          encoding: 'utf-8',
          timeout: SQLITE_TIMEOUT_MS,
          maxBuffer: 32 * 1024 * 1024,
        }
      );
      const trimmed = fallbackOut.trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

/**
 * Calls a read-only Language Server Connect RPC when LS credentials are present.
 */
export async function callLanguageServerRpc(methodName, payload = {}, env = process.env) {
  const lsAddress = env.ANTIGRAVITY_LS_ADDRESS;
  const csrfToken = env.ANTIGRAVITY_CSRF_TOKEN;
  if (!lsAddress || !csrfToken) {
    return null;
  }

  const url = `http://${lsAddress}/exa.language_server_pb.LanguageServerService/${methodName}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrfToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Scans shell profile files (read-only) to see if `AGY_CLI_AUTO_COMPACT_OVERRIDE`
 * or other `AGY_CLI_*` variables are configured in user startup scripts.
 */
function scanShellStartupFilesForAgyEnv(homeDirPath) {
  const candidateFiles = ['.zshenv', '.zprofile', '.zshrc', '.bashrc', '.bash_profile'];
  const shellDefinitions = {};

  for (const fileName of candidateFiles) {
    const fullPath = join(homeDirPath, fileName);
    if (!existsSync(fullPath)) continue;
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(
          /^(?:export\s+)?(AGY_CLI_[A-Z0-9_]+)\s*=\s*(.+)$/
        );
        if (match) {
          const varName = match[1];
          const rawVal = match[2].trim().replace(/^['"]|['"]$/g, '');
          shellDefinitions[varName] = {
            value: rawVal,
            sourceFile: `~/${fileName}`,
          };
        }
      }
    } catch {
      // Ignore unreadable shell startup files
    }
  }

  return shellDefinitions;
}

/**
 * Detects the preferred UI language (`en` or `zh-CN`) from Antigravity / VSCode
 * NLS configuration or host OS environment variables.
 */
export function detectHostLocale(env = process.env) {
  const candidates = [];

  if (env.ANTIGRAVITY_LOCALE) candidates.push(String(env.ANTIGRAVITY_LOCALE));
  if (env.AGY_LOCALE) candidates.push(String(env.AGY_LOCALE));

  if (env.VSCODE_NLS_CONFIG) {
    try {
      const nls = JSON.parse(env.VSCODE_NLS_CONFIG);
      if (nls.locale) candidates.push(String(nls.locale));
      if (nls.userLocale) candidates.push(String(nls.userLocale));
      if (nls.osLocale) candidates.push(String(nls.osLocale));
    } catch {
      // Ignore malformed VSCODE_NLS_CONFIG
    }
  }

  if (env.LC_ALL) candidates.push(String(env.LC_ALL));
  if (env.LC_MESSAGES) candidates.push(String(env.LC_MESSAGES));
  if (env.LANG) candidates.push(String(env.LANG));

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) candidates.push(String(intlLocale));
  } catch {
    // Ignore Intl errors
  }

  for (const raw of candidates) {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned || cleaned === 'c' || cleaned === 'posix' || cleaned.startsWith('c.')) {
      continue;
    }
    if (cleaned.startsWith('zh')) {
      return { hostLocale: 'zh-CN', hostLocaleRaw: raw.trim() };
    }
    if (cleaned.startsWith('en')) {
      return { hostLocale: 'en', hostLocaleRaw: raw.trim() };
    }
  }

  return { hostLocale: 'en', hostLocaleRaw: candidates[0] || 'en-US' };
}

/**
 * Collects runtime environment variables (`AGY_CLI_AUTO_COMPACT_OVERRIDE`),
 * `settings.json` (`contextWindow`, `model`), `config.json`, and model catalog.
 */
export async function collectRuntimeEnvironment({
  homeDirPath = homedir(),
  env = process.env,
} = {}) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const cliSettingsPath = join(geminiRoot, 'antigravity-cli', 'settings.json');
  const globalConfigPath = join(geminiRoot, 'config', 'config.json');

  const cliSettings = readJsonFileSafe(cliSettingsPath) || {};
  const globalConfig = readJsonFileSafe(globalConfigPath) || {};
  const userSettings = globalConfig.userSettings || {};
  const localeInfo = detectHostLocale(env);

  const shellDefs = scanShellStartupFilesForAgyEnv(homeDirPath);
  const processAutoCompact = env.AGY_CLI_AUTO_COMPACT_OVERRIDE;
  const shellAutoCompact = shellDefs.AGY_CLI_AUTO_COMPACT_OVERRIDE;

  let autoCompactValue = null;
  let autoCompactSource = '未设置 (默认自动压缩策略)';
  let autoCompactSourceType = 'unset';
  let autoCompactSourceFile = '';
  if (processAutoCompact !== undefined && processAutoCompact !== '') {
    autoCompactValue = String(processAutoCompact);
    autoCompactSource = '进程环境变量 (process.env)';
    autoCompactSourceType = 'process_env';
  } else if (shellAutoCompact) {
    autoCompactValue = shellAutoCompact.value;
    autoCompactSource = `Shell 配置文件 (${shellAutoCompact.sourceFile})`;
    autoCompactSourceType = 'shell_profile';
    autoCompactSourceFile = shellAutoCompact.sourceFile;
  }

  const activeAgyCliEnvVars = {};
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith('AGY_CLI_') && val !== undefined) {
      activeAgyCliEnvVars[key] = { value: String(val), source: 'process.env' };
    }
  }
  for (const [key, info] of Object.entries(shellDefs)) {
    if (!activeAgyCliEnvVars[key]) {
      activeAgyCliEnvVars[key] = { value: info.value, source: info.sourceFile };
    }
  }

  const configuredContextWindow =
    cliSettings.contextWindow !== undefined && cliSettings.contextWindow !== null
      ? String(cliSettings.contextWindow)
      : null;

  const modelConfigData = await callLanguageServerRpc(
    'GetCascadeModelConfigData',
    {},
    env
  );
  const clientModelConfigs = Array.isArray(modelConfigData?.clientModelConfigs)
    ? modelConfigData.clientModelConfigs.map((m) => ({
        label: String(m.label || ''),
        modelId: String(m.modelId || ''),
        modelEnum: String(m.modelOrAlias?.model || ''),
        remainingFraction:
          typeof m.quotaInfo?.remainingFraction === 'number'
            ? m.quotaInfo.remainingFraction
            : null,
        resetTime: String(m.quotaInfo?.resetTime || ''),
        tagTitle: String(m.tagTitle || ''),
        contextWindowOptions: Array.isArray(m.contextWindowOptions)
          ? m.contextWindowOptions
          : [],
      }))
    : [];

  return {
    hostLocale: localeInfo.hostLocale,
    hostLocaleRaw: localeInfo.hostLocaleRaw,
    autoCompactOverride: {
      envKey: 'AGY_CLI_AUTO_COMPACT_OVERRIDE',
      isSet: autoCompactValue !== null,
      value: autoCompactValue,
      envValue: autoCompactValue,
      displayValue: autoCompactValue !== null ? autoCompactValue : '未设置 (默认开启)',
      source: autoCompactSource,
      sourceType: autoCompactSourceType,
      sourceFile: autoCompactSourceFile,
    },
    contextWindowConfig: {
      settingKey: 'contextWindow',
      isExplicitlySet: configuredContextWindow !== null,
      configuredValue: configuredContextWindow,
      displayValue:
        configuredContextWindow !== null
          ? configuredContextWindow
          : '未显式指定 (跟随模型默认窗口)',
      settingsFilePath: '~/.gemini/antigravity-cli/settings.json',
    },
    cliSettingsSummary: {
      model: String(cliSettings.model || '未设置'),
      agentMode: String(cliSettings.agentMode || '未设置'),
      toolPermission: String(cliSettings.toolPermission || '未设置'),
      artifactReviewMode: String(cliSettings.artifactReviewMode || '未设置'),
      colorScheme: String(cliSettings.colorScheme || '未设置'),
      allowNonWorkspaceAccess: Boolean(cliSettings.allowNonWorkspaceAccess),
    },
    appSettingsSummary: {
      permissionPreset: String(userSettings.permissionPreset || '未设置'),
      autoExecutionPolicy: String(userSettings.autoExecutionPolicy || '未设置'),
      artifactReviewMode: String(userSettings.artifactReviewMode || '未设置'),
      themeMode: String(userSettings.themeMode || '未设置'),
      enableTerminalSandbox: Boolean(userSettings.enableTerminalSandbox),
    },
    activeAgyCliEnvVars,
    clientModelConfigs,
  };
}

/**
 * Lists conversations across both `antigravity` (App) and `antigravity-cli` (CLI).
 */
export function listAvailableConversations({
  homeDirPath = homedir(),
  limit = 50,
} = {}) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const byId = new Map();

  for (const surface of APP_SURFACES) {
    const surfaceDir = join(geminiRoot, surface.id);
    const summaryDbPath = join(surfaceDir, 'conversation_summaries.db');
    const convDir = join(surfaceDir, 'conversations');

    const rows = runSqliteJsonQuery(
      summaryDbPath,
      `SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, status
       FROM conversation_summaries
       ORDER BY last_modified_time DESC
       LIMIT ${Number(limit) || 50};`
    );

    for (const row of rows) {
      const id = String(row.conversation_id || '').trim();
      if (!id) continue;
      const dbFilePath = join(convDir, `${id}.db`);
      if (!existsSync(dbFilePath)) continue;

      byId.set(id, {
        conversationId: id,
        title: String(row.title || '').trim() || `会话 ${id.slice(0, 8)}`,
        preview: String(row.preview || '').trim(),
        stepCount: Number(row.step_count || 0),
        lastModifiedTime: String(row.last_modified_time || ''),
        workspaceUris: String(row.workspace_uris || ''),
        status: String(row.status || ''),
        surfaceId: surface.id,
        surfaceLabel: surface.label,
        dbPath: dbFilePath,
      });
    }

    if (existsSync(convDir)) {
      try {
        const files = readdirSync(convDir).filter((f) => f.endsWith('.db'));
        for (const file of files) {
          const id = basename(file, '.db');
          const dbFilePath = join(convDir, file);
          if (!byId.has(id)) {
            const stat = statSync(dbFilePath);
            byId.set(id, {
              conversationId: id,
              title: `会话 ${id.slice(0, 8)}`,
              preview: '',
              stepCount: 0,
              lastModifiedTime: stat.mtime.toISOString(),
              workspaceUris: '',
              status: '',
              surfaceId: surface.id,
              surfaceLabel: surface.label,
              dbPath: dbFilePath,
            });
          }
        }
      } catch {
        // Ignore directory listing errors
      }
    }
  }

  return Array.from(byId.values())
    .sort((a, b) =>
      String(b.lastModifiedTime).localeCompare(String(a.lastModifiedTime))
    )
    .slice(0, limit);
}

/**
 * Reads `gen_metadata` records directly from a conversation's `.db` file,
 * caching decoded records by file mtime + WAL mtime to avoid redundant subprocesses.
 */
export function readGeneratorMetadataFromSqlite(dbPath) {
  if (!existsSync(dbPath)) {
    return [];
  }
  let cacheKey = '';
  try {
    const dbStat = statSync(dbPath);
    const walPath = `${dbPath}-wal`;
    const walMtime = existsSync(walPath) ? statSync(walPath).mtimeMs : 0;
    cacheKey = `${dbStat.mtimeMs}:${dbStat.size}:${walMtime}`;
    const cached = sqliteFileCache.get(dbPath);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.records;
    }
  } catch {
    // Proceed without cache on stat failure
  }

  const rows = runSqliteJsonQuery(
    dbPath,
    'SELECT idx, hex(data) AS hex_data FROM gen_metadata ORDER BY idx ASC;'
  );
  const records = [];
  for (const row of rows) {
    if (!row.hex_data) continue;
    try {
      const decoded = decodeGeneratorMetadataProto(row.hex_data);
      decoded.metadataIndex = Number(row.idx);
      records.push(decoded);
    } catch {
      // Skip malformed row without failing the entire conversation
    }
  }

  if (cacheKey) {
    sqliteFileCache.set(dbPath, { cacheKey, records });
  }
  return records;
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

  for (const conv of conversations) {
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

      const key = `${step.modelDisplayName}||${step.responseModel}||${step.modelEnum}`;
      if (!registryMap.has(key)) {
        registryMap.set(key, {
          modelDisplayName: step.modelDisplayName,
          responseModel: step.responseModel,
          modelEnum: step.modelEnum,
          apiProvider: step.apiProvider,
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

      const item = registryMap.get(key);
      item.requestCount += 1;
      item.conversationIds.add(conv.conversationId);
      if (step.maxContextTokens > item.maxContextTokens) {
        item.maxContextTokens = step.maxContextTokens;
      }
      item.inputTokens += step.inputTokens;
      item.cacheReadTokens += step.cacheReadTokens;
      item.outputTokens += step.outputTokens;
      item.thinkingOutputTokens += step.thinkingOutputTokens;
      item.responseOutputTokens += step.responseOutputTokens;
      if (step.isValidThroughputSample) {
        item.validSteps.push(step);
      }
    }
  }

  const entries = Array.from(registryMap.values())
    .map((item) => {
      const tp = computeThroughputWindowSummary(item.validSteps);
      const totalPrompt = item.inputTokens + item.cacheReadTokens;
      return {
        modelDisplayName: item.modelDisplayName,
        responseModel: item.responseModel,
        modelEnum: item.modelEnum,
        apiProvider: item.apiProvider,
        maxContextTokens: item.maxContextTokens,
        requestCount: item.requestCount,
        conversationCount: item.conversationIds.size,
        inputTokens: item.inputTokens,
        cacheReadTokens: item.cacheReadTokens,
        totalPromptTokens: totalPrompt,
        cacheHitRate: totalPrompt > 0 ? item.cacheReadTokens / totalPrompt : 0,
        outputTokens: item.outputTokens,
        thinkingOutputTokens: item.thinkingOutputTokens,
        responseOutputTokens: item.responseOutputTokens,
        weightedStreamingTokPerSec: tp.weightedStreamingTokPerSec,
        weightedE2ETokPerSec: tp.weightedE2ETokPerSec,
        meanTtftSec: tp.meanTtftSec,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);

  const totalGlobalPromptTokens =
    totalGlobalInputTokens + totalGlobalCacheReadTokens;

  return {
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
}

/**
 * Reads step timestamps from `transcript.jsonl` if present on disk.
 */
function readStepTimestampsFromTranscript(geminiRoot, conversationId) {
  const timestampsByStep = new Map();
  for (const surface of APP_SURFACES) {
    const transcriptPath = join(
      geminiRoot,
      surface.id,
      'brain',
      conversationId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );
    if (!existsSync(transcriptPath)) continue;
    try {
      const content = readFileSync(transcriptPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (
          typeof parsed.step_index === 'number' &&
          typeof parsed.created_at === 'string'
        ) {
          timestampsByStep.set(parsed.step_index, parsed.created_at);
        }
      }
    } catch {
      // Ignore transcript parse errors
    }
  }
  return timestampsByStep;
}

/**
 * Computes throughput summary (`tok/s`) for a given slice of valid step records.
 */
function computeThroughputWindowSummary(validSteps) {
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

/**
 * Resolves the database path and surface info for a given conversation ID.
 */
function findConversationDbOnDisk(geminiRoot, conversationId) {
  for (const surface of APP_SURFACES) {
    const candidate = join(
      geminiRoot,
      surface.id,
      'conversations',
      `${conversationId}.db`
    );
    if (existsSync(candidate)) {
      return {
        dbPath: candidate,
        surfaceId: surface.id,
        surfaceLabel: surface.label,
      };
    }
  }
  return null;
}

/**
 * Collects full token usage, `gen_metadata` model/endpoint mappings, dual-mode
 * `tok/s` throughput, and contextWindow metrics for a conversation.
 */
export async function collectConversationTelemetry(
  conversationId,
  {
    homeDirPath = homedir(),
    env = process.env,
    recentWindowSize = DEFAULT_RECENT_SAMPLE_WINDOW,
  } = {}
) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const availableConversations = listAvailableConversations({
    homeDirPath,
    limit: 60,
  });

  const targetId =
    conversationId ||
    env.ANTIGRAVITY_CONVERSATION_ID ||
    availableConversations[0]?.conversationId ||
    '';

  const runtimeEnv = await collectRuntimeEnvironment({ homeDirPath, env });
  const modelCatalogByEnum = new Map();
  const modelCatalogByLabel = new Map();
  for (const m of runtimeEnv.clientModelConfigs) {
    if (m.modelEnum) modelCatalogByEnum.set(m.modelEnum, m);
    if (m.label) modelCatalogByLabel.set(m.label, m);
  }

  if (!targetId) {
    return {
      conversationId: '',
      conversationMeta: null,
      dataSource: 'none',
      collectedAt: new Date().toISOString(),
      runtimeEnv,
      availableConversations,
      tokenTotals: null,
      contextWindowState: null,
      throughput: null,
      modelsUsed: [],
      stepRecords: [],
    };
  }

  const matchedConv =
    availableConversations.find((c) => c.conversationId === targetId) || null;
  const diskInfo =
    matchedConv || findConversationDbOnDisk(geminiRoot, targetId);

  let rawStepRecords = [];
  let dataSource = 'none';

  // Channel 1: Try Language Server GetCascadeTrajectoryGeneratorMetadata RPC
  const rpcData = await callLanguageServerRpc(
    'GetCascadeTrajectoryGeneratorMetadata',
    { cascadeId: targetId },
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
    dataSource = 'language_server_rpc';
  }

  // Channel 2: Read from local SQLite conversation `.db` if RPC was empty or unavailable
  if (rawStepRecords.length === 0 && diskInfo?.dbPath) {
    rawStepRecords = readGeneratorMetadataFromSqlite(diskInfo.dbPath);
    if (rawStepRecords.length > 0) {
      dataSource = `sqlite_gen_metadata (${diskInfo.surfaceId})`;
    }
  }

  const timestampsByStep = readStepTimestampsFromTranscript(
    geminiRoot,
    targetId
  );

  // Filter chatModel generation records and enrich with catalog & timestamps
  let plannerMaxOutputTokens = 0;
  const chatStepRecords = [];

  for (const rec of rawStepRecords) {
    if (rec.plannerMaxOutputTokens > plannerMaxOutputTokens) {
      plannerMaxOutputTokens = rec.plannerMaxOutputTokens;
    }
    if (!rec.hasChatModel) {
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

    chatStepRecords.push({
      ...rec,
      configuredModelId: catalogEntry?.modelId || '',
      remainingQuotaFraction:
        catalogEntry?.remainingFraction !== undefined
          ? catalogEntry.remainingFraction
          : null,
      quotaResetTime: catalogEntry?.resetTime || '',
      createdAt: timestamp,
    });
  }

  // Token Totals Aggregation
  let totalInputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalOutputTokens = 0;
  let totalThinkingOutputTokens = 0;
  let totalResponseOutputTokens = 0;
  let totalRetryCount = 0;

  const modelGroupsMap = new Map();
  let latestContextStep = null;

  for (const step of chatStepRecords) {
    totalInputTokens += step.inputTokens;
    totalCacheReadTokens += step.cacheReadTokens;
    totalCacheWriteTokens += step.cacheWriteTokens;
    totalOutputTokens += step.outputTokens;
    totalThinkingOutputTokens += step.thinkingOutputTokens;
    totalResponseOutputTokens += step.responseOutputTokens;
    totalRetryCount += step.retryCount;

    if (step.maxContextTokens > 0 || step.estimatedTokensUsed > 0) {
      latestContextStep = step;
    }

    if (
      step.responseModel === 'unspecified' &&
      step.inputTokens === 0 &&
      step.outputTokens === 0
    ) {
      continue;
    }

    const modelKey = `${step.modelDisplayName}||${step.responseModel}||${step.modelEnum}`;
    if (!modelGroupsMap.has(modelKey)) {
      modelGroupsMap.set(modelKey, {
        modelDisplayName: step.modelDisplayName,
        responseModel: step.responseModel,
        configuredModelId: step.configuredModelId,
        modelEnum: step.modelEnum,
        apiProvider: step.apiProvider,
        remainingQuotaFraction: step.remainingQuotaFraction,
        quotaResetTime: step.quotaResetTime,
        requestCount: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0,
        thinkingOutputTokens: 0,
        responseOutputTokens: 0,
        validSteps: [],
      });
    }

    const group = modelGroupsMap.get(modelKey);
    group.requestCount += 1;
    group.inputTokens += step.inputTokens;
    group.cacheReadTokens += step.cacheReadTokens;
    group.outputTokens += step.outputTokens;
    group.thinkingOutputTokens += step.thinkingOutputTokens;
    group.responseOutputTokens += step.responseOutputTokens;
    if (step.isValidThroughputSample) {
      group.validSteps.push(step);
    }
  }

  const totalPromptTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalPromptTokens > 0 ? totalCacheReadTokens / totalPromptTokens : 0;

  const modelsUsed = Array.from(modelGroupsMap.values()).map((g) => {
    const throughputSummary = computeThroughputWindowSummary(g.validSteps);
    const totalGroupPrompt = g.inputTokens + g.cacheReadTokens;
    return {
      modelDisplayName: g.modelDisplayName,
      responseModel: g.responseModel,
      configuredModelId: g.configuredModelId,
      modelEnum: g.modelEnum,
      apiProvider: g.apiProvider,
      remainingQuotaFraction: g.remainingQuotaFraction,
      quotaResetTime: g.quotaResetTime,
      requestCount: g.requestCount,
      validSampleCount: throughputSummary.sampleCount,
      inputTokens: g.inputTokens,
      cacheReadTokens: g.cacheReadTokens,
      totalPromptTokens: totalGroupPrompt,
      cacheHitRate: totalGroupPrompt > 0 ? g.cacheReadTokens / totalGroupPrompt : 0,
      outputTokens: g.outputTokens,
      thinkingOutputTokens: g.thinkingOutputTokens,
      responseOutputTokens: g.responseOutputTokens,
      weightedStreamingTokPerSec: throughputSummary.weightedStreamingTokPerSec,
      meanStreamingTokPerSec: throughputSummary.meanStreamingTokPerSec,
      weightedE2ETokPerSec: throughputSummary.weightedE2ETokPerSec,
      meanE2ETokPerSec: throughputSummary.meanE2ETokPerSec,
      meanTtftSec: throughputSummary.meanTtftSec,
    };
  }).sort((a, b) => b.requestCount - a.requestCount);

  // Valid throughput samples (ordered chronologically)
  const validThroughputSteps = chatStepRecords.filter(
    (s) => s.isValidThroughputSample
  );
  const latestValidStep =
    validThroughputSteps.length > 0
      ? validThroughputSteps[validThroughputSteps.length - 1]
      : null;
  const recentValidSteps = validThroughputSteps.slice(-recentWindowSize);

  const recentWindowSummary = computeThroughputWindowSummary(recentValidSteps);
  const sessionThroughputSummary =
    computeThroughputWindowSummary(validThroughputSteps);

  const maxContextTokens = latestContextStep?.maxContextTokens || 0;
  const estimatedTokensUsed = latestContextStep?.estimatedTokensUsed || 0;
  const contextUsageRatio =
    maxContextTokens > 0 ? estimatedTokensUsed / maxContextTokens : 0;

  const globalModelRegistry = collectGlobalModelRegistry({
    homeDirPath,
    maxConversations: 60,
  });

  return {
    conversationId: targetId,
    conversationMeta: matchedConv || {
      conversationId: targetId,
      title: `会话 ${targetId.slice(0, 8)}`,
      surfaceId: diskInfo?.surfaceId || 'antigravity',
      surfaceLabel: diskInfo?.surfaceLabel || 'Antigravity 2.0 (App)',
      stepCount: chatStepRecords.length,
    },
    dataSource,
    collectedAt: new Date().toISOString(),
    runtimeEnv,
    availableConversations,
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
    contextWindowState: {
      cliConfiguredValue: runtimeEnv.contextWindowConfig.configuredValue,
      cliDisplayValue: runtimeEnv.contextWindowConfig.displayValue,
      estimatedTokensUsed,
      maxContextTokens,
      plannerMaxOutputTokens,
      usageRatio: contextUsageRatio,
      remainingContextTokens: Math.max(0, maxContextTokens - estimatedTokensUsed),
      breakdownGroups: latestContextStep?.breakdownGroups || [],
    },
    throughput: {
      recentWindowSize,
      latest: latestValidStep
        ? {
            stepIndices: latestValidStep.stepIndices,
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
      recentWindow: recentWindowSummary,
      sessionOverall: sessionThroughputSummary,
    },
    modelsUsed,
    globalModelRegistry,
    stepRecords: chatStepRecords,
  };
}
