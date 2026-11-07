/**
 * @fileoverview Shared formatting, localization, and API fetch utilities for
 * the React-based AGY Token Telemetry frontend.
 */

import * as i18nModule from './i18n.js';

export function getI18nBridge() {
  return i18nModule;
}

export function createTranslator(lang) {
  const { I18N } = i18nModule;
  const dict = I18N[lang] || I18N.en;
  return function t(key) {
    return dict[key] !== undefined ? dict[key] : I18N.en[key];
  };
}

export function formatStepSpan(step, singleIndexOnly = false) {
  if (!step) return '#-';
  const indices = Array.isArray(step.stepIndices) ? step.stepIndices : [];
  const firstIdx =
    typeof step.firstStepIndex === 'number' && step.firstStepIndex >= 0
      ? step.firstStepIndex
      : indices.length > 0
        ? indices[0]
        : -1;
  if (firstIdx < 0) return '#-';
  if (!singleIndexOnly && indices.length > 1 && step.lastStepIndex >= 0) {
    return `#${firstIdx}..${step.lastStepIndex}`;
  }
  return `#${firstIdx}`;
}

export function formatAutoCompactSource(ac, t) {
  if (!ac) return '-';
  if (ac.sourceType === 'process_env') return t('processEnvSource');
  if (ac.sourceType === 'shell_profile') {
    return t('shellProfileSource')(ac.sourceFile || 'shell');
  }
  return t('unsetDefaultPolicy');
}

export async function apiFetch(url, payload) {
  const params = new URLSearchParams();
  if (payload && payload.conversationId) {
    params.set('conversationId', payload.conversationId);
  }
  if (payload && payload.scope) {
    params.set('scope', String(payload.scope));
  }
  if (payload && payload.recentWindowSize) {
    params.set('recentWindowSize', String(payload.recentWindowSize));
  }
  if (payload && payload.workspaceUris) {
    params.set(
      'workspaceUris',
      typeof payload.workspaceUris === 'string'
        ? payload.workspaceUris
        : JSON.stringify(payload.workspaceUris)
    );
  }
  const query = params.toString();
  const getUrl = query ? `${url}?${query}` : url;

  const hasToken = Boolean(
    new URLSearchParams(window.location.search).get('token')
  );
  if (
    hasToken &&
    window.sidecar &&
    typeof window.sidecar.fetch === 'function'
  ) {
    const res = await window.sidecar.fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
    if (res.ok) return res.json();
  }

  const res = await fetch(getUrl);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
