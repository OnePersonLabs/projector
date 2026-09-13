import { DerivedObservationBudget, ObservationError, type ProjectionLens, type SelectorExpr } from "@projector/core";
import { describe, expect, it } from "vitest";

import { authorityRecord, projectionUnit, tagSelector } from "./test-fixtures.js";
import {
  GovernanceCycleError,
  LensCompilationError,
  compileProjectionLenses,
  createRepositoryScriptLens,
} from "./index.js";

function separatelyApproved(lenses: ProjectionLens[]) {
  return {
    lenses: lenses.map(lens => ({ ...lens, authorityRecordId: `authority:${lens.id}` })),
    authorityRecords: lenses.map(lens => authorityRecord(`authority:${lens.id}`, lens.id)),
  };
}

describe("minimal repository-script lens", () => {
  it("rejects membership expansion before exceeding its allowance without charging stabilization repeatedly", () => {
    const lens = createRepositoryScriptLens({ id: "lens:bounded", status: "shadow", authorityRecordId: "authority:bounded", governanceBasis: [] });
    const unit = projectionUnit("bounded", { tags: ["repository-automation"] });
    const pairBytes = 256 + 4 * (lens.id.length + unit.id.length);
    const budget = new DerivedObservationBudget(pairBytes);
    expect(compileProjectionLenses({ lenses: [lens], units: [unit], authorityRecords: [], derivedBudget: budget }).memberships[lens.id]).toEqual([unit.id]);
    expect(budget.usedBytes).toBe(pairBytes);
    const units = [unit, projectionUnit("overflow", { tags: ["repository-automation"] })];
    expect(() => compileProjectionLenses({ lenses: [lens], units, authorityRecords: [], derivedBudget: new DerivedObservationBudget(pairBytes) })).toThrow(ObservationError);
  });
  it("refuses an authority record approved for another lens", () => {
    const record = authorityRecord("authority:trusted", "lens:trusted");
    const lens = createRepositoryScriptLens({ id: "lens:untrusted", status: "active", authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }] });
    expect(() => compileProjectionLenses({ lenses: [lens], units: [], authorityRecords: [record] })).toThrow(/belongs to/iu);
  });

  it("uses observed file facts for symbol-anchored units in lens membership and ownership", () => {
    const record = authorityRecord("authority:repository-script");
    const unit = { ...projectionUnit("symbol"), anchor: { kind: "symbol" as const, value: "export:verify" } };
    const selector: SelectorExpr = { op: "atom", field: "path", matcher: "glob", value: "scripts/**" };
    const lens = createRepositoryScriptLens({ status: "active", selector, authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }] });
    const input = { lenses: [lens], units: [unit], authorityRecords: [record],
      selectorFactsByUnitId: new Map([[unit.id, { path: "scripts/verify.ts" }]]) };
    expect(compileProjectionLenses(input).memberships[lens.id]).toEqual([unit.id]);
    expect(compileProjectionLenses({ ...input, selectorFactsByUnitId: new Map([[unit.id, { path: "other/verify.ts" }]]) }).memberships[lens.id]).toEqual([]);
    const other = { ...lens, id: "lens:other", key: "lens:other" };
    expect(() => compileProjectionLenses({ ...input, ...separatelyApproved([lens, other]) })).toThrow(/owner collision/iu);
  });

  it("keeps a shadow lens observable but non-governing and activates the same rules only with approved authority", () => {
    const unit = projectionUnit("repository-script", { path: ".codex/hooks/validate-repo.mjs", tags: ["repository-automation"] });
    const record = authorityRecord("authority:repository-script");
    const shadow = createRepositoryScriptLens({
      status: "shadow",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "architecture-decision", decisionId: "decision:repository-layout" }],
    });
    const active = createRepositoryScriptLens({
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "architecture-decision", decisionId: "decision:repository-layout" }],
    });

    const shadowCompilation = compileProjectionLenses({ lenses: [shadow], units: [unit], authorityRecords: [record] });
    const activeCompilation = compileProjectionLenses({ lenses: [active], units: [unit], authorityRecords: [record] });

    expect(shadowCompilation.memberships[shadow.id]).toEqual([unit.id]);
    expect(shadowCompilation.activeRules).toEqual([]);
    expect(activeCompilation.activeRules.length).toBeGreaterThan(0);
  });

  it("rejects an active lens that cites itself as its governance basis", () => {
    const record = authorityRecord("authority:repository-script");
    const lens = createRepositoryScriptLens({
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "active-lens", lensId: "lens:repository-script" }],
    });

    expect(() => compileProjectionLenses({ lenses: [lens], units: [], authorityRecords: [record] }))
      .toThrow(LensCompilationError);
  });
});

