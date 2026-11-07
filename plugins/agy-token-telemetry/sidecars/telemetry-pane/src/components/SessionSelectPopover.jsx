/**
 * @fileoverview Custom React Popover Selector replacing native `<select>` for
 * Main Conversation and Sub-Conversation lists, with constant-height in-place
 * secondary view for project historical conversations.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusIndicator } from './StatusIndicator.jsx';

export function SessionSelectPopover({
  id,
  options = [],
  historyOptions = [],
  value = '',
  onChange,
  tooltip = '',
  defaultOpen = false,
  defaultSubView = 'primary',
  t,
}) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen));
  const [subView, setSubView] = useState(
    defaultSubView === 'history' ? 'history' : 'primary'
  );
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutsideMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
        setSubView('primary');
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSubView('primary');
      }
    }
    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const allOptions = useMemo(
    () => [...options, ...historyOptions],
    [options, historyOptions]
  );

  const selectedOption =
    allOptions.find((opt) => opt.value === value) ||
    allOptions[0] || {
      value: '',
      label: '-',
      lifecycleStatus: 'inactive',
      statusLabel: '',
    };

  const hasHistory = historyOptions.length > 0;
  const effectiveSubView =
    hasHistory && subView === 'history' ? 'history' : 'primary';

  const renderOptionRow = (opt) => {
    const isSelected = opt.value === selectedOption.value;
    return (
      <button
        type="button"
        key={opt.value}
        role="option"
        aria-selected={isSelected}
        data-value={opt.value}
        data-status={opt.lifecycleStatus || 'inactive'}
        className={`w-full min-w-0 flex items-center gap-2 py-[7px] px-2.5 rounded-[8px] text-left text-[12.5px] text-[#1d1d1f] cursor-pointer transition-colors shrink-0 ${
          isSelected
            ? 'bg-[#e8e8ed] font-semibold'
            : 'bg-transparent hover:bg-[#f5f5f7]'
        }`}
        title={opt.label}
        onClick={() => {
          setIsOpen(false);
          setSubView('primary');
          if (onChange && opt.value !== value) {
            onChange(opt.value);
          }
        }}
      >
        <StatusIndicator
          status={opt.lifecycleStatus}
          title={opt.statusLabel}
        />
        <span className="flex-1 min-w-0 truncate">{opt.label}</span>
      </button>
    );
  };

  return (
    <div className="static w-full min-w-0" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="w-full min-w-0 flex items-center gap-[7px] py-[5px] px-2.5 rounded-[8px] bg-[#e8e8ed] text-[#1d1d1f] text-[12px] text-left cursor-pointer hover:opacity-88 transition-opacity"
        title={tooltip || selectedOption.label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() =>
          setIsOpen((prev) => {
            const next = !prev;
            if (!next) setSubView('primary');
            return next;
          })
        }
      >
        <StatusIndicator
          status={selectedOption.lifecycleStatus}
          title={selectedOption.statusLabel}
        />
        <span className="flex-1 min-w-0 truncate font-medium">
          {selectedOption.label}
        </span>
        <svg
          className={`shrink-0 text-[#515154] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && allOptions.length > 0 && (
        <div
          className={`absolute top-[calc(100%+6px)] left-0 right-0 w-full ${
            hasHistory ? 'h-[220px]' : 'max-h-[274px]'
          } overflow-hidden bg-white rounded-[12px] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] z-[60] flex flex-col`}
          id={`${id}Menu`}
          role="listbox"
          data-subview={effectiveSubView}
        >
          {effectiveSubView === 'primary' ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-0.5">
                {options.map(renderOptionRow)}
              </div>
              {hasHistory && (
                <button
                  type="button"
                  id={`${id}HistoryEntryBtn`}
                  className="shrink-0 mt-1 w-full min-w-0 flex items-center justify-between gap-2 py-[7px] px-2.5 rounded-[8px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[12px] text-[#515154] font-medium cursor-pointer transition-colors"
                  onClick={() => setSubView('history')}
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
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
                      {t ? t('historyConversationsLabel') : '历史对话'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[11px] text-[#86868b] tabular-nums">
                    <span>
                      {t
                        ? t('fmtHistoryConversationsCount')(
                            historyOptions.length
                          )
                        : historyOptions.length}
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
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                id={`${id}HistoryBackBtn`}
                className="shrink-0 mb-1 w-full min-w-0 flex items-center justify-between gap-2 py-[5px] px-2.5 rounded-[8px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[11.5px] text-[#515154] font-semibold cursor-pointer transition-colors"
                onClick={() => setSubView('primary')}
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
                  <span className="truncate">
                    {t ? t('backToActiveConversations') : '返回当前对话'}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-[#86868b] font-normal tabular-nums">
                  {t
                    ? t('fmtHistoryConversationsCount')(historyOptions.length)
                    : historyOptions.length}
                </span>
              </button>
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-0.5"
                id={`${id}HistoryList`}
              >
                {historyOptions.map(renderOptionRow)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
