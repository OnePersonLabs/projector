import {
  ChangeLifecycleStore
} from "./shared-IYQMR2PN.js";
import {
  reverseDerivationManifestKey,
  safeRealizationCandidateIds,
  sourceRecords,
  summarizeColdObservation
} from "./shared-4Z373ACI.js";
import {
  governanceManifestNodeKey
} from "./shared-K6T6H2O7.js";
import {
  KNOWLEDGE_API_VERSION,
  KnowledgeApplicationEvidenceAssessmentSchema,
  KnowledgeContextResultSchema,
  KnowledgeContextStore,
  KnowledgeDecisionValiditySchema,
  KnowledgeInterpretationCandidateSchema,
  KnowledgeLensObligationSchema,
  KnowledgeReconciliationResultSchema,
  applicationEvidenceDependencies,
  applicationEvidenceDisposition,
  assessKnowledgeApplicationEvidence,
  finalizeKnowledgeContext,
  governanceEvaluationSchema,
  knowledgeContextWrite
} from "./shared-5KKVMNK4.js";
import {
  buildRepositoryImpactSnapshot,
  persistRepositoryImpactSnapshot,
  readRepositoryImpactSnapshot,
  reconcileRetainedImpact,
  repositoryImpactProofHash
} from "./shared-WTUCTIQX.js";
import {
  WatchmanSynchronizationUnavailableError,
  captureIndependentValidator,
  enrollWatchman,
  filterSourceWatchmanEvents,
  observeChangeRepository,
  observeRepositoryState,
  observeWatchmanChanges,
  realizeChangeRepositoryData,
  verifyWatchmanChanges
} from "./shared-VSXA2WT5.js";
import {
  CHANGE_QUERY_PROGRAM_IDS,
  createChangeQueryRegistry,
  exactIdentityCandidates
} from "./shared-SRZY32OS.js";
import {
  KnowledgeGraph,
  assessKnowledgeDecisions,
  knowledgeGovernanceStatus
} from "./shared-2A7U2BFL.js";
import {
  DecisionBaselineReader,
  captureDecisionBaselines,
  captureDecisionTriggerObservations,
  triggerSubjectId
} from "./shared-VLNOT24G.js";
import {
  runObservationTask
} from "./shared-FFVGFO5N.js";
import {
  ArtifactSetIncompleteError,
  CanonicalFileRepository,
  DurableArtifactSetStore,
  ExactTextPatchTransform,
  FileTransactionJournal,
  GovernedWorktreeRuntime,
  NativeProcessLauncher,
  RepositoryPathService,
  SqliteObservationSourceCapture,
  SqliteObservationStore,
  WriterLeaseManager,
  canonicalApiVersion,
  canonicalSchemaVersion,
  checkoutCacheLocation,
  collectCanonicalSnapshotSources,
  configuredHostAssumptions,
  currentObservationScope,
  withDerivedCacheAdmission,
  withObservationScope
} from "./shared-GXAKKSCS.js";
import {
  collectGitFacts,
  collectGitPathIdentities,
  collectLocalRepositoryInputs,
  detectMechanicalDivergences,
  inventoryEntryBytes,
  inventoryEntryChunks,
  inventoryRepository,
  inventoryRepositoryIdentities,
  localImportCandidates,
  localRepositoryAdapterVersion,
  localSemanticKey,
  observationGit,
  parseGitStatus,
  readInventoryEntry,
  readObservationFile,
  syntaxProgramVersion
} from "./shared-XAKKJSHO.js";
import {
  BUILT_IN_REPRESENTATION_PROFILES,
  RepresentationCompiler,
  StateBoundChangeExecutor,
  canonicalRepresentationSourceFromSemanticChange,
  compileContext,
  compileProjectionLenses,
  compileRelevanceClosure,
  compileSemanticChange,
  currentBuiltInRepresentationProfile,
  executionCapsuleHash,
  executionPlanHash,
  governancePopulationEntry,
  lensMembershipFingerprint,
  publishPreparedStateBoundChangeSuccess,
  summarizeGovernanceManifest
} from "./shared-XN3IZTFL.js";
import {
  discoverArchitectureConcerns,
  runArchitecturePreflight
} from "./shared-EK2KJXX2.js";
import {
  compileSemanticChangePlan
} from "./shared-JRUJSZFM.js";
import {
  DependencyScopedStateBindingValidator,
  assessDecisionDeferral,
  createStateBinding,
  normalizeSelector
} from "./shared-RMBXVF7C.js";
import {
  AnalyzerFailureSchema,
  ArchitectureConcernSchema,
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  BehavioralScenarioSchema,
  CodeContextSummarySchema,
  ConceptSchema,
  ContentHashSchema,
  DerivedObservationBudget,
  DeveloperPreferenceSchema,
  DurableRepresentationArtifactRecordSchema,
  ExecutionCapsuleSchema,
  LineageRecordSchema,
  ObservationError,
  ProjectionLensSchema,
  ProjectorOperationInputSchemas,
  ProjectorOperationRequestSchema,
  RelationSchema,
  RepresentationProjectionRefSchema,
  RepresentationProjectionSchema,
  RequirementSchema,
  StateDependencyObservationSchema,
  StateDigestSchema,
  TombstoneSchema,
  ValidationResultSchema,
  buildManifest,
  canonicalJson,
  createDurableRepresentationArtifactRecord,
  deriveEntityId,
  hashFramedDomain,
  hashSemantic,
  manifestKey,
  normalizeRepositoryRelativePath,
  observationLimitValue,
  parseChangeProposal,
  updateManifest,
  withCanonicalHashes
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/service.js
import { resolve as resolve4 } from "node:path";

// node_modules/@projector/control-plane/dist/change-lifecycle/indexed-observer.js
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { lstat, mkdir, rm } from "node:fs/promises";

// node_modules/@projector/control-plane/dist/observation/indexed-types.js
var INDEXED_OBSERVATION_CONTRACT = "projector-indexed-observation/v1";

// node_modules/@projector/control-plane/dist/knowledge/indexed-delta.js
function enrollIndexedGraphDelta(input) {
  const { descriptor, store, changedObservation: observation } = input;
  if (observation.canonical.rootDigest !== descriptor.metadata.canonicalRootDigest)
    throw new Error("Canonical inputs changed; indexed graph delta requires complete enrollment");
  const generation = descriptor.generation;
  const graph = new KnowledgeGraph(observation, {}, new DerivedObservationBudget(observation.analysis.observationDescriptor.limits.maxDerivedBytes), void 0, input.preparedLensCompilation ?? {});
  const upserts = [];
  const deletes = [];
  const populations = [];
  const paths = /* @__PURE__ */ new Set([...input.changedPaths, ...observation.analysis.files.map(({ path }) => path)]);
  const oldUnits = /* @__PURE__ */ new Map();
  for (const path of paths)
    for (const id of store.populationAt(generation, `unit-path:${path}`)) {
      const unit = store.getAt(generation, "unit", id);
      if (unit === void 0)
        throw new Error(`Prior unit population for ${path} references missing ${id}`);
      oldUnits.set(id, unit);
    }
  const newUnits = new Map(graph.units.map((unit) => [unit.id, unit]));
  const removedIds = [...oldUnits.keys()].filter((id) => !newUnits.has(id));
  for (const id of removedIds)
    for (const kind of ["knowledge-source", "knowledge-values", "knowledge-source-hash", "knowledge-authority-unknowns", "knowledge-topology", "knowledge-bindings"])
      deletes.push({ kind, key: id });
  for (const unit of graph.units) {
    const source = graph.loadSource(unit.id);
    if (source === void 0)
      throw new Error(`Changed graph unit ${unit.id} has no context source`);
    upserts.push({ kind: "knowledge-source", key: unit.id, value: source }, { kind: "knowledge-values", key: unit.id, value: graph.valueDependencies([unit.id]) }, { kind: "knowledge-source-hash", key: unit.id, value: graph.sourceHash(unit.id) }, { kind: "knowledge-authority-unknowns", key: unit.id, value: [] }, { kind: "knowledge-topology", key: unit.id, value: { supported: graph.supportsStaticTopology(unit.id), neighbors: graph.topologyNeighbors(unit.id), boundary: graph.topologyObservationBoundary(unit.id) } }, { kind: "query-dependency-version", key: `projection-unit:${unit.id}`, value: hashFramedDomain("indexed-graph-dependency", unit) });
  }
  const touchedIds = /* @__PURE__ */ new Set([...oldUnits.keys(), ...newUnits.keys()]);
  const touchedSubjects = new Set([...oldUnits.values(), ...newUnits.values()].flatMap((unit) => [...unit.conceptIds, ...unit.requirementIds, ...unit.scenarioIds]));
  if (store.getAt(generation, "population-version", "knowledge-binding-subjects") === void 0)
    throw new Error("Knowledge binding incidence is missing; rebuild the complete observation");
  for (const id of oldUnits.keys())
    for (const subject of store.populationAt(generation, `knowledge-binding-subjects:${id}`))
      touchedSubjects.add(subject);
  for (const entity of graph.entities)
    if (graph.implementationBindings(entity.id).length > 0)
      touchedSubjects.add(entity.id);
  for (const subject of touchedSubjects) {
    const previous = store.getAt(generation, "knowledge-bindings", subject) ?? [];
    const next = [...previous.filter(({ id }) => !touchedIds.has(String(id))), ...graph.implementationBindings(subject)].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    upserts.push({ kind: "knowledge-bindings", key: subject, value: next });
    for (const binding of previous)
      if (touchedIds.has(String(binding.id)))
        populations.push({ selector: `knowledge-binding-subjects:${String(binding.id)}`, member: subject, present: false });
    for (const binding of graph.implementationBindings(subject))
      populations.push({ selector: `knowledge-binding-subjects:${String(binding.id)}`, member: subject, present: true });
  }
  const addresses = new Set([...oldUnits.values(), ...newUnits.values()].flatMap(({ id, key }) => [id, key]));
  for (const path of paths)
    addresses.add(path);
  for (const address of addresses) {
    const selector = `knowledge-unit-address:${address}`;
    const old = store.populationAt(generation, selector);
    const candidates = graph.resolveNamedTargets([address]);
    const remaining = old.filter((id) => !touchedIds.has(id));
    if (remaining.length > 0)
      throw new Error(`Unit identity collision ${address} escaped the complete changed component; rebuild observation`);
    for (const member of old)
      populations.push({ selector, member, present: false });
    const candidate = candidates[0];
    if (candidate === void 0)
      deletes.push({ kind: "knowledge-target", key: address });
    else {
      populations.push({ selector, member: candidate.entityId, present: true });
      upserts.push({ kind: "knowledge-target", key: address, value: candidate });
    }
  }
  const previousUncertainty = store.getAt(generation, "knowledge-global", "uncertain-importers");
  if (previousUncertainty === void 0)
    throw new Error("Complete uncertainty population is missing; rebuild observation");
  const uncertainty = [...previousUncertainty.filter(({ path }) => !paths.has(path)), ...graph.uncertainTopologyImporters()].sort((a, b) => a.id.localeCompare(b.id));
  upserts.push({ kind: "knowledge-global", key: "uncertain-importers", value: uncertainty });
  const facts = { paths: [...paths].sort(), units: graph.units, files: observation.analysis.files, dependencies: observation.analysis.dependencies, testTargets: observation.analysis.testTargets, uncertainty };
  for (const key of ["projection-unit-membership", "repository-module-dependencies", "repository-test-targets", "canonical-realizations"]) {
    const previous = store.getAt(generation, "query-dependency-version", key);
    if (previous === void 0)
      throw new Error(`Query population ${key} has no complete baseline; rebuild observation`);
    upserts.push({ kind: "query-dependency-version", key, value: hashFramedDomain("indexed-graph-delta-witness", { previous, facts }) });
  }
  for (const path of paths)
    upserts.push({ kind: "query-dependency-version", key: `path:${path}`, value: hashFramedDomain("indexed-graph-path-delta", { path, file: observation.analysis.files.find((file) => file.path === path) ?? null, units: graph.units.filter((unit) => unit.key === path) }) });
  store.verifyGeneration(generation);
  return { upserts, deletes, populations };
}

// node_modules/@projector/control-plane/dist/knowledge/indexed-governance-delta.js
var same = (left, right) => canonicalJson(left) === canonicalJson(right);
function updateIndexedGovernanceDelta(input) {
  const { descriptor, store, changedObservation: observation, graph } = input;
  const generation = descriptor.generation;
  const read = (kind, key) => store.getAt(generation, kind, key);
  const required = (kind, key) => {
    const value = read(kind, key);
    if (value === void 0)
      throw new Error(`Indexed governance delta lacks ${kind}:${key}; rebuild the complete observation`);
    return value;
  };
  if (observation.canonical.rootDigest !== descriptor.metadata.canonicalRootDigest)
    throw new Error("Governance configuration changed; rebuild its populations");
  if (required("governance-meta", "lensCompilationUnknown") !== null || graph.lensCompilation === void 0)
    return void 0;
  const upserts = [], deletes = [];
  const put = (kind, key, value) => {
    upserts.push({ kind, key, value });
  };
  const paths = /* @__PURE__ */ new Set([...input.changedPaths, ...observation.analysis.files.map(({ path }) => path)]);
  const oldUnits = /* @__PURE__ */ new Map();
  for (const path of paths)
    for (const id of store.populationAt(generation, `unit-path:${path}`))
      oldUnits.set(id, required("unit", id));
  const newUnits = new Map(graph.units.map((unit) => [unit.id, unit]));
  const ids = [.../* @__PURE__ */ new Set([...oldUnits.keys(), ...newUnits.keys()])].sort();
  const oldSubjects = new Map([...oldUnits.keys()].map((id) => [id, required("governance-subject", id)]));
  const governed = graph.governanceObservation();
  const newSubjects = new Map(governed.subjects.map((subject) => [subject.id, subject]));
  const oldMemberships = new Map([...oldUnits.keys()].map((id) => [id, required("governance-lens-membership", id)]));
  const writeManifest = (kind, id, manifest) => {
    for (const [prefix, node] of manifest.nodes)
      put(kind, governanceManifestNodeKey(id, prefix), node);
    for (const prefix of manifest.removed)
      deletes.push({ kind, key: governanceManifestNodeKey(id, prefix) });
  };
  const membershipFingerprints = { ...graph.lensCompilation.membershipFingerprints };
  for (const lens of graph.lenses) {
    const prior = required("governance-lens-root", lens.id);
    const members = new Set(graph.lensCompilation.memberships[lens.id] ?? []);
    const changes = ids.flatMap((id) => {
      const before = oldMemberships.get(id)?.results.some((member) => member.id === lens.id) ?? false;
      const after = members.has(id);
      return before === after ? [] : [{ key: manifestKey(id), ...after ? { value: id } : {} }];
    });
    if (changes.length === 0) {
      membershipFingerprints[lens.id] = prior.fingerprint;
      continue;
    }
    const manifest = updateManifest(prior.root, changes, (prefix) => read("governance-lens-manifest", governanceManifestNodeKey(lens.id, prefix)));
    membershipFingerprints[lens.id] = lensMembershipFingerprint(lens.id, manifest.root);
    writeManifest("governance-lens-manifest", lens.id, manifest);
    put("governance-lens-root", lens.id, { root: manifest.root, fingerprint: membershipFingerprints[lens.id] });
  }
  const selectors = new Map(graph.lenses.flatMap((lens) => lens.rules.flatMap((rule) => rule.predicates.flatMap((predicate) => predicate.kind === "cardinality" ? [[hashFramedDomain("governance-selector", predicate.selector), predicate.selector]] : []))));
  for (const [key, selector] of selectors) {
    const prior = required("governance-cardinality", key);
    const state = required("governance-cardinality-state", key);
    let known = prior.knownCount, unknown = prior.unknownCount;
    const changes = [];
    for (const id of ids) {
      const before = oldSubjects.get(id), after = newUnits.has(id) ? newSubjects.get(id) : void 0;
      const old = before === void 0 ? void 0 : governancePopulationEntry(selector, before);
      const next = after === void 0 ? void 0 : governancePopulationEntry(selector, after);
      if (same(old ?? null, next ?? null))
        continue;
      if (old?.value.matched === true)
        known--;
      else if (old !== void 0)
        unknown--;
      if (next?.value.matched === true)
        known++;
      else if (next !== void 0)
        unknown++;
      changes.push({ key: manifestKey(id), ...next === void 0 ? {} : { value: next.value } });
    }
    if (changes.length === 0)
      continue;
    const manifest = updateManifest(state.root, changes, (prefix) => read("governance-cardinality-manifest", governanceManifestNodeKey(key, prefix)));
    if (known < 0 || unknown < 0)
      throw new Error("Indexed governance cardinality accounting is inconsistent");
    writeManifest("governance-cardinality-manifest", key, manifest);
    put("governance-cardinality", key, summarizeGovernanceManifest(manifest.root, known, unknown));
    put("governance-cardinality-state", key, { root: manifest.root, selector });
  }
  const outgoing = /* @__PURE__ */ new Map();
  for (const edge of governed.dependencies) {
    const values = outgoing.get(edge.fromUnitId) ?? [];
    values.push(edge);
    outgoing.set(edge.fromUnitId, values);
  }
  for (const subject of governed.subjects)
    put("governance-subject", subject.id, subject);
  for (const enumeration of governed.dependencyEnumerations)
    put("governance-enumeration", enumeration.unitId, enumeration);
  const failures = observation.analysis.failures.filter(({ analyzerId }) => analyzerId === "projector.filesystem-local").map(({ analyzerId, capability, scope }) => `${analyzerId}:${capability}:${scope}`).sort();
  const decisionsByUnit = /* @__PURE__ */ new Map();
  const oldDecisions = /* @__PURE__ */ new Set();
  for (const id of oldUnits.keys())
    for (const decision of required("governance-decision-membership", id).results)
      oldDecisions.add(decision.id);
  const applicabilityByDecision = /* @__PURE__ */ new Map();
  for (const decision of graph.decisions) {
    const local = graph.decisionApplicabilityResult(decision.id);
    for (const member of local.results) {
      const id = String(member.id), members = decisionsByUnit.get(id) ?? [];
      members.push({ id: decision.id, semanticHash: decision.semanticHash });
      decisionsByUnit.set(id, members);
    }
    if (local.results.length === 0 && !oldDecisions.has(decision.id))
      continue;
    const previous = required("governance-decision-applicability", decision.id);
    const results = [...previous.results.filter((member) => !oldUnits.has(String(member.id))), ...local.results].sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
    if (!same(results, previous.results))
      applicabilityByDecision.set(decision.id, { ...previous, results });
  }
  for (const [id, value] of applicabilityByDecision)
    put("governance-decision-applicability", id, value);
  for (const unit of graph.units) {
    put("governance-outgoing", unit.id, outgoing.get(unit.id) ?? []);
    const membership = graph.lensMembershipResult(unit.id);
    put("governance-lens-membership", unit.id, membership.observability === "unavailable" ? membership : { ...membership, results: membership.results.map((member) => ({ ...member, membershipFingerprint: membershipFingerprints[member.id] })) });
    put("governance-decision-membership", unit.id, { results: decisionsByUnit.get(unit.id) ?? [], observability: observation.analysis.surface.enumeration.observability, assumptions: [], unavailableLanes: failures, dependencyKeys: ["canonical-decisions", "projection-unit-membership"] });
  }
  for (const id of oldUnits.keys())
    if (!newUnits.has(id))
      for (const kind of ["governance-subject", "governance-outgoing", "governance-enumeration", "governance-lens-membership", "governance-decision-membership"])
        deletes.push({ kind, key: id });
  const nextPaths = new Set(observation.analysis.files.map(({ path }) => path));
  const changedPaths = [...paths].filter((path) => read("file", path) !== void 0 !== nextPaths.has(path));
  if (changedPaths.length > 0)
    for (const decision of graph.decisions) {
      const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
      if (authority === void 0)
        continue;
      const prior = required("governance-decision-observations", decision.id);
      const local = captureDecisionTriggerObservations(decision, authority, observation.canonical.documents, [...nextPaths], observation.analysis.surface.kind);
      const updated = local.map((item) => {
        const value = item.value;
        if (!Array.isArray(value.paths))
          return item;
        const previous = prior.find(({ key }) => key === item.key)?.value;
        if (!Array.isArray(previous?.paths))
          throw new Error(`Decision ${decision.id} lacks its completed scope population`);
        return { ...item, value: { paths: [.../* @__PURE__ */ new Set([...previous.paths.filter((path) => typeof path === "string" && !paths.has(path)), ...value.paths])].sort() } };
      });
      if (!same(prior, updated))
        put("governance-decision-observations", decision.id, updated);
    }
  return { delta: { upserts, deletes }, compilation: { ...graph.lensCompilation, membershipFingerprints } };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/indexed-observer.js
async function captureStore(root2, scope) {
  const location = await checkoutCacheLocation(root2), paths = await RepositoryPathService.create(location.cacheRoot);
  const target = await paths.resolveWrite(".projector/runtime/observations/index.sqlite");
  const capture = await SqliteObservationSourceCapture.create(target.realTarget, scope.budget, scope.signal);
  scope.registerCleanup(async () => {
    await capture.dispose();
  });
  return capture;
}
async function verifyCapturedInventory(root2, expected, scope) {
  const current = await inventoryRepositoryIdentities(root2, { budget: scope.budget, signal: scope.signal });
  const { limits: _beforeLimits, ...beforeBoundary } = expected.observationDescriptor;
  const { limits: _afterLimits, ...afterBoundary } = current.observationDescriptor;
  const matches = expected.entries.length === current.entries.length && expected.entries.every((entry, index) => {
    const actual = current.entries[index];
    return entry.path === actual.path && entry.kind === actual.kind && entry.contentHash === actual.contentHash && entry.mediaType === actual.mediaType && entry.generated === actual.generated;
  });
  if (!matches || hashFramedDomain("indexed-inventory-boundary", beforeBoundary) !== hashFramedDomain("indexed-inventory-boundary", afterBoundary) || hashFramedDomain("indexed-directory-boundary", expected.directories) !== hashFramedDomain("indexed-directory-boundary", current.directories))
    throw new Error("Repository source changed during indexed computation; the previous completed generation remains current");
}
var exclusions = [".git", ".worktrees", ".projector/runtime"];
var observerPrograms = `projector.local-repository@${localRepositoryAdapterVersion}/indexed-producer@4/source-versions@2/query-registry@3/governance-merkle@2/knowledge-lexical@1/realization-incidence@1/git-full-identity@1/git-leaf-proof@1/reverse-derivation-manifest@1/directory-population@1/${syntaxProgramVersion}`;
function merge(...deltas) {
  return { upserts: deltas.flatMap((delta) => delta.upserts ?? []), deletes: deltas.flatMap((delta) => delta.deletes ?? []), populations: deltas.flatMap((delta) => delta.populations ?? []), dependencies: deltas.flatMap((delta) => delta.dependencies ?? []) };
}
function materialize(store, descriptor) {
  return store.readGeneration(descriptor.generation, () => {
    const byPath = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
    const list2 = (kind) => store.population(kind).map((key) => {
      const value = store.get(kind, key);
      if (value === void 0)
        throw new Error(`Indexed observation record missing: ${kind}:${key}`);
      return value;
    });
    const grouped = (kind) => list2(kind).flatMap((value) => value);
    const analysis = {};
    for (const key of ["observationDescriptor", "surface", "capabilities", "git", "gitMoves", "packageScriptInvocations", "topology", "divergences", "failures"])
      analysis[key] = store.get("analysis-global", key);
    const javaScript = {};
    for (const key of ["events", "eventUncertainties", "contracts", "failures"])
      javaScript[key] = store.get("javascript-global", key);
    javaScript.files = list2("js");
    javaScript.dependencies = grouped("dependency");
    javaScript.testTargets = grouped("test-target");
    analysis.files = list2("file");
    analysis.artifacts = list2("artifact").map((artifact) => ({ ...artifact, observationRevision: descriptor.metadata.analysisHeader.git.revision })).sort((a, b) => byPath(a.locator, b.locator));
    analysis.projectionUnits = list2("unit");
    analysis.gitIdentities = list2("git-identity");
    analysis.dependencies = javaScript.dependencies;
    analysis.testTargets = javaScript.testTargets;
    analysis.javaScript = javaScript;
    analysis.git = { ...analysis.git, revision: descriptor.metadata.analysisHeader.git.revision, identities: list2("git-full-identity") };
    const artifactPaths = new Map(analysis.artifacts.map((artifact) => [artifact.id, artifact.locator]));
    analysis.projectionUnits = analysis.projectionUnits.sort((a, b) => byPath(artifactPaths.get(a.artifactId) ?? "", artifactPaths.get(b.artifactId) ?? ""));
    analysis.documents = list2("document");
    analysis.markdown = list2("markdown");
    analysis.actions = list2("actions");
    return { repositoryRoot: descriptor.repositoryRoot, analysis, canonical: { documents: list2("canonical"), entries: store.get("canonical-manifest", "entries"), rootDigest: descriptor.metadata.canonicalRootDigest }, realizations: grouped("realization"), state: descriptor.metadata.state };
  });
}
function handle(store, metadata, generation, mode, changedPaths) {
  const descriptor = { schemaVersion: INDEXED_OBSERVATION_CONTRACT, repositoryRoot: metadata.repositoryRoot, checkoutId: metadata.checkoutId, generation, contractHash: metadata.contractHash, metadata };
  return { descriptor, store, mode, changedPaths, materialize: () => materialize(store, descriptor), close: () => store.close() };
}
async function gitDirectories(root2, budget, signal) {
  const output = await observationGit(root2, ["rev-parse", "--absolute-git-dir", "--git-common-dir"], budget, { signal, stage: "indexed-git-directory" });
  const directories = [...new Set(output.trim().split("\n").map((path) => resolve(root2, path)))];
  if (directories.length === 0)
    throw new Error("Git did not provide its checkout metadata directories");
  return directories;
}
async function stagedPaths(root2, scope) {
  return (await observationGit(root2, ["diff", "--cached", "--no-ext-diff", "--no-renames", "--name-only", "-z"], scope.budget, { signal: scope.signal, stage: "indexed-git-stage-delta" })).split("\0").filter(Boolean);
}
function contract(metadata) {
  const { limits: _limits, ...descriptor } = metadata.inventoryDescriptor;
  return hashFramedDomain("indexed-observation-contract-v1", { schema: INDEXED_OBSERVATION_CONTRACT, programs: observerPrograms, descriptor, capabilities: metadata.analysisHeader.capabilities });
}
function validMetadata(value) {
  if (value === null || typeof value !== "object")
    return false;
  const metadata = value;
  return metadata.schemaVersion === INDEXED_OBSERVATION_CONTRACT && typeof metadata.checkoutId === "string" && typeof metadata.repositoryRoot === "string" && metadata.state !== void 0 && metadata.inventoryDescriptor !== void 0 && metadata.analysisHeader !== void 0 && Array.isArray(metadata.gitWatchmen) && Array.isArray(metadata.gitDirectories) && metadata.counts !== void 0 && typeof metadata.canonicalSourceHash === "string" && typeof metadata.gitSourceHash === "string";
}
function canonicalSourceHash(sources) {
  return hashFramedDomain("indexed-canonical-source-v1", sources.map(({ relativePath, source }) => ({ relativePath, source })));
}
async function gitSource(root2, scope) {
  const [head, index, status] = await Promise.all([
    observationGit(root2, ["rev-parse", "--verify", "--quiet", "HEAD"], scope.budget, { signal: scope.signal, allowedExitCodes: [1], stage: "indexed-git-source" }),
    observationGit(root2, ["ls-files", "--stage", "-z"], scope.budget, { signal: scope.signal, stage: "indexed-git-source" }),
    observationGit(root2, ["status", "--porcelain=v1", "--untracked-files=all", "-z"], scope.budget, { signal: scope.signal, stage: "indexed-git-source" })
  ]);
  const revision = head.trim() || "unborn";
  return { hash: hashFramedDomain("indexed-git-source-v1", { revision, index, status }), revision, status };
}
function inventoryChanges(store, generation, inventory, metadata) {
  if (inventory.directories?.length !== metadata.counts.directories)
    return void 0;
  const previous = store.inventorySummariesAt(generation);
  if (previous.length !== metadata.counts.files)
    return void 0;
  const previousSet = new Set(previous.map((entry) => entry.path));
  const entries = new Map(inventory.entries.map((entry) => [entry.path, entry]));
  const paths = /* @__PURE__ */ new Set();
  for (const prior of previous) {
    const current = entries.get(prior.path);
    if (current === void 0 || current.contentHash !== prior.contentHash || current.kind !== prior.kind || current.mediaType !== prior.mediaType || current.generated !== prior.generated)
      paths.add(prior.path);
  }
  for (const path of entries.keys())
    if (!previousSet.has(path))
      paths.add(path);
  for (const path of inventory.directories ?? [])
    if (!store.has("inventory-directory", path))
      return void 0;
  return [...paths];
}
async function effectiveBoundaryUnchanged(root2, metadata, scope) {
  const effective = metadata.inventoryDescriptor.ignoreSources.find((source) => source.path === "git:effective-config");
  if (effective === void 0)
    return false;
  const config = await observationGit(root2, ["config", "--show-origin", "--null", "--list"], scope.budget, { signal: scope.signal, stage: "indexed-ignore-boundary" });
  if (hashFramedDomain("repository-ignore-source", config) !== effective.contentHash)
    return false;
  for (const source of metadata.inventoryDescriptor.ignoreSources)
    if (source.path.startsWith("git:core.excludesFile:")) {
      const path = resolve(root2, source.path.slice("git:core.excludesFile:".length));
      let stat;
      try {
        stat = await lstat(path);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
          return false;
        throw error;
      }
      if (!stat.isFile() || stat.isSymbolicLink())
        return false;
      const bytes2 = await readObservationFile(path, scope.budget, source.path, scope.signal);
      if (hashFramedDomain("repository-ignore-source", bytes2.toString("base64")) !== source.contentHash)
        return false;
    }
  return true;
}
function syntaxAffectedPaths(store, generation, next) {
  const paths = /* @__PURE__ */ new Map();
  const include = (file) => {
    const members = paths.get(file.participantId) ?? /* @__PURE__ */ new Set();
    members.add(file.path);
    paths.set(file.participantId, members);
  };
  for (const file of next.files)
    include(file);
  for (const path of store.populationAt(generation, "js")) {
    const file = store.getAt(generation, "js", path);
    if (file !== void 0)
      include(file);
  }
  const participants = /* @__PURE__ */ new Set();
  for (const key of ["events", "eventUncertainties", "contracts"]) {
    for (const fact of store.getAt(generation, "javascript-global", key) ?? [])
      participants.add(fact.participantId);
    for (const fact of next[key])
      participants.add(fact.participantId);
  }
  return [...new Set([...participants].flatMap((id) => [...paths.get(id) ?? []]))];
}
async function syntaxLane(descriptor, scope, inventory) {
  const scanned = inventory ?? await inventoryRepository(descriptor.repositoryRoot, { budget: scope.budget, signal: scope.signal });
  const { limits: _limits, ...boundary } = scanned.observationDescriptor, { limits: _priorLimits, ...prior } = descriptor.metadata.inventoryDescriptor;
  if (hashFramedDomain("indexed-inventory-boundary", boundary) !== hashFramedDomain("indexed-inventory-boundary", prior))
    return void 0;
  const facts = await runObservationTask("analyze-javascript", { inventory: scanned }, scope);
  if (facts.failures.length > 0)
    return void 0;
  return { facts, inventory: scanned };
}
async function leafDelta(store, descriptor, paths, scope, enrollment, gitSnapshot, globalSyntax) {
  const metadata = descriptor.metadata, root2 = descriptor.repositoryRoot, generation = descriptor.generation;
  if (globalSyntax !== void 0 && (store.getAt(generation, "analysis-global", "failures") ?? []).length > 0)
    return void 0;
  if (paths.some((path) => path.startsWith(".projector/") || /(?:^|\/)(?:\.gitignore|\.gitattributes|\.watchmanconfig)$/u.test(path) || path.endsWith("package.json") || /(?:^|\/)(?:tsconfig[^/]*\.json|[^/]*config\.[^/]+|[^/]*lock[^/]*)$/u.test(path)))
    return void 0;
  if (!metadata.incrementalSupport.globalSyntax && globalSyntax === void 0 && paths.some((path) => /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path) || store.has("js", path)))
    return void 0;
  const capture = await captureStore(root2, scope);
  const retained = /* @__PURE__ */ new Map();
  const changed = /* @__PURE__ */ new Map();
  for (const path of paths) {
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth++)
      if (!store.has("inventory-directory", parts.slice(0, depth).join("/")))
        return void 0;
  }
  const currentIdentities = /* @__PURE__ */ new Map();
  const initialPaths = paths.filter((path) => gitSnapshot !== void 0 || !store.has("inventory", path));
  const knownInitial = new Map(initialPaths.map((path) => [path, store.getAt(generation, "git-full-identity", path)]).filter((item) => item[1] !== void 0));
  for (const identity of await collectGitPathIdentities(root2, initialPaths, gitSnapshot?.revision ?? metadata.analysisHeader.git.revision, knownInitial, { budget: scope.budget, signal: scope.signal, ancestryPreserved: gitSnapshot?.ancestryPreserved ?? true }))
    currentIdentities.set(identity.path, identity);
  const candidates = paths.filter((path) => (currentIdentities.get(path) ?? store.getAt(generation, "git-identity", path))?.tracked !== true);
  const ignored = candidates.length === 0 ? /* @__PURE__ */ new Set() : new Set((await observationGit(root2, ["check-ignore", "-z", "--stdin"], scope.budget, { signal: scope.signal, input: candidates.map((path) => `${path}\0`).join(""), allowedExitCodes: [1] })).split("\0").filter(Boolean));
  for (const path of [...new Set(paths)]) {
    if (ignored.has(path)) {
      if (store.has("inventory", path))
        changed.set(path, void 0);
      continue;
    }
    const entry = await readInventoryEntry(root2, path, scope.budget, scope.signal, capture);
    changed.set(path, entry);
    if (entry !== void 0)
      retained.set(path, entry);
  }
  const removedPaths = [...changed].filter(([, entry]) => entry === void 0).map(([path]) => path);
  const removedTracked = removedPaths.filter((path) => store.getAt(generation, "git-identity", path)?.tracked === true).length;
  const addedUntracked = [...changed].filter(([path, entry]) => entry !== void 0 && !store.has("inventory", path)).length;
  if (metadata.moveManifestRoot !== buildManifest([]).root || metadata.moveCandidates.deleted > 0 && addedUntracked > 0 || removedTracked > 0 && (metadata.moveCandidates.untracked > 0 || addedUntracked > 0))
    return void 0;
  const affected = new Set(changed.keys());
  const expand = () => {
    const queue = [...affected];
    for (let index = 0; index < queue.length; index++) {
      scope.budget.check("indexed-component");
      scope.signal.throwIfAborted();
      const path = queue[index];
      const neighbours = [...store.dependentsAt(generation, `path:${path}`), ...(store.getAt(generation, "dependency", path) ?? []).flatMap((item) => item.resolvedPath === void 0 ? [] : [item.resolvedPath])];
      const key = store.getAt(generation, "semantic-key", path);
      if (key !== void 0)
        neighbours.push(...store.populationAt(generation, `semantic-key:${key}`));
      for (const neighbour of neighbours)
        if (!affected.has(neighbour)) {
          affected.add(neighbour);
          queue.push(neighbour);
        }
      if (affected.size > observationLimitValue(scope.limits.maxFiles))
        throw new ObservationError("observation-limit-exceeded", "indexed-component", ".", "Affected component exceeds maxFiles", "maxFiles", affected.size);
    }
  };
  expand();
  const refreshIdentities = async () => {
    const pending = [...affected].filter((path) => !currentIdentities.has(path) && (gitSnapshot !== void 0 || !store.has("inventory", path)));
    const known = new Map(pending.map((path) => [path, store.getAt(generation, "git-identity", path)]).filter((item) => item[1] !== void 0));
    for (const identity of await collectGitPathIdentities(root2, pending, gitSnapshot?.revision ?? metadata.analysisHeader.git.revision, known, { budget: scope.budget, signal: scope.signal, ancestryPreserved: gitSnapshot?.ancestryPreserved ?? true }))
      currentIdentities.set(identity.path, identity);
  };
  await refreshIdentities();
  const collectedFor = async () => {
    await capture.beginAppend();
    const retain = async (entry) => {
      const existing = retained.get(entry.path);
      if (existing !== void 0)
        return existing;
      const fields = Object.fromEntries(Object.keys(entry).filter((key) => key !== "content").map((key) => [key, entry[key]]));
      const metadata2 = { ...fields, contentBytes: inventoryEntryBytes(entry) };
      const sourceVersionId = entry.sourceVersionId;
      const copied = sourceVersionId === void 0 ? await capture.putChunks(metadata2, inventoryEntryChunks(entry)) : capture.linkExisting(metadata2, sourceVersionId);
      retained.set(entry.path, copied);
      return copied;
    };
    const entries = /* @__PURE__ */ new Map();
    for (const path of affected) {
      const entry = changed.has(path) ? changed.get(path) : store.inventoryEntryAt(generation, path);
      if (entry !== void 0)
        entries.set(path, await retain(entry));
      const segments = path.split("/");
      for (let depth = 0; depth < segments.length; depth++) {
        const manifest = [...segments.slice(0, depth), "package.json"].join("/");
        const context = store.inventoryEntryAt(generation, manifest);
        if (context !== void 0)
          entries.set(manifest, await retain(context));
      }
    }
    const identities = [...entries.keys()].map((path) => currentIdentities.get(path) ?? store.getAt(generation, "git-identity", path) ?? { sourceClass: "derived", path, tracked: false, availability: "available", introductionHistory: "not-applicable" });
    await capture.finish();
    return { options: { repositoryRoot: root2 }, inventoryResult: { contentStore: capture.descriptor, entries: [...entries.values()], failures: [], rootAvailability: "available", observationDescriptor: { ...metadata.inventoryDescriptor, limits: scope.limits }, enumeration: metadata.enumeration }, gitFacts: { availability: "available", revision: gitSnapshot?.revision ?? metadata.analysisHeader.git.revision, identities, moves: [], failures: [] } };
  };
  let collected = await collectedFor();
  let preliminary = await runObservationTask("analyze-incremental", { collected, ...globalSyntax === void 0 ? {} : { context: { javaScript: globalSyntax } } }, scope);
  if (globalSyntax === void 0 && (preliminary.javaScript.events.length > 0 || preliminary.javaScript.contracts.length > 0 || preliminary.javaScript.eventUncertainties.length > 0))
    return void 0;
  const firstEntries = new Map(collected.inventoryResult.entries.map((entry) => [entry.path, entry])), firstJS = new Map(preliminary.javaScript.files.map((file) => [file.path, file]));
  let extended = false;
  for (const dependency of preliminary.dependencies) {
    const target = localImportCandidates(dependency.importerPath, dependency.specifier).find((path) => changed.has(path) ? changed.get(path) !== void 0 : store.has("inventory", path));
    if (target !== void 0 && !affected.has(target)) {
      affected.add(target);
      extended = true;
    }
  }
  for (const file of preliminary.files) {
    if (!affected.has(file.path))
      continue;
    const key = localSemanticKey(firstEntries.get(file.path), firstJS.get(file.path), file.semanticRole);
    for (const collision of store.populationAt(generation, `semantic-key:${key}`))
      if (!affected.has(collision)) {
        affected.add(collision);
        extended = true;
      }
  }
  if (extended) {
    expand();
    await refreshIdentities();
    collected = await collectedFor();
    preliminary = await runObservationTask("analyze-incremental", { collected, ...globalSyntax === void 0 ? {} : { context: { javaScript: globalSyntax } } }, scope);
  }
  const entriesByPath = new Map(collected.inventoryResult.entries.map((entry) => [entry.path, entry])), jsByPath = new Map(preliminary.javaScript.files.map((file) => [file.path, file]));
  const counts = {};
  const baseKeys = /* @__PURE__ */ new Map();
  for (const file of preliminary.files) {
    const key = localSemanticKey(entriesByPath.get(file.path), jsByPath.get(file.path), file.semanticRole);
    baseKeys.set(file.path, key);
  }
  for (const key of new Set(baseKeys.values())) {
    const unchanged = store.populationAt(generation, `semantic-key:${key}`).filter((path) => !affected.has(path) && !baseKeys.has(path)).length;
    counts[key] = unchanged + [...baseKeys.values()].filter((candidate) => candidate === key).length;
  }
  const targets = [...preliminary.testTargets];
  const raw = await runObservationTask("analyze-incremental", { collected, context: { javaScript: preliminary.javaScript, semanticKeyCounts: counts, testTargets: targets } }, scope);
  if (raw.failures.length > 0)
    return void 0;
  const artifactIds = new Set(raw.files.filter((file) => affected.has(file.path)).map((file) => file.artifactId));
  const filtered = { ...raw, files: raw.files.filter((file) => affected.has(file.path)), artifacts: raw.artifacts.filter((artifact) => artifactIds.has(artifact.id)), projectionUnits: raw.projectionUnits.filter((unit) => artifactIds.has(unit.artifactId)), gitIdentities: raw.gitIdentities.filter((identity) => affected.has(identity.path)), dependencies: raw.dependencies.filter((item) => affected.has(item.importerPath)), testTargets: raw.testTargets.filter((item) => affected.has(item.testPath)), javaScript: { ...raw.javaScript, files: raw.javaScript.files.filter((file) => affected.has(file.path)), dependencies: raw.javaScript.dependencies.filter((item) => affected.has(item.importerPath)), testTargets: raw.javaScript.testTargets.filter((item) => affected.has(item.testPath)) }, documents: raw.documents.filter((file) => affected.has(file.path)), actions: raw.actions.filter((file) => affected.has(file.path)), markdown: raw.markdown.filter((file) => affected.has(file.path)) };
  const realizationIds = safeRealizationCandidateIds({ descriptor, store, analysis: filtered, changedPaths: [...affected] });
  const documents = [.../* @__PURE__ */ new Set([...realizationIds, ...["projection-lens", "authority-record", "architecture-decision", "relation", "architecture-concern", "developer-preference"].flatMap((kind) => store.populationAt(generation, `canonical-kind:${kind}`))])].map((id) => store.getAt(generation, "canonical", id));
  const presentCanonical = new Set(documents.map((document) => document.id));
  for (const document of [...documents])
    for (const basis of document.payload.governanceBasis ?? []) {
      if (basis.conceptId === void 0 || presentCanonical.has(basis.conceptId))
        continue;
      const referenced = store.getAt(generation, "canonical", basis.conceptId);
      if (referenced !== void 0) {
        documents.push(referenced);
        presentCanonical.add(referenced.id);
      }
    }
  const partial = realizeChangeRepositoryData(root2, filtered, { documents, entries: documents.map((document) => ({ entityId: document.id, canonicalDocumentHash: document.canonicalDocumentHash })), rootDigest: metadata.canonicalRootDigest });
  const source = sourceRecords(partial, [...changed.values()].filter((entry) => entry !== void 0));
  const allowed = /* @__PURE__ */ new Set(["inventory", "file", "artifact", "unit", "js", "git-identity", "git-full-identity", "document", "markdown", "actions", "dependency", "test-target", "semantic-key"]);
  const upserts = (source.upserts ?? []).filter((row) => allowed.has(row.kind));
  if (globalSyntax !== void 0) {
    for (const key of ["events", "eventUncertainties", "contracts", "failures"])
      upserts.push({ kind: "javascript-global", key, value: globalSyntax[key] });
    const allActions = store.populationAt(generation, "actions").map((path) => store.getAt(generation, "actions", path)).filter((item) => item !== void 0);
    upserts.push({ kind: "analysis-global", key: "topology", value: raw.topology }, { kind: "analysis-global", key: "divergences", value: detectMechanicalDivergences(globalSyntax, allActions) });
  }
  const previousUnitIds = new Set([...affected].flatMap((path) => store.populationAt(generation, `unit-path:${path}`)));
  const realizationEntities = new Set(partial.realizations.map((item) => item.entityId));
  for (const entityId of realizationEntities) {
    const previous = store.getAt(generation, "realization", entityId) ?? [];
    const values = partial.realizations.filter((item) => item.entityId === entityId).map((next) => {
      const before = previous.find((item) => item.bindingIndex === next.bindingIndex);
      if (before !== void 0 && before.bindingHash !== next.bindingHash)
        throw new Error("Canonical realization binding changed outside the proved configuration");
      if (next.status === "unsupported" || next.status === "unavailable")
        return next;
      const memberIds = [.../* @__PURE__ */ new Set([...(before?.memberIds ?? []).filter((id) => !previousUnitIds.has(id)), ...next.memberIds])].sort();
      return { ...next, memberIds, status: memberIds.length === 0 ? "unmatched" : "matched", reason: memberIds.length === 0 ? "Declared realization has no members in the observed repository boundary." : "Declared realization matches observed raw facts; membership does not establish behavioral fulfillment." };
    });
    upserts.push({ kind: "realization", key: entityId, value: values });
  }
  const populations = (source.populations ?? []).filter((item) => allowed.has(item.selector) || item.selector.startsWith("unit-path:") || item.selector.startsWith("semantic-key:"));
  const deletes = [];
  for (const path of affected) {
    if (changed.has(path) && changed.get(path) === void 0) {
      deletes.push({ kind: "inventory", key: path });
      populations.push({ selector: "inventory", member: path, present: false });
    }
    const oldFile = store.getAt(generation, "file", path);
    if (oldFile !== void 0) {
      deletes.push({ kind: "artifact", key: oldFile.artifactId });
      populations.push({ selector: "artifact", member: oldFile.artifactId, present: false });
    }
    for (const id of store.populationAt(generation, `unit-path:${path}`)) {
      deletes.push({ kind: "unit", key: id });
      populations.push({ selector: "unit", member: id, present: false }, { selector: `unit-path:${path}`, member: id, present: false });
    }
    const oldKey = store.getAt(generation, "semantic-key", path);
    if (oldKey !== void 0)
      populations.push({ selector: `semantic-key:${oldKey}`, member: path, present: false });
    for (const kind of ["file", "js", "git-identity", "git-full-identity", "document", "markdown", "actions", "dependency", "test-target", "semantic-key"]) {
      deletes.push({ kind, key: path });
      populations.push({ selector: kind, member: path, present: false });
    }
  }
  const additions = (source.populations ?? []).filter((item) => allowed.has(item.selector) || item.selector.startsWith("unit-path:") || item.selector.startsWith("semantic-key:"));
  const orderedPopulations = [...populations.filter((item) => !item.present), ...additions];
  const oldDependencies = [...affected].flatMap((path) => (store.getAt(generation, "dependency", path) ?? []).flatMap((item) => localImportCandidates(item.importerPath, item.specifier).map((target) => ({ consumer: path, input: `path:${target}`, present: false }))));
  const fileManifest = updateManifest(metadata.fileManifestRoot, [...partial.analysis.files.map(({ path, contentHash, mediaType, generated }) => ({ key: manifestKey(path), value: { path, contentHash, mediaType, generated } })), ...removedPaths.map((path) => ({ key: manifestKey(path) }))], (prefix) => store.getAt(generation, "file-manifest", prefix));
  upserts.push(...[...fileManifest.nodes].map(([key, value]) => ({ kind: "file-manifest", key, value })));
  deletes.push(...fileManifest.removed.map((key) => ({ kind: "file-manifest", key })));
  let bytes2 = metadata.counts.bytes, files = metadata.counts.files;
  for (const [path, entry] of changed) {
    const previous = store.inventoryEntryAt(generation, path);
    if (previous === void 0 && entry !== void 0)
      files++;
    if (previous !== void 0 && entry === void 0)
      files--;
    bytes2 += (entry === void 0 ? 0 : inventoryEntryBytes(entry)) - (previous === void 0 ? 0 : inventoryEntryBytes(previous));
  }
  if (files > observationLimitValue(scope.limits.maxFiles) || bytes2 > observationLimitValue(scope.limits.maxTotalBytes))
    throw new ObservationError("observation-limit-exceeded", "indexed-population-admission", ".", "Updated inventory exceeds the declared finite limits", files > observationLimitValue(scope.limits.maxFiles) ? "maxFiles" : "maxTotalBytes", files > observationLimitValue(scope.limits.maxFiles) ? files : bytes2);
  const state = { ...metadata.state, gitBase: gitSnapshot?.revision ?? metadata.state.gitBase, worktreeDigest: hashFramedDomain("repository-change-worktree/v2", { files: fileManifest.root, moves: metadata.moveManifestRoot, surface: metadata.analysisHeader.surface.enumeration }) };
  const changedObservation = { ...partial, state };
  const localGraph = new KnowledgeGraph(changedObservation);
  const governance = updateIndexedGovernanceDelta({ descriptor, store, changedPaths: [...affected], changedObservation, graph: localGraph });
  if (governance === void 0)
    return void 0;
  let enlarged = false;
  for (const row of governance.delta.upserts ?? [])
    if (row.kind === "governance-lens-root") {
      const visit = (prefix) => {
        const node = store.getAt(generation, "governance-lens-manifest", governanceManifestNodeKey(row.key, prefix));
        if (node === void 0)
          throw new Error("Indexed lens member manifest is incomplete; rebuild the complete observation");
        if (node.kind === "branch")
          for (const digit of Object.keys(node.children))
            visit(prefix + digit);
        else
          for (const entry of node.entries) {
            const unit = store.getAt(generation, "unit", String(entry.value));
            if (unit === void 0)
              throw new Error("Lens member refers to missing indexed unit");
            const artifact = store.getAt(generation, "artifact", unit.artifactId);
            if (artifact === void 0)
              throw new Error("Lens member refers to missing indexed artifact");
            if (!affected.has(artifact.locator)) {
              affected.add(artifact.locator);
              enlarged = true;
            }
          }
      };
      visit("");
    }
  if (enlarged)
    return leafDelta(store, descriptor, [...affected], scope, enrollment, gitSnapshot, globalSyntax);
  const graph = enrollment?.delta === void 0 ? enrollIndexedGraphDelta({ descriptor, store, changedPaths: [...affected], changedObservation, preparedLensCompilation: { compilation: governance.compilation } }) : await enrollment.delta({ descriptor, store, changedPaths: [...affected], changedObservation });
  const impact = buildRepositoryImpactSnapshot(changedObservation, new KnowledgeGraph(changedObservation, {}, void 0, void 0, { compilation: governance.compilation }));
  const reverse = /* @__PURE__ */ new Map(), derivationDependencies = [];
  const reverseChange = (id, unitId, present) => {
    const changes = reverse.get(id) ?? [];
    changes.push({ key: manifestKey(unitId), ...present ? { value: unitId } : {} });
    reverse.set(id, changes);
  };
  const nextInputs = new Map(impact.records.map((record) => [record.unitId, new Set(record.inputs.map((input) => input.id))]));
  const previousInputs = /* @__PURE__ */ new Map();
  for (const path of affected)
    for (const unitId of store.populationAt(generation, `unit-path:${path}`)) {
      const inputs = new Set((store.getAt(generation, "derivation-inputs", unitId) ?? []).map((input) => input.id));
      previousInputs.set(unitId, inputs);
      for (const id of inputs)
        if (!nextInputs.get(unitId)?.has(id)) {
          reverseChange(id, unitId, false);
          derivationDependencies.push({ consumer: unitId, input: `derivation:${id}`, present: false });
        }
      deletes.push({ kind: "derivation-inputs", key: unitId });
    }
  for (const record of impact.records) {
    upserts.push({ kind: "derivation-inputs", key: record.unitId, value: record.inputs });
    for (const input of record.inputs)
      if (!previousInputs.get(record.unitId)?.has(input.id)) {
        reverseChange(input.id, record.unitId, true);
        derivationDependencies.push({ consumer: record.unitId, input: `derivation:${input.id}`, present: true });
      }
  }
  for (const [id, changes] of reverse) {
    const prior = store.getAt(generation, "reverse-derivation-root", id);
    if (prior === void 0 && !store.has("population-version", "reverse-derivations"))
      throw new Error("Reverse derivation namespace is not complete; rebuild the observation");
    const empty = prior === void 0 ? buildManifest([]) : void 0;
    const manifest = updateManifest(prior ?? empty.root, changes, (prefix) => store.getAt(generation, "reverse-derivation-manifest", reverseDerivationManifestKey(id, prefix)) ?? (prefix === "" ? empty?.nodes.get("") : void 0));
    upserts.push({ kind: "reverse-derivation-root", key: id, value: manifest.root }, { kind: "query-dependency-version", key: `reverse-derivations:${id}`, value: hashFramedDomain("indexed-graph-dependency", manifest.root) }, ...[...manifest.nodes].map(([prefix, value]) => ({ kind: "reverse-derivation-manifest", key: reverseDerivationManifestKey(id, prefix), value })));
    deletes.push(...manifest.removed.map((prefix) => ({ kind: "reverse-derivation-manifest", key: reverseDerivationManifestKey(id, prefix) })));
  }
  for (const item of source.upserts ?? [])
    if (item.kind === "population-version" && item.key.startsWith("unit-path:"))
      upserts.push(item);
  return { metadata: { ...metadata, state, analysisHeader: { ...metadata.analysisHeader, git: { ...metadata.analysisHeader.git, revision: gitSnapshot?.revision ?? metadata.analysisHeader.git.revision } }, incrementalSupport: { ...metadata.incrementalSupport, globalSyntax: globalSyntax === void 0 ? metadata.incrementalSupport.globalSyntax : globalSyntax.events.length === 0 && globalSyntax.contracts.length === 0 && globalSyntax.eventUncertainties.length === 0 }, fileManifestRoot: fileManifest.root, counts: { ...metadata.counts, files, bytes: bytes2 }, moveCandidates: gitSnapshot?.candidates ?? { deleted: metadata.moveCandidates.deleted + removedPaths.filter((path) => store.getAt(generation, "git-identity", path)?.tracked === true).length, untracked: metadata.moveCandidates.untracked + addedUntracked - removedPaths.filter((path) => store.getAt(generation, "git-identity", path)?.tracked === false).length } }, delta: merge({ upserts, deletes, populations: orderedPopulations, dependencies: [...oldDependencies, ...source.dependencies ?? [], ...derivationDependencies] }, graph, governance.delta), paths: [...affected] };
}
async function observeIndexedRepository(repositoryRoot, options = {}) {
  return withObservationScope({}, async (scope) => {
    const location = await checkoutCacheLocation(repositoryRoot), root2 = location.checkoutRoot;
    const store = await SqliteObservationStore.open(root2, { budget: scope.budget, signal: scope.signal });
    try {
      const head = store.head();
      let reason = options.rebuild === true ? "explicit-rebuild" : "missing-completed-baseline";
      let scannedInventory;
      if (options.rebuild !== true && head !== void 0 && validMetadata(head.metadata) && head.metadata.checkoutId === location.checkoutId && head.metadata.repositoryRoot === root2 && head.contract === head.metadata.contractHash && head.contract === contract(head.metadata)) {
        const previous = head.metadata;
        if (previous.counts.files > observationLimitValue(scope.limits.maxFiles))
          throw new ObservationError("observation-limit-exceeded", "indexed-population-admission", ".", "Indexed population exceeds maxFiles", "maxFiles", previous.counts.files);
        if (previous.counts.directories > observationLimitValue(scope.limits.maxDirectories))
          throw new ObservationError("observation-limit-exceeded", "indexed-population-admission", ".", "Indexed population exceeds maxDirectories", "maxDirectories", previous.counts.directories);
        if (previous.counts.bytes > observationLimitValue(scope.limits.maxTotalBytes))
          throw new ObservationError("observation-limit-exceeded", "indexed-population-admission", ".", "Indexed population exceeds maxTotalBytes", "maxTotalBytes", previous.counts.bytes);
        if (previous.watchman === void 0 && previous.gitWatchmen.length === 0) {
          const warmCapture = await captureStore(root2, scope);
          const inventory = await inventoryRepository(root2, { budget: scope.budget, signal: scope.signal, contentStore: warmCapture, deferContentStoreFinish: true });
          scannedInventory = inventory;
          const { limits: _limits, ...boundary } = inventory.observationDescriptor;
          const { limits: _previousLimits, ...priorBoundary } = previous.inventoryDescriptor;
          if (hashFramedDomain("indexed-inventory-boundary", boundary) === hashFramedDomain("indexed-inventory-boundary", priorBoundary) && inventory.enumeration.method === previous.enumeration.method) {
            const canonical = canonicalSourceHash(await collectCanonicalSnapshotSources(root2, scope.budget, scope.signal));
            const git = previous.analysisHeader.git.availability === "available" ? await gitSource(root2, scope) : void 0;
            const gitHash = git?.hash ?? hashFramedDomain("indexed-no-git-source", inventory.enumeration.method);
            const paths = inventoryChanges(store, head.generation, inventory, previous);
            if (paths !== void 0 && canonical === previous.canonicalSourceHash) {
              scope.signal.throwIfAborted();
              scope.budget.check("indexed-source-currentness");
              if (paths.length === 0 && gitHash === previous.gitSourceHash)
                return handle(store, previous, head.generation, "unchanged", []);
              await warmCapture.finish();
              if (git !== void 0 && git.revision === previous.analysisHeader.git.revision) {
                const status = parseGitStatus(git.status);
                const statusPaths = [];
                for (const record of git.status.split("\0"))
                  if (record.length >= 4)
                    statusPaths.push(record.slice(3));
                const stages2 = await stagedPaths(root2, scope), oldStages = store.populationAt(head.generation, "git-staged-path");
                const affected = [...new Set(gitHash === previous.gitSourceHash ? paths : [...paths, ...statusPaths, ...stages2, ...oldStages])].filter((path) => !exclusions.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
                const descriptor = { schemaVersion: INDEXED_OBSERVATION_CONTRACT, repositoryRoot: root2, checkoutId: location.checkoutId, generation: head.generation, contractHash: head.contract, metadata: previous };
                const snapshot = { revision: git.revision, ancestryPreserved: true, candidates: { deleted: status.deleted.length, untracked: status.untracked.length } };
                let changed = status.moves.length === 0 && !(status.deleted.length > 0 && status.untracked.length > 0) && affected.length > 0 ? await leafDelta(store, descriptor, affected, scope, options.enrollment, snapshot) : void 0;
                if (changed === void 0 && affected.some((path) => /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path)) && status.moves.length === 0) {
                  const lane = await syntaxLane(descriptor, scope, inventory);
                  if (lane !== void 0)
                    changed = await leafDelta(store, descriptor, [.../* @__PURE__ */ new Set([...affected, ...syntaxAffectedPaths(store, head.generation, lane.facts)])], scope, options.enrollment, snapshot, lane.facts);
                }
                if (changed !== void 0) {
                  await verifyCapturedInventory(root2, inventory, scope);
                  const verified = await gitSource(root2, scope);
                  if (verified.hash !== git.hash || canonicalSourceHash(await collectCanonicalSnapshotSources(root2, scope.budget, scope.signal)) !== canonical)
                    throw new Error("Source boundary changed during indexed delta; retry observation");
                  scope.signal.throwIfAborted();
                  scope.budget.check("indexed-generation-publication");
                  const metadata2 = { ...changed.metadata, canonicalSourceHash: canonical, gitSourceHash: gitHash };
                  const stageDelta = { populations: [...oldStages.map((member) => ({ selector: "git-staged-path", member, present: false })), ...stages2.map((member) => ({ selector: "git-staged-path", member, present: true }))] };
                  const published2 = await store.publishWhenReady(head.generation, { contract: head.contract, metadata: metadata2 }, merge(changed.delta, stageDelta), { signal: scope.signal });
                  return handle(store, metadata2, published2.generation, "delta", changed.paths);
                }
              }
            }
          }
          await warmCapture.finish();
          reason = "changed-or-unknown-source-boundary";
        }
        try {
          const delta = await observeWatchmanChanges(previous.watchman, scope.budget, scope.signal);
          if (delta.kind === "delta" && delta.baseline.uncoveredPrefixes.every((prefix) => exclusions.some((excluded) => prefix === excluded || prefix.startsWith(`${excluded}/`)))) {
            const gitDeltas = await Promise.all(previous.gitWatchmen.map((baseline) => observeWatchmanChanges(baseline, scope.budget, scope.signal)));
            const sourceEvents = previous.analysisHeader.git.availability === "available" ? await filterSourceWatchmanEvents(root2, delta.events.filter((event) => !exclusions.some((prefix) => event.path === prefix || event.path.startsWith(`${prefix}/`))), scope.budget, scope.signal) : delta.events;
            let paths = sourceEvents.filter((event) => event.type !== "d").map((event) => event.path).filter((path) => !exclusions.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
            const revision = (await observationGit(root2, ["rev-parse", "--verify", "--quiet", "HEAD"], scope.budget, { signal: scope.signal, allowedExitCodes: [1] })).trim() || "unborn";
            if (previous.analysisHeader.git.availability === "available" && previous.gitWatchmen.length === previous.gitDirectories.length && gitDeltas.every((result) => result.kind === "delta" && result.baseline.uncoveredPrefixes.length === 0) && await effectiveBoundaryUnchanged(root2, previous, scope)) {
              const gitChanged = revision !== previous.analysisHeader.git.revision || gitDeltas.some((result) => result.kind === "delta" && result.events.length > 0);
              let gitSnapshot, stageDelta = {};
              let gitSupported = true;
              if (gitChanged) {
                const status = parseGitStatus(await observationGit(root2, ["status", "--porcelain=v1", "--untracked-files=all", "-z"], scope.budget, { signal: scope.signal, stage: "indexed-git-population-proof" }));
                gitSupported = status.moves.length === 0 && !(status.deleted.length > 0 && status.untracked.length > 0) && previous.moveManifestRoot === buildManifest([]).root;
                let ancestryPreserved = revision === previous.analysisHeader.git.revision;
                if (revision !== previous.analysisHeader.git.revision && revision !== "unborn" && previous.analysisHeader.git.revision !== "unborn")
                  ancestryPreserved = (await observationGit(root2, ["merge-base", previous.analysisHeader.git.revision, revision], scope.budget, { signal: scope.signal, stage: "indexed-git-history-proof", allowedExitCodes: [1] })).trim() === previous.analysisHeader.git.revision;
                gitSupported &&= ancestryPreserved;
                if (gitSupported) {
                  const stages2 = await stagedPaths(root2, scope), oldStages = store.populationAt(head.generation, "git-staged-path");
                  const treePaths = revision === previous.analysisHeader.git.revision ? [] : (await observationGit(root2, ["diff-tree", "--no-ext-diff", "--no-renames", "--name-only", "-r", "-z", previous.analysisHeader.git.revision, revision], scope.budget, { signal: scope.signal, stage: "indexed-git-tree-delta" })).split("\0").filter(Boolean);
                  paths = [.../* @__PURE__ */ new Set([...paths, ...stages2, ...oldStages, ...treePaths])].filter((path) => !exclusions.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
                  gitSnapshot = { revision, ancestryPreserved, candidates: { deleted: status.deleted.length, untracked: status.untracked.length } };
                  stageDelta = { populations: [...oldStages.map((member) => ({ selector: "git-staged-path", member, present: false })), ...stages2.map((member) => ({ selector: "git-staged-path", member, present: true }))] };
                }
              }
              const descriptor = { schemaVersion: INDEXED_OBSERVATION_CONTRACT, repositoryRoot: root2, checkoutId: location.checkoutId, generation: head.generation, contractHash: head.contract, metadata: previous };
              let directoryChanged = false;
              const directoryEvents = sourceEvents.filter((event) => event.type === "d" && !exclusions.some((prefix) => event.path === prefix || event.path.startsWith(`${prefix}/`)));
              if (directoryEvents.length > 0) {
                const repositoryPaths = await RepositoryPathService.create(root2);
                for (const event of directoryEvents) {
                  scope.budget.check("indexed-directory-currentness", event.path);
                  scope.signal.throwIfAborted();
                  if (!event.exists || !store.has("inventory-directory", event.path)) {
                    directoryChanged = true;
                    break;
                  }
                  const resolved = await repositoryPaths.resolveRead(event.path);
                  let stat;
                  try {
                    stat = await lstat(resolved.realTarget);
                  } catch (error) {
                    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
                      directoryChanged = true;
                      break;
                    }
                    throw error;
                  }
                  if (!stat.isDirectory() || stat.isSymbolicLink()) {
                    directoryChanged = true;
                    break;
                  }
                }
              }
              let changed = gitSupported && !directoryChanged && (paths.length > 0 || gitChanged) ? await leafDelta(store, descriptor, paths, scope, options.enrollment, gitSnapshot) : void 0;
              if (changed === void 0 && gitSupported && !directoryChanged && paths.some((path) => /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path))) {
                const lane = await syntaxLane(descriptor, scope);
                if (lane !== void 0)
                  changed = await leafDelta(store, descriptor, [.../* @__PURE__ */ new Set([...paths, ...syntaxAffectedPaths(store, head.generation, lane.facts)])], scope, options.enrollment, gitSnapshot, lane.facts);
              }
              if (!gitSupported || directoryChanged || (paths.length > 0 || gitChanged) && changed === void 0) {
                reason = "unsupported-source-or-git-delta";
              } else {
                const verifiedGitSource2 = previous.analysisHeader.git.availability === "available" ? await gitSource(root2, scope) : void 0;
                const watchman2 = await verifyWatchmanChanges(delta.baseline, scope.budget, scope.signal, exclusions, true);
                const gitWatchmen2 = [];
                for (const result of gitDeltas)
                  if (result.kind === "delta")
                    gitWatchmen2.push(await verifyWatchmanChanges(result.baseline, scope.budget, scope.signal));
                if (!await effectiveBoundaryUnchanged(root2, previous, scope))
                  throw new Error("Effective Git ignore/configuration boundary changed during indexed observation; retry the complete observation");
                const metadata2 = { ...changed?.metadata ?? previous, watchman: watchman2, gitWatchmen: gitWatchmen2, gitSourceHash: verifiedGitSource2?.hash ?? previous.gitSourceHash };
                scope.signal.throwIfAborted();
                const published2 = await store.publishWhenReady(head.generation, { contract: head.contract, metadata: metadata2 }, merge(changed?.delta ?? {}, stageDelta), { retainGeneration: changed === void 0, signal: scope.signal });
                return handle(store, metadata2, published2.generation, changed === void 0 ? "unchanged" : "delta", changed?.paths ?? []);
              }
            }
            reason = paths.length > 0 ? "known-source-delta" : "changed-or-unknown-git-inputs";
          } else
            reason = delta.kind === "rediscovery" ? delta.reason : "incomplete-provider-coverage";
        } catch (error) {
          if (!(error instanceof WatchmanSynchronizationUnavailableError))
            throw error;
          reason = "watchman-synchronization-unavailable";
        }
      }
      const watchman = await enrollWatchman(root2, scope.budget, scope.signal);
      let directories = [];
      try {
        directories = await gitDirectories(root2, scope.budget, scope.signal);
      } catch (error) {
        try {
          await lstat(resolve(root2, ".git"));
          throw error;
        } catch (markerError) {
          if (!(typeof markerError === "object" && markerError !== null && "code" in markerError && markerError.code === "ENOENT"))
            throw markerError;
        }
      }
      const gitWatchmen = [];
      for (const directory of directories) {
        const enrolled = await enrollWatchman(directory, scope.budget, scope.signal);
        if (enrolled !== void 0)
          gitWatchmen.push(enrolled);
      }
      const capturedGitSource = directories.length === 0 ? void 0 : await gitSource(root2, scope);
      const collected = scannedInventory === void 0 ? await collectLocalRepositoryInputs({ repositoryRoot: root2, budget: scope.budget, signal: scope.signal, contentStore: await captureStore(root2, scope) }) : {
        options: { repositoryRoot: root2 },
        inventoryResult: scannedInventory,
        gitFacts: await collectGitFacts(root2, scannedInventory.entries.map((entry) => entry.path), { budget: scope.budget, signal: scope.signal, entries: scannedInventory.entries, ...scannedInventory.contentStore === void 0 ? {} : { contentStore: scannedInventory.contentStore }, confirmedNonGit: scannedInventory.enumeration.method === "recursive-filesystem-fallback" })
      };
      const canonicalSources = await collectCanonicalSnapshotSources(root2, scope.budget, scope.signal);
      let summary, prepared, stage;
      if (options.enrollment === void 0) {
        const target = await (await RepositoryPathService.create(location.cacheRoot)).resolveWrite(`.projector/runtime/observations/index.sqlite.temporary/${randomUUID().replaceAll("-", "")}.db`);
        await mkdir(dirname(target.realTarget), { recursive: true });
        stage = { schemaVersion: "projector.observation-stage/v1", path: target.realTarget };
        const stagePath = stage.path;
        scope.registerCleanup(async () => {
          for (const suffix of ["", "-journal", "-wal", "-shm"])
            await rm(stagePath + suffix, { force: true });
        });
        summary = await runObservationTask("observe-indexed", { collected, canonicalSources, stage }, scope);
        prepared = { upserts: collected.inventoryResult.entries.map((value) => ({ kind: "inventory", key: value.path, value })) };
      } else {
        const data = await runObservationTask("observe", { collected, canonicalSources }, scope);
        const summarized = summarizeColdObservation(data, collected.inventoryResult);
        summary = summarized.summary;
        prepared = merge(sourceRecords(data, collected.inventoryResult.entries), await options.enrollment.cold(data), summarized.manifestDelta);
      }
      const stages = summary.analysisHeader.git.availability === "available" ? await stagedPaths(root2, scope) : [];
      let completedWatchman = watchman;
      const completedGit = [];
      try {
        if (watchman !== void 0)
          completedWatchman = await verifyWatchmanChanges(watchman, scope.budget, scope.signal, exclusions, summary.analysisHeader.git.availability === "available");
        for (const baseline of gitWatchmen)
          completedGit.push(await verifyWatchmanChanges(baseline, scope.budget, scope.signal));
      } catch (error) {
        if (!(error instanceof WatchmanSynchronizationUnavailableError))
          throw error;
        completedWatchman = void 0;
        completedGit.length = 0;
      }
      if (completedWatchman === void 0)
        await verifyCapturedInventory(root2, collected.inventoryResult, scope);
      const verifiedCanonical = canonicalSourceHash(await collectCanonicalSnapshotSources(root2, scope.budget, scope.signal));
      if (verifiedCanonical !== canonicalSourceHash(canonicalSources))
        throw new Error("Canonical sources changed during indexed computation; retry before publication");
      const verifiedGitSource = summary.analysisHeader.git.availability === "available" ? await gitSource(root2, scope) : void 0;
      if (capturedGitSource?.hash !== verifiedGitSource?.hash || verifiedGitSource !== void 0 && verifiedGitSource.revision !== summary.analysisHeader.git.revision)
        throw new Error("Git source boundary changed during indexed computation; retry before publication");
      const metadata = {
        ...summary,
        moveCandidates: { deleted: collected.gitFacts.pendingMoveCandidates?.deleted.length ?? 0, untracked: collected.gitFacts.pendingMoveCandidates?.untracked.length ?? 0 },
        schemaVersion: INDEXED_OBSERVATION_CONTRACT,
        checkoutId: location.checkoutId,
        repositoryRoot: root2,
        inventoryDescriptor: collected.inventoryResult.observationDescriptor,
        enumeration: collected.inventoryResult.enumeration,
        canonicalSourceHash: canonicalSourceHash(canonicalSources),
        gitSourceHash: verifiedGitSource?.hash ?? hashFramedDomain("indexed-no-git-source", collected.inventoryResult.enumeration.method),
        contractHash: "",
        ...completedWatchman === void 0 ? {} : { watchman: completedWatchman },
        gitWatchmen: completedGit,
        gitDirectories: directories,
        rebuildReason: reason
      };
      const completed = { ...metadata, contractHash: contract(metadata) };
      scope.signal.throwIfAborted();
      scope.budget.check("indexed-generation-publication");
      const published = await store.publishWhenReady(head?.generation ?? null, { contract: completed.contractHash, metadata: completed }, { ...merge(prepared, { upserts: (collected.inventoryResult.directories ?? []).map((key) => ({ kind: "inventory-directory", key, value: true })), populations: stages.map((member) => ({ selector: "git-staged-path", member, present: true })) }), rebuild: true }, { signal: scope.signal, ...stage === void 0 ? {} : { stage } });
      return handle(store, completed, published.generation, "rebuild", []);
    } catch (error) {
      store.close();
      throw error;
    }
  });
}

// node_modules/@projector/control-plane/dist/coverage/continuation.js
import { z as z6 } from "zod";

// node_modules/@projector/control-plane/dist/knowledge/transport.js
import { z } from "zod";
var contentBudget = 32e3;
var branchBudget = 48e3;
var messageBudget = 2048;
var sampleLimit = 12;
var countSchema = z.strictObject({ total: z.number().int().nonnegative(), included: z.number().int().nonnegative(), omitted: z.number().int().nonnegative() });
var stringsSchema = z.strictObject({ values: z.array(z.string()), disclosure: countSchema });
var bindingStatusSchema = z.enum(["current", "rebound", "stale", "suspect", "unavailable"]);
var humanMeaningSectionSchema = z.strictObject({
  id: z.string(),
  entityId: z.string(),
  sourceSemanticHash: ContentHashSchema,
  kind: z.enum(["statement", "scenario", "decision", "qualifier", "currentness", "summary"]),
  heading: z.string(),
  text: z.string(),
  branchIds: z.array(z.string())
});
var humanMeaningSchema = z.strictObject({
  profile: z.strictObject({ id: z.literal("human-compact"), version: z.literal(1), sourceContentHash: ContentHashSchema }),
  sections: z.array(humanMeaningSectionSchema),
  disclosure: countSchema
});
var contextItemReferenceSchema = z.strictObject({
  entityId: z.string(),
  sourceSemanticHash: ContentHashSchema,
  kind: z.enum(["concept", "requirement", "scenario", "decision", "projection-unit", "other"]),
  band: z.enum(["direct", "governing", "consequence", "possible"]),
  disclosure: z.enum(["full", "summary", "identity"]),
  relevanceScore: z.number().finite(),
  relevanceReasons: z.array(z.string()),
  uncertainty: z.array(z.string()),
  confidence: z.number().finite(),
  sectionIds: z.array(z.string()),
  sectionDisclosure: countSchema
});
var safetySchema = z.strictObject({
  blockedDecisions: z.number().int().nonnegative(),
  unknownDecisions: z.number().int().nonnegative(),
  firedDecisionChecks: z.number().int().nonnegative(),
  unknownDecisionChecks: z.number().int().nonnegative(),
  unobservedDecisionChecks: z.number().int().nonnegative(),
  violatedGovernance: z.number().int().nonnegative(),
  unknownGovernance: z.number().int().nonnegative(),
  violatedFindings: z.number().int().nonnegative(),
  unknownFindings: z.number().int().nonnegative(),
  unknownObligations: z.number().int().nonnegative(),
  applicationEvidenceCount: z.number().int().nonnegative(),
  violatedApplicationEvidence: z.number().int().nonnegative(),
  unknownApplicationEvidence: z.number().int().nonnegative()
});
var contextBranchSchema = z.strictObject({
  id: z.string(),
  interpretation: KnowledgeInterpretationCandidateSchema,
  hypothesis: z.boolean(),
  context: z.strictObject({
    items: z.array(contextItemReferenceSchema),
    itemsDisclosure: countSchema,
    meaningDisclosure: countSchema,
    deferredEntityIds: stringsSchema,
    requiredExpansionIds: z.array(z.string()),
    requiredExpansionDisclosure: countSchema,
    estimatedCost: z.number().nonnegative(),
    requiredBudgetOverrun: z.number().nonnegative()
  }),
  frontier: z.array(z.string()),
  frontierDisclosure: countSchema,
  lensObligations: z.array(KnowledgeLensObligationSchema),
  obligationDisclosure: countSchema,
  decisionValidity: z.array(KnowledgeDecisionValiditySchema),
  decisionDisclosure: countSchema,
  governanceEvaluations: z.array(governanceEvaluationSchema),
  governanceDisclosure: countSchema,
  applicationEvidence: z.array(KnowledgeApplicationEvidenceAssessmentSchema),
  applicationEvidenceDisclosure: countSchema,
  safety: safetySchema
});
var KnowledgeContextAgentViewSchema = z.strictObject({
  code: CodeContextSummarySchema.optional(),
  apiVersion: z.literal(KNOWLEDGE_API_VERSION),
  view: z.literal("agent"),
  id: z.string(),
  request: z.string(),
  persisted: z.boolean(),
  contentHash: ContentHashSchema,
  capturedState: StateDigestSchema,
  interpretation: z.strictObject({ status: z.enum(["direct", "candidates", "unresolved"]), candidates: z.array(KnowledgeInterpretationCandidateSchema), candidateDisclosure: countSchema, unknowns: z.array(z.string()), unknownDisclosure: countSchema }),
  branches: z.array(contextBranchSchema),
  branchDisclosure: countSchema,
  meaning: humanMeaningSchema,
  unknowns: z.array(z.string()),
  unknownDisclosure: countSchema,
  analyzerFailures: z.array(AnalyzerFailureSchema),
  analyzerFailureDisclosure: countSchema,
  safety: safetySchema,
  fullEvidence: z.strictObject({ operation: z.literal("context"), inputPatch: z.strictObject({ view: z.literal("full") }), note: z.string() }),
  retainedEvidence: z.strictObject({ operation: z.literal("context.inspect"), input: z.strictObject({ contextId: z.string() }) }).optional()
});
var validationSchema = z.strictObject({
  status: bindingStatusSchema,
  reasons: z.array(z.string()),
  reasonDisclosure: countSchema,
  changedValueDependencyIds: z.array(z.string()),
  changedValueDependencyDisclosure: countSchema,
  changedQueryDependencyIds: z.array(z.string()),
  changedQueryDependencyDisclosure: countSchema
});
var governanceBranchSchema = z.strictObject({
  interpretationEntityId: z.string(),
  retainedBranchId: z.string().optional(),
  currentBranchId: z.string().optional(),
  status: z.enum(["conformant", "violated", "unknown", "not-applicable"]),
  reasons: z.array(z.string()),
  reasonDisclosure: countSchema,
  decisionValidity: z.array(KnowledgeDecisionValiditySchema),
  decisionDisclosure: countSchema,
  evaluations: z.array(governanceEvaluationSchema),
  evaluationDisclosure: countSchema,
  safety: safetySchema
});
var impactSchema = z.strictObject({
  status: z.enum(["current", "changed", "unavailable"]),
  contentHash: ContentHashSchema,
  repairRoute: z.enum(["reuse", "revalidate", "widen-analysis", "human-decision"]),
  predictedUnitIds: stringsSchema,
  observedChangedUnitIds: stringsSchema,
  knownAffectedUnitIds: stringsSchema,
  possibleFrontierUnitIds: stringsSchema,
  backdatedUnitIds: stringsSchema,
  blockedUnitIds: stringsSchema,
  surpriseCount: z.number().int().nonnegative(),
  candidateRelationCount: z.number().int().nonnegative(),
  diagnostics: stringsSchema
});
var KnowledgeReconciliationAgentViewSchema = z.strictObject({
  apiVersion: z.literal(KNOWLEDGE_API_VERSION),
  view: z.literal("agent"),
  contextId: z.string(),
  contentHash: ContentHashSchema,
  capturedState: StateDigestSchema,
  currentState: StateDigestSchema,
  status: bindingStatusSchema,
  discoveryValidation: validationSchema,
  branches: z.array(z.strictObject({ branchId: z.string(), validation: validationSchema })),
  branchDisclosure: countSchema,
  governance: z.strictObject({
    status: z.enum(["conformant", "violated", "unknown", "not-applicable"]),
    regeneratedContextId: z.string(),
    reasons: z.array(z.string()),
    reasonDisclosure: countSchema,
    branches: z.array(governanceBranchSchema),
    branchDisclosure: countSchema,
    safety: safetySchema
  }),
  applicationEvidence: z.strictObject({
    status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]),
    branches: z.array(z.strictObject({ branchId: z.string(), status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]), changed: z.boolean(), reasons: z.array(z.string()) })),
    branchDisclosure: countSchema
  }),
  reasons: z.array(z.string()),
  reasonDisclosure: countSchema,
  impact: impactSchema.optional(),
  fullEvidence: z.strictObject({ operation: z.literal("reconcile"), input: z.strictObject({ contextId: z.string(), view: z.literal("full") }) })
});
var KnowledgeContextOperationOutputSchema = z.union([KnowledgeContextAgentViewSchema, KnowledgeContextResultSchema]);
var KnowledgeReconciliationOperationOutputSchema = z.union([KnowledgeReconciliationAgentViewSchema, KnowledgeReconciliationResultSchema]);
var KnowledgeContextInspectionOutputSchema = z.strictObject({
  apiVersion: z.literal(KNOWLEDGE_API_VERSION),
  view: z.literal("detail"),
  contextId: z.string(),
  contentHash: ContentHashSchema,
  capturedState: StateDigestSchema,
  currentness: z.literal("retained-only"),
  document: z.unknown().optional(),
  records: z.array(z.union([
    z.strictObject({ path: z.string(), value: z.unknown() }),
    z.strictObject({ path: z.string(), text: z.string(), textOffset: z.number().int().nonnegative(), last: z.boolean() })
  ])),
  offset: z.number().int().nonnegative(),
  disclosure: countSchema,
  nextCursor: z.string().optional()
});
var KnowledgeContextInspectOperationOutputSchema = z.union([KnowledgeContextInspectionOutputSchema, KnowledgeContextResultSchema]);
var pointerPart = (part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1");
var inlineTextUnits = 4 * 1024;
var textChunkUnits = 8 * 1024;
var pageTargetBytes = 64 * 1024;
function appendTextRecords(value, path, records) {
  for (let chunkIndex = 0; chunkIndex < Math.ceil(value.length / textChunkUnits); chunkIndex++) {
    records.push({ path, source: value, chunkIndex });
  }
}
function textBoundary(value, boundary) {
  if (boundary > 0 && boundary < value.length && value.charCodeAt(boundary) >= 56320 && value.charCodeAt(boundary) <= 57343)
    return boundary + 1;
  return boundary;
}
function detailRecord(source) {
  if (!("source" in source))
    return source;
  const start = textBoundary(source.source, source.chunkIndex * textChunkUnits);
  const end = textBoundary(source.source, Math.min(source.source.length, (source.chunkIndex + 1) * textChunkUnits));
  return { path: source.path, text: source.source.slice(start, end), textOffset: start, last: end === source.source.length };
}
function detailSkeleton(value, path, records) {
  if (typeof value === "string" && value.length > inlineTextUnits) {
    appendTextRecords(value, path, records);
    return "";
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}/${index}`;
      const recordIndex = records.length;
      records.push({ path: itemPath, value: null });
      records[recordIndex] = { path: itemPath, value: detailSkeleton(item, itemPath, records) };
    });
    return [];
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, detailSkeleton(child, `${path}/${pointerPart(key)}`, records)]));
  }
  return value;
}
function decodeDetailCursor(cursor, report) {
  let value;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid knowledge context detail cursor");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid knowledge context detail cursor");
  const decoded = value;
  if (decoded.contextId !== report.id || decoded.contentHash !== report.contentHash || typeof decoded.offset !== "number" || !Number.isSafeInteger(decoded.offset) || decoded.offset < 0) {
    throw new Error("knowledge context detail cursor does not match the retained context identity");
  }
  return decoded.offset;
}
function inspectKnowledgeContext(report, input = {}) {
  if (input.view === "full") {
    if (input.cursor !== void 0 || input.limit !== void 0)
      throw new Error("full retained context inspection does not accept paging options");
    return report;
  }
  const limit = input.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("knowledge context detail limit must be between 1 and 100 records");
  const records = [];
  const document = detailSkeleton(report, "", records);
  const offset = input.cursor === void 0 ? 0 : decodeDetailCursor(input.cursor, report);
  if (offset > records.length)
    throw new Error("knowledge context detail cursor exceeds the retained record count");
  const included = [];
  let pageBytes = 0;
  for (const source of records.slice(offset, offset + limit)) {
    const record = detailRecord(source);
    const recordBytes = bytes(record);
    if (included.length > 0 && pageBytes + recordBytes > pageTargetBytes)
      break;
    included.push(record);
    pageBytes += recordBytes;
  }
  const nextOffset = offset + included.length;
  return KnowledgeContextInspectionOutputSchema.parse({
    apiVersion: report.apiVersion,
    view: "detail",
    contextId: report.id,
    contentHash: report.contentHash,
    capturedState: report.capturedState,
    currentness: "retained-only",
    ...offset === 0 ? { document } : {},
    records: included,
    offset,
    disclosure: count(records.length, included.length),
    ...nextOffset < records.length ? { nextCursor: Buffer.from(JSON.stringify({ contextId: report.id, contentHash: report.contentHash, offset: nextOffset }), "utf8").toString("base64url") } : {}
  });
}
function bytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
function count(total, included) {
  return { total, included, omitted: total - included };
}
function sample(values, budget = messageBudget, limit = sampleLimit) {
  const included = [];
  for (const value of values) {
    const size = bytes(value) + 1;
    if (included.length < limit && size <= budget) {
      included.push(value);
      budget -= size;
    }
  }
  return { values: included, disclosure: count(values.length, included.length) };
}
function safety(branches) {
  const decisions2 = branches.flatMap((branch) => branch.decisionValidity ?? []);
  const checks = decisions2.flatMap((decision) => decision.checks);
  const evaluations2 = branches.flatMap((branch) => branch.governanceEvaluations ?? []);
  const findings = evaluations2.flatMap((evaluation) => evaluation.findings);
  return {
    blockedDecisions: decisions2.filter((decision) => decision.assessment.blocksCurrentChange).length,
    unknownDecisions: decisions2.filter((decision) => decision.baseline.kind === "unavailable" || decision.checks.some((check) => check.status === "unknown")).length,
    firedDecisionChecks: checks.filter((check) => check.status === "fired").length,
    unknownDecisionChecks: checks.filter((check) => check.status === "unknown").length,
    unobservedDecisionChecks: checks.filter((check) => check.status === "unobserved").length,
    violatedGovernance: evaluations2.filter((evaluation) => evaluation.status === "violated").length,
    unknownGovernance: evaluations2.filter((evaluation) => evaluation.status === "unknown").length,
    violatedFindings: findings.filter((finding) => finding.status === "violated").length,
    unknownFindings: findings.filter((finding) => finding.status === "unknown").length,
    unknownObligations: branches.flatMap((branch) => branch.lensObligations).filter((obligation) => obligation.status === "unknown" || obligation.unknowns.length > 0).length,
    applicationEvidenceCount: branches.reduce((total, branch) => total + branch.applicationEvidence.length, 0),
    violatedApplicationEvidence: branches.flatMap((branch) => branch.applicationEvidence).filter((item) => item.status === "assessed" && item.assessment.fulfillment.status === "violated").length,
    unknownApplicationEvidence: branches.flatMap((branch) => branch.applicationEvidence).filter((item) => item.status === "unavailable" || item.assessment.fulfillment.status === "unknown").length
  };
}
function decisions(values) {
  return sample([...values].sort((a, b) => Number(b.assessment.blocksCurrentChange) - Number(a.assessment.blocksCurrentChange)), 4096);
}
function evaluations(values) {
  return sample([...values].sort((a, b) => Number(b.status !== "conformant") - Number(a.status !== "conformant")), 4096);
}
function object(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function string(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : void 0;
}
function strings(value) {
  return Array.isArray(value) ? value.flatMap((item) => string(item) ?? []) : [];
}
function list(label2, values) {
  return values.length === 0 ? void 0 : `${label2}:
${values.map((value) => `- ${value}`).join("\n")}`;
}
function valueText(value) {
  if (typeof value === "string")
    return value;
  if (value === void 0)
    return void 0;
  return JSON.stringify(value);
}
function sourceRecord(content) {
  try {
    const parsed = object(JSON.parse(content));
    if (parsed === void 0)
      return { fallback: content };
    const record = object(parsed.record) ?? parsed;
    const authorityEnvelope = object(parsed.authority);
    if (authorityEnvelope === void 0)
      return { record };
    return { record, authority: object(authorityEnvelope.payload) ?? authorityEnvelope };
  } catch {
    return { fallback: content };
  }
}
function label(record, fallback) {
  return string(record?.title) ?? string(record?.name) ?? string(record?.key) ?? fallback;
}
function section(item, kind, heading, text) {
  return {
    // Source semantic identity keeps all branch copies of the same current fact together.
    id: `${item.entityId}:${item.sourceSemanticHash}:${kind}`,
    entityId: item.entityId,
    sourceSemanticHash: item.sourceSemanticHash,
    kind,
    heading,
    text
  };
}
function meaningFromItem(item) {
  if (item.disclosure === "identity")
    return [];
  const parsed = sourceRecord(item.content);
  if (parsed.record === void 0) {
    return parsed.fallback === void 0 ? [] : [section(item, "summary", item.entityId, parsed.fallback)];
  }
  const record = parsed.record;
  const sourceLabel = label(record, item.entityId);
  const sections = [];
  const statement = string(record.statement);
  const decision = string(record.decision);
  const steps = Array.isArray(record.steps) ? record.steps.flatMap((step) => {
    const value = object(step);
    const text = string(value?.statement);
    return text === void 0 ? [] : [`${string(value?.role) ?? "step"}: ${text}`];
  }) : [];
  if (statement !== void 0)
    sections.push(section(item, "statement", sourceLabel, statement));
  else if (decision !== void 0)
    sections.push(section(item, "decision", sourceLabel, decision));
  else if (steps.length > 0)
    sections.push(section(item, "scenario", sourceLabel, steps.join("\n")));
  else if (item.disclosure === "summary")
    sections.push(section(item, "summary", sourceLabel, string(record.summary) ?? item.content));
  const consequences = Array.isArray(record.consequences) ? record.consequences.flatMap((entry) => string(object(entry)?.explanation) ?? []) : [];
  const qualifiers = [
    list("Consequences", consequences),
    valueText(record.scope) === void 0 ? void 0 : `Scope: ${valueText(record.scope)}`,
    string(parsed.authority?.rationale) === void 0 ? void 0 : `Rationale: ${parsed.authority.rationale}`,
    list("Assumptions", strings(parsed.authority?.assumptions)),
    Array.isArray(parsed.authority?.reconsiderWhen) && parsed.authority.reconsiderWhen.length > 0 ? `Reconsider when: ${JSON.stringify(parsed.authority.reconsiderWhen)}` : void 0
  ].filter((value) => value !== void 0);
  if (qualifiers.length > 0)
    sections.push(section(item, "qualifier", `${sourceLabel} qualifiers`, qualifiers.join("\n\n")));
  const current = [
    string(record.lifecycle) === void 0 ? void 0 : `Lifecycle: ${record.lifecycle}`,
    string(record.status) === void 0 ? void 0 : `Status: ${record.status}`,
    string(parsed.authority?.status) === void 0 ? void 0 : `Authority status: ${parsed.authority.status}`,
    string(parsed.authority?.conclusion) === void 0 ? void 0 : `Authority conclusion: ${parsed.authority.conclusion}`
  ].filter((value) => value !== void 0);
  if (current.length > 0)
    sections.push(section(item, "currentness", `${sourceLabel} currentness`, current.join("\n")));
  return sections;
}
function bandPriority(band) {
  return band === "direct" ? 0 : band === "governing" ? 1 : band === "consequence" ? 2 : 3;
}
function compareCandidates(left, right) {
  return bandPriority(left.item.band) - bandPriority(right.item.band) || Number(left.hypothesis) - Number(right.hypothesis) || right.item.relevanceScore - left.item.relevanceScore || left.branchIndex - right.branchIndex || left.branchId.localeCompare(right.branchId);
}
function humanMeaning(report) {
  const candidates = report.branches.flatMap((branch, branchIndex) => branch.context.items.flatMap((item) => meaningFromItem(item).map((source) => ({ branchId: branch.id, branchIndex, hypothesis: branch.hypothesis, item, section: source }))));
  const groups = /* @__PURE__ */ new Map();
  for (const candidate of candidates)
    groups.set(candidate.section.id, [...groups.get(candidate.section.id) ?? [], candidate]);
  const ordered = [...groups.values()].map((group) => [...group].sort(compareCandidates)).sort((left, right) => compareCandidates(left[0], right[0]));
  let remaining = contentBudget;
  const included = /* @__PURE__ */ new Set();
  const sections = [];
  for (const group of ordered) {
    const primary = group[0];
    const rendered = { ...primary.section, branchIds: [...new Set(group.map(({ branchId }) => branchId))].sort() };
    const size = bytes(rendered) + 1;
    if (size > remaining)
      continue;
    included.add(rendered.id);
    sections.push(rendered);
    remaining -= size;
  }
  return { sections, disclosure: count(ordered.length, sections.length), included };
}
function projectKnowledgeContext(report, view = "agent") {
  if (view === "full")
    return report;
  const candidates = sample(report.interpretation.candidates, 4096);
  const interpretationUnknowns = sample(report.interpretation.unknowns);
  const unknowns = sample(report.unknowns);
  const failures = sample(report.analyzerFailures);
  const meaning = humanMeaning(report);
  const projected = report.branches.slice(0, sampleLimit).map((branch) => {
    const priority = (band) => band === "direct" ? 0 : band === "governing" ? 1 : 2;
    const ordered = [...branch.context.items].sort((a, b) => priority(a.band) - priority(b.band));
    const references = ordered.map((item) => {
      const ids = meaningFromItem(item).map(({ id }) => id);
      const selected = ids.filter((id) => meaning.included.has(id));
      return {
        entityId: item.entityId,
        sourceSemanticHash: item.sourceSemanticHash,
        kind: item.kind,
        band: item.band,
        disclosure: item.disclosure,
        relevanceScore: item.relevanceScore,
        relevanceReasons: item.relevanceReasons,
        uncertainty: item.uncertainty,
        confidence: item.confidence,
        sectionIds: selected,
        sectionDisclosure: count(ids.length, selected.length)
      };
    });
    const items = sample(references, 8e3, 64);
    const deferred = sample(ordered.filter((item) => {
      const ids = meaningFromItem(item).map(({ id }) => id);
      return ids.some((id) => !meaning.included.has(id)) || !items.values.some(({ entityId }) => entityId === item.entityId);
    }).map((item) => item.entityId));
    const frontier = sample(branch.frontier);
    const expansions = sample(branch.context.requiredExpansionIds);
    const obligations = sample([...branch.lensObligations].sort((a, b) => Number(b.status === "unknown") - Number(a.status === "unknown")), 4096);
    const decision = decisions(branch.decisionValidity ?? []);
    const governance = evaluations(branch.governanceEvaluations ?? []);
    const applicationEvidence = sample(branch.applicationEvidence, 2048);
    return {
      id: branch.id,
      interpretation: branch.interpretation,
      hypothesis: branch.hypothesis,
      context: {
        items: items.values,
        itemsDisclosure: items.disclosure,
        deferredEntityIds: deferred,
        meaningDisclosure: count(references.reduce((total, reference) => total + reference.sectionDisclosure.total, 0), references.reduce((total, reference) => total + reference.sectionDisclosure.included, 0)),
        requiredExpansionIds: expansions.values,
        requiredExpansionDisclosure: expansions.disclosure,
        estimatedCost: branch.context.estimatedCost,
        requiredBudgetOverrun: branch.context.requiredBudgetOverrun
      },
      frontier: frontier.values,
      frontierDisclosure: frontier.disclosure,
      lensObligations: obligations.values,
      obligationDisclosure: obligations.disclosure,
      decisionValidity: decision.values,
      decisionDisclosure: decision.disclosure,
      governanceEvaluations: governance.values,
      governanceDisclosure: governance.disclosure,
      applicationEvidence: applicationEvidence.values,
      applicationEvidenceDisclosure: applicationEvidence.disclosure,
      safety: safety([branch])
    };
  });
  const branches = sample(projected, branchBudget);
  return KnowledgeContextAgentViewSchema.parse({
    ...report.code === void 0 ? {} : { code: { ...report.code, symbols: report.code.symbols.slice(0, 20), edges: report.code.edges.slice(0, 40), unknowns: [...report.code.unknowns, ...report.code.symbols.length > 20 || report.code.edges.length > 40 ? ["Additional semantic facts are retained; use code queries with the displayed generation"] : []] } },
    apiVersion: report.apiVersion,
    view: "agent",
    id: report.id,
    request: report.request,
    persisted: report.persisted,
    contentHash: report.contentHash,
    capturedState: report.capturedState,
    interpretation: {
      status: report.interpretation.status,
      candidates: candidates.values,
      candidateDisclosure: candidates.disclosure,
      unknowns: interpretationUnknowns.values,
      unknownDisclosure: interpretationUnknowns.disclosure
    },
    branches: branches.values,
    branchDisclosure: count(report.branches.length, branches.values.length),
    meaning: { profile: { id: "human-compact", version: 1, sourceContentHash: report.contentHash }, sections: meaning.sections, disclosure: meaning.disclosure },
    unknowns: unknowns.values,
    unknownDisclosure: unknowns.disclosure,
    analyzerFailures: failures.values,
    analyzerFailureDisclosure: failures.disclosure,
    safety: safety(report.branches),
    fullEvidence: { operation: "context", inputPatch: { view: "full" }, note: "Merge inputPatch into the original context input; it is not a complete request. Preserve request, entities, namedTargets, policy, operation and persist. A persisted context can be inspected exactly through retainedEvidence; omitted content is not an absent constraint." },
    ...report.persisted ? { retainedEvidence: { operation: "context.inspect", input: { contextId: report.id } } } : {}
  });
}
function validation(value) {
  const reasons = sample(value.reasons);
  const values = sample(value.changedValueDependencyIds);
  const queries = sample(value.changedQueryDependencyIds);
  return {
    status: value.status,
    reasons: reasons.values,
    reasonDisclosure: reasons.disclosure,
    changedValueDependencyIds: values.values,
    changedValueDependencyDisclosure: values.disclosure,
    changedQueryDependencyIds: queries.values,
    changedQueryDependencyDisclosure: queries.disclosure
  };
}
function projectKnowledgeReconciliation(report, view = "agent") {
  if (view === "full")
    return report;
  const reasons = sample(report.reasons);
  const branches = sample(report.branches.map((branch) => ({ branchId: branch.branchId, validation: validation(branch.validation) })), 8e3);
  const governanceReasons = sample(report.governance.reasons);
  const governanceInputs = report.governance.branches.map((branch) => ({ decisionValidity: branch.decisionValidity ?? [], governanceEvaluations: branch.evaluations, lensObligations: [], applicationEvidence: [] }));
  const governanceBranches = sample(report.governance.branches.slice(0, sampleLimit).map((branch, index) => {
    const reasons2 = sample(branch.reasons);
    const decision = decisions(branch.decisionValidity ?? []);
    const evaluation = evaluations(branch.evaluations);
    return {
      interpretationEntityId: branch.interpretationEntityId,
      ...branch.retainedBranchId === void 0 ? {} : { retainedBranchId: branch.retainedBranchId },
      ...branch.currentBranchId === void 0 ? {} : { currentBranchId: branch.currentBranchId },
      status: branch.status,
      reasons: reasons2.values,
      reasonDisclosure: reasons2.disclosure,
      decisionValidity: decision.values,
      decisionDisclosure: decision.disclosure,
      evaluations: evaluation.values,
      evaluationDisclosure: evaluation.disclosure,
      safety: safety([governanceInputs[index]])
    };
  }), 24e3);
  const applications = sample(report.applicationEvidence.branches, 4096);
  const impact = report.impact;
  return KnowledgeReconciliationAgentViewSchema.parse({
    apiVersion: report.apiVersion,
    view: "agent",
    contextId: report.contextId,
    contentHash: report.contentHash,
    capturedState: report.capturedState,
    currentState: report.currentState,
    status: report.status,
    discoveryValidation: validation(report.discoveryValidation),
    branches: branches.values,
    branchDisclosure: branches.disclosure,
    reasons: reasons.values,
    reasonDisclosure: reasons.disclosure,
    governance: {
      status: report.governance.status,
      regeneratedContextId: report.governance.regeneratedContextId,
      reasons: governanceReasons.values,
      reasonDisclosure: governanceReasons.disclosure,
      branches: governanceBranches.values,
      branchDisclosure: count(report.governance.branches.length, governanceBranches.values.length),
      safety: safety(governanceInputs)
    },
    applicationEvidence: { status: report.applicationEvidence.status, branches: applications.values, branchDisclosure: applications.disclosure },
    ...impact === void 0 ? {} : { impact: {
      status: impact.status,
      contentHash: impact.contentHash,
      repairRoute: impact.repairRoute,
      predictedUnitIds: sample(impact.predictedUnitIds, 512),
      observedChangedUnitIds: sample(impact.observedChangedUnitIds, 512),
      knownAffectedUnitIds: sample(impact.knownAffectedUnitIds, 512),
      possibleFrontierUnitIds: sample(impact.possibleFrontierUnitIds, 512),
      backdatedUnitIds: sample(impact.backdatedUnitIds, 512),
      blockedUnitIds: sample(impact.blockedUnitIds, 512),
      surpriseCount: impact.surprises.length,
      candidateRelationCount: impact.candidateRelations.length,
      diagnostics: sample(impact.diagnostics)
    } },
    fullEvidence: { operation: "reconcile", input: { contextId: report.contextId, view: "full" } }
  });
}

// node_modules/@projector/control-plane/dist/representation/service.js
import { z as z5 } from "zod";

// node_modules/@projector/control-plane/dist/change-lifecycle/service.js
import { resolve as resolve3 } from "node:path";
import { z as z4 } from "zod";

// node_modules/@projector/control-plane/dist/change-lifecycle/compiler.js
import { relative, resolve as resolve2 } from "node:path";
import { setImmediate } from "node:timers/promises";

// node_modules/@projector/control-plane/dist/observation/change-query.js
function evaluateObservedChangeQuery(observation, now, query, context) {
  const { independentValidator: _validator, ...data } = observation;
  const { signal, ...contextData } = context;
  return withObservationScope({ signal }, (scope) => runObservationTask("change-query", { observation: data, now, query, context: contextData }, scope));
}
function calculateObservedRelevance(observation, editedPaths, signal) {
  const { independentValidator: _validator, ...data } = observation;
  return withObservationScope(signal === void 0 ? {} : { signal }, (scope) => runObservationTask("change-relevance", { observation: data, editedPaths }, scope));
}

// node_modules/@projector/control-plane/dist/observation/source.js
import { lstat as lstat2 } from "node:fs/promises";
async function readObservedText(path, signal) {
  return withObservationScope(signal === void 0 ? {} : { signal }, async (scope) => {
    scope.signal.throwIfAborted();
    try {
      await lstat2(path);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    }
    return (await readObservationFile(path, scope.budget, path, scope.signal)).toString("utf8");
  });
}
async function hashObservedText(content, signal) {
  if (content === null)
    return hashFramedDomain("transform-content", null);
  return withObservationScope(signal === void 0 ? {} : { signal }, (scope) => runObservationTask("hash-content", { content }, scope));
}

// node_modules/@projector/control-plane/dist/change-lifecycle/architecture-products.js
function validateArchitectureProducts(documents, now, changedIds) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const decisions2 = documents.filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload));
  const active = decisions2.filter(({ lifecycle }) => lifecycle === "active");
  const concerns = documents.filter(({ kind }) => kind === "architecture-concern").map(({ payload }) => ArchitectureConcernSchema.parse(payload));
  const preferences = documents.filter(({ kind }) => kind === "developer-preference").map(({ payload }) => DeveloperPreferenceSchema.parse(payload));
  const changedDecisionIds = new Set(decisions2.filter(({ id }) => changedIds.has(id)).map(({ id }) => id));
  const touchedConcernIds = /* @__PURE__ */ new Set([
    ...decisions2.filter(({ id }) => changedDecisionIds.has(id)).map(({ concernId }) => concernId),
    ...concerns.filter(({ id, decisionIds }) => changedIds.has(id) || decisionIds.some((decisionId) => changedDecisionIds.has(decisionId))).map(({ id }) => id)
  ]);
  for (const concern of concerns.filter(({ id }) => touchedConcernIds.has(id))) {
    for (const [ids, kind] of [[concern.relatedConceptIds, "concept"], [concern.relatedRequirementIds, "requirement"], [concern.decisionIds, "architecture-decision"]]) {
      for (const id of ids)
        if (byId.get(id)?.kind !== kind)
          throw new Error(`concern ${concern.id} references missing or wrong-kind ${id}`);
    }
    for (const id of concern.decisionIds)
      if (decisions2.find((decision) => decision.id === id)?.concernId !== concern.id)
        throw new Error(`concern ${concern.id} lists decision ${id} owned by another concern`);
    for (const decision of active.filter(({ concernId }) => concernId === concern.id))
      if (!concern.decisionIds.includes(decision.id))
        throw new Error(`concern ${concern.id} must index active decision ${decision.id} in decisionIds; revise the concern in the same canonical proposal`);
    if (concern.status === "resolved" && !active.some((decision) => decision.concernId === concern.id))
      throw new Error(`resolved concern ${concern.id} has no active decision; use dismissed with rationale when no decision is needed`);
    if (concern.status === "deferred") {
      const deferral = concern.deferral;
      if (deferral === void 0 || !deferral.rationale.trim() || deferral.preserveOptionality.length === 0 || deferral.forbiddenCommitments.length === 0 || deferral.reconsiderWhen.length === 0)
        throw new Error(`deferred concern ${concern.id} needs rationale, preserved options, forbidden commitments and reconsideration conditions`);
      if (deferral.reviewBy !== void 0 && (!Number.isFinite(Date.parse(deferral.reviewBy)) || Date.parse(deferral.reviewBy) <= Date.parse(now)))
        throw new Error(`deferred concern ${concern.id} has an invalid or expired review date`);
    }
  }
  for (const decision of active) {
    const decisionChanged = changedIds.has(decision.id);
    const concernChanged = changedIds.has(decision.concernId);
    if (!decisionChanged && !concernChanged && !decision.consequences.some(({ targetId }) => targetId !== void 0 && changedIds.has(targetId)))
      continue;
    const concern = byId.get(decision.concernId);
    if (decisionChanged && concern?.kind !== "architecture-concern")
      throw new Error(`changed active decision ${decision.id} requires a real architecture-concern ${decision.concernId}; include or repair the concern in the same canonical proposal`);
    if ((decisionChanged || concernChanged) && concern?.kind === "architecture-concern") {
      const owner = ArchitectureConcernSchema.parse(concern.payload);
      if (canonicalJson(normalizeSelector(decision.scope)) !== canonicalJson(normalizeSelector(owner.scope)))
        throw new Error(`decision ${decision.id} scope must match the normalized scope of concern ${owner.id}; author an explicitly scoped concern and update its decisionIds when the decision needs a different boundary`);
    }
    for (const preference of decision.appliedPreferences.filter(() => decisionChanged)) {
      if (preference.scope !== "project")
        throw new Error(`decision ${decision.id} cannot claim ${preference.scope} preference ${preference.key} without an authenticated provider; explicitly adopt the preference as a project record and cite that accepted project hash`);
      const adopted = preferences.find(({ key }) => key === preference.key);
      if (adopted === void 0 || adopted.scope !== "project" || adopted.status !== "active" || adopted.semanticHash !== preference.semanticHash)
        throw new Error(`decision ${decision.id} cites a missing, inactive or stale project preference ${preference.key}`);
    }
    for (const consequence of decision.consequences)
      validateConsequence(decision, consequence, byId);
  }
  validateTouchedDecisionCycles(active, changedIds);
}
function validateTouchedDecisionCycles(decisions2, changedIds) {
  const byId = new Map(decisions2.map((decision) => [decision.id, decision]));
  const complete = /* @__PURE__ */ new Set();
  const visit = (id, path) => {
    const cycleAt = path.indexOf(id);
    if (cycleAt >= 0)
      throw new Error(`decision constraint cycle ${[...path.slice(cycleAt), id].join(" -> ")} lacks a supported convergence proof; revise the touched constrain-decision consequences to be acyclic`);
    if (complete.has(id))
      return;
    const decision = byId.get(id);
    for (const consequence of decision?.consequences ?? [])
      if (consequence.kind === "constrain-decision" && consequence.targetId !== void 0 && byId.has(consequence.targetId))
        visit(consequence.targetId, [...path, id]);
    complete.add(id);
  };
  for (const decision of decisions2.filter(({ id }) => changedIds.has(id)))
    visit(decision.id, []);
}
function validateConsequence(decision, consequence, documents) {
  if (consequence.kind === "advisory")
    return;
  if (consequence.kind === "select-technology" || consequence.kind === "deprecate-technology")
    throw new Error(`decision ${decision.id} consequence ${consequence.kind} is unsupported because no authenticated technology product is available; record the choice and options in the architecture decision and express concrete obligations through an explicit constraint concept`);
  const target = consequence.targetId === void 0 ? void 0 : documents.get(consequence.targetId);
  const fail = (reason) => {
    throw new Error(`decision ${decision.id} consequence ${consequence.kind}: ${reason}; include the corresponding canonical product in the same proposal`);
  };
  if (target === void 0)
    fail(`target ${consequence.targetId ?? "(missing)"} is unavailable`);
  const record = target;
  if (consequence.scope !== void 0) {
    const targetScope = record.payload.scope ?? record.payload.selector;
    if (targetScope === void 0 || typeof targetScope !== "object" || targetScope === null)
      fail("declared scope has no supported target scope or selector to verify");
    let scopesMatch = false;
    try {
      scopesMatch = canonicalJson(normalizeSelector(consequence.scope)) === canonicalJson(normalizeSelector(targetScope));
    } catch {
      fail("declared scope or target scope cannot be normalized by the supported selector evaluator");
    }
    if (!scopesMatch)
      fail("declared scope does not match the canonical target scope or selector");
  }
  for (const [field, expected] of Object.entries(consequence.payload ?? {})) {
    if (!Object.hasOwn(record.payload, field))
      fail(`declared payload field ${field} is unsupported by the canonical target`);
    if (canonicalJson(record.payload[field]) !== canonicalJson(expected))
      fail(`declared payload field ${field} does not match the canonical target`);
  }
  const active = record.payload.status === "active" || record.payload.lifecycle === "active";
  const retired = record.payload.status === "retired" || record.payload.lifecycle === "retired" || record.payload.lifecycle === "superseded";
  const isGovernance = record.kind === "projection-lens" || record.kind === "rule";
  switch (consequence.kind) {
    case "activate-governance": {
      if (!isGovernance || record.kind === "projection-lens" && !active)
        fail("target is not active executable governance");
      const basis = record.payload.governanceBasis;
      if (!basis?.some((item) => item.kind === "architecture-decision" && item.decisionId === decision.id))
        fail("governance target does not retain this decision as its basis");
      break;
    }
    case "deactivate-governance":
      if (record.kind !== "projection-lens" || active)
        fail("target lens remains active or has no supported deactivation state");
      break;
    case "introduce-constraint":
    case "retire-constraint": {
      if (record.kind !== "concept")
        fail("target is not an accepted concept");
      const concept = ConceptSchema.parse(record.payload);
      if (consequence.kind === "introduce-constraint" && concept.kind !== "constraint" && concept.kind !== "invariant")
        fail("target is not a constraint or invariant");
      if (consequence.kind === "introduce-constraint" ? !active : !retired)
        fail("target lifecycle does not implement the consequence");
      break;
    }
    case "activate-concern":
      if (record.kind !== "architecture-concern" || record.payload.status !== "active")
        fail("target is not an active concern");
      break;
    case "constrain-decision": {
      if (record.kind !== "architecture-decision" || !active)
        fail("target is not an active decision");
      const targetDecision = ArchitectureDecisionSchema.parse(record.payload);
      if (!targetDecision.governanceBasis.some((basis) => basis.kind === "architecture-decision" && basis.decisionId === decision.id))
        fail("target decision does not retain the constraining decision as a basis");
      break;
    }
    case "require-migration":
      if (record.kind !== "migration" || record.payload.phase === "rolled-back")
        fail("target is not an accepted migration");
      break;
  }
}

// node_modules/@projector/control-plane/dist/knowledge/canonical-governance.js
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function validateCanonicalRelationEndpoints(relations, knownIds, options) {
  const unresolved = [];
  for (const relation of relations)
    if (relation.active && (!knownIds.has(relation.fromId) || !knownIds.has(relation.toId))) {
      const issue = `relation ${relation.id} has a dangling endpoint`;
      if (options.populationComplete || options.removedIds?.has(relation.fromId) || options.removedIds?.has(relation.toId))
        throw new Error(issue);
      unresolved.push(`${issue}: ${[relation.fromId, relation.toId].filter((id) => !knownIds.has(id)).join(", ")}; external identity population is unobserved`);
    }
  return unresolved;
}
function assertEligibleAuthority(record, subjectId, label2) {
  if (record.subjectId !== subjectId)
    throw new Error(`${label2} authority ${record.id} is bound to ${record.subjectId}, expected ${subjectId}`);
  if (record.status !== "approved" && record.status !== "auto-approved")
    throw new Error(`${label2} authority ${record.id} is not approved`);
  if (record.conclusion === "unknown" || record.conclusion === "exception")
    throw new Error(`${label2} authority ${record.id} does not authorize activation`);
  if (record.decidedBy === "system" && record.status !== "auto-approved")
    throw new Error(`system authority ${record.id} lacks auto-approval`);
}
function isEligibleAuthority(record) {
  return (record.status === "approved" || record.status === "auto-approved") && record.conclusion !== "unknown" && record.conclusion !== "exception" && (record.decidedBy !== "system" || record.status === "auto-approved");
}
function validateStaticCanonicalGovernance(documents, knownAfterIds, options) {
  const documentsAfter = new Map(documents.map((d) => [d.id, d]));
  const unresolved = [];
  const authoritiesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "authority-record").map(({ payload }) => AuthorityRecordSchema.parse(payload));
  const authorityById = new Map(authoritiesAfter.map((record) => [record.id, record]));
  const decisionsAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "architecture-decision").map(({ payload }) => ArchitectureDecisionSchema.parse(payload));
  const lensesAfter = [...documentsAfter.values()].filter(({ kind }) => kind === "projection-lens").map(({ payload }) => ProjectionLensSchema.parse(payload));
  const decisionConcernIds = new Set(decisionsAfter.map(({ concernId }) => concernId));
  for (const authority of authoritiesAfter.filter(isEligibleAuthority))
    if (!knownAfterIds.has(authority.subjectId) && !decisionConcernIds.has(authority.subjectId)) {
      const issue = `authority ${authority.id} has a dangling subject ${authority.subjectId}`;
      if (options.populationComplete || options.removedIds?.has(authority.subjectId))
        throw new Error(issue);
      unresolved.push(issue);
    }
  for (const decision of decisionsAfter.filter(({ lifecycle }) => lifecycle === "active")) {
    const authority = authorityById.get(decision.authorityRecordId);
    if (authority === void 0)
      throw new Error(`active decision ${decision.id} has no authority record ${decision.authorityRecordId}`);
    assertEligibleAuthority(authority, decision.concernId, `active decision ${decision.id}`);
  }
  const activeByConcern = /* @__PURE__ */ new Map();
  for (const decision of decisionsAfter) {
    if (decision.lifecycle === "active")
      activeByConcern.set(decision.concernId, [...activeByConcern.get(decision.concernId) ?? [], decision.id]);
    for (const supersededId of decision.supersedesDecisionIds) {
      const targetDocument = documentsAfter.get(supersededId);
      if (targetDocument?.kind !== "architecture-decision")
        throw new Error(`decision ${decision.id} supersedes a missing or non-decision target ${supersededId}`);
      const target = ArchitectureDecisionSchema.parse(targetDocument.payload);
      if (target.concernId !== decision.concernId)
        throw new Error(`decision ${decision.id} cannot supersede ${supersededId} from another concern`);
      if (target.lifecycle !== "superseded")
        throw new Error(`superseded decision ${supersededId} must be superseded in the proposed final state`);
    }
  }
  for (const [concernId, ids] of activeByConcern)
    if (ids.length > 1)
      throw new Error(`concern ${concernId} has multiple active decisions: ${ids.sort(compare).join(", ")}`);
  for (const governed of [...decisionsAfter.filter(({ lifecycle }) => lifecycle === "active"), ...lensesAfter.filter(({ status }) => status === "active")])
    for (const basis of governed.governanceBasis) {
      const referencedId = basis.kind === "architecture-decision" ? basis.decisionId : basis.kind === "hard-constraint" ? basis.conceptId : basis.kind === "adopted-standard" ? basis.authorityRecordId : basis.kind === "migration-overlay" ? basis.migrationId : basis.kind === "active-lens" ? basis.lensId : void 0;
      if (referencedId === void 0)
        continue;
      const target = documentsAfter.get(referencedId);
      const expectedKind = basis.kind === "architecture-decision" ? "architecture-decision" : basis.kind === "hard-constraint" ? "concept" : basis.kind === "adopted-standard" ? "authority-record" : basis.kind === "migration-overlay" ? "migration" : "projection-lens";
      if (target?.kind !== expectedKind)
        throw new Error(`${governed.id} governance basis ${basis.kind} references missing or wrong-kind ${referencedId}`);
      if (basis.kind === "hard-constraint") {
        const concept = ConceptSchema.parse(target.payload);
        if (concept.status !== "active")
          throw new Error(`${governed.id} hard constraint ${referencedId} is not active`);
      } else if (basis.kind === "architecture-decision") {
        const decision = ArchitectureDecisionSchema.parse(target.payload);
        if (decision.lifecycle !== "active")
          throw new Error(`${governed.id} decision basis ${referencedId} is not active`);
      } else if (basis.kind === "adopted-standard") {
        const authority = AuthorityRecordSchema.parse(target.payload);
        const subjectId = "concernId" in governed ? governed.concernId : governed.id;
        assertEligibleAuthority(authority, subjectId, `${governed.id} adopted-standard basis`);
      } else if (basis.kind === "active-lens") {
        const lens = ProjectionLensSchema.parse(target.payload);
        if (lens.status !== "active")
          throw new Error(`${governed.id} lens basis ${referencedId} is not active`);
      }
    }
  compileProjectionLenses({ lenses: lensesAfter, units: [], authorityRecords: authoritiesAfter, ...options.derivedBudget ? { derivedBudget: options.derivedBudget } : {} });
  return unresolved;
}

// node_modules/@projector/control-plane/dist/change-lifecycle/compiler.js
var compare2 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique = (values) => [...new Set(values)].sort(compare2);
var placeholder = hashFramedDomain("repository-change-canonical-placeholder", null);
async function withCancellation(operation, signal) {
  signal?.throwIfAborted();
  const result = await operation;
  signal?.throwIfAborted();
  return result;
}
function baselineObservation(observation) {
  const value = {
    files: observation.analysis.files.map(({ path, contentHash }) => ({ path, contentHash })).sort((left, right) => compare2(left.path, right.path)),
    canonicalEntries: observation.canonical.entries.map(({ entityId, canonicalDocumentHash }) => ({ entityId, canonicalDocumentHash })).sort((left, right) => compare2(left.entityId, right.entityId)),
    units: observation.analysis.projectionUnits.map(({ id, key, membershipHash, validity }) => ({ id, key, membershipHash, validity })).sort((left, right) => compare2(left.id, right.id)),
    analyzerFailures: observation.analysis.failures.map(({ analyzerId, capability, scope, message, affectedClaimKinds }) => ({ analyzerId, capability, scope, message, affectedClaimKinds: [...affectedClaimKinds].sort(compare2) })).sort((left, right) => compare2(canonicalJson(left), canonicalJson(right)))
  };
  return { ...value, contentHash: hashFramedDomain("repository-change-baseline-observation", value) };
}
function identityEvidence(kind, requestedKey, claims, candidates, targetId, canonicalRootDigest) {
  const value = {
    kind,
    requestedKey,
    searchedClaims: unique(claims.map((claim) => claim.normalize("NFKC").trim().toLocaleLowerCase("en-US"))),
    candidateIds: unique(candidates.map(({ id: id2 }) => id2)),
    outcome: candidates.length === 0 ? "create-new" : "reuse-existing",
    targetId,
    canonicalRootDigest
  };
  const contentHash = hashFramedDomain("repository-change-identity-resolution", value);
  const id = `identity_resolution_${contentHash.slice(-32)}`;
  return { id, ...value, contentHash };
}
function scopeFor(paths) {
  const atoms = unique(paths).map((path) => ({ op: "atom", field: "path", matcher: "equals", value: path }));
  return atoms.length === 1 ? atoms[0] : { op: "any", items: atoms };
}
function proposedRequirementPayload(proposal, existing, id, proposalHash, paths) {
  assertExplicitRevision(proposal, existing, existing !== void 0 && (proposal.title !== existing.title || proposal.statement !== existing.statement));
  if (existing !== void 0 && proposal.revision === void 0)
    return existing;
  const key = existing?.key ?? proposal.key;
  const origin = [...existing?.origin ?? [], {
    kind: "document",
    locator: `proposal:${proposalHash}`,
    contentHash: proposalHash,
    description: proposal.revision === void 0 ? "Structured interpretation proposed for approval; not a verbatim user request." : `Proposed revision of ${proposal.revision.id} at ${proposal.revision.expectedSemanticHash}: ${proposal.revision.rationale}`
  }];
  return {
    ...existing ?? {},
    id,
    key,
    title: proposal.title,
    aliases: unique([...existing?.aliases ?? [], ...proposal.aliases, ...key === proposal.key ? [] : [proposal.key]]),
    statement: proposal.statement,
    status: "active",
    sourceClass: "authored",
    scope: existing?.scope ?? scopeFor(paths),
    origin: [...new Map(origin.map((item) => [canonicalJson(item), item])).values()],
    evidence: existing?.evidence ?? [],
    discoveryHash: existing?.discoveryHash ?? placeholder,
    semanticHash: existing?.semanticHash ?? placeholder
  };
}
function proposedScenarioPayload(proposal, existing, id, paths) {
  assertExplicitRevision(proposal, existing, existing !== void 0 && (proposal.title !== existing.title || canonicalJson(proposal.steps) !== canonicalJson(existing.steps)));
  if (existing !== void 0 && proposal.revision === void 0)
    return existing;
  const key = existing?.key ?? proposal.key;
  return {
    ...existing ?? {},
    id,
    key,
    title: proposal.title,
    aliases: unique([...existing?.aliases ?? [], ...proposal.aliases, ...key === proposal.key ? [] : [proposal.key]]),
    status: "active",
    sourceClass: "authored",
    scope: existing?.scope ?? scopeFor(paths),
    steps: proposal.steps.map((step) => ({ ...step })),
    evidence: existing?.evidence ?? [],
    discoveryHash: existing?.discoveryHash ?? placeholder,
    semanticHash: existing?.semanticHash ?? placeholder
  };
}
function assertExplicitRevision(proposal, existing, contentChanged) {
  const revision = proposal.revision;
  if (revision !== void 0 && (existing === void 0 || revision.id !== existing.id || revision.expectedSemanticHash !== existing.semanticHash)) {
    throw new Error(`canonical revision target or semantic hash is stale: ${proposal.key}`);
  }
  if (existing !== void 0 && existing.status !== "active")
    throw new Error(`canonical intent is not active: ${existing.id}`);
  if (contentChanged && revision === void 0) {
    throw new Error(`implicit canonical revision is forbidden for ${existing.id}; preserve its exact title and meaning, or supply revision.id, expectedSemanticHash, and rationale`);
  }
  if (revision !== void 0 && !contentChanged)
    throw new Error(`canonical revision does not change title or meaning: ${existing.id}`);
}
async function optionalText(path) {
  return readObservedText(path);
}
async function canonicalWrite(repositoryRoot, repository, locations, kind, id, key, payload) {
  const body = { ...payload };
  const lifecycle = kind === "relation" ? body.active === true ? "active" : "inactive" : kind === "tombstone" ? "deleted" : typeof body.lifecycle === "string" ? body.lifecycle : typeof body.status === "string" ? body.status : "active";
  const envelope = withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind, id, key, lifecycle, payload: body });
  const existing = locations.get(id);
  if (existing !== void 0 && existing.kind !== kind)
    throw new Error(`canonical identity kind changed: ${id}`);
  const prepared = repository.prepareWrite(envelope, existing === void 0 ? {} : { existingPath: existing.path });
  const before = await optionalText(prepared.path);
  if (existing === void 0 && before !== null)
    throw new Error(`canonical filename is already owned; choose a distinct readable title for ${id}`);
  return {
    id,
    kind,
    path: relative(repositoryRoot, prepared.path).replaceAll("\\", "/"),
    before,
    after: prepared.contents,
    envelope
  };
}
async function canonicalDelete(repositoryRoot, locations, document) {
  const kind = document.kind;
  const located = locations.get(document.id);
  if (located !== void 0 && located.kind !== kind)
    throw new Error(`canonical identity kind changed: ${document.id}`);
  if (located === void 0)
    throw new Error(`canonical retirement source disappeared: ${document.id}`);
  const absolutePath = located.path;
  const before = await optionalText(absolutePath);
  if (before === null)
    throw new Error(`canonical retirement source disappeared: ${document.id}`);
  return {
    id: document.id,
    kind,
    path: relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
    before,
    after: null,
    envelope: document
  };
}
var canonicalMutationSchemas = {
  requirement: RequirementSchema,
  "behavioral-scenario": BehavioralScenarioSchema,
  concept: ConceptSchema,
  relation: RelationSchema,
  "architecture-decision": ArchitectureDecisionSchema,
  "architecture-concern": ArchitectureConcernSchema,
  "developer-preference": DeveloperPreferenceSchema,
  "projection-lens": ProjectionLensSchema,
  "authority-record": AuthorityRecordSchema
};
function parsedMutationPayload(mutation) {
  const supplied = mutation.payload;
  const payloadWithNestedHashes = mutation.kind === "projection-lens" ? {
    ...supplied,
    rules: supplied.rules.map((rule) => ({ ...rule, semanticHash: hashSemantic("rule", rule) })),
    impactRules: supplied.impactRules.map((rule) => ({ ...rule, semanticHash: hashFramedDomain("impact-rule", rule) }))
  } : supplied;
  const result = canonicalMutationSchemas[mutation.kind].safeParse({
    ...payloadWithNestedHashes,
    semanticHash: mutation.kind === "behavioral-scenario" ? hashSemantic("behavioral-scenario", payloadWithNestedHashes) : placeholder,
    ...["concept", "requirement", "behavioral-scenario"].includes(mutation.kind) ? { discoveryHash: placeholder } : {}
  });
  if (!result.success)
    throw new Error(`invalid ${mutation.kind} mutation payload: ${result.error.message}`);
  const payload = result.data;
  if (["concept", "requirement", "behavioral-scenario", "relation", "architecture-concern", "developer-preference"].includes(mutation.kind) && payload.sourceClass !== "authored") {
    throw new Error(`${mutation.kind} mutations must be explicitly authored; observed or inferred material cannot be promoted`);
  }
  if (mutation.kind === "developer-preference" && payload.scope !== "project")
    throw new Error("repository preferences must be explicitly adopted with project scope; local user and organization preferences cannot become shared authority implicitly");
  return payload;
}
function mutationKey(kind, payload) {
  if (kind === "relation")
    return `relation:${String(payload.id)}`;
  if (typeof payload.key !== "string" || payload.key.trim() === "")
    throw new Error(`${kind} mutation payload requires a key`);
  return payload.key;
}
function defaultRepresentationArtifacts() {
  const values = /* @__PURE__ */ new Map();
  return { put: async (hash, content) => {
    const prior = values.get(hash);
    if (prior !== void 0 && prior !== content)
      throw new Error("representation artifact hash collision");
    values.set(hash, content);
  }, get: async (hash) => values.get(hash) };
}
async function compileRepresentation(change, artifacts, profileKey) {
  const tokenizer = { profileId: "projector.whitespace@1", measure: (text) => text.trim() === "" ? 0 : text.trim().split(/\s+/u).length };
  const compiler = new RepresentationCompiler({
    artifacts,
    tokenizer,
    utility: { profileId: "projector.instruction-cost@1", measure: ({ source, candidate, profileOverheadTokens }) => ({ netInstructionEfficiency: tokenizer.measure(source.statements.map(({ text }) => text).join("\n")) - tokenizer.measure(candidate) - profileOverheadTokens, evidence: "deterministic total instruction payload cost including profile overhead" }) }
  });
  const { projection } = await compiler.compileBest({ source: canonicalRepresentationSourceFromSemanticChange(change.change), binding: change.boundState, requestedProfileKey: profileKey });
  return {
    reference: { projectionId: projection.id, profileId: projection.profileId, profileVersion: projection.profileVersion, contentHash: projection.contentHash, preservationHash: projection.preservation.semanticHash },
    projection
  };
}
async function compileRepositoryChange(input, options = {}) {
  return withObservationScope(options.signal === void 0 ? {} : { signal: options.signal }, () => compileObservedRepositoryChange(input, options));
}
async function compileObservedRepositoryChange(input, options) {
  options.signal?.throwIfAborted();
  const request = input.request.normalize("NFKC").trim();
  if (request.length === 0 || request.length > 16384 || request.includes("\0"))
    throw new Error("natural-language change request must be nonblank bounded UTF-8 text");
  const now = input.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const executionKind = input.proposal.edits.length === 0 ? "canonical-only" : "repository-code";
  const representationProfileKey = options.representationProfileKey ?? "agent-compact@2";
  const representationProfile = BUILT_IN_REPRESENTATION_PROFILES[representationProfileKey];
  const semanticAnalysisFacets = input.proposal.analysisFacets.filter((facet) => facet !== "workspace-expansion");
  if (input.proposal.architecture !== null) {
    const deferralDurationMs = Date.parse(input.proposal.architecture.deferral.validUntil) - Date.parse(now);
    if (deferralDurationMs <= 0)
      throw new Error("architecture deferral is expired");
    if (deferralDurationMs > 366 * 24 * 60 * 60 * 1e3)
      throw new Error("architecture deferral horizon exceeds one year");
  }
  const observation = options.observation ?? await withCancellation(observeChangeRepository(input.repositoryRoot), options.signal);
  if (resolve2(observation.repositoryRoot) !== resolve2(input.repositoryRoot))
    throw new Error("Compilation observation belongs to a different repository");
  const queryRegistry = createChangeQueryRegistry({ observation, now });
  const proposalHash = hashFramedDomain("repository-change-proposal", input.proposal);
  const context = { repositoryRoot: input.repositoryRoot, stateDigest: observation.state, config: {}, signal: options.signal ?? new AbortController().signal };
  const paths = await withCancellation(RepositoryPathService.create(input.repositoryRoot), options.signal);
  for (const edit of input.proposal.edits) {
    options.signal?.throwIfAborted();
    let actual;
    try {
      const resolved = await withCancellation(paths.resolveRead(edit.path), options.signal);
      actual = await readObservedText(resolved.realTarget, options.signal);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        actual = null;
      else
        throw error;
    }
    if (actual !== edit.before)
      throw new Error(`proposal exact before content is stale: ${edit.path}`);
  }
  const independentValidators = await withCancellation(Promise.all(input.proposal.validation.independentNodeTests.map((path) => observation.independentValidator(path))), options.signal);
  const canonical = new CanonicalFileRepository(input.repositoryRoot);
  const canonicalLocations = new Map((await canonical.locations()).map((location) => [location.id, location]));
  const retiredEntityIds = new Set(observation.canonical.documents.filter(({ kind }) => kind === "tombstone").map(({ payload }) => String(payload.entityId)));
  const assertAdditionIsNotRetired = (kind, id) => {
    if (retiredEntityIds.has(id))
      throw new Error(`${kind} stable ID is retired by an immutable tombstone: ${id}`);
  };
  const existingRequirements = observation.canonical.documents.filter(({ kind }) => kind === "requirement").map(({ payload }) => RequirementSchema.parse(payload));
  const existingScenarios = observation.canonical.documents.filter(({ kind }) => kind === "behavioral-scenario").map(({ payload }) => BehavioralScenarioSchema.parse(payload));
  const editedPaths = input.proposal.edits.map(({ path }) => path);
  const identityResolutions = [];
  const identityQueries = [];
  const canonicalWrites = [];
  const operations = [];
  const reviewSubjects = [];
  for (const proposed of input.proposal.requirements) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "requirement", claims);
    if (candidates.length > 1)
      throw new Error(`ambiguous duplicate requirement identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.requirement", proposed.key);
    if (candidates.length === 0 && existingRequirements.some(({ id }) => id === derivedId))
      throw new Error(`requirement stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    if (existing === void 0)
      assertAdditionIsNotRetired("requirement", targetId);
    const resolution = identityEvidence("requirement", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:requirement:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "requirement", claims } });
    const priorResult = await evaluateObservedChangeQuery(observation, now, query, context);
    if (priorResult.resultCount !== candidates.length)
      throw new Error(`authenticated requirement identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution);
    identityQueries.push({ query, priorResult, role: "exact requirement key and alias negative-space search" });
    const payload = proposedRequirementPayload(proposed, existing, targetId, proposalHash, editedPaths);
    reviewSubjects.push({ id: targetId, kind: "requirement", operation: existing === void 0 ? "add" : proposed.revision === void 0 ? "preserve" : "revise", before: existing ?? null, after: payload, rationale: proposed.revision?.rationale ?? null });
    if (existing !== void 0 && proposed.revision === void 0)
      continue;
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, canonicalLocations, "requirement", targetId, payload.key, payload), options.signal);
    reviewSubjects[reviewSubjects.length - 1] = { ...reviewSubjects.at(-1), after: RequirementSchema.parse(write.envelope.payload) };
    if (write.before !== write.after) {
      canonicalWrites.push(write);
      operations.push({ subjectType: "requirement", kind: existing === void 0 ? "add" : "modify", requirementId: targetId, proposedRequirement: payload, rationale: proposed.revision?.rationale ?? `structured proposal ${proposalHash}` });
    }
  }
  for (const proposed of input.proposal.scenarios) {
    const claims = [proposed.key, ...proposed.aliases];
    const candidates = exactIdentityCandidates(observation, "scenario", claims);
    if (candidates.length > 1)
      throw new Error(`ambiguous duplicate scenario identity: ${proposed.key}`);
    const derivedId = deriveEntityId("projector.scenario", proposed.key);
    if (candidates.length === 0 && existingScenarios.some(({ id }) => id === derivedId))
      throw new Error(`scenario stable ID is occupied by an unrelated identity: ${derivedId}`);
    const existing = candidates[0];
    const targetId = existing?.id ?? derivedId;
    if (existing === void 0)
      assertAdditionIsNotRetired("behavioral-scenario", targetId);
    const resolution = identityEvidence("scenario", proposed.key, claims, candidates, targetId, observation.canonical.rootDigest);
    const query = queryRegistry.createSpec({ id: `identity:scenario:${resolution.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "scenario", claims } });
    const priorResult = await evaluateObservedChangeQuery(observation, now, query, context);
    if (priorResult.resultCount !== candidates.length)
      throw new Error(`authenticated scenario identity query disagrees with resolved candidates: ${proposed.key}`);
    identityResolutions.push(resolution);
    identityQueries.push({ query, priorResult, role: "exact scenario key and alias negative-space search" });
    const payload = proposedScenarioPayload(proposed, existing, targetId, editedPaths);
    reviewSubjects.push({ id: targetId, kind: "scenario", operation: existing === void 0 ? "add" : proposed.revision === void 0 ? "preserve" : "revise", before: existing ?? null, after: payload, rationale: proposed.revision?.rationale ?? null });
    if (existing !== void 0 && proposed.revision === void 0)
      continue;
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, canonicalLocations, "behavioral-scenario", targetId, payload.key, payload), options.signal);
    reviewSubjects[reviewSubjects.length - 1] = { ...reviewSubjects.at(-1), after: BehavioralScenarioSchema.parse(write.envelope.payload) };
    if (write.before !== write.after) {
      canonicalWrites.push(write);
      operations.push({ subjectType: "scenario", kind: existing === void 0 ? "add" : "modify", scenarioId: targetId, proposedScenario: payload, rationale: proposed.revision?.rationale ?? `structured proposal ${proposalHash}` });
    }
  }
  const mutationReviews = [];
  const documentsAfter = new Map(observation.canonical.documents.map((document) => [document.id, document]));
  for (const write of canonicalWrites)
    documentsAfter.set(write.id, write.envelope);
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind === "lineage")
      continue;
    const payload = parsedMutationPayload(mutation);
    const id = String(payload.id);
    const existing = documentsAfter.get(id);
    if (mutation.operation === "add") {
      if (existing !== void 0)
        throw new Error(`canonical addition expected ${id} to be absent`);
      if (mutation.kind === "concept" || mutation.kind === "requirement" || mutation.kind === "behavioral-scenario")
        assertAdditionIsNotRetired(mutation.kind, id);
      const duplicateKey = [...documentsAfter.values()].find((document) => document.kind === mutation.kind && document.key === mutationKey(mutation.kind, payload));
      if (duplicateKey !== void 0)
        throw new Error(`${mutation.kind} key is already owned by ${duplicateKey.id}`);
    } else {
      if (existing === void 0 || existing.kind !== mutation.kind)
        throw new Error(`canonical revision target is absent or has another kind: ${id}`);
      if (existing.semanticHash !== mutation.expectedSemanticHash || existing.canonicalDocumentHash !== mutation.expectedDocumentHash) {
        throw new Error(`canonical revision target hashes are stale: ${id}`);
      }
    }
    const write = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, canonicalLocations, mutation.kind, id, mutationKey(mutation.kind, payload), payload), options.signal);
    if (mutation.operation === "revise" && existing?.canonicalDocumentHash === write.envelope.canonicalDocumentHash) {
      throw new Error(`canonical revision is a no-op: ${id}`);
    }
    canonicalWrites.push(write);
    documentsAfter.set(id, write.envelope);
    mutationReviews.push({ id, kind: mutation.kind, operation: mutation.operation, before: existing?.payload ?? null, after: write.envelope.payload, rationale: mutation.rationale });
    if (mutation.kind === "requirement")
      operations.push({ subjectType: "requirement", kind: mutation.operation === "add" ? "add" : "modify", requirementId: id, proposedRequirement: RequirementSchema.parse(write.envelope.payload), rationale: mutation.rationale });
    else if (mutation.kind === "behavioral-scenario")
      operations.push({ subjectType: "scenario", kind: mutation.operation === "add" ? "add" : "modify", scenarioId: id, proposedScenario: BehavioralScenarioSchema.parse(write.envelope.payload), rationale: mutation.rationale });
    else
      operations.push({
        subjectType: mutation.kind === "architecture-decision" ? "decision" : mutation.kind === "projection-lens" ? "lens" : mutation.kind === "concept" || mutation.kind === "relation" ? mutation.kind : "other",
        subjectKey: mutationKey(mutation.kind, payload),
        subjectId: id,
        kind: mutation.operation === "add" ? mutation.kind === "projection-lens" ? "adopt-rule" : "add" : "modify",
        payload: { ...write.envelope.payload, revisionRationale: mutation.rationale }
      });
  }
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind !== "lineage")
      continue;
    const sources = mutation.sources.map((source) => {
      if (canonicalWrites.some(({ id }) => id === source.id)) {
        throw new Error(`lineage source cannot also be revised in the same proposal: ${source.id}`);
      }
      const document = documentsAfter.get(source.id);
      if (document === void 0 || document.kind !== source.kind) {
        throw new Error(`lineage source is absent or has another kind: ${source.id}`);
      }
      if (document.semanticHash !== source.expectedSemanticHash || document.canonicalDocumentHash !== source.expectedDocumentHash) {
        throw new Error(`lineage source hashes are stale: ${source.id}`);
      }
      return document;
    });
    const sourceKind = sources[0].kind;
    if (sources.some(({ kind }) => kind !== sourceKind))
      throw new Error("lineage sources must have one canonical kind");
    for (const replacementId of mutation.replacementIds) {
      const replacement = documentsAfter.get(replacementId);
      if (replacement === void 0 || replacement.kind !== sourceKind) {
        throw new Error(`lineage replacement is absent or has another kind: ${replacementId}`);
      }
    }
    const fromIds = sources.map(({ id }) => id).sort(compare2);
    const toIds = [...mutation.replacementIds].sort(compare2);
    const lineageId = deriveEntityId("projector.lineage", canonicalJson({
      kind: mutation.lineageKind,
      fromIds,
      toIds,
      stateDigest: observation.state.canonicalProjectorDigest
    }));
    if (documentsAfter.has(lineageId))
      throw new Error(`immutable lineage record already exists: ${lineageId}`);
    const lineage = LineageRecordSchema.parse({
      id: lineageId,
      kind: mutation.lineageKind,
      fromIds,
      toIds,
      reason: mutation.rationale,
      stateDigest: observation.state.canonicalProjectorDigest
    });
    const lineageWrite = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, canonicalLocations, "lineage", lineageId, `lineage:${lineageId}`, lineage), options.signal);
    canonicalWrites.push(lineageWrite);
    documentsAfter.set(lineageId, lineageWrite.envelope);
    mutationReviews.push({ id: lineageId, kind: "lineage", operation: "add", before: null, after: lineageWrite.envelope.payload, rationale: mutation.rationale });
    operations.push({ subjectType: "other", subjectKey: `lineage:${lineageId}`, subjectId: lineageId, kind: "add", payload: lineageWrite.envelope.payload });
    for (const source of sources) {
      const duplicateTombstone = [...documentsAfter.values()].find((document) => document.kind === "tombstone" && document.payload.entityId === source.id);
      if (duplicateTombstone !== void 0)
        throw new Error(`immutable tombstone already exists for ${source.id}`);
      const tombstoneId = deriveEntityId("projector.tombstone", source.id);
      if (documentsAfter.has(tombstoneId))
        throw new Error(`tombstone stable ID is occupied: ${tombstoneId}`);
      const tombstone = TombstoneSchema.parse({
        entityId: source.id,
        deletedAtRevision: 1,
        lastSemanticHash: source.semanticHash,
        replacementIds: toIds,
        reason: mutation.rationale
      });
      const tombstoneWrite = await withCancellation(canonicalWrite(input.repositoryRoot, canonical, canonicalLocations, "tombstone", tombstoneId, `tombstone:${source.id}`, tombstone), options.signal);
      const deletionWrite = await withCancellation(canonicalDelete(input.repositoryRoot, canonicalLocations, source), options.signal);
      canonicalWrites.push(tombstoneWrite, deletionWrite);
      documentsAfter.set(tombstoneId, tombstoneWrite.envelope);
      documentsAfter.delete(source.id);
      mutationReviews.push({ id: tombstoneId, kind: "tombstone", operation: "add", before: null, after: tombstoneWrite.envelope.payload, rationale: mutation.rationale }, { id: source.id, kind: source.kind, operation: "retire", before: source.payload, after: null, rationale: mutation.rationale });
      operations.push({ subjectType: "other", subjectKey: `tombstone:${source.id}`, subjectId: tombstoneId, kind: "add", payload: tombstoneWrite.envelope.payload }, source.kind === "requirement" ? { subjectType: "requirement", kind: "remove", requirementId: source.id, rationale: mutation.rationale } : source.kind === "behavioral-scenario" ? { subjectType: "scenario", kind: "remove", scenarioId: source.id, rationale: mutation.rationale } : { subjectType: "concept", subjectKey: source.key, subjectId: source.id, kind: "remove", payload: { rationale: mutation.rationale } });
    }
  }
  const retiredIds = new Set((input.proposal.canonicalMutations ?? []).filter((mutation) => mutation.kind === "lineage").flatMap(({ sources }) => sources.map(({ id }) => id)));
  for (const mutation of input.proposal.canonicalMutations ?? []) {
    if (mutation.kind !== "requirement" && mutation.kind !== "behavioral-scenario")
      continue;
    const changed = documentsAfter.get(String(mutation.payload.id));
    if (changed.payload.status !== "active")
      continue;
    const claims = (document) => new Set([document.key, ...document.payload.aliases].map((value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US")));
    const selectedClaims = claims(changed);
    const overlap = [...documentsAfter.values()].find((document) => document.id !== changed.id && document.kind === changed.kind && document.payload.status === "active" && [...claims(document)].some((claim) => selectedClaims.has(claim)));
    if (overlap !== void 0)
      throw new Error(`${changed.kind} identity claims are already owned by ${overlap.id}; revise or explicitly retire the existing identity`);
  }
  const knownAfterIds = /* @__PURE__ */ new Set([...documentsAfter.keys(), ...observation.analysis.projectionUnits.map(({ id }) => id)]);
  for (const relation of [...documentsAfter.values()].filter(({ kind }) => kind === "relation").map(({ payload }) => RelationSchema.parse(payload)).filter(({ active }) => active)) {
    if (retiredIds.has(relation.fromId) || retiredIds.has(relation.toId))
      throw new Error(`active relation ${relation.id} still references a retired identity`);
  }
  for (const review of mutationReviews.filter(({ kind, after }) => kind === "relation" && after !== null)) {
    const relation = RelationSchema.parse(documentsAfter.get(review.id).payload);
    validateCanonicalRelationEndpoints([relation], knownAfterIds, { populationComplete: true });
  }
  validateArchitectureProducts([...documentsAfter.values()], now, new Set(canonicalWrites.map(({ id }) => id)));
  if (mutationReviews.length > 0)
    validateStaticCanonicalGovernance([...documentsAfter.values()], knownAfterIds, { populationComplete: true });
  if (executionKind === "canonical-only" && canonicalWrites.length === 0)
    throw new Error("canonical-only proposal produces no model change");
  canonicalWrites.sort((left, right) => compare2(left.path, right.path));
  const contextIds = input.knowledgeContext?.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure: closure2 }) => closure2.entries.map(({ entityId }) => entityId)) ?? [];
  const requiredContextIds = input.knowledgeContext?.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure: closure2 }) => closure2.entries.filter(({ requiredForPlanning }) => requiredForPlanning).map(({ entityId }) => entityId)) ?? [];
  const contextRootIds = input.knowledgeContext?.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure: closure2 }) => closure2.entries.filter(({ band }) => band === "direct").map(({ entityId }) => entityId)) ?? [];
  const relationMutationEndpointIds = mutationReviews.filter(({ kind }) => kind === "relation").flatMap(({ before, after }) => [before, after]).filter((payload) => payload !== null).flatMap((payload) => {
    const relation = RelationSchema.parse(payload);
    return [relation.fromId, relation.toId];
  });
  const semanticRootIds = unique([
    ...identityResolutions.map(({ targetId }) => targetId),
    ...mutationReviews.filter(({ kind }) => kind !== "relation").map(({ id }) => id),
    ...relationMutationEndpointIds,
    ...contextRootIds
  ]).sort(compare2);
  const relatedIds = new Set(contextIds);
  const relations = [...documentsAfter.values()].filter(({ kind }) => kind === "relation").map(({ payload }) => RelationSchema.parse(payload)).filter(({ active }) => active).sort((left, right) => compare2(left.id, right.id));
  const relatedRelations = /* @__PURE__ */ new Map();
  const candidateRelationIds = /* @__PURE__ */ new Set();
  const unresolvedCommitmentIds = /* @__PURE__ */ new Set();
  const dependencyRelations = /* @__PURE__ */ new Set(["requires", "depends-on", "constrains"]);
  const forwardRelations = /* @__PURE__ */ new Set(["owns", "has-requirement", "realizes", "demonstrated-by", "governed-by"]);
  const prerequisiteRelations = /* @__PURE__ */ new Map();
  const dependentRelations = /* @__PURE__ */ new Map();
  for (const relation of relations) {
    if (dependencyRelations.has(relation.type) || forwardRelations.has(relation.type)) {
      const adjacent = prerequisiteRelations.get(relation.fromId) ?? [];
      adjacent.push(relation);
      prerequisiteRelations.set(relation.fromId, adjacent);
    }
    if (dependencyRelations.has(relation.type)) {
      const adjacent = dependentRelations.get(relation.toId) ?? [];
      adjacent.push(relation);
      dependentRelations.set(relation.toId, adjacent);
    }
  }
  const canonicalObligationIds = new Set([...documentsAfter.values()].filter(({ kind }) => kind !== "relation").map(({ id }) => id));
  const observedProjectionIds = new Set(observation.analysis.projectionUnits.map(({ id }) => id));
  const prerequisiteQueue = [];
  const dependentQueue = [];
  const prerequisiteVisited = /* @__PURE__ */ new Set();
  const dependentVisited = /* @__PURE__ */ new Set();
  for (const id of requiredContextIds) {
    if (!canonicalObligationIds.has(id) && !observedProjectionIds.has(id))
      unresolvedCommitmentIds.add(id);
  }
  const enqueue = (id, direction) => {
    relatedIds.add(id);
    if (!canonicalObligationIds.has(id)) {
      if (!observedProjectionIds.has(id))
        unresolvedCommitmentIds.add(id);
      return;
    }
    const enqueueDirection = (nextDirection) => {
      const visited = nextDirection === "prerequisite" ? prerequisiteVisited : dependentVisited;
      const queue = nextDirection === "prerequisite" ? prerequisiteQueue : dependentQueue;
      if (!visited.has(id)) {
        visited.add(id);
        queue.push(id);
      }
    };
    enqueueDirection(direction);
    if (direction === "dependent")
      enqueueDirection("prerequisite");
  };
  for (const id of semanticRootIds) {
    enqueue(id, "prerequisite");
    enqueue(id, "dependent");
  }
  const traverse = async (queue, direction) => {
    const adjacency = direction === "prerequisite" ? prerequisiteRelations : dependentRelations;
    for (let offset = 0; offset < queue.length; offset += 1) {
      if (offset > 0 && offset % 256 === 0)
        await setImmediate();
      options.signal?.throwIfAborted();
      const currentId = queue[offset];
      for (const relation of adjacency.get(currentId) ?? []) {
        const nextId = direction === "prerequisite" ? relation.toId : relation.fromId;
        if (relation.sourceClass === "inferred") {
          candidateRelationIds.add(relation.id);
          continue;
        }
        relatedRelations.set(relation.id, relation);
        enqueue(nextId, direction);
      }
    }
  };
  await traverse(dependentQueue, "dependent");
  await traverse(prerequisiteQueue, "prerequisite");
  const knownIds = /* @__PURE__ */ new Set([...documentsAfter.keys(), ...retiredIds, ...observation.analysis.projectionUnits.map(({ id }) => id), ...identityResolutions.map(({ targetId }) => targetId)]);
  const blockingUnknowns = unique([
    ...[...unresolvedCommitmentIds].filter((id) => !knownIds.has(id)).sort(compare2).map((id) => `related commitment has no current canonical entity or observed projection: ${id}`)
  ]);
  const reviewBasis = {
    ...input.proposal.identityResolution === void 0 ? {} : { identityResolution: input.proposal.identityResolution },
    subjects: reviewSubjects.sort((a, b) => compare2(a.id, b.id)),
    relations: [...relatedRelations.values()].sort((a, b) => compare2(a.id, b.id)),
    canonicalMutations: mutationReviews.sort((a, b) => compare2(a.id, b.id)),
    relatedObligations: observation.canonical.documents.filter(({ id, kind }) => relatedIds.has(id) && kind !== "relation").map(({ id, kind, payload }) => ({ id, kind, payload })).sort((a, b) => compare2(a.id, b.id)),
    blockingUnknowns,
    unknowns: unique([
      ...blockingUnknowns,
      ...[...candidateRelationIds].map((id) => `inferred relation remains a candidate and has not been adopted as an obligation: ${id}`),
      ...executionKind === "repository-code" ? ["Independent validator provenance does not establish coverage of every requirement or scenario outcome."] : [],
      ...input.knowledgeContext === void 0 ? ["No retained pre-edit conceptual context was supplied; relevance starts from proposal identities."] : input.knowledgeContext.unknowns
    ])
  };
  const intentReview = { ...reviewBasis, contentHash: hashFramedDomain("repository-intent-review", reviewBasis) };
  if (blockingUnknowns.length > 0)
    throw new Error(`unresolved conceptual obligations prevent planning: ${blockingUnknowns.join("; ")}`);
  const boundary = unique([...editedPaths, ...canonicalWrites.map(({ path }) => path)]);
  const calculatedRelevance = await calculateObservedRelevance(observation, editedPaths, options.signal);
  if (calculatedRelevance.unavailableSurfaceIds.length > 0) {
    throw new Error(`repository change compilation requires unavailable analyzer evidence: ${calculatedRelevance.unavailableSurfaceIds.join(", ")}`);
  }
  const relevanceSpec = queryRegistry.createSpec({ id: `relevance:${hashFramedDomain("repository-change-relevance-query-id", editedPaths).slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.reverseImporters, input: { editedPaths } });
  const relevancePrior = await evaluateObservedChangeQuery(observation, now, relevanceSpec, context);
  const relevanceValue = {
    knownAffectedPaths: calculatedRelevance.knownAffectedPaths,
    knownAffectedUnitIds: calculatedRelevance.knownAffectedUnitIds,
    possibleFrontierUnitIds: calculatedRelevance.possibleFrontierUnitIds,
    unavailableSurfaceIds: calculatedRelevance.unavailableSurfaceIds,
    reasons: calculatedRelevance.reasons,
    queryDependency: { query: relevanceSpec, priorResult: relevancePrior, role: "edited units, transitive reverse importers, and bounded negative space" }
  };
  const relevanceHash = hashFramedDomain("repository-change-relevance", relevanceValue);
  const relevance = { id: `relevance_${relevanceHash.slice(-32)}`, ...relevanceValue, contentHash: relevanceHash };
  const preparedImpact = await withObservationScope(options.signal === void 0 ? {} : { signal: options.signal }, (scope) => {
    const { independentValidator: _validator, ...data } = observation;
    return runObservationTask("prepare-impact", { observation: data, editedPaths, canonicalChanges: canonicalWrites, affectedUnitIds: relevance.knownAffectedUnitIds }, scope);
  });
  const { baseline: impactBaseline, prediction: impactPrediction, governanceMemberships: memberships } = preparedImpact;
  const derivationImpact = { baseline: impactBaseline, prediction: impactPrediction, contentHash: repositoryImpactProofHash(impactBaseline, impactPrediction) };
  if (impactPrediction.blockedUnitIds.length > 0)
    throw new Error(`active Impact Rules block planning for ${impactPrediction.blockedUnitIds.join(", ")}`);
  const governanceBefore = { memberships, contentHash: hashFramedDomain("repository-pre-change-governance", memberships) };
  const valueDependencies = [
    { kind: "artifact", id: "repository-impact-proof", versionHash: derivationImpact.contentHash, role: "exact observed derivation snapshot and known-delta impact prediction" },
    ...input.proposal.edits.map((edit) => ({ kind: "projection-unit", id: `path:${edit.path}`, versionHash: hashFramedDomain("transform-content", edit.before), role: `exact before content for ${edit.path}` })),
    ...independentValidators.map((validator) => ({ kind: "artifact", id: `independent-validator:${validator.path}`, versionHash: validator.contentHash, role: `Git-base-bound independent validator introduced by ${validator.introductionCommit}` })),
    { kind: "canonical-governance", id: "canonical-root", versionHash: observation.canonical.rootDigest, role: "canonical identity and decision search root" },
    { kind: "adapter", id: "projector.local-repository", versionHash: observation.state.toolchainDigest, role: "no-exec local analyzer versions" },
    { kind: "artifact", id: `proposal:${proposalHash}`, versionHash: proposalHash, role: "authenticated structured interpretation of the user request" },
    { kind: "representation-profile", id: representationProfile.id, versionHash: representationProfile.semanticHash, role: "selected plan-bound representation profile" },
    ...input.knowledgeContext === void 0 ? [] : [{ kind: "artifact", id: `knowledge-context:${input.knowledgeContext.id}`, versionHash: input.knowledgeContext.contentHash, role: "retained pre-edit conceptual context" }]
  ];
  const preliminaryBinding = createStateBinding({ compiledAgainst: observation.state, valueDependencies, queryDependencies: [...identityQueries, relevance.queryDependency] });
  const closureBasis = {
    requestHash: hashFramedDomain("repository-change-request", request),
    seeds: [{ kind: "request-term", value: request, reason: "authenticated user request", confidence: 1 }],
    entries: [
      ...relevance.knownAffectedUnitIds.map((entityId) => ({ entityId, band: "direct", score: 1, requiredForPlanning: true, reasons: [{ kind: "package-dependency", weight: 1, provenance: "derived", confidence: 1, explanation: "exact edit or static reverse importer", evidenceIds: [] }] })),
      ...relevance.possibleFrontierUnitIds.map((entityId) => ({ entityId, band: "possible", score: 0.25, requiredForPlanning: false, reasons: [{ kind: "open-world-widening", weight: 0.25, provenance: "derived", confidence: 0.5, explanation: "bounded analyzer dynamic frontier", evidenceIds: [] }] }))
    ],
    activatedFacetKeys: [...input.proposal.analysisFacets],
    unknowns: relevance.possibleFrontierUnitIds.map((id) => `unresolved dynamic frontier ${id}`),
    unavailableLanes: [...relevance.unavailableSurfaceIds],
    boundState: preliminaryBinding
  };
  const closureHash = hashFramedDomain("relevance-closure", closureBasis);
  const closure = { id: `relevance_closure_${closureHash.slice(-32)}`, ...closureBasis, contentHash: closureHash };
  const activationFacets = [];
  if (input.proposal.analysisFacets.includes("public-contract"))
    activationFacets.push("public-contract");
  if (input.proposal.analysisFacets.includes("workspace-expansion")) {
    const provesWorkspaceExpansion = input.proposal.edits.some(({ path, before, after }) => before === null && after !== null && /^packages\/[^/]+\/package\.json$/u.test(path));
    if (!provesWorkspaceExpansion)
      throw new Error("workspace-expansion facet lacks an exact new workspace manifest edit");
    activationFacets.push("workspace-expansion");
  }
  if (input.proposal.analysisFacets.includes("distribution"))
    activationFacets.push("distribution");
  const discovery = discoverArchitectureConcerns({
    closure,
    changes: [{ kind: "user-request", subjectIds: identityResolutions.map(({ targetId }) => targetId), activationFacets, explanation: "deterministic architecture activation from authenticated change facts", scope: scopeFor(editedPaths) }],
    inferred: []
  });
  const proposedArchitecture = input.proposal.architecture;
  let architectureDeferral;
  let architectureQuery;
  let governedConcerns = [...discovery.concerns];
  const deferralAssessmentPort = {
    assess: async () => ({ compatibilityPreserving: independentValidators.length > 0, optionalityPreserved: false, secretlySelectsOption: false, irreversibleCommitments: [] })
  };
  if (proposedArchitecture !== null) {
    const matching = discovery.concerns.filter(({ key }) => key === proposedArchitecture.concernKey);
    if (matching.length !== 1)
      throw new Error(`architecture concern response is not uniquely derived: ${proposedArchitecture.concernKey}`);
    const discoveredConcern = matching[0];
    if (discoveredConcern.materiality === "blocking-now")
      throw new Error(`blocking architecture concern requires a current canonical decision: ${discoveredConcern.key}`);
    if (discoveredConcern.title !== proposedArchitecture.title || discoveredConcern.question !== proposedArchitecture.question || discoveredConcern.materiality !== proposedArchitecture.materiality) {
      throw new Error(`architecture concern response mismatches engine-derived concern: ${proposedArchitecture.concernKey}`);
    }
    const decisionDeferral = {
      rationale: proposedArchitecture.deferral.rationale,
      preserveOptionality: [...proposedArchitecture.deferral.preservedOptions],
      forbiddenCommitments: [...proposedArchitecture.deferral.forbiddenCommitments, ...proposedArchitecture.deferral.forbiddenWritePaths.map((path) => `forbid-write:${path}`)],
      reconsiderWhen: [{ type: "manual-review" }, { type: "date", at: proposedArchitecture.deferral.validUntil }],
      reviewBy: proposedArchitecture.deferral.validUntil
    };
    const dispositionText = [decisionDeferral.rationale, proposedArchitecture.deferral.reconsiderWhen, ...decisionDeferral.preserveOptionality, ...proposedArchitecture.deferral.forbiddenCommitments];
    const dispositionAssessmentPort = {
      assess: async () => ({
        compatibilityPreserving: independentValidators.length > 0,
        optionalityPreserved: decisionDeferral.preserveOptionality.length > 0 && proposedArchitecture.deferral.forbiddenWritePaths.length > 0,
        secretlySelectsOption: dispositionText.some((value) => /\b(?:adopt|choose|standardize on|must use|use (?:redis|postgres|mysql|mongodb|react|vue|angular))\b/iu.test(value)),
        irreversibleCommitments: input.proposal.edits.filter(({ path }) => proposedArchitecture.deferral.forbiddenWritePaths.includes(path)).map(({ path }) => path)
      })
    };
    const deferralValidation = await withCancellation(assessDecisionDeferral(decisionDeferral, dispositionAssessmentPort), options.signal);
    if (!deferralValidation.valid)
      throw new Error(`architecture deferral is invalid: ${deferralValidation.reasons.join("; ")}`);
    const { semanticHash: _concernHash, ...concernWithoutHash } = discoveredConcern;
    const deferredWithoutHash = { ...concernWithoutHash, status: "deferred", deferral: decisionDeferral };
    const deferredConcern = ArchitectureConcernSchema.parse({ ...deferredWithoutHash, semanticHash: hashFramedDomain("architecture-concern", deferredWithoutHash) });
    governedConcerns = discovery.concerns.map((concern) => concern.id === deferredConcern.id ? deferredConcern : concern);
    deferralAssessmentPort.assess = dispositionAssessmentPort.assess;
    const deferralValue = { concern: deferredConcern, authoritativeDecision: false, proposalHash, discoveryHash: discovery.contentHash };
    const deferralHash = hashFramedDomain("repository-change-architecture-deferral", deferralValue);
    architectureDeferral = {
      id: `architecture_deferral_${deferralHash.slice(-32)}`,
      authoritativeDecision: false,
      concernId: deferredConcern.id,
      concernKey: deferredConcern.key,
      materiality: deferredConcern.materiality,
      rationale: decisionDeferral.rationale,
      reconsiderWhen: proposedArchitecture.deferral.reconsiderWhen,
      validUntil: proposedArchitecture.deferral.validUntil,
      preservedOptions: decisionDeferral.preserveOptionality,
      forbiddenCommitments: proposedArchitecture.deferral.forbiddenCommitments,
      forbiddenWritePaths: proposedArchitecture.deferral.forbiddenWritePaths,
      discoveryHash: discovery.contentHash,
      preflightHash: placeholder,
      contentHash: deferralHash
    };
  }
  const preflight = await withCancellation(runArchitecturePreflight({ closure, concerns: governedConcerns, validity: [], overrideAuthorityRecordIds: [], mode: "govern", risk: "R2" }, {
    authority: { read: async () => void 0 },
    deferral: deferralAssessmentPort,
    validity: { verify: async () => false }
  }), options.signal);
  if (!preflight.planningAllowed || !preflight.governedCompletion)
    throw new Error(`architecture preflight blocked: ${preflight.reasons.join("; ")}`);
  if (architectureDeferral !== void 0) {
    const { id: _priorId, contentHash: _priorHash, preflightHash: _priorPreflight, ...evidenceBasis } = architectureDeferral;
    const finalizedBasis = { ...evidenceBasis, preflightHash: preflight.contentHash };
    const finalizedHash = hashFramedDomain("repository-change-architecture-deferral", finalizedBasis);
    architectureDeferral = { id: `architecture_deferral_${finalizedHash.slice(-32)}`, ...finalizedBasis, contentHash: finalizedHash };
    const architectureSpec = queryRegistry.createSpec({ id: `architecture-deferral:${architectureDeferral.contentHash.slice(-16)}`, programId: CHANGE_QUERY_PROGRAM_IDS.boundedDeferral, input: { concernId: architectureDeferral.concernId, concernKey: architectureDeferral.concernKey, discoveryHash: discovery.contentHash, deferralId: architectureDeferral.id, validUntil: architectureDeferral.validUntil, forbiddenWritePaths: architectureDeferral.forbiddenWritePaths, editedPaths } });
    const architecturePrior = await evaluateObservedChangeQuery(observation, now, architectureSpec, context);
    if (architecturePrior.resultCount !== 1)
      throw new Error("architecture deferral query did not authenticate a current narrowing disposition");
    architectureQuery = { query: architectureSpec, priorResult: architecturePrior, role: "bounded non-authoritative architecture deferral and reconsideration condition" };
  }
  const boundState = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [...valueDependencies, { kind: "adapter", id: "architecture-discovery", versionHash: discovery.contentHash, role: "deterministic concern discovery from bounded relevance and authenticated facts" }], queryDependencies: [...identityQueries, relevance.queryDependency, ...architectureQuery === void 0 ? [] : [architectureQuery]] });
  const intentBase = {
    id: `intent_${proposalHash.slice(-32)}`,
    request,
    normalizedIntent: request,
    statements: [
      ...input.proposal.requirements.map(({ statement }) => ({ kind: "behavior", statement, origin: [{ kind: "document", locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Proposed interpretation; semantic fidelity to the user request is unverified." }], confidence: 1 })),
      ...input.proposal.scenarios.flatMap(({ steps }) => steps.map(({ statement }) => ({ kind: "behavior", statement, origin: [{ kind: "document", locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Proposed interpretation; semantic fidelity to the user request is unverified." }], confidence: 1 }))),
      ...mutationReviews.map(({ kind, id, after }) => ({
        kind: kind === "architecture-decision" || kind === "projection-lens" || kind === "relation" ? "constraint" : "behavior",
        statement: after === null ? `Retire ${kind} ${id}` : [after.statement, after.decision, after.purpose, after.rationale, after.reason, after.name].find((value) => typeof value === "string" && value.trim().length > 0) ?? `${kind} ${id}`,
        origin: [{ kind: "document", locator: `proposal:${proposalHash}`, contentHash: proposalHash, description: "Explicit canonical mutation proposed for approval." }],
        confidence: 1
      })),
      ...(architectureDeferral?.forbiddenCommitments ?? []).map((statement) => ({ kind: "constraint", statement, origin: [{ kind: "user-request", locator: `proposal:${proposalHash}`, contentHash: proposalHash }], confidence: 1 }))
    ],
    ambiguity: [],
    assumptions: architectureDeferral === void 0 ? [] : [`bounded architecture deferral ${architectureDeferral.id} remains current through ${architectureDeferral.validUntil}`]
  };
  const intentAnalysis = { ...intentBase, contentHash: hashFramedDomain("change-intent-analysis", intentBase) };
  const factsValue = {
    intentAnalysis,
    identityResolutionIds: [
      ...identityResolutions.map(({ id }) => id),
      ...mutationReviews.map(({ kind, id, operation }) => `explicit-canonical-${operation}:${kind}:${id}`)
    ],
    relevanceClosureId: relevance.id,
    analysisFacetKeys: semanticAnalysisFacets,
    operations: operations.map((operation) => ({ provenance: "authenticated", operation })),
    relations: intentReview.relations.map(({ id, fromId, toId }) => ({ id, subjectIds: [fromId, toId] })),
    assumptions: [
      `Preserve reviewed conceptual commitments except the explicit revisions in intent review ${intentReview.contentHash}.`,
      `Preserve or explicitly reconcile pre-change architectural applicability ${governanceBefore.contentHash}.`,
      ...intentReview.subjects.filter(({ operation }) => operation === "preserve").flatMap(({ id, after }) => "statement" in after ? [`Preserve ${id}: ${after.statement}`] : after.steps.map(({ role, statement }) => `Preserve ${id} ${role}: ${statement}`)),
      ...intentReview.relatedObligations.filter(({ id, kind }) => (kind === "requirement" || kind === "behavioral-scenario") && !intentReview.subjects.some((subject) => subject.id === id)).flatMap(({ id, kind, payload }) => kind === "requirement" ? [`Related commitment ${id}: ${RequirementSchema.parse(payload).statement}`] : BehavioralScenarioSchema.parse(payload).steps.map(({ role, statement }) => `Related commitment ${id} ${role}: ${statement}`)),
      ...architectureDeferral === void 0 ? [] : [
        `architecture deferral ${architectureDeferral.id}: ${architectureDeferral.rationale}`,
        ...architectureDeferral.preservedOptions.map((value) => `preserve option: ${value}`),
        ...architectureDeferral.forbiddenCommitments.map((value) => `forbidden commitment: ${value}`)
      ]
    ],
    boundary,
    boundState
  };
  const factsHash = hashFramedDomain("authenticated-change-compiler-facts", factsValue);
  const knownAffectedUnitIds = unique([...relevance.knownAffectedUnitIds, ...impactPrediction.knownAffectedUnitIds, ...canonicalWrites.map(({ id }) => id)]);
  const impactValue = {
    knownAffectedUnitIds,
    possibleFrontierUnitIds: unique([...relevance.possibleFrontierUnitIds, ...impactPrediction.possibleFrontierUnitIds]),
    unavailableSurfaceIds: relevance.unavailableSurfaceIds,
    reasons: [
      ...relevance.reasons,
      ...canonicalWrites.map(({ id }) => ({ unitId: id, kind: "exact", reason: "canonical semantic entity in the same transaction" }))
    ],
    queryDependencyIds: [relevance.queryDependency.query.id]
  };
  const mutatesGovernanceAuthority = (input.proposal.canonicalMutations ?? []).some(({ kind }) => kind === "architecture-decision" || kind === "projection-lens" || kind === "authority-record");
  const risk = {
    class: "R2",
    inherentOperationRisk: executionKind === "repository-code" || mutatesGovernanceAuthority ? 2 : 1,
    affectedUnitCount: knownAffectedUnitIds.length,
    affectedSurfaceCount: 1,
    publicContractImpact: input.proposal.analysisFacets.includes("public-contract"),
    externalImpact: false,
    dataImpact: input.proposal.analysisFacets.includes("persistence"),
    reversibility: "full",
    validationStrength: executionKind === "canonical-only" ? "exact" : "strong",
    closureConfidence: "bounded",
    unresolvedIdentityCount: 0,
    relevanceFrontierCount: relevance.possibleFrontierUnitIds.length,
    openWorldDependencies: relevance.possibleFrontierUnitIds.length > 0 || relevance.unavailableSurfaceIds.length > 0,
    unresolvedBlockingConcernCount: 0,
    suspectDecisionCount: 0,
    compensationAvailable: true,
    reasons: executionKind === "canonical-only" ? [mutatesGovernanceAuthority ? "canonical authority or executable governance mutation is R2" : "canonical meaning mutation is reversible R1", "validation covers canonical integrity and eligible lens compilation; implementation fidelity is not claimed"] : ["canonical requirement/scenario mutation requires explicit approval", "bounded local static relevance with an independent Git-base validator"]
  };
  const compiledChange = await withCancellation(compileSemanticChange({ request, currentState: observation.state, context }, {
    facts: { load: async () => ({ value: factsValue, contentHash: factsHash }) },
    bindingValidator: { validate: async () => ({ status: "current", currentState: observation.state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) },
    authority: { verify: async ({ subjectHash }) => subjectHash === factsHash },
    architecture: { preflight: async () => {
      const value = { allowed: preflight.planningAllowed && preflight.governedCompletion, decisionIds: [] };
      return { ...value, contentHash: hashFramedDomain("change-architecture-preflight", value) };
    } },
    impact: { compile: async () => ({ value: impactValue, contentHash: hashFramedDomain("authenticated-impact-closure", impactValue) }) },
    risk: { assess: async () => ({ value: risk, contentHash: hashFramedDomain("authenticated-change-risk", risk) }) }
  }), options.signal);
  const representation = await withCancellation(compileRepresentation(compiledChange, options.representationArtifacts ?? defaultRepresentationArtifacts(), representationProfileKey), options.signal);
  const validatorIds = [
    "exact-text-patch.verify",
    "projector.repository-post-observation",
    ...executionKind === "canonical-only" ? ["projector.canonical-model-integrity", "projector.canonical-decision-baselines"] : ["projector.post-change-knowledge"],
    ...independentValidators.map(({ path }) => `node-independent:${path}`),
    ...input.proposal.validation.supplementalNodeTests.map((path) => `node-supplemental:${path}`)
  ];
  const completionContract = {
    requiredUnitStates: knownAffectedUnitIds.map((unitId) => ({ unitId, state: "valid" })),
    requiredValidators: validatorIds,
    requiredEvidenceLanes: executionKind === "canonical-only" ? ["runtime"] : ["runtime", "test"],
    minimumValidationAssurance: executionKind === "canonical-only" ? "exact" : "strong",
    requireIndependentValidation: executionKind !== "canonical-only",
    maximumNewDivergences: 0,
    maximumUnknowns: 0,
    allowUnavailableExternalActions: false,
    requiredArtifacts: ["certificate", "receipt"],
    cleanWorkingTree: false
  };
  const planningValue = { change: compiledChange.change, boundState: compiledChange.boundState, compilerFactsHash: compiledChange.compilerFactsHash };
  const packetValue = {
    proposals: [{
      key: executionKind === "canonical-only" ? "canonical-model-change" : "exact-text-change",
      title: input.proposal.requirements.map(({ title }) => title).join("; ") || mutationReviews.map(({ kind, id }) => `${kind} ${id}`).join("; "),
      stage: "source",
      executionMode: "deterministic",
      transformId: executionKind === "canonical-only" ? "canonical-model-write" : "exact-text-patch",
      unitIds: knownAffectedUnitIds,
      semanticOwnerIds: identityResolutions.map(({ targetId }) => targetId),
      writeSelectors: boundary,
      forbiddenWriteSelectors: unique([".git/**", ".projector/runtime/**", ...architectureDeferral?.forbiddenWritePaths ?? []]),
      dependencies: [],
      validatorIds
    }],
    completionContract
  };
  const compiledPlan = await withCancellation(compileSemanticChangePlan({ changeId: compiledChange.change.id, revision: 1, sourceRunId: `run:${compiledChange.change.id}` }, {
    changes: { read: async () => ({ value: planningValue, contentHash: hashFramedDomain("authenticated-change-planning-input", planningValue) }) },
    packets: { compile: async () => ({ value: packetValue, contentHash: hashFramedDomain("authenticated-change-packet-proposals", packetValue) }) },
    representations: { compile: async () => representation.reference }
  }), options.signal);
  const planHash = executionPlanHash(compiledPlan.plan);
  const exactPatchInput = {
    edits: [
      ...input.proposal.edits.map((edit) => ({ unitId: observation.analysis.projectionUnits.find(({ key }) => key === edit.path)?.id ?? deriveEntityId("projector.proposed-unit", edit.path), ...edit })),
      ...canonicalWrites.map(({ id, path, before, after }) => ({ unitId: id, path, before, after }))
    ].sort((left, right) => compare2(left.path, right.path))
  };
  return {
    derivationImpact,
    executionKind,
    proposalHash,
    identityResolutions: identityResolutions.sort((left, right) => compare2(left.id, right.id)),
    ...architectureDeferral === void 0 ? {} : { architectureDeferral },
    relevance,
    canonicalWrites,
    intentReview,
    governanceBefore,
    ...input.knowledgeContext === void 0 ? {} : { knowledgeContext: input.knowledgeContext },
    independentValidators,
    baselineObservation: baselineObservation(observation),
    compiledChange,
    representation: representation.reference,
    representationDetails: representation.projection,
    compiledPlan,
    planHash,
    exactPatchInput
  };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/currentness.js
async function validateCompiledRepositoryChangeCurrentness(input) {
  return withObservationScope(input.signal === void 0 ? {} : { signal: input.signal }, async () => {
    input.signal?.throwIfAborted();
    const paths = await RepositoryPathService.create(input.repositoryRoot);
    const now = input.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
    let capturedObservation;
    const liveObservation = async () => {
      input.signal?.throwIfAborted();
      capturedObservation ??= observeChangeRepository(input.repositoryRoot);
      const observation2 = await capturedObservation;
      input.signal?.throwIfAborted();
      return observation2;
    };
    const validator = new DependencyScopedStateBindingValidator({
      values: {
        readVersionHash: async (dependency) => {
          const observation2 = await liveObservation();
          if (dependency.id.startsWith("path:")) {
            const path = dependency.id.slice("path:".length);
            return hashObservedText(await readObservedText((await paths.resolveRead(path)).realTarget, input.signal), input.signal);
          }
          if (dependency.id.startsWith("independent-validator:"))
            return (await observation2.independentValidator(dependency.id.slice("independent-validator:".length))).contentHash;
          if (dependency.id === "canonical-root")
            return observation2.canonical.rootDigest;
          if (dependency.id === "projector.local-repository")
            return observation2.state.toolchainDigest;
          if (dependency.kind === "representation-profile") {
            return currentBuiltInRepresentationProfile(dependency.id)?.semanticHash;
          }
          if (dependency.id.startsWith("proposal:"))
            return input.compiled.proposalHash;
          if (dependency.id === "repository-impact-proof") {
            return withObservationScope(input.signal === void 0 ? {} : { signal: input.signal }, async (scope) => {
              const { independentValidator: _validator, ...data } = observation2;
              const snapshot = await runObservationTask("build-impact", { observation: data }, scope);
              const prediction = await runObservationTask("predict-impact", { snapshot, editedPaths: input.compiled.exactPatchInput.edits.filter(({ path }) => !path.startsWith(".projector/")).map(({ path }) => path), canonicalChanges: input.compiled.canonicalWrites }, scope);
              return repositoryImpactProofHash(snapshot, prediction);
            });
          }
          if (dependency.id.startsWith("knowledge-context:")) {
            const retained = input.compiled.knowledgeContext;
            return retained !== void 0 && dependency.id === `knowledge-context:${retained.id}` ? retained.contentHash : void 0;
          }
          if (dependency.id === "architecture-discovery")
            return dependency.versionHash;
          return void 0;
        }
      },
      queries: { evaluate: async (query, context) => evaluateObservedChangeQuery(await liveObservation(), now(), query, context) }
    });
    const observation = await liveObservation();
    const binding = input.binding ?? input.compiled.compiledPlan.plan.boundState;
    const result = await validator.validate(binding, observation.state, {
      repositoryRoot: input.repositoryRoot,
      stateDigest: observation.state,
      config: {},
      signal: input.signal ?? new AbortController().signal
    });
    return result.status === "rebound" ? { ...result, status: "current", reasons: ["all approval-scoped value and query dependencies remain current"] } : result;
  });
}

// node_modules/@projector/control-plane/dist/knowledge/validators.js
import { z as z2 } from "zod";
var parameters = z2.record(z2.string(), z2.json());
var inputSchema = z2.strictObject({ path: z2.string(), parameters: parameters.optional() });
var outputSchema = z2.strictObject({ status: z2.enum(["satisfied", "violated", "unknown"]), reason: z2.string().min(1).max(4096) });
var KnowledgeValidatorRun = class {
  observation;
  signal;
  host;
  launcher;
  results = /* @__PURE__ */ new Map();
  executed = false;
  constructor(observation, signal, host = {}) {
    this.observation = observation;
    this.signal = signal;
    this.host = host;
  }
  evaluate(request) {
    const key = canonicalJson(request);
    let result = this.results.get(key);
    if (result === void 0) {
      result = this.run(request).then((finding) => {
        if (finding.status === "unknown")
          this.results.delete(key);
        return finding;
      });
      this.results.set(key, result);
    }
    return result;
  }
  async evaluateAll(requests) {
    const groups = /* @__PURE__ */ new Map();
    for (const request of requests) {
      const key = `${request.unitId}\0${request.binding.id}@${request.binding.version}`;
      groups.set(key, [...groups.get(key) ?? [], request]);
    }
    const findings = [];
    for (const group of groups.values()) {
      const first = group[0];
      if (group.some((request) => canonicalJson(request) !== canonicalJson(first))) {
        findings.push({ unitId: first.unitId, validatorId: `${first.binding.id}@${first.binding.version}`, status: "unknown", reason: "One validator identity has conflicting binding inputs for this unit.", evidenceIds: [] });
      } else
        findings.push(await this.evaluate(first));
    }
    return findings;
  }
  async run({ binding, unitId, unitPath }) {
    const validatorId = `${binding.id}@${binding.version}`;
    const unknown = (reason, evidenceIds = []) => ({ unitId, validatorId, status: "unknown", reason, evidenceIds });
    if (binding.provider !== "repository-node")
      return unknown(`Validator ${validatorId} uses unsupported provider ${binding.provider}.`);
    this.signal.throwIfAborted();
    try {
      return await withObservationScope({ signal: this.signal }, async (scope) => {
        const input = inputSchema.parse(binding.input);
        const normalizedPath = normalizeRepositoryRelativePath(input.path);
        if (normalizedPath !== input.path || !/\.(?:c|m)?js$/u.test(input.path))
          throw new Error("repository-node input.path must be a canonical repository-relative .js, .mjs, or .cjs path");
        const captured = await this.observation.independentValidator(input.path);
        if (binding.version !== captured.contentHash && binding.version !== `git:${captured.objectId}`)
          throw new Error("repository-node binding.version must equal the tracked validator contentHash or git:<tracked-blob-object-id>");
        if (binding.requiredIndependenceGroup !== void 0 && binding.requiredIndependenceGroup !== "tracked-git-base")
          throw new Error(`unsupported independence group ${binding.requiredIndependenceGroup}`);
        const evidenceIds = [`evidence_${hashFramedDomain("knowledge-validator-identity", { validatorId, unitId, path: captured.path, objectId: captured.objectId, introductionCommit: captured.introductionCommit, contentHash: captured.contentHash }).slice(-32)}`];
        this.launcher ??= (this.host.createLauncher ?? (async () => new NativeProcessLauncher()))();
        const launcher = await this.launcher;
        const paths = await RepositoryPathService.create(this.observation.repositoryRoot);
        const target = (await paths.resolveRead(input.path)).realTarget;
        const readHash = async () => runObservationTask("hash-content", {
          content: (await readObservationFile(target, scope.budget, input.path, this.signal)).toString("utf8")
        }, { ...scope, signal: this.signal });
        const beforeHash = await readHash();
        if (beforeHash !== captured.contentHash)
          throw new Error(`Validator ${validatorId} source changed before execution.`);
        const protocol = { apiVersion: "projector.knowledge-validator/v1", validatorId, unitId, unitPath, parameters: input.parameters ?? {} };
        this.executed = true;
        const result = await launcher.launch({
          executable: process.execPath,
          args: [target, canonicalJson(protocol)],
          cwd: this.observation.repositoryRoot,
          env: {},
          timeoutMs: scope.limits.timeoutMs === null ? null : Math.max(1, scope.budget.remainingMs()),
          maxOutputBytes: null,
          signal: this.signal
        });
        scope.budget.check("validator-execution", input.path);
        this.signal.throwIfAborted();
        const afterHash = await readHash();
        if (afterHash !== captured.contentHash)
          return unknown(`Validator ${validatorId} changed during execution.`, evidenceIds);
        if (result.exitCode !== 0 || result.signal !== null)
          return unknown(`Validator ${validatorId} did not complete successfully (exit ${result.exitCode}, signal ${result.signal}).`, evidenceIds);
        const output = outputSchema.parse(JSON.parse(result.stdout));
        return {
          unitId,
          validatorId,
          ...output,
          reason: `${output.reason} Executed under the configured host permissions; this result does not establish filesystem confinement, network denial, or hostile same-user protection.`,
          evidenceIds
        };
      });
    } catch (error) {
      this.signal.throwIfAborted();
      if (error instanceof ObservationError)
        throw error;
      return unknown(`Validator ${validatorId} unavailable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 4096));
    }
  }
};

// node_modules/@projector/control-plane/dist/change-lifecycle/knowledge-validation.js
async function validatePostChangeKnowledge(compiled, observation, startedAt, completedAt, signal = new AbortController().signal) {
  const decisionBaselines = transactionDecisionBaselines(compiled, observation);
  const graph = new KnowledgeGraph(observation, { acceptedDecisionBaselines: decisionBaselines, now: completedAt });
  const changedPaths = new Set(compiled.exactPatchInput.edits.map(({ path }) => path));
  const selectedIds = /* @__PURE__ */ new Set([
    ...compiled.relevance.knownAffectedUnitIds,
    ...graph.units.filter(({ key }) => changedPaths.has(key)).map(({ id }) => id),
    ...compiled.knowledgeContext?.branches.filter(({ hypothesis }) => !hypothesis).flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)) ?? []
  ]);
  const applicableLenses = graph.lenses.filter(({ id, status }) => status === "active" && (graph.lensCompilation?.memberships[id] ?? []).some((unitId) => selectedIds.has(unitId)));
  for (const lens of applicableLenses)
    selectedIds.add(lens.id);
  selectChangedDecisions(compiled, graph, selectedIds);
  const operation = compiled.knowledgeContext?.operation ?? "change";
  const context = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal };
  const decisions2 = await assessKnowledgeDecisions(graph, graph.relevantDecisions(selectedIds), operation, context);
  const validators = new KnowledgeValidatorRun(observation, signal);
  const findings = await validators.evaluateAll(graph.validatorRequests(selectedIds, operation));
  const evaluations2 = graph.governanceEvaluations(selectedIds, operation, findings);
  const reasons = [
    ...graph.lensCompilationUnknown === void 0 ? [] : [graph.lensCompilationUnknown],
    ...graph.authorityUnknowns([...selectedIds]),
    ...decisions2.decisions.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation),
    ...evaluations2.filter(({ status }) => status !== "conformant").flatMap(({ findings: findings2, boundary }) => [
      ...findings2.filter(({ status }) => status !== "satisfied").map(({ reason }) => reason),
      ...boundary
    ])
  ];
  for (const before of compiled.governanceBefore.memberships) {
    const current = graph.units.find(({ key }) => key === before.path);
    if (current === void 0 || !(graph.lensCompilation?.memberships[before.lensId] ?? []).includes(current.id)) {
      reasons.push(`Previously governed source ${before.path} no longer has applicability under ${before.lensId}; removal or relocation requires explicit conceptual reconciliation.`);
    }
  }
  const retained = compiled.knowledgeContext === void 0 ? void 0 : await (await RepositoryKnowledgeService.create({ repositoryRoot: observation.repositoryRoot, acceptedDecisionBaselines: decisionBaselines, now: completedAt })).reconcile(compiled.knowledgeContext.id, { signal, observation });
  if (retained !== void 0) {
    if (canonicalJson(retained.currentState) !== canonicalJson(observation.state))
      reasons.push("Repository changed between post-state observation and retained-context reconciliation.");
    if (canonicalJson(await observeRepositoryState(observation)) !== canonicalJson(observation.state))
      reasons.push("Repository changed during post-state retained-context reconciliation.");
    if (retained.status === "suspect" || retained.status === "unavailable")
      reasons.push(`Retained knowledge is ${retained.status}.`);
    if (retained.governance.status === "unknown" || retained.governance.status === "violated")
      reasons.push(...retained.governance.reasons, `Retained governance is ${retained.governance.status}.`);
  }
  const passed = reasons.length === 0 && evaluations2.every(({ status }) => status === "conformant");
  const details = {
    state: observation.state,
    intentReviewHash: compiled.intentReview.contentHash,
    preChangeGovernanceHash: compiled.governanceBefore.contentHash,
    evaluations: evaluations2,
    decisionValidity: decisions2.decisions,
    decisionBaselines,
    ...retained === void 0 ? {} : { retainedReconciliation: retained },
    reasons: [...new Set(reasons)].sort(),
    semanticFidelity: "not-established"
  };
  const contentHash = hashFramedDomain("repository-post-change-knowledge", details);
  return {
    validatorId: "projector.post-change-knowledge",
    status: passed ? "passed" : "failed",
    summary: passed ? "Applicable executable architectural obligations conform in the post-state; full behavioral fidelity is not established." : "Post-change conceptual knowledge has violated or unavailable executable obligations.",
    evidenceIds: [`evidence_${contentHash.slice(-32)}`],
    evidenceLane: "runtime",
    independenceGroup: "projector.knowledge-governance",
    assurance: "strong",
    authorSource: "projector.local-repository",
    sideEffectClass: "none",
    details,
    startedAt,
    completedAt: completedAt()
  };
}
function transactionDecisionBaselines(compiled, observation) {
  return captureDecisionBaselines(observation, compiled.canonicalWrites.filter(({ kind }) => kind === "authority-record").map(({ id }) => id), compiled.canonicalWrites.filter(({ kind }) => kind === "architecture-decision").map(({ id }) => id));
}
function selectChangedDecisions(compiled, graph, selectedIds) {
  const changed = new Set(compiled.canonicalWrites.map(({ id }) => id));
  for (const decision of graph.decisions) {
    const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
    if (changed.has(decision.id) || changed.has(decision.authorityRecordId) || authority?.reconsiderWhen.some((trigger) => {
      const id = triggerSubjectId(trigger);
      return id !== void 0 && changed.has(id);
    }) === true)
      selectedIds.add(decision.id);
  }
}
async function validateCanonicalDecisionBaselines(compiled, observation, startedAt, completedAt, signal = new AbortController().signal) {
  const decisionBaselines = transactionDecisionBaselines(compiled, observation);
  const graph = new KnowledgeGraph(observation, { acceptedDecisionBaselines: decisionBaselines, now: completedAt });
  const selectedIds = /* @__PURE__ */ new Set();
  selectChangedDecisions(compiled, graph, selectedIds);
  const context = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal };
  const decisions2 = await assessKnowledgeDecisions(graph, graph.relevantDecisions(selectedIds), compiled.knowledgeContext?.operation ?? "change", context);
  const reasons = [...graph.authorityUnknowns([...selectedIds]), ...decisions2.decisions.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation)];
  const details = { state: observation.state, decisionValidity: decisions2.decisions, decisionBaselines, reasons, runtimeValidation: "not-performed" };
  return {
    validatorId: "projector.canonical-decision-baselines",
    status: reasons.length === 0 ? "passed" : "blocked",
    summary: reasons.length === 0 ? "Accepted conceptual decision baselines captured from the actual post-state; runtime behavior was not validated." : "A relevant decision requires reconsideration before this canonical change.",
    evidenceIds: [`evidence_${hashFramedDomain("canonical-decision-baselines", details).slice(-32)}`],
    evidenceLane: "architecture",
    independenceGroup: "projector.knowledge-governance",
    assurance: "exact",
    authorSource: "projector.local-repository",
    sideEffectClass: "none",
    details,
    startedAt,
    completedAt: completedAt()
  };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/executor.js
var JournalExecutionAdapter = class {
  paths;
  worktree;
  boundary;
  attempt;
  binding;
  heartbeatIntervalMs;
  transaction;
  session;
  heartbeatTimer;
  heartbeatPending = Promise.resolve();
  ownershipError;
  heartbeatStopped = true;
  constructor(paths, worktree, boundary, attempt, binding, heartbeatIntervalMs) {
    this.paths = paths;
    this.worktree = worktree;
    this.boundary = boundary;
    this.attempt = attempt;
    this.binding = binding;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }
  async begin(input) {
    if (this.transaction !== void 0 || this.session !== void 0)
      throw new Error("lifecycle attempt already owns a transaction");
    const leaseBinding = { ...this.binding, compiledAgainst: input.beforeState };
    const session = await this.worktree.open({ sessionId: this.attempt.id, processId: process.pid, stateBinding: leaseBinding });
    this.session = session;
    this.startHeartbeatKeeper(this.heartbeatIntervalMs);
    try {
      const transaction = await session.begin({
        transactionId: this.attempt.transactionId,
        planId: input.planId,
        beforeState: input.beforeState,
        allowedWriteRoots: [...this.boundary]
      });
      this.transaction = transaction;
      const close = async () => {
        await this.stopHeartbeatKeeper();
        this.transaction = void 0;
        const active = this.session;
        this.session = void 0;
        if (active !== void 0)
          await active.close();
      };
      return {
        get phase() {
          return transaction.entry.phase;
        },
        get lastCheckpointId() {
          return transaction.entry.checkpointIds.at(-1);
        },
        checkpoint: async (id) => {
          await this.assertOwned();
          await transaction.checkpoint(id);
        },
        transition: async (phase) => {
          await this.assertOwned();
          await transaction.transition(phase);
        },
        commit: async () => {
          await this.assertOwned();
          await transaction.commit();
          await close();
        },
        rollback: async () => {
          await this.assertOwned();
          try {
            await transaction.rollback();
          } finally {
            await close();
          }
        }
      };
    } catch (error) {
      await this.stopHeartbeatKeeper();
      this.session = void 0;
      try {
        await session.close();
      } catch (closeError) {
        throw new AggregateError([error, closeError], "lifecycle transaction failed and the writer lease could not be released");
      }
      throw error;
    }
  }
  async readFile(path) {
    return await readObservedText((await this.paths.resolveScopedRead(path, this.boundary)).realTarget) ?? void 0;
  }
  async assertWritable(path) {
    await this.paths.resolveScopedWrite(path, this.boundary);
  }
  async moveFile(from, to) {
    await this.assertOwned();
    await this.active().moveFile(from, to);
  }
  async writeFile(path, content) {
    await this.assertOwned();
    await this.active().writeFile(path, content);
  }
  async deleteFile(path) {
    await this.assertOwned();
    await this.active().deleteFile(path);
  }
  async checkpoint(id) {
    await this.assertOwned();
    await this.active().checkpoint(id);
  }
  async runWhileOwned(operation, intervalMs = 5e3) {
    void intervalMs;
    await this.assertOwned();
    const result = await operation();
    await this.assertOwned();
    return result;
  }
  active() {
    if (this.transaction === void 0)
      throw new Error("governed mutation attempted outside the durable lifecycle transaction");
    return this.transaction;
  }
  async assertOwned() {
    if (this.ownershipError !== void 0)
      throw this.ownershipError;
    if (this.session === void 0)
      throw new Error("governed mutation attempted without an active writer lease");
    await this.session.heartbeat();
    if (this.ownershipError !== void 0)
      throw this.ownershipError;
  }
  startHeartbeatKeeper(intervalMs = 5e3) {
    this.heartbeatStopped = false;
    this.ownershipError = void 0;
    const schedule = () => {
      this.heartbeatTimer = setTimeout(() => {
        const session = this.session;
        this.heartbeatPending = (session === void 0 ? Promise.reject(new Error("writer lease session disappeared")) : session.heartbeat()).catch((error) => {
          this.ownershipError = error;
        }).finally(() => {
          if (!this.heartbeatStopped && this.ownershipError === void 0)
            schedule();
        });
      }, intervalMs);
      this.heartbeatTimer.unref();
    };
    schedule();
  }
  async stopHeartbeatKeeper() {
    this.heartbeatStopped = true;
    if (this.heartbeatTimer !== void 0)
      clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = void 0;
    await this.heartbeatPending;
  }
};
function validationPath(validatorId) {
  const independent = "node-independent:";
  const supplemental = "node-supplemental:";
  if (validatorId.startsWith(independent))
    return { path: validatorId.slice(independent.length), independenceGroup: `git-base:${validatorId.slice(independent.length)}`, authorSource: "tracked-git-base", source: "git-base" };
  if (validatorId.startsWith(supplemental))
    return { path: validatorId.slice(supplemental.length), independenceGroup: `proposal:${validatorId.slice(supplemental.length)}`, authorSource: "authenticated-proposal", source: "approved-edit" };
  return void 0;
}
async function observeAppliedRepositoryChange(compiled, observation, paths) {
  const exactWrites = [];
  for (const edit of compiled.exactPatchInput.edits) {
    const content = await readObservedText((await paths.resolveRead(edit.path)).realTarget);
    const expectedAfterHash = await hashObservedText(edit.after);
    const observedAfterHash = await hashObservedText(content);
    exactWrites.push({ path: edit.path, unitId: edit.unitId, expectedAfterHash, observedAfterHash, matches: content === edit.after });
  }
  const beforeFiles = new Map(compiled.baselineObservation.files.map(({ path, contentHash }) => [path, contentHash]));
  const afterFiles = new Map(observation.analysis.files.map(({ path, contentHash }) => [path, contentHash]));
  const observedChangedPaths = [.../* @__PURE__ */ new Set([...beforeFiles.keys(), ...afterFiles.keys()])].filter((path) => beforeFiles.get(path) !== afterFiles.get(path)).sort();
  const predictedChangedPaths = compiled.exactPatchInput.edits.filter(({ path, before, after }) => !path.startsWith(".projector/") && before !== after).map(({ path }) => path).sort();
  const unexpectedChangedPaths = observedChangedPaths.filter((path) => !predictedChangedPaths.includes(path));
  const beforeCanonical = new Map(compiled.baselineObservation.canonicalEntries.map(({ entityId, canonicalDocumentHash }) => [entityId, canonicalDocumentHash]));
  const afterCanonical = new Map(observation.canonical.entries.map(({ entityId, canonicalDocumentHash }) => [entityId, canonicalDocumentHash]));
  const observedChangedCanonicalIds = [.../* @__PURE__ */ new Set([...beforeCanonical.keys(), ...afterCanonical.keys()])].filter((id) => beforeCanonical.get(id) !== afterCanonical.get(id)).sort();
  const predictedCanonicalIds = compiled.canonicalWrites.filter(({ before, after }) => before !== after).map(({ id }) => id).sort();
  const unexpectedChangedCanonicalIds = observedChangedCanonicalIds.filter((id) => !predictedCanonicalIds.includes(id));
  const afterUnits = new Map(observation.analysis.projectionUnits.map((unit) => [unit.id, unit]));
  const beforeUnits = new Map(compiled.baselineObservation.units.map((unit) => [unit.id, unit]));
  const exactByUnit = new Map(exactWrites.map((write) => [write.unitId, write]));
  const canonicalByUnit = new Map(compiled.canonicalWrites.map((write) => [write.id, write]));
  const unitStates = compiled.compiledPlan.plan.completionCriteria.requiredUnitStates.map(({ unitId }) => ({
    unitId,
    state: (() => {
      const exact = exactByUnit.get(unitId);
      if (exact !== void 0)
        return exact.matches ? "valid" : "exception";
      const canonical = canonicalByUnit.get(unitId);
      if (canonical !== void 0) {
        const document = observation.canonical.documents.find(({ id }) => id === unitId);
        return canonical.after === null ? document === void 0 ? "valid" : "exception" : document !== void 0 && canonicalJson(document) === canonicalJson(canonical.envelope) ? "valid" : "exception";
      }
      const before = beforeUnits.get(unitId);
      const after = afterUnits.get(unitId);
      return before !== void 0 && after !== void 0 && after.validity === "valid" && before.membershipHash === after.membershipHash ? "valid" : "exception";
    })()
  }));
  const changedCanonicalIdsForKind = (expectedKind) => compiled.canonicalWrites.filter(({ id, kind, envelope, after }) => kind === expectedKind && observedChangedCanonicalIds.includes(id) && (after === null ? observation.canonical.documents.every((document) => document.id !== id) : canonicalJson(observation.canonical.documents.find((document) => document.id === id)) === canonicalJson(envelope))).map(({ id }) => id).sort();
  const changedConceptIds = changedCanonicalIdsForKind("concept");
  const changedRequirementIds = changedCanonicalIdsForKind("requirement");
  const changedScenarioIds = changedCanonicalIdsForKind("behavioral-scenario");
  const changedRelationIds = changedCanonicalIdsForKind("relation");
  const baselineFailures = new Set(compiled.baselineObservation.analyzerFailures.map((failure) => canonicalJson(failure)));
  const newAnalyzerFailures = observation.analysis.failures.map(({ analyzerId, capability, scope, message, affectedClaimKinds }) => ({ analyzerId, capability, scope, message, affectedClaimKinds: [...affectedClaimKinds].sort() })).filter((failure) => !baselineFailures.has(canonicalJson(failure))).map((failure) => `${failure.analyzerId}:${failure.capability}:${failure.scope}:${failure.message}`).sort();
  const surpriseClaims = [
    ...unexpectedChangedPaths.map((path) => `unexpected-path:${path}`),
    ...unexpectedChangedCanonicalIds.map((id) => `unexpected-canonical-entity:${id}`),
    ...newAnalyzerFailures.map((failure) => `new-analyzer-failure:${failure}`)
  ];
  const planningSurpriseIds = surpriseClaims.map((claim) => `planning_surprise_${hashFramedDomain("repository-change-planning-surprise", claim).slice(-32)}`).sort();
  const unknowns = newAnalyzerFailures.map((failure) => `new analyzer failure: ${failure}`);
  const reconciliation = {
    exactWrites,
    unitStates,
    baselineObservationHash: compiled.baselineObservation.contentHash,
    canonicalRootDigest: observation.canonical.rootDigest,
    changedConceptIds,
    changedRequirementIds,
    changedScenarioIds,
    changedRelationIds,
    predictedChangedPaths,
    observedChangedPaths,
    observedChangedCanonicalIds,
    unexpectedChangedPaths,
    unexpectedChangedCanonicalIds,
    newAnalyzerFailures,
    planningSurpriseIds,
    unknowns
  };
  const reconciliationHash = hashFramedDomain("repository-change-reconciliation", reconciliation);
  const basis = {
    version: 1,
    beforeState: compiled.compiledPlan.plan.boundState.compiledAgainst,
    afterState: observation.state,
    exactWrites,
    unitStates,
    changedConceptIds,
    changedRequirementIds,
    changedScenarioIds,
    changedRelationIds,
    predictedChangedPaths,
    observedChangedPaths,
    observedChangedCanonicalIds,
    unexpectedChangedPaths,
    unexpectedChangedCanonicalIds,
    newAnalyzerFailures,
    planningSurpriseIds,
    unknowns,
    reconciliationHash
  };
  return { ...basis, contentHash: hashFramedDomain("repository-change-post-observation", basis) };
}
function postObservationValidation(observation, startedAt, completedAt, impact, impactProofHash) {
  const invalidWrites = observation.exactWrites.filter(({ matches }) => !matches).map(({ path }) => path);
  const invalidUnits = observation.unitStates.filter(({ state }) => state !== "valid").map(({ unitId }) => unitId);
  const passed = invalidWrites.length === 0 && invalidUnits.length === 0 && observation.planningSurpriseIds.length === 0 && observation.unknowns.length === 0 && impact.surprises.length === 0 && impact.blockedUnitIds.length === 0;
  return {
    validatorId: "projector.repository-post-observation",
    status: passed ? "passed" : "failed",
    summary: passed ? "authenticated post-change observation matches the approved writes and required unit states" : "post-change repository observation does not reconcile with the approved plan",
    evidenceIds: [`evidence_${observation.contentHash.slice(-32)}`],
    evidenceLane: "runtime",
    independenceGroup: "projector.repository-observer",
    assurance: "exact",
    authorSource: "projector.local-repository@1",
    sideEffectClass: "none",
    details: { observation, impact, impactProofHash },
    startedAt,
    completedAt
  };
}
async function runNodeValidators(launcher, repositoryRoot, paths, validatorIds, independentValidators, approvedEdits, signal, now, runWhileOwned) {
  const results = [];
  const resolvedIndependentValidations = [];
  for (const validatorId of validatorIds) {
    const validator = validationPath(validatorId);
    if (validator === void 0)
      continue;
    const startedAt = now();
    const approvedEdit = approvedEdits.find(({ path }) => path === validator.path);
    const expected = validator.source === "git-base" ? independentValidators.find(({ path }) => path === validator.path)?.contentHash : approvedEdit?.after === null || approvedEdit?.after === void 0 ? void 0 : hashFramedDomain("transform-content", approvedEdit.after);
    if (expected === void 0) {
      results.push({
        validatorId,
        status: "blocked",
        summary: `Host validator source is not bound to authenticated executable bytes: ${validator.path}`,
        evidenceIds: [`evidence_${hashFramedDomain("validator-execution-identity", { validatorId, expectedContentHash: null }).slice(-32)}`],
        evidenceLane: "test",
        independenceGroup: validator.independenceGroup,
        assurance: "strong",
        authorSource: validator.authorSource,
        sideEffectClass: "none",
        details: { expectedContentHash: null },
        startedAt,
        completedAt: now()
      });
      continue;
    }
    const contentPath2 = (await paths.resolveRead(validator.path)).realTarget;
    const beforeContentHash = await hashObservedText(await readObservedText(contentPath2, signal), signal);
    const identityEvidenceId = `evidence_${hashFramedDomain("validator-execution-identity", {
      validatorId,
      expectedContentHash: expected,
      beforeContentHash
    }).slice(-32)}`;
    if (beforeContentHash !== expected) {
      results.push({
        validatorId,
        status: "blocked",
        summary: `Host validator source is unavailable or changed before execution: ${validator.path}`,
        evidenceIds: [identityEvidenceId],
        evidenceLane: "test",
        independenceGroup: validator.independenceGroup,
        assurance: "strong",
        authorSource: validator.authorSource,
        sideEffectClass: "none",
        details: { expectedContentHash: expected, beforeContentHash, exactResolvedPath: contentPath2 },
        startedAt,
        completedAt: now()
      });
      continue;
    }
    const execution = await runWhileOwned(() => launcher.launch({
      executable: process.execPath,
      args: [contentPath2],
      cwd: repositoryRoot,
      env: {},
      timeoutMs: null,
      maxOutputBytes: 256 * 1024,
      outputOverflow: "truncate",
      signal
    }));
    const afterContentHash = await hashObservedText(await readObservedText(contentPath2, signal), signal);
    const identityCurrent = afterContentHash === beforeContentHash && afterContentHash === expected;
    const passed = execution.exitCode === 0 && identityCurrent;
    const result = {
      validatorId,
      status: passed ? "passed" : "failed",
      summary: passed ? `Host validator passed with stable exact source identity: ${validator.path}` : identityCurrent ? `Host validator failed: ${validator.path}` : `Host validator source identity changed during execution: ${validator.path}`,
      evidenceIds: [identityEvidenceId],
      evidenceLane: "test",
      independenceGroup: validator.independenceGroup,
      assurance: "strong",
      authorSource: validator.authorSource,
      sideEffectClass: "none",
      details: {
        expectedContentHash: expected,
        beforeContentHash,
        afterContentHash,
        executedContentHash: expected,
        executionSource: validator.source === "git-base" ? "exact-live-tracked-validator" : "exact-live-approved-validator",
        exactResolvedPath: contentPath2,
        observedResult: { exitCode: execution.exitCode, signal: execution.signal, stdout: execution.stdout, stderr: execution.stderr },
        executionPolicy: { timeoutMs: null, diagnosticCaptureBytes: 256 * 1024, diagnosticOverflow: "truncate", callerCancellation: true },
        hostAssumptions: configuredHostAssumptions
      },
      startedAt,
      completedAt: now()
    };
    results.push(result);
    if (validator.source === "git-base" && identityCurrent) {
      resolvedIndependentValidations.push({ validatorId, evidenceIds: result.evidenceIds });
    }
  }
  return { results, resolvedIndependentValidations };
}
async function executeCompiledRepositoryChange(input) {
  const packet = input.compiled.compiledPlan.packets[0];
  if (packet === void 0 || input.compiled.compiledPlan.packets.length !== 1)
    throw new Error("initial repository lifecycle requires exactly one compiled packet");
  const plan = input.compiled.compiledPlan.plan;
  const capsule = packet.capsule;
  if (input.approval.capsuleId !== capsule.id)
    throw new Error("execution approval belongs to another capsule");
  const launcher = input.compiled.executionKind === "canonical-only" ? void 0 : new NativeProcessLauncher();
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  const journal = new FileTransactionJournal(paths);
  const leaseStaleAfterMs = input.leaseStaleAfterMs ?? 3e4;
  const worktree = new GovernedWorktreeRuntime(new WriterLeaseManager(paths, { staleAfterMs: leaseStaleAfterMs }), journal);
  const transaction = new JournalExecutionAdapter(paths, worktree, plan.boundary, input.attempt, plan.boundState, Math.max(10, Math.min(5e3, Math.floor(leaseStaleAfterMs / 3))));
  const exact = new ExactTextPatchTransform(transaction, { ...input.now === void 0 ? {} : { now: input.now } });
  const now = input.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  const bindingValidator = {
    validate: async (binding, _currentState, context) => validateCompiledRepositoryChangeCurrentness({
      repositoryRoot: input.repositoryRoot,
      compiled: input.compiled,
      binding,
      signal: context.signal,
      now
    })
  };
  let postObservation;
  let refreshedImpact;
  let resolvedIndependentValidations = [];
  const transform = {
    preview: (transformInput, context) => exact.preview(transformInput, context),
    apply: (transformInput, context) => exact.apply(transformInput, context),
    verify: async (result2, context) => {
      const exactValidations = await exact.verify(result2, context);
      const hostValidation = launcher === void 0 ? { results: [], resolvedIndependentValidations: [] } : await runNodeValidators(launcher, input.repositoryRoot, paths, capsule.requiredValidations, input.compiled.independentValidators, input.compiled.exactPatchInput.edits, context.signal, now, (operation) => transaction.runWhileOwned(operation));
      resolvedIndependentValidations = hostValidation.resolvedIndependentValidations;
      const validations = [
        ...exactValidations,
        ...hostValidation.results
      ];
      const observationStartedAt = now();
      const observation = await observeChangeRepository(input.repositoryRoot);
      postObservation = await observeAppliedRepositoryChange(input.compiled, observation, paths);
      const impact = await withObservationScope({ signal: context.signal }, async (scope) => {
        const { independentValidator: _validator, ...data } = observation;
        refreshedImpact = await runObservationTask("build-impact", { observation: data }, scope);
        return runObservationTask("reconcile-impact", { before: input.compiled.derivationImpact.baseline, after: refreshedImpact, predictedUnitIds: plan.completionCriteria.requiredUnitStates.map(({ unitId }) => unitId), planId: plan.id, predictedPaths: input.compiled.exactPatchInput.edits.map(({ path }) => path) }, scope);
      });
      const modelIntegrity = {
        validatorId: "projector.canonical-model-integrity",
        status: "passed",
        summary: "authenticated canonical documents, references, and eligible active lenses match the approved model-only transaction",
        evidenceIds: [`evidence_${postObservation.contentHash.slice(-32)}`],
        evidenceLane: "runtime",
        independenceGroup: "projector.canonical-repository",
        assurance: "exact",
        authorSource: "projector.canonical-repository@2",
        sideEffectClass: "none",
        details: { canonicalEntityIds: input.compiled.canonicalWrites.map(({ id }) => id), implementationFidelityAssessed: false },
        startedAt: observationStartedAt,
        completedAt: now()
      };
      return [
        ...validations,
        postObservationValidation(postObservation, observationStartedAt, now(), impact, input.compiled.derivationImpact.contentHash),
        ...input.compiled.executionKind === "canonical-only" ? [modelIntegrity, await validateCanonicalDecisionBaselines(input.compiled, observation, observationStartedAt, now, context.signal)] : [await validatePostChangeKnowledge(input.compiled, observation, observationStartedAt, now, context.signal)]
      ];
    }
  };
  const executor = new StateBoundChangeExecutor({
    state: { current: async () => (await observeChangeRepository(input.repositoryRoot)).state },
    bindingValidator,
    transform,
    transactions: transaction,
    artifacts: { write: (kind, hash, content) => input.store.writeArtifact(kind, hash, content) },
    completion: {
      assess: async () => {
        if (postObservation === void 0)
          throw new Error("completion requires an authenticated post-change repository observation");
        return {
          unitStates: postObservation.unitStates,
          newDivergenceIds: postObservation.planningSurpriseIds,
          unknowns: postObservation.unknowns,
          unavailableActions: [],
          availableArtifacts: [],
          cleanWorkingTree: false,
          resolvedIndependentValidations
        };
      }
    },
    successDurability: {
      prepare: async (success) => {
        if (postObservation === void 0 || canonicalJson(success.afterState) !== canonicalJson(postObservation.afterState)) {
          throw new Error("prepared success state does not match the authenticated post-change observation");
        }
        await input.store.prepareAttemptSuccess(input.attempt.id, success);
      }
    },
    changedCanonicalEntityIds: () => input.compiled.canonicalWrites.map(({ id }) => id),
    changedConceptIds: () => postObservation?.changedConceptIds ?? [],
    changedRequirementIds: () => postObservation?.changedRequirementIds ?? [],
    changedScenarioIds: () => postObservation?.changedScenarioIds ?? [],
    changedRelationIds: () => postObservation?.changedRelationIds ?? [],
    planningSurpriseIds: () => postObservation?.planningSurpriseIds ?? [],
    environment: { repositoryRoot: input.repositoryRoot, signal: input.signal },
    ...input.now === void 0 ? {} : { now: input.now }
  });
  const result = await executor.execute({ plan, capsule, approval: input.approval, transformInput: input.compiled.exactPatchInput });
  if (result.outcome === "success" && refreshedImpact !== void 0)
    await persistRepositoryImpactSnapshot(input.repositoryRoot, refreshedImpact);
  return result;
}

// node_modules/@projector/control-plane/dist/change-lifecycle/identity-adjudication.js
var normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
var durableKinds = /* @__PURE__ */ new Set(["concept", "requirement", "behavioral-scenario", "architecture-decision", "architecture-concern", "developer-preference", "projection-lens"]);
var coveredIds = (context) => new Set(context.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure }) => [...closure.entries.map(({ entityId }) => entityId), ...closure.boundState.valueDependencies.map(({ id }) => id)]));
var directRootIds = (context) => new Set(context.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure }) => closure.entries.filter(({ band }) => band === "direct").map(({ entityId }) => entityId)));
var sameIds = (left, right) => left.size === right.size && [...left].every((id) => right.has(id));
function existingAddresses(proposal, documents) {
  const selected = /* @__PURE__ */ new Set();
  for (const [kind, subjects] of [["requirement", proposal.requirements], ["behavioral-scenario", proposal.scenarios]]) {
    for (const subject of subjects) {
      for (const document of documents.filter((item) => item.kind === kind)) {
        const payload = document.payload;
        if (subject.revision?.id === document.id) {
          selected.add(document.id);
          continue;
        }
        const claims = new Set([subject.key, ...subject.aliases].map(normalize));
        const aliases = Array.isArray(payload.aliases) ? payload.aliases.filter((value) => typeof value === "string") : [];
        const sameIdentity = [document.key, ...aliases].some((claim) => claims.has(normalize(claim)));
        const sameMeaning = payload.title === subject.title && ("statement" in subject ? payload.statement === subject.statement : canonicalJson(payload.steps) === canonicalJson(subject.steps));
        if (sameIdentity && sameMeaning)
          selected.add(document.id);
      }
    }
  }
  for (const mutation of proposal.canonicalMutations ?? []) {
    if (mutation.kind === "lineage") {
      for (const source of mutation.sources)
        if (documents.some(({ id }) => id === source.id))
          selected.add(source.id);
      continue;
    }
    if (mutation.operation !== "revise" || typeof mutation.payload.id !== "string")
      continue;
    const before = documents.find(({ id }) => id === mutation.payload.id);
    if (before === void 0)
      continue;
    if (mutation.kind === "relation") {
      for (const id of [before.payload.fromId, before.payload.toId, mutation.payload.fromId, mutation.payload.toId]) {
        if (typeof id === "string" && documents.some((document) => document.id === id && durableKinds.has(document.kind)))
          selected.add(id);
      }
    } else if (mutation.kind === "authority-record") {
      for (const document of documents)
        if (document.payload.authorityRecordId === before.id || document.id === before.payload.subjectId && durableKinds.has(document.kind))
          selected.add(document.id);
    } else if (mutation.kind === "architecture-concern") {
      selected.add(before.id);
      for (const id of [...before.payload.relatedConceptIds, ...before.payload.relatedRequirementIds, ...mutation.payload.relatedConceptIds, ...mutation.payload.relatedRequirementIds])
        selected.add(id);
      for (const document of documents)
        if (document.kind === "architecture-decision" && document.payload.concernId === before.id)
          selected.add(document.id);
    } else if (mutation.kind === "developer-preference") {
      selected.add(before.id);
    } else
      selected.add(mutation.payload.id);
  }
  return [...selected].sort();
}
async function captureKnowledgeContextId(repositoryRoot, request, proposal, suppliedId, signal, applicationEvidence) {
  signal?.throwIfAborted();
  const resolutionId = proposal.identityResolution?.contextId;
  if (suppliedId !== void 0 && resolutionId !== void 0 && suppliedId !== resolutionId)
    throw new Error("identity resolution and supplied knowledge context differ");
  if (suppliedId !== void 0 || resolutionId !== void 0)
    return suppliedId ?? resolutionId;
  const snapshot = await new CanonicalFileRepository(repositoryRoot).snapshot();
  signal?.throwIfAborted();
  if (!snapshot.documents.some(({ kind }) => durableKinds.has(kind)))
    return void 0;
  const entities = existingAddresses(proposal, snapshot.documents);
  const context = await (await RepositoryKnowledgeService.create(applicationEvidence === void 0 ? repositoryRoot : { repositoryRoot, applicationEvidence })).context({ request, entities, policy: { maxCandidates: Math.max(5, entities.length) }, ...signal === void 0 ? {} : { signal } });
  signal?.throwIfAborted();
  if (!context.branches.some(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)) {
    throw new Error(`Pre-edit meaning is unresolved. Inspect ${context.id} and supply identityResolution bound to its contentHash; omitting context does not authorize a new identity.`);
  }
  return context.id;
}
async function adjudicatedKnowledgeContext(repositoryRoot, proposal, contextId, signal, applicationEvidence, observation) {
  signal?.throwIfAborted();
  if (contextId === void 0) {
    if (proposal.identityResolution !== void 0)
      throw new Error("identity resolution requires its retained candidate context");
    const snapshot = observation?.canonical ?? await new CanonicalFileRepository(repositoryRoot).snapshot();
    signal?.throwIfAborted();
    if (snapshot.documents.some(({ kind }) => durableKinds.has(kind)))
      throw new Error("existing canonical meaning requires retained pre-edit knowledge; recapture this change");
    return void 0;
  }
  const knowledge = await RepositoryKnowledgeService.create(applicationEvidence === void 0 ? repositoryRoot : { repositoryRoot, applicationEvidence });
  const retained = await knowledge.read(contextId);
  signal?.throwIfAborted();
  const resolution = proposal.identityResolution;
  if (resolution !== void 0) {
    if (resolution.contextId !== retained.id || resolution.contextHash !== retained.contentHash)
      throw new Error("identity resolution does not authenticate the retained candidate proof");
    const candidates = new Set(retained.interpretation.candidates.map(({ entityId }) => entityId));
    for (const id of [...resolution.selectedEntityIds, ...resolution.newBoundary?.nearestEntityIds ?? []]) {
      if (!candidates.has(id))
        throw new Error(`identity resolution references an uninspected candidate: ${id}`);
    }
  } else if (!retained.branches.some(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct)) {
    throw new Error("knowledge context has no direct, accepted, usable interpretation branch; supply a reviewed identityResolution");
  }
  const required = existingAddresses(proposal, (observation?.canonical ?? await new CanonicalFileRepository(repositoryRoot).snapshot()).documents);
  signal?.throwIfAborted();
  const covered = coveredIds(retained);
  if (resolution === void 0 && required.every((id) => covered.has(id)))
    return retained;
  const selectedIds = resolution?.selectedEntityIds ?? retained.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure }) => closure.entries.filter(({ band }) => band === "direct").map(({ entityId }) => entityId));
  const entities = [.../* @__PURE__ */ new Set([...selectedIds, ...required])].sort();
  if (entities.length === 0)
    return retained;
  const allRetainedBranchesDirect = retained.branches.length > 0 && retained.branches.every(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct);
  if (allRetainedBranchesDirect && required.every((id) => covered.has(id)) && sameIds(directRootIds(retained), new Set(entities)))
    return retained;
  const selected = await knowledge.context({
    request: retained.request,
    entities,
    namedTargets: retained.requestOptions.namedTargets,
    operation: retained.operation,
    policy: { ...retained.requestOptions.policy, maxCandidates: Math.max(retained.requestOptions.policy.maxCandidates, entities.length + retained.requestOptions.namedTargets.length) },
    ...signal === void 0 ? {} : { signal }
  }, observation === void 0 ? {} : { observation });
  signal?.throwIfAborted();
  const directIds = new Set(selected.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).flatMap(({ closure }) => closure.entries.filter(({ band }) => band === "direct").map(({ entityId }) => entityId)));
  if (selectedIds.some((id) => !directIds.has(id)))
    throw new Error("a selected identity no longer resolves directly; refresh candidate knowledge");
  return selected;
}
function assertIdentityDisposition(compiled, proposal) {
  const resolution = proposal.identityResolution;
  const context = compiled.knowledgeContext;
  if (context === void 0)
    return;
  const direct = context.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct);
  if (resolution === void 0 && direct.length === 0)
    throw new Error("knowledge context has no direct, accepted, usable interpretation branch; supply a reviewed identityResolution");
  const covered = coveredIds(context);
  const requiredExisting = [
    ...compiled.intentReview.subjects.filter(({ before }) => before !== null).map(({ id }) => id),
    ...(compiled.intentReview.canonicalMutations ?? []).flatMap(({ id, before, kind }) => {
      if (before === null)
        return [];
      if (durableKinds.has(kind) || kind === "authority-record")
        return [id];
      return kind === "relation" ? [before.fromId, before.toId].filter((value) => typeof value === "string") : [];
    })
  ];
  if (requiredExisting.some((id) => !covered.has(id)))
    throw new Error(`retained selected context does not cover the existing meaning being changed: ${requiredExisting.filter((id) => !covered.has(id)).join(", ")}`);
  const addsMeaning = compiled.intentReview.subjects.some(({ operation }) => operation === "add") || (compiled.intentReview.canonicalMutations ?? []).some(({ kind, operation }) => durableKinds.has(kind) && operation === "add");
  if (addsMeaning && resolution?.newBoundary === void 0)
    throw new Error("new durable meaning in an existing model requires an explicit reviewed newBoundary in identityResolution");
  if (resolution?.outcome === "no-durable-entity" && compiled.canonicalWrites.length > 0)
    throw new Error("no-durable-entity cannot authorize canonical mutations");
  if (resolution?.outcome === "create-new" && !addsMeaning)
    throw new Error("create-new must introduce durable meaning");
  if (resolution?.outcome === "reuse-existing" && addsMeaning)
    throw new Error("reuse-existing cannot introduce new durable ownership");
  const lineage = (proposal.canonicalMutations ?? []).filter((mutation) => mutation.kind === "lineage");
  if (lineage.length > 0 && (resolution?.outcome === "reuse-existing" || resolution?.outcome === "create-new"))
    throw new Error("identity outcome does not authorize retirement of existing meaning");
  const expectedKind = resolution?.outcome === "split-existing" ? "split" : resolution?.outcome === "merge-existing" ? "merge" : resolution?.outcome === "replace-existing" ? "replace" : void 0;
  if (expectedKind !== void 0 && !lineage.some(({ lineageKind }) => lineageKind === expectedKind))
    throw new Error(`${resolution.outcome} requires its explicit lineage operation`);
  const kinds = new Set(lineage.map(({ lineageKind }) => lineageKind));
  if (resolution !== void 0 && kinds.size === 1 && [...kinds].some((kind) => ["split", "merge", "replace"].includes(kind)) && expectedKind !== lineage[0]?.lineageKind)
    throw new Error("reviewed identity outcome disagrees with the lineage operation");
  if (lineage.length > 0 && resolution !== void 0) {
    const selected = new Set(resolution.selectedEntityIds);
    if (lineage.flatMap(({ sources }) => sources).some(({ id }) => !selected.has(id)))
      throw new Error("identity resolution must select every retired source identity");
  }
}

// node_modules/@projector/control-plane/dist/representation/artifact-store.js
import { createHash } from "node:crypto";
import { link, mkdir as mkdir2, open, readdir, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join } from "node:path";
import { z as z3 } from "zod";
var root = ".projector/runtime/representations";
var publicationRoot = ".projector/runtime/representation-publication";
var publicationSchema = z3.object({
  path: z3.string(),
  sha256: z3.string().regex(/^[a-f0-9]{64}$/u),
  semanticChangeId: z3.string().optional(),
  projectionId: z3.string().optional()
}).strict();
function validatePublication(bytes2) {
  const source = Buffer.from(bytes2).toString("utf8");
  const manifest = publicationSchema.parse(JSON.parse(source));
  if (canonicalJson(manifest) !== source || !/^\.projector\/runtime\/representations\/(content\/[a-f0-9]{64}\.txt|projections\/[a-f0-9]{64}\.json)$/u.test(manifest.path)) {
    throw new Error("representation publication manifest is invalid");
  }
  return { manifest, blobs: [{ path: "artifact", sha256: manifest.sha256 }] };
}
function projectionPath(projectionId) {
  return `${root}/projections/${hashFramedDomain("representation-projection-path", projectionId).slice("sha256:v1:".length)}.json`;
}
function contentPath(contentHash) {
  return `${root}/content/${contentHash.slice("sha256:v1:".length)}.txt`;
}
function projectionSemanticHash(projection) {
  const { semanticHash: _semanticHash, ...basis } = projection;
  return hashFramedDomain("representation-projection", basis);
}
function preservationSemanticHash(projection) {
  const { semanticHash: _semanticHash, ...basis } = projection.preservation;
  return hashFramedDomain("semantic-preservation-fingerprint", basis);
}
async function readArtifact(path) {
  const handle2 = await open(path, "r");
  try {
    const status = await handle2.stat();
    if (!status.isFile())
      throw new Error("representation artifact is not a regular file");
    const bytes2 = await handle2.readFile();
    const after = await handle2.stat();
    if (bytes2.length !== status.size || after.size !== status.size || after.mtimeMs !== status.mtimeMs) {
      throw new Error("representation artifact changed while it was read");
    }
    return bytes2.toString("utf8");
  } finally {
    await handle2.close();
  }
}
async function writeExact(paths, path, bytes2, stagedPath) {
  const resolved = await paths.resolveWrite(path);
  await mkdir2(dirname2(resolved.realTarget), { recursive: true });
  try {
    await link(stagedPath, resolved.realTarget);
    let directoryPath = dirname2(resolved.realTarget);
    while (true) {
      const directory = await open(directoryPath, "r");
      try {
        await directory.sync();
      } catch (error) {
        if (!(error instanceof Error && "code" in error && ["EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code))))
          throw error;
      } finally {
        await directory.close();
      }
      if (directoryPath === paths.root)
        break;
      directoryPath = dirname2(directoryPath);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
    const existing = await readArtifact((await paths.resolveRead(path)).realTarget);
    if (existing !== bytes2)
      throw new Error(`conflicting durable representation artifact: ${path}`);
  }
}
function assertProjection(projection) {
  RepresentationProjectionSchema.parse(projection);
  if (projection.semanticHash !== projectionSemanticHash(projection))
    throw new Error("representation projection semantic hash is invalid");
  if (projection.preservation.semanticHash !== preservationSemanticHash(projection))
    throw new Error("representation preservation hash is invalid");
}
var RepositoryRepresentationArtifactStore = class _RepositoryRepresentationArtifactStore {
  paths;
  options;
  publications;
  constructor(paths, options) {
    this.paths = paths;
    this.options = options;
    this.publications = new DurableArtifactSetStore(join(paths.root, publicationRoot), validatePublication);
  }
  static async create(repositoryRoot, options = {}) {
    return new _RepositoryRepresentationArtifactStore(await RepositoryPathService.create(repositoryRoot), options);
  }
  async materialize(publicationId) {
    const set = await this.publications.resumeFinalize(publicationId);
    if (hashFramedDomain("representation-publication", set.manifest).slice("sha256:v1:".length) !== publicationId)
      throw new Error("representation publication identity authentication failed");
    const bytes2 = Buffer.from(set.blobs.get("artifact")).toString("utf8");
    const contentMatch = /content\/([a-f0-9]{64})\.txt$/u.exec(set.manifest.path);
    if (contentMatch !== null) {
      if (hashFramedDomain("representation-artifact", bytes2) !== `sha256:v1:${contentMatch[1]}`)
        throw new Error("representation publication content authentication failed");
    } else {
      const record = DurableRepresentationArtifactRecordSchema.parse(JSON.parse(bytes2));
      assertProjection(record.projection);
      if (canonicalJson(record) !== bytes2 || projectionPath(record.projection.id) !== set.manifest.path || set.manifest.projectionId !== record.projection.id)
        throw new Error("representation publication projection authentication failed");
      const content = await this.get(record.projection.contentHash);
      if (content === void 0 || hashFramedDomain("representation-artifact", content) !== record.projection.contentHash)
        throw new Error("representation publication has no authenticated content");
    }
    await writeExact(this.paths, set.manifest.path, bytes2, join(this.publications.storageRoot, "published", publicationId, "blobs", "artifact"));
    return set.manifest;
  }
  async removePublication(publicationId) {
    const target = (await this.paths.resolveWrite(`${publicationRoot}/published/${publicationId}`)).realTarget;
    await rm2(target, { recursive: true, force: true });
    const temporary = (await this.paths.resolveWrite(`${publicationRoot}/temporary/${publicationId}`)).realTarget;
    await rm2(temporary, { recursive: true, force: true });
  }
  async writePublication(path, content, association = {}) {
    try {
      const existing = await readArtifact((await this.paths.resolveRead(path)).realTarget);
      if (existing !== content)
        throw new Error(`conflicting durable representation artifact: ${path}`);
      if (association.semanticChangeId === void 0)
        return;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
        throw error;
    }
    const manifest = { path, sha256: createHash("sha256").update(content).digest("hex"), ...association };
    const manifestBytes = Buffer.from(canonicalJson(manifest));
    const publicationId = hashFramedDomain("representation-publication", manifest).slice("sha256:v1:".length);
    const current = await this.publications.read(publicationId);
    if (current.status !== "published") {
      await this.publications.begin({ artifactSetId: publicationId });
      await this.publications.stageBlob({ artifactSetId: publicationId, path: "artifact", bytes: Buffer.from(content) });
      await this.publications.finalize({ artifactSetId: publicationId, manifestBytes });
    }
    await this.options.afterStage?.();
    try {
      await this.materialize(publicationId);
    } catch (error) {
      if (!(error instanceof ArtifactSetIncompleteError) || (await this.publications.read(publicationId)).status !== "missing")
        throw error;
      const existing = await readArtifact((await this.paths.resolveRead(path)).realTarget);
      if (existing !== content)
        throw new Error(`conflicting durable representation artifact: ${path}`);
    }
    if (association.semanticChangeId === void 0)
      await this.removePublication(publicationId);
  }
  async pending(options = {}) {
    options.signal?.throwIfAborted();
    const ids = /* @__PURE__ */ new Set();
    for (const phase of ["staging", "finalizing", "published"]) {
      try {
        const directory = (await this.paths.resolveRead(`${publicationRoot}/${phase}`)).realTarget;
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name))
            throw new Error("representation publication namespace contains an unsupported entry");
          ids.add(entry.name);
        }
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
          throw error;
      }
    }
    const states = [];
    for (const publicationId of [...ids].sort()) {
      options.signal?.throwIfAborted();
      const current = await this.publications.read(publicationId);
      if (current.status === "missing")
        continue;
      let association = current.status === "published" ? current.manifest : void 0;
      if (current.status === "incomplete") {
        try {
          const manifestPath = (await this.paths.resolveRead(`${publicationRoot}/finalizing/${publicationId}/manifest.bin`)).realTarget;
          association = validatePublication(Buffer.from(await readArtifact(manifestPath))).manifest;
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
            throw error;
        }
      }
      if (association !== void 0 && hashFramedDomain("representation-publication", association).slice("sha256:v1:".length) !== publicationId) {
        states.push({ publicationId, status: "integrity-failed", reason: "representation publication identity authentication failed" });
        continue;
      }
      states.push({ publicationId, status: current.status, ...association?.semanticChangeId === void 0 ? {} : { semanticChangeId: association.semanticChangeId }, ...association?.projectionId === void 0 ? {} : { projectionId: association.projectionId }, ...current.status === "integrity-failed" ? { reason: current.reason } : {} });
    }
    return states;
  }
  async recover(options = {}) {
    const outcomes = [];
    const states = await this.pending(options);
    for (const state of states.sort((a, b) => Number(a.projectionId !== void 0) - Number(b.projectionId !== void 0))) {
      options.signal?.throwIfAborted();
      try {
        const manifest = await this.materialize(state.publicationId);
        options.signal?.throwIfAborted();
        outcomes.push({ publicationId: state.publicationId, status: "recovered", ...manifest.semanticChangeId === void 0 ? {} : { semanticChangeId: manifest.semanticChangeId }, ...manifest.projectionId === void 0 ? {} : { projectionId: manifest.projectionId } });
        if (manifest.semanticChangeId === void 0)
          await this.removePublication(state.publicationId);
      } catch (error) {
        options.signal?.throwIfAborted();
        outcomes.push({ ...state, status: "recovery-required", reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }
  async acknowledgeCapture(semanticChangeId) {
    for (const state of await this.pending()) {
      if (state.semanticChangeId === semanticChangeId && state.status === "published")
        await this.removePublication(state.publicationId);
    }
  }
  async put(contentHash, content) {
    if (hashFramedDomain("representation-artifact", content) !== contentHash)
      throw new Error("representation content hash is invalid");
    await this.writePublication(contentPath(contentHash), content);
  }
  async get(contentHash) {
    try {
      return await readArtifact((await this.paths.resolveRead(contentPath(contentHash))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return void 0;
      throw error;
    }
  }
  async publish(projection, semanticChangeId) {
    assertProjection(projection);
    const content = await this.get(projection.contentHash);
    if (content === void 0 || hashFramedDomain("representation-artifact", content) !== projection.contentHash) {
      throw new Error("representation projection content is missing or invalid");
    }
    const record = createDurableRepresentationArtifactRecord(projection);
    await this.writePublication(projectionPath(projection.id), canonicalJson(record), { projectionId: projection.id, ...semanticChangeId === void 0 ? {} : { semanticChangeId } });
  }
  async read(reference) {
    let source;
    try {
      source = await readArtifact((await this.paths.resolveRead(projectionPath(reference.projectionId))).realTarget);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return void 0;
      throw error;
    }
    const record = DurableRepresentationArtifactRecordSchema.parse(JSON.parse(source));
    assertProjection(record.projection);
    const expected = {
      projectionId: record.projection.id,
      profileId: record.projection.profileId,
      profileVersion: record.projection.profileVersion,
      contentHash: record.projection.contentHash,
      preservationHash: record.projection.preservation.semanticHash
    };
    if (canonicalJson(expected) !== canonicalJson(reference))
      throw new Error("representation artifact does not match the selected plan reference");
    const content = await this.get(reference.contentHash);
    if (content === void 0 || hashFramedDomain("representation-artifact", content) !== reference.contentHash)
      throw new Error("representation artifact content is missing or invalid");
    return { projection: record.projection, content, recordHash: record.recordHash };
  }
};

// node_modules/@projector/control-plane/dist/change-lifecycle/service.js
var compilationObservations = /* @__PURE__ */ new WeakMap();
var representationPublicationFields = {
  publicationId: z4.string().regex(/^[a-f0-9]{64}$/u),
  semanticChangeId: z4.string().optional(),
  projectionId: z4.string().optional(),
  reason: z4.string().optional(),
  captureStatus: z4.enum(["captured", "uncaptured", "unassociated"])
};
var RepresentationPendingOutputSchema = z4.array(z4.object({ ...representationPublicationFields, status: z4.enum(["published", "incomplete", "integrity-failed"]) }).strict());
var RepresentationRecoveryOutputSchema = z4.array(z4.object({ ...representationPublicationFields, status: z4.enum(["recovered", "recovery-required"]) }).strict());
function capsules(compiled) {
  return compiled.compiledPlan.packets.map(({ capsule }) => capsule);
}
function exactPatchInputHash(compiled) {
  return hashFramedDomain("exact-text-patch-input", compiled.exactPatchInput);
}
function permitsDecisionReconsideration(compiled, governance) {
  if (compiled.executionKind !== "canonical-only" || governance.status !== "unknown")
    return false;
  const revised = new Set((compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation }) => operation === "revise" && (kind === "architecture-decision" || kind === "authority-record")).map(({ id }) => id));
  if (revised.size === 0)
    return false;
  const resolvedReasons = /* @__PURE__ */ new Set();
  for (const branch of governance.branches) {
    if (branch.evaluations.some(({ status }) => status !== "conformant"))
      return false;
    for (const decision of branch.decisionValidity ?? []) {
      if (!revised.has(decision.decisionId) && !revised.has(decision.authorityId))
        continue;
      if (decision.assessment.blocksCurrentChange)
        resolvedReasons.add(decision.assessment.explanation);
      for (const check of decision.checks)
        if (check.status === "unknown")
          resolvedReasons.add(check.reason);
    }
  }
  return resolvedReasons.size > 0 && governance.reasons.every((reason) => resolvedReasons.has(reason));
}
function removedUnsupportedEvidenceReasons(compiled, authorityId) {
  const revisions = (compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation, id }) => kind === "authority-record" && operation === "revise" && id === authorityId);
  if (revisions.length !== 1)
    return void 0;
  const revision = revisions[0];
  const before = AuthorityRecordSchema.safeParse(revision.before);
  const after = AuthorityRecordSchema.safeParse(revision.after);
  if (!before.success || !after.success)
    return void 0;
  const prior = before.data;
  const revised = after.data;
  const stableFields = ({ evidence: _evidence, rationale: _rationale, semanticHash: _semanticHash, ...fields }) => fields;
  if (prior.id !== authorityId || revised.id !== authorityId || canonicalJson(stableFields(prior)) !== canonicalJson(stableFields(revised)))
    return void 0;
  const priorIds = new Set(prior.evidence.map(({ evidenceId }) => evidenceId));
  const revisedIds = new Set(revised.evidence.map(({ evidenceId }) => evidenceId));
  if (priorIds.size !== prior.evidence.length || revisedIds.size !== revised.evidence.length || revised.evidence.some((reference) => {
    const retained = prior.evidence.find(({ evidenceId }) => evidenceId === reference.evidenceId);
    return retained === void 0 || canonicalJson(retained) !== canonicalJson(reference);
  }))
    return void 0;
  const removedIds = [...priorIds].filter((id) => !revisedIds.has(id));
  const rationalePrefix = `${prior.rationale.trimEnd()}

`;
  if (!revised.rationale.startsWith(rationalePrefix) || removedIds.some((id) => !revised.rationale.slice(rationalePrefix.length).includes(id)))
    return void 0;
  return removedIds.length === 0 ? void 0 : new Set(removedIds.map((id) => `Evidence ${id} has no supported accepted observation; external evidence validity is unknown.`));
}
function permitsUnchangedDecisionBaselineBinding(compiled, reconciliation) {
  if (reconciliation.status !== "suspect" || !permitsDecisionReconsideration(compiled, reconciliation.governance))
    return false;
  if (reconciliation.discoveryValidation.status !== "current" && reconciliation.discoveryValidation.status !== "rebound")
    return false;
  const revised = new Set((compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation }) => operation === "revise" && (kind === "architecture-decision" || kind === "authority-record")).map(({ id }) => id));
  const baselineTriggers = /* @__PURE__ */ new Set(["concept-changed", "requirement-changed", "scenario-changed", "relation-changed", "constraint-changed", "lens-changed", "scope-expanded"]);
  let qualifyingQueries = 0;
  for (const validation2 of [reconciliation.discoveryValidation, ...reconciliation.branches.map(({ validation: validation3 }) => validation3)]) {
    if (validation2.changedValueDependencyIds.length !== 0 || validation2.changedQueryDependencyIds.length !== 0)
      return false;
    if (validation2.status !== "current" && validation2.status !== "rebound" && validation2.status !== "suspect")
      return false;
    if (validation2.status === "suspect" && !validation2.observations?.length)
      return false;
    for (const observed of validation2.observations ?? []) {
      if (observed.status === "current")
        continue;
      if (observed.kind !== "query" || observed.status !== "unknown" || observed.basis === "unavailable" || observed.currentResult === void 0)
        return false;
      const { query, priorResult } = observed.dependency;
      const decisionId = query.input.decisionId;
      if (typeof decisionId !== "string" || query.kind !== "custom" || query.programId !== "projector.knowledge.decision-triggers" || query.programVersion !== "1" || query.id !== `knowledge-decision-triggers:${decisionId}`)
        return false;
      const current = observed.currentResult;
      if (priorResult.queryHash !== query.semanticHash || current.queryHash !== query.semanticHash || priorResult.observability !== "closed" || current.observability !== "closed" || priorResult.resultCount !== 1 || current.resultCount !== 1 || canonicalJson(priorResult) !== canonicalJson(current))
        return false;
      const decisions2 = reconciliation.governance.branches.flatMap(({ decisionValidity }) => decisionValidity ?? []).filter((decision) => decision.decisionId === decisionId);
      if (decisions2.length === 0)
        return false;
      for (const decision of decisions2) {
        if (!revised.has(decision.decisionId) && !revised.has(decision.authorityId) || decision.checks.some(({ status }) => status === "fired"))
          return false;
        const lanes = /* @__PURE__ */ new Set([...priorResult.unavailableLanes, ...current.unavailableLanes]);
        let reasons;
        if (decision.baseline.kind === "unavailable") {
          const unknown = decision.checks.filter(({ status }) => status === "unknown");
          if (unknown.length === 0 || unknown.some(({ trigger, reason }) => !baselineTriggers.has(trigger.type) || !reason.startsWith(`No accepted baseline observation for ${trigger.type}: `)))
            return false;
          reasons = new Set(unknown.map(({ reason }) => reason));
        } else if (decision.baseline.kind === "authenticated-transaction") {
          if (decision.checks.some(({ status }) => status === "unknown"))
            return false;
          reasons = removedUnsupportedEvidenceReasons(compiled, decision.authorityId);
        }
        if (reasons === void 0)
          return false;
        if (lanes.size !== reasons.size || [...lanes].some((reason) => !reasons.has(reason)))
          return false;
      }
      qualifyingQueries += 1;
    }
  }
  return qualifyingQueries > 0;
}
function approvedCompilation(compiled, capture) {
  if (compiled.proposalHash !== capture.proposalHash || exactPatchInputHash(compiled) !== capture.exactPatchInputHash) {
    throw new Error("lifecycle approval dependencies are stale for the current repository observation");
  }
  if (compiled.compiledPlan.packets.length !== capture.capsules.length)
    throw new Error("lifecycle approved packet composition changed");
  const packets = compiled.compiledPlan.packets.map((current, index) => {
    const capsule = capture.capsules[index];
    const packetId = capture.plan.packetIds[index];
    if (packetId === void 0 || capsule.taskId !== packetId)
      throw new Error("lifecycle captured plan and capsule identities do not compose");
    const packet = { ...current.packet, id: packetId, planId: capture.plan.id, capsuleId: capsule.id, boundState: capture.stateBinding };
    return { ...current, packet, capsule, packetHash: hashFramedDomain("semantic-change-work-packet", packet), capsuleHash: executionCapsuleHash(capsule) };
  });
  return {
    ...compiled,
    compiledPlan: {
      plan: capture.plan,
      packets,
      executionOrder: packets,
      packetHash: hashFramedDomain("semantic-change-packet-set", packets.map(({ packetHash, capsuleHash }) => ({ packetHash, capsuleHash })))
    },
    planHash: capture.planHash
  };
}
var RepositoryChangeLifecycleService = class _RepositoryChangeLifecycleService {
  repositoryRoot;
  store;
  representationArtifacts;
  now;
  leaseStaleAfterMs;
  applicationEvidence;
  representationProfileKey;
  constructor(repositoryRoot, store, representationArtifacts, options) {
    this.repositoryRoot = repositoryRoot;
    this.store = store;
    this.representationArtifacts = representationArtifacts;
    this.now = options.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
    this.leaseStaleAfterMs = options.leaseStaleAfterMs ?? 3e4;
    this.applicationEvidence = options.applicationEvidence;
    this.representationProfileKey = options.representationProfileKey;
  }
  static async create(repositoryRoot, options = {}) {
    repositoryRoot = resolve3(repositoryRoot);
    const store = await ChangeLifecycleStore.create(repositoryRoot, options);
    const representationArtifacts = await RepositoryRepresentationArtifactStore.create(repositoryRoot);
    return new _RepositoryChangeLifecycleService(repositoryRoot, store, representationArtifacts, options);
  }
  async capture(input, options = {}) {
    options.signal?.throwIfAborted();
    const proposal = parseChangeProposal(input.proposal);
    const suppliedId = input.knowledgeContextId?.normalize("NFKC").trim();
    if (input.knowledgeContextId !== void 0 && !suppliedId)
      throw new Error("knowledge context ID must be nonblank");
    const knowledgeContextId = await captureKnowledgeContextId(this.repositoryRoot, input.request, proposal, suppliedId, options.signal, this.applicationEvidence);
    const compiled = await this.compile(input.request, proposal, knowledgeContextId, options.signal, true, true);
    if (knowledgeContextId !== void 0)
      await this.assertKnowledgeContext(knowledgeContextId, compiled, proposal, options.signal);
    else
      await this.assertObservationFresh(compiled, options.signal);
    options.signal?.throwIfAborted();
    const capture = await this.store.capture({
      request: input.request.normalize("NFKC").trim(),
      proposal,
      proposalHash: compiled.proposalHash,
      semanticChangeId: compiled.compiledChange.change.id,
      plan: compiled.compiledPlan.plan,
      capsules: capsules(compiled),
      exactPatchInputHash: exactPatchInputHash(compiled),
      ...knowledgeContextId === void 0 ? {} : { knowledgeContextId }
    });
    await this.representationArtifacts.acknowledgeCapture(capture.semanticChangeId);
    return { capture, compiled };
  }
  async representationCaptureStatus(semanticChangeId, projectionId) {
    if (semanticChangeId === void 0)
      return "unassociated";
    try {
      const capture = await this.store.readCapture(semanticChangeId);
      if (projectionId === void 0 || !capture.capsules.some((capsule) => capsule.representation?.projectionId === projectionId))
        throw new Error("representation publication does not match its authenticated lifecycle capture");
      return "captured";
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return "uncaptured";
      throw error;
    }
  }
  async pendingRepresentations(options = {}) {
    const states = await this.representationArtifacts.pending(options);
    return Promise.all(states.map(async (state) => ({ ...state, captureStatus: await this.representationCaptureStatus(state.semanticChangeId, state.projectionId) })));
  }
  async recoverRepresentations(options = {}) {
    const outcomes = await this.representationArtifacts.recover(options);
    const results = [];
    for (const outcome of outcomes) {
      options.signal?.throwIfAborted();
      const captureStatus = await this.representationCaptureStatus(outcome.semanticChangeId, outcome.projectionId);
      if (outcome.status === "recovered" && captureStatus === "captured")
        await this.representationArtifacts.acknowledgeCapture(outcome.semanticChangeId);
      if (outcome.status === "recovered" && captureStatus === "uncaptured") {
        results.push({
          ...outcome,
          status: "recovery-required",
          captureStatus,
          reason: `Change ${outcome.semanticChangeId} has authenticated representation bytes but no lifecycle capture. Use inspect --representations to inspect the retained publication for projection ${outcome.projectionId}. If this change was never applied, re-present the original exact proposal to capture it. Recovery cannot reconstruct the missing capture or establish whether an external mutation occurred.`
        });
      } else
        results.push({ ...outcome, captureStatus });
    }
    return results;
  }
  async plan(selector, options = {}) {
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(selector);
    options.signal?.throwIfAborted();
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal);
    if (capture.knowledgeContextId !== void 0)
      await this.assertKnowledgeContext(capture.knowledgeContextId, compiled, proposal, options.signal);
    else
      await this.assertObservationFresh(compiled, options.signal);
    const mismatches = [];
    if (compiled.compiledChange.change.id !== capture.semanticChangeId)
      mismatches.push("semantic change identity");
    if (compiled.proposalHash !== capture.proposalHash)
      mismatches.push("proposal hash");
    if (compiled.compiledPlan.plan.id !== capture.planId || compiled.compiledPlan.plan.revision !== capture.planRevision)
      mismatches.push("plan identity or revision");
    if (compiled.planHash !== capture.planHash)
      mismatches.push("plan hash");
    if (exactPatchInputHash(compiled) !== capture.exactPatchInputHash)
      mismatches.push("exact patch input hash");
    const currentCapsules = capsules(compiled).map((capsule) => ({ packetId: capsule.taskId, capsuleId: capsule.id, capsuleHash: executionCapsuleHash(capsule) }));
    if (canonicalJson(currentCapsules) !== canonicalJson(capture.capsuleBindings))
      mismatches.push("capsule bindings");
    if (mismatches.length > 0)
      throw new Error(`lifecycle plan is stale or unauthenticated: ${mismatches.join(", ")}`);
    return { capture, compiled };
  }
  /**
   * Re-observes only the dependencies that authorize reuse of a captured plan.
   * The global compiledAgainst digest may rebind when every value/query and
   * representation-profile dependency remains identical.
   */
  async inspectCurrentPlan(selector, options = {}) {
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(selector);
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal, false);
    if (capture.knowledgeContextId !== void 0)
      await this.assertKnowledgeContext(capture.knowledgeContextId, compiled, proposal, options.signal);
    else
      await this.assertObservationFresh(compiled, options.signal);
    const validation2 = await validateCompiledRepositoryChangeCurrentness({ repositoryRoot: this.repositoryRoot, compiled, binding: capture.stateBinding, ...options.signal === void 0 ? {} : { signal: options.signal }, now: this.now });
    if (validation2.status !== "current")
      throw new Error(`lifecycle plan dependencies are ${validation2.status}: ${validation2.reasons.join("; ")}`);
    return { capture, compiled };
  }
  async approve(selector, presentedPlanHash, options = {}) {
    const planned = await this.plan(selector, options);
    options.signal?.throwIfAborted();
    return this.store.approve(selector, presentedPlanHash, planned.compiled.compiledPlan.plan, capsules(planned.compiled));
  }
  async readApproval(selector) {
    return this.store.readApproval(selector);
  }
  async apply(approvalSelector, options = {}) {
    options.signal?.throwIfAborted();
    const prior = await this.store.successfulResultForApproval(approvalSelector);
    if (prior !== void 0)
      return prior.result;
    const approvalRecord = await this.store.readApproval(approvalSelector);
    const capture = await this.store.readCapture(approvalRecord.semanticChangeId);
    if (approvalRecord.planHash !== capture.planHash)
      throw new Error("lifecycle approval is stale for the current authenticated plan");
    if (approvalRecord.knowledgeContextId !== capture.knowledgeContextId)
      throw new Error("lifecycle approval knowledge context does not match the authenticated capture");
    if (approvalRecord.approvals.length !== 1)
      throw new Error("initial repository lifecycle requires exactly one packet approval");
    const paths = await RepositoryPathService.create(this.repositoryRoot);
    const journal = new FileTransactionJournal(paths);
    const incomplete = await journal.incomplete();
    if (incomplete.length > 0)
      throw new Error(`incomplete governed transaction requires recovery before apply: ${incomplete.map(({ entry }) => entry.transactionId).join(", ")}`);
    const proposal = parseChangeProposal(capture.proposal);
    const currentCompilation = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal);
    if (capture.knowledgeContextId !== void 0)
      await this.assertKnowledgeContext(capture.knowledgeContextId, currentCompilation, proposal, options.signal);
    else
      await this.assertObservationFresh(currentCompilation, options.signal);
    const compiled = approvedCompilation(currentCompilation, capture);
    options.signal?.throwIfAborted();
    const attempt = await this.store.beginAttempt(approvalRecord.id);
    let result;
    try {
      result = await executeCompiledRepositoryChange({
        repositoryRoot: this.repositoryRoot,
        compiled,
        approval: approvalRecord.approvals[0],
        attempt,
        store: this.store,
        now: this.now,
        leaseStaleAfterMs: this.leaseStaleAfterMs,
        signal: options.signal ?? new AbortController().signal
      });
    } catch (error) {
      try {
        const transaction = await journal.read(attempt.transactionId);
        if (transaction.entry.phase === "committed")
          await this.store.markCommittedUnpublished(attempt.id, transaction);
      } catch (inspectionError) {
        if (!(inspectionError instanceof Error && "code" in inspectionError && inspectionError.code === "ENOENT"))
          throw inspectionError;
      }
      throw error;
    }
    if (result.outcome === "success") {
      const transaction = await journal.read(attempt.transactionId);
      await this.store.completeSuccessfulAttempt(attempt.id, result, transaction);
    } else {
      await this.store.completeAttempt(attempt.id, result.outcome, result);
    }
    return result;
  }
  async recover(approvalSelector, options = {}) {
    options.signal?.throwIfAborted();
    const approval = await this.store.readApproval(approvalSelector);
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(approval.semanticChangeId);
    if (approval.knowledgeContextId !== capture.knowledgeContextId)
      throw new Error("lifecycle approval knowledge context does not match the authenticated capture");
    const attempts = await this.store.incompleteAttemptsForApproval(approval.id);
    options.signal?.throwIfAborted();
    if (attempts.length === 0)
      return [];
    const paths = await RepositoryPathService.create(this.repositoryRoot);
    const journal = new FileTransactionJournal(paths);
    const worktree = new GovernedWorktreeRuntime(new WriterLeaseManager(paths, { staleAfterMs: this.leaseStaleAfterMs }), journal);
    const session = await worktree.open({
      sessionId: `recovery_${hashFramedDomain("change-lifecycle-recovery-session", attempts.map(({ id }) => id)).slice(-32)}`,
      processId: process.pid,
      stateBinding: capture.stateBinding
    });
    let recovered;
    try {
      options.signal?.throwIfAborted();
      recovered = await session.recover(attempts.map(({ transactionId }) => transactionId), options.signal === void 0 ? {} : { signal: options.signal });
      options.signal?.throwIfAborted();
      const byTransaction = new Map(recovered.map((result) => [result.transactionId, result]));
      const outcomes = [];
      for (const attempt of attempts) {
        options.signal?.throwIfAborted();
        let record;
        try {
          record = await journal.read(attempt.transactionId);
          options.signal?.throwIfAborted();
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
            throw error;
        }
        const recovery = byTransaction.get(attempt.transactionId);
        if (record?.entry.phase === "committed") {
          let prepared;
          try {
            prepared = await this.store.readPreparedSuccess(attempt.id);
            options.signal?.throwIfAborted();
          } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
              outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: "committed transaction has no authenticated prepared-success checkpoint" });
              continue;
            }
            throw error;
          }
          if (!record.entry.checkpointIds.includes(prepared.prepared.checkpointId)) {
            outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: "committed journal does not bind the authenticated prepared-success identity" });
            continue;
          }
          options.signal?.throwIfAborted();
          const result = await publishPreparedStateBoundChangeSuccess(prepared.prepared, {
            write: async (kind, hash, content) => {
              options.signal?.throwIfAborted();
              const published = await this.store.writeArtifact(kind, hash, content);
              options.signal?.throwIfAborted();
              return published;
            }
          });
          options.signal?.throwIfAborted();
          await this.store.completeSuccessfulAttempt(attempt.id, result, record);
          outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "finalized" });
          continue;
        }
        if (record?.entry.phase === "recovery-required" || recovery?.action === "recovery-required") {
          outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: recovery?.reason ?? "journal requires manual recovery" });
          continue;
        }
        const outcome = record === void 0 ? { attemptId: attempt.id, transactionId: attempt.transactionId, action: "no-transaction", reason: "attempt stopped before a governed transaction began" } : { attemptId: attempt.id, transactionId: attempt.transactionId, action: "rolled-back" };
        options.signal?.throwIfAborted();
        try {
          await this.store.readAttemptResult(attempt.id);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
            throw error;
          await this.store.completeAttempt(attempt.id, "failure", { kind: "recovery", ...outcome });
        }
        outcomes.push(outcome);
      }
      return outcomes;
    } finally {
      await session.close();
    }
  }
  async compile(request, proposal, contextId, signal, publishRepresentation = true, retainCaptureAssociation = false) {
    return withObservationScope(signal === void 0 ? {} : { signal }, async () => {
      const observation = await observeChangeRepository(this.repositoryRoot);
      const knowledgeContext = await adjudicatedKnowledgeContext(this.repositoryRoot, proposal, contextId, signal, this.applicationEvidence, observation);
      const compiled = await compileRepositoryChange({ repositoryRoot: this.repositoryRoot, request, proposal, now: this.now(), ...knowledgeContext === void 0 ? {} : { knowledgeContext } }, {
        ...publishRepresentation ? { representationArtifacts: this.representationArtifacts } : {},
        ...this.representationProfileKey === void 0 ? {} : { representationProfileKey: this.representationProfileKey },
        ...signal === void 0 ? {} : { signal },
        observation
      });
      assertIdentityDisposition(compiled, proposal);
      compilationObservations.set(compiled, observation);
      if (publishRepresentation)
        await this.representationArtifacts.publish(compiled.representationDetails, retainCaptureAssociation ? compiled.compiledChange.change.id : void 0);
      return compiled;
    });
  }
  async assertKnowledgeContext(contextId, compiled, proposal, signal) {
    const observation = compilationObservations.get(compiled);
    if (observation === void 0)
      throw new Error("Lifecycle compilation has no request-local repository observation");
    const knowledge = await RepositoryKnowledgeService.create(this.applicationEvidence === void 0 ? this.repositoryRoot : { repositoryRoot: this.repositoryRoot, applicationEvidence: this.applicationEvidence });
    const reconciliation = await knowledge.reconcile(contextId, { ...signal === void 0 ? {} : { signal }, observation });
    const expectedState = compiled.compiledPlan.plan.boundState.compiledAgainst;
    if (canonicalJson(reconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("knowledge context and lifecycle compilation observed different repository states; retry before mutation");
    }
    if (reconciliation.status !== "current" && reconciliation.status !== "rebound" && !permitsUnchangedDecisionBaselineBinding(compiled, reconciliation)) {
      throw new Error(`knowledge context binding is ${reconciliation.status}: ${reconciliation.reasons.join("; ")}`);
    }
    const selected = compiled.knowledgeContext;
    const selectedReconciliation = selected !== void 0 && selected.id !== contextId ? await knowledge.reconcile(selected.id, { ...signal === void 0 ? {} : { signal }, observation }) : reconciliation;
    if (selectedReconciliation.status !== "current" && selectedReconciliation.status !== "rebound" && !permitsUnchangedDecisionBaselineBinding(compiled, selectedReconciliation)) {
      throw new Error(`selected knowledge context binding is ${selectedReconciliation.status}: ${selectedReconciliation.reasons.join("; ")}`);
    }
    const governance = selectedReconciliation.governance;
    if (selectedReconciliation.applicationEvidence.status === "violated" || selectedReconciliation.applicationEvidence.status === "unknown") {
      throw new Error(`knowledge context application evidence is ${selectedReconciliation.applicationEvidence.status}: ${selectedReconciliation.applicationEvidence.branches.flatMap(({ reasons }) => reasons).join("; ")}`);
    }
    if (proposal.identityResolution?.selectedEntityIds.length !== 0 && governance.status !== "conformant" && governance.status !== "not-applicable" && !permitsDecisionReconsideration(compiled, governance)) {
      throw new Error(`knowledge context governance is ${governance.status}: ${governance.reasons.join("; ")}`);
    }
    if (canonicalJson(selectedReconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("selected knowledge and lifecycle compilation observed different repository states; retry before mutation");
    }
    await this.assertObservationFresh(compiled, signal);
  }
  async assertObservationFresh(compiled, signal) {
    signal?.throwIfAborted();
    const observation = compilationObservations.get(compiled);
    if (observation === void 0)
      throw new Error("Lifecycle compilation has no request-local repository observation");
    const current = await observeRepositoryState(observation);
    signal?.throwIfAborted();
    if (canonicalJson(current) !== canonicalJson(compiled.compiledPlan.plan.boundState.compiledAgainst))
      throw new Error("Repository changed during lifecycle compilation or knowledge reconciliation; retry before mutation");
  }
};

// node_modules/@projector/control-plane/dist/representation/service.js
var factStatusSchema = z5.enum(["valid", "invalid", "unavailable"]);
var freshnessStatusSchema = z5.enum(["current", "stale", "unknown"]);
var representationInspectionFields = {
  kind: z5.literal("representation-inspection"),
  changeSelector: z5.string().min(1),
  view: z5.enum(["summary", "content"]),
  association: z5.strictObject({
    planId: z5.string().min(1),
    planRevision: z5.number().int().positive(),
    planHash: ContentHashSchema,
    capsuleId: z5.string().min(1),
    capsuleHash: ContentHashSchema,
    normativeKernelHash: ContentHashSchema,
    representation: RepresentationProjectionRefSchema
  }),
  renderedText: z5.string().optional(),
  artifactIntegrity: z5.strictObject({ status: factStatusSchema, recordHash: ContentHashSchema.optional(), reason: z5.string().min(1) }),
  dependencyFreshness: z5.strictObject({ status: freshnessStatusSchema, currentState: StateDigestSchema.optional(), reasons: z5.array(z5.string().min(1)) }),
  semanticFidelity: z5.strictObject({
    status: factStatusSchema,
    reason: z5.string().min(1),
    projection: RepresentationProjectionSchema.optional(),
    validatorResults: z5.array(ValidationResultSchema)
  }),
  executionAuthorization: z5.strictObject({
    status: z5.enum(["not-supplied", "authenticated-current", "authenticated-stale", "unknown"]),
    approvalSelector: z5.string().min(1).optional(),
    reason: z5.string().min(1)
  })
};
function validateInspectionOutput(value, context) {
  if (value.view === "summary" && value.renderedText !== void 0) {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "the summary view cannot expose rendered text" });
  }
  if (value.view === "content" && value.artifactIntegrity.status === "valid" && value.renderedText === void 0) {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "a valid content view must expose the authenticated rendered text" });
  }
  if (value.renderedText !== void 0 && value.artifactIntegrity.status !== "valid") {
    context.addIssue({ code: "custom", path: ["renderedText"], message: "invalid or unavailable artifacts cannot expose rendered text" });
  }
}
var RepresentationInspectionOutputSchema = z5.strictObject({
  ...representationInspectionFields,
  delivery: z5.strictObject({
    stage: z5.literal("inspection-service"),
    deliveredToRunnerBoundary: z5.literal(false),
    agentUnderstandingEstablished: z5.literal(false),
    behavioralCompletionEstablished: z5.literal(false)
  })
}).superRefine(validateInspectionOutput);
var RepresentationInspectionOperationOutputSchema = z5.strictObject({
  ...representationInspectionFields,
  delivery: z5.strictObject({
    stage: z5.literal("operation-runner"),
    deliveredToRunnerBoundary: z5.literal(true),
    agentUnderstandingEstablished: z5.literal(false),
    behavioralCompletionEstablished: z5.literal(false)
  })
}).superRefine(validateInspectionOutput);
function projectRepresentationInspectionOperation(inspection) {
  return RepresentationInspectionOperationOutputSchema.parse({
    ...RepresentationInspectionOutputSchema.parse(inspection),
    delivery: {
      stage: "operation-runner",
      deliveredToRunnerBoundary: true,
      agentUnderstandingEstablished: false,
      behavioralCompletionEstablished: false
    }
  });
}
function selectCapsule(capture, capsuleId) {
  if (capsuleId === void 0) {
    if (capture.capsules.length !== 1)
      throw new Error("capsuleId is required when a plan has more than one execution capsule");
    return capture.capsules[0];
  }
  const capsule = capture.capsules.find(({ id }) => id === capsuleId);
  if (capsule === void 0)
    throw new Error("requested capsule is not bound to the authenticated lifecycle plan");
  return ExecutionCapsuleSchema.parse(capsule);
}
function errorReason(error) {
  return error instanceof Error && error.message.trim() !== "" ? error.message : "representation observation failed without a diagnostic";
}
function staleReason(reason) {
  return /\b(?:stale|changed|mismatch|does not match|different repository states|binding is suspect|binding is violated|dependencies are violated)\b/iu.test(reason);
}
var RepositoryRepresentationInspectionService = class _RepositoryRepresentationInspectionService {
  lifecycle;
  lifecycleStore;
  artifacts;
  constructor(lifecycle, lifecycleStore, artifacts) {
    this.lifecycle = lifecycle;
    this.lifecycleStore = lifecycleStore;
    this.artifacts = artifacts;
  }
  static async create(repositoryRoot, options = {}) {
    const [lifecycle, lifecycleStore, artifacts] = await Promise.all([
      RepositoryChangeLifecycleService.create(repositoryRoot, options),
      ChangeLifecycleStore.create(repositoryRoot),
      RepositoryRepresentationArtifactStore.create(repositoryRoot)
    ]);
    return new _RepositoryRepresentationInspectionService(lifecycle, lifecycleStore, artifacts);
  }
  async inspect(input) {
    input.signal?.throwIfAborted();
    const capture = await this.lifecycleStore.readCapture(input.changeSelector);
    const capsule = selectCapsule(capture, input.capsuleId);
    const reference = capsule.representation;
    if (reference === void 0)
      throw new Error("selected execution capsule has no representation projection");
    let durable;
    let artifactIntegrity;
    try {
      durable = await this.artifacts.read(reference);
      artifactIntegrity = durable === void 0 ? { status: "unavailable", reason: "durable representation artifact is unavailable" } : { status: "valid", recordHash: durable.recordHash, reason: "durable record, projection and rendered bytes match the selected capsule reference" };
    } catch (error) {
      durable = void 0;
      artifactIntegrity = { status: "invalid", reason: errorReason(error) };
    }
    input.signal?.throwIfAborted();
    let freshness2;
    try {
      const current = await this.lifecycle.inspectCurrentPlan(input.changeSelector, input.signal === void 0 ? {} : { signal: input.signal });
      const currentCapsule = current.compiled.compiledPlan.packets.map(({ capsule: currentPacketCapsule }) => currentPacketCapsule).find(({ id }) => id === capsule.id);
      if (executionPlanHash(current.compiled.compiledPlan.plan) !== capture.planHash || currentCapsule === void 0 || executionCapsuleHash(currentCapsule) !== executionCapsuleHash(capsule) || canonicalJson(currentCapsule.representation) !== canonicalJson(reference)) {
        freshness2 = { status: "stale", currentState: current.compiled.compiledPlan.plan.boundState.compiledAgainst, reasons: ["live lifecycle recompilation changed the plan, capsule, or representation association"] };
      } else {
        freshness2 = { status: "current", currentState: current.compiled.compiledPlan.plan.boundState.compiledAgainst, reasons: ["live lifecycle recompilation matched every bound plan, capsule, representation, value and query dependency"] };
      }
    } catch (error) {
      input.signal?.throwIfAborted();
      const reason = errorReason(error);
      freshness2 = { status: staleReason(reason) ? "stale" : "unknown", reasons: [reason] };
    }
    if (freshness2.status === "current" && durable !== void 0) {
      const profile = currentBuiltInRepresentationProfile(reference.profileId);
      const boundProfile = durable.projection.boundState.valueDependencies.find(({ kind, id }) => kind === "representation-profile" && id === reference.profileId);
      if (profile === void 0 || reference.profileVersion !== profile.version || boundProfile?.versionHash !== profile.semanticHash) {
        freshness2 = { status: "stale", ...freshness2.currentState === void 0 ? {} : { currentState: freshness2.currentState }, reasons: ["selected representation profile version or semantic hash changed"] };
      }
    }
    const fidelity = durable === void 0 ? { status: artifactIntegrity.status === "invalid" ? "invalid" : "unavailable", reason: "compiler fidelity evidence is unavailable without an authenticated durable projection", validatorResults: [] } : durable.projection.preservation.semanticHash !== reference.preservationHash || durable.projection.validatorResults.some(({ status }) => status !== "passed") ? { status: "invalid", reason: "compiler fidelity evidence does not authenticate the selected preservation result", projection: durable.projection, validatorResults: durable.projection.validatorResults } : { status: "valid", reason: "compiler-owned protected dimensions and validator results authenticate the selected representation", projection: durable.projection, validatorResults: durable.projection.validatorResults };
    const authorization = await this.authorization(input.approvalSelector, capture, capsule, freshness2.status);
    input.signal?.throwIfAborted();
    return RepresentationInspectionOutputSchema.parse({
      kind: "representation-inspection",
      changeSelector: input.changeSelector,
      view: input.view,
      association: {
        planId: capture.planId,
        planRevision: capture.planRevision,
        planHash: capture.planHash,
        capsuleId: capsule.id,
        capsuleHash: executionCapsuleHash(capsule),
        normativeKernelHash: capsule.normativeKernelHash,
        representation: reference
      },
      ...input.view === "content" && durable !== void 0 ? { renderedText: durable.content } : {},
      artifactIntegrity,
      dependencyFreshness: freshness2,
      semanticFidelity: fidelity,
      executionAuthorization: authorization,
      delivery: { stage: "inspection-service", deliveredToRunnerBoundary: false, agentUnderstandingEstablished: false, behavioralCompletionEstablished: false }
    });
  }
  async authorization(approvalSelector, capture, capsule, freshness2) {
    if (approvalSelector === void 0)
      return { status: "not-supplied", reason: "inspection does not require or create execution approval" };
    try {
      const approval = await this.lifecycleStore.readApproval(approvalSelector);
      const capsuleApproval = approval.approvals.find(({ capsuleId }) => capsuleId === capsule.id);
      const valid = approval.semanticChangeId === capture.semanticChangeId && approval.planHash === capture.planHash && capsuleApproval?.planId === capture.planId && capsuleApproval.planRevision === capture.planRevision && capsuleApproval.planHash === capture.planHash && capsuleApproval.dependencyDigest === capture.stateBinding.dependencyDigest && capsuleApproval.capsuleHash === executionCapsuleHash(capsule);
      if (!valid)
        throw new Error("approval does not authenticate the selected plan revision and capsule");
      if (freshness2 === "current")
        return { status: "authenticated-current", approvalSelector, reason: "existing approval authenticates the selected current plan and capsule; inspection creates no new authority" };
      if (freshness2 === "stale")
        return { status: "authenticated-stale", approvalSelector, reason: "existing approval is authentic but the selected representation or its live dependencies are stale" };
      return { status: "unknown", approvalSelector, reason: "approval is authentic but live dependency currentness is unavailable" };
    } catch (error) {
      throw new Error(`approval selector is not bound to this inspection: ${errorReason(error)}`);
    }
  }
};

// node_modules/@projector/control-plane/dist/coverage/continuation.js
var freshnessSchema = z6.enum(["current", "stale", "unknown"]);
var evidenceSchema = z6.strictObject({
  id: z6.string(),
  owner: z6.enum(["knowledge", "lifecycle", "representation"]),
  status: freshnessSchema,
  availability: z6.enum(["present", "missing", "unobservable"]),
  required: z6.boolean(),
  reason: z6.string(),
  outcome: z6.enum(["success", "failure", "partial"]).optional(),
  dependency: StateDependencyObservationSchema.optional(),
  binding: z6.strictObject({ status: z6.enum(["current", "rebound", "stale", "suspect", "unavailable"]), compiledAgainst: StateDigestSchema, currentState: StateDigestSchema }).optional(),
  inspect: ProjectorOperationRequestSchema.optional()
});
var RepositoryContinuationSchema = z6.strictObject({
  readOnly: z6.literal(true),
  context: z6.strictObject({ contextId: z6.string(), status: freshnessSchema, governance: z6.enum(["conformant", "violated", "unknown", "not-applicable"]) }).optional(),
  restoration: z6.strictObject({ meaning: KnowledgeReconciliationAgentViewSchema, context: KnowledgeContextAgentViewSchema.optional() }).optional(),
  lifecycle: z6.strictObject({ changeSelector: z6.string(), approvalSelector: z6.string().optional(), status: z6.enum(["unresolved", "recovery-required", "completed", "unknown"]), planFreshness: freshnessSchema }).optional(),
  advisoryNotes: z6.strictObject({ status: z6.literal("unobservable"), reason: z6.string() }),
  evidence: z6.array(evidenceSchema).max(50),
  counts: z6.strictObject({ current: z6.number().int().nonnegative(), stale: z6.number().int().nonnegative(), unknown: z6.number().int().nonnegative() }),
  page: z6.strictObject({ offset: z6.number().int().nonnegative(), total: z6.number().int().nonnegative(), included: z6.number().int().nonnegative(), omitted: z6.number().int().nonnegative(), nextOffset: z6.number().int().nonnegative().nullable(), evidenceIdentity: ContentHashSchema }),
  nextAction: ProjectorOperationRequestSchema.nullable(),
  reason: z6.string(),
  drillDown: ProjectorOperationRequestSchema.nullable(),
  limits: z6.array(z6.string())
});
function freshness(status) {
  return status === "current" || status === "rebound" ? "current" : status === "stale" ? "stale" : "unknown";
}
function isMissing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
async function inspectRepositoryContinuation(repositoryRoot, request, options = {}) {
  const input = ProjectorOperationInputSchemas.cleanup.parse(request);
  const signal = options.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  const evidence = [];
  let context;
  let restoration;
  let lifecycle;
  let nextAction = null;
  let reason = "Inspect the cleanup questions for unresolved accepted work; no lifecycle authority was selected.";
  const operation = (operation2, input2) => ProjectorOperationRequestSchema.parse({ apiVersion: "projector.operation/v1", repositoryRoot, operation: operation2, input: input2 });
  const lifecycleStore = await ChangeLifecycleStore.create(repositoryRoot);
  const approval = input.approvalSelector === void 0 ? void 0 : await lifecycleStore.readApproval(input.approvalSelector);
  const changeSelector = input.changeSelector ?? approval?.semanticChangeId;
  const capture = changeSelector === void 0 ? void 0 : await lifecycleStore.readCapture(changeSelector);
  if (approval !== void 0 && (approval.semanticChangeId !== capture?.semanticChangeId || approval.planHash !== capture.planHash || approval.knowledgeContextId !== capture.knowledgeContextId))
    throw new Error("Continuation approval does not authenticate the selected lifecycle capture.");
  const contextId = input.contextId ?? capture?.knowledgeContextId;
  if (contextId !== void 0) {
    const store = await KnowledgeContextStore.create(repositoryRoot);
    let retained;
    try {
      retained = await store.read(contextId);
    } catch (error) {
      if (!isMissing(error) && !(error instanceof Error && isMissing(error.cause)))
        throw error;
    }
    if (retained === void 0) {
      context = { contextId, status: "unknown", governance: "unknown" };
      evidence.push({ id: contextId, owner: "knowledge", status: "unknown", availability: "missing", required: true, reason: "The selected saved context is absent from its disposable cache; current meaning must be retrieved before this reasoning can be reused." });
      nextAction = operation("context", { request: capture?.request ?? `Recover current meaning for the unavailable saved context ${contextId}`, persist: true });
      reason = "Retrieve current meaning before reusing unavailable saved reasoning.";
    } else {
      const reconciled = options.reconcileContext === void 0 ? await (await RepositoryKnowledgeService.create({ repositoryRoot, ...options.applicationEvidence === void 0 ? {} : { applicationEvidence: options.applicationEvidence } })).reconcile(retained.id, { signal }) : await options.reconcileContext(retained);
      context = { contextId: retained.id, status: freshness(reconciled.status), governance: reconciled.governance.status };
      restoration = { meaning: KnowledgeReconciliationAgentViewSchema.parse(projectKnowledgeReconciliation(reconciled)), ...["current", "rebound"].includes(reconciled.status) ? { context: KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(retained)) } : {} };
      for (const item of [{ id: "discovery", validation: reconciled.discoveryValidation }, ...reconciled.branches.map(({ branchId, validation: validation2 }) => ({ id: branchId, validation: validation2 }))]) {
        const bound = item.id === "discovery" ? retained.discoveryBinding : retained.branches.find(({ id }) => id === item.id).closure.boundState;
        evidence.push({ id: `${retained.id}:${item.id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: item.validation.reasons.join("; ") || "Bound values and query results remain current.", binding: { status: item.validation.status, compiledAgainst: bound.compiledAgainst, currentState: item.validation.currentState }, inspect: operation("reconcile", { contextId: retained.id }) });
        for (const observation of item.validation.observations ?? []) {
          const id = observation.kind === "value" ? observation.dependency.id : observation.dependency.query.id;
          const changed = observation.kind === "value" ? `Bound value or profile changed: ${id}` : `Bound query semantics or result changed: ${id}`;
          evidence.push({ id: `${item.id}:${observation.kind}:${id}:${hashFramedDomain("continuation-dependency-role", observation.dependency.role)}`, owner: "knowledge", status: observation.status, availability: observation.status === "unknown" ? "unobservable" : "present", required: true, reason: observation.status === "stale" ? `${changed}; ${observation.reason}` : observation.reason, dependency: observation });
        }
        if (item.validation.observations === void 0) {
          for (const id of item.validation.changedValueDependencyIds)
            evidence.push({ id: `${item.id}:value:${id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: `Bound value or profile changed: ${id}` });
          for (const id of item.validation.changedQueryDependencyIds)
            evidence.push({ id: `${item.id}:query:${id}`, owner: "knowledge", status: freshness(item.validation.status), availability: "present", required: true, reason: `Bound query semantics or result changed: ${id}` });
        }
      }
      for (const message of reconciled.governance.reasons)
        evidence.push({ id: hashFramedDomain("continuation-governance", message), owner: "knowledge", status: "unknown", availability: "present", required: true, reason: message });
      for (const message of retained.unknowns)
        evidence.push({ id: hashFramedDomain("continuation-retained-unknown", message), owner: "knowledge", status: "unknown", availability: "unobservable", required: false, reason: `Retained context boundary: ${message}` });
      if (context.status !== "current" || !["conformant", "not-applicable"].includes(context.governance)) {
        nextAction = operation("context", { ...retained.requestOptions, request: retained.request, persist: true });
        reason = "Refresh affected reasoning; binding freshness and current governance are separate observations.";
      }
    }
  }
  if (capture !== void 0) {
    let recoveryRequired = false;
    let completed = false;
    if (approval !== void 0) {
      const journal = new FileTransactionJournal(await RepositoryPathService.create(repositoryRoot));
      for (const attempt of await lifecycleStore.attemptsForApproval(approval.id)) {
        signal.throwIfAborted();
        let result;
        try {
          result = await lifecycleStore.readAttemptResult(attempt.id);
        } catch (error) {
          if (!isMissing(error))
            throw error;
        }
        let transaction;
        try {
          transaction = await journal.read(attempt.transactionId);
        } catch (error) {
          if (!isMissing(error))
            throw error;
        }
        if (result !== void 0) {
          completed ||= result.outcome === "success";
          evidence.push({ id: attempt.id, owner: "lifecycle", status: "current", availability: "present", required: true, outcome: result.outcome, reason: `Authenticated historical ${result.outcome} result. Historical completion does not authorize repeating committed effects.` });
          if (transaction !== void 0 && !["committed", "rolled-back"].includes(transaction.entry.phase)) {
            recoveryRequired = true;
            evidence.push({ id: `${attempt.id}:journal`, owner: "lifecycle", status: "current", availability: "present", required: true, reason: `The published ${result.outcome} result does not close journal phase ${transaction.entry.phase}. Recover the remaining effects while preserving this outcome.` });
          }
          continue;
        }
        recoveryRequired = true;
        evidence.push({ id: attempt.id, owner: "lifecycle", status: "current", availability: "present", required: true, reason: `Authenticated unfinished attempt; journal phase: ${transaction?.entry.phase ?? "not-started"}. Use recovery before attempting further effects.` });
        evidence.push({ id: `${attempt.id}:result`, owner: "lifecycle", status: "unknown", availability: "missing", required: true, reason: "The result or an artifact required to authenticate it is missing; no completed-success claim can be reused." });
        if (transaction?.entry.phase === "committed" || transaction?.entry.checkpointIds.some((id) => id.startsWith("prepared-success:"))) {
          let prepared;
          try {
            prepared = await lifecycleStore.readPreparedSuccess(attempt.id);
          } catch (error) {
            if (!isMissing(error))
              throw error;
          }
          evidence.push({ id: `${attempt.id}:prepared-success`, owner: "lifecycle", status: prepared === void 0 ? "unknown" : "current", availability: prepared === void 0 ? "missing" : "present", required: true, reason: prepared === void 0 ? "The journal names required prepared-success evidence, but it is unavailable. Recovery cannot invent that evidence." : "Authenticated prepared-success evidence is available for recovery publication." });
        }
      }
    }
    let planFreshness = "current";
    let representationAvailable = true;
    const representation = await RepositoryRepresentationInspectionService.create(repositoryRoot, options);
    for (const capsule of capture.capsules) {
      if (capsule.representation === void 0)
        continue;
      const inspected = await representation.inspect({ changeSelector: capture.semanticChangeId, capsuleId: capsule.id, view: "summary", ...approval === void 0 ? {} : { approvalSelector: approval.id }, signal });
      if (inspected.dependencyFreshness.status === "unknown")
        planFreshness = "unknown";
      else if (inspected.dependencyFreshness.status === "stale" && planFreshness !== "unknown")
        planFreshness = "stale";
      evidence.push({ id: `${capsule.id}:dependencies`, owner: "representation", status: inspected.dependencyFreshness.status, availability: "present", required: true, reason: inspected.dependencyFreshness.reasons.join("; ") });
      const valid = inspected.artifactIntegrity.status === "valid" && inspected.semanticFidelity.status === "valid";
      representationAvailable &&= valid;
      evidence.push({ id: `${capsule.id}:artifact`, owner: "representation", status: valid ? "current" : "unknown", availability: inspected.artifactIntegrity.status === "unavailable" ? "missing" : "present", required: true, reason: `${inspected.artifactIntegrity.reason}; ${inspected.semanticFidelity.reason}`, inspect: operation("representation.inspect", { changeSelector: capture.semanticChangeId, capsuleId: capsule.id, ...approval === void 0 ? {} : { approvalSelector: approval.id }, view: "content" }) });
    }
    if (capture.capsules.length === 0 || capture.capsules.some(({ representation: representation2 }) => representation2 === void 0)) {
      planFreshness = "unknown";
      representationAvailable = false;
      evidence.push({ id: `${capture.planId}:representation`, owner: "representation", status: "unknown", availability: "unobservable", required: true, reason: "The selected plan has no inspectable representation for every capsule." });
    }
    lifecycle = { changeSelector: capture.semanticChangeId, ...approval === void 0 ? {} : { approvalSelector: approval.id }, status: recoveryRequired ? "recovery-required" : completed ? "completed" : "unresolved", planFreshness };
    if (recoveryRequired && approval !== void 0) {
      nextAction = operation("change.recover", { approvalSelector: approval.id });
      reason = "Resolve the durable unfinished attempt first. Stale planning or missing advisory preparation does not authorize blocking safe recovery.";
    } else if (completed) {
      if (nextAction === null)
        nextAction = operation("complete", { scope: input.scope ?? "." });
      reason = "The selected lifecycle has authenticated historical success. Continue remaining obligations without replaying committed effects.";
    } else if (nextAction === null) {
      if (planFreshness !== "current") {
        nextAction = operation("context", { request: capture.request, persist: true });
        reason = "Refresh current meaning and revise the immutable plan before requesting new approval; selected plan dependencies are stale or unknown.";
      } else if (!representationAvailable) {
        nextAction = operation("change.plan", { changeSelector: capture.semanticChangeId });
        reason = "Regenerate and review the required plan-bound representation before execution.";
      } else {
        nextAction = approval === void 0 ? operation("change.approve", { changeSelector: capture.semanticChangeId, planHash: capture.planHash }) : operation("change.apply", { approvalSelector: approval.id });
        reason = approval === void 0 ? "Review and approve the exact current plan hash before execution." : "The selected approval and its plan dependencies are current; continue through the lifecycle service.";
      }
    }
  }
  signal.throwIfAborted();
  nextAction ??= operation("complete", { scope: input.scope ?? "." });
  const evidenceIdentity = hashFramedDomain("repository-continuation-evidence", { context, lifecycle, evidence });
  if (input.evidenceIdentity !== void 0 && input.evidenceIdentity !== evidenceIdentity)
    throw new Error("Continuation evidence changed; restart cleanup at evidenceOffset 0 without the previous evidenceIdentity.");
  const offset = input.evidenceOffset ?? 0;
  const limit = input.evidenceLimit ?? 10;
  if (offset > evidence.length)
    throw new Error("evidenceOffset exceeds the current continuation evidence population");
  const selected = evidence.slice(offset, offset + limit);
  const nextOffset = offset + selected.length < evidence.length ? offset + selected.length : null;
  return RepositoryContinuationSchema.parse({
    readOnly: true,
    ...context === void 0 ? {} : { context },
    ...restoration === void 0 ? {} : { restoration },
    ...lifecycle === void 0 ? {} : { lifecycle },
    advisoryNotes: { status: "unobservable", reason: "The selected existing owners do not name advisory notes. No note discovery or absence claim is inferred." },
    evidence: selected,
    counts: { current: evidence.filter(({ status }) => status === "current").length, stale: evidence.filter(({ status }) => status === "stale").length, unknown: evidence.filter(({ status }) => status === "unknown").length },
    page: { offset, total: evidence.length, included: selected.length, omitted: evidence.length - selected.length, nextOffset, evidenceIdentity },
    nextAction,
    reason,
    drillDown: nextOffset === null ? null : operation("cleanup", { ...input, evidenceOffset: nextOffset, evidenceLimit: limit, evidenceIdentity }),
    limits: ["Evidence pagination bounds disclosure, not repository observation. Each page re-observes the existing owners and rejects changed evidence.", "Current bindings are not proof of behavioral completion. No note, answer or progress store is created."]
  });
}

// node_modules/@projector/control-plane/dist/observation/deadline-signal.js
function observationHostSignal(scope, caller) {
  const deadline = scope.deadline;
  if (!Number.isFinite(deadline))
    return { signal: AbortSignal.any([scope.signal, caller]), close() {
    } };
  const controller = new AbortController();
  let timer;
  const schedule = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      controller.abort(new Error("Observation deadline exceeded"));
      return;
    }
    timer = setTimeout(schedule, Math.min(remaining, 2147483647));
    timer.unref();
  };
  schedule();
  return {
    signal: AbortSignal.any([scope.signal, caller, controller.signal]),
    close() {
      if (timer !== void 0)
        clearTimeout(timer);
    }
  };
}

// node_modules/@projector/control-plane/dist/observation/indexed-knowledge-host.js
function createIndexedKnowledgeComputeHostHandler(observation, host = {}) {
  const { descriptor, store } = observation;
  const readDocument = (id) => store.getAt(descriptor.generation, "canonical", id);
  const baselines = new DecisionBaselineReader({ repositoryRoot: descriptor.repositoryRoot, readDocument });
  let validators;
  const handle2 = async (request, signal) => {
    const scope = currentObservationScope();
    const hostSignal = observationHostSignal(scope, signal);
    const combined = hostSignal.signal;
    try {
      return await withObservationScope({ signal: combined }, async () => {
        store.verifyGeneration(descriptor.generation);
        switch (request.type) {
          case "baseline":
            return baselines.read(request.decision, request.authority);
          case "application-evidence": {
            const documents = [...new Set(request.ownerIds)].sort().map(readDocument).filter((document) => document !== void 0);
            return assessKnowledgeApplicationEvidence({ observation: { canonical: { documents, readDocument } }, ownerIds: request.ownerIds, signal: combined, ...host.applicationEvidence === void 0 ? {} : { port: host.applicationEvidence } });
          }
          case "validators": {
            if (request.requests.length === 0)
              return { findings: [], executed: false };
            validators ??= new KnowledgeValidatorRun({
              repositoryRoot: descriptor.repositoryRoot,
              independentValidator: (path) => captureIndependentValidator(descriptor.repositoryRoot, descriptor.metadata.analysisHeader.git.availability, (address) => store.getAt(descriptor.generation, "git-identity", address), path)
            }, combined, host);
            return { findings: await validators.evaluateAll(request.requests), executed: validators.executed };
          }
          case "fresh-state": {
            return (await observeChangeRepository(descriptor.repositoryRoot)).state;
          }
          case "read-impact":
            return readRepositoryImpactSnapshot(descriptor.repositoryRoot, request.reference);
          case "coverage-continuation":
            return inspectRepositoryContinuation(descriptor.repositoryRoot, request.request, {
              signal: combined,
              ...host.applicationEvidence === void 0 ? {} : { applicationEvidence: host.applicationEvidence },
              reconcileContext: async (retained) => {
                const now = (host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
                const accepted = host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: host.acceptedDecisionBaselines };
                if (retained.impactBaseline === void 0)
                  return runObservationTask("indexed-knowledge-reconcile", { descriptor, retained, now, ...accepted }, { ...currentObservationScope(), onHostRequest: handle2 });
                const full = await observeChangeRepository(descriptor.repositoryRoot);
                const { independentValidator: _validator, ...data } = full;
                return runObservationTask("knowledge-reconcile", { observation: data, retained, now, ...accepted }, { ...currentObservationScope(), onHostRequest: createKnowledgeComputeHostHandler(full, host) });
              }
            });
        }
      });
    } finally {
      hostSignal.close();
    }
  };
  return handle2;
}

// node_modules/@projector/control-plane/dist/knowledge/service.js
var compare3 = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique2 = (values) => [...new Set(values)].sort(compare3);
function createKnowledgeComputeHostHandler(observation, host = {}) {
  const baselines = new DecisionBaselineReader(observation);
  let validators;
  const handle2 = async (request, signal) => {
    const scope = currentObservationScope();
    const hostSignal = observationHostSignal(scope, signal);
    const combined = hostSignal.signal;
    try {
      return await withObservationScope({ signal: combined }, async () => {
        switch (request.type) {
          case "coverage-continuation":
            return inspectRepositoryContinuation(observation.repositoryRoot, request.request, {
              signal: combined,
              ...host.applicationEvidence === void 0 ? {} : { applicationEvidence: host.applicationEvidence },
              reconcileContext: async (retained) => {
                const { independentValidator: _validator, ...data } = observation;
                return runObservationTask("knowledge-reconcile", { observation: data, retained, now: (host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(), ...host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: host.acceptedDecisionBaselines } }, { ...currentObservationScope(), onHostRequest: handle2 });
              }
            });
          case "baseline":
            return baselines.read(request.decision, request.authority);
          case "validators": {
            validators ??= new KnowledgeValidatorRun(observation, combined, host);
            return { findings: await validators.evaluateAll(request.requests), executed: validators.executed };
          }
          case "application-evidence":
            return assessKnowledgeApplicationEvidence({ observation, ownerIds: request.ownerIds, signal: combined, ...host.applicationEvidence === void 0 ? {} : { port: host.applicationEvidence } });
          case "fresh-state":
            return observeRepositoryState(observation);
          case "read-impact":
            return readRepositoryImpactSnapshot(observation.repositoryRoot, request.reference);
        }
      });
    } finally {
      hostSignal.close();
    }
  };
  return handle2;
}
var defaultPolicy = {
  maxCandidates: 5,
  maxEntries: 40,
  maxDepth: 4,
  maxTraversalCost: 80,
  minimumScore: 0.3,
  maxContextCost: 24e3
};
function policy(input) {
  const result = { ...defaultPolicy, ...input };
  if (!Number.isSafeInteger(result.maxCandidates) || result.maxCandidates < 1 || !Number.isSafeInteger(result.maxEntries) || result.maxEntries < 1 || !Number.isSafeInteger(result.maxDepth) || result.maxDepth < 0 || !Number.isFinite(result.maxTraversalCost) || result.maxTraversalCost < 0 || !Number.isFinite(result.minimumScore) || result.minimumScore < 0 || result.minimumScore > 1 || !Number.isFinite(result.maxContextCost) || result.maxContextCost < 0) {
    throw new Error("invalid knowledge context policy");
  }
  return result;
}
function coreCandidate(candidate) {
  if (candidate.entityKind !== "concept" && candidate.entityKind !== "requirement" && candidate.entityKind !== "scenario")
    return void 0;
  return {
    entityId: candidate.entityId,
    entityKind: candidate.entityKind,
    similarity: candidate.score,
    ownershipFit: 0,
    boundaryFit: 0,
    evidence: [],
    explanation: candidate.explanation
  };
}
function identityResolution(request, candidates, compiledAgainst, identityDependency, graph) {
  const eligible = candidates.filter((candidate) => candidate.direct && coreCandidate(candidate) !== void 0);
  const kinds = unique2(eligible.map(({ entityKind }) => entityKind));
  const requestedKind = kinds.length === 1 ? kinds[0] : "unknown";
  const boundState = createStateBinding({
    compiledAgainst,
    valueDependencies: graph.valueDependencies(eligible.map(({ entityId }) => entityId)),
    queryDependencies: [identityDependency]
  });
  const basis = {
    requestedMeaning: request,
    requestedKind,
    outcome: eligible.length > 0 ? "reuse-existing" : "unresolved",
    candidates: eligible.map(coreCandidate).filter((item) => item !== void 0),
    selectedEntityIds: eligible.map(({ entityId }) => entityId).sort(),
    confidence: eligible.length > 0 ? 1 : Math.max(...candidates.map(({ score }) => score), 0),
    evidence: [],
    unknowns: eligible.length > 0 ? [] : ["interpretation remains a candidate; context compilation does not prove semantic identity"],
    boundState
  };
  const contentHash = hashFramedDomain("semantic-identity-resolution", basis);
  return { id: `semantic_identity_resolution_${contentHash.slice(-32)}`, ...basis, contentHash };
}
function rebindClosure(closure, graph, queryDependencies, extraValueIds = [], extraValueDependencies = []) {
  const boundState = createStateBinding({
    compiledAgainst: closure.boundState.compiledAgainst,
    valueDependencies: [...graph.valueDependencies(unique2([...closure.entries.map(({ entityId }) => entityId), ...extraValueIds])), ...extraValueDependencies],
    queryDependencies
  });
  const basis = {
    requestHash: closure.requestHash,
    seeds: closure.seeds,
    entries: closure.entries,
    activatedFacetKeys: closure.activatedFacetKeys,
    unknowns: closure.unknowns,
    unavailableLanes: closure.unavailableLanes,
    boundState
  };
  const contentHash = hashFramedDomain("relevance-closure", basis);
  return { id: `relevance_closure_${contentHash.slice(-32)}`, ...basis, contentHash };
}
function closureWithBinding(closure, boundState, resolutionId) {
  const entries = closure.entries.map((entry) => ({ ...entry, reasons: entry.reasons.map((reason) => reason.kind === "identity-match" ? { ...reason, fromId: resolutionId, explanation: `selected by semantic identity resolution ${resolutionId}` } : reason) }));
  const basis = {
    requestHash: closure.requestHash,
    seeds: closure.seeds,
    entries,
    activatedFacetKeys: closure.activatedFacetKeys,
    unknowns: closure.unknowns,
    unavailableLanes: closure.unavailableLanes,
    boundState
  };
  const contentHash = hashFramedDomain("relevance-closure", basis);
  return { ...basis, id: `relevance_closure_${contentHash.slice(-32)}`, contentHash };
}
var reusable = (validation2) => validation2?.status === "current" || validation2?.status === "rebound";
var validationRank = {
  current: 0,
  rebound: 1,
  suspect: 2,
  stale: 3,
  unavailable: 4
};
function contextGraph(observation, host, budget, graph) {
  if (graph !== void 0)
    return graph;
  if (!("canonical" in observation))
    throw new Error("Indexed context computation requires its generation-bound graph reader");
  return new KnowledgeGraph(observation, host, budget);
}
function compareContextScope(retained, current, validations) {
  const before = new Set(retained.branches.flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)));
  const after = new Set(current.branches.flatMap(({ closure }) => closure.entries.map(({ entityId }) => entityId)));
  const observations = validations.flatMap(({ observations: observations2 }) => observations2 ?? []);
  return {
    scope: "retained-context",
    addedEntityIds: [...after].filter((id) => !before.has(id)).sort(),
    removedFromContextEntityIds: [...before].filter((id) => !after.has(id)).sort(),
    changedSemanticEntityIds: unique2(observations.flatMap((item) => item.kind === "value" && item.status === "stale" && ["canonical-entity", "canonical-governance", "projection-unit"].includes(item.dependency.kind) ? [item.dependency.id] : [])),
    changedSourceEntityIds: unique2(observations.flatMap((item) => item.kind === "value" && item.status === "stale" && item.dependency.id.startsWith("knowledge-source:") ? [item.dependency.id.slice("knowledge-source:".length)] : [])),
    changedQueryIds: unique2(validations.flatMap(({ changedQueryDependencyIds }) => changedQueryDependencyIds)),
    unknownDependencyIds: unique2(observations.flatMap((item) => item.status === "unknown" ? [item.kind === "value" ? item.dependency.id : item.dependency.query.id] : [])),
    frontierEntityIds: unique2(current.branches.flatMap(({ closure, frontier, context }) => [
      ...closure.entries.filter(({ band }) => band === "possible").map(({ entityId }) => entityId),
      ...frontier,
      ...context.requiredExpansionIds
    ])),
    unknowns: unique2([...current.unknowns, ...observations.filter(({ status }) => status === "unknown").map(({ reason }) => reason)])
  };
}
var RepositoryKnowledgeService = class _RepositoryKnowledgeService {
  repositoryRoot;
  store;
  host;
  computeHost;
  derivedBudget;
  constructor(repositoryRoot, store, host, computeHost, derivedBudget) {
    this.repositoryRoot = repositoryRoot;
    this.store = store;
    this.host = host;
    this.computeHost = computeHost;
    this.derivedBudget = derivedBudget;
  }
  static async create(input) {
    const repositoryRoot = resolve4(typeof input === "string" ? input : input.repositoryRoot);
    return new _RepositoryKnowledgeService(repositoryRoot, await KnowledgeContextStore.create(repositoryRoot), typeof input === "string" ? {} : input);
  }
  /** Read authenticated retained proof without compiling or refreshing context. */
  async inspectContext(contextId, signal) {
    if (this.store === void 0)
      throw new Error("knowledge context inspection requires a repository-backed service");
    signal?.throwIfAborted();
    const context = await withObservationScope(signal === void 0 ? {} : { signal }, () => this.store.read(contextId));
    signal?.throwIfAborted();
    return context;
  }
  async context(input, options = {}) {
    return withObservationScope({ ...input.signal === void 0 ? {} : { signal: input.signal } }, async (scope) => {
      if (options.observation === void 0) {
        const indexed = await observeIndexedRepository(this.repositoryRoot);
        try {
          await runObservationTask("code-operation", { repositoryRoot: this.repositoryRoot, operation: "code.index", input: { provider: "native" }, descriptor: indexed.descriptor }, scope);
          const { signal: _signal2, ...request2 } = input;
          const prepared2 = await runObservationTask("indexed-knowledge-context", { descriptor: indexed.descriptor, request: request2, now: (this.host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(), ...this.host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines } }, { ...scope, onHostRequest: createIndexedKnowledgeComputeHostHandler(indexed, this.host) });
          scope.signal.throwIfAborted();
          scope.budget.check("context-publication");
          if (prepared2.writes.length > 0)
            await withDerivedCacheAdmission(this.repositoryRoot, (cache) => cache.publishAll(prepared2.writes), { signal: scope.signal, deadline: scope.deadline });
          return prepared2.result;
        } finally {
          indexed.close();
        }
      }
      const observation = options.observation;
      if (observation.repositoryRoot !== this.repositoryRoot)
        throw new Error("Knowledge observation belongs to a different repository");
      const { independentValidator: _validator, ...data } = observation;
      const { signal: _signal, ...request } = input;
      const prepared = await runObservationTask("knowledge-context", { observation: data, request, now: (this.host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(), ...this.host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines } }, {
        ...scope,
        onHostRequest: this.hostRequests(observation)
      });
      scope.signal.throwIfAborted();
      scope.budget.check("context-publication");
      if (prepared.writes.length > 0)
        await withDerivedCacheAdmission(this.repositoryRoot, (cache) => cache.publishAll(prepared.writes), { signal: scope.signal, deadline: scope.deadline });
      return prepared.result;
    });
  }
  hostRequests(observation) {
    return createKnowledgeComputeHostHandler(observation, this.host);
  }
  static async computeContext(input, observation, host, computeHost, derivedBudget, graph) {
    const service = new _RepositoryKnowledgeService(observation.repositoryRoot, void 0, host, computeHost, derivedBudget);
    const result = await service.compileContext(input, observation, contextGraph(observation, host, derivedBudget, graph));
    return { result, writes: result.persisted ? [knowledgeContextWrite(result)] : [] };
  }
  async compileContext(input, observation, graph, reuse) {
    input.signal?.throwIfAborted();
    const request = input.request.normalize("NFKC").trim();
    if (request.length === 0)
      throw new Error("knowledge context request must be nonblank");
    const entities = unique2((input.entities ?? []).map((item) => item.normalize("NFKC").trim()).filter(Boolean));
    const namedTargets = unique2((input.namedTargets ?? []).map((item) => item.replaceAll("\\", "/").normalize("NFKC").trim()).filter(Boolean));
    const operation = input.operation?.normalize("NFKC").trim() || "change";
    const selectedPolicy = policy(input.policy);
    const persist = input.persist ?? true;
    const adapterContext = {
      repositoryRoot: observation.repositoryRoot,
      stateDigest: observation.state,
      config: {},
      signal: input.signal ?? new AbortController().signal
    };
    const retainedDiscovery = reusable(reuse?.discovery) ? reuse : void 0;
    const reboundDiscovery = retainedDiscovery?.discovery.status === "rebound" ? retainedDiscovery.discovery.rebound : void 0;
    const identity = retainedDiscovery === void 0 ? await graph.bindIdentity(request, entities, namedTargets, adapterContext) : {
      value: retainedDiscovery.retained.interpretation.candidates,
      dependency: (reboundDiscovery ?? retainedDiscovery.retained.discoveryBinding).queryDependencies[0]
    };
    const directCandidates = identity.value.filter(({ direct }) => direct);
    const directAddressGroup = entities.length > 1 && namedTargets.length === 0 && directCandidates.length > 1;
    const candidates = directAddressGroup ? identity.value : identity.value.slice(0, selectedPolicy.maxCandidates);
    const branchCandidates = directAddressGroup ? [directCandidates[0], ...candidates.filter(({ direct }) => !direct)] : candidates;
    const missingAddresses = retainedDiscovery === void 0 ? entities.filter((address) => graph.search(request, [address], 1).length === 0) : [];
    const missingTargets = retainedDiscovery === void 0 ? namedTargets.filter((target) => graph.resolveNamedTargets([target]).length === 0) : [];
    const interpretationUnknowns = retainedDiscovery?.retained.interpretation.unknowns ?? unique2([
      ...missingAddresses.map((address) => `explicit canonical address ${address} did not resolve`),
      ...missingTargets.map((target) => `named repository target ${target} did not resolve`),
      ...candidates.length === 0 ? ["no supported canonical or observed interpretation candidate was found"] : []
    ]);
    const discoveryBinding = createStateBinding({ compiledAgainst: observation.state, valueDependencies: [], queryDependencies: [identity.dependency] });
    const branches = [];
    const computeHost = this.computeHost;
    if (computeHost === void 0)
      throw new Error("Knowledge compilation requires its observation worker host");
    let validatorsExecuted = false;
    for (const candidate of branchCandidates) {
      const selectedCandidates = directAddressGroup && candidate.entityId === directCandidates[0].entityId ? directCandidates : [candidate];
      const resolution = identityResolution(request, selectedCandidates, observation.state, identity.dependency, graph);
      const collectedQueries = [];
      const retainedBranch = retainedDiscovery?.retained.branches.find((branch) => branch.interpretation.entityId === candidate.entityId);
      const branchValidation = retainedBranch === void 0 ? void 0 : retainedDiscovery?.branches.get(retainedBranch.id);
      const reuseBranch = retainedBranch !== void 0 && reusable(branchValidation) && retainedBranch.hypothesis === !candidate.direct;
      if (reuseBranch) {
        const binding = branchValidation?.status === "rebound" ? branchValidation.rebound : retainedBranch.closure.boundState;
        if (binding === void 0)
          throw new Error("Rebound closure lacks its validated current binding");
        collectedQueries.push(...binding.queryDependencies.filter((item) => item.query.id !== identity.dependency.query.id && !item.query.id.startsWith("knowledge-decision-applicability:") && !item.query.id.startsWith("knowledge-decision-triggers:")));
      }
      const seeds = selectedCandidates.filter((selected) => coreCandidate(selected) === void 0).map((selected) => ({
        kind: selected.entityKind === "projection-unit" ? "projection-unit" : selected.entityKind === "architecture-decision" ? "decision" : "manual",
        subjectId: selected.entityId,
        reason: selected.explanation,
        confidence: selected.score
      }));
      const compilation = reuseBranch ? { closure: closureWithBinding(retainedBranch.closure, branchValidation?.status === "rebound" ? branchValidation.rebound : retainedBranch.closure.boundState, resolution.id), metrics: retainedBranch.metrics, frontier: retainedBranch.frontier } : await compileRelevanceClosure({
        request,
        seeds: seeds.length > 0 ? seeds : candidate.direct ? [] : [{ kind: candidate.entityKind === "projection-unit" ? "projection-unit" : candidate.entityKind === "architecture-decision" ? "decision" : "manual", subjectId: candidate.entityId, reason: `hypothetical interpretation branch: ${candidate.explanation}`, confidence: candidate.score }],
        identityResolution: resolution,
        activatedFacetKeys: [],
        compiledAgainst: observation.state,
        context: adapterContext,
        discovery: graph.discovery(adapterContext, collectedQueries),
        valueDependencies: [],
        policy: { maxEntries: selectedPolicy.maxEntries, maxDepth: selectedPolicy.maxDepth, maxCost: selectedPolicy.maxTraversalCost, minimumScore: selectedPolicy.minimumScore }
      });
      const closureIds = compilation.closure.entries.map(({ entityId }) => entityId);
      const decisionEvidence = await assessKnowledgeDecisions(graph, graph.relevantDecisions(new Set(closureIds)), operation, adapterContext);
      const decisionIds = decisionEvidence.decisions.map(({ decisionId }) => decisionId);
      const applicationEvidence = reuseBranch && retainedBranch !== void 0 ? retainedDiscovery.applicationEvidence.get(retainedBranch.id) ?? await computeHost.applicationEvidence(closureIds) : await computeHost.applicationEvidence(closureIds);
      const closure = rebindClosure(compilation.closure, graph, [identity.dependency, ...collectedQueries, ...decisionEvidence.dependencies], decisionIds, applicationEvidenceDependencies(applicationEvidence));
      const baseContext = await compileContext(closure, graph, { maxCost: selectedPolicy.maxContextCost });
      const contextUnknowns = unique2([...baseContext.unknowns, ...graph.authorityUnknowns(closureIds), ...graph.topologyUnknowns(closureIds), ...graph.realizationUnknowns(closureIds), ...decisionEvidence.decisions.flatMap(({ checks }) => checks.filter(({ status }) => status === "unknown").map(({ reason }) => reason)), ...applicationEvidence.flatMap((item) => item.status === "unavailable" ? [item.reason] : [])]);
      const contextBasis = {
        sourceClosureId: baseContext.sourceClosureId,
        items: baseContext.items,
        unknowns: contextUnknowns,
        estimatedCost: baseContext.estimatedCost,
        requiredBudgetOverrun: baseContext.requiredBudgetOverrun,
        requiredExpansionIds: unique2([...baseContext.requiredExpansionIds, ...decisionIds.filter((id) => !closureIds.includes(id))])
      };
      const compiledContext = { ...contextBasis, contentHash: hashFramedDomain("compiled-semantic-context", contextBasis) };
      const valueDependencies = graph.valueDependencies(closureIds);
      const lensObligations = graph.lensObligations(new Set(closureIds), operation);
      const validation2 = await computeHost.validators(graph.validatorRequests(new Set(closureIds), operation));
      validatorsExecuted ||= validation2.executed;
      const validatorFindings = validation2.findings;
      const governanceEvaluations = graph.governanceEvaluations(new Set(closureIds), operation, validatorFindings);
      const sourceFingerprint = hashFramedDomain("knowledge-context-sources", { values: valueDependencies.map(({ id, role }) => ({ id, role, sourceHash: graph.sourceHash(id) ?? null })), applicationEvidence: applicationEvidence.map(({ contentHash }) => contentHash) });
      const semanticFingerprint = hashFramedDomain("knowledge-context-semantics", { values: valueDependencies, applicationEvidence: applicationEvidence.map(({ contentHash }) => contentHash) });
      const queryFingerprint = hashFramedDomain("knowledge-context-queries", closure.boundState.queryDependencies);
      const branchBasis = { interpretation: candidate, hypothesis: !candidate.direct, closureHash: closure.contentHash, contextHash: compiledContext.contentHash, sourceFingerprint, semanticFingerprint, queryFingerprint, lensObligations, decisionValidity: decisionEvidence.decisions, governanceEvaluations, applicationEvidence };
      branches.push({
        id: `knowledge_branch_${hashFramedDomain("knowledge-context-branch", branchBasis).slice(-32)}`,
        interpretation: candidate,
        hypothesis: !candidate.direct,
        closure,
        context: compiledContext,
        metrics: compilation.metrics,
        frontier: compilation.frontier,
        lensObligations,
        decisionValidity: decisionEvidence.decisions,
        governanceEvaluations,
        applicationEvidence,
        sourceFingerprint,
        semanticFingerprint,
        queryFingerprint
      });
    }
    if (validatorsExecuted) {
      const after = await computeHost.freshState();
      input.signal?.throwIfAborted();
      if (hashFramedDomain("knowledge-validation-state", after) !== hashFramedDomain("knowledge-validation-state", observation.state))
        throw new Error("Repository changed while custom validators ran; discard these observations and request fresh context.");
    }
    const requestOptions = { entities, namedTargets, operation, policy: selectedPolicy };
    const unknowns = unique2([
      ...interpretationUnknowns,
      ...graph.lensCompilationUnknown === void 0 ? [] : [`lens obligations unavailable: ${graph.lensCompilationUnknown}`],
      ...branches.flatMap(({ closure, context }) => [...closure.unknowns, ...context.unknowns])
    ]);
    input.signal?.throwIfAborted();
    const code = graph.semanticSummary?.(branches.flatMap((branch) => branch.closure.entries.map((entry) => entry.entityId)));
    const result = finalizeKnowledgeContext({
      ...code === void 0 ? {} : { code },
      apiVersion: KNOWLEDGE_API_VERSION,
      request,
      requestFingerprint: hashFramedDomain("knowledge-request", requestOptions),
      operation,
      requestOptions,
      capturedState: observation.state,
      discoveryBinding,
      interpretation: {
        status: candidates.length === 0 ? "unresolved" : candidates.every(({ direct }) => direct) ? "direct" : "candidates",
        candidates,
        unknowns: interpretationUnknowns
      },
      branches,
      analyzerCapabilities: observation.analysis.capabilities,
      analyzerFailures: observation.analysis.failures,
      unknowns,
      persisted: persist
    });
    const parsed = KnowledgeContextResultSchema.parse(result);
    input.signal?.throwIfAborted();
    return parsed;
  }
  read(contextId) {
    return this.store.read(contextId);
  }
  async reconcile(contextId, options = {}) {
    return withObservationScope(options, async (scope) => {
      const retained = await this.store.read(contextId);
      if (options.observation === void 0 && retained.impactBaseline === void 0) {
        const indexed = await observeIndexedRepository(this.repositoryRoot);
        try {
          await runObservationTask("code-operation", { repositoryRoot: this.repositoryRoot, operation: "code.index", input: { provider: "native" }, descriptor: indexed.descriptor }, scope);
          return await runObservationTask("indexed-knowledge-reconcile", { descriptor: indexed.descriptor, retained, now: (this.host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(), ...this.host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines } }, { ...scope, onHostRequest: createIndexedKnowledgeComputeHostHandler(indexed, this.host) });
        } finally {
          indexed.close();
        }
      }
      const observation = options.observation ?? await observeChangeRepository(this.repositoryRoot);
      if (observation.repositoryRoot !== this.repositoryRoot)
        throw new Error("Knowledge observation belongs to a different repository");
      const { independentValidator: _validator, ...data } = observation;
      return runObservationTask("knowledge-reconcile", { observation: data, retained, now: (this.host.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))(), ...this.host.acceptedDecisionBaselines === void 0 ? {} : { acceptedDecisionBaselines: this.host.acceptedDecisionBaselines } }, { ...scope, onHostRequest: this.hostRequests(observation) });
    });
  }
  static computeReconciliation(retained, observation, host, computeHost, derivedBudget, graph) {
    return new _RepositoryKnowledgeService(observation.repositoryRoot, void 0, host, computeHost, derivedBudget).reconcileObserved(retained, observation, contextGraph(observation, host, derivedBudget, graph));
  }
  async reconcileObserved(retained, observation, graph) {
    const contextId = retained.id;
    const options = {};
    const adapterContext = { repositoryRoot: observation.repositoryRoot, stateDigest: observation.state, config: {}, signal: options.signal ?? new AbortController().signal };
    const currentApplicationDependencies = /* @__PURE__ */ new Map();
    const validator = new DependencyScopedStateBindingValidator({
      values: { readVersionHash: async (dependency) => currentApplicationDependencies.get(dependency.id) ?? graph.currentVersionHash(dependency) },
      queries: { evaluate: (query, context) => graph.registry.evaluate(query, context) }
    });
    const discoveryValidation = await validator.validate(retained.discoveryBinding, observation.state, adapterContext);
    options.signal?.throwIfAborted();
    const contextInput = { request: retained.request, entities: retained.requestOptions.entities, namedTargets: retained.requestOptions.namedTargets, operation: retained.requestOptions.operation, policy: retained.requestOptions.policy, persist: false };
    const discoveryReusable = reusable(discoveryValidation) && retained.discoveryBinding.queryDependencies.length === 1;
    let current;
    if (!discoveryReusable) {
      current = await this.compileContext(contextInput, observation, graph);
      for (const dependency of current.branches.flatMap(({ applicationEvidence: applicationEvidence2 }) => applicationEvidenceDependencies(applicationEvidence2)))
        currentApplicationDependencies.set(dependency.id, dependency.versionHash);
    }
    const currentEvidence = /* @__PURE__ */ new Map();
    if (discoveryReusable && this.computeHost !== void 0) {
      for (const branch of retained.branches) {
        const evidence = await this.computeHost.applicationEvidence(branch.closure.entries.map(({ entityId }) => entityId));
        currentEvidence.set(branch.id, evidence);
        for (const dependency of applicationEvidenceDependencies(evidence))
          currentApplicationDependencies.set(dependency.id, dependency.versionHash);
      }
    }
    const branches = [];
    const branchValidations = /* @__PURE__ */ new Map();
    for (const branch of retained.branches) {
      const validation2 = await validator.validate(branch.closure.boundState, observation.state, adapterContext);
      branches.push({ branchId: branch.id, validation: validation2 });
      branchValidations.set(branch.id, validation2);
      options.signal?.throwIfAborted();
    }
    current ??= await this.compileContext(contextInput, observation, graph, discoveryReusable ? { retained, discovery: discoveryValidation, branches: branchValidations, applicationEvidence: currentEvidence } : void 0);
    options.signal?.throwIfAborted();
    const validations = [discoveryValidation, ...branches.map(({ validation: validation2 }) => validation2)];
    let status = validations.reduce((worst, validation2) => validationRank[validation2.status] > validationRank[worst] ? validation2.status : worst, "current");
    let reasons = unique2(validations.flatMap(({ reasons: validationReasons }) => validationReasons));
    const namedTargetsReplaced = retained.requestOptions.entities.length === 0 && retained.branches.every(({ interpretation }) => interpretation.entityKind === "projection-unit") && retained.requestOptions.namedTargets.length > 0 && retained.requestOptions.namedTargets.every((target) => graph.resolveNamedTargets([target]).length > 0);
    if (status === "unavailable" && namedTargetsReplaced) {
      status = "stale";
      reasons = unique2([...reasons, "a retained projection-unit identity disappeared while every explicitly named source target remains present with current observed membership"]);
    }
    const retainedByEntity = new Map(retained.branches.map((branch) => [branch.interpretation.entityId, branch]));
    const currentByEntity = new Map(current.branches.map((branch) => [branch.interpretation.entityId, branch]));
    const governanceBranches = unique2([...retainedByEntity.keys(), ...currentByEntity.keys()]).map((interpretationEntityId) => {
      const retainedBranch = retainedByEntity.get(interpretationEntityId);
      const currentBranch = currentByEntity.get(interpretationEntityId);
      if (currentBranch === void 0) {
        return {
          interpretationEntityId,
          ...retainedBranch === void 0 ? {} : { retainedBranchId: retainedBranch.id },
          status: "unknown",
          evaluations: [],
          reasons: ["the retained interpretation is absent from the current repository observation"]
        };
      }
      if (graph.lensCompilationUnknown !== void 0) {
        return {
          interpretationEntityId,
          ...retainedBranch === void 0 ? {} : { retainedBranchId: retainedBranch.id },
          currentBranchId: currentBranch.id,
          status: "unknown",
          evaluations: [],
          reasons: [`current lens compilation is unavailable: ${graph.lensCompilationUnknown}`]
        };
      }
      const evaluations2 = currentBranch.governanceEvaluations ?? [];
      const decisionValidity = currentBranch.decisionValidity ?? [];
      const authorityUnknowns = graph.authorityUnknowns(currentBranch.closure.entries.map(({ entityId }) => entityId));
      const branchStatus = knowledgeGovernanceStatus(evaluations2, decisionValidity, authorityUnknowns);
      return {
        interpretationEntityId,
        ...retainedBranch === void 0 ? {} : { retainedBranchId: retainedBranch.id },
        currentBranchId: currentBranch.id,
        status: branchStatus,
        evaluations: evaluations2,
        decisionValidity,
        reasons: unique2([
          ...authorityUnknowns,
          ...decisionValidity.filter(({ assessment }) => assessment.blocksCurrentChange).map(({ assessment }) => assessment.explanation),
          ...decisionValidity.flatMap(({ checks }) => checks.filter(({ status: status2 }) => status2 === "unknown").map(({ reason }) => reason)),
          ...evaluations2.flatMap((evaluation) => [
            ...evaluation.findings.filter(({ status: findingStatus }) => findingStatus !== "satisfied").map(({ reason }) => reason),
            ...evaluation.status === "unknown" ? evaluation.boundary : []
          ])
        ])
      };
    });
    const governanceStatus = graph.lensCompilationUnknown !== void 0 ? "unknown" : governanceBranches.some(({ status: branchStatus }) => branchStatus === "violated") ? "violated" : governanceBranches.some(({ status: branchStatus }) => branchStatus === "unknown") ? "unknown" : governanceBranches.some(({ status: branchStatus }) => branchStatus === "conformant") ? "conformant" : "not-applicable";
    const governance = {
      status: governanceStatus,
      regeneratedContextId: current.id,
      branches: governanceBranches,
      reasons: unique2([
        ...graph.lensCompilationUnknown === void 0 ? [] : [`current lens compilation is unavailable: ${graph.lensCompilationUnknown}`],
        ...governanceBranches.flatMap(({ reasons: branchReasons }) => branchReasons)
      ])
    };
    const applicationBranches = retained.branches.map((retainedBranch) => {
      const currentBranch = current.branches.find(({ interpretation }) => interpretation.entityId === retainedBranch.interpretation.entityId);
      if (currentBranch === void 0)
        return { branchId: retainedBranch.id, status: "unknown", changed: true, reasons: ["The retained application-evidence branch is absent from the current repository observation."] };
      const currentStatus = applicationEvidenceDisposition(currentBranch.applicationEvidence);
      const changed = canonicalJson(retainedBranch.applicationEvidence.map(({ contentHash }) => contentHash)) !== canonicalJson(currentBranch.applicationEvidence.map(({ contentHash }) => contentHash));
      const reasons2 = unique2([
        ...changed ? ["Application evidence or its currentness disposition changed since context capture."] : [],
        ...currentBranch.applicationEvidence.flatMap((item) => item.status === "unavailable" ? [item.reason] : []),
        ...currentBranch.applicationEvidence.flatMap((item) => item.status === "assessed" && item.assessment.fulfillment.status !== "satisfied" ? [item.assessment.fulfillment.reason] : [])
      ]);
      return { branchId: retainedBranch.id, status: currentStatus, changed, reasons: reasons2 };
    });
    const directBranchIds = new Set(retained.branches.filter(({ hypothesis, interpretation }) => !hypothesis && interpretation.direct).map(({ id }) => id));
    const applicationStatuses = applicationBranches.filter(({ branchId }) => directBranchIds.has(branchId)).map(({ status: applicationStatus }) => applicationStatus);
    const applicationEvidence = {
      status: applicationStatuses.includes("violated") ? "violated" : applicationStatuses.includes("unknown") ? "unknown" : applicationStatuses.includes("satisfied") ? "satisfied" : "not-applicable",
      branches: applicationBranches
    };
    if (retained.impactBaseline !== void 0 && (!("canonical" in observation) || !(graph instanceof KnowledgeGraph)))
      throw new Error("This retained context contains a legacy repository impact baseline; use an explicit complete observation to compare that historical proof.");
    const impact = retained.impactBaseline === void 0 ? void 0 : await reconcileRetainedImpact(this.repositoryRoot, retained.impactBaseline, buildRepositoryImpactSnapshot(observation, graph), unique2(retained.branches.flatMap(({ closure }) => closure.entries.filter(({ band }) => band !== "possible").map(({ entityId }) => entityId))), contextId, false, (_root, reference) => this.computeHost.readImpact(reference), this.derivedBudget);
    const scopeChanges = compareContextScope(retained, current, validations);
    options.signal?.throwIfAborted();
    const basis = { apiVersion: KNOWLEDGE_API_VERSION, contextId, capturedState: retained.capturedState, currentState: observation.state, status, discoveryValidation, branches, governance, applicationEvidence, scopeChanges, ...impact === void 0 ? {} : { impact }, reasons };
    const result = { ...basis, contentHash: hashFramedDomain("knowledge-reconciliation", basis) };
    const parsed = KnowledgeReconciliationResultSchema.parse(result);
    options.signal?.throwIfAborted();
    return parsed;
  }
};

export {
  validateArchitectureProducts,
  validateCanonicalRelationEndpoints,
  validateStaticCanonicalGovernance,
  observeIndexedRepository,
  KnowledgeContextOperationOutputSchema,
  KnowledgeReconciliationOperationOutputSchema,
  KnowledgeContextInspectionOutputSchema,
  KnowledgeContextInspectOperationOutputSchema,
  inspectKnowledgeContext,
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  RepositoryRepresentationArtifactStore,
  RepresentationInspectionOutputSchema,
  RepresentationInspectionOperationOutputSchema,
  projectRepresentationInspectionOperation,
  RepositoryRepresentationInspectionService,
  RepositoryContinuationSchema,
  createKnowledgeComputeHostHandler,
  RepositoryKnowledgeService,
  RepresentationPendingOutputSchema,
  RepresentationRecoveryOutputSchema,
  RepositoryChangeLifecycleService
};
