import type {
  AdapterContext,
  Concept,
  ContentHash,
  Relation,
  StateDigest,
  StateQuerySpec,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import {
  InMemoryGraphReader,
  QueryDependencyRegistry,
  UnknownQueryProgramError,
} from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;

const state: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("1"),
  canonicalProjectorDigest: hash("2"),
  toolchainDigest: hash("3"),
};

const context: AdapterContext = {
  repositoryRoot: "/repo",
  stateDigest: state,
  config: {},
  signal: new AbortController().signal,
};

const concept = (id: string, name: string, aliases: string[] = []): Concept => ({
  id,
  key: id,
  kind: "capability",
  name,
  aliases,
  statement: `${name} behavior`,
  status: "active",
  sourceClass: "authored",
  confidence: 1,
  tags: [],
  evidence: [],
  discoveryHash: hash(`${id}d`),
  semanticHash: hash(`${id}s`),
});

const relation = (id: string, fromId: string, toId: string): Relation => ({
  id,
  fromId,
  toId,
  type: "depends-on",
  sourceClass: "authored",
  confidence: 1,
  evidence: [],
  active: true,
  semanticHash: hash(id),
});

describe("in-memory graph reader", () => {
  it("returns stable IDs in deterministic order regardless of insertion order", () => {
    const first = new InMemoryGraphReader({
      concepts: [concept("concept-b", "Billing"), concept("concept-a", "Accounts")],
      relations: [relation("relation-b", "concept-a", "concept-b"), relation("relation-a", "concept-a", "concept-b")],
    });
    const second = new InMemoryGraphReader({
      concepts: [concept("concept-a", "Accounts"), concept("concept-b", "Billing")],
      relations: [relation("relation-a", "concept-a", "concept-b"), relation("relation-b", "concept-a", "concept-b")],
    });

    expect(first.searchSemanticIdentities("bill")).toEqual(["concept-b"]);
    expect(first.getRelations("concept-a", "out").map(({ id }) => id)).toEqual(["relation-a", "relation-b"]);
    expect(first.getRelations("concept-a", "out")).toEqual(second.getRelations("concept-a", "out"));
  });

  it("rejects duplicate stable IDs instead of choosing by insertion order", () => {
    expect(() => new InMemoryGraphReader({ concepts: [concept("same", "First"), concept("same", "Second")] }))
      .toThrow(/duplicate.*same/i);
  });

  it("sorts stable IDs by deterministic code-unit order", () => {
    const graph = new InMemoryGraphReader({
      concepts: [concept("éclair", "match"), concept("Zulu", "match")],
    });

    expect(graph.searchSemanticIdentities("match")).toEqual(["Zulu", "éclair"]);
  });
});

describe("registered query dependencies", () => {
  it("normalizes result ordering and dependency keys before fingerprinting", async () => {
    const graph = new InMemoryGraphReader();
    const registry = new QueryDependencyRegistry(graph);
    registry.register({
      id: "custom.members",
      version: "1",
      kind: "custom",
      evaluate: () => ({
        results: [{ id: "member-b", rank: 2 }, { rank: 1, id: "member-a" }, { id: "member-a", rank: 1 }],
        observability: "closed",
        assumptions: ["index complete", "index complete"],
        unavailableLanes: [],
        dependencyKeys: ["units:b", "units:a", "units:a"],
      }),
    });
    const query = registry.createSpec({ id: "members", programId: "custom.members", input: { scope: "all" } });

    const result = await registry.evaluate(query, context);

    expect(result.resultCount).toBe(2);
    expect(result.dependencyKeys).toEqual(["units:a", "units:b"]);
    expect(result.assumptions).toEqual(["index complete"]);
  });

  it("changes a relation-neighborhood result when a new edge appears", async () => {
    const graph = new InMemoryGraphReader({ relations: [relation("relation-a", "source", "old-target")] });
    const registry = new QueryDependencyRegistry(graph);
    const query = registry.createSpec({
      id: "source-neighbors",
      programId: "graph.relation-neighborhood",
      input: { entityId: "source", direction: "out" },
    });
    const before = await registry.evaluate(query, context);

    graph.replace({
      relations: [
        relation("relation-a", "source", "old-target"),
        relation("relation-b", "source", "new-target"),
      ],
    });
    const after = await registry.evaluate(query, context);

    expect(before.resultCount).toBe(1);
    expect(after.resultCount).toBe(2);
    expect(after.resultHash).not.toBe(before.resultHash);
    expect(after.dependencyKeys).toContain("relations:out:source");
  });

  it("fails closed when a query program is unknown", async () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader());
    const unknown = {
      id: "unknown-query",
      kind: "custom",
      programId: "missing.program",
      programVersion: "1",
      input: {},
      semanticHash: hash("unknown"),
    } satisfies StateQuerySpec;

    await expect(registry.evaluate(unknown, context)).rejects.toBeInstanceOf(UnknownQueryProgramError);
  });

  it("rejects replacing a registered program without a version change", () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    const program = {
      id: "custom.fixed",
      version: "1",
      kind: "custom" as const,
      evaluate: () => ({
        results: [],
        observability: "closed" as const,
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["custom:fixed"],
      }),
    };
    registry.register(program);

    expect(() => registry.register({ ...program, evaluate: () => ({ ...program.evaluate(), results: [{ id: "different" }] }) }))
      .toThrow(/version/i);
  });

  it("rejects query results without a stable identity", async () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    registry.register({
      id: "custom.unstable",
      version: "1",
      kind: "custom",
      evaluate: () => ({
        results: [{ displayName: "not an identity" }],
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["custom:unstable"],
      }),
    });
    const query = registry.createSpec({ id: "unstable", programId: "custom.unstable", input: {} });

    await expect(registry.evaluate(query, context)).rejects.toThrow(/stable.*id/i);
  });
});
