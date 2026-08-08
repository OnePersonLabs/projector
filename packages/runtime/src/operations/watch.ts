import { hashFramedDomain, type ContentHash } from "@projector/core";

export type WatchEventKind = "create" | "change" | "delete" | "rename" | "overflow" | "generated";
export interface WatchEvent { readonly kind: WatchEventKind; readonly path: string; readonly to?: string }
export interface AuthenticatedWatchScan { readonly digest: ContentHash; readonly affectedDependencyIds: readonly string[]; readonly generatedEventIds: readonly string[]; readonly contentHash: ContentHash }
export interface WatchProcessResult { readonly digest: ContentHash; readonly cacheKeys: readonly string[]; readonly followUpEvents?: readonly WatchEvent[] }
export interface WatchPorts { readonly scan: (input: { readonly fullScan: boolean; readonly paths: readonly string[]; readonly events: readonly WatchEvent[] }) => Promise<AuthenticatedWatchScan>; readonly process: (scan: AuthenticatedWatchScan) => Promise<WatchProcessResult> }
export interface WatchResult { readonly digest: ContentHash; readonly fullScan: boolean; readonly paths: readonly string[]; readonly invalidatedDependencyIds: readonly string[]; readonly preservedCacheKeys: readonly string[]; readonly generatedEventIds: readonly string[]; readonly iterations: number }
export interface WatchEventSource { readonly subscribe: (listener: (event: WatchEvent) => void, failure: (error: unknown) => void) => () => void }
export interface WatchLifecycleResult { readonly cancelled: boolean; readonly budgetExhausted: boolean; readonly processedEvents: number; readonly lastResult: WatchResult }

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

export async function runWatchLifecycle(coordinator: WatchCoordinator, source: WatchEventSource, options: { readonly signal: AbortSignal; readonly maximumEvents?: number }): Promise<WatchLifecycleResult> {
  const maximumEvents = options.maximumEvents ?? 10_000; if (!Number.isSafeInteger(maximumEvents) || maximumEvents < 1) throw new Error("watch event budget must be positive");
  let processedEvents = 0; let lastResult: WatchResult | undefined; let tail = Promise.resolve(); let settle: (() => void) | undefined; let rejectFailure: ((error: unknown) => void) | undefined; const done = new Promise<void>((resolve, reject) => { settle = resolve; rejectFailure = reject; });
  const enqueue = (events: readonly WatchEvent[]) => { tail = tail.then(async () => { if (processedEvents + events.length > maximumEvents) { settle?.(); return; } processedEvents += events.length; lastResult = await coordinator.submit(events); if (processedEvents >= maximumEvents) settle?.(); }).catch((error) => rejectFailure?.(error)); };
  const close = source.subscribe((event) => enqueue([event]), (error) => rejectFailure?.(error));
  const abort = () => settle?.(); options.signal.addEventListener("abort", abort, { once: true });
  try { lastResult = await coordinator.submit([{ kind: "overflow", path: "." }]); if (options.signal.aborted) settle?.(); await done; await tail; if (lastResult === undefined) throw new Error("watch lifecycle produced no authenticated scan"); return { cancelled: options.signal.aborted, budgetExhausted: !options.signal.aborted && processedEvents >= maximumEvents, processedEvents, lastResult }; }
  finally { close(); options.signal.removeEventListener("abort", abort); }
}
