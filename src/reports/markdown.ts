import type { CodeBridgeReport } from "../core/types.js";
const cell = (v: string): string => v.replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
const fence = (v: string): string => "`".repeat(Math.max(3, ...Array.from(v.matchAll(/`+/g), m => m[0].length + 1)));

export function renderMarkdown(report: CodeBridgeReport): string {
  const s: string[] = [
    "# CodeBridge – Intent Verification", "",
    `**Decision:** ${report.decision.toUpperCase()}  `,
    `**Repository:** ${report.repository}  `,
    `**Base ref:** ${report.baseRef}  `,
    `**Generated:** ${report.generatedAt}`, "",
    "## Summary", "",
    `- Criteria: ${report.summary.totalCriteria} (${report.summary.verified} verified, ${report.summary.partial} partial, ${report.summary.unverified} unverified, ${report.summary.conflict} conflict)`,
    `- Changed files: ${report.summary.changedFiles}`,
    `- Added / deleted lines: +${report.summary.addedLines} / -${report.summary.deletedLines}`,
    `- Findings: ${report.findings.length}`, "",
    "## Acceptance criteria", "",
    "| ID | Description | Status | Explanation |", "|---|---|---|---|",
    ...report.criteria.map(c => `| ${c.id} | ${cell(c.description)} | ${c.status} | ${cell(c.explanation)} |`), "",
    "## Evidence", ""
  ];
  for (const c of report.criteria) {
    s.push(`### ${c.id}`, "");
    if (!c.evidence.length) s.push("- No explicit evidence mapped.");
    for (const e of c.evidence) s.push(`- **${e.status}** [${e.kind}]: ${e.description}${e.file ? ` — \`${e.file}\`` : ""}`);
    s.push("");
  }
  s.push("## Deterministic findings", "");
  if (!report.findings.length) s.push("No findings.");
  for (const f of report.findings) s.push(`- **${f.severity.toUpperCase()}** ${f.ruleId}: ${f.message}${f.file ? ` (\`${f.file}\`${f.line ? `:${f.line}` : ""})` : ""}`);
  s.push("", "## Checks", "", "| Check | Status | Duration (ms) |", "|---|---|---:|",
    ...report.checks.map(c => `| ${c.id} | ${c.status} | ${c.durationMs} |`), "", "## Change inventory", "",
    "| File | Status | Added | Deleted |", "|---|---|---:|---:|",
    ...report.changeDetails.map(f => `| ${cell(f.path)} | ${f.status} | ${f.additions} | ${f.deletions} |`),
    "", "## Check output", "");
  for (const c of report.checks) {
    s.push(`### ${c.id}`, "");
    if (c.errorMessage) s.push(`Error: ${c.errorMessage}`, "");
    if (c.output.trim()) { const f = fence(c.output); s.push(`${f}text`, c.output.trim(), f, ""); }
    else s.push("(no output)", "");
  }
  s.push("---", "", "**Verification caveat:** passing linked checks indicates explicit evidence, not proof of complete functional correctness. Rule findings are heuristic; review them before acting.", "");
  return s.join("\n");
}
