import { access } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export class ReleaseCommandCleanupUnconfirmedError extends Error {
  constructor(failure, cleanupCause, details) {
    super(`Release command cleanup is unconfirmed; preserve its working artifacts: ${failure.message}. ${cleanupCause.message}`, { cause: failure });
    this.name = "ReleaseCommandCleanupUnconfirmedError";
    this.code = "RELEASE_COMMAND_CLEANUP_UNCONFIRMED";
    this.cleanupCause = cleanupCause;
    Object.assign(this, details);
  }
}

/** Wrappers must not turn uncertain process ownership into permission to delete artifacts. */
export function isReleaseCommandCleanupUnconfirmed(error) {
  const pending = [error];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (current.code === "RELEASE_COMMAND_CLEANUP_UNCONFIRMED") return true;
    pending.push(current.cause);
    if (current instanceof AggregateError) pending.push(...current.errors);
  }
  return false;
}

/** Cancellation confirms tree cleanup and pipe closure, or explicitly reports uncertainty after a finite grace. */
export async function executeReleaseCommand(file, args, options = {}) {
  options.signal?.throwIfAborted();
  const maxBuffer = options.maxBuffer ?? 10_000_000;
  const timeout = options.timeout ?? 30_000;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0 || !Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("Release command output and time bounds must be positive integers");
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [], stderr = [];
    let bytes = 0;
    let failure;
    let settled = false;
    let closed = false;
    let exitCode;
    let cleanupComplete = false;
    let cleanupTimer;
    let cleanupChild;
    const output = () => ({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
    const releaseListeners = () => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
      options.signal?.removeEventListener("abort", abort);
    };
    const unconfirmed = (cleanupCause) => {
      if (settled) return;
      settled = true;
      releaseListeners();
      // Release only our handles: closing a pipe is not evidence that its other
      // owners exited. Callers must retain artifacts on this distinct failure.
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      if (cleanupChild !== undefined) {
        cleanupChild.kill();
        cleanupChild.stdout?.destroy();
        cleanupChild.stderr?.destroy();
        cleanupChild.unref();
      }
      reject(new ReleaseCommandCleanupUnconfirmedError(failure, cleanupCause, { ...output(), pid: child.pid, durationMs: performance.now() - started }));
    };
    const finish = () => {
      if (settled || !closed || (failure !== undefined && !cleanupComplete)) return;
      settled = true;
      releaseListeners();
      const result = output();
      if (failure !== undefined) { reject(Object.assign(new Error(failure.message, { cause: failure }), failure, result)); return; }
      if (exitCode !== 0) { reject(Object.assign(new Error(`Release command exited with code ${exitCode}: ${result.stderr.trim()}`), result, { code: exitCode })); return; }
      resolve(result);
    };
    const stop = (error) => {
      if (settled || failure !== undefined) return;
      failure = error instanceof Error ? error : new Error(String(error));
      clearTimeout(timer);
      if (child.pid === undefined) { cleanupComplete = true; finish(); return; }
      // This also bounds a stalled taskkill and inherited pipes surviving the
      // original parent. Waiting only for 'close' can otherwise wait forever.
      cleanupTimer = setTimeout(() => unconfirmed(new Error("Tree termination and pipe drain exceeded the 2000ms cleanup grace")), 2_000);
      void (async () => {
        if (process.platform === "win32") {
          const cleanup = execute("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 2_000, maxBuffer: 64 * 1024 });
          cleanupChild = cleanup.child;
          await cleanup;
        } else {
          try { process.kill(-child.pid, "SIGKILL"); }
          catch (error) { if (error.code !== "ESRCH") throw error; }
        }
        cleanupComplete = true;
        finish();
      })().catch(unconfirmed);
    };
    const abort = () => stop(options.signal.reason ?? new Error("Release command cancelled"));
    const timer = setTimeout(() => stop(new Error(`Release command exceeded its ${timeout}ms deadline`)), timeout);
    options.signal?.addEventListener("abort", abort, { once: true });
    const collect = (chunks, chunk, onChunk) => {
      if (settled || failure !== undefined) return;
      bytes += chunk.length;
      if (bytes > maxBuffer) { stop(new Error(`Release command output exceeded its ${maxBuffer}-byte bound`)); return; }
      chunks.push(chunk);
      try { onChunk?.(chunk.toString("utf8")); } catch (error) { stop(error); }
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk, options.onStdout));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.once("error", stop);
    child.once("close", (code) => {
      closed = true;
      exitCode = code;
      finish();
    });
    if (options.signal?.aborted) abort();
  });
}

export async function resolveNpmCommand(arguments_, environment = process.env) {
  if (process.platform !== "win32") return { executable: "npm", arguments: arguments_ };

  const pathValue = Object.entries(environment).find(([key]) => key.toLowerCase() === "path")?.[1] ?? "";
  const configuredNpm = environment.npm_execpath;
  const candidates = [
    ...(configuredNpm !== undefined && /(?:^|[\\/])npm-cli\.js$/iu.test(configuredNpm) ? [configuredNpm] : []),
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    ...pathValue.split(delimiter).filter(Boolean).map((entry) => join(entry, "node_modules", "npm", "bin", "npm-cli.js")),
  ];
  for (const candidate of new Set(candidates)) {
    try {
      await access(candidate);
      return { executable: process.execPath, arguments: [candidate, ...arguments_] };
    } catch (error) {
      if ((error)?.code !== "ENOENT") throw error;
    }
  }
  throw new Error("npm-cli.js was not found beside the active Node installation or an npm PATH entry");
}
