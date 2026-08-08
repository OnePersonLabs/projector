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
  type ValidationResult,
} from "@projector/core";

import { evaluateSelector, type SelectorSubject } from "../governance/selectors.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  if (leftParts.every((part) => /^\d+$/u.test(part)) && rightParts.every((part) => /^\d+$/u.test(part))) {
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = Number(leftParts[index] ?? "0") - Number(rightParts[index] ?? "0");
      if (difference !== 0) return difference < 0 ? -1 : 1;
    }
    return 0;
  }
  return compareStrings(left, right);
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
      .sort(compareVersions)
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
        const dependents = this.reverse.get(input.id) ?? new Set<string>();
        dependents.add(record.unitId);
        this.reverse.set(input.id, dependents);
      }
    }
    this.buildProofGroups();
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

    const declared = new Map<string, string[]>();
    for (const record of this.byUnit.values()) {
      if (record.proofGroupId === undefined) continue;
      declared.set(record.proofGroupId, [...(declared.get(record.proofGroupId) ?? []), record.unitId]);
    }
    for (const members of [...components, ...[...declared.values()].map((ids) => sortedUnique(ids))]) {
      const selfCycle = members.length === 1 && (adjacency.get(members[0]!) ?? []).includes(members[0]!);
      const declaredId = members.map((id) => this.byUnit.get(id)?.proofGroupId).find((id) => id !== undefined);
      const group: DerivationProofGroup = {
        id: declaredId ?? `proof-group:${hashFramedDomain("derivation-proof-group", members).slice("sha256:v1:".length)}`,
        memberIds: members,
        cyclic: members.length > 1 || selfCycle,
      };
      if (group.cyclic || declaredId !== undefined) members.forEach((id) => this.groups.set(id, group));
    }
  }
}

export class ImpactRuleRegistry {
  private readonly rules = new Map<string, ImpactRule>();

  constructor(rules: readonly ImpactRule[] = []) {
    rules.forEach((rule) => this.register(rule));
  }

  register(rule: ImpactRule): void {
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
      if (existing === undefined || compareVersions(existing.version, rule.version) < 0) byId.set(rule.id, rule);
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
}

export interface ImpactRuleEvaluationPort {
  subjects(rule: ImpactRule, phase: "before" | "after", event: InvalidationEvent): Promise<readonly SelectorSubject[]>;
  traverse(seedIds: readonly EntityId[], rule: ImpactRule, event: InvalidationEvent): Promise<ImpactTraversalResult>;
}

const triggerFor = (eventKind: string): ImpactRule["trigger"] | undefined => {
  const triggers = new Set<ImpactRule["trigger"]>([
    "concept-change", "interface-change", "membership-change", "removal", "lens-change", "rule-change",
    "decision-change", "concern-resolution", "representation-profile-change", "external-change", "manual",
  ]);
  return triggers.has(eventKind as ImpactRule["trigger"]) ? eventKind as ImpactRule["trigger"] : undefined;
};

export type ImpactProofClass = "exact-derivation" | "impact-rule" | "inferred" | "unavailable";
export type ImpactDisposition = "known" | "possible" | "unavailable";

export interface ImpactClosureEntry {
  unitId: EntityId;
  disposition: ImpactDisposition;
  proofClass: ImpactProofClass;
  observability: ObservabilityClass;
  frontier: boolean;
  reasons: string[];
}

export interface InternalImpactClosure {
  version: "impact-closure@1";
  event: InvalidationEvent;
  stateBinding: StateBinding;
  entries: ImpactClosureEntry[];
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
  const dispositionRank: Record<ImpactDisposition, number> = { possible: 0, unavailable: 1, known: 2 };
  for (const candidate of entries) {
    const entry = { ...structuredClone(candidate), reasons: sortedUnique(candidate.reasons) };
    const existing = byKey.get(entry.unitId);
    if (existing === undefined || dispositionRank[entry.disposition] > dispositionRank[existing.disposition]) byKey.set(entry.unitId, entry);
    else if (existing.disposition === entry.disposition) {
      existing.reasons = sortedUnique([...existing.reasons, ...entry.reasons]);
      existing.frontier ||= entry.frontier;
    }
  }
  return [...byKey.values()].sort((left, right) => compareStrings(left.unitId, right.unitId));
}

export function createImpactClosure(input: {
  event: InvalidationEvent;
  stateBinding: StateBinding;
  entries: readonly ImpactClosureEntry[];
}): InternalImpactClosure {
  const entries = normalizeClosureEntries(input.entries);
  const payload = {
    version: "impact-closure@1" as const,
    event: structuredClone(input.event),
    stateBinding: structuredClone(input.stateBinding),
    entries,
  };
  const contentHash = hashFramedDomain("impact-closure", payload);
  return {
    ...payload,
    contentHash,
    ref: {
      contentHash,
      knownAffectedUnitIds: entries.filter(({ disposition }) => disposition === "known").map(({ unitId }) => unitId),
      possibleFrontierUnitIds: entries.filter(({ disposition }) => disposition === "possible").map(({ unitId }) => unitId),
      unavailableSurfaceIds: entries.filter(({ disposition }) => disposition === "unavailable").map(({ unitId }) => unitId),
    },
  };
}

export interface RevalidatedUnit {
  unitId: EntityId;
  signature: SemanticSignature;
  validations?: readonly ValidationResult[];
}

export interface InvalidationRunOptions {
  revalidate(unitIds: readonly EntityId[]): Promise<readonly RevalidatedUnit[]>;
  backdatingPolicy?: BackdatingPolicy;
  stateBinding?: StateBinding;
  maximumProofGroupIterations?: number;
}

export interface InvalidationRunResult {
  invalidation: InvalidationResult;
  backdatedUnitIds: EntityId[];
  validUnitIds: EntityId[];
  diagnostics: string[];
  impactClosure?: InternalImpactClosure;
}

export class InvalidationEngine {
  private readonly derivations: DerivationIndex;
  private readonly impactRules: ImpactRuleRegistry | undefined;
  private readonly impactPort: ImpactRuleEvaluationPort | undefined;
  private readonly closureStore: ImpactClosureArtifactStore | undefined;

