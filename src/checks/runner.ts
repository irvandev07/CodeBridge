import { spawn } from "node:child_process";
import type { CheckResult } from "../core/types.js";

// No shell. Only explicitly configured package-manager/Node commands are allowed.
// npm scripts may themselves run arbitrary code: configure them only from trusted repositories.
const EXECUTABLES = new Set(["npm", "pnpm", "yarn", "bun", "node"]);
const MAX_OUTPUT_CHARS = 20000;

function redact(text: string): string {
  let result = text;
  for (const [name, value] of Object.entries(process.env)) {
    if (/TOKEN|PASSWORD|SECRET|PRIVATE_KEY|API_KEY|CREDENTIAL/i.test(name) && value && value.length >= 8) {
      result = result.split(value).join("[REDACTED]");
    }
  }
  return result;
}

export async function runCheck(id: string, argv: string[], cwd: string, timeoutMs: number): Promise<CheckResult> {
  const started = Date.now();
  const [executable, ...args] = argv;
  if (!executable || !EXECUTABLES.has(executable)) {
    return { id, status: "error", durationMs: 0, output: "", errorMessage: `Executable '${executable}' tidak diizinkan` };
  }
  return await new Promise<CheckResult>((resolve) => {
    let output = "";
    let settled = false;
    let timedOut = false;
    const finish = (status: CheckResult["status"], exitCode?: number | null, errorMessage?: string) => {
      if (settled) return;
      settled = true;
      resolve({ id, status, durationMs: Date.now() - started, exitCode,
        output: redact(output), errorMessage: errorMessage ? redact(errorMessage) : undefined });
    };
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
      detached: process.platform !== "win32"
    });
    const consume = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-MAX_OUTPUT_CHARS);
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== "win32" && child.pid) {
        try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      } else child.kill("SIGTERM");
      const hardKill = setTimeout(() => {
        if (process.platform !== "win32" && child.pid) {
          try { process.kill(-child.pid, "SIGKILL"); } catch { /* already exited */ }
        } else child.kill("SIGKILL");
      }, 1500);
      hardKill.unref();
    }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); finish("error", null, error.message); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) finish("error", code, `Timeout: ${timeoutMs} ms`);
      else finish(code === 0 ? "passed" : "failed", code);
    });
  });
}
