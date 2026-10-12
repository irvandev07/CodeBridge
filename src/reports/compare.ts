import { readFile } from "node:fs/promises";
import type { CodeBridgeReport, CriterionResult, Finding, ReportComparison, Decision } from "../core/types.js";
const rank = (status: CriterionResult["status"]): number => ({ conflict: 0, unverified: 1, partial: 2, verified: 3 })[status];
function valid(v: unknown): v is CodeBridgeReport {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<CodeBridgeReport>;
  return (["1.0", "1.1", "1.2", "1.3"] as string[]).includes(String(r.schemaVersion)) && ["pass", "review", "fail"].includes(r.decision ?? "") && Array.isArray(r.criteria) && Array.isArray(r.findings);
}
export async function loadReport(filename: string): Promise<CodeBridgeReport> {
  const parsed: unknown = JSON.parse(await readFile(filename, "utf8"));
  if (!valid(parsed)) throw new Error(`File report tidak valid: ${filename}`);
  return parsed;
}
export function compareReports(baseline: CodeBridgeReport, current: CodeBridgeReport, baselineName = "baseline", currentName = "current"): ReportComparison {
  const beforeCriteria = new Map(baseline.criteria.map(c => [c.id, c.status]));
  const regressions: string[] = [], improvements: string[] = [];
  for (const c of current.criteria) {
    const previous = beforeCriteria.get(c.id);
    if (previous === undefined) continue;
    if (rank(c.status) < rank(previous)) regressions.push(`${c.id}: ${previous} -> ${c.status}`);
    if (rank(c.status) > rank(previous)) improvements.push(`${c.id}: ${previous} -> ${c.status}`);
  }
  const identity = (f: Finding) => `${f.ruleId}\0${f.file ?? ""}\0${f.line ?? ""}`;
  const before = new Set(baseline.findings.map(identity));
  const after = new Set(current.findings.map(identity));
  return { baseline: baselineName, current: currentName, decisionBefore: baseline.decision as Decision, decisionAfter: current.decision as Decision,
    regressedCriteria: regressions, improvedCriteria: improvements,
    newFindings: current.findings.filter(f => !before.has(identity(f))),
    resolvedFindingIds: baseline.findings.filter(f => !after.has(identity(f))).map(f => f.id) };
}
