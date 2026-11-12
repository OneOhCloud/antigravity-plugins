/**
 * @fileoverview Custom React Popover Selector replacing native `<select>` for
 * Sub-Conversation scope selection, styled exclusively with Tailwind CSS.
 */

import React, { useEffect, useRef, useState } from 'react';
import { StatusIndicator } from './StatusIndicator.jsx';

export function SessionSelectPopover({
  id,
  options = [],
  value = '',
  onChange,
  tooltip = '',
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

  const selectedOption =
    options.find((opt) => opt.value === value) ||
    options[0] || {
      value: '',
      label: '-',
      lifecycleStatus: 'inactive',
      statusLabel: '',
    };

  return (
    <div className="static w-full min-w-0" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="w-full min-w-0 flex items-center gap-[7px] py-[5px] px-2.5 rounded-[8px] bg-[#f5f5f7] text-[#1d1d1f] text-[12px] text-left cursor-pointer hover:bg-[#ececef] transition-colors"
        title={tooltip || selectedOption.label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
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

      {isOpen && options.length > 0 && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 right-0 w-full max-h-[240px] overflow-y-auto overflow-x-hidden bg-white rounded-[12px] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] z-[60] flex flex-col gap-0.5"
          id={`${id}Menu`}
          role="listbox"
        >
          {options.map((opt) => {
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
          })}
        </div>
      )}
    </div>
  );
}
