# Example provenance

These are **real public hook events** from the isolated `average` repair task,
run using Claude Code 2.1.288 and the user-authorized Kimi Coding endpoint with
requested/reported identifier `kimi-for-coding`. This is not an Anthropic-model
benchmark. Metadata-only recording was enabled. Original paths and content are
absent; identifiers are keyed hashes. The local key is never published.

- [HTML report](report.html), [Markdown report](report.md)
- [Normalized session](trace.json), [event journal](events.jsonl)
- [Eval case](eval-case.json), with unknown goal outcome and no human labels
- [Terminal demo](demo.cast) ([readable transcript](demo.txt))

The terminal demo explicitly replays the recorded **public final coding response**,
then records fresh independent tests and a live CLI report. It is not a fabricated
live model recording. Play it with `asciinema play examples/demo.cast`. The separate
slash-command integration result is recorded in the validation report.

The F01 finding indicates equivalent calls repeated, not task failure. Independent
tests pass; these are separate evidence sources. The report's current git snapshot
does not establish which actor caused a change. Aggregate batch results are in
[real-tasks.json](../docs/evaluation/real-tasks.json). Synthetic scenarios are kept
separately in the rule-conformance set and raw hook fixtures.
