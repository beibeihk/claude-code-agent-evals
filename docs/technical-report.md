# What observable signals reliably identify coding-agent failures?

## Motivation

A final agent response is not an audit trail. Coding-agent reliability evaluation
needs independently observable behavior and explicit limits on inference. This
project asks which public Claude Code hook signals can support reproducible rules
without retaining prompts/source by default or reading hidden reasoning.

## Public plugin surface

The plugin uses documented command hooks, user-invoked skills and a read-only
optional analyst. Source research, official examples and version notes are in
[official research](official-research.md). It never patches the CLI, reads private
IPC/databases, or reads transcripts/reasoning. Stop is a turn boundary; SubagentStop
does not prove failure; PermissionDenied only covers auto mode.

## Data model

See [schema](schema.md). JSONL events use receipt sequence, public hook name,
timestamp, keyed session/workspace/correlation identifiers and allowlisted metadata.
The documented project directory stabilizes workspace identity if tools change cwd.
Tool pairing uses agent/tool IDs. Public `duration_ms` wins over receipt intervals.
Unknown/orphan/duplicate states remain explicit. Final goal outcome is unknown.
Content is opt-in and redacted; default exports contain no body or original paths.

## Detector design

Definitions and counterexamples are in [detectors](detectors.md). F01–F10 report
repetition, consecutive failures, retries, durations, completion-protocol mismatch,
missing verification, exact edit reversal, auto denials, explicit Agent/Task failure
and compaction correlation. The evidence layer and deterministic findings are
separate from optional interpretation. No rule claims compaction causality.

Verification classification distinguishes recognizable invocation from reliable
exit status: a limited `cd … &&` prefix is recognized; known output-only pipelines
can demonstrate an invocation but mask the test process exit. Such verification
results are unknown, not pass. Shell prose, arbitrary chains/wrappers and background
work are excluded. This boundary was motivated by real-task observations and has
positive and adversarial regression tests.

## Evaluation

The automated suite covers every rule's positive/counterexample, durations,
parallel correlation/writes, denial/cancellation, 14 fake secrets, opt-in/default
privacy, malformed/oversized input, unsafe custom regex, corruption/recovery,
symlink/path injection, CLI operations and HTML escaping. Actual final test counts
and real-run summaries are recorded in `docs/evaluation/validation.json`.

The [50-scenario synthetic set](evaluation/rule-conformance.json) exactly matches
50 predeclared rule-label sets. This is implementation conformance, not estimated
accuracy on real failures. [Human review sheet](evaluation/human-review.csv) contains
50 pending rows. Human-reviewed annotations: **0**. Human precision, false-positive
rate and recall: **not estimated**. No AI-authored labels are described as human
ground truth. A meaningful FPR denominator needs a specified sampled set of actual
negatives, not merely non-firing rules.

The real harness runs 20 independently testable one-function JavaScript repairs in
isolated repositories, including sum, clamp, factorial, chunk, median and zip.
It instructs the agent to run the fixed tests before and after repair; an independent
Node test process checks the final source. No external project is modified.
The user explicitly authorized **Claude Code with Kimi Coding**; requested and
reported model names are recorded, so this is client integration/evidence testing,
not an Anthropic-model benchmark. Failed setup attempts and final task results are
kept distinct. Source/body and original raw transcripts stay out of the released
trace examples. The small deterministic fixtures do not represent general SWE tasks.

## Performance

Measured Node v24.12.0 on Windows 11 x64. The benchmark writes and flushes 1,000
and 10,000 synthetic events; separate 100-process samples include Node startup and
filesystem work. [Machine-readable measurements](evaluation/benchmark.json) report
mean/p50/p95 processing, disk bytes, report time and end-of-process RSS. RSS is not
peak memory, and warm local filesystem observations are not deployment-wide guarantees.
No fabricated sub-millisecond hook claim is made. Synchronous recording adds real
latency; async teardown loss was judged worse for this evidence recorder.

## False positives and limitations

Repetition and long tools can be intentional. A red test can be a successful
debugging step. Missing recognizable verification can reflect command wrappers,
pipelines or hidden CI rather than omission by the agent. Exact reversal can be
deliberate comparison. Findings therefore cite events and conservative severity.
The first real-run wave exposed verification-recognition gaps; no retroactive labels
are fabricated from hashes or assistant claims.

Goal drift, business correctness, coverage and task satisfaction are outside
metadata-only observation. Manual permission denials/background work may be absent.
Client cancellation can omit hook events; stale locks and incomplete traces are
visible limitations. Current git diffs include other actors' and pre-existing edits.
Redaction is best effort for known patterns; metadata-only remains the privacy default.

## Future work

Collect independent human annotations with explicit negative sampling; measure
inter-reviewer agreement and precision by rule. Add verification adapters only when
public structured evidence is available. Study incremental signal value relative
to independent tests and task labels. Evaluate LLM interpretations separately.
Cross-harness adapters should preserve provenance/unknown states before attempting
a shared observatory. An Action importer is deferred until a stable public artifact
contract and safe permission model are available.
