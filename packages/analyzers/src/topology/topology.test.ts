import { hashFramedDomain, type AdapterContext, type ContentHash } from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { compileEventContractTopology, createTopologyRelevanceAdapter, createTopologyRelevanceQueryStatePort } from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const bindingPort = (topology: ReturnType<typeof compileEventContractTopology>) => ({
  bind: async (subjectId: string, subjectKind: "event" | "contract", _context: AdapterContext) => {
    const route = topology.routes.find((item) => item.subjectId === subjectId)!;
    const programId = `projector.topology.${subjectKind}-relevance`;
    const kind = `${subjectKind}-topology` as "event-topology" | "contract-topology";
    const input = { subjectId };
    const queryHash = hashFramedDomain("state-query", { kind, programId, programVersion: "1", input });
    const snapshot = createTopologyRelevanceQueryStatePort(topology).inspect(subjectId, subjectKind);
    const results = snapshot.results;
    return {
      query: { id: `topology-consumers:${subjectId}`, kind, programId, programVersion: "1", input, semanticHash: queryHash },
      priorResult: {
        queryHash, resultHash: hashFramedDomain("state-query-result", results), resultCount: results.length,
        observability: route.observability, assumptions: route.enumeration?.assumptions ?? [], unavailableLanes: [], dependencyKeys: [`topology:${subjectId}`],
      },
      role: `known ${subjectKind} consumers and negative space for ${subjectId}`,
    };
  },
});

