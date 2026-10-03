# Claude Code Reliability Report

Session: `4581123141ff268dea431c72a2b1446c`

Evidence scope: observed public hooks. Final task outcome: **unknown**.

## Overview

| Metric                |              Value |
| --------------------- | -----------------: |
| session_duration_ms   |              35265 |
| tool_call_count       |                  7 |
| tool_success_count    |                  5 |
| tool_failure_count    |                  2 |
| tool_failure_rate     | 0.2857142857142857 |
| tool_cancelled_count  |                  0 |
| tool_denied_count     |                  0 |
| unpaired_call_count   |                  0 |
| orphan_result_count   |                  0 |
| duplicate_event_count |                  0 |
| bash_call_count       |                  3 |
| edit_call_count       |                  2 |
| read_call_count       |                  2 |
| search_call_count     |                  0 |
| tool_duration_p50_ms  |                 82 |
| tool_duration_p95_ms  |               2188 |
| stop_count            |                  1 |
| subagent_count        |                  0 |
| compaction_count      |                  0 |
| files_touched         |                  1 |

## Findings

- **F01-1 (info)**: Equivalent tool arguments repeated within the configured window. Events: 7, 11, 15.

## Verification

- Event 8: test / unknown
- Event 12: test / unknown
- Event 16: test / success

## Limitations

- Receipt sequence orders recorder writes, not concurrent tool execution. Timestamps are hook receipt times.
- No hidden reasoning or transcripts are read. Stop is a turn boundary, not proof of task completion.
- Observation can miss external/background tools, non-hooked changes and process termination.
- Cancellation/denial are separate from execution failure. PermissionDenied covers auto mode only.
- Verification recognition covers a conservative set of foreground shell commands; no assertion count or coverage is inferred.
