import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verificationSignal,
  analyze,
  DEFAULT_CONFIG,
} from "../bin/library.mjs";
import { events, tool, edit, stop } from "./helpers.mjs";
test("cd prefix and stderr merge recognized; output pipeline never reports test pass", () => {
  assert.deepEqual(
    verificationSignal('cd "/path with space" && node --test tests.mjs 2>&1'),
    { kind: "test", scope: "cd_prefix" },
  );
  assert.deepEqual(
    verificationSignal("node --test tests.mjs 2>&1 | head -n 60"),
    { kind: "test", scope: "output_pipeline" },
  );
  const trace = analyze(
    events([
      ...tool("edit", "Edit", edit),
      ...tool("test", "Bash", {
        command: "node --test tests.mjs 2>&1 | head -n 60",
      }),
      stop,
    ]),
    DEFAULT_CONFIG,
  );
  assert.equal(trace.verification[0].outcome, "unknown");
  assert.ok(!trace.findings.some((f) => f.type === "F06"));
});
test("shell fragments and echo remain non-evidence", () => {
  for (const command of [
    'echo "node --test"',
    "'node --test'",
    "npm 'run test'",
    "node '--test bogus'",
    "node --test || true",
    "node --test; echo ok",
    "echo x && node --test",
    "node --test | sh",
    "node --test $(echo anything)",
    'cd /repo && echo "node --test"',
  ])
    assert.equal(verificationSignal(command), undefined);
});
test("a denied verification invocation is not evidence that verification ran", () => {
  const trace = analyze(
    events([
      ...tool("edit", "Edit", edit),
      ...tool("test", "Bash", { command: "npm test" }, "denied"),
      stop,
    ]),
    DEFAULT_CONFIG,
  );
  assert.ok(trace.findings.some((f) => f.type === "F06"));
});
