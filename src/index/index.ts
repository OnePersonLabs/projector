import { Worker } from 'node:worker_threads';
import { LIMITS } from './types.ts';
import type { IndexBackend, Indexed, IndexJob } from './types.ts';
export { emptyCounters, LIMITS } from './types.ts';
export type { Counters, IndexBackend, Indexed, IndexJob } from './types.ts';
export { git, hash, safePath, rootIdentity } from './git.ts';

interface Task { job: IndexJob; resolve(value: Indexed): void; reject(error: Error): void; }
interface Lane { worker: Worker; task?: Task; timer?: ReturnType<typeof setTimeout>; }

/** Two persistent worker lanes; one job per root at a time, round-robin root admission. */
export class IndexPool implements IndexBackend {
  private lanes: Lane[] = [];
  private queues = new Map<string, Task[]>();
  private active = new Set<string>();
  private closed = false;
  private readonly timeoutMs: number;
  private readonly workerFactory: (url: URL) => Worker;
  constructor(timeoutMs = 30_000, workerFactory: (url: URL) => Worker = url => new Worker(url)) { this.timeoutMs = timeoutMs; this.workerFactory = workerFactory; }
  run(job: IndexJob): Promise<Indexed> {
    if (this.closed) return Promise.reject(new Error('Index pool is closed'));
    if ([...this.queues.values()].reduce((n, q) => n + q.length, 0) >= LIMITS.queue) return Promise.reject(new Error('Index queue admission limit reached'));
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(job.root) ?? [];
      queue.push({ job, resolve, reject }); this.queues.set(job.root, queue);
      this.schedule();
    });
  }
  private createLane(): Lane {
    const worker = this.workerFactory(new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url));
    const lane: Lane = { worker };
    worker.on('message', (message: { result?: Indexed; error?: string }) => {
      const task = lane.task;
      if (!task) return;
      clearTimeout(lane.timer); lane.task = undefined; this.active.delete(task.job.root);
      if (message.error || !message.result) task.reject(new Error(message.error ?? 'Worker returned no index'));
      else task.resolve(message.result);
      this.schedule();
    });
    const failed = (error: Error) => {
      const task = lane.task; lane.task = undefined; clearTimeout(lane.timer);
      if (task) { this.active.delete(task.job.root); task.reject(error); }
      this.lanes = this.lanes.filter(item => item !== lane);
      void worker.terminate();
      if (!this.closed) this.schedule();
    };
    worker.on('error', failed);
    worker.on('exit', code => { if (!this.closed && this.lanes.includes(lane)) failed(new Error(`Index worker exited (${code})`)); });
    this.lanes.push(lane); return lane;
  }
  private schedule(): void {
    if (this.closed) return;
    for (const [root, queue] of this.queues) {
      if (this.active.has(root)) continue;
      let lane = this.lanes.find(item => !item.task);
      if (!lane && this.lanes.length < LIMITS.lanes) lane = this.createLane();
      if (!lane) break;
      const task = queue.shift();
      this.queues.delete(root);
      if (queue.length) this.queues.set(root, queue);
      if (!task) continue;
      lane.task = task; this.active.add(root);
      const owner = lane;
      lane.timer = setTimeout(() => {
        if (owner.task !== task) return;
        owner.task = undefined; this.active.delete(root);
        task.reject(new Error('Index worker deadline exceeded; publication withheld'));
        this.lanes = this.lanes.filter(item => item !== owner); void owner.worker.terminate(); this.schedule();
      }, this.timeoutMs);
      lane.worker.postMessage(task.job);
    }
  }
  async close(): Promise<void> {
    this.closed = true;
    for (const queue of this.queues.values()) for (const task of queue) task.reject(new Error('Index pool closed'));
    this.queues.clear();
    await Promise.all(this.lanes.map(async lane => { clearTimeout(lane.timer); lane.task?.reject(new Error('Index pool closed')); await lane.worker.terminate(); }));
    this.lanes = [];
  }
}
