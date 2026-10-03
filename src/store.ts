import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, parse, resolve } from "node:path";
import { homedir } from "node:os";
import { HOOKS, SCHEMA_VERSION, TraceEvent, object } from "./model.js";
export const MAX_INPUT = 1024 * 1024;
export const MAX_TRACE = 64 * 1024 * 1024;
export class StoreError extends Error {}
export function dataRoot(pluginData?: string): string {
  return resolve(
    process.env.AGENT_EVALS_DATA_DIR ||
      pluginData ||
      process.env.CLAUDE_PLUGIN_DATA ||
      join(homedir(), ".claude", "plugins", "data", "agent-evals-local"),
  );
}
export function safePath(path: string): void {
  const absolute = resolve(path);
  let cursor = parse(absolute).root;
  for (const part of absolute
    .slice(cursor.length)
    .split(/[\\/]/)
    .filter(Boolean)) {
    cursor = join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink())
        throw new StoreError("Symlink/reparse path refused");
    } catch (error) {
      if (object(error).code !== "ENOENT") throw error;
    }
  }
}
export function ensureRoot(root: string): void {
  safePath(root);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  safePath(root);
}
export function storeKey(root: string): Buffer {
  ensureRoot(root);
  const path = join(root, "hash-key");
  safePath(path);
  if (!existsSync(path)) {
    const temp = join(root, ".key-" + randomBytes(8).toString("hex"));
    writeFileSync(temp, randomBytes(32), { flag: "wx", mode: 0o600 });
    try {
      linkSync(temp, path);
    } catch (error) {
      if (object(error).code !== "EEXIST") throw error;
    } finally {
      unlinkSync(temp);
    }
  }
  const key = readFileSync(path);
  if (key.length !== 32) throw new StoreError("Invalid store hash key");
  return key;
}
export function sessionPath(root: string, id: string): string {
  if (!/^[a-f0-9]{32}$/.test(id))
    throw new StoreError("Invalid session identifier");
  const path = join(root, "sessions", id + ".jsonl");
  safePath(path);
  return path;
}
function tailSeq(path: string): number {
  if (!existsSync(path)) return 0;
  const size = statSync(path).size;
  if (!size) return 0;
  if (size > MAX_TRACE) throw new StoreError("Trace exceeds 64 MiB limit");
  const fd = openSync(path, "r");
  try {
    let bytes = Math.min(size, 8192);
    let line = "";
    while (true) {
      const buffer = Buffer.alloc(bytes);
      readSync(fd, buffer, 0, bytes, size - bytes);
      const text = buffer.toString("utf8");
      if (!text.endsWith("\n"))
        throw new StoreError("Truncated trace tail; run recover explicitly");
      const previous = text.lastIndexOf("\n", text.length - 2);
      if (previous >= 0 || bytes === size) {
        line = text.slice(previous + 1, -1);
        break;
      }
      if (bytes >= MAX_INPUT + 8192)
        throw new StoreError("Trace record exceeds bound");
      bytes = Math.min(size, bytes * 2, MAX_INPUT + 8192);
    }
    let last: unknown;
    try {
      last = JSON.parse(line);
    } catch {
      throw new StoreError("Corrupt trace tail");
    }
    const seq = object(last).seq;
    if (!Number.isSafeInteger(seq) || Number(seq) < 1)
      throw new StoreError("Invalid trace sequence");
    return Number(seq);
  } finally {
    closeSync(fd);
  }
}
export async function locked<T>(
  path: string,
  operation: () => T,
  waitMs = 400,
): Promise<T> {
  const start = Date.now();
  const lock = path + ".lock";
  safePath(lock);
  let acquired = false;
  let lockFd: number | undefined;
  while (!acquired) {
    try {
      lockFd = openSync(lock, "wx", 0o600);
      acquired = true;
    } catch (error) {
      if (object(error).code !== "EEXIST") throw error;
      if (Date.now() - start > waitMs)
        throw new StoreError(
          "Recorder busy or stale lock; inspect lock, do not delete while recording",
        );
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  try {
    return operation();
  } finally {
    if (lockFd !== undefined) closeSync(lockFd);
    unlinkSync(lock);
  }
}
export async function appendEvent(
  root: string,
  event: TraceEvent,
): Promise<TraceEvent> {
  ensureRoot(root);
  const path = sessionPath(root, event.session_id);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  return locked(path, () => {
    safePath(path);
    event.seq = tailSeq(path) + 1;
    const line = JSON.stringify(event) + "\n";
    if (Buffer.byteLength(line) > MAX_INPUT)
      throw new StoreError("Normalized event too large");
    const fd = openSync(path, "a", 0o600);
    try {
      appendFileSync(fd, line, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return event;
  });
}
export function validateEvents(events: unknown[]): TraceEvent[] {
  if (!events.length) throw new StoreError("Empty trace");
  let session: unknown;
  let workspace: unknown;
  for (let i = 0; i < events.length; i++) {
    const e = object(events[i]);
    const metadata = object(e.metadata);
    const numberFields = [
      "input_bytes",
      "output_bytes",
      "exit_code",
      "background_count",
    ];
    const hashFields = [
      "input_hash",
      "output_hash",
      "error_hash",
      "old_hash",
      "new_hash",
    ];
    const booleanFields = [
      "capture_content",
      "completion_marker_seen",
      "suppressed_content",
    ];
    const stringFields = [
      "error_category",
      "verification",
      "file_id",
      "file_kind",
      "source",
      "stop_reason",
      "compaction_trigger",
      "verification_scope",
      "verification_outcome",
    ];
    const allowedFields = [
      ...numberFields,
      ...hashFields,
      ...booleanFields,
      ...stringFields,
    ];
    if (
      Object.keys(metadata).some((k) => !allowedFields.includes(k)) ||
      numberFields.some(
        (k) =>
          metadata[k] !== undefined &&
          (!Number.isSafeInteger(metadata[k]) ||
            (k !== "exit_code" && Number(metadata[k]) < 0)),
      ) ||
      hashFields.some(
        (k) =>
          metadata[k] !== undefined &&
          (typeof metadata[k] !== "string" ||
            !/^[a-f0-9]{64}$/.test(String(metadata[k]))),
      ) ||
      booleanFields.some(
        (k) => metadata[k] !== undefined && typeof metadata[k] !== "boolean",
      ) ||
      stringFields.some(
        (k) =>
          metadata[k] !== undefined &&
          (typeof metadata[k] !== "string" || String(metadata[k]).length > 80),
      ) ||
      (e.duration_ms !== undefined &&
        (typeof e.duration_ms !== "number" ||
          !Number.isFinite(e.duration_ms) ||
          e.duration_ms < 0)) ||
      (e.outcome !== undefined &&
        !["success", "failure", "cancelled", "denied", "unknown"].includes(
          String(e.outcome),
        )) ||
      ![
        "session",
        "prompt",
        "tool_call",
        "tool_result",
        "stop",
        "subagent",
        "compaction",
      ].includes(String(e.event_type)) ||
      ["correlation_id", "agent_id", "prompt_id"].some(
        (k) =>
          e[k] !== undefined &&
          (typeof e[k] !== "string" || !/^[a-f0-9]{32}$/.test(String(e[k]))),
      ) ||
      (metadata.verification !== undefined &&
        !["test", "lint", "build"].includes(String(metadata.verification))) ||
      (metadata.file_kind !== undefined &&
        !["source", "test", "other"].includes(String(metadata.file_kind)))
    )
      throw new StoreError("Invalid event fields at line " + (i + 1));
    if (
      e.seq !== i + 1 ||
      e.schema_version !== SCHEMA_VERSION ||
      e.source !== "claude-code" ||
      !HOOKS.includes(e.source_hook as (typeof HOOKS)[number]) ||
      typeof e.timestamp !== "string" ||
      !Number.isFinite(Date.parse(e.timestamp)) ||
      typeof e.session_id !== "string" ||
      !/^[a-f0-9]{32}$/.test(e.session_id) ||
      typeof e.workspace_id !== "string" ||
      !/^[a-f0-9]{32}$/.test(e.workspace_id) ||
      typeof object(e.metadata).capture_content !== "boolean"
    )
      throw new StoreError("Corrupt or unsupported event at line " + (i + 1));
    if (i === 0) {
      session = e.session_id;
      workspace = e.workspace_id;
    }
    if (e.session_id !== session || e.workspace_id !== workspace)
      throw new StoreError("Mixed session/workspace identities");
    if (e.content !== undefined && !object(e.metadata).capture_content)
      throw new StoreError("Unexpected content in metadata-only event");
  }
  return events as TraceEvent[];
}
export function readEvents(root: string, id: string): TraceEvent[] {
  const path = sessionPath(root, id);
  if (!existsSync(path)) throw new StoreError("Session not found");
  if (statSync(path).size > MAX_TRACE)
    throw new StoreError("Trace exceeds size limit");
  const text = readFileSync(path, "utf8");
  if (!text.endsWith("\n"))
    throw new StoreError(
      "Truncated JSONL; report refused. Use recover for tail recovery.",
    );
  try {
    return validateEvents(
      text
        .slice(0, -1)
        .split("\n")
        .map((line) => JSON.parse(line)),
    );
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError("Invalid JSONL; report refused");
  }
}
export function latestSession(
  root: string,
  workspaceId?: string | string[],
): string {
  const folder = join(root, "sessions");
  safePath(folder);
  if (!existsSync(folder)) throw new StoreError("No recorded sessions");
  const candidates = readdirSync(folder)
    .filter((n) => /^[a-f0-9]{32}\.jsonl$/.test(n))
    .map((n) => ({
      id: n.slice(0, -6),
      mtime: statSync(sessionPath(root, n.slice(0, -6))).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const c of candidates) {
    const events = readEvents(root, c.id);
    if (
      !workspaceId ||
      (Array.isArray(workspaceId) ? workspaceId : [workspaceId]).includes(
        events[0]!.workspace_id,
      )
    )
      return c.id;
  }
  throw new StoreError("No recorded sessions for this workspace");
}
export function writeArtifact(
  root: string,
  id: string,
  name: string,
  content: string,
): string {
  if (!/^[a-z][a-z0-9.-]+$/.test(name))
    throw new StoreError("Invalid artifact name");
  sessionPath(root, id);
  const folder = join(root, "reports", id);
  safePath(folder);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const dest = join(folder, name);
  safePath(dest);
  const temp = join(folder, "." + randomBytes(8).toString("hex") + ".tmp");
  writeFileSync(temp, content, { mode: 0o600, flag: "wx" });
  renameSync(temp, dest);
  return dest;
}
export async function recoverTail(root: string, id: string): Promise<number> {
  const path = sessionPath(root, id);
  return locked(path, () => {
    safePath(path);
    if (statSync(path).size > MAX_TRACE)
      throw new StoreError("Trace exceeds size limit");
    const text = readFileSync(path, "utf8");
    if (text.endsWith("\n")) {
      readEvents(root, id);
      return 0;
    }
    const boundary = text.lastIndexOf("\n") + 1;
    const prefix = text.slice(0, boundary);
    validateEvents(
      prefix
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line)),
    );
    const tail = text.slice(boundary);
    writeArtifact(root, id, "quarantined-tail.txt", tail);
    writeFileSync(path, prefix, { mode: 0o600 });
    return Buffer.byteLength(tail);
  });
}
