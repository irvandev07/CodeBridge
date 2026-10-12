import path from "node:path";
import { realpath, lstat } from "node:fs/promises";

export function resolveInside(root: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error(`Path tidak aman: '${relativePath}'`);
  const base = path.resolve(root);
  const full = path.resolve(base, relativePath);
  if (full !== base && !full.startsWith(`${base}${path.sep}`)) throw new Error(`Path keluar repository: '${relativePath}'`);
  return full;
}
/** Reject symlink traversal even when a lexical path is within the project. */
export async function ensureInsideReal(root: string, fullPath: string): Promise<void> {
  const base = await realpath(root);
  const relative = path.relative(path.resolve(root), path.resolve(fullPath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path keluar repository: ${fullPath}`);
  let current = path.resolve(root);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return; // remaining descendants cannot yet be symlinks
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Symlink tidak diizinkan untuk file konfigurasi/output: ${current}`);
  }
  const parent = await realpath(root);
  if (parent !== base) throw new Error("Root repository tidak konsisten");
}
