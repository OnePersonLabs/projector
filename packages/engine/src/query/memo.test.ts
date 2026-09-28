import { describe, expect, it } from "vitest";
import { hashFramedDomain, type AdapterContext, type ContentHash } from "@projector/core";
import { BUILT_IN_QUERY_PROGRAM_IDS, InMemoryGraphReader, QueryDependencyRegistry, type QueryMemoEntry } from "./index.js";

describe("registered query memoization", () => {
  it("recomputes when effective configuration changes despite unchanged graph populations", async () => {
    const entries = new Map<ContentHash, QueryMemoEntry>();
    let runs = 0;
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false, { read: (key) => entries.get(key), version: () => hashFramedDomain("complete-population", []), write: (key, entry) => { entries.set(key, entry); } });
    registry.register({ id: "configured", version: "1", kind: "selector-membership", evaluate: ({ context }) => { runs++; return { results: [{ id: "configured-result", mode: context.config.mode }], observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["complete-population"] }; } });
    const query = registry.createSpec({ id: "configured", programId: "configured", input: {} });
    const first = { signal: new AbortController().signal, config: { mode: "first" } } as unknown as AdapterContext;
    const second = { ...first, config: { mode: "second" } };
    const before = await registry.evaluate(query, first);
    const after = await registry.evaluate(query, second);
    expect(after.resultHash).not.toBe(before.resultHash);
    expect(runs).toBe(2);
  });
  it("binds transitive traversal to intermediate and empty leaf populations", async () => {
    const graph = new InMemoryGraphReader({ reverseDerivations: [{ subjectId: "shared", dependentIds: ["middle"] }] });
    const entries = new Map<ContentHash, QueryMemoEntry>();
    const versions = new Map<string, ContentHash>([
      ["reverse-derivations:shared", hashFramedDomain("members", ["middle"])],
      ["reverse-derivations:middle", hashFramedDomain("members", [])],
      ["reverse-derivations:distant", hashFramedDomain("members", [])],
    ]);
    const registry = new QueryDependencyRegistry(graph, true, {
      read: (key) => entries.get(key), version: (key) => versions.get(key),
      write: (key, entry) => { entries.set(key, entry); },
    });
    const query = registry.createSpec({ id: "shared-consumers", programId: BUILT_IN_QUERY_PROGRAM_IDS.transitiveReverseDerivation, input: { seedIds: ["shared"] } });
    const context = { signal: new AbortController().signal } as AdapterContext;
    const first = await registry.evaluate(query, context);
    expect(first.dependencyKeys).toEqual(["reverse-derivations:middle", "reverse-derivations:shared"]);
    graph.replace({ reverseDerivations: [{ subjectId: "shared", dependentIds: ["middle"] }, { subjectId: "middle", dependentIds: ["distant"] }] });
    versions.set("reverse-derivations:middle", hashFramedDomain("members", ["distant"]));
    const changed = await registry.evaluate(query, context);
    expect(changed.resultCount).toBe(2);
    expect(changed.dependencyKeys).toContain("reverse-derivations:distant");
  });
  it("reuses complete populations and recomputes empty results when a distant consumer appears", async () => {
    const entries = new Map<ContentHash, QueryMemoEntry>();
    let population = hashFramedDomain("population", []);
    let members: string[] = [];
    let runs = 0;
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false, {
      read: (key) => entries.get(key), version: () => population,
      write: (key, entry) => { entries.set(key, entry); },
    });
    registry.register({ id: "consumers", version: "1", kind: "selector-membership", evaluate: () => {
      runs++;
      return { results: members.map((id) => ({ id })), observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: ["consumers:shared"] };
    } });
    const query = registry.createSpec({ id: "query", programId: "consumers", input: {} });
    const context = { signal: new AbortController().signal } as AdapterContext;
    const empty = await registry.evaluate(query, context);
    expect((await registry.evaluate(query, context)).resultHash).toBe(empty.resultHash);
    expect(runs).toBe(1);
    members = ["distant-new-consumer"];
    population = hashFramedDomain("population", members);
    const populated = await registry.evaluate(query, context);
    expect(populated.resultCount).toBe(1);
    expect(runs).toBe(2);
    population = hashFramedDomain("population", { members, source: "changed but same semantics" });
    const unchanged = await registry.evaluate(query, context);
    expect(unchanged.resultHash).toBe(populated.resultHash);
    expect(runs).toBe(3);
  });

  it("does not admit unknown dependencies and checks program versions before reuse", async () => {
    const entries = new Map<ContentHash, QueryMemoEntry>();
    let runs = 0;
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false, {
      read: (key) => entries.get(key), version: () => undefined,
      write: (key, entry) => { entries.set(key, entry); },
    });
    const program = { id: "unknown", version: "1", kind: "selector-membership" as const, evaluate: () => {
      runs++;
      return { results: [], observability: "closed" as const, assumptions: [], unavailableLanes: [], dependencyKeys: ["absence"] };
    } };
    registry.register(program);
    const query = registry.createSpec({ id: "query", programId: program.id, input: {} });
    const context = { signal: new AbortController().signal } as AdapterContext;
    await registry.evaluate(query, context); await registry.evaluate(query, context);
    expect(runs).toBe(2); expect(entries.size).toBe(0);
    registry.register({ ...program, version: "2" });
    await expect(registry.evaluate(query, context)).rejects.toThrow("version changed");
  });
});
