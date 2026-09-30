import {
  enrollIndexedGovernance
} from "./shared-ZQJOKWDN.js";
import {
  buildRepositoryImpactSnapshot
} from "./shared-5DRPCZRI.js";
import {
  realizeChangeRepositoryData
} from "./shared-NMHHCCIJ.js";
import {
  KnowledgeGraph,
  tokens
} from "./shared-A2IBJY7A.js";
import {
  hydrateCapturedInventory
} from "./shared-QJIGMBBX.js";
import {
  SqliteObservationStage,
  parseCanonicalSnapshotSources
} from "./shared-GXAKKSCS.js";
import {
  analyzeCollectedLocalRepository,
  inventoryEntryBytes,
  localImportCandidates,
  localSemanticKey
} from "./shared-5EIJVVQJ.js";
import {
  projectionUnitSelectorSubject
} from "./shared-RMBXVF7C.js";
import {
  buildManifest,
  canonicalJson,
  hashFramedDomain,
  manifestKey
} from "./shared-Q56AARV7.js";

// node_modules/@projector/control-plane/dist/knowledge/indexed-selector-incidence.js
var key = (gate) => `realization-incidence:${hashFramedDomain("realization-incidence-gate/v1", gate)}`;
var unknownKey = (field) => `realization-incidence-unknown:${field}`;
var supportedFields = /* @__PURE__ */ new Set(["path", "artifact-role", "concept", "requirement", "scenario", "lens", "tag", "control-ownership", "control-mutation", "causal-origin", "surface", "package", "package-kind"]);
function realizationSelectorGates(selector) {
  if (selector.op === "not")
    return void 0;
  if (selector.op === "all") {
    const choices = selector.items.map(realizationSelectorGates).filter((value) => value !== void 0);
    return choices.sort((a, b) => a.length - b.length)[0];
  }
  if (selector.op === "any") {
    const choices = selector.items.map(realizationSelectorGates);
    return choices.some((value) => value === void 0) ? void 0 : choices.flatMap((value) => value);
  }
  if (!supportedFields.has(selector.field))
    return void 0;
  if (selector.matcher === "equals" && typeof selector.value === "string")
    return [{ field: selector.field, mode: "value", value: selector.value }];
  if (selector.matcher === "in" && Array.isArray(selector.value) && selector.value.every((value) => typeof value === "string"))
    return selector.value.map((value) => ({ field: selector.field, mode: "value", value }));
  if (selector.field === "path" && selector.matcher === "glob" && typeof selector.value === "string") {
    if (!/^[A-Za-z0-9_./:*?-]+$/.test(selector.value))
      return void 0;
    const prefix = selector.value.match(/^([A-Za-z0-9_.\/:-]+)[*?]/)?.[1];
    if (prefix !== void 0)
      return [{ field: "path", mode: "prefix", value: prefix }];
    const suffix = selector.value.match(/[*?]([A-Za-z0-9_.\/:-]+)$/)?.[1];
    if (suffix !== void 0)
      return [{ field: "path", mode: "suffix", value: suffix.replace(/^\/+/, "") }];
    if (!/[*?]/.test(selector.value))
      return [{ field: "path", mode: "value", value: selector.value }];
  }
  return void 0;
}
function enrollRealizationIncidence(observation) {
  const members = /* @__PURE__ */ new Map();
  const add = (selector, id) => {
    const ids = members.get(selector) ?? /* @__PURE__ */ new Set();
    ids.add(id);
    members.set(selector, ids);
  };
  for (const document of observation.canonical.documents) {
    if (!["concept", "requirement", "behavioral-scenario"].includes(document.kind))
      continue;
    const payload = document.payload;
    if (payload.status !== "active")
      continue;
    for (const binding of payload.realizations ?? []) {
      const gates = realizationSelectorGates(binding.selector);
      if (gates === void 0)
        add("realization-incidence:conservative", document.id);
      else
        for (const gate of gates) {
          add(key(gate), document.id);
          add(unknownKey(gate.field), document.id);
        }
    }
  }
  return { upserts: [{ kind: "population-version", key: "realization-incidence", value: hashFramedDomain("realization-incidence/v1", observation.canonical.rootDigest) }], populations: [...members].flatMap(([selector, ids]) => [...ids].map((member) => ({ selector, member, present: true }))) };
}
function safeRealizationCandidateIds(input) {
  const { descriptor, store, analysis } = input, generation = descriptor.generation;
  if (store.getAt(generation, "population-version", "realization-incidence") === void 0)
    throw new Error("Realization incidence index is missing; rebuild the complete observation");
  const ids = new Set(store.populationAt(generation, "realization-incidence:conservative"));
  const add = (selector) => {
    for (const id of store.populationAt(generation, selector))
      ids.add(id);
  };
  const files = new Map(analysis.files.map((file) => [file.artifactId, file]));
  for (const original of analysis.projectionUnits) {
    const unit = { ...original, conceptIds: [], requirementIds: [], scenarioIds: [] };
    const path = files.get(unit.artifactId)?.path ?? unit.key, segments = path.split("/"), packageRoot = ["packages", "apps"].includes(segments[0]) && segments[1] !== void 0 ? `${segments[0]}/${segments[1]}` : void 0;
    const subject = projectionUnitSelectorSubject(unit, { path, surface: analysis.surface.kind, ...packageRoot === void 0 ? {} : { package: packageRoot, packageKind: segments[0] } });
    for (const field of supportedFields) {
      const value = subject.values[field];
      if (value === void 0) {
        add(unknownKey(field));
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value])
        add(key({ field, mode: "value", value: item }));
    }
    for (let length = 1; length <= path.length; length++) {
      add(key({ field: "path", mode: "prefix", value: path.slice(0, length) }));
      add(key({ field: "path", mode: "suffix", value: path.slice(-length) }));
    }
  }
  for (const path of /* @__PURE__ */ new Set([...input.changedPaths, ...analysis.files.map((file) => file.path)]))
    for (const unitId of store.populationAt(generation, `unit-path:${path}`)) {
      const unit = store.getAt(generation, "unit", unitId);
      if (unit === void 0)
        throw new Error(`Realization incidence prior unit ${unitId} is missing`);
      for (const id of [...unit.conceptIds, ...unit.requirementIds, ...unit.scenarioIds])
        ids.add(id);
    }
  return [...ids].sort();
}

