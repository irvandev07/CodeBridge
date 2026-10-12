export type VerificationStatus = "verified" | "partial" | "unverified" | "conflict";
export type CheckStatus = "passed" | "failed" | "error" | "skipped";
export type Decision = "pass" | "review" | "fail";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface AcceptanceCriterion {
  id: string;
  description: string;
}

export interface Evidence {
  id: string;
  criterionId: string;
  kind: "test" | "static" | "manual";
  status: "pass" | "fail" | "unknown";
  description: string;
  checkId?: string;
  file?: string;
}

export interface CriterionResult extends AcceptanceCriterion {
  status: VerificationStatus;
  evidence: Evidence[];
  explanation: string;
}

export interface CheckResult {
  id: string;
  status: CheckStatus;
  durationMs: number;
  exitCode?: number | null;
  output: string;
  errorMessage?: string;
}

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "renamed" | "copied" | "deleted" | "untracked";
  additions: number;
  deletions: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: Severity;
  source: "deterministic";
  file?: string;
  line?: number;
}

export interface CodeBridgeReport {
  schemaVersion: "1.1";
  toolVersion: "0.2.0";
  generatedAt: string;
  repository: string;
  baseRef: string;
  changedFiles: string[];
  changeDetails: ChangedFile[];
  criteria: CriterionResult[];
  checks: CheckResult[];
  findings: Finding[];
  decision: Decision;
  summary: {
    totalCriteria: number;
    verified: number;
    partial: number;
    unverified: number;
    conflict: number;
    changedFiles: number;
    addedLines: number;
    deletedLines: number;
    findingsBySeverity: Record<Severity, number>;
  };
}

export interface ReportComparison {
  baseline: string;
  current: string;
  decisionBefore: Decision;
  decisionAfter: Decision;
  regressedCriteria: string[];
  improvedCriteria: string[];
  newFindings: Finding[];
  resolvedFindingIds: string[];
}
