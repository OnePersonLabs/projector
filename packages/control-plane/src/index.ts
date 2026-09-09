export {
  RepositoryChangeLifecycleService,
  type LifecycleRecoveryOutcome,
} from "./change-lifecycle/service.js";
export { RepositoryKnowledgeService } from "./knowledge/service.js";
export { buildRepositoryImpactSnapshot, predictRepositoryImpact, reconcileRepositoryImpact, type RepositoryImpactReport } from "./impact/service.js";
export { inspectRepositoryArchitecture } from "./knowledge/architecture-inspection.js";
export type {
  KnowledgeContextRequest,
  KnowledgeContextResult,
  KnowledgeReconciliationResult,
} from "./knowledge/types.js";
export { inspectRepositoryCoverage, type RepositoryCoverageRequest } from "./coverage/service.js";
export type { CompletionQuestion } from "./coverage/issues.js";
