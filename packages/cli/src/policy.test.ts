import { describe, expect, it } from "vitest";

import { normalizeExecutionPolicy } from "./policy.js";

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
});
