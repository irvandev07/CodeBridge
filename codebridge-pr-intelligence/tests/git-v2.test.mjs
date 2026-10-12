import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getGitChanges } from "../dist/git/diff.js";
import { ensureInsideReal } from "../dist/utils/paths.js";

it("Git inventory includes tracked/untracked files, diff stats and new-line locations", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "codebridge-git-v2-"));
  try {
    const git = (args) => {
      const r = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
    };
    git(["init", "-q", "-b", "main"]); git(["config", "user.email", "a@example.org"]); git(["config", "user.name", "A"]);
    writeFileSync(path.join(cwd, "one.txt"), "before\n");
    git(["add", "one.txt"]); git(["commit", "-qm", "start"]);
    writeFileSync(path.join(cwd, "one.txt"), "after\nsecond\n");
    writeFileSync(path.join(cwd, "fresh.txt"), "new\ncontent\n");
    const changes = await getGitChanges(cwd, "main");
    assert.deepEqual(changes.files.map(f => f.path), ["fresh.txt", "one.txt"]);
    assert.equal(changes.files.find(f => f.path === "one.txt").status, "modified");
    assert.equal(changes.files.find(f => f.path === "fresh.txt").status, "untracked");
    assert.ok(changes.addedLines.some(l => l.file === "one.txt" && l.content === "second" && l.line === 2));
    assert.ok(changes.addedLines.some(l => l.file === "fresh.txt" && l.content === "content" && l.line === 2));
    assert.equal(changes.files.find(f => f.path === "fresh.txt").additions, 2);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

it("symlink config/output path is rejected", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "codebridge-symlink-v2-"));
  const external = mkdtempSync(path.join(tmpdir(), "codebridge-external-v2-"));
  try {
    mkdirSync(path.join(cwd, "safe"));
    symlinkSync(external, path.join(cwd, "unsafe"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(() => ensureInsideReal(cwd, path.join(cwd, "unsafe", "report.json")), /Symlink/);
    await ensureInsideReal(cwd, path.join(cwd, "safe", "report.json"));
  } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(external, { recursive: true, force: true }); }
});
