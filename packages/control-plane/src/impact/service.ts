import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DerivationRecordSchema, ImpactRuleSchema, RelationSchema, canonicalJson, hashFramedDomain,
  type ContentHash, type DerivationInput, type DerivationRecord, type ImpactRule,
  type InvalidationEvent, type PlanningSurprise, type Relation, type StateDigest,
} from "@projector/core";
import {
  DerivationIndex, ImpactRuleRegistry, InvalidationEngine, SemanticSignatureProfileRegistry,
  createStateBinding, projectionUnitSelectorSubject,
  type InvalidationRunResult, type SelectorSubject,
} from "@projector/engine";
import { RepositoryPathService } from "@projector/runtime";
import { z } from "zod";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "../knowledge/graph.js";

const version = "repository-impact@1" as const;
const profileId = "projector.exact-observed-inputs";
const profileVersion = "1.0.0";
const scope = "Exact source bytes, resolved static dependencies, and governing membership; no runtime behavior equivalence";
const hash = (value: unknown): ContentHash => hashFramedDomain(version, value);
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const ordered = <T>(items: readonly T[]): T[] => [...items].sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);

export interface RepositoryImpactReference {
  readonly version: typeof version;
  readonly contentHash: ContentHash;
  readonly state: StateDigest;
}

export interface RepositoryImpactSnapshot extends RepositoryImpactReference {
  readonly records: readonly DerivationRecord[];
  readonly files: readonly { path: string; artifactId: string; contentHash: ContentHash; unitIds: readonly string[] }[];
  readonly canonical: readonly { id: string; kind: string; versionHash: ContentHash }[];
  readonly subjects: readonly SelectorSubject[];
  readonly rules: readonly { lensId: string; memberIds: readonly string[]; rule: ImpactRule }[];
  readonly relations: readonly Relation[];
  readonly possibleUnitIds: readonly string[];
  readonly unknowns: readonly string[];
}

export interface RepositoryImpactReport {
  readonly baseline: RepositoryImpactReference;
  readonly current: RepositoryImpactReference;
  readonly status: "current" | "changed" | "unavailable";
  readonly predictedUnitIds: readonly string[];
  readonly observedChangedUnitIds: readonly string[];
  readonly knownAffectedUnitIds: readonly string[];
  readonly possibleFrontierUnitIds: readonly string[];
  readonly backdatedUnitIds: readonly string[];
  readonly blockedUnitIds: readonly string[];
  readonly repairRoute: "reuse" | "revalidate" | "widen-analysis" | "human-decision";
  readonly surprises: readonly PlanningSurprise[];
  readonly candidateRelations: readonly { id: string; fromId: string; toId: string; sourceClass: "inferred"; evidenceHash: ContentHash; explanation: string }[];
  readonly diagnostics: readonly string[];
  readonly contentHash: ContentHash;
}

