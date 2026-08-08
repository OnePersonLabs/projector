import { describe, expect, it } from "vitest";
import fc from "fast-check";
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

  it("prefers semantic exactness over broad any selectors at the same layer", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    const broad = { op: "any" as const, items: [tagSelector("vendor"), tagSelector("generated")] };
    const result = compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "broad", layer: "rule", concern: "mutation", effect: "ignore", selector: broad },
      { id: "exact", layer: "rule", concern: "mutation", effect: "include", selector: tagSelector("vendor") },
    ] });
    expect(result.byUnit[unit.id]!.mutation).toBe(false);
  });

  it("keeps exact atoms above any/not/glob breadth regardless of branch count", () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 20 }), (count) => {
      const unit = projectionUnit("vendor", { tags: ["vendor"] });
      const broad = { op: "any" as const, items: Array.from({ length: count }, (_, index) => index === 0
        ? tagSelector("vendor")
        : ({ op: "atom" as const, field: "path" as const, matcher: "glob" as const, value: `**/${index}/**` })) };
      const result = compileLayeredIgnorePolicy({ units: [unit], rules: [
        { id: "broad", layer: "rule", concern: "reporting", effect: "ignore", selector: broad },
        { id: "exact", layer: "rule", concern: "reporting", effect: "include", selector: tagSelector("vendor") },
      ] });
      expect(result.byUnit[unit.id]!.reporting).toBe(false);
    }));
  });

  it("uses semantic containment for in subsets and conjunctions", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    const broad = { op: "atom" as const, field: "tag" as const, matcher: "in" as const, value: ["vendor", "generated"] };
    const narrow = { op: "all" as const, items: [tagSelector("vendor"), { op: "atom" as const, field: "artifact-role" as const, matcher: "equals" as const, value: unit.role }] };
    const result = compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "broad", layer: "rule", concern: "mutation", effect: "ignore", selector: broad },
      { id: "narrow", layer: "rule", concern: "mutation", effect: "include", selector: narrow },
    ] });
    expect(result.byUnit[unit.id]!.mutation).toBe(false);
  });

  it("fails closed for overlapping incomparable or unsupported conflicting selectors", () => {
    const unit = projectionUnit("vendor", { tags: ["vendor"] });
    expect(() => compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "tag", layer: "rule", concern: "reporting", effect: "ignore", selector: tagSelector("vendor") },
      { id: "role", layer: "rule", concern: "reporting", effect: "include", selector: { op: "atom", field: "artifact-role", matcher: "equals", value: unit.role } },
    ] })).toThrow(/conflicting layered ignore/u);
    expect(() => compileLayeredIgnorePolicy({ units: [unit], rules: [
      { id: "contains", layer: "rule", concern: "mutation", effect: "ignore", selector: { op: "atom", field: "tag", matcher: "contains", value: "vendor" } },
      { id: "exact", layer: "rule", concern: "mutation", effect: "include", selector: tagSelector("vendor") },
    ] })).toThrow(/conflicting layered ignore/u);
  });
});
