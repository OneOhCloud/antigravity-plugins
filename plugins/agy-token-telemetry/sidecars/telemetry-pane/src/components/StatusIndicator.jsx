/**
 * @fileoverview Pure inline SVG tri-state status indicator for conversation
 * and subagent dropdown lists (`active` = green dot, `completed` = green check,
 * `inactive` = gray dot), styled with Tailwind CSS.
 */

import React from 'react';

export function StatusIndicator({ status = 'inactive', title = '' }) {
  const normalized =
    status === 'active' || status === 'completed' ? status : 'inactive';

  if (normalized === 'active') {
    return (
      <span
        className="inline-flex items-center justify-center w-3 h-3 shrink-0 status-active"
        data-status="active"
        title={title || 'Active'}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5" fill="#34C759" fillOpacity="0.22" />
          <circle cx="6" cy="6" r="3.4" fill="#34C759" />
        </svg>
      </span>
    );
  }

  if (normalized === 'completed') {
    return (
      <span
        className="inline-flex items-center justify-center w-3 h-3 shrink-0 status-completed"
        data-status="completed"
        title={title || 'Completed'}
      >
        <svg
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.2 6.3L4.9 9L9.9 3.2"
            stroke="#34C759"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center w-3 h-3 shrink-0 status-inactive"
      data-status="inactive"
      title={title || 'Inactive'}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <circle cx="6" cy="6" r="3.3" fill="#86868B" />
      </svg>
    </span>
  );
}
