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
  const svgHeight = 76;
  const svgWidth = 480;

  const validSteps = (Array.isArray(stepRecords) ? stepRecords : [])
    .filter((s) => s.isValidThroughputSample && Number(s.e2eTokPerSec) > 0)
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
  const padTop = 15;
  const padBottom = 16;
  const chartH = svgHeight - padTop - padBottom;
  const slotW = svgWidth / validSteps.length;
  const barW = Math.min(20, Math.max(8, slotW * 0.44));

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width="100%"
      height={svgHeight}
      preserveAspectRatio="none"
    >
      {validSteps.map((step, idx) => {
        const xCenter = idx * slotW + slotW / 2;
        const hE2E = Math.max(4, (step.e2eTokPerSec / maxRate) * chartH);
        const yE2E = padTop + chartH - hE2E;
        const stepLabel = formatStepSpan(step, true);
        const titleText = `Step ${(step.stepIndices || []).join(',')} | ${step.modelDisplayName} (${step.responseModel}): E2E ${step.e2eTokPerSec.toFixed(1)} tok/s · TTFT ${fmtSec(step.timeToFirstTokenSec)}`;
        return (
          <g key={`${step.trajectoryId || 'root'}-${step.firstStepIndex}-${idx}`}>
            <title>{titleText}</title>
            <rect
              x={(xCenter - barW / 2).toFixed(1)}
              y={yE2E.toFixed(1)}
              width={barW.toFixed(1)}
              height={hE2E.toFixed(1)}
              rx="3.5"
              className="fill-[#1d1d1f]"
            />
            <text
              x={xCenter.toFixed(1)}
              y={(yE2E - 3.2).toFixed(1)}
              textAnchor="middle"
              className="font-mono text-[9.5px] font-semibold fill-[#515154]"
            >
              {Math.round(step.e2eTokPerSec)}
            </text>
            <text
              x={xCenter.toFixed(1)}
              y={svgHeight - 3}
              textAnchor="middle"
              className="font-mono text-[9px] fill-[#86868b]"
            >
              {stepLabel}
            </text>
          </g>
        );
      })}
    </svg>
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
        <div className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-3.5 flex flex-col gap-[5px] shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('tkE2ETitle')}
            </span>
            <span
              className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
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
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="tkE2ESub"
          >
            {t('fmtVelocityGroupSub')(
              fmtRate(latest?.e2eTokPerSec),
              fmtRate(recent.weightedE2ETokPerSec),
              fmtSec(latest?.timeToFirstTokenSec)
            )}
          </div>
        </div>

        <div className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-3.5 flex flex-col gap-[5px] shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('tkTotalTitle')}
            </span>
            <span
              className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
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
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
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
        className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-3.5 flex flex-col gap-[7px] shrink-0 min-w-0 min-h-[88px] overflow-hidden"
        id="ovCtxCard"
      >
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="inline-flex items-baseline gap-[7px] min-w-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
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
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
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
          className="flex-1 w-full min-h-[44px] grid gap-[3px]"
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
              className={`w-full h-full min-h-[8px] rounded-[2.5px] transition-colors duration-150 ${
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
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[#1d1d1f] tracking-[-0.01em]">
                      {m.modelDisplayName}
                    </span>
                    <span className="font-mono text-[13.5px] font-bold text-[#1d1d1f] whitespace-nowrap tabular-nums">
                      {fmtRate(m.weightedE2ETokPerSec)}{' '}
                      <span className="text-[12px] font-medium text-[#86868b] ml-1">
                        tok/s
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11.5px] tabular-nums">
                    <span className="text-[#515154] font-medium">
                      {m.responseModel}{' '}
                      <span className="text-[#86868b] text-[11px] whitespace-nowrap">
                        · {shortEnum}
                      </span>
                    </span>
                    <span className="text-[#86868b] text-[11px] font-mono tabular-nums whitespace-nowrap">
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
