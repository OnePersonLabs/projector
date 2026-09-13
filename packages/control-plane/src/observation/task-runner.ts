import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { AsyncResource } from "node:async_hooks";
import { ObservationError, type ObservationLimits } from "@projector/core";
import { currentObservationScope, type ObservationScope } from "@projector/runtime";
import { assertBoundedObservationData } from "./data-bound.js";
import type { ObservationTaskInputs, ObservationTaskResults } from "./tasks.js";
import type { KnowledgeHostRequest } from "./knowledge-host.js";

export interface ObservationTaskOptions {
  readonly deadline: number;
  readonly limits: ObservationLimits;
  readonly signal?: AbortSignal;
  readonly maxDerivedBytes?: number;
  readonly maxWorkerHeapMiB?: number;
  readonly onHostRequest?: (request: KnowledgeHostRequest, signal: AbortSignal) => Promise<unknown>;
  /** Diagnostic notification after module loading, immediately before computation. */
  readonly onWorkerStarted?: (workerId: number) => void;
}

interface WorkerSlot { worker: Worker; busy: boolean; heapMiB: number }
interface WorkerPool { slots: Set<WorkerSlot>; scope: ObservationScope }
const pools = new WeakMap<object, WorkerPool>();

function acquireWorker(entry: URL, heapMiB: number): { slot: WorkerSlot; pool?: WorkerPool } {
  const scope = currentObservationScope();
  let pool: WorkerPool | undefined;
  if (scope?.isActive()) {
    pool = pools.get(scope.budget);
    if (pool === undefined) {
      pool = { slots: new Set(), scope };
      pools.set(scope.budget, pool);
      const owned = pool;
      scope.registerCleanup(async () => {
        await Promise.all([...owned.slots].map(({ worker }) => worker.terminate()));
        owned.slots.clear();
        pools.delete(scope.budget);
      });
    }
    const idle = [...pool.slots].find((slot) => !slot.busy && slot.heapMiB === heapMiB);
    if (idle !== undefined) { idle.busy = true; return { slot: idle, pool }; }
    if (pool.slots.size >= 4) throw new ObservationError("observation-limit-exceeded", "worker-concurrency", ".", "Observation requires more than four simultaneous computation workers; reduce concurrent work before retrying.");
  }
  const worker = new Worker(entry, { resourceLimits: { maxOldGenerationSizeMb: heapMiB, maxYoungGenerationSizeMb: Math.min(16, heapMiB) }, execArgv: [] });
  const slot: WorkerSlot = { worker, busy: true, heapMiB };
  // An idle worker may fail independently; it must never be reused afterward.
  worker.on("error", () => pool?.slots.delete(slot));
  worker.on("exit", () => pool?.slots.delete(slot));
  pool?.slots.add(slot);
  return { slot, ...(pool === undefined ? {} : { pool }) };
}

