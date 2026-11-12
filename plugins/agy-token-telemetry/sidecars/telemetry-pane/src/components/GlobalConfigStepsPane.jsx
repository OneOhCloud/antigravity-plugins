/**
 * @fileoverview Global Panel -> Config & Steps tab (`#pane-steps`), styled
 * exclusively with Tailwind CSS utility classes on a single-color white canvas.
 */

import React from 'react';
import {
  formatAutoCompactSource,
  formatStepSpan,
  getI18nBridge,
} from '../utils.js';

export function GlobalConfigStepsPane({ data, t }) {
  const { fmtInt, fmtCompact, fmtRate, fmtSec } = getI18nBridge();

  const env = data?.runtimeEnv || {};
  const ac = env.autoCompactOverride || {};
  const cwCfg = env.contextWindowConfig || {};
  const cwState = data?.contextWindowState || {};
  const maxCtx = cwState.maxContextTokens || 0;
  const acVal = ac.value ?? ac.envValue ?? null;

  const steps = (Array.isArray(data?.stepRecords) ? data.stepRecords : [])
    .slice()
    .reverse();

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-5 overflow-y-auto overflow-x-hidden pr-0.5"
      id="pane-steps"
    >
      <div className="shrink-0 grid grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('stAutoCompactTitle')}
            </span>
            <span
              className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
              id="stDataSource"
            >
              AUTO_COMPACT
            </span>
          </div>
          <div
            className="font-mono text-[22px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
            id="stAutoCompactVal"
          >
            {acVal !== null && acVal !== undefined
              ? String(acVal)
              : t('defaultOn')}
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="stAutoCompactSrc"
          >
            {formatAutoCompactSource(ac, t)}
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('stContextWinTitle')}
            </span>
            <span className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate">
              contextWindow
            </span>
          </div>
          <div
            className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
            id="stContextWinVal"
          >
            {maxCtx > 0
              ? fmtCompact(maxCtx)
              : cwCfg.configuredValue || t('defaultVal')}
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="stPlannerMaxOut"
          >
            {t('fmtMaxStepOut')(
              cwState.plannerMaxOutputTokens > 0
                ? fmtCompact(cwState.plannerMaxOutputTokens)
                : '-',
              cwCfg.configuredValue ? t('overridden') : t('notOverridden')
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-[120px] max-h-full min-w-0">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('stStepsLogTitle')}
          </span>
          <span
            className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
            id="stStepsCount"
          >
            {t('fmtStepsCount')(steps.length)}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="w-[19%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thStep')}
                </th>
                <th className="w-[33%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thModelEndpoint')}
                </th>
                <th className="w-[22%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
                  {t('thOutputTtft')}
                </th>
                <th className="w-[26%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
                  {t('thE2EVelocity')}
                </th>
              </tr>
            </thead>
            <tbody id="stStepsTableBody">
              {steps.slice(0, 40).map((s, idx) => {
                const stepSpan = formatStepSpan(s);
                const subShortId = String(s.trajectoryId || '').slice(0, 8);
                const subBadge = s.isSubagent
                  ? `L${s.nestingDepth || 1} · ${subShortId}`
                  : '';
                const retryLabel =
                  s.retryCount > 0 ? t('fmtRetryBadge')(s.retryCount) : '';
                const stepSubText = [subBadge, retryLabel]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <tr
                    key={`${s.trajectoryId || 'root'}-${s.firstStepIndex}-${idx}`}
                  >
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top font-mono tabular-nums truncate">
                      <div className="truncate">{stepSpan}</div>
                      <div
                        className="text-[#86868b] text-[10.5px] mt-0.5 truncate"
                        title={s.trajectoryDisplayTitle || s.agentRole || ''}
                      >
                        {stepSubText}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top truncate">
                      <div className="truncate">
                        <strong>{s.modelDisplayName}</strong>
                      </div>
                      <div className="font-mono tabular-nums text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {s.responseModel}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-1 align-top text-right whitespace-nowrap font-mono tabular-nums truncate">
                      <div className="truncate">
                        <strong>{`${fmtCompact(s.outputTokens)} tok`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {t('fmtTtftShort')(fmtSec(s.timeToFirstTokenSec))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-1 align-top text-right whitespace-nowrap font-mono tabular-nums truncate">
                      <div className="truncate">
                        <strong>{`${fmtRate(s.e2eTokPerSec)} tok/s`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {t('fmtThinkRespShort')(
                          fmtCompact(s.thinkingOutputTokens),
                          fmtCompact(s.responseOutputTokens)
                        )}
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