// node_modules/@projector/control-plane/dist/knowledge/indexed-derivations.js
var reverseDerivationManifestKey = (subject, prefix) => canonicalJson([subject, prefix]);

// node_modules/@projector/control-plane/dist/knowledge/indexed-enrollment.js
function enrollIndexedGraph(observation, impact, graph = new KnowledgeGraph(observation), emit) {
  const populations = /* @__PURE__ */ new Map();
  const population = (name) => {
    let members = populations.get(name);
    if (members === void 0) {
      members = /* @__PURE__ */ new Set();
      populations.set(name, members);
    }
    return members;
  };
  for (const kind of ["concept", "requirement", "behavioral-scenario", "relation", "authority-record", "lineage", "tombstone", "architecture-decision", "projection-lens", "architecture-concern", "developer-preference"])
    population(`canonical-kind:${kind}`);
  for (const document of observation.canonical.documents) {
    population(`canonical-kind:${document.kind}`).add(document.id);
    if (document.kind === "relation") {
      const relation = document.payload;
      if (!relation.active)
        continue;
      population(`relations:out:${relation.fromId}`).add(relation.id);
      population(`relations:in:${relation.toId}`).add(relation.id);
      population(`relations:both:${relation.fromId}`).add(relation.id);
      population(`relations:both:${relation.toId}`).add(relation.id);
    }
  }
  const upserts = [];
  const dependencies = [];
  const flush = () => {
    if (emit !== void 0) {
      emit({ upserts: upserts.splice(0), dependencies: dependencies.splice(0) });
    }
  };
  const append = (...records) => {
    upserts.push(...records);
    if (upserts.length >= 64)
      flush();
  };
  const reverse = /* @__PURE__ */ new Map();
  for (const record of impact.records) {
    if (upserts.length >= 64)
      flush();
    append({ kind: "derivation-inputs", key: record.unitId, value: record.inputs });
    for (const input of record.inputs) {
      const consumers = reverse.get(input.id) ?? /* @__PURE__ */ new Set();
      consumers.add(record.unitId);
      reverse.set(input.id, consumers);
      dependencies.push({ consumer: record.unitId, input: `derivation:${input.id}`, present: true });
    }
  }
  const version = (key2, value) => {
    if (upserts.length >= 64)
      flush();
    append({ kind: "query-dependency-version", key: key2, value: hashFramedDomain("indexed-graph-dependency", value) });
  };
  const canonicalKinds = {
    "canonical-identity-discovery": ["concept", "requirement", "behavioral-scenario", "architecture-decision", "projection-lens", "architecture-concern", "developer-preference"],
    "canonical-lineage": ["lineage"],
    "canonical-tombstones": ["tombstone"],
    "canonical-relations": ["relation"],
    "canonical-decisions": ["architecture-decision"],
    "canonical-authorities": ["authority-record"],
    "canonical-lenses": ["projection-lens"],
    "canonical-scopes": ["architecture-decision", "architecture-concern", "projection-lens"]
  };
  for (const [key2, kinds] of Object.entries(canonicalKinds))
    version(key2, observation.canonical.documents.filter((document) => kinds.includes(document.kind)).map(({ id, canonicalDocumentHash }) => ({ id, canonicalDocumentHash })).sort((a, b) => a.id.localeCompare(b.id)));
  version("canonical-realizations", observation.realizations);
  version("projection-unit-membership", observation.analysis.projectionUnits);
  version("repository-module-dependencies", { dependencies: observation.analysis.dependencies, files: observation.analysis.javaScript.files, failures: observation.analysis.javaScript.failures, capabilities: observation.analysis.capabilities });
  version("repository-test-targets", observation.analysis.testTargets);
  for (const unit of observation.analysis.projectionUnits)
    version(`projection-unit:${unit.id}`, unit);
  const impactUnitsByPath = new Map(impact.files.map(({ path, unitIds }) => [path, unitIds]));
  for (const file of observation.analysis.files)
    version(`path:${file.path}`, { file, units: impactUnitsByPath.get(file.path) ?? [] });
  for (const document of observation.canonical.documents)
    version(`entity:${document.id}`, document);
  const entityIds = [...graph.entities.map(({ id }) => id), ...graph.units.map(({ id }) => id)];
  for (const id of entityIds) {
    if (upserts.length >= 64)
      flush();
    const source = graph.loadSource(id);
    if (source !== void 0)
      append({ kind: "knowledge-source", key: id, value: source });
    append({ kind: "knowledge-values", key: id, value: graph.valueDependencies([id]) });
    const sourceHash = graph.sourceHash(id);
    if (sourceHash !== void 0)
      append({ kind: "knowledge-source-hash", key: id, value: sourceHash });
    append({ kind: "knowledge-authority-unknowns", key: id, value: graph.authorityUnknowns([id]) });
    append({ kind: "knowledge-bindings", key: id, value: graph.implementationBindings(id) });
    for (const binding of graph.implementationBindings(id))
      population(`knowledge-binding-subjects:${String(binding.id)}`).add(id);
  }
  for (const unit of graph.units)
    append({ kind: "knowledge-topology", key: unit.id, value: { supported: graph.supportsStaticTopology(unit.id), neighbors: graph.topologyNeighbors(unit.id), boundary: graph.topologyObservationBoundary(unit.id) } });
  append({ kind: "knowledge-global", key: "uncertain-importers", value: graph.uncertainTopologyImporters() });
  append({ kind: "knowledge-global", key: "failures", value: observation.analysis.failures });
  for (const entity of graph.entities) {
    append({ kind: "knowledge-identity", key: entity.id, value: entity });
    for (const token of tokens(entity.searchable.join(" ")))
      population(`knowledge-lexical:${token}`).add(entity.id);
    for (const address of [entity.id, entity.key, ...entity.accepted ? entity.aliases : []])
      population(`knowledge-address:${address.normalize("NFKC").trim().toLocaleLowerCase("en-US")}`).add(entity.id);
  }
  for (const [index, edge] of [
    ...graph.lineages.flatMap(({ fromIds, toIds }) => fromIds.map((from) => ({ from, toIds, origins: fromIds, signal: "lineage" }))),
    ...graph.tombstones.map(({ entityId, replacementIds }) => ({ from: entityId, toIds: replacementIds, origins: [entityId], signal: "tombstone" }))
  ].entries()) {
    const key2 = String(index);
    append({ kind: "knowledge-continuity", key: key2, value: edge });
    population(`knowledge-continuity-address:${edge.from.normalize("NFKC").trim().toLocaleLowerCase("en-US")}`).add(key2);
    population(`knowledge-continuity:${edge.from}`).add(key2);
  }
  for (const unit of graph.units) {
    for (const address of [unit.id, unit.key])
      population(`knowledge-unit-address:${address}`).add(unit.id);
  }
  const unitIdsByArtifact = /* @__PURE__ */ new Map();
  for (const unit of graph.units) {
    const ids = unitIdsByArtifact.get(unit.artifactId) ?? [];
    ids.push(unit.id);
    unitIdsByArtifact.set(unit.artifactId, ids);
  }
  for (const file of observation.analysis.files)
    for (const id of unitIdsByArtifact.get(file.artifactId) ?? [])
      population(`knowledge-unit-address:${file.path}`).add(id);
  for (const selector of populations.keys())
    if (selector.startsWith("knowledge-unit-address:")) {
      const target = selector.slice("knowledge-unit-address:".length);
      const candidate = graph.resolveNamedTargets([target])[0];
      if (candidate !== void 0)
        append({ kind: "knowledge-target", key: target, value: candidate });
    }
  const realizationUnknowns = /* @__PURE__ */ new Map();
  for (const realization of observation.realizations)
    if (realization.status !== "matched") {
      const unknowns = realizationUnknowns.get(realization.entityId) ?? [];
      unknowns.push(`realization ${realization.entityId}[${realization.bindingIndex}]: ${realization.reason}`);
      realizationUnknowns.set(realization.entityId, unknowns);
    }
  for (const [id, unknowns] of realizationUnknowns)
    append({ kind: "knowledge-realization-unknowns", key: id, value: unknowns.sort() });
  for (const [subject, members] of reverse) {
    const manifest = buildManifest([...members].sort().map((id) => ({ key: manifestKey(id), value: id })));
    append({ kind: "reverse-derivation-root", key: subject, value: manifest.root });
    for (const [prefix, node] of manifest.nodes)
      append({ kind: "reverse-derivation-manifest", key: reverseDerivationManifestKey(subject, prefix), value: node });
    version(`reverse-derivations:${subject}`, manifest.root);
  }
  const sourceVersions = new Map(observation.canonical.documents.map((document) => [document.id, document.canonicalDocumentHash]));
  for (const [selector, members] of populations) {
    const identities = [...members].sort();
    const fingerprint = hashFramedDomain("indexed-graph-population", identities.map((id) => ({ id, source: sourceVersions.get(id) })));
    append({ kind: "population-version", key: selector, value: fingerprint });
    version(selector, fingerprint);
  }
  for (const namespace of ["relations", "reverse-derivations", "knowledge-address", "knowledge-lexical", "knowledge-unit-address", "knowledge-binding-subjects", "knowledge-continuity", "knowledge-source", "knowledge-realization-unknowns"])
    append({ kind: "population-version", key: namespace, value: hashFramedDomain("indexed-graph-enrollment", { namespace, canonical: observation.canonical.rootDigest, impact: impact.contentHash }) });
  const incidence = enrollRealizationIncidence(observation);
  if (emit !== void 0) {
    flush();
    emit(enrollIndexedGovernance(observation, graph));
    emit(incidence);
    let batch = [];
    for (const [selector, members] of populations)
      for (const member of members) {
        batch.push({ selector, member, present: true });
        if (batch.length >= 64) {
          emit({ populations: batch });
          batch = [];
        }
      }
    if (batch.length > 0)
      emit({ populations: batch });
    return {};
  }
  return {
    upserts: [...upserts, ...enrollIndexedGovernance(observation, graph).upserts ?? [], ...incidence.upserts ?? []],
    populations: [...populations].flatMap(([selector, members]) => [...members].map((member) => ({ selector, member, present: true }))).concat(incidence.populations ?? []),
    dependencies
  };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/indexed-source-records.js
function recordPopulation(rows, populations, kind, items, key2) {
  for (const item of items) {
    const id = key2(item);
    rows.push({ kind, key: id, value: item });
    populations.push({ selector: kind, member: id, present: true });
  }
  rows.push({ kind: "population-version", key: kind, value: hashFramedDomain("indexed-population-v1", items.map(key2)) });
}
function sourceRecords(data, inventory) {
  const rows = [], populations = [];
  const path = (item) => item.path;
  const id = (item) => item.id;
  recordPopulation(rows, populations, "inventory", inventory, path);
  recordPopulation(rows, populations, "file", data.analysis.files, path);
  recordPopulation(rows, populations, "artifact", data.analysis.artifacts, id);
  recordPopulation(rows, populations, "unit", data.analysis.projectionUnits, id);
  recordPopulation(rows, populations, "js", data.analysis.javaScript.files, path);
  recordPopulation(rows, populations, "git-identity", data.analysis.gitIdentities, path);
  recordPopulation(rows, populations, "git-full-identity", data.analysis.git.identities, path);
  recordPopulation(rows, populations, "canonical", data.canonical.documents, id);
  recordPopulation(rows, populations, "document", data.analysis.documents, path);
  recordPopulation(rows, populations, "markdown", data.analysis.markdown, path);
  recordPopulation(rows, populations, "actions", data.analysis.actions, path);
  const group = (kind, items, getKey) => {
    const groups = /* @__PURE__ */ new Map();
    for (const item of items) {
      const key2 = getKey(item);
      const existing = groups.get(key2) ?? [];
      existing.push(item);
      groups.set(key2, existing);
    }
    recordPopulation(rows, populations, kind, [...groups].map(([key2, value]) => ({ key: key2, value })), (item) => item.key);
    for (const row of rows.filter((row2) => row2.kind === kind))
      row.value = row.value.value;
  };
  group("dependency", data.analysis.dependencies, (item) => item.importerPath);
  group("test-target", data.analysis.testTargets, (item) => item.testPath);
  group("realization", data.realizations, (item) => item.entityId);
  const unitsByArtifact = /* @__PURE__ */ new Map();
  for (const unit of data.analysis.projectionUnits) {
    const existing = unitsByArtifact.get(unit.artifactId) ?? [];
    unitsByArtifact.set(unit.artifactId, [...existing, unit]);
  }
  const entriesByPath = new Map(inventory.map((entry) => [entry.path, entry]));
  const jsByPath = new Map(data.analysis.javaScript.files.map((file) => [file.path, file]));
  for (const file of data.analysis.files) {
    const units = unitsByArtifact.get(file.artifactId) ?? [];
    for (const unit of units)
      populations.push({ selector: `unit-path:${file.path}`, member: unit.id, present: true });
    rows.push({ kind: "population-version", key: `unit-path:${file.path}`, value: hashFramedDomain("indexed-path-units-v1", units) });
    const entry = entriesByPath.get(file.path);
    if (entry !== void 0) {
      const key2 = localSemanticKey(entry, jsByPath.get(file.path), file.semanticRole);
      rows.push({ kind: "semantic-key", key: file.path, value: key2 });
      populations.push({ selector: `semantic-key:${key2}`, member: file.path, present: true });
    }
  }
  for (const [key2, value] of Object.entries(data.analysis))
    if (!["files", "artifacts", "projectionUnits", "gitIdentities", "dependencies", "testTargets", "javaScript", "documents", "markdown", "actions"].includes(key2))
      rows.push({ kind: "analysis-global", key: key2, value: key2 === "git" ? { ...data.analysis.git, identities: [] } : value });
  for (const [key2, value] of Object.entries(data.analysis.javaScript))
    if (!["files", "dependencies", "testTargets"].includes(key2))
      rows.push({ kind: "javascript-global", key: key2, value });
  rows.push({ kind: "canonical-manifest", key: "entries", value: data.canonical.entries });
  return { upserts: rows, populations, dependencies: [...data.analysis.dependencies.flatMap((item) => localImportCandidates(item.importerPath, item.specifier).map((path2) => ({ consumer: item.importerPath, input: `path:${path2}`, present: true }))), ...data.analysis.packageScriptInvocations.map((item) => ({ consumer: item.manifestPath, input: `path:${item.targetPath}`, present: true }))] };
}

// node_modules/@projector/control-plane/dist/change-lifecycle/indexed-cold.js
function summarizeColdObservation(data, inventory) {
  const { surface, capabilities, observationDescriptor, git } = data.analysis;
  const fileManifest = buildManifest(data.analysis.files.map(({ path, contentHash, mediaType, generated }) => ({ key: manifestKey(path), value: { path, contentHash, mediaType, generated } })));
  const moveManifest = buildManifest(data.analysis.gitMoves.map((move) => ({ key: manifestKey(move.fromPath), value: move })));
  return {
    summary: {
      state: data.state,
      analysisHeader: { surface, capabilities, observationDescriptor, git: { availability: git.availability, revision: git.revision } },
      canonicalRootDigest: data.canonical.rootDigest,
      counts: { files: inventory.entries.length, bytes: inventory.entries.reduce((sum, entry) => sum + inventoryEntryBytes(entry), 0), directories: inventory.directories?.length ?? 0 },
      incrementalSupport: { globalSyntax: data.analysis.javaScript.events.length === 0 && data.analysis.javaScript.contracts.length === 0 && data.analysis.javaScript.eventUncertainties.length === 0, hookReachability: !data.analysis.files.some((file) => file.lifecycleExports.length > 0 || file.semanticRole === "hook-private-support") },
      fileManifestRoot: fileManifest.root,
      moveManifestRoot: moveManifest.root
    },
    manifestDelta: { upserts: [...fileManifest.nodes].map(([key2, value]) => ({ kind: "file-manifest", key: key2, value })).concat([...moveManifest.nodes].map(([key2, value]) => ({ kind: "move-manifest", key: key2, value }))) }
  };
}
function executeIndexedObservationTask(input, budget) {
  const hydrated = hydrateCapturedInventory(input.collected.inventoryResult);
  let stage;
  try {
    const collected = { ...input.collected, inventoryResult: hydrated.inventory };
    const data = realizeChangeRepositoryData(collected.options.repositoryRoot, analyzeCollectedLocalRepository(collected, budget), parseCanonicalSnapshotSources(input.canonicalSources, budget), budget);
    stage = new SqliteObservationStage(input.stage, true);
    const sources = sourceRecords(data, hydrated.inventory.entries);
    stage.write({ ...sources, upserts: sources.upserts?.filter((record) => record.kind !== "inventory") ?? [] });
    const graph = new KnowledgeGraph(data, {}, budget);
    enrollIndexedGraph(data, buildRepositoryImpactSnapshot(data, graph), graph, (delta) => stage.write(delta));
    const { summary, manifestDelta } = summarizeColdObservation(data, hydrated.inventory);
    stage.write(manifestDelta);
    stage.finish();
    return summary;
  } finally {
    stage?.close();
    hydrated.close();
  }
}

export {
  safeRealizationCandidateIds,
  reverseDerivationManifestKey,
  sourceRecords,
  summarizeColdObservation,
  executeIndexedObservationTask
};
