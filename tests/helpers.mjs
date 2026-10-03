import { normalize, DEFAULT_CONFIG } from "../bin/library.mjs";
export const key = Buffer.alloc(32, 7);
export const base = {
  session_id: "synthetic-session",
  cwd: "/fixture",
  transcript_path: "/never-read.jsonl",
};
export const config = { ...DEFAULT_CONFIG };
export function events(payloads, options = config, interval = 1000) {
  return payloads.map((p, i) => ({
    ...normalize({ ...base, ...p }, key, options, 1700000000000 + i * interval),
    seq: i + 1,
  }));
}
export function tool(
  id,
  name = "Bash",
  input = { command: "npm test" },
  outcome = "success",
  extra = {},
) {
  return [
    {
      hook_event_name: "PreToolUse",
      tool_use_id: id,
      tool_name: name,
      tool_input: input,
      ...extra,
    },
    {
      hook_event_name:
        outcome === "denied"
          ? "PermissionDenied"
          : outcome === "success"
            ? "PostToolUse"
            : "PostToolUseFailure",
      tool_use_id: id,
      tool_name: name,
      tool_input: input,
      ...(outcome === "failure"
        ? { error: "Exit code 1\nassertion failed" }
        : {}),
      ...(outcome === "cancelled"
        ? { error: "interrupted", is_interrupt: true }
        : {}),
      ...extra,
    },
  ];
}
export const start = { hook_event_name: "SessionStart", source: "startup" };
export const stop = {
  hook_event_name: "Stop",
  last_assistant_message: "Finished.",
  stop_hook_active: false,
};
export const edit = {
  file_path: "/fixture/src/main.ts",
  old_string: "A",
  new_string: "B",
};
