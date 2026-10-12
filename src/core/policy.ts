import type { CheckResult, CriterionResult, Decision, Finding } from "./types.js";
export function determineDecision(criteria: CriterionResult[], checks: CheckResult[], requiredChecks: string[], findings: Finding[], failOn: string[]): Decision {
  if (checks.some(check => requiredChecks.includes(check.id) && check.status !== "passed")) return "fail";
  if (findings.some(finding => failOn.includes(finding.severity))) return "fail";
  if (criteria.some(criterion => criterion.status === "conflict")) return "fail";
  if (criteria.some(criterion => criterion.status !== "verified") || checks.some(check => check.status !== "passed")) return "review";
  return "pass";
}
export function exitCode(decision: Decision, strictReview: boolean): number {
  return decision === "fail" || (strictReview && decision === "review") ? 1 : 0;
}
