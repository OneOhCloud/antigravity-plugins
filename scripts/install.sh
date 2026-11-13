#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${AGY_PLUGINS_REPO:-OneOhCloud/antigravity-plugins}"
REPO_BRANCH="${AGY_PLUGINS_BRANCH:-main}"
RELEASE_TAG="${AGY_PLUGINS_TAG:-latest}"
TARGET_ROOT="${AGY_PLUGINS_DIR:-${HOME}/.gemini/config/plugins}"
INSTALL_SOURCE="${AGY_INSTALL_SOURCE:-0}"

requested_plugins=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-source)
      INSTALL_SOURCE=1
      shift
      ;;
    --tag)
      RELEASE_TAG="${2:-latest}"
      shift 2
      ;;
    *)
      requested_plugins+=("$1")
      shift
      ;;
  esac
done

cleanup_dir=""
cleanup() {
  if [[ -n "${cleanup_dir}" && -d "${cleanup_dir}" ]]; then
    rm -rf "${cleanup_dir}"
  fi
}
trap cleanup EXIT

detect_local_repo() {
  local script_path="${BASH_SOURCE[0]:-}"
  if [[ -n "${script_path}" && -f "${script_path}" ]]; then
    local script_dir
    script_dir="$(cd "$(dirname "${script_path}")" && pwd)"
    local candidate_root
    candidate_root="$(cd "${script_dir}/.." && pwd)"
    if [[ -d "${candidate_root}/plugins" ]]; then
      printf "%s\n" "${candidate_root}"
      return 0
    fi
  fi
  return 1
}

download_source_root() {
  cleanup_dir="$(mktemp -d 2>/dev/null || mktemp -d -t agy-plugins)"
  local archive_url="https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${REPO_BRANCH}"
  echo "[OneOh Cloud] Downloading source archive ${REPO_SLUG} (${REPO_BRANCH})..." >&2
  curl -fsSL "${archive_url}" | tar -xz -C "${cleanup_dir}"
  local extracted
  extracted="$(find "${cleanup_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "${extracted}" || ! -d "${extracted}/plugins" ]]; then
    echo "[OneOh Cloud] Error: Failed to locate plugins directory in archive." >&2
    exit 1
  fi
  printf "%s\n" "${extracted}"
}

