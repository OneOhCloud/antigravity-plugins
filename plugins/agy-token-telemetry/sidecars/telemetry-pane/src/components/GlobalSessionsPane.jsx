/**
 * @fileoverview Global Panel -> Global Sessions tab (`#pane-sessions`), styled
 * exclusively with Tailwind CSS utility classes.
 */

import React, { useMemo } from 'react';
import { getI18nBridge } from '../utils.js';
import { StatusIndicator } from './StatusIndicator.jsx';

function formatShortTimestamp(isoStr, lang) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  const monthDay = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = d.toLocaleTimeString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${monthDay} ${time}`;
}

function mapStatusLabel(lifecycleStatus, t) {
  if (lifecycleStatus === 'active') return t('statusActive');
  if (lifecycleStatus === 'completed') return t('statusCompleted');
  return t('statusInactive');
}

export function GlobalSessionsPane({
  data,
  t,
  lang,
  selectedConversationId,
  onSelectConversation,
}) {
  const { fmtInt } = getI18nBridge();

  const globalConversations = useMemo(
    () =>
      Array.isArray(data?.globalConversations)
        ? data.globalConversations
        : Array.isArray(data?.availableConversations)
          ? data.availableConversations
          : [],
    [data?.globalConversations, data?.availableConversations]
  );

  const currentWorkspace = data?.currentWorkspace || {};
  const workspaceSessionsCount = Array.isArray(data?.availableConversations)
    ? data.availableConversations.length
    : 0;

  const stats = useMemo(() => {
    const workspaces = new Set();
    let activeCount = 0;
    let totalSubagents = 0;

    for (const c of globalConversations) {
      if (c.workspaceName) workspaces.add(c.workspaceName);
      if (c.lifecycleStatus === 'active') activeCount += 1;
      totalSubagents += Number(c.subagentCount || 0);
    }

    return {
      workspaceCount: workspaces.size,
      activeCount,
      totalSubagents,
    };
  }, [globalConversations]);

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-2 overflow-hidden"
      id="pane-sessions"
    >
      <div className="shrink-0 grid grid-cols-2 gap-2 items-stretch">
        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('gsTotalSessionsTitle')}
            </span>
            <span
              className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
              id="gsActiveMeta"
            >
              {t('fmtActiveSubagentsSummary')(
                stats.activeCount,
                stats.totalSubagents
              )}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="gsTotalSessionsVal"
            >
              {fmtInt(globalConversations.length)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              {t('unitSessions')}
            </span>
          </div>
          <div
            className="font-mono text-[11px] text-[#515154] tabular-nums truncate"
            id="gsCurrentWorkspaceSub"
          >
            {t('fmtCurrentWorkspaceSessions')(
              currentWorkspace.name || '-',
              workspaceSessionsCount
            )}
          </div>
        </div>

        <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 shrink-0 min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 shrink-0">
            <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
              {t('gsWorkspacesTitle')}
            </span>
            <span className="font-mono text-[11px] text-[#86868b] tabular-nums truncate">
              {t('gsWorkspaceMeta')}
            </span>
          </div>
          <div>
            <span
              className="font-mono text-[26px] font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.08] tabular-nums"
              id="gsWorkspacesCount"
            >
              {fmtInt(stats.workspaceCount)}
            </span>
            <span className="text-[12px] font-medium text-[#86868b] ml-1">
              {t('unitWorkspaces')}
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#515154] tabular-nums truncate">
            {currentWorkspace.name || 'Global'}
          </div>
        </div>
      </div>

      <div className="bg-[#f5f5f7] rounded-[16px] py-3 px-[15px] flex flex-col gap-1.5 flex-1 min-h-0 max-h-full min-w-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('gsTableTitle')}
          </span>
          <span
            className="font-mono text-[11px] text-[#86868b] tabular-nums truncate"
            id="gsTableCount"
          >
            {t('fmtAcrossSessions')(globalConversations.length)}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table
            id="gsSessionsTable"
            className="w-full table-fixed border-collapse text-left tabular-nums"
          >
            <thead>
              <tr>
                <th className="w-[48%] sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thSessionTitle')}
                </th>
                <th className="w-[30%] sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thWorkspace')}
                </th>
                <th className="w-[22%] sticky top-0 bg-[#f5f5f7] text-[11px] font-semibold text-[#86868b] pt-1 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thStepsSubagents')}
                </th>
              </tr>
            </thead>
            <tbody id="gsSessionsTableBody">
              {globalConversations.map((conv) => {
                const shortId = String(conv.conversationId || '').slice(0, 8);
                let title = conv.title || '';
                if (title === `会话 ${shortId}`) {
                  title = t('untitledSession')(shortId);
                }
                const subCount = Number(conv.subagentCount || 0);
                const status = conv.lifecycleStatus || 'inactive';
                const isSelected =
                  conv.conversationId === selectedConversationId;
                const wsBranch =
                  conv.worktreeBranch ||
                  (conv.surfaceId === 'antigravity-cli' ? 'CLI' : 'App');
                const subBadge =
                  subCount > 0 ? ` · ${t('fmtSubagentsBadge')(subCount)}` : '';

                const cellBg = isSelected
                  ? 'bg-[#e8e8ed]'
                  : 'group-hover:bg-[#e8e8ed]';

                return (
                  <tr
                    key={conv.conversationId}
                    className="group cursor-pointer transition-colors"
                    data-conversation-id={conv.conversationId}
                    onClick={() => {
                      if (onSelectConversation) {
                        onSelectConversation(conv.conversationId);
                      }
                    }}
                  >
                    <td
                      className={`text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-1.5 align-top rounded-l-[8px] ${cellBg}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <StatusIndicator
                          status={status}
                          title={mapStatusLabel(status, t)}
                        />
                        <strong className="block truncate" title={title}>
                          {title}
                        </strong>
                      </div>
                      <div className="font-mono tabular-nums text-[#86868b] text-[11px]">
                        {`${shortId}${subBadge}`}
                      </div>
                    </td>
                    <td
                      className={`text-[12px] text-[#1d1d1f] py-[7px] pr-2 pl-0 align-top ${cellBg}`}
                    >
                      <div>
                        <strong className="block truncate">
                          {conv.workspaceName || 'Global'}
                        </strong>
                      </div>
                      <div
                        className="font-mono tabular-nums text-[#86868b] text-[11px] block truncate"
                        title={wsBranch}
                      >
                        {wsBranch}
                      </div>
                    </td>
                    <td
                      className={`text-[12px] text-[#1d1d1f] py-[7px] pr-1.5 pl-2 align-top text-right whitespace-nowrap font-mono tabular-nums rounded-r-[8px] ${cellBg}`}
                    >
                      <div>
                        <strong>
                          {t('fmtStepsCount')(fmtInt(conv.stepCount || 0))}
                        </strong>
                      </div>
                      <div className="text-[#86868b] text-[11px]">
                        {formatShortTimestamp(
                          conv.treeLastModifiedTime || conv.lastModifiedTime,
                          lang
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
