/**
 * @fileoverview Global Panel -> Model Registry tab (`#pane-models`), styled
 * exclusively with Tailwind CSS utility classes.
 */

import React from 'react';
import { getI18nBridge } from '../utils.js';

export function GlobalModelsPane({ data, t }) {
  const { fmtInt, fmtCompact, fmtRate } = getI18nBridge();

  const globalReg = data?.globalModelRegistry || {};
  const globalEntries = Array.isArray(globalReg.entries)
    ? globalReg.entries
    : [];
  const topGlobalModel = globalEntries[0] || {};

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-2 overflow-hidden"
      id="pane-models"
    >
      <div className="shrink-0 grid grid-cols-2 gap-2 items-stretch">
        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('mdDiscoveredTitle')}
            </span>
            <span
              className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
              id="mdScannedConvs"
            >
              {t('fmtAcrossSessions')(globalReg.scannedConversations || 0)}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="mdModelCount"
            >
              {globalEntries.length}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              {t('unitModels')}
            </span>
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="mdTopModelName"
          >
            {t('fmtPrimaryModel')(topGlobalModel.modelDisplayName || '-')}
          </div>
        </div>

        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('mdGlobalCallsTitle')}
            </span>
            <span className="font-mono text-[11px] text-[#86868b] tabular-nums truncate">
              {t('mdGlobalCallsMeta')}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="mdTotalGlobalReqs"
            >
              {fmtInt(globalReg.totalGlobalRequests || 0)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              {t('unitCalls')}
            </span>
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="mdTopEndpointId"
          >
            {t('fmtPrimaryEndpoint')(topGlobalModel.responseModel || '-')}
          </div>
        </div>
      </div>

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 flex-1 min-h-0 max-h-full min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('mdRegistryTableTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="mdGlobalSummary"
          >
            {t('fmtAcrossSessionsCalls')(
              globalReg.scannedConversations || 0,
              fmtInt(globalReg.totalGlobalRequests || 0)
            )}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thDisplayName')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thEndpointId')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thCallsWindow')}
                </th>
                <th className="sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thE2EVelocity')}
                </th>
              </tr>
            </thead>
            <tbody id="mdGlobalTableBody">
              {globalEntries.map((g) => {
                const shortEnum = String(g.modelEnum || '').replace(
                  'MODEL_PLACEHOLDER_',
                  ''
                );
                const shortProv = String(g.apiProvider || '').replace(
                  'API_PROVIDER_',
                  ''
                );
                return (
                  <tr
                    key={`${g.modelDisplayName}-${g.responseModel}-${g.modelEnum}`}
                  >
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top">
                      <div>
                        <strong>{g.modelDisplayName}</strong>
                      </div>
                      <div className="text-[#86868b] text-[11px] font-mono tabular-nums">
                        {shortProv}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top font-mono tabular-nums">
                      <div>
                        <strong>{g.responseModel}</strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {shortEnum}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>
                          {t('fmtCallsCount')(fmtInt(g.requestCount))}
                        </strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {t('fmtWinShort')(
                          g.maxContextTokens > 0
                            ? fmtCompact(g.maxContextTokens)
                            : '-'
                        )}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-[7px] pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>
                          {`${fmtRate(g.weightedE2ETokPerSec)} tok/s`}
                        </strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {t('fmtOutShort')(fmtCompact(g.outputTokens))}
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
