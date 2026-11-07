/**
 * @fileoverview Secondary popover menu (`#moreActionsBtn` / `#moreActionsMenu`),
 * styled exclusively with Tailwind CSS utility classes.
 */

import React, { useEffect, useRef, useState } from 'react';

const POLL_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 0, labelKey: 'manualOption' },
];

export function MoreActionsPopover({
  t,
  lang,
  pollIntervalMs,
  onChangePollInterval,
  onToggleLang,
  onRefresh,
  statusTimestamp,
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen));
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutsideMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activePollLabel =
    pollIntervalMs > 0 ? `${pollIntervalMs / 1000}s` : t('manualOption');

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        id="moreActionsBtn"
        className={`inline-flex items-center justify-center w-[30px] h-7 p-0 rounded-[8px] cursor-pointer hover:opacity-88 transition-opacity ${
          isOpen
            ? 'bg-[#1d1d1f] text-white'
            : 'bg-[#e8e8ed] text-[#1d1d1f]'
        }`}
        title={`${t('moreActionsTooltip')} (${activePollLabel} · ${statusTimestamp})`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="3.2" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.8" cy="8" r="1.4" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 w-[248px] bg-white rounded-[14px] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)] z-[70] flex flex-col gap-3"
          id="moreActionsMenu"
          role="menu"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11.5px] font-semibold text-[#515154]">
                {t('menuRefreshLabel')}
              </span>
              <span
                className="text-[11px] text-[#86868b] font-mono tabular-nums"
                id="statusTimestamp"
              >
                {statusTimestamp}
              </span>
            </div>
            <button
              className="inline-flex items-center justify-center gap-[5px] font-semibold text-[12px] bg-[#1d1d1f] text-white py-[5px] px-[9px] rounded-[8px] whitespace-nowrap cursor-pointer hover:opacity-88 transition-opacity"
              id="refreshBtn"
              type="button"
              onClick={() => {
                if (onRefresh) onRefresh();
              }}
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M13.5 8a5.5 5.5 0 1 1-1.3-3.5M13.5 2.5v2.5H11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t('refresh')}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] font-semibold text-[#515154]">
                {t('menuPollLabel')}
              </span>
              <span className="text-[11px] text-[#86868b] font-mono tabular-nums">
                {activePollLabel}
              </span>
            </div>
            <div
              className="grid grid-cols-5 gap-[3px] bg-[#f5f5f7] p-[3px] rounded-[8px]"
              id="pollIntervalSelect"
              role="radiogroup"
              aria-label={t('pollTooltip')}
            >
              {POLL_OPTIONS.map((opt) => {
                const isSelected = Number(pollIntervalMs) === opt.value;
                const text = opt.labelKey ? t(opt.labelKey) : opt.label;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    data-value={opt.value}
                    className={`text-[11px] py-1 px-0.5 rounded-[6px] text-center whitespace-nowrap cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-white text-[#1d1d1f] font-semibold'
                        : 'bg-transparent text-[#515154] font-medium hover:opacity-88'
                    }`}
                    onClick={() => onChangePollInterval(opt.value)}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-[#515154]">
              {t('menuLangLabel')}
            </span>
            <button
              type="button"
              className="font-semibold text-[11.5px] py-[5px] px-[7px] rounded-[8px] whitespace-nowrap text-[#1d1d1f] bg-[#e8e8ed] cursor-pointer hover:opacity-88 transition-opacity"
              id="langToggleBtn"
              title={t('langTooltip')}
              onClick={onToggleLang}
            >
              {lang === 'zh-CN' ? '简体中文 · Switch EN' : 'English · 切换中文'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