const contentHashSchema = z.string().regex(/^sha256:v1:[0-9a-f]{64}$/u);
const stateSchema = z.strictObject({ gitBase: z.string(), worktreeDigest: contentHashSchema, canonicalProjectorDigest: contentHashSchema, toolchainDigest: contentHashSchema, pinnedExternalSnapshotDigest: contentHashSchema.optional() });
export const RepositoryImpactReferenceSchema = z.strictObject({ version: z.literal(version), contentHash: contentHashSchema, state: stateSchema }) as z.ZodType<RepositoryImpactReference>;
const snapshotSchema = z.strictObject({
  version: z.literal(version), contentHash: contentHashSchema, state: stateSchema,
  records: z.array(DerivationRecordSchema),
  files: z.array(z.strictObject({ path: z.string(), artifactId: z.string(), contentHash: contentHashSchema, unitIds: z.array(z.string()) })),
  canonical: z.array(z.strictObject({ id: z.string(), kind: z.string(), versionHash: contentHashSchema })),
  subjects: z.array(z.strictObject({ id: z.string(), values: z.record(z.string(), z.unknown()), dependencyKeys: z.array(z.string()) })),
  rules: z.array(z.strictObject({ lensId: z.string(), memberIds: z.array(z.string()), rule: ImpactRuleSchema })),
  relations: z.array(RelationSchema), possibleUnitIds: z.array(z.string()), unknowns: z.array(z.string()),
});
export const RepositoryImpactReportSchema = z.strictObject({
  baseline: RepositoryImpactReferenceSchema, current: RepositoryImpactReferenceSchema,
  status: z.enum(["current", "changed", "unavailable"]),
  predictedUnitIds: z.array(z.string()), observedChangedUnitIds: z.array(z.string()), knownAffectedUnitIds: z.array(z.string()), possibleFrontierUnitIds: z.array(z.string()), backdatedUnitIds: z.array(z.string()), blockedUnitIds: z.array(z.string()),
  repairRoute: z.enum(["reuse", "revalidate", "widen-analysis", "human-decision"]),
  surprises: z.array(z.strictObject({ id: z.string(), planId: z.string(), kind: z.literal("unpredicted-code-impact"), predictedEntityIds: z.array(z.string()), observedEntityIds: z.array(z.string()), unexpectedEntityIds: z.array(z.string()), evidence: z.array(z.strictObject({ evidenceId: z.string(), stance: z.literal("supports") })), explanation: z.string(), disposition: z.literal("unresolved"), proposedRelationIds: z.array(z.string()), contentHash: contentHashSchema })),
  candidateRelations: z.array(z.strictObject({ id: z.string(), fromId: z.string(), toId: z.string(), sourceClass: z.literal("inferred"), evidenceHash: contentHashSchema, explanation: z.string() })),
  diagnostics: z.array(z.string()), contentHash: contentHashSchema,
}) as z.ZodType<RepositoryImpactReport>;

function profiles(): SemanticSignatureProfileRegistry {
  const registry = new SemanticSignatureProfileRegistry();
  registry.register({ id: profileId, version: profileVersion, scope, normalization: "Canonical serialization of complete observed input hashes; source bytes are not normalized", ignoredDifferences: [], adapterId: version, adapterVersion: profileVersion, maximumAssurance: "exact", assuranceEvidence: ["Byte content hashes and resolved static import facts from the no-exec repository observation"], unsupportedConstructs: ["runtime semantic equivalence", "dynamic dependency resolution", "external side effects"], normalize: (value) => value });
  return registry;
}

export function impactReference(snapshot: RepositoryImpactSnapshot): RepositoryImpactReference {
  return { version, contentHash: snapshot.contentHash, state: snapshot.state };
}

/** Approval binds the proof it used; unrelated whole-repository changes may rebind. */
export function repositoryImpactProofHash(snapshot: RepositoryImpactSnapshot, prediction: RepositoryImpactReport): ContentHash {
  const selected = new Set([...prediction.knownAffectedUnitIds, ...prediction.possibleFrontierUnitIds, ...prediction.blockedUnitIds]);
  return hashFramedDomain("repository-plan-derivation-impact", {
    version,
    records: snapshot.records.filter(({ unitId }) => selected.has(unitId)),
    rules: snapshot.rules,
    relations: snapshot.rules.length === 0 ? [] : snapshot.relations.filter(({ fromId, toId }) => selected.has(fromId) || selected.has(toId)),
    knownAffectedUnitIds: prediction.knownAffectedUnitIds,
    possibleFrontierUnitIds: prediction.possibleFrontierUnitIds,
    blockedUnitIds: prediction.blockedUnitIds,
    diagnostics: prediction.diagnostics,
  });
}

