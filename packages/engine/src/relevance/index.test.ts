import type {
  AdapterContext,
  ContentHash,
  RelevanceReason,
  RelevanceSeed,
  SemanticIdentityResolution,
  StateDigest,
  StateQueryDependency,
} from "@projector/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  analyzeIntent,
  classifyPlanningSurprise,
  compileRelevanceClosure,
  scoutRelevance,
  type RelevanceDiscoveryPort,
} from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const state: StateDigest = {
  gitBase: "base",
  worktreeDigest: hash("worktree"),
  canonicalProjectorDigest: hash("canonical"),
  toolchainDigest: hash("toolchain"),
};
const context: AdapterContext = {
  repositoryRoot: "/repo",
  stateDigest: state,
  config: {},
  signal: new AbortController().signal,
};
const seed = (subjectId: string): RelevanceSeed => ({
  kind: "semantic-entity",
  subjectId,
  reason: "explicit request target",
  confidence: 1,
});
const reason = (kind: RelevanceReason["kind"], fromId: string, confidence = 1): RelevanceReason => ({
  kind,
  fromId,
  weight: confidence,
  provenance: "derived",
  confidence,
  explanation: `${kind} from ${fromId}`,
  evidenceIds: [`evidence-${fromId}`],
});
const dependency = (
  id: string,
  resultCount: number,
  observability: "closed" | "bounded" | "open" | "sampled" | "unavailable" = "closed",
): StateQueryDependency => {
  const queryHash = hash(`query-${id}`);
  return {
    query: {
      id,
      kind: "relation-neighborhood",
      programId: "test.relevance",
      programVersion: "1",
      input: { id },
      semanticHash: queryHash,
    },
    priorResult: {
      queryHash,
      resultHash: hash(`result-${id}-${resultCount}`),
      resultCount,
      observability,
      assumptions: observability === "bounded" ? ["fixture boundary complete"] : [],
      unavailableLanes: observability === "unavailable" ? [id] : [],
      dependencyKeys: [`relations:${id}`],
    },
    role: `relevance expansion from ${id}`,
  };
};

const identityResolution = (selectedEntityIds = ["midi-timing"]): SemanticIdentityResolution => ({
  id: "resolution",
  requestedMeaning: "preserve Bluetooth MIDI timing",
  requestedKind: "requirement",
  outcome: "reuse-existing",
  candidates: [],
  selectedEntityIds,
  confidence: 1,
  evidence: [],
  unknowns: [],
  boundState: { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hash("identity-binding") },
  contentHash: hash("identity-resolution"),
});

describe("WHAT/WHY and WHERE/WHAT-ELSE separation", () => {
  it("keeps a proposed implementation out of behavioral intent", () => {
    const intent = analyzeIntent({
      request: "Use Redis to make live MIDI timing consistent",
      outcomes: ["live MIDI timing remains consistent"],
      constraints: ["preserve recorded ordering"],
      nonGoals: ["redesign avatars"],
      implementationProposals: ["use Redis"],
    });

    expect(intent.what).toEqual(["live MIDI timing remains consistent"]);
    expect(intent.why).toEqual(["preserve recorded ordering"]);
    expect(intent.solutionProposals).toEqual(["use Redis"]);
    expect(intent.behavioralMeaning).not.toContain("Redis");
  });

  it("lets the independent scout inspect topology without selecting HOW or authorizing mutation", async () => {
    const result = await scoutRelevance({ request: "change MIDI event schema", namedTargets: ["MidiNoteCaptured"] }, {
      inspect: async () => ({
        seeds: [seed("event-midi-note")],
        discoveredIds: ["recorder", "relay"],
        questions: ["which consumers decode the event?"],
        unavailableLanes: [],
      }),
    });

    expect(result.discoveredIds).toEqual(["recorder", "relay"]);
    expect(result).not.toHaveProperty("technology");
    expect(result).not.toHaveProperty("allowedWrites");
  });
});

