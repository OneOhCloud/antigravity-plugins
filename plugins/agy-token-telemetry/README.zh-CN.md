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
   - 自动提取当前会话及本机历史会话的 `modelDisplayName`（可读名称）、`responseModel`（底层端点 ID）、`model` 枚举值（含 Antigravity `2.31+` `M1000+` 整数枚举自动解析）、`plannerConfig.maxOutputTokens` 与 `apiProvider` 提供商，构建本机全量模型字典。
3. **端到端（E2E）有效速率与子对话范围控制（`tok/s`）**：
   - 默认展示 **仅主会话（`root`）** 指标，避免子代理大吞吐掩盖主会话上下文水位；支持随时切换为 **全部（主会话 + 子代理）** 全树累加或单独查看指定子代理。
4. **API 真实水位校准的整行上下文窗口晶圆矩阵与手动 `/compact` 即时刷新**：
   - 以 API 真实发送上下文水位（`inputTokens + cacheReadTokens`）校准晶圆格子矩阵占用（`contextTokensUsed / maxContextTokens`）与剩余可用容量，消除未持久化的单轮思考推理 Token 带来的虚高误差，同时在悬浮提示中保留客户端 `estimatedTokensUsed` 估算值对照；精准识别 SQLite `steps` 表中的 `CORTEX_STEP_TYPE_CHECKPOINT`（`step_type = 23`）压缩检查点并过滤取消态空记录，压缩完成后无需等待下一轮提问即可立即刷新窗口水位。
5. **React 18 + Tailwind CSS v4 生产级架构、二级菜单历史对话与中英双语（`en` / `zh-CN`）**：
   - **对话面板（默认进入）**：顶栏主行精简合并为「`对话 | 全局` + `概览 | 明细` + `⋯`」；会话切换入口收纳至右上角 `⋯` 二级菜单顶部「历史对话」卡片，点击后在恒定高度弹层内原位切换并直接展示包含当前对话在内的完整工作区对话列表。
   - **全局面板**：下设 **会话记录**、**模型字典** 与 **配置与步骤**，并在 `⋯` 菜单集成多语言切换（`EN` / `中文`）与刷新周期设置（默认 `5s` + 窗口聚焦即时刷新）。
   - **三态纯矢量状态指示器**：主会话与子对话列表在标题前通过纯内联 SVG 展示对话状态（正常活跃 = `#34C759` 绿色圆点、不活跃 = `#86868B` 灰色圆点、已完成 = `#34C759` 绿色对勾）。
   - 支持 `1s`、`5s`、`10s`、`30s` 与 `手动` 刷新速率。

---

## 开源许可协议

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
