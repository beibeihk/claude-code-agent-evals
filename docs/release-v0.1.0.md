# v0.1.0 — observable coding-agent reliability evidence

Install the community marketplace and plugin:

```text
/plugin marketplace add beibeihk/claude-code-agent-evals
/plugin install agent-evals@beibeihk-agent-evals
```

Node.js 20+ on PATH is required; the distributed bundle needs no npm install.
This release provides public hook recording, metadata-only local storage with
opt-in redaction, F01–F10 deterministic evidence rules, four user-invoked skills,
HTML/Markdown/JSON/JSONL reports, eval-case exports, and an optional analyst.

Validation: 31 automated tests, 50/50 synthetic rule-conformance scenarios,
official manifest validation, actual install/uninstall, and 20 independently
passing small coding repairs using Claude Code 2.1.288 with Kimi Coding's
`kimi-for-coding` identifier. A real report skill invocation was also checked.
See the [technical report](technical-report.md) for reproducibility, measured
performance, tested bundle identities and integration limits.

Human annotations remain pending by the user's explicit release choice;
precision/false-positive rate/recall are not estimated. Findings are observations,
not proof of task failure. Public hooks cannot establish final goal success.

The [terminal demo](../examples/demo.cast) explicitly replays a recorded public
coding result, then runs fresh independent tests and generates a live report.
All example provenance and unobserved states are documented. No hidden reasoning
or transcript is read. Upstream Action research is tracked separately and is not
presented as a merged contribution.
