import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig } from "./config.js";
import { getGitChanges } from "../git/diff.js";
import { runChecks } from "../checks/scheduler.js";
import { loadCriteria } from "../intent/parser.js";
import { loadEvidenceManifest, mapEvidence } from "../intent/evidence.js";
import { discoverTapTests } from "../discovery/tap.js";
import { buildEvidenceGraph } from "../intent/evidence-graph.js";
import { runRules } from "../analysis/rules.js";
import { determineDecision } from "./policy.js";
import { renderJson } from "../reports/json.js";
import { renderMarkdown } from "../reports/markdown.js";
import { renderHtml } from "../reports/html.js";
import { renderSarif } from "../reports/sarif.js";
import { resolveInside, ensureInsideReal } from "../utils/paths.js";
import type { CodeBridgeReport, Severity } from "./types.js";

export type ReportFormat = "markdown" | "json" | "html" | "sarif" | "all" | "both";
export interface RunOptions { cwd: string; base?: string; format?: ReportFormat; out?: string; }
export async function runCodeBridge(options: RunOptions): Promise<{ report: CodeBridgeReport; outputDirectory: string }> {
  const cwd = path.resolve(options.cwd);
  const config = await loadConfig(cwd, options.base);
  const outputDirectory = resolveInside(cwd, options.out ?? config.outputDirectory);
  await ensureInsideReal(cwd, outputDirectory);
  const [criteria, manifest, gitChanges] = await Promise.all([
    loadCriteria(cwd, config.goalFile), loadEvidenceManifest(cwd, config.evidenceFile), getGitChanges(cwd, config.baseRef)
  ]);
  // Prevent previously generated reports from appearing as fresh untracked changes.
  const outputRel = path.relative(cwd, outputDirectory).split(path.sep).join("/");
  const ignored = (file: string): boolean => outputRel !== "" && (file === outputRel || file.startsWith(outputRel + "/"));
  const changes = { files: gitChanges.files.filter(f => !ignored(f.path)), addedLines: gitChanges.addedLines.filter(l => !ignored(l.file)) };
  const checks = await runChecks(config.commands, cwd, config.timeoutMs, config.maxConcurrency);
  const testCases = discoverTapTests(checks);
  const resultCriteria = mapEvidence(criteria, manifest, checks, changes.files.map(f => f.path), testCases);
  const evidenceGraph = buildEvidenceGraph(resultCriteria, checks, testCases, changes.files.map(f => f.path));
  const findings = runRules(changes, config.rules);
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;
  const report: CodeBridgeReport = {
    schemaVersion: "1.3", toolVersion: "0.5.0", generatedAt: new Date().toISOString(),
    repository: path.basename(cwd), baseRef: config.baseRef,
    commitSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", timeout: 10000 }).trim(),
    changedFiles: changes.files.map(f => f.path), changeDetails: changes.files,
    criteria: resultCriteria, checks, testCases, evidenceGraph, findings,
    decision: determineDecision(resultCriteria, checks, config.requiredChecks, findings, config.failOn),
    summary: {
      totalCriteria: resultCriteria.length,
      verified: resultCriteria.filter(c => c.status === "verified").length,
      partial: resultCriteria.filter(c => c.status === "partial").length,
      unverified: resultCriteria.filter(c => c.status === "unverified").length,
      conflict: resultCriteria.filter(c => c.status === "conflict").length,
      changedFiles: changes.files.length,
      addedLines: changes.files.reduce((n, f) => n + f.additions, 0),
      deletedLines: changes.files.reduce((n, f) => n + f.deletions, 0),
      findingsBySeverity: counts
    }
  };
  await mkdir(outputDirectory, { recursive: true });
  const format = options.format ?? "all";
  const files: Record<string, () => string> = {
    "report.md": () => renderMarkdown(report), "report.json": () => renderJson(report),
    "report.html": () => renderHtml(report), "report.sarif": () => renderSarif(report)
  };
  for (const [name, generate] of Object.entries(files)) {
    const selected = format === "all" || (format === "both" && ["report.md", "report.json"].includes(name)) ||
      (format === "markdown" && name === "report.md") || (format === "json" && name === "report.json") ||
      (format === "html" && name === "report.html") || (format === "sarif" && name === "report.sarif");
    if (selected) {
      const file = path.join(outputDirectory, name);
      await ensureInsideReal(cwd, file);
      await writeFile(file, generate(), { encoding: "utf8", flag: "w", mode: 0o600 });
    }
  }
  return { report, outputDirectory };
}
