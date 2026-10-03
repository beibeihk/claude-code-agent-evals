import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  workspaceIdentity,
  workspaceCandidates,
  identity,
} from "../bin/library.mjs";
test("skill directory option works without shell assignment and honors explicit override", () => {
  const plugin = mkdtempSync(
    join(realpathSync(tmpdir()), "agent-evals-plugin-"),
  );
  const override = mkdtempSync(
    join(realpathSync(tmpdir()), "agent-evals-override-"),
  );
  const env = { ...process.env };
  delete env.AGENT_EVALS_DATA_DIR;
  delete env.CLAUDE_PLUGIN_DATA;
  const run = (options) =>
    spawnSync(
      process.execPath,
      [resolve("bin/agent-evals.mjs"), "doctor", "--plugin-data", plugin],
      { env: options, encoding: "utf8" },
    );
  assert.equal(run(env).status, 0);
  assert.equal(JSON.parse(run(env).stdout).data_directory, plugin);
  assert.equal(
    JSON.parse(run({ ...env, AGENT_EVALS_DATA_DIR: override }).stdout)
      .data_directory,
    override,
  );
});
test("workspace identity matches public Windows slash spelling and legacy traces", () => {
  const key = Buffer.alloc(32, 9);
  const cwd = process.cwd();
  assert.equal(
    workspaceIdentity(key, cwd),
    workspaceIdentity(key, resolve(cwd, ".")),
  );
  if (process.platform === "win32")
    assert.equal(
      workspaceIdentity(key, cwd),
      workspaceIdentity(key, cwd.replace(/\\/g, "/")),
    );
  assert.ok(
    workspaceCandidates(key, cwd).includes(
      identity(key, cwd.replace(/\\/g, "/")),
    ),
  );
});
