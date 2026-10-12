import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderHtml } from "../dist/reports/html.js";
import { renderSarif } from "../dist/reports/sarif.js";
import { compareReports } from "../dist/reports/compare.js";
import { exitCode } from "../dist/core/policy.js";

function report(status="unverified", decision="review") { return {
  schemaVersion: "1.1", toolVersion: "0.2.0", generatedAt: "2026-01-01", repository: "repo", baseRef: "main",
  changedFiles: ["a.ts"], changeDetails: [{ path: "a.ts", status: "modified", additions: 1, deletions: 0 }],
  criteria: [{ id: "AC-A", description: "<script>alert(1)</script>", status, evidence: [], explanation: "N/A" }], checks: [], findings: [], decision,
  summary: { totalCriteria: 1, verified: 0, partial: 0, unverified: 1, conflict: 0, changedFiles: 1, addedLines: 1, deletedLines: 0,
    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } }
}; }
describe("report formats and comparison", () => {
  it("escapes user-controlled text in offline HTML", () => {
    const page = renderHtml(report());
    assert.ok(page.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(!page.includes("<script>"));
    assert.ok(page.includes("Content-Security-Policy"));
  });
  it("generates valid SARIF 2.1.0", () => {
    const r = report(); r.findings = [{ id: "F-0001", ruleId: "sensitive", severity: "high", title: "Sensitive file", message: "restricted", file: "a.ts", line: 2, source: "deterministic" }];
    const json = JSON.parse(renderSarif(r));
    assert.equal(json.version, "2.1.0");
    assert.equal(json.runs[0].results[0].locations[0].physicalLocation.region.startLine, 2);
  });
  it("identifies regressions by stable criterion IDs", () => {
    const diff = compareReports(report("verified", "pass"), report("unverified", "review"));
    assert.deepEqual(diff.regressedCriteria, ["AC-A: verified -> unverified"]);
  });
  it("supports strict review exits", () => {
    assert.equal(exitCode("review", false), 0);
    assert.equal(exitCode("review", true), 1);
    assert.equal(exitCode("fail", false), 1);
  });
});
