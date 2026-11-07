/**
 * @fileoverview Bilingual localization dictionary (`en` / `zh-CN`), language
 * detection, and number/rate formatting utilities for AGY Telemetry UI.
 */

export const I18N = {
  en: {
    panelConversation: 'Session',
    panelGlobal: 'Global',
    selectConvTooltip: 'Select Root Conversation',
    selectScopeTooltip: 'Select Session Tree or Specific Sub-Agent',
    subagentScopeLabel: 'Sub-Sessions',
    pollTooltip: 'Poll Interval',
    langTooltip: 'Switch Language (English / 简体中文)',
    langToggleLabel: '中文',
    moreActionsTooltip: 'More Actions & Settings',
    menuRefreshLabel: 'Telemetry',
    menuPollLabel: 'Auto Refresh',
    menuLangLabel: 'Language',
    manualOption: 'Manual',
    refresh: 'Refresh',
    retry: 'Retry',
    tabOverview: 'Overview',
    tabDetails: 'Details',
    tabSessions: 'Global Sessions',
    tabModels: 'Model Registry',
    tabSteps: 'Config & Steps',
    statusActive: 'Active',
    statusCompleted: 'Completed',
    statusInactive: 'Inactive',
    gsTotalSessionsTitle: 'Global Sessions',
    unitSessions: 'sessions',
    gsWorkspacesTitle: 'Workspaces',
    gsWorkspaceMeta: 'Indexed Workspaces',
    unitWorkspaces: 'workspaces',
    gsTableTitle: 'Session History',
    thSessionTitle: 'Session',
    thWorkspace: 'Workspace',
    thStepsSubagents: 'Steps / Time',
    thLastActive: 'Last Active',
    fmtActiveSubagentsSummary: (active, subs) =>
      `${active} active · +${subs} sub`,
    fmtCurrentWorkspaceSessions: (ws, count) => `Current: ${ws} (${count})`,
    fmtStepsSubsCell: (steps, subs) =>
      subs > 0 ? `${steps} steps · +${subs} sub` : `${steps} steps`,
    tkE2ETitle: 'Velocity',
    tkTotalTitle: 'Token Usage',
    tkMixTitle: 'Token Mix',
    tkInputMixDesc: 'Input · Cache vs Fresh',
    tkOutputMixDesc: 'Output · Think vs Reply',
    tkValidListTitle: 'Request Log',
    mdDiscoveredTitle: 'Models',
    unitModels: 'models',
    mdGlobalCallsTitle: 'Total Calls',
    mdGlobalCallsMeta: 'All Sessions',
    unitCalls: 'calls',
    mdRegistryTableTitle: 'Model Registry',
    stAutoCompactTitle: 'Auto-Compact',
    stContextWinTitle: 'Context Limit',
    stStepsLogTitle: 'Step Log',
    thStep: 'Step',
    thModelEndpoint: 'Model & Endpoint',
    thCacheOutput: 'Cache / Output',
    thE2EVelocity: 'Velocity',
    thDisplayName: 'Model',
    thEndpointId: 'Endpoint',
    thCallsWindow: 'Calls / Win',
    thOutputTtft: 'Out / TTFT',
    noValidSamples: 'No valid samples yet',
    noModelsInSession: 'No models in this session',
    ovLatestVelocity: 'Velocity',
    ovContextWindow: 'Context Window',
    ovRecentTrend: 'Velocity Trend',
    ovModelsTitle: 'Session Models',
    defaultOn: 'Default On',
    defaultVal: 'Default',
    unsetDefaultPolicy: 'Unset (Default)',
    processEnvSource: 'process.env',
    shellProfileSource: (file) => `Shell (${file})`,
    overridden: 'Custom',
    notOverridden: 'Default',
    untitledSession: (shortId) => `Session ${shortId}`,
    fmtGlobalToolbarSummary: (sessions, models) =>
      `Global · ${sessions} sessions · ${models} models`,
    fmtSubagentsBadge: (n) => `+${n} sub`,
    fmtScopeTreeOption: (subCount, reqs, tok) =>
      `All (Main + ${subCount} Sub) · ${reqs} reqs · ${tok}`,
    fmtScopeRootOption: (title, reqs, tok) =>
      `Main · ${title} (${reqs} reqs · ${tok})`,
    fmtScopeSubOption: (depth, title, shortId, reqs, tok) =>
      `[L${depth}] ${title} (${shortId} · ${reqs} reqs · ${tok})`,
    fmtReqsCache: (reqs, cachePct) => `${reqs} reqs · Cache ${cachePct}`,
    fmtModelsCount: (n) => `${n} ${n === 1 ? 'model' : 'models'}`,
    fmtLast5TokS: (r5, ttft) => `5-avg ${r5} · TTFT ${ttft}`,
    fmtVelocityGroupSub: (latestRate, r5, ttft) =>
      `Now ${latestRate} · 5-avg ${r5} · TTFT ${ttft}`,
    fmtTokensGroupSub: (inp, out, cachePct) =>
      `In ${inp} · Out ${out} · Cache ${cachePct}`,
    fmtContextWindowMeta: (used, max, avail, stepTok) =>
      `Used ${used} / ${max} · Free ${avail} · ${stepTok}/cell`,
    fmtCtxGridTooltip: (filled, total, stepTok, used, max) =>
      `${filled}/${total} cells filled (${stepTok}/cell) · ${used} / ${max}`,
    fmtSessionAvgPeak: (avg, peak) => `Avg ${avg} · Peak ${peak}`,
    fmtAvailableCompact: (avail, compact) => `Free ${avail} · ${compact}`,
    fmtValidSamples: (n) => `${n} samples`,
    fmtLatestLast5: (lat, r5) => `Now ${lat} · 5-avg ${r5}`,
    fmtCacheHit: (pct) => `Cache ${pct}`,
    fmtTotalInOut: (inp, out) => `In ${inp} · Out ${out}`,
    fmtReqsRetries: (reqs, retries) => `${reqs} reqs · ${retries} retries`,
    fmtThinkRespMix: (think, pct, resp) =>
      `Think ${think} (${pct}%) / Reply ${resp}`,
    fmtValidReqsCount: (n) => `${n} requests`,
    fmtCacheShort: (c) => `Cache ${c}`,
    fmtTtftShort: (t) => `TTFT ${t}`,
    fmtAcrossSessions: (n) => `Across ${n} sessions`,
    fmtPrimaryModel: (m) => `Primary: ${m}`,
    fmtPrimaryEndpoint: (e) => `Endpoint: ${e}`,
    fmtAcrossSessionsCalls: (s, c) => `Across ${s} sessions · ${c} calls`,
    fmtCallsCount: (c) => `${c} calls`,
    fmtWinShort: (w) => `Win ${w}`,
    fmtOutShort: (o) => `Out ${o}`,
    fmtMaxStepOut: (maxOut, status) => `Max Output ${maxOut} · ${status}`,
    fmtStepsCount: (n) => `${n} steps`,
    fmtRetryBadge: (r) => `Retry x${r}`,
    fmtThinkRespShort: (t, r) => `T ${t} / R ${r}`,
    historyConversationsLabel: 'History Sessions',
    fmtHistoryConversationsCount: (n) => `${n} history`,
    backToActiveConversations: 'Back to Active',
  },
  'zh-CN': {
    panelConversation: '对话',
    panelGlobal: '全局',
    selectConvTooltip: '选择主会话',
    selectScopeTooltip: '切换全会话树汇总、仅主会话或指定子代理对话',
    subagentScopeLabel: '子对话范围',
    pollTooltip: '刷新周期',
    langTooltip: '切换语言 (简体中文 / English)',
    langToggleLabel: 'EN',
    moreActionsTooltip: '更多操作与设置',
    menuRefreshLabel: '遥测同步',
    menuPollLabel: '刷新频率',
    menuLangLabel: '界面语言',
    manualOption: '手动',
    refresh: '刷新',
    retry: '重试',
    tabOverview: '概览',
    tabDetails: '明细',
    tabSessions: '会话记录',
    tabModels: '模型字典',
    tabSteps: '配置与步骤',
    statusActive: '正常活跃',
    statusCompleted: '已完成',
    statusInactive: '不活跃',
    gsTotalSessionsTitle: '全局会话',
    unitSessions: '个',
    gsWorkspacesTitle: '工作区',
    gsWorkspaceMeta: '已索引目录',
    unitWorkspaces: '个',
    gsTableTitle: '全局会话记录',
    thSessionTitle: '会话',
    thWorkspace: '工作区',
    thStepsSubagents: '步数 / 时间',
    thLastActive: '活跃时间',
    fmtActiveSubagentsSummary: (active, subs) =>
      `${active} 活跃 · +${subs} 子代理`,
    fmtCurrentWorkspaceSessions: (ws, count) => `当前: ${ws} (${count})`,
    fmtStepsSubsCell: (steps, subs) =>
      subs > 0 ? `${steps} 步 · +${subs} 子代理` : `${steps} 步`,
    tkE2ETitle: '生成速率',
    tkTotalTitle: 'Token 消耗',
    tkMixTitle: 'Token 构成',
    tkInputMixDesc: '输入 · 缓存 vs 新增',
    tkOutputMixDesc: '输出 · 思考 vs 回复',
    tkValidListTitle: '请求明细',
    mdDiscoveredTitle: '模型总数',
    unitModels: '个',
    mdGlobalCallsTitle: '累计调用',
    mdGlobalCallsMeta: '全量会话',
    unitCalls: '次',
    mdRegistryTableTitle: '模型字典',
    stAutoCompactTitle: '自动压缩',
    stContextWinTitle: '窗口上限',
    stStepsLogTitle: '步骤明细',
    thStep: '步骤',
    thModelEndpoint: '模型与端点',
    thCacheOutput: '缓存 / 输出',
    thE2EVelocity: '速率',
    thDisplayName: '模型名称',
    thEndpointId: '底层端点',
    thCallsWindow: '调用 / 窗口',
    thOutputTtft: '产出 / 首字',
    noValidSamples: '暂无速率样本',
    noModelsInSession: '暂无模型记录',
    ovLatestVelocity: '生成速率',
    ovContextWindow: '上下文窗口',
    ovRecentTrend: '速率趋势',
    ovModelsTitle: '会话模型',
    defaultOn: '默认开启',
    defaultVal: '默认',
    unsetDefaultPolicy: '默认策略',
    processEnvSource: '环境变量 (process.env)',
    shellProfileSource: (file) => `配置 (${file})`,
    overridden: '已覆写',
    notOverridden: '未覆写',
    untitledSession: (shortId) => `会话 ${shortId}`,
    fmtGlobalToolbarSummary: (sessions, models) =>
      `全局 · ${sessions} 会话 · ${models} 模型`,
    fmtSubagentsBadge: (n) => `+${n} 子代理`,
    fmtScopeTreeOption: (subCount, reqs, tok) =>
      `全部 (主会话 + ${subCount} 子代理) · ${reqs}次 · ${tok}`,
    fmtScopeRootOption: (title, reqs, tok) =>
      `仅主会话 · ${title} (${reqs}次 · ${tok})`,
    fmtScopeSubOption: (depth, title, shortId, reqs, tok) =>
      `[L${depth}] ${title} (${shortId} · ${reqs}次 · ${tok})`,
    fmtReqsCache: (reqs, cachePct) => `${reqs}次 · 缓存 ${cachePct}`,
    fmtModelsCount: (n) => `${n} 个`,
    fmtLast5TokS: (r5, ttft) => `近5次 ${r5} · 首字 ${ttft}`,
    fmtVelocityGroupSub: (latestRate, r5, ttft) =>
      `最新 ${latestRate} · 近5次 ${r5} · 首字 ${ttft}`,
    fmtTokensGroupSub: (inp, out, cachePct) =>
      `入 ${inp} · 出 ${out} · 缓存 ${cachePct}`,
    fmtContextWindowMeta: (used, max, avail, stepTok) =>
      `已用 ${used} / ${max} · 剩余 ${avail} · ${stepTok}/格`,
    fmtCtxGridTooltip: (filled, total, stepTok, used, max) =>
      `已填充 ${filled}/${total} 格 (${stepTok}/格) · 已用 ${used} / ${max}`,
    fmtSessionAvgPeak: (avg, peak) => `均值 ${avg} · 峰值 ${peak}`,
    fmtAvailableCompact: (avail, compact) => `剩余 ${avail} · ${compact}`,
    fmtValidSamples: (n) => `${n} 次样本`,
    fmtLatestLast5: (lat, r5) => `最新 ${lat} · 近5次 ${r5}`,
    fmtCacheHit: (pct) => `缓存 ${pct}`,
    fmtTotalInOut: (inp, out) => `入 ${inp} · 出 ${out}`,
    fmtReqsRetries: (reqs, retries) => `${reqs}次 · 重试 ${retries}`,
    fmtThinkRespMix: (think, pct, resp) =>
      `思 ${think} (${pct}%) / 回 ${resp}`,
    fmtValidReqsCount: (n) => `共 ${n} 条`,
    fmtCacheShort: (c) => `缓存 ${c}`,
    fmtTtftShort: (t) => `首字 ${t}`,
    fmtAcrossSessions: (n) => `跨 ${n} 个会话`,
    fmtPrimaryModel: (m) => `主力模型 ${m}`,
    fmtPrimaryEndpoint: (e) => `主力端点 ${e}`,
    fmtAcrossSessionsCalls: (s, c) => `跨 ${s} 个会话 · ${c} 次调用`,
    fmtCallsCount: (c) => `${c} 次`,
    fmtWinShort: (w) => `窗口 ${w}`,
    fmtOutShort: (o) => `产出 ${o}`,
    fmtMaxStepOut: (maxOut, status) => `单步最大输出 ${maxOut} · ${status}`,
    fmtStepsCount: (n) => `共 ${n} 步`,
    fmtRetryBadge: (r) => `重试x${r}`,
    fmtThinkRespShort: (t, r) => `思 ${t} / 回 ${r}`,
    historyConversationsLabel: '历史对话',
    fmtHistoryConversationsCount: (n) => `${n} 个历史对话`,
    backToActiveConversations: '返回当前对话',
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
