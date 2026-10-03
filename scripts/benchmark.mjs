import { performance } from "node:perf_hooks";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, platform, release, arch } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  normalize,
  appendEvent,
  analyze,
  readEvents,
  DEFAULT_CONFIG,
  html,
} from "../bin/library.mjs";
const key = Buffer.alloc(32, 5);
const root = mkdtempSync(join(realpathSync(tmpdir()), "agent-evals-bench-"));
const results = [];
const percentile = (values, q) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * q) - 1)
  ];
for (const count of [1000, 10000]) {
  const data = join(root, String(count));
  const times = [];
  const start = performance.now();
  let id;
  for (let i = 0; i < count; i++) {
    const before = performance.now();
    const e = normalize(
      {
        session_id: "bench",
        cwd: "/bench",
        hook_event_name: i % 2 ? "PostToolUse" : "PreToolUse",
        tool_name: "Bash",
        tool_use_id: "tool-" + Math.floor(i / 2),
        tool_input: { command: "node --test tests.mjs" },
        ...(i % 2 ? { duration_ms: 12 } : {}),
      },
      key,
      DEFAULT_CONFIG,
      1700000000000 + i * 20,
    );
    await appendEvent(data, e);
    times.push(performance.now() - before);
    id = e.session_id;
  }
  const processMs = performance.now() - start;
  const reportStart = performance.now();
  const trace = analyze(readEvents(data, id), DEFAULT_CONFIG);
  const document = html(trace);
  const reportMs = performance.now() - reportStart;
  results.push({
    events: count,
    event_processing_total_ms: processMs,
    event_processing_mean_ms: processMs / count,
    event_processing_p50_ms: percentile(times, 0.5),
    event_processing_p95_ms: percentile(times, 0.95),
    disk_bytes: statSync(join(data, "sessions", id + ".jsonl")).size,
    report_generation_ms: reportMs,
    html_bytes: Buffer.byteLength(document),
    rss_bytes: process.memoryUsage().rss,
  });
  console.log(JSON.stringify(results.at(-1)));
}
const startup = [];
const childData = join(root, "subprocess");
for (let i = 0; i < 100; i++) {
  const before = performance.now();
  const r = spawnSync(
    process.execPath,
    [resolve("bin/agent-evals.mjs"), "hook"],
    {
      input: JSON.stringify({
        session_id: "subprocess",
        cwd: "/bench",
        hook_event_name: "Stop",
      }),
      env: { ...process.env, AGENT_EVALS_DATA_DIR: childData },
      encoding: "utf8",
    },
  );
  if (r.status !== 0 || r.stderr)
    throw new Error("Hook benchmark skipped an event");
  startup.push(performance.now() - before);
}
const output = {
  measured_at: new Date().toISOString(),
  node: process.version,
  os: platform() + " " + release() + " " + arch(),
  method:
    "Warm local journal append + fsync. Separate process sample includes Node startup. No Claude tool/API time. RSS is process RSS at end, not peak memory.",
  results,
  hook_subprocess: {
    samples: 100,
    p50_ms: percentile(startup, 0.5),
    p95_ms: percentile(startup, 0.95),
    mean_ms: startup.reduce((a, b) => a + b, 0) / startup.length,
  },
};
mkdirSync("docs/evaluation", { recursive: true });
writeFileSync(
  "docs/evaluation/benchmark.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log(JSON.stringify(output.hook_subprocess));
