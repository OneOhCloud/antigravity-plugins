/**
 * @fileoverview Conversation Panel -> Overview tab (`#pane-overview`), styled
 * exclusively with Tailwind CSS utility classes using Apple HIG single-color
 * pure white layout and top-right host system metrics cluster.
 */

import React, { useMemo } from 'react';
import { formatStepSpan, getI18nBridge } from '../utils.js';

function computeContextWindowGrid(usedTokens, maxTokens) {
  const effectiveMax = maxTokens > 0 ? maxTokens : 256000;
  let tokensPerCell = 2000;
  if (effectiveMax <= 64000) {
    tokensPerCell = 1000;
  } else if (effectiveMax > 320000) {
    tokensPerCell = Math.max(4000, Math.ceil(effectiveMax / 128 / 1000) * 1000);
  }
  const rows = 4;
  const rawCells = Math.max(32, Math.round(effectiveMax / tokensPerCell));
  const cols = Math.max(8, Math.round(rawCells / rows));
  const totalCells = cols * rows;
  const actualTokensPerCell = Math.round(effectiveMax / totalCells);
  const ratio = Math.min(1, Math.max(0, usedTokens / effectiveMax));
  const filledCells =
    usedTokens <= 0
      ? 0
      : Math.min(totalCells, Math.max(1, Math.round(ratio * totalCells)));

  return {
    effectiveMax,
    cols,
    rows,
    totalCells,
    filledCells,
    tokensPerCell: actualTokensPerCell,
    ratio,
  };
}

