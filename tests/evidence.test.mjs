import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapEvidence } from "../dist/intent/evidence.js";

const criteria = [{ id: "AC-001", description: "Works" }];
const manifest = (checks = [], files = []) => ({ version: 1, criteria: { "AC-001": { checks, files } } });
const checked = (id, status) => ({id, status, durationMs: 1, output: ""});

describe("intent evidence mapping", () => {
  it("does not assume generic test success verifies criterion", () => {
    assert.equal(mapEvidence(criteria, manifest(), [checked("test", "passed")], ["src/demo.ts"])[0].status, "unverified");
  });
  it("verifies mapped checks that pass", () => {
    assert.equal(mapEvidence(criteria, manifest(["ac-demo"]), [checked("ac-demo", "passed")], [])[0].status, "verified");
  });
  it("reports failing mapped check as conflict", () => {
    assert.equal(mapEvidence(criteria, manifest(["ac-demo"]), [checked("ac-demo", "failed")], [])[0].status, "conflict");
  });
  it("changed files offer partial evidence", () => {
    assert.equal(mapEvidence(criteria, manifest([], ["src/demo.ts"]), [], ["src/demo.ts"])[0].status, "partial");
  });
});
