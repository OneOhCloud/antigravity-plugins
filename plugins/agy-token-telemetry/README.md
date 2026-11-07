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
   - Extracts `modelDisplayName` (e.g. `Gemini 4 Argon (High)`), `responseModel` endpoint ID (e.g. `gemini-4-argon`), `model` enum (`MODEL_PLACEHOLDER_*`), and `apiProvider` across both the active session and a global local registry of up to 60 conversations.
3. **End-to-End (`E2E`) `tok/s` Velocity**:
   - Computes `outputTokens / (timeToFirstToken + streamingDuration)` for valid generation steps (`outputTokens > 0` and `streamingDuration >= 50ms`, automatically filtering single-packet flush artifacts) across the latest request, last-5-request weighted window, and full-session average.
4. **Context Window & Auto-Compact Inspection**:
   - Displays real-time context window utilization (`estimatedTokensUsed / maxContextTokens`), remaining token capacity, `~/.gemini/antigravity-cli/settings.json` `contextWindow` overrides, and `AGY_CLI_AUTO_COMPACT_OVERRIDE` environment / shell profile settings.
5. **React 18 Dual-Panel Architecture, Tri-State SVG Status & Bilingual UI (`en` / `zh-CN`)**:
   - **Session Panel (Default)**: Features **Overview** (2x2 Bento KPI grid with End-to-End Velocity, Cumulative Tokens, Latest E2E Velocity, and Context Window, plus Recent E2E Velocity Trend and Session Model Cards) and **Details** (Token Composition and Valid Step Requests).
   - **Global Panel**: Features **Model Registry** and **Config & Steps**, along with the global `EN` / `中文` language toggle.
   - **Tri-State Vector SVG Status Indicators**: Custom React dropdown lists display a green dot (`#34C759`) for active conversations, a gray dot (`#86868B`) for inactive conversations, and a green checkmark (`#34C759`) for completed sub-agent conversations.
   - Supports `1s`, `5s`, `10s`, `30s`, and `Manual` refresh intervals.

---

## License

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
