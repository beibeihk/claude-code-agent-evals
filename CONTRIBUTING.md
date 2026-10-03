# Contributing

Use Node 20+ and npm. Runtime bundles are committed so plugin installation needs
no package download or build step.

```bash
npm ci --ignore-scripts
npm test
npm run lint
npm run typecheck
npm run validate
npm run format:check
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate .claude-plugin/marketplace.json --strict
```

Commit regenerated `bin/` files with source changes. CI checks reproducibility.
For hook changes use the latest public [hooks reference](https://code.claude.com/docs/en/hooks),
fixtures, and an isolated real Claude Code session. Never inspect private storage
or reasoning. A detector change needs a positive example, counterexample,
threshold boundary, provenance and false-positive discussion. Cite event sequences.
Use `fix:`, `feat:` or `docs:` commits. Keep PRs focused.

`npm run evaluate` checks synthetic rule conformance and prepares 50 unlabeled human
review rows. `npm run benchmark` measures 1,000/10,000 real disk writes and 100 hook
subprocesses. `node scripts/real-tasks.mjs 20` uses existing provider credentials;
set `AGENT_EVALS_OFFICIAL_PROVIDER=1` to exclude custom provider environment overrides.
The runner ignores user-level settings for reproducibility, does not modify login
state, stops on infrastructure failure, and spends at most the configured per-task
Claude budget. Results stay under ignored `.tmp/`. Audit and redact before publishing.

Do not report synthetic expectations or AI-authored annotations as human ground
truth. Do not publish fabricated precision, recall, pass rates or performance.
