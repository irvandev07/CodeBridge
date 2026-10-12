import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runRules } from "../dist/analysis/rules.js";
import { parseAddedLines } from "../dist/git/diff.js";
import { validateConfig } from "../dist/core/config.js";
const rules = validateConfig({}).rules;

describe("deterministic static rules", () => {
  it("reports restricted path and private key marker without exposing source", () => {
    const content = "-----BEGIN PRIVATE KEY-----";
    const changes = { files: [{ path: ".env.production", status: "untracked", additions: 1, deletions: 0 }],
      addedLines: [{ file: ".env.production", line: 2, content }] };
    const found = runRules(changes, rules);
    assert.ok(found.some(x => x.ruleId === "forbidden-path" && x.severity === "high"));
    assert.ok(found.some(x => x.ruleId === "private-key" && x.severity === "critical"));
    assert.ok(!JSON.stringify(found).includes(content));
  });
  it("only scans added lines and retains line numbers", () => {
    const patch = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -5,2 +5,3 @@\n const x=1\n+debugger;\n-old\n+const y=2;\n";
    assert.deepEqual(parseAddedLines(patch), [
      { file: "src/a.ts", line: 6, content: "debugger;" },
      { file: "src/a.ts", line: 7, content: "const y=2;" }
    ]);
  });
  it("detects debug statements only when enabled", () => {
    const changes = { files: [{ path: "a.ts", status: "modified", additions: 1, deletions: 0 }],
      addedLines: [{ file: "a.ts", line: 1, content: "console.log('trace')" }] };
    assert.equal(runRules(changes, rules).length, 0);
    assert.equal(runRules(changes, { ...rules, detectDebugStatements: true })[0].ruleId, "debug-statement");
  });
  it("recognizes size thresholds", () => {
    const changes = { files: [{ path: "a.ts", status: "modified", additions: 300, deletions: 0 }], addedLines: [] };
    assert.equal(runRules(changes, { ...rules, maxChangedFiles: 0, maxAddedLines: 100 }).length, 2);
  });
});
