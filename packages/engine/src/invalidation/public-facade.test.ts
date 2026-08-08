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
});
