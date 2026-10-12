import type { CodeBridgeReport } from "../core/types.js";
export function renderJson(report: CodeBridgeReport): string { return JSON.stringify(report, null, 2) + "\n"; }
