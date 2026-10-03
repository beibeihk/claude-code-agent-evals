import {
  Config,
  Finding,
  SessionTrace,
  ToolCall,
  TraceEvent,
} from "./model.js";

const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);
export function analyze(events: TraceEvent[], config: Config): SessionTrace {
  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) throw new Error("Empty trace");
  const findings: Finding[] = [];
  const limitations = [
    "Receipt sequence orders recorder writes, not concurrent tool execution. Timestamps are hook receipt times.",
    "No hidden reasoning or transcripts are read. Stop is a turn boundary, not proof of task completion.",
    "Observation can miss external/background tools, non-hooked changes and process termination.",
    "Cancellation/denial are separate from execution failure. PermissionDenied covers auto mode only.",
    "Verification recognition covers a conservative set of foreground shell commands; no assertion count or coverage is inferred.",
  ];
  const calls: ToolCall[] = [];
  const pending = new Map<string, ToolCall>();
  const correlationKey = (e: TraceEvent) =>
    e.correlation_id
      ? (e.agent_id ?? "main") + ":" + e.correlation_id
      : undefined;
  let callEvents = events.filter((e) => e.source_hook === "PreToolUse");
  let resultEvents = events.filter((e) =>
    ["PostToolUse", "PostToolUseFailure", "PermissionDenied"].includes(
      e.source_hook,
    ),
  );
  const completedIds = new Set<string>();
  const byCallSeq = new Map<number, ToolCall>();
  const duplicates: number[] = [];
  for (const e of events) {
    const key = correlationKey(e);
    if (e.source_hook === "PreToolUse") {
      if (key && pending.has(key)) {
        duplicates.push(e.seq);
        continue;
      }
      const call: ToolCall = {
        id: key ?? "unpaired:" + e.seq,
        tool_name: e.tool_name ?? "unknown",
        agent_id: e.agent_id,
        call_seq: e.seq,
        outcome: "unknown",
        duration_ms: null,
        duration_source: "unavailable",
      };
      calls.push(call);
      byCallSeq.set(e.seq, call);
      if (key) pending.set(key, call);
    }
  }
  for (const e of resultEvents) {
    const key = correlationKey(e);
    if (key && completedIds.has(key)) {
      duplicates.push(e.seq);
      continue;
    }
    if (key) completedIds.add(key);
    let call = key ? pending.get(key) : undefined;
    if (call && call.tool_name !== e.tool_name) {
      limitations.push(
        "Tool name mismatch for correlation at event " +
          e.seq +
          "; result kept unpaired.",
      );
      call = undefined;
    }
    if (!call) {
      call = {
        id: "orphan:" + e.seq,
        tool_name: e.tool_name ?? "unknown",
        agent_id: e.agent_id,
        outcome: "unknown",
        duration_ms: null,
        duration_source: "unavailable",
      };
      calls.push(call);
    }
    call.result_seq = e.seq;
    call.outcome = e.outcome ?? "unknown";
    if (e.duration_ms !== undefined) {
      call.duration_ms = e.duration_ms;
      call.duration_source = "hook";
    } else if (call.call_seq) {
      const start = events[call.call_seq - 1];
      const interval = start
        ? Date.parse(e.timestamp) - Date.parse(start.timestamp)
        : -1;
      if (interval >= 0) {
        call.duration_ms = interval;
        call.duration_source = "observed_interval";
      }
    }
  }
  if (duplicates.length)
    limitations.push(
      "Duplicate correlation events excluded from tool outcomes: " +
        duplicates.join(", "),
    );
  callEvents = callEvents.filter((e) => !duplicates.includes(e.seq));
  resultEvents = resultEvents.filter((e) => !duplicates.includes(e.seq));
  if (calls.some((c) => !c.call_seq || !c.result_seq))
    limitations.push(
      "Trace has unmatched tool calls/results; incomplete evidence is included in metrics.",
    );
  const emit = (
    type: string,
    severity: Finding["severity"],
    seqs: number[],
    message: string,
    evidence: Finding["evidence"],
  ) => {
    findings.push({
      id: type + "-" + (findings.filter((f) => f.type === type).length + 1),
      type,
      severity,
      event_seqs: seqs,
      message,
      evidence,
    });
  };
  const time = (e: TraceEvent) => Date.parse(e.timestamp);
  const sameAgent = (a: TraceEvent, b: TraceEvent) => a.agent_id === b.agent_id;
  const groups = new Map<string, TraceEvent[]>();
  for (const e of callEvents) {
    if (!e.tool_name || !e.metadata.input_hash) continue;
    const key =
      (e.agent_id ?? "main") + ":" + e.tool_name + ":" + e.metadata.input_hash;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  for (const group of groups.values()) {
    let start = 0;
    let reportedRepeat = false;
    let reportedRetry = false;
    let retryStart = 0;
    for (let end = 0; end < group.length; end++) {
      const current = group[end]!;
      while (
        start < end &&
        time(current) - time(group[start]!) > config.windowMs
      )
        start++;
      if (end - start + 1 >= config.repeatedCalls && !reportedRepeat) {
        emit(
          "F01",
          "info",
          group.slice(start, end + 1).map((e) => e.seq),
          "Equivalent tool arguments repeated within the configured window.",
          {
            threshold: config.repeatedCalls,
            window_ms: config.windowMs,
            tool: current.tool_name,
          },
        );
        reportedRepeat = true;
      }
      // Retries require a failed/denied result BEFORE each following call.
      if (end > 0) {
        const previous = byCallSeq.get(group[end - 1]!.seq);
        if (
          !previous?.result_seq ||
          previous.result_seq >= current.seq ||
          !["failure", "denied"].includes(previous.outcome)
        )
          retryStart = end;
      }
      const effectiveStart = Math.max(start, retryStart);
      if (
        end - effectiveStart + 1 >= config.excessiveRetries &&
        !reportedRetry
      ) {
        emit(
          "F03",
          "warning",
          group.slice(effectiveStart, end + 1).map((e) => e.seq),
          "Equivalent failed/denied invocation retried above the configured threshold.",
          { threshold: config.excessiveRetries, window_ms: config.windowMs },
        );
        reportedRetry = true;
      }
    }
  }
  const byAgent = new Map<string, TraceEvent[]>();
  for (const e of resultEvents) {
    const key = e.agent_id ?? "main";
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key)!.push(e);
  }
  for (const group of byAgent.values()) {
    let loop: TraceEvent[] = [];
    let reported = false;
    for (const e of group) {
      const prev = loop.at(-1);
      if (e.outcome !== "failure") {
        loop = [];
        reported = false;
        continue;
      }
      if (
        !prev ||
        prev.tool_name !== e.tool_name ||
        time(e) - time(prev) > config.windowMs
      ) {
        loop = [];
        reported = false;
      }
      loop.push(e);
      if (loop.length >= config.failureLoop && !reported) {
        emit(
          "F02",
          "warning",
          loop.map((e) => e.seq),
          "Consecutive observed failures of the same tool.",
          {
            threshold: config.failureLoop,
            tool: e.tool_name,
            error_categories: loop.map((x) => x.metadata.error_category),
          },
        );
        reported = true;
      }
    }
  }
  for (const call of calls) {
    if (
      call.result_seq &&
      call.duration_ms !== null &&
      call.duration_ms > config.longToolMs
    )
      emit(
        "F04",
        "warning",
        [call.call_seq, call.result_seq].filter(
          (n): n is number => n !== undefined,
        ),
        "Tool duration exceeds the user-configured warning threshold.",
        {
          duration_ms: call.duration_ms,
          threshold_ms: config.longToolMs,
          duration_source: call.duration_source,
        },
      );
  }
  const verification = resultEvents
    .filter((e) => e.metadata.verification !== undefined)
    .map((e) => ({
      event_seq: e.seq,
      kind: e.metadata.verification!,
      outcome: e.metadata.verification_outcome ?? e.outcome ?? "unknown",
    }));
  for (const stop of events.filter(
    (e) => e.source_hook === "Stop" && !e.agent_id,
  )) {
    const previousPrompt =
      events
        .filter(
          (e) =>
            e.source_hook === "UserPromptSubmit" &&
            e.seq < stop.seq &&
            !e.agent_id,
        )
        .at(-1)?.seq ?? 0;
    const turn = events.filter(
      (e) => e.seq > previousPrompt && e.seq < stop.seq,
    );
    const latestTest = turn
      .filter(
        (e) =>
          e.metadata.verification === "test" &&
          e.event_type === "tool_result" &&
          !e.agent_id,
      )
      .at(-1);
    if (
      stop.metadata.completion_marker_seen &&
      stop.metadata.background_count === 0 &&
      latestTest !== undefined &&
      (latestTest?.metadata.verification_outcome ?? latestTest?.outcome) ===
        "failure"
    ) {
      emit(
        "F05",
        "warning",
        [latestTest.seq, stop.seq],
        "Explicit completion marker observed while the last visible foreground test failed.",
        {
          completion_protocol: true,
          scope: "current turn / main agent",
          final_goal_outcome: "unknown",
        },
      );
    }
    const edits = turn.filter(
      (e) =>
        EDIT_TOOLS.has(e.tool_name ?? "") &&
        e.source_hook === "PostToolUse" &&
        e.metadata.file_kind === "source",
    );
    const latestEdit = edits.at(-1);
    if (
      latestEdit &&
      !turn.some(
        (e) =>
          e.seq > latestEdit.seq &&
          e.event_type === "tool_result" &&
          e.metadata.verification !== undefined &&
          (e.outcome === "success" || e.outcome === "failure"),
      )
    ) {
      emit(
        "F06",
        "info",
        [latestEdit.seq, stop.seq],
        "Source edit observed without a recognized verification after the final edit in this turn.",
        {
          scope: "recognized foreground verification",
          task_requires_tests: "unknown",
        },
      );
    }
  }
  const editsByFile = new Map<string, TraceEvent[]>();
  for (const e of resultEvents.filter(
    (e) =>
      e.source_hook === "PostToolUse" &&
      e.tool_name === "Edit" &&
      e.metadata.file_id &&
      e.metadata.old_hash &&
      e.metadata.new_hash,
  )) {
    const key = (e.agent_id ?? "main") + ":" + e.metadata.file_id;
    if (!editsByFile.has(key)) editsByFile.set(key, []);
    editsByFile.get(key)!.push(e);
  }
  for (const edits of editsByFile.values()) {
    let chain: TraceEvent[] = [];
    for (const e of edits) {
      const prev = chain.at(-1);
      const reversed =
        prev &&
        e.metadata.old_hash === prev.metadata.new_hash &&
        e.metadata.new_hash === prev.metadata.old_hash &&
        time(e) - time(prev) <= config.windowMs;
      if (
        !reversed ||
        (prev &&
          resultEvents.some(
            (v) =>
              sameAgent(v, e) &&
              v.seq > prev.seq &&
              v.seq < e.seq &&
              v.metadata.verification &&
              (v.metadata.verification_outcome ?? v.outcome) === "success",
          ))
      )
        chain = [];
      chain.push(e);
      if (chain.length === config.oscillations)
        emit(
          "F07",
          "warning",
          chain.map((v) => v.seq),
          "Exact reverse edits repeated without an intervening successful recognized verification.",
          {
            threshold: config.oscillations,
            file_id: e.metadata.file_id,
            intent: "unknown",
          },
        );
    }
  }
  const denials = new Map<string, TraceEvent[]>();
  for (const e of resultEvents.filter(
    (e) => e.source_hook === "PermissionDenied" && e.metadata.input_hash,
  )) {
    const key =
      (e.agent_id ?? "main") + ":" + e.tool_name + ":" + e.metadata.input_hash;
    const group = (denials.get(key) ?? []).filter(
      (x) => time(e) - time(x) <= config.windowMs,
    );
    group.push(e);
    denials.set(key, group);
    if (group.length === config.failureLoop)
      emit(
        "F08",
        "warning",
        group.map((v) => v.seq),
        "Equivalent tool denied repeatedly by auto mode.",
        { threshold: config.failureLoop, coverage: "auto mode only" },
      );
  }
  for (const e of resultEvents.filter(
    (e) =>
      ["Agent", "Task"].includes(e.tool_name ?? "") && e.outcome === "failure",
  )) {
    emit(
      "F09",
      "warning",
      [e.seq],
      "Subagent tool invocation explicitly failed; main-task outcome is unknown.",
      { signal: "PostToolUseFailure", subagent_completed: "unknown" },
    );
  }
  for (const compact of events.filter((e) => e.source_hook === "PreCompact")) {
    const following = resultEvents.filter(
      (e) =>
        e.seq > compact.seq &&
        time(e) - time(compact) <= config.windowMs &&
        e.outcome === "failure",
    );
    emit(
      "F10",
      "info",
      [compact.seq, ...following.map((e) => e.seq)],
      "Observed compaction boundary; following failures are temporal correlation only.",
      {
        events_before: compact.seq - 1,
        observed_ms_before: time(compact) - time(first),
        following_failures: following.length,
        causal_claim: false,
      },
    );
  }
  const durations = calls
    .filter((c) => c.duration_ms !== null)
    .map((c) => c.duration_ms!)
    .sort((a, b) => a - b);
  const percentile = (q: number) =>
    durations.length
      ? durations[Math.max(0, Math.ceil(durations.length * q) - 1)]!
      : null;
  const successful = calls.filter((c) => c.outcome === "success").length;
  const failed = calls.filter((c) => c.outcome === "failure").length;
  const subagents = new Set(
    events
      .filter((e) => e.source_hook === "SubagentStart")
      .map((e) => e.agent_id ?? "event:" + e.seq),
  );
  return {
    schema_version: first.schema_version,
    session: {
      id: first.session_id,
      workspace_id: first.workspace_id,
      source: "claude-code",
      first_observed: first.timestamp,
      last_observed: last.timestamp,
      ended: events.some((e) => e.source_hook === "SessionEnd"),
    },
    events,
    tool_calls: calls,
    findings,
    verification,
    limitations,
    metrics: {
      session_duration_ms: Math.max(
        0,
        Date.parse(last.timestamp) - Date.parse(first.timestamp),
      ),
      tool_call_count: callEvents.length,
      tool_success_count: successful,
      tool_failure_count: failed,
      tool_failure_rate:
        successful + failed ? failed / (successful + failed) : null,
      tool_cancelled_count: calls.filter((c) => c.outcome === "cancelled")
        .length,
      tool_denied_count: calls.filter((c) => c.outcome === "denied").length,
      unpaired_call_count: calls.filter((c) => !c.result_seq).length,
      orphan_result_count: calls.filter((c) => !c.call_seq).length,
      duplicate_event_count: duplicates.length,
      bash_call_count: callEvents.filter((e) =>
        ["Bash", "PowerShell"].includes(e.tool_name ?? ""),
      ).length,
      edit_call_count: callEvents.filter((e) =>
        EDIT_TOOLS.has(e.tool_name ?? ""),
      ).length,
      read_call_count: callEvents.filter((e) => e.tool_name === "Read").length,
      search_call_count: callEvents.filter((e) =>
        ["Grep", "Glob"].includes(e.tool_name ?? ""),
      ).length,
      tool_duration_p50_ms: percentile(0.5),
      tool_duration_p95_ms: percentile(0.95),
      stop_count: events.filter((e) => e.source_hook === "Stop" && !e.agent_id)
        .length,
      subagent_count: subagents.size,
      compaction_count: events.filter((e) => e.source_hook === "PreCompact")
        .length,
      files_touched: new Set(
        resultEvents
          .filter(
            (e) =>
              EDIT_TOOLS.has(e.tool_name ?? "") &&
              e.outcome === "success" &&
              e.metadata.file_id,
          )
          .map((e) => e.metadata.file_id),
      ).size,
    },
  };
}
