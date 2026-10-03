import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  appendEvent,
  readEvents,
  recoverTail,
  sessionPath,
  storeKey,
  identity,
  safePath,
  loadConfig,
} from "../bin/library.mjs";
import { events, start, stop, base } from "./helpers.mjs";
const cli = resolve("bin/agent-evals.mjs");
const temp = () => mkdtempSync(join(tmpdir(), "agent-evals-test-"));
test("60 concurrent writes have unique contiguous sequence and intact lines", async () => {
  const root = temp();
  const event = events([start])[0];
  await Promise.all(
    Array.from({ length: 60 }, () => appendEvent(root, structuredClone(event))),
  );
  const stored = readEvents(root, event.session_id);
  assert.equal(stored.length, 60);
  assert.deepEqual(
    stored.map((e) => e.seq),
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
});
test("parallel real hook processes safely initialize key and append", async () => {
  const root = temp();
  const results = await Promise.all(
    Array.from(
      { length: 20 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [cli, "hook"], {
            env: { ...process.env, AGENT_EVALS_DATA_DIR: root },
            stdio: ["pipe", "pipe", "pipe"],
          });
          let err = "";
          child.stderr.on("data", (c) => (err += c));
          child.on("error", reject);
          child.on("close", (code) => resolve({ code, err }));
          child.stdin.end(JSON.stringify({ ...base, ...start }));
        }),
    ),
  );
  for (const r of results) assert.deepEqual(r, { code: 0, err: "" });
  const id = identity(storeKey(root), base.session_id);
  assert.equal(readEvents(root, id).length, 20);
});
test("corrupt trace fails loudly; explicit tail recovery preserves valid prefix", async () => {
  const root = temp();
  const e = events([start])[0];
  await appendEvent(root, e);
  const path = sessionPath(root, e.session_id);
  writeFileSync(path, readFileSync(path, "utf8") + '{"partial":');
  assert.throws(() => readEvents(root, e.session_id), /Truncated/);
  assert.equal(await recoverTail(root, e.session_id), 11);
  assert.equal(readEvents(root, e.session_id).length, 1);
  assert.ok(
    existsSync(join(root, "reports", e.session_id, "quarantined-tail.txt")),
  );
  writeFileSync(path, JSON.stringify({ ...e, seq: 7 }) + "\n");
  assert.throws(() => readEvents(root, e.session_id), /Corrupt/);
});
test("path traversal, filename injection and symlink rejected", () => {
  const root = temp();
  for (const id of [
    "../x",
    "../../auth.json",
    "a\n.jsonl",
    "C:\\foo",
    "0".repeat(32) + "../",
  ])
    assert.throws(() => sessionPath(root, id));
  const outside = temp();
  const link = join(root, "link");
  symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => safePath(join(link, "child")), /Symlink/);
  const dangling = join(root, "dangling");
  symlinkSync(
    join(outside, "missing"),
    dangling,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => safePath(dangling), /Symlink/);
});
test("malformed hook, huge input, invalid config and stale lock fail open without echoing payload", async () => {
  const root = temp();
  for (const input of [
    "SECRET_SENTINEL_INVALID_JSON",
    JSON.stringify({
      session_id: "../attack",
      hook_event_name: "Unknown",
      secret: "SECRET_SENTINEL",
    }),
    "x".repeat(1024 * 1024 + 1),
  ]) {
    const r = spawnSync(process.execPath, [cli, "hook"], {
      input,
      env: { ...process.env, AGENT_EVALS_DATA_DIR: root },
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.includes("event skipped"));
    assert.ok(!r.stderr.includes("SECRET_SENTINEL"));
  }
  writeFileSync(join(root, "config.json"), '{"captureContent":"yes"}');
  assert.throws(() => loadConfig(root));
  const r = spawnSync(process.execPath, [cli, "hook"], {
    input: JSON.stringify({ ...base, ...stop }),
    env: { ...process.env, AGENT_EVALS_DATA_DIR: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.ok(r.stderr.includes("event skipped"));
  const root2 = temp();
  const key = storeKey(root2);
  const id = identity(key, base.session_id);
  mkdirSync(join(root2, "sessions"));
  mkdirSync(sessionPath(root2, id) + ".lock");
  const busy = spawnSync(process.execPath, [cli, "hook"], {
    input: JSON.stringify({ ...base, ...stop }),
    env: { ...process.env, AGENT_EVALS_DATA_DIR: root2 },
    encoding: "utf8",
  });
  assert.equal(busy.status, 0);
  assert.ok(busy.stderr.includes("event skipped"));
});
test("CLI report, export, case and workspace selection", () => {
  const root = temp();
  const env = { ...process.env, AGENT_EVALS_DATA_DIR: root };
  const hook = spawnSync(process.execPath, [cli, "hook"], {
    input: JSON.stringify({ ...base, cwd: process.cwd(), ...start }),
    env,
    encoding: "utf8",
  });
  assert.equal(hook.stderr, "");
  for (const cmd of ["status", "report", "export", "make-case"]) {
    const r = spawnSync(process.execPath, [cli, cmd], {
      env,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
  }
  const wrong = spawnSync(process.execPath, [cli, "report"], {
    env,
    encoding: "utf8",
    cwd: tmpdir(),
  });
  assert.equal(wrong.status, 1);
  assert.ok(wrong.stderr.includes("No recorded sessions for this workspace"));
});
