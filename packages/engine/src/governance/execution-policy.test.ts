import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assertGovernanceConflictPolicy, normalizeRiskPolicy, riskRank } from "./execution-policy.js";

describe("risk policy", () => {
  it("never weakens approval, isolation, evidence, or validation as risk rises", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 }), (a, b) => {
      const low = normalizeRiskPolicy(["R0", "R1", "R2", "R3", "R4"][Math.min(a, b)]! as any);
      const high = normalizeRiskPolicy(["R0", "R1", "R2", "R3", "R4"][Math.max(a, b)]! as any);
      expect(riskRank(high.approval)).toBeGreaterThanOrEqual(riskRank(low.approval));
      expect(riskRank(high.worktree)).toBeGreaterThanOrEqual(riskRank(low.worktree));
      expect(riskRank(high.independentValidation)).toBeGreaterThanOrEqual(riskRank(low.independentValidation));
      expect(high.minimumEvidence).toBeGreaterThanOrEqual(low.minimumEvidence);
    }));
  });

  it("blocks canonical governance conflicts in mutation modes", () => {
    expect(() => assertGovernanceConflictPolicy("govern", [".projector/rules/a.json"])).toThrow(/canonical governance conflict/u);
    expect(() => assertGovernanceConflictPolicy("autonomous", [".projector/lenses/a.json"])).toThrow(/canonical governance conflict/u);
    expect(() => assertGovernanceConflictPolicy("guide", [".projector/rules/a.json"])).not.toThrow();
  });
});
