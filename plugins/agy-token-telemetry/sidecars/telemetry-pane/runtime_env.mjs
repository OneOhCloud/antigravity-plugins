/**
 * @fileoverview Host locale detection, shell startup file scanner (`AGY_CLI_*`),
 * and runtime configuration collector (`settings.json`, `config.json`, model catalog).
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  callLanguageServerRpc,
  getGeminiRootDir,
  readJsonFileSafe,
} from './sqlite_rpc.mjs';

/**
 * Scans shell profile files (read-only) to see if `AGY_CLI_AUTO_COMPACT_OVERRIDE`
 * or other `AGY_CLI_*` variables are configured in user startup scripts.
 */
function scanShellStartupFilesForAgyEnv(homeDirPath) {
  const candidateFiles = [
    '.zshenv',
    '.zprofile',
    '.zshrc',
    '.bashrc',
    '.bash_profile',
  ];
  const shellDefinitions = {};

  for (const fileName of candidateFiles) {
    const fullPath = join(homeDirPath, fileName);
    if (!existsSync(fullPath)) continue;
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(
          /^(?:export\s+)?(AGY_CLI_[A-Z0-9_]+)\s*=\s*(.+)$/
        );
        if (match) {
          const varName = match[1];
          const rawVal = match[2].trim().replace(/^['"]|['"]$/g, '');
          shellDefinitions[varName] = {
            value: rawVal,
            sourceFile: `~/${fileName}`,
          };
        }
      }
    } catch {
      // Ignore unreadable shell startup files
    }
  }

  return shellDefinitions;
}

/**
 * Detects the preferred UI language (`en` or `zh-CN`) from Antigravity / VSCode
 * NLS configuration or host OS environment variables.
 */
export function detectHostLocale(env = process.env) {
  const candidates = [];

  if (env.ANTIGRAVITY_LOCALE) candidates.push(String(env.ANTIGRAVITY_LOCALE));
  if (env.AGY_LOCALE) candidates.push(String(env.AGY_LOCALE));

  if (env.VSCODE_NLS_CONFIG) {
    try {
      const nls = JSON.parse(env.VSCODE_NLS_CONFIG);
      if (nls.locale) candidates.push(String(nls.locale));
      if (nls.userLocale) candidates.push(String(nls.userLocale));
      if (nls.osLocale) candidates.push(String(nls.osLocale));
    } catch {
      // Ignore malformed VSCODE_NLS_CONFIG
    }
  }

  if (env.LC_ALL) candidates.push(String(env.LC_ALL));
  if (env.LC_MESSAGES) candidates.push(String(env.LC_MESSAGES));
  if (env.LANG) candidates.push(String(env.LANG));

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) candidates.push(String(intlLocale));
  } catch {
    // Ignore Intl errors
  }

  for (const raw of candidates) {
    const cleaned = raw.trim().toLowerCase();
    if (
      !cleaned ||
      cleaned === 'c' ||
      cleaned === 'posix' ||
      cleaned.startsWith('c.')
    ) {
      continue;
    }
    if (cleaned.startsWith('zh')) {
      return { hostLocale: 'zh-CN', hostLocaleRaw: raw.trim() };
    }
    if (cleaned.startsWith('en')) {
      return { hostLocale: 'en', hostLocaleRaw: raw.trim() };
    }
  }

  return { hostLocale: 'en', hostLocaleRaw: candidates[0] || 'en-US' };
}

/**
 * Collects runtime environment variables (`AGY_CLI_AUTO_COMPACT_OVERRIDE`),
 * `settings.json` (`contextWindow`, `model`), `config.json`, and model catalog.
 */
