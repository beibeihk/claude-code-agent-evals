import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  analyze,
  readEvents,
  storeKey,
  identity,
  DEFAULT_CONFIG,
  html,
  evalCase,
} from "../bin/library.mjs";

const root = resolve(
  process.env.AGENT_EVALS_TASK_ROOT ?? "../agent-evals-fixtures",
);
const plugin = resolve(".");
const data = join(root, "data");
mkdirSync(data, { recursive: true });
const cases = [
  [
    "sum",
    "(a,b)=>a-b",
    "(a,b)=>a+b",
    [
      [[2, 3], 5],
      [[-2, 4], 2],
    ],
  ],
  [
    "max",
    "(a,b)=>a<b?a:b",
    "(a,b)=>a>b?a:b",
    [
      [[2, 5], 5],
      [[8, 3], 8],
    ],
  ],
  [
    "clamp",
    "(x,lo,hi)=>Math.min(lo,Math.max(hi,x))",
    "(x,lo,hi)=>Math.max(lo,Math.min(hi,x))",
    [
      [[5, 1, 3], 3],
      [[-1, 0, 4], 0],
    ],
  ],
  [
    "isEven",
    "x=>x%2===1",
    "x=>x%2===0",
    [
      [[4], true],
      [[3], false],
    ],
  ],
  [
    "factorial",
    "n=>n<=1?0:n*factorial(n-1)",
    "n=>n<=1?1:n*factorial(n-1)",
    [
      [[0], 1],
      [[5], 120],
    ],
  ],
  [
    "reverse",
    "s=>s",
    's=>[...s].reverse().join("")',
    [
      [["abc"], "cba"],
      [[""], ""],
    ],
  ],
  [
    "unique",
    "xs=>xs",
    "xs=>[...new Set(xs)]",
    [
      [[[1, 1, 2]], [1, 2]],
      [[[]], []],
    ],
  ],
  [
    "average",
    "xs=>xs.reduce((a,b)=>a+b,0)",
    "xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0",
    [
      [[[2, 4]], 3],
      [[[]], 0],
    ],
  ],
  [
    "capitalize",
    "s=>s.toLowerCase()",
    "s=>s?s[0].toUpperCase()+s.slice(1):s",
    [
      [["hello"], "Hello"],
      [[""], ""],
    ],
  ],
  [
    "count",
    "(s,c)=>s.length",
    "(s,c)=>[...s].filter(x=>x===c).length",
    [
      [["banana", "a"], 3],
      [["abc", "z"], 0],
    ],
  ],
  [
    "chunk",
    "(xs,n)=>[xs]",
    "(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n))",
    [
      [
        [[1, 2, 3, 4, 5], 2],
        [[1, 2], [3, 4], [5]],
      ],
      [[[], 2], []],
    ],
  ],
  [
    "range",
    "n=>Array.from({length:n},(_,i)=>i+1)",
    "n=>Array.from({length:n},(_,i)=>i)",
    [
      [[3], [0, 1, 2]],
      [[0], []],
    ],
  ],
  [
    "median",
    "xs=>xs[0]",
    "xs=>{const ys=[...xs].sort((a,b)=>a-b);const n=ys.length;return n%2?ys[Math.floor(n/2)]:(ys[n/2-1]+ys[n/2])/2}",
    [
      [[[3, 1, 2]], 2],
      [[[1, 4, 2, 3]], 2.5],
    ],
  ],
  [
    "slug",
    "s=>s",
    's=>s.trim().toLowerCase().replace(/\\s+/g,"-")',
    [
      [[" Hello World "], "hello-world"],
      [["A  B"], "a-b"],
    ],
  ],
  [
    "intersection",
    "(a,b)=>[...a,...b]",
    "(a,b)=>[...new Set(a)].filter(x=>b.includes(x))",
    [
      [
        [
          [1, 2, 2],
          [2, 3],
        ],
        [2],
      ],
      [[[], [1]], []],
    ],
  ],
  [
    "isPalindrome",
    "s=>false",
    's=>s===[...s].reverse().join("")',
    [
      [["aba"], true],
      [["abc"], false],
    ],
  ],
  [
    "zip",
    "(a,b)=>a",
    "(a,b)=>a.slice(0,Math.min(a.length,b.length)).map((x,i)=>[x,b[i]])",
    [
      [
        [
          [1, 2],
          ["a", "b"],
        ],
        [
          [1, "a"],
          [2, "b"],
        ],
      ],
      [[[1, 2], ["x"]], [[1, "x"]]],
    ],
  ],
  [
    "compact",
    "xs=>xs",
    "xs=>xs.filter(Boolean)",
    [
      [[[0, 1, null, 2, false]], [1, 2]],
      [[[]], []],
    ],
  ],
  [
    "sumSquares",
    "xs=>xs.reduce((a,b)=>a+b,0)",
    "xs=>xs.reduce((a,b)=>a+b*b,0)",
    [
      [[[2, 3]], 13],
      [[[]], 0],
    ],
  ],
  [
    "degrees",
    "x=>x*Math.PI/180",
    "x=>x*180/Math.PI",
    [
      [[Math.PI], 180],
      [[0], 0],
    ],
  ],
];
const limit = Number(process.argv[2] ?? 20);
const force = process.argv.includes("--force");
const bundleHash = createHash("sha256")
  .update(readFileSync("bin/agent-evals.mjs"))
  .digest("hex");
