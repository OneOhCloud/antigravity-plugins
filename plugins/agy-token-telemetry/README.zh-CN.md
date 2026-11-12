# AGY Token 与模型遥测面板 (`agy-token-telemetry`)

[English](./README.md) | **简体中文**

专为 Antigravity 2.0 与 `agy` CLI 打造的零外部依赖、非侵入式只读 Sidecar 侧边栏遥测插件（`SIDECAR_UI_ENTRYPOINT_AUX_PANE`）。采用 Apple HIG 纯白一体（`#FFFFFF`）无框视觉体系，实时解析 `gen_metadata` 原生 Protobuf 记录、SQLite 步骤时间戳、Language Server 遥测接口与宿主机系统指标，一站式呈现当前会话 Token 消耗、全局近三个月历史用量趋势、本机系统微尺、模型与底层端点映射、活跃实时 `tok/s` 速率及上下文窗口晶圆矩阵。

---

## 极速安装（仅需 1 步）

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

---

## 核心特性

1. **全局近三个月历史 Token 用量 KPI 与序列柱图钻取**：
   - 自动扫描 App 与 CLI 全量本地会话数据库并维护按文件签名增量更新的日桶持久化账本（支持最长滚动 `92` 天与近 3 个自然月，旧 `.db` 清理后仍完整保留历史记录）。
   - 在 `全局 -> 会话` 顶部以 **左主右副** 结构默认展示 **本月 / 本周 / 今日** 用量与同口径环比趋势，下方内嵌可翻页的 **日 / 周 / 月** 序列柱图，支持点选查看任意具体某日、某周、某月的 `总计 / 输入 / 输出 / 调用` 明细。
2. **`对话 -> 全部` 活跃实时过滤（排除不活跃/已完成代理与 1 分钟前数据）**：
   - 默认展示 **主会话（`root`）** 指标；切换至 **全部实时（`tree`）** 范围时，严格排除 `已完成` 与 `不活跃` 子代理并过滤超过 **1 分钟（`60s`）** 的历史步骤，杜绝历史已完成子代理叠加导致的速率虚高与窗口容量失真。
3. **对话概览右上侧本机系统指标簇**：
   - 在 `对话 -> 概览` 首行右侧嵌入 `2x2` 本机系统微尺簇，实时采样 **处理器** 占用率、**负载**（`1m` / `5m`）、**内存**（macOS 活动监视器 `vm_stat` 同口径物理内存 / Linux `MemAvailable`）与 **磁盘** 剩余空间，每项指标配备 `1:1` 唯一语义细进度条。
4. **API 真实水位校准的整行上下文窗口晶圆矩阵与手动 `/compact` 即时刷新**：
   - 以 API 真实发送上下文水位（`inputTokens + cacheReadTokens`）校准晶圆格子矩阵占用并识别 `CORTEX_STEP_TYPE_CHECKPOINT`（`step_type = 23`）压缩检查点，手动 `/compact` 后无需等待下一轮提问即可立即刷新窗口水位。
5. **模型字典映射与 Apple HIG 纯白一体中英双语界面（`en` / `zh-CN`）**：
   - 跨最多 500 个本地会话提取 `modelDisplayName`、`responseModel`、`MODEL_PLACEHOLDER_*`（兼容 `2.31+` `M1000+` 整数枚举）、`plannerConfig.maxOutputTokens` 与 `apiProvider`。
   - 基于 React 18 + Tailwind CSS v4 生产级编译产物（`dist/`）托管，全局融合单一纯白底色与 `4pt / 8pt` 倍律间距，支持 `1s`、`5s`（默认）、`10s`、`30s` 与 `手动` 刷新周期。

---

## 开源许可协议

[MIT License](../../LICENSE) · Copyright (c) 2026 OneOh Cloud
