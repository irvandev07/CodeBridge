import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveInside } from "../dist/utils/paths.js";

describe("paths", () => {
  it("allows subpaths", () => assert.match(resolveInside("/tmp/demo", "goal.md"), /goal\.md$/));
  it("rejects traversal", () => assert.throws(() => resolveInside("/tmp/demo", "../outside")));
  it("rejects absolute paths", () => assert.throws(() => resolveInside("/tmp/demo", "/tmp/other")));
});
