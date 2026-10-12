import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { determineDecision } from "../dist/core/policy.js";

const criterion = (status) => ({ id: "AC-001", description: "Works", status, explanation: "", evidence: [] });
const check = (status) => ({ id: "test", status, durationMs: 1, output: "" });

describe("policy", () => {
  it("reviews unverified acceptance criterion", () => assert.equal(determineDecision([criterion("unverified")], [], [], [], []), "review"));
  it("fails required check failures", () => assert.equal(determineDecision([], [check("failed")], ["test"], [], []), "fail"));
  it("passes verified criteria with passing checks", () => assert.equal(determineDecision([criterion("verified")], [check("passed")], ["test"], [], []), "pass"));
});
