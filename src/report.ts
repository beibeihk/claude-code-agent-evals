import { SessionTrace } from "./model.js";
export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function markdown(trace: SessionTrace): string {
  const rows = Object.entries(trace.metrics)
    .map(
      ([name, value]) => "| " + name + " | " + (value ?? "unavailable") + " |",
    )
    .join("\n");
  const findings =
    trace.findings
      .map(
        (f) =>
          `- **${f.id} (${f.severity})**: ${f.message} Events: ${f.event_seqs.join(", ")}.`,
      )
      .join("\n") ||
    "No configured rule fired. This does not establish task success.";
  return `# Claude Code Reliability Report\n\nSession: \`${trace.session.id}\`\n\nEvidence scope: observed public hooks. Final task outcome: **unknown**.\n\n## Overview\n\n| Metric | Value |\n|---|---:|\n${rows}\n\n## Findings\n\n${findings}\n\n## Verification\n\n${trace.verification.map((v) => `- Event ${v.event_seq}: ${v.kind} / ${v.outcome}`).join("\n") || "No recognized foreground verification observed."}\n\n## Limitations\n\n${trace.limitations.map((v) => "- " + v).join("\n")}\n`;
}
export function html(trace: SessionTrace): string {
  const esc = escapeHtml;
  const table = (headers: string[], rows: unknown[][]) =>
    `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v ?? "unavailable")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>Agent Evals — Reliability Evidence</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{font:15px/1.6 system-ui,sans-serif;background:#101821;color:#dce6ef;max-width:1180px;margin:0 auto;padding:36px}h1{font-size:34px;letter-spacing:-1px}h2{color:#7dd5c0;margin-top:38px}p{max-width:85ch}.badge{border:1px solid #456575;padding:5px 12px;border-radius:4px;color:#98dbca}table{width:100%;border-collapse:collapse;margin:14px 0;font-variant-numeric:tabular-nums}th{text-align:left;color:#8eaac0}td,th{padding:9px;border-bottom:1px solid #293a48;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#152330;padding:16px;border-radius:6px}.finding{border-left:3px solid #eabf74;background:#182735;padding:16px;margin:12px 0}.muted{color:#99acbb}code{font-size:13px}footer{margin-top:40px;border-top:1px solid #293a48;padding-top:20px}</style></head><body>
  <span class="badge">COMMUNITY PLUGIN · LOCAL EVIDENCE</span><h1>Claude Code Reliability Report</h1><p class="muted">Session ${esc(trace.session.id)} · ${esc(trace.session.first_observed)} → ${esc(trace.session.last_observed)}</p><p>Final task outcome: <strong>unknown</strong>. Rules describe observed behavior; absence of findings is not proof of success.</p>
  <h2>Overview</h2>${table(["Metric", "Value"], Object.entries(trace.metrics))}
  <h2>Findings</h2>${trace.findings.map((f) => `<article class="finding"><strong>${esc(f.id)} · ${esc(f.severity)}</strong><p>${esc(f.message)}</p><p>Evidence events: ${esc(f.event_seqs.join(", "))}</p><pre>${esc(JSON.stringify(f.evidence, null, 2))}</pre></article>`).join("") || "<p>No configured rule fired.</p>"}
  <h2>Timeline</h2>${table(
    ["Seq", "Receipt time", "Hook", "Tool", "Outcome"],
    trace.events.map((e) => [
      e.seq,
      e.timestamp,
      e.source_hook,
      e.tool_name,
      e.outcome,
    ]),
  )}
  <h2>Tools</h2>${table(
    ["Call", "Result", "Tool", "Outcome", "Duration (ms)", "Duration source"],
    trace.tool_calls.map((c) => [
      c.call_seq,
      c.result_seq,
      c.tool_name,
      c.outcome,
      c.duration_ms,
      c.duration_source,
    ]),
  )}
  <h2>Verification</h2>${table(
    ["Event", "Kind", "Outcome"],
    trace.verification.map((v) => [v.event_seq, v.kind, v.outcome]),
  )}
  <h2>Workspace diff metrics</h2><pre>${esc(JSON.stringify(trace.workspace_diff ?? { available: false, reason: "Use CLI report --git to take a current workspace snapshot. No agent attribution." }, null, 2))}</pre>
  <h2>Subagents and compaction</h2>${table(
    ["Event", "Hook", "Agent (hashed)"],
    trace.events
      .filter(
        (e) => e.event_type === "subagent" || e.event_type === "compaction",
      )
      .map((e) => [e.seq, e.source_hook, e.agent_id]),
  )}
  <h2>Limitations</h2><ul>${trace.limitations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><footer>No scripts, remote assets, uploads, or hidden reasoning. Schema ${esc(trace.schema_version)}. All findings are deterministic; LLM interpretation is optional and separate.</footer></body></html>`;
}
export function evalCase(trace: SessionTrace): Record<string, unknown> {
  return {
    schema_version: trace.schema_version,
    kind: "observable_agent_eval_case",
    task: {
      session_id: trace.session.id,
      workspace_id: trace.session.workspace_id,
      description: "Not captured in metadata-only mode",
    },
    events: trace.events,
    findings: trace.findings,
    metrics: trace.metrics,
    verification: trace.verification,
    workspace_diff: trace.workspace_diff ?? null,
    final_outcome: {
      status: "unknown",
      reason: "Public hook boundaries do not prove task completion",
    },
    annotation: { human_labels: [], reviewed_by: null },
    limitations: trace.limitations,
  };
}
