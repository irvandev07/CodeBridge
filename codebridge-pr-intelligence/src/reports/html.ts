import type { CodeBridgeReport } from "../core/types.js";
function e(input: unknown): string { return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
export function renderHtml(report: CodeBridgeReport): string {
  const status = (v: string) => `<span class="pill ${e(v)}">${e(v)}</span>`;
  const t = (values: unknown[]) => values.map(x => `<td>${e(x)}</td>`).join("");
  const criteria = report.criteria.map(c => `<tr><td>${e(c.id)}</td><td>${e(c.description)}</td><td>${status(c.status)}</td><td>${e(c.explanation)}</td></tr>`).join("\n");
  const checks = report.checks.map(c => `<tr>${t([c.id])}<td>${status(c.status)}</td>${t([c.durationMs, c.errorMessage ?? "—"])}</tr>`).join("\n");
  const findings = report.findings.map(f => `<tr><td>${status(f.severity)}</td>${t([f.ruleId, f.title, f.message, f.file ?? "—", f.line ?? "—"])}</tr>`).join("\n");
  const inventory = report.changeDetails.map(f => `<tr>${t([f.path, f.status, f.additions, f.deletions])}</tr>`).join("\n");
  const evidence = report.criteria.map(c => `<section><h3>${e(c.id)} — ${e(c.description)}</h3><ul>${c.evidence.length ? c.evidence.map(v => `<li>${status(v.status)} ${e(v.kind)}: ${e(v.description)}</li>`).join("") : "<li>No evidence mapped</li>"}</ul></section>`).join("\n");
  const graph = report.evidenceGraph;
  const graphTable = (graph?.edges ?? []).map(v => `<tr>${t([v.from, v.relation, v.to])}</tr>`).join("\n");
  const testsTable = (report.testCases ?? []).map(v => `<tr>${t([v.checkId, v.name])}<td>${status(v.status)}</td></tr>`).join("\n");
  const output = report.checks.map(c => `<details><summary>${e(c.id)} ${status(c.status)}</summary><pre>${e(c.output || c.errorMessage || "No output")}</pre></details>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>CodeBridge — ${e(report.repository)}</title><style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif}body{margin:0;background:#0b1326;color:#e6edf9}header{padding:48px 5%;background:linear-gradient(120deg,#172e53,#111827)}main{width:min(1200px,90%);margin:32px auto 70px}h1{font-size:36px;margin:0 0 10px}h2{margin:36px 0 14px}small{color:#aab8d4}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:24px}.stat,section,details{border:1px solid #334155;border-radius:12px;padding:18px;background:#162238}.stat strong{display:block;font-size:28px}.table{overflow:auto;border:1px solid #334155;border-radius:12px}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:11px 15px;border-bottom:1px solid #334155;vertical-align:top}th{background:#1a2c47}.pill{font-size:12px;font-weight:700;display:inline-block;padding:3px 9px;border-radius:999px;background:#334155;color:#eef2ff}.verified,.passed,.pass{background:#115e40;color:#c5f5dd}.partial,.review,.medium,.low{background:#5c450b;color:#fff1b3}.fail,.failed,.conflict,.critical,.high,.error{background:#692e3a;color:#ffd5d8}section,details{margin-bottom:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}footer{margin-top:44px;color:#aab8d4}
</style></head><body><header><h1>CodeBridge <span class="pill ${e(report.decision)}">${e(report.decision.toUpperCase())}</span></h1><small>${e(report.repository)} · base: ${e(report.baseRef)} · ${e(report.generatedAt)}</small>
<div class="stats"><div class="stat"><strong>${report.summary.totalCriteria}</strong>Criteria</div><div class="stat"><strong>${report.summary.verified}</strong>Verified</div><div class="stat"><strong>${report.summary.unverified}</strong>Unverified</div><div class="stat"><strong>${report.summary.changedFiles}</strong>Changed files</div><div class="stat"><strong>${report.findings.length}</strong>Findings</div></div></header><main>
<h2>Acceptance criteria</h2><div class="table"><table><thead><tr><th>ID</th><th>Criterion</th><th>Status</th><th>Explanation</th></tr></thead><tbody>${criteria}</tbody></table></div>
<h2>Evidence map</h2>${evidence}
<h2>Discovered TAP test cases</h2><div class="table"><table><thead><tr><th>Check</th><th>Exact name</th><th>Result</th></tr></thead><tbody>${testsTable || '<tr><td colspan="3">No TAP cases discovered</td></tr>'}</tbody></table></div>
<h2>Traceable evidence graph</h2><p>${graph?.nodes.length ?? 0} nodes, ${graph?.edges.length ?? 0} edges</p><div class="table"><table><thead><tr><th>From</th><th>Relationship</th><th>To</th></tr></thead><tbody>${graphTable || '<tr><td colspan="3">No evidence links</td></tr>'}</tbody></table></div>
<h2>Findings</h2><div class="table"><table><thead><tr><th>Severity</th><th>Rule</th><th>Title</th><th>Description</th><th>File</th><th>Line</th></tr></thead><tbody>${findings || '<tr><td colspan="6">No findings</td></tr>'}</tbody></table></div>
<h2>Checks</h2><div class="table"><table><thead><tr><th>Check</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead><tbody>${checks}</tbody></table></div>
<h2>Change inventory</h2><div class="table"><table><thead><tr><th>File</th><th>Status</th><th>Added</th><th>Deleted</th></tr></thead><tbody>${inventory}</tbody></table></div>
<h2>Check logs</h2>${output}<footer>Conservative evidence model: linked tests passing does not guarantee complete requirements coverage. No external resources or client-side JavaScript.</footer></main></body></html>\n`;
}
