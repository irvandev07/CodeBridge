import { runCheck } from "./runner.js";
import type { CheckResult } from "../core/types.js";

/** Bounded parallel execution; report ordering remains deterministic. */
export async function runChecks(commands: Record<string, string[]>, cwd: string, timeoutMs: number, concurrency: number): Promise<CheckResult[]> {
  const entries = Object.entries(commands);
  const results: CheckResult[] = new Array(entries.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < entries.length) {
      const task = index++;
      const [id, argv] = entries[task];
      results[task] = await runCheck(id, argv, cwd, timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, () => worker()));
  return results;
}
