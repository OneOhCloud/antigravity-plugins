/**
 * @fileoverview Non-blocking host system telemetry collector for CPU usage,
 * load averages, physical memory (macOS Activity Monitor formula / Linux
 * MemAvailable), and filesystem capacity via native Node APIs.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { cpus, freemem, homedir, loadavg, platform, totalmem } from 'node:os';

const VM_STAT_CACHE_TTL_MS = 2000;
const VM_STAT_TIMEOUT_MS = 800;

let prevCpuSnapshot = captureCpuTotals();
let cachedMemSample = { timestampMs: 0, usedBytes: 0, totalBytes: 0 };

function captureCpuTotals() {
  const coreList = cpus() || [];
  let idle = 0;
  let total = 0;
  for (const core of coreList) {
    const t = core.times || {};
    const busy =
      Number(t.user || 0) +
      Number(t.nice || 0) +
      Number(t.sys || 0) +
      Number(t.irq || 0);
    const coreIdle = Number(t.idle || 0);
    idle += coreIdle;
    total += busy + coreIdle;
  }
  return {
    cores: Math.max(1, coreList.length),
    idle,
    total,
  };
}

async function sampleCpuUsagePct() {
  let current = captureCpuTotals();
  let deltaTotal = current.total - prevCpuSnapshot.total;
  let deltaIdle = current.idle - prevCpuSnapshot.idle;

  if (deltaTotal <= 0) {
    await new Promise((resolve) => setTimeout(resolve, 35));
    current = captureCpuTotals();
    deltaTotal = current.total - prevCpuSnapshot.total;
    deltaIdle = current.idle - prevCpuSnapshot.idle;
  }

  prevCpuSnapshot = current;
  if (deltaTotal <= 0) {
    return { cpuUsagePct: 0, cpuCores: current.cores };
  }
  const usedRatio = Math.min(1, Math.max(0, 1 - deltaIdle / deltaTotal));
  return {
    cpuUsagePct: Number((usedRatio * 100).toFixed(1)),
    cpuCores: current.cores,
  };
}

function readDarwinMemoryUsedBytes(totalBytes) {
  try {
    const out = execFileSync('/usr/bin/vm_stat', [], {
      encoding: 'utf-8',
      timeout: VM_STAT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const headerMatch = out.match(/page size of\s+(\d+)\s+bytes/i);
    const pageSize = headerMatch ? Number(headerMatch[1]) : 16384;
    const parsePages = (labelPattern) => {
      const m = out.match(labelPattern);
      return m ? Number(m[1]) : 0;
    };
    const anonymousPages = parsePages(/Anonymous pages:\s+(\d+)/i);
    const purgeablePages = parsePages(/Pages purgeable:\s+(\d+)/i);
    const wiredPages = parsePages(/Pages wired down:\s+(\d+)/i);
    const compressorPages = parsePages(/Pages occupied by compressor:\s+(\d+)/i);
    const appPages = Math.max(0, anonymousPages - purgeablePages);
    const used = (appPages + wiredPages + compressorPages) * pageSize;
    if (used > 0) {
      return Math.min(totalBytes, used);
    }
  } catch {
    // Fallback to totalmem - freemem below
  }
  return Math.max(0, totalBytes - freemem());
}

function readLinuxMemoryUsedBytes(totalBytes) {
  try {
    if (existsSync('/proc/meminfo')) {
      const raw = readFileSync('/proc/meminfo', 'utf-8');
      const availMatch = raw.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (availMatch) {
        const availBytes = Number(availMatch[1]) * 1024;
        return Math.min(totalBytes, Math.max(0, totalBytes - availBytes));
      }
    }
  } catch {
    // Fallback to totalmem - freemem below
  }
  return Math.max(0, totalBytes - freemem());
}

function samplePhysicalMemory() {
  const now = Date.now();
  const totalBytes = totalmem();
  if (
    cachedMemSample.totalBytes === totalBytes &&
    now - cachedMemSample.timestampMs < VM_STAT_CACHE_TTL_MS
  ) {
    return cachedMemSample;
  }

  const osPlatform = platform();
  let usedBytes = Math.max(0, totalBytes - freemem());
  if (osPlatform === 'darwin') {
    usedBytes = readDarwinMemoryUsedBytes(totalBytes);
  } else if (osPlatform === 'linux') {
    usedBytes = readLinuxMemoryUsedBytes(totalBytes);
  }

  cachedMemSample = { timestampMs: now, usedBytes, totalBytes };
  return cachedMemSample;
}

function sampleDiskCapacity(targetPath) {
  try {
    const st = statfsSync(targetPath);
    const blockSize = Number(st.bsize || st.frsize || 4096);
    const totalBytes = Math.max(0, Number(st.blocks || 0) * blockSize);
    const availBytes = Math.max(0, Number(st.bavail ?? st.bfree ?? 0) * blockSize);
    const usedBytes = Math.max(0, totalBytes - availBytes);
    const usagePct =
      totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
    return {
      diskUsedBytes: usedBytes,
      diskAvailBytes: availBytes,
      diskTotalBytes: totalBytes,
      diskUsagePct: Math.min(100, usagePct),
    };
  } catch {
    return {
      diskUsedBytes: 0,
      diskAvailBytes: 0,
      diskTotalBytes: 0,
      diskUsagePct: 0,
    };
  }
}

export async function collectHostSystemMetrics({
  homeDirPath = homedir(),
} = {}) {
  const { cpuUsagePct, cpuCores } = await sampleCpuUsagePct();
  const [rawLoad1, rawLoad5, rawLoad15] = loadavg();
  const loadAvg1m = Number((rawLoad1 || 0).toFixed(2));
  const loadAvg5m = Number((rawLoad5 || 0).toFixed(2));
  const loadAvg15m = Number((rawLoad15 || 0).toFixed(2));
  const loadSaturationPct = Math.min(
    100,
    Number(((loadAvg1m / Math.max(1, cpuCores)) * 100).toFixed(1))
  );

  const mem = samplePhysicalMemory();
  const memUsagePct =
    mem.totalBytes > 0
      ? Math.min(100, Number(((mem.usedBytes / mem.totalBytes) * 100).toFixed(1)))
      : 0;

  const diskTarget = existsSync(homeDirPath) ? homeDirPath : homedir();
  const disk = sampleDiskCapacity(diskTarget);

  return {
    cpuUsagePct,
    cpuCores,
    loadAvg1m,
    loadAvg5m,
    loadAvg15m,
    loadSaturationPct,
    memUsedBytes: mem.usedBytes,
    memTotalBytes: mem.totalBytes,
    memUsagePct,
    ...disk,
  };
}
