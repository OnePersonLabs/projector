import {
  canonicalJson,
  hashFramedDomain,
  type ContentHash,
  type DerivationInput,
  type DerivationRecord,
  type EntityId,
  type ImpactClosureRef,
  type ImpactRule,
  type InvalidationEvent,
  type InvalidationResult,
  type ObservabilityClass,
  type SemanticSignature,
  type StateBinding,
  type StateQueryDependency,
  type StateQueryKind,
  type ValidationResult,
} from "@projector/core";

import { evaluateSelector, type SelectorSubject } from "../governance/selectors.js";
import { createStateBinding } from "../state/index.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

interface ParsedVersion {
  numeric: string[];
  prerelease: string[];
}

/**
 * Versions in the invalidation registries use a deliberately small, documented
 * SemVer-compatible contract. Numeric-only versions (for example `1` and
 * `2.1`) remain valid for the existing profile/rule records. Opaque strings
 * are rejected instead of being guessed by lexical ordering.
 */
function parseVersion(version: string): ParsedVersion {
  const match = /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(version);
  if (match === null) throw new Error(`unsupported version format ${version}; use numeric dot segments with optional SemVer prerelease`);
  return {
    numeric: match[1]!.split("."),
    prerelease: match[2] === undefined ? [] : match[2].split("."),
  };
}

function compareNumericTokens(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/u, "");
  const normalizedRight = right.replace(/^0+(?=\d)/u, "");
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  return compareStrings(normalizedLeft, normalizedRight);
}

function compareVersions(left: string, right: string): number {
  const leftParsed = parseVersion(left);
  const rightParsed = parseVersion(right);
  const numericLength = Math.max(leftParsed.numeric.length, rightParsed.numeric.length);
  for (let index = 0; index < numericLength; index += 1) {
    const difference = compareNumericTokens(leftParsed.numeric[index] ?? "0", rightParsed.numeric[index] ?? "0");
    if (difference !== 0) return difference;
  }
  if (leftParsed.prerelease.length === 0 && rightParsed.prerelease.length > 0) return 1;
  if (leftParsed.prerelease.length > 0 && rightParsed.prerelease.length === 0) return -1;
  const prereleaseLength = Math.max(leftParsed.prerelease.length, rightParsed.prerelease.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftToken = leftParsed.prerelease[index];
    const rightToken = rightParsed.prerelease[index];
    if (leftToken === undefined) return -1;
    if (rightToken === undefined) return 1;
    const leftNumeric = /^\d+$/u.test(leftToken);
    const rightNumeric = /^\d+$/u.test(rightToken);
    if (leftNumeric && rightNumeric) {
      const difference = compareNumericTokens(leftToken, rightToken);
      if (difference !== 0) return difference;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else {
      const difference = compareStrings(leftToken, rightToken);
      if (difference !== 0) return difference;
    }
  }
  return 0;
}

function compareVersionStrings(left: string, right: string): number {
  return compareVersions(left, right) || compareStrings(left, right);
}

const assuranceRank = {
  heuristic: 0,
  validated: 1,
  exact: 2,
} as const;

const validationAssuranceRank: Record<ValidationResult["assurance"], number> = {
  weak: 0,
  supporting: 1,
  strong: 2,
  exact: 3,
};

export interface RegisteredSemanticSignatureProfile {
  id: string;
  version: string;
  scope: string;
  normalization: string;
  ignoredDifferences: readonly string[];
  adapterId: string;
  adapterVersion: string;
  maximumAssurance: SemanticSignature["assurance"];
  assuranceEvidence: readonly string[];
  unsupportedConstructs: readonly string[];
  normalize(input: unknown): unknown;
}

export interface SignatureProfileAssessment {
  current: boolean;
  reason: string;
}

/** Versioned in-memory registry. Durable adapters can load/save the descriptors through their own ports. */
export class SemanticSignatureProfileRegistry {
  private readonly profiles = new Map<string, RegisteredSemanticSignatureProfile>();

  register(profile: RegisteredSemanticSignatureProfile): void {
    if (profile.id.trim() === "" || profile.version.trim() === "" || profile.scope.trim() === "") {
      throw new Error("signature profile identity, version, and scope are required");
    }
    parseVersion(profile.version);
    if ((profile.maximumAssurance === "exact" || profile.maximumAssurance === "validated")
      && profile.assuranceEvidence.length === 0) {
      throw new Error(`${profile.maximumAssurance} signature profile ${profile.id}@${profile.version} requires assurance evidence`);
    }
    const key = `${profile.id}\u0000${profile.version}`;
    const existing = this.profiles.get(key);
    const descriptor = (value: RegisteredSemanticSignatureProfile): unknown => ({
      id: value.id,
      version: value.version,
      scope: value.scope,
      normalization: value.normalization,
      ignoredDifferences: sortedUnique(value.ignoredDifferences),
      adapterId: value.adapterId,
      adapterVersion: value.adapterVersion,
      maximumAssurance: value.maximumAssurance,
      assuranceEvidence: sortedUnique(value.assuranceEvidence),
      unsupportedConstructs: sortedUnique(value.unsupportedConstructs),
    });
    if (existing !== undefined && canonicalJson(descriptor(existing)) !== canonicalJson(descriptor(profile))) {
      throw new Error(`conflicting signature profile ${profile.id}@${profile.version}`);
    }
    this.profiles.set(key, {
      ...profile,
      ignoredDifferences: sortedUnique(profile.ignoredDifferences),
      assuranceEvidence: sortedUnique(profile.assuranceEvidence),
      unsupportedConstructs: sortedUnique(profile.unsupportedConstructs),
    });
  }

  get(id: string, version: string): RegisteredSemanticSignatureProfile {
    const profile = this.profiles.get(`${id}\u0000${version}`);
    if (profile === undefined) throw new Error(`unknown semantic signature profile ${id}@${version}`);
    return profile;
  }

  currentVersion(id: string): string | undefined {
    return [...this.profiles.values()]
      .filter((profile) => profile.id === id)
      .map((profile) => profile.version)
      .sort(compareVersionStrings)
      .at(-1);
  }

  assess(signature: SemanticSignature): SignatureProfileAssessment {
    const currentVersion = this.currentVersion(signature.profileId);
    if (currentVersion === undefined) {
      return { current: false, reason: `signature profile ${signature.profileId} is unavailable` };
    }
    if (currentVersion !== signature.profileVersion) {
      return {
        current: false,
        reason: `signature profile version changed from ${signature.profileVersion} to ${currentVersion}`,
      };
    }
    const profile = this.get(signature.profileId, signature.profileVersion);
    if (profile.scope !== signature.scope) return { current: false, reason: "signature scope does not match its profile" };
    if (assuranceRank[signature.assurance] > assuranceRank[profile.maximumAssurance]) {
      return { current: false, reason: "signature assurance exceeds its profile assurance" };
    }
    return { current: true, reason: "signature uses the current registered profile" };
  }

  sign(
    id: string,
    version: string,
    input: unknown,
    options: { assurance: SemanticSignature["assurance"]; evidenceIds: readonly EntityId[] },
  ): SemanticSignature {
    const profile = this.get(id, version);
    if (assuranceRank[options.assurance] > assuranceRank[profile.maximumAssurance]) {
      throw new Error(`profile ${id}@${version} cannot issue ${options.assurance} assurance`);
    }
    const normalized = profile.normalize(structuredClone(input));
    const repeated = profile.normalize(structuredClone(input));
    if (canonicalJson(normalized) !== canonicalJson(repeated)) {
      throw new Error(`signature profile ${id}@${version} produced nondeterministic normalization`);
    }
    return {
      hash: hashFramedDomain("semantic-signature", {
        profileId: id,
        profileVersion: version,
        scope: profile.scope,
        normalized,
      }),
      profileId: id,
      profileVersion: version,
      scope: profile.scope,
      assurance: options.assurance,
      evidenceIds: sortedUnique(options.evidenceIds),
    };
  }
}

export interface BackdatingPolicy {
  minimumValidatedAssurance: ValidationResult["assurance"];
  requireIndependent: boolean;
  disallowedEvidenceLanes?: readonly ValidationResult["evidenceLane"][];
}

export interface BackdatingAssessment {
  eligible: boolean;
  materiallyChanged: boolean;
  reason: string;
  qualifyingValidatorIds: string[];
}

const sameSignatureProfile = (left: SemanticSignature, right: SemanticSignature): boolean =>
  left.profileId === right.profileId && left.profileVersion === right.profileVersion && left.scope === right.scope;

export function assessBackdating(
  previous: SemanticSignature,
  current: SemanticSignature,
  validations: readonly ValidationResult[],
  policy: BackdatingPolicy,
): BackdatingAssessment {
  if (!sameSignatureProfile(previous, current)) {
    return { eligible: false, materiallyChanged: true, reason: "signature profile, version, or scope changed", qualifyingValidatorIds: [] };
  }
  if (previous.hash !== current.hash) {
    return { eligible: false, materiallyChanged: true, reason: "semantic signature materially changed", qualifyingValidatorIds: [] };
  }
  if (previous.assurance === "heuristic" || current.assurance === "heuristic") {
    return {
      eligible: false,
      materiallyChanged: false,
      reason: "heuristic equality cannot backdate downstream validity",
      qualifyingValidatorIds: [],
    };
  }
  if (previous.assurance === "exact" && current.assurance === "exact") {
    return { eligible: true, materiallyChanged: false, reason: "exact semantic equality", qualifyingValidatorIds: [] };
  }
  const disallowed = new Set<ValidationResult["evidenceLane"]>([
    ...(policy.disallowedEvidenceLanes ?? []),
    ...(policy.requireIndependent ? ["same-packet-agent" as const] : []),
  ]);
  const qualifying = validations.filter((result) =>
    result.status === "passed"
    && validationAssuranceRank[result.assurance] >= validationAssuranceRank[policy.minimumValidatedAssurance]
    && !disallowed.has(result.evidenceLane)
    && (!policy.requireIndependent || result.independenceGroup.trim() !== "")
    && result.evidenceIds.some((evidenceId) => current.evidenceIds.includes(evidenceId)),
  );
  return qualifying.length > 0
    ? {
        eligible: true,
        materiallyChanged: false,
        reason: "validated semantic equality has policy-sufficient independent evidence",
        qualifyingValidatorIds: sortedUnique(qualifying.map(({ validatorId }) => validatorId)),
      }
    : {
        eligible: false,
        materiallyChanged: false,
        reason: "validated equality lacks policy-sufficient independent evidence",
        qualifyingValidatorIds: [],
      };
}

const inputKey = (input: DerivationInput): string => canonicalJson({ kind: input.kind, id: input.id, role: input.role });

function normalizeRecord(record: DerivationRecord): DerivationRecord {
  const inputs = new Map<string, DerivationInput>();
  for (const input of record.inputs) {
    const key = inputKey(input);
    const existing = inputs.get(key);
    if (existing !== undefined && existing.versionHash !== input.versionHash) {
      throw new Error(`conflicting derivation input ${input.id} for ${record.unitId}`);
    }
    inputs.set(key, structuredClone(input));
  }
  return {
    ...structuredClone(record),
    inputs: [...inputs.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, input]) => input),
    outputSemanticSignature: {
      ...structuredClone(record.outputSemanticSignature),
      evidenceIds: sortedUnique(record.outputSemanticSignature.evidenceIds),
    },
    outputStructuralSignature: {
      ...structuredClone(record.outputStructuralSignature),
      evidenceIds: sortedUnique(record.outputStructuralSignature.evidenceIds),
    },
    validators: [...record.validators].map((item) => structuredClone(item)).sort((left, right) => compareStrings(left.validatorId, right.validatorId)),
  };
}

