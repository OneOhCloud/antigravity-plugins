/**
 * @fileoverview Conversation Panel -> Details tab (`#pane-details`), styled
 * exclusively with Tailwind CSS utility classes on a single-color white canvas.
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
      className="flex-1 min-h-0 max-h-full flex flex-col gap-5 overflow-y-auto overflow-x-hidden pr-0.5"
      id="pane-details"
    >
      <div className="flex flex-col gap-3 shrink-0 min-w-0">
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11.5px] text-[#515154] tabular-nums">
            <span>{t('tkInputMixDesc')}</span>
            <span className="font-mono tabular-nums" id="tkInputMixLabel">
              {`${fmtCompact(totals.totalCacheReadTokens)} (${cachePct.toFixed(1)}%) / ${fmtCompact(totals.totalInputTokens)}`}
            </span>
          </div>
          <div className="h-[6px] w-full bg-[#ececef] rounded-full overflow-hidden flex">
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

        <div className="flex flex-col gap-2">
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
          <div className="h-[6px] w-full bg-[#ececef] rounded-full overflow-hidden flex">
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

      <div className="flex flex-col gap-3 flex-1 min-h-[120px] max-h-full min-w-0">
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
          <table className="w-full table-fixed border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="w-[20%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thStep')}
                </th>
                <th className="w-[38%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thModelEndpoint')}
                </th>
                <th className="w-[21%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
                  {t('thCacheOutput')}
                </th>
                <th className="w-[21%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
                  {t('thE2EVelocity')}
                </th>
              </tr>
            </thead>
            <tbody id="tkValidStepsTableBody">
              {validStepsRev.slice(0, 40).map((s, idx) => {
                const stepSpan = formatStepSpan(s);
                const subShortId = String(s.trajectoryId || '').slice(0, 8);
                return (
                  <tr
                    key={`${s.trajectoryId || 'root'}-${s.firstStepIndex}-${idx}`}
                  >
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top font-mono tabular-nums truncate">
                      <div className="truncate">{stepSpan}</div>
                      {s.isSubagent && (
                        <div
                          className="text-[#86868b] text-[10.5px] mt-0.5 truncate"
                          title={`${s.trajectoryDisplayTitle || s.agentRole || ''} (${subShortId})`}
                        >
                          {`L${s.nestingDepth || 1} · ${subShortId}`}
                        </div>
                      )}
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top truncate">
                      <div className="truncate">
                        <strong>{s.modelDisplayName}</strong>
                      </div>
                      <div className="font-mono tabular-nums text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {s.responseModel}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>{`${fmtInt(s.outputTokens)} tok`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5">
                        {t('fmtCacheShort')(fmtCompact(s.cacheReadTokens))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>{`${fmtRate(s.e2eTokPerSec)} tok/s`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5">
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
