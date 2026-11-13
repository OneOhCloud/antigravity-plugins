# OneOh Cloud Antigravity Plugins

**English** | [简体中文](./README.zh-CN.md)

Official multi-plugin monorepo for Google Antigravity (`Antigravity 2.0` IDE and `agy` CLI), maintained by **OneOh Cloud**. Every plugin in this repository is built with zero external runtime dependencies, non-invasive read-only data collection, pure vector SVG iconography, and built-in bilingual (`English` / `简体中文`) localization.

---

## Quick Installation (1 Step)

Run the following single-line command in your terminal to install all plugins into `~/.gemini/config/plugins`:

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash
```

To install a specific plugin by name (for example `agy-token-telemetry`):

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

### Alternative: Clone & Install (2 Steps)

```bash
git clone https://github.com/OneOhCloud/antigravity-plugins.git
./antigravity-plugins/scripts/install.sh
```

---

## Plugin Catalog

| Plugin Name | Category | Version | Languages | Description |
| :--- | :--- | :--- | :--- | :--- |
| [`agy-token-telemetry`](./plugins/agy-token-telemetry/README.md) | Sidecar Aux Pane / Telemetry | `1.3.1` | `en`, `zh-CN` | Real-time session token usage, 3-month historical token KPIs, host system metrics (`CPU / Load / Memory / Disk`), `gen_metadata` model & endpoint mapping, live 1m `tok/s` velocity, and `contextWindow` wafer matrix. |

---

## Repository Architecture

This repository is structured as a multi-plugin monorepo so additional Antigravity plugins can be added under `plugins/<plugin-name>` without coupling:

```text
antigravity-plugins/
├── .agents/
│   └── plugins.json                         # Workspace plugin discovery manifest
├── plugins/
│   └── agy-token-telemetry/                 # Token & Model Telemetry sidecar plugin
│       ├── plugin.json                      # Plugin manifest
│       ├── README.md                        # Plugin documentation (English)
│       ├── README.zh-CN.md                  # Plugin documentation (Simplified Chinese)
│       ├── assets/
│       │   └── logo.svg                     # Pure vector SVG logo
│       └── sidecars/
│           └── telemetry-pane/
│               ├── sidecar.json             # Sidecar process & auxiliary pane config
│               ├── main.mjs                 # Sidecar HTTP/API entrypoint
│               ├── collector.mjs            # Telemetry aggregation & model registry facade
│               ├── history_aggregator.mjs   # Incremental 3-month (92-day) global token ledger
│               ├── host_metrics.mjs         # Non-blocking host CPU, Load, Memory & Disk sampler
│               ├── throughput_aggregator.mjs # Multi-agent total throughput & token aggregator
│               ├── session_tree.mjs         # Multi-surface discovery & DFS subagent tree builder
│               ├── sqlite_rpc.mjs           # Read-only SQLite URI & Language Server RPC client
│               ├── runtime_env.mjs          # Host locale & runtime config collector
│               ├── proto_decoder.mjs        # Zero-dependency Protobuf wire decoder
│               ├── dist/                    # Compiled production React 18 + Tailwind CSS v4 bundle
│               │   ├── index.html           # Production HTML entry
│               │   └── assets/              # Minified app.css & app.js
│               └── src/                     # Modular React 18 + Tailwind CSS v4 source (.jsx)
├── scripts/
│   ├── build_ui.mjs                         # Production React 18 + Tailwind CSS v4 compiler
│   └── install.sh                           # One-step installer script
├── LICENSE                                  # MIT License
├── README.md                                # Repository documentation (English)
└── README.zh-CN.md                          # Repository documentation (Simplified Chinese)
```

---

## Internationalization (i18n)

All UI plugins in this repository support **English (`en`)** and **Simplified Chinese (`zh-CN`)**:

1. **Automatic Detection**: Automatically detects the language from Antigravity / VSCode NLS configuration (`ANTIGRAVITY_LOCALE`, `VSCODE_NLS_CONFIG`), OS locale (`LANG`, `LC_ALL`), or browser `navigator.language`.
2. **Manual Switch**: Click the `EN` / `中文` toggle button in the top toolbar at any time to switch languages in-place and persist your preference across sessions.

---

## Contributing a New Plugin

1. Create a new directory under `plugins/<your-plugin-name>/` with a valid `plugin.json` manifest, `README.md`, and `README.zh-CN.md`.
2. Validate the plugin manifest strictly using the Antigravity CLI:
   ```bash
   agy plugin validate plugins/<your-plugin-name> --strict
   ```
3. Run `./scripts/install.sh <your-plugin-name>` to deploy and verify in a live Antigravity session.

---

## License

Released under the [MIT License](./LICENSE). Copyright (c) 2026 OneOh Cloud.
