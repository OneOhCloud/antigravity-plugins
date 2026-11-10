# OneOh Cloud Antigravity 插件集

[English](./README.md) | **简体中文**

由 **OneOh Cloud** 维护的 Google Antigravity（`Antigravity 2.0` 客户端与 `agy` CLI）官方多插件开源单仓（Monorepo）。本仓库中的所有插件均采用零外部运行时依赖、非侵入式只读数据采集、纯矢量 SVG 图标体系设计，并原生支持 **英文 (`en`)** 与 **简体中文 (`zh-CN`)** 自动识别与一键手动切换。

---

## 极速安装（仅需 1 步）

在终端执行以下单行命令，即可将插件自动安装至 `~/.gemini/config/plugins`：

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash
```

如需按名称仅安装指定插件（例如 `agy-token-telemetry`）：

```bash
curl -fsSL https://raw.githubusercontent.com/OneOhCloud/antigravity-plugins/main/scripts/install.sh | bash -s -- agy-token-telemetry
```

### 备选方式：克隆仓库安装（2 步）

```bash
git clone https://github.com/OneOhCloud/antigravity-plugins.git
./antigravity-plugins/scripts/install.sh
```

---

## 插件目录

| 插件名称 | 类型 | 版本 | 支持语言 | 功能简介 |
| :--- | :--- | :--- | :--- | :--- |
| [`agy-token-telemetry`](./plugins/agy-token-telemetry/README.zh-CN.md) | Sidecar 侧边栏面板 / 遥测 | `1.2.1` | `en`, `zh-CN` | 实时统计会话 Token 消耗、`gen_metadata` 模型可读名称与底层端点标识映射、单步有效请求端到端 `tok/s` 速率，并展示 `AGY_CLI_AUTO_COMPACT_OVERRIDE` 与 `contextWindow` 状态。 |

---

## 多插件仓库目录结构

本仓库采用标准 `plugins/<plugin-name>` 多插件隔离架构，便于未来持续扩展更多独立插件：

```text
antigravity-plugins/
├── .agents/
│   └── plugins.json                         # 工作区插件自动发现清单
├── plugins/
│   └── agy-token-telemetry/                 # Token 与模型端到端遥测侧边栏插件
│       ├── plugin.json                      # 插件清单
│       ├── README.md                        # 插件英文文档（默认）
│       ├── README.zh-CN.md                  # 插件简体中文文档
│       ├── assets/
│       │   └── logo.svg                     # 纯矢量 SVG 图标
│       └── sidecars/
│           └── telemetry-pane/
│               ├── sidecar.json             # Sidecar 进程与侧边栏视图配置
│               ├── main.mjs                 # Sidecar 服务与静态资源入口
│               ├── collector.mjs            # 遥测聚合与全量模型字典门面
│               ├── throughput_aggregator.mjs # 多代理总吞吐与容量累加器
│               ├── session_tree.mjs         # 双端会话发现与多级子代理深度优先树构建
│               ├── sqlite_rpc.mjs           # 只读 SQLite URI 与 Language Server RPC 客户端
│               ├── runtime_env.mjs          # 宿主语言识别与运行环境配置采集
│               ├── proto_decoder.mjs        # 零依赖 Protobuf wire-format 解码器
│               ├── dist/                    # React 18 + Tailwind CSS v4 生产级编译产物
│               │   ├── index.html           # 生产级 HTML 入口
│               │   └── assets/              # 压缩后的 app.css 与 app.js
│               └── src/                     # 模块化 React 18 + Tailwind CSS v4 组件源码 (.jsx)
├── scripts/
│   ├── build_ui.mjs                         # React 18 + Tailwind CSS v4 生产编译脚本
│   └── install.sh                           # 一键安装脚本
├── LICENSE                                  # MIT 开源许可协议
├── README.md                                # 仓库英文主文档（默认）
└── README.zh-CN.md                          # 仓库简体中文主文档
```

---

## 多语言支持（中英双语）

本仓库内所有 UI 插件均原生支持 **英文 (`en`)** 与 **简体中文 (`zh-CN`)**：

1. **自动识别**：自动读取 Antigravity / VSCode 语言配置（`ANTIGRAVITY_LOCALE`、`VSCODE_NLS_CONFIG`）、操作系统语言环境（`LANG`、`LC_ALL`）或浏览器 `navigator.language` 自动匹配界面语言。
2. **手动切换**：随时点击面板顶部工具栏右侧的 `EN` / `中文` 按钮，即可原位即时切换语言并持久化保存偏好。

---

## 新增插件开发规范

1. 在 `plugins/<plugin-name>/` 下创建插件目录，包含符合规范的 `plugin.json`、`README.md` 与 `README.zh-CN.md`。
2. 使用 Antigravity CLI 执行严格清单校验：
   ```bash
   agy plugin validate plugins/<plugin-name> --strict
   ```
3. 运行 `./scripts/install.sh <plugin-name>` 部署至本地环境并完成端到端验证。

---

## 开源许可协议

本项目基于 [MIT License](./LICENSE) 开源发布。Copyright (c) 2026 OneOh Cloud。
