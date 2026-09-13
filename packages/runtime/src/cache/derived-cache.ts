import { randomUUID } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, mkdir, open, opendir, readFile, readdir, rename, rm, rmdir, utimes } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_OBSERVATION_LIMITS } from "@projector/core";
import { RepositoryPathService } from "../security/repository-path.js";
import { projectOperationProcessIsAlive } from "../access/operation-access.js";

export const DERIVED_CACHE_MAX_BYTES = 256 * 1024 * 1024;
const roots = [".projector/runtime/knowledge/contexts", ".projector/runtime/impact"] as const;
const mutex = ".projector/runtime/cache-admission";
export interface DerivedCacheBudget { deadline: number; remainingEntries: number; remainingBytes: number }
export interface DerivedCacheWrite { readonly relativePath: string; readonly content: string }
export interface DerivedCacheEntry { readonly relativePath: string; readonly bytes: number; readonly lastUsedMs: number; readonly kind: "context" | "impact" | "staging" }
export interface DerivedCacheOptions { readonly maxBytes?: number; readonly signal?: AbortSignal; readonly deadline?: number; readonly budget?: DerivedCacheBudget }
export interface DerivedCacheSession {
  readonly entries: readonly DerivedCacheEntry[];
  readonly totalBytes: number;
  publish(relativePath: string, content: string): Promise<void>;
  publishAll(writes: readonly DerivedCacheWrite[]): Promise<void>;
  remove(entry: DerivedCacheEntry): Promise<void>;
}
export class DerivedCacheError extends Error {
  constructor(readonly code: "cache-capacity" | "cache-corrupt" | "cache-busy" | "cache-budget", message: string) { super(message); this.name = "DerivedCacheError"; }
}

