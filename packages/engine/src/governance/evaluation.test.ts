import { describe, expect, it } from "vitest";
import type { EnumerationContract, NormalizedPredicate, SelectorExpr } from "@projector/core";
import { compileEffectiveRuleBundle } from "./rules.js";
import { evaluateEffectiveRuleBundle, type GovernanceObservation } from "./evaluation.js";
import { projectionUnit, rule } from "./test-fixtures.js";

const path = (value: string): SelectorExpr => ({ op: "atom", field: "path", matcher: "glob", value });
const all: SelectorExpr = { op: "all", items: [] };
const closed: EnumerationContract = { observability: "closed", method: "static import syntax", assumptions: [], blindSpots: [], dynamicMechanisms: [] };
const subject = (id: string, value: string) => ({ id, values: { path: value }, dependencyKeys: [`file:${value}`] });
const observation = (overrides: Partial<GovernanceObservation> = {}): GovernanceObservation => ({
  subjects: [subject("core", "packages/core/src/value.ts"), subject("engine", "packages/engine/src/value.ts")],
  unitIds: overrides.unitIds ?? overrides.subjects?.map(({ id }) => id) ?? ["core", "engine"],
  dependencies: [], unitEnumeration: closed, dependencyEnumerations: [{ unitId: "core", contract: closed, unknowns: [] }], ...overrides,
});
function evaluate(predicates: NormalizedPredicate[], observed = observation(), validatorIds: string[] = []) {
  return evaluateEffectiveRuleBundle(compileEffectiveRuleBundle({ unit: projectionUnit("core"), operation: "reconcile",
    rules: [rule("boundary", { selector: all, predicates, validatorIds })] }), observed);
}
const forbidden: NormalizedPredicate = { kind: "dependency-forbidden", from: path("packages/core/**"), to: path("packages/engine/**") };

describe("observed predicate evaluation", () => {
  it("accepts different handwritten implementations and respects path segments", () => {
    const predicate: NormalizedPredicate = { kind: "path-under", root: "packages/core" };
    for (const file of ["packages/core/src/a.ts", "packages/core/other/b.ts"]) {
      expect(evaluate([predicate], observation({ subjects: [subject("core", file)] })).status).toBe("conformant");
    }
    expect(evaluate([predicate], observation({ subjects: [subject("core", "packages/core2/a.ts")] })).status).toBe("violated");
    for (const file of ["packages\\core\\a.ts", "packages/core/../other.ts"]) {
      expect(evaluate([predicate], observation({ subjects: [subject("core", file)] })).status).toBe("unknown");
    }
  });

  it("finds an observed forbidden edge even when enumeration is open, independent of order/duplicates", () => {
    const edge = { fromUnitId: "core", toSubjectId: "engine", specifier: "@projector/engine", evidenceIds: ["import:1"] };
    const observed = observation({ dependencies: [edge], dependencyEnumerations: [{ unitId: "core", contract: { ...closed, observability: "open" }, unknowns: [] }] });
    const first = evaluate([forbidden], observed);
    expect(first.status).toBe("violated");
    expect(first.findings[0]).toMatchObject({ status: "violated", ruleId: "boundary", evidenceIds: ["import:1"] });
    expect(evaluate([forbidden], { ...observed, subjects: [...observed.subjects].reverse(), dependencies: [edge, edge] })).toEqual(first);
  });

  it.each(["open", "sampled", "unavailable"] as const)("does not prove absence with %s observations", (observability) => {
    expect(evaluate([forbidden], observation({ dependencyEnumerations: [{ unitId: "core", contract: { ...closed, observability }, unknowns: [] }] })).status).toBe("unknown");
  });

  it("accepts bounded static evidence and retains its stated coverage limit", () => {
    const contract = { ...closed, observability: "bounded" as const, assumptions: ["Static imports only."], blindSpots: ["Runtime dependency mechanisms."] };
    const result = evaluate([forbidden], observation({ dependencyEnumerations: [{ unitId: "core", contract, unknowns: [] }] }));
    expect(result.status).toBe("conformant");
    expect(result.boundary).toContain("Static imports only.");
    expect(evaluate([forbidden], observation({ dependencyEnumerations: [{ unitId: "core", contract, unknowns: ["Unresolved relative import."] }] })).status).toBe("unknown");
  });

  it("interprets allowed targets as a union and keeps unresolved edges unknown", () => {
    const predicates: NormalizedPredicate[] = ["packages/core/**", "packages/shared/**"].map((value) => ({ kind: "dependency-allowed", from: all, to: path(value) }));
    const edge = { fromUnitId: "core", toSubjectId: "core", specifier: "./value.js", evidenceIds: ["import:local"] };
    expect(evaluate(predicates, observation({ dependencies: [edge] })).status).toBe("conformant");
    expect(evaluate(predicates, observation({ dependencies: [edge, { ...edge, toSubjectId: "engine" }] })).status).toBe("violated");
    expect(evaluate(predicates, observation({ dependencies: [{ fromUnitId: "core", specifier: "./missing.js", evidenceIds: [] }] })).status).toBe("unknown");
  });

  it("does not turn an unavailable target selector fact into negative proof", () => {
    const observed = observation({ subjects: [{ id: "core", values: {}, dependencyKeys: [] }] });
    expect(evaluate([forbidden], observed).status).toBe("unknown");
  });

  it("enforces cardinality bounds without claiming absence in an open universe", () => {
    const predicate: NormalizedPredicate = { kind: "cardinality", selector: all, min: 1, max: 2 };
    expect(evaluate([predicate]).status).toBe("conformant");
    expect(evaluate([predicate], observation({ subjects: [...observation().subjects, subject("third", "third.ts")], unitEnumeration: { ...closed, observability: "open" } })).status).toBe("violated");
    expect(evaluate([{ kind: "cardinality", selector: path("absent/**"), min: 1 }], observation({ unitEnumeration: { ...closed, observability: "open" } })).status).toBe("unknown");
    for (const bounds of [{ min: -1 }, { min: 1.5 }, { min: 2, max: 1 }, {}]) {
      expect(evaluate([{ kind: "cardinality", selector: all, ...bounds }]).status).toBe("unknown");
    }
    expect(() => evaluate([predicate], observation({ subjects: [subject("core", "a.ts"), subject("core", "b.ts")] }))).toThrow(/duplicate/iu);
  });

  it("does not count dependency-only external subjects as repository units", () => {
    const observed = observation({ subjects: [...observation().subjects, { id: "external:zod", values: { package: "zod" }, dependencyKeys: [] }], unitIds: ["core", "engine"] });
    expect(evaluate([{ kind: "cardinality", selector: all, max: 2 }], observed).status).toBe("conformant");
  });

  it("leaves unsupported predicates and unregistered validator names unknown", () => {
    expect(evaluate([{ kind: "schema-valid", schemaId: "claimed-pass" }]).status).toBe("unknown");
    expect(evaluate([forbidden], observation(), ["node run-arbitrary-code.js"]).status).toBe("unknown");
    expect(evaluate([forbidden], observation(), ["projector.builtin.static-dependency-boundary@1"]).status).toBe("conformant");
  });
});
