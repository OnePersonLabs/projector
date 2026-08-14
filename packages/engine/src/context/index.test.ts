import type {
  AnalysisFacet,
  ContentHash,
  RelevanceClosure,
  SelectorExpr,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import {
  activateAnalysisFacets,
  compileContext,
} from "./index.js";

const hash = (value: string): ContentHash => `sha256:v1:${value.padEnd(64, "0")}`;
const selector = (field: "tag" | "concept-kind", value: string): SelectorExpr => ({ op: "atom", field, matcher: "equals", value });
const facet = (key: string, expression: SelectorExpr): AnalysisFacet => ({
  key,
  version: "1",
  selector: expression,
  questionKeys: [`${key}.questions`],
  relevanceRuleIds: [`${key}.relevance`],
  requiredEvidenceLanes: ["test"],
  outputKinds: [`${key}.report`],
});

describe("Analysis Facets", () => {
  it("composes only applicable facets and adds obligations without selecting technology", () => {
    const simple = activateAnalysisFacets(
      [facet("events", selector("concept-kind", "event")), facet("behavior", selector("tag", "behavior"))],
      { id: "simple", values: { tag: ["behavior"] }, dependencyKeys: ["request:simple"] },
    );
    const realtime = activateAnalysisFacets(
      [
        facet("public-contract", selector("tag", "public-contract")),
        facet("realtime", selector("tag", "realtime")),
        facet("events", selector("concept-kind", "event")),
        facet("behavior", selector("tag", "behavior")),
      ],
      {
        id: "event-change",
        values: { tag: ["behavior", "realtime", "public-contract"], "concept-kind": ["event"] },
        dependencyKeys: ["request:event-change"],
      },
    );

    expect(simple.facetKeys).toEqual(["behavior"]);
    expect(realtime.facetKeys).toEqual(["behavior", "events", "public-contract", "realtime"]);
    expect(realtime).not.toHaveProperty("technology");
    expect(realtime).not.toHaveProperty("architectureChoice");
  });
});

describe("bounded context and derived behavior views", () => {
  const closure: RelevanceClosure = {
    id: "closure",
    requestHash: hash("request"),
    seeds: [],
    entries: [
      { entityId: "direct", band: "direct", score: 1, requiredForPlanning: true, reasons: [] },
      { entityId: "governing", band: "governing", score: 0.9, requiredForPlanning: true, reasons: [] },
      { entityId: "consequence", band: "consequence", score: 0.7, requiredForPlanning: false, reasons: [] },
      { entityId: "possible", band: "possible", score: 0.4, requiredForPlanning: false, reasons: [{
        kind: "semantic-similarity", fromId: "direct", weight: 0.4, provenance: "inferred", confidence: 0.4,
        explanation: "may share timing semantics", evidenceIds: ["similarity-evidence"],
      }] },
    ],
    activatedFacetKeys: [],
    unknowns: [],
    unavailableLanes: [],
    boundState: {
      compiledAgainst: { gitBase: "base", worktreeDigest: hash("w"), canonicalProjectorDigest: hash("c"), toolchainDigest: hash("t") },
      valueDependencies: [], queryDependencies: [], dependencyDigest: hash("binding"),
    },
    contentHash: hash("closure"),
  };

  it("uses full, summary, and identity-only disclosure by semantic band without identity forks", async () => {
    const compiled = await compileContext(closure, {
      load: async (id) => ({
        entityId: id,
        kind: id === "governing" ? "requirement" : "concept",
        semanticHash: hash(id),
        full: `full ${id}`,
        summary: `summary ${id}`,
      }),
    }, { maxCost: 100 });

    expect(compiled.items.map(({ entityId, disclosure }) => [entityId, disclosure])).toEqual([
      ["direct", "full"], ["governing", "full"], ["consequence", "summary"], ["possible", "identity"],
    ]);
    expect(new Set(compiled.items.map(({ entityId }) => entityId)).size).toBe(4);
    expect(compiled.sourceClosureId).toBe("closure");
    expect(compiled.items.find(({ entityId }) => entityId === "possible")).toMatchObject({
      relevanceReasons: ["may share timing semantics"], confidence: 0.4,
      uncertainty: ["inferred semantic-similarity at confidence 0.4"],
    });
  });

  it("exposes required semantic context that overruns the soft budget", async () => {
    const compiled = await compileContext(closure, {
      load: async (id) => ({ entityId: id, kind: "concept", semanticHash: hash(id), full: `full ${id}`, summary: `summary ${id}` }),
    }, { maxCost: 4 });
    expect(compiled.requiredBudgetOverrun).toBeGreaterThan(0);
    expect(compiled.requiredExpansionIds).toEqual(["direct", "governing"]);
    expect(compiled.unknowns.join(" ")).toMatch(/required.*budget/i);
  });

});
