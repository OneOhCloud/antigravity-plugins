#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGINS_DIR="${REPO_ROOT}/plugins"
OUT_DIR="${OUT_DIR:-${REPO_ROOT}/.local/releases}"

mkdir -p "${OUT_DIR}"

if [[ -f "${REPO_ROOT}/scripts/build_ui.mjs" ]]; then
  if [[ ! -d "${REPO_ROOT}/node_modules/esbuild" && -f "${REPO_ROOT}/package.json" ]]; then
    (cd "${REPO_ROOT}" && npm install --prefer-offline --no-audit --no-fund)
  fi
  node "${REPO_ROOT}/scripts/build_ui.mjs"
fi

requested_plugins=("$@")
if [[ ${#requested_plugins[@]} -eq 0 ]]; then
  while IFS= read -r dir; do
    requested_plugins+=("$(basename "${dir}")")
  done < <(find "${PLUGINS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)
fi

staging_root="$(mktemp -d 2>/dev/null || mktemp -d -t agy-pkg)"
cleanup() {
  rm -rf "${staging_root}"
}
trap cleanup EXIT

packaged_count=0
for plugin_name in "${requested_plugins[@]}"; do
  src_dir="${PLUGINS_DIR}/${plugin_name}"
  manifest_path="${src_dir}/plugin.json"
  if [[ ! -d "${src_dir}" || ! -f "${manifest_path}" ]]; then
    echo "[OneOh Cloud] Skipping unknown plugin: ${plugin_name}" >&2
    continue
  fi

  version="$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(String(m.version || '0.0.0').trim());" "${manifest_path}")"
  pkg_dir="${staging_root}/${plugin_name}"
  rm -rf "${pkg_dir}"
  mkdir -p "${pkg_dir}"
  cp -R "${src_dir}/." "${pkg_dir}/"
  rm -rf "${pkg_dir}/test" "${pkg_dir}/tests" "${pkg_dir}/.local" "${pkg_dir}/sidecars/telemetry-pane/src"

  archive_name="${plugin_name}-v${version}.tar.gz"
  archive_path="${OUT_DIR}/${archive_name}"
  tar -czf "${archive_path}" -C "${staging_root}" "${plugin_name}"

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${OUT_DIR}" && sha256sum "${archive_name}" > "${archive_name}.sha256")
  else
    (cd "${OUT_DIR}" && shasum -a 256 "${archive_name}" > "${archive_name}.sha256")
  fi

  echo "[OneOh Cloud] Packaged ${plugin_name} v${version} -> ${archive_path}"
  packaged_count=$((packaged_count + 1))
done

if [[ ${packaged_count} -eq 0 ]]; then
  echo "[OneOh Cloud] Error: No plugins were packaged." >&2
  exit 1
fi
