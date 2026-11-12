/**
 * @fileoverview Read-only SQLite query helpers, WAL-aware URI builder,
 * trajectory/generator metadata decoders with mtime caching, and Connect RPC
 * client for the Antigravity Language Server.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  decodeCheckpointStepMetadata,
  decodeGeneratorMetadataProto,
  decodeStepTimestampMetadata,
  decodeTrajectoryHierarchyMetadata,
} from './proto_decoder.mjs';

const RPC_TIMEOUT_MS = 4000;
const SQLITE_TIMEOUT_MS = 5000;

export const APP_SURFACES = Object.freeze([
  { id: 'antigravity', label: 'Antigravity 2.0 (App)' },
  { id: 'antigravity-cli', label: 'Antigravity CLI (agy)' },
]);

const sqliteFileCache = new Map();
const sqliteCheckpointCache = new Map();
const sqliteHierarchyCache = new Map();
const sqliteStepTimestampCache = new Map();
const transcriptFileCache = new Map();

export function getGeminiRootDir(customHomeDir) {
  return join(customHomeDir || homedir(), '.gemini');
}

export function readJsonFileSafe(filePath) {
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
export function buildReadOnlySqliteUri(dbPath) {
  const hasWal = existsSync(`${dbPath}-wal`);
  return hasWal ? `file:${dbPath}?mode=ro` : `file:${dbPath}?immutable=1`;
}

export function runSqliteJsonQuery(dbPath, sqlQuery) {
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
        stdio: ['ignore', 'pipe', 'ignore'],
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
          stdio: ['ignore', 'pipe', 'ignore'],
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
export async function callLanguageServerRpc(
  methodName,
  payload = {},
  env = process.env
) {
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
 * Reads `trajectory_metadata_blob` from a conversation `.db` file as a fallback
 * when `conversation_summaries.db` does not have hierarchy metadata for that file.
 */
export function readTrajectoryHierarchyFromSqlite(dbPath) {
  const emptyHierarchy = {
    parentConversationId: '',
    rootConversationId: '',
    nestingDepth: 0,
    agentName: '',
    agentRole: '',
    projectId: '',
    workspaceUris: [],
  };
  if (!existsSync(dbPath)) {
    return emptyHierarchy;
  }
  try {
    const dbStat = statSync(dbPath);
    if (dbStat.size === 0) {
      return emptyHierarchy;
    }
    const cacheKey = `${dbStat.mtimeMs}:${dbStat.size}`;
    const cached = sqliteHierarchyCache.get(dbPath);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.hierarchy;
    }
    const rows = runSqliteJsonQuery(
      dbPath,
      'SELECT hex(data) AS hex_data FROM trajectory_metadata_blob WHERE id = "main" LIMIT 1;'
    );
    const hexData = rows[0]?.hex_data || '';
    const hierarchy = decodeTrajectoryHierarchyMetadata(hexData);
    sqliteHierarchyCache.set(dbPath, { cacheKey, hierarchy });
    return hierarchy;
  } catch {
    return emptyHierarchy;
  }
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
    if (dbStat.size === 0) {
      return [];
    }
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
 * Reads the latest completed `CORTEX_STEP_TYPE_CHECKPOINT` (`step_type = 23`)
 * step from a conversation's SQLite `steps` table (or `transcript.jsonl` fallback),
 * caching by file mtime + WAL mtime.
 */
