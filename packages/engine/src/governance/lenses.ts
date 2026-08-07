import {
  hashFramedDomain,
  type AuthorityRecord,
  type GovernanceBasis,
  type ProjectionLens,
  type ProjectionUnit,
  type Rule,
  type SelectorExpr,
} from "@projector/core";

import { assessLensAuthority, governanceBasisIsEndogenous } from "../authority/index.js";
import {
  assertMonotonicLensSelector,
  evaluateSelector,
  normalizeSelector,
  projectionUnitSelectorSubject,
  selectorLensDependencies,
  type SelectorSubject,
} from "./selectors.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export class LensCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LensCompilationError";
  }
}

export class GovernanceCycleError extends LensCompilationError {
  readonly lensIds: string[];

  constructor(lensIds: readonly string[]) {
    super(`governance-cycle: recursive lens membership lacks declared fixed-point semantics (${sortedUnique(lensIds).join(", ")})`);
    this.name = "GovernanceCycleError";
    this.lensIds = sortedUnique(lensIds);
  }
}

export class NonconvergentGovernanceError extends LensCompilationError {
  constructor(groupId: string, maxIterations: number) {
    super(`governance fixed-point group ${groupId} did not converge within ${maxIterations} iterations`);
    this.name = "NonconvergentGovernanceError";
  }
}

export class LensOwnershipCollisionError extends LensCompilationError {
  constructor(unitId: string, role: string, lensIds: readonly string[]) {
    super(`projection owner collision for unit ${unitId} role ${role}: ${sortedUnique(lensIds).join(", ")}`);
    this.name = "LensOwnershipCollisionError";
  }
}

export interface GovernanceFixedPointGroup {
  id: string;
  lensIds: readonly string[];
  semantics: "monotonic-union";
  maxIterations: number;
}

export interface CompileProjectionLensesInput {
  lenses: readonly ProjectionLens[];
  units: readonly ProjectionUnit[];
  authorityRecords: readonly AuthorityRecord[];
  fixedPointGroups?: readonly GovernanceFixedPointGroup[];
}

export interface ProjectionLensCompilation {
  memberships: Record<string, string[]>;
  membershipFingerprints: Record<string, string>;
  activeRules: Rule[];
  fixedPointIterations: Record<string, number>;
}

function stronglyConnectedComponents(lenses: readonly ProjectionLens[]): string[][] {
  const known = new Set(lenses.map(({ id }) => id));
  const knownIds = [...known].sort(compareStrings);
  const graph = new Map(lenses.map((lens) => [lens.id, selectorLensDependencies(lens.selector, knownIds)]));
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const connect = (id: string): void => {
    indexes.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (!indexes.has(dependency)) {
        connect(dependency);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(id, Math.min(lowLinks.get(id)!, indexes.get(dependency)!));
      }
    }
    if (lowLinks.get(id) === indexes.get(id)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== id);
      const selfCycle = component.length === 1 && (graph.get(component[0]!) ?? []).includes(component[0]!);
      if (component.length > 1 || selfCycle) components.push(component.sort(compareStrings));
    }
  };
  [...graph.keys()].sort(compareStrings).forEach((id) => { if (!indexes.has(id)) connect(id); });
  return components.sort((left, right) => compareStrings(left.join("\u0000"), right.join("\u0000")));
}

function subjectWithMemberships(
  unit: ProjectionUnit,
  memberships: ReadonlyMap<string, ReadonlySet<string>>,
): SelectorSubject {
  const subject = projectionUnitSelectorSubject(unit);
  const computedLensIds = [...memberships.entries()]
    .filter(([, memberIds]) => memberIds.has(unit.id))
    .map(([lensId]) => lensId);
  return {
    ...subject,
    values: {
      ...subject.values,
      lens: sortedUnique([...(subject.values.lens as string[]), ...computedLensIds]),
    },
    dependencyKeys: sortedUnique([
      ...subject.dependencyKeys,
      ...computedLensIds.map((lensId) => `lens-membership:${lensId}:${unit.id}`),
    ]),
  };
}

