import type {
  AnalysisFacet,
  BehavioralScenario,
  ContentHash,
  RelevanceClosure,
  Requirement,
  SelectorExpr,
} from "@projector/core";
import { describe, expect, it } from "vitest";

import {
  activateAnalysisFacets,
  compileContext,
  deriveBehaviorViews,
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
      { entityId: "possible", band: "possible", score: 0.4, requiredForPlanning: false, reasons: [] },
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
  });

  it("derives Markdown, Gherkin, compact, and machine views from the same canonical Requirement/Scenario identities", () => {
    const requirement: Requirement = {
      id: "req-timing", key: "REQ-TIMING", title: "Stable timing", aliases: [],
      statement: "MIDI timing must remain stable", status: "active", sourceClass: "authored",
      scope: selector("tag", "midi"), origin: [], evidence: [], discoveryHash: hash("req-d"), semanticHash: hash("req-s"),
    };
    const scenario: BehavioralScenario = {
      id: "scenario-timing", key: "SCENARIO-TIMING", title: "Wireless timing", aliases: [],
      status: "active", sourceClass: "authored", scope: selector("tag", "midi"), evidence: [],
      steps: [
        { role: "precondition", statement: "a wireless MIDI device is connected" },
        { role: "trigger", statement: "a note arrives" },
        { role: "expected-outcome", statement: "recorded ordering stays stable" },
      ],
      discoveryHash: hash("scenario-d"), semanticHash: hash("scenario-s"),
    };

    const views = deriveBehaviorViews(requirement, scenario, ["markdown", "gherkin", "agent-compact", "machine-invariant"]);
    expect(views.map(({ format }) => format)).toEqual(["agent-compact", "gherkin", "machine-invariant", "markdown"]);
    expect(views.every(({ requirementId }) => requirementId === requirement.id)).toBe(true);
    expect(views.every(({ scenarioId }) => scenarioId === scenario.id)).toBe(true);
    expect(new Set(views.map(({ derivedId }) => derivedId)).size).toBe(4);
    expect(requirement.statement).toBe("MIDI timing must remain stable");
  });
});
