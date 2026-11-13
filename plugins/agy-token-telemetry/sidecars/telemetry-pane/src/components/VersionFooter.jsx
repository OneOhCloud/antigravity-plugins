/**
 * @fileoverview Centered minimal bottom version footer displaying the current
 * plugin version and an icon-only update check / package install button.
 */

import React, { useCallback, useEffect, useState } from 'react';

function withAuthToken(url) {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

async function requestJson(url, method = 'POST', body = {}) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  };
  if (method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  let response;
  if (window.sidecar && typeof window.sidecar.fetch === 'function') {
    response = await window.sidecar.fetch(url, init);
  } else {
    response = await fetch(withAuthToken(url), init);
  }

  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function RefreshIcon({ spinning = false }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`}
      aria-hidden="true"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.67" />
      <path d="M13.5 2.75v2.75h-2.75" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <path d="M8 2.75v7.5" />
      <path d="M5 7.5L8 10.5L11 7.5" />
      <path d="M3 12.75h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <path d="M3.5 8.25L6.5 11.25L12.5 5" />
    </svg>
  );
}

export function VersionFooter({
  t,
  mockCurrentVersion = '',
  autoCheck = true,
}) {
  const [currentVersion, setCurrentVersion] = useState(mockCurrentVersion || '');
  const [status, setStatus] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [installResult, setInstallResult] = useState(null);

  useEffect(() => {
    let active = true;
    requestJson('/api/version', 'GET')
      .then((data) => {
        if (!active) return;
        if (mockCurrentVersion) {
          setCurrentVersion(mockCurrentVersion);
        } else if (data?.version) {
          setCurrentVersion(String(data.version));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mockCurrentVersion]);

  const handleCheckUpdate = useCallback(async () => {
    setStatus('checking');
    try {
      const payload = mockCurrentVersion ? { mockCurrentVersion } : {};
      const data = await requestJson('/api/update/check', 'POST', payload);
      setUpdateInfo(data);
      if (data.currentVersion) {
        setCurrentVersion(data.currentVersion);
      }
      setStatus(data.hasUpdate ? 'available' : 'up_to_date');
    } catch {
      setStatus('error');
    }
  }, [mockCurrentVersion]);

  useEffect(() => {
    if (autoCheck) {
      handleCheckUpdate();
    }
  }, [autoCheck, handleCheckUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    if (!updateInfo?.asset?.downloadUrl) return;
    setStatus('installing');
    try {
      const result = await requestJson('/api/update/install', 'POST', {
        downloadUrl: updateInfo.asset.downloadUrl,
      });
      setInstallResult(result);
      if (result.installedVersion) {
        setCurrentVersion(result.installedVersion);
      }
      setUpdateInfo(null);
      setStatus('installed');
      if (result.restartScheduled) {
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      }
    } catch {
      setStatus('error');
    }
  }, [updateInfo]);

  const canInstall =
    status === 'available' && Boolean(updateInfo?.asset?.downloadUrl);

  const tooltip = canInstall
    ? t('versionInstallUpdate')(updateInfo.latestVersion)
    : status === 'checking'
      ? t('versionChecking')
      : status === 'installing'
        ? t('versionInstalling')
        : status === 'up_to_date'
          ? t('versionUpToDate')
          : status === 'installed' && installResult
            ? t('versionInstalled')
            : status === 'error'
              ? t('versionCheckFailed')
              : t('versionCheckUpdate');

  return (
    <footer
      id="versionFooter"
      className="w-full min-w-0 shrink-0 pt-1 flex items-center justify-center gap-1.5 bg-white"
    >
      <span className="font-mono text-[11px] font-medium text-black/45 tabular-nums shrink-0">
        {currentVersion ? `v${currentVersion}` : 'v--'}
      </span>
      <button
        type="button"
        onClick={canInstall ? handleInstallUpdate : handleCheckUpdate}
        disabled={status === 'checking' || status === 'installing'}
        title={tooltip}
        aria-label={tooltip}
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-45 ${
          canInstall
            ? 'bg-[#1d1d1f] text-white hover:bg-black/85'
            : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-black/10'
        }`}
      >
        {canInstall ? (
          <DownloadIcon />
        ) : status === 'up_to_date' || status === 'installed' ? (
          <CheckIcon />
        ) : (
          <RefreshIcon spinning={status === 'checking' || status === 'installing'} />
        )}
      </button>
    </footer>
  );
}