describe("lens composition and fixed points", () => {
  it("rejects two active unlayered projection owners of the same unit role", () => {
    const record = authorityRecord("authority:repository-script");
    const first = createRepositoryScriptLens({
      id: "lens:first",
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const second = createRepositoryScriptLens({
      id: "lens:second",
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const unit = projectionUnit("repository-script", { tags: ["repository-automation"] });

    expect(() => compileProjectionLenses({ ...separatelyApproved([second, first]), units: [unit] }))
      .toThrow(/projection owner/i);
  });

  it("does not treat duplicate owner projections from one lens as a collision", () => {
    const record = authorityRecord("authority:repository-script");
    const base = createRepositoryScriptLens({
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const lens = { ...base, expectedProjections: [base.expectedProjections[0]!, base.expectedProjections[0]!] };
    const unit = projectionUnit("repository-script", { tags: ["repository-automation"] });

    expect(() => compileProjectionLenses({ lenses: [lens], units: [unit], authorityRecords: [record] })).not.toThrow();
  });

  it("detects recursive membership without declared fixed-point semantics", () => {
    const record = authorityRecord("authority:repository-script");
    const first = createRepositoryScriptLens({
      id: "lens:first",
      status: "active",
      selector: { op: "atom", field: "lens", matcher: "equals", value: "lens:second" },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const second = createRepositoryScriptLens({
      id: "lens:second",
      status: "active",
      selector: { op: "all", items: [
        { op: "atom", field: "lens", matcher: "equals", value: "lens:first" },
        tagSelector("repository-automation"),
      ] },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });

    expect(() => compileProjectionLenses({ ...separatelyApproved([first, second]), units: [] }))
      .toThrow(GovernanceCycleError);
  });

  it.each([
    { matcher: "contains", value: "second" },
    { matcher: "glob", value: "lens:sec*" },
    { matcher: "regex", value: "^lens:second$" },
  ] as const)("detects recursive membership expressed with the $matcher lens matcher", ({ matcher, value }) => {
    const record = authorityRecord("authority:repository-script");
    const first = createRepositoryScriptLens({
      id: "lens:first",
      status: "active",
      selector: { op: "atom", field: "lens", matcher, value },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const second = createRepositoryScriptLens({
      id: "lens:second",
      status: "active",
      selector: { op: "atom", field: "lens", matcher: "equals", value: "lens:first" },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });

    expect(() => compileProjectionLenses({ ...separatelyApproved([first, second]), units: [] }))
      .toThrow(GovernanceCycleError);
  });

  it("validates malformed lens selectors even when the unit universe is empty", () => {
    const record = authorityRecord("authority:repository-script");
    const lens = createRepositoryScriptLens({
      status: "active",
      selector: { op: "atom", field: "lens", matcher: "regex", value: "^(lens:)+)+$" },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });

    expect(() => compileProjectionLenses({ lenses: [lens], units: [], authorityRecords: [record] })).toThrow(/selector|regex/i);
  });

  it.each([
    (base: ProjectionLens, malformed: SelectorExpr): ProjectionLens => ({
      ...base,
      expectedProjections: [{ ...base.expectedProjections[0]!, selector: malformed }],
    }),
    (base: ProjectionLens, malformed: SelectorExpr): ProjectionLens => ({
      ...base,
      rules: [{ ...base.rules[0]!, selector: malformed }],
    }),
  ])("validates every nested governance selector before an empty-universe compile", (mutate) => {
    const record = authorityRecord("authority:repository-script");
    const base = createRepositoryScriptLens({
      status: "active",
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    });
    const malformed: SelectorExpr = { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" };

    expect(() => compileProjectionLenses({ lenses: [mutate(base, malformed)], units: [], authorityRecords: [record] }))
      .toThrow(/selector|regex/i);
  });

  it.each([
    { op: "not", item: { op: "atom", field: "lens", matcher: "equals", value: "lens:second" } },
    { op: "atom", field: "lens", matcher: "exists", value: false },
  ] satisfies SelectorExpr[])("rejects non-monotone recursive membership in a monotonic-union group", (selector) => {
    const record = authorityRecord("authority:repository-script");
    const first = { ...createRepositoryScriptLens({
      id: "lens:first",
      status: "active",
      selector,
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    }), contributions: ["constraint-contributor" as const] };
    const second = { ...createRepositoryScriptLens({
      id: "lens:second",
      status: "active",
      selector: { op: "atom", field: "lens", matcher: "equals", value: "lens:first" },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    }), contributions: ["constraint-contributor" as const] };

    expect(() => compileProjectionLenses({
      ...separatelyApproved([first, second]),
      units: [],
      fixedPointGroups: [{ id: "group:bad", lensIds: ["lens:first", "lens:second"], semantics: "monotonic-union", maxIterations: 4 }],
    })).toThrow(/monotonic/i);
  });

  it("converges an explicitly declared monotonic SCC deterministically", () => {
    const record = authorityRecord("authority:repository-script");
    const seed = { ...createRepositoryScriptLens({
      id: "lens:seed",
      status: "active",
      selector: { op: "any", items: [
        tagSelector("seed"),
        { op: "atom", field: "lens", matcher: "equals", value: "lens:closure" },
      ] },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    }), contributions: ["constraint-contributor" as const] };
    const closure = { ...createRepositoryScriptLens({
      id: "lens:closure",
      status: "active",
      selector: { op: "atom", field: "lens", matcher: "equals", value: "lens:seed" },
      authorityRecordId: record.id,
      governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:layout" }],
    }), contributions: ["constraint-contributor" as const] };
    const unit = projectionUnit("seed-unit", { tags: ["seed"] });

    const result = compileProjectionLenses({
      ...separatelyApproved([closure, seed]),
      units: [unit],
      fixedPointGroups: [{ id: "group:closure", lensIds: ["lens:closure", "lens:seed"], semantics: "monotonic-union", maxIterations: 4 }],
    });

    expect(result.memberships).toEqual({ "lens:closure": [unit.id], "lens:seed": [unit.id] });
    expect(result.fixedPointIterations["group:closure"]).toBe(2);
  });
});