export interface DerivationProofGroup {
  id: EntityId;
  memberIds: EntityId[];
  cyclic: boolean;
}

export interface DerivationIndexSnapshot {
  schemaVersion: "invalidation-derived@1";
  records: DerivationRecord[];
  reverseDependencies: Array<{ subjectId: EntityId | string; dependentIds: EntityId[] }>;
  proofGroups: DerivationProofGroup[];
}

/** Replace-only derived-state seam: canonical inputs remain authoritative and the snapshot is rebuildable. */
export interface DerivationIndexStore {
  load(): Promise<DerivationIndexSnapshot | undefined>;
  replace(snapshot: DerivationIndexSnapshot): Promise<void>;
}

/** Deterministic derived index; storage adapters need only persist normalized records and reverse rows. */
export class DerivationIndex {
  private readonly byUnit = new Map<string, DerivationRecord>();
  private readonly reverse = new Map<string, Set<string>>();
  private readonly groups = new Map<string, DerivationProofGroup>();

  constructor(records: readonly DerivationRecord[] = []) {
    this.replaceRecords(records);
  }

  /** Replace the rebuildable derived index after a successful revalidation. */
  replaceRecords(records: readonly DerivationRecord[]): void {
    this.byUnit.clear();
    this.reverse.clear();
    this.groups.clear();
    for (const candidate of records) {
      const record = normalizeRecord(candidate);
      const existing = this.byUnit.get(record.unitId);
      if (existing !== undefined && canonicalJson(existing) !== canonicalJson(record)) {
        throw new Error(`conflicting derivation record ${record.unitId}`);
      }
      this.byUnit.set(record.unitId, record);
    }
    for (const record of this.byUnit.values()) {
      for (const input of record.inputs) {
        this.addReverseDependency(input.id, record.unitId);
      }
      this.addReverseDependency(record.outputSemanticSignature.profileId, record.unitId);
      this.addReverseDependency(record.outputStructuralSignature.profileId, record.unitId);
    }
    this.buildProofGroups();
  }