describe("bounded four-band Relevance Closure", () => {
  const port = (shuffle = false): RelevanceDiscoveryPort => ({
    discover: async (subjectId) => {
      const rows = subjectId === "midi-timing" ? [
        { entityId: "session-clock", band: "governing" as const, score: 0.98, requiredForPlanning: true, reason: reason("governs", subjectId), cost: 10 },
        { entityId: "weak-avatar-neighbor", band: "possible" as const, score: 0.1, requiredForPlanning: false, reason: reason("semantic-similarity", subjectId, 0.1), cost: 10 },
      ] : subjectId === "session-clock" ? [
        { entityId: "multiplayer-ordering", band: "consequence" as const, score: 0.8, requiredForPlanning: true, reason: reason("depends-on", subjectId, 0.9), cost: 10 },
        { entityId: "recording", band: "consequence" as const, score: 0.75, requiredForPlanning: true, reason: reason("event-producer-consumer", subjectId, 0.9), cost: 10 },
      ] : [];
      const edges = shuffle ? [...rows].reverse() : rows;
      return { edges, dependency: dependency(`neighbors-${subjectId}`, edges.length) };
    },
  });

  it("finds physically distant governing and downstream semantics while refusing weak over-expansion", async () => {
    const compiled = await compileRelevanceClosure({
      request: "change Bluetooth MIDI timestamp compensation",
      seeds: [seed("midi-timing")],
      identityResolution: identityResolution(),
      activatedFacetKeys: ["behavior", "events"],
      compiledAgainst: state,
      context,
      discovery: port(),
      valueDependencies: [{ kind: "canonical-entity", id: "midi-timing", versionHash: hash("midi"), role: "direct semantic meaning" }],
      policy: { maxEntries: 5, maxDepth: 2, maxCost: 50, minimumScore: 0.2 },
    });

    expect(compiled.closure.entries.map(({ entityId, band }) => [entityId, band])).toEqual([
      ["midi-timing", "direct"],
      ["session-clock", "governing"],
      ["multiplayer-ordering", "consequence"],
      ["recording", "consequence"],
    ]);
    expect(compiled.closure.entries.some(({ entityId }) => entityId.includes("avatar"))).toBe(false);
    expect(compiled.metrics.irrelevantExpansionRate).toBeGreaterThan(0);
    expect(compiled.closure.boundState.queryDependencies.map(({ query }) => query.id)).toEqual([
      "neighbors-midi-timing", "neighbors-multiplayer-ordering", "neighbors-recording", "neighbors-session-clock",
    ]);
  });

  it("binds empty stopping queries and records open-world emptiness as unknown rather than absence", async () => {
    const discovery: RelevanceDiscoveryPort = {
      discover: async (subjectId) => ({
        edges: [],
        dependency: dependency(`event-consumers-${subjectId}`, 0, "sampled"),
      }),
    };
    const compiled = await compileRelevanceClosure({
      request: "change MIDI event",
      seeds: [seed("midi-event")],
      identityResolution: identityResolution(["midi-event"]),
      activatedFacetKeys: ["events"],
      compiledAgainst: state,
      context,
      discovery,
      valueDependencies: [],
      policy: { maxEntries: 4, maxDepth: 1, maxCost: 20, minimumScore: 0.1 },
    });

    expect(compiled.closure.boundState.queryDependencies).toHaveLength(1);
    expect(compiled.closure.unknowns.join(" ")).toMatch(/sampled.*cannot prove absence/i);
  });

  it("keeps an open discovery lane uncertain even when it returns a known consumer", async () => {
    const compiled = await compileRelevanceClosure({
      request: "change an externally extensible event",
      seeds: [seed("open-event")],
      identityResolution: identityResolution(["open-event"]),
      activatedFacetKeys: ["events"], compiledAgainst: state, context,
      discovery: {
        discover: async (subjectId) => ({
          edges: subjectId === "open-event" ? [{
            entityId: "known-consumer", band: "consequence", score: 0.8, requiredForPlanning: true,
            reason: reason("event-producer-consumer", subjectId), cost: 1,
          }] : [],
          dependency: dependency(`open-${subjectId}`, subjectId === "open-event" ? 1 : 0, "open"),
        }),
      },
      valueDependencies: [], policy: { maxEntries: 4, maxDepth: 1, maxCost: 20, minimumScore: 0.1 },
    });

    expect(compiled.closure.entries.some(({ entityId }) => entityId === "known-consumer")).toBe(true);
    expect(compiled.closure.unknowns.join(" ")).toMatch(/open.*cannot prove.*complete|open.*additional/i);
  });

  it("refuses to combine identity evidence compiled against a different state snapshot", async () => {
    const staleIdentity = identityResolution();
    staleIdentity.boundState.compiledAgainst = { ...state, canonicalProjectorDigest: hash("different") };
    await expect(compileRelevanceClosure({
      request: "stale identity", seeds: [seed("midi-timing")], identityResolution: staleIdentity,
      activatedFacetKeys: [], compiledAgainst: state, context,
      discovery: { discover: async (subjectId) => ({ edges: [], dependency: dependency(`q-${subjectId}`, 0) }) },
      valueDependencies: [], policy: { maxEntries: 2, maxDepth: 0, maxCost: 1, minimumScore: 0.1 },
    })).rejects.toThrow(/state|snapshot|stale/i);
  });

  it("fails visibly when a required discovery lane is unavailable", async () => {
    const compiled = await compileRelevanceClosure({
      request: "change public MIDI contract",
      seeds: [seed("midi-contract")],
      identityResolution: identityResolution(["midi-contract"]),
      activatedFacetKeys: ["public-contract"],
      compiledAgainst: state,
      context,
      discovery: { discover: async () => ({ edges: [], dependency: dependency("contracts", 0, "unavailable") }) },
      valueDependencies: [],
      policy: { maxEntries: 4, maxDepth: 1, maxCost: 20, minimumScore: 0.1 },
    });

    expect(compiled.closure.unavailableLanes).toEqual(["contracts"]);
    expect(compiled.closure.unknowns.join(" ")).toMatch(/unavailable/i);
  });

  it("retains a frontier and stops deterministically at entry/depth/cost bounds", async () => {
    const discovery: RelevanceDiscoveryPort = {
      discover: async (subjectId) => ({
        edges: [1, 2, 3].map((index) => ({
          entityId: `${subjectId}-${index}`,
          band: "possible" as const,
          score: 0.8 - index / 10,
          requiredForPlanning: false,
          reason: reason("historical-cochange", subjectId, 0.7),
          cost: 4,
        })),
        dependency: dependency(`q-${subjectId}`, 3),
      }),
    };
    const compiled = await compileRelevanceClosure({
      request: "bounded request",
      seeds: [seed("root")],
      identityResolution: identityResolution(["root"]),
      activatedFacetKeys: [],
      compiledAgainst: state,
      context,
      discovery,
      valueDependencies: [],
      policy: { maxEntries: 3, maxDepth: 2, maxCost: 8, minimumScore: 0.1 },
    });

    expect(compiled.closure.entries).toHaveLength(3);
    expect(compiled.frontier.length).toBeGreaterThan(0);
    expect(compiled.closure.unknowns.join(" ")).toMatch(/budget|bound/i);
  });

  it("is reproducible under seed and discovery insertion permutations", async () => {
    await fc.assert(fc.asyncProperty(fc.boolean(), async (reverse) => {
      const seeds = [seed("midi-timing"), seed("midi-timing")];
      const compiled = await compileRelevanceClosure({
        request: "stable request",
        seeds: reverse ? seeds.reverse() : seeds,
        identityResolution: identityResolution(),
        activatedFacetKeys: reverse ? ["events", "behavior"] : ["behavior", "events"],
        compiledAgainst: state,
        context,
        discovery: port(reverse),
        valueDependencies: [],
        policy: { maxEntries: 5, maxDepth: 2, maxCost: 50, minimumScore: 0.2 },
      });
      const baseline = await compileRelevanceClosure({
        request: "stable request",
        seeds,
        identityResolution: identityResolution(),
        activatedFacetKeys: ["behavior", "events"],
        compiledAgainst: state,
        context,
        discovery: port(false),
        valueDependencies: [],
        policy: { maxEntries: 5, maxDepth: 2, maxCost: 50, minimumScore: 0.2 },
      });
      expect(compiled.closure).toEqual(baseline.closure);
    }));
  });
});