/** This index records observed derivation inputs, never relevance edges. */
export function buildRepositoryImpactSnapshot(observation: ChangeRepositoryObservation, graph = new KnowledgeGraph(observation)): RepositoryImpactSnapshot {
  const registry = profiles();
  const analysis = observation.analysis;
  const files = [...analysis.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map((file) => ({ path: file.path, artifactId: file.artifactId, contentHash: file.contentHash, unitIds: unique(graph.units.filter(({ artifactId }) => artifactId === file.artifactId).map(({ id }) => id)) }));
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const filesByArtifact = new Map(files.map((file) => [file.artifactId, file]));
  const possible = new Set<string>();
  const unknowns = new Set<string>();
  const activeLenses = graph.lenses.filter(({ status }) => status === "active");
  if (graph.lensCompilationUnknown !== undefined) { unknowns.add(graph.lensCompilationUnknown); graph.units.forEach(({ id }) => possible.add(id)); }
  for (const failure of analysis.failures) {
    if (!failure.affectedClaimKinds.some((kind) => !kind.startsWith("git-") && kind !== "move-lineage")) continue;
    unknowns.add(`${failure.analyzerId}: ${failure.scope}: ${failure.message}`);
    const affected = filesByPath.get(failure.scope)?.unitIds ?? graph.units.map(({ id }) => id);
    affected.forEach((id) => possible.add(id));
  }
  for (const file of analysis.javaScript.files) {
    const uncertainty = file.unknowns.filter((message) => /import|module|dependency/iu.test(message));
    if (uncertainty.length > 0) {
      filesByPath.get(file.path)?.unitIds.forEach((id) => possible.add(id));
      uncertainty.forEach((message) => unknowns.add(`${file.path}: ${message}`));
    }
  }
  const supportedSources = new Set(analysis.javaScript.files.map(({ path }) => path));
  for (const file of analysis.files.filter(({ path, semanticRole }) => semanticRole === "source" && !supportedSources.has(path))) {
    filesByPath.get(file.path)?.unitIds.forEach((id) => possible.add(id));
    unknowns.add(`Static runtime dependency observation is unsupported for ${file.path}`);
  }
  const records = graph.units.flatMap((unit): DerivationRecord[] => {
    const file = filesByArtifact.get(unit.artifactId);
    if (file === undefined) { possible.add(unit.id); unknowns.add(`No observed source bytes for ${unit.id}`); return []; }
    const lenses = activeLenses.filter(({ id }) => graph.lensCompilation?.memberships[id]?.includes(unit.id));
    const membershipHash = hash(lenses.map(({ id }) => ({ id, members: graph.lensCompilation?.memberships[id] ?? [] })));
    const ruleBundleHash = hash(lenses.map(({ id, semanticHash, rules, impactRules }) => ({ id, semanticHash, rules, impactRules })));
    const inputs: DerivationInput[] = [
      { kind: "artifact", id: file.artifactId, versionHash: file.contentHash, role: "exact own source bytes" },
      { kind: "toolchain", id: "repository-toolchain", versionHash: observation.state.toolchainDigest, role: "observing adapter versions" },
      { kind: "signature-profile", id: profileId, versionHash: hash({ profileId, profileVersion, scope }), role: "exact observed input profile" },
      { kind: "rule-bundle", id: `observed-rules:${unit.id}`, versionHash: ruleBundleHash, role: "applicable rules" },
      { kind: "rule-bundle", id: `observed-membership:${unit.id}`, versionHash: membershipHash, role: "applicable lens selector membership" },
      ...lenses.map(({ id, semanticHash }): DerivationInput => ({ kind: "lens", id, versionHash: semanticHash, role: "applicable active lens" })),
    ];
    for (const dependency of analysis.dependencies.filter(({ importerPath }) => importerPath === file.path)) {
      const target = dependency.resolvedPath === undefined ? undefined : filesByPath.get(dependency.resolvedPath);
      if (target === undefined || target.unitIds.length === 0) { possible.add(unit.id); unknowns.add(`Unresolved dependency ${file.path}: ${dependency.specifier}`); continue; }
      for (const id of target.unitIds) inputs.push({ kind: "unit", id, versionHash: target.contentHash, role: `resolved static import ${dependency.specifier}` });
    }
    const normalizedInputs = ordered([...new Map(inputs.map((input) => [`${input.kind}\0${input.id}\0${input.role}`, input])).values()]);
    const signature = registry.sign(profileId, profileVersion, { inputs: normalizedInputs, membershipHash, ruleBundleHash }, { assurance: "exact", evidenceIds: [file.artifactId] });
    // The logical epoch keeps rebuilds deterministic; the snapshot state binds observation time.
    return [{ unitId: unit.id, engineVersion: profileVersion, adapterVersion: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`).sort().join(","), inputs: normalizedInputs, ruleBundleHash, outputSemanticSignature: signature, outputStructuralSignature: signature, membershipHash, establishedAt: "1970-01-01T00:00:00.000Z", validators: [] }];
  });
  const basis = {
    version, state: observation.state, records: new DerivationIndex(records).records(), files,
    canonical: observation.canonical.documents.map(({ id, kind, semanticHash, canonicalDocumentHash }) => ({ id, kind, versionHash: semanticHash ?? canonicalDocumentHash })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    subjects: graph.units.map((unit) => projectionUnitSelectorSubject(unit, { path: filesByArtifact.get(unit.artifactId)?.path ?? unit.key, surface: analysis.surface.kind })),
    rules: activeLenses.flatMap((lens) => lens.impactRules.map((rule) => ({ lensId: lens.id, memberIds: graph.lensCompilation?.memberships[lens.id] ?? [], rule }))),
    relations: graph.relations, possibleUnitIds: unique([...possible]), unknowns: unique([...unknowns]),
  };
  return { ...basis, contentHash: hash(basis) };
}

function authenticate(value: unknown, reference: RepositoryImpactReference): RepositoryImpactSnapshot {
  const snapshot = snapshotSchema.parse(value) as unknown as RepositoryImpactSnapshot;
  const { contentHash, ...basis } = snapshot;
  if (snapshot.version !== version || contentHash !== reference.contentHash || hash(basis) !== contentHash || canonicalJson(snapshot.state) !== canonicalJson(reference.state)) throw new Error("Derived impact snapshot failed content, version, or state authentication");
  if (canonicalJson(new DerivationIndex(snapshot.records).records()) !== canonicalJson(snapshot.records)) throw new Error("Derived impact records are not normalized");
  return snapshot;
}

const snapshotPath = (reference: RepositoryImpactReference): string => {
  RepositoryImpactReferenceSchema.parse(reference);
  return `.projector/runtime/impact/${reference.contentHash.slice("sha256:v1:".length)}.json`;
};

export async function readRepositoryImpactSnapshot(repositoryRoot: string, reference: RepositoryImpactReference): Promise<RepositoryImpactSnapshot> {
  const paths = await RepositoryPathService.create(repositoryRoot);
  const path = await paths.resolveRead(snapshotPath(reference));
  return authenticate(JSON.parse(await readFile(path.realTarget, "utf8")) as RepositoryImpactSnapshot, reference);
}

/** Rebuildable derived cache. The caller must opt into persistence. */
export async function persistRepositoryImpactSnapshot(repositoryRoot: string, snapshot: RepositoryImpactSnapshot): Promise<void> {
  authenticate(snapshot, impactReference(snapshot));
  const paths = await RepositoryPathService.create(repositoryRoot);
  const relativePath = snapshotPath(impactReference(snapshot));
  const initial = await paths.resolveWrite(relativePath);
  await mkdir(dirname(initial.realTarget), { recursive: true });
  const destination = (await paths.resolveWrite(relativePath)).realTarget;
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${canonicalJson(snapshot)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, destination);
}

function eventChanges(before: RepositoryImpactSnapshot, after: RepositoryImpactSnapshot): InvalidationEvent[] {
  const oldInputs = new Map(before.records.flatMap(({ inputs }) => inputs.map((input) => [input.id, input] as const)));
  const newInputs = new Map(after.records.flatMap(({ inputs }) => inputs.map((input) => [input.id, input] as const)));
  const events = unique([...oldInputs.keys(), ...newInputs.keys()]).flatMap((id): InvalidationEvent[] => {
    const oldInput = oldInputs.get(id); const nextInput = newInputs.get(id);
    if (oldInput?.versionHash === nextInput?.versionHash) return [];
    const kind = nextInput?.kind ?? oldInput?.kind;
    return [{ eventKind: kind === "lens" ? "lens-change" : kind === "rule-bundle" ? "membership-change" : kind === "signature-profile" ? "signature-profile-change" : nextInput === undefined ? "removal" : "external-change", subjectId: id, ...(oldInput === undefined ? {} : { oldHash: oldInput.versionHash }), ...(nextInput === undefined ? {} : { newHash: nextInput.versionHash }), graphRevision: 0, stateDigest: after.state }];
  });
  const oldCanonical = new Map(before.canonical.map((entry) => [entry.id, entry]));
  const newCanonical = new Map(after.canonical.map((entry) => [entry.id, entry]));
  for (const id of unique([...oldCanonical.keys(), ...newCanonical.keys()])) {
    const prior = oldCanonical.get(id); const next = newCanonical.get(id);
    if (prior?.versionHash === next?.versionHash) continue;
    events.push({ eventKind: next === undefined ? "removal" : canonicalEventKind(next.kind), subjectId: id, ...(prior === undefined ? {} : { oldHash: prior.versionHash }), ...(next === undefined ? {} : { newHash: next.versionHash }), graphRevision: 0, stateDigest: after.state });
  }
  const currentRecords = new Map(after.records.map((record) => [record.unitId, record]));
  for (const prior of before.records) {
    const current = currentRecords.get(prior.unitId);
    if (current !== undefined && (prior.outputSemanticSignature.profileId !== current.outputSemanticSignature.profileId || prior.outputSemanticSignature.profileVersion !== current.outputSemanticSignature.profileVersion)) events.push({ eventKind: "signature-profile-change", subjectId: prior.outputSemanticSignature.profileId, oldHash: prior.outputSemanticSignature.hash, newHash: current.outputSemanticSignature.hash, graphRevision: 0, stateDigest: after.state });
  }
  return ordered([...new Map(events.map((event) => [canonicalJson(event), event])).values()]);
}

function canonicalEventKind(kind: string): string {
  return kind === "projection-lens" ? "lens-change" : kind === "architecture-decision" || kind === "authority-record" ? "decision-change" : kind === "architecture-concern" ? "concern-resolution" : "concept-change";
}

async function runImpact(before: RepositoryImpactSnapshot, after: RepositoryImpactSnapshot, events: readonly InvalidationEvent[], predicted = false): Promise<InvalidationRunResult[]> {
  const registry = profiles();
  const current = new Map(after.records.map((record) => [record.unitId, record]));
  const rules = new Map([...before.rules, ...after.rules].map((entry) => [`${entry.rule.id}@${entry.rule.version}`, entry.rule]));
  const results: InvalidationRunResult[] = [];
  const baselineIndex = new DerivationIndex(before.records);
  for (const event of events) {
    if (baselineIndex.reverseDependents(event.subjectId).length === 0 && ![...rules.values()].some(({ trigger }) => trigger === event.eventKind)) continue;
    // Each delta reads the same prior proof. One event must not erase another's invalidation.
    const engine = new InvalidationEngine({ derivations: new DerivationIndex(before.records), signatureProfiles: registry, impactRules: new ImpactRuleRegistry([...rules.values()]), impactPort: {
      subjects: async (rule, phase) => {
        const snapshot = phase === "before" ? before : after;
        const entries = snapshot.rules.filter(({ rule: candidate }) => candidate.id === rule.id && candidate.version === rule.version);
        const members = new Set(entries.flatMap(({ memberIds }) => memberIds));
        return snapshot.subjects.filter(({ id }) => members.has(id));
      },
      traverse: async (seeds, rule) => {
        const known = new Set<string>(); const possible = new Set<string>(); const visited = new Set(seeds); let pending = [...seeds];
        const relations = ordered([...new Map([...before.relations, ...after.relations].map((relation) => [relation.id, relation])).values()]);
        const limit = rule.maxDepth ?? 4;
        for (let depth = 0; pending.length > 0 && depth <= limit; depth += 1) {
          const next: string[] = [];
          for (const source of pending) for (const relation of relations) {
            if (rule.relationTypes !== undefined && !rule.relationTypes.includes(relation.type)) continue;
            const target = rule.direction !== "reverse" && relation.fromId === source ? relation.toId : rule.direction !== "forward" && relation.toId === source ? relation.fromId : undefined;
            if (target === undefined || visited.has(target)) continue;
            visited.add(target);
            // Declared or inferred relations are impact-rule evidence, never exact derivation inputs.
            if (depth === limit || relation.sourceClass === "inferred" || relation.confidence < (rule.requiredRelationConfidence ?? 1)) possible.add(target);
            else { known.add(target); next.push(target); }
          }
          pending = next;
        }
        return { knownIds: [...known], possibleIds: [...possible], unavailableIds: [], observability: possible.size > 0 ? "open" : "bounded", reasons: Object.fromEntries([...known, ...possible].map((id) => [id, [`Active Impact Rule ${rule.id}; relation evidence remains separate from derivations`]])) };
      },
    } });
    results.push(await engine.invalidate(event, { stateBinding: createStateBinding({ compiledAgainst: after.state, valueDependencies: [], queryDependencies: [] }), revalidate: async (ids) => ids.flatMap((id) => {
      const record = current.get(id); if (record === undefined) return [];
      const prior = baselineIndex.get(id);
      // A rule can demand reconsideration for meaning that this byte profile does
      // not observe. Unchanged bytes cannot discharge that semantic obligation.
      if (!predicted && !prior?.inputs.some((input) => input.id === event.subjectId) && event.eventKind !== "signature-profile-change") return [];
      // Prediction cannot establish an after-state proof. Force propagation without pretending byte equality.
      const signature = predicted ? { ...record.outputSemanticSignature, hash: hash({ prediction: event, unitId: id }) } : record.outputSemanticSignature;
      return [{ unitId: id, signature, structuralSignature: record.outputStructuralSignature, inputs: record.inputs, validations: [] }];
    }) }));
  }
  return results;
}

export async function predictRepositoryImpact(snapshot: RepositoryImpactSnapshot, editedPaths: readonly string[], canonicalChanges: readonly { id: string; kind: string }[] = []): Promise<RepositoryImpactReport> {
  const files = snapshot.files.filter(({ path }) => editedPaths.includes(path));
  const events = files.map(({ artifactId, contentHash }): InvalidationEvent => ({ eventKind: "external-change", subjectId: artifactId, oldHash: contentHash, newHash: hash({ proposedEdit: artifactId }), graphRevision: 0, stateDigest: snapshot.state }));
  for (const path of editedPaths.filter((path) => !files.some((file) => file.path === path))) events.push({ eventKind: "external-change", subjectId: `proposed-path:${path}`, newHash: hash({ proposedPath: path }), graphRevision: 0, stateDigest: snapshot.state });
  for (const entry of canonicalChanges) events.push({ eventKind: canonicalEventKind(entry.kind), subjectId: entry.id, newHash: hash({ proposedCanonical: entry }), graphRevision: 0, stateDigest: snapshot.state });
  return report(snapshot, snapshot, await runImpact(snapshot, snapshot, events, true), [], [], "prediction");
}

function changedUnits(before: RepositoryImpactSnapshot, after: RepositoryImpactSnapshot): string[] {
  const oldFiles = new Map(before.files.map((file) => [file.path, file]));
  const newFiles = new Map(after.files.map((file) => [file.path, file]));
  return unique(unique([...oldFiles.keys(), ...newFiles.keys()]).flatMap((path) => {
    const prior = oldFiles.get(path); const current = newFiles.get(path);
    return prior?.contentHash === current?.contentHash ? [] : [...(prior?.unitIds ?? []), ...(current?.unitIds ?? [])];
  }));
}

function report(before: RepositoryImpactReference, after: RepositoryImpactSnapshot, runs: readonly InvalidationRunResult[], predicted: readonly string[], observed: readonly string[], planId: string, unavailable?: string): RepositoryImpactReport {
  const known = unique([...observed, ...runs.flatMap(({ invalidation }) => [...invalidation.directlyAffected, ...invalidation.transitivelyAffected])]);
  const possible = unique([...runs.flatMap(({ invalidation }) => [...invalidation.possibleFrontier, ...invalidation.unavailable]), ...(runs.length > 0 || unavailable !== undefined ? after.possibleUnitIds : []), ...(unavailable === undefined ? [] : after.records.map(({ unitId }) => unitId))]).filter((id) => !known.includes(id));
  const unexpected = observed.filter((id) => !predicted.includes(id));
  const evidenceHash = hash({ before: before.contentHash, after: after.contentHash, predicted, observed });
  const candidateRelations = unexpected.flatMap((toId) => predicted.filter((id) => observed.includes(id)).slice(0, 8).map((fromId) => ({ id: `candidate_relation_${hash({ fromId, toId, evidenceHash }).slice(-32)}`, fromId, toId, sourceClass: "inferred" as const, evidenceHash, explanation: "Co-change outside the predicted boundary suggests investigation; it does not prove dependency or shared meaning." })));
  const surpriseBasis = { planId, kind: "unpredicted-code-impact" as const, predictedEntityIds: [...predicted], observedEntityIds: [...observed], unexpectedEntityIds: unexpected, evidence: [{ evidenceId: `evidence_${evidenceHash.slice(-32)}`, stance: "supports" as const }], explanation: "Observed source changes extend beyond the retained prediction. Review the extra scope and candidate relations before accepting any canonical meaning.", disposition: "unresolved" as const, proposedRelationIds: candidateRelations.map(({ id }) => id) };
  const surpriseHash = hash(surpriseBasis);
  const blockedUnitIds = unique(runs.flatMap(({ blockedUnitIds }) => blockedUnitIds));
  const diagnostics = unique([...(unavailable === undefined ? [] : [unavailable]), ...runs.flatMap(({ diagnostics }) => diagnostics), ...(possible.length === 0 ? [] : after.unknowns)]);
  const basis = { baseline: { version: before.version, contentHash: before.contentHash, state: before.state }, current: impactReference(after), status: unavailable !== undefined ? "unavailable" as const : before.contentHash === after.contentHash ? "current" as const : "changed" as const, predictedUnitIds: unique(predicted), observedChangedUnitIds: unique(observed), knownAffectedUnitIds: known, possibleFrontierUnitIds: possible, backdatedUnitIds: unique(runs.flatMap(({ backdatedUnitIds }) => backdatedUnitIds)).filter((id) => !runs.some(({ invalidation, backdatedUnitIds }) => [...invalidation.directlyAffected, ...invalidation.transitivelyAffected].includes(id) && !backdatedUnitIds.includes(id))), blockedUnitIds, repairRoute: blockedUnitIds.length > 0 ? "human-decision" as const : possible.length > 0 || unexpected.length > 0 || unavailable !== undefined ? "widen-analysis" as const : known.length > 0 ? "revalidate" as const : "reuse" as const, surprises: unexpected.length === 0 ? [] : [{ ...surpriseBasis, id: `planning_surprise_${surpriseHash.slice(-32)}`, contentHash: surpriseHash }], candidateRelations, diagnostics };
  return { ...basis, contentHash: hash(basis) };
}

export async function reconcileRepositoryImpact(before: RepositoryImpactSnapshot, after: RepositoryImpactSnapshot, predictedUnitIds: readonly string[], planId: string, predictedPaths: readonly string[] = []): Promise<RepositoryImpactReport> {
  authenticate(before, impactReference(before)); authenticate(after, impactReference(after));
  const paths = new Set([...predictedPaths, ...before.files.filter(({ unitIds }) => unitIds.some((id) => predictedUnitIds.includes(id))).map(({ path }) => path)]);
  const predicted = unique([...predictedUnitIds, ...after.files.filter(({ path }) => paths.has(path)).flatMap(({ unitIds }) => unitIds)]);
  return report(before, after, await runImpact(before, after, eventChanges(before, after)), predicted, changedUnits(before, after), planId);
}

export async function reconcileRetainedImpact(repositoryRoot: string, reference: RepositoryImpactReference, after: RepositoryImpactSnapshot, predictedUnitIds: readonly string[], contextId: string): Promise<RepositoryImpactReport> {
  let before: RepositoryImpactSnapshot;
  try { before = await readRepositoryImpactSnapshot(repositoryRoot, reference); }
  catch (error) { return report(reference, after, [], predictedUnitIds, [], contextId, `Retained derivation proof unavailable: ${error instanceof Error ? error.message : String(error)}. Capture fresh context to rebuild the current derived snapshot.`); }
  return reconcileRepositoryImpact(before, after, predictedUnitIds, contextId);
}