export async function collectRuntimeEnvironment({
  homeDirPath = homedir(),
  env = process.env,
} = {}) {
  const geminiRoot = getGeminiRootDir(homeDirPath);
  const cliSettingsPath = join(geminiRoot, 'antigravity-cli', 'settings.json');
  const globalConfigPath = join(geminiRoot, 'config', 'config.json');

  const cliSettings = readJsonFileSafe(cliSettingsPath) || {};
  const globalConfig = readJsonFileSafe(globalConfigPath) || {};
  const userSettings = globalConfig.userSettings || {};
  const localeInfo = detectHostLocale(env);

  const shellDefs = scanShellStartupFilesForAgyEnv(homeDirPath);
  const processAutoCompact = env.AGY_CLI_AUTO_COMPACT_OVERRIDE;
  const shellAutoCompact = shellDefs.AGY_CLI_AUTO_COMPACT_OVERRIDE;

  let autoCompactValue = null;
  let autoCompactSource = '未设置 (默认自动压缩策略)';
  let autoCompactSourceType = 'unset';
  let autoCompactSourceFile = '';
  if (processAutoCompact !== undefined && processAutoCompact !== '') {
    autoCompactValue = String(processAutoCompact);
    autoCompactSource = '进程环境变量 (process.env)';
    autoCompactSourceType = 'process_env';
  } else if (shellAutoCompact) {
    autoCompactValue = shellAutoCompact.value;
    autoCompactSource = `Shell 配置文件 (${shellAutoCompact.sourceFile})`;
    autoCompactSourceType = 'shell_profile';
    autoCompactSourceFile = shellAutoCompact.sourceFile;
  }

  const activeAgyCliEnvVars = {};
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith('AGY_CLI_') && val !== undefined) {
      activeAgyCliEnvVars[key] = { value: String(val), source: 'process.env' };
    }
  }
  for (const [key, info] of Object.entries(shellDefs)) {
    if (!activeAgyCliEnvVars[key]) {
      activeAgyCliEnvVars[key] = { value: info.value, source: info.sourceFile };
    }
  }

  const configuredContextWindow =
    cliSettings.contextWindow !== undefined && cliSettings.contextWindow !== null
      ? String(cliSettings.contextWindow)
      : null;

  const modelConfigData = await callLanguageServerRpc(
    'GetCascadeModelConfigData',
    {},
    env
  );
  const clientModelConfigs = Array.isArray(modelConfigData?.clientModelConfigs)
    ? modelConfigData.clientModelConfigs.map((m) => ({
        label: String(m.label || ''),
        modelId: String(m.modelId || ''),
        modelEnum: String(m.modelOrAlias?.model || ''),
        remainingFraction:
          typeof m.quotaInfo?.remainingFraction === 'number'
            ? m.quotaInfo.remainingFraction
            : null,
        resetTime: String(m.quotaInfo?.resetTime || ''),
        tagTitle: String(m.tagTitle || ''),
        contextWindowOptions: Array.isArray(m.contextWindowOptions)
          ? m.contextWindowOptions
          : [],
      }))
    : [];

  return {
    hostLocale: localeInfo.hostLocale,
    hostLocaleRaw: localeInfo.hostLocaleRaw,
    autoCompactOverride: {
      envKey: 'AGY_CLI_AUTO_COMPACT_OVERRIDE',
      isSet: autoCompactValue !== null,
      value: autoCompactValue,
      envValue: autoCompactValue,
      displayValue:
        autoCompactValue !== null ? autoCompactValue : '未设置 (默认开启)',
      source: autoCompactSource,
      sourceType: autoCompactSourceType,
      sourceFile: autoCompactSourceFile,
    },
    contextWindowConfig: {
      settingKey: 'contextWindow',
      isExplicitlySet: configuredContextWindow !== null,
      configuredValue: configuredContextWindow,
      displayValue:
        configuredContextWindow !== null
          ? configuredContextWindow
          : '未显式指定 (跟随模型默认窗口)',
      settingsFilePath: '~/.gemini/antigravity-cli/settings.json',
    },
    cliSettingsSummary: {
      model: String(cliSettings.model || '未设置'),
      agentMode: String(cliSettings.agentMode || '未设置'),
      toolPermission: String(cliSettings.toolPermission || '未设置'),
      artifactReviewMode: String(cliSettings.artifactReviewMode || '未设置'),
      colorScheme: String(cliSettings.colorScheme || '未设置'),
      allowNonWorkspaceAccess: Boolean(cliSettings.allowNonWorkspaceAccess),
    },
    appSettingsSummary: {
      permissionPreset: String(userSettings.permissionPreset || '未设置'),
      autoExecutionPolicy: String(userSettings.autoExecutionPolicy || '未设置'),
      artifactReviewMode: String(userSettings.artifactReviewMode || '未设置'),
      themeMode: String(userSettings.themeMode || '未设置'),
      enableTerminalSandbox: Boolean(userSettings.enableTerminalSandbox),
    },
    activeAgyCliEnvVars,
    clientModelConfigs,
  };
}
