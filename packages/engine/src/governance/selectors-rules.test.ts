import type { SelectorExpr } from "@projector/core";
import { describe, expect, it } from "vitest";

import { projectionUnit, rule, tagSelector } from "./test-fixtures.js";
import {
  GovernanceConflictError,
  SelectorEvaluationError,
  assertGovernable,
  compileEffectiveRuleBundle,
  evaluateSelector,
  evaluateSelectorMembership,
  normalizeSelector,
  projectionUnitSelectorSubject,
} from "./index.js";

const selectorTruthRows: Array<[SelectorExpr, boolean]> = [
  [{ op: "atom", field: "tag", matcher: "in", value: ["other", "public"] }, true],
  [{ op: "atom", field: "language", matcher: "exists", value: true }, false],
  [{ op: "not", item: tagSelector("private") }, true],
  [{ op: "any", items: [tagSelector("private"), tagSelector("public")] }, true],
  [{ op: "all", items: [tagSelector("public"), tagSelector("private")] }, false],
];

describe("selector normalization and evaluation", () => {
  it("normalizes boolean order and duplicates without changing truth", () => {
    const first = normalizeSelector({ op: "all", items: [
      tagSelector("repository-automation"),
      { op: "atom", field: "path", matcher: "glob", value: "scripts/**/*.mjs" },
      tagSelector("repository-automation"),
    ] });
    const second = normalizeSelector({ op: "all", items: [
      { op: "atom", field: "path", matcher: "glob", value: "scripts/**/*.mjs" },
      tagSelector("repository-automation"),
    ] });
    const subject = projectionUnitSelectorSubject(
      projectionUnit("script", { path: "scripts/checks/verify.mjs", tags: ["repository-automation"] }),
    );

    expect(first).toEqual(second);
    expect(evaluateSelector(first, subject).matched).toBe(true);
  });

  it("fails closed for regex features outside the deterministic safe subset", () => {
    const subject = projectionUnitSelectorSubject(projectionUnit("script"));
    expect(() => evaluateSelector(
      { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" },
      subject,
    )).toThrow(SelectorEvaluationError);
  });

  it.each([
    { op: "all", items: [tagSelector("missing"), { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" }] },
    { op: "any", items: [tagSelector("public"), { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" }] },
  ] satisfies SelectorExpr[])("validates every atom before boolean short circuit", (selector) => {
    const subject = projectionUnitSelectorSubject(projectionUnit("unit", { tags: ["public"] }));
    expect(() => evaluateSelector(selector, subject)).toThrow(SelectorEvaluationError);
    expect(() => normalizeSelector(selector)).toThrow(SelectorEvaluationError);
  });

  it("rejects a malformed selector before an empty universe can prove absence", () => {
    const malformed: SelectorExpr = { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" };
    expect(() => evaluateSelectorMembership(malformed, [], { observability: "closed" })).toThrow(SelectorEvaluationError);
  });

  it("evaluates the anchored regex subset with a deterministic state machine", () => {
    const subject = projectionUnitSelectorSubject(projectionUnit("script", { path: "scripts/check-links.mjs" }));
    expect(evaluateSelector(
      { op: "atom", field: "path", matcher: "regex", value: "^scripts/[^/]+\\.mjs$" },
      subject,
    ).matched).toBe(true);
  });

  it.each(selectorTruthRows)("evaluates selector truth-table row %#", (selector, expected) => {
    const subject = projectionUnitSelectorSubject(projectionUnit("unit", { tags: ["public"] }));
    expect(evaluateSelector(selector, subject).matched).toBe(expected);
  });

  it("fingerprints entering and leaving membership independently of subject order", () => {
    const selector = tagSelector("public");
    const privateUnit = projectionUnitSelectorSubject(projectionUnit("unit-a"));
    const publicUnit = projectionUnitSelectorSubject(projectionUnit("unit-b", { tags: ["public"] }));
    const first = evaluateSelectorMembership(selector, [privateUnit, publicUnit], { observability: "closed" });
    const reordered = evaluateSelectorMembership(selector, [publicUnit, privateUnit], { observability: "closed" });
    const expanded = evaluateSelectorMembership(selector, [
      { ...privateUnit, values: { ...privateUnit.values, tag: ["public"] } },
      publicUnit,
    ], { observability: "closed" });

    expect(first.membershipFingerprint).toBe(reordered.membershipFingerprint);
    expect(first.memberIds).toEqual(["unit-b"]);
    expect(expanded.memberIds).toEqual(["unit-a", "unit-b"]);
    expect(expanded.membershipFingerprint).not.toBe(first.membershipFingerprint);
  });

  it.each(["open", "sampled", "unavailable"] as const)("does not prove absence from an empty %s membership", (observability) => {
    const membership = evaluateSelectorMembership(tagSelector("missing"), [], { observability });
    expect(membership.absenceProven).toBe(false);
  });
});

describe("hard rule compilation", () => {
  const unit = projectionUnit("repository-script", {
    path: ".codex/hooks/validate-repo.mjs",
    tags: ["repository-automation"],
  });

  it("is order-independent and sorts higher authority before specificity and stable ID", () => {
    const local = rule("rule:local", { authorityClass: "local-convention" });
    const platform = rule("rule:platform", { authorityClass: "platform-constraint" });
    const first = compileEffectiveRuleBundle({ unit, operation: "move", rules: [local, platform] });
    const second = compileEffectiveRuleBundle({ unit, operation: "move", rules: [platform, local] });

    expect(first.rules.map(({ id }) => id)).toEqual(["rule:platform", "rule:local"]);
    expect(first.bundleHash).toBe(second.bundleHash);
  });

  it("never compiles advisory payload fields as hard predicates or permissions", () => {
    const hard = rule("rule:hard", { predicates: [{ kind: "permission", operation: "move", allowed: false }] });
    const advisory = rule("rule:advice", {
      effect: "prefer",
      authorityClass: "task-suggestion",
      predicates: [],
      advisoryPayload: { operation: "move", allowed: true, predicates: [{ kind: "permission", operation: "move", allowed: true }] },
    });

    const bundle = compileEffectiveRuleBundle({ unit, operation: "move", rules: [advisory, hard] });

    expect(bundle.predicates).toEqual([{ kind: "permission", operation: "move", allowed: false }]);
    expect(bundle.suppressedRules).toEqual([]);
  });

  it("surfaces equivalent-authority require/forbid conflicts and blocks context compilation", () => {
    const required = rule("rule:required", { effect: "require" });
    const forbidden = rule("rule:forbidden", { effect: "forbid" });
    const bundle = compileEffectiveRuleBundle({ unit, operation: "move", rules: [forbidden, required] });

    expect(bundle.conflicts).toHaveLength(1);
    expect(bundle.conflicts[0]?.kind).toBe("require-forbid");
    expect(() => assertGovernable(bundle)).toThrow(GovernanceConflictError);
  });

  it("fails a lower-authority attempt to contradict host safety without an explicit exception", () => {
    const host = rule("rule:host", {
      authorityClass: "host-safety",
      predicates: [{ kind: "permission", operation: "write-outside-root", allowed: false }],
    });
    const suggestion = rule("rule:suggestion", {
      effect: "grant",
      authorityClass: "task-suggestion",
      predicates: [{ kind: "permission", operation: "write-outside-root", allowed: true }],
    });

    const bundle = compileEffectiveRuleBundle({ unit, operation: "write-outside-root", rules: [suggestion, host] });
    expect(bundle.conflicts.map(({ kind }) => kind)).toContain("authority-override");
  });

  it("rejects a blocking rule that has neither a normalized predicate nor a validator", () => {
    const invalid = rule("rule:invalid", { predicates: [], validatorIds: [] });
    expect(() => compileEffectiveRuleBundle({ unit, operation: "move", rules: [invalid] })).toThrow(/predicate or validator/i);
  });

  it("validates nested predicate selectors even when the enclosing rule does not apply", () => {
    const malformed = rule("rule:malformed-target", {
      selector: tagSelector("does-not-apply"),
      predicates: [{
        kind: "relation-required",
        relation: "verifies",
        targetSelector: { op: "atom", field: "path", matcher: "regex", value: "^(a+)+$" },
      }],
    });

    expect(() => compileEffectiveRuleBundle({ unit, operation: "move", rules: [malformed] }))
      .toThrow(SelectorEvaluationError);
  });

  it("reports distinct unlayered transform claims as exclusive", () => {
    const first = rule("rule:transform-a", { effect: "transform", transformIds: ["transform:a"] });
    const second = rule("rule:transform-b", { effect: "transform", transformIds: ["transform:b"] });
    const bundle = compileEffectiveRuleBundle({ unit, operation: "move", rules: [first, second] });
    expect(bundle.conflicts.map(({ kind }) => kind)).toContain("exclusive-transform");
  });

  it("normalizes transform IDs as a sorted set before comparing exclusive claims", () => {
    const first = rule("rule:transform-a", { effect: "transform", transformIds: ["transform:b", "transform:a", "transform:a"] });
    const second = rule("rule:transform-b", { effect: "transform", transformIds: ["transform:a", "transform:b"] });
    const bundle = compileEffectiveRuleBundle({ unit, operation: "move", rules: [first, second] });

    expect(bundle.conflicts).toEqual([]);
    expect(bundle.rules.map(({ transformIds }) => transformIds)).toEqual([
      ["transform:a", "transform:b"],
      ["transform:a", "transform:b"],
    ]);
  });
});