/** Serializes admission across processes. Every publication accounts for the staging peak first. */
export async function withDerivedCacheAdmission<T>(root: string, body: (session: DerivedCacheSession) => Promise<T>, options: DerivedCacheOptions = {}): Promise<T> {
  const operationDeadline = options.deadline ?? options.budget?.deadline;
  if (operationDeadline !== undefined && !Number.isFinite(operationDeadline)) throw new RangeError("Cache admission deadline must be finite");
  checkAdmission(options.signal, operationDeadline);
  const maximum = options.maxBytes ?? DERIVED_CACHE_MAX_BYTES;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > DERIVED_CACHE_MAX_BYTES) throw new RangeError("Invalid derived cache capacity");
  const paths = await RepositoryPathService.create(root);
  const runtime = (await paths.resolveWrite(".projector/runtime")).realTarget;
  await mkdir(runtime, { recursive: true });
  const deadline = Date.now() + 5_000;
  const lockPath = (await paths.resolveWrite(mutex)).realTarget;
  const owner = `owner-${process.pid}-${randomUUID()}`;
  const candidate = `${mutex}-claim-${owner}`;
  const candidatePath = (await paths.resolveWrite(candidate)).realTarget;
  await reclaimAbandonedCandidates(paths);
  await mkdir(candidatePath);
  let acquired = false;
  try {
    await mkdir((await paths.resolveWrite(`${candidate}/${owner}`)).realTarget);
    while (true) {
      checkAdmission(options.signal, operationDeadline);
      await paths.resolveWrite(mutex);
      try { await rename(candidatePath, lockPath); acquired = true; break; }
      catch (error) {
        if (!isCode(error, "EEXIST") && !isCode(error, "ENOTEMPTY") && !isCode(error, "EPERM")) throw error;
        if (await reclaimDeadLock(paths, mutex)) continue;
        if (Date.now() >= deadline) throw new DerivedCacheError("cache-busy", "Derived cache admission is held by a live process; retry after active operations finish");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    const budget = options.budget ?? { deadline: Math.min(Date.now() + 5_000, operationDeadline ?? Infinity), remainingEntries: 10_000, remainingBytes: DEFAULT_OBSERVATION_LIMITS.maxDerivedBytes };
    const records = await scan(paths, budget);
    checkAdmission(options.signal, operationDeadline);
    const session = new CacheSession(paths, records, maximum, options.signal, operationDeadline);
    try { const result = await body(session); checkAdmission(options.signal, operationDeadline); return result; }
    finally { session.close(); }
  } finally {
    if (acquired) {
      // Retire the complete claim atomically so contenders never observe an ownerless live lock.
      const marker = await lstat((await paths.resolveRead(`${mutex}/${owner}`)).realTarget);
      if (!marker.isDirectory() || marker.isSymbolicLink()) throw new DerivedCacheError("cache-corrupt", "Cache admission ownership changed before release");
      await rename((await paths.resolveWrite(mutex)).realTarget, candidatePath);
    }
    try { await rmdir((await paths.resolveWrite(`${candidate}/${owner}`)).realTarget); }
    catch (error) { if (!isCode(error, "ENOENT")) throw error; }
    await rmdir((await paths.resolveWrite(candidate)).realTarget);
  }
}

const ownerPattern = /^owner-([1-9][0-9]*)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
async function reclaimDeadLock(paths: RepositoryPathService, relativePath: string, candidateOwner?: string): Promise<boolean> {
  const target = (await paths.resolveRead(relativePath)).realTarget;
  let identity;
  try { identity = await lstat(target, { bigint: true }); }
  catch (error) { if (isCode(error, "ENOENT")) return true; throw error; }
  if (!identity.isDirectory() || identity.isSymbolicLink()) throw new DerivedCacheError("cache-corrupt", "Cache admission claim is not a real directory");
  const entries = await readdir(target, { withFileTypes: true });
  const owner = candidateOwner ?? entries[0]?.name;
  const match = owner === undefined ? null : ownerPattern.exec(owner);
  if (match === null || entries.length > 1 || (entries.length === 0 && candidateOwner === undefined) || entries.some((entry) => entry.name !== owner || !entry.isDirectory() || entry.isSymbolicLink())) throw new DerivedCacheError("cache-corrupt", "Cache admission owner is ambiguous; preserve the claim for inspection");
  const pid = Number(match[1]);
  if (!Number.isSafeInteger(pid) || pid > 2147483647) throw new DerivedCacheError("cache-corrupt", "Cache admission process identity is invalid");
  if (projectOperationProcessIsAlive(pid)) return false;
  if (owner === undefined) throw new DerivedCacheError("cache-corrupt", "Cache admission owner is missing");
  const current = await lstat(target, { bigint: true });
  if (current.dev !== identity.dev || current.ino !== identity.ino) throw new DerivedCacheError("cache-corrupt", "Cache admission owner changed during recovery");
  if (entries.length !== 0) {
    try { await rmdir((await paths.resolveWrite(`${relativePath}/${owner}`)).realTarget); }
    catch (error) { if (!isCode(error, "ENOENT")) throw error; }
  }
  try { await rmdir((await paths.resolveWrite(relativePath)).realTarget); }
  catch (error) { if (!isCode(error, "ENOENT") && !isCode(error, "ENOTEMPTY") && !isCode(error, "EEXIST")) throw error; }
  return true;
}
async function reclaimAbandonedCandidates(paths: RepositoryPathService): Promise<void> {
  const directory = await opendir((await paths.resolveRead(".projector/runtime")).realTarget);
  let remaining = 10_000;
  for await (const entry of directory) {
    if (--remaining < 0) throw new DerivedCacheError("cache-budget", "Runtime claim discovery exceeds the bounded cache admission inspection");
    const prefix = "cache-admission-claim-";
    if (entry.name.startsWith(prefix)) await reclaimDeadLock(paths, `.projector/runtime/${entry.name}`, entry.name.slice(prefix.length));
  }
}

interface RecordEntry { entry: DerivedCacheEntry; identity: BigIntStats }
class CacheSession implements DerivedCacheSession {
  private usable = true;
  private writing = false;
  constructor(private readonly paths: RepositoryPathService, private readonly records: Map<string, RecordEntry>, private readonly maximum: number, private readonly signal?: AbortSignal, private readonly deadline?: number) {}
  get entries(): readonly DerivedCacheEntry[] { return [...this.records.values()].map(({ entry }) => entry); }
  get totalBytes(): number { return this.entries.reduce((sum, entry) => sum + entry.bytes, 0); }
  close(): void { this.usable = false; }
  async publish(relativePath: string, content: string): Promise<void> { await this.publishAll([{ relativePath, content }]); }
  async publishAll(writes: readonly DerivedCacheWrite[]): Promise<void> {
    if (!this.usable || this.writing) throw new DerivedCacheError("cache-busy", "Cache admission session is closed, failed, or already publishing");
    this.writing = true;
    try { await this.publishBatch(writes); }
    catch (error) { if (!(error instanceof DerivedCacheError) || error.code !== "cache-capacity") this.usable = false; throw error; }
    finally { this.writing = false; }
  }
  private async publishBatch(writes: readonly DerivedCacheWrite[]): Promise<void> {
    checkAdmission(this.signal, this.deadline);
    const unique = new Map<string, DerivedCacheWrite>();
    for (const write of writes) {
      if (classify(write.relativePath) === "staging") throw new DerivedCacheError("cache-corrupt", "Cannot publish a staging path");
      if (unique.has(write.relativePath) && unique.get(write.relativePath)!.content !== write.content) throw new DerivedCacheError("cache-corrupt", "Conflicting cache batch addresses");
      unique.set(write.relativePath, write);
    }
    const pending: DerivedCacheWrite[] = [];
    let projected = this.totalBytes;
    if (projected > this.maximum) throw capacity();
    for (const write of unique.values()) {
      const existing = this.records.get(write.relativePath);
      if (existing !== undefined) {
        // LRU touches are metadata changes. Exact bytes, identity and size establish reuse.
        const target = await this.checked(existing, false);
        if (await readFile(target, { encoding: "utf8", ...(this.signal === undefined ? {} : { signal: this.signal }) }) !== write.content) throw new DerivedCacheError("cache-corrupt", `Derived cache content differs at ${write.relativePath}; inspect and remove only this disposable entry before refreshing context`);
        await this.checked(existing, false);
        checkAdmission(this.signal, this.deadline);
      } else {
        const bytes = Buffer.byteLength(write.content);
        // Publication links the stage before removing its name. Count both names conservatively.
        if (projected + bytes * 2 > this.maximum) throw capacity();
        projected += bytes;
        pending.push(write);
      }
    }
    const publishedContexts: RecordEntry[] = [];
    try {
      for (const write of pending) {
        await this.writeNew(write);
        const record = this.records.get(write.relativePath)!;
        if (record.entry.kind === "context") publishedContexts.push(record);
      }
      checkAdmission(this.signal, this.deadline);
    } catch (error) {
      if (this.signal?.aborted === true || (this.deadline !== undefined && Date.now() >= this.deadline)) {
        for (const record of publishedContexts) {
          await rm(await this.checked(record, false));
          this.records.delete(record.entry.relativePath);
        }
      }
      throw error;
    }
  }
  async remove(entry: DerivedCacheEntry): Promise<void> {
    if (!this.usable || this.writing) throw new DerivedCacheError("cache-busy", "Cannot collect using a closed session or during cache publication");
    checkAdmission(this.signal, this.deadline);
    const record = this.records.get(entry.relativePath);
    if (record === undefined || record.entry !== entry) throw new DerivedCacheError("cache-corrupt", "Cache deletion did not name an inspected entry");
    const target = await this.checked(record);
    await rm(target);
    this.records.delete(entry.relativePath);
  }
  private async checked(record: RecordEntry, checkMtime = true): Promise<string> {
    const target = (await this.paths.resolveRead(record.entry.relativePath)).realTarget;
    const current = await lstat(target, { bigint: true });
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== record.identity.dev || current.ino !== record.identity.ino || current.size !== record.identity.size || (checkMtime && current.mtimeNs !== record.identity.mtimeNs)) throw new DerivedCacheError("cache-corrupt", `Derived cache changed during admission: ${record.entry.relativePath}`);
    return target;
  }
  private async writeNew(write: DerivedCacheWrite): Promise<void> {
    checkAdmission(this.signal, this.deadline);
    const initial = (await this.paths.resolveWrite(write.relativePath)).realTarget;
    await mkdir(dirname(initial), { recursive: true });
    const destination = (await this.paths.resolveWrite(write.relativePath)).realTarget;
    const temporaryRelative = `${write.relativePath}.${process.pid}.${randomUUID()}.tmp`;
    const temporary = (await this.paths.resolveWrite(temporaryRelative)).realTarget;
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    let linked = false;
    let writtenIdentity: BigIntStats | undefined;
    try {
      try {
        try {
          const bytes = Buffer.from(write.content, "utf8");
          for (let offset = 0; offset < bytes.length;) {
            checkAdmission(this.signal, this.deadline);
            const { bytesWritten } = await handle.write(bytes.subarray(offset, offset + 64 * 1024));
            if (bytesWritten === 0) throw new Error("Derived cache staging write made no progress");
            offset += bytesWritten;
          }
          await handle.sync();
          writtenIdentity = await handle.stat({ bigint: true });
        } finally { await handle.close(); }
        await this.paths.resolveWrite(write.relativePath);
        await this.paths.resolveWrite(temporaryRelative);
        checkAdmission(this.signal, this.deadline);
        await link(temporary, destination);
        linked = true;
        checkAdmission(this.signal, this.deadline);
      } finally { await this.paths.resolveWrite(temporaryRelative); await rm(temporary); }
      const identity = await lstat(destination, { bigint: true });
      checkAdmission(this.signal, this.deadline);
      this.records.set(write.relativePath, { identity, entry: { relativePath: write.relativePath, bytes: Number(identity.size), lastUsedMs: Number(identity.mtimeMs), kind: classify(write.relativePath) } });
    } catch (error) {
      if (linked && classify(write.relativePath) === "context" && writtenIdentity !== undefined) {
        const current = await lstat((await this.paths.resolveRead(write.relativePath)).realTarget, { bigint: true });
        if (current.dev !== writtenIdentity.dev || current.ino !== writtenIdentity.ino) throw new DerivedCacheError("cache-corrupt", "New context identity changed before cancelled publication cleanup");
        await rm(destination);
      }
      throw error;
    }
  }
}

