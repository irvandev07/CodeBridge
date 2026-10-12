import type { CodeBridgeReport } from "../core/types.js";
/** SARIF 2.1.0 for static findings; rules are deterministic heuristics. */
export function renderSarif(report: CodeBridgeReport): string {
  const rules = [...new Set(report.findings.map(f => f.ruleId))].sort().map(ruleId => {
    const f = report.findings.find(item => item.ruleId === ruleId)!;
    return { id: ruleId, shortDescription: { text: f.title }, fullDescription: { text: f.message }, properties: { precision: "low" } };
  });
  const level = (s: string) => s === "critical" || s === "high" ? "error" : s === "medium" ? "warning" : "note";
  const results = report.findings.map(f => ({
    ruleId: f.ruleId, level: level(f.severity), message: { text: f.message },
    ...(f.file ? { locations: [{ physicalLocation: { artifactLocation: { uri: f.file.replace(/\\/g, "/"), uriBaseId: "%SRCROOT%" }, ...(f.line ? { region: { startLine: f.line } } : {}) } }] } : {}),
    properties: { severity: f.severity }
  }));
  return JSON.stringify({ version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{ tool: { driver: { name: "CodeBridge", semanticVersion: "0.2.0", rules } },
      originalUriBaseIds: { "%SRCROOT%": { uri: "file:///" } }, results }] }, null, 2) + "\n";
}