  upsert(record: DerivationRecord): void {
    this.replaceRecords([...this.byUnit.values(), record]);
  }

  private addReverseDependency(subjectId: EntityId | string, dependentId: EntityId): void {
    const dependents = this.reverse.get(subjectId) ?? new Set<string>();
    dependents.add(dependentId);
    this.reverse.set(subjectId, dependents);
  }

  records(): DerivationRecord[] {
    return [...this.byUnit.values()].sort((left, right) => compareStrings(left.unitId, right.unitId)).map((item) => structuredClone(item));
  }

  get(unitId: EntityId): DerivationRecord | undefined {
    const record = this.byUnit.get(unitId);
    return record === undefined ? undefined : structuredClone(record);
  }

  reverseDependents(subjectId: EntityId | string): EntityId[] {
    return sortedUnique([...(this.reverse.get(subjectId) ?? [])]);
  }

  proofGroupFor(unitId: EntityId): DerivationProofGroup | undefined {
    const group = this.groups.get(unitId);
    return group === undefined ? undefined : structuredClone(group);
  }

  allUnitIds(): EntityId[] {
    return [...this.byUnit.keys()].sort(compareStrings);
  }

  snapshot(): DerivationIndexSnapshot {
    const groups = new Map<string, DerivationProofGroup>();
    for (const group of this.groups.values()) groups.set(group.id, group);
    return {
      schemaVersion: "invalidation-derived@1",
      records: this.records(),
      reverseDependencies: [...this.reverse.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([subjectId, dependentIds]) => ({ subjectId, dependentIds: sortedUnique([...dependentIds]) })),
      proofGroups: [...groups.values()].sort((left, right) => compareStrings(left.id, right.id)).map((group) => structuredClone(group)),
    };
  }

  private buildProofGroups(): void {
    const nodes = this.allUnitIds();
    const adjacency = new Map(nodes.map((id) => [id, this.get(id)!.inputs
      .filter((input) => input.kind === "unit" && this.byUnit.has(input.id))
      .map((input) => input.id)
      .sort(compareStrings)]));
    let nextIndex = 0;
    const indexes = new Map<string, number>();
    const lows = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const components: string[][] = [];
    const visit = (node: string): void => {
      indexes.set(node, nextIndex);
      lows.set(node, nextIndex);
      nextIndex += 1;
      stack.push(node);
      onStack.add(node);
      for (const target of adjacency.get(node) ?? []) {
        if (!indexes.has(target)) {
          visit(target);
          lows.set(node, Math.min(lows.get(node)!, lows.get(target)!));
        } else if (onStack.has(target)) lows.set(node, Math.min(lows.get(node)!, indexes.get(target)!));
      }
      if (lows.get(node) !== indexes.get(node)) return;
      const component: string[] = [];
      let popped: string;
      do {
        popped = stack.pop()!;
        onStack.delete(popped);
        component.push(popped);
      } while (popped !== node);
      components.push(component.sort(compareStrings));
    };
    nodes.forEach((node) => { if (!indexes.has(node)) visit(node); });

    const declaredGroups = new Map<string, { memberIds: string[]; cyclic: boolean }>();
    for (const members of components) {
      const declaredIds = sortedUnique(members
        .map((id) => this.byUnit.get(id)?.proofGroupId)
        .filter((id): id is string => id !== undefined));
      if (declaredIds.length > 1) {
        throw new Error(`incompatible declared proof group IDs inside SCC ${members.join(", ")}: ${declaredIds.join(", ")}`);
      }
      const selfCycle = members.length === 1 && (adjacency.get(members[0]!) ?? []).includes(members[0]!);
      const declaredId = declaredIds[0];
      if (declaredId === undefined) {
        if (members.length > 1 || selfCycle) {
          const group: DerivationProofGroup = {
            id: `proof-group:${hashFramedDomain("derivation-proof-group", members).slice("sha256:v1:".length)}`,
            memberIds: members,
            cyclic: true,
          };
          members.forEach((id) => this.groups.set(id, group));
        }
        continue;
      }
      const existing = declaredGroups.get(declaredId);
      if (existing === undefined) {
        declaredGroups.set(declaredId, { memberIds: [...members], cyclic: members.length > 1 || selfCycle });
      } else {
        existing.memberIds.push(...members);
        existing.cyclic ||= members.length > 1 || selfCycle || existing.memberIds.length > 1;
      }
    }
    for (const [id, definition] of declaredGroups.entries()) {
      const group: DerivationProofGroup = {
        id,
        memberIds: sortedUnique(definition.memberIds),
        cyclic: definition.cyclic || definition.memberIds.length > 1,
      };
      group.memberIds.forEach((memberId) => this.groups.set(memberId, group));
    }
  }
}

export class ImpactRuleRegistry {
  private readonly rules = new Map<string, ImpactRule>();

  constructor(rules: readonly ImpactRule[] = []) {
    rules.forEach((rule) => this.register(rule));
  }

  register(rule: ImpactRule): void {
    parseVersion(rule.version);
    const key = `${rule.id}\u0000${rule.version}`;
    const existing = this.rules.get(key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(rule)) {
      throw new Error(`conflicting impact rule ${rule.id}@${rule.version}`);
    }
    this.rules.set(key, structuredClone(rule));
  }

  current(): ImpactRule[] {
    const byId = new Map<string, ImpactRule>();
    for (const rule of this.rules.values()) {
      const existing = byId.get(rule.id);
      if (existing === undefined || compareVersionStrings(existing.version, rule.version) < 0) byId.set(rule.id, rule);
    }
    return [...byId.values()].sort((left, right) => compareStrings(`${left.id}\u0000${left.version}`, `${right.id}\u0000${right.version}`))
      .map((rule) => structuredClone(rule));
  }
}

export interface ImpactTraversalResult {
  knownIds: readonly EntityId[];
  possibleIds: readonly EntityId[];
  unavailableIds: readonly EntityId[];
  observability: ObservabilityClass;
  reasons: Readonly<Record<EntityId, readonly string[]>>;
  dependencyKeys?: readonly string[];
  assumptions?: readonly string[];
  unavailableLanes?: readonly string[];
}

export interface ImpactRuleEvaluationPort {
  subjects(rule: ImpactRule, phase: "before" | "after", event: InvalidationEvent): Promise<readonly SelectorSubject[]>;
  traverse(seedIds: readonly EntityId[], rule: ImpactRule, event: InvalidationEvent): Promise<ImpactTraversalResult>;
}

