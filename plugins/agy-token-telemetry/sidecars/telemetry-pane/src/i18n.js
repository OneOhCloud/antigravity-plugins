/**
 * @fileoverview Bilingual localization dictionary (`en` / `zh-CN`), language
 * detection, and number/rate/capacity formatting utilities for AGY Telemetry UI.
 */

export const I18N = {
  en: {
    panelConversation: 'Session',
    panelGlobal: 'Global',
    selectConvTooltip: 'Select Root Conversation',
    selectScopeTooltip: 'Select Live Tree, Main Session, or Sub-Agent',
    subagentScopeLabel: 'Scope',
    pollTooltip: 'Poll Interval',
    langTooltip: 'Switch Language (English / 简体中文)',
    langToggleLabel: '中文',
    moreActionsTooltip: 'More Actions & Settings',
    menuRefreshLabel: 'Telemetry',
    menuPollLabel: 'Refresh',
    menuLangLabel: 'Language',
    manualOption: 'Manual',
    refresh: 'Sync',
    retry: 'Retry',
    tabOverview: 'Overview',
    tabDetails: 'Details',
    tabSessions: 'Sessions',
    tabModels: 'Models',
    tabSteps: 'Config',
    statusActive: 'Active',
    statusCompleted: 'Completed',
    statusInactive: 'Inactive',
    gsTotalSessionsTitle: 'Sessions',
    unitSessions: 'sessions',
    gsWorkspacesTitle: 'Workspaces',
    gsWorkspaceMeta: 'Indexed',
    unitWorkspaces: 'ws',
    gsTableTitle: 'Sessions',
    thSessionTitle: 'Session',
    thWorkspace: 'Workspace',
    thStepsSubagents: 'Steps / Time',
    thLastActive: 'Active',
    fmtActiveSubagentsSummary: (active, subs) =>
      `${active} active · +${subs} sub`,
    fmtCurrentWorkspaceSessions: (ws, count) => `${ws} (${count})`,
    fmtSessionsHeaderMeta: (total, ws, active) =>
      `${total} sessions · ${ws} ws · ${active} active`,
    fmtStepsSubsCell: (steps, subs) =>
      subs > 0 ? `${steps} · +${subs} sub` : `${steps}`,
    tkE2ETitle: 'Velocity',
    tkTotalTitle: 'Tokens',
    tkMixTitle: 'Token Mix',
    tkInputMixDesc: 'Input · Cache / Fresh',
    tkOutputMixDesc: 'Output · Think / Reply',
    tkValidListTitle: 'Requests',
    sysCpuTitle: 'CPU',
    sysLoadTitle: 'Load',
    sysMemTitle: 'Memory',
    sysDiskTitle: 'Disk',
    fmtCpuCores: (c) => `${c}C`,
    fmtLoadSub: (l5) => `5m ${l5}`,
    fmtDiskAvail: (g) => `Free ${g}`,
    ghMtdTitle: 'MTD',
    ghWtdTitle: 'WTD',
    ghTodayTitle: 'Today',
    ghVsPrevMonth: 'vs prev mo',
    ghVsPrevWeek: 'vs prev wk',
    ghVsYesterday: 'vs yday',
    ghGranDay: 'Day',
    ghGranWeek: 'Week',
    ghGranMonth: 'Month',
    ghSliceTotal: 'Total',
    ghSliceInput: 'Input',
    ghSliceOutput: 'Output',
    ghSliceCalls: 'Calls',
    ghPrevPage: 'Older',
    ghNextPage: 'Newer',
    mdDiscoveredTitle: 'Models',
    unitModels: '',
    mdGlobalCallsTitle: 'Calls',
    mdGlobalCallsMeta: 'All Sessions',
    unitCalls: '',
    mdRegistryTableTitle: 'Models',
    stAutoCompactTitle: 'Auto-Compact',
    stContextWinTitle: 'Context Limit',
    stStepsLogTitle: 'Steps',
    thStep: 'Step',
    thModelEndpoint: 'Model',
    thCacheOutput: 'Out / Cache',
    thE2EVelocity: 'Velocity',
    thDisplayName: 'Model',
    thEndpointId: 'Endpoint',
    thCallsWindow: 'Calls / Win',
    thOutputTtft: 'Out / TTFT',
    noValidSamples: 'No samples',
    noLiveSamples1m: 'No active requests in past 1m',
    noModelsInSession: 'No active models',
    ovLatestVelocity: 'Velocity',
    ovContextWindow: 'Context Window',
    ovRecentTrend: 'Velocity Trend',
    ovModelsTitle: 'Models',
    defaultOn: 'Default On',
    defaultVal: 'Default',
    unsetDefaultPolicy: 'Default',
    processEnvSource: 'process.env',
    shellProfileSource: (file) => file,
    overridden: 'Custom',
    notOverridden: 'Default',
    untitledSession: (shortId) => `Session ${shortId}`,
    fmtGlobalToolbarSummary: (sessions, models) =>
      `${sessions} sessions · ${models} models`,
    fmtSubagentsBadge: (n) => `+${n} sub`,
    fmtScopeTreeOption: (subCount, reqs, tok) =>
      `All (Main + ${subCount} Sub) · ${reqs} · ${tok}`,
    fmtScopeTreeLiveOption: (liveCount, activeCount, reqs, tok) =>
      `Live (${liveCount}/${activeCount} active · 1m) · ${reqs} · ${tok}`,
    fmtScopeRootOption: (title, reqs, tok) =>
      `Main · ${title} (${reqs} · ${tok})`,
    fmtScopeSubOption: (depth, title, shortId, reqs, tok) =>
      `[L${depth}] ${title} (${shortId} · ${reqs} · ${tok})`,
    fmtReqsCache: (reqs, cachePct) => `${reqs} · Cache ${cachePct}`,
    fmtModelsCount: (n) => `${n}`,
    fmtLast5TokS: (r5, ttft) => `5x ${r5} · TTFT ${ttft}`,
    fmtVelocityGroupSub: (latestRate, r5, ttft) =>
      `Now ${latestRate} · 5x ${r5} · TTFT ${ttft}`,
    fmtTokensGroupSub: (inp, out, cachePct) =>
      `In ${inp} · Out ${out} · ${cachePct}`,
    fmtContextWindowMeta: (used, max, avail, stepTok) =>
      `${used} / ${max} · Free ${avail} · ${stepTok}/cell`,
    fmtCtxGridTooltip: (filled, total, stepTok, used, max, heuristic) =>
      heuristic
        ? `${filled}/${total} (${stepTok}/cell) · ${used} / ${max} (Est. ${heuristic})`
        : `${filled}/${total} (${stepTok}/cell) · ${used} / ${max}`,
    fmtSessionAvgPeak: (avg, peak) => `Avg ${avg} · Peak ${peak}`,
    fmtAvailableCompact: (avail, compact) => `Free ${avail} · ${compact}`,
    fmtValidSamples: (n) => `${n} reqs`,
    fmtLatestLast5: (lat, r5) => `Now ${lat} · 5x ${r5}`,
    fmtCacheHit: (pct) => `Cache ${pct}`,
    fmtTotalInOut: (inp, out) => `In ${inp} · Out ${out}`,
    fmtReqsRetries: (reqs, retries) =>
      retries > 0 ? `${reqs} reqs · ${retries} retry` : `${reqs} reqs`,
    fmtThinkRespMix: (think, pct, resp) =>
      `T ${think} (${pct}%) / R ${resp}`,
    fmtValidReqsCount: (n) => `${n}`,
    fmtCacheShort: (c) => `Cache ${c}`,
    fmtTtftShort: (t) => `TTFT ${t}`,
    fmtAcrossSessions: (n) => `${n} sessions`,
    fmtPrimaryModel: (m) => m,
    fmtPrimaryEndpoint: (e) => e,
    fmtAcrossSessionsCalls: (s, c) => `${s} sessions · ${c} calls`,
    fmtCallsCount: (c) => `${c}`,
    fmtWinShort: (w) => `Win ${w}`,
    fmtOutShort: (o) => `Out ${o}`,
    fmtMaxStepOut: (maxOut, status) => `Max Out ${maxOut} · ${status}`,
    fmtStepsCount: (n) => `${n} steps`,
    fmtRetryBadge: (r) => `x${r}`,
    fmtThinkRespShort: (t, r) => `T ${t} / R ${r}`,
    historyConversationsLabel: 'Sessions',
    fmtHistoryConversationsCount: (n) => `${n}`,
    backToActiveConversations: 'Back',
    backToMoreSettings: 'Back',
  },
  'zh-CN': {
    panelConversation: '对话',
    panelGlobal: '全局',
    selectConvTooltip: '选择主会话',
    selectScopeTooltip: '切换活跃实时汇总、仅主会话或指定子代理',
    subagentScopeLabel: '范围',
    pollTooltip: '刷新周期',
    langTooltip: '切换语言 (简体中文 / English)',
    langToggleLabel: 'EN',
    moreActionsTooltip: '设置与会话切换',
    menuRefreshLabel: '同步',
    menuPollLabel: '刷新频率',
    menuLangLabel: '语言',
    manualOption: '手动',
    refresh: '刷新',
    retry: '重试',
    tabOverview: '概览',
    tabDetails: '明细',
    tabSessions: '会话',
    tabModels: '模型',
    tabSteps: '配置',
    statusActive: '活跃',
    statusCompleted: '已完成',
    statusInactive: '不活跃',
    gsTotalSessionsTitle: '会话',
    unitSessions: '个',
    gsWorkspacesTitle: '工作区',
    gsWorkspaceMeta: '已索引',
    unitWorkspaces: '个',
    gsTableTitle: '会话记录',
    thSessionTitle: '会话',
    thWorkspace: '工作区',
    thStepsSubagents: '步数 / 时间',
    thLastActive: '时间',
    fmtActiveSubagentsSummary: (active, subs) =>
      `${active} 活跃 · +${subs} 子代理`,
    fmtCurrentWorkspaceSessions: (ws, count) => `${ws} (${count})`,
    fmtSessionsHeaderMeta: (total, ws, active) =>
      `${total} 会话 · ${ws} 工作区 · ${active} 活跃`,
    fmtStepsSubsCell: (steps, subs) =>
      subs > 0 ? `${steps} 步 · +${subs}` : `${steps} 步`,
    tkE2ETitle: '生成速率',
    tkTotalTitle: 'Token 消耗',
    tkMixTitle: 'Token 构成',
    tkInputMixDesc: '输入 · 缓存 / 新增',
    tkOutputMixDesc: '输出 · 思考 / 回复',
    tkValidListTitle: '请求明细',
    sysCpuTitle: '处理器',
    sysLoadTitle: '负载',
    sysMemTitle: '内存',
    sysDiskTitle: '磁盘',
    fmtCpuCores: (c) => `${c}核`,
    fmtLoadSub: (l5) => `5分 ${l5}`,
    fmtDiskAvail: (g) => `余 ${g}`,
    ghMtdTitle: '本月',
    ghWtdTitle: '本周',
    ghTodayTitle: '今日',
    ghVsPrevMonth: '较上月',
    ghVsPrevWeek: '较上周',
    ghVsYesterday: '较昨日',
    ghGranDay: '日',
    ghGranWeek: '周',
    ghGranMonth: '月',
    ghSliceTotal: '总计',
    ghSliceInput: '输入',
    ghSliceOutput: '输出',
    ghSliceCalls: '调用',
    ghPrevPage: '更早',
    ghNextPage: '更新',
    mdDiscoveredTitle: '模型数',
    unitModels: '个',
    mdGlobalCallsTitle: '总调用',
    mdGlobalCallsMeta: '全量会话',
    unitCalls: '次',
    mdRegistryTableTitle: '模型字典',
    stAutoCompactTitle: '自动压缩',
    stContextWinTitle: '窗口上限',
    stStepsLogTitle: '步骤明细',
    thStep: '步骤',
    thModelEndpoint: '模型',
    thCacheOutput: '输出 / 缓存',
    thE2EVelocity: '速率',
    thDisplayName: '模型',
    thEndpointId: '端点',
    thCallsWindow: '调用 / 窗口',
    thOutputTtft: '输出 / 首字',
    noValidSamples: '暂无样本',
    noLiveSamples1m: '近 1 分钟无活跃请求',
    noModelsInSession: '暂无活跃模型',
    ovLatestVelocity: '生成速率',
    ovContextWindow: '上下文窗口',
    ovRecentTrend: '速率趋势',
    ovModelsTitle: '会话模型',
    defaultOn: '默认开启',
    defaultVal: '默认',
    unsetDefaultPolicy: '默认策略',
    processEnvSource: 'process.env',
    shellProfileSource: (file) => file,
    overridden: '自定义',
    notOverridden: '默认',
    untitledSession: (shortId) => `会话 ${shortId}`,
    fmtGlobalToolbarSummary: (sessions, models) =>
      `${sessions} 会话 · ${models} 模型`,
    fmtSubagentsBadge: (n) => `+${n}`,
    fmtScopeTreeOption: (subCount, reqs, tok) =>
      `全部 (主 + ${subCount}子) · ${reqs}次 · ${tok}`,
    fmtScopeTreeLiveOption: (liveCount, activeCount, reqs, tok) =>
      `全部实时 (${liveCount}/${activeCount}活跃 · 1分) · ${reqs}次 · ${tok}`,
    fmtScopeRootOption: (title, reqs, tok) =>
      `主会话 · ${title} (${reqs}次 · ${tok})`,
    fmtScopeSubOption: (depth, title, shortId, reqs, tok) =>
      `[L${depth}] ${title} (${shortId} · ${reqs}次 · ${tok})`,
    fmtReqsCache: (reqs, cachePct) => `${reqs}次 · 缓 ${cachePct}`,
    fmtModelsCount: (n) => `${n} 个`,
    fmtLast5TokS: (r5, ttft) => `近5 ${r5} · 首 ${ttft}`,
    fmtVelocityGroupSub: (latestRate, r5, ttft) =>
      `新 ${latestRate} · 近5 ${r5} · 首 ${ttft}`,
    fmtTokensGroupSub: (inp, out, cachePct) =>
      `入 ${inp} · 出 ${out} · 缓 ${cachePct}`,
    fmtContextWindowMeta: (used, max, avail, stepTok) =>
      `${used} / ${max} · 余 ${avail} · ${stepTok}/格`,
    fmtCtxGridTooltip: (filled, total, stepTok, used, max, heuristic) =>
      heuristic
        ? `${filled}/${total}格 (${stepTok}/格) · ${used} / ${max} (预估 ${heuristic})`
        : `${filled}/${total}格 (${stepTok}/格) · ${used} / ${max}`,
    fmtSessionAvgPeak: (avg, peak) => `均 ${avg} · 峰 ${peak}`,
    fmtAvailableCompact: (avail, compact) => `余 ${avail} · ${compact}`,
    fmtValidSamples: (n) => `${n} 次`,
    fmtLatestLast5: (lat, r5) => `新 ${lat} · 近5 ${r5}`,
    fmtCacheHit: (pct) => `缓 ${pct}`,
    fmtTotalInOut: (inp, out) => `入 ${inp} · 出 ${out}`,
    fmtReqsRetries: (reqs, retries) =>
      retries > 0 ? `${reqs}次 · 重试 ${retries}` : `${reqs} 次`,
    fmtThinkRespMix: (think, pct, resp) =>
      `思 ${think} (${pct}%) / 回 ${resp}`,
    fmtValidReqsCount: (n) => `${n} 条`,
    fmtCacheShort: (c) => `缓 ${c}`,
    fmtTtftShort: (t) => `首 ${t}`,
    fmtAcrossSessions: (n) => `${n} 会话`,
    fmtPrimaryModel: (m) => m,
    fmtPrimaryEndpoint: (e) => e,
    fmtAcrossSessionsCalls: (s, c) => `${s} 会话 · ${c} 次`,
    fmtCallsCount: (c) => `${c} 次`,
    fmtWinShort: (w) => `窗 ${w}`,
    fmtOutShort: (o) => `出 ${o}`,
    fmtMaxStepOut: (maxOut, status) => `单步上限 ${maxOut} · ${status}`,
    fmtStepsCount: (n) => `${n} 步`,
    fmtRetryBadge: (r) => `重试x${r}`,
    fmtThinkRespShort: (t, r) => `思 ${t} / 回 ${r}`,
    historyConversationsLabel: '切换会话',
    fmtHistoryConversationsCount: (n) => `${n}`,
    backToActiveConversations: '返回',
    backToMoreSettings: '返回',
  },
};

