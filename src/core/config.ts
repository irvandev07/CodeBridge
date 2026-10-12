import { readFile } from "node:fs/promises";
import { resolveInside, ensureInsideReal } from "../utils/paths.js";
import type { Severity } from "./types.js";

export interface RuleConfig {
  enabled: boolean;
  maxChangedFiles: number;
  maxAddedLines: number;
  forbiddenPaths: string[];
  detectCredentials: boolean;
  detectPrivateKeys: boolean;
  detectDebugStatements: boolean;
}
export interface CodeBridgeConfig {
  baseRef: string;
  goalFile: string;
  evidenceFile: string;
  commands: Record<string, string[]>;
  requiredChecks: string[];
  failOn: Severity[];
  timeoutMs: number;
  maxConcurrency: number;
  strictReview: boolean;
  outputDirectory: string;
  rules: RuleConfig;
}

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];
const known = new Set(["baseRef", "goalFile", "evidenceFile", "commands", "requiredChecks", "failOn", "timeoutMs", "maxConcurrency", "strictReview", "outputDirectory", "rules"]);
const ruleKeys = new Set(["enabled", "maxChangedFiles", "maxAddedLines", "forbiddenPaths", "detectCredentials", "detectPrivateKeys", "detectDebugStatements"]);
const defaultRules: RuleConfig = { enabled: true, maxChangedFiles: 50, maxAddedLines: 1500, forbiddenPaths: [".env", ".env.*", "*.pem", "*.key"], detectCredentials: true, detectPrivateKeys: true, detectDebugStatements: false };

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} harus object JSON`);
  return value as Record<string, unknown>;
}
function text(value: unknown, fallback: string, name: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${name} harus string nonkosong`);
  return value;
}
function bool(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${name} harus boolean`);
  return value;
}
function integer(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${name} harus integer ${min}..${max}`);
  return value;
}
function strings(value: unknown, fallback: string[], name: string): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || !value.every(v => typeof v === "string" && v.trim() !== "" && !v.includes("\0"))) throw new Error(`${name} harus array string nonkosong`);
  return value;
}
function rejectUnknown(raw: Record<string, unknown>, keys: Set<string>, name: string): void {
  for (const key of Object.keys(raw)) if (!keys.has(key)) throw new Error(`${name}: kunci tidak dikenal '${key}'`);
}
export function validateConfig(content: unknown, overrideBase?: string): CodeBridgeConfig {
  const raw = object(content, "config");
  rejectUnknown(raw, known, "config");
  const commands: Record<string, string[]> = {};
  const cmdObject = raw.commands === undefined ? {} : object(raw.commands, "commands");
  for (const [id, argv] of Object.entries(cmdObject)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error(`Nama check '${id}' tidak valid`);
    if (!Array.isArray(argv) || argv.length < 1 || argv.length > 32 || !argv.every(p => typeof p === "string" && p.length > 0 && p.length <= 1000 && !p.includes("\0"))) throw new Error(`commands.${id} harus array argumen valid`);
    commands[id] = argv as string[];
  }
  const baseRef = text(overrideBase ?? raw.baseRef, "main", "baseRef");
  if (!/^[a-zA-Z0-9_./-]+$/.test(baseRef) || baseRef.startsWith("-") || baseRef.includes("..") || baseRef.endsWith("/")) throw new Error(`Git baseRef tidak valid: ${baseRef}`);
  const requiredChecks = strings(raw.requiredChecks, [], "requiredChecks");
  for (const id of requiredChecks) if (!Object.hasOwn(commands, id)) throw new Error(`Required check '${id}' tidak ada dalam commands`);
  const failOn = strings(raw.failOn, ["critical", "high"], "failOn");
  for (const item of failOn) if (!severities.includes(item as Severity)) throw new Error(`Severity failOn tidak valid: ${item}`);
  const rulesRaw = raw.rules === undefined ? {} : object(raw.rules, "rules");
  rejectUnknown(rulesRaw, ruleKeys, "rules");
  const rules: RuleConfig = {
    enabled: bool(rulesRaw.enabled, defaultRules.enabled, "rules.enabled"),
    maxChangedFiles: integer(rulesRaw.maxChangedFiles, defaultRules.maxChangedFiles, 0, 100000, "rules.maxChangedFiles"),
    maxAddedLines: integer(rulesRaw.maxAddedLines, defaultRules.maxAddedLines, 0, 10000000, "rules.maxAddedLines"),
    forbiddenPaths: strings(rulesRaw.forbiddenPaths, defaultRules.forbiddenPaths, "rules.forbiddenPaths"),
    detectCredentials: bool(rulesRaw.detectCredentials, defaultRules.detectCredentials, "rules.detectCredentials"),
    detectPrivateKeys: bool(rulesRaw.detectPrivateKeys, defaultRules.detectPrivateKeys, "rules.detectPrivateKeys"),
    detectDebugStatements: bool(rulesRaw.detectDebugStatements, defaultRules.detectDebugStatements, "rules.detectDebugStatements")
  };
  for (const pattern of rules.forbiddenPaths) if (pattern.length > 300 || pattern.includes("..") || pattern.includes("\\")) throw new Error(`Pattern path tidak valid: ${pattern}`);
  return {
    baseRef, goalFile: text(raw.goalFile, "goal.md", "goalFile"),
    evidenceFile: text(raw.evidenceFile, "codebridge.evidence.json", "evidenceFile"),
    commands, requiredChecks, failOn: failOn as Severity[],
    timeoutMs: integer(raw.timeoutMs, 120000, 1000, 600000, "timeoutMs"),
    maxConcurrency: integer(raw.maxConcurrency, 2, 1, 8, "maxConcurrency"),
    strictReview: bool(raw.strictReview, false, "strictReview"),
    outputDirectory: text(raw.outputDirectory, ".codebridge", "outputDirectory"), rules
  };
}
export async function loadConfig(cwd: string, overrideBase?: string): Promise<CodeBridgeConfig> {
  let raw: unknown;
  try {
    const p = resolveInside(cwd, "codebridge.config.json");
    await ensureInsideReal(cwd, p);
    raw = JSON.parse(await readFile(p, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("codebridge.config.json tidak ditemukan. Jalankan 'codebridge init'.");
    throw new Error(`Gagal membaca konfigurasi: ${(error as Error).message}`);
  }
  const config = validateConfig(raw, overrideBase);
  for (const p of [config.goalFile, config.evidenceFile, config.outputDirectory]) resolveInside(cwd, p);
  return config;
}
