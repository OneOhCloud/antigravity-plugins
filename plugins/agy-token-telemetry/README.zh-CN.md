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
3. **端到端（E2E）有效速率与全会话树总吞吐累加（`tok/s`）**：
   - 单 Agent 内按全部输出 Token 总量除以端到端总耗时秒数计算 `tok/s`；当子对话范围选择「全部（主会话 + 子代理）」时，将主会话与所有子代理的生成速率、有效样本数、Token 消耗总量、上下文窗口总容量及会话模型吞吐直接累加求和。
4. **整行上下文窗口晶圆格子矩阵与自动压缩配置巡检**：
   - 通过整行晶圆格子矩阵直观呈现上下文窗口占用（`estimatedTokensUsed / maxContextTokens`）与剩余可用容量，自动检测 `~/.gemini/antigravity-cli/settings.json` 中的 `contextWindow` 配置及 `AGY_CLI_AUTO_COMPACT_OVERRIDE` 状态。
5. **React 18 + Tailwind CSS v4 生产级架构、项目历史对话二级入口与中英双语（`en` / `zh-CN`）**：
   - **对话面板（默认进入）**：仅展示当前工作区会话；顶栏会话下拉框一级列表仅显示当前活跃会话，项目非活跃历史对话收纳至底部「历史对话」二级入口并在恒定高度弹层内原位切换。
   - **全局面板**：下设 **会话记录**、**模型字典** 与 **配置与步骤**，并在顶栏右侧 `⋯` 菜单集成多语言切换（`EN` / `中文`）与刷新周期设置。
   - **三态纯矢量状态指示器**：主会话与子对话列表在标题前通过纯内联 SVG 展示对话状态（正常活跃 = `#34C759` 绿色圆点、不活跃 = `#86868B` 灰色圆点、已完成 = `#34C759` 绿色对勾）。
   - 支持 `1s`、`5s`、`10s`、`30s` 与 `手动` 刷新速率。

---

## 开源许可协议

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