describe("predicted versus observed Planning Surprises", () => {
  it("proposes an evidence-backed missing relationship without silently making it canonical", () => {
    const result = classifyPlanningSurprise({
      planId: "plan-midi",
      predictedEntityIds: ["midi-timing"],
      observed: [{
        entityId: "replay-normalization",
        impact: "semantic",
        legitimacy: "required",
        authorized: true,
        evidence: [{ evidenceId: "reverse-analysis", stance: "supports" }],
        proposedRelation: { fromId: "midi-timing", toId: "replay-normalization", type: "depends-on" },
      }],
    });

    expect(result.surprise.kind).toBe("missing-relation");
    expect(result.surprise.disposition).toBe("accept-and-learn");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({ status: "proposed", canonical: false });
    expect(result.proposals[0]?.evidence).toHaveLength(1);
  });

  it("classifies unrelated agent edits as overreach and refuses to learn a false relationship", () => {
    const result = classifyPlanningSurprise({
      planId: "plan-midi",
      predictedEntityIds: ["midi-timing"],
      observed: [{
        entityId: "avatar-ui",
        impact: "code",
        legitimacy: "unexplained",
        authorized: false,
        evidence: [{ evidenceId: "diff", stance: "supports" }],
      }],
    });

    expect(result.surprise.kind).toBe("agent-overreach");
    expect(result.surprise.disposition).toBe("revert-overreach");
    expect(result.proposals).toEqual([]);
  });

  it("maps analysis deficiency and benign incidental mutation to stable normative surprise kinds", () => {
    const deficiency = classifyPlanningSurprise({
      planId: "plan", predictedEntityIds: [],
      observed: [{ entityId: "missed-code", impact: "code", legitimacy: "analysis-deficiency", authorized: true, evidence: [] }],
    });
    const incidental = classifyPlanningSurprise({
      planId: "plan", predictedEntityIds: [],
      observed: [{ entityId: "formatter", impact: "code", legitimacy: "incidental", authorized: true, evidence: [] }],
    });
    expect(deficiency.classification).toBe("missing-predicted-impact");
    expect(deficiency.surprise.kind).toBe("unpredicted-code-impact");
    expect(incidental.classification).toBe("incidental-change");
    expect(incidental.surprise.kind).toBe("benign-discovery");
  });
});
