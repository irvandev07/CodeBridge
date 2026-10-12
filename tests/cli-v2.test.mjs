import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const cli = fileURLToPath(new URL("../dist/cli/index.js", import.meta.url));
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 20000 });

it("CLI doctor/check/explain/compare and four report formats", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "codebridge-cli-v2-"));
  try {
    const git = (args) => { const r = run("git", args, cwd); assert.equal(r.status, 0, r.stderr); };
    git(["init", "-q", "-b", "main"]); git(["config", "user.name", "A"]); git(["config", "user.email", "a@example.org"]);
    writeFileSync(path.join(cwd, "app.js"), "export const ok=true;\n");
    git(["add", "app.js"]); git(["commit", "-qm", "init"]);
    let res = run(process.execPath, [cli, "init"], cwd);
    assert.equal(res.status, 0, res.stderr);
    const configPath = path.join(cwd, "codebridge.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.commands = { acceptance: ["node", "-e", "process.exit(0)"], types: ["node", "-e", "process.exit(0)"] };
    config.requiredChecks = ["types"];
    writeFileSync(configPath, JSON.stringify(config));
    const manifestPath = path.join(cwd, "codebridge.evidence.json");
    writeFileSync(manifestPath, JSON.stringify({ version: 1, criteria: { "AC-MAIN": { checks: ["acceptance"], files: ["app.js"] } } }));
    writeFileSync(path.join(cwd, "app.js"), "export const ok=true;\nexport const update=true;\n");
    res = run(process.execPath, [cli, "doctor"], cwd);
    assert.equal(res.status, 0, res.stderr + res.stdout);
    res = run(process.execPath, [cli, "check", "--format", "all"], cwd);
    assert.equal(res.status, 0, res.stderr + res.stdout);
    for (const file of ["report.md", "report.json", "report.html", "report.sarif"]) assert.ok(existsSync(path.join(cwd, ".codebridge", file)), file);
    const r = JSON.parse(readFileSync(path.join(cwd, ".codebridge", "report.json"), "utf8"));
    assert.equal(r.schemaVersion, "1.3");
    assert.equal(r.criteria.find(x => x.id === "AC-MAIN").status, "verified");
    assert.equal(r.decision, "review");
    assert.deepEqual(r.changedFiles, ["app.js", "codebridge.config.json", "codebridge.evidence.json", "goal.md"]);
    res = run(process.execPath, [cli, "explain", "AC-MAIN"], cwd);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Status: verified/);
    copyFileSync(path.join(cwd, ".codebridge", "report.json"), path.join(cwd, "baseline.json"));
    res = run(process.execPath, [cli, "compare", "baseline.json", "baseline.json"], cwd);
    assert.equal(res.status, 0, res.stderr + res.stdout);
    res = run(process.execPath, [cli, "check", "--strict"], cwd);
    assert.equal(res.status, 1, res.stderr + res.stdout);
    // Previously produced report files should never be collected in Git change inventory.
    assert.equal(JSON.parse(readFileSync(path.join(cwd, ".codebridge", "report.json"), "utf8")).changedFiles.some(x => x.startsWith(".codebridge/")), false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
