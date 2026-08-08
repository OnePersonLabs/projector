import type {
  AdapterContext,
  Concept,
  ContentHash,
  DerivationInput,
  Relation,
  StateDigest,
  StateQuerySpec,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import {
  InMemoryGraphReader,
  QueryDependencyRegistry,
  UnknownQueryProgramError,
  createIdentityBoundaryQueryPrograms,
  createTopologyQueryBindingPort,
  createTopologyRelevanceQueryPrograms,
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

  it("totally orders derivation inputs including kind and version hash", () => {
    const adapterA = { kind: "adapter", id: "same", role: "input", versionHash: hash("a") } satisfies DerivationInput;
    const adapterB = { kind: "adapter", id: "same", role: "input", versionHash: hash("b") } satisfies DerivationInput;
    const toolchain = { kind: "toolchain", id: "same", role: "input", versionHash: hash("a") } satisfies DerivationInput;
    const graph = new InMemoryGraphReader({
      derivationInputs: [{ unitId: "unit", inputs: [toolchain, adapterB, adapterA] }],
    });

    expect(graph.getDerivationInputs("unit")).toEqual([adapterA, adapterB, toolchain]);
  });
});

describe("registered topology query contract", () => {
  it("replays current topology and refreshes the fingerprint when closure evidence changes", async () => {
    let evidenceIds = ["old-evidence"];
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    for (const program of createTopologyRelevanceQueryPrograms({
      inspect: (subjectId, subjectKind) => ({
        results: [{
          id: "consumer:mobile", participantId: "mobile", role: "consumer", assurance: "exact", confidence: 1,
          artifactHash: hash("artifact"), adapterVersion: "1", evidenceIds, semanticKey: "MidiEvent@1",
          observability: "closed",
        }],
        observability: "closed", assumptions: [], unavailableLanes: [], dependencyKeys: [`topology:${subjectKind}:${subjectId}`],
      }),
    })) registry.register(program);
    const binding = createTopologyQueryBindingPort(registry);
    const dependency = await binding.bind("event-midi", "event", context);
    evidenceIds = ["new-evidence"];
    const replayed = await registry.evaluate(dependency.query, context);

    expect(dependency.query.programId).toBe("projector.topology.event-relevance");
    expect(replayed.resultHash).not.toBe(dependency.priorResult.resultHash);
  });
});

describe("registered query dependencies", () => {
  it("replays each identity boundary lane through its authoritative lane evaluator", async () => {
    const laneState = new Map<string, string[]>([
      ["exact", ["exact-a"]],
      ["alias", ["alias-a"]],
      ["lineage", ["lineage-a"]],
      ["tombstone", ["tombstone-a"]],
      ["relations", ["relation-a"]],
      ["topology", ["topology-a"]],
    ]);
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    for (const program of createIdentityBoundaryQueryPrograms({
      inspect: (lane) => ({
        results: (laneState.get(lane) ?? []).map((id) => ({ id, lane })),
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: [`identity-boundary:${lane}`],
      }),
    })) registry.register(program);

    for (const lane of ["exact", "alias", "lineage", "tombstone", "relations", "topology"] as const) {
      const programId = `identity.${lane === "exact" ? "exact-search" : lane === "alias" ? "alias-search" : lane}`;
      const query = registry.createSpec({
        id: `identity-${lane}`,
        programId,
        input: { requestedMeaning: "wireless MIDI", requestedKind: "concept" },
      });
      const before = await registry.evaluate(query, context);
      laneState.set(lane, [`${lane}-b`]);
      const after = await registry.evaluate(query, context);

      expect(after.resultHash, `${lane} must observe its own lane`).not.toBe(before.resultHash);
      expect(after.dependencyKeys).toEqual([`identity-boundary:${lane}`]);
    }
  });

  it("does not ship six identity boundary names backed by the generic graph text search", () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader());

    expect(() => registry.createSpec({
      id: "dishonest-lineage",
      programId: "identity.lineage",
      input: { requestedMeaning: "wireless MIDI", requestedKind: "concept" },
    })).toThrow(UnknownQueryProgramError);
  });

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

  it("does not reactivate a previously replaced version identifier", () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    const program = (version: string) => ({
      id: "custom.history",
      version,
      kind: "custom" as const,
      evaluate: () => ({
        results: [],
        observability: "closed" as const,
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["custom:history"],
      }),
    });
    registry.register(program("1"));
    registry.register(program("2"));

    expect(() => registry.register(program("1"))).toThrow(/previous|history|version/i);
  });

  it("does not let a caller rebind a registered implementation by mutating its object", async () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
    const program = {
      id: "custom.snapshot",
      version: "1",
      kind: "custom" as const,
      evaluate: () => ({
        results: [{ id: "original" }],
        observability: "closed" as const,
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: ["custom:snapshot"],
      }),
    };
    registry.register(program);
    program.evaluate = () => ({
      results: [{ id: "replacement-a" }, { id: "replacement-b" }],
      observability: "closed",
      assumptions: [],
      unavailableLanes: [],
      dependencyKeys: ["custom:snapshot"],
    });
    const query = registry.createSpec({ id: "snapshot", programId: "custom.snapshot", input: {} });

    await expect(registry.evaluate(query, context)).resolves.toMatchObject({ resultCount: 1 });
  });

  it("normalizes set-like built-in kinds before hashing the query", () => {
    const registry = new QueryDependencyRegistry(new InMemoryGraphReader());

    const first = registry.createSpec({
      id: "first",
      programId: "graph.semantic-identity-search",
      input: { query: "billing", kinds: ["scenario", "concept", "scenario"] },
    });
    const second = registry.createSpec({
      id: "second",
      programId: "graph.semantic-identity-search",
      input: { kinds: ["concept", "scenario"], query: "billing" },
    });

    expect(first.input).toEqual({ kinds: ["concept", "scenario"], query: "billing" });
    expect(first.semanticHash).toBe(second.semanticHash);
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
