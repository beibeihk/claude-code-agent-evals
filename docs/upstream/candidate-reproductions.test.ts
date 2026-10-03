// Known upstream bugs, deliberately failing on the recorded baseline.
// This is a research harness, not part of this plugin's passing unit suite.
import { test, expect, mock } from "bun:test";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const checkout = resolve(
  process.env.CLAUDE_ACTION_CHECKOUT ?? "../research/claude-code-action",
);
const load = (path: string) => import(pathToFileURL(join(checkout, path)).href);
test("#1852: pending background work must survive the first turn result", async () => {
  const dir = mkdtempSync(
    join(realpathSync(tmpdir()), "action-background-repro-"),
  );
  process.env.RUNNER_TEMP = dir;
  writeFileSync(join(dir, "prompt.txt"), "Synthetic background task fixture");
  const result = (text: string) => ({
    type: "result",
    subtype: "success",
    is_error: false,
    result: text,
    num_turns: 1,
    duration_ms: 1,
    total_cost_usd: 0,
    permission_denials: [],
    modelUsage: {},
  });
  mock.module(
    join(checkout, "node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs"),
    () => ({
      query: async function* () {
        yield {
          type: "system",
          subtype: "init",
          session_id: "fixture-session",
        };
        yield {
          type: "system",
          subtype: "task_started",
          task_id: "fixture-task",
          task_type: "local_agent",
          description: "synthetic",
        };
        yield result("WAITING");
        yield {
          type: "system",
          subtype: "task_notification",
          task_id: "fixture-task",
          status: "completed",
          summary: "DONE",
        };
        yield result("DONE");
      },
    }),
  );
  const { runClaudeWithSdk } = await load("base-action/src/run-claude-sdk.ts");
  const run = await runClaudeWithSdk(join(dir, "prompt.txt"), {
    sdkOptions: {},
    showFullOutput: false,
    hasJsonSchema: false,
  });
  const messages = JSON.parse(readFileSync(run.executionFile, "utf8"));
  console.log(
    JSON.stringify({
      candidate: 1852,
      actual_conclusion: run.conclusion,
      actual_result: messages.at(-1).result,
      consumed_messages: messages.length,
    }),
  );
  expect(messages.at(-1).result).toBe("DONE");
});
test("#1854: a log body timeout must reject rather than return empty success", async () => {
  const { Octokit } = await import(
    pathToFileURL(
      join(checkout, "node_modules/@octokit/rest/dist-src/index.js"),
    ).href
  );
  const { downloadJobLog } = await load("src/mcp/github-actions-server.ts");
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "action-log-repro-"));
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("line 1\nline 2\n"));
          },
        }),
        { headers: { "content-type": "text/plain" } },
      ),
  });
  try {
    let failed = false;
    let actual;
    try {
      actual = await downloadJobLog(
        new Octokit({ baseUrl: server.url.origin }),
        { owner: "fixture", repo: "fixture", job_id: 1 },
        dir,
        300,
      );
    } catch {
      failed = true;
    }
    console.log(
      JSON.stringify({
        candidate: 1854,
        rejected: failed,
        size_bytes: actual?.size_bytes,
      }),
    );
    expect(failed).toBe(true);
  } finally {
    server.stop(true);
  }
}, 5000);
test("#1841: failing MCP content blocks must retain the actual error text", async () => {
  const { formatToolWithResult } = await load(
    "src/entrypoints/format-turns.ts",
  );
  const actual = formatToolWithResult(
    { name: "mcp__fixture__tool", input: {} },
    {
      is_error: true,
      content: [{ type: "text", text: "fixture tool failed" }],
    },
  );
  console.log(JSON.stringify({ candidate: 1841, actual }));
  expect(actual).toContain("fixture tool failed");
  expect(actual).not.toContain("[object Object]");
});
