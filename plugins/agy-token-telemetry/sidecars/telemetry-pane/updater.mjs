/**
 * @fileoverview Plugin version inspection, GitHub Releases update check, and
 * prebuilt release package installation with sidecar hot-restart support.
 */

import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { callLanguageServerRpc } from './sqlite_rpc.mjs';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = resolve(__dirname, '../..');
const DEFAULT_REPO_SLUG = 'OneOhCloud/antigravity-plugins';
const CHECK_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 30000;
const EXTRACT_TIMEOUT_MS = 15000;

/**
 * Reads the local plugin manifest (`plugin.json`).
 */
export function readLocalPluginManifest(pluginRootDir = DEFAULT_PLUGIN_ROOT) {
  const manifestPath = join(pluginRootDir, 'plugin.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  return {
    name: String(raw.name || 'agy-token-telemetry'),
    displayName: String(raw.displayName || raw.name || 'AGY Token & Model Telemetry'),
    version: normalizeVersionString(raw.version || '0.0.0'),
    homepage: String(raw.homepage || ''),
  };
}

/**
 * Strips leading `v` and whitespace from a SemVer tag/version string.
 */
export function normalizeVersionString(raw) {
  return String(raw || '').trim().replace(/^v/i, '');
}

/**
 * Parses a SemVer string into `[major, minor, patch, pre]`.
 */
function parseSemver(version) {
  const cleaned = normalizeVersionString(version);
  const [core, pre = ''] = cleaned.split('-', 2);
  const parts = core.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    pre,
  };
}

/**
 * Compares two SemVer strings. Returns `1` if `a > b`, `-1` if `a < b`, `0` if equal.
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] > pb[key]) return 1;
    if (pa[key] < pb[key]) return -1;
  }
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && !pb.pre) return -1;
  if (pa.pre !== pb.pre) return pa.pre > pb.pre ? 1 : -1;
  return 0;
}

/**
 * Selects the matching `.tar.gz` release asset for a given plugin name.
 */
export function selectPluginAsset(assets, pluginName) {
  if (!Array.isArray(assets) || !pluginName) return null;
  const prefix = `${pluginName}-`;
  const match = assets.find(
    (asset) =>
      asset &&
      typeof asset.name === 'string' &&
      asset.name.startsWith(prefix) &&
      asset.name.endsWith('.tar.gz') &&
      typeof asset.browser_download_url === 'string'
  );
  if (!match) return null;

  const versionMatch = match.name.match(
    new RegExp(`^${pluginName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-v?(\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?)\\.tar\\.gz$`)
  );
  return {
    name: match.name,
    version: versionMatch ? versionMatch[1] : '',
    downloadUrl: match.browser_download_url,
    size: Number(match.size || 0),
    contentType: String(match.content_type || 'application/gzip'),
  };
}

async function fetchJsonWithTimeout(url, timeoutMs = CHECK_TIMEOUT_MS) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'agy-token-telemetry-updater',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return await response.json();
}

/**
 * Queries GitHub Releases API for the latest release and matching plugin archive.
 */
export async function checkForPluginUpdate(options = {}) {
  const pluginRootDir = options.pluginRootDir || DEFAULT_PLUGIN_ROOT;
  const repoSlug = options.repoSlug || process.env.AGY_PLUGINS_REPO || DEFAULT_REPO_SLUG;
  const manifest = readLocalPluginManifest(pluginRootDir);
  const currentVersion = options.currentVersionOverride
    ? normalizeVersionString(options.currentVersionOverride)
    : manifest.version;

  const latestUrl =
    options.releaseApiUrl ||
    `https://api.github.com/repos/${repoSlug}/releases/latest`;
  let release = await fetchJsonWithTimeout(latestUrl, options.timeoutMs || CHECK_TIMEOUT_MS);
  let asset = selectPluginAsset(release?.assets, manifest.name);

  if (!asset && !options.releaseApiUrl) {
    try {
      const listUrl = `https://api.github.com/repos/${repoSlug}/releases?per_page=10`;
      const releases = await fetchJsonWithTimeout(listUrl, options.timeoutMs || CHECK_TIMEOUT_MS);
      if (Array.isArray(releases)) {
        const withAsset = releases.find((item) => selectPluginAsset(item?.assets, manifest.name));
        if (withAsset) {
          release = withAsset;
          asset = selectPluginAsset(withAsset.assets, manifest.name);
        }
      }
    } catch {
      // Keep latest release payload if list fallback fails
    }
  }

  const latestVersion = normalizeVersionString(
    (asset && asset.version) || release?.tag_name || currentVersion
  );

  return {
    pluginName: manifest.name,
    currentVersion,
    latestVersion,
    hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
    releaseTag: String(release?.tag_name || ''),
    releaseName: String(release?.name || ''),
    releaseUrl: String(release?.html_url || ''),
    publishedAt: String(release?.published_at || ''),
    asset,
    checkedAt: Date.now(),
  };
}

function validateDownloadUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const isHttps = parsed.protocol === 'https:';
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (!isHttps && !isLocalHttp) {
    throw new Error(`Unsupported download URL protocol: ${parsed.protocol}`);
  }
  return parsed.toString();
}

/**
 * Downloads a prebuilt plugin `.tar.gz` archive, validates its structure,
 * replaces the installed plugin directory, and optionally restarts the sidecar.
 */
export async function installPluginPackage(options = {}) {
  const pluginRootDir = options.pluginRootDir || DEFAULT_PLUGIN_ROOT;
  const manifest = readLocalPluginManifest(pluginRootDir);
  let downloadUrl = options.downloadUrl ? String(options.downloadUrl).trim() : '';

  if (!downloadUrl) {
    const checkResult = await checkForPluginUpdate({
      pluginRootDir,
      repoSlug: options.repoSlug,
      releaseApiUrl: options.releaseApiUrl,
    });
    if (!checkResult.asset || !checkResult.asset.downloadUrl) {
      throw new Error(`No release package asset found for ${manifest.name}`);
    }
    downloadUrl = checkResult.asset.downloadUrl;
  }

  const validatedUrl = validateDownloadUrl(downloadUrl);
  const targetPluginsRoot =
    options.targetPluginsRoot ||
    process.env.AGY_PLUGINS_DIR ||
    join(homedir(), '.gemini', 'config', 'plugins');
  const destDir = join(targetPluginsRoot, manifest.name);
  const tempDir = mkdtempSync(join(tmpdir(), 'agy-plugin-install-'));

  try {
    const archivePath = join(tempDir, `${manifest.name}.tar.gz`);
    const extractDir = join(tempDir, 'extracted');
    mkdirSync(extractDir, { recursive: true });

    const response = await fetch(validatedUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'agy-token-telemetry-updater' },
      signal: AbortSignal.timeout(options.timeoutMs || DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to download package: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(archivePath, buffer);

    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractDir], {
      timeout: EXTRACT_TIMEOUT_MS,
    });

    const stagedPluginDir = join(extractDir, manifest.name);
    const stagedManifestPath = join(stagedPluginDir, 'plugin.json');
    const stagedIndexPath = join(
      stagedPluginDir,
      'sidecars',
      'telemetry-pane',
      'dist',
      'index.html'
    );
    if (!existsSync(stagedManifestPath) || !existsSync(stagedIndexPath)) {
      throw new Error('Invalid plugin package layout: missing plugin.json or dist/index.html');
    }

    const installedManifest = readLocalPluginManifest(stagedPluginDir);
    mkdirSync(targetPluginsRoot, { recursive: true });
    rmSync(destDir, { recursive: true, force: true });
    mkdirSync(destDir, { recursive: true });
    cpSync(stagedPluginDir, destDir, { recursive: true });

    try {
      await execFileAsync('agy', ['plugin', 'validate', destDir], {
        timeout: 5000,
      });
    } catch {
      // Ignore if agy CLI is unavailable
    }

    let restartScheduled = false;
    if (
      options.restartSidecar !== false &&
      process.env.ANTIGRAVITY_LS_ADDRESS &&
      process.env.ANTIGRAVITY_CSRF_TOKEN
    ) {
      restartScheduled = true;
      setTimeout(() => {
        callLanguageServerRpc('ManageSidecar', {
          sidecarId: `${manifest.name}/telemetry-pane`,
          action: 'SIDECAR_ACTION_RESTART',
        }).catch(() => {});
      }, 250);
    }

    return {
      ok: true,
      pluginName: installedManifest.name,
      installedVersion: installedManifest.version,
      targetDir: destDir,
      archiveBytes: buffer.length,
      restartScheduled,
      installedAt: Date.now(),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
