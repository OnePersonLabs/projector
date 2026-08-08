import { hashFramedDomain, type ContentHash } from "@projector/core";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { posix } from "node:path";
import { RepositoryPathService } from "../security/repository-path.js";

export type WatchEventKind = "create" | "change" | "delete" | "rename" | "overflow" | "generated";
export interface WatchEvent { readonly kind: WatchEventKind; readonly path: string; readonly to?: string }
export interface AuthenticatedWatchScan { readonly digest: ContentHash; readonly affectedDependencyIds: readonly string[]; readonly generatedEventIds: readonly string[]; readonly contentHash: ContentHash }
export interface WatchProcessResult { readonly digest: ContentHash; readonly cacheKeys: readonly string[]; readonly followUpEvents?: readonly WatchEvent[] }
export interface WatchPorts { readonly scan: (input: { readonly fullScan: boolean; readonly paths: readonly string[]; readonly events: readonly WatchEvent[] }) => Promise<AuthenticatedWatchScan>; readonly process: (scan: AuthenticatedWatchScan) => Promise<WatchProcessResult> }
export interface WatchResult { readonly digest: ContentHash; readonly fullScan: boolean; readonly paths: readonly string[]; readonly invalidatedDependencyIds: readonly string[]; readonly preservedCacheKeys: readonly string[]; readonly generatedEventIds: readonly string[]; readonly iterations: number }
export interface WatchEventSource { readonly subscribe: (listener: (event: WatchEvent) => void, failure: (error: unknown) => void) => () => void }
export interface WatchCheckpoint { readonly version: 1; readonly sequence: number; readonly pendingEvents: readonly WatchEvent[]; readonly lastResult: WatchResult }
export interface AuthenticatedWatchCheckpoint extends WatchCheckpoint { readonly contentHash: ContentHash }
export interface WatchCheckpointStore { readonly load: () => Promise<AuthenticatedWatchCheckpoint | null>; readonly save: (checkpoint: AuthenticatedWatchCheckpoint) => Promise<AuthenticatedWatchCheckpoint>; readonly clear: (contentHash: ContentHash) => Promise<void> }
export interface WatchLifecycleResult { readonly cancelled: boolean; readonly budgetExhausted: boolean; readonly processedEvents: number; readonly lastResult: WatchResult; readonly checkpoint?: AuthenticatedWatchCheckpoint }

const unique = (values: readonly string[]) => [...new Set(values)].sort();
export class WatchCoordinator {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly ports: WatchPorts, private readonly options: { readonly maximumIterations?: number } = {}) {}
  submit(events: readonly WatchEvent[]): Promise<WatchResult> { const run = this.tail.then(() => this.run(events)); this.tail = run.catch(() => undefined); return run; }
  private async run(initial: readonly WatchEvent[]): Promise<WatchResult> {
    let events = [...initial]; const seen = new Set<ContentHash>(); const maximum = this.options.maximumIterations ?? 8; let latest: WatchResult | undefined;
    for (let iteration = 1; iteration <= maximum; iteration += 1) {
      const fullScan = events.some(({ kind }) => kind === "overflow"); const paths = unique(events.flatMap(({ path, to }) => [path, ...(to === undefined ? [] : [to])]).filter((path) => path !== "."));
      const scan = await this.ports.scan({ fullScan, paths, events: [...events] }); const value = { digest: scan.digest, affectedDependencyIds: [...scan.affectedDependencyIds], generatedEventIds: [...scan.generatedEventIds] };
      if (scan.contentHash !== hashFramedDomain("authenticated-watch-scan", value)) throw new Error("watch scan authentication failed");
      const processed = await this.ports.process(scan); if (processed.digest !== scan.digest) throw new Error("watch process digest mismatch");
      const invalidated = unique(scan.affectedDependencyIds); latest = { digest: scan.digest, fullScan, paths, invalidatedDependencyIds: invalidated, preservedCacheKeys: unique(processed.cacheKeys.filter((key) => !invalidated.includes(key))), generatedEventIds: unique(scan.generatedEventIds), iterations: iteration };
      const follow = processed.followUpEvents ?? []; if (follow.length === 0) return latest;
      if (seen.has(scan.digest)) throw new Error(`nonconvergent watch repeated digest ${scan.digest}`); seen.add(scan.digest); events = [...follow];
    }
    throw new Error(`nonconvergent watch exceeded ${maximum} iterations (${latest?.digest ?? "no digest"})`);
  }
}

