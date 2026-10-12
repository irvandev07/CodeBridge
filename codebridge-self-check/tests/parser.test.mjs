import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGoalMarkdown } from "../dist/intent/parser.js";

describe("goal parser", () => {
  it("parses bullets and stops at next heading", () => {
    const result = parseGoalMarkdown("# Feature\nDemo\n## Acceptance Criteria\n- First\n- [ ] Second\n## Notes\n- Ignore");
    assert.deepEqual(result, [{id: "AC-001", description: "First"}, {id: "AC-002", description: "Second"}]);
  });
  it("throws without required heading", () => assert.throws(() => parseGoalMarkdown("# Feature"), /Acceptance Criteria/));
});
