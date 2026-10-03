import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, verificationKind, normalize } from "../bin/library.mjs";
import {
  events,
  config,
  tool,
  start,
  stop,
  edit,
  base,
  key,
} from "./helpers.mjs";
const types = (payloads, options = config, interval) =>
  analyze(events(payloads, options, interval), options).findings.map(
    (f) => f.type,
  );

test("normal session edits then verifies, with no findings", () => {
  const trace = analyze(
    events([
      start,
      ...tool("read", "Read", { file_path: "/fixture/src/main.ts" }),
      ...tool("edit", "Edit", edit),
      ...tool("verify"),
      stop,
    ]),
    config,
  );
  assert.deepEqual(trace.findings, []);
  assert.equal(trace.metrics.tool_call_count, 3);
  assert.equal(trace.metrics.tool_failure_rate, 0);
  assert.equal(trace.metrics.files_touched, 1);
});
test("F01 canonical object order and descriptions", () => {
  const payloads = [
    start,
    ...tool("a", "Bash", { command: "npm test", description: "first" }),
    ...tool("b", "Bash", { description: "second", command: "npm test" }),
    ...tool("c"),
  ];
  assert.deepEqual(types(payloads), ["F01"]);
});
test("F01 excludes distinct args, agents and expired window", () => {
  assert.deepEqual(
    types([
      ...tool("a"),
      ...tool("b", "Bash", { command: "node --test" }),
      ...tool("c"),
    ]),
    [],
  );
  assert.deepEqual(
    types([
      ...tool("a"),
      ...tool("b", "Bash", { command: "npm test" }, "success", {
        agent_id: "child",
      }),
      ...tool("c"),
    ]),
    [],
  );
  assert.ok(
    !types([...tool("a"), ...tool("b"), ...tool("c")], config, 200000).includes(
      "F01",
    ),
  );
});
test("F02 consecutive failures and reset after success", () => {
  assert.ok(
    types([
      ...tool("a", "Bash", {}, "failure"),
      ...tool("b", "Bash", {}, "failure"),
      ...tool("c", "Bash", {}, "failure"),
    ]).includes("F02"),
  );
  assert.ok(
    !types([
      ...tool("a", "Bash", {}, "failure"),
      ...tool("b"),
      ...tool("c", "Bash", {}, "failure"),
    ]).includes("F02"),
  );
});
test("F03 retries require preceding completed failures, not parallel or successful repeated calls", () => {
  const opts = { ...config, excessiveRetries: 3 };
  assert.ok(
    types(
      [
        ...tool("a", "Bash", {}, "failure"),
        ...tool("b", "Bash", {}, "failure"),
        ...tool("c", "Bash", {}, "failure"),
      ],
      opts,
    ).includes("F03"),
  );
  assert.ok(
    !types([...tool("a"), ...tool("b"), ...tool("c")], opts).includes("F03"),
  );
  const calls = ["a", "b", "c"].map((id) => tool(id, "Bash", {}, "failure"));
  assert.ok(
    !types(
      [...calls.map((p) => p[0]), ...calls.map((p) => p[1])],
      opts,
    ).includes("F03"),
  );
});
test("F04 configured hook duration warning, equality is not over threshold", () => {
  assert.deepEqual(
    types(
      tool("a", "Bash", {}, "success", { duration_ms: config.longToolMs + 1 }),
    ),
    ["F04"],
  );
  assert.deepEqual(
    types(tool("a", "Bash", {}, "success", { duration_ms: config.longToolMs })),
    [],
  );
});
test("F05 explicit protocol only, last visible test fails, no pending work", () => {
  const opts = { ...config, completionMarker: "AGENT_EVALS_TASK_COMPLETE" };
  const marked = {
    ...stop,
    last_assistant_message: "Done\nAGENT_EVALS_TASK_COMPLETE",
  };
  const failing = tool("a", "Bash", { command: "npm test" }, "failure");
  assert.ok(types([...failing, marked], opts).includes("F05"));
  assert.ok(!types([...failing, stop], opts).includes("F05"));
  assert.ok(!types([...failing, marked]).includes("F05"));
  assert.ok(!types([...failing, ...tool("b"), marked], opts).includes("F05"));
  assert.ok(
    !types(
      [...failing, { ...marked, background_tasks: [{ id: "pending" }] }],
      opts,
    ).includes("F05"),
  );
});
test("F06 source edit and missing verification after final edit", () => {
  assert.deepEqual(types([...tool("a", "Edit", edit), stop]), ["F06"]);
  assert.deepEqual(types([...tool("v"), ...tool("a", "Edit", edit), stop]), [
    "F06",
  ]);
  assert.deepEqual(
    types([
      ...tool("a", "Edit", { ...edit, file_path: "/fixture/README.md" }),
      stop,
    ]),
    [],
  );
  assert.deepEqual(types([...tool("a", "Edit", edit, "failure"), stop]), []);
});
test("F07 exact reverse edits, unrelated edits and verification improvement", () => {
  const chain = [0, 1, 2, 3].flatMap((i) =>
    tool(
      "e" + i,
      "Edit",
      i % 2 ? { ...edit, old_string: "B", new_string: "A" } : edit,
    ),
  );
  assert.ok(types(chain).includes("F07"));
  assert.ok(
    !types([
      ...chain.slice(0, 4),
      ...tool("verify"),
      ...chain.slice(4),
    ]).includes("F07"),
  );
  assert.ok(
    !types(
      [0, 1, 2, 3].flatMap((i) =>
        tool("e" + i, "Edit", { ...edit, new_string: "C" + i }),
      ),
    ).includes("F07"),
  );
});
test("F08 auto denial loop separate from failure and cancellation", () => {
  const trace = analyze(
    events(["a", "b", "c"].flatMap((id) => tool(id, "Bash", {}, "denied"))),
    config,
  );
  assert.ok(trace.findings.some((f) => f.type === "F08"));
  assert.equal(trace.metrics.tool_failure_count, 0);
  assert.equal(trace.metrics.tool_denied_count, 3);
  assert.ok(!trace.findings.some((f) => f.type === "F02"));
  const cancelled = analyze(
    events(["a", "b", "c"].flatMap((id) => tool(id, "Bash", {}, "cancelled"))),
    config,
  );
  assert.equal(cancelled.metrics.tool_cancelled_count, 3);
  assert.equal(cancelled.metrics.tool_failure_rate, null);
  assert.ok(
    !cancelled.findings.some((f) => ["F02", "F03", "F08"].includes(f.type)),
  );
});
test("F09 explicit failed agent invocation, SubagentStop has no failure semantics", () => {
  assert.deepEqual(
    types(tool("a", "Agent", { prompt: "do fixture task" }, "failure")),
    ["F09"],
  );
  assert.deepEqual(
    types([
      {
        hook_event_name: "SubagentStop",
        agent_id: "child",
        last_assistant_message: "I failed",
      },
    ]),
    [],
  );
});
test("F10 compaction is correlation, never causality", () => {
  const trace = analyze(
    events([
      start,
      { hook_event_name: "PreCompact", trigger: "auto" },
      ...tool("a", "Bash", {}, "failure"),
    ]),
    config,
  );
  const finding = trace.findings.find((f) => f.type === "F10");
  assert.equal(finding.evidence.causal_claim, false);
  assert.equal(finding.evidence.following_failures, 1);
  assert.equal(trace.metrics.compaction_count, 1);
});
test("parallel correlation, out-of-order delivery, missing results and duplicates", () => {
  const a = tool("a", "Read", { file_path: "/a" });
  const b = tool("b", "Bash", { command: "npm test" }, "failure");
  const trace = analyze(events([a[0], b[0], b[1], a[1]]), config);
  assert.equal(trace.tool_calls[0].result_seq, 4);
  assert.equal(trace.tool_calls[1].result_seq, 3);
  const reverse = analyze(events([a[1], a[0]]), config);
  assert.equal(reverse.tool_calls[0].duration_ms, null);
  const missing = analyze(events([a[0]]), config);
  assert.equal(missing.metrics.unpaired_call_count, 1);
  assert.equal(missing.metrics.tool_failure_rate, null);
  const duplicate = analyze(events([a[0], a[1], a[1]]), config);
  assert.equal(duplicate.metrics.tool_success_count, 1);
  assert.equal(duplicate.metrics.duplicate_event_count, 1);
});
test("verification avoids echo, conditional chains, background and wrappers", () => {
  for (const cmd of [
    "echo npm test",
    "npm test || true",
    "node --test &",
    'printf "pytest"',
    "npm test; echo ok",
  ])
    assert.equal(verificationKind(cmd), undefined);
  assert.equal(verificationKind("node --test tests.mjs"), "test");
  assert.equal(verificationKind("npm run lint"), "lint");
  assert.equal(verificationKind("cargo build"), "build");
  assert.equal(
    normalize(
      {
        ...base,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test", run_in_background: true },
      },
      key,
      config,
    ).metadata.verification,
    undefined,
  );
});
