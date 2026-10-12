import type { CodeBridgeReport, ReportComparison, CriterionResult } from "../core/types.js";
import { compareReports } from "../reports/compare.js";

export const COMMENT_MARKER = "<!-- codebridge-pr-intelligence:v1 -->";
const statusIcon: Record<string, string> = { verified: "✅", partial: "🟡", unverified: "⚪", conflict: "❌" };

function plain(input: unknown, max = 240): string {
  return String(input ?? "").replace(/[\r\n\t]+/g, " ").replace(/\|/g, "\\|").replace(/[<>]/g, "").slice(0, max);
}
function inline(s: unknown, max = 100): string { return `\`${plain(s, max).replace(/`/g, "'")}\``; }
function uniqueSorted(values: string[]): string[] { return [...new Set(values)].sort(); }

/** All values from a report are untrusted (including link-like strings and markup). */
export function renderPrComment(report: CodeBridgeReport, previous?: CodeBridgeReport): string {
  const delta: ReportComparison | undefined = previous ? compareReports(previous, report) : undefined;
  const severity = ["critical", "high", "medium", "low", "info"];
  const highFindings = report.findings.filter(f => ["critical", "high"].includes(f.severity));
  const rows = report.criteria.slice(0, 80).map((c: CriterionResult) =>
    `| ${inline(c.id, 80)} | ${statusIcon[c.status] ?? "?"} ${c.status} | ${plain(c.description, 140)} | ${c.evidence.filter(e => e.status === "pass").length} |`);
  const checks = report.checks.slice(0, 30).map(c => `| ${inline(c.id)} | ${plain(c.status)} | ${c.durationMs}ms |`);
  const result = [
    COMMENT_MARKER,
    "## 🔍 CodeBridge PR Intelligence",
    "",
    `**Decision: ${plain(report.decision.toUpperCase())}** · Commit ${inline(report.commitSha?.slice(0, 12) ?? "unknown")}`,
    `Criteria: **${report.summary.verified} verified**, ${report.summary.partial} partial, ${report.summary.unverified} unverified, ${report.summary.conflict} conflict · Changed files: ${report.summary.changedFiles}`,
    "",
    "### Acceptance criteria", "",
    "| ID | Result | Requirement | Passing evidence |", "|---|---|---|---:|", ...rows,
    ...(report.criteria.length > 80 ? [`_... ${report.criteria.length - 80} more criteria omitted_`] : []),
    "", "### Check results", "", "| Check | Result | Duration |", "|---|---|---:|", ...checks,
    "", "### High-risk findings", ""
  ];
  if (highFindings.length === 0) result.push("No critical or high findings detected by configured heuristic rules.");
  else for (const f of highFindings.slice(0, 20)) result.push(`- **${plain(f.severity.toUpperCase())}** ${inline(f.ruleId)}: ${plain(f.message, 250)}${f.file ? ` (${inline(f.file)})` : ""}`);
  if (highFindings.length > 20) result.push(`_... ${highFindings.length - 20} more high-risk findings omitted_`);
  if (delta) {
    result.push("", "### Change since baseline", "", `Previous decision: **${delta.decisionBefore.toUpperCase()}** → **${delta.decisionAfter.toUpperCase()}**`,
      `- Regressions (${delta.regressedCriteria.length}): ${delta.regressedCriteria.length ? uniqueSorted(delta.regressedCriteria).slice(0, 20).map(v => inline(v)).join(", ") : "none"}`,
      `- Improvements (${delta.improvedCriteria.length}): ${delta.improvedCriteria.length ? uniqueSorted(delta.improvedCriteria).slice(0, 20).map(v => inline(v)).join(", ") : "none"}`,
      `- New findings: ${delta.newFindings.length}; resolved findings: ${delta.resolvedFindingIds.length}`);
  }
  result.push("", `Severity distribution: ${severity.map(k => `${k}=${report.summary.findingsBySeverity[k as keyof typeof report.summary.findingsBySeverity] ?? 0}`).join(" · ")}`,
    "", "_Passing checks and mapped test cases are evidence, not a guarantee that every requirement is semantically correct. Review unverified criteria before merge._", "");
  const joined = result.join("\n");
  return joined.length > 55000 ? joined.slice(0, 54000) + "\n\n_Comment truncated._" : joined;
}

