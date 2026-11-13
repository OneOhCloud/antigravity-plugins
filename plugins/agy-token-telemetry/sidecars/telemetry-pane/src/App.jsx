/**
 * @fileoverview Root React 18 component for the AGY Token Telemetry Auxiliary
 * Pane. Styled exclusively with Tailwind CSS utility classes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConversationDetailsPane } from './components/ConversationDetailsPane.jsx';
import { ConversationOverviewPane } from './components/ConversationOverviewPane.jsx';
import { GlobalConfigStepsPane } from './components/GlobalConfigStepsPane.jsx';
import { GlobalModelsPane } from './components/GlobalModelsPane.jsx';
import { GlobalSessionsPane } from './components/GlobalSessionsPane.jsx';
import { TopBar } from './components/TopBar.jsx';
import { apiFetch, createTranslator, getI18nBridge } from './utils.js';

function readSavedPrefs() {
  try {
    return JSON.parse(localStorage.getItem('agy_telemetry_studio_v1') || '{}');
  } catch {
    return {};
  }
}

export function App() {
  const { detectInitialLang, normalizeLangCode } = getI18nBridge();
  const savedPrefs = useMemo(() => readSavedPrefs(), []);
  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );

  const initialTabParam = urlParams.get('tab') || '';
  const initialPanelParam = urlParams.get('panel') || '';
  const initialIsGlobal =
    initialPanelParam === 'global' ||
    initialTabParam === 'sessions' ||
    initialTabParam === 'models' ||
    initialTabParam === 'steps';

  const [activePanel, setActivePanel] = useState(
    initialIsGlobal ? 'global' : 'conversation'
  );
  const [convTab, setConvTab] = useState(
    initialTabParam === 'details' || initialTabParam === 'tokens'
      ? 'details'
      : 'overview'
  );
  const [globalTab, setGlobalTab] = useState(
    initialTabParam === 'steps'
      ? 'steps'
      : initialTabParam === 'models'
        ? 'models'
        : 'sessions'
  );

  const initialWorkspaceUris = useMemo(() => {
    const fromParams = urlParams.getAll('workspaceUri').filter(Boolean);
    return fromParams;
  }, [urlParams]);

  const [selectedConversationId, setSelectedConversationId] = useState(
    urlParams.get('conversationId') ||
      (window.sidecar && window.sidecar.conversationId) ||
      ''
  );
  const [selectedScope, setSelectedScope] = useState(
    urlParams.get('scope') || 'root'
  );
  const [treeMode, setTreeMode] = useState(() => {
    const raw = urlParams.get('treeMode') || savedPrefs.treeMode || 'active_full';
    return raw === 'live_1m' ? 'live_1m' : 'active_full';
  });
  const [pollIntervalMs, setPollIntervalMs] = useState(() => {
    if (urlParams.get('poll') !== null) return Number(urlParams.get('poll'));
    if (typeof savedPrefs.pollIntervalMs === 'number') {
      return savedPrefs.pollIntervalMs;
    }
    return 5000;
  });
  const [lang, setLang] = useState(() =>
    detectInitialLang(savedPrefs.lang, urlParams.get('lang'))
  );
  const [userExplicitLang, setUserExplicitLang] = useState(
    Boolean(urlParams.get('lang') || savedPrefs.lang)
  );
  const [telemetry, setTelemetry] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const inFlightRef = useRef(false);
  const selectedConvRef = useRef(selectedConversationId);
  const selectedScopeRef = useRef(selectedScope);
  const treeModeRef = useRef(treeMode);
  const workspaceUrisRef = useRef(initialWorkspaceUris);
  selectedConvRef.current = selectedConversationId;
  selectedScopeRef.current = selectedScope;
  treeModeRef.current = treeMode;

  const t = useMemo(() => createTranslator(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const refreshTelemetry = useCallback(
    async (
      explicitConvId,
      explicitScope,
      explicitWorkspaceUris,
      explicitTreeMode
    ) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const targetId =
          explicitConvId !== undefined
            ? explicitConvId
            : selectedConvRef.current;
        const targetScope =
          explicitScope !== undefined
            ? explicitScope
            : selectedScopeRef.current;
        const targetWsUris =
          explicitWorkspaceUris !== undefined
            ? explicitWorkspaceUris
            : workspaceUrisRef.current;
        const targetTreeMode =
          explicitTreeMode !== undefined
            ? explicitTreeMode
            : treeModeRef.current;

        const queryParams = {
          conversationId: targetId,
          scope: targetScope,
          treeMode: targetTreeMode,
          recentWindowSize: 5,
        };
        if (Array.isArray(targetWsUris) && targetWsUris.length > 0) {
          queryParams.workspaceUris = JSON.stringify(targetWsUris);
        }

        const data = await apiFetch('/api/telemetry', queryParams);
        setFetchError(false);
        setTelemetry(data);
        if (data.conversationId) {
          setSelectedConversationId(data.conversationId);
        }
        if (data.activeScope) {
          setSelectedScope(data.activeScope);
        }
        if (data.themePrefs && !userExplicitLang) {
          const prefLang = normalizeLangCode(data.themePrefs.lang);
          const hostLang = normalizeLangCode(data.runtimeEnv?.hostLocale);
          const targetLang = prefLang || hostLang;
          if (targetLang && targetLang !== lang) {
            setLang(targetLang);
            if (prefLang) setUserExplicitLang(true);
          }
        }
      } catch {
        setFetchError(true);
      } finally {
        inFlightRef.current = false;
      }
    },
    [lang, normalizeLangCode, userExplicitLang]
  );

  useEffect(() => {
    let cancelled = false;
    async function initWorkspaceAndFetch() {
      if (
        workspaceUrisRef.current.length === 0 &&
        window.sidecar &&
        typeof window.sidecar.getWorkspaceUris === 'function' &&
        window.parent !== window
      ) {
        try {
          const resolvedUris = await Promise.race([
            window.sidecar.getWorkspaceUris(),
            new Promise((resolve) => setTimeout(() => resolve([]), 200)),
          ]);
          if (
            !cancelled &&
            Array.isArray(resolvedUris) &&
            resolvedUris.length > 0
          ) {
            workspaceUrisRef.current = resolvedUris;
          }
        } catch {
          // Ignore workspace bridge timeout
        }
      }
      if (!cancelled) {
        refreshTelemetry(
          selectedConvRef.current,
          selectedScopeRef.current,
          workspaceUrisRef.current
        );
      }
    }
    initWorkspaceAndFetch();

    let unsubscribe = () => {};
    if (
      window.sidecar &&
      typeof window.sidecar.onWorkspaceChange === 'function'
    ) {
      unsubscribe = window.sidecar.onWorkspaceChange((nextUris) => {
        if (!Array.isArray(nextUris) || nextUris.length === 0) return;
        const prevKey = workspaceUrisRef.current.join('|');
        const nextKey = nextUris.join('|');
        if (prevKey !== nextKey) {
          workspaceUrisRef.current = nextUris;
          selectedConvRef.current = '';
          setSelectedConversationId('');
          setSelectedScope('root');
          refreshTelemetry('', 'root', nextUris);
        }
      });
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshTelemetry]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return undefined;
    const timer = setInterval(() => {
      refreshTelemetry(selectedConvRef.current, selectedScopeRef.current);
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs, refreshTelemetry]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshTelemetry(selectedConvRef.current, selectedScopeRef.current);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshTelemetry]);

  const handleChangePollInterval = useCallback((nextPollMs) => {
    setPollIntervalMs(nextPollMs);
    try {
      const prev = readSavedPrefs();
      localStorage.setItem(
        'agy_telemetry_studio_v1',
        JSON.stringify({ ...prev, pollIntervalMs: nextPollMs })
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleToggleLang = useCallback(() => {
    const nextLang = lang === 'zh-CN' ? 'en' : 'zh-CN';
    setLang(nextLang);
    setUserExplicitLang(true);
    try {
      const prev = readSavedPrefs();
      localStorage.setItem(
        'agy_telemetry_studio_v1',
        JSON.stringify({ ...prev, lang: nextLang })
      );
      fetch(`/api/theme?lang=${encodeURIComponent(nextLang)}`).catch(() => {});
    } catch {
      // Ignore storage errors
    }
  }, [lang]);

  const handleSelectConversation = useCallback(
    (nextConvId) => {
      setSelectedConversationId(nextConvId);
      setSelectedScope('root');
      refreshTelemetry(nextConvId, 'root');
    },
    [refreshTelemetry]
  );

  const handleSelectScope = useCallback(
    (nextScope) => {
      const normalized = nextScope || 'root';
      setSelectedScope(normalized);
      refreshTelemetry(selectedConvRef.current, normalized);
    },
    [refreshTelemetry]
  );

  const handleChangeTreeMode = useCallback(
    (nextMode) => {
      const normalized = nextMode === 'live_1m' ? 'live_1m' : 'active_full';
      setTreeMode(normalized);
      treeModeRef.current = normalized;
      try {
        const prev = readSavedPrefs();
        localStorage.setItem(
          'agy_telemetry_studio_v1',
          JSON.stringify({ ...prev, treeMode: normalized })
        );
      } catch {
        // Ignore storage errors
      }
      refreshTelemetry(
        selectedConvRef.current,
        selectedScopeRef.current,
        workspaceUrisRef.current,
        normalized
      );
    },
    [refreshTelemetry]
  );

  const handleSelectPanel = useCallback(
    (nextPanel) => {
      setActivePanel(nextPanel);
      if (nextPanel === 'conversation' && telemetry) {
        const wsConvs = Array.isArray(telemetry.availableConversations)
          ? telemetry.availableConversations
          : [];
        if (
          wsConvs.length > 0 &&
          !wsConvs.some((c) => c.conversationId === selectedConvRef.current)
        ) {
          const fallbackId = wsConvs[0].conversationId;
          setSelectedConversationId(fallbackId);
          setSelectedScope('root');
          refreshTelemetry(fallbackId, 'root', workspaceUrisRef.current);
        }
      }
    },
    [telemetry, refreshTelemetry]
  );

  const handleSelectTab = useCallback(
    (tabId) => {
      if (activePanel === 'conversation') {
        setConvTab(tabId);
      } else {
        setGlobalTab(tabId);
      }
    },
    [activePanel]
  );

  const statusTimestamp = useMemo(() => {
    if (fetchError) return t('retry');
    if (!telemetry?.collectedAt) return t('refresh');
    return new Date(telemetry.collectedAt).toLocaleTimeString(
      lang === 'zh-CN' ? 'zh-CN' : 'en-US',
      { hour12: false }
    );
  }, [fetchError, telemetry?.collectedAt, lang, t]);

  const activeTab = activePanel === 'conversation' ? convTab : globalTab;
  const openMenuParam = urlParams.get('openMenu') || '';
  const initialGranularityParam = urlParams.get('granularity') || 'day';

  return (
    <div
      id="appShell"
      className="h-screen max-h-screen w-full max-w-[560px] mx-auto py-3 px-3.5 sm:py-3.5 sm:px-4 flex flex-col gap-5 overflow-hidden bg-white text-[#1d1d1f] font-sans text-[13px] leading-[1.45] antialiased"
    >
      <TopBar
        t={t}
        lang={lang}
        activePanel={activePanel}
        onSelectPanel={handleSelectPanel}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        telemetry={telemetry}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        selectedScope={selectedScope}
        onSelectScope={handleSelectScope}
        treeMode={treeMode}
        onChangeTreeMode={handleChangeTreeMode}
        pollIntervalMs={pollIntervalMs}
        onChangePollInterval={handleChangePollInterval}
        onToggleLang={handleToggleLang}
        onRefresh={() =>
          refreshTelemetry(
            selectedConvRef.current,
            selectedScopeRef.current,
            workspaceUrisRef.current
          )
        }
        statusTimestamp={statusTimestamp}
        openMenu={openMenuParam}
      />

      <main className="flex-1 min-h-0 max-h-full flex flex-col overflow-hidden relative z-[1]">
        {activePanel === 'conversation' ? (
          convTab === 'details' ? (
            <ConversationDetailsPane data={telemetry} t={t} />
          ) : (
            <ConversationOverviewPane data={telemetry} t={t} />
          )
        ) : globalTab === 'steps' ? (
          <GlobalConfigStepsPane data={telemetry} t={t} />
        ) : globalTab === 'models' ? (
          <GlobalModelsPane data={telemetry} t={t} />
        ) : (
          <GlobalSessionsPane
            data={telemetry}
            t={t}
            lang={lang}
            initialGranularity={initialGranularityParam}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </main>
    </div>
  );
}