async function scan(paths: RepositoryPathService, budget: DerivedCacheBudget): Promise<Map<string, RecordEntry>> {
  const records = new Map<string, RecordEntry>();
  for (const root of roots) {
    const directory = (await paths.resolveRead(root)).realTarget;
    let handle;
    try { handle = await opendir(directory); }
    catch (error) { if (isCode(error, "ENOENT")) continue; throw error; }
    for await (const entry of handle) {
      budget.remainingEntries -= 1;
      checkDerivedCacheBudget(budget);
      const relativePath = `${root}/${entry.name}`;
      const kind = classify(relativePath);
      const target = (await paths.resolveRead(relativePath)).realTarget;
      const identity = await lstat(target, { bigint: true });
      if (!identity.isFile() || identity.isSymbolicLink()) throw new DerivedCacheError("cache-corrupt", `Derived cache entry must be a regular file: ${relativePath}`);
      records.set(relativePath, { identity, entry: { relativePath, bytes: Number(identity.size), lastUsedMs: Number(identity.mtimeMs), kind } });
    }
  }
  const links = new Map<string, number>();
  for (const { identity } of records.values()) { const key = `${identity.dev}:${identity.ino}`; links.set(key, (links.get(key) ?? 0) + 1); }
  for (const { identity, entry } of records.values()) {
    if (identity.nlink !== BigInt(links.get(`${identity.dev}:${identity.ino}`)!)) throw new DerivedCacheError("cache-corrupt", `Derived cache entry has links outside the disposable cache: ${entry.relativePath}`);
  }
  return records;
}

