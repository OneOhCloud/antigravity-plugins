/**
 * @fileoverview Global Panel -> Config & Steps tab (`#pane-steps`), styled
 * exclusively with Tailwind CSS utility classes.
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
      className="flex-1 min-h-0 max-h-full flex flex-col gap-2 overflow-hidden"
      id="pane-steps"
    >
      <div className="shrink-0 grid grid-cols-2 gap-2 items-stretch">
        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('stAutoCompactTitle')}
            </span>
            <span
              className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
              id="stDataSource"
            >
              AUTO_COMPACT
            </span>
          </div>
          <div
            className="font-mono text-[22px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
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

        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('stContextWinTitle')}
            </span>
            <span className="font-mono text-[11px] text-[#86868b] tabular-nums truncate">
              contextWindow
            </span>
          </div>
          <div
            className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
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

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 flex-1 min-h-0 max-h-full min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('stStepsLogTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="stStepsCount"
          >
            {t('fmtStepsCount')(steps.length)}
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
                  {t('thOutputTtft')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
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
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top font-mono tabular-nums">
                      <div>{stepSpan}</div>
                      <div
                        className="text-[#86868b] text-[11px]"
                        title={s.trajectoryDisplayTitle || s.agentRole || ''}
                      >
                        {stepSubText}
                      </div>
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
                        {t('fmtTtftShort')(fmtSec(s.timeToFirstTokenSec))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>{`${fmtRate(s.e2eTokPerSec)} tok/s`}</strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {t('fmtThinkRespShort')(
                          fmtInt(s.thinkingOutputTokens),
                          fmtInt(s.responseOutputTokens)
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
