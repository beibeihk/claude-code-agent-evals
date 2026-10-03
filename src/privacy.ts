import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { object } from "./model.js";

export function workspaceIdentity(key: Buffer, path: string): string {
  const absolute = resolve(path);
  return identity(
    key,
    process.platform === "win32" ? absolute.replace(/\\/g, "/") : absolute,
  );
}
export function workspaceCandidates(key: Buffer, path: string): string[] {
  const absolute = resolve(path);
  // Earlier local evaluation builds hashed the public spelling verbatim.
  // Claude uses forward slashes on Windows; process.cwd() uses backslashes.
  return [
    ...new Set([
      workspaceIdentity(key, path),
      identity(key, path),
      identity(key, absolute.replace(/\\/g, "/")),
    ]),
  ];
}

// Applied to keys and values. Custom expressions are bounded literals / simple
// character classes, never arbitrary JavaScript regular expressions.
const KEY =
  /(?:secret|token|password|passwd|authorization|cookie|api[_-]?key|credential|private[_-]?key|client[_-]?secret)/i;
const INTERNAL =
  /^(?:thinking|reasoning|chain[_-]?of[_-]?thought|scratchpad|transcript_path|agent_transcript_path)$/i;
const PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,})/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\bBearer\s+[^\s'";,]+/gi,
  /\b(?:ANTHROPIC_API_KEY|GITHUB_TOKEN|AWS_(?:SECRET_ACCESS_KEY|SESSION_TOKEN)|GOOGLE_APPLICATION_CREDENTIALS|AZURE_[A-Z_]+|[A-Z_]*(?:API_KEY|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD))\s*[=:]\s*[^\s,;]+/gi,
  /\b(?:authorization|cookie|set-cookie|password|passwd|api[_-]?key|client[_-]?secret|accountkey|sharedaccesssignature|private_key)\s*[=:]\s*[^\r\n]+/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/gi,
];
export function compileCustom(pattern: string): RegExp {
  // Reject groups, alternation, wildcards, escapes, and unbounded quantifiers.
  // This sacrifices expressive power to keep untrusted config off the hook's
  // catastrophic-backtracking path. See docs/privacy.md.
  if (
    !pattern ||
    pattern.length > 160 ||
    !/^[A-Za-z0-9_:@/-]*(?:\[[A-Za-z0-9_-]+\]\{\d{1,3}(?:,\d{1,3})?\})?[A-Za-z0-9_:@/-]*$/.test(
      pattern,
    )
  ) {
    throw new Error(
      "Unsafe custom redaction expression; use literals, character classes and bounded {n,m}",
    );
  }
  const bounds = /\{(\d+)(?:,(\d+))?\}/.exec(pattern);
  if (
    bounds &&
    (Number(bounds[1]) < 1 ||
      Number(bounds[2] ?? bounds[1]) > 256 ||
      Number(bounds[1]) > Number(bounds[2] ?? bounds[1]))
  )
    throw new Error("Unsafe redaction bounds");
  return new RegExp(pattern, "g");
}
export function redactText(text: string, custom: RegExp[] = []): string {
  let out = text;
  for (const regex of [...PATTERNS, ...custom])
    out = out.replace(regex, "[REDACTED]");
  return out;
}
export function redact(
  value: unknown,
  custom: RegExp[] = [],
  depth = 0,
): unknown {
  if (depth > 16) return "[DEPTH LIMIT]";
  if (typeof value === "string") return redactText(value, custom);
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (Array.isArray(value))
    return value.slice(0, 1000).map((v) => redact(v, custom, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(object(value)).slice(0, 1000)) {
    if (INTERNAL.test(key)) continue;
    result[redactText(key, custom)] = KEY.test(key)
      ? "[REDACTED]"
      : redact(v, custom, depth + 1);
  }
  return result;
}
export function canonical(value: unknown, depth = 0): string {
  if (depth > 24) throw new Error("Hook input nesting exceeds limit");
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v, depth + 1)).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .filter((k) => !INTERNAL.test(k))
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) + ":" + canonical(object(value)[k], depth + 1),
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value) ?? "null";
}
export function digest(key: Buffer, value: unknown): string {
  return createHmac("sha256", key).update(canonical(value)).digest("hex");
}
export function identity(key: Buffer, value: string): string {
  return digest(key, value).slice(0, 32);
}
