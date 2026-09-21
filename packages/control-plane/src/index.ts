export {
  RepositoryChangeLifecycleService,
  type LifecycleRecoveryOutcome,
} from "./change-lifecycle/service.js";
export {
  LifecycleApplyOutputSchema,
  LifecycleApprovalOutputSchema,
  LifecycleCaptureOutputSchema,
  LifecyclePlanOutputSchema,
  LifecycleRecoveryOutcomeSchema,
  LifecycleRecoveryOutputSchema,
  RepositoryIntentReviewSummarySchema,
  StateBoundChangeResultSchema,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  summarizeRepositoryIntentReview,
  type LifecycleApplyOutput,
  type LifecycleApprovalOutput,
  type LifecycleCaptureOutput,
  type LifecyclePlanOutput,
  type LifecycleRecoveryOutput,
  type RepositoryIntentReviewSummary,
} from "./change-lifecycle/transport.js";
export { RepositoryKnowledgeService } from "./knowledge/service.js";
export { checkRepository, RepositoryCheckOutputSchema } from "./repository-check/service.js";
export {
  KnowledgeApplicationEvidenceAssessmentSchema,
  type KnowledgeApplicationEvidenceAssessment,
  type ApplicationEvidencePort,
} from "./knowledge/application-evidence.js";
export { buildRepositoryImpactSnapshot, predictRepositoryImpact, reconcileRepositoryImpact, type RepositoryImpactReport } from "./impact/service.js";
export { inspectRepositoryArchitecture } from "./knowledge/architecture-inspection.js";
export type {
  KnowledgeContextRequest,
  KnowledgeContextResult,
  KnowledgeReconciliationResult,
} from "./knowledge/types.js";
export { KnowledgeContextResultSchema, KnowledgeReconciliationResultSchema } from "./knowledge/types.js";
export { KnowledgeContextOperationOutputSchema, KnowledgeReconciliationOperationOutputSchema, projectKnowledgeContext, projectKnowledgeReconciliation } from "./knowledge/transport.js";
export { inspectRepositoryCoverage, type RepositoryCoverageRequest } from "./coverage/service.js";
export type { CompletionQuestion } from "./coverage/issues.js";
export {
  CompletionQuestionSchema,
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  parseRepositoryCoverageResult,
  type RepositoryCoverageMode,
  type RepositoryCoverageResult,
} from "./coverage/transport.js";
export {
  PreparedProjectInitializationResultSchema,
  initializePreparedProject,
  inspectProjectReadiness,
  withProjectOperationAccess,
  type PreparedProjectInitializationResult,
  type ProjectOperationAccessResult,
  type ReadinessInspectionInput,
  type ReadyProjectReadiness,
} from "./readiness/service.js";
export {
  RepositoryRepresentationArtifactStore,
  type DurableRepresentationArtifact,
} from "./representation/artifact-store.js";
export {
  RepositoryRepresentationInspectionService,
  RepresentationInspectionOperationOutputSchema,
  RepresentationInspectionOutputSchema,
  projectRepresentationInspectionOperation,
  type RepresentationInspectionOperationOutput,
  type RepresentationInspectionOutput,
} from "./representation/service.js";
export {
  RepositoryRepresentationProfileReconciliationService,
  RepresentationProfileReconciliationOperationOutputSchema,
  RepresentationProfileReconciliationOutputSchema,
  projectRepresentationProfileReconciliationOperation,
  type RepresentationProfileReconciliationOperationOutput,
  type RepresentationProfileReconciliationOutput,
} from "./representation/profile-reconciliation.js";
export { runObservationTask } from "./observation/task-runner.js";