function VelocityBarChart({ stepRecords, activeScope, treeMode, t }) {
  const { fmtSec } = getI18nBridge();
  const maxBars = 12;

  const validSteps = (Array.isArray(stepRecords) ? stepRecords : [])
    .filter((s) => s.outputTokens > 0 && Number(s.e2eTokPerSec) > 0)
    .slice(-maxBars);

  if (validSteps.length === 0) {
    return (
      <div className="text-[#86868b] text-[11.5px] py-3 text-center">
        {activeScope === 'tree' && treeMode === 'live_1m'
          ? t('noLiveSamples1m')
          : t('noValidSamples')}
      </div>
    );
  }

  const maxRate = Math.max(
    ...validSteps.map((s) => Number(s.e2eTokPerSec) || 0),
    10
  );

  return (
    <div
      className="h-[76px] w-full flex items-end justify-between gap-1 pt-0.5 select-none"
      role="img"
      aria-label={t('ovRecentTrend')}
    >
      {validSteps.map((step, idx) => {
        const heightPct = Math.max(
          10,
          Math.round(((Number(step.e2eTokPerSec) || 0) / maxRate) * 76)
        );
        const stepLabel = formatStepSpan(step, true);
        const titleText = `Step ${(step.stepIndices || []).join(',')} | ${step.modelDisplayName} (${step.responseModel}): E2E ${step.e2eTokPerSec.toFixed(1)} tok/s · TTFT ${fmtSec(step.timeToFirstTokenSec)}`;
        return (
          <div
            key={`${step.trajectoryId || 'root'}-${step.firstStepIndex}-${idx}`}
            title={titleText}
            className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-2"
          >
            <div className="flex-1 w-full flex flex-col items-center justify-end gap-1 min-h-0">
              <span className="font-mono text-[9.5px] font-semibold text-[#515154] leading-none tabular-nums shrink-0">
                {Math.round(step.e2eTokPerSec)}
              </span>
              <div
                className="w-full max-w-[18px] min-h-[4px] rounded-[4px] bg-[#1d1d1f] shrink-0"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="font-mono text-[9px] tracking-[-0.03em] text-[#86868b] leading-none tabular-nums whitespace-nowrap shrink-0">
              {stepLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SystemMetricUnit({ id, label, meta, valueText, barPct }) {
  const clampedPct = Math.min(100, Math.max(0, Number(barPct) || 0));
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-baseline justify-between gap-1 min-w-0">
        <span className="text-[11.5px] font-semibold text-[#515154] whitespace-nowrap">
          {label}
        </span>
        <span className="font-mono text-[10px] text-[#86868b] tabular-nums whitespace-nowrap truncate">
          {meta}
        </span>
      </div>
      <div
        id={id}
        className="font-mono text-[17.5px] font-bold text-[#1d1d1f] tracking-[-0.025em] leading-none tabular-nums whitespace-nowrap"
      >
        {valueText}
      </div>
      <div className="h-1 w-full rounded-full bg-[#ececef] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#1d1d1f]"
          style={{ width: `${clampedPct.toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

export function ConversationOverviewPane({ data, t }) {
  const {
    fmtInt,
    fmtCompact,
    fmtRate,
    fmtSec,
    fmtPct,
    fmtBytesGib,
    fmtMemoryPairGib,
  } = getI18nBridge();

  const cwState = data?.contextWindowState || {};
  const usedCtx = cwState.contextTokensUsed ?? cwState.estimatedTokensUsed ?? 0;
  const heuristicCtx = cwState.heuristicTokensUsed || 0;
  const maxCtx = cwState.maxContextTokens || 0;

  const gridSpec = useMemo(
    () => computeContextWindowGrid(usedCtx, maxCtx),
    [usedCtx, maxCtx]
  );
  const availCtx =
    cwState.remainingContextTokens ??
    Math.max(0, gridSpec.effectiveMax - usedCtx);

  const tp = data?.throughput || {};
  const latest = tp.latest || null;
  const recent = tp.recentWindow || {};
  const overall = tp.sessionOverall || {};
  const totals = data?.tokenTotals || {};
  const sys = data?.systemMetrics || {};
  const modelsUsed = Array.isArray(data?.modelsUsed) ? data.modelsUsed : [];

  const cells = useMemo(
    () => Array.from({ length: gridSpec.totalCells }, (_, idx) => idx),
    [gridSpec.totalCells]
  );

  const divergentHeuristicLabel =
    heuristicCtx > 0 && Math.abs(heuristicCtx - usedCtx) >= 1000
      ? fmtCompact(heuristicCtx)
      : '';

  const gridTooltip = t('fmtCtxGridTooltip')(
    gridSpec.filledCells,
    gridSpec.totalCells,
    fmtCompact(gridSpec.tokensPerCell),
    fmtCompact(usedCtx),
    fmtCompact(gridSpec.effectiveMax),
    divergentHeuristicLabel
  );

  const cpuPct = Number(sys.cpuUsagePct || 0);
  const cpuCores = Number(sys.cpuCores || 0);
  const load1m = Number(sys.loadAvg1m || 0);
  const load5m = Number(sys.loadAvg5m || 0);
  const loadSatPct = Number(sys.loadSaturationPct || 0);
  const memPct = Number(sys.memUsagePct || 0);
  const diskPct = Number(sys.diskUsagePct || 0);

  const isLiveMode = data?.treeMode === 'live_1m';
  const isLive1mTree = data?.activeScope === 'tree' && isLiveMode;

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-5 overflow-y-auto overflow-x-hidden pr-0.5"
      id="pane-overview"
    >
      <div className="shrink-0 grid grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] gap-7 sm:gap-8 items-start min-w-0">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] whitespace-nowrap">
                {isLiveMode ? t('tkE2ETitleLive') : t('tkE2ETitle')}
              </span>
              <span
                className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
                id="tkSampleCount"
              >
                {isLiveMode
                  ? t('fmtValidSamples1m')(overall.sampleCount || 0)
                  : t('fmtValidSamples')(overall.sampleCount || 0)}
              </span>
            </div>
            <div className="leading-none">
              <span
                className="font-mono text-[23px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
                id="tkE2ESession"
              >
                {fmtRate(overall.weightedE2ETokPerSec)}
              </span>
              <span className="text-[11.5px] font-medium text-[#86868b] ml-1">
                tok/s
              </span>
            </div>
            <div
              className="font-mono text-[10px] tracking-[-0.03em] text-[#86868b] tabular-nums whitespace-nowrap truncate"
              id="tkE2ESub"
            >
              {t('fmtVelocityGroupSub')(
                fmtRate(latest?.e2eTokPerSec),
                fmtRate(recent.weightedE2ETokPerSec),
                fmtSec(latest?.timeToFirstTokenSec)
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] whitespace-nowrap">
                {t('tkTotalTitle')}
              </span>
              <span
                className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
                id="tkCacheMeta"
              >
                {isLive1mTree
                  ? t('fmtCacheHit1m')(fmtPct(totals.cacheHitRate))
                  : t('fmtCacheHit')(fmtPct(totals.cacheHitRate))}
              </span>
            </div>
            <div className="leading-none">
              <span
                className="font-mono text-[23px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
                id="tkGrandTotal"
              >
                {fmtCompact(totals.grandTotalTokens)}
              </span>
              <span className="text-[11.5px] font-medium text-[#86868b] ml-1">
                tok
              </span>
            </div>
            <div
              className="font-mono text-[10px] tracking-[-0.03em] text-[#86868b] tabular-nums whitespace-nowrap truncate"
              id="tkPromptSub"
            >
              {t('fmtTotalInOut')(
                fmtCompact(totals.totalPromptTokens),
                fmtCompact(totals.totalOutputTokens)
              )}
            </div>
          </div>
        </div>

        <div
          id="ovSystemCluster"
          className="grid grid-cols-2 gap-x-3 gap-y-3.5 min-w-0 pt-0.5"
        >
          <SystemMetricUnit
            id="sysCpuVal"
            label={t('sysCpuTitle')}
            meta={cpuCores > 0 ? t('fmtCpuCores')(cpuCores) : '-'}
            valueText={`${cpuPct.toFixed(1)}%`}
            barPct={cpuPct}
          />
          <SystemMetricUnit
            id="sysLoadVal"
            label={t('sysLoadTitle')}
            meta={t('fmtLoadSub')(load5m.toFixed(1))}
            valueText={load1m.toFixed(2)}
            barPct={loadSatPct}
          />
          <SystemMetricUnit
            id="sysMemVal"
            label={t('sysMemTitle')}
            meta={fmtMemoryPairGib(sys.memUsedBytes, sys.memTotalBytes)}
            valueText={`${memPct.toFixed(1)}%`}
            barPct={memPct}
          />
          <SystemMetricUnit
            id="sysDiskVal"
            label={t('sysDiskTitle')}
            meta={t('fmtDiskAvail')(fmtBytesGib(sys.diskAvailBytes))}
            valueText={`${diskPct.toFixed(1)}%`}
            barPct={diskPct}
          />
        </div>
      </div>

      <div
        className="flex flex-col gap-3 shrink-0 min-w-0 min-h-[76px]"
        id="ovCtxCard"
      >
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="inline-flex items-baseline gap-1.5 shrink-0 whitespace-nowrap">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] whitespace-nowrap">
              {t('ovContextWindow')}
            </span>
            <span
              className="font-mono text-[13px] font-bold text-[#1d1d1f] leading-none tabular-nums"
              id="ovCtxPct"
            >
              {fmtPct(gridSpec.ratio)}
            </span>
          </div>
          <span
            className="font-mono text-[10.5px] tracking-[-0.03em] text-[#86868b] tabular-nums whitespace-nowrap truncate"
            id="ovCtxMeta"
          >
            {t('fmtContextWindowMeta')(
              fmtCompact(usedCtx),
              fmtCompact(gridSpec.effectiveMax),
              fmtCompact(availCtx),
              fmtCompact(gridSpec.tokensPerCell)
            )}
          </span>
        </div>
        <div
          className="h-[44px] w-full grid gap-[3px]"
          id="ovCtxBar"
          title={gridTooltip}
          style={{
            gridTemplateColumns: `repeat(${gridSpec.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridSpec.rows}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((idx) => (
            <span
              key={idx}
              className={`w-full h-full min-h-[8px] rounded-[2.5px] ${
                idx < gridSpec.filledCells ? 'bg-[#1d1d1f]' : 'bg-[#ececef]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 shrink-0 min-w-0">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('ovRecentTrend')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="ovTrendMeta"
          >
            {isLiveMode
              ? t('fmtLiveAvgPeak')(
                  fmtRate(overall.weightedE2ETokPerSec),
                  fmtRate(overall.peakE2ETokPerSec)
                )
              : t('fmtSessionAvgPeak')(
                  fmtRate(overall.weightedE2ETokPerSec),
                  fmtRate(overall.peakE2ETokPerSec)
                )}
          </span>
        </div>
        <div id="ovTrendChartSlot">
          <VelocityBarChart
            stepRecords={data?.stepRecords || []}
            activeScope={data?.activeScope}
            treeMode={data?.treeMode}
            t={t}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-[96px] max-h-full min-w-0">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('ovModelsTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="ovModelsCountMeta"
          >
            {t('fmtModelsCount')(modelsUsed.length)}
          </span>
        </div>
        <div
          className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden flex flex-col gap-2.5 pr-0.5"
          id="ovModelsListSlot"
        >
          {modelsUsed.length === 0 ? (
            <div className="text-[#86868b] text-[11.5px]">
              {t('noModelsInSession')}
            </div>
          ) : (
            modelsUsed.map((m) => {
              const shortEnum = String(m.modelEnum || '').replace(
                'MODEL_PLACEHOLDER_',
                ''
              );
              return (
                <div
                  className="py-1 flex flex-col gap-1 shrink-0"
                  key={`${m.modelDisplayName}-${m.responseModel}-${m.modelEnum}`}
                >
                  <div className="flex items-baseline justify-between gap-2 min-w-0">
                    <span className="text-[13px] font-semibold text-[#1d1d1f] tracking-[-0.01em] truncate">
                      {m.modelDisplayName}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#1d1d1f] whitespace-nowrap tabular-nums shrink-0">
                      {fmtRate(m.weightedE2ETokPerSec)}{' '}
                      <span className="text-[11.5px] font-medium text-[#86868b] ml-0.5">
                        tok/s
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums min-w-0">
                    <span className="text-[#515154] font-medium truncate">
                      {m.responseModel}{' '}
                      <span className="text-[#86868b] whitespace-nowrap">
                        · {shortEnum}
                      </span>
                    </span>
                    <span className="text-[#86868b] font-mono tabular-nums whitespace-nowrap shrink-0">
                      {t('fmtReqsCache')(
                        fmtInt(m.requestCount),
                        fmtPct(m.cacheHitRate)
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
