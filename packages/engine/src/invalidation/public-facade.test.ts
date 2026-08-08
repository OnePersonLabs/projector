import * as engine from "../index.js";
import { describe, expect, it } from "vitest";

describe("engine public facade", () => {
  it("exports invalidation through @projector/engine's root barrel", () => {
    expect(engine.InvalidationEngine).toBeDefined();
    expect(engine.DerivationIndex).toBeDefined();
    expect(engine.createImpactClosure).toBeDefined();
  });

  it("exports identity, relevance, and context through @projector/engine's root barrel", () => {
    expect(engine.resolveSemanticIdentity).toBeDefined();
    expect(engine.AdjudicatedSemanticIdentityResolutionSchema).toBeDefined();
    expect(engine.compileRelevanceClosure).toBeDefined();
    expect(engine.activateAnalysisFacets).toBeDefined();
  });

  it("exports representation, governance policy, and plan revision APIs", () => {
    expect(engine.RepresentationCompiler).toBeDefined();
    expect(engine.UpgradeDeclarationSchema).toBeDefined();
    expect(engine.compileLayeredIgnorePolicy).toBeDefined();
    expect(engine.normalizeRiskPolicy).toBeDefined();
    expect(engine.InMemoryPlanRevisionStore).toBeDefined();
  });

  it("exports progressive architecture commitment APIs", () => {
    expect(engine.discoverArchitectureConcerns).toBeDefined();
    expect(engine.runArchitecturePreflight).toBeDefined();
    expect(engine.acceptArchitectureDecisions).toBeDefined();
  });
});
