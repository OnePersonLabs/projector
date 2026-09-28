import { DerivedObservationBudget, hashFramedDomain, type ContentHash, type ProjectionUnit } from "@projector/core";
import type { IndexedObservationDelta, SqliteObservationStore } from "@projector/runtime";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { KnowledgeGraph } from "./graph.js";

export interface IndexedGraphDeltaInput {
  readonly descriptor: IndexedObservationDescriptor;
  readonly store: SqliteObservationStore;
  readonly changedPaths: readonly string[];
  /** Complete affected dependency/role/collision component, not a repository
   * population. Canonical configuration must remain unchanged. */
  readonly changedObservation: RepositoryObservationData;
  readonly preparedLensCompilation?: ConstructorParameters<typeof KnowledgeGraph>[4];
}

/** Re-enroll addressed source nodes using the existing graph calculations. The
 * producer establishes component completeness and publishes this delta atomically. */
export function enrollIndexedGraphDelta(input: IndexedGraphDeltaInput): IndexedObservationDelta {
  const { descriptor, store, changedObservation: observation } = input;
  if (observation.canonical.rootDigest !== descriptor.metadata.canonicalRootDigest) throw new Error("Canonical inputs changed; indexed graph delta requires complete enrollment");
  const generation = descriptor.generation;
  const graph = new KnowledgeGraph(observation, {}, new DerivedObservationBudget(observation.analysis.observationDescriptor.limits.maxDerivedBytes), undefined, input.preparedLensCompilation ?? {});
  const upserts: NonNullable<IndexedObservationDelta["upserts"]>[number][] = [];
  const deletes: NonNullable<IndexedObservationDelta["deletes"]>[number][] = [];
  const populations: NonNullable<IndexedObservationDelta["populations"]>[number][] = [];
  const paths = new Set([...input.changedPaths, ...observation.analysis.files.map(({ path }) => path)]);
  const oldUnits = new Map<string, ProjectionUnit>();
  for (const path of paths) for (const id of store.populationAt(generation, `unit-path:${path}`)) {
    const unit = store.getAt<ProjectionUnit>(generation, "unit", id);
    if (unit === undefined) throw new Error(`Prior unit population for ${path} references missing ${id}`);
    oldUnits.set(id, unit);
  }
  const newUnits = new Map(graph.units.map((unit) => [unit.id, unit]));
  const removedIds = [...oldUnits.keys()].filter((id) => !newUnits.has(id));
  for (const id of removedIds) for (const kind of ["knowledge-source", "knowledge-values", "knowledge-source-hash", "knowledge-authority-unknowns", "knowledge-topology", "knowledge-bindings"]) deletes.push({ kind, key: id });
  for (const unit of graph.units) {
    const source = graph.loadSource(unit.id);
    if (source === undefined) throw new Error(`Changed graph unit ${unit.id} has no context source`);
    upserts.push(
      { kind: "knowledge-source", key: unit.id, value: source },
      { kind: "knowledge-values", key: unit.id, value: graph.valueDependencies([unit.id]) },
      { kind: "knowledge-source-hash", key: unit.id, value: graph.sourceHash(unit.id) },
      { kind: "knowledge-authority-unknowns", key: unit.id, value: [] },
      { kind: "knowledge-topology", key: unit.id, value: { supported: graph.supportsStaticTopology(unit.id), neighbors: graph.topologyNeighbors(unit.id), boundary: graph.topologyObservationBoundary(unit.id) } },
      { kind: "query-dependency-version", key: `projection-unit:${unit.id}`, value: hashFramedDomain("indexed-graph-dependency", unit) },
    );
  }
  const touchedIds = new Set([...oldUnits.keys(), ...newUnits.keys()]);
  const touchedSubjects = new Set([...oldUnits.values(), ...newUnits.values()].flatMap((unit) => [...unit.conceptIds, ...unit.requirementIds, ...unit.scenarioIds]));
  if (store.getAt(generation,"population-version","knowledge-binding-subjects") === undefined) throw new Error("Knowledge binding incidence is missing; rebuild the complete observation");
  for (const id of oldUnits.keys()) for (const subject of store.populationAt(generation,`knowledge-binding-subjects:${id}`)) touchedSubjects.add(subject);
  for (const entity of graph.entities) if (graph.implementationBindings(entity.id).length > 0) touchedSubjects.add(entity.id);
  for (const subject of touchedSubjects) {
    const previous = store.getAt<Array<Record<string, unknown>>>(generation, "knowledge-bindings", subject) ?? [];
    const next = [...previous.filter(({ id }) => !touchedIds.has(String(id))), ...graph.implementationBindings(subject)].sort((a,b) => String(a.id).localeCompare(String(b.id)));
    upserts.push({ kind: "knowledge-bindings", key: subject, value: next });
    for (const binding of previous) if (touchedIds.has(String(binding.id))) populations.push({selector:`knowledge-binding-subjects:${String(binding.id)}`,member:subject,present:false});
    for (const binding of graph.implementationBindings(subject)) populations.push({selector:`knowledge-binding-subjects:${String(binding.id)}`,member:subject,present:true});
  }
  const addresses = new Set([...oldUnits.values(), ...newUnits.values()].flatMap(({ id, key }) => [id, key]));
  for (const path of paths) addresses.add(path);
  for (const address of addresses) {
    const selector = `knowledge-unit-address:${address}`;
    const old = store.populationAt(generation, selector);
    const candidates = graph.resolveNamedTargets([address]);
    // Producer includes every identity collision in the affected component.
    const remaining = old.filter((id) => !touchedIds.has(id));
    if (remaining.length > 0) throw new Error(`Unit identity collision ${address} escaped the complete changed component; rebuild observation`);
    for (const member of old) populations.push({ selector, member, present: false });
    const candidate = candidates[0];
    if (candidate === undefined) deletes.push({ kind: "knowledge-target", key: address });
    else {
      populations.push({ selector, member: candidate.entityId, present: true });
      upserts.push({ kind: "knowledge-target", key: address, value: candidate });
    }
  }
  const previousUncertainty = store.getAt<Array<{ id: string; path: string; sourceHash: ContentHash; uncertainty: string[] }>>(generation, "knowledge-global", "uncertain-importers");
  if (previousUncertainty === undefined) throw new Error("Complete uncertainty population is missing; rebuild observation");
  const uncertainty = [...previousUncertainty.filter(({ path }) => !paths.has(path)), ...graph.uncertainTopologyImporters()].sort((a,b) => a.id.localeCompare(b.id));
  upserts.push({ kind: "knowledge-global", key: "uncertain-importers", value: uncertainty });
  const facts = { paths: [...paths].sort(), units: graph.units, files: observation.analysis.files, dependencies: observation.analysis.dependencies, testTargets: observation.analysis.testTargets, uncertainty };
  // These are disposable invalidation witnesses, not canonical identities. A
  // changed witness forces exact result recomputation; identical result hashes
  // continue to prune downstream semantic invalidation.
  for (const key of ["projection-unit-membership", "repository-module-dependencies", "repository-test-targets", "canonical-realizations"]) {
    const previous = store.getAt<ContentHash>(generation, "query-dependency-version", key);
    if (previous === undefined) throw new Error(`Query population ${key} has no complete baseline; rebuild observation`);
    upserts.push({ kind: "query-dependency-version", key, value: hashFramedDomain("indexed-graph-delta-witness", { previous, facts }) });
  }
  for (const path of paths) upserts.push({ kind: "query-dependency-version", key: `path:${path}`, value: hashFramedDomain("indexed-graph-path-delta", { path, file: observation.analysis.files.find((file) => file.path === path) ?? null, units: graph.units.filter((unit) => unit.key === path) }) });
  store.verifyGeneration(generation);
  return { upserts, deletes, populations };
}