const checkpointBody = (checkpoint: WatchCheckpoint): WatchCheckpoint => ({ version: 1, sequence: checkpoint.sequence, pendingEvents: checkpoint.pendingEvents, lastResult: checkpoint.lastResult });
export function authenticateWatchCheckpoint(checkpoint: AuthenticatedWatchCheckpoint): boolean { return checkpoint.version === 1 && Number.isSafeInteger(checkpoint.sequence) && checkpoint.sequence >= 0 && checkpoint.contentHash === hashFramedDomain("authenticated-watch-checkpoint", checkpointBody(checkpoint)); }
export class FileWatchCheckpointStore implements WatchCheckpointStore {
  private constructor(private readonly paths: RepositoryPathService, private readonly path: string) {}
  static async create(paths: RepositoryPathService, path = ".projector/watch/checkpoint.json"): Promise<FileWatchCheckpointStore> { const canonical = paths.canonicalize(path); await mkdir((await paths.resolveWrite(posix.dirname(canonical))).realTarget, { recursive: true }); return new FileWatchCheckpointStore(paths, canonical); }
  async load(): Promise<AuthenticatedWatchCheckpoint | null> { let bytes: string; try { bytes = await readFile((await this.paths.resolveRead(this.path)).realTarget, "utf8"); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return null; throw error; } let checkpoint: AuthenticatedWatchCheckpoint; try { checkpoint = JSON.parse(bytes) as AuthenticatedWatchCheckpoint; } catch { throw new Error("watch checkpoint is corrupt"); } if (!authenticateWatchCheckpoint(checkpoint)) throw new Error("watch checkpoint authentication failed"); return checkpoint; }
  async save(checkpoint: AuthenticatedWatchCheckpoint): Promise<AuthenticatedWatchCheckpoint> { if (!authenticateWatchCheckpoint(checkpoint)) throw new Error("watch checkpoint authentication failed"); const temporary = `${this.path}.${process.pid}.tmp`; const target = await this.paths.resolveWrite(this.path); const temporaryTarget = await this.paths.resolveWrite(temporary); try { await writeFile(temporaryTarget.realTarget, `${JSON.stringify(checkpoint)}\n`, { encoding: "utf8", flag: "wx" }); await rename(temporaryTarget.realTarget, target.realTarget); } finally { await rm(temporaryTarget.realTarget, { force: true }); } return checkpoint; }
  async clear(contentHash: ContentHash): Promise<void> { const checkpoint = await this.load(); if (checkpoint === null) return; if (checkpoint.contentHash !== contentHash) throw new Error("watch checkpoint changed before clear"); await rm((await this.paths.resolveWrite(this.path)).realTarget, { force: true }); }
}

export async function runWatchLifecycle(coordinator: WatchCoordinator, source: WatchEventSource, options: { readonly signal: AbortSignal; readonly maximumEvents?: number; readonly checkpointStore?: WatchCheckpointStore }): Promise<WatchLifecycleResult> {
  const maximumEvents = options.maximumEvents ?? 10_000; if (!Number.isSafeInteger(maximumEvents) || maximumEvents < 1) throw new Error("watch event budget must be positive");
  const prior = await options.checkpointStore?.load() ?? null; if (prior !== null && !authenticateWatchCheckpoint(prior)) throw new Error("watch checkpoint authentication failed"); let processedEvents = 0; let lastResult: WatchResult | undefined; let tail = Promise.resolve(); const pendingEvents: WatchEvent[] = []; let settle: (() => void) | undefined; let rejectFailure: ((error: unknown) => void) | undefined; const done = new Promise<void>((resolve, reject) => { settle = resolve; rejectFailure = reject; });
  const enqueue = (events: readonly WatchEvent[]) => { tail = tail.then(async () => { const capacity = maximumEvents - processedEvents; const accepted = events.slice(0, Math.max(0, capacity)); pendingEvents.push(...events.slice(accepted.length)); if (accepted.length > 0) { processedEvents += accepted.length; lastResult = await coordinator.submit(accepted); } if (processedEvents >= maximumEvents) settle?.(); }).catch((error) => rejectFailure?.(error)); };
  let closed = false; const closeSource = source.subscribe((event) => enqueue([event]), (error) => rejectFailure?.(error)); const close = () => { if (!closed) { closed = true; closeSource(); } };
  const abort = () => settle?.(); options.signal.addEventListener("abort", abort, { once: true });
  try { lastResult = await coordinator.submit([{ kind: "overflow", path: "." }]); if (prior !== null) enqueue(prior.pendingEvents); if (options.signal.aborted) settle?.(); await done; close(); await tail; if (lastResult === undefined) throw new Error("watch lifecycle produced no authenticated scan"); const budgetExhausted = !options.signal.aborted && processedEvents >= maximumEvents; if (budgetExhausted) { if (options.checkpointStore === undefined) return { cancelled: false, budgetExhausted, processedEvents, lastResult }; const body = { version: 1 as const, sequence: (prior?.sequence ?? 0) + processedEvents, pendingEvents: [...pendingEvents], lastResult }; const checkpoint = await options.checkpointStore.save({ ...body, contentHash: hashFramedDomain("authenticated-watch-checkpoint", body) }); return { cancelled: false, budgetExhausted, processedEvents, lastResult, checkpoint }; } if (prior !== null && options.checkpointStore !== undefined) await options.checkpointStore.clear(prior.contentHash); return { cancelled: options.signal.aborted, budgetExhausted: false, processedEvents, lastResult }; }
  finally { close(); options.signal.removeEventListener("abort", abort); }
}
