# Public surface research — 2026-10-03

Source checkout: [`anthropics/claude-code`](https://github.com/anthropics/claude-code/tree/1c229fcd1e1e4e452e29a8f116b45fe4cfe2c528),
including root README, plugins README, marketplace, plugin-dev, code-review,
pr-review-toolkit, hookify, ralph-wiggum and security-guidance. The official repository
contains examples and plugins, not the private CLI source. Current documentation
is the specification when examples differ.

| Source                                                                  | Engineering implication                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Plugin overview](https://code.claude.com/docs/en/plugins)              | Package skills, agents and hooks in one installable directory; namespace by plugin name                                       |
| [Manifest reference](https://code.claude.com/docs/en/plugins-reference) | Only documented metadata fields; components outside .claude-plugin; validate with official CLI; persistent CLAUDE_PLUGIN_DATA |
| [Hooks reference](https://code.claude.com/docs/en/hooks)                | JSON stdin, public tool IDs, separate failures and auto denials; optional duration; no output decisions; bounded local work   |
| [Skills](https://code.claude.com/docs/en/skills)                        | SKILL.md, disable-model-invocation, explicit session/data placeholders; Bash lacks plugin environment variables               |
| [Subagents](https://code.claude.com/docs/en/sub-agents)                 | Read-only analyst with evidence versus interpretation; no automatic dispatch                                                  |
| [MCP](https://code.claude.com/docs/en/mcp)                              | Tool exposure is distinct from passive lifecycle observation; no MCP needed for v1                                            |
| [Settings](https://code.claude.com/docs/en/settings)                    | Scope and trust affect loading; do not overwrite user auth or permission configuration                                        |
| [Marketplace](https://code.claude.com/docs/en/plugin-marketplaces)      | Community catalog, relative source, explicit add/install; no reserved Anthropic name                                          |
| [CLI reference](https://code.claude.com/docs/en/cli-reference)          | Local plugin loading and print-mode fixtures; install/uninstall/validation checked against local CLI help                     |

Official plugin-dev skills read: plugin-structure, hook-development,
command-development and agent-development, plus plugin-validator's checklist.
Its shell validators are reference checks, not the authoritative current schema:
the hook validator predates PostToolUseFailure/PermissionDenied/StopFailure and
expects the inner hooks map. The current CLI and docs resolve those differences.
The agent validator is run unchanged. Hook validator input is the extracted map;
Windows jq CRLF output needs normalization when run under Git Bash.

Compared examples: hookify demonstrates stdin hooks, ralph-wiggum demonstrates
blocking Stop behavior (which this observer does not use), security-guidance
demonstrates portable root references and bounded event handlers, and review plugins
illustrate agent/command frontmatter. No example's private assumptions are copied.

Documented registered events: SessionStart, UserPromptSubmit, PreToolUse,
PostToolUse, PostToolUseFailure, PermissionDenied, Stop, StopFailure,
SubagentStart, SubagentStop, PreCompact and SessionEnd. Payload fields are optional
by event/client version; absence is recorded as unavailable. No transcript is read.

The client auto-updated from 2.1.169 to 2.1.288 during this session; validation
and real-task results identify the version actually used. Node is v24.12.0 on
Windows 11. Current public docs were downloaded locally for an auditable research
trail, outside the released repository.

For real tasks the user authorized Kimi Coding through Claude Code. The provider's
[official third-party agent guide](https://www.kimi.com/en/help/kimi-code/third-party-agents)
documents the compatible endpoint/model. Provider identity is reported in evaluation,
never described as an Anthropic model run. Existing credentials are used only in
subprocess memory and are never written into scripts, logs or Git.
