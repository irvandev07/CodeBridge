import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../dist/cli/index.js", import.meta.url));

function run(executable, args, cwd) {
  return spawnSync(executable, args, { cwd, encoding: "utf8", timeout: 20000 });
}

it("CLI init and check write reports even when a required check fails", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "codebridge-e2e-"));
  try {
    const git = (args) => {
      const result = run("git", args, cwd);
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "ci@example.test"]);
    git(["config", "user.name", "CodeBridge CI"]);
    writeFileSync(path.join(cwd, "app.txt"), "initial\n");
    git(["add", "app.txt"]);
    git(["commit", "-qm", "initial"]);
    const init = run(process.execPath, [cli, "init"], cwd);
    assert.equal(init.status, 0, init.stderr);

    const configPath = path.join(cwd, "codebridge.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.commands = {
      "ac-main": ["node", "-e", "process.exit(0)"],
      "required-test": ["node", "-e", "process.exit(1)"]
    };
    config.requiredChecks = ["required-test"];
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(path.join(cwd, "codebridge.evidence.json"), JSON.stringify({
      version: 1, criteria: { "AC-MAIN": { checks: ["ac-main"], files: [] } }
    }));
    writeFileSync(path.join(cwd, "app.txt"), "changed\n");
    const check = run(process.execPath, [cli, "check", "--base", "main"], cwd);
    assert.equal(check.status, 1, check.stderr + check.stdout);
    const report = JSON.parse(readFileSync(path.join(cwd, ".codebridge", "report.json"), "utf8"));
    assert.equal(report.decision, "fail");
    assert.equal(report.criteria[0].status, "verified");
    assert.equal(report.criteria[1].status, "unverified");
    assert.ok(report.changedFiles.includes("app.txt"));
    assert.equal(report.checks.find((x) => x.id === "required-test").status, "failed");
    assert.match(readFileSync(path.join(cwd, ".codebridge", "report.md"), "utf8"), /Intent Verification/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
