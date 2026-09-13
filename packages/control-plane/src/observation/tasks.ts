import type { CollectedLocalRepositoryInputs, LocalRepositoryAnalysis } from "@projector/analyzers";
import type { CanonicalSnapshot, CanonicalSnapshotSource } from "@projector/runtime";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import type { RepositoryImpactSnapshot, RepositoryImpactReport, RepositoryImpactReference } from "../impact/service.js";
import type { DerivedCacheWrite } from "@projector/runtime";
import type { KnowledgeContextRequest, KnowledgeContextResult, KnowledgeReconciliationResult } from "../knowledge/types.js";
import type { KnowledgeDecisionBaseline } from "../knowledge/decision-baselines.js";
import type { DecisionBaselineDataInput, DecisionBaselineDataResult } from "../knowledge/decision-baseline-data.js";
import type { RepositoryCoverageRequest } from "../coverage/service.js";
import type { RepositoryCoverageMode, RepositoryCoverageResult } from "../coverage/transport.js";
import type { computeRepositoryArchitecture } from "../knowledge/architecture-inspection.js";
import type { AdapterContext, ContentHash, StateQuerySpec, StateQueryResultFingerprint } from "@projector/core";
import type { CalculatedRepositoryRelevance, RepositoryRelevanceObservation } from "../change-lifecycle/query-programs.js";

export type RepositoryObservationData = Omit<ChangeRepositoryObservation, "independentValidator">;
export interface ObservationTaskInputs {
  "change-relevance": { observation: RepositoryRelevanceObservation; editedPaths: readonly string[] };
  "change-query": { observation: RepositoryObservationData; now: string; query: StateQuerySpec; context: Omit<AdapterContext, "signal"> };
  "cache-protection": { repositoryRoot: string; sources: Record<string, string>; deadline: number; maxSourceBytes?: number };
  "authenticate-impact": { source: string; reference: RepositoryImpactReference };
  "prepare-impact": { observation: RepositoryObservationData; editedPaths: readonly string[]; canonicalChanges: readonly { id: string; kind: string }[]; affectedUnitIds: readonly string[] };
  "analyze-collected": { collected: CollectedLocalRepositoryInputs };
  coverage: { observation: RepositoryObservationData; request: RepositoryCoverageRequest; mode: RepositoryCoverageMode; now: string };
  architecture: { observation: RepositoryObservationData; now: string };
  "hash-content": { content: string };
  "authenticate-context": { source: string };
  "decision-baseline-data": DecisionBaselineDataInput;
  "knowledge-context": { observation: RepositoryObservationData; request: Omit<KnowledgeContextRequest, "signal">; now: string; acceptedDecisionBaselines?: readonly KnowledgeDecisionBaseline[] };
  "knowledge-reconcile": { observation: RepositoryObservationData; retained: KnowledgeContextResult; now: string; acceptedDecisionBaselines?: readonly KnowledgeDecisionBaseline[] };
  observe: { collected: CollectedLocalRepositoryInputs; canonicalSources: readonly CanonicalSnapshotSource[] };
  canonical: { sources: readonly CanonicalSnapshotSource[] };
  "build-impact": { observation: RepositoryObservationData };
  "predict-impact": { snapshot: RepositoryImpactSnapshot; editedPaths: readonly string[]; canonicalChanges?: readonly { id: string; kind: string }[] };
  "reconcile-impact": { before: RepositoryImpactSnapshot; after: RepositoryImpactSnapshot; predictedUnitIds: readonly string[]; planId: string; predictedPaths?: readonly string[]; hasPrediction?: boolean };
}
export interface ObservationTaskResults {
  "change-relevance": CalculatedRepositoryRelevance;
  "change-query": StateQueryResultFingerprint;
  "cache-protection": string[];
  "authenticate-impact": RepositoryImpactSnapshot;
  "prepare-impact": { baseline: RepositoryImpactSnapshot; prediction: RepositoryImpactReport; governanceMemberships: { lensId: string; unitId: string; path: string }[] };
  "analyze-collected": LocalRepositoryAnalysis;
  coverage: RepositoryCoverageResult;
  architecture: Awaited<ReturnType<typeof computeRepositoryArchitecture>>;
  "hash-content": ContentHash;
  "authenticate-context": KnowledgeContextResult;
  "decision-baseline-data": DecisionBaselineDataResult;
  "knowledge-context": { result: KnowledgeContextResult; writes: DerivedCacheWrite[] };
  "knowledge-reconcile": KnowledgeReconciliationResult;
  observe: RepositoryObservationData;
  canonical: CanonicalSnapshot;
  "build-impact": RepositoryImpactSnapshot;
  "predict-impact": RepositoryImpactReport;
  "reconcile-impact": RepositoryImpactReport;
}
export type ObservationTask = { [K in keyof ObservationTaskInputs]: { type: K; input: ObservationTaskInputs[K] } }[keyof ObservationTaskInputs];
