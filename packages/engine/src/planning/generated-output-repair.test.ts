import { describe, expect, it } from "vitest";
import { planGeneratedOutputRepair } from "./generated-output-repair.js";
describe("generated output upstream repair policy", () => {
  it("plans upstream change regeneration and validation while rejecting direct patches and unauthenticated overlays", () => {
    const capable = { validatorCanProveValidity: true, deterministicPatch: true, patchIsReversible: true, generator: true, upstreamSourceKnown: true };
    expect(planGeneratedOutputRepair({ capabilities: capable, intent: "upstream-regeneration" })).toEqual({ strategy: "upstream-regeneration", operations: ["change-upstream", "regenerate", "validate"] });
    expect(() => planGeneratedOutputRepair({ capabilities: capable, intent: "direct-generated-patch" })).toThrow(/direct generated-output repair is forbidden/iu);
    const withoutGenerator = { ...capable, generator: false };
    expect(() => planGeneratedOutputRepair({ capabilities: withoutGenerator, intent: "temporary-generated-overlay", temporaryOverlay: { migrationId: "", debtId: "debt:one", exitCriteria: [] } })).toThrow(/migration.*debt.*exit criteria/iu);
    expect(planGeneratedOutputRepair({ capabilities: withoutGenerator, intent: "temporary-generated-overlay", temporaryOverlay: { migrationId: "migration:one", debtId: "debt:one", exitCriteria: ["generator supports source"] } })).toMatchObject({ strategy: "temporary-overlay", operations: ["apply-overlay", "validate"] });
  });
});