/** The only worker entries are shipped Projector code; repository sources are data. */
export async function runObservationTask<K extends keyof ObservationTaskInputs>(
  type: K, input: ObservationTaskInputs[K], options: ObservationTaskOptions,
): Promise<ObservationTaskResults[K]> {
  const maxDerivedBytes = options.maxDerivedBytes ?? options.limits.maxDerivedBytes;
  const maxWorkerHeapMiB = options.maxWorkerHeapMiB ?? options.limits.maxWorkerHeapMiB;
  for (const [name, value] of Object.entries({ maxDerivedBytes, maxWorkerHeapMiB })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer`);
  }
  options.signal?.throwIfAborted();
  // Collected input is separately bounded by source bytes; impact tasks consume derived data.
  let transferLimit = type === "observe" || type === "canonical" || type === "analyze-collected" ? options.limits.maxTotalBytes * 8 : maxDerivedBytes;
  if (type === "authenticate-context" || type === "authenticate-impact") {
    const source = (input as ObservationTaskInputs["authenticate-context"]).source;
    const sourceBytes = Buffer.byteLength(source);
    if (sourceBytes > maxDerivedBytes) throw new ObservationError("observation-limit-exceeded", "derived-read", ".", "Retained derived record exceeds maxDerivedBytes", "maxDerivedBytes", sourceBytes);
    // A JSON source crosses the channel as a string; escaping it is transport overhead.
    transferLimit = maxDerivedBytes * 6 + 1024;
  }
  assertBoundedObservationData(input, transferLimit, options.deadline);
  const entry = import.meta.url.endsWith(".ts")
    ? new URL("../../dist/observation/task-worker.js", import.meta.url)
    : new URL("./task-worker.js", import.meta.url);
  if (!existsSync(entry)) throw new Error("Compiled observation worker is unavailable; build the Projector workspace before running source tests.");
  const remaining = options.deadline - Date.now();
  if (remaining <= 0) throw deadlineError(type);
  const { slot, pool } = acquireWorker(entry, maxWorkerHeapMiB);
  const worker = slot.worker;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const hostAbort = new AbortController();
  const activeHost = new Set<Promise<void>>();
  let succeeded = false;
  let detach: (() => void) | undefined;
  try {
    return await new Promise<ObservationTaskResults[K]>((resolve, reject) => {
      timer = setTimeout(() => reject(deadlineError(type)), remaining);
      abort = () => reject(options.signal?.reason ?? new Error("Observation aborted"));
      options.signal?.addEventListener("abort", abort, { once: true });
      const onError = (error: Error): void => reject("code" in error && error.code === "ERR_WORKER_OUT_OF_MEMORY"
        ? new ObservationError("observation-limit-exceeded", type, ".", "Observation worker exceeded maxWorkerHeapMiB; explicitly revise the finite allowance to retry.", "maxWorkerHeapMiB", maxWorkerHeapMiB)
        : error);
      const onExit = (code: number): void => reject(new Error(`Observation worker exited before returning ${type} (code ${code})`));
      const onMessage = (message: { started?: boolean; hostRequest?: KnowledgeHostRequest; id?: number; ok: boolean; result?: ObservationTaskResults[K]; error?: { message: string; name?: string; code?: string; stage?: string; scope?: string } }): void => {
        if (message.started === true) {
          try { options.onWorkerStarted?.(worker.threadId); } catch (error) { reject(error); }
          return;
        }
        if (message.hostRequest !== undefined) {
          const request = message.hostRequest;
          const pending = (async () => {
            try {
              if (options.onHostRequest === undefined) throw new Error("Observation worker requested an unavailable host operation");
              const result = await options.onHostRequest(request, hostAbort.signal);
              assertBoundedObservationData(result, maxDerivedBytes, options.deadline);
              worker.postMessage({ id: message.id, ok: true, result });
            } catch (error) {
              const failure = error as { message?: string; name?: string; code?: string; stage?: string; scope?: string };
              worker.postMessage({ id: message.id, ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope } });
            }
          })();
          activeHost.add(pending);
          void pending.then(() => activeHost.delete(pending), () => activeHost.delete(pending));
          return;
        }
        if (Date.now() >= options.deadline) { reject(deadlineError(type)); return; }
        if (message.ok) { succeeded = true; resolve(message.result!); }
        else if (message.error?.code === "observation-limit-exceeded" || message.error?.code === "observation-failed") reject(new ObservationError(message.error.code, message.error.stage ?? type, message.error.scope ?? ".", message.error.message));
        else {
          const error = new Error(message.error?.message ?? "Observation worker failed");
          error.name = message.error?.name ?? "Error";
          reject(error);
        }
      };
      worker.once("error", onError);
      worker.once("exit", onExit);
      // Worker events inherit the worker's creation scope. A reused worker must
      // dispatch host reads under this task's current signal and budget instead.
      const boundMessage = AsyncResource.bind(onMessage);
      worker.on("message", boundMessage);
      detach = () => { worker.off("error", onError); worker.off("exit", onExit); worker.off("message", boundMessage); };
      worker.postMessage({ task: { type, input }, deadline: options.deadline, maxDerivedBytes });
      if (options.signal?.aborted) abort();
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (abort !== undefined) options.signal?.removeEventListener("abort", abort);
    hostAbort.abort(new Error("Observation worker stopped"));
    // Failed tasks never return while their computation remains alive.
    if (!succeeded || pool === undefined || !pool.scope.isActive()) {
      await worker.terminate();
      pool?.slots.delete(slot);
    }
    await Promise.allSettled(activeHost);
    detach?.();
    slot.busy = false;
  }
}

function deadlineError(stage: string): ObservationError {
  return new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs");
}
