import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
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
  checkRepository,
  initializePreparedProject,
  inspectProjectReadiness,
  projectLifecycleApply,
  projectLifecycleApproval,
  projectLifecycleCapture,
  projectLifecyclePlan,
  projectLifecycleRecovery,
  projectRepresentationProfileReconciliationOperation,
  summarizeRepositoryIntentReview,
  withProjectOperationAccess
} from "../chunks/shared-IS6JDIFX.js";
import {
  inspectRepositoryArchitecture
} from "../chunks/shared-SFAAGYPE.js";
import {
  CompletionQuestionSchema,
  RepositoryCleanupOutputSchema,
  RepositoryCompletionOutputSchema,
  RepositoryCoverageOutputSchema,
  inspectRepositoryCoverage,
  parseRepositoryCoverageResult
} from "../chunks/shared-ZVAUVDKU.js";
import "../chunks/shared-NAF7P2ZX.js";
import {
  KnowledgeContextOperationOutputSchema,
  KnowledgeReconciliationOperationOutputSchema,
  RepositoryChangeLifecycleService,
  RepositoryKnowledgeService,
  RepositoryRepresentationArtifactStore,
  RepositoryRepresentationInspectionService,
  RepresentationInspectionOperationOutputSchema,
  RepresentationInspectionOutputSchema,
  projectKnowledgeContext,
  projectKnowledgeReconciliation,
  projectRepresentationInspectionOperation
} from "../chunks/shared-7TU7H6FV.js";
import "../chunks/shared-BDBDN4N7.js";
import "../chunks/shared-JZDJZQHJ.js";
import "../chunks/shared-UXWNVNBJ.js";
import {
  KnowledgeApplicationEvidenceAssessmentSchema,
  KnowledgeContextResultSchema,
  KnowledgeReconciliationResultSchema
} from "../chunks/shared-UF33E7SL.js";
import {
  buildRepositoryImpactSnapshot,
  predictRepositoryImpact,
  reconcileRepositoryImpact
} from "../chunks/shared-XUCQQRWD.js";
import "../chunks/shared-E2ZEUURS.js";
import "../chunks/shared-OYZBO5ZA.js";
import {
  runObservationTask
} from "../chunks/shared-HODAXZKW.js";
import "../chunks/shared-3WNQLUKU.js";
import "../chunks/shared-GHTLNEBM.js";
import "../chunks/shared-IFURLTPX.js";
import "../chunks/shared-FZTNE5ZL.js";
import "../chunks/shared-RWHW46VO.js";
import "../chunks/shared-GHDUIXJM.js";
import "../chunks/shared-UX72GU5O.js";
import "../chunks/shared-ZKECJVYF.js";
import "../chunks/shared-6VIFAIKJ.js";
export {
  CompletionQuestionSchema,
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
  RepresentationProfileReconciliationOperationOutputSchema,
  RepresentationProfileReconciliationOutputSchema,
  StateBoundChangeResultSchema,
  buildRepositoryImpactSnapshot,
  checkRepository,
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
  summarizeRepositoryIntentReview,
  withProjectOperationAccess
};
