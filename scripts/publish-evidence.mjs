import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  analyze,
  readEvents,
  DEFAULT_CONFIG,
  html,
  markdown,
  evalCase,
  workspaceDiff,
} from "../bin/library.mjs";
const root = resolve("../agent-evals-fixtures");
const records = JSON.parse(
  readFileSync(join(root, "results.json"), "utf8"),
).sort((a, b) => a.index - b.index);
if (
  records.length !== 20 ||
  records.some((r) => r.agent_exit !== 0 || r.independent_tests !== 0)
)
  throw new Error("Expected 20 independently passing real tasks");
if (new Set(records.map((r) => r.bundle_sha256)).size !== 1)
  throw new Error("Mixed tested bundles; rerun fixed build");
const summarized = records.map((r) => {
  const trace = analyze(
    readEvents(join(root, "data"), r.session_id).slice(0, r.observed_events),
    DEFAULT_CONFIG,
  );
  return {
    task: r.task,
    session_id: r.session_id,
    provider: r.provider,
    requested_model: r.requested_model,
    reported_models: r.reported_models,
    claude_version: r.claude_version,
    bundle_sha256: r.bundle_sha256,
    elapsed_ms: r.elapsed_ms,
    agent_exit: r.agent_exit,
    independent_test_exit: r.independent_tests,
    observed_events: trace.events.length,
    findings: trace.findings.map((f) => ({
      type: f.type,
      severity: f.severity,
      event_seqs: f.event_seqs,
    })),
    metrics: trace.metrics,
    verification: trace.verification,
  };
});
mkdirSync("docs/evaluation", { recursive: true });
mkdirSync("examples", { recursive: true });
writeFileSync(
  "docs/evaluation/real-tasks.json",
  JSON.stringify(
    {
      recorded_at: new Date().toISOString(),
      provenance:
        "Real Claude Code client with user-authorized Kimi Coding endpoint; small isolated JavaScript bug-repair fixtures. Final tests executed independently. Detector labels are not human annotations.",
      tasks: 20,
      independently_passing: 20,
      human_reviewed: 0,
      precision: null,
      false_positive_rate: null,
      recall: null,
      records: summarized,
    },
    null,
    2,
  ) + "\n",
);
const chosen = records.find((r) => r.task === "average");
const trace = analyze(
  readEvents(join(root, "data"), chosen.session_id).slice(
    0,
    chosen.observed_events,
  ),
  DEFAULT_CONFIG,
);
trace.workspace_diff = workspaceDiff(join(root, "task-08"));
writeFileSync("examples/report.html", html(trace));
writeFileSync("examples/report.md", markdown(trace));
writeFileSync("examples/trace.json", JSON.stringify(trace, null, 2) + "\n");
writeFileSync(
  "examples/events.jsonl",
  trace.events.map((e) => JSON.stringify(e)).join("\n") + "\n",
);
writeFileSync(
  "examples/eval-case.json",
  JSON.stringify(evalCase(trace), null, 2) + "\n",
);
// Record commands actually run now. First displays a previously recorded public
// coding result; playback is expressly identified, not a live coding recording.
const frames = [];
const started = Date.now();
const output = (text) => {
  frames.push([
    (Date.now() - started) / 1000,
    "o",
    text.replace(/\r?\n/g, "\r\n"),
  ]);
  process.stdout.write(text);
};
output(
  "Recorded replay: completed average bug repair with Claude Code + Kimi Coding.\n",
);
output(chosen.result + "\n");
const env = { ...process.env, AGENT_EVALS_DATA_DIR: join(root, "data") };
for (const args of [["--test", "tests.mjs"]]) {
  output("$ node " + args.join(" ") + "\n");
  const run = spawnSync(process.execPath, args, {
    cwd: join(root, "task-08"),
    env,
    encoding: "utf8",
  });
  output(run.stdout);
  if (run.status !== 0) throw new Error("Demo tests failed");
}
output(
  "$ node <plugin>/bin/agent-evals.mjs report --session <recorded-session> --git\n",
);
const report = spawnSync(
  process.execPath,
  [
    resolve("bin/agent-evals.mjs"),
    "report",
    "--session",
    chosen.session_id,
    "--git",
  ],
  { cwd: join(root, "task-08"), env, encoding: "utf8" },
);
if (report.status !== 0) throw new Error("Live report command failed");
const publicOutput = JSON.parse(report.stdout);
publicOutput.paths = publicOutput.paths.map(
  (p) =>
    "<local-plugin-data>/artifacts/" +
    chosen.session_id +
    "/" +
    p.split(/[\\/]/).at(-1),
);
output(JSON.stringify(publicOutput, null, 2) + "\n");
writeFileSync(
  "examples/demo.cast",
  [
    JSON.stringify({
      version: 2,
      width: 110,
      height: 34,
      timestamp: Math.floor(started / 1000),
      title:
        "Claude Code Agent Evals — recorded coding replay + live tests/report",
      env: { TERM: "xterm-256color" },
    }),
    ...frames.map((f) => JSON.stringify(f)),
  ].join("\n") + "\n",
);
writeFileSync("examples/demo.txt", frames.map((f) => f[2]).join(""));
console.log("Published safe metadata examples and actual measurements.");
