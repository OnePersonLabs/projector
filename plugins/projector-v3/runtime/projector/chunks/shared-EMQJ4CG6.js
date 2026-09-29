import {
  executeCodeWorker
} from "./shared-4GV3JCWN.js";
import {
  KnowledgeGraph
} from "./shared-BEDSHOK5.js";
import {
  runObservationTask
} from "./shared-AIE6IGAJ.js";
import {
  RepositoryPathService,
  SqliteCodeStore,
  currentObservationScope,
  readDerivedCacheSource,
  touchDerivedCacheEntry,
  withDerivedCacheAdmission,
  withObservationScope
} from "./shared-QSFRBEBN.js";
import {
  verifyCodeInputBinding
} from "./shared-BGCYVYNK.js";
import {
  DerivationIndex,
  ImpactRuleRegistry,
  InvalidationEngine,
  SemanticSignatureProfileRegistry
} from "./shared-XN3IZTFL.js";
import {
  createStateBinding,
  projectionUnitSelectorSubject
} from "./shared-RMBXVF7C.js";
import {
  CodeImpactResultSchema,
  DerivationRecordSchema,
  DerivedObservationBudget,
  ImpactRuleSchema,
  ObservationDescriptorSchema,
  ObservationError,
  RelationSchema,
  canonicalJson,
  hashFramedDomain,
  observationLimitValue
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/impact/service.js
import { z } from "zod";

// node_modules/@projector/control-plane/dist/observation/read-derived.js
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
async function readDerivedObservationSource(path, label, scope2) {
  const check = () => {
    scope2.signal.throwIfAborted();
    scope2.budget.check("derived-read", label);
  };
  const checkBytes = (size) => {
    if (size > observationLimitValue(scope2.limits.maxDerivedBytes))
      throw new ObservationError("observation-limit-exceeded", "derived-read", label, "Retained derived record exceeds maxDerivedBytes; explicitly increase the allowance or retrieve a smaller context", "maxDerivedBytes", size);
  };
  check();
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink())
    throw new Error("Retained derived record is not a regular file");
  checkBytes(Number(before.size));
  scope2.budget.assertTotalBytes(Number(before.size), label);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size)
      throw new Error("Retained derived record changed while opening");
    const chunks = [];
    let size = 0;
    while (true) {
      check();
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, observationLimitValue(scope2.limits.maxDerivedBytes) - size + 1, scope2.budget.remaining("maxTotalBytes") + 1));
      const { bytesRead } = await handle.read(chunk);
      if (bytesRead === 0)
        break;
      size += bytesRead;
      checkBytes(size);
      scope2.budget.consume("maxTotalBytes", bytesRead, "derived-read", label);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    if (after.size !== before.size || BigInt(size) !== before.size)
      throw new Error("Retained derived record changed while reading");
    check();
    return Buffer.concat(chunks, size).toString("utf8");
  } finally {
    await handle.close();
  }
}

