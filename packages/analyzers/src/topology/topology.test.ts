import type { ContentHash } from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { compileEventContractTopology, createTopologyRelevanceAdapter } from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;

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

  it("routes every known event and contract consumer deterministically with explicit assurance", () => {
    const topology = compileEventContractTopology(observations);

    expect(topology.routes.map(({ subjectId, consumerIds }) => [subjectId, consumerIds])).toEqual([
      ["contract-midi-api", ["mobile-app"]],
      ["event-midi-note", ["multiplayer-relay", "recorder"]],
    ]);
    expect(topology.routes.flatMap(({ links }) => links).map(({ assurance }) => assurance)).toEqual([
      "heuristic", "validated", "exact",
    ]);
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
    const result = await createTopologyRelevanceAdapter(topology).discover("event-midi-note", 0, {
      repositoryRoot: "/repo",
      stateDigest: { gitBase: "base", worktreeDigest: hash("w"), canonicalProjectorDigest: hash("c"), toolchainDigest: hash("t") },
      config: {}, signal: new AbortController().signal,
    });
    expect(result.edges.map(({ entityId }) => entityId)).toEqual(["multiplayer-relay", "recorder"]);
    expect(result.edges.every(({ reason }) => reason.kind === "event-producer-consumer" && reason.provenance !== "inferred")).toBe(true);
    expect(result.dependency.query.kind).toBe("event-topology");
    expect(result.dependency.priorResult.resultCount).toBe(2);
  });

  it("does not claim bounded heuristic enumeration without an explicit bounded proof", () => {
    const route = compileEventContractTopology([observations[2]!]).routes[0]!;
    expect(route.observability).toBe("open");
    const bounded = compileEventContractTopology([observations[2]!], {
      observability: "bounded", method: "complete manifest scan", assumptions: ["manifest is authoritative"],
      blindSpots: [], dynamicMechanisms: [],
    }).routes[0]!;
    expect(bounded.observability).toBe("bounded");
  });
});
