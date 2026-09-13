import type { ArchitectureDecision, AuthorityRecord } from "@projector/core";
import type { ExternalGovernanceValidatorFinding } from "@projector/engine";
import type { StateDigest } from "@projector/core";
import type { assessKnowledgeApplicationEvidence } from "../knowledge/application-evidence.js";
import type { DecisionBaselineEvidence } from "../knowledge/decision-baselines.js";
import type { KnowledgeValidatorRequest } from "../knowledge/validators.js";
import type { RepositoryImpactSnapshot, RepositoryImpactReference } from "../impact/service.js";
import type { RepositoryContinuationRequest, RepositoryContinuation } from "../coverage/continuation.js";

export interface KnowledgeComputeHost {
  continuation(request: RepositoryContinuationRequest): Promise<RepositoryContinuation>;
  baseline(decision: ArchitectureDecision, authority: AuthorityRecord): Promise<DecisionBaselineEvidence>;
  validators(requests: readonly KnowledgeValidatorRequest[]): Promise<{ findings: ExternalGovernanceValidatorFinding[]; executed: boolean }>;
  applicationEvidence(ownerIds: readonly string[]): ReturnType<typeof assessKnowledgeApplicationEvidence>;
  freshState(): Promise<StateDigest>;
  readImpact(reference: RepositoryImpactReference): Promise<RepositoryImpactSnapshot>;
  stageImpact(snapshot: RepositoryImpactSnapshot): void;
}
export type KnowledgeHostRequest =
  | { type: "coverage-continuation"; request: RepositoryContinuationRequest }
  | { type: "baseline"; decision: ArchitectureDecision; authority: AuthorityRecord }
  | { type: "validators"; requests: readonly KnowledgeValidatorRequest[] }
  | { type: "application-evidence"; ownerIds: readonly string[] }
  | { type: "fresh-state" }
  | { type: "read-impact"; reference: RepositoryImpactReference };
