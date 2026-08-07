import { describe, expect, it } from "vitest";

import { authorityRecord, projectionUnit, tagSelector } from "./test-fixtures.js";
import {
  GovernanceCycleError,
  LensCompilationError,
  compileProjectionLenses,
  createRepositoryScriptLens,
} from "./index.js";

describe("minimal repository-script lens", () => {
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

    expect(() => compileProjectionLenses({ lenses: [second, first], units: [unit], authorityRecords: [record] }))
      .toThrow(/projection owner/i);
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

    expect(() => compileProjectionLenses({ lenses: [first, second], units: [], authorityRecords: [record] }))
      .toThrow(GovernanceCycleError);
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
      lenses: [closure, seed],
      units: [unit],
      authorityRecords: [record],
      fixedPointGroups: [{ id: "group:closure", lensIds: ["lens:closure", "lens:seed"], semantics: "monotonic-union", maxIterations: 4 }],
    });

    expect(result.memberships).toEqual({ "lens:closure": [unit.id], "lens:seed": [unit.id] });
    expect(result.fixedPointIterations["group:closure"]).toBe(2);
  });
});
