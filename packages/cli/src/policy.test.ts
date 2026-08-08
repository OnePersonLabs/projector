import { describe, expect, it } from "vitest";

import fc from "fast-check";
import { assertOperationRiskAuthorized, deriveOperationRisk, normalizeExecutionPolicy } from "./policy.js";

describe("CLI execution-policy normalization", () => {
  it("normalizes guide apply to bounded R1 automatic mutation", () => {
    expect(normalizeExecutionPolicy({ command: "apply", mode: "guide", dryRun: false })).toMatchObject({
      preset: "guide",
      maximumAutomaticRisk: "R1",
      allowAutoMutation: true,
      network: "deny",
      externalWrites: "deny",
    });
  });

  it("rejects contradictory mutation flags", () => {
    expect(() => normalizeExecutionPolicy({
      command: "apply",
      mode: "observe",
      dryRun: false,
    })).toThrow(/observe.*apply/u);
    expect(() => normalizeExecutionPolicy({
      command: "apply",
      mode: "guide",
      dryRun: true,
      auditOnly: true,
    })).toThrow(/contradictory/u);
  });

  it("normalizes friendly aliases to the identical internal policy", () => {
    expect(normalizeExecutionPolicy({ command: "audit", mode: "observe" }))
      .toEqual(normalizeExecutionPolicy({ command: "audit", auditOnly: true }));
    expect(normalizeExecutionPolicy({ command: "apply", mode: "guide", dryRun: true }))
      .toEqual(normalizeExecutionPolicy({ command: "plan", mode: "guide" }));
  });

  it("uses modes only as monotone permission and proof presets", () => {
    const observe = normalizeExecutionPolicy({ command: "audit", mode: "observe" });
    const govern = normalizeExecutionPolicy({ command: "apply", mode: "govern" });
    const autonomous = normalizeExecutionPolicy({ command: "apply", mode: "autonomous" });
    const salvage = normalizeExecutionPolicy({ command: "apply", mode: "salvage" });
    expect(observe.allowAutoMutation).toBe(false);
    expect(govern.maximumAutomaticRisk).toBe("R1");
    expect(autonomous.requireIndependentValidationAtOrAbove).toBe("R1");
    expect(salvage.requireWorktreeAtOrAbove).toBe("R2");
    expect(salvage.maximumAutomaticRisk).not.toBe("R4");
    expect(normalizeExecutionPolicy({ command: "apply", mode: "autonomous", dryRun: true })).toMatchObject({ preset: "autonomous", allowAutoMutation: false, maximumAutomaticRisk: "R0" });
  });

  it("rejects all contradictory read-only and mutation combinations", () => {
    expect(() => normalizeExecutionPolicy({ command: "reconcile", auditOnly: true })).toThrow(/contradictory/u);
    expect(() => normalizeExecutionPolicy({ command: "audit", mode: "autonomous", auditOnly: true })).toThrow(/contradictory/u);
  });

  it("derives command risk from side effects and keeps authorization monotone", () => {
    expect(deriveOperationRisk({ command: "audit", sideEffect: "read-only", externalWrite: false, canonicalMutation: false })).toBe("R0");
    expect(deriveOperationRisk({ command: "init", sideEffect: "canonical-write", externalWrite: false, canonicalMutation: true })).toBe("R2");
    expect(deriveOperationRisk({ command: "apply", sideEffect: "workspace-write", externalWrite: false, canonicalMutation: false })).toBe("R1");
    expect(deriveOperationRisk({ command: "reconcile", sideEffect: "external-write", externalWrite: true, canonicalMutation: true })).toBe("R3");
    const policy = { ...normalizeExecutionPolicy({ command: "apply", mode: "guide" }), maximumAutomaticRisk: "R3" as const };
    expect(() => assertOperationRiskAuthorized(policy, "R0")).not.toThrow();
    expect(() => assertOperationRiskAuthorized(policy, "R1")).not.toThrow();
    fc.assert(fc.property(fc.integer({ min: 0, max: 3 }), (maximum) => {
      const risks = ["R0", "R1", "R2", "R3"] as const;
      risks.forEach((risk, index) => {
        const candidate = { ...policy, maximumAutomaticRisk: risks[maximum]! };
        if (index <= maximum) expect(() => assertOperationRiskAuthorized(candidate, risk)).not.toThrow();
        else expect(() => assertOperationRiskAuthorized(candidate, risk)).toThrow();
      });
    }));
  });
});
