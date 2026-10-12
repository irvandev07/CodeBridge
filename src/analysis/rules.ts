import path from "node:path";
import type { Finding } from "../core/types.js";
import type { GitChanges } from "../git/diff.js";
import type { RuleConfig } from "../core/config.js";

/** Minimal basename/glob support: * matches within path component; ** matches across directories. */
function matchesGlob(file: string, glob: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  const escaped = glob.replace(/\\/g, "/").replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  const regex = new RegExp(`^${escaped}$`, "i");
  return regex.test(normalized) || (!glob.includes("/") && regex.test(path.posix.basename(normalized)));
}
export function runRules(changes: GitChanges, config: RuleConfig): Finding[] {
  if (!config.enabled) return [];
  const findings: Finding[] = [];
  let next = 1;
  const add = (ruleId: string, title: string, message: string, severity: Finding["severity"], file?: string, line?: number) => {
    findings.push({ id: `F-${String(next++).padStart(4, "0")}`, ruleId, title, message, severity, source: "deterministic", file, line });
  };
  const activeFiles = changes.files.filter(f => f.status !== "deleted");
  if (changes.files.length > config.maxChangedFiles) add("change-size", "Too many changed files", `${changes.files.length} files exceed the configured limit (${config.maxChangedFiles}).`, "medium");
  const sum = changes.files.reduce((acc, f) => acc + f.additions, 0);
  if (sum > config.maxAddedLines) add("added-lines", "Large patch", `${sum} added lines exceed the configured limit (${config.maxAddedLines}).`, "medium");
  for (const file of activeFiles) {
    const matched = config.forbiddenPaths.find(pattern => matchesGlob(file.path, pattern));
    if (matched) add("forbidden-path", "Sensitive file included in change", `File matches restricted pattern '${matched}'`, "high", file.path);
  }
  const seen = new Set<string>();
  for (const added of changes.addedLines) {
    // Never include matched source content, values, or snippets in findings.
    const ruleMatches: Array<{ ruleId: string; title: string; message: string; severity: Finding["severity"] }> = [];
    if (config.detectPrivateKeys && /-----BEGIN\s+(?:(?:RSA|EC|OPENSSH|DSA)\s+)?PRIVATE KEY-----/.test(added.content)) {
      ruleMatches.push({ ruleId: "private-key", title: "Private key marker added", message: "Potential private key material found in added line; inspect this change and rotate credentials if real.", severity: "critical" });
    }
    if (config.detectCredentials && /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key|password)\b\s*[:=]\s*["']?[A-Za-z0-9_\/+=.-]{12,}/i.test(added.content) && !/\b(?:process\.env|import\.meta\.env|\$\{|\*{3,}|<.*?>|example|placeholder|your[_-])/.test(added.content)) {
      ruleMatches.push({ ruleId: "credential-assignment", title: "Possible hard-coded credential", message: "Credential-like assignment in a new line. Review manually; scanner uses heuristics and can produce false positives.", severity: "high" });
    }
    if (config.detectDebugStatements && /\b(?:console\.log|debugger)\s*(?:\(|;|$)/.test(added.content)) {
      ruleMatches.push({ ruleId: "debug-statement", title: "Debug statement added", message: "Potential debug instrumentation added.", severity: "low" });
    }
    for (const match of ruleMatches) {
      const key = `${match.ruleId}\0${added.file}\0${added.line}`;
      if (!seen.has(key) && findings.length < 1000) {
        seen.add(key); add(match.ruleId, match.title, match.message, match.severity, added.file, added.line);
      }
    }
  }
  return findings;
}