export interface GitHubTransport { (url: string, init: RequestInit): Promise<Response> }
export interface PublishOptions {
  repo: string; pr: number; token: string; report: CodeBridgeReport; previous?: CodeBridgeReport;
  expectedSha?: string; apiBase?: string; transport?: GitHubTransport; dryRun?: boolean;
}
export function validateRepository(value: string): void {
  if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value) || value.split("/").some(x => x === "." || x === ".."))
    throw new Error("Repository harus berbentuk owner/repo");
}
export function validateReportForPr(report: CodeBridgeReport, expectedSha?: string): void {
  if (!["1.2", "1.3"].includes(String(report.schemaVersion)) || !Array.isArray(report.criteria) || !Array.isArray(report.checks) || !Array.isArray(report.findings))
    throw new Error("Report schema tidak didukung");
  if (!report.commitSha || !/^[a-f0-9]{40}$/.test(report.commitSha)) throw new Error("Report tidak memiliki commitSha Git yang valid");
  if (expectedSha && report.commitSha !== expectedSha) throw new Error("Report SHA tidak sesuai dengan commit workflow");
}

/** Idempotent PR comment: search for the marker in bot comments then PATCH, otherwise POST. */
export async function publishPrComment(opts: PublishOptions): Promise<{ action: "created" | "updated" | "dry-run"; url?: string; body: string }> {
  validateRepository(opts.repo);
  if (!Number.isSafeInteger(opts.pr) || opts.pr < 1) throw new Error("Nomor PR tidak valid");
  validateReportForPr(opts.report, opts.expectedSha);
  const body = renderPrComment(opts.report, opts.previous);
  if (opts.dryRun) return { action: "dry-run", body };
  if (!opts.token) throw new Error("GITHUB_TOKEN harus tersedia untuk publish");
  const base = opts.apiBase ?? "https://api.github.com";
  // Never allow external caller to redirect credentials to an arbitrary host.
  if (base !== "https://api.github.com" && !opts.transport) throw new Error("Custom API base hanya diizinkan dengan transport eksplisit");
  const transport = opts.transport ?? fetch;
  const headers = { Authorization: `Bearer ${opts.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
  const endpoint = `${base}/repos/${opts.repo}`;
  const api = async (url: string, method = "GET", payload?: unknown): Promise<any> => {
    const response = await transport(url, { method, headers, redirect: "error", body: payload ? JSON.stringify(payload) : undefined });
    const raw = await response.text();
    if (!response.ok) throw new Error(`GitHub API ${response.status} (${method} ${new URL(url).pathname}): ${raw.slice(0, 400).replace(/Bearer\s+\S+/g, "[redacted]")}`);
    try { return JSON.parse(raw); } catch { throw new Error("Respons JSON GitHub API tidak valid"); }
  };
  // Fetch PR details server-side to prevent publishing a report from a different SHA.
  const prInfo = await api(`${endpoint}/pulls/${opts.pr}`);
  if (prInfo?.head?.sha !== opts.report.commitSha) throw new Error("Head commit PR berbeda dari report (stale artifact)");
  const viewer = await api(`${base}/user`);
  const login = viewer?.login;
  if (typeof login !== "string" || !login) throw new Error("Tidak dapat mengidentifikasi akun GitHub bot");
  let existingId: number | undefined;
  for (let page = 1; page <= 5; page++) {
    const list = await api(`${endpoint}/issues/${opts.pr}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(list)) throw new Error("Respons daftar komentar tidak valid");
    const match = list.find(c => c?.user?.login === login && typeof c?.body === "string" && c.body.includes(COMMENT_MARKER));
    if (match && Number.isSafeInteger(match.id)) { existingId = match.id; break; }
    if (list.length < 100) break;
  }
  if (existingId !== undefined) {
    const updated = await api(`${endpoint}/issues/comments/${existingId}`, "PATCH", { body });
    return { action: "updated", url: updated?.html_url, body };
  }
  const created = await api(`${endpoint}/issues/${opts.pr}/comments`, "POST", { body });
  return { action: "created", url: created?.html_url, body };
}