interface SyntheticQueryInput {
  id: string;
  kind: StateQueryKind;
  programId: string;
  programVersion: string;
  input: Record<string, unknown>;
  role: string;
  result: unknown;
  resultCount: number;
  observability: ObservabilityClass;
  assumptions?: readonly string[];
  unavailableLanes?: readonly string[];
  dependencyKeys: readonly string[];
}

function syntheticQueryDependency(input: SyntheticQueryInput): StateQueryDependency {
  const semanticHash = hashFramedDomain("state-query", {
    kind: input.kind,
    programId: input.programId,
    programVersion: input.programVersion,
    input: input.input,
  });
  return {
    query: {
      id: input.id,
      kind: input.kind,
      programId: input.programId,
      programVersion: input.programVersion,
      input: structuredClone(input.input),
      semanticHash,
    },
    priorResult: {
      queryHash: semanticHash,
      resultHash: hashFramedDomain("state-query-result", input.result),
      resultCount: input.resultCount,
      observability: input.observability,
      assumptions: sortedUnique(input.assumptions ?? []),
      unavailableLanes: sortedUnique(input.unavailableLanes ?? []),
      dependencyKeys: sortedUnique(input.dependencyKeys.length > 0 ? input.dependencyKeys : [`query:${input.id}`]),
    },
    role: input.role,
  };
}

function mergeImpactStateBinding(binding: StateBinding, event: InvalidationEvent, generated: readonly StateQueryDependency[]): StateBinding {
  return createStateBinding({
    compiledAgainst: binding.compiledAgainst ?? event.stateDigest,
    valueDependencies: binding.valueDependencies ?? [],
    queryDependencies: [...(binding.queryDependencies ?? []), ...generated],
  });
}

function normalizeSubjectResults(subjects: readonly SelectorSubject[]): Array<{ id: string; values: Partial<Record<string, unknown>> }> {
  return subjects.map(({ id, values }) => ({ id, values: structuredClone(values) }))
    .sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
}

const triggerFor = (eventKind: string): ImpactRule["trigger"] | undefined => {
  const triggers = new Set<ImpactRule["trigger"]>([
    "concept-change", "interface-change", "membership-change", "removal", "lens-change", "rule-change",
    "decision-change", "concern-resolution", "representation-profile-change", "external-change", "manual",
  ]);
  return triggers.has(eventKind as ImpactRule["trigger"]) ? eventKind as ImpactRule["trigger"] : undefined;
};

export type ImpactProofClass = "exact-derivation" | "impact-rule" | "inferred" | "unavailable";
export type ImpactDisposition = "known" | "possible" | "blocked" | "unavailable";

export interface ImpactClosureEntry {
  unitId: EntityId;
  disposition: ImpactDisposition;
  proofClass: ImpactProofClass;
  observability: ObservabilityClass;
  frontier: boolean;
  reasons: string[];
}

export interface ImpactClosureBlock {
  ruleId: EntityId;
  ruleVersion: string;
  unitIds: EntityId[];
  reason: string;
}

export interface InternalImpactClosure {
  version: "impact-closure@1";
  event: InvalidationEvent;
  stateBinding: StateBinding;
  entries: ImpactClosureEntry[];
  blocks: ImpactClosureBlock[];
  contentHash: ContentHash;
  ref: ImpactClosureRef;
}

/** Content-addressed persistence seam implemented by runtime adapters. */
export interface ImpactClosureArtifactStore {
  put(closure: InternalImpactClosure): Promise<void>;
  get(contentHash: ContentHash): Promise<InternalImpactClosure | undefined>;
}

function normalizeClosureEntries(entries: readonly ImpactClosureEntry[]): ImpactClosureEntry[] {
  const byKey = new Map<string, ImpactClosureEntry>();
  const proofRank: Record<ImpactProofClass, number> = { unavailable: 0, inferred: 1, "impact-rule": 2, "exact-derivation": 3 };
  const observabilityRank: Record<ObservabilityClass, number> = { closed: 0, bounded: 1, sampled: 2, open: 3, unavailable: 4 };
  const dispositionRank: Record<ImpactDisposition, number> = { known: 0, possible: 1, blocked: 2, unavailable: 3 };
  for (const candidate of entries) {
    const entry = { ...structuredClone(candidate), reasons: sortedUnique(candidate.reasons) };
    const key = `${entry.unitId}\u0000${entry.disposition}`;
    const existing = byKey.get(key);
    if (existing === undefined) byKey.set(key, entry);
    else {
      existing.reasons = sortedUnique([...existing.reasons, ...entry.reasons]);
      existing.frontier ||= entry.frontier;
      if (proofRank[entry.proofClass] > proofRank[existing.proofClass]) existing.proofClass = entry.proofClass;
      if (observabilityRank[entry.observability] > observabilityRank[existing.observability]) existing.observability = entry.observability;
    }
  }
  return [...byKey.values()].sort((left, right) => compareStrings(left.unitId, right.unitId)
    || dispositionRank[left.disposition] - dispositionRank[right.disposition]);
}

export function createImpactClosure(input: {
  event: InvalidationEvent;
  stateBinding: StateBinding;
  entries: readonly ImpactClosureEntry[];
  blocks?: readonly ImpactClosureBlock[];
}): InternalImpactClosure {
  const entries = normalizeClosureEntries(input.entries);
  const blocks = [...(input.blocks ?? [])].map((block) => ({
    ...structuredClone(block),
    unitIds: sortedUnique(block.unitIds),
  })).sort((left, right) => compareStrings(`${left.ruleId}\u0000${left.ruleVersion}`, `${right.ruleId}\u0000${right.ruleVersion}`)
    || compareStrings(left.reason, right.reason));
  const payload = {
    version: "impact-closure@1" as const,
    event: structuredClone(input.event),
    stateBinding: structuredClone(input.stateBinding),
    entries,
    blocks,
  };
  const contentHash = hashFramedDomain("impact-closure", payload);
  return {
    ...payload,
    contentHash,
    ref: {
      contentHash,
      knownAffectedUnitIds: sortedUnique(entries.filter(({ disposition }) => disposition === "known" || disposition === "blocked").map(({ unitId }) => unitId)),
      possibleFrontierUnitIds: sortedUnique(entries.filter(({ disposition }) => disposition === "possible").map(({ unitId }) => unitId)),
      unavailableSurfaceIds: sortedUnique(entries.filter(({ disposition }) => disposition === "unavailable").map(({ unitId }) => unitId)),
    },
  };
}

export interface RevalidatedUnit {
  unitId: EntityId;
  signature: SemanticSignature;
  validations?: readonly ValidationResult[];
}

