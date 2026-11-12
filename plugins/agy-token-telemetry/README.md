# AGY Token & Model Telemetry (`agy-token-telemetry`)

**English** | [简体中文](./README.zh-CN.md)

A non-invasive, zero-dependency Sidecar Auxiliary Pane (`SIDECAR_UI_ENTRYPOINT_AUX_PANE`) plugin for Antigravity 2.0 and `agy` CLI. It decodes real-time `gen_metadata` records and Language Server telemetry to display session token consumption, readable model names vs. underlying endpoint identifiers, end-to-end `tok/s` velocity, and `contextWindow` / `AGY_CLI_AUTO_COMPACT_OVERRIDE` configuration status.

---

## Installation (1 Step)

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

---

## Core Capabilities

1. **Session Token Telemetry & Cache Hit Analysis**:
   - Tracks `inputTokens`, `cacheReadTokens`, `outputTokens`, `thinkingOutputTokens`, and `responseOutputTokens` across all steps in any App or CLI conversation.
   - Visualizes input cache hit ratio (`cacheReadTokens / (inputTokens + cacheReadTokens)`) and thinking vs. response output token proportions.
2. **Readable Model Name & Underlying Endpoint Mapping**:
   - Extracts `modelDisplayName` (e.g. `Gemini 4 Carbon (High)`), `responseModel` endpoint ID (e.g. `gemini-4-carbon`), `model` enum (`MODEL_PLACEHOLDER_*`, including Antigravity `2.31+` `M1000+` integer enums), `plannerConfig.maxOutputTokens`, and `apiProvider` across both the active session and a global local registry of up to 60 conversations.
3. **End-to-End (`E2E`) `tok/s` Velocity & Sub-Session Scope Control**:
   - Defaults to **Main Session Only (`root`)** scope so sub-agent activity does not mask main-thread metrics, while supporting one-click switching to **All (Main + Sub)** (`tree`) or individual sub-agent scopes.
4. **API-Calibrated Context Window Wafer Matrix & Immediate Manual `/compact` Refresh**:
   - Displays real-time context window utilization (`contextTokensUsed / maxContextTokens`) calibrated to actual API prompt tokens (`inputTokens + cacheReadTokens`) so ephemeral reasoning tokens never falsely inflate window usage, while retaining client `estimatedTokensUsed` heuristic comparison in tooltips and immediate post-compaction recalculation from `CORTEX_STEP_TYPE_CHECKPOINT` (`step_type = 23`) steps without waiting for the next prompt.
5. **React 18 + Tailwind CSS v4 Production Architecture, Secondary History Menu & Bilingual UI (`en` / `zh-CN`)**:
   - **Session Panel (Default)**: Scoped to the active workspace with a streamlined single-row primary toolbar (`Session | Global` + `Overview | Details` + `⋯`); clicking `History Sessions` inside the `⋯` secondary menu switches in-place within a constant-height popover to list all workspace conversations (including the current session).
   - **Global Panel**: Features **Global Sessions**, **Model Registry**, and **Config & Steps**, along with `EN` / `中文` toggle and refresh interval controls (`1s`, `5s` default, `10s`, `30s`, `Manual`, plus automatic focus/visibility refresh).
   - **Tri-State Vector SVG Status Indicators**: Custom React dropdown lists display a green dot (`#34C759`) for active conversations, a gray dot (`#86868B`) for inactive conversations, and a green checkmark (`#34C759`) for completed sub-agent conversations.
   - Supports `1s`, `5s`, `10s`, `30s`, and `Manual` refresh intervals.

---

## License

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
