/**
 * @fileoverview Streamlined TopBar with 3-item primary toolbar (`Session | Global`
 * switch + full-width Conversation Selector + `⋯` Secondary Menu Popover) and
 * single-row flex navigation tabs, styled exclusively with Tailwind CSS.
 */

import React, { useMemo } from 'react';
import { getI18nBridge } from '../utils.js';
import { MoreActionsPopover } from './MoreActionsPopover.jsx';
import { SessionSelectPopover } from './SessionSelectPopover.jsx';

function mapStatusLabel(lifecycleStatus, t) {
  if (lifecycleStatus === 'active') return t('statusActive');
  if (lifecycleStatus === 'completed') return t('statusCompleted');
  return t('statusInactive');
}

export function TopBar({
  t,
  lang,
  activePanel,
  onSelectPanel,
  activeTab,
  onSelectTab,
  telemetry,
  selectedConversationId,
  onSelectConversation,
  selectedScope,
  onSelectScope,
  pollIntervalMs,
  onChangePollInterval,
  onToggleLang,
  onRefresh,
  statusTimestamp,
  openMenu = '',
}) {
  const { fmtInt, fmtCompact } = getI18nBridge();

  const conversationOptions = useMemo(() => {
    const list = Array.isArray(telemetry?.availableConversations)
      ? telemetry.availableConversations
      : [];
    return list.map((conv) => {
      const surfacePrefix =
        conv.surfaceId === 'antigravity-cli' ? '[CLI] ' : '';
      const shortId = String(conv.conversationId || '').slice(0, 8);
      let title = conv.title || '';
      if (title === `会话 ${shortId}`) {
        title = t('untitledSession')(shortId);
      }
      const subCount = Number(conv.subagentCount || 0);
      const subBadge =
        subCount > 0 ? ` · ${t('fmtSubagentsBadge')(subCount)}` : '';
      const lifecycleStatus = conv.lifecycleStatus || 'inactive';
      return {
        value: conv.conversationId,
        label: `${surfacePrefix}${title}${subBadge} (${shortId})`,
        lifecycleStatus,
        statusLabel: mapStatusLabel(lifecycleStatus, t),
      };
    });
  }, [telemetry?.availableConversations, t]);

  const globalConversationOptions = useMemo(() => {
    const list = Array.isArray(telemetry?.globalConversations)
      ? telemetry.globalConversations
      : Array.isArray(telemetry?.availableConversations)
        ? telemetry.availableConversations
        : [];
    return list.map((conv) => {
      const wsPrefix = conv.workspaceName ? `[${conv.workspaceName}] ` : '';
      const shortId = String(conv.conversationId || '').slice(0, 8);
      let title = conv.title || '';
      if (title === `会话 ${shortId}`) {
        title = t('untitledSession')(shortId);
      }
      const subCount = Number(conv.subagentCount || 0);
      const subBadge =
        subCount > 0 ? ` · ${t('fmtSubagentsBadge')(subCount)}` : '';
      const lifecycleStatus = conv.lifecycleStatus || 'inactive';
      return {
        value: conv.conversationId,
        label: `${wsPrefix}${title}${subBadge} (${shortId})`,
        lifecycleStatus,
        statusLabel: mapStatusLabel(lifecycleStatus, t),
      };
    });
  }, [
    telemetry?.globalConversations,
    telemetry?.availableConversations,
    t,
  ]);

  const subagentOptions = useMemo(() => {
    const sh = telemetry?.sessionHierarchy;
    if (!sh || !sh.subagentCount) return [];

    const treeTotals = sh.treeTotals || {};
    const rootTotals = sh.rootTotals || {};
    const shortRootId = String(sh.rootConversationId || '').slice(0, 8);
    let rootTitle = sh.rootTitle || '';
    if (rootTitle === `会话 ${shortRootId}`) {
      rootTitle = t('untitledSession')(shortRootId);
    }

    const treeStatus = sh.treeLifecycleStatus || 'inactive';
    const rootStatus = sh.rootLifecycleStatus || 'inactive';

    const items = [
      {
        value: 'tree',
        label: t('fmtScopeTreeOption')(
          sh.subagentCount,
          fmtInt(treeTotals.requestCount || 0),
          fmtCompact(treeTotals.grandTotalTokens || 0)
        ),
        lifecycleStatus: treeStatus,
        statusLabel: mapStatusLabel(treeStatus, t),
      },
      {
        value: 'root',
        label: t('fmtScopeRootOption')(
          rootTitle,
          fmtInt(rootTotals.requestCount || 0),
          fmtCompact(rootTotals.grandTotalTokens || 0)
        ),
        lifecycleStatus: rootStatus,
        statusLabel: mapStatusLabel(rootStatus, t),
      },
    ];

    const subNodes = (Array.isArray(sh.nodes) ? sh.nodes : []).filter(
      (n) => n.isSubagent
    );
    for (const sub of subNodes) {
      const depth = Math.max(1, Number(sub.nestingDepth || 1));
      const shortId = String(sub.conversationId || '').slice(0, 8);
      const title =
        sub.displayTitle || sub.agentRole || sub.agentName || shortId;
      const subStatus = sub.lifecycleStatus || 'inactive';
      items.push({
        value: sub.conversationId,
        label: t('fmtScopeSubOption')(
          depth,
          title,
          shortId,
          fmtInt(sub.requestCount || 0),
          fmtCompact(sub.grandTotalTokens || 0)
        ),
        lifecycleStatus: subStatus,
        statusLabel: mapStatusLabel(subStatus, t),
      });
    }

    return items;
  }, [telemetry?.sessionHierarchy, t, fmtInt, fmtCompact]);

  const globalReg = telemetry?.globalModelRegistry || {};
  const globalSessions = globalReg.scannedConversations || 0;
  const globalModelsCount = Array.isArray(globalReg.entries)
    ? globalReg.entries.length
    : 0;
  const globalSummaryText = t('fmtGlobalToolbarSummary')(
    globalSessions,
    globalModelsCount
  );

  const navTabBase =
    'flex-1 min-w-0 py-[5px] px-1.5 rounded-[7px] text-[12px] text-center whitespace-nowrap truncate cursor-pointer transition-colors';
  const navTabActive = 'bg-white text-[#1d1d1f] font-semibold';
  const navTabInactive =
    'bg-transparent text-[#515154] font-medium hover:opacity-88';

  return (
    <header className="bg-[#f5f5f7] rounded-[16px] py-2.5 px-3 flex flex-col gap-[7px] shrink-0 min-w-0 relative z-30">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5 items-center min-w-0 relative">
        <div
          className="inline-grid grid-cols-2 gap-0.5 bg-[#e8e8ed] p-0.5 rounded-[8px] shrink-0"
          role="group"
        >
          <button
            type="button"
            id="panelBtnConversation"
            className={`text-[11.5px] font-semibold py-[3px] px-[9px] rounded-[6px] whitespace-nowrap cursor-pointer transition-colors ${
              activePanel === 'conversation'
                ? 'bg-white text-[#1d1d1f]'
                : 'bg-transparent text-[#515154] hover:opacity-88'
            }`}
            onClick={() => onSelectPanel('conversation')}
          >
            {t('panelConversation')}
          </button>
          <button
            type="button"
            id="panelBtnGlobal"
            className={`text-[11.5px] font-semibold py-[3px] px-[9px] rounded-[6px] whitespace-nowrap cursor-pointer transition-colors ${
              activePanel === 'global'
                ? 'bg-white text-[#1d1d1f]'
                : 'bg-transparent text-[#515154] hover:opacity-88'
            }`}
            onClick={() => onSelectPanel('global')}
          >
            {t('panelGlobal')}
          </button>
        </div>

        {activePanel === 'conversation' ? (
          <SessionSelectPopover
            id="conversationSelect"
            options={conversationOptions}
            value={selectedConversationId}
            onChange={onSelectConversation}
            tooltip={t('selectConvTooltip')}
            defaultOpen={openMenu === 'conversation'}
          />
        ) : (
          <SessionSelectPopover
            id="globalConversationSelect"
            options={globalConversationOptions}
            value={selectedConversationId}
            onChange={onSelectConversation}
            tooltip={globalSummaryText}
            defaultOpen={openMenu === 'globalConversation'}
          />
        )}

        <MoreActionsPopover
          t={t}
          lang={lang}
          pollIntervalMs={pollIntervalMs}
          onChangePollInterval={onChangePollInterval}
          onToggleLang={onToggleLang}
          onRefresh={onRefresh}
          statusTimestamp={statusTimestamp}
          defaultOpen={openMenu === 'more'}
        />
      </div>

      {activePanel === 'conversation' && subagentOptions.length > 0 && (
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 items-center min-w-0 relative"
          id="subagentScopeRow"
        >
          <span
            className="inline-flex items-center gap-1 font-semibold text-[11px] text-[#515154] py-[5px] px-[7px] rounded-[8px] bg-[#e8e8ed] whitespace-nowrap select-none"
            id="subagentScopeBadge"
          >
            <svg
              className="w-3 h-3 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="4" cy="4" r="1.6" />
              <circle cx="12" cy="8" r="1.6" />
              <circle cx="12" cy="13" r="1.6" />
              <path
                d="M4 5.6V11a2 2 0 0 0 2 2h4.4M4 8h6.4"
                strokeLinecap="round"
              />
            </svg>
            <span>{t('subagentScopeLabel')}</span>
          </span>
          <SessionSelectPopover
            id="subagentScopeSelect"
            options={subagentOptions}
            value={selectedScope}
            onChange={onSelectScope}
            tooltip={t('selectScopeTooltip')}
            defaultOpen={openMenu === 'subagent'}
          />
        </div>
      )}

      <nav
        className="flex flex-nowrap items-center gap-1 bg-[#e8e8ed] p-[3px] rounded-[10px]"
        role="tablist"
      >
        {activePanel === 'conversation' ? (
          <>
            <button
              type="button"
              className={`${navTabBase} ${activeTab === 'overview' ? navTabActive : navTabInactive}`}
              data-tab="overview"
              onClick={() => onSelectTab('overview')}
            >
              {t('tabOverview')}
            </button>
            <button
              type="button"
              className={`${navTabBase} ${activeTab === 'details' ? navTabActive : navTabInactive}`}
              data-tab="details"
              onClick={() => onSelectTab('details')}
            >
              {t('tabDetails')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${navTabBase} ${activeTab === 'sessions' ? navTabActive : navTabInactive}`}
              data-tab="sessions"
              onClick={() => onSelectTab('sessions')}
            >
              {t('tabSessions')}
            </button>
            <button
              type="button"
              className={`${navTabBase} ${activeTab === 'models' ? navTabActive : navTabInactive}`}
              data-tab="models"
              onClick={() => onSelectTab('models')}
            >
              {t('tabModels')}
            </button>
            <button
              type="button"
              className={`${navTabBase} ${activeTab === 'steps' ? navTabActive : navTabInactive}`}
              data-tab="steps"
              onClick={() => onSelectTab('steps')}
            >
              {t('tabSteps')}
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
