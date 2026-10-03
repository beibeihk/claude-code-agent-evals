import { writeFileSync, mkdirSync } from "node:fs";
import { analyze, DEFAULT_CONFIG } from "../bin/library.mjs";
import { events, tool, start, stop, edit } from "../tests/helpers.mjs";
// Rule-conformance scenarios, NOT human ground truth or natural-task accuracy.
const cases = [];
const add = (name, payloads, expected, options = DEFAULT_CONFIG) =>
  cases.push({
    id: "S" + String(cases.length + 1).padStart(2, "0"),
    name,
    payloads,
    expected,
    options,
  });
for (let i = 0; i < 10; i++)
  add(
    "normal verified task " + i,
    [
      start,
      ...tool("edit", "Edit", {
        ...edit,
        file_path: "/fixture/src/file" + i + ".ts",
      }),
      ...tool("verify"),
      stop,
    ],
    [],
  );
for (let i = 0; i < 5; i++)
  add(
    "repetition " + i,
    ["a", "b", "c"].flatMap((id) =>
      tool(id, "Read", { file_path: "/file" + i }),
    ),
    ["F01"],
  );
for (let i = 0; i < 5; i++)
  add(
    "error loop " + i,
    ["a", "b", "c"].flatMap((id) =>
      tool(id, "Bash", { command: "fixture-" + i }, "failure"),
    ),
    ["F01", "F02"],
  );
for (let i = 0; i < 5; i++)
  add(
    "cancelled repetition " + i,
    ["a", "b", "c"].flatMap((id) =>
      tool(id, "Bash", { command: "fixture-" + i }, "cancelled"),
    ),
    ["F01"],
  );
for (let i = 0; i < 5; i++)
  add(
    "denial loop " + i,
    ["a", "b", "c"].flatMap((id) =>
      tool(id, "Bash", { command: "fixture-" + i }, "denied"),
    ),
    ["F01", "F08"],
  );
for (let i = 0; i < 5; i++)
  add(
    "unverified source " + i,
    [
      ...tool("edit", "Edit", {
        ...edit,
        file_path: "/fixture/src/file" + i + ".ts",
      }),
      stop,
    ],
    ["F06"],
  );
for (let i = 0; i < 5; i++)
  add(
    "docs only " + i,
    [
      ...tool("edit", "Edit", {
        ...edit,
        file_path: "/fixture/doc" + i + ".md",
      }),
      stop,
    ],
    [],
  );
for (let i = 0; i < 5; i++)
  add(
    "explicit final failing test " + i,
    [
      ...tool("test", "Bash", { command: "node --test" }, "failure"),
      { ...stop, last_assistant_message: "AGENT_EVALS_TASK_COMPLETE" },
    ],
    ["F05"],
    { ...DEFAULT_CONFIG, completionMarker: "AGENT_EVALS_TASK_COMPLETE" },
  );
for (let i = 0; i < 5; i++)
  add(
    "compaction correlation " + i,
    [
      start,
      { hook_event_name: "PreCompact", trigger: "auto" },
      ...tool("read", "Read", { file_path: "/f" + i }),
    ],
    ["F10"],
  );
let matches = 0;
const rows = [];
for (const c of cases) {
  const trace = analyze(events(c.payloads, c.options), c.options);
  const actual = trace.findings.map((f) => f.type).sort();
  const expected = [...c.expected].sort();
  const matched = JSON.stringify(actual) === JSON.stringify(expected);
  if (matched) matches++;
  rows.push({
    id: c.id,
    name: c.name,
    expected_rule_labels: expected,
    observed_rule_labels: actual,
    matched,
    provenance: "synthetic / predeclared rule expectations",
    human_reviewed: false,
    human_labels: null,
    evidence_events: trace.events,
    findings: trace.findings,
  });
}
mkdirSync("docs/evaluation", { recursive: true });
writeFileSync(
  "docs/evaluation/rule-conformance.json",
  JSON.stringify(
    {
      scenarios: cases.length,
      exact_matches: matches,
      human_precision: null,
      human_false_positive_rate: null,
      reason:
        "No human annotations collected. Rule conformance is not accuracy on natural failures.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "docs/evaluation/human-review.csv",
  "id,name,expected_rules,observed_rules,human_reviewed,human_label,reviewer,rationale\n" +
    rows
      .map((r) =>
        [
          r.id,
          r.name,
          r.expected_rule_labels.join("|"),
          r.observed_rule_labels.join("|"),
          "false",
          "",
          "",
          "",
        ]
          .map((x) => '"' + String(x).replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\n") +
    "\n",
);
console.log(
  JSON.stringify({
    scenarios: cases.length,
    exact_matches: matches,
    human_annotations: 0,
  }),
);
if (matches !== cases.length) process.exitCode = 1;
