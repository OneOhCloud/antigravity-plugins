# AGY Token 与模型遥测面板 (`agy-token-telemetry`)

[English](./README.md) | **简体中文**

专为 Antigravity 2.0 与 `agy` CLI 打造的零外部依赖、非侵入式只读 Sidecar 侧边栏遥测插件（`SIDECAR_UI_ENTRYPOINT_AUX_PANE`）。实时解析 `gen_metadata` 原生 Protobuf 记录与 Language Server 遥测接口，展示会话 Token 消耗结构、可读模型名称与底层端点标识映射、单步有效请求端到端 `tok/s` 速率，以及 `contextWindow` 与 `AGY_CLI_AUTO_COMPACT_OVERRIDE` 参数状态。

---

## 极速安装（仅需 1 步）

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

---

## 核心特性

1. **会话 Token 消耗与缓存命中分析**：
   - 实时聚合 App 与 CLI 会话的 `inputTokens`、`cacheReadTokens`、`outputTokens`、`thinkingOutputTokens` 与 `responseOutputTokens`。
   - 直观呈现输入缓存命中率（`cacheReadTokens / (inputTokens + cacheReadTokens)`）及输出端思考推理与正式回复的构成比例。
2. **模型可读名称与底层端点标识映射**：
   - 自动提取当前会话及本机历史会话的 `modelDisplayName`（可读名称）、`responseModel`（底层端点 ID）、`model` 枚举值与 `apiProvider` 提供商，构建本机全量模型字典。
3. **端到端（E2E）有效请求速率（`tok/s`）**：
   - 严格过滤单包瞬时 flush 伪影（仅纳入 `outputTokens > 0` 且 `streamingDuration >= 50ms` 的有效生成样本），计算最新单步、近 5 次加权窗口及全会话端到端 `tok/s` 速率与首字耗时（TTFT）。
4. **上下文窗口水位与自动压缩配置巡检**：
   - 实时监控当前会话窗口水位（`estimatedTokensUsed / maxContextTokens`）与剩余可用容量，自动检测 `~/.gemini/antigravity-cli/settings.json` 中的 `contextWindow` 配置及进程/Shell 配置文件中的 `AGY_CLI_AUTO_COMPACT_OVERRIDE` 状态。
5. **中英双语自适应与 20×20×20 外观工作台**：
   - 根据设备或 Antigravity 语言标识自动匹配 **英文 (`en`)** 或 **简体中文 (`zh-CN`)**，并支持在顶部工具栏一键手动切换 `EN` / `中文`。
   - 点击左上角外观徽章（默认 `L06·I20·C01`）可原位切换 20 种概览布局（`L01`–`L20`）、20 种纯矢量 SVG 图标（`I01`–`I20`）与 20 种配色方案（`C01`–`C20`）。

---

## 开源许可协议

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
