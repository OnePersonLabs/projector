import { describe, expect, it } from "vitest";
import { compileIgnorePolicy, IgnorePolicyConflictError, compileLayeredIgnorePolicy } from "./ignore-policy.js";
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

  it("resolves repository/config/lens/rule precedence independently per role", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    const result = compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "repo-ignore-report", layer: "repository", concern: "reporting", effect: "ignore", selector: tagSelector("vendor") },
      { id: "config-include-report", layer: "config", concern: "reporting", effect: "include", selector: tagSelector("vendor") },
      { id: "lens-ignore-mutation", layer: "lens", concern: "mutation", effect: "ignore", selector: tagSelector("vendor") },
    ] });
    expect(result.byUnit[unit.id]).toMatchObject({ reporting: false, mutation: true, inventory: false });
  });

  it("fails conservatively on equal-precedence conflicts and unauthorized all-role erasure", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    expect(() => compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "a", layer: "rule", concern: "reporting", effect: "ignore", selector: tagSelector("vendor") },
      { id: "b", layer: "rule", concern: "reporting", effect: "include", selector: tagSelector("vendor") },
    ] })).toThrow(/conflicting layered ignore/u);
    expect(() => compileLayeredIgnorePolicy({ units: [unit], rules: [
      ...(["inventory", "inferenceAuthority", "mutation", "reporting", "modelContext", "coverageDenominator"] as const)
        .map((concern) => ({ id: `all-${concern}`, layer: "rule" as const, concern, effect: "ignore" as const, selector: tagSelector("vendor") })),
    ] })).toThrow(/all semantic roles/u);
  });
});
