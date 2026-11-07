/**
 * @fileoverview Conversation Panel -> Details tab (`#pane-details`), styled
 * exclusively with Tailwind CSS utility classes.
 */

import React from 'react';
import { formatStepSpan, getI18nBridge } from '../utils.js';

export function ConversationDetailsPane({ data, t }) {
  const { fmtInt, fmtCompact, fmtRate, fmtSec } = getI18nBridge();
  const totals = data?.tokenTotals || {};

  const promptTotal = Math.max(1, totals.totalPromptTokens || 0);
  const cachePct =
    totals.totalPromptTokens > 0
      ? (totals.totalCacheReadTokens / promptTotal) * 100
      : 0;
  const freshPct =
    totals.totalPromptTokens > 0
      ? (totals.totalInputTokens / promptTotal) * 100
      : 0;

  const outTotal = Math.max(1, totals.totalOutputTokens || 0);
  const thinkPct =
    totals.totalOutputTokens > 0
      ? (totals.totalThinkingOutputTokens / outTotal) * 100
      : 0;
  const respPct =
    totals.totalOutputTokens > 0
      ? (totals.totalResponseOutputTokens / outTotal) * 100
      : 0;

  const validStepsRev = (
    Array.isArray(data?.stepRecords) ? data.stepRecords : []
  )
    .filter((s) => s.outputTokens > 0 && Number(s.e2eTokPerSec) > 0)
    .slice()
    .reverse();

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-2 overflow-hidden"
      id="pane-details"
    >
      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('tkMixTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="tkTotalRequests"
          >
            {t('fmtReqsRetries')(
              totals.totalRequests || 0,
              totals.totalRetryCount || 0
            )}
          </span>
        </div>

        <div className="flex flex-col gap-[5px]">
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11.5px] text-[#515154] tabular-nums">
            <span>{t('tkInputMixDesc')}</span>
            <span className="font-mono tabular-nums" id="tkInputMixLabel">
              {`${fmtCompact(totals.totalCacheReadTokens)} (${cachePct.toFixed(1)}%) / ${fmtCompact(totals.totalInputTokens)}`}
            </span>
          </div>
          <div className="h-[7px] w-full bg-[#e8e8ed] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#1d1d1f]"
              id="tkCacheBar"
              style={{ width: `${cachePct.toFixed(1)}%` }}
            />
            <div
              className="h-full bg-[#86868b]"
              id="tkFreshInputBar"
              style={{ width: `${freshPct.toFixed(1)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[5px]">
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11.5px] text-[#515154] tabular-nums">
            <span>{t('tkOutputMixDesc')}</span>
            <span className="font-mono tabular-nums" id="tkOutputMixLabel">
              {t('fmtThinkRespMix')(
                fmtCompact(totals.totalThinkingOutputTokens),
                thinkPct.toFixed(1),
                fmtCompact(totals.totalResponseOutputTokens)
              )}
            </span>
          </div>
          <div className="h-[7px] w-full bg-[#e8e8ed] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#1d1d1f]"
              id="tkThinkingBar"
              style={{ width: `${thinkPct.toFixed(1)}%` }}
            />
            <div
              className="h-full bg-[#86868b]"
              id="tkResponseBar"
              style={{ width: `${respPct.toFixed(1)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 flex-1 min-h-0 max-h-full min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('tkValidListTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="tkValidListMeta"
          >
            {t('fmtValidReqsCount')(validStepsRev.length)}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thStep')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thModelEndpoint')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thCacheOutput')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thE2EVelocity')}
                </th>
              </tr>
            </thead>
            <tbody id="tkValidStepsTableBody">
              {validStepsRev.slice(0, 40).map((s, idx) => {
                const stepSpan = formatStepSpan(s);
                const subShortId = String(s.trajectoryId || '').slice(0, 8);
                return (
                  <tr key={`${s.trajectoryId || 'root'}-${s.firstStepIndex}-${idx}`}>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top font-mono tabular-nums">
                      <div>{stepSpan}</div>
                      {s.isSubagent && (
                        <div
                          className="text-[#86868b] text-[11px]"
                          title={`${s.trajectoryDisplayTitle || s.agentRole || ''} (${subShortId})`}
                        >
                          {`L${s.nestingDepth || 1} · ${subShortId}`}
                        </div>
                      )}
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top">
                      <div>
                        <strong>{s.modelDisplayName}</strong>
                      </div>
                      <div className="font-mono tabular-nums text-[#86868b] text-[11px]">
                        {s.responseModel}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>{`${fmtInt(s.outputTokens)} tok`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {t('fmtCacheShort')(fmtCompact(s.cacheReadTokens))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>{`${fmtRate(s.e2eTokPerSec)} tok/s`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {t('fmtTtftShort')(fmtSec(s.timeToFirstTokenSec))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
