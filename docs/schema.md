# Normalized schema v1.0.0

`SessionTrace` contains `session`, `events`, `tool_calls`, `findings`, `metrics`,
`verification`, `limitations`, and optional `workspace_diff`. Type definitions live
in `src/model.ts`. Events carry schema version, contiguous receipt sequence,
timestamp, source, source hook, keyed session/workspace identity, optional keyed
correlation/agent/prompt IDs, outcome, public duration and allowlisted metadata.

Events are session/prompt/tool-call/tool-result/stop/subagent/compaction records.
Missing fields remain absent; unknown observations do not become zero-valued success.
Source is currently `claude-code`. Correlation is agent ID + tool-use ID, not input
hash or sequence adjacency. Input hashes identify equivalent canonical args, not
tool identity. Hashes use a private per-store HMAC key, with no cross-store matching.

`tool_calls` explicitly records unmatched calls/results and duration provenance.
`verification` has event sequence, recognized command kind and observable outcome.
`findings` has ID/type/severity/event sequences/message/evidence. Interpretation is
not a finding field. `eval-case.json` adds unknown final goal outcome and empty human
annotation slots. `events.jsonl` is raw normalized evidence, without analysis.

The loader rejects invalid JSON, truncated tails, sequence gaps, mixed identity,
unsupported schema version and invalid metadata field types. Major schema changes
need explicit migration; future adapters must preserve their own observation limits
and source provenance rather than invent unsupported fields.
