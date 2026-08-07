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
});
