import { readFile } from "node:fs/promises";
import type { AcceptanceCriterion, CheckResult, CriterionResult, Evidence, DiscoveredTest } from "../core/types.js";
import { resolveInside, ensureInsideReal } from "../utils/paths.js";

export interface EvidenceManifest {
  version: 1 | 2;
  criteria: Record<string, { checks: string[]; files: string[]; tests?: { check: string; name: string }[]; note?: string }>;
}
function object(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function array(v: unknown, label: string): string[] {
  if (!Array.isArray(v) || !v.every(item => typeof item === "string" && item.length > 0 && !item.includes("\0"))) throw new Error(`${label} harus array string nonkosong`);
  const items = v as string[];
  if (new Set(items).size !== items.length) throw new Error(`Duplicate entry pada ${label}`);
  return items;
}
export function validateManifest(raw: unknown): EvidenceManifest {
  if (!object(raw) || raw.version !== 1 && raw.version !== 2 || !object(raw.criteria)) throw new Error("Manifest membutuhkan version:1|2 dan object criteria");
  for (const key of Object.keys(raw)) if (!["version", "criteria"].includes(key)) throw new Error(`Manifest: kunci tidak dikenal '${key}'`);
  const version = raw.version as 1 | 2;
  const criteria: EvidenceManifest["criteria"] = {};
  for (const [id, spec] of Object.entries(raw.criteria)) {
    if (!/^AC-[A-Za-z0-9_-]{1,40}$/.test(id) || !object(spec)) throw new Error(`Mapping ID tidak valid: ${id}`);
    for (const key of Object.keys(spec)) if (!["checks", "files", "note", "tests"].includes(key)) throw new Error(`Mapping ${id} punya kunci tidak dikenal '${key}'`);
    const checks = array(spec.checks ?? [], `${id}.checks`);
    const files = array(spec.files ?? [], `${id}.files`);
    if (spec.note !== undefined && (typeof spec.note !== "string" || spec.note.length > 2000)) throw new Error(`${id}.note harus string <=2000 karakter`);
    if (version === 1 && spec.tests !== undefined) throw new Error(`${id}.tests memerlukan manifest version 2`);
    const tests: { check: string; name: string }[] = [];
    if (spec.tests !== undefined) {
      if (!Array.isArray(spec.tests) || spec.tests.length > 200) throw new Error(`${id}.tests harus array maksimal 200`);
      for (const item of spec.tests) {
        if (!object(item) || Object.keys(item).some(k => !["check", "name"].includes(k)) ||
            typeof item.check !== "string" || !item.check || typeof item.name !== "string" || !item.name.trim() || item.name.length > 500)
          throw new Error(`${id}.tests membutuhkan {check,name} yang valid`);
        if (tests.some(t => t.check === item.check && t.name === item.name)) throw new Error(`Duplikat test pada ${id}`);
        tests.push({ check: item.check, name: item.name });
      }
    }
    criteria[id] = { checks, files, tests, note: spec.note as string | undefined };
  }
  return { version, criteria };
}
export async function loadEvidenceManifest(cwd: string, evidenceFile: string): Promise<EvidenceManifest> {
  const location = resolveInside(cwd, evidenceFile);
  await ensureInsideReal(cwd, location);
  try { return validateManifest(JSON.parse(await readFile(location, "utf8"))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 2, criteria: {} };
    throw new Error(`Evidence manifest tidak valid: ${(error as Error).message}`);
  }
}
export function validateEvidenceReferences(criteria: AcceptanceCriterion[], manifest: EvidenceManifest, commandIds: string[]): string[] {
  const ids = new Set(criteria.map(c => c.id));
  const checks = new Set(commandIds);
  const warnings: string[] = [];
  for (const [id, spec] of Object.entries(manifest.criteria)) {
    if (!ids.has(id)) warnings.push(`Evidence '${id}' tidak ditemukan dalam goal.md`);
    for (const check of spec.checks) if (!checks.has(check)) warnings.push(`Evidence '${id}' merujuk check '${check}' yang tidak dikonfigurasi`);
    for (const test of spec.tests ?? []) if (!checks.has(test.check)) warnings.push(`Evidence '${id}' merujuk test check '${test.check}' yang tidak dikonfigurasi`);
  }
  return warnings;
}
/**
 * Only explicitly linked checks can verify a criterion, and every linked check must pass.
 * Files and manual notes are context, never standalone verification.
 */
export function mapEvidence(criteria: AcceptanceCriterion[], manifest: EvidenceManifest, checks: CheckResult[], changedFiles: string[], discovered: DiscoveredTest[] = []): CriterionResult[] {
  const checkById = new Map(checks.map(check => [check.id, check]));
  const changed = new Set(changedFiles);
  return criteria.map(c => {
    const mapping = manifest.criteria[c.id] ?? { checks: [], files: [] };
    const evidence: Evidence[] = [];
    for (const checkId of mapping.checks) {
      const check = checkById.get(checkId);
      const status = check?.status === "passed" ? "pass" : check?.status === "failed" ? "fail" : "unknown";
      evidence.push({ id: `${c.id}:check:${checkId}`, criterionId: c.id, checkId, kind: "test", status,
        description: check ? `Check '${checkId}': ${check.status}` : `Check '${checkId}' tidak dijalankan` });
    }
    for (const ref of mapping.tests ?? []) {
      const matches = discovered.filter(t => t.checkId === ref.check && t.name === ref.name);
      const check = checkById.get(ref.check);
      const status = matches.length === 1 && matches[0].status === "failed" ? "fail" :
        matches.length === 1 && matches[0].status === "passed" && check?.status === "passed" ? "pass" : "unknown";
      evidence.push({ id: `${c.id}:tap:${ref.check}:${ref.name}`, criterionId: c.id, checkId: ref.check, testName: ref.name,
        kind: "test", status, provenance: "tap",
        description: matches.length > 1 ? `Ambiguous TAP title '${ref.name}' (${matches.length} matches)` :
          matches.length === 0 ? `TAP test '${ref.name}' tidak ditemukan pada '${ref.check}'` :
          `TAP '${ref.name}' dalam '${ref.check}': ${matches[0].status}; suite: ${check?.status ?? "missing"}` });
    }
    for (const file of mapping.files) evidence.push({ id: `${c.id}:file:${file}`, criterionId: c.id, file, kind: "static", status: "unknown",
      description: changed.has(file) ? "File berubah; belum membuktikan perilaku" : "File tidak berubah di diff ini" });
    if (mapping.note) evidence.push({ id: `${c.id}:note`, criterionId: c.id, kind: "manual", status: "unknown", description: mapping.note });
    const mappedChecks = evidence.filter(e => e.kind === "test");
    const hasFailed = mappedChecks.some(e => e.status === "fail");
    const allPassed = mappedChecks.length > 0 && mappedChecks.every(e => e.status === "pass");
    const hasPositive = mappedChecks.some(e => e.status === "pass") || evidence.some(e => e.kind === "static" && changed.has(e.file ?? ""));
    let status: CriterionResult["status"] = "unverified";
    let explanation = "Belum ada bukti check khusus untuk kriteria ini.";
    if (hasFailed) { status = "conflict"; explanation = "Check spesifik kriteria gagal."; }
    else if (allPassed) { status = "verified"; explanation = "Semua check yang eksplisit terhubung lulus. Cakupan test perlu dipastikan oleh reviewer."; }
    else if (hasPositive) { status = "partial"; explanation = "Bukti parsial ditemukan; masih ada check yang tidak berhasil/diverifikasi."; }
    else if (mappedChecks.length) explanation = "Check khusus belum tersedia atau mengalami error.";
    return { ...c, status, evidence, explanation };
  });
}
