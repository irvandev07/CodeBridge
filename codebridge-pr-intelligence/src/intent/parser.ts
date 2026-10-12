import { readFile } from "node:fs/promises";
import type { AcceptanceCriterion } from "../core/types.js";
import { resolveInside, ensureInsideReal } from "../utils/paths.js";

/** Optional stable IDs: '- [AC-LOGIN] Login works' or '- [AC-001] Login works'. */
export function parseGoalMarkdown(content: string): AcceptanceCriterion[] {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,6}\s+Acceptance Criteria\s*$/i.test(line.trim()));
  if (start === -1) throw new Error("Heading '## Acceptance Criteria' tidak ditemukan di goal.md");
  const result: AcceptanceCriterion[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(start + 1)) {
    if (/^\s*#{1,6}\s+/.test(line)) break;
    const bullet = line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/);
    if (!bullet) continue;
    let description = bullet[1].trim();
    const match = description.match(/^\[(AC-[A-Za-z0-9_-]{1,40})\]\s+(.+)$/);
    const id = match ? match[1] : `AC-${String(result.length + 1).padStart(3, "0")}`;
    if (match) description = match[2].trim();
    if (seen.has(id)) throw new Error(`Duplicate acceptance criterion ID: ${id}. Gunakan explicit ID yang unik.`);
    seen.add(id);
    result.push({ id, description });
  }
  if (result.length === 0) throw new Error("Tidak ada bullet acceptance criteria di goal.md");
  return result;
}
export async function loadCriteria(cwd: string, goalFile: string): Promise<AcceptanceCriterion[]> {
  const location = resolveInside(cwd, goalFile);
  await ensureInsideReal(cwd, location);
  return parseGoalMarkdown(await readFile(location, "utf8"));
}
