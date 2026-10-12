import { it } from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "../dist/checks/scheduler.js";

it("parallel scheduler maintains config order despite different completion order", async () => {
  const commands = {
    slow: ["node", "-e", "setTimeout(() => process.exit(0), 120)"],
    quick: ["node", "-e", "process.exit(0)"]
  };
  const checks = await runChecks(commands, process.cwd(), 5000, 2);
  assert.deepEqual(checks.map(c => c.id), ["slow", "quick"]);
  assert.ok(checks.every(c => c.status === "passed"));
});
