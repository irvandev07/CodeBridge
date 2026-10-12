import type { CriterionResult, CheckResult, DiscoveredTest, EvidenceGraph } from "../core/types.js";

export function buildEvidenceGraph(criteria: CriterionResult[], checks: CheckResult[], tests: DiscoveredTest[], changedFiles: string[]): EvidenceGraph {
  const nodes = new Map<string, EvidenceGraph["nodes"][number]>();
  const edges: EvidenceGraph["edges"] = [];
  const add = (id: string, type: EvidenceGraph["nodes"][number]["type"], label: string, status?: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, type, label, status });
  };
  for (const c of criteria) {
    const criterion = `criterion:${c.id}`;
    add(criterion, "criterion", c.description, c.status);
    for (const ev of c.evidence) {
      if (ev.checkId) {
        const checkId = `check:${ev.checkId}`;
        add(checkId, "check", ev.checkId, checks.find(ch => ch.id === ev.checkId)?.status);
        if (ev.testName) {
          const id = `test:${JSON.stringify([ev.checkId, ev.testName])}`;
          const observed = tests.filter(t => t.checkId === ev.checkId && t.name === ev.testName);
          add(id, "test", ev.testName, observed.length === 1 ? observed[0].status : "unknown");
          edges.push({ from: criterion, to: id, relation: "validated-by" });
          edges.push({ from: id, to: checkId, relation: "observed-in" });
        } else edges.push({ from: criterion, to: checkId, relation: "validated-by" });
      }
      if (ev.file) {
        const id = `file:${ev.file}`;
        add(id, "file", ev.file, changedFiles.includes(ev.file) ? "changed" : "unchanged");
        edges.push({ from: criterion, to: id, relation: "references" });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}
