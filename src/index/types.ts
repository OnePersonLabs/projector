import type { FileRecord } from '../documents/index.ts';

export interface Counters {
  sourceBytes: number; hashBytes: number; parsedFiles: number; extractions: number;
  dependencyVisits: number; subprocesses: number; transactions: number; cacheBytes: number;
  outputBytes: number; modelCalls: number; barriers: number; workerStarts: number;
}
export const emptyCounters = (): Counters => ({ sourceBytes: 0, hashBytes: 0, parsedFiles: 0, extractions: 0,
  dependencyVisits: 0, subprocesses: 0, transactions: 0, cacheBytes: 0, outputBytes: 0, modelCalls: 0, barriers: 0, workerStarts: 0 });
export interface IndexJob {
  root: string; database: string; kind: 'revision' | 'working'; revision?: string; paths?: string[];
}
export interface Indexed {
  revision: string; files: FileRecord[]; deleted: string[]; inventory: string[]; counters: Counters;
  warnings: string[];
}
export interface IndexBackend { run(job: IndexJob): Promise<Indexed>; close(): Promise<void>; }
export const LIMITS = { lanes: 2, roots: 8, queue: 128, files: 20_000, fileBytes: 1_048_576,
  snapshotBytes: 32 * 1_048_576, queries: 128, resultBytes: 256 * 1024, rows: 250, history: 4 } as const;
