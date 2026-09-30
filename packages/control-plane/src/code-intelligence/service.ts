import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, readdir, rename, unlink, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  CodeIndexRequestSchema, CodeIndexRunSchema, CodeIndexStatusSchema, CodeIndexStatusRequestSchema,
  CodeIndexWaitRequestSchema, CodeIndexCancelRequestSchema,
  type CodeIndexRun,
} from "@projector/core";
import {
  NativeProcessLauncher, RepositoryPathService, currentObservationScope, resolveDerivedCachePath,
  withRetainedObservationScope,
} from "@projector/runtime";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { runObservationTask } from "../observation/task-runner.js";
import { residentObservationWorkerPool } from "../observation/resident-pool.js";
import type { IndexedRepositoryObservation } from "../observation/indexed-types.js";
import type { InventoryEntry } from "@projector/analyzers";

type CodeOperation = "code.query" | "code.index" | "code.index-status" | "code.index-wait" | "code.index-cancel" | "code.impact" | "code.tests" | "code.evidence" | "code.export";
type ExecutionOptions = { readonly signal: AbortSignal; readonly environment: Readonly<Record<string, string | undefined>> };
type ActiveRun = { readonly controller: AbortController; readonly promise: Promise<CodeIndexRun> };
const activeRuns = new Map<string, ActiveRun>();

async function runDirectory(root: string): Promise<string> {
  const path = await resolveDerivedCachePath(root, ".projector/runtime/code/runs");
  await mkdir(path, { recursive: true });
  return path;
}

async function writeRun(directory: string, candidate: CodeIndexRun): Promise<CodeIndexRun> {
  const run = CodeIndexRunSchema.parse(candidate);
  const destination = join(directory, `${run.id}.json`);
  const temporary = join(directory, `.${run.id}.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(run)}\n`, { flag: "wx" });
  await rename(temporary, destination);
  return run;
}

async function readRun(directory: string, id: string): Promise<CodeIndexRun> {
  if (!/^code_index_[0-9a-f-]{36}$/u.test(id)) throw new Error("Invalid code index run ID");
  return CodeIndexRunSchema.parse(JSON.parse(await readFile(join(directory, `${id}.json`), "utf8")));
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}

async function currentRun(directory: string, run: CodeIndexRun): Promise<CodeIndexRun> {
  if (run.state !== "running" || (run.ownerPid === process.pid ? activeRuns.has(run.id) : pidAlive(run.ownerPid))) return run;
  return writeRun(directory, { ...run, state: "interrupted", finishedAt: new Date().toISOString(), error: "The owning process exited before the index run reached a terminal state" });
}

async function listRuns(directory: string): Promise<{ runs: CodeIndexRun[]; truncated: boolean }> {
  const files = (await readdir(directory)).filter(file => /^code_index_[0-9a-f-]{36}\.json$/u.test(file)).sort();
  const runs = await Promise.all(files.map(async file => currentRun(directory, await readRun(directory, file.slice(0, -5)))));
  runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  return { runs: runs.slice(0, 1000), truncated: runs.length > 1000 };
}

async function pruneTerminalRuns(directory: string): Promise<void> {
  const files = (await readdir(directory)).filter(file => /^code_index_[0-9a-f-]{36}\.json$/u.test(file));
  const records = await Promise.all(files.map(file => readRun(directory, file.slice(0, -5))));
  const terminal = records.filter(run => run.state === "published" || run.state === "failed" || run.state === "cancelled")
    .sort((left, right) => (right.finishedAt ?? right.startedAt).localeCompare(left.finishedAt ?? left.startedAt));
  for (const run of terminal.slice(1000)) {
    const current = await readRun(directory, run.id);
    if (current.state !== run.state || current.finishedAt !== run.finishedAt) throw new Error(`Code index run changed during history pruning: ${run.id}`);
    await unlink(join(directory, `${run.id}.json`));
  }
}

