import * as engine from "../index.js";
import { describe, expect, it } from "vitest";

describe("engine public facade", () => {
  it("exports invalidation through @projector/engine's root barrel", () => {
    expect(engine.InvalidationEngine).toBeDefined();
    expect(engine.DerivationIndex).toBeDefined();
    expect(engine.createImpactClosure).toBeDefined();
  });
});