function classify(path: string): DerivedCacheEntry["kind"] {
  const match = /^\.projector\/runtime\/(knowledge\/contexts\/[0-9a-f]{32}|impact\/[0-9a-f]{64})\.json(\.\d+\.(?:[0-9a-f-]+)\.tmp)?$/u.exec(path);
  if (match === null) throw new DerivedCacheError("cache-corrupt", `Unrecognized disposable cache entry: ${path}`);
  return match[2] !== undefined ? "staging" : path.includes("/contexts/") ? "context" : "impact";
}
export function checkDerivedCacheBudget(budget: DerivedCacheBudget): void {
  if (Date.now() > budget.deadline || budget.remainingEntries < 0 || budget.remainingBytes < 0) throw new DerivedCacheError("cache-budget", "Derived cache maintenance could not complete its bounded safety inspection; no unproven entries may be removed");
}
export async function touchDerivedCacheEntry(root: string, relativePath: string): Promise<void> {
  classify(relativePath);
  const paths = await RepositoryPathService.create(root);
  const target = (await paths.resolveRead(relativePath)).realTarget;
  const status = await lstat(target);
  if (!status.isFile() || status.isSymbolicLink()) throw new DerivedCacheError("cache-corrupt", `Invalid cache entry: ${relativePath}`);
  const now = new Date();
  await utimes(target, now, now);
}
function capacity(): DerivedCacheError { return new DerivedCacheError("cache-capacity", "Derived cache capacity cannot admit this publication including staging; finish or recover protected operations, run cache maintenance, then request fresh context"); }
function checkAdmission(signal?: AbortSignal, deadline?: number): void {
  signal?.throwIfAborted();
  if (deadline !== undefined && Date.now() >= deadline) throw new DerivedCacheError("cache-budget", "Derived cache publication exceeded the operation deadline; retry with an explicit larger observation allowance");
}
function isCode(error: unknown, code: string): boolean { return error instanceof Error && "code" in error && error.code === code; }
