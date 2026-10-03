import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve("../agent-evals-fixtures");
const plugin = resolve(".");
const data = join(root, "data");
const sessions = JSON.parse(
  readFileSync(join(root, ".private-session-map.json"), "utf8"),
);
const env = {
  ...process.env,
  AGENT_EVALS_DATA_DIR: data,
  ANTHROPIC_BASE_URL: "https://api.kimi.com/coding",
  ANTHROPIC_AUTH_TOKEN: process.env.KIMI_API_KEY,
};
if (!env.ANTHROPIC_AUTH_TOKEN)
  throw new Error("Existing Kimi configuration required");
delete env.ANTHROPIC_API_KEY;
const start = Date.now();
const run = spawnSync(
  "claude",
  [
    "-p",
    "/agent-evals:report",
    "--resume",
    sessions[7],
    "--setting-sources",
    "project,local",
    "--plugin-dir",
    plugin,
    "--model",
    "kimi-for-coding",
    "--output-format",
    "json",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read,Skill,Bash(node *)",
    "--max-budget-usd",
    "0.5",
  ],
  {
    cwd: join(root, "task-08"),
    env,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 2 * 1024 * 1024,
  },
);
let result;
try {
  result = JSON.parse(run.stdout);
} catch {
  throw new Error("Missing public CLI JSON result");
}
// Only public final response; no raw stream, transcript, reasoning or credentials.
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/skill-smoke.json",
  JSON.stringify(
    {
      exit: run.status,
      is_error: result.is_error,
      models: Object.keys(result.modelUsage ?? {}),
      elapsed_ms: Date.now() - start,
      result: result.result,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    exit: run.status,
    is_error: result.is_error,
    models: Object.keys(result.modelUsage ?? {}),
    elapsed_ms: Date.now() - start,
    result: result.result,
  }),
);