function normalizeRevalidatedUnits(outputs: readonly RevalidatedUnit[]): RevalidatedUnit[] {
  const byUnit = new Map<string, RevalidatedUnit>();
  for (const candidate of outputs) {
    const normalized: RevalidatedUnit = {
      ...structuredClone(candidate),
      ...(candidate.validations === undefined ? {} : {
        validations: [...candidate.validations].map((validation) => structuredClone(validation))
          .sort((left, right) => compareStrings(left.validatorId, right.validatorId) || compareStrings(left.summary, right.summary)),
      }),
    };
    const existing = byUnit.get(normalized.unitId);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(normalized)) {
        throw new Error(`duplicate revalidation output ${normalized.unitId} has conflicting signatures or validations`);
      }
      continue;
    }
    byUnit.set(normalized.unitId, normalized);
  }
  return [...byUnit.values()].sort((left, right) => compareStrings(left.unitId, right.unitId));
}

export interface InvalidationRunOptions {
  revalidate(unitIds: readonly EntityId[]): Promise<readonly RevalidatedUnit[]>;
  backdatingPolicy?: BackdatingPolicy;
  stateBinding?: StateBinding;
  maximumProofGroupIterations?: number;
  derivationStore?: DerivationIndexStore;
}

export interface InvalidationBlock {
  ruleId: EntityId;
  ruleVersion: string;
  unitIds: EntityId[];
  reason: string;
}

export interface InvalidationRunResult {
  invalidation: InvalidationResult;
  backdatedUnitIds: EntityId[];
  validUnitIds: EntityId[];
  revalidatedRecords: DerivationRecord[];
  blocked: InvalidationBlock[];
  blockedUnitIds: EntityId[];
  diagnostics: string[];
  impactClosure?: InternalImpactClosure;
}

export class InvalidationEngine {
  private readonly derivations: DerivationIndex;
  private readonly impactRules: ImpactRuleRegistry | undefined;
  private readonly impactPort: ImpactRuleEvaluationPort | undefined;
  private readonly closureStore: ImpactClosureArtifactStore | undefined;
  private readonly signatureProfiles: SemanticSignatureProfileRegistry | undefined;
  private readonly derivationStore: DerivationIndexStore | undefined;

  constructor(options: {
    derivations: DerivationIndex;
    impactRules?: ImpactRuleRegistry;
    impactPort?: ImpactRuleEvaluationPort;
    closureStore?: ImpactClosureArtifactStore;
    signatureProfiles?: SemanticSignatureProfileRegistry;
    derivationStore?: DerivationIndexStore;
  }) {
    this.derivations = options.derivations;
    this.impactRules = options.impactRules;
    this.impactPort = options.impactPort;
    this.closureStore = options.closureStore;
    this.signatureProfiles = options.signatureProfiles;
    this.derivationStore = options.derivationStore;
    if ((this.impactRules === undefined) !== (this.impactPort === undefined)) {
      throw new Error("Impact Rules require an evaluation port and vice versa");
    }
  }

