import { analyzeGitTree } from "@projector/analyzers";
import { hashFramedDomain, type DerivedObservationBudget, type GitIntegrationAssessment } from "@projector/core";
import { type CanonicalSnapshot, type ObservationScope } from "@projector/runtime";
import { realizeChangeRepositoryData } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { buildRepositoryImpactSnapshot } from "../impact/service.js";

const unique = (values: readonly string[]) => [...new Set(values)].sort();
/** Recompute all populations on each tree, including queries with no baseline consumers. */
export async function reconcileIntegrationResult(root: string, scope: ObservationScope, derived: DerivedObservationBudget, trees: readonly [string, string, string], canonical: readonly [CanonicalSnapshot, CanonicalSnapshot, CanonicalSnapshot], changedPaths: readonly string[]): Promise<GitIntegrationAssessment["resultReconciliation"]> {
  const observations = [];
  for (let index = 0; index < trees.length; index++) {
    scope.signal.throwIfAborted();
    const raw = await analyzeGitTree(root, trees[index]!, scope.budget, derived, scope.signal);
    observations.push(realizeChangeRepositoryData(root, raw, canonical[index]!, derived));
  }
  const graphs = observations.map(observation => new KnowledgeGraph(observation, {}, derived));
  const snapshots = observations.map((observation, index) => buildRepositoryImpactSnapshot(observation, graphs[index]!));
  const unknowns = unique(snapshots.flatMap(snapshot => [...snapshot.unknowns]));
  const consumers = observations.map(observation => {
    const reverse = new Map<string, string[]>();
    for (const dependency of observation.analysis.dependencies) if (dependency.resolvedPath !== undefined) reverse.set(dependency.resolvedPath, [...(reverse.get(dependency.resolvedPath) ?? []), dependency.importerPath]);
    return (path: string): string[] => {
      const seen = new Set<string>(), pending = [...(reverse.get(path) ?? [])];
      while (pending.length) {
        const current = pending.pop()!;
        scope.budget.check("git-result-consumer-population", current); scope.signal.throwIfAborted();
        if (current === path || seen.has(current)) continue;
        derived.reserve(128 + current.length * 2, "git-result-consumer-population", current);
        seen.add(current); pending.push(...(reverse.get(current) ?? []));
      }
      return [...seen].sort();
    };
  });
  const consumerQueries = unique(changedPaths.filter(path => !path.startsWith(".projector/"))).map(dependencyPath => {
    const targetConsumers = consumers[0]!(dependencyPath), incomingConsumers = consumers[1]!(dependencyPath), resultConsumers = consumers[2]!(dependencyPath);
    const newlyRelevantConsumers = resultConsumers.filter(path => !targetConsumers.includes(path) || !incomingConsumers.includes(path));
    const removedConsumers = unique([...targetConsumers, ...incomingConsumers]).filter(path => !resultConsumers.includes(path));
    const basis = { dependencyPath, targetConsumers, incomingConsumers, resultConsumers, newlyRelevantConsumers, removedConsumers };
    return { ...basis, fingerprint: hashFramedDomain("git-result-consumer-population-v1", { trees, ...basis }) };
  });
  const lensIds = unique(graphs.flatMap(graph => graph.lenses.filter(lens => lens.status === "active").map(lens => lens.id)));
  const topologyMaps = observations.map(observation => new Map(observation.analysis.topology.routes.map(route => [route.subjectId, route])));
  const topologyQueries = unique(topologyMaps.flatMap(routes => [...routes.keys()])).map(subjectId => {
    const routes = topologyMaps.map(map => map.get(subjectId));
    const [targetConsumers, incomingConsumers, resultConsumers] = routes.map(route => unique(route?.consumerIds ?? [])) as [string[], string[], string[]];
    const final = routes[2];
    const observability = final?.observability ?? "unavailable";
    if (observability === "open" || observability === "unavailable") unknowns.push(`${subjectId}: result topology consumer population is ${observability}`);
    const basis = { subjectId, subjectKind: (final ?? routes[0] ?? routes[1])!.subjectKind, targetConsumers, incomingConsumers, resultConsumers, newlyRelevantConsumers: resultConsumers.filter(id => !targetConsumers.includes(id) || !incomingConsumers.includes(id)), observability };
    return { ...basis, fingerprint: hashFramedDomain("git-result-topology-population-v1", { trees, ...basis }) };
  });
  const finalGraph = graphs[2]!;
  const allIds = new Set([...finalGraph.units.map(unit => unit.id), ...lensIds]);
  const compiledObligations = finalGraph.lensObligations(allIds, "integration");
  const lensPopulations = lensIds.map(lensId => {
    const [targetMembers, incomingMembers, resultMembers] = graphs.map(graph => unique(graph.lensCompilation?.memberships[lensId] ?? [])) as [string[], string[], string[]];
    return { lensId, targetMembers, incomingMembers, resultMembers, newlyApplicableUnitIds: resultMembers.filter(id => !targetMembers.includes(id) || !incomingMembers.includes(id)), resultObligations: compiledObligations.filter(obligation => obligation.lensId === lensId).map(({ unitId, applicabilityFingerprint, validatorIds, ruleIds }) => ({ unitId, applicabilityFingerprint, validatorIds: [...validatorIds], ruleIds: [...ruleIds] })) };
  });
  const contradictions: string[] = [];
  for (const divergence of observations[2]!.analysis.divergences) {
    const message = `${divergence.code}: ${divergence.path}: ${divergence.explanation}`;
    // A repeated export name across separate modules is legal. Only a
    // demonstrably missing static target is a contradiction without a lens.
    if (divergence.code === "broken-static-import" || divergence.code === "actions-needs-gap") contradictions.push(message);
    else unknowns.push(`Requires semantic review: ${message}`);
  }
  const evaluations = finalGraph.governanceEvaluationsWithProvenance(allIds, "integration");
  for (const { lensId, evaluation } of evaluations) {
    if (evaluation.status === "violated") contradictions.push(`${lensId}: ${evaluation.unitId}: static governance violated`);
    if (evaluation.status === "unknown") unknowns.push(`${lensId}: ${evaluation.unitId}: static governance unknown`);
  }
  const semanticMaps = observations.map(observation => new Map(observation.analysis.javaScript.files.map(file => [file.path, file.semanticHash])));
  const semanticChanges = unique([...semanticMaps[0]!.keys(), ...semanticMaps[1]!.keys(), ...semanticMaps[2]!.keys()]).filter(path => semanticMaps[0]!.get(path) !== semanticMaps[2]!.get(path) || semanticMaps[1]!.get(path) !== semanticMaps[2]!.get(path)).map(path => ({ path, ...(semanticMaps[0]!.has(path) ? { targetHash: semanticMaps[0]!.get(path)! } : {}), ...(semanticMaps[1]!.has(path) ? { incomingHash: semanticMaps[1]!.get(path)! } : {}), ...(semanticMaps[2]!.has(path) ? { resultHash: semanticMaps[2]!.get(path)! } : {}) }));
  return { status: contradictions.length ? "failed" : unknowns.length ? "incomplete" : "assessed", scope: "immutable-result-static-consumers-and-obligations", consumerQueries, topologyQueries, lensPopulations, semanticChanges, contradictions: unique(contradictions), unknowns: unique(unknowns), behavior: { status: "not-assessed", reusable: false } };
}
