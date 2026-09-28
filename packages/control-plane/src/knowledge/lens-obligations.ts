import { hashFramedDomain, type ContentHash, type ProjectionLens, type ProjectionUnit } from "@projector/core";
import { compileEffectiveRuleBundle, evaluateSelector, projectionUnitSelectorSubject, type ProjectionUnitSelectorFacts } from "@projector/engine";
import type { KnowledgeLensObligation } from "./types.js";

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

/** Membership is supplied by the complete lens compiler, never inferred from this unit alone. */
export function compileKnowledgeLensObligation(lens: ProjectionLens, unit: ProjectionUnit, membershipFingerprint: ContentHash, facts: ProjectionUnitSelectorFacts, operation: string): KnowledgeLensObligation {
  const selectorFacts = { ...facts, operation };
  const subject = projectionUnitSelectorSubject(unit, selectorFacts);
  const bundle = compileEffectiveRuleBundle({ unit, operation, rules: lens.rules, selectorFacts });
  const expectations = lens.expectedProjections.filter((projection) => projection.role === unit.role && projection.surfaceKind === "repository" && evaluateSelector(projection.selector, subject).matched);
  const expectationValidators = expectations.flatMap(({ expectation }) => expectation.kind === "predicate-constrained" ? expectation.validatorIds : []);
  return {
    lensId: lens.id, lensVersion: lens.version, lensSemanticHash: lens.semanticHash,
    authorityRecordId: lens.authorityRecordId, unitId: unit.id, membershipFingerprint,
    applicabilityFingerprint: hashFramedDomain("knowledge-lens-applicability", { lensId: lens.id, unitId: unit.id, operation, bundle: bundle.dependencyFingerprint, expectations: expectations.map(({ role, expectation }) => ({ role, kind: expectation.kind })) }),
    ruleIds: bundle.rules.map(({ id }) => id), predicates: bundle.predicates,
    validatorIds: unique([...bundle.rules.flatMap(({ validatorIds }) => validatorIds), ...bundle.predicates.flatMap((predicate) => predicate.kind === "validator" ? [predicate.validatorId] : []), ...expectationValidators, ...lens.validators.filter(({ required }) => required).map(({ id, version }) => `${id}@${version}`)]),
    expectationKinds: unique(expectations.map(({ expectation }) => expectation.kind)), status: "applicable", unknowns: [],
  };
}
