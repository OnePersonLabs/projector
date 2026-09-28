import { existsSync } from "node:fs";
import { AsyncResource } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { ObservationError, observationLimitValue, type ObservationLimits } from "@projector/core";
import { inventoryForTransport } from "@projector/analyzers";
import { currentObservationScope, SqliteCodeStore } from "@projector/runtime";
import { assertBoundedObservationData } from "./data-bound.js";
import type { ObservationTaskFailure, ObservationTaskInputs, ObservationTaskResults } from "./tasks.js";
import type { KnowledgeHostRequest } from "./knowledge-host.js";
import { residentObservationWorkerPool, ResidentObservationWorkerPool, type ResidentWorkerSlot } from "./resident-pool.js";

export interface ObservationTaskOptions {
  readonly deadline: number;
  readonly limits: ObservationLimits;
  readonly signal?: AbortSignal;
  readonly maxDerivedBytes?: number | null;
  readonly maxWorkerHeapMiB?: number | null;
  readonly onHostRequest?: (request: KnowledgeHostRequest, signal: AbortSignal) => Promise<unknown>;
  /** Diagnostic notification after module loading, immediately before computation. */
  readonly onWorkerStarted?: (workerId: number) => void;
}

interface WorkerSlot extends ResidentWorkerSlot {}
interface SemanticLeaseNotice { readonly scope: string; readonly token: string; readonly repositoryRoot: string }
interface SemanticLeaseEnding { readonly scope: string; readonly token: string }
function isSqliteBusy(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ERR_SQLITE_ERROR" || error.code === "SQLITE_BUSY") && /database is locked|SQLITE_BUSY/u.test(error.message);
}
function taskInputForTransport<K extends keyof ObservationTaskInputs>(type: K, input: ObservationTaskInputs[K]): ObservationTaskInputs[K] {
  if (type === "analyze-javascript") {
    const javascriptInput = input as ObservationTaskInputs["analyze-javascript"];
    return { inventory: inventoryForTransport(javascriptInput.inventory) } as ObservationTaskInputs[K];
  }
  if (type !== "observe" && type !== "observe-indexed" && type !== "analyze-collected" && type !== "analyze-incremental") return input;
  const collectedInput = input as ObservationTaskInputs["analyze-collected"];
  return {
    ...collectedInput,
    collected: {
      ...collectedInput.collected,
      inventoryResult: inventoryForTransport(collectedInput.collected.inventoryResult),
    },
  } as ObservationTaskInputs[K];
}
const scopedPools = new WeakMap<object, ResidentObservationWorkerPool>();

async function acquireWorker(entry: URL, heapMiB: number, deadline: number, signal?: AbortSignal, autoMemory = false): Promise<{ slot: WorkerSlot; resident: ResidentObservationWorkerPool; oneShot?: true }> {
  let resident = residentObservationWorkerPool();
  if (resident !== undefined) return { slot: await resident.acquire(entry, heapMiB, deadline, signal, autoMemory), resident };
  const scope = currentObservationScope();
  if (scope?.isActive()) {
    resident = scopedPools.get(scope.budget);
    if (resident === undefined) {
      resident = new ResidentObservationWorkerPool(4);
      scopedPools.set(scope.budget, resident);
      const owned = resident;
      scope.registerCleanup(async () => { await owned.close(); scopedPools.delete(scope.budget); });
    }
    return { slot: await resident.acquire(entry, heapMiB, deadline, signal, autoMemory), resident };
  }
  const oneShot = new ResidentObservationWorkerPool(1);
  return { slot: await oneShot.acquire(entry, heapMiB, deadline, signal, autoMemory), resident: oneShot, oneShot: true };
}

