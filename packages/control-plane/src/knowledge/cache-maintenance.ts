import { basename } from "node:path";
import { DEFAULT_OBSERVATION_LIMITS } from "@projector/core";
import { DERIVED_CACHE_MAX_BYTES, checkDerivedCacheBudget, currentObservationScope, tryWithProjectExclusiveAccess, withDerivedCacheAdmission, withObservationScope, type DerivedCacheBudget, type DerivedCacheEntry } from "@projector/runtime";
import { readRepositoryImpactSnapshot, type RepositoryImpactReference } from "../impact/service.js";
import { readProtectedKnowledgeContextIds } from "./cache-protection.js";
import { KnowledgeContextStore } from "./store.js";

export interface DerivedCacheMaintenanceOptions {
  readonly targetBytes?: number;
  readonly budget?: DerivedCacheBudget;
  readonly signal?: AbortSignal;
  /** Exact context IDs (full selectors or their 32-hex suffixes), retained for this pass only. */
  readonly preserveContextIds?: readonly string[];
}
export interface DerivedCacheMaintenanceResult {
  readonly status: "busy" | "unchanged" | "collected";
  readonly removedEntries: number;
  readonly retainedBytes?: number;
}

/** Run outside ordinary shared operations. The complete authenticated proof precedes every deletion. */
export async function maintainDerivedCache(root: string, options: DerivedCacheMaintenanceOptions = {}): Promise<DerivedCacheMaintenanceResult> {
  const target = options.targetBytes ?? Math.floor(DERIVED_CACHE_MAX_BYTES * 0.75);
  if (!Number.isSafeInteger(target) || target < 0 || target > DERIVED_CACHE_MAX_BYTES) throw new RangeError("Invalid cache maintenance target");
  const preservedIds = (options.preserveContextIds ?? []).map((id) => {
    const match = /^(?:knowledge_context_)?([0-9a-f]{32})$/u.exec(id);
    if (match === null) throw new Error(`Invalid preserved context identity: ${id}`);
    return `knowledge_context_${match[1]}`;
  });
  const result = await tryWithProjectExclusiveAccess(root, "derived-cache-maintenance", async (access) => {
    const budget = options.budget ?? { deadline: Date.now() + 5_000, remainingEntries: 10_000, remainingBytes: (currentObservationScope()?.limits ?? DEFAULT_OBSERVATION_LIMITS).maxDerivedBytes };
    return withObservationScope({ signal: access.signal, limits: { timeoutMs: Math.max(1, budget.deadline - Date.now()) } }, async () => withDerivedCacheAdmission(root, async (cache): Promise<DerivedCacheMaintenanceResult> => {
      if (cache.totalBytes <= target && cache.entries.every(({ kind }) => kind !== "staging")) return { status: "unchanged", removedEntries: 0, retainedBytes: cache.totalBytes };
      const protectedIds = new Set([...await readProtectedKnowledgeContextIds(root, budget, access.signal), ...preservedIds]);
      const store = await KnowledgeContextStore.create(root);
      const contextDependencies = new Map<string, string>();
      const protectedPaths = new Set<string>();
      const referencedBy = new Map<string, Set<string>>();
      const entries = new Map(cache.entries.map((entry) => [entry.relativePath, entry]));
      const retained = new Map<string, DerivedCacheEntry>();
      const references = new Map<string, RepositoryImpactReference>();
      let retainedBytes = 0;
      const retain = (entry: DerivedCacheEntry): void => {
        if (!retained.has(entry.relativePath)) { retained.set(entry.relativePath, entry); retainedBytes += entry.bytes; }
      };
      const forget = (path: string): void => {
        const entry = retained.get(path);
        if (entry !== undefined) { retained.delete(path); retainedBytes -= entry.bytes; }
      };
      for (const id of protectedIds) {
        const path = `.projector/runtime/knowledge/contexts/${id.slice("knowledge_context_".length)}.json`;
        const entry = entries.get(path);
        if (entry === undefined) throw new Error(`Protected context ${id} is missing; recover or refresh its lifecycle before cache maintenance`);
        protectedPaths.add(path);
        retain(entry);
      }
      // Choose disposable context retention from bounded metadata before opening any payload.
      const newestContexts = cache.entries.filter(({ kind }) => kind === "context").sort((a, b) => b.lastUsedMs - a.lastUsedMs || a.relativePath.localeCompare(b.relativePath));
      for (const entry of newestContexts) {
        if (!protectedPaths.has(entry.relativePath) && retainedBytes + entry.bytes <= target) retain(entry);
      }
      let remainingPayloadBytes = DERIVED_CACHE_MAX_BYTES;
      for (const entry of [...retained.values()]) {
        remainingPayloadBytes -= entry.bytes;
        if (remainingPayloadBytes < 0) throw new Error("Protected or selected cache payloads exceed the 256 MiB inspection bound; narrow the retention target or finish protected operations before retrying");
        checkDerivedCacheBudget(budget);
        const id = `knowledge_context_${basename(entry.relativePath, ".json")}`;
        const context = await store.read(id, false);
        if (context.impactBaseline !== undefined) {
          const dependency = `.projector/runtime/impact/${context.impactBaseline.contentHash.slice("sha256:v1:".length)}.json`;
          const snapshot = entries.get(dependency);
          if (snapshot === undefined) throw new Error(`Retained context ${id} is missing its impact dependency; refresh it before cache maintenance`);
          const prior = references.get(dependency);
          if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(context.impactBaseline)) throw new Error(`Retained contexts disagree about their shared impact reference: ${dependency}`);
          references.set(dependency, context.impactBaseline);
          contextDependencies.set(entry.relativePath, dependency);
          const users = referencedBy.get(dependency) ?? new Set<string>();
          users.add(entry.relativePath);
          referencedBy.set(dependency, users);
          retain(snapshot);
        }
        checkDerivedCacheBudget(budget);
      }
      // Include shared dependency sizes, then remove oldest optional contexts before snapshot reads.
      for (const entry of [...newestContexts].reverse()) {
        if (retainedBytes <= target) break;
        if (!retained.has(entry.relativePath) || protectedPaths.has(entry.relativePath)) continue;
        forget(entry.relativePath);
        const dependency = contextDependencies.get(entry.relativePath);
        if (dependency !== undefined) {
          const users = referencedBy.get(dependency)!;
          users.delete(entry.relativePath);
          if (users.size === 0) forget(dependency);
        }
      }
      for (const entry of retained.values()) {
        if (entry.kind !== "impact") continue;
        remainingPayloadBytes -= entry.bytes;
        if (remainingPayloadBytes < 0) throw new Error("Retained cache proof exceeds the 256 MiB inspection bound; narrow the retention target before retrying");
        checkDerivedCacheBudget(budget);
        await readRepositoryImpactSnapshot(root, references.get(entry.relativePath)!, false);
      }
      // Only final retained contexts can refer to surviving snapshots. Everything else is disposable.
      const selected = cache.entries.filter((entry) => !retained.has(entry.relativePath))
        .sort((a, b) => Number(a.kind === "impact") - Number(b.kind === "impact") || a.relativePath.localeCompare(b.relativePath));
      checkDerivedCacheBudget(budget);
      await access.assertOwned();
      for (const entry of selected) {
        access.signal.throwIfAborted();
        checkDerivedCacheBudget(budget);
        await cache.remove(entry);
      }
      return { status: selected.length === 0 ? "unchanged" : "collected", removedEntries: selected.length, retainedBytes: cache.totalBytes };
    }, { signal: access.signal, budget }));
  }, options.signal);
  return result.acquired ? result.value : { status: "busy", removedEntries: 0 };
}
