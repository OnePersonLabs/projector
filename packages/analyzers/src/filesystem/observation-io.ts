import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { ObservationBudget, ObservationError } from "@projector/core";

export function observationFailure(error: unknown, stage: string, scope = "."): ObservationError {
  return error instanceof ObservationError ? error : new ObservationError("observation-failed", stage, scope,
    error instanceof Error ? error.message : String(error));
}
export function checkObservation(budget: ObservationBudget, signal?: AbortSignal, stage = "collection", scope = "."): void {
  budget.check(stage, scope);
  if (signal?.aborted) throw new ObservationError("observation-failed", stage, scope, "Repository observation cancelled.");
}

/** At most four owned operations; the first error aborts and drains every sibling. */
export async function observationMap<T, R>(items: readonly T[], action: (item: T, signal: AbortSignal) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const results: R[] = new Array(items.length);
  let cursor = 0, failure: unknown;
  const worker = async (): Promise<void> => {
    while (!controller.signal.aborted && cursor < items.length) {
      const index = cursor++;
      try { results[index] = await action(items[index]!, controller.signal); }
      catch (error) { failure ??= error; controller.abort(); }
    }
  };
  try {
    await Promise.allSettled(Array.from({ length: Math.min(4, items.length) }, () => worker()));
    if (failure !== undefined) throw failure;
    if (controller.signal.aborted) throw new ObservationError("observation-failed", "collection", ".", "Repository observation cancelled.");
    return results;
  } finally { signal?.removeEventListener("abort", abort); }
}
export async function readObservationFile(path: string, budget: ObservationBudget, scope: string, signal?: AbortSignal): Promise<Buffer> {
  checkObservation(budget, signal, "file-read", scope);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Observation source is not a regular file");
    budget.assertFileBytes(stat.size, scope);
    budget.assertTotalBytes(stat.size, scope);
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
      checkObservation(budget, signal, "file-read", scope);
      // At most one small sentinel byte beyond a boundary is read, never retained.
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, budget.limits.maxFileBytes - size + 1, budget.remaining("maxTotalBytes") + 1));
      const { bytesRead } = await handle.read(buffer);
      if (bytesRead === 0) break;
      size += bytesRead;
      budget.assertFileBytes(size, scope);
      budget.consume("maxTotalBytes", bytesRead, "file-read", scope);
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, size);
  } catch (error) { throw observationFailure(error, "file-read", scope); }
  finally { await handle?.close(); }
}

function environment(): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TMP", "TEMP", "TMPDIR"]) {
    if (process.env[key] !== undefined) result[key] = process.env[key];
  }
  return { ...result, LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_OPTIONAL_LOCKS: "0" };
}
export class GitCommandError extends ObservationError {
  constructor(readonly exitCode: number | null, readonly stderr: string, stage: string) {
    super("observation-failed", stage, ".", `Git observation failed (${exitCode ?? "signal"}): ${stderr.trim()}`);
  }
}

/** Calls are intentionally sequential at the collector; every child is drained before rejection. */
export interface GitObservationOptions {
  readonly signal?: AbortSignal; readonly stage?: string; readonly input?: string; readonly allowedExitCodes?: readonly number[];
}
export async function observationGit(root: string, args: readonly string[], budget: ObservationBudget, options: GitObservationOptions = {}): Promise<string> {
  return observationGitResult(root, args, budget, options, (output) => output.toString("utf8"));
}
/** Raw output is needed when Git batch framing uses byte lengths rather than characters. */
export async function observationGitBytes(root: string, args: readonly string[], budget: ObservationBudget, options: GitObservationOptions = {}): Promise<Buffer> {
  return observationGitResult(root, args, budget, options, (output) => output);
}
async function observationGitResult<T>(root: string, args: readonly string[], budget: ObservationBudget, options: GitObservationOptions, result: (output: Buffer) => T): Promise<T> {
  const stage = options.stage ?? "git-facts";
  checkObservation(budget, options.signal, stage);
  return new Promise<T>((resolve, reject) => {
    const child = spawn("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "-c",
      `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`, ...args],
    { cwd: root, env: environment(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let failure: ObservationError | undefined;
    let termination = Promise.resolve();
    const stop = (error: unknown): void => {
      if (failure !== undefined) return;
      failure = observationFailure(error, stage);
      if (child.pid === undefined) return;
      if (process.platform !== "win32") {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch (killError) { if ((killError as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL"); }
      } else {
        // Terminate the known child's tree, including any Git helper retaining its pipes.
        const killer = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/pid", String(child.pid), "/T", "/F"],
          { stdio: "ignore", windowsHide: true });
        termination = new Promise<void>((done) => {
          killer.on("error", () => { child.kill("SIGKILL"); done(); });
          killer.on("close", () => done());
        });
      }
    };
    const onAbort = (): void => stop(new Error("Repository observation cancelled."));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => stop(new ObservationError("observation-limit-exceeded", stage, ".",
      "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs", budget.limits.timeoutMs)), budget.remainingMs());
    const collect = (target: Buffer[], chunk: Buffer): void => {
      if (failure !== undefined) return;
      try { budget.consume("maxGitOutputBytes", chunk.length, stage); target.push(chunk); }
      catch (error) { stop(error); }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", stop);
    child.stdin.on("error", (error: NodeJS.ErrnoException) => { if (error.code !== "EPIPE") stop(error); });
    child.on("close", async (code) => {
      clearTimeout(timer); options.signal?.removeEventListener("abort", onAbort);
      await termination;
      if (failure !== undefined) { reject(failure); return; }
      if (code !== 0 && !options.allowedExitCodes?.includes(code ?? -1)) {
        reject(new GitCommandError(code, Buffer.concat(stderr).toString("utf8"), stage)); return;
      }
      resolve(result(Buffer.concat(stdout)));
    });
    child.stdin.end(options.input);
    if (options.signal?.aborted) onAbort();
  });
}
