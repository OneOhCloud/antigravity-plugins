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
5. **Bilingual UI (`en` / `zh-CN`) & 20x20x20 Studio Combinator**:
   - Automatically selects English (`en`) or Simplified Chinese (`zh-CN`) based on Antigravity / OS locale, with a manual `EN` / `中文` toggle button in the top toolbar.
   - Click the top-left preset badge (`L06·I20·C01`) to switch between 20 overview layouts (`L01`–`L20`), 20 pure vector SVG icons (`I01`–`I20`), and 20 color palettes (`C01`–`C20`).

---

## License

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
