import { hashFramedDomain, type ContentHash } from "@projector/core";
import type { QueryMemoEntry, QueryMemoPort } from "@projector/engine";
import type { IndexedObservationDelta, SqliteObservationStore } from "@projector/runtime";

/** One evaluation owner holds a pinned observation generation. Writes are staged
 * and admitted by its publisher after the read transaction has ended. */
export class IndexedQueryMemo implements QueryMemoPort {
  private readonly pending = new Map<ContentHash, QueryMemoEntry>();
  constructor(private readonly store: SqliteObservationStore, private readonly generation: number, private readonly extraVersion?: (key: string) => ContentHash | undefined) {}
  read(queryHash: ContentHash): QueryMemoEntry | undefined {
    return this.pending.get(queryHash) ?? this.store.getAt<QueryMemoEntry>(this.generation, "query-result", queryHash);
  }
  version(dependencyKey: string): ContentHash | undefined {
    const external = this.extraVersion?.(dependencyKey);
    if (external !== undefined) return external;
    const version = this.store.getAt<ContentHash>(this.generation, "query-dependency-version", dependencyKey);
    if (version !== undefined) return version;
    const namespace = dependencyKey.startsWith("relations:") ? "relations"
      : dependencyKey.startsWith("reverse-derivations:") ? "reverse-derivations" : undefined;
    if (namespace === undefined) return undefined;
    const complete = this.store.getAt<ContentHash>(this.generation, "population-version", namespace);
    return complete === undefined ? undefined : hashFramedDomain("indexed-graph-absent-population", { dependencyKey, complete });
  }
  write(queryHash: ContentHash, entry: QueryMemoEntry): void {
    this.pending.set(queryHash, structuredClone(entry));
  }
  delta(): IndexedObservationDelta {
    return {
      upserts: [...this.pending].map(([key, value]) => ({ kind: "query-result", key, value })),
      dependencies: [...this.pending].flatMap(([consumer, entry]) => {
        const old = this.store.getAt<QueryMemoEntry>(this.generation, "query-result", consumer);
        const current = new Set(entry.result.dependencyKeys);
        return [
          ...(old?.result.dependencyKeys ?? []).filter((input) => !current.has(input)).map((input) => ({ consumer, input, present: false })),
          ...entry.result.dependencyKeys.map((input) => ({ consumer, input, present: true })),
        ];
      }),
    };
  }
}
