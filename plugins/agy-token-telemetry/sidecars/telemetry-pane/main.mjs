/**
 * @fileoverview Sidecar backend entrypoint for the Antigravity Token & Model
 * Telemetry Auxiliary Pane (`SIDECAR_UI_ENTRYPOINT_AUX_PANE`). Serves the
 * compiled production React + Tailwind CSS build from `dist/`.
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
const DIST_HTML_PATH = join(__dirname, 'dist', 'index.html');
const DIST_CSS_PATH = join(__dirname, 'dist', 'assets', 'app.css');
const DIST_JS_PATH = join(__dirname, 'dist', 'assets', 'app.js');
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
        lang: typeof parsed.lang === 'string' ? parsed.lang : '',
        updatedAt: parsed.updatedAt || 0,
      };
    }
  } catch {
    // Fallback to defaults
  }
  return { lang: '', updatedAt: 0 };
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
    const candidates = [
      join(
        homedir(),
        '.gemini',
        'antigravity',
        'lib',
        'node_modules',
        'sidecar_sdk',
        'index.mjs'
      ),
      join(
        homedir(),
        '.gemini',
        'config',
        'node_modules',
        'sidecar_sdk',
        'index.mjs'
      ),
    ];
    const fallbackSdkPath =
      candidates.find((candidate) => existsSync(candidate)) || candidates[0];
    return await import(pathToFileURL(fallbackSdkPath).href);
  }
}

export async function startTelemetrySidecar() {
  const { SidecarApp, Response } = await loadSidecarSdk();
  const app = new SidecarApp();

  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  };
  const serveUiPage = () =>
    new Response(readFileSync(DIST_HTML_PATH, 'utf-8'), {
      contentType: 'text/html; charset=utf-8',
      headers: noCacheHeaders,
    });
  app.page('/', serveUiPage);
  app.page('/index.html', serveUiPage);
  app.page('/host.html', serveUiPage);
  app.page(
    '/assets/app.css',
    () =>
      new Response(readFileSync(DIST_CSS_PATH, 'utf-8'), {
        contentType: 'text/css; charset=utf-8',
        headers: noCacheHeaders,
      })
  );
  app.page(
    '/assets/app.js',
    () =>
      new Response(readFileSync(DIST_JS_PATH, 'utf-8'), {
        contentType: 'application/javascript; charset=utf-8',
        headers: noCacheHeaders,
      })
  );

  const handleTelemetryRequest = async (data = {}) => {
    const requestedConvId =
      typeof data.conversationId === 'string' && data.conversationId.trim()
        ? data.conversationId.trim()
        : app.config.conversationId || '';
    const requestedScope =
      typeof data.scope === 'string' && data.scope.trim()
        ? data.scope.trim()
        : '';
    const requestedTreeMode =
      typeof data.treeMode === 'string' && data.treeMode.trim()
        ? data.treeMode.trim()
        : '';
    const rawWorkspaceUris = data.workspaceUris ?? data.workspaceUri ?? [];
    const recentWindowSize =
      Number(data.recentWindowSize) > 0 ? Number(data.recentWindowSize) : 5;

    const payload = await collectConversationTelemetry(requestedConvId, {
      recentWindowSize,
      scope: requestedScope,
      treeMode: requestedTreeMode,
      workspaceUris: rawWorkspaceUris,
    });
    payload.themePrefs = readThemePrefs();
    return payload;
  };

  app.api('/api/telemetry', handleTelemetryRequest, 'POST');
  app.api('/api/telemetry', handleTelemetryRequest, 'GET');

  const handleThemeRequest = async (data = {}) => {
    let prefs = readThemePrefs();
    if (data.lang !== undefined) {
      prefs = writeThemePrefs({
        lang: String(data.lang),
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
    conversations: listAvailableConversations({ limit: 500 }),
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
