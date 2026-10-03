# Claude Code Agent Evals

**社区插件 · 仅公开 hooks · 本地存储 · 默认仅元数据**

[English](README.md) · [报告示例](examples/report.html) · [技术报告](docs/technical-report.md) · [规则定义](docs/detectors.md)

## Why

Coding agent 实际调用了哪些工具、哪里失败、是否观察到验证？本插件将
Claude Code 的公开 hook 输入转为可复核证据，再生成确定性 findings。
不采集隐藏思维链，不凭会话结束判断用户目标已经实现。

## Features

- 有界本地 JSONL 记录；稳定序号与官方工具 ID 关联。
- 默认仅元数据；内容采集须显式启用，并先脱敏；身份与输入使用带密钥的哈希。
- 工具结果、可观察耗时、验证、子代理与压缩边界指标。
- 十类保守规则，定义、阈值、误报风险与反例均有文档。
- 静态 HTML/Markdown；中性 JSON/JSONL 与 eval case 导出。
- 用户主动调用时，分析代理才读取已脱敏报告并提出解释。
- 无运行时 npm 依赖，安装无需构建。

## Installation

需要 PATH 中可用的 **Node.js 20+** 和 Claude Code。已测试客户端版本见技术报告。
这是独立社区插件，不是 Anthropic 官方插件或产品。

在 Claude Code 中执行：

```text
/plugin marketplace add beibeihk/claude-code-agent-evals
/plugin install agent-evals@beibeihk-agent-evals
```

或在终端执行：

```bash
claude plugin marketplace add beibeihk/claude-code-agent-evals
claude plugin install agent-evals@beibeihk-agent-evals --scope local
```

本地克隆可用 `claude --plugin-dir ./claude-code-agent-evals` 加载。
卸载：`claude plugin uninstall agent-evals@beibeihk-agent-evals --scope local --keep-data`。
只有确实希望应用客户端的数据删除语义时，才去掉 `--keep-data`；修改 hooks 后重启或重新加载插件。

## Quick Start

在隔离仓库完成 coding task 后，执行：

```text
/agent-evals:status
/agent-evals:report
/agent-evals:make-case
```

打开返回的本地 `report.html`。数据保存在仓库之外的官方插件持久化目录。
不需要 MCP 服务或守护进程，不上传数据。

也可直接使用 CLI：

```bash
AGENT_EVALS_DATA_DIR="<插件数据目录>" node "<插件>/bin/agent-evals.mjs" report
AGENT_EVALS_DATA_DIR="<插件数据目录>" node "<插件>/bin/agent-evals.mjs" export --jsonl
```

PowerShell 中先设置 `$env:AGENT_EVALS_DATA_DIR`。未指定 session 时，仅选当前 workspace
最近会话；`--session <哈希ID>` 或 `--raw-session <Claude会话ID>` 可显式指定。
Skills 在可用时使用官方 `${CLAUDE_SESSION_ID}`。

## Commands

| Skill                    | 功能                                    |
| ------------------------ | --------------------------------------- |
| `/agent-evals:status`    | 观测范围、指标与 findings 数量          |
| `/agent-evals:report`    | 本地 HTML、Markdown、normalized JSON    |
| `/agent-evals:export`    | normalized JSON；CLI `--jsonl` 导出事件 |
| `/agent-evals:make-case` | 事件、findings、验证证据与未知目标结果  |

CLI 另有 `doctor`、`config-init`、`recover`、`report --git`、`make-case --git`。
不自动运行项目测试或修改源代码。`--git` 是显式只读 workspace 对 HEAD 的差异快照，
包含既有和外部修改，不能归因于 Claude；未追踪文件仅计数量，不计行数。

## Failure Detectors

| ID  | 观察模式                        | 默认                    |
| --- | ------------------------------- | ----------------------- |
| F01 | 等价参数在短窗口重复            | info；120 秒内 3 次     |
| F02 | 同一工具连续执行失败            | warning；3 次           |
| F03 | 等价失败/拒绝调用重试           | warning；6 次调用       |
| F04 | 超过可配置耗时阈值              | warning；120 秒         |
| F05 | 明确完成标记 + 最后可见测试失败 | 配置完成协议前禁用      |
| F06 | 最后一次源码修改后无可识别验证  | info                    |
| F07 | 精确反向修改且无已观察验证改善  | warning；4 次           |
| F08 | 自动模式重复拒绝同一调用        | warning；3 次           |
| F09 | Agent/Task 工具调用明确失败     | warning；主任务结果未知 |
| F10 | 压缩边界及后续失败              | info；仅时间相关        |

重复调用、压缩和缺少验证不必然意味着失败。定义、证据要求、误报风险和反例见
[detectors](docs/detectors.md)。

## Example Report

[静态报告](examples/report.html) 展示概览、findings、时间线、工具关联、验证、git 快照范围、
子代理和压缩边界。没有 JavaScript 和远程资源。数据来源在 [examples](examples/README.md)
明确标注，合成数据不会冒充真实运行。

## Privacy

**默认所有 trace 均保留在本机。** 不保存完整 prompt、源文件正文、shell 输出或 secret
值。只有本地明确设置 `captureContent: true` 才采集脱敏内容，始终不读取隐藏推理或
transcript。详见 [隐私模型](docs/privacy.md)。可选分析代理在用户要求解释时使用配置的模型服务。

## Architecture

公开 hooks → 输入白名单 → 元数据/脱敏 → 本地 journal → 关联和确定性规则 →
report/eval case → 可选解释。详见 [architecture](docs/architecture.md)、
[schema](docs/schema.md) 与四项 [ADR](docs/adr.md)。Hook 不返回权限决策、不调用模型、不上传。

## Evaluation

测试、50 场景规则符合性检查、benchmark 与真实任务 harness 都可复现。
实际测量及验证状态见 [技术报告](docs/technical-report.md)。合成规则符合性不等同自然任务准确率。
人工 precision/误报率需要人工审阅标签；未审阅字段保留 null，不声称 recall。

## Limitations

- Hooks 只提供部分证据；语义正确性和目标偏离需要独立标签。
- Stop 是轮次边界；SubagentStop 不代表子代理失败。
- 自动模式拒绝事件不涵盖全部手动拒绝或策略阻止。
- 保守验证识别会漏掉包装脚本、复杂复合命令和后台任务。
- 缺失、重复事件、陈旧锁、损坏尾部会明确提示，不能静默修复。
- 旧客户端的 receipt interval 包含权限和 hook 延迟。
- V1 无其他 agent importer、遥测服务或证据层 LLM judge。

## Development

```bash
npm ci --ignore-scripts
npm test
npm run lint
npm run typecheck
npm run validate
npm run evaluate
npm run benchmark
```

见 [CONTRIBUTING](CONTRIBUTING.md)、[SECURITY](SECURITY.md) 和
[中文学习指南](CLAUDE_CODE_AGENT_EVALS_STUDY_GUIDE.md)。提交 runtime bundle；CI 在 Linux、
Windows、macOS 检查测试、lint、类型、manifest、格式和构建一致性。MIT 授权。