function evaluateLensMembers(
  lens: ProjectionLens,
  units: readonly ProjectionUnit[],
  memberships: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  return new Set(units
    .filter((unit) => evaluateSelector(lens.selector, subjectWithMemberships(unit, memberships)).matched)
    .map(({ id }) => id));
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function validateLenses(lenses: readonly ProjectionLens[], authorityRecords: readonly AuthorityRecord[]): void {
  const ids = new Set<string>();
  for (const lens of lenses) {
    if (ids.has(lens.id)) throw new LensCompilationError(`duplicate lens stable ID ${lens.id}`);
    ids.add(lens.id);
    normalizeSelector(lens.selector);
    lens.expectedProjections.forEach(({ selector }) => normalizeSelector(selector));
    lens.impactRules.forEach(({ selector }) => normalizeSelector(selector));
    for (const rule of lens.rules) {
      normalizeSelector(rule.selector);
      for (const predicate of rule.predicates) {
        if (predicate.kind === "relation-required" || predicate.kind === "relation-forbidden") {
          normalizeSelector(predicate.targetSelector);
        } else if (predicate.kind === "cardinality") {
          normalizeSelector(predicate.selector);
        } else if (predicate.kind === "dependency-allowed" || predicate.kind === "dependency-forbidden") {
          normalizeSelector(predicate.from);
          normalizeSelector(predicate.to);
        }
      }
    }
    if (governanceBasisIsEndogenous(lens.id, lens.governanceBasis)) {
      throw new LensCompilationError(`lens ${lens.id} cannot cite itself as its governance basis`);
    }
    if (lens.status === "active") {
      const assessment = assessLensAuthority(lens, authorityRecords);
      if (!assessment.eligible) throw new LensCompilationError(assessment.reasons.join("; "));
      if (lens.governanceBasis.length === 0) throw new LensCompilationError(`active lens ${lens.id} lacks a typed governance basis`);
      if (lens.recognizers.length === 0 || lens.validators.length === 0 || lens.expectedProjections.length === 0) {
        throw new LensCompilationError(`active lens ${lens.id} lacks executable recognition, validation, or projection expectations`);
      }
    }
  }
}

function validateFixedPointGroups(
  cycles: readonly string[][],
  groups: readonly GovernanceFixedPointGroup[],
  lenses: readonly ProjectionLens[],
): Map<string, GovernanceFixedPointGroup> {
  const lensesById = new Map(lenses.map((lens) => [lens.id, lens]));
  const byLens = new Map<string, GovernanceFixedPointGroup>();
  for (const group of groups) {
    if (group.maxIterations < 1 || !Number.isSafeInteger(group.maxIterations)) {
      throw new LensCompilationError(`fixed-point group ${group.id} has an invalid iteration budget`);
    }
    for (const lensId of sortedUnique(group.lensIds)) {
      if (!lensesById.has(lensId)) throw new LensCompilationError(`fixed-point group ${group.id} references unknown lens ${lensId}`);
      if (byLens.has(lensId)) throw new LensCompilationError(`lens ${lensId} belongs to multiple fixed-point groups`);
      byLens.set(lensId, group);
    }
    for (const lensId of sortedUnique(group.lensIds)) {
      assertMonotonicLensSelector(lensesById.get(lensId)!.selector, group.lensIds);
    }
  }
  for (const cycle of cycles) {
    const group = byLens.get(cycle[0]!);
    if (group === undefined || cycle.some((lensId) => byLens.get(lensId)?.id !== group.id)) throw new GovernanceCycleError(cycle);
    const declared = sortedUnique(group.lensIds);
    if (declared.some((lensId) => cycle.includes(lensId)) && cycle.some((lensId) => !declared.includes(lensId))) {
      throw new GovernanceCycleError(cycle);
    }
  }
  return byLens;
}

function compileOwnership(
  lenses: readonly ProjectionLens[],
  units: readonly ProjectionUnit[],
  memberships: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  const owners = new Map<string, Set<string>>();
  for (const lens of lenses.filter(({ status, contributions }) => status === "active" && contributions.includes("projection-owner"))) {
    for (const unit of units) {
      if (!(memberships.get(lens.id)?.has(unit.id) ?? false)) continue;
      for (const projection of lens.expectedProjections) {
        if (projection.role !== unit.role) continue;
        if (!evaluateSelector(projection.selector, subjectWithMemberships(unit, memberships)).matched) continue;
        const key = `${unit.id}\u0000${projection.role}`;
        const entries = owners.get(key) ?? new Set<string>();
        entries.add(lens.id);
        owners.set(key, entries);
      }
    }
  }
  for (const [key, lensIdSet] of owners) {
    const lensIds = [...lensIdSet].sort(compareStrings);
    if (lensIds.length < 2) continue;
    const [unitId, role] = key.split("\u0000") as [string, string];
    throw new LensOwnershipCollisionError(unitId, role, lensIds);
  }
}

function stabilizeAcyclicMemberships(
  lenses: readonly ProjectionLens[],
  units: readonly ProjectionUnit[],
  memberships: Map<string, Set<string>>,
  iterationBudget: number,
): void {
  for (let iteration = 0; iteration <= iterationBudget; iteration += 1) {
    let changed = false;
    for (const lens of lenses) {
      const next = evaluateLensMembers(lens, units, memberships);
      if (!sameSet(memberships.get(lens.id)!, next)) {
        memberships.set(lens.id, next);
        changed = true;
      }
    }
    if (!changed) return;
  }
  throw new GovernanceCycleError(lenses.map(({ id }) => id));
}

export function compileProjectionLenses(input: CompileProjectionLensesInput): ProjectionLensCompilation {
  const lenses = [...input.lenses].sort((left, right) => compareStrings(left.id, right.id));
  const units = [...input.units].sort((left, right) => compareStrings(left.id, right.id));
  validateLenses(lenses, input.authorityRecords);
  const cycles = stronglyConnectedComponents(lenses);
  const fixedPointGroups = input.fixedPointGroups ?? [];
  const groupByLens = validateFixedPointGroups(cycles, fixedPointGroups, lenses);
  const memberships = new Map<string, Set<string>>(lenses.map(({ id }) => [id, new Set<string>()]));
  const fixedPointIterations: Record<string, number> = {};

  // Acyclic memberships are evaluated to a stable state independent of input order.
  const acyclic = lenses.filter((lens) => !groupByLens.has(lens.id));
  stabilizeAcyclicMemberships(acyclic, units, memberships, lenses.length);

  const groups = [...new Map(fixedPointGroups.map((group) => [group.id, group])).values()]
    .sort((left, right) => compareStrings(left.id, right.id));
  for (const group of groups) {
    const groupLenses = lenses.filter(({ id }) => group.lensIds.includes(id));
    let changeRounds = 0;
    let converged = false;
    for (let iteration = 0; iteration < group.maxIterations; iteration += 1) {
      const proposals = new Map(groupLenses.map((lens) => [lens.id, evaluateLensMembers(lens, units, memberships)]));
      let changed = false;
      for (const lens of groupLenses) {
        const current = memberships.get(lens.id)!;
        const next = new Set([...current, ...(proposals.get(lens.id) ?? [])]);
        if (!sameSet(current, next)) {
          memberships.set(lens.id, next);
          changed = true;
        }
      }
      if (!changed) {
        converged = true;
        break;
      }
      changeRounds += 1;
    }
    if (!converged) throw new NonconvergentGovernanceError(group.id, group.maxIterations);
    fixedPointIterations[group.id] = changeRounds;
  }

  // Downstream acyclic lenses may depend on membership produced by a fixed-point group.
  stabilizeAcyclicMemberships(acyclic, units, memberships, lenses.length);

  compileOwnership(lenses, units, memberships);
  const membershipObject = Object.fromEntries([...memberships.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([lensId, memberIds]) => [lensId, [...memberIds].sort(compareStrings)]));
  const membershipFingerprints = Object.fromEntries(Object.entries(membershipObject).map(([lensId, memberIds]) => [
    lensId,
    hashFramedDomain("lens-membership", { lensId, memberIds }),
  ]));
  const activeRules = lenses
    .filter(({ status }) => status === "active")
    .flatMap(({ rules }) => rules)
    .sort((left, right) => compareStrings(left.id, right.id));
  return { memberships: membershipObject, membershipFingerprints, activeRules, fixedPointIterations };
}

export interface CreateRepositoryScriptLensInput {
  id?: string;
  status: "shadow" | "active";
  selector?: SelectorExpr;
  authorityRecordId: string;
  governanceBasis: GovernanceBasis[];
}

export function createRepositoryScriptLens(input: CreateRepositoryScriptLensInput): ProjectionLens {
  const id = input.id ?? "lens:repository-script";
  const selector = input.selector ?? { op: "atom", field: "tag", matcher: "equals", value: "repository-automation" };
  const pathRuleWithoutHash = {
    id: `${id}:placement`,
    key: `${id}:placement`,
    version: "1",
    effect: "require" as const,
    authorityClass: "active-lens" as const,
    governanceBasis: structuredClone(input.governanceBasis),
    selector: structuredClone(selector),
    predicates: [{ kind: "path-under" as const, root: "scripts" }],
    rationale: "repository automation belongs under scripts",
    evidence: [],
    conflictPolicy: "error" as const,
    validatorIds: ["repository-script-placement@1"],
    transformIds: ["move-repository-script@1"],
  };
  const testRuleWithoutHash = {
    id: `${id}:test-colocation`,
    key: `${id}:test-colocation`,
    version: "1",
    effect: "require" as const,
    authorityClass: "active-lens" as const,
    governanceBasis: structuredClone(input.governanceBasis),
    selector: structuredClone(selector),
    predicates: [{
      kind: "relation-required" as const,
      relation: "verifies" as const,
      targetSelector: { op: "atom" as const, field: "artifact-role" as const, matcher: "equals" as const, value: "test" },
    }],
    rationale: "repository automation has colocated verification",
    evidence: [],
    conflictPolicy: "error" as const,
    validatorIds: ["repository-script-test-colocation@1"],
    transformIds: ["move-repository-script@1"],
  };
  const rules: Rule[] = [pathRuleWithoutHash, testRuleWithoutHash].map((rule) => ({
    ...rule,
    semanticHash: hashFramedDomain("rule", rule),
  }));
  const lensWithoutHash = {
    id,
    key: id,
    version: "1",
    status: input.status,
    purpose: "keep repository-wide automation and its tests under scripts",
    realizesConceptKinds: ["capability" as const],
    selector: structuredClone(selector),
    contributions: ["projection-owner" as const, "constraint-contributor" as const, "validator-contributor" as const],
    expectedProjections: [{
      role: "implementation" as const,
      cardinality: "many" as const,
      surfaceKind: "repository" as const,
      selector: structuredClone(selector),
      control: { ownership: "shared" as const, mutation: "transform" as const, actuation: "approval" as const },
      expectation: {
        kind: "predicate-constrained" as const,
        predicateIds: rules.map(({ id: ruleId }) => ruleId),
        validatorIds: ["repository-script-placement@1", "repository-script-test-colocation@1"],
      },
    }],
    rules,
    impactRules: [],
    recognizers: [{
      id: "repository-script-recognizer",
      version: "1",
      adapterId: "projection-unit-facts",
      query: { tags: ["repository-automation"] },
      minimumConfidence: 0.8,
    }],
    validators: [{
      id: "repository-script-validator",
      version: "1",
      provider: "deterministic-governance",
      input: { ruleIds: rules.map(({ id: ruleId }) => ruleId) },
      required: true,
      requiredIndependenceGroup: "repository-script-validator@1",
    }],
    transforms: [{ id: "move-repository-script", version: "1", input: { root: "scripts" }, exclusiveUnitClaim: true }],
    migrations: [],
    conflictsWith: [],
    compatibleWith: [],
    examples: [],
    counterExamples: [],
    authorityRecordId: input.authorityRecordId,
    governanceBasis: structuredClone(input.governanceBasis),
  };
  return { ...lensWithoutHash, semanticHash: hashFramedDomain("projection-lens", lensWithoutHash) };
}
