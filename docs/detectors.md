# Deterministic detectors

All rules report observable patterns, not semantic ground truth. Defaults are in
`DEFAULT_CONFIG`; local `config.json` overrides them. Each finding has a stable
rule family ID, severity, event sequences, message and machine-readable evidence.

| Rule | Definition and evidence requirement                                                                                                              | Threshold                                                            | False-positive risk                                                            | Non-example                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| F01  | Same agent/tool/keyed canonical input hash repeated in a receipt-time window; object key order and descriptions ignored                          | 3 calls / 120 s                                                      | Deliberate polling or rereading is legitimate; info only                       | Different args/agent, or repetitions outside window                   |
| F02  | Consecutive failure result hooks from the same agent and tool, with no intervening success/denial/cancel                                         | 3; consecutive gap ≤120 s                                            | Repeated debugging tests may be expected; errors may differ                    | Failure → success → failure; cancellation; denial                     |
| F03  | Same canonical invocation repeats, with a failed/denied matched result preceding each next call                                                  | 6 invocations /120 s                                                 | Intentional retries after environmental recovery                               | Parallel unfinished equivalent calls; repeated successes              |
| F04  | Public `duration_ms`, otherwise nonnegative matched receipt interval, above threshold                                                            | >120,000 ms; configurable                                            | Builds and expensive tests are legitimate; interval includes permission delay  | Exactly threshold; unpaired/no duration                               |
| F05  | Main Stop ends with a configured exact completion marker, no known background tasks, and last visible foreground test result in this turn failed | Explicit opt-in `completionMarker`, e.g. `AGENT_EVALS_TASK_COMPLETE` | The protocol can be misused; goal outcome remains unknown                      | Ordinary “done” prose; later successful test; pending work; no marker |
| F06  | Successful Edit/Write-family source-file result before main Stop, with no recognized non-cancelled verification after the last edit in this turn | At least one source edit; info                                       | Small changes may need no test; wrappers/unobserved CI are missed              | Docs-only edit, failed edit, verification after last edit             |
| F07  | Same file/agent gets alternating exact old/new keyed hashes from successful Edit results; no intervening successful recognized verification      | 4 reverse edits; each gap ≤120 s                                     | Intentional comparison/ablation or undo/redo                                   | Different replacements, files, agents, or verification improvement    |
| F08  | Same agent/tool/canonical input repeatedly receives PermissionDenied                                                                             | 3 /120 s                                                             | User may intentionally probe a policy; only auto-mode denial covered           | PermissionRequest alone; manual rejection inferred from prose         |
| F09  | Agent/Task tool explicitly emits PostToolUseFailure and is not interrupted                                                                       | One result                                                           | Invocation setup failure is not proof the subagent itself completed and failed | SubagentStop; failure-like text; ordinary completed Agent result      |
| F10  | PreCompact boundary, event count/time before it, and following failed tool events in a window                                                    | One boundary; next120 s                                              | Temporal proximity does not identify a causal mechanism                        | No compaction event; claims of context loss from LLM prose            |

`tests/detectors.test.mjs` includes positives and counterexamples for every family,
threshold boundaries, canonicalization, parallel results, duplicates and unknown
outcomes. `scripts/evaluate.mjs` contains 50 predeclared synthetic scenarios. These
validate rule implementation; they do not estimate natural-task precision/recall.

Tool failure rate denominator is observed successes + execution failures. Cancelled,
denied and unknown calls are separately counted and excluded. Unpaired results remain
visible, without guessed calls or durations. Verification recognizes only a narrow
set of foreground test/lint/build invocations; passing exit status does not imply
all tests ran, adequate coverage, or goal success. F05/F06 operate per user turn.

F07 intentionally requires exact reverse Edit replacements rather than inventing
full file snapshots or reading source. F09 intentionally does not label arbitrary
subagent prose as failure. No detector attempts to infer hidden reasoning, compaction
causality or semantic goal drift from metadata.