async function acquireIndexLock(directory: string, run: CodeIndexRun): Promise<void> {
  const lock = join(directory, "index.lock");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lock, "wx");
      try { await handle.writeFile(JSON.stringify({ id: run.id, ownerPid: process.pid })); }
      finally { await handle.close(); }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let occupant: { id: string; ownerPid: number } | undefined;
      for (let read = 0; read < 5 && occupant === undefined; read += 1) {
        try { occupant = JSON.parse(await readFile(lock, "utf8")) as { id: string; ownerPid: number }; }
        catch (readError) {
          if (!(readError instanceof SyntaxError) && (readError as NodeJS.ErrnoException).code !== "ENOENT") throw readError;
          await delay(20);
        }
      }
      if (occupant === undefined) throw new Error("Code index ownership record remained incomplete");
      if (!Number.isSafeInteger(occupant.ownerPid) || occupant.ownerPid <= 0 || pidAlive(occupant.ownerPid)) throw new Error(`Code indexing is already owned by ${occupant.id}`);
      try { await currentRun(directory, await readRun(directory, occupant.id)); }
      catch (readError) { if ((readError as NodeJS.ErrnoException).code !== "ENOENT") throw readError; }
      const stale = join(directory, `stale-${randomUUID()}.lock`);
      await rename(lock, stale);
      await unlink(stale);
    }
  }
  throw new Error("Could not acquire code index ownership after stale-run recovery");
}

