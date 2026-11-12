/**
 * @fileoverview Incremental 3-month global historical token usage aggregator.
 * Scans all local `antigravity` and `antigravity-cli` conversation SQLite
 * databases, persists mtime-keyed daily buckets so unchanged conversations
 * require zero subprocess queries and survive old `.db` cleanup within 92 days,
 * and computes MTD / WTD / Today KPIs with fair trend comparisons plus
 * selectable daily, weekly, and monthly slices.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  APP_SURFACES,
  getGeminiRootDir,
  readGeneratorMetadataFromSqlite,
  readJsonFileSafe,
  readStepTimestampsFromSqlite,
  readStepTimestampsFromTranscript,
} from './sqlite_rpc.mjs';

const LEDGER_VERSION = 1;
const HOT_CACHE_TTL_MS = 5000;
const MAX_RETENTION_DAYS = 92;
const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const memoryResultCache = new Map();
const memoryLedgerByRoot = new Map();

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatLocalDateKey(epochMs) {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function addDaysLocal(baseDate, deltaDays) {
  const next = new Date(baseDate.getTime());
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function emptyBucket() {
  return {
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    responseTokens: 0,
    requestCount: 0,
  };
}

function addBucketInto(target, src) {
  if (!src) return target;
  target.inputTokens += Number(src.inputTokens || 0);
  target.cacheReadTokens += Number(src.cacheReadTokens || 0);
  target.outputTokens += Number(src.outputTokens || 0);
  target.thinkingTokens += Number(src.thinkingTokens || 0);
  target.responseTokens += Number(src.responseTokens || 0);
  target.requestCount += Number(src.requestCount || 0);
  return target;
}

function finalizeBucketTotals(b) {
  const inputTokens = Number(b?.inputTokens || 0);
  const cacheReadTokens = Number(b?.cacheReadTokens || 0);
  const promptTokens = inputTokens + cacheReadTokens;
  const outputTokens = Number(b?.outputTokens || 0);
  const thinkingTokens = Number(b?.thinkingTokens || 0);
  const responseTokens = Number(b?.responseTokens || 0);
  const requestCount = Number(b?.requestCount || 0);
  return {
    totalTokens: promptTokens + outputTokens,
    promptTokens,
    inputTokens,
    cacheReadTokens,
    outputTokens,
    thinkingTokens,
    responseTokens,
    requestCount,
    cacheHitRate: promptTokens > 0 ? cacheReadTokens / promptTokens : 0,
  };
}

function computeDeltaRatio(currentVal, prevVal) {
  if (!Number.isFinite(prevVal) || prevVal <= 0) return null;
  return (currentVal - prevVal) / prevVal;
}

function loadLedgerForRoot(geminiRoot) {
  if (memoryLedgerByRoot.has(geminiRoot)) {
    return memoryLedgerByRoot.get(geminiRoot);
  }
  const ledgerPath = join(
    geminiRoot,
    'config',
    'agy-token-telemetry-history.json'
  );
  const disk = readJsonFileSafe(ledgerPath);
  const conversations =
    disk && disk.version === LEDGER_VERSION && disk.conversations && typeof disk.conversations === 'object'
      ? { ...disk.conversations }
      : {};
  const loaded = { ledgerPath, conversations };
  memoryLedgerByRoot.set(geminiRoot, loaded);
  return loaded;
}

function persistLedgerSafe(ledgerPath, conversations) {
  try {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    writeFileSync(
      ledgerPath,
      JSON.stringify({ version: LEDGER_VERSION, updatedAt: Date.now(), conversations }),
      'utf-8'
    );
  } catch {
    // Non-fatal if filesystem is read-only
  }
}

function buildConversationDayBuckets(dbPath, geminiRoot, convId, fallbackMtimeMs) {
  const genRecords = readGeneratorMetadataFromSqlite(dbPath);
  if (genRecords.length === 0) return {};

  const sqliteTsMap = readStepTimestampsFromSqlite(dbPath);
  let transcriptTsMap = null;
  const buckets = {};

  for (const step of genRecords) {
    if (!step.hasChatModel) continue;
    if (
      step.responseModel === 'unspecified' &&
      step.inputTokens === 0 &&
      step.cacheReadTokens === 0 &&
      step.outputTokens === 0
    ) {
      continue;
    }

    let stepTsMs =
      sqliteTsMap.get(step.firstStepIndex)?.timestampMs ||
      sqliteTsMap.get(step.lastStepIndex)?.timestampMs ||
      0;

    if (!stepTsMs && Array.isArray(step.stepIndices)) {
      for (const idx of step.stepIndices) {
        const hit = sqliteTsMap.get(idx)?.timestampMs;
        if (hit) {
          stepTsMs = hit;
          break;
        }
      }
    }

    if (!stepTsMs) {
      if (!transcriptTsMap) {
        transcriptTsMap = readStepTimestampsFromTranscript(geminiRoot, convId);
      }
      const iso =
        transcriptTsMap.get(step.firstStepIndex) ||
        transcriptTsMap.get(step.lastStepIndex) ||
        '';
      const parsed = iso ? Date.parse(iso) : 0;
      stepTsMs = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMtimeMs;
    }

    const dayKey = formatLocalDateKey(stepTsMs);
    if (!buckets[dayKey]) buckets[dayKey] = emptyBucket();
    const dst = buckets[dayKey];
    dst.inputTokens += step.inputTokens;
    dst.cacheReadTokens += step.cacheReadTokens;
    dst.outputTokens += step.outputTokens;
    dst.thinkingTokens += step.thinkingOutputTokens;
    dst.responseTokens += step.responseOutputTokens;
    dst.requestCount += 1;
  }

  return buckets;
}

function getIsoWeekNumber(dateObj) {
  const tmp = new Date(
    Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
  );
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

function getMondayOf(dateObj) {
  const d = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    0,
    0,
    0,
    0
  );
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

export function collectGlobalTokenHistory({
  homeDirPath = homedir(),
  nowMs = Date.now(),
  forceRefresh = false,
} = {}) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const todayDate = new Date(nowMs);
  const todayMidnight = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
    0,
    0,
    0,
    0
  );
  const todayKey = formatLocalDateKey(todayMidnight.getTime());
  const cacheKey = `${geminiRoot}:${todayKey}`;

  if (!forceRefresh) {
    const hot = memoryResultCache.get(cacheKey);
    if (hot && Date.now() - hot.computedAtMs < HOT_CACHE_TTL_MS) {
      return hot.payload;
    }
  }

  // Cutoff covers both rolling 92 days and full 3 calendar months (current + prev 2)
  const rollingCutoff = addDaysLocal(todayMidnight, -(MAX_RETENTION_DAYS - 1));
  const threeMonthStart = new Date(
    todayMidnight.getFullYear(),
    todayMidnight.getMonth() - 2,
    1,
    0,
    0,
    0,
    0
  );
  const earliestRetainedDate =
    threeMonthStart.getTime() < rollingCutoff.getTime()
      ? threeMonthStart
      : rollingCutoff;
  const earliestKey = formatLocalDateKey(earliestRetainedDate.getTime());

  const ledger = loadLedgerForRoot(geminiRoot);
  let ledgerDirty = false;
  let scannedDbFiles = 0;

  for (const surface of APP_SURFACES) {
    const convDir = join(geminiRoot, surface.id, 'conversations');
    if (!existsSync(convDir)) continue;
    let files = [];
    try {
      files = readdirSync(convDir).filter((f) => f.endsWith('.db'));
    } catch {
      continue;
    }

    for (const file of files) {
      const convId = basename(file, '.db');
      const dbPath = join(convDir, file);
      let dbStat;
      try {
        dbStat = statSync(dbPath);
      } catch {
        continue;
      }
      if (!dbStat || dbStat.size === 0) continue;
      scannedDbFiles += 1;

      const walPath = `${dbPath}-wal`;
      let walMtime = 0;
      try {
        if (existsSync(walPath)) walMtime = statSync(walPath).mtimeMs;
      } catch {
        walMtime = 0;
      }

      const sig = `${Math.round(dbStat.mtimeMs)}:${dbStat.size}:${Math.round(walMtime)}`;
      const entryKey = `${surface.id}:${convId}`;
      const existing = ledger.conversations[entryKey];

      if (!existing || existing.sig !== sig) {
        const rawBuckets = buildConversationDayBuckets(
          dbPath,
          geminiRoot,
          convId,
          dbStat.mtimeMs
        );
        const pruned = {};
        for (const [dKey, b] of Object.entries(rawBuckets)) {
          if (dKey >= earliestKey && dKey <= todayKey) {
            pruned[dKey] = b;
          }
        }
        ledger.conversations[entryKey] = { sig, days: pruned };
        ledgerDirty = true;
      }
    }
  }

  // Prune expired day buckets across all retained ledger entries
  const dailyMap = new Map();
  for (const [entryKey, convEntry] of Object.entries(ledger.conversations)) {
    const dayObj = convEntry?.days || {};
    for (const [dKey, bucket] of Object.entries(dayObj)) {
      if (dKey < earliestKey) {
        delete dayObj[dKey];
        ledgerDirty = true;
        continue;
      }
      if (dKey > todayKey) continue;
      if (!dailyMap.has(dKey)) dailyMap.set(dKey, emptyBucket());
      addBucketInto(dailyMap.get(dKey), bucket);
    }
    if (Object.keys(dayObj).length === 0 && !convEntry?.sig) {
      delete ledger.conversations[entryKey];
      ledgerDirty = true;
    }
  }

  if (ledgerDirty) {
    persistLedgerSafe(ledger.ledgerPath, ledger.conversations);
  }

  const sumRange = (startDate, endDate) => {
    const acc = emptyBucket();
    let activeDays = 0;
    for (
      let cur = new Date(startDate.getTime());
      cur.getTime() <= endDate.getTime();
      cur = addDaysLocal(cur, 1)
    ) {
      const k = formatLocalDateKey(cur.getTime());
      const b = dailyMap.get(k);
      if (b && (b.requestCount > 0 || b.inputTokens > 0 || b.outputTokens > 0)) {
        activeDays += 1;
        addBucketInto(acc, b);
      }
    }
    return { ...finalizeBucketTotals(acc), activeDays };
  };

  // 1. Default Three Periods (Today, WTD, MTD) + Fair Trend Comparisons
  const yesterdayDate = addDaysLocal(todayMidnight, -1);
  const todayStats = sumRange(todayMidnight, todayMidnight);
  const yesterdayStats = sumRange(yesterdayDate, yesterdayDate);

  const thisMonday = getMondayOf(todayMidnight);
  const wtdSpanDays =
    Math.round((todayMidnight.getTime() - thisMonday.getTime()) / 86400000) + 1;
  const prevMonday = addDaysLocal(thisMonday, -7);
  const prevWeekSameEnd = addDaysLocal(prevMonday, wtdSpanDays - 1);
  const wtdStats = sumRange(thisMonday, todayMidnight);
  const prevWtdStats = sumRange(prevMonday, prevWeekSameEnd);

  const thisMonthStart = new Date(
    todayMidnight.getFullYear(),
    todayMidnight.getMonth(),
    1
  );
  const mtdDayOfMonth = todayMidnight.getDate();
  const prevMonthStart = new Date(
    todayMidnight.getFullYear(),
    todayMidnight.getMonth() - 1,
    1
  );
  const prevMonthLastDay = new Date(
    todayMidnight.getFullYear(),
    todayMidnight.getMonth(),
    0
  );
  const prevMonthSameEnd = new Date(
    prevMonthStart.getFullYear(),
    prevMonthStart.getMonth(),
    Math.min(mtdDayOfMonth, prevMonthLastDay.getDate())
  );
  const mtdStats = sumRange(thisMonthStart, todayMidnight);
  const prevMonthSameSpan = sumRange(prevMonthStart, prevMonthSameEnd);
  const prevMonthFull = sumRange(prevMonthStart, prevMonthLastDay);

  let mtdDeltaRatio = null;
  let mtdPrevBaseline = prevMonthSameSpan.totalTokens;
  let mtdComparisonMode = 'same_span';
  if (prevMonthSameSpan.totalTokens > 0) {
    mtdDeltaRatio = computeDeltaRatio(
      mtdStats.totalTokens,
      prevMonthSameSpan.totalTokens
    );
  } else if (prevMonthFull.totalTokens > 0 && prevMonthFull.activeDays > 0) {
    const curDailyAvg =
      mtdStats.totalTokens / Math.max(1, mtdStats.activeDays || mtdDayOfMonth);
    const prevDailyAvg = prevMonthFull.totalTokens / prevMonthFull.activeDays;
    mtdDeltaRatio = computeDeltaRatio(curDailyAvg, prevDailyAvg);
    mtdPrevBaseline = prevMonthFull.totalTokens;
    mtdComparisonMode = 'daily_avg';
  }

  // 2. Daily Slices (Past 92 Days, chronological)
  const days = [];
  for (let i = MAX_RETENTION_DAYS - 1; i >= 0; i -= 1) {
    const d = addDaysLocal(todayMidnight, -i);
    const key = formatLocalDateKey(d.getTime());
    const m = d.getMonth() + 1;
    const dom = d.getDate();
    const totals = finalizeBucketTotals(dailyMap.get(key));
    const prevTotals = days.length > 0 ? days[days.length - 1].totalTokens : 0;
    days.push({
      key,
      zhLabel: `${pad2(m)}月${pad2(dom)}日`,
      zhShort: `${pad2(dom)}日`,
      enLabel: `${EN_MONTHS[m - 1]} ${dom}`,
      enShort: `${m}/${dom}`,
      ...totals,
      deltaRatio: computeDeltaRatio(totals.totalTokens, prevTotals),
    });
  }

  // 3. Weekly Slices (Past ~14 ISO Weeks covering 92 days, chronological)
  const weeks = [];
  const firstWeekMonday = getMondayOf(rollingCutoff);
  for (
    let mon = new Date(firstWeekMonday.getTime());
    mon.getTime() <= thisMonday.getTime();
    mon = addDaysLocal(mon, 7)
  ) {
    const isCurrentWeek = mon.getTime() === thisMonday.getTime();
    const sun = isCurrentWeek ? todayMidnight : addDaysLocal(mon, 6);
    const stats = sumRange(mon, sun);
    const wkNum = getIsoWeekNumber(mon);
    const sm = pad2(mon.getMonth() + 1);
    const sd = pad2(mon.getDate());
    const em = pad2(sun.getMonth() + 1);
    const ed = pad2(sun.getDate());
    const prevWeekTotal =
      weeks.length > 0 ? weeks[weeks.length - 1].totalTokens : 0;
    const deltaRatio = isCurrentWeek
      ? computeDeltaRatio(stats.totalTokens, prevWtdStats.totalTokens)
      : computeDeltaRatio(stats.totalTokens, prevWeekTotal);

    weeks.push({
      key: `${mon.getFullYear()}-W${pad2(wkNum)}`,
      zhLabel: isCurrentWeek
        ? `本周 (${sm}.${sd}—${em}.${ed})`
        : `${wkNum}周 (${sm}.${sd}—${em}.${ed})`,
      zhShort: isCurrentWeek ? '本周' : `${wkNum}周`,
      enLabel: isCurrentWeek
        ? `This Wk (${sm}/${sd}–${em}/${ed})`
        : `W${wkNum} (${sm}/${sd}–${em}/${ed})`,
      enShort: isCurrentWeek ? 'WTD' : `W${wkNum}`,
      ...stats,
      deltaRatio,
    });
  }

  // 4. Monthly Slices (3 Calendar Months: month-2, month-1, current month)
  const months = [];
  for (let offset = 2; offset >= 0; offset -= 1) {
    const mStart = new Date(
      todayMidnight.getFullYear(),
      todayMidnight.getMonth() - offset,
      1
    );
    const isCurMonth = offset === 0;
    const mEnd = isCurMonth
      ? todayMidnight
      : new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
    const stats = sumRange(mStart, mEnd);
    const yr = mStart.getFullYear();
    const mo = mStart.getMonth() + 1;
    const prevMoTotal =
      months.length > 0 ? months[months.length - 1].totalTokens : 0;
    const deltaRatio = isCurMonth
      ? mtdDeltaRatio
      : computeDeltaRatio(stats.totalTokens, prevMoTotal);

    months.push({
      key: `${yr}-${pad2(mo)}`,
      zhLabel: `${yr}年${pad2(mo)}月`,
      zhShort: `${mo}月`,
      enLabel: `${EN_MONTHS[mo - 1]} ${yr}`,
      enShort: EN_MONTHS[mo - 1],
      ...stats,
      deltaRatio,
    });
  }

  const payload = {
    retentionDays: MAX_RETENTION_DAYS,
    earliestDate: earliestKey,
    latestDate: todayKey,
    scannedConversations: scannedDbFiles,
    periods: {
      mtd: {
        key: months[months.length - 1]?.key || '',
        ...mtdStats,
        prevTotalTokens: mtdPrevBaseline,
        deltaRatio: mtdDeltaRatio,
        comparisonMode: mtdComparisonMode,
      },
      wtd: {
        key: weeks[weeks.length - 1]?.key || '',
        ...wtdStats,
        prevTotalTokens: prevWtdStats.totalTokens,
        deltaRatio: computeDeltaRatio(
          wtdStats.totalTokens,
          prevWtdStats.totalTokens
        ),
        comparisonMode: 'same_span',
      },
      today: {
        key: todayKey,
        ...todayStats,
        prevTotalTokens: yesterdayStats.totalTokens,
        deltaRatio: computeDeltaRatio(
          todayStats.totalTokens,
          yesterdayStats.totalTokens
        ),
        comparisonMode: 'prev_day',
      },
    },
    days,
    weeks,
    months,
  };

  memoryResultCache.set(cacheKey, {
    computedAtMs: Date.now(),
    payload,
  });
  return payload;
}