  async invalidate(event: InvalidationEvent, options: InvalidationRunOptions): Promise<InvalidationRunResult> {
    const directlyAffected = new Set(this.derivations.reverseDependents(event.subjectId));
    const transitivelyAffected = new Set<string>();
    const possibleFrontier = new Set<string>();
    const unavailable = new Set<string>();
    const backdated = new Set<string>();
    const refreshedRecords = new Map<string, DerivationRecord>();
    const blocked = new Map<string, InvalidationBlock>();
    const diagnostics = new Set<string>();
    const queryDependencies: StateQueryDependency[] = [];
    const reasons = new Map<string, Set<string>>();
    const proofClasses = new Map<string, ImpactProofClass>();
    const observability = new Map<string, ObservabilityClass>();
    queryDependencies.push(syntheticQueryDependency({
      id: `invalidation:reverse-derivation:${event.subjectId}`,
      kind: "reverse-derivation",
      programId: "invalidation.exact-reverse-derivation",
      programVersion: "1",
      input: { eventKind: event.eventKind, subjectId: event.subjectId },
      role: "exact reverse derivation dependents",
      result: sortedUnique([...directlyAffected]),
      resultCount: directlyAffected.size,
      observability: "closed",
      dependencyKeys: [`reverse-derivations:${event.subjectId}`],
    }));
    const addReason = (id: string, reason: string): void => {
      const values = reasons.get(id) ?? new Set<string>();
      values.add(reason);
      reasons.set(id, values);
    };
    directlyAffected.forEach((id) => {
      addReason(id, `exact derivation input ${event.subjectId} changed`);
      proofClasses.set(id, "exact-derivation");
      observability.set(id, "closed");
      const record = this.derivations.get(id);
      if (event.eventKind === "signature-profile-change" && record !== undefined
        && (record.outputSemanticSignature.profileId === event.subjectId || record.outputStructuralSignature.profileId === event.subjectId)) {
        addReason(id, `signature profile ${event.subjectId} changed; output derivation requires fresh proof`);
      }
    });

    if (this.impactRules !== undefined && this.impactPort !== undefined) {
      const trigger = triggerFor(event.eventKind);
      for (const rule of this.impactRules.current().filter((candidate) => candidate.trigger === trigger)) {
        let before: readonly SelectorSubject[];
        let after: readonly SelectorSubject[];
        try {
          [before, after] = await Promise.all([
            this.impactPort.subjects(rule, "before", event),
            this.impactPort.subjects(rule, "after", event),
          ]);
          for (const [phase, subjects] of [["before", before], ["after", after]] as const) {
            queryDependencies.push(syntheticQueryDependency({
              id: `invalidation:${rule.id}:${rule.version}:selector-membership:${phase}`,
              kind: "selector-membership",
              programId: "invalidation.impact-rule-selector-membership",
              programVersion: "1",
              input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, phase },
              role: "Impact Rule selector membership",
              result: normalizeSubjectResults(subjects),
              resultCount: subjects.length,
              observability: "closed",
              dependencyKeys: subjects.flatMap(({ dependencyKeys }) => dependencyKeys),
            }));
          }
        } catch (error) {
          for (const phase of ["before", "after"] as const) {
            queryDependencies.push(syntheticQueryDependency({
              id: `invalidation:${rule.id}:${rule.version}:selector-membership:${phase}`,
              kind: "selector-membership",
              programId: "invalidation.impact-rule-selector-membership",
              programVersion: "1",
              input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, phase },
              role: "Impact Rule selector membership",
              result: [],
              resultCount: 0,
              observability: "unavailable",
              unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} membership`],
              dependencyKeys: [`impact-rule-membership:${rule.id}:${phase}`],
            }));
          }
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} membership is unavailable`);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} membership failure: ${error instanceof Error ? error.message : "unknown failure"}`);
          continue;
        }
        let seeds: string[];
        try {
          seeds = sortedUnique([...before, ...after]
            .filter((subject) => evaluateSelector(rule.selector, subject).matched)
            .map(({ id }) => id));
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:applicability`,
            kind: "impact-rule-applicability",
            programId: "invalidation.impact-rule-applicability",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version },
            role: "Impact Rule applicability",
            result: seeds,
            resultCount: seeds.length,
            observability: "closed",
            dependencyKeys: [...before, ...after].flatMap(({ dependencyKeys }) => dependencyKeys),
          }));
        } catch (error) {
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:applicability`,
            kind: "impact-rule-applicability",
            programId: "invalidation.impact-rule-applicability",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version },
            role: "Impact Rule applicability",
            result: [],
            resultCount: 0,
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} evaluation`],
            dependencyKeys: [`impact-rule-applicability:${rule.id}`],
          }));
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} evaluation is unavailable`);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} evaluation failure: ${error instanceof Error ? error.message : "unknown failure"}`);
          continue;
        }
        seeds.forEach((id) => {
          directlyAffected.add(id);
          addReason(id, `Impact Rule ${rule.id}@${rule.version} applies to prior or current selector membership`);
          if (!proofClasses.has(id)) proofClasses.set(id, "impact-rule");
          if (!observability.has(id)) observability.set(id, "closed");
        });
        if (seeds.length === 0 || rule.effect === "advisory") continue;
        if (rule.effect === "block") {
          const block: InvalidationBlock = {
            ruleId: rule.id,
            ruleVersion: rule.version,
            unitIds: sortedUnique(seeds),
            reason: `Impact Rule ${rule.id}@${rule.version} blocks planning and mutation for applicable selector members`,
          };
          blocked.set(`${rule.id}\u0000${rule.version}`, block);
          block.unitIds.forEach((id) => {
            addReason(id, block.reason);
            proofClasses.set(id, "impact-rule");
            observability.set(id, "closed");
          });
          diagnostics.add(`impact-rule-block:${rule.id}@${rule.version}`);
          continue;
        }
        try {
          const traversal = await this.impactPort.traverse(seeds, rule, event);
          const traversalIds = [...traversal.knownIds, ...traversal.possibleIds, ...traversal.unavailableIds];
          const traversalDependencyKeys = [
            ...seeds.map((id) => `selector-member:${id}`),
            ...(traversal.dependencyKeys ?? []),
          ];
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:reverse-traversal`,
            kind: "reverse-derivation",
            programId: "invalidation.impact-rule-reverse-traversal",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, seedIds: sortedUnique(seeds) },
            role: "Impact Rule reverse derivation traversal",
            result: { knownIds: sortedUnique(traversal.knownIds), possibleIds: sortedUnique(traversal.possibleIds), unavailableIds: sortedUnique(traversal.unavailableIds) },
            resultCount: traversalIds.length,
            observability: traversal.observability,
            ...(traversal.assumptions === undefined ? {} : { assumptions: traversal.assumptions }),
            ...(traversal.unavailableLanes === undefined ? {} : { unavailableLanes: traversal.unavailableLanes }),
            dependencyKeys: traversalDependencyKeys,
          }));
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:enumeration`,
            kind: "surface-enumeration",
            programId: "invalidation.impact-rule-enumeration",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, seedIds: sortedUnique(seeds) },
            role: "Impact Rule bounded consequence enumeration",
            result: traversalIds,
            resultCount: traversalIds.length,
            observability: traversal.observability,
            ...(traversal.assumptions === undefined ? {} : { assumptions: traversal.assumptions }),
            ...(traversal.unavailableLanes === undefined ? {} : { unavailableLanes: traversal.unavailableLanes }),
            dependencyKeys: traversalDependencyKeys,
          }));
          traversal.knownIds.forEach((id) => {
            if (rule.effect === "widen-analysis") possibleFrontier.add(id);
            else transitivelyAffected.add(id);
            proofClasses.set(id, rule.effect === "widen-analysis" ? "inferred" : "impact-rule");
            observability.set(id, traversal.observability);
            addReason(id, `${rule.effect === "widen-analysis" ? "possible" : "proven"} Impact Rule ${rule.id}@${rule.version} consequence`);
          });
          traversal.possibleIds.forEach((id) => {
            possibleFrontier.add(id);
            proofClasses.set(id, "inferred");
            observability.set(id, traversal.observability);
            addReason(id, `possible Impact Rule ${rule.id}@${rule.version} consequence`);
          });
          traversal.unavailableIds.forEach((id) => {
            unavailable.add(id);
            proofClasses.set(id, "unavailable");
            observability.set(id, "unavailable");
            addReason(id, `Impact Rule ${rule.id}@${rule.version} traversal unavailable`);
          });
          for (const [id, values] of Object.entries(traversal.reasons)) values.forEach((reason) => addReason(id, reason));
          if (traversal.observability === "open" || traversal.observability === "sampled") {
            seeds.forEach((id) => addReason(id, `${traversal.observability} Impact Rule traversal cannot prove closure`));
          }
        } catch (error) {
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:reverse-traversal`,
            kind: "reverse-derivation",
            programId: "invalidation.impact-rule-reverse-traversal",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, seedIds: sortedUnique(seeds) },
            role: "Impact Rule reverse derivation traversal",
            result: [],
            resultCount: 0,
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} traversal`],
            dependencyKeys: seeds.map((id) => `selector-member:${id}`),
          }));
          queryDependencies.push(syntheticQueryDependency({
            id: `invalidation:${rule.id}:${rule.version}:enumeration`,
            kind: "surface-enumeration",
            programId: "invalidation.impact-rule-enumeration",
            programVersion: "1",
            input: { eventKind: event.eventKind, subjectId: event.subjectId, ruleId: rule.id, ruleVersion: rule.version, seedIds: sortedUnique(seeds) },
            role: "Impact Rule bounded consequence enumeration",
            result: [],
            resultCount: 0,
            observability: "unavailable",
            unavailableLanes: [`Impact Rule ${rule.id}@${rule.version} enumeration`],
            dependencyKeys: seeds.map((id) => `selector-member:${id}`),
          }));
          seeds.forEach((id) => {
            unavailable.add(id);
            proofClasses.set(id, "unavailable");
            observability.set(id, "unavailable");
            addReason(id, `Impact Rule ${rule.id}@${rule.version} traversal unavailable: ${error instanceof Error ? error.message : "unknown failure"}`);
          });
        }
      }
    }

    const policy = options.backdatingPolicy ?? {
      minimumValidatedAssurance: "strong",
      requireIndependent: true,
    };
    const processed = new Set<string>();
    for (const directId of [...directlyAffected].sort(compareStrings)) {
      if (processed.has(directId)) continue;
      const group = this.derivations.proofGroupFor(directId);
      const memberIds = group?.memberIds ?? [directId];
      memberIds.forEach((id) => processed.add(id));
      const priorRecords = memberIds.map((id) => this.derivations.get(id)).filter((item): item is DerivationRecord => item !== undefined);
      if (priorRecords.length === 0) continue;
      const maximumIterations = Math.max(1, options.maximumProofGroupIterations ?? 8);
      let outputs: RevalidatedUnit[] = [];
      let priorRoundHash: ContentHash | undefined;
      let fixedPointReached = group?.cyclic !== true;
      for (let iteration = 0; iteration < (group?.cyclic ? maximumIterations : 1); iteration += 1) {
        try {
          outputs = normalizeRevalidatedUnits(await options.revalidate(memberIds));
        } catch (error) {
          outputs = [];
          diagnostics.add(error instanceof Error ? error.message : "semantic revalidation failed");
          break;
        }
        const outputHash = hashFramedDomain("proof-group-output", [...outputs]
          .map(({ unitId, signature, validations }) => ({ unitId, signature, validations }))
          .sort((left, right) => compareStrings(left.unitId, right.unitId)));
        const matchesEstablished = priorRecords.every((prior) => {
          const output = outputs.find(({ unitId }) => unitId === prior.unitId);
          return output !== undefined && this.assessBackdating(prior, output, event, policy).eligible;
        });
        if (matchesEstablished || priorRoundHash === outputHash) {
          fixedPointReached = true;
          break;
        }
        priorRoundHash = outputHash;
      }
      const byUnit = new Map(outputs.map((output) => [output.unitId, output]));
      const assessments = priorRecords.map((prior) => {
        const output = byUnit.get(prior.unitId);
        return {
          unitId: prior.unitId,
          assessment: output === undefined ? undefined : this.assessBackdating(prior, output, event, policy),
        };
      });
      const groupEligible = assessments.length === memberIds.length && assessments.every(({ assessment }) => assessment?.eligible);
      if (groupEligible) {
        memberIds.forEach((id) => backdated.add(id));
        for (const prior of priorRecords) {
          const output = byUnit.get(prior.unitId);
          if (output !== undefined) refreshedRecords.set(prior.unitId, this.refreshDerivationRecord(prior, output, event));
        }
        continue;
      }
      const anyUnavailable = assessments.some(({ assessment }) => assessment === undefined);
      const anyMaterial = assessments.some(({ assessment }) => assessment?.materiallyChanged);
      const assuranceInsufficient = assessments.some(({ assessment }) =>
        assessment !== undefined && !assessment.eligible && !assessment.materiallyChanged);
      if (group?.cyclic && (!fixedPointReached || anyUnavailable || assuranceInsufficient)) {
        diagnostics.add("derivation-cycle-unresolved");
      }
      const reason = assessments.find(({ assessment }) => !assessment?.eligible)?.assessment?.reason
        ?? "semantic revalidation is unavailable";
      const downstream = this.transitiveDependents(memberIds, new Set(memberIds));
      queryDependencies.push(syntheticQueryDependency({
        id: `invalidation:reverse-derivation:downstream:${memberIds.join(",")}`,
        kind: "reverse-derivation",
        programId: "invalidation.transitive-reverse-derivation",
        programVersion: "1",
        input: { eventKind: event.eventKind, subjectId: event.subjectId, seedIds: sortedUnique(memberIds) },
        role: "transitive reverse derivation dependents",
        result: downstream,
        resultCount: downstream.length,
        observability: "closed",
        dependencyKeys: memberIds.map((id) => `reverse-derivations:${id}`),
      }));
      if (anyMaterial && fixedPointReached) downstream.forEach((id) => {
        if (!directlyAffected.has(id)) transitivelyAffected.add(id);
        addReason(id, reason);
      });
      else downstream.forEach((id) => {
        possibleFrontier.add(id);
        addReason(id, reason);
      });
      if (anyUnavailable) memberIds.forEach((id) => {
        unavailable.add(id);
        addReason(id, "semantic revalidation is unavailable");
      });
    }

    const revalidatedRecords = [...refreshedRecords.values()].sort((left, right) => compareStrings(left.unitId, right.unitId));
    if (revalidatedRecords.length > 0) {
      const refreshedById = new Map(revalidatedRecords.map((record) => [record.unitId, record]));
      this.derivations.replaceRecords(this.derivations.records().map((record) => refreshedById.get(record.unitId) ?? record));
      await (options.derivationStore ?? this.derivationStore)?.replace(this.derivations.snapshot());
    }

    directlyAffected.forEach((id) => {
      transitivelyAffected.delete(id);
      possibleFrontier.delete(id);
    });
    transitivelyAffected.forEach((id) => possibleFrontier.delete(id));
    const invalidation: InvalidationResult = {
      directlyAffected: sortedUnique([...directlyAffected]),
      transitivelyAffected: sortedUnique([...transitivelyAffected]),
      possibleFrontier: sortedUnique([...possibleFrontier]),
      unavailable: sortedUnique([...unavailable]),
      reasons: Object.fromEntries([...reasons.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([id, values]) => [id, sortedUnique([...values])])),
    };
    const invalid = new Set([
      ...invalidation.directlyAffected,
      ...invalidation.transitivelyAffected,
      ...invalidation.possibleFrontier,
      ...invalidation.unavailable,
      ...[...blocked.values()].flatMap(({ unitIds }) => unitIds),
    ]);
    const blockedUnitIds = new Set([...blocked.values()].flatMap(({ unitIds }) => unitIds));
    backdated.forEach((id) => {
      if (!blockedUnitIds.has(id)) invalid.delete(id);
    });

    const entries: ImpactClosureEntry[] = [
      ...invalidation.directlyAffected.map((unitId) => ({ unitId, disposition: "known" as const, proofClass: proofClasses.get(unitId) ?? "exact-derivation", observability: observability.get(unitId) ?? "closed", frontier: false, reasons: invalidation.reasons[unitId] ?? [] })),
      ...invalidation.transitivelyAffected.map((unitId) => ({ unitId, disposition: "known" as const, proofClass: proofClasses.get(unitId) ?? "exact-derivation", observability: observability.get(unitId) ?? "closed", frontier: false, reasons: invalidation.reasons[unitId] ?? [] })),
      ...invalidation.possibleFrontier.map((unitId) => ({ unitId, disposition: "possible" as const, proofClass: proofClasses.get(unitId) ?? "inferred", observability: observability.get(unitId) ?? "open", frontier: true, reasons: invalidation.reasons[unitId] ?? [] })),
      ...[...blocked.values()].flatMap((block) => block.unitIds.map((unitId) => ({ unitId, disposition: "blocked" as const, proofClass: "impact-rule" as const, observability: observability.get(unitId) ?? "closed", frontier: true, reasons: [...(invalidation.reasons[unitId] ?? []), block.reason] }))),
      ...invalidation.unavailable.map((unitId) => ({ unitId, disposition: "unavailable" as const, proofClass: "unavailable" as const, observability: "unavailable" as const, frontier: true, reasons: invalidation.reasons[unitId] ?? [] })),
    ];
    const normalizedBinding = options.stateBinding === undefined
      ? undefined
      : mergeImpactStateBinding(options.stateBinding, event, queryDependencies);
    const impactClosure = options.stateBinding === undefined
      ? undefined
      : createImpactClosure({ event, stateBinding: normalizedBinding!, entries, blocks: [...blocked.values()] });
    if (impactClosure !== undefined) await this.closureStore?.put(impactClosure);
    return {
      invalidation,
      backdatedUnitIds: sortedUnique([...backdated]),
      validUnitIds: this.derivations.allUnitIds().filter((id) => !invalid.has(id)),
      revalidatedRecords,
      blocked: [...blocked.values()].sort((left, right) => compareStrings(`${left.ruleId}\u0000${left.ruleVersion}`, `${right.ruleId}\u0000${right.ruleVersion}`)),
      blockedUnitIds: sortedUnique([...blocked.values()].flatMap(({ unitIds }) => unitIds)),
      diagnostics: sortedUnique([...diagnostics]),
      ...(impactClosure === undefined ? {} : { impactClosure }),
    };
  }

  private assessBackdating(
    prior: DerivationRecord,
    output: RevalidatedUnit,
    event: InvalidationEvent,
    policy: BackdatingPolicy,
  ): BackdatingAssessment {
    const profileChanged = event.eventKind === "signature-profile-change"
      && (event.subjectId === prior.outputSemanticSignature.profileId || event.subjectId === prior.outputStructuralSignature.profileId);
    if (profileChanged) {
      return {
        eligible: false,
        materiallyChanged: true,
        reason: "signature profile changed and requires a fresh derivation proof",
        qualifyingValidatorIds: [],
      };
    }
    if (this.signatureProfiles !== undefined) {
      for (const candidate of [output.signature, prior.outputStructuralSignature]) {
        const profileAssessment = this.signatureProfiles.assess(candidate);
        if (!profileAssessment.current) {
          return {
            eligible: false,
            materiallyChanged: true,
            reason: profileAssessment.reason,
            qualifyingValidatorIds: [],
          };
        }
      }
    }
    return assessBackdating(prior.outputSemanticSignature, output.signature, output.validations ?? [], policy);
  }

  private refreshDerivationRecord(prior: DerivationRecord, output: RevalidatedUnit, event: InvalidationEvent): DerivationRecord {
    const changedVersionHash = event.newHash ?? hashFramedDomain("invalidation-event-input", event);
    const inputs = prior.inputs.map((input) => input.id === event.subjectId
      ? { ...input, versionHash: changedVersionHash }
      : input);
    const profileDependency = event.eventKind === "signature-profile-change"
      && (prior.outputSemanticSignature.profileId === event.subjectId || prior.outputStructuralSignature.profileId === event.subjectId)
      && !inputs.some((input) => input.kind === "signature-profile" && input.id === event.subjectId);
    if (profileDependency) inputs.push({
      kind: "signature-profile",
      id: event.subjectId,
      versionHash: changedVersionHash,
      role: "output-signature-profile",
    });
    return normalizeRecord({
      ...prior,
      inputs,
      outputSemanticSignature: structuredClone(output.signature),
      validators: output.validations === undefined ? prior.validators : [...output.validations],
    });
  }

  private transitiveDependents(seedIds: readonly string[], excluded: ReadonlySet<string>): string[] {
    const seen = new Set<string>();
    const pending = [...seedIds].sort(compareStrings);
    while (pending.length > 0) {
      const current = pending.shift()!;
      for (const dependent of this.derivations.reverseDependents(current)) {
        if (excluded.has(dependent) || seen.has(dependent)) continue;
        seen.add(dependent);
        pending.push(dependent);
        pending.sort(compareStrings);
      }
    }
    return sortedUnique([...seen]);
  }
}

