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
  testName?: string;
  provenance?: "manifest" | "tap" | "git";
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
  schemaVersion: "1.3";
  toolVersion: "0.5.0";
  generatedAt: string;
  repository: string;
  baseRef: string;
  commitSha?: string;
  changedFiles: string[];
  changeDetails: ChangedFile[];
  criteria: CriterionResult[];
  checks: CheckResult[];
  testCases?: DiscoveredTest[];
  evidenceGraph?: EvidenceGraph;
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

export interface DiscoveredTest {
  id: string;
  checkId: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  source: "tap";
  occurrence: number;
}
export interface EvidenceNode { id: string; type: "criterion" | "check" | "test" | "file"; label: string; status?: string; }
export interface EvidenceEdge { from: string; to: string; relation: "validated-by" | "observed-in" | "references" | "changed"; }
export interface EvidenceGraph { nodes: EvidenceNode[]; edges: EvidenceEdge[]; }
