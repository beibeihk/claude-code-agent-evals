import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "./analyze.js";
import { DEFAULT_CONFIG, loadConfig, parseConfig } from "./config.js";
import { normalize } from "./normalize.js";
import { identity, workspaceCandidates } from "./privacy.js";
import { evalCase, html, markdown } from "./report.js";
import { workspaceDiff } from "./git.js";
import {
  MAX_INPUT,
  StoreError,
  appendEvent,
  dataRoot,
  ensureRoot,
  latestSession,
  readEvents,
  recoverTail,
  safePath,
  storeKey,
  writeArtifact,
} from "./store.js";
import { object } from "./model.js";

async function input(): Promise<string> {
  let size = 0;
  const parts: Buffer[] = [];
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_INPUT)
      throw new StoreError("Hook input exceeds 1 MiB; event skipped");
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString("utf8");
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args.shift() ?? "help";
  // Skill placeholders provide the documented plugin directory without adding
  // a shell environment-assignment prefix that widens/changes tool matching.
  const pluginDataIndex = args.indexOf("--plugin-data");
  let pluginData: string | undefined;
  if (pluginDataIndex >= 0) {
    pluginData = args[pluginDataIndex + 1];
    if (!pluginData || pluginData.startsWith("--"))
      throw new StoreError("--plugin-data requires a directory");
    args.splice(pluginDataIndex, 2);
  }
  const root = dataRoot(pluginData);
  if (command === "hook") {
    try {
      // Start timestamp before config/key I/O; retain receipt-time semantics.
      const now = Date.now();
      const text = await input();
      const raw: unknown = JSON.parse(text);
      const config = loadConfig(root);
      const event = normalize(
        raw,
        storeKey(root),
        config,
        now,
        process.env.CLAUDE_PROJECT_DIR,
      );
      await appendEvent(root, event);
    } catch {
      // Never emit raw payload/errors/paths, permission decisions or exit 2.
      process.stderr.write(
        "agent-evals: event skipped (invalid input, configuration, storage, or contention). Run doctor; coding task continues.\n",
      );
    }
    return;
  }
  const allowed = new Set([
    "help",
    "doctor",
    "config-init",
    "status",
    "report",
    "export",
    "make-case",
    "recover",
  ]);
  if (!allowed.has(command)) throw new StoreError("Unknown command");
  let session: string | undefined;
  let rawSession: string | undefined;
  let git = false;
  let jsonl = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--session") session = args[++i];
    else if (arg === "--raw-session") rawSession = args[++i];
    else if (arg === "--git") git = true;
    else if (arg === "--jsonl") jsonl = true;
    else throw new StoreError("Unsupported argument; run help");
  }
  if (command === "help") {
    console.log(
      "agent-evals: hook | doctor | config-init | status | report | export [--jsonl] | make-case | recover\nSelect --session <hashed-id> or --raw-session <Claude session id>; default latest in current workspace.\nreport/make-case --git: explicit read-only workspace snapshot. AGENT_EVALS_DATA_DIR overrides the data directory.",
    );
    return;
  }
  ensureRoot(root);
  if (command === "config-init") {
    const path = join(root, "config.json");
    safePath(path);
    if (existsSync(path))
      throw new StoreError("Config already exists; edit it explicitly");
    writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    console.log(path);
    return;
  }
  const key = storeKey(root);
  const config = loadConfig(root);
  if (command === "doctor") {
    console.log(
      JSON.stringify(
        {
          node: process.version,
          data_directory: root,
          capture_content: config.captureContent,
          hook_input_limit_bytes: MAX_INPUT,
          storage: "local only",
          scope:
            "doctor checks configuration, not hook delivery or credentials",
          note: "An interrupted process can leave .lock; inspect before removing manually.",
        },
        null,
        2,
      ),
    );
    return;
  }
  const id = rawSession
    ? identity(key, rawSession)
    : (session ?? latestSession(root, workspaceCandidates(key, process.cwd())));
  if (command === "recover") {
    console.log(
      JSON.stringify({
        recovered_tail_bytes: await recoverTail(root, id),
        session_id: id,
      }),
    );
    return;
  }
  const events = readEvents(root, id);
  const trace = analyze(events, parseConfig(config));
  if (git) {
    if (
      !workspaceCandidates(key, process.cwd()).includes(events[0]!.workspace_id)
    )
      throw new StoreError("Git snapshot requires the recorded workspace");
    trace.workspace_diff = workspaceDiff(process.cwd());
  }
  if (command === "status") {
    console.log(
      JSON.stringify(
        {
          session: trace.session,
          metrics: trace.metrics,
          findings: trace.findings.length,
          capture_content: config.captureContent,
          limitations: trace.limitations,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "report") {
    const paths = [
      writeArtifact(root, id, "report.html", html(trace)),
      writeArtifact(root, id, "report.md", markdown(trace)),
      writeArtifact(
        root,
        id,
        "trace.json",
        JSON.stringify(trace, null, 2) + "\n",
      ),
    ];
    console.log(
      JSON.stringify(
        { paths, findings: trace.findings, metrics: trace.metrics },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "export") {
    const filename = jsonl ? "events.jsonl" : "trace.json";
    const text = jsonl
      ? events.map((e) => JSON.stringify(e)).join("\n") + "\n"
      : JSON.stringify(trace, null, 2) + "\n";
    console.log(writeArtifact(root, id, filename, text));
    return;
  }
  if (command === "make-case")
    console.log(
      writeArtifact(
        root,
        id,
        "eval-case.json",
        JSON.stringify(evalCase(trace), null, 2) + "\n",
      ),
    );
}
if (process.env.AGENT_EVALS_LIBRARY !== "1") {
  main().catch((error) => {
    console.error(
      error instanceof StoreError
        ? error.message
        : "agent-evals: operation failed; check configuration and trace integrity",
    );
    if (object(error).code === "ENOENT")
      console.error(
        "Missing local data; run a Claude Code session with the plugin first.",
      );
    process.exitCode = 1;
  });
}
