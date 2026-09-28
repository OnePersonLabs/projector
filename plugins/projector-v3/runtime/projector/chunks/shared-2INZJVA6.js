import {
  assertBoundedObservationData
} from "./shared-IFEDFPQ4.js";
import {
  SqliteCodeStore,
  currentObservationScope
} from "./shared-EHAKQ7RC.js";
import {
  inventoryForTransport
} from "./shared-T66EWDMN.js";
import {
  ObservationError,
  observationLimitValue
} from "./shared-AJ5KBTH5.js";

// node_modules/@projector/control-plane/dist/observation/resident-pool.js
import { AsyncLocalStorage } from "node:async_hooks";
import { Worker } from "node:worker_threads";
var currentPool = new AsyncLocalStorage();
function withResidentObservationWorkerPool(pool, operation) {
  return currentPool.run(pool, operation);
}
function residentObservationWorkerPool() {
  return currentPool.getStore();
}
var ResidentObservationWorkerPool = class {
  maximumWorkers;
  slots = /* @__PURE__ */ new Set();
  waiters = [];
  closed = false;
  constructor(maximumWorkers = 4) {
    this.maximumWorkers = maximumWorkers;
    if (!Number.isSafeInteger(maximumWorkers) || maximumWorkers <= 0)
      throw new TypeError("maximumWorkers must be a positive safe integer");
  }
  async acquire(entry, heapMiB, deadline, signal, autoMemory = false) {
    signal?.throwIfAborted();
    if (this.closed)
      throw new Error("Resident observation worker pool is closed");
    if (Date.now() >= deadline)
      throw deadlineError();
    const immediate = this.take(entry, heapMiB, autoMemory);
    if (immediate !== void 0)
      return immediate;
    return new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        reject(deadlineError());
        return;
      }
      const waiter = {
        entry,
        heapMiB,
        autoMemory,
        deadline,
        resolve,
        reject,
        ...signal === void 0 ? {} : { signal },
        ...Number.isFinite(remaining) ? { timer: setTimeout(() => this.removeWaiter(waiter, deadlineError()), remaining) } : {},
        ...signal === void 0 ? {} : { abort: () => this.removeWaiter(waiter, signal.reason ?? new Error("Observation aborted")) }
      };
      this.waiters.push(waiter);
      if (waiter.abort !== void 0)
        signal?.addEventListener("abort", waiter.abort, { once: true });
      if (signal?.aborted)
        this.removeWaiter(waiter, signal.reason ?? new Error("Observation aborted"));
    });
  }
  release(slot) {
    slot.busy = false;
    slot.suspendedHostRequests = 0;
    if (this.slots.size > this.maximumWorkers) {
      slot.retiring = true;
      void slot.worker.terminate();
    }
    this.dispatch();
  }
  /** A worker waiting for a host reply is not computing. Its lease stays
   * owned, but subordinate work can use currently available host memory. */
  suspendForHostRequest(slot) {
    if (!slot.busy)
      throw new Error("Cannot suspend an idle observation worker");
    slot.suspendedHostRequests += 1;
    this.dispatch();
  }
  resumeAfterHostRequest(slot) {
    if (slot.suspendedHostRequests < 1)
      throw new Error("Observation worker host suspension is not active");
    slot.suspendedHostRequests -= 1;
  }
  discard(slot) {
    this.slots.delete(slot);
    this.dispatch();
  }
  async close() {
    if (this.closed)
      return;
    this.closed = true;
    for (const waiter of [...this.waiters])
      this.removeWaiter(waiter, new Error("Resident observation worker pool closed"));
    await Promise.all([...this.slots].map(({ worker }) => worker.terminate()));
    this.slots.clear();
  }
  removeWaiter(waiter, error) {
    const index = this.waiters.indexOf(waiter);
    if (index < 0)
      return;
    this.waiters.splice(index, 1);
    this.clearWaiter(waiter);
    waiter.reject(error);
  }
  clearWaiter(waiter) {
    if (waiter.timer !== void 0)
      clearTimeout(waiter.timer);
    if (waiter.abort !== void 0)
      waiter.signal?.removeEventListener("abort", waiter.abort);
  }
  dispatch() {
    while (this.waiters.length > 0) {
      const waiter = this.waiters[0];
      if (waiter.signal?.aborted) {
        this.removeWaiter(waiter, waiter.signal.reason);
        continue;
      }
      if (Date.now() >= waiter.deadline) {
        this.removeWaiter(waiter, deadlineError());
        continue;
      }
      let slot;
      try {
        slot = this.take(waiter.entry, waiter.heapMiB, waiter.autoMemory);
      } catch (error) {
        this.removeWaiter(waiter, error);
        continue;
      }
      if (slot === void 0)
        break;
      this.waiters.shift();
      this.clearWaiter(waiter);
      waiter.resolve(slot);
    }
  }
  take(entry, heapMiB, autoMemory) {
    if ([...this.slots].some((slot2) => slot2.busy && slot2.suspendedHostRequests === 0 && (autoMemory || slot2.autoMemory)))
      return void 0;
    const idle = [...this.slots].find((slot2) => !slot2.busy && !slot2.retiring && slot2.autoMemory === autoMemory && (autoMemory || slot2.heapMiB === heapMiB));
    if (idle !== void 0) {
      idle.busy = true;
      return idle;
    }
    if (this.slots.size >= this.maximumWorkers) {
      const incompatible = [...this.slots].find((slot2) => !slot2.busy && !slot2.retiring);
      if (incompatible !== void 0) {
        incompatible.retiring = true;
        void incompatible.worker.terminate();
        return void 0;
      }
      const computing = [...this.slots].filter((slot2) => slot2.busy && slot2.suspendedHostRequests === 0);
      if (computing.length >= this.maximumWorkers)
        return void 0;
    }
    const worker = new Worker(entry, { resourceLimits: { maxOldGenerationSizeMb: heapMiB, maxYoungGenerationSizeMb: Math.min(16, heapMiB) }, execArgv: [] });
    const slot = { worker, heapMiB, autoMemory, busy: true, suspendedHostRequests: 0, retiring: false };
    worker.on("error", () => this.discard(slot));
    worker.on("exit", () => this.discard(slot));
    this.slots.add(slot);
    return slot;
  }
};
function deadlineError() {
  return new ObservationError("observation-limit-exceeded", "worker-concurrency", ".", "Repository observation deadline exceeded while waiting for a computation worker; explicitly increase timeoutMs to retry.", "timeoutMs");
}

