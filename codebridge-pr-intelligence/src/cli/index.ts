#!/usr/bin/env node
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { runCodeBridge, type ReportFormat } from "../core/orchestrator.js";
import { loadConfig } from "../core/config.js";
import { getGitChanges } from "../git/diff.js";
import { loadCriteria } from "../intent/parser.js";
import { loadEvidenceManifest, validateEvidenceReferences } from "../intent/evidence.js";
import { exitCode } from "../core/policy.js";
import { loadReport, compareReports } from "../reports/compare.js";
import { resolveInside, ensureInsideReal } from "../utils/paths.js";
import { renderPrComment, publishPrComment } from "../github/pr.js";

const HELP = `CodeBridge Pro Beta v0.5

Usage:
  codebridge init [--force]
  codebridge doctor [--base <ref>]
  codebridge check [--base <ref>] [--format all|both|json|markdown|html|sarif] [--out <dir>] [--strict] [--verbose]
  codebridge explain <AC-ID> [--report <path>]
  codebridge compare <baseline.json> <current.json>
  codebridge pr-summary [--report <report.json>] [--baseline <previous.json>]
  codebridge pr-comment --repo <owner/repo> --pr <number> [--report <path>] [--baseline <path>] [--expected-sha <gitsha>] [--dry-run]
  codebridge --help | --version

Exit: 0=pass/review, 1=fail (or strict review), 2=usage/config/runtime error`;

function parseArgs(args: string[], allowedFlags: string[], valueFlags: string[]): { positional: string[]; options: Record<string, string | boolean> } {
  const positional: string[] = [], options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const item = args[i];
    if (valueFlags.includes(item)) {
      if (item in options) throw new Error(`Option duplikat: ${item}`);
      const v = args[++i];
      if (!v || v.startsWith("--")) throw new Error(`Nilai ${item} tidak tersedia`);
      options[item] = v;
    } else if (allowedFlags.includes(item)) options[item] = true;
    else if (item.startsWith("-")) throw new Error(`Option tidak dikenal: ${item}`);
    else positional.push(item);
  }
  return { positional, options };
}

