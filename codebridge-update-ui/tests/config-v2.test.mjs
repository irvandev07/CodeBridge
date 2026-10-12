import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../dist/core/config.js";
import { validateManifest, validateEvidenceReferences } from "../dist/intent/evidence.js";
import { parseGoalMarkdown } from "../dist/intent/parser.js";

describe("v0.2 validation and stable IDs", () => {
  it("supports stable IDs on bullet list with checkbox items", () => {
    const parsed = parseGoalMarkdown("## Acceptance Criteria\n- [ ] [AC-LOGIN] Login works\n- [AC-PASSWORD] Password reset works\n");
    assert.deepEqual(parsed.map(x => x.id), ["AC-LOGIN", "AC-PASSWORD"]);
  });
  it("rejects duplicate IDs", () => assert.throws(() => parseGoalMarkdown("## Acceptance Criteria\n- [AC-X] One\n- [AC-X] Two"), /Duplicate/));
  it("rejects unknown options", () => assert.throws(() => validateConfig({ foo: true }), /kunci tidak dikenal/));
  it("rejects invalid maxConcurrency", () => assert.throws(() => validateConfig({ maxConcurrency: 200 }), /maxConcurrency/));
  it("supports rule configuration defaults", () => assert.equal(validateConfig({}).rules.detectCredentials, true));
  it("warns for missing mapped checks and IDs", () => {
    const map = validateManifest({ version: 1, criteria: { "AC-EXTRA": { checks: ["test:nothing"], files: [] } } });
    const issues = validateEvidenceReferences([{ id: "AC-A", description: "test" }], map, ["test"]);
    assert.equal(issues.length, 2);
  });
  it("rejects duplicate manifest checks", () => assert.throws(() => validateManifest({ version: 1, criteria: { "AC-X": { checks: ["check", "check"] } } }), /Duplicate/));
});
