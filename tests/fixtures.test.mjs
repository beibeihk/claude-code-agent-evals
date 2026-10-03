import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize, DEFAULT_CONFIG, analyze } from "../bin/library.mjs";
const read = (name) =>
  JSON.parse(readFileSync("tests/fixtures/" + name + ".json", "utf8"));
test("public-shaped JSON hook fixtures normalize and correlate", () => {
  const rows = [
    "session-start",
    "pre-tool-bash",
    "post-tool-bash-success",
    "stop",
  ].map((name, i) => ({
    ...normalize(
      read(name),
      Buffer.alloc(32, 1),
      DEFAULT_CONFIG,
      1700000000000 + i * 1000,
    ),
    seq: i + 1,
  }));
  const trace = analyze(rows, DEFAULT_CONFIG);
  assert.equal(trace.tool_calls[0].duration_source, "hook");
  assert.equal(trace.verification[0].outcome, "success");
  const failure = normalize(
    read("post-tool-bash-failure"),
    Buffer.alloc(32, 1),
    DEFAULT_CONFIG,
  );
  assert.equal(failure.outcome, "failure");
  assert.equal(failure.metadata.exit_code, 1);
});