async function releaseIndexLock(directory: string, id: string): Promise<void> {
  const lock = join(directory, "index.lock");
  try {
    const owner = JSON.parse(await readFile(lock, "utf8")) as { id?: string };
    if (owner.id !== id) throw new Error(`Code index ownership changed before releasing ${id}`);
    await unlink(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function sourceHashes(paths: RepositoryPathService, hashes: Record<string, string>): Promise<Record<string, string>> {
  const entries: Array<readonly [string, string]> = [];
  for (const path of Object.keys(hashes).sort()) {
    const resolved = await paths.resolveRead(path);
    entries.push([path, await streamingCodeInputHash(resolved.realTarget)]);
  }
  return Object.fromEntries(entries);
}

/** Match codeInputHash while yielding between file chunks. */
async function streamingCodeInputHash(path: string): Promise<string> {
  const size = (await stat(path)).size;
  if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Code source size is not safely bounded: ${path}`);
  const budget = currentObservationScope()?.budget;
  if (budget === undefined) throw new Error("Code source hashing requires an observation scope");
  budget.assertFileBytes(size, path);
  budget.consume("maxTotalBytes", size, "code-producer-input", path);
  const hash = createHash("sha256");
  const frame = (value: string) => { const bytes = Buffer.from(value, "utf8"); const length = Buffer.allocUnsafe(8); length.writeBigUInt64BE(BigInt(bytes.length)); hash.update(length); hash.update(bytes); };
  frame("projector\0sha256\0v1");
  frame("projector-code-input-v1");
  const contentLength = Buffer.allocUnsafe(8);
  contentLength.writeBigUInt64BE(BigInt(Math.ceil(size / 3) * 4 + 2));
  hash.update(contentLength);
  hash.update('"');
  let tail = Buffer.alloc(0);
  let observed = 0;
  for await (const bytes of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    const chunk = Buffer.concat([tail, bytes as Buffer]);
    observed += (bytes as Buffer).length;
    const aligned = Math.floor(chunk.length / 3) * 3;
    if (aligned > 0) hash.update(chunk.subarray(0, aligned).toString("base64"));
    tail = chunk.subarray(aligned);
  }
  if (observed !== size) throw new Error(`Code source changed while hashing: ${path}`);
  if (tail.length > 0) hash.update(tail.toString("base64"));
  hash.update('"');
  return `sha256:v1:${hash.digest("hex")}`;
}

function assertSourceHashes(expected: Record<string, string>, actual: Record<string, string>): void {
  for (const [path, hash] of Object.entries(expected)) {
    if (actual[path] !== hash) throw new Error(`External code producer input changed or has an incorrect source hash: ${path}`);
  }
}

async function runExternalProducer(root: string, input: ReturnType<typeof CodeIndexRequestSchema.parse>, options: ExecutionOptions): Promise<void> {
  const producer = input.producer;
  if (producer === undefined) return;
  const paths = await RepositoryPathService.create(root);
  const expected = input.sourceHashes ?? {};
  if (Object.keys(expected).length === 0) throw new Error("External code producers require explicit sourceHashes for currentness validation");
  assertSourceHashes(expected, await sourceHashes(paths, expected));
  const cwd = (await paths.resolveRead(producer.cwd ?? ".")).realTarget;
  const environment = Object.fromEntries(Object.entries({ ...options.environment, ...producer.environment }).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const result = await new NativeProcessLauncher().launch({ executable: producer.executable, args: [...producer.args], cwd, env: environment, timeoutMs: input.timeoutMs, maxOutputBytes: 1024 * 1024, outputOverflow: "truncate", signal: options.signal });
  if (result.exitCode !== 0) throw new Error(`External code producer failed with exit code ${result.exitCode}: ${result.stderr.slice(0, 4096)}${result.outputTruncated ? " [diagnostic output truncated]" : ""}`);
  assertSourceHashes(expected, await sourceHashes(paths, expected));
  const artifact = await paths.resolveRead(producer.artifact);
  const artifactStatus = await stat(artifact.realTarget);
  const limit = currentObservationScope()?.limits.maxDerivedBytes;
  if (!artifactStatus.isFile() || limit === undefined || (limit !== null && artifactStatus.size > limit)) throw new Error(`External code artifact is unavailable or exceeds maxDerivedBytes: ${producer.artifact}`);
}

function observedHashMap(observation: IndexedRepositoryObservation): Map<string, string> {
  return observation.store.readGeneration(observation.descriptor.generation, () => new Map(
    observation.store.population("inventory").map(path => {
      const entry = observation.store.get<InventoryEntry>("inventory", path);
      if (entry === undefined) throw new Error(`Observed source membership has no bytes: ${path}`);
      return [path, entry.contentHash] as const;
    }),
  ));
}

async function executeWorker(root: string, operation: CodeOperation, input: unknown, options: ExecutionOptions, observe: boolean, existing?: IndexedRepositoryObservation): Promise<unknown> {
  const scope = currentObservationScope();
  if (scope === undefined) throw new Error("Code operations require an observation scope");
  const observation = existing ?? (observe ? await observeIndexedRepository(root) : undefined);
  try {
    return await runObservationTask("code-operation", {
      repositoryRoot: root, operation, input,
      ...(observation === undefined ? {} : { descriptor: observation.descriptor }),
    }, { ...scope, signal: options.signal });
  } finally { if (existing === undefined) observation?.close(); }
}

async function executeExternalIndex(root: string, input: ReturnType<typeof CodeIndexRequestSchema.parse>, options: ExecutionOptions): Promise<unknown> {
  const producer = input.producer;
  if (producer === undefined) throw new Error("External index request has no producer");
  const before = await observeIndexedRepository(root);
  let beforeHashes: Map<string, string>;
  try { beforeHashes = observedHashMap(before); }
  finally { before.close(); }
  await runExternalProducer(root, input, options);
  const after = await observeIndexedRepository(root);
  try {
    const afterHashes = observedHashMap(after);
    const paths = new Set([...beforeHashes.keys(), ...afterHashes.keys()]);
    for (const path of paths) {
      if (path === producer.artifact) continue;
      if (beforeHashes.get(path) !== afterHashes.get(path)) throw new Error(`External code producer changed observed repository input: ${path}`);
    }
    const { producer: _producer, ...request } = input;
    return await executeWorker(root, "code.index", { ...request, provider: producer.format, artifact: producer.artifact }, options, false, after);
  } finally { after.close(); }
}

async function startIndex(root: string, raw: unknown, options: ExecutionOptions): Promise<CodeIndexRun> {
  const input = CodeIndexRequestSchema.parse(raw);
  const callerScope = currentObservationScope();
  if (callerScope === undefined) throw new Error("Code index start requires an authorized observation scope");
  const directory = await runDirectory(root);
  const run: CodeIndexRun = { id: `code_index_${randomUUID()}`, repositoryRoot: root, provider: input.provider, state: "running", startedAt: new Date().toISOString(), ownerPid: process.pid };
  await acquireIndexLock(directory, run);
  try { await writeRun(directory, run); }
  catch (error) { await releaseIndexLock(directory, run.id); throw error; }
  const controller = new AbortController();
  const promise = withRetainedObservationScope({ limits: { ...callerScope.limits, timeoutMs: input.timeoutMs }, signal: controller.signal }, async () => {
    try {
      const runOptions = { ...options, signal: controller.signal };
      const output = (input.provider === "external"
        ? await executeExternalIndex(root, input, runOptions)
        : await executeWorker(root, "code.index", input, runOptions, true)) as { generation?: string };
      if (typeof output.generation !== "string") throw new Error("Code index worker did not publish a generation");
      return await writeRun(directory, { ...run, state: "published", generation: output.generation, finishedAt: new Date().toISOString() });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      return await writeRun(directory, { ...run, state: controller.signal.aborted ? "cancelled" : "failed", finishedAt: new Date().toISOString(), error: failure });
    } finally {
      activeRuns.delete(run.id);
      try { await pruneTerminalRuns(directory); }
      finally { await releaseIndexLock(directory, run.id); }
    }
  });
  void promise.catch(error => process.stderr.write(`${JSON.stringify({ event: "code-index-run-error", runId: run.id, message: error instanceof Error ? error.message : String(error) })}\n`));
  activeRuns.set(run.id, { controller, promise });
  // A one-shot CLI has no resident owner after returning; finish its run before exit.
  if (residentObservationWorkerPool() === undefined) return promise;
  return run;
}

async function waitIndex(root: string, raw: unknown, signal: AbortSignal): Promise<CodeIndexRun> {
  const input = CodeIndexWaitRequestSchema.parse(raw);
  const directory = await runDirectory(root);
  const deadline = Date.now() + input.timeoutMs;
  while (true) {
    signal.throwIfAborted();
    const run = await currentRun(directory, await readRun(directory, input.runId));
    if (run.repositoryRoot !== root) throw new Error("Code index run belongs to another repository");
    if (run.state !== "running" || Date.now() >= deadline) return run;
    await delay(Math.min(100, deadline - Date.now()), undefined, { signal });
  }
}

async function cancelIndex(root: string, raw: unknown): Promise<CodeIndexRun> {
  const input = CodeIndexCancelRequestSchema.parse(raw);
  const directory = await runDirectory(root);
  const run = await currentRun(directory, await readRun(directory, input.runId));
  if (run.repositoryRoot !== root) throw new Error("Code index run belongs to another repository");
  const active = activeRuns.get(run.id);
  if (active === undefined) {
    if (run.state === "running") throw new Error(`Code index run ${run.id} is owned by another process and cannot be cancelled from this connection`);
    return run;
  }
  active.controller.abort(new Error("Code index run cancelled"));
  return active.promise;
}

export async function shutdownCodeIndexRuns(): Promise<void> {
  const runs = [...activeRuns.values()];
  for (const run of runs) run.controller.abort(new Error("Resident code index host shut down"));
  await Promise.all(runs.map(run => run.promise));
}

export async function executeCodeOperation(repositoryRoot: string, operation: CodeOperation, input: unknown, options: ExecutionOptions): Promise<unknown> {
  options.signal.throwIfAborted();
  const root = (await RepositoryPathService.create(repositoryRoot)).root;
  if (operation === "code.index") return startIndex(root, input, options);
  if (operation === "code.index-wait") return waitIndex(root, input, options.signal);
  if (operation === "code.index-cancel") return cancelIndex(root, input);
  if (operation === "code.index-status") {
    const statusInput = CodeIndexStatusRequestSchema.parse(input);
    const directory = await runDirectory(root);
    const base = await executeWorker(root, operation, input, options, false) as Record<string, unknown>;
    if (statusInput.runId !== undefined) {
      let run: CodeIndexRun | undefined;
      if (/^code_index_[0-9a-f-]{36}$/u.test(statusInput.runId)) {
        try { run = await currentRun(directory, await readRun(directory, statusInput.runId)); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
      return CodeIndexStatusSchema.parse({ ...base, runs: run === undefined ? [] : [run], runsTruncated: false });
    }
    const history = await listRuns(directory);
    return CodeIndexStatusSchema.parse({ ...base, runs: history.runs, runsTruncated: history.truncated });
  }
  const request = input as { freshness?: string; generation?: string; after?: string };
  const observe = operation === "code.query" ? request.freshness !== "pinned"
    : operation === "code.tests" || operation === "code.evidence" ? request.generation === undefined
      : operation === "code.impact" ? request.after === undefined : false;
  return executeWorker(root, operation, input, options, observe);
}
