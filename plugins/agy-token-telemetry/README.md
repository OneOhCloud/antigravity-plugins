# AGY Token & Model Telemetry (`agy-token-telemetry`)

**English** | [简体中文](./README.zh-CN.md)

A non-invasive, zero-dependency Sidecar Auxiliary Pane (`SIDECAR_UI_ENTRYPOINT_AUX_PANE`) plugin for Antigravity 2.0 and `agy` CLI. Styled in an Apple HIG single-color pure-white (`#FFFFFF`) cardless layout, it decodes real-time `gen_metadata` records, SQLite step timestamps, Language Server telemetry, and host OS counters to present session token usage, 3-month global historical KPIs, host system metrics, model-to-endpoint mapping, live `tok/s` velocity, and `contextWindow` utilization.

---

## Installation (1 Step)

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

---

## Core Capabilities

1. **Global 3-Month Historical Token Usage KPIs & Sequence Bar Explorer**:
   - Maintains an incremental mtime-keyed daily ledger across all App and CLI conversations (`92` rolling days + 3 calendar months, surviving old `.db` cleanup).
   - Displays **MTD** (primary left hero) alongside **WTD** and **Today** (right secondary columns) with fair period-over-period trend comparisons, plus an interactive **Day / Week / Month** sequence bar chart with window paging to inspect `Total / Input / Output / Calls` for any specific day, week, or month.
2. **Real-Time Live Filtering in `Live (All)` (`tree`) Scope**:
   - Defaults to **Main Session (`root`)** scope; when switched to **Live (`tree`)** scope, strictly excludes `completed` and `inactive` sub-agents and filters out steps older than **1 minute (`60s`)** so velocity and context window metrics reflect true live activity.
3. **Host System Metrics Cluster in Session Overview**:
   - Samples real-time **CPU** utilization (`os.cpus()` tick delta), **Load Average** (`1m` / `5m`), **Physical Memory** (macOS Activity Monitor `vm_stat` formula / Linux `MemAvailable`), and **Disk** free capacity (`fs.statfsSync`) in a compact `2x2` top-right cluster with 1:1 progress bars.
4. **API-Calibrated Context Window Wafer Matrix & Immediate Manual `/compact` Refresh**:
   - Calibrates context window occupancy (`contextTokensUsed / maxContextTokens`) to actual API prompt tokens (`inputTokens + cacheReadTokens`) and immediately recalculates usage from `CORTEX_STEP_TYPE_CHECKPOINT` (`step_type = 23`) steps upon manual `/compact`.
5. **Readable Model Name & Endpoint Registry + Apple HIG Single-Color Bilingual UI (`en` / `zh-CN`)**:
   - Extracts `modelDisplayName`, `responseModel`, `MODEL_PLACEHOLDER_*` (`M1000+` compatible), `plannerConfig.maxOutputTokens`, and `apiProvider` across up to 500 local conversations.
   - Pure React 18 + Tailwind CSS v4 production bundle (`dist/`) on a unified `#FFFFFF` canvas with 4pt/8pt spacing rhythm, tri-state vector SVG status indicators, and `1s`, `5s` (default), `10s`, `30s`, or `Manual` refresh intervals.

---

## License

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
