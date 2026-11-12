/**
 * @fileoverview 3-Month Global Token Usage KPI (`左主右副`: MTD primary hero +
 * WTD / Today secondary columns) and interactive Sequence Bar Explorer
 * (`序列柱图`: Day / Week / Month granularity with full 92-day / 14-week / 3-month
 * window paging and slice breakdown), styled exclusively with Tailwind CSS.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getI18nBridge } from '../utils.js';

const PAGE_SIZE = 12;

function normalizeGranularity(raw) {
  if (raw === 'week' || raw === 'month') return raw;
  return 'day';
}

export function GlobalHistorySection({
  history,
  t,
  lang,
  initialGranularity = 'day',
}) {
  const { fmtInt, fmtCompact, fmtPct, fmtSignedTrend } = getI18nBridge();

  const [granularity, setGranularity] = useState(() =>
    normalizeGranularity(initialGranularity)
  );
  const [pageOffsetFromLatest, setPageOffsetFromLatest] = useState(0);
  const [selectedKey, setSelectedKey] = useState('');

  const slices = useMemo(() => {
    if (!history) return [];
    if (granularity === 'month') {
      return Array.isArray(history.months) ? history.months : [];
    }
    if (granularity === 'week') {
      return Array.isArray(history.weeks) ? history.weeks : [];
    }
    return Array.isArray(history.days) ? history.days : [];
  }, [history, granularity]);

  useEffect(() => {
    setPageOffsetFromLatest(0);
    setSelectedKey('');
  }, [granularity]);

  const maxPageOffset = Math.max(
    0,
    Math.ceil(slices.length / PAGE_SIZE) - 1
  );
  const safeOffset = Math.min(pageOffsetFromLatest, maxPageOffset);

  const visibleSlices = useMemo(() => {
    if (slices.length <= PAGE_SIZE) return slices;
    const endIdx = Math.max(0, slices.length - safeOffset * PAGE_SIZE);
    const startIdx = Math.max(0, endIdx - PAGE_SIZE);
    return slices.slice(startIdx, endIdx);
  }, [slices, safeOffset]);

  const activeSlice = useMemo(() => {
    if (visibleSlices.length === 0) return null;
    if (selectedKey) {
      const hit = visibleSlices.find((s) => s.key === selectedKey);
      if (hit) return hit;
    }
    return visibleSlices[visibleSlices.length - 1];
  }, [visibleSlices, selectedKey]);

  const maxVisibleTotal = useMemo(() => {
    let peak = 1;
    for (const s of visibleSlices) {
      if ((s.totalTokens || 0) > peak) peak = s.totalTokens;
    }
    return peak;
  }, [visibleSlices]);

  const periods = history?.periods || {};
  const mtd = periods.mtd || {};
  const wtd = periods.wtd || {};
  const today = periods.today || {};

  const isZh = lang === 'zh-CN';
  const activeSliceLabel = activeSlice
    ? isZh
      ? activeSlice.zhLabel
      : activeSlice.enLabel
    : '-';

  const canPageOlder = safeOffset < maxPageOffset;
  const canPageNewer = safeOffset > 0;

  return (
    <div id="ghHistorySection" className="shrink-0 flex flex-col gap-5 min-w-0">
      <div
        id="ghDefaultPeriods"
        className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-4 items-end min-w-0"
      >
        <div id="ghMtdHero" className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] whitespace-nowrap">
              {t('ghMtdTitle')}
            </span>
            <span className="font-mono text-[10.5px] text-[#86868b] tabular-nums whitespace-nowrap">
              {t('ghVsPrevMonth')}
            </span>
          </div>
          <div className="leading-none">
            <span
              id="ghMtdTotal"
              className="font-mono text-[28px] sm:text-[30px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-none tabular-nums"
            >
              {fmtCompact(mtd.totalTokens || 0)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              tok
            </span>
          </div>
          <div
            id="ghMtdDelta"
            className="font-mono text-[10.5px] text-[#515154] tabular-nums whitespace-nowrap truncate"
          >
            <span>{fmtSignedTrend(mtd.deltaRatio)}</span>
            <span className="text-[#86868b]">
              {` · ${t('fmtCallsCount')(fmtInt(mtd.requestCount || 0))}`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div id="ghWtdCard" className="flex flex-col gap-2 min-w-0">
            <span className="text-[11.5px] font-semibold text-[#515154] whitespace-nowrap">
              {t('ghWtdTitle')}
            </span>
            <span
              id="ghWtdTotal"
              className="font-mono text-[17px] sm:text-[18.5px] font-bold text-[#1d1d1f] tracking-[-0.025em] leading-none tabular-nums truncate"
            >
              {fmtCompact(wtd.totalTokens || 0)}
            </span>
            <span
              id="ghWtdDelta"
              className="font-mono text-[10px] text-[#86868b] tabular-nums whitespace-nowrap truncate"
            >
              {fmtSignedTrend(wtd.deltaRatio)}
            </span>
          </div>

          <div id="ghTodayCard" className="flex flex-col gap-2 min-w-0">
            <span className="text-[11.5px] font-semibold text-[#515154] whitespace-nowrap">
              {t('ghTodayTitle')}
            </span>
            <span
              id="ghTodayTotal"
              className="font-mono text-[17px] sm:text-[18.5px] font-bold text-[#1d1d1f] tracking-[-0.025em] leading-none tabular-nums truncate"
            >
              {fmtCompact(today.totalTokens || 0)}
            </span>
            <span
              id="ghTodayDelta"
              className="font-mono text-[10px] text-[#86868b] tabular-nums whitespace-nowrap truncate"
            >
              {fmtSignedTrend(today.deltaRatio)}
            </span>
          </div>
        </div>
      </div>

      <div id="ghSequenceSection" className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              id="ghSelectedSliceLabel"
              className="text-[12px] font-semibold text-[#1d1d1f] tracking-[-0.01em] whitespace-nowrap truncate"
            >
              {activeSliceLabel}
            </span>
            <span
              id="ghSelectedSliceDelta"
              className="font-mono text-[10.5px] text-[#86868b] tabular-nums whitespace-nowrap shrink-0"
            >
              {fmtSignedTrend(activeSlice?.deltaRatio)}
            </span>
            {slices.length > PAGE_SIZE && (
              <div className="inline-flex items-center gap-0.5 ml-1 shrink-0">
                <button
                  type="button"
                  id="ghPrevPageBtn"
                  disabled={!canPageOlder}
                  title={t('ghPrevPage')}
                  onClick={() => {
                    if (canPageOlder) {
                      setPageOffsetFromLatest((p) => p + 1);
                      setSelectedKey('');
                    }
                  }}
                  className={`w-5 h-5 inline-flex items-center justify-center rounded-[5px] transition-colors ${
                    canPageOlder
                      ? 'text-[#515154] hover:bg-[#f5f5f7] cursor-pointer'
                      : 'text-[#d2d2d7] cursor-default'
                  }`}
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path
                      d="M7.5 2.5L4 6L7.5 9.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  id="ghNextPageBtn"
                  disabled={!canPageNewer}
                  title={t('ghNextPage')}
                  onClick={() => {
                    if (canPageNewer) {
                      setPageOffsetFromLatest((p) => Math.max(0, p - 1));
                      setSelectedKey('');
                    }
                  }}
                  className={`w-5 h-5 inline-flex items-center justify-center rounded-[5px] transition-colors ${
                    canPageNewer
                      ? 'text-[#515154] hover:bg-[#f5f5f7] cursor-pointer'
                      : 'text-[#d2d2d7] cursor-default'
                  }`}
                >
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path
                      d="M4.5 2.5L8 6L4.5 9.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div
            id="ghGranularitySwitch"
            role="tablist"
            className="inline-grid grid-cols-3 gap-0.5 bg-[#f5f5f7] p-[2.5px] rounded-[8px] shrink-0"
          >
            {[
              { id: 'day', label: t('ghGranDay') },
              { id: 'week', label: t('ghGranWeek') },
              { id: 'month', label: t('ghGranMonth') },
            ].map((item) => {
              const isSelected = granularity === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-granularity={item.id}
                  onClick={() => setGranularity(item.id)}
                  className={`text-[11px] py-[3px] px-2 rounded-[6px] whitespace-nowrap cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white text-[#1d1d1f] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'bg-transparent text-[#515154] font-medium hover:text-[#1d1d1f]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="ghSequenceBars"
          className="h-[74px] w-full min-w-0 flex items-end justify-between gap-1 pt-0.5 select-none"
          role="listbox"
        >
          {visibleSlices.map((s) => {
            const isSelected = activeSlice?.key === s.key;
            const rawPct =
              s.totalTokens > 0
                ? Math.max(10, Math.round((s.totalTokens / maxVisibleTotal) * 100))
                : 0;
            const shortLabel = isZh ? s.zhShort : s.enShort;
            const fullLabel = isZh ? s.zhLabel : s.enLabel;
            return (
              <button
                key={s.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-slice-key={s.key}
                title={`${fullLabel} · ${fmtCompact(s.totalTokens)} tok`}
                onClick={() => setSelectedKey(s.key)}
                className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-2 cursor-pointer group bg-transparent p-0"
              >
                <div className="flex-1 w-full max-w-[36px] rounded-[5px] bg-[#f5f5f7] flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-[5px] transition-colors ${
                      isSelected
                        ? 'bg-[#1d1d1f]'
                        : 'bg-[#c7c7cc] group-hover:bg-[#86868b]'
                    }`}
                    style={{ height: `${rawPct}%` }}
                  />
                </div>
                <span
                  className={`font-mono text-[9.5px] leading-none tabular-nums whitespace-nowrap ${
                    isSelected
                      ? 'text-[#1d1d1f] font-semibold'
                      : 'text-[#86868b]'
                  }`}
                >
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="ghSelectedMetrics"
          className="grid grid-cols-4 gap-3 pt-0.5 min-w-0"
        >
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-[#86868b] whitespace-nowrap">
              {t('ghSliceTotal')}
            </span>
            <span
              id="ghSliceTotalVal"
              className="font-mono text-[14px] font-bold text-[#1d1d1f] leading-none tabular-nums truncate"
            >
              {fmtCompact(activeSlice?.totalTokens || 0)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-[#86868b] whitespace-nowrap truncate">
              {`${t('ghSliceInput')} · ${fmtPct(activeSlice?.cacheHitRate || 0)}`}
            </span>
            <span
              id="ghSliceInputVal"
              className="font-mono text-[14px] font-bold text-[#1d1d1f] leading-none tabular-nums truncate"
            >
              {fmtCompact(activeSlice?.promptTokens || 0)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-[#86868b] whitespace-nowrap">
              {t('ghSliceOutput')}
            </span>
            <span
              id="ghSliceOutputVal"
              className="font-mono text-[14px] font-bold text-[#1d1d1f] leading-none tabular-nums truncate"
            >
              {fmtCompact(activeSlice?.outputTokens || 0)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-[#86868b] whitespace-nowrap">
              {t('ghSliceCalls')}
            </span>
            <span
              id="ghSliceCallsVal"
              className="font-mono text-[14px] font-bold text-[#1d1d1f] leading-none tabular-nums truncate"
            >
              {fmtInt(activeSlice?.requestCount || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
