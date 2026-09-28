import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, type AdapterContext } from "@projector/core";
import { InMemoryGraphReader, QueryDependencyRegistry } from "@projector/engine";
import { SqliteObservationStore } from "@projector/runtime";
import { expect, it } from "vitest";
import { IndexedQueryMemo } from "./indexed-query.js";

it("retains authenticated registered queries across independent store lifetimes and invalidates complete empty populations", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-indexed-query-"));
  const path = join(root, "index.sqlite");
  let runs = 0;
  const create = (store: SqliteObservationStore, generation: number, members: string[]) => {
    const memo = new IndexedQueryMemo(store, generation);
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false, memo);
    registry.register({ id: "consumer", version: "1", kind: "selector-membership", evaluate: () => {
      runs++;
      return { results: members.map((id) => ({ id })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["consumers:shared"] };
    } });
    return { memo, registry, query: registry.createSpec({ id: "consumer:shared", programId: "consumer", input: {} }) };
  };
  const context = { signal: new AbortController().signal } as AdapterContext;
  let store = new SqliteObservationStore(path);
  try {
    let head = store.publish(null, { contract: "test", metadata: {} }, {
      upserts: [{ kind: "query-dependency-version", key: "consumers:shared", value: hashFramedDomain("population", []) }],
    });
    const first = create(store, head.generation, []);
    const empty = await first.registry.evaluate(first.query, context);
    head = store.publish(head.generation, head, first.memo.delta());
    store.close(); store = new SqliteObservationStore(path);
    const second = create(store, head.generation, []);
    expect(await second.registry.evaluate(second.query, context)).toEqual(empty);
    expect(runs).toBe(1);
    head = store.publish(head.generation, head, {
      upserts: [{ kind: "query-dependency-version", key: "consumers:shared", value: hashFramedDomain("population", ["distant"] ) }],
    });
    const changed = create(store, head.generation, ["distant"]);
    expect((await changed.registry.evaluate(changed.query, context)).resultCount).toBe(1);
    expect(runs).toBe(2);
    await expect(second.registry.evaluate(second.query, context)).rejects.toThrow("generation changed");
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});
