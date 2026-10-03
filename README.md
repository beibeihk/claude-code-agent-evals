# Claude Code Agent Evals

**Community plugin · public hooks · local-only · metadata by default**

[中文](README.zh-CN.md) · [Example report](examples/report.html) · [Technical report](docs/technical-report.md) · [Detector definitions](docs/detectors.md)

## Why

What did a coding agent actually do? Which tools failed, what verification was
observed, and which patterns deserve investigation? This plugin records public
Claude Code hook evidence and produces reproducible, deterministic findings.
It does not infer hidden reasoning or declare that a user's goal succeeded.

## Features

- Bounded local JSONL recording with sequence numbers and tool-ID correlation.
- Metadata-only defaults; explicit redacted content opt-in and keyed identifiers.
- Tool outcomes, observed durations, verification, subagents and compaction metrics.
- Ten conservative rule families with evidence requirements and counterexamples.
- Standalone HTML/Markdown reports; neutral JSON/JSONL and eval-case exports.
- Optional analyst reads a redacted report only on explicit user request.
- Zero runtime npm dependencies; installed bundle works without a build step.

## Installation

Requirements: **Node.js 20+** on PATH and Claude Code. The compatibility record in
the technical report lists the client version actually tested. This is an
independent community plugin, not an Anthropic product or official plugin.

In Claude Code:

```text
/plugin marketplace add beibeihk/claude-code-agent-evals
/plugin install agent-evals@beibeihk-agent-evals
```

Or from your shell:

```bash
claude plugin marketplace add beibeihk/claude-code-agent-evals
claude plugin install agent-evals@beibeihk-agent-evals --scope local
```

To test a clone for one session:

```bash
git clone https://github.com/beibeihk/claude-code-agent-evals.git
claude --plugin-dir ./claude-code-agent-evals
```

Uninstall with `claude plugin uninstall agent-evals@beibeihk-agent-evals --scope local
--keep-data`. Omit `--keep-data` only if you intend to apply the client's documented
data-removal behavior. Restart/reload plugins when testing hook changes.

## Quick Start

Install, run a coding task in an isolated repository, then invoke:

```text
/agent-evals:status
/agent-evals:report
/agent-evals:make-case
```

Open the returned local `report.html` path. Hooks store data outside your repository
in the documented persistent plugin data directory. No MCP server or daemon is
required. Nothing is uploaded.

CLI access is also available; use the expanded plugin install/data paths:

```bash
AGENT_EVALS_DATA_DIR="<plugin-data-directory>" node "<plugin>/bin/agent-evals.mjs" report
AGENT_EVALS_DATA_DIR="<plugin-data-directory>" node "<plugin>/bin/agent-evals.mjs" export --jsonl
```

On PowerShell set `$env:AGENT_EVALS_DATA_DIR` before the `node` command. Without an
explicit session, CLI operations choose the latest session **in the current
workspace**. `--session <hashed-id>` and `--raw-session <Claude-session-id>` select
one explicitly. Skills use the documented `${CLAUDE_SESSION_ID}` when available.

## Commands

| Skill                    | Operation                                                           |
| ------------------------ | ------------------------------------------------------------------- |
| `/agent-evals:status`    | Observation scope, metrics and finding count                        |
| `/agent-evals:report`    | Local HTML, Markdown and normalized JSON                            |
| `/agent-evals:export`    | Normalized JSON; CLI `--jsonl` exports raw normalized events        |
| `/agent-evals:make-case` | Eval case with observable events, findings and unknown goal outcome |

CLI-only: `doctor`, `config-init`, `recover`, `report --git`, `make-case --git`.
These operations never run project tests or change source. An explicit `--git`
captures a read-only current workspace diff against HEAD; it cannot attribute
changes to Claude and does not include untracked file line counts.

## Failure Detectors

| ID  | Observation                                                   | Default                                       |
| --- | ------------------------------------------------------------- | --------------------------------------------- |
| F01 | Equivalent arguments repeated within a window                 | info; 3 calls / 120 s                         |
| F02 | Consecutive failures of the same tool                         | warning; 3 failures                           |
| F03 | Equivalent failed/denied calls retried                        | warning; 6 invocations                        |
| F04 | Duration over configured threshold                            | warning; 120 s                                |
| F05 | Explicit completion marker with last visible failing test     | disabled until completion protocol configured |
| F06 | Source edit without recognized verification after final edit  | info                                          |
| F07 | Exact reverse edits without observed verification improvement | warning; 4 edits                              |
| F08 | Repeated equivalent auto-mode denials                         | warning; 3 denials                            |
| F09 | Explicit failed Agent/Task tool invocation                    | warning; main outcome unknown                 |
| F10 | Compaction boundary and subsequent failures                   | info; correlation only                        |

Repeated tools, compaction and missing verification are not inherently failures.
See [definitions, thresholds, risks and non-examples](docs/detectors.md).

## Example Report

The [static report](examples/report.html) contains overview metrics, findings,
timeline, tool correlation, verification, git-snapshot scope, subagents and
compaction. It has no JavaScript or remote assets. Example provenance is stated
in [examples](examples/README.md); synthetic data is never presented as a real run.

## Privacy

**All traces remain local by default.** Metadata-only recording stores no prompt,
source body, shell output or secret values. `captureContent: true` is an explicit
local opt-in; redaction runs before persistence. Hidden reasoning and transcripts
are never collected. See [privacy settings and limitations](docs/privacy.md).
The optional analyst uses your configured LLM provider when you request analysis.

## Architecture

Public hooks → input allowlist → metadata/redaction → local journal → correlation
and deterministic findings → report/eval case → optional interpretation.
Read [architecture](docs/architecture.md), [schema](docs/schema.md) and the four
[ADRs](docs/adr.md). The hooks issue no permission decisions, model calls or uploads.

## Evaluation

Tests, the 50-scenario rule-conformance set, benchmark and real-task harness are
reproducible. Actual measurements and validation status are recorded in
[the technical report](docs/technical-report.md). Synthetic rule conformance is
not natural-task accuracy. Human precision/false-positive rate require a reviewed
label set; unreviewed fields remain null. Recall is not claimed.

## Limitations

- Public hooks are incomplete evidence; goal drift and semantic correctness need independent labels.
- Stop ends a turn; SubagentStop does not imply subagent failure.
- Auto-mode denial events do not cover all manual denials or policy blocks.
- Verification recognition is conservative; wrappers/compound/background commands can be missed.
- Missing/duplicate events, stale locks and corrupt tails are surfaced, not silently repaired.
- Receipt-interval durations on older clients include permission and hook latency.
- V1 has no cross-agent importer, telemetry service or LLM judge in the evidence layer.

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

Follow [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md) and the
[study guide](CLAUDE_CODE_AGENT_EVALS_STUDY_GUIDE.md). Runtime bundles are committed;
CI checks tests, lint, types, manifests, formatting and reproducible builds on
Linux, Windows and macOS. MIT licensed.
