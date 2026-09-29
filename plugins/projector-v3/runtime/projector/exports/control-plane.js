import {
  BuiltinVerificationService,
  GeneratedOutputService,
  LifecycleApplyOutputSchema,
  LifecycleApprovalOutputSchema,
  LifecycleCaptureOutputSchema,
  LifecyclePlanOutputSchema,
  LifecycleRecoveryOutcomeSchema,
  LifecycleRecoveryOutputSchema,
  PreparedProjectInitializationResultSchema,
  RepositoryCheckOutputSchema,
  RepositoryIntentReviewSummarySchema,
  RepositoryRepresentationProfileReconciliationService,
  RepresentationProfileReconciliationOperationOutputSchema,
  RepresentationProfileReconciliationOutputSchema,
  StateBoundChangeResultSchema,
  VerificationService,
  assessGitIntegration,
  builtinCanonicalCheck,
  checkRepository,
  evaluateRepositoryArchitectureOptions,
  executeCodeOperation,
  executeCodeTestReplay,
  initializePreparedProject,
  inspectProjectReadiness,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  projectRepresentationProfileReconciliationOperation,
  shutdownCodeIndexRuns,
  summarizeRepositoryIntentReview,
  withProjectOperationAccess
} from "../chunks/shared-7TNVZRWS.js";
import "../chunks/shared-PBCNT5ED.js";
import {
  inspectRepositoryArchitecture
} from "../chunks/shared-7F6QD6HY.js";
import {
  CompletionQuestionSchema,
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  inspectRepositoryCoverage,
  parseRepositoryCoverageResult
} from "../chunks/shared-53T52QIE.js";
import {
  KnowledgeContextInspectOperationOutputSchema,
  KnowledgeContextInspectionOutputSchema,
  KnowledgeContextOperationOutputSchema,
  KnowledgeReconciliationOperationOutputSchema,
  RepositoryChangeLifecycleService,
  RepositoryKnowledgeService,
  RepositoryRepresentationArtifactStore,
  RepositoryRepresentationInspectionService,
  RepresentationInspectionOperationOutputSchema,
  RepresentationInspectionOutputSchema,
  RepresentationPendingOutputSchema,
  RepresentationRecoveryOutputSchema,
  inspectKnowledgeContext,
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  projectRepresentationInspectionOperation
} from "../chunks/shared-XO4N5UQ4.js";
import "../chunks/shared-4VMBTM7P.js";
import "../chunks/shared-T7I2XRNT.js";
import "../chunks/shared-A4MG5XTQ.js";
import {
  KnowledgeApplicationEvidenceAssessmentSchema,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationResultSchema
} from "../chunks/shared-NNEVKOIJ.js";
import {
  buildRepositoryImpactSnapshot,
  predictRepositoryImpact,
  reconcileRepositoryImpact
} from "../chunks/shared-F4F42JVN.js";
import "../chunks/shared-HMB6GHHY.js";
import "../chunks/shared-RLI43OE3.js";
import "../chunks/shared-SRZY32OS.js";
import "../chunks/shared-3WBVMTX7.js";
import "../chunks/shared-HCFZBUVW.js";
import {
  ResidentObservationWorkerPool,
  runObservationTask,
  withResidentObservationWorkerPool
} from "../chunks/shared-A7FXFSCG.js";
import "../chunks/shared-VH32AY4L.js";
import "../chunks/shared-K5SAD5NH.js";
import "../chunks/shared-3OPGBX4O.js";
import "../chunks/shared-QSFRBEBN.js";
import "../chunks/shared-XAKKJSHO.js";
import "../chunks/shared-XN3IZTFL.js";
import "../chunks/shared-EK2KJXX2.js";
import "../chunks/shared-53BCDAHA.js";
import "../chunks/shared-JRUJSZFM.js";
import "../chunks/shared-RMBXVF7C.js";
import {
  ArchitectureEvaluationOutputSchema
} from "../chunks/shared-Q56AARV7.js";
import "../chunks/shared-WC2OT3WX.js";
export {
  ArchitectureEvaluationOutputSchema,
  BuiltinVerificationService,
  CompletionQuestionSchema,
  GeneratedOutputService,
  KnowledgeApplicationEvidenceAssessmentSchema,
  KnowledgeContextInspectOperationOutputSchema,
  KnowledgeContextInspectionOutputSchema,
  KnowledgeContextOperationOutputSchema,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationOperationOutputSchema,
  KnowledgeReconciliationResultSchema,
  LifecycleApplyOutputSchema,
  LifecycleApprovalOutputSchema,
  LifecycleCaptureOutputSchema,
  LifecyclePlanOutputSchema,
  LifecycleRecoveryOutcomeSchema,
  LifecycleRecoveryOutputSchema,
  PreparedProjectInitializationResultSchema,
  RepositoryChangeLifecycleService,
  RepositoryCheckOutputSchema,
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  RepositoryIntentReviewSummarySchema,
  RepositoryKnowledgeService,
  RepositoryRepresentationArtifactStore,
  RepositoryRepresentationInspectionService,
  RepositoryRepresentationProfileReconciliationService,
  RepresentationInspectionOperationOutputSchema,
  RepresentationInspectionOutputSchema,
  RepresentationPendingOutputSchema,
  RepresentationProfileReconciliationOperationOutputSchema,
  RepresentationProfileReconciliationOutputSchema,
  RepresentationRecoveryOutputSchema,
  ResidentObservationWorkerPool,
  StateBoundChangeResultSchema,
  VerificationService,
  assessGitIntegration,
  buildRepositoryImpactSnapshot,
  builtinCanonicalCheck,
  checkRepository,
  evaluateRepositoryArchitectureOptions,
  executeCodeOperation,
  executeCodeTestReplay,
  initializePreparedProject,
  inspectKnowledgeContext,
  inspectProjectReadiness,
  inspectRepositoryArchitecture,
  inspectRepositoryCoverage,
  parseRepositoryCoverageResult,
  predictRepositoryImpact,
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  projectRepresentationInspectionOperation,
  projectRepresentationProfileReconciliationOperation,
  reconcileRepositoryImpact,
  runObservationTask,
  shutdownCodeIndexRuns,
  summarizeRepositoryIntentReview,
  withProjectOperationAccess,
  withResidentObservationWorkerPool
};
