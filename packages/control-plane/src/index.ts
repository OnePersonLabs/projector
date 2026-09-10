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
  LifecycleResumeOutputSchema,
  RepositoryIntentReviewSummarySchema,
  StateBoundChangeResultSchema,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  projectLifecycleResume,
  summarizeRepositoryIntentReview,
  type LifecycleApplyOutput,
  type LifecycleApprovalOutput,
  type LifecycleCaptureOutput,
  type LifecyclePlanOutput,
  type LifecycleRecoveryOutput,
  type LifecycleResumeOutput,
  type RepositoryIntentReviewSummary,
} from "./change-lifecycle/transport.js";
export { RepositoryKnowledgeService } from "./knowledge/service.js";
export {
  KnowledgeApplicationEvidenceAssessmentSchema,
  type KnowledgeApplicationEvidenceAssessment,
  type PsychordApplicationEvidenceHost,
} from "./knowledge/application-evidence.js";
export { buildRepositoryImpactSnapshot, predictRepositoryImpact, reconcileRepositoryImpact, type RepositoryImpactReport } from "./impact/service.js";
export { inspectRepositoryArchitecture } from "./knowledge/architecture-inspection.js";
export type {
  KnowledgeContextRequest,
  KnowledgeContextResult,
  KnowledgeReconciliationResult,
} from "./knowledge/types.js";
export { KnowledgeContextResultSchema, KnowledgeReconciliationResultSchema } from "./knowledge/types.js";
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
  createPreparedProjectDataMigrationRecoveryService,
  type PreparedProjectDataMigrationRecoveryService,
} from "./readiness/project-data-migration-recovery.js";
export {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
  type ValidatedReleaseCandidateInventory,
} from "./readiness/project-data-format-owner.js";
export {
  compareProjectDataFormats,
  createProjectDataMigrationDraft,
  createReleaseCandidateProjectDataMigration,
  projectDataFormatDimensions,
  verifyProjectDataMigrationManifest,
  type ProjectDataFormatDimension,
} from "./readiness/project-data-migration-authoring.js";
export {
  RepositoryRepresentationArtifactStore,
  type DurableRepresentationArtifact,
} from "./representation/artifact-store.js";
export {
  RepositoryRepresentationInspectionService,
  RepresentationInspectionOutputSchema,
  type RepresentationInspectionOutput,
} from "./representation/service.js";