describe("event and contract topology", () => {
  const observations = [
    {
      subjectId: "event-midi-note", subjectKind: "event" as const, semanticKey: "MidiNoteCaptured@1",
      participantId: "recorder", role: "consumer" as const, assurance: "exact" as const,
      confidence: 1, evidenceIds: ["typescript-call"], adapterVersion: "1", artifactHash: hash("a"),
      incidentalPath: "packages/recording/src/consume.ts",
    },
    {
      subjectId: "event-midi-note", subjectKind: "event" as const, semanticKey: "MidiNoteCaptured@1",
      participantId: "multiplayer-relay", role: "consumer" as const, assurance: "validated" as const,
      confidence: 0.9, evidenceIds: ["message-handler"], adapterVersion: "1", artifactHash: hash("b"),
      incidentalPath: "apps/multiplayer/relay.ts",
    },
    {
      subjectId: "contract-midi-api", subjectKind: "contract" as const, semanticKey: "MidiPublicApi@2",
      participantId: "mobile-app", role: "consumer" as const, assurance: "heuristic" as const,
      confidence: 0.6, evidenceIds: ["import"], adapterVersion: "1", artifactHash: hash("c"),
      incidentalPath: "apps/mobile/api.ts",
    },
  ];

  it("routes every known event and contract consumer deterministically with conservatively capped raw assurance", () => {
    const topology = compileEventContractTopology(observations);

    expect(topology.routes.map(({ subjectId, consumerIds }) => [subjectId, consumerIds])).toEqual([
      ["contract-midi-api", ["mobile-app"]],
      ["event-midi-note", ["multiplayer-relay", "recorder"]],
    ]);
    expect(topology.routes.flatMap(({ links }) => links).map(({ assurance }) => assurance)).toEqual(["heuristic", "heuristic", "heuristic"]);
  });

  it("uses stable semantic identities rather than paths and rejects conflicting duplicate observations", () => {
    const moved = observations.map((item) => ({ ...item, incidentalPath: `/moved/${item.participantId}.ts` }));
    expect(compileEventContractTopology(moved)).toEqual(compileEventContractTopology(observations));
    expect(() => compileEventContractTopology([
      observations[0]!,
      { ...observations[0]!, confidence: 0.2 },
    ])).toThrow(/conflicting duplicate/i);
  });

  it("rejects two semantic keys or kinds claiming the same stable subject identity", () => {
    expect(() => compileEventContractTopology([
      observations[0]!,
      { ...observations[1]!, semanticKey: "DifferentEvent@1" },
    ])).toThrow(/stable subject identity|conflicting subject/i);
  });

  it("is invariant to observation insertion order", () => {
    fc.assert(fc.property(fc.shuffledSubarray(observations, { minLength: 3, maxLength: 3 }), (values) => {
      expect(compileEventContractTopology(values)).toEqual(compileEventContractTopology(observations));
    }));
  });

  it("keeps route semantic identity stable across assurance, evidence, content, and participant refresh", () => {
    const initial = compileEventContractTopology([observations[0]!]).routes[0]!;
    const refreshed = compileEventContractTopology([
      { ...observations[0]!, assurance: "validated", confidence: 0.8, evidenceIds: ["new-evidence"], artifactHash: hash("refreshed") },
      { ...observations[0]!, participantId: "new-consumer", artifactHash: hash("new") },
    ]).routes[0]!;
    expect(refreshed.id).toBe(initial.id);
    expect(refreshed.contentHash).not.toBe(initial.contentHash);
  });

  it("exposes a host-neutral query-bound relevance adapter that routes consumers before inference", async () => {
    const topology = compileEventContractTopology(observations);
    const result = await createTopologyRelevanceAdapter(topology, bindingPort(topology)).discover("event-midi-note", 0, {
      repositoryRoot: "/repo",
      stateDigest: { gitBase: "base", worktreeDigest: hash("w"), canonicalProjectorDigest: hash("c"), toolchainDigest: hash("t") },
      config: {}, signal: new AbortController().signal,
    });
    expect(result.edges.map(({ entityId }) => entityId)).toEqual(["multiplayer-relay", "recorder"]);
    expect(result.edges.every(({ reason }) => reason.kind === "event-producer-consumer" && reason.provenance !== "inferred")).toBe(true);
    expect(result.dependency.query.kind).toBe("event-topology");
    expect(result.dependency.priorResult.resultCount).toBe(2);
  });

  it("does not let the raw compiler promote heuristic observations with caller enumeration", () => {
    const route = compileEventContractTopology([observations[2]!]).routes[0]!;
    expect(route.observability).toBe("open");
    const bounded = compileEventContractTopology([observations[2]!], {
      observability: "bounded", method: "complete manifest scan", assumptions: ["manifest is authoritative"],
      blindSpots: [], dynamicMechanisms: [],
    }).routes[0]!;
    expect(bounded.observability).toBe("open");
  });

  it("defaults exact observed links to open without an explicit enumeration proof", () => {
    expect(compileEventContractTopology([observations[0]!]).routes[0]!.observability).toBe("open");
  });

  it("conservatively caps caller-declared proof on the raw public compiler", () => {
    const route = compileEventContractTopology([observations[0]!], {
      observability: "closed", method: "caller says exhaustive", assumptions: [], blindSpots: [], dynamicMechanisms: [],
    }).routes[0]!;
    expect(route.observability).toBe("open");
    expect(route.links[0]).toMatchObject({ assurance: "heuristic" });
  });

  it("rejects a closed enumeration label without an exhaustive proof contract", () => {
    expect(() => compileEventContractTopology([observations[0]!], {
      observability: "closed", method: "", assumptions: [], blindSpots: [], dynamicMechanisms: ["runtime subscription"],
    })).toThrow(/enumeration|proof|closed|method/i);
  });

  it("keeps stable route identity when the mutable semantic key is refreshed", () => {
    const original = compileEventContractTopology([observations[0]!]).routes[0]!;
    const refreshed = compileEventContractTopology([{ ...observations[0]!, semanticKey: "MidiNoteCaptured@2" }]).routes[0]!;

    expect(refreshed.id).toBe(original.id);
    expect(refreshed.contentHash).not.toBe(original.contentHash);
  });

  it("refreshes the topology query fingerprint when evidence or semantic key changes", async () => {
    const originalTopology = compileEventContractTopology([observations[0]!]);
    const evidenceTopology = compileEventContractTopology([{ ...observations[0]!, evidenceIds: ["new-evidence"] }]);
    const keyTopology = compileEventContractTopology([{ ...observations[0]!, semanticKey: "MidiNoteCaptured@2" }]);
    const original = await createTopologyRelevanceAdapter(originalTopology, bindingPort(originalTopology))
      .discover("event-midi-note", 0, {} as never);
    const evidenceRefresh = await createTopologyRelevanceAdapter(evidenceTopology, bindingPort(evidenceTopology)).discover("event-midi-note", 0, {} as never);
    const keyRefresh = await createTopologyRelevanceAdapter(keyTopology, bindingPort(keyTopology)).discover("event-midi-note", 0, {} as never);

    expect(evidenceRefresh.dependency.priorResult.resultHash).not.toBe(original.dependency.priorResult.resultHash);
    expect(keyRefresh.dependency.priorResult.resultHash).not.toBe(original.dependency.priorResult.resultHash);
  });

  it("rejects an injected binding for an unrelated or noncanonical topology query", async () => {
    const topology = compileEventContractTopology([observations[0]!]);
    const valid = bindingPort(topology);
    await expect(createTopologyRelevanceAdapter(topology, {
      bind: async (...args) => {
        const dependency = await valid.bind(...args);
        return { ...dependency, query: { ...dependency.query, programId: "unrelated.query" } };
      },
    }).discover("event-midi-note", 0, {} as never)).rejects.toThrow(/registered|canonical|query|binding/i);
  });
});
