import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import type { ChangedFile } from "../core/types.js";
import { resolveInside } from "../utils/paths.js";
const exec = promisify(execFile);

async function git(cwd: string, args: string[], maxBuffer = 8 * 1024 * 1024): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, encoding: "utf8", timeout: 20000, maxBuffer, windowsHide: true });
  return stdout;
}

export interface AddedLine { file: string; line: number; content: string; }
export interface GitChanges { files: ChangedFile[]; addedLines: AddedLine[]; }

function readStatus(data: string, map: Map<string, ChangedFile>): void {
  const records = data.split("\0");
  for (let i = 0; i < records.length - 1; i += 2) {
    const code = records[i]?.[0];
    const file = records[i + 1];
    if (!code || !file) continue;
    const status = code === "A" ? "added" : code === "D" ? "deleted" : code === "C" ? "copied" : code === "R" ? "renamed" : "modified";
    map.set(file, { path: file, status, additions: 0, deletions: 0 });
  }
}
function readNumstat(data: string, map: Map<string, ChangedFile>): void {
  for (const record of data.split("\0")) {
    const m = record.match(/^(\d+|-)\t(\d+|-)\t([\s\S]+)$/);
    if (!m) continue;
    const file = map.get(m[3]);
    if (file) { file.additions += m[1] === "-" ? 0 : Number(m[1]); file.deletions += m[2] === "-" ? 0 : Number(m[2]); }
  }
}
/** Only scan added patch lines; never copy secrets into findings/output. */
export function parseAddedLines(diff: string): AddedLine[] {
  const found: AddedLine[] = [];
  let file = "";
  let current = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+++ /dev/null")) file = "";
    else if (line.startsWith("@@ ")) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) current = Number(match[1]);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (file && found.length < 100000) found.push({ file, line: current, content: line.slice(1) });
      current++;
    } else if (line.startsWith(" ")) current++;
  }
  return found;
}

export async function getGitChanges(cwd: string, baseRef: string): Promise<GitChanges> {
  try {
    await git(cwd, ["rev-parse", "--verify", `${baseRef}^{commit}`]);
    const committedArgs = ["diff", "--no-renames", "--no-ext-diff", "--no-textconv"];
    const localArgs = ["diff", "--no-renames", "--no-ext-diff", "--no-textconv"];
    const [statusCommitted, statusLocal, untracked, statCommitted, statLocal, patchCommitted, patchLocal] = await Promise.all([
      git(cwd, [...committedArgs, "--name-status", "-z", `${baseRef}...HEAD`, "--"]),
      git(cwd, [...localArgs, "--name-status", "-z", "HEAD", "--"]),
      git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
      git(cwd, [...committedArgs, "--numstat", "-z", `${baseRef}...HEAD`, "--"]),
      git(cwd, [...localArgs, "--numstat", "-z", "HEAD", "--"]),
      git(cwd, [...committedArgs, "--unified=0", `${baseRef}...HEAD`, "--"], 16 * 1024 * 1024),
      git(cwd, [...localArgs, "--unified=0", "HEAD", "--"], 16 * 1024 * 1024)
    ]);
    const files = new Map<string, ChangedFile>();
    readStatus(statusCommitted, files);
    readStatus(statusLocal, files);
    for (const name of untracked.split("\0").filter(Boolean)) files.set(name, { path: name, status: "untracked", additions: 0, deletions: 0 });
    readNumstat(statCommitted, files);
    readNumstat(statLocal, files);
    const addedLines = [...parseAddedLines(patchCommitted), ...parseAddedLines(patchLocal)];
    for (const name of untracked.split("\0").filter(Boolean)) {
      const full = resolveInside(cwd, name);
      const stat = await lstat(full);
      if (!stat.isFile() || stat.size > 128 * 1024) continue;
      const buffer = await readFile(full);
      if (buffer.includes(0)) continue;
      const lines = buffer.toString("utf8").split(/\r?\n/);
      const count = lines.length - (lines.at(-1) === "" ? 1 : 0);
      const file = files.get(name);
      if (file) file.additions = count;
      for (let i = 0; i < count; i++) if (addedLines.length < 100000) addedLines.push({ file: name, line: i + 1, content: lines[i] });
    }
    const unique = new Map<string, AddedLine>();
    for (const line of addedLines) unique.set(`${line.file}\0${line.line}\0${line.content}`, line);
    return { files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)), addedLines: [...unique.values()] };
  } catch (error) {
    throw new Error(`Gagal mengambil Git diff dari '${baseRef}'. Periksa Git repository dan base ref. ${(error as Error).message}`);
  }
}
export async function getChangedFiles(cwd: string, baseRef: string): Promise<string[]> {
  return (await getGitChanges(cwd, baseRef)).files.map(f => f.path);
}