export interface CorrectnessOracleInput {
  rebuild: { incrementalHash: ContentHash; cleanHash: ContentHash };
  conformance: readonly ValidationResult[];
  historical: readonly ValidationResult[];
  conformancePolicy?: {
    minimumAssurance?: ValidationResult["assurance"];
    minimumIndependentGroups?: number;
    disallowedEvidenceLanes?: readonly ValidationResult["evidenceLane"][];
  };
}

export interface CorrectnessOracleVerdict {
  rebuildConsistent: boolean;
  conformancePassed: boolean;
  historicalPassed: boolean | undefined;
  strongCompletion: boolean;
  contradictions: string[];
  evidenceByOracle: {
    rebuild: string[];
    conformance: string[];
    historical: string[];
  };
}

export function compareCorrectnessOracles(input: CorrectnessOracleInput): CorrectnessOracleVerdict {
  const rebuildConsistent = input.rebuild.incrementalHash === input.rebuild.cleanHash;
  const minimumAssurance = input.conformancePolicy?.minimumAssurance ?? "strong";
  const minimumIndependentGroups = Math.max(1, input.conformancePolicy?.minimumIndependentGroups ?? 1);
  const disallowedEvidenceLanes = new Set<ValidationResult["evidenceLane"]>([
    "same-packet-agent",
    ...(input.conformancePolicy?.disallowedEvidenceLanes ?? []),
  ]);
  const qualifyingConformance = input.conformance.filter((result) =>
    result.status === "passed"
    && validationAssuranceRank[result.assurance] >= validationAssuranceRank[minimumAssurance]
    && !disallowedEvidenceLanes.has(result.evidenceLane)
    && result.independenceGroup.trim() !== ""
    && result.authorSource.trim() !== ""
    && result.evidenceIds.length > 0,
  );
  const independentGroups = new Set(qualifyingConformance.map(({ independenceGroup }) => independenceGroup.trim()));
  const conformancePassed = input.conformance.length > 0
    && input.conformance.every(({ status }) => status === "passed")
    && qualifyingConformance.length > 0
    && independentGroups.size >= minimumIndependentGroups;
  const historicalPassed = input.historical.length === 0
    ? undefined
    : input.historical.every(({ status }) => status === "passed");
  const contradictions = sortedUnique([
    ...input.conformance.filter(({ status }) => status === "failed" || status === "blocked").map(({ summary }) => summary),
    ...input.historical.filter(({ status }) => status === "failed" || status === "blocked").map(({ summary }) => summary),
  ]);
  return {
    rebuildConsistent,
    conformancePassed,
    historicalPassed,
    strongCompletion: rebuildConsistent && conformancePassed && contradictions.length === 0,
    contradictions,
    evidenceByOracle: {
      rebuild: [rebuildConsistent ? "clean and incremental derived state agree" : "clean and incremental derived state differ"],
      conformance: input.conformance.map(({ summary }) => summary).sort(compareStrings),
      historical: input.historical.map(({ summary }) => summary).sort(compareStrings),
    },
  };
}