export function readLatestCheckpointFromSqlite(
  dbPath,
  geminiRoot = '',
  conversationId = ''
) {
  if (dbPath && existsSync(dbPath)) {
    let cacheKey = '';
    try {
      const dbStat = statSync(dbPath);
      if (dbStat.size > 0) {
        const walPath = `${dbPath}-wal`;
        const walMtime = existsSync(walPath) ? statSync(walPath).mtimeMs : 0;
        cacheKey = `${dbStat.mtimeMs}:${dbStat.size}:${walMtime}`;
        const cached = sqliteCheckpointCache.get(dbPath);
        if (cached && cached.cacheKey === cacheKey) {
          return cached.checkpoint;
        }
      }
    } catch {
      // Proceed without cache on stat failure
    }

    const rows = runSqliteJsonQuery(
      dbPath,
      'SELECT idx, status, hex(metadata) AS hex_meta FROM steps WHERE step_type = 23 AND status IN (3, 5) ORDER BY idx DESC LIMIT 1;'
    );
    const row = rows[0];
    let checkpoint = null;
    if (row && row.idx !== undefined) {
      try {
        checkpoint = decodeCheckpointStepMetadata(
          row.hex_meta || '',
          Number(row.idx)
        ) || {
          stepIndex: Number(row.idx),
          createdAt: '',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          thinkingOutputTokens: 0,
          responseOutputTokens: 0,
        };
      } catch {
        checkpoint = null;
      }
    }
    if (cacheKey) {
      sqliteCheckpointCache.set(dbPath, { cacheKey, checkpoint });
    }
    if (checkpoint) {
      return checkpoint;
    }
  }

  if (geminiRoot && conversationId) {
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
        let latestCp = null;
        for (const line of content.split(/\r?\n/)) {
          if (!line.includes('"CHECKPOINT"')) continue;
          const parsed = JSON.parse(line);
          if (parsed.type === 'CHECKPOINT' && parsed.status === 'DONE') {
            const outTok = Number(parsed.output_tokens || 0);
            latestCp = {
              stepIndex: Number(parsed.step_index),
              createdAt: String(parsed.created_at || ''),
              inputTokens: Number(parsed.input_tokens || 0),
              outputTokens: outTok,
              cacheReadTokens: Number(parsed.cache_read_tokens || 0),
              thinkingOutputTokens: 0,
              responseOutputTokens: outTok,
            };
          }
        }
        if (latestCp) return latestCp;
      } catch {
        // Ignore transcript parse errors
      }
    }
  }

  return null;
}

/**
 * Reads step timestamps from `transcript.jsonl` if present on disk,
 * caching by `mtimeMs:size` for fast 1s polling.
 */
export function readStepTimestampsFromTranscript(geminiRoot, conversationId) {
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
      const st = statSync(transcriptPath);
      const cacheKey = `${st.mtimeMs}:${st.size}`;
      const cached = transcriptFileCache.get(transcriptPath);
      if (cached && cached.cacheKey === cacheKey) {
        return cached.map;
      }
      const timestampsByStep = new Map();
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
      transcriptFileCache.set(transcriptPath, {
        cacheKey,
        map: timestampsByStep,
      });
      return timestampsByStep;
    } catch {
      // Ignore transcript parse errors
    }
  }
  return new Map();
}

/**
 * Reads per-step timestamps from SQLite `steps.metadata` header slices (`tag 1`
 * `createdAt` and `tag 8` `completedAt`), cached by `mtimeMs:size:walMtime`.
 */
export function readStepTimestampsFromSqlite(dbPath) {
  if (!dbPath || !existsSync(dbPath)) {
    return new Map();
  }
  let cacheKey = '';
  try {
    const dbStat = statSync(dbPath);
    if (dbStat.size === 0) return new Map();
    const walPath = `${dbPath}-wal`;
    const walMtime = existsSync(walPath) ? statSync(walPath).mtimeMs : 0;
    cacheKey = `${dbStat.mtimeMs}:${dbStat.size}:${walMtime}`;
    const cached = sqliteStepTimestampCache.get(dbPath);
    if (cached && cached.cacheKey === cacheKey) {
      return cached.map;
    }
  } catch {
    // Proceed without cache on stat failure
  }

  const rows = runSqliteJsonQuery(
    dbPath,
    'SELECT idx, hex(substr(metadata, 1, 64)) AS hex_meta FROM steps;'
  );
  const map = new Map();
  for (const row of rows) {
    if (row.idx === undefined || !row.hex_meta) continue;
    try {
      const decoded = decodeStepTimestampMetadata(row.hex_meta);
      if (decoded.timestampMs > 0) {
        map.set(Number(row.idx), decoded);
      }
    } catch {
      // Ignore malformed step metadata header
    }
  }

  if (cacheKey) {
    sqliteStepTimestampCache.set(dbPath, { cacheKey, map });
  }
  return map;
}

/**
 * Resolves the database path and surface info for a given conversation ID.
 */
export function findConversationDbOnDisk(geminiRoot, conversationId) {
  for (const surface of APP_SURFACES) {
    const candidate = join(
      geminiRoot,
      surface.id,
      'conversations',
      `${conversationId}.db`
    );
    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).size === 0) continue;
      } catch {
        continue;
      }
      return {
        dbPath: candidate,
        surfaceId: surface.id,
        surfaceLabel: surface.label,
      };
    }
  }
  return null;
}