/** The only worker entries are shipped Projector code; repository sources are data. */
export async function runObservationTask<K extends keyof ObservationTaskInputs>(
  type: K, input: ObservationTaskInputs[K], options: ObservationTaskOptions,
): Promise<ObservationTaskResults[K]> {
  const transportInput = taskInputForTransport(type, input);
  const maxDerivedBytes = options.maxDerivedBytes === undefined ? options.limits.maxDerivedBytes : options.maxDerivedBytes;
  const requestedHeapMiB = options.maxWorkerHeapMiB === undefined ? options.limits.maxWorkerHeapMiB : options.maxWorkerHeapMiB;
  for (const [name, value] of Object.entries({ maxDerivedBytes, maxWorkerHeapMiB: requestedHeapMiB })) {
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) throw new TypeError(`${name} must be a positive safe integer or null`);
  }
  // A single automatic worker may use most available memory. Resident pools
  // serialize automatic workers instead of dividing a fixed heap among four.
  const maxWorkerHeapMiB = requestedHeapMiB ?? Math.floor(process.availableMemory() * 0.8 / (1024 * 1024));
  if (requestedHeapMiB === null && maxWorkerHeapMiB < 64) throw new ObservationError("observation-failed", type, ".", "Available host memory is insufficient for an observation worker");
  options.signal?.throwIfAborted();
  // Collected input is separately bounded by source bytes; impact tasks consume derived data.
  let transferLimit = type === "observe" || type === "observe-indexed" || type === "canonical" || type === "analyze-collected" || type === "analyze-incremental" || type === "analyze-javascript" ? observationLimitValue(options.limits.maxTotalBytes) * 8 : observationLimitValue(maxDerivedBytes);
  if (type === "authenticate-context" || type === "authenticate-impact") {
    const source = (input as ObservationTaskInputs["authenticate-context"]).source;
    const sourceBytes = Buffer.byteLength(source);
    if (sourceBytes > observationLimitValue(maxDerivedBytes)) throw new ObservationError("observation-limit-exceeded", "derived-read", ".", "Retained derived record exceeds maxDerivedBytes", "maxDerivedBytes", sourceBytes);
    // A JSON source crosses the channel as a string; escaping it is transport overhead.
    transferLimit = observationLimitValue(maxDerivedBytes) * 6 + 1024;
  }
  assertBoundedObservationData(transportInput, transferLimit, options.deadline);
  const entry = import.meta.url.endsWith(".ts")
    ? new URL("../../dist/observation/task-worker.js", import.meta.url)
    : new URL("./task-worker.js", import.meta.url);
  if (!existsSync(entry)) throw new Error("Compiled observation worker is unavailable; build the Projector workspace before running source tests.");
  const remaining = options.deadline - Date.now();
  if (remaining <= 0) throw deadlineError(type);
  const { slot, resident, oneShot } = await acquireWorker(entry, maxWorkerHeapMiB, options.deadline, options.signal, requestedHeapMiB === null);
  const worker = slot.worker;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const hostAbort = new AbortController();
  const activeHost = new Set<Promise<void>>();
  let semanticLease: SqliteCodeStore | undefined;
  let semanticLeaseNotice: SemanticLeaseNotice | undefined;
  let semanticLeaseTimer: ReturnType<typeof setInterval> | undefined;
  let semanticLeaseWork: Promise<void> = Promise.resolve();
  let semanticLeaseStopped = false;
  let succeeded = false;
  let detach: (() => void) | undefined;
  try {
    return await new Promise<ObservationTaskResults[K]>((resolve, reject) => {
      if (Number.isFinite(remaining)) timer = setTimeout(() => reject(deadlineError(type)), remaining);
      abort = () => reject(options.signal?.reason ?? new Error("Observation aborted"));
      options.signal?.addEventListener("abort", abort, { once: true });
      const onError = (error: Error): void => reject("code" in error && error.code === "ERR_WORKER_OUT_OF_MEMORY"
        ? new ObservationError("observation-limit-exceeded", type, ".", "Observation worker exceeded maxWorkerHeapMiB; explicitly revise the finite allowance to retry.", "maxWorkerHeapMiB", maxWorkerHeapMiB)
        : error);
      const onExit = (code: number): void => reject(new Error(`Observation worker exited before returning ${type} (code ${code})`));
      const onMessage = (message: { started?: boolean; semanticLease?: SemanticLeaseNotice; semanticLeaseEnding?: SemanticLeaseEnding; hostRequest?: KnowledgeHostRequest; id?: number; ok: boolean; result?: ObservationTaskResults[K]; error?: ObservationTaskFailure }): void => {
        if (message.started === true) {
          try { options.onWorkerStarted?.(worker.threadId); } catch (error) { reject(error); }
          return;
        }
        if (message.semanticLease !== undefined) {
          const notice = message.semanticLease;
          if (type !== "code-operation" || semanticLeaseNotice !== undefined) {
            reject(new Error("Unexpected code writer lease notification"));
            return;
          }
          semanticLeaseNotice = notice;
          semanticLeaseWork = (async () => {
            while (!semanticLeaseStopped) {
              try {
                semanticLease ??= await SqliteCodeStore.open(notice.repositoryRoot);
                semanticLease.heartbeatLease(notice.scope, notice.token, 300_000);
                break;
              } catch (error) {
                if (!isSqliteBusy(error)) throw error;
                await delay(2_000);
              }
            }
            if (semanticLeaseStopped) return;
            semanticLeaseTimer = setInterval(() => {
              semanticLeaseWork = semanticLeaseWork.then(() => {
                try { semanticLease?.heartbeatLease(notice.scope, notice.token, 300_000); }
                catch (error) { if (!isSqliteBusy(error)) throw error; }
              });
              void semanticLeaseWork.catch(reject);
            }, 60_000);
            semanticLeaseTimer.unref();
          })();
          void semanticLeaseWork.catch(reject);
          return;
        }
        if (message.semanticLeaseEnding !== undefined) {
          const ending = message.semanticLeaseEnding;
          if (message.id === undefined || semanticLeaseNotice?.scope !== ending.scope || semanticLeaseNotice.token !== ending.token) {
            reject(new Error("Unexpected code writer lease completion"));
            return;
          }
          semanticLeaseStopped = true;
          if (semanticLeaseTimer !== undefined) clearInterval(semanticLeaseTimer);
          semanticLeaseTimer = undefined;
          void (async () => {
            try {
              await semanticLeaseWork;
              semanticLease?.close();
              semanticLease = undefined;
              semanticLeaseNotice = undefined;
              semanticLeaseStopped = false;
              worker.postMessage({ id: message.id, ok: true, semanticLeaseEndAck: ending });
            } catch (error) { reject(error); }
          })();
          return;
        }
        if (message.hostRequest !== undefined) {
          const request = message.hostRequest;
          resident.suspendForHostRequest(slot);
          const pending = (async () => {
            try {
              if (options.onHostRequest === undefined) throw new Error("Observation worker requested an unavailable host operation");
              const result = await options.onHostRequest(request, hostAbort.signal);
              assertBoundedObservationData(result, observationLimitValue(maxDerivedBytes), options.deadline);
              worker.postMessage({ id: message.id, ok: true, result });
            } catch (error) {
              const failure = error as Partial<ObservationTaskFailure>;
              worker.postMessage({ id: message.id, ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope, limit: failure.limit, observed: failure.observed } });
            } finally {
              resident.resumeAfterHostRequest(slot);
            }
          })();
          activeHost.add(pending);
          void pending.then(() => activeHost.delete(pending), () => activeHost.delete(pending));
          return;
        }
        if (Date.now() >= options.deadline) { reject(deadlineError(type)); return; }
        if (message.ok) { succeeded = true; resolve(message.result!); }
        else if (message.error?.code === "observation-limit-exceeded" || message.error?.code === "observation-failed") reject(new ObservationError(message.error.code, message.error.stage ?? type, message.error.scope ?? ".", message.error.message, message.error.limit, message.error.observed));
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
      worker.postMessage({ task: { type, input: transportInput }, deadline: options.deadline, maxDerivedBytes });
      if (options.signal?.aborted) abort();
    });
  } finally {
    semanticLeaseStopped = true;
    if (timer !== undefined) clearTimeout(timer);
    if (abort !== undefined) options.signal?.removeEventListener("abort", abort);
    hostAbort.abort(new Error("Observation worker stopped"));
    // Failed tasks never return while their computation remains alive.
    if (!succeeded) {
      await worker.terminate();
      resident?.discard(slot);
    }
    await Promise.allSettled(activeHost);
    if (semanticLeaseTimer !== undefined) clearInterval(semanticLeaseTimer);
    await semanticLeaseWork.catch(() => undefined);
    semanticLease?.close();
    detach?.();
    slot.busy = false;
    if (succeeded) resident?.release(slot);
    if (oneShot) await resident.close();
  }
}

function deadlineError(stage: string): ObservationError {
  return new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs");
}
