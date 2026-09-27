import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  currentObservationScope
} from "./shared-3WNQLUKU.js";
import {
  assertBoundedObservationData
} from "./shared-GHTLNEBM.js";
import {
  ObservationError
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/observation/task-runner.js
import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { AsyncResource } from "node:async_hooks";
var pools = /* @__PURE__ */ new WeakMap();
function acquireWorker(entry, heapMiB) {
  const scope = currentObservationScope();
  let pool;
  if (scope?.isActive()) {
    pool = pools.get(scope.budget);
    if (pool === void 0) {
      pool = { slots: /* @__PURE__ */ new Set(), scope };
      pools.set(scope.budget, pool);
      const owned = pool;
      scope.registerCleanup(async () => {
        await Promise.all([...owned.slots].map(({ worker: worker2 }) => worker2.terminate()));
        owned.slots.clear();
        pools.delete(scope.budget);
      });
    }
    const idle = [...pool.slots].find((slot2) => !slot2.busy && slot2.heapMiB === heapMiB);
    if (idle !== void 0) {
      idle.busy = true;
      return { slot: idle, pool };
    }
    if (pool.slots.size >= 4)
      throw new ObservationError("observation-limit-exceeded", "worker-concurrency", ".", "Observation requires more than four simultaneous computation workers; reduce concurrent work before retrying.");
  }
  const worker = new Worker(entry, { resourceLimits: { maxOldGenerationSizeMb: heapMiB, maxYoungGenerationSizeMb: Math.min(16, heapMiB) }, execArgv: [] });
  const slot = { worker, busy: true, heapMiB };
  worker.on("error", () => pool?.slots.delete(slot));
  worker.on("exit", () => pool?.slots.delete(slot));
  pool?.slots.add(slot);
  return { slot, ...pool === void 0 ? {} : { pool } };
}
async function runObservationTask(type, input, options) {
  const maxDerivedBytes = options.maxDerivedBytes ?? options.limits.maxDerivedBytes;
  const maxWorkerHeapMiB = options.maxWorkerHeapMiB ?? options.limits.maxWorkerHeapMiB;
  for (const [name, value] of Object.entries({ maxDerivedBytes, maxWorkerHeapMiB })) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new TypeError(`${name} must be a positive safe integer`);
  }
  options.signal?.throwIfAborted();
  let transferLimit = type === "observe" || type === "canonical" || type === "analyze-collected" ? options.limits.maxTotalBytes * 8 : maxDerivedBytes;
  if (type === "authenticate-context" || type === "authenticate-impact") {
    const source = input.source;
    const sourceBytes = Buffer.byteLength(source);
    if (sourceBytes > maxDerivedBytes)
      throw new ObservationError("observation-limit-exceeded", "derived-read", ".", "Retained derived record exceeds maxDerivedBytes", "maxDerivedBytes", sourceBytes);
    transferLimit = maxDerivedBytes * 6 + 1024;
  }
  assertBoundedObservationData(input, transferLimit, options.deadline);
  const entry = import.meta.url.endsWith(".ts") ? new URL("../../dist/observation/task-worker.js", import.meta.url) : new URL("../workers/task-worker.js", import.meta.url);
  if (!existsSync(entry))
    throw new Error("Compiled observation worker is unavailable; build the Projector workspace before running source tests.");
  const remaining = options.deadline - Date.now();
  if (remaining <= 0)
    throw deadlineError(type);
  const { slot, pool } = acquireWorker(entry, maxWorkerHeapMiB);
  const worker = slot.worker;
  let timer;
  let abort;
  const hostAbort = new AbortController();
  const activeHost = /* @__PURE__ */ new Set();
  let succeeded = false;
  let detach;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(deadlineError(type)), remaining);
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
        if (message.hostRequest !== void 0) {
          const request = message.hostRequest;
          const pending = (async () => {
            try {
              if (options.onHostRequest === void 0)
                throw new Error("Observation worker requested an unavailable host operation");
              const result = await options.onHostRequest(request, hostAbort.signal);
              assertBoundedObservationData(result, maxDerivedBytes, options.deadline);
              worker.postMessage({ id: message.id, ok: true, result });
            } catch (error) {
              const failure = error;
              worker.postMessage({ id: message.id, ok: false, error: { message: failure.message ?? String(error), name: failure.name, code: failure.code, stage: failure.stage, scope: failure.scope, limit: failure.limit, observed: failure.observed } });
            }
          })();
          activeHost.add(pending);
          void pending.then(() => activeHost.delete(pending), () => activeHost.delete(pending));
          return;
        }
        if (Date.now() >= options.deadline) {
          reject(deadlineError(type));
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
      worker.postMessage({ task: { type, input }, deadline: options.deadline, maxDerivedBytes });
      if (options.signal?.aborted)
        abort();
    });
  } finally {
    if (timer !== void 0)
      clearTimeout(timer);
    if (abort !== void 0)
      options.signal?.removeEventListener("abort", abort);
    hostAbort.abort(new Error("Observation worker stopped"));
    if (!succeeded || pool === void 0 || !pool.scope.isActive()) {
      await worker.terminate();
      pool?.slots.delete(slot);
    }
    await Promise.allSettled(activeHost);
    detach?.();
    slot.busy = false;
  }
}
function deadlineError(stage) {
  return new ObservationError("observation-limit-exceeded", stage, ".", "Repository observation deadline exceeded; explicitly increase timeoutMs to retry.", "timeoutMs");
}

export {
  runObservationTask
};