  constructor(options: {
    derivations: DerivationIndex;
    impactRules?: ImpactRuleRegistry;
    impactPort?: ImpactRuleEvaluationPort;
    closureStore?: ImpactClosureArtifactStore;
  }) {
    this.derivations = options.derivations;
    this.impactRules = options.impactRules;
    this.impactPort = options.impactPort;
    this.closureStore = options.closureStore;
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
    const diagnostics = new Set<string>();
    const reasons = new Map<string, Set<string>>();
    const proofClasses = new Map<string, ImpactProofClass>();
    const observability = new Map<string, ObservabilityClass>();
    const addReason = (id: string, reason: string): void => {
      const values = reasons.get(id) ?? new Set<string>();
      values.add(reason);
      reasons.set(id, values);
    };
    directlyAffected.forEach((id) => {
      addReason(id, `exact derivation input ${event.subjectId} changed`);
      proofClasses.set(id, "exact-derivation");
      observability.set(id, "closed");
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
        } catch {
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} membership is unavailable`);
          continue;
        }
        let seeds: string[];
        try {
          seeds = sortedUnique([...before, ...after]
            .filter((subject) => evaluateSelector(rule.selector, subject).matched)
            .map(({ id }) => id));
        } catch {
          unavailable.add(event.subjectId);
          addReason(event.subjectId, `Impact Rule ${rule.id}@${rule.version} evaluation is unavailable`);
          continue;
        }
        seeds.forEach((id) => {
          directlyAffected.add(id);
          addReason(id, `Impact Rule ${rule.id}@${rule.version} applies to prior or current selector membership`);
          if (!proofClasses.has(id)) proofClasses.set(id, "impact-rule");
          if (!observability.has(id)) observability.set(id, "closed");
        });
        if (seeds.length === 0 || rule.effect === "advisory") continue;
        try {
          const traversal = await this.impactPort.traverse(seeds, rule, event);
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
        } catch {
          seeds.forEach((id) => unavailable.add(id));
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
      let outputs: readonly RevalidatedUnit[] = [];
      let priorRoundHash: ContentHash | undefined;
      let fixedPointReached = group?.cyclic !== true;
      for (let iteration = 0; iteration < (group?.cyclic ? maximumIterations : 1); iteration += 1) {
        try {
          outputs = await options.revalidate(memberIds);
        } catch {
          outputs = [];
          break;
        }
        const outputHash = hashFramedDomain("proof-group-output", [...outputs]
          .map(({ unitId, signature }) => ({ unitId, signature }))
          .sort((left, right) => compareStrings(left.unitId, right.unitId)));
        const matchesEstablished = priorRecords.every((prior) => {
          const output = outputs.find(({ unitId }) => unitId === prior.unitId);
          return output !== undefined && assessBackdating(
            prior.outputSemanticSignature,
            output.signature,
            output.validations ?? [],
            policy,
          ).eligible;
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
          assessment: output === undefined ? undefined : assessBackdating(
            prior.outputSemanticSignature,
            output.signature,
            output.validations ?? [],
            policy,
          ),
        };
      });
      const groupEligible = assessments.length === memberIds.length && assessments.every(({ assessment }) => assessment?.eligible);
      if (groupEligible) {
        memberIds.forEach((id) => backdated.add(id));
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
    ]);
    backdated.forEach((id) => invalid.delete(id));

    const entries: ImpactClosureEntry[] = [
      ...invalidation.directlyAffected.map((unitId) => ({ unitId, disposition: "known" as const, proofClass: proofClasses.get(unitId) ?? "exact-derivation", observability: observability.get(unitId) ?? "closed", frontier: false, reasons: invalidation.reasons[unitId] ?? [] })),
      ...invalidation.transitivelyAffected.map((unitId) => ({ unitId, disposition: "known" as const, proofClass: proofClasses.get(unitId) ?? "exact-derivation", observability: observability.get(unitId) ?? "closed", frontier: false, reasons: invalidation.reasons[unitId] ?? [] })),
      ...invalidation.possibleFrontier.map((unitId) => ({ unitId, disposition: "possible" as const, proofClass: proofClasses.get(unitId) ?? "inferred", observability: observability.get(unitId) ?? "open", frontier: true, reasons: invalidation.reasons[unitId] ?? [] })),
      ...invalidation.unavailable.map((unitId) => ({ unitId, disposition: "unavailable" as const, proofClass: "unavailable" as const, observability: "unavailable" as const, frontier: true, reasons: invalidation.reasons[unitId] ?? [] })),
    ];
    const impactClosure = options.stateBinding === undefined
      ? undefined
      : createImpactClosure({ event, stateBinding: options.stateBinding, entries });
    if (impactClosure !== undefined) await this.closureStore?.put(impactClosure);
    return {
      invalidation,
      backdatedUnitIds: sortedUnique([...backdated]),
      validUnitIds: this.derivations.allUnitIds().filter((id) => !invalid.has(id)),
      diagnostics: sortedUnique([...diagnostics]),
      ...(impactClosure === undefined ? {} : { impactClosure }),
    };
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
  const independentConformance = input.conformance.filter(({ evidenceLane }) => evidenceLane !== "same-packet-agent");
  const conformancePassed = independentConformance.length > 0
    && independentConformance.every(({ status }) => status === "passed");
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
