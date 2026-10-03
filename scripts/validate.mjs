import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const plugin = json(".claude-plugin/plugin.json");
const marketplace = json(".claude-plugin/marketplace.json");
const hooks = json("hooks/hooks.json");
assert.equal(plugin.name, "agent-evals");
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(marketplace.plugins[0].source, "./");
const supported = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionDenied",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
];
for (const [event, groups] of Object.entries(hooks.hooks)) {
  assert.ok(supported.includes(event));
  for (const group of groups)
    for (const handler of group.hooks) {
      assert.equal(handler.type, "command");
      assert.equal(
        handler.command,
        'node "${CLAUDE_PLUGIN_ROOT}/bin/agent-evals.mjs" hook',
      );
      assert.equal(handler.timeout, 5);
      assert.equal(handler.async, undefined);
    }
}
for (const file of [
  "bin/agent-evals.mjs",
  "bin/library.mjs",
  ...["status", "report", "export", "make-case"].map(
    (s) => "skills/" + s + "/SKILL.md",
  ),
  "agents/reliability-analyst.md",
])
  assert.ok(existsSync(file), file);
console.log(
  "Plugin structural checks passed. Also run claude plugin validate on both manifests (authoritative).",
);