export function normalizeLangCode(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en';
  return '';
}

export function detectInitialLang(savedLang, urlLang) {
  const fromUrl = normalizeLangCode(urlLang);
  if (fromUrl) return fromUrl;
  const fromSaved = normalizeLangCode(savedLang);
  if (fromSaved) return fromSaved;
  if (typeof window !== 'undefined' && window.sidecar && window.sidecar.locale) {
    const fromSidecar = normalizeLangCode(window.sidecar.locale);
    if (fromSidecar) return fromSidecar;
  }
  const navCandidates =
    typeof navigator !== 'undefined' &&
    Array.isArray(navigator.languages) &&
    navigator.languages.length > 0
      ? navigator.languages
      : [typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en'];
  for (const cand of navCandidates) {
    const norm = normalizeLangCode(cand);
    if (norm) return norm;
  }
  return 'en';
}

export const fmtInt = (n) => {
  const val = Number(n);
  return Number.isFinite(val) ? Math.round(val).toLocaleString('en-US') : '0';
};

export const fmtCompact = (n) => {
  const val = Number(n);
  if (!Number.isFinite(val)) return '0';
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(1) + 'k';
  return Math.round(val).toLocaleString('en-US');
};

export const fmtRate = (n) => {
  const val = Number(n);
  return Number.isFinite(val) && val > 0 ? val.toFixed(1) : '-';
};

export const fmtSec = (n) => {
  const val = Number(n);
  return Number.isFinite(val) && val > 0 ? val.toFixed(2) + 's' : '-';
};

export const fmtPct = (ratio) => {
  const val = Number(ratio);
  return Number.isFinite(val) ? (val * 100).toFixed(1) + '%' : '0.0%';
};

export const fmtSignedTrend = (ratio) => {
  if (ratio === null || ratio === undefined) return '-';
  const val = Number(ratio);
  if (!Number.isFinite(val)) return '-';
  const pct = val * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

export const fmtBytesGib = (bytes) => {
  const val = Number(bytes);
  if (!Number.isFinite(val) || val <= 0) return '0G';
  const gib = val / 1024 ** 3;
  return gib >= 100 ? `${Math.round(gib)}G` : `${gib.toFixed(1)}G`;
};

export const fmtMemoryPairGib = (usedBytes, totalBytes) => {
  const u = Number(usedBytes);
  const tot = Number(totalBytes);
  if (!Number.isFinite(tot) || tot <= 0) return '-';
  const uGib = Math.max(0, u) / 1024 ** 3;
  const tGib = tot / 1024 ** 3;
  return `${uGib.toFixed(1)}/${Math.round(tGib)}G`;
};
