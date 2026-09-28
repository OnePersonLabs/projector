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
} from "../chunks/shared-RQAO52GP.js";
import "../chunks/shared-YZHC7WTJ.js";
import {
  inspectRepositoryArchitecture
} from "../chunks/shared-7LB4PVNV.js";
import {
  CompletionQuestionSchema,
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  inspectRepositoryCoverage,
  parseRepositoryCoverageResult
} from "../chunks/shared-PMEWHUNO.js";
import {
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
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  projectRepresentationInspectionOperation
} from "../chunks/shared-D3MXHIAY.js";
import "../chunks/shared-PMEH6UKE.js";
import "../chunks/shared-2B7P2BAO.js";
import "../chunks/shared-PMI2YIJY.js";
import {
  KnowledgeApplicationEvidenceAssessmentSchema,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationResultSchema
} from "../chunks/shared-TKNA4UJH.js";
import {
  buildRepositoryImpactSnapshot,
  predictRepositoryImpact,
  reconcileRepositoryImpact
} from "../chunks/shared-HUQ6JTJS.js";
import "../chunks/shared-YMMDUUVJ.js";
import "../chunks/shared-VQ4M4TY3.js";
import "../chunks/shared-F7VGIPLU.js";
import "../chunks/shared-SN3OO5CC.js";
import "../chunks/shared-WY2QJ7AR.js";
import {
  ResidentObservationWorkerPool,
  runObservationTask,
  withResidentObservationWorkerPool
} from "../chunks/shared-2INZJVA6.js";
import "../chunks/shared-AHRONKDP.js";
import "../chunks/shared-IVNK7NJ5.js";
import "../chunks/shared-IFEDFPQ4.js";
import "../chunks/shared-EHAKQ7RC.js";
import "../chunks/shared-T66EWDMN.js";
import "../chunks/shared-WYYVWFGB.js";
import "../chunks/shared-3PXVRXWV.js";
import "../chunks/shared-KWLM6SLK.js";
import "../chunks/shared-2U2MJHPJ.js";
import "../chunks/shared-HEBLUKDF.js";
import {
  ArchitectureEvaluationOutputSchema
} from "../chunks/shared-AJ5KBTH5.js";
import "../chunks/shared-WC2OT3WX.js";
export {
  ArchitectureEvaluationOutputSchema,
  BuiltinVerificationService,
  CompletionQuestionSchema,
  GeneratedOutputService,
  KnowledgeApplicationEvidenceAssessmentSchema,
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
