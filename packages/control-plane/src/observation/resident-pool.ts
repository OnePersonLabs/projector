import { AsyncLocalStorage } from "node:async_hooks";
import { Worker } from "node:worker_threads";
import { ObservationError } from "@projector/core";

export interface ResidentWorkerSlot {
  readonly worker: Worker;
  readonly heapMiB: number;
  readonly autoMemory: boolean;
  busy: boolean;
  suspendedHostRequests: number;
  retiring: boolean;
}

interface Waiter {
  readonly entry: URL;
  readonly heapMiB: number;
  readonly autoMemory: boolean;
  readonly deadline: number;
  readonly resolve: (slot: ResidentWorkerSlot) => void;
  readonly reject: (error: unknown) => void;
  readonly signal?: AbortSignal;
  readonly abort?: () => void;
  readonly timer?: ReturnType<typeof setTimeout>;
}

const currentPool = new AsyncLocalStorage<ResidentObservationWorkerPool>();

export function withResidentObservationWorkerPool<T>(pool: ResidentObservationWorkerPool, operation: () => Promise<T>): Promise<T> {
  return currentPool.run(pool, operation);
}

export function residentObservationWorkerPool(): ResidentObservationWorkerPool | undefined {
  return currentPool.getStore();
}

/** A connection-owned pool. Each lease retains its own deadline, signal and observation budget. */
export class ResidentObservationWorkerPool {
  private readonly slots = new Set<ResidentWorkerSlot>();
  private readonly waiters: Waiter[] = [];
  private closed = false;

  constructor(private readonly maximumWorkers = 4) {
    if (!Number.isSafeInteger(maximumWorkers) || maximumWorkers <= 0) throw new TypeError("maximumWorkers must be a positive safe integer");
  }

  async acquire(entry: URL, heapMiB: number, deadline: number, signal?: AbortSignal, autoMemory = false): Promise<ResidentWorkerSlot> {
    signal?.throwIfAborted();
    if (this.closed) throw new Error("Resident observation worker pool is closed");
    if (Date.now() >= deadline) throw deadlineError();
    const immediate = this.take(entry, heapMiB, autoMemory);
    if (immediate !== undefined) return immediate;
    return new Promise<ResidentWorkerSlot>((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { reject(deadlineError()); return; }
      const waiter: Waiter = {
        entry, heapMiB, autoMemory, deadline, resolve, reject,
        ...(signal === undefined ? {} : { signal }),
        ...(Number.isFinite(remaining) ? { timer: setTimeout(() => this.removeWaiter(waiter, deadlineError()), remaining) } : {}),
        ...(signal === undefined ? {} : { abort: () => this.removeWaiter(waiter, signal.reason ?? new Error("Observation aborted")) }),
      };
      this.waiters.push(waiter);
      if (waiter.abort !== undefined) signal?.addEventListener("abort", waiter.abort, { once: true });
      if (signal?.aborted) this.removeWaiter(waiter, signal.reason ?? new Error("Observation aborted"));
    });
  }

  release(slot: ResidentWorkerSlot): void {
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
  suspendForHostRequest(slot: ResidentWorkerSlot): void {
    if (!slot.busy) throw new Error("Cannot suspend an idle observation worker");
    slot.suspendedHostRequests += 1;
    this.dispatch();
  }

  resumeAfterHostRequest(slot: ResidentWorkerSlot): void {
    if (slot.suspendedHostRequests < 1) throw new Error("Observation worker host suspension is not active");
    slot.suspendedHostRequests -= 1;
  }

  discard(slot: ResidentWorkerSlot): void {
    this.slots.delete(slot);
    this.dispatch();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of [...this.waiters]) this.removeWaiter(waiter, new Error("Resident observation worker pool closed"));
    await Promise.all([...this.slots].map(({ worker }) => worker.terminate()));
    this.slots.clear();
  }

  private removeWaiter(waiter: Waiter, error: unknown): void {
    const index = this.waiters.indexOf(waiter);
    if (index < 0) return;
    this.waiters.splice(index, 1);
    this.clearWaiter(waiter);
    waiter.reject(error);
  }

  private clearWaiter(waiter: Waiter): void {
    if (waiter.timer !== undefined) clearTimeout(waiter.timer);
    if (waiter.abort !== undefined) waiter.signal?.removeEventListener("abort", waiter.abort);
  }

  private dispatch(): void {
    while (this.waiters.length > 0) {
      const waiter = this.waiters[0]!;
      if (waiter.signal?.aborted) { this.removeWaiter(waiter, waiter.signal.reason); continue; }
      if (Date.now() >= waiter.deadline) { this.removeWaiter(waiter, deadlineError()); continue; }
      let slot: ResidentWorkerSlot | undefined;
      try { slot = this.take(waiter.entry, waiter.heapMiB, waiter.autoMemory); }
      catch (error) { this.removeWaiter(waiter, error); continue; }
      if (slot === undefined) break;
      this.waiters.shift();
      this.clearWaiter(waiter);
      waiter.resolve(slot);
    }
  }

  private take(entry: URL, heapMiB: number, autoMemory: boolean): ResidentWorkerSlot | undefined {
    if ([...this.slots].some((slot) => slot.busy && slot.suspendedHostRequests === 0 && (autoMemory || slot.autoMemory))) return undefined;
    const idle = [...this.slots].find((slot) => !slot.busy && !slot.retiring && slot.autoMemory === autoMemory && (autoMemory || slot.heapMiB === heapMiB));
    if (idle !== undefined) { idle.busy = true; return idle; }
    if (this.slots.size >= this.maximumWorkers) {
      const incompatible = [...this.slots].find((slot) => !slot.busy && !slot.retiring);
      if (incompatible !== undefined) {
        incompatible.retiring = true;
        void incompatible.worker.terminate();
        return undefined;
      }
      const computing = [...this.slots].filter((slot) => slot.busy && slot.suspendedHostRequests === 0);
      if (computing.length >= this.maximumWorkers) return undefined;
      // Suspended ancestors retain their workers for a host reply but consume
      // no computation admission. Their children use remaining host memory.
    }
    const worker = new Worker(entry, { resourceLimits: { maxOldGenerationSizeMb: heapMiB, maxYoungGenerationSizeMb: Math.min(16, heapMiB) }, execArgv: [] });
    const slot: ResidentWorkerSlot = { worker, heapMiB, autoMemory, busy: true, suspendedHostRequests: 0, retiring: false };
    worker.on("error", () => this.discard(slot));
    worker.on("exit", () => this.discard(slot));
    this.slots.add(slot);
    return slot;
  }
}

function deadlineError(): ObservationError {
  return new ObservationError("observation-limit-exceeded", "worker-concurrency", ".", "Repository observation deadline exceeded while waiting for a computation worker; explicitly increase timeoutMs to retry.", "timeoutMs");
}