install_from_directory() {
  local source_root="$1"
  local plugins_src="${source_root}/plugins"

  if [[ -f "${source_root}/scripts/build_ui.mjs" ]]; then
    if [[ ! -d "${source_root}/node_modules/esbuild" && -f "${source_root}/package.json" && -z "${cleanup_dir}" ]]; then
      (cd "${source_root}" && npm install --prefer-offline --no-audit --no-fund)
    fi
    if [[ -d "${source_root}/node_modules/esbuild" ]]; then
      node "${source_root}/scripts/build_ui.mjs"
    fi
  fi

  local targets=()
  if [[ ${#requested_plugins[@]} -gt 0 ]]; then
    targets=("${requested_plugins[@]}")
  fi
  if [[ ${#targets[@]} -eq 0 ]]; then
    while IFS= read -r dir; do
      targets+=("$(basename "${dir}")")
    done < <(find "${plugins_src}" -mindepth 1 -maxdepth 1 -type d | sort)
  fi

  INSTALLED_COUNT=0
  for plugin_name in "${targets[@]}"; do
    local src_dir="${plugins_src}/${plugin_name}"
    if [[ ! -d "${src_dir}" || ! -f "${src_dir}/plugin.json" ]]; then
      echo "[OneOh Cloud] Skipping unknown plugin: ${plugin_name}" >&2
      continue
    fi

    local dest_dir="${TARGET_ROOT}/${plugin_name}"
    rm -rf "${dest_dir}"
    mkdir -p "${dest_dir}"
    cp -R "${src_dir}/." "${dest_dir}/"
    rm -rf "${dest_dir}/test" "${dest_dir}/tests" "${dest_dir}/.local" "${dest_dir}/sidecars/telemetry-pane/src"

    if command -v agy >/dev/null 2>&1; then
      agy plugin validate "${dest_dir}" >/dev/null 2>&1 || true
    fi

    echo "[OneOh Cloud] Installed plugin: ${plugin_name} -> ${dest_dir}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
  done
}

install_from_release_assets() {
  local api_url
  if [[ "${RELEASE_TAG}" == "latest" ]]; then
    api_url="https://api.github.com/repos/${REPO_SLUG}/releases/latest"
  else
    api_url="https://api.github.com/repos/${REPO_SLUG}/releases/tags/${RELEASE_TAG}"
  fi

  local release_json
  if ! release_json="$(curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: agy-plugins-installer" "${api_url}" 2>/dev/null)"; then
    return 1
  fi

  local matched_assets
  matched_assets="$(printf "%s" "${release_json}" | node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(0, 'utf8'));
    const requested = process.argv.slice(1);
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const tgz = assets.filter((a) => typeof a.name === 'string' && a.name.endsWith('.tar.gz'));
    for (const asset of tgz) {
      const m = asset.name.match(/^(.+?)-v?\\d+\\.\\d+\\.\\d+.*\\.tar\\.gz$/);
      const pluginName = m ? m[1] : asset.name.replace(/\\.tar\\.gz$/, '');
      if (requested.length === 0 || requested.includes(pluginName)) {
        console.log(pluginName + '\t' + asset.name + '\t' + asset.browser_download_url);
      }
    }
  " ${requested_plugins[@]+"${requested_plugins[@]}"})"

  if [[ -z "${matched_assets}" ]]; then
    return 1
  fi

  cleanup_dir="$(mktemp -d 2>/dev/null || mktemp -d -t agy-release)"
  local installed_count=0
  while IFS=$'\t' read -r plugin_name asset_name download_url; do
    [[ -z "${plugin_name}" || -z "${download_url}" ]] && continue
    echo "[OneOh Cloud] Downloading release package ${asset_name}..." >&2
    local archive_path="${cleanup_dir}/${asset_name}"
    curl -fsSL "${download_url}" -o "${archive_path}"

    local extract_dir="${cleanup_dir}/extract_${plugin_name}"
    mkdir -p "${extract_dir}"
    tar -xzf "${archive_path}" -C "${extract_dir}"

    local pkg_dir="${extract_dir}/${plugin_name}"
    if [[ ! -f "${pkg_dir}/plugin.json" ]]; then
      echo "[OneOh Cloud] Error: Invalid package layout in ${asset_name}." >&2
      continue
    fi

    local dest_dir="${TARGET_ROOT}/${plugin_name}"
    rm -rf "${dest_dir}"
    mkdir -p "${dest_dir}"
    cp -R "${pkg_dir}/." "${dest_dir}/"

    if command -v agy >/dev/null 2>&1; then
      agy plugin validate "${dest_dir}" >/dev/null 2>&1 || true
    fi

    echo "[OneOh Cloud] Installed release package: ${plugin_name} (${asset_name}) -> ${dest_dir}"
    installed_count=$((installed_count + 1))
  done <<< "${matched_assets}"

  if [[ ${installed_count} -eq 0 ]]; then
    return 1
  fi

  echo "[OneOh Cloud] Successfully installed ${installed_count} plugin(s) from release packages into ${TARGET_ROOT}."
  return 0
}

mkdir -p "${TARGET_ROOT}"

if local_root="$(detect_local_repo)"; then
  install_from_directory "${local_root}"
  if [[ ${INSTALLED_COUNT} -eq 0 ]]; then
    echo "[OneOh Cloud] No plugins were installed." >&2
    exit 1
  fi
  echo "[OneOh Cloud] Successfully installed ${INSTALLED_COUNT} plugin(s) into ${TARGET_ROOT}."
  exit 0
fi

if [[ "${INSTALL_SOURCE}" != "1" ]]; then
  if install_from_release_assets; then
    exit 0
  fi
  echo "[OneOh Cloud] Release package not found for ${RELEASE_TAG}; falling back to source archive..." >&2
fi

SOURCE_ROOT="$(download_source_root)"
install_from_directory "${SOURCE_ROOT}"
if [[ ${INSTALLED_COUNT} -eq 0 ]]; then
  echo "[OneOh Cloud] No plugins were installed." >&2
  exit 1
fi
echo "[OneOh Cloud] Successfully installed ${INSTALLED_COUNT} plugin(s) into ${TARGET_ROOT}."
