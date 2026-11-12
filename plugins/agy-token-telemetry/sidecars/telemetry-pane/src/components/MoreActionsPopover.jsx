/**
 * @fileoverview Secondary popover menu (`#moreActionsBtn` / `#moreActionsMenu`)
 * with constant-height in-place sub-view switching between settings and the
 * full History Conversations list (including the current conversation).
 */

import React, { useEffect, useRef, useState } from 'react';
import { StatusIndicator } from './StatusIndicator.jsx';

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
  conversationOptions = [],
  selectedConversationId = '',
  onSelectConversation,
  pollIntervalMs,
  onChangePollInterval,
  onToggleLang,
  onRefresh,
  statusTimestamp,
  defaultOpen = false,
  defaultSubView = 'settings',
}) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen));
  const [subView, setSubView] = useState(
    defaultSubView === 'history' ? 'history' : 'settings'
  );
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutsideMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
        setSubView('settings');
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSubView('settings');
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

  const selectedOption =
    conversationOptions.find((opt) => opt.value === selectedConversationId) ||
    conversationOptions[0] || {
      value: '',
      label: '-',
      lifecycleStatus: 'inactive',
      statusLabel: '',
    };

  const effectiveSubView =
    conversationOptions.length > 0 && subView === 'history'
      ? 'history'
      : 'settings';

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        id="moreActionsBtn"
        className={`inline-flex items-center justify-center w-[30px] h-7 p-0 rounded-[8px] cursor-pointer transition-colors ${
          isOpen
            ? 'bg-[#1d1d1f] text-white'
            : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ececef]'
        }`}
        title={`${t('moreActionsTooltip')} (${selectedOption.label} · ${activePollLabel} · ${statusTimestamp})`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() =>
          setIsOpen((prev) => {
            const next = !prev;
            if (!next) setSubView('settings');
            return next;
          })
        }
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
          className="absolute top-[calc(100%+6px)] right-0 w-[288px] sm:w-[316px] h-[228px] overflow-hidden bg-white rounded-[14px] p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] z-[70] flex flex-col justify-between"
          id="moreActionsMenu"
          role="menu"
          data-subview={effectiveSubView}
        >
          {effectiveSubView === 'settings' ? (
            <>
              <button
                type="button"
                id="conversationSelectHistoryEntryBtn"
                data-select-role="conversationSelect"
                className="shrink-0 w-full min-w-0 flex flex-col gap-1 py-1.5 px-2.5 rounded-[10px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-left cursor-pointer transition-colors"
                title={selectedOption.label}
                onClick={() => setSubView('history')}
              >
                <div className="w-full min-w-0 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0 truncate text-[11.5px] font-semibold text-[#515154]">
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-[#86868b]"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="8" r="5.75" />
                      <path
                        d="M8 4.75V8L10.25 9.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="truncate">
                      {t('historyConversationsLabel')}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[11px] text-[#86868b] tabular-nums">
                    <span>
                      {t('fmtHistoryConversationsCount')(
                        conversationOptions.length
                      )}
                    </span>
                    <svg
                      className="w-3 h-3 shrink-0"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 2.5L8 6L4.5 9.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <div className="w-full min-w-0 flex items-center gap-1.5">
                  <StatusIndicator
                    status={selectedOption.lifecycleStatus}
                    title={selectedOption.statusLabel}
                  />
                  <span className="flex-1 min-w-0 truncate text-[11.5px] font-medium text-[#1d1d1f]">
                    {selectedOption.label}
                  </span>
                </div>
              </button>

              <div className="flex items-center justify-between gap-2 px-0.5">
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

              <div className="flex flex-col gap-1 px-0.5">
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

              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11.5px] font-semibold text-[#515154]">
                  {t('menuLangLabel')}
                </span>
                <button
                  type="button"
                  className="font-semibold text-[11.5px] py-[4px] px-[7px] rounded-[8px] whitespace-nowrap text-[#1d1d1f] bg-[#e8e8ed] cursor-pointer hover:opacity-88 transition-opacity"
                  id="langToggleBtn"
                  title={t('langTooltip')}
                  onClick={onToggleLang}
                >
                  {lang === 'zh-CN'
                    ? '简体中文 · Switch EN'
                    : 'English · 切换中文'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
              <button
                type="button"
                id="conversationSelectHistoryBackBtn"
                className="shrink-0 w-full min-w-0 flex items-center justify-between gap-2 py-[5px] px-2.5 rounded-[8px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11.5px] text-[#515154] font-semibold cursor-pointer transition-colors"
                onClick={() => setSubView('settings')}
              >
                <span className="inline-flex items-center gap-1 min-w-0 truncate">
                  <svg
                    className="w-3 h-3 shrink-0"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path
                      d="M7.5 2.5L4 6L7.5 9.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="truncate">{t('backToMoreSettings')}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-[#86868b] font-normal tabular-nums">
                  {t('fmtHistoryConversationsCount')(
                    conversationOptions.length
                  )}
                </span>
              </button>

              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-0.5"
                id="conversationSelectHistoryList"
                role="listbox"
              >
                {conversationOptions.map((opt) => {
                  const isSelected = opt.value === selectedOption.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      data-value={opt.value}
                      data-status={opt.lifecycleStatus || 'inactive'}
                      className={`w-full min-w-0 flex items-center gap-2 py-[7px] px-2.5 rounded-[8px] text-left text-[12px] text-[#1d1d1f] cursor-pointer transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-[#e8e8ed] font-semibold'
                          : 'bg-transparent hover:bg-[#f5f5f7]'
                      }`}
                      title={opt.label}
                      onClick={() => {
                        setIsOpen(false);
                        setSubView('settings');
                        if (onSelectConversation && opt.value !== selectedConversationId) {
                          onSelectConversation(opt.value);
                        }
                      }}
                    >
                      <StatusIndicator
                        status={opt.lifecycleStatus}
                        title={opt.statusLabel}
                      />
                      <span className="flex-1 min-w-0 truncate">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