// node_modules/@projector/control-plane/dist/impact/service.js
var version = "repository-impact@3";
var previousVersion = "repository-impact@2";
var legacyVersion = "repository-impact@1";
var profileId = "projector.exact-observed-inputs";
var profileVersion = "2.0.0";
var scope = "Exact source bytes, resolved static dependencies, and governing membership; no runtime behavior equivalence";
var hash = (value) => hashFramedDomain(version, value);
var unique = (values) => [...new Set(values)].sort();
var ordered = (items) => [...items].sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);
var contentHashSchema = z.string().regex(/^sha256:v1:[0-9a-f]{64}$/u);
var stateSchema = z.strictObject({ gitBase: z.string(), worktreeDigest: contentHashSchema, canonicalProjectorDigest: contentHashSchema, toolchainDigest: contentHashSchema, pinnedExternalSnapshotDigest: contentHashSchema.optional() });
var RepositoryImpactReferenceSchema = z.strictObject({ version: z.enum([version, previousVersion, legacyVersion]), contentHash: contentHashSchema, state: stateSchema });
var snapshotFields = {
  contentHash: contentHashSchema,
  state: stateSchema,
  records: z.array(DerivationRecordSchema),
  files: z.array(z.strictObject({ path: z.string(), artifactId: z.string(), contentHash: contentHashSchema, unitIds: z.array(z.string()) })),
  canonical: z.array(z.strictObject({ id: z.string(), kind: z.string(), versionHash: contentHashSchema })),
  subjects: z.array(z.strictObject({ id: z.string(), values: z.record(z.string(), z.unknown()), dependencyKeys: z.array(z.string()) })),
  rules: z.array(z.strictObject({ lensId: z.string(), memberIds: z.array(z.string()), rule: ImpactRuleSchema })),
  relations: z.array(RelationSchema),
  possibleUnitIds: z.array(z.string()),
  unknowns: z.array(z.string())
};
var snapshotSchema = z.discriminatedUnion("version", [
  z.strictObject({ ...snapshotFields, version: z.literal(version), observationDescriptor: ObservationDescriptorSchema, codeGeneration: z.string().min(1).max(256).optional() }),
  z.strictObject({ ...snapshotFields, version: z.literal(previousVersion), observationDescriptor: ObservationDescriptorSchema }),
  z.strictObject({ ...snapshotFields, version: z.literal(legacyVersion) })
]);
var RepositoryImpactReportSchema = z.strictObject({
  baseline: RepositoryImpactReferenceSchema,
  current: RepositoryImpactReferenceSchema,
  status: z.enum(["current", "changed", "unavailable"]),
  predictedUnitIds: z.array(z.string()),
  observedChangedUnitIds: z.array(z.string()),
  knownAffectedUnitIds: z.array(z.string()),
  possibleFrontierUnitIds: z.array(z.string()),
  backdatedUnitIds: z.array(z.string()),
  blockedUnitIds: z.array(z.string()),
  repairRoute: z.enum(["reuse", "revalidate", "widen-analysis", "human-decision"]),
  surprises: z.array(z.strictObject({ id: z.string(), planId: z.string(), kind: z.literal("unpredicted-code-impact"), predictedEntityIds: z.array(z.string()), observedEntityIds: z.array(z.string()), unexpectedEntityIds: z.array(z.string()), evidence: z.array(z.strictObject({ evidenceId: z.string(), stance: z.literal("supports") })), explanation: z.string(), disposition: z.literal("unresolved"), proposedRelationIds: z.array(z.string()), contentHash: contentHashSchema })),
  candidateRelations: z.array(z.strictObject({ id: z.string(), fromId: z.string(), toId: z.string(), sourceClass: z.literal("inferred"), evidenceHash: contentHashSchema, explanation: z.string() })),
  diagnostics: z.array(z.string()),
  contentHash: contentHashSchema
});
function profiles() {
  const registry = new SemanticSignatureProfileRegistry();
  registry.register({ id: profileId, version: profileVersion, scope, normalization: "Canonical serialization of complete observed input hashes; source bytes are not normalized", ignoredDifferences: [], adapterId: version, adapterVersion: profileVersion, maximumAssurance: "exact", assuranceEvidence: ["Byte content hashes and resolved static import facts from the no-exec repository observation"], unsupportedConstructs: ["runtime semantic equivalence", "dynamic dependency resolution", "external side effects"], normalize: (value) => value });
  return registry;
}
function impactReference(snapshot) {
  return { version: snapshot.version, contentHash: snapshot.contentHash, state: snapshot.state };
}
async function verifiedCurrentCodeGeneration(repositoryRoot, state) {
  const store = await SqliteCodeStore.open(repositoryRoot);
  try {
    const generation = store.head();
    const manifest = generation === null ? void 0 : store.manifest(generation);
    if (manifest?.binding.status !== "verified" || manifest.binding.worktreeDigest !== state.worktreeDigest || !verifyCodeInputBinding(manifest.binding, repositoryRoot))
      return void 0;
    return generation;
  } finally {
    store.close();
  }
}
function repositoryImpactProofHash(snapshot, prediction) {
  const selected = /* @__PURE__ */ new Set([...prediction.knownAffectedUnitIds, ...prediction.possibleFrontierUnitIds, ...prediction.blockedUnitIds]);
  return hashFramedDomain("repository-plan-derivation-impact", {
    version: snapshot.version,
    ...snapshot.observationDescriptor === void 0 ? {} : { observationCoverage: comparisonCoverage(snapshot.observationDescriptor) },
    records: snapshot.records.filter(({ unitId }) => selected.has(unitId)),
    rules: snapshot.rules,
    relations: snapshot.rules.length === 0 ? [] : snapshot.relations.filter(({ fromId, toId }) => selected.has(fromId) || selected.has(toId)),
    knownAffectedUnitIds: prediction.knownAffectedUnitIds,
    possibleFrontierUnitIds: prediction.possibleFrontierUnitIds,
    blockedUnitIds: prediction.blockedUnitIds,
    diagnostics: prediction.diagnostics
  });
}
function buildRepositoryImpactSnapshot(observation, graph = new KnowledgeGraph(observation), codeGeneration) {
  const registry = profiles();
  const analysis = observation.analysis;
  const budget = graph.derivedBudget;
  const unitsByArtifact = /* @__PURE__ */ new Map();
  for (const unit of graph.units) {
    budget.reserve(128 + 2 * unit.id.length, "impact-file-unit", unit.id);
    const ids = unitsByArtifact.get(unit.artifactId) ?? [];
    ids.push(unit.id);
    unitsByArtifact.set(unit.artifactId, ids);
  }
  const files = [...analysis.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map((file) => {
    budget.reserve(256 + 2 * (file.path.length + file.artifactId.length), "impact-file", file.path);
    return { path: file.path, artifactId: file.artifactId, contentHash: file.contentHash, unitIds: unique(unitsByArtifact.get(file.artifactId) ?? []) };
  });
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const filesByArtifact = new Map(files.map((file) => [file.artifactId, file]));
  const possible = /* @__PURE__ */ new Set();
  const unknowns = /* @__PURE__ */ new Set();
  const activeLenses = graph.lenses.filter(({ status }) => status === "active");
  if (graph.lensCompilationUnknown !== void 0) {
    unknowns.add(graph.lensCompilationUnknown);
    graph.units.forEach(({ id }) => possible.add(id));
  }
  for (const failure of analysis.failures) {
    if (!failure.affectedClaimKinds.some((kind) => !kind.startsWith("git-") && kind !== "move-lineage"))
      continue;
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
  const records = [];
  const dependenciesByPath = /* @__PURE__ */ new Map();
  for (const dependency of analysis.dependencies) {
    const entries = dependenciesByPath.get(dependency.importerPath) ?? [];
    entries.push(dependency);
    dependenciesByPath.set(dependency.importerPath, entries);
  }
  for (const unit of graph.units) {
    const file = filesByArtifact.get(unit.artifactId);
    if (file === void 0) {
      possible.add(unit.id);
      unknowns.add(`No observed source bytes for ${unit.id}`);
      continue;
    }
    budget.reserve(1024 + 2 * unit.id.length, "impact-record", unit.id);
    const lenses = activeLenses.filter(({ id }) => graph.lensCompilation?.memberships[id]?.includes(unit.id));
    const membershipHash = hash(lenses.map(({ id }) => ({ id, fingerprint: graph.lensCompilation?.membershipFingerprints[id] ?? null })));
    const ruleBundleHash = hash(lenses.map(({ id, semanticHash, rules, impactRules }) => ({ id, semanticHash, rules, impactRules })));
    budget.reserveItems(5, 512 + 2 * (file.artifactId.length + unit.id.length), "impact-input", unit.id);
    const inputs = [
      { kind: "artifact", id: file.artifactId, versionHash: file.contentHash, role: "exact own source bytes" },
      { kind: "toolchain", id: "repository-toolchain", versionHash: observation.state.toolchainDigest, role: "observing adapter versions" },
      { kind: "signature-profile", id: profileId, versionHash: hash({ profileId, profileVersion, scope }), role: "exact observed input profile" },
      { kind: "rule-bundle", id: `observed-rules:${unit.id}`, versionHash: ruleBundleHash, role: "applicable rules" },
      { kind: "rule-bundle", id: `observed-membership:${unit.id}`, versionHash: membershipHash, role: "applicable lens selector membership" }
    ];
    for (const lens of lenses) {
      budget.reserve(512 + 2 * lens.id.length, "impact-input", unit.id);
      inputs.push({ kind: "lens", id: lens.id, versionHash: lens.semanticHash, role: "applicable active lens" });
    }
    for (const dependency of dependenciesByPath.get(file.path) ?? []) {
      const target = dependency.resolvedPath === void 0 ? void 0 : filesByPath.get(dependency.resolvedPath);
      if (target === void 0 || target.unitIds.length === 0) {
        possible.add(unit.id);
        unknowns.add(`Unresolved dependency ${file.path}: ${dependency.specifier}`);
        continue;
      }
      for (const id of target.unitIds) {
        budget.reserve(512 + 2 * (id.length + dependency.specifier.length), "impact-input", unit.id);
        inputs.push({ kind: "unit", id, versionHash: target.contentHash, role: `resolved static import ${dependency.specifier}` });
      }
    }
    const normalizedInputs = ordered([...new Map(inputs.map((input) => [`${input.kind}\0${input.id}\0${input.role}`, input])).values()]);
    const signature = registry.sign(profileId, profileVersion, { inputs: normalizedInputs, membershipHash, ruleBundleHash }, { assurance: "exact", evidenceIds: [file.artifactId] });
    records.push({ unitId: unit.id, engineVersion: profileVersion, adapterVersion: analysis.capabilities.map(({ analyzerId, adapterVersion }) => `${analyzerId}@${adapterVersion}`).sort().join(","), inputs: normalizedInputs, ruleBundleHash, outputSemanticSignature: signature, outputStructuralSignature: signature, membershipHash, establishedAt: "1970-01-01T00:00:00.000Z", validators: [] });
  }
  const basis = {
    version,
    observationDescriptor: ObservationDescriptorSchema.parse(analysis.observationDescriptor),
    ...codeGeneration === void 0 ? {} : { codeGeneration },
    state: observation.state,
    records: new DerivationIndex(records).records(),
    files,
    canonical: observation.canonical.documents.map(({ id, kind, semanticHash, canonicalDocumentHash }) => ({ id, kind, versionHash: semanticHash ?? canonicalDocumentHash })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    subjects: graph.units.map((unit) => projectionUnitSelectorSubject(unit, { path: filesByArtifact.get(unit.artifactId)?.path ?? unit.key, surface: analysis.surface.kind })),
    rules: activeLenses.flatMap((lens) => lens.impactRules.map((rule) => ({ lensId: lens.id, memberIds: graph.lensCompilation?.memberships[lens.id] ?? [], rule }))),
    relations: graph.relations,
    possibleUnitIds: unique([...possible]),
    unknowns: unique([...unknowns])
  };
  return { ...basis, contentHash: hash(basis) };
}
function authenticate(value, reference) {
  const snapshot = snapshotSchema.parse(value);
  const { contentHash, ...basis } = snapshot;
  if (snapshot.version !== reference.version || contentHash !== reference.contentHash || hashFramedDomain(snapshot.version, basis) !== contentHash || canonicalJson(snapshot.state) !== canonicalJson(reference.state))
    throw new Error("Derived impact snapshot failed content, version, or state authentication");
  if (canonicalJson(new DerivationIndex(snapshot.records).records()) !== canonicalJson(snapshot.records))
    throw new Error("Derived impact records are not normalized");
  return snapshot;
}
function authenticateRepositoryImpactSnapshot(value) {
  const reference = RepositoryImpactReferenceSchema.parse(typeof value === "object" && value !== null ? { version: Reflect.get(value, "version"), contentHash: Reflect.get(value, "contentHash"), state: Reflect.get(value, "state") } : value);
  return authenticate(value, reference);
}
var snapshotPath = (reference) => {
  RepositoryImpactReferenceSchema.parse(reference);
  return `.projector/runtime/impact/${reference.contentHash.slice("sha256:v1:".length)}.json`;
};
async function readRepositoryImpactSnapshot(repositoryRoot, reference, touch = true) {
  return withObservationScope({}, async (scope2) => {
    let source = await readDerivedCacheSource(repositoryRoot, snapshotPath(reference), scope2);
    if (source === void 0) {
      const paths = await RepositoryPathService.create(repositoryRoot);
      const path = await paths.resolveRead(snapshotPath(reference));
      source = await readDerivedObservationSource(path.realTarget, reference.contentHash, scope2);
    }
    const snapshot = await runObservationTask("authenticate-impact", { source, reference }, scope2);
    scope2.signal.throwIfAborted();
    scope2.budget.check("impact-authentication");
    if (touch)
      await touchDerivedCacheEntry(repositoryRoot, snapshotPath(reference));
    return snapshot;
  });
}
function authenticateRepositoryImpactSource(source, reference) {
  return authenticate(JSON.parse(source), reference);
}
function impactSnapshotWrite(snapshot) {
  authenticate(snapshot, impactReference(snapshot));
  if (snapshot.version !== version)
    throw new Error("Legacy impact proofs cannot be published as current observation snapshots; capture fresh context.");
  return { relativePath: snapshotPath(impactReference(snapshot)), content: `${canonicalJson(snapshot)}
` };
}
async function persistRepositoryImpactSnapshot(repositoryRoot, snapshot, session) {
  const write = impactSnapshotWrite(snapshot);
  if (snapshot.codeGeneration !== void 0) {
    const store = await SqliteCodeStore.open(repositoryRoot);
    try {
      store.pinRetained(snapshot.codeGeneration, snapshot.contentHash);
    } finally {
      store.close();
    }
  }
  if (session !== void 0)
    await session.publishAll([write]);
  else
    await withDerivedCacheAdmission(repositoryRoot, (admission) => admission.publishAll([write]));
}
function eventChanges(before, after) {
  const oldInputs = new Map(before.records.flatMap(({ inputs }) => inputs.map((input) => [input.id, input])));
  const newInputs = new Map(after.records.flatMap(({ inputs }) => inputs.map((input) => [input.id, input])));
  const events = unique([...oldInputs.keys(), ...newInputs.keys()]).flatMap((id) => {
    const oldInput = oldInputs.get(id);
    const nextInput = newInputs.get(id);
    if (oldInput?.versionHash === nextInput?.versionHash)
      return [];
    const kind = nextInput?.kind ?? oldInput?.kind;
    return [{ eventKind: kind === "lens" ? "lens-change" : kind === "rule-bundle" ? "membership-change" : kind === "signature-profile" ? "signature-profile-change" : nextInput === void 0 ? "removal" : "external-change", subjectId: id, ...oldInput === void 0 ? {} : { oldHash: oldInput.versionHash }, ...nextInput === void 0 ? {} : { newHash: nextInput.versionHash }, graphRevision: 0, stateDigest: after.state }];
  });
  const oldCanonical = new Map(before.canonical.map((entry) => [entry.id, entry]));
  const newCanonical = new Map(after.canonical.map((entry) => [entry.id, entry]));
  for (const id of unique([...oldCanonical.keys(), ...newCanonical.keys()])) {
    const prior = oldCanonical.get(id);
    const next = newCanonical.get(id);
    if (prior?.versionHash === next?.versionHash)
      continue;
    events.push({ eventKind: next === void 0 ? "removal" : canonicalEventKind(next.kind), subjectId: id, ...prior === void 0 ? {} : { oldHash: prior.versionHash }, ...next === void 0 ? {} : { newHash: next.versionHash }, graphRevision: 0, stateDigest: after.state });
  }
  const currentRecords = new Map(after.records.map((record) => [record.unitId, record]));
  for (const prior of before.records) {
    const current = currentRecords.get(prior.unitId);
    if (current !== void 0 && (prior.outputSemanticSignature.profileId !== current.outputSemanticSignature.profileId || prior.outputSemanticSignature.profileVersion !== current.outputSemanticSignature.profileVersion))
      events.push({ eventKind: "signature-profile-change", subjectId: prior.outputSemanticSignature.profileId, oldHash: prior.outputSemanticSignature.hash, newHash: current.outputSemanticSignature.hash, graphRevision: 0, stateDigest: after.state });
  }
  return ordered([...new Map(events.map((event) => [canonicalJson(event), event])).values()]);
}
function canonicalEventKind(kind) {
  return kind === "projection-lens" ? "lens-change" : kind === "architecture-decision" || kind === "authority-record" ? "decision-change" : kind === "architecture-concern" ? "concern-resolution" : "concept-change";
}
async function runImpact(before, after, events, predicted = false, budget = new DerivedObservationBudget(after.observationDescriptor?.limits.maxDerivedBytes)) {
  const registry = profiles();
  const current = new Map(after.records.map((record) => [record.unitId, record]));
  const rules = new Map([...before.rules, ...after.rules].map((entry) => [`${entry.rule.id}@${entry.rule.version}`, entry.rule]));
  const affected = /* @__PURE__ */ new Set();
  const possible = /* @__PURE__ */ new Set();
  const unavailable = /* @__PURE__ */ new Set();
  const backdated = /* @__PURE__ */ new Set();
  const nonBackdated = /* @__PURE__ */ new Set();
  const blocked = /* @__PURE__ */ new Set();
  const diagnostics = /* @__PURE__ */ new Set();
  let runCount = 0;
  const retain = (target, values) => {
    for (const value of values) {
      if (target.has(value))
        continue;
      budget.reserve(192 + 4 * value.length, "impact-event-summary");
      target.add(value);
    }
  };
  const baselineIndex = new DerivationIndex(before.records);
  const activeRules = [...rules.values()];
  const relations = ordered([...new Map([...before.relations, ...after.relations].map((relation) => [relation.id, relation])).values()]);
  const engine = new InvalidationEngine({ derivations: baselineIndex, signatureProfiles: registry, impactRules: new ImpactRuleRegistry(activeRules), impactPort: {
    subjects: async (rule, phase) => {
      const snapshot = phase === "before" ? before : after;
      const members = /* @__PURE__ */ new Set();
      for (const entry of snapshot.rules) {
        if (entry.rule.id !== rule.id || entry.rule.version !== rule.version)
          continue;
        for (const id of entry.memberIds) {
          if (members.has(id))
            continue;
          budget.reserve(128 + 2 * id.length, "impact-rule-member", rule.id);
          members.add(id);
        }
      }
      const subjects = [];
      for (const subject of snapshot.subjects) {
        if (!members.has(subject.id))
          continue;
        budget.reserve(128 + 2 * subject.id.length, "impact-rule-subject", rule.id);
        subjects.push(subject);
      }
      return subjects;
    },
    traverse: async (seeds, rule) => {
      const known = /* @__PURE__ */ new Set();
      const possible2 = /* @__PURE__ */ new Set();
      const visited = /* @__PURE__ */ new Set();
      for (const id of seeds) {
        if (visited.has(id))
          continue;
        budget.reserve(192 + 2 * id.length, "impact-rule-traversal", rule.id);
        visited.add(id);
      }
      budget.reserveItems(seeds.length, 16, "impact-rule-traversal", rule.id);
      let pending = [...seeds];
      const limit = rule.maxDepth ?? 4;
      for (let depth = 0; pending.length > 0 && depth <= limit; depth += 1) {
        const next = [];
        for (const source of pending)
          for (const relation of relations) {
            if (rule.relationTypes !== void 0 && !rule.relationTypes.includes(relation.type))
              continue;
            const target = rule.direction !== "reverse" && relation.fromId === source ? relation.toId : rule.direction !== "forward" && relation.toId === source ? relation.fromId : void 0;
            if (target === void 0 || visited.has(target))
              continue;
            budget.reserve(768 + 4 * (target.length + rule.id.length), "impact-rule-traversal", rule.id);
            visited.add(target);
            if (depth === limit || relation.sourceClass === "inferred" || relation.confidence < (rule.requiredRelationConfidence ?? 1))
              possible2.add(target);
            else {
              known.add(target);
              next.push(target);
            }
          }
        pending = next;
      }
      return { knownIds: [...known], possibleIds: [...possible2], unavailableIds: [], observability: possible2.size > 0 ? "open" : "bounded", reasons: Object.fromEntries([...known, ...possible2].map((id) => [id, [`Active Impact Rule ${rule.id}; relation evidence remains separate from derivations`]])) };
    }
  } });
  for (const event of events) {
    if (baselineIndex.reverseDependents(event.subjectId).length === 0 && !activeRules.some(({ trigger }) => trigger === event.eventKind))
      continue;
    const beforeRunBytes = budget.usedBytes;
    const result = await engine.invalidate(event, { derivedBudget: budget, preserveDerivations: true, stateBinding: createStateBinding({ compiledAgainst: after.state, valueDependencies: [], queryDependencies: [] }), revalidate: async (ids) => ids.flatMap((id) => {
      const record = current.get(id);
      if (record === void 0)
        return [];
      const prior = baselineIndex.get(id);
      if (!predicted && !prior?.inputs.some((input) => input.id === event.subjectId) && event.eventKind !== "signature-profile-change")
        return [];
      const signature = predicted ? { ...record.outputSemanticSignature, hash: hash({ prediction: event, unitId: id }) } : record.outputSemanticSignature;
      return [{ unitId: id, signature, structuralSignature: record.outputStructuralSignature, inputs: record.inputs, validations: [] }];
    }) });
    const runBytes = budget.usedBytes - beforeRunBytes;
    const changed = [...result.invalidation.directlyAffected, ...result.invalidation.transitivelyAffected];
    retain(affected, changed);
    retain(possible, result.invalidation.possibleFrontier);
    retain(unavailable, result.invalidation.unavailable);
    retain(backdated, result.backdatedUnitIds);
    retain(nonBackdated, changed.filter((id) => !result.backdatedUnitIds.includes(id)));
    retain(blocked, result.blockedUnitIds);
    retain(diagnostics, result.diagnostics);
    runCount += 1;
    budget.release(runBytes);
  }
  return runCount === 0 ? [] : [{
    invalidation: { directlyAffected: [...affected], transitivelyAffected: [], possibleFrontier: [...possible], unavailable: [...unavailable], reasons: {} },
    backdatedUnitIds: [...backdated].filter((id) => !nonBackdated.has(id)),
    blockedUnitIds: [...blocked],
    diagnostics: [...diagnostics],
    validUnitIds: [],
    revalidatedRecords: [],
    blocked: []
  }];
}
async function predictRepositoryImpact(snapshot, editedPaths, canonicalChanges = [], derivedBudget) {
  authenticate(snapshot, impactReference(snapshot));
  const unavailable = comparisonUnavailable(snapshot, snapshot);
  if (unavailable !== void 0)
    return report(snapshot, snapshot, [], [], [], "prediction", unavailable);
  const files = snapshot.files.filter(({ path }) => editedPaths.includes(path));
  const events = files.map(({ artifactId, contentHash }) => ({ eventKind: "external-change", subjectId: artifactId, oldHash: contentHash, newHash: hash({ proposedEdit: artifactId }), graphRevision: 0, stateDigest: snapshot.state }));
  for (const path of editedPaths.filter((path2) => !files.some((file) => file.path === path2)))
    events.push({ eventKind: "external-change", subjectId: `proposed-path:${path}`, newHash: hash({ proposedPath: path }), graphRevision: 0, stateDigest: snapshot.state });
  for (const entry of canonicalChanges)
    events.push({ eventKind: canonicalEventKind(entry.kind), subjectId: entry.id, newHash: hash({ proposedCanonical: entry }), graphRevision: 0, stateDigest: snapshot.state });
  return report(snapshot, snapshot, await runImpact(snapshot, snapshot, events, true, derivedBudget), [], [], "prediction");
}
function changedUnits(before, after) {
  const oldFiles = new Map(before.files.map((file) => [file.path, file]));
  const newFiles = new Map(after.files.map((file) => [file.path, file]));
  return unique(unique([...oldFiles.keys(), ...newFiles.keys()]).flatMap((path) => {
    const prior = oldFiles.get(path);
    const current = newFiles.get(path);
    return prior?.contentHash === current?.contentHash ? [] : [...prior?.unitIds ?? [], ...current?.unitIds ?? []];
  }));
}
function report(before, after, runs, predicted, observed, planId, unavailable, hasPrediction = true, semantic) {
  const semanticUnits = (paths) => unique(after.files.filter(({ path }) => paths.includes(path)).flatMap(({ unitIds }) => unitIds));
  const semanticKnownPaths = (semantic?.affectedPaths ?? []).filter((path) => !semantic?.possiblePaths.includes(path));
  const known = unique([...observed, ...runs.flatMap(({ invalidation }) => [...invalidation.directlyAffected, ...invalidation.transitivelyAffected]), ...semanticUnits(semanticKnownPaths)]);
  const possible = unique([...runs.flatMap(({ invalidation }) => [...invalidation.possibleFrontier, ...invalidation.unavailable]), ...runs.length > 0 || unavailable !== void 0 ? after.possibleUnitIds : [], ...unavailable === void 0 || semantic?.truncated !== true ? [] : after.records.map(({ unitId }) => unitId), ...semanticUnits(semantic?.possiblePaths ?? [])]).filter((id) => !known.includes(id));
  const unexpected = hasPrediction ? observed.filter((id) => !predicted.includes(id)) : [];
  const evidenceHash = hash({ before: before.contentHash, after: after.contentHash, predicted, observed });
  const candidateRelations = unexpected.flatMap((toId) => predicted.filter((id) => observed.includes(id)).slice(0, 8).map((fromId) => ({ id: `candidate_relation_${hash({ fromId, toId, evidenceHash }).slice(-32)}`, fromId, toId, sourceClass: "inferred", evidenceHash, explanation: "Co-change outside the predicted boundary suggests investigation; it does not prove dependency or shared meaning." })));
  const surpriseBasis = { planId, kind: "unpredicted-code-impact", predictedEntityIds: [...predicted], observedEntityIds: [...observed], unexpectedEntityIds: unexpected, evidence: [{ evidenceId: `evidence_${evidenceHash.slice(-32)}`, stance: "supports" }], explanation: "Observed source changes extend beyond the retained prediction. Review the extra scope and candidate relations before accepting any canonical meaning.", disposition: "unresolved", proposedRelationIds: candidateRelations.map(({ id }) => id) };
  const surpriseHash = hash(surpriseBasis);
  const blockedUnitIds = unique(runs.flatMap(({ blockedUnitIds: blockedUnitIds2 }) => blockedUnitIds2));
  const diagnostics = unique([...unavailable === void 0 ? [] : [unavailable], ...runs.flatMap(({ diagnostics: diagnostics2 }) => diagnostics2), ...possible.length === 0 ? [] : after.unknowns, ...semantic?.unknowns ?? []]);
  const basis = { baseline: { version: before.version, contentHash: before.contentHash, state: before.state }, current: impactReference(after), status: unavailable !== void 0 ? "unavailable" : before.contentHash === after.contentHash ? "current" : "changed", predictedUnitIds: unique(predicted), observedChangedUnitIds: unique(observed), knownAffectedUnitIds: known, possibleFrontierUnitIds: possible, backdatedUnitIds: unique(runs.flatMap(({ backdatedUnitIds }) => backdatedUnitIds)).filter((id) => !runs.some(({ invalidation, backdatedUnitIds }) => [...invalidation.directlyAffected, ...invalidation.transitivelyAffected].includes(id) && !backdatedUnitIds.includes(id))), blockedUnitIds, repairRoute: blockedUnitIds.length > 0 ? "human-decision" : possible.length > 0 || unexpected.length > 0 || unavailable !== void 0 ? "widen-analysis" : known.length > 0 ? "revalidate" : "reuse", surprises: unexpected.length === 0 ? [] : [{ ...surpriseBasis, id: `planning_surprise_${surpriseHash.slice(-32)}`, contentHash: surpriseHash }], candidateRelations, diagnostics };
  return { ...basis, contentHash: hash(basis) };
}
async function reconcileRepositoryImpact(before, after, predictedUnitIds, planId, predictedPaths = [], hasPrediction = true, derivedBudget, semantic) {
  authenticate(before, impactReference(before));
  authenticate(after, impactReference(after));
  const unavailable = comparisonUnavailable(before, after);
  if (unavailable !== void 0)
    return report(before, after, [], predictedUnitIds, [], planId, unavailable, hasPrediction);
  const paths = /* @__PURE__ */ new Set([...predictedPaths, ...before.files.filter(({ unitIds }) => unitIds.some((id) => predictedUnitIds.includes(id))).map(({ path }) => path)]);
  const predicted = unique([...predictedUnitIds, ...after.files.filter(({ path }) => paths.has(path)).flatMap(({ unitIds }) => unitIds)]);
  if (semantic !== void 0 && (semantic.before !== before.codeGeneration || semantic.after !== after.codeGeneration))
    throw new Error("Semantic impact generations do not match the authenticated repository snapshots");
  return report(before, after, await runImpact(before, after, eventChanges(before, after), false, derivedBudget), predicted, changedUnits(before, after), planId, void 0, hasPrediction, semantic);
}
function comparisonUnavailable(before, after) {
  if (before.observationDescriptor === void 0 || after.observationDescriptor === void 0) {
    return "Retained observation coverage is unavailable for this legacy proof. Capture fresh context before comparing repository changes.";
  }
  const beforeCoverage = comparisonCoverage(before.observationDescriptor);
  const afterCoverage = comparisonCoverage(after.observationDescriptor);
  if (canonicalJson(beforeCoverage) !== canonicalJson(afterCoverage)) {
    return "Repository observation scope or analysis method changed, including effective exclusion rules. Capture fresh context; omitted files are not established removals.";
  }
  return void 0;
}
function comparisonCoverage(descriptor) {
  const { limits: _limits, ...coverage } = descriptor;
  return coverage;
}
async function reconcileRetainedImpact(repositoryRoot, reference, after, predictedUnitIds, contextId, hasPrediction = true, readSnapshot = readRepositoryImpactSnapshot, derivedBudget) {
  let before;
  try {
    before = authenticate(await readSnapshot(repositoryRoot, reference), reference);
  } catch (error) {
    if (error instanceof ObservationError || error instanceof Error && error.name === "AbortError")
      throw error;
    return report(reference, after, [], predictedUnitIds, [], contextId, `Retained derivation proof unavailable: ${error instanceof Error ? error.message : String(error)}. Capture fresh context to rebuild the current derived snapshot.`);
  }
  let semantic;
  if (before.codeGeneration !== void 0 && after.codeGeneration !== void 0) {
    if (await verifiedCurrentCodeGeneration(repositoryRoot, after.state) !== after.codeGeneration)
      throw new Error("Current semantic generation does not match the authenticated impact snapshot");
    semantic = CodeImpactResultSchema.parse(await executeCodeWorker({ repositoryRoot, operation: "code.impact", input: { before: before.codeGeneration, after: after.codeGeneration } }, currentObservationScope()?.deadline ?? Number.POSITIVE_INFINITY));
  }
  return reconcileRepositoryImpact(before, after, predictedUnitIds, contextId, [], hasPrediction, derivedBudget, semantic);
}

export {
  readDerivedObservationSource,
  RepositoryImpactReferenceSchema,
  RepositoryImpactReportSchema,
  impactReference,
  verifiedCurrentCodeGeneration,
  repositoryImpactProofHash,
  buildRepositoryImpactSnapshot,
  authenticateRepositoryImpactSnapshot,
  readRepositoryImpactSnapshot,
  authenticateRepositoryImpactSource,
  impactSnapshotWrite,
  persistRepositoryImpactSnapshot,
  predictRepositoryImpact,
  reconcileRepositoryImpact,
  reconcileRetainedImpact
};
