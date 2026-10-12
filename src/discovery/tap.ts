import type { CheckResult, DiscoveredTest } from "../core/types.js";

/** Discover TAP v13+ *top-level* test results only. A title is not evidence until explicitly linked.
 * Nested tests are deliberately excluded to avoid attributing a parent result to a child. */
export function discoverTapTests(checks: CheckResult[]): DiscoveredTest[] {
  const result: DiscoveredTest[] = [];
  for (const check of checks) {
    // Avoid guessing from arbitrary command output; require a TAP header.
    if (!/^TAP version \d+\s*$/m.test(check.output)) continue;
    const occurrences = new Map<string, number>();
    for (const line of check.output.split(/\r?\n/)) {
      const match = /^(not ok|ok)\s+\d+\s+-\s+(.+?)\s*$/.exec(line);
      if (!match) continue;
      const name = match[2].replace(/\s+#\s+(SKIP|TODO)(?:\s+.*)?$/i, "").trim();
      if (!name) continue;
      const count = (occurrences.get(name) ?? 0) + 1;
      occurrences.set(name, count);
      const skip = /\s+#\s+(SKIP|TODO)(?:\s+.*)?$/i.test(match[2]);
      result.push({ id: `tap:${check.id}:${result.length + 1}`, checkId: check.id, name,
        status: skip ? "skipped" : match[1] === "ok" ? "passed" : "failed", occurrence: count, source: "tap" });
    }
  }
  return result;
}
