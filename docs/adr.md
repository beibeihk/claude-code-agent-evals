# Architecture decisions

## ADR-001: Metadata-only by default

Traces should be useful without retaining prompts, source or output. Use allowlisted
categories and keyed hashes. Content capture requires an explicit local opt-in and
redaction. Metadata still has privacy costs; it is not anonymization.

## ADR-002: Deterministic findings before LLM interpretation

Rules require observable evidence and event sequence references. Optional analyst
output is a hypothesis with uncertainty. It is never a ground-truth failure label.

## ADR-003: Public hooks only

Use documented lifecycle inputs, skills and agent definitions. No installation
patching, transcript/hidden reasoning extraction, private IPC or database access.
Omit evidence unavailable on the installed client.

## ADR-004: Local-only storage

Use the documented persistent plugin data directory. No daemon, telemetry, network
upload or external database. Bounded synchronous writes trade small measured latency
for predictable pre-call capture and fewer teardown losses.
