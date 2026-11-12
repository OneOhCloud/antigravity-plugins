/**
 * @fileoverview Global Panel -> Models tab (`#pane-models`), styled
 * exclusively with Tailwind CSS utility classes on a single-color white canvas.
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
      className="flex-1 min-h-0 max-h-full flex flex-col gap-5 overflow-y-auto overflow-x-hidden pr-0.5"
      id="pane-models"
    >
      <div className="shrink-0 grid grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('mdDiscoveredTitle')}
            </span>
            <span
              className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
              id="mdScannedConvs"
            >
              {t('fmtAcrossSessions')(globalReg.scannedConversations || 0)}
            </span>
          </div>
          <div className="leading-none">
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
              id="mdModelCount"
            >
              {globalEntries.length}
            </span>
            {t('unitModels') && (
              <span className="text-[12px] font-medium text-[#86868b] ml-1">
                {t('unitModels')}
              </span>
            )}
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="mdTopModelName"
          >
            {t('fmtPrimaryModel')(topGlobalModel.modelDisplayName || '-')}
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('mdGlobalCallsTitle')}
            </span>
            <span className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate">
              {t('mdGlobalCallsMeta')}
            </span>
          </div>
          <div className="leading-none">
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
              id="mdTotalGlobalReqs"
            >
              {fmtInt(globalReg.totalGlobalRequests || 0)}
            </span>
            {t('unitCalls') && (
              <span className="text-[12px] font-medium text-[#86868b] ml-1">
                {t('unitCalls')}
              </span>
            )}
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="mdTopEndpointId"
          >
            {t('fmtPrimaryEndpoint')(topGlobalModel.responseModel || '-')}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-[120px] max-h-full min-w-0">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('mdRegistryTableTitle')}
          </span>
          <span
            className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
            id="mdGlobalSummary"
          >
            {t('fmtAcrossSessionsCalls')(
              globalReg.scannedConversations || 0,
              fmtInt(globalReg.totalGlobalRequests || 0)
            )}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-left tabular-nums">
            <thead>
              <tr>
                <th className="w-[33%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thDisplayName')}
                </th>
                <th className="w-[27%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thEndpointId')}
                </th>
                <th className="w-[19%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
                  {t('thCallsWindow')}
                </th>
                <th className="w-[21%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-1 text-right whitespace-nowrap z-[1]">
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
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top truncate">
                      <div className="truncate" title={g.modelDisplayName}>
                        <strong>{g.modelDisplayName}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] font-mono tabular-nums mt-0.5 truncate">
                        {shortProv}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top font-mono tabular-nums truncate">
                      <div className="truncate" title={g.responseModel}>
                        <strong>{g.responseModel}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {shortEnum}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>
                          {t('fmtCallsCount')(fmtInt(g.requestCount))}
                        </strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5">
                        {t('fmtWinShort')(
                          g.maxContextTokens > 0
                            ? fmtCompact(g.maxContextTokens)
                            : '-'
                        )}
                      </div>
                    </td>
                    <td className="text-[12px] text-[#1d1d1f] py-2 pr-0 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums">
                      <div>
                        <strong>
                          {`${fmtRate(g.weightedE2ETokPerSec)} tok/s`}
                        </strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5">
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