// node_modules/@projector/control-plane/dist/observation/task-runner.js
import { existsSync } from "node:fs";
import { AsyncResource } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
function isSqliteBusy(error) {
  return error instanceof Error && "code" in error && (error.code === "ERR_SQLITE_ERROR" || error.code === "SQLITE_BUSY") && /database is locked|SQLITE_BUSY/u.test(error.message);
}
function taskInputForTransport(type, input) {
  if (type === "analyze-javascript") {
    const javascriptInput = input;
    return { inventory: inventoryForTransport(javascriptInput.inventory) };
  }
  if (type !== "observe" && type !== "observe-indexed" && type !== "analyze-collected" && type !== "analyze-incremental")
    return input;
  const collectedInput = input;
  return {
    ...collectedInput,
    collected: {
      ...collectedInput.collected,
      inventoryResult: inventoryForTransport(collectedInput.collected.inventoryResult)
    }
  };
}
var scopedPools = /* @__PURE__ */ new WeakMap();
async function acquireWorker(entry, heapMiB, deadline, signal, autoMemory = false) {
  let resident = residentObservationWorkerPool();
  if (resident !== void 0)
    return { slot: await resident.acquire(entry, heapMiB, deadline, signal, autoMemory), resident };
  const scope = currentObservationScope();
  if (scope?.isActive()) {
    resident = scopedPools.get(scope.budget);
    if (resident === void 0) {
      resident = new ResidentObservationWorkerPool(4);
      scopedPools.set(scope.budget, resident);
      const owned = resident;
      scope.registerCleanup(async () => {
        await owned.close();
        scopedPools.delete(scope.budget);
      });
    }
    return { slot: await resident.acquire(entry, heapMiB, deadline, signal, autoMemory), resident };
  }
  const oneShot = new ResidentObservationWorkerPool(1);
  return { slot: await oneShot.acquire(entry, heapMiB, deadline, signal, autoMemory), resident: oneShot, oneShot: true };
}
async function runObservationTask(type, input, options) {
  const transportInput = taskInputForTransport(type, input);
  const maxDerivedBytes = options.maxDerivedBytes === void 0 ? options.limits.maxDerivedBytes : options.maxDerivedBytes;
  const requestedHeapMiB = options.maxWorkerHeapMiB === void 0 ? options.limits.maxWorkerHeapMiB : options.maxWorkerHeapMiB;
  for (const [name, value] of Object.entries({ maxDerivedBytes, maxWorkerHeapMiB: requestedHeapMiB })) {
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0))
      throw new TypeError(`${name} must be a positive safe integer or null`);
  }
  const maxWorkerHeapMiB = requestedHeapMiB ?? Math.floor(process.availableMemory() * 0.8 / (1024 * 1024));
  if (requestedHeapMiB === null && maxWorkerHeapMiB < 64)
    throw new ObservationError("observation-failed", type, ".", "Available host memory is insufficient for an observation worker");
  options.signal?.throwIfAborted();
  let transferLimit = type === "observe" || type === "observe-indexed" || type === "canonical" || type === "analyze-collected" || type === "analyze-incremental" || type === "analyze-javascript" ? observationLimitValue(options.limits.maxTotalBytes) * 8 : observationLimitValue(maxDerivedBytes);
  if (type === "authenticate-context" || type === "authenticate-impact") {
    const source = input.source;
    const sourceBytes = Buffer.byteLength(source);
    if (sourceBytes > observationLimitValue(maxDerivedBytes))
      throw new ObservationError("observation-limit-exceeded", "derived-read", ".", "Retained derived record exceeds maxDerivedBytes", "maxDerivedBytes", sourceBytes);
    transferLimit = observationLimitValue(maxDerivedBytes) * 6 + 1024;
  }
  assertBoundedObservationData(transportInput, transferLimit, options.deadline);
  const entry = import.meta.url.endsWith(".ts") ? new URL("../../dist/observation/task-worker.js", import.meta.url) : new URL("../workers/task-worker.js", import.meta.url);
  if (!existsSync(entry))
    throw new Error("Compiled observation worker is unavailable; build the Projector workspace before running source tests.");
  const remaining = options.deadline - Date.now();
  if (remaining <= 0)
    throw deadlineError2(type);
  const { slot, resident, oneShot } = await acquireWorker(entry, maxWorkerHeapMiB, options.deadline, options.signal, requestedHeapMiB === null);
  const worker = slot.worker;
  let timer;
  let abort;
  const hostAbort = new AbortController();
  const activeHost = /* @__PURE__ */ new Set();
  let semanticLease;
  let semanticLeaseNotice;
  let semanticLeaseTimer;
  let semanticLeaseWork = Promise.resolve();
  let semanticLeaseStopped = false;
  let succeeded = false;
  let detach;
  try {
    return await new Promise((resolve, reject) => {
      if (Number.isFinite(remaining))
        timer = setTimeout(() => reject(deadlineError2(type)), remaining);
      abort = () => reject(options.signal?.reason ?? new Error("Observation aborted"));
      options.signal?.addEventListener("abort", abort, { once: true });
      const onError = (error) => reject("code" in error && error.code === "ERR_WORKER_OUT_OF_MEMORY" ? new ObservationError("observation-limit-exceeded", type, ".", "Observation worker exceeded maxWorkerHeapMiB; explicitly revise the finite allowance to retry.", "maxWorkerHeapMiB", maxWorkerHeapMiB) : error);
      const onExit = (code) => reject(new Error(`Observation worker exited before returning ${type} (code ${code})`));
      const onMessage = (message) => {
        if (message.started === true) {
          try {
            options.onWorkerStarted?.(worker.threadId);
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (message.semanticLease !== void 0) {
          const notice = message.semanticLease;
          if (type !== "code-operation" || semanticLeaseNotice !== void 0) {
            reject(new Error("Unexpected code writer lease notification"));
            return;
          }
          semanticLeaseNotice = notice;
          semanticLeaseWork = (async () => {
            while (!semanticLeaseStopped) {
              try {
                semanticLease ??= await SqliteCodeStore.open(notice.repositoryRoot);
                semanticLease.heartbeatLease(notice.scope, notice.token, 3e5);
                break;
              } catch (error) {
                if (!isSqliteBusy(error))
                  throw error;
                await delay(2e3);
              }
            }
            if (semanticLeaseStopped)
              return;
            semanticLeaseTimer = setInterval(() => {
              semanticLeaseWork = semanticLeaseWork.then(() => {
                try {
                  semanticLease?.heartbeatLease(notice.scope, notice.token, 3e5);
                } catch (error) {
                  if (!isSqliteBusy(error))
                    throw error;
                }
              });
              void semanticLeaseWork.catch(reject);
            }, 6e4);
            semanticLeaseTimer.unref();
          })();
          void semanticLeaseWork.catch(reject);
          return;
        }
        if (message.semanticLeaseEnding !== void 0) {
          const ending = message.semanticLeaseEnding;
          if (message.id === void 0 || semanticLeaseNotice?.scope !== ending.scope || semanticLeaseNotice.token !== ending.token) {
            reject(new Error("Unexpected code writer lease completion"));
            return;
          }
          semanticLeaseStopped = true;
          if (semanticLeaseTimer !== void 0)
            clearInterval(semanticLeaseTimer);
          semanticLeaseTimer = void 0;
          void (async () => {
            try {
              await semanticLeaseWork;
              semanticLease?.close();
              semanticLease = void 0;
              semanticLeaseNotice = void 0;
              semanticLeaseStopped = false;
              worker.postMessage({ id: message.id, ok: true, semanticLeaseEndAck: ending });
            } catch (error) {
              reject(error);
            }
          })();
          return;
        }
        if (message.hostRequest !== void 0) {
          const request = message.hostRequest;
          resident.suspendForHostRequest(slot);
          const pending = (async () => {
            try {
              if (options.onHostRequest === void 0)
                throw new Error("Observation worker requested an unavailable host operation");
              const result = await options.onHostRequest(request, hostAbort.signal);
              assertBoundedObservationData(result, observationLimitValue(maxDerivedBytes), options.deadline);
              worker.postMessage({ id: message.id, ok: true, result });
            } catch (error) {
              const failure = error;
              worker.postMessage({ id: message.id, ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope, limit: failure.limit, observed: failure.observed } });
            } finally {
              resident.resumeAfterHostRequest(slot);
            }
          })();
          activeHost.add(pending);
          void pending.then(() => activeHost.delete(pending), () => activeHost.delete(pending));
          return;
        }
        if (Date.now() >= options.deadline) {
          reject(deadlineError2(type));
          return;
        }
        if (message.ok) {
          succeeded = true;
          resolve(message.result);
        } else if (message.error?.code === "observation-limit-exceeded" || message.error?.code === "observation-failed")
          reject(new ObservationError(message.error.code, message.error.stage ?? type, message.error.scope ?? ".", message.error.message, message.error.limit, message.error.observed));
        else {
          const error = new Error(message.error?.message ?? "Observation worker failed");
          error.name = message.error?.name ?? "Error";
          reject(error);
        }
      };
      worker.once("error", onError);
      worker.once("exit", onExit);
      const boundMessage = AsyncResource.bind(onMessage);
      worker.on("message", boundMessage);
      detach = () => {
        worker.off("error", onError);
        worker.off("exit", onExit);
        worker.off("message", boundMessage);
      };
      worker.postMessage({ task: { type, input: transportInput }, deadline: options.deadline, maxDerivedBytes });
      if (options.signal?.aborted)
        abort();
    });
  } finally {
    semanticLeaseStopped = true;
    if (timer !== void 0)
      clearTimeout(timer);
    if (abort !== void 0)
      options.signal?.removeEventListener("abort", abort);
    hostAbort.abort(new Error("Observation worker stopped"));
    if (!succeeded) {
      await worker.terminate();
      resident?.discard(slot);
    }
    await Promise.allSettled(activeHost);
    if (semanticLeaseTimer !== void 0)
      clearInterval(semanticLeaseTimer);
    await semanticLeaseWork.catch(() => void 0);
    semanticLease?.close();
    detach?.();
    slot.busy = false;
    if (succeeded)
      resident?.release(slot);
    if (oneShot)
      await resident.close();
  }
}
function deadlineError2(stage) {
  return new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs");
}

export {
  withResidentObservationWorkerPool,
  residentObservationWorkerPool,
  ResidentObservationWorkerPool,
  runObservationTask
};
