#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${AGY_PLUGINS_REPO:-OneOhCloud/antigravity-plugins}"
REPO_BRANCH="${AGY_PLUGINS_BRANCH:-main}"
TARGET_ROOT="${AGY_PLUGINS_DIR:-${HOME}/.gemini/config/plugins}"

cleanup_dir=""
cleanup() {
  if [[ -n "${cleanup_dir}" && -d "${cleanup_dir}" ]]; then
    rm -rf "${cleanup_dir}"
  fi
}
trap cleanup EXIT

resolve_source_dir() {
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

  cleanup_dir="$(mktemp -d 2>/dev/null || mktemp -d -t agy-plugins)"
  local archive_url="https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/heads/${REPO_BRANCH}"
  echo "[OneOh Cloud] Downloading ${REPO_SLUG} (${REPO_BRANCH})..." >&2
  curl -fsSL "${archive_url}" | tar -xz -C "${cleanup_dir}"
  local extracted
  extracted="$(find "${cleanup_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "${extracted}" || ! -d "${extracted}/plugins" ]]; then
    echo "[OneOh Cloud] Error: Failed to locate plugins directory in archive." >&2
    exit 1
  fi
  printf "%s\n" "${extracted}"
}

SOURCE_ROOT="$(resolve_source_dir)"
PLUGINS_SRC="${SOURCE_ROOT}/plugins"
mkdir -p "${TARGET_ROOT}"

requested_plugins=("$@")
if [[ ${#requested_plugins[@]} -eq 0 ]]; then
  while IFS= read -r dir; do
    requested_plugins+=("$(basename "${dir}")")
  done < <(find "${PLUGINS_SRC}" -mindepth 1 -maxdepth 1 -type d | sort)
fi

installed_count=0
for plugin_name in "${requested_plugins[@]}"; do
  src_dir="${PLUGINS_SRC}/${plugin_name}"
  if [[ ! -d "${src_dir}" || ! -f "${src_dir}/plugin.json" ]]; then
    echo "[OneOh Cloud] Skipping unknown plugin: ${plugin_name}" >&2
    continue
  fi

  dest_dir="${TARGET_ROOT}/${plugin_name}"
  mkdir -p "${dest_dir}"
  cp -R "${src_dir}/." "${dest_dir}/"
  rm -rf "${dest_dir}/test" "${dest_dir}/tests" "${dest_dir}/.local"

  if command -v agy >/dev/null 2>&1; then
    agy plugin validate "${dest_dir}" >/dev/null 2>&1 || true
  fi

  echo "[OneOh Cloud] Installed plugin: ${plugin_name} -> ${dest_dir}"
  installed_count=$((installed_count + 1))
done

if [[ ${installed_count} -eq 0 ]]; then
  echo "[OneOh Cloud] No plugins were installed." >&2
  exit 1
fi

echo "[OneOh Cloud] Successfully installed ${installed_count} plugin(s) into ${TARGET_ROOT}."
