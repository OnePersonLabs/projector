import { describe, expect, it } from "vitest";
import { compileIgnorePolicy, IgnorePolicyConflictError } from "./ignore-policy.js";
import { projectionUnit, tagSelector } from "./test-fixtures.js";

describe("layered ignore policy", () => {
  it("excludes each semantic role independently", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    const result = compileIgnorePolicy({
      policy: {
        inventory: [], inferenceAuthority: [tagSelector("vendor")], mutation: [tagSelector("vendor")],
        reporting: [], modelContext: [tagSelector("secret")], coverageDenominator: [],
      },
      units: [unit],
    });
    expect(result.byUnit[unit.id]).toEqual({
      inventory: false, inferenceAuthority: true, mutation: true,
      reporting: false, modelContext: false, coverageDenominator: false,
    });
  });

  it("is deterministic under rule order and rejects conflicting duplicate rule identities", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor", "generated"] });
    const first = compileIgnorePolicy({ policy: {
      inventory: [tagSelector("vendor"), tagSelector("generated")], inferenceAuthority: [], mutation: [], reporting: [], modelContext: [], coverageDenominator: [],
    }, units: [unit] });
    const second = compileIgnorePolicy({ policy: {
      inventory: [tagSelector("generated"), tagSelector("vendor")], inferenceAuthority: [], mutation: [], reporting: [], modelContext: [], coverageDenominator: [],
    }, units: [unit] });
    expect(first.policyHash).toBe(second.policyHash);
    expect(() => compileIgnorePolicy({ policy: {
      inventory: [tagSelector("vendor"), tagSelector("generated")], inferenceAuthority: [], mutation: [], reporting: [], modelContext: [], coverageDenominator: [],
    }, units: [unit], ruleIds: { inventory: ["ignore:same", "ignore:same"] } })).toThrow(IgnorePolicyConflictError);
  });
});
