import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { discoverTapTests } from "../dist/discovery/tap.js";
import { validateManifest, mapEvidence } from "../dist/intent/evidence.js";
import { buildEvidenceGraph } from "../dist/intent/evidence-graph.js";
const criterion = [{ id: "AC-LOGIN", description: "Valid login works" }];
const manifest = validateManifest({ version: 2, criteria: { "AC-LOGIN": { checks: [], files: ["src/login.ts"], tests: [{ check: "test", name: "valid login" }] } } });
const checked = (status, output) => [{ id: "test", status, output, durationMs: 1 }];
const tap = (result) => `TAP version 13\n${result} 1 - valid login\n1..1\n`;
describe("v0.3 TAP evidence discovery", () => {
  it("discovers explicit top-level TAP case and verifies exact link", () => {
    const checks = checked("passed", tap("ok"));
    const tests = discoverTapTests(checks);
    assert.equal(tests.length, 1);
    const results = mapEvidence(criterion, manifest, checks, ["src/login.ts"], tests);
    assert.equal(results[0].status, "verified");
    assert.equal(results[0].evidence.find(e => e.testName).provenance, "tap");
    const graph = buildEvidenceGraph(results, checks, tests, ["src/login.ts"]);
    assert.equal(graph.edges.filter(e => e.relation === "validated-by").length, 1);
    assert.equal(graph.edges.filter(e => e.relation === "observed-in").length, 1);
  });
  it("fails linked test conservatively", () => {
    const checks = checked("failed", tap("not ok"));
    assert.equal(mapEvidence(criterion, manifest, checks, [], discoverTapTests(checks))[0].status, "conflict");
  });
  it("does not verify missing TAP cases", () => {
    const checks = checked("passed", "Everything is good");
    assert.equal(mapEvidence(criterion, manifest, checks, [], discoverTapTests(checks))[0].status, "unverified");
  });
  it("does not verify duplicate matching titles", () => {
    const checks = checked("passed", "TAP version 13\nok 1 - valid login\nok 2 - valid login\n1..2\n");
    const evidence = mapEvidence(criterion, manifest, checks, [], discoverTapTests(checks))[0];
    assert.equal(evidence.status, "unverified");
    assert.match(evidence.evidence[0].description, /Ambiguous/);
  });
  it("does not verify case with failed suite", () => {
    const checks = checked("failed", tap("ok"));
    assert.equal(mapEvidence(criterion, manifest, checks, [], discoverTapTests(checks))[0].status, "unverified");
  });
  it("rejects invalid v2 test references", () => assert.throws(() => validateManifest({version:2,criteria:{"AC-LOGIN":{tests:[{check:"test",name:3}]}}})));
  it("rejects version 1 test field", () => assert.throws(() => validateManifest({version:1,criteria:{"AC-LOGIN":{tests:[]}}})));
  it("ignores nested TAP results", () => {
    const checks = checked("passed", "TAP version 13\n# Subtest: suite\n    ok 1 - valid login\nok 1 - suite\n1..1\n");
    assert.deepEqual(discoverTapTests(checks).map(t => t.name), ["suite"]);
  });
});