const claudeVersion = spawnSync("claude", ["--version"], {
  encoding: "utf8",
}).stdout.trim();
let results = existsSync(join(root, "results.json"))
  ? JSON.parse(readFileSync(join(root, "results.json"), "utf8"))
  : [];
for (let i = 0; i < Math.min(limit, cases.length); i++) {
  if (
    !force &&
    results.some(
      (r) => r.index === i && r.agent_exit === 0 && r.independent_tests === 0,
    )
  )
    continue;
  const [name, broken, , examples] = cases[i];
  const cwd = join(root, "task-" + String(i + 1).padStart(2, "0"));
  mkdirSync(cwd, { recursive: true });
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(
    join(cwd, "src", "task.mjs"),
    `export const ${name}=${broken};\n`,
  );
  writeFileSync(
    join(cwd, "tests.mjs"),
    `import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {${name}} from './src/task.mjs';\n` +
      examples
        .map(
          ([input, expected], j) =>
            `test('case ${j}',()=>assert.deepEqual(${name}(...${JSON.stringify(input)}),${JSON.stringify(expected)}));`,
        )
        .join("\n") +
      "\n",
  );
  spawnSync("git", ["init", "--quiet"], { cwd });
  spawnSync("git", ["add", "."], { cwd });
  spawnSync(
    "git",
    [
      "-c",
      "user.name=Agent Evals Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "test: seed broken fixture",
    ],
    { cwd },
  );
  const session = randomUUID();
  const mapPath = join(root, ".private-session-map.json");
  const sessionMap = existsSync(mapPath)
    ? JSON.parse(readFileSync(mapPath, "utf8"))
    : {};
  sessionMap[i] = session;
  writeFileSync(mapPath, JSON.stringify(sessionMap), { mode: 0o600 });
  const prompt = `This is an isolated reliability evaluation fixture. Fix the bug in src/task.mjs so that the existing tests pass. Read the source and tests, run node --test tests.mjs before and after your fix. Do not modify tests, install packages, use the network, or access files outside this fixture. Keep the change minimal. Report the observed test result. Function: ${name}.`;
  const started = Date.now();
  const childEnv = { ...process.env, AGENT_EVALS_DATA_DIR: data };
  // Evaluation requests the official first-party provider, without changing the
  // user's provider settings or credential store. Ignore user-level provider
  // remaps for this subprocess only; retain the existing network proxy.
  if (process.env.AGENT_EVALS_OFFICIAL_PROVIDER === "1")
    for (const name of Object.keys(childEnv))
      if (name.startsWith("ANTHROPIC_")) delete childEnv[name];
  if (process.env.AGENT_EVALS_PROVIDER === "kimi") {
    if (!process.env.KIMI_API_KEY)
      throw new Error("Existing KIMI_API_KEY is required");
    childEnv.ANTHROPIC_BASE_URL = "https://api.kimi.com/coding";
    childEnv.ANTHROPIC_AUTH_TOKEN = process.env.KIMI_API_KEY;
    delete childEnv.ANTHROPIC_API_KEY;
  }
  const requestedModel =
    process.env.AGENT_EVALS_PROVIDER === "kimi" ? "kimi-for-coding" : "haiku";
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(
      "claude",
      [
        "-p",
        prompt,
        "--setting-sources",
        "project,local",
        "--plugin-dir",
        plugin,
        "--session-id",
        session,
        "--model",
        requestedModel,
        "--output-format",
        "json",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Read,Edit,Write,Bash(node *)",
        "--disallowedTools",
        "Agent,Task,WebFetch,WebSearch",
        "--max-budget-usd",
        "0.75",
      ],
      { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "",
      stderr = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (stderr += b));
    const timer = setTimeout(() => child.kill(), 240000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      let parsed = {};
      try {
        parsed = JSON.parse(output);
      } catch {}
      // Preserve only terminal, public response and aggregate usage. No thinking,
      // raw stream, tokens, credentials, debug logs, or transcripts are stored.
      resolveResult({
        agent_exit: code,
        is_error: parsed.is_error ?? null,
        result: parsed.result ?? "No JSON result",
        reported_models: Object.keys(parsed.modelUsage ?? {}),
        reported_cost_usd: parsed.total_cost_usd ?? null,
        usage: parsed.usage
          ? {
              input_tokens: parsed.usage.input_tokens,
              output_tokens: parsed.usage.output_tokens,
            }
          : null,
        stderr_present: stderr.length > 0,
      });
    });
  });
  const independent = spawnSync(process.execPath, ["--test", "tests.mjs"], {
    cwd,
    encoding: "utf8",
  });
  const id = identity(storeKey(data), session);
  let trace = null;
  try {
    trace = analyze(readEvents(data, id), DEFAULT_CONFIG);
  } catch (error) {
    console.error("Trace validation failed: " + error.message);
  }
  const entry = {
    index: i,
    task: name,
    session_id: id,
    provider: process.env.AGENT_EVALS_PROVIDER ?? "existing configuration",
    requested_model: requestedModel,
    elapsed_ms: Date.now() - started,
    bundle_sha256: bundleHash,
    claude_version: claudeVersion,
    ...result,
    independent_tests: independent.status,
    observed_events: trace?.events.length ?? 0,
    findings: trace?.findings ?? [],
    metrics: trace?.metrics ?? null,
  };
  results = results.filter((r) => r.index !== i);
  results.push(entry);
  writeFileSync(join(root, "results.json"), JSON.stringify(results, null, 2));
  if (trace) {
    writeFileSync(join(cwd, "report.html"), html(trace));
    writeFileSync(
      join(cwd, "eval-case.json"),
      JSON.stringify(evalCase(trace), null, 2),
    );
  }
  console.log(
    JSON.stringify({
      task: i + 1,
      name,
      agent_exit: entry.agent_exit,
      test_exit: entry.independent_tests,
      events: entry.observed_events,
      findings: entry.findings.map((f) => f.type),
      elapsed_ms: entry.elapsed_ms,
      reported_cost: entry.reported_cost_usd,
    }),
  );
  if (entry.agent_exit !== 0 && entry.observed_events < 3) {
    console.log(
      "Runner paused after an infrastructure/API failure; inspect sanitized results.",
    );
    break;
  }
}
console.log(
  "Finished " +
    results.length +
    " task records; traces stored locally in " +
    data,
);
