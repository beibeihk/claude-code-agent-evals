import {
  Config,
  HOOKS,
  HookName,
  SCHEMA_VERSION,
  TraceEvent,
  VerificationKind,
  object,
} from "./model.js";
import {
  canonical,
  compileCustom,
  digest,
  identity,
  redact,
  redactText,
  workspaceIdentity,
} from "./privacy.js";
import { parse } from "shell-quote";

export function verificationKind(
  command: string,
): VerificationKind | undefined {
  // Recognize simple, foreground invocations only. echo/quoted prose, pipelines,
  // conditional chains and background launchers are deliberately not evidence.
  if (/[;&|`\n\r<>]/.test(command) || command.includes("$(")) return;
  const text = command.trim();
  if (
    /^(?:npm|pnpm|yarn|bun) (?:test|run (?:test(?::[\w-]+)?|test:unit))(?:\s|$)/.test(
      text,
    ) ||
    /^(?:node --test|pytest|python(?:3)? -m (?:pytest|unittest)|cargo test|go test|dotnet test)(?:\s|$)/.test(
      text,
    )
  )
    return "test";
  if (
    /^(?:(?:npm|pnpm|yarn|bun) run lint|eslint|ruff check|cargo clippy)(?:\s|$)/.test(
      text,
    )
  )
    return "lint";
  if (
    /^(?:(?:npm|pnpm|yarn|bun) run build|tsc|cargo build|go build|dotnet build)(?:\s|$)/.test(
      text,
    )
  )
    return "build";
}
export function verificationSignal(command: string):
  | {
      kind: VerificationKind;
      scope: "direct" | "cd_prefix" | "output_pipeline";
    }
  | undefined {
  if (command.length > 8192 || /[`\n\r]/.test(command) || command.includes("$"))
    return;
  const cleaned = command.replace(/\s+2>&1(?=\s*(?:\||$))/g, "");
  let tokens: ReturnType<typeof parse>;
  try {
    tokens = parse(cleaned, () => "");
  } catch {
    return;
  }
  let scope: "direct" | "cd_prefix" | "output_pipeline" = "direct";
  if (
    tokens[0] === "cd" &&
    typeof tokens[1] === "string" &&
    object(tokens[2]).op === "&&"
  ) {
    tokens = tokens.slice(3);
    scope = "cd_prefix";
  }
  const pipe = tokens.findIndex((t) => object(t).op === "|");
  if (pipe >= 0) {
    const tail = tokens.slice(pipe + 1);
    if (
      !["head", "tail", "cat"].includes(String(tail[0])) ||
      tail.some((t) => typeof t !== "string")
    )
      return;
    tokens = tokens.slice(0, pipe);
    scope = "output_pipeline";
  }
  if (!tokens.length || tokens.some((t) => typeof t !== "string")) return;
  // Joining tokens must not turn one quoted executable/argument into a command
  // prefix (e.g. 'node --test' or npm 'run test'). Check the actual argv shape.
  const first = tokens[0];
  if (typeof first !== "string" || /\s/.test(first)) return;
  if (first === "node" && tokens[1] !== "--test") return;
  if (
    ["npm", "pnpm", "yarn", "bun"].includes(first) &&
    !(
      tokens[1] === "test" ||
      (tokens[1] === "run" &&
        typeof tokens[2] === "string" &&
        !/\s/.test(tokens[2]))
    )
  )
    return;
  if (["python", "python3"].includes(first) && tokens[1] !== "-m") return;
  if (
    ["cargo", "go", "dotnet", "ruff"].includes(first) &&
    typeof tokens[1] === "string" &&
    /\s/.test(tokens[1])
  )
    return;
  const kind = verificationKind(tokens.join(" "));
  return kind ? { kind, scope } : undefined;
}
function fileKind(path: string): "source" | "test" | "other" {
  if (
    /(?:^|[\\/])(?:tests?|__tests__)(?:[\\/]|$)|(?:\.|_)(?:test|spec)\.[\w]+$/i.test(
      path,
    )
  )
    return "test";
  return /\.(?:[cm]?[jt]sx?|py|rs|go|java|kt|c|cpp|h|cs|rb|php|sh|gd|jl|r|m)$/i.test(
    path,
  )
    ? "source"
    : "other";
}
function errorCategory(error: string, interrupted: boolean): string {
  if (interrupted) return "cancelled";
  if (/^Exit code -?\d+\b/.test(error)) return "nonzero_exit";
  if (/timed out|timeout/i.test(error)) return "timeout";
  if (/permission|denied|not allowed/i.test(error))
    return "permission_related_unconfirmed";
  return "tool_error";
}
export function normalize(
  rawValue: unknown,
  key: Buffer,
  config: Config,
  now = Date.now(),
  projectDir?: string,
): TraceEvent {
  const raw = object(rawValue);
  if (
    typeof raw.session_id !== "string" ||
    !raw.session_id ||
    raw.session_id.length > 512 ||
    typeof raw.cwd !== "string" ||
    !raw.cwd ||
    raw.cwd.length > 8192 ||
    !HOOKS.includes(raw.hook_event_name as HookName)
  )
    throw new Error("Invalid/unsupported hook input");
  const hook = raw.hook_event_name as HookName;
  const custom = config.customRedactions.map(compileCustom);
  const input = object(raw.tool_input);
  const response = object(raw.tool_response);
  const inputText = canonical(raw.tool_input ?? raw.prompt ?? null);
  const outputText = canonical(
    raw.tool_response ?? raw.error ?? raw.last_assistant_message ?? null,
  );
  const event: TraceEvent = {
    schema_version: SCHEMA_VERSION,
    seq: 0,
    timestamp: new Date(now).toISOString(),
    session_id: identity(key, raw.session_id),
    workspace_id: workspaceIdentity(key, projectDir ?? raw.cwd),
    source: "claude-code",
    source_hook: hook,
    event_type:
      hook === "UserPromptSubmit"
        ? "prompt"
        : hook === "PreToolUse"
          ? "tool_call"
          : ["PostToolUse", "PostToolUseFailure", "PermissionDenied"].includes(
                hook,
              )
            ? "tool_result"
            : ["Stop", "StopFailure"].includes(hook)
              ? "stop"
              : hook === "PreCompact"
                ? "compaction"
                : hook.startsWith("Subagent")
                  ? "subagent"
                  : "session",
    metadata: {
      capture_content: config.captureContent,
      input_bytes: Buffer.byteLength(inputText),
      output_bytes: Buffer.byteLength(outputText),
    },
  };
  if (typeof raw.agent_id === "string")
    event.agent_id = identity(key, raw.agent_id);
  if (typeof raw.prompt_id === "string")
    event.prompt_id = identity(key, raw.prompt_id);
  if (typeof raw.tool_name === "string") {
    if (!/^[\w:.-]{1,160}$/.test(raw.tool_name))
      throw new Error("Invalid tool name");
    event.tool_name = redactText(raw.tool_name, custom);
    // Tool descriptions/timeouts are not execution arguments. Exclude description
    // so retries with different descriptions still canonicalize identically.
    const args = { ...input };
    delete args.description;
    event.metadata.input_hash = digest(key, args);
  }
  if (typeof raw.tool_use_id === "string")
    event.correlation_id = identity(key, raw.tool_use_id);
  if (raw.tool_response !== undefined)
    event.metadata.output_hash = digest(key, raw.tool_response);
  if (hook === "PostToolUse")
    event.outcome = response.interrupted === true ? "cancelled" : "success";
  if (hook === "PostToolUseFailure") {
    const interrupted = raw.is_interrupt === true;
    event.outcome = interrupted ? "cancelled" : "failure";
    const error = typeof raw.error === "string" ? raw.error : "";
    event.metadata.error_hash = digest(key, error);
    event.metadata.error_category = errorCategory(error, interrupted);
    const exit = /^(?:Exit code )(-?\d+)\b/.exec(error);
    if (exit) event.metadata.exit_code = Number(exit[1]);
  }
  if (hook === "PermissionDenied") {
    event.outcome = "denied";
    event.metadata.error_category = "auto_mode_denial";
  }
  if (hook === "StopFailure") {
    event.outcome = "failure";
    event.metadata.error_category = "api_error";
  }
  if (
    typeof raw.duration_ms === "number" &&
    Number.isFinite(raw.duration_ms) &&
    raw.duration_ms >= 0
  )
    event.duration_ms = raw.duration_ms;
  if (event.tool_name === "Bash" || event.tool_name === "PowerShell") {
    if (typeof input.command === "string" && input.run_in_background !== true) {
      const signal = verificationSignal(input.command);
      if (signal) {
        event.metadata.verification = signal.kind;
        event.metadata.verification_scope = signal.scope;
        event.metadata.verification_outcome =
          signal.scope === "output_pipeline" ||
          (signal.scope === "cd_prefix" && event.outcome !== "success")
            ? "unknown"
            : (event.outcome ?? "unknown");
      }
    }
  }
  if (
    typeof input.file_path === "string" ||
    typeof input.notebook_path === "string"
  ) {
    const path = String(input.file_path ?? input.notebook_path);
    event.metadata.file_id = identity(key, path);
    event.metadata.file_kind = fileKind(path);
  }
  if (
    event.tool_name === "Edit" &&
    typeof input.old_string === "string" &&
    typeof input.new_string === "string"
  ) {
    event.metadata.old_hash = digest(key, input.old_string);
    event.metadata.new_hash = digest(key, input.new_string);
  }
  if (
    typeof raw.source === "string" &&
    ["startup", "resume", "clear", "compact", "fork"].includes(raw.source)
  )
    event.metadata.source = raw.source;
  if (hook === "SessionEnd" && typeof raw.reason === "string") {
    event.metadata.stop_reason = [
      "clear",
      "logout",
      "prompt_input_exit",
      "bypass_permissions_disabled",
      "other",
    ].includes(raw.reason)
      ? raw.reason
      : "unrecognized";
  }
  if (hook === "Stop") {
    event.metadata.background_count = Array.isArray(raw.background_tasks)
      ? raw.background_tasks.length
      : 0;
    event.metadata.completion_marker_seen =
      config.completionMarker !== null &&
      typeof raw.last_assistant_message === "string" &&
      raw.last_assistant_message.trim().split(/\r?\n/).at(-1) ===
        config.completionMarker;
  }
  if (hook === "PreCompact")
    event.metadata.compaction_trigger =
      raw.trigger === "manual"
        ? "manual"
        : raw.trigger === "auto"
          ? "auto"
          : "unknown";
  if (config.captureContent) {
    const file = String(
      input.file_path ?? input.notebook_path ?? input.command ?? "",
    );
    if (
      /(?:^|[\\/\s'"=])(?:\.env(?:\.[^\\/\s'";]*)?|credentials(?:\.json)?|id_rsa|id_ed25519|[^\\/\s]*\.pem)(?:$|[\\/\s'";])/i.test(
        file,
      )
    ) {
      event.metadata.suppressed_content = true;
    } else {
      // Strict allowlist of public payload fields. No transcript is read.
      const content: Record<string, unknown> = {};
      for (const field of [
        "tool_input",
        "tool_response",
        "prompt",
        "error",
        "last_assistant_message",
      ]) {
        if (raw[field] !== undefined)
          content[field] = redact(raw[field], custom);
      }
      event.content = content;
    }
  }
  return event;
}
