/**
 * @fileoverview Sidecar backend entrypoint for the Antigravity Token & Model
 * Telemetry Auxiliary Pane (`SIDECAR_UI_ENTRYPOINT_AUX_PANE`).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  collectConversationTelemetry,
  listAvailableConversations,
} from './collector.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_HTML_PATH = join(__dirname, 'ui.html');
const THEME_PREFS_PATH = join(
  homedir(),
  '.gemini',
  'config',
  'agy-token-telemetry-theme.json'
);

function readThemePrefs() {
  try {
    if (existsSync(THEME_PREFS_PATH)) {
      const parsed = JSON.parse(readFileSync(THEME_PREFS_PATH, 'utf-8'));
      return {
        layoutId: parsed.layoutId || 'L06',
        iconId: parsed.iconId || 'I20',
        colorId: parsed.colorId || 'C01',
        lang: parsed.lang || '',
        updatedAt: parsed.updatedAt || 0,
      };
    }
  } catch {
    // Fallback to defaults
  }
  return { layoutId: 'L06', iconId: 'I20', colorId: 'C01', lang: '', updatedAt: 0 };
}

function writeThemePrefs(nextPrefs) {
  const merged = {
    ...readThemePrefs(),
    ...nextPrefs,
    updatedAt: Date.now(),
  };
  try {
    writeFileSync(THEME_PREFS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
  return merged;
}

async function loadSidecarSdk() {
  try {
    return await import('sidecar_sdk');
  } catch {
    const fallbackSdkPath = join(
      homedir(),
      '.gemini',
      'config',
      'node_modules',
      'sidecar_sdk',
      'index.mjs'
    );
    return await import(pathToFileURL(fallbackSdkPath).href);
  }
}

export async function startTelemetrySidecar() {
  const { SidecarApp, Response } = await loadSidecarSdk();
  const app = new SidecarApp();

  const serveUiPage = () => readFileSync(UI_HTML_PATH, 'utf-8');
  app.page('/', serveUiPage);
  app.page('/index.html', serveUiPage);
  app.page('/host.html', serveUiPage);

  const handleTelemetryRequest = async (data = {}) => {
    const requestedConvId =
      typeof data.conversationId === 'string' && data.conversationId.trim()
        ? data.conversationId.trim()
        : app.config.conversationId || '';
    const recentWindowSize =
      Number(data.recentWindowSize) > 0 ? Number(data.recentWindowSize) : 5;

    const payload = await collectConversationTelemetry(requestedConvId, {
      recentWindowSize,
    });
    payload.themePrefs = readThemePrefs();
    return payload;
  };

  app.api('/api/telemetry', handleTelemetryRequest, 'POST');
  app.api('/api/telemetry', handleTelemetryRequest, 'GET');

  const handleThemeRequest = async (data = {}) => {
    let prefs = readThemePrefs();
    if (data.layoutId || data.iconId || data.colorId || data.lang !== undefined) {
      prefs = writeThemePrefs({
        layoutId: data.layoutId || prefs.layoutId,
        iconId: data.iconId || prefs.iconId,
        colorId: data.colorId || prefs.colorId,
        lang: data.lang !== undefined ? String(data.lang) : prefs.lang,
      });
    }
    return new Response(JSON.stringify(prefs), {
      contentType: 'application/json',
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  };

  app.api('/api/theme', handleThemeRequest, 'GET');
  app.api('/api/theme', handleThemeRequest, 'POST');

  const handleConversationsRequest = async () => ({
    activeConversationId: app.config.conversationId || '',
    conversations: listAvailableConversations({ limit: 60 }),
  });

  app.api('/api/conversations', handleConversationsRequest, 'POST');
  app.api('/api/conversations', handleConversationsRequest, 'GET');

  const server = await app.run();
  return { app, server };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  startTelemetrySidecar().catch((err) => {
    console.error('[agy-token-telemetry] Failed to start sidecar:', err);
    process.exit(1);
  });
}
