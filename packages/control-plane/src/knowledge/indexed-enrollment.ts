import { buildManifest, manifestKey, hashFramedDomain, type ContentHash, type Relation } from "@projector/core";
import type { IndexedObservationDelta } from "@projector/runtime";
import type { RepositoryObservationData } from "../observation/tasks.js";
import type { RepositoryImpactSnapshot } from "../impact/service.js";
import { KnowledgeGraph, tokens } from "./graph.js";
import { enrollIndexedGovernance } from "./indexed-governance.js";
import { enrollRealizationIncidence } from "./indexed-selector-incidence.js";
import { reverseDerivationManifestKey } from "./indexed-derivations.js";

/** Enroll the existing graph contracts, including complete empty populations.
 * Cold enrollment is linear in the explicit canonical and derivation output. */
export function enrollIndexedGraph(observation: RepositoryObservationData, impact: RepositoryImpactSnapshot, graph = new KnowledgeGraph(observation), emit?: (delta:IndexedObservationDelta)=>void): IndexedObservationDelta {
  const populations = new Map<string, Set<string>>();
  const population = (name: string): Set<string> => {
    let members = populations.get(name);
    if (members === undefined) { members = new Set(); populations.set(name, members); }
    return members;
  };
  for (const kind of ["concept", "requirement", "behavioral-scenario", "relation", "authority-record", "lineage", "tombstone", "architecture-decision", "projection-lens", "architecture-concern", "developer-preference"]) population(`canonical-kind:${kind}`);
  for (const document of observation.canonical.documents) {
    population(`canonical-kind:${document.kind}`).add(document.id);
    if (document.kind === "relation") {
      const relation = document.payload as unknown as Relation;
      if (!relation.active) continue;
      population(`relations:out:${relation.fromId}`).add(relation.id);
      population(`relations:in:${relation.toId}`).add(relation.id);
      population(`relations:both:${relation.fromId}`).add(relation.id);
      population(`relations:both:${relation.toId}`).add(relation.id);
    }
  }
  const upserts: NonNullable<IndexedObservationDelta["upserts"]>[number][] = [];
  const dependencies: NonNullable<IndexedObservationDelta["dependencies"]>[number][] = [];
  // Bound enrollment records independently of repository population. The graph
  // itself still owns the semantic state needed for cross-file reasoning.
  const flush=():void=>{if(emit!==undefined){emit({upserts:upserts.splice(0),dependencies:dependencies.splice(0)});}};
  const append=(...records:typeof upserts):void=>{upserts.push(...records);if(upserts.length>=64)flush();};
  const reverse = new Map<string, Set<string>>();
  for (const record of impact.records) {
    if(upserts.length>=64)flush();
    append({ kind: "derivation-inputs", key: record.unitId, value: record.inputs });
    for (const input of record.inputs) {
      const consumers = reverse.get(input.id) ?? new Set<string>();
      consumers.add(record.unitId); reverse.set(input.id, consumers);
      dependencies.push({ consumer: record.unitId, input: `derivation:${input.id}`, present: true });
    }
  }
  const version = (key: string, value: unknown): void => {
    if(upserts.length>=64)flush();
    append({ kind: "query-dependency-version", key, value: hashFramedDomain("indexed-graph-dependency", value) });
  };
  const canonicalKinds: Record<string, readonly string[]> = {
    "canonical-identity-discovery": ["concept", "requirement", "behavioral-scenario", "architecture-decision", "projection-lens", "architecture-concern", "developer-preference"],
    "canonical-lineage": ["lineage"], "canonical-tombstones": ["tombstone"],
    "canonical-relations": ["relation"], "canonical-decisions": ["architecture-decision"],
    "canonical-authorities": ["authority-record"], "canonical-lenses": ["projection-lens"],
    "canonical-scopes": ["architecture-decision", "architecture-concern", "projection-lens"],
  };
  for (const [key, kinds] of Object.entries(canonicalKinds)) version(key, observation.canonical.documents.filter((document) => kinds.includes(document.kind)).map(({ id, canonicalDocumentHash }) => ({ id, canonicalDocumentHash })).sort((a,b) => a.id.localeCompare(b.id)));
  version("canonical-realizations", observation.realizations);
  version("projection-unit-membership", observation.analysis.projectionUnits);
  version("repository-module-dependencies", { dependencies: observation.analysis.dependencies, files: observation.analysis.javaScript.files, failures: observation.analysis.javaScript.failures, capabilities: observation.analysis.capabilities });
  version("repository-test-targets", observation.analysis.testTargets);
  for (const unit of observation.analysis.projectionUnits) version(`projection-unit:${unit.id}`, unit);
  const impactUnitsByPath = new Map(impact.files.map(({ path, unitIds }) => [path, unitIds]));
  for (const file of observation.analysis.files) version(`path:${file.path}`, { file, units: impactUnitsByPath.get(file.path) ?? [] });
  for (const document of observation.canonical.documents) version(`entity:${document.id}`, document);
  const entityIds = [...graph.entities.map(({ id }) => id), ...graph.units.map(({ id }) => id)];
  for (const id of entityIds) {
    if(upserts.length>=64)flush();
    const source = graph.loadSource(id);
    if (source !== undefined) append({ kind: "knowledge-source", key: id, value: source });
    append({ kind: "knowledge-values", key: id, value: graph.valueDependencies([id]) });
    const sourceHash = graph.sourceHash(id);
    if (sourceHash !== undefined) append({ kind: "knowledge-source-hash", key: id, value: sourceHash });
    append({ kind: "knowledge-authority-unknowns", key: id, value: graph.authorityUnknowns([id]) });
    append({ kind: "knowledge-bindings", key: id, value: graph.implementationBindings(id) });
    for (const binding of graph.implementationBindings(id)) population(`knowledge-binding-subjects:${String(binding.id)}`).add(id);
  }
  for (const unit of graph.units) append({ kind: "knowledge-topology", key: unit.id, value: { supported: graph.supportsStaticTopology(unit.id), neighbors: graph.topologyNeighbors(unit.id), boundary: graph.topologyObservationBoundary(unit.id) } });
  append({ kind: "knowledge-global", key: "uncertain-importers", value: graph.uncertainTopologyImporters() });
  append({ kind: "knowledge-global", key: "failures", value: observation.analysis.failures });
  for (const entity of graph.entities) {
    append({ kind: "knowledge-identity", key: entity.id, value: entity });
    for (const token of tokens(entity.searchable.join(" "))) population(`knowledge-lexical:${token}`).add(entity.id);
    for (const address of [entity.id, entity.key, ...(entity.accepted ? entity.aliases : [])]) population(`knowledge-address:${address.normalize("NFKC").trim().toLocaleLowerCase("en-US")}`).add(entity.id);
  }
  for (const [index, edge] of [
    ...graph.lineages.flatMap(({ fromIds, toIds }) => fromIds.map((from) => ({ from, toIds, origins: fromIds, signal: "lineage" as const }))),
    ...graph.tombstones.map(({ entityId, replacementIds }) => ({ from: entityId, toIds: replacementIds, origins: [entityId], signal: "tombstone" as const })),
  ].entries()) {
    const key = String(index);
    append({ kind: "knowledge-continuity", key, value: edge });
    population(`knowledge-continuity-address:${edge.from.normalize("NFKC").trim().toLocaleLowerCase("en-US")}`).add(key);
    population(`knowledge-continuity:${edge.from}`).add(key);
  }
  for (const unit of graph.units) {
    for (const address of [unit.id, unit.key]) population(`knowledge-unit-address:${address}`).add(unit.id);
  }
  const unitIdsByArtifact = new Map<string, string[]>();
  for (const unit of graph.units) { const ids = unitIdsByArtifact.get(unit.artifactId) ?? []; ids.push(unit.id); unitIdsByArtifact.set(unit.artifactId, ids); }
  for (const file of observation.analysis.files) for (const id of unitIdsByArtifact.get(file.artifactId) ?? []) population(`knowledge-unit-address:${file.path}`).add(id);
  for (const selector of populations.keys()) if (selector.startsWith("knowledge-unit-address:")) {
    const target = selector.slice("knowledge-unit-address:".length);
    const candidate = graph.resolveNamedTargets([target])[0];
    if (candidate !== undefined) append({ kind: "knowledge-target", key: target, value: candidate });
  }
  const realizationUnknowns = new Map<string, string[]>();
  for (const realization of observation.realizations) if (realization.status !== "matched") {
    const unknowns = realizationUnknowns.get(realization.entityId) ?? [];
    unknowns.push(`realization ${realization.entityId}[${realization.bindingIndex}]: ${realization.reason}`);
    realizationUnknowns.set(realization.entityId, unknowns);
  }
  for (const [id, unknowns] of realizationUnknowns) append({ kind: "knowledge-realization-unknowns", key: id, value: unknowns.sort() });
  for (const [subject, members] of reverse) {
    const manifest = buildManifest([...members].sort().map(id => ({key:manifestKey(id),value:id})));
    append({kind:"reverse-derivation-root",key:subject,value:manifest.root});
    for (const [prefix,node] of manifest.nodes) append({kind:"reverse-derivation-manifest",key:reverseDerivationManifestKey(subject,prefix),value:node});
    version(`reverse-derivations:${subject}`, manifest.root);
  }
  const sourceVersions = new Map(observation.canonical.documents.map((document) => [document.id, document.canonicalDocumentHash]));
  for (const [selector, members] of populations) {
    const identities = [...members].sort();
    const fingerprint: ContentHash = hashFramedDomain("indexed-graph-population", identities.map((id) => ({ id, source: sourceVersions.get(id) })));
    append({ kind: "population-version", key: selector, value: fingerprint });
    version(selector, fingerprint);
  }
  // These namespace markers prove absent addressed populations are empty. A
  // missing namespace means enrollment was incomplete, not an empty answer.
  for (const namespace of ["relations", "reverse-derivations", "knowledge-address", "knowledge-lexical", "knowledge-unit-address", "knowledge-binding-subjects", "knowledge-continuity", "knowledge-source", "knowledge-realization-unknowns"]) append({ kind: "population-version", key: namespace, value: hashFramedDomain("indexed-graph-enrollment", { namespace, canonical: observation.canonical.rootDigest, impact: impact.contentHash }) });
  const incidence = enrollRealizationIncidence(observation);
  if(emit!==undefined){
    flush();emit(enrollIndexedGovernance(observation,graph));emit(incidence);
    let batch:NonNullable<IndexedObservationDelta["populations"]>[number][]=[];
    for(const [selector,members] of populations)for(const member of members){
      batch.push({selector,member,present:true});if(batch.length>=64){emit({populations:batch});batch=[];}
    }
    if(batch.length>0)emit({populations:batch});return{};
  }
  return {
    upserts: [...upserts, ...(enrollIndexedGovernance(observation, graph).upserts ?? []), ...(incidence.upserts ?? [])],
    populations: [...populations].flatMap(([selector, members]) => [...members].map((member) => ({ selector, member, present: true }))).concat(incidence.populations ?? []),
    dependencies,
  };
}
