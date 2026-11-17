/**
 * @fileoverview Global Panel -> Sessions tab (`#pane-sessions`), embedding the
 * 3-month historical token usage KPI + sequence bar explorer above the global
 * session history table on a unified pure-white Apple HIG canvas.
 */

import React, { useMemo, useState } from 'react';
import { getI18nBridge } from '../utils.js';
import { GlobalHistorySection } from './GlobalHistorySection.jsx';
import { StatusIndicator } from './StatusIndicator.jsx';

function computeSessionSliceStats(conv, activeSlice) {
  const ht = conv?.historyTotals;
  if (!ht) {
    return {
      sliceTokens: 0,
      sliceRequests: 0,
      totalTokens: 0,
      totalRequests: 0,
    };
  }
  const totalTokens = Number(ht.totalTokens || 0);
  const totalRequests = Number(ht.requestCount || 0);
  const startKey = activeSlice?.startDateKey || '';
  const endKey = activeSlice?.endDateKey || '';
  const dayMap = ht.days;
  let sliceTokens = 0;
  let sliceRequests = 0;
  if (startKey && endKey && dayMap && typeof dayMap === 'object') {
    for (const [dKey, bucket] of Object.entries(dayMap)) {
      if (dKey >= startKey && dKey <= endKey) {
        sliceTokens += Number(bucket?.totalTokens || 0);
        sliceRequests += Number(bucket?.requestCount || 0);
      }
    }
  }
  return { sliceTokens, sliceRequests, totalTokens, totalRequests };
}

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
  initialGranularity = 'day',
  selectedConversationId,
  onSelectConversation,
}) {
  const { fmtInt } = getI18nBridge();
  const fmtCompact = t('fmtCompact');
  const [activeSlice, setActiveSlice] = useState(null);

  const globalConversations = useMemo(
    () =>
      Array.isArray(data?.globalConversations)
        ? data.globalConversations
        : Array.isArray(data?.availableConversations)
          ? data.availableConversations
          : [],
    [data?.globalConversations, data?.availableConversations]
  );

  const effectiveSlice = useMemo(() => {
    if (activeSlice) return activeSlice;
    const hist = data?.globalTokenHistory;
    if (!hist) return null;
    const list =
      initialGranularity === 'month'
        ? hist.months
        : initialGranularity === 'week'
          ? hist.weeks
          : hist.days;
    return Array.isArray(list) && list.length > 0 ? list[list.length - 1] : null;
  }, [activeSlice, data?.globalTokenHistory, initialGranularity]);

  const orderedRows = useMemo(() => {
    const contributors = [];
    const rest = [];
    for (const conv of globalConversations) {
      const sliceStats = computeSessionSliceStats(conv, effectiveSlice);
      const item = { conv, sliceStats };
      if (sliceStats.sliceTokens > 0 || sliceStats.sliceRequests > 0) {
        contributors.push(item);
      } else {
        rest.push(item);
      }
    }
    return [...contributors, ...rest];
  }, [globalConversations, effectiveSlice]);

  const stats = useMemo(() => {
    const workspaces = new Set();
    let activeCount = 0;

    for (const c of globalConversations) {
      if (c.workspaceName) workspaces.add(c.workspaceName);
      if (c.lifecycleStatus === 'active') activeCount += 1;
    }

    return {
      workspaceCount: workspaces.size,
      activeCount,
    };
  }, [globalConversations]);

  return (
    <section
      className="flex-1 min-h-0 max-h-full flex flex-col gap-5 overflow-y-auto overflow-x-hidden pr-0.5"
      id="pane-sessions"
    >
      <GlobalHistorySection
        history={data?.globalTokenHistory}
        t={t}
        lang={lang}
        initialGranularity={initialGranularity}
        onActiveSliceChange={setActiveSlice}
      />

      <div className="flex flex-col gap-3 flex-1 min-h-[140px] max-h-full min-w-0">
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-[#515154] tracking-[-0.01em] truncate">
            {t('gsTableTitle')}
          </span>
          <span
            className="font-mono text-[10.5px] text-[#86868b] tabular-nums truncate"
            id="gsTableCount"
          >
            {t('fmtSessionsHeaderMeta')(
              fmtInt(globalConversations.length),
              fmtInt(stats.workspaceCount),
              fmtInt(stats.activeCount)
            )}
          </span>
        </div>
        <div className="flex-1 min-h-0 max-h-full overflow-y-auto overflow-x-hidden">
          <table
            id="gsSessionsTable"
            className="w-full table-fixed border-collapse text-left tabular-nums"
          >
            <thead>
              <tr>
                <th className="w-[42%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thSessionTitle')}
                </th>
                <th className="w-[22%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-2 pb-2 pl-0 whitespace-nowrap z-[1]">
                  {t('thWorkspace')}
                </th>
                <th className="w-[36%] sticky top-0 bg-white text-[11px] font-semibold text-[#86868b] pt-0.5 pr-0 pb-2 pl-2 text-right whitespace-nowrap z-[1]">
                  {t('thStepsSubagents')}
                </th>
              </tr>
            </thead>
            <tbody id="gsSessionsTableBody">
              {orderedRows.map(({ conv, sliceStats }) => {
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
                  ? 'bg-[#f5f5f7]'
                  : 'group-hover:bg-[#f5f5f7]';

                const shortTs = formatShortTimestamp(
                  conv.treeLastModifiedTime || conv.lastModifiedTime,
                  lang
                );
                const hasSliceUsage =
                  sliceStats.sliceTokens > 0 || sliceStats.sliceRequests > 0;
                const hasLifetimeUsage =
                  sliceStats.totalTokens > 0 || sliceStats.totalRequests > 0;
                const primaryMetric = hasSliceUsage
                  ? t('fmtSessionCallsUsage')(
                      fmtCompact(sliceStats.sliceTokens),
                      fmtInt(sliceStats.sliceRequests)
                    )
                  : hasLifetimeUsage
                    ? t('fmtSessionCallsUsage')(
                        fmtCompact(sliceStats.totalTokens),
                        fmtInt(sliceStats.totalRequests)
                      )
                    : t('fmtStepsCount')(fmtInt(conv.stepCount || 0));
                const showCombinedTotal =
                  hasSliceUsage && sliceStats.totalTokens > sliceStats.sliceTokens;

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
                      className={`text-[12px] text-[#1d1d1f] py-2 pr-2 pl-1.5 align-top rounded-l-[8px] ${cellBg}`}
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
                      <div className="font-mono tabular-nums text-[#86868b] text-[10.5px] mt-0.5 truncate">
                        {`${shortId}${subBadge}`}
                      </div>
                    </td>
                    <td
                      className={`text-[12px] text-[#1d1d1f] py-2 pr-2 pl-0 align-top ${cellBg}`}
                    >
                      <div>
                        <strong className="block truncate">
                          {conv.workspaceName || 'Global'}
                        </strong>
                      </div>
                      <div
                        className="font-mono tabular-nums text-[#86868b] text-[10.5px] block truncate mt-0.5"
                        title={wsBranch}
                      >
                        {wsBranch}
                      </div>
                    </td>
                    <td
                      className={`text-[12px] py-2 pr-1.5 pl-1 align-top text-right whitespace-nowrap font-mono tabular-nums rounded-r-[8px] ${cellBg} ${
                        hasSliceUsage ? 'text-[#1d1d1f]' : 'text-[#515154]'
                      }`}
                    >
                      <div className="truncate">
                        <strong>{primaryMetric}</strong>
                      </div>
                      <div className="text-[#86868b] text-[10.5px] mt-0.5 flex items-baseline justify-end gap-1 min-w-0">
                        {showCombinedTotal ? (
                          <>
                            <span className="truncate min-w-0">
                              {t('fmtSessionTotalPrefix')(
                                fmtCompact(sliceStats.totalTokens)
                              )}
                            </span>
                            <span className="shrink-0">·</span>
                            <span className="shrink-0">{shortTs}</span>
                          </>
                        ) : (
                          <span className="shrink-0">{shortTs}</span>
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
