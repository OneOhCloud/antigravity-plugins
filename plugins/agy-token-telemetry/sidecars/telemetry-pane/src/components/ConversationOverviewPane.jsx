/**
 * @fileoverview Conversation Panel -> Overview tab (`#pane-overview`), styled
 * exclusively with Tailwind CSS utility classes.
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

function VelocityBarChart({ stepRecords, t }) {
  const { fmtSec } = getI18nBridge();
  const maxBars = 12;

  const validSteps = (Array.isArray(stepRecords) ? stepRecords : [])
    .filter((s) => s.outputTokens > 0 && Number(s.e2eTokPerSec) > 0)
    .slice(-maxBars);

  if (validSteps.length === 0) {
    return (
      <div className="text-[#86868b] text-[11px] py-3 text-center">
        {t('noValidSamples')}
      </div>
    );
  }

  const maxRate = Math.max(
    ...validSteps.map((s) => Number(s.e2eTokPerSec) || 0),
    10
  );

  return (
    <div
      className="h-[76px] w-full flex items-end justify-between gap-0.5 pt-0.5 pb-0.5 select-none"
      role="img"
      aria-label={t('ovRecentTrend')}
    >
      {validSteps.map((step, idx) => {
        const heightPct = Math.max(
          8,
          Math.round(((Number(step.e2eTokPerSec) || 0) / maxRate) * 76)
        );
        const stepLabel = formatStepSpan(step, true);
        const titleText = `Step ${(step.stepIndices || []).join(',')} | ${step.modelDisplayName} (${step.responseModel}): E2E ${step.e2eTokPerSec.toFixed(1)} tok/s · TTFT ${fmtSec(step.timeToFirstTokenSec)}`;
        return (
          <div
            key={`${step.trajectoryId || 'root'}-${step.firstStepIndex}-${idx}`}
            title={titleText}
            className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1"
          >
            <div className="flex-1 w-full flex flex-col items-center justify-end gap-[2px] min-h-0">
              <span className="font-mono text-[9.5px] font-semibold text-[#515154] leading-none tabular-nums shrink-0">
                {Math.round(step.e2eTokPerSec)}
              </span>
              <div
                className="w-full max-w-[18px] min-h-[4px] rounded-[3.5px] bg-[#1d1d1f] shrink-0"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="font-mono text-[8.5px] tracking-[-0.04em] text-[#86868b] leading-none tabular-nums whitespace-nowrap shrink-0">
              {stepLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ConversationOverviewPane({ data, t }) {
  const { fmtInt, fmtCompact, fmtRate, fmtSec, fmtPct } = getI18nBridge();

  const cwState = data?.contextWindowState || {};
  const usedCtx = cwState.estimatedTokensUsed || 0;
  const maxCtx = cwState.maxContextTokens || 0;

  const gridSpec = useMemo(
    () => computeContextWindowGrid(usedCtx, maxCtx),
    [usedCtx, maxCtx]
  );
  const availCtx =
    cwState.availableTokensRemaining ??
    Math.max(0, gridSpec.effectiveMax - usedCtx);

  const tp = data?.throughput || {};
  const latest = tp.latest || null;
  const recent = tp.recentWindow || {};
  const overall = tp.sessionOverall || {};
  const totals = data?.tokenTotals || {};
  const modelsUsed = Array.isArray(data?.modelsUsed) ? data.modelsUsed : [];

  const cells = useMemo(
    () => Array.from({ length: gridSpec.totalCells }, (_, idx) => idx),
    [gridSpec.totalCells]
  );

  const gridTooltip = t('fmtCtxGridTooltip')(
    gridSpec.filledCells,
    gridSpec.totalCells,
    fmtCompact(gridSpec.tokensPerCell),
    fmtCompact(usedCtx),
    fmtCompact(gridSpec.effectiveMax)
  );

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-2 overflow-y-auto overflow-x-hidden"
      id="pane-overview"
    >
      <div className="shrink-0 grid grid-cols-2 gap-2 items-stretch">
        <div className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-2.5 flex flex-col gap-[5px] shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-1.5 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] shrink-0 whitespace-nowrap">
              {t('tkE2ETitle')}
            </span>
            <span
              className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
              id="tkSampleCount"
            >
              {t('fmtValidSamples')(overall.sampleCount || 0)}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[23px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="tkE2ESession"
            >
              {fmtRate(overall.weightedE2ETokPerSec)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              tok/s
            </span>
          </div>
          <div
            className="font-mono text-[9.5px] sm:text-[10.5px] tracking-[-0.04em] text-[#515154] tabular-nums whitespace-nowrap truncate"
            id="tkE2ESub"
          >
            {t('fmtVelocityGroupSub')(
              fmtRate(latest?.e2eTokPerSec),
              fmtRate(recent.weightedE2ETokPerSec),
              fmtSec(latest?.timeToFirstTokenSec)
            )}
          </div>
        </div>

        <div className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-2.5 flex flex-col gap-[5px] shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-1.5 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] shrink-0 whitespace-nowrap">
              {t('tkTotalTitle')}
            </span>
            <span
              className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
              id="tkCacheMeta"
            >
              {t('fmtCacheHit')(fmtPct(totals.cacheHitRate))}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[23px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="tkGrandTotal"
            >
              {fmtCompact(totals.grandTotalTokens)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              tok
            </span>
          </div>
          <div
            className="font-mono text-[9.5px] sm:text-[10.5px] tracking-[-0.04em] text-[#515154] tabular-nums whitespace-nowrap truncate"
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
        className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-3 flex flex-col gap-[7px] shrink-0 min-w-0 min-h-[88px] overflow-hidden"
        id="ovCtxCard"
      >
        <div className="flex items-baseline justify-between gap-1.5 shrink-0">
          <div className="inline-flex items-baseline gap-[6px] shrink-0 whitespace-nowrap">
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
                idx < gridSpec.filledCells ? 'bg-[#1d1d1f]' : 'bg-[#e8e8ed]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('ovRecentTrend')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="ovTrendMeta"
          >
            {t('fmtSessionAvgPeak')(
              fmtRate(overall.weightedE2ETokPerSec),
              fmtRate(overall.peakE2ETokPerSec)
            )}
          </span>
        </div>
        <div id="ovTrendChartSlot">
          <VelocityBarChart stepRecords={data?.stepRecords || []} t={t} />
        </div>
      </div>

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 flex-1 min-h-[96px] max-h-full min-w-0 overflow-hidden">
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
          className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden flex flex-col gap-1.5 pr-0.5"
          id="ovModelsListSlot"
        >
          {modelsUsed.length === 0 ? (
            <div className="text-[#86868b] text-[11px]">
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
                  className="py-[5px] px-0.5 flex flex-col gap-[3px] shrink-0"
                  key={`${m.modelDisplayName}-${m.responseModel}-${m.modelEnum}`}
                >
                  <div className="flex items-baseline justify-between gap-2 min-w-0">
                    <span className="text-[13.5px] font-semibold text-[#1d1d1f] tracking-[-0.01em] truncate">
                      {m.modelDisplayName}
                    </span>
                    <span className="font-mono text-[13.5px] font-bold text-[#1d1d1f] whitespace-nowrap tabular-nums shrink-0">
                      {fmtRate(m.weightedE2ETokPerSec)}{' '}
                      <span className="text-[12px] font-medium text-[#86868b] ml-1">
                        tok/s
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11.5px] tabular-nums min-w-0">
                    <span className="text-[#515154] font-medium truncate">
                      {m.responseModel}{' '}
                      <span className="text-[#86868b] text-[11px] whitespace-nowrap">
                        · {shortEnum}
                      </span>
                    </span>
                    <span className="text-[#86868b] text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0">
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
