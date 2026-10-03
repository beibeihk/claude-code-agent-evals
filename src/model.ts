export const SCHEMA_VERSION = "1.0.0";
export const HOOKS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionDenied",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
] as const;
export type HookName = (typeof HOOKS)[number];
export type Outcome =
  "success" | "failure" | "cancelled" | "denied" | "unknown";
export type VerificationKind = "test" | "lint" | "build";
export interface Config {
  captureContent: boolean;
  customRedactions: string[];
  windowMs: number;
  repeatedCalls: number;
  failureLoop: number;
  excessiveRetries: number;
  longToolMs: number;
  oscillations: number;
  completionMarker: string | null;
}
export interface TraceEvent {
  schema_version: string;
  seq: number;
  timestamp: string;
  session_id: string;
  workspace_id: string;
  source: "claude-code";
  source_hook: HookName;
  event_type:
    | "session"
    | "prompt"
    | "tool_call"
    | "tool_result"
    | "stop"
    | "subagent"
    | "compaction";
  tool_name?: string;
  correlation_id?: string;
  agent_id?: string;
  prompt_id?: string;
  outcome?: Outcome;
  duration_ms?: number;
  metadata: {
    capture_content: boolean;
    input_bytes: number;
    output_bytes: number;
    input_hash?: string;
    output_hash?: string;
    error_hash?: string;
    error_category?: string;
    exit_code?: number;
    verification?: VerificationKind;
    verification_scope?: "direct" | "cd_prefix" | "output_pipeline";
    verification_outcome?: Outcome;
    file_id?: string;
    file_kind?: "source" | "test" | "other";
    old_hash?: string;
    new_hash?: string;
    source?: string;
    stop_reason?: string;
    completion_marker_seen?: boolean;
    background_count?: number;
    compaction_trigger?: string;
    suppressed_content?: boolean;
  };
  content?: unknown;
}
export interface Finding {
  id: string;
  type: string;
  severity: "info" | "warning" | "error";
  event_seqs: number[];
  message: string;
  evidence: Record<string, unknown>;
}
export interface ToolCall {
  id: string;
  tool_name: string;
  agent_id?: string;
  call_seq?: number;
  result_seq?: number;
  outcome: Outcome;
  duration_ms: number | null;
  duration_source: "hook" | "observed_interval" | "unavailable";
}
export interface SessionTrace {
  schema_version: string;
  session: {
    id: string;
    workspace_id: string;
    source: "claude-code";
    first_observed: string;
    last_observed: string;
    ended: boolean;
  };
  events: TraceEvent[];
  tool_calls: ToolCall[];
  findings: Finding[];
  metrics: Record<string, number | null>;
  verification: Array<{
    event_seq: number;
    kind: VerificationKind;
    outcome: Outcome;
  }>;
  limitations: string[];
  workspace_diff?: Record<string, unknown>;
}
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