async function init(force: boolean): Promise<void> {
  const examples: Record<string, string> = {
    "goal.md": "# Feature\nDeskripsi perubahan\n\n## Acceptance Criteria\n- [AC-MAIN] Pengguna dapat menjalankan alur utama.\n- [AC-INPUT] Input invalid ditangani.\n- [AC-REGRESSION] Alur lama tetap berjalan.\n",
    "codebridge.config.json": JSON.stringify({
      baseRef: "main", goalFile: "goal.md", evidenceFile: "codebridge.evidence.json",
      commands: { typecheck: ["npm", "run", "typecheck"], test: ["npm", "run", "test:run"] },
      requiredChecks: ["typecheck", "test"], failOn: ["critical", "high"], timeoutMs: 120000,
      maxConcurrency: 2, strictReview: false, outputDirectory: ".codebridge",
      rules: { enabled: true, maxChangedFiles: 50, maxAddedLines: 1500, forbiddenPaths: [".env", ".env.*", "*.pem", "*.key"], detectCredentials: true, detectPrivateKeys: true, detectDebugStatements: false }
    }, null, 2) + "\n",
    "codebridge.evidence.json": JSON.stringify({ version: 2, criteria: { "AC-MAIN": { checks: [], files: [], tests: [], note: "Tambahkan check spesifik untuk memverifikasi kriteria." } } }, null, 2) + "\n"
  };
  for (const [name, contents] of Object.entries(examples)) {
    try {
      await writeFile(path.join(process.cwd(), name), contents, { encoding: "utf8", flag: force ? "w" : "wx" });
      console.log(`Created ${name}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") console.log(`Skip ${name} (already exists)`);
      else throw error;
    }
  }
  console.log("Next: edit goal.md, config, and evidence mapping; then run 'codebridge doctor' and 'codebridge check'.");
}
async function doctor(base?: string): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd, base);
  const [criteria, manifest, git] = await Promise.all([
    loadCriteria(cwd, config.goalFile), loadEvidenceManifest(cwd, config.evidenceFile), getGitChanges(cwd, config.baseRef)
  ]);
  const warnings = validateEvidenceReferences(criteria, manifest, Object.keys(config.commands));
  console.log(`CodeBridge doctor: config valid, ${criteria.length} criteria, ${Object.keys(config.commands).length} checks, ${git.files.length} changed files`);
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (warnings.length > 0) process.exitCode = 1;
}
async function explain(criterionId: string, reportFile: string): Promise<void> {
  const cwd = process.cwd();
  const reportPath = resolveInside(cwd, reportFile);
  await ensureInsideReal(cwd, reportPath);
  const report = await loadReport(reportPath);
  const criterion = report.criteria.find(c => c.id === criterionId);
  if (!criterion) throw new Error(`Kriteria '${criterionId}' tidak ditemukan pada report`);
  console.log(`${criterion.id}: ${criterion.description}\nStatus: ${criterion.status}\nExplanation: ${criterion.explanation}`);
  for (const item of criterion.evidence) console.log(`  - ${item.kind}/${item.status}: ${item.description}`);
}
async function compare(baseFile: string, currentFile: string): Promise<void> {
  const [before, after] = await Promise.all([loadReport(baseFile), loadReport(currentFile)]);
  const diff = compareReports(before, after, baseFile, currentFile);
  console.log(`${diff.decisionBefore.toUpperCase()} → ${diff.decisionAfter.toUpperCase()}`);
  console.log(`Regressed criteria (${diff.regressedCriteria.length}): ${diff.regressedCriteria.join(", ") || "none"}`);
  console.log(`Improved criteria (${diff.improvedCriteria.length}): ${diff.improvedCriteria.join(", ") || "none"}`);
  console.log(`New findings: ${diff.newFindings.length}; resolved findings: ${diff.resolvedFindingIds.length}`);
  if (diff.regressedCriteria.length > 0 || diff.newFindings.some(f => f.severity === "high" || f.severity === "critical")) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || ["help", "--help", "-h"].includes(command)) { console.log(HELP); return; }
  if (["--version", "-V"].includes(command)) { console.log("0.5.0"); return; }
  if (command === "init") {
    const parsed = parseArgs(args, ["--force"], []);
    if (parsed.positional.length) throw new Error("init tidak menerima positional arguments");
    return init(!!parsed.options["--force"]);
  }
  if (command === "doctor") {
    const parsed = parseArgs(args, [], ["--base"]);
    if (parsed.positional.length) throw new Error("doctor tidak menerima positional arguments");
    return doctor(parsed.options["--base"] as string | undefined);
  }
  if (command === "explain") {
    const parsed = parseArgs(args, [], ["--report"]);
    if (parsed.positional.length !== 1) throw new Error("Usage: explain <AC-ID> [--report <path>]");
    return explain(parsed.positional[0], (parsed.options["--report"] as string | undefined) ?? ".codebridge/report.json");
  }
  if (command === "compare") {
    const parsed = parseArgs(args, [], []);
    if (parsed.positional.length !== 2) throw new Error("Usage: compare <baseline.json> <current.json>");
    return compare(parsed.positional[0], parsed.positional[1]);
  }
  if (command === "pr-summary" || command === "pr-comment") {
    const parsed = parseArgs(args, ["--dry-run"], ["--repo", "--pr", "--report", "--baseline", "--expected-sha"]);
    if (parsed.positional.length) throw new Error("Argumen positional tidak diizinkan");
    const reportFile = (parsed.options["--report"] as string | undefined) ?? ".codebridge/report.json";
    const report = await loadReport(reportFile);
    const baseline = parsed.options["--baseline"] ? await loadReport(parsed.options["--baseline"] as string) : undefined;
    if (command === "pr-summary") { console.log(renderPrComment(report, baseline)); return; }
    const repo = parsed.options["--repo"] as string | undefined ?? process.env.GITHUB_REPOSITORY;
    const pr = Number(parsed.options["--pr"]);
    if (!repo || !parsed.options["--pr"]) throw new Error("--repo dan --pr diperlukan (repo dapat dari GITHUB_REPOSITORY)");
    const published = await publishPrComment({ repo, pr, report, previous: baseline,
      expectedSha: parsed.options["--expected-sha"] as string | undefined,
      token: process.env.GITHUB_TOKEN ?? "", dryRun: !!parsed.options["--dry-run"] });
    console.log(`PR comment: ${published.action}${published.url ? ` — ${published.url}` : ""}`);
    if (published.action === "dry-run") console.log(published.body);
    return;
  }
  if (command === "check") {
    const parsed = parseArgs(args, ["--strict", "--verbose", "--no-ai"], ["--base", "--format", "--out"]);
    if (parsed.positional.length) throw new Error(`Unexpected argument: ${parsed.positional.join(" ")}`);
    const format = (parsed.options["--format"] ?? "all") as ReportFormat;
    if (!["all", "both", "markdown", "json", "html", "sarif"].includes(format)) throw new Error(`Format tidak valid: ${format}`);
    const { report, outputDirectory } = await runCodeBridge({ cwd: process.cwd(), base: parsed.options["--base"] as string | undefined, format, out: parsed.options["--out"] as string | undefined });
    console.log(`CodeBridge: ${report.decision.toUpperCase()}`);
    console.log(`Criteria: ${report.summary.verified} verified, ${report.summary.partial} partial, ${report.summary.unverified} unverified, ${report.summary.conflict} conflict`);
    console.log(`Changed files: ${report.summary.changedFiles} | Discovered TAP tests: ${report.testCases?.length ?? 0} | Findings: ${report.findings.length}`);
    for (const check of report.checks) {
      console.log(`  ${check.id}: ${check.status}${check.errorMessage ? ` — ${check.errorMessage}` : ""}`);
      if (parsed.options["--verbose"] && check.output) console.log(check.output);
    }
    console.log(`Reports: ${outputDirectory}`);
    const config = await loadConfig(process.cwd(), parsed.options["--base"] as string | undefined);
    process.exitCode = exitCode(report.decision, !!parsed.options["--strict"] || config.strictReview);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
main().catch((error: unknown) => { console.error(`CodeBridge error: ${(error as Error).message}`); process.exitCode = 2; });
