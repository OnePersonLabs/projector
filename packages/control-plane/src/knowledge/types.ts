import {
  AnalyzerCapabilitiesSchema,
  AnalyzerFailureSchema,
  ContentHashSchema,
  AuthorityReconsiderTriggerSchema,
  DecisionValidityAssessmentSchema,
  NormalizedPredicateSchema,
  RelevanceClosureSchema,
  StateBindingSchema,
  StateBindingValidationSchema,
  StateDigestSchema,
  type AnalyzerCapabilities,
  type AnalyzerFailure,
  type ContentHash,
  type AuthorityReconsiderTrigger,
  type DecisionValidityAssessment,
  type NormalizedPredicate,
  type RelevanceClosure,
  type StateBinding,
  type StateBindingValidation,
  type StateDigest,
} from "@projector/core";
import type { CompiledSemanticContext, GovernanceBundleEvaluation, RelevanceMetrics } from "@projector/engine";
import { z } from "zod";
import { RepositoryImpactReferenceSchema, RepositoryImpactReportSchema, type RepositoryImpactReference, type RepositoryImpactReport } from "../impact/service.js";
import { KnowledgeApplicationEvidenceAssessmentSchema, type KnowledgeApplicationEvidenceAssessment } from "./application-evidence.js";

export const KNOWLEDGE_API_VERSION = "projector.knowledge/v1" as const;

export type KnowledgeEntityKind =
  | "concept"
  | "requirement"
  | "scenario"
  | "architecture-decision"
  | "architecture-concern"
  | "developer-preference"
  | "projection-unit"
  | "projection-lens";

export interface KnowledgeContextPolicy {
  readonly maxCandidates?: number;
  readonly maxEntries?: number;
  readonly maxDepth?: number;
  readonly maxTraversalCost?: number;
  readonly minimumScore?: number;
  readonly maxContextCost?: number;
}

export interface KnowledgeContextRequest {
  readonly request: string;
  readonly view?: "agent" | "full";
  /** Stable IDs, canonical keys, or accepted aliases supplied as explicit addresses. */
  readonly entities?: readonly string[];
  readonly namedTargets?: readonly string[];
  readonly operation?: string;
  readonly persist?: boolean;
  readonly policy?: KnowledgeContextPolicy;
  readonly signal?: AbortSignal;
}

export type KnowledgeCandidateSignal = "id" | "key" | "alias" | "lexical" | "lineage" | "tombstone";

export interface KnowledgeInterpretationCandidate {
  readonly entityId: string;
  readonly entityKind: KnowledgeEntityKind;
  readonly score: number;
  readonly direct: boolean;
  readonly signals: readonly KnowledgeCandidateSignal[];
  readonly explanation: string;
  readonly continuityFromIds: readonly string[];
}

export interface KnowledgeInterpretation {
  readonly status: "direct" | "candidates" | "unresolved";
  readonly candidates: readonly KnowledgeInterpretationCandidate[];
  readonly unknowns: readonly string[];
}

export interface KnowledgeLensObligation {
  readonly lensId: string;
  readonly lensVersion: string;
  readonly lensSemanticHash: ContentHash;
  readonly authorityRecordId: string;
  readonly unitId: string;
  readonly membershipFingerprint: ContentHash;
  readonly applicabilityFingerprint: ContentHash;
  readonly ruleIds: readonly string[];
  readonly predicates: readonly NormalizedPredicate[];
  readonly validatorIds: readonly string[];
  readonly expectationKinds: readonly string[];
  readonly status: "applicable" | "unknown";
  readonly unknowns: readonly string[];
}

export interface KnowledgeContextBranch {
  readonly id: string;
  readonly interpretation: KnowledgeInterpretationCandidate;
  readonly hypothesis: boolean;
  readonly closure: RelevanceClosure;
  readonly context: CompiledSemanticContext;
  readonly metrics: RelevanceMetrics;
  readonly frontier: readonly string[];
  readonly lensObligations: readonly KnowledgeLensObligation[];
  readonly decisionValidity?: readonly KnowledgeDecisionValidity[];
  readonly governanceEvaluations?: readonly GovernanceBundleEvaluation[];
  readonly applicationEvidence: readonly KnowledgeApplicationEvidenceAssessment[];
  readonly sourceFingerprint: ContentHash;
  readonly semanticFingerprint: ContentHash;
  readonly queryFingerprint: ContentHash;
}

export interface KnowledgeDecisionCheck {
  readonly trigger: AuthorityReconsiderTrigger;
  readonly status: "current" | "fired" | "unknown" | "unobserved";
  readonly reason: string;
}

export interface KnowledgeDecisionValidity {
  readonly decisionId: string;
  readonly authorityId: string;
  readonly baseline: { readonly kind: "authenticated-transaction" | "tracked-git-history" | "unavailable"; readonly reference?: string; readonly reason?: string };
  readonly checks: readonly KnowledgeDecisionCheck[];
  readonly assessment: DecisionValidityAssessment;
  readonly contentHash: ContentHash;
}

export interface KnowledgeContextResult {
  readonly impactBaseline?: RepositoryImpactReference;
  readonly apiVersion: typeof KNOWLEDGE_API_VERSION;
  readonly id: string;
  readonly request: string;
  readonly requestFingerprint: ContentHash;
  readonly operation: string;
  readonly requestOptions: {
    readonly entities: readonly string[];
    readonly namedTargets: readonly string[];
    readonly operation: string;
    readonly policy: Required<KnowledgeContextPolicy>;
  };
  readonly capturedState: StateDigest;
  readonly discoveryBinding: StateBinding;
  readonly interpretation: KnowledgeInterpretation;
  readonly branches: readonly KnowledgeContextBranch[];
  readonly analyzerCapabilities: readonly AnalyzerCapabilities[];
  readonly analyzerFailures: readonly AnalyzerFailure[];
  readonly unknowns: readonly string[];
  readonly persisted: boolean;
  readonly contentHash: ContentHash;
}

export interface KnowledgeReconciliationBranch {
  readonly branchId: string;
  readonly validation: StateBindingValidation;
}

export interface KnowledgeGovernanceReconciliationBranch {
  readonly interpretationEntityId: string;
  readonly retainedBranchId?: string;
  readonly currentBranchId?: string;
  readonly status: "conformant" | "violated" | "unknown" | "not-applicable";
  readonly evaluations: readonly GovernanceBundleEvaluation[];
  readonly decisionValidity?: readonly KnowledgeDecisionValidity[];
  readonly reasons: readonly string[];
}

export interface KnowledgeGovernanceReconciliation {
  readonly status: "conformant" | "violated" | "unknown" | "not-applicable";
  readonly regeneratedContextId: string;
  readonly branches: readonly KnowledgeGovernanceReconciliationBranch[];
  readonly reasons: readonly string[];
}

export interface KnowledgeReconciliationResult {
  readonly impact?: RepositoryImpactReport;
  readonly apiVersion: typeof KNOWLEDGE_API_VERSION;
  readonly contextId: string;
  readonly capturedState: StateDigest;
  readonly currentState: StateDigest;
  readonly status: StateBindingValidation["status"];
  readonly discoveryValidation: StateBindingValidation;
  readonly branches: readonly KnowledgeReconciliationBranch[];
  readonly governance: KnowledgeGovernanceReconciliation;
  readonly applicationEvidence: {
    readonly status: "satisfied" | "violated" | "unknown" | "not-applicable";
    readonly branches: readonly { readonly branchId: string; readonly status: "satisfied" | "violated" | "unknown" | "not-applicable"; readonly changed: boolean; readonly reasons: readonly string[] }[];
  };
  readonly reasons: readonly string[];
  readonly contentHash: ContentHash;
}

const candidateSignalSchema = z.enum(["id", "key", "alias", "lexical", "lineage", "tombstone"]);
export const KnowledgeInterpretationCandidateSchema: z.ZodType<KnowledgeInterpretationCandidate> = z.strictObject({
  entityId: z.string().min(1),
  entityKind: z.enum(["concept", "requirement", "scenario", "architecture-decision", "architecture-concern", "developer-preference", "projection-unit", "projection-lens"]),
  score: z.number().min(0).max(1).finite(),
  direct: z.boolean(),
  signals: z.array(candidateSignalSchema),
  explanation: z.string(),
  continuityFromIds: z.array(z.string()),
});

export const KnowledgeInterpretationSchema: z.ZodType<KnowledgeInterpretation> = z.strictObject({
  status: z.enum(["direct", "candidates", "unresolved"]),
  candidates: z.array(KnowledgeInterpretationCandidateSchema),
  unknowns: z.array(z.string()),
});

export const KnowledgeLensObligationSchema = z.strictObject({
  lensId: z.string(),
  lensVersion: z.string(),
  lensSemanticHash: ContentHashSchema,
  authorityRecordId: z.string(),
  unitId: z.string(),
  membershipFingerprint: ContentHashSchema,
  applicabilityFingerprint: ContentHashSchema,
  ruleIds: z.array(z.string()),
  predicates: z.array(NormalizedPredicateSchema),
  validatorIds: z.array(z.string()),
  expectationKinds: z.array(z.string()),
  status: z.enum(["applicable", "unknown"]),
  unknowns: z.array(z.string()),
}) as unknown as z.ZodType<KnowledgeLensObligation>;

const relevanceMetricsSchema: z.ZodType<RelevanceMetrics> = z.strictObject({
  consideredEdgeCount: z.number().int().nonnegative(),
  includedEdgeCount: z.number().int().nonnegative(),
  duplicateEdgeCount: z.number().int().nonnegative(),
  belowThresholdEdgeCount: z.number().int().nonnegative(),
  budgetDeferredEdgeCount: z.number().int().nonnegative(),
  frontierCount: z.number().int().nonnegative(),
  irrelevantExpansionRate: z.number().min(0).max(1).finite(),
  closureSize: z.number().int().nonnegative(),
});

export const compiledContextSchema = z.strictObject({
  sourceClosureId: z.string(),
  items: z.array(z.strictObject({
    entityId: z.string(),
    sourceSemanticHash: ContentHashSchema,
    kind: z.enum(["concept", "requirement", "scenario", "decision", "projection-unit", "other"]),
    band: z.enum(["direct", "governing", "consequence", "possible"]),
    disclosure: z.enum(["full", "summary", "identity"]),
    content: z.string(),
    relevanceScore: z.number().finite(),
    relevanceReasons: z.array(z.string()),
    uncertainty: z.array(z.string()),
    confidence: z.number().finite(),
  })),
  unknowns: z.array(z.string()),
  estimatedCost: z.number().nonnegative(),
  requiredBudgetOverrun: z.number().nonnegative(),
  requiredExpansionIds: z.array(z.string()),
  contentHash: ContentHashSchema,
});

export const KnowledgeDecisionValiditySchema = z.strictObject({
  decisionId: z.string(), authorityId: z.string(),
  baseline: z.strictObject({ kind: z.enum(["authenticated-transaction", "tracked-git-history", "unavailable"]), reference: z.string().optional(), reason: z.string().optional() }),
  checks: z.array(z.strictObject({ trigger: AuthorityReconsiderTriggerSchema, status: z.enum(["current", "fired", "unknown", "unobserved"]), reason: z.string() })),
  assessment: DecisionValidityAssessmentSchema,
  contentHash: ContentHashSchema,
}) as unknown as z.ZodType<KnowledgeDecisionValidity>;

export const governanceEvaluationSchema = z.strictObject({
  unitId: z.string(), status: z.enum(["conformant", "violated", "unknown"]),
  findings: z.array(z.strictObject({ id: z.string(), unitId: z.string(), ruleId: z.string(), predicateHash: ContentHashSchema,
    status: z.enum(["satisfied", "violated", "unknown"]), reason: z.string(), evidenceIds: z.array(z.string()) })),
  boundary: z.array(z.string()), observationHash: ContentHashSchema, contentHash: ContentHashSchema,
});

export const KnowledgeContextBranchSchema = z.strictObject({
  id: z.string(),
  interpretation: KnowledgeInterpretationCandidateSchema,
  hypothesis: z.boolean(),
  closure: RelevanceClosureSchema,
  context: compiledContextSchema,
  metrics: relevanceMetricsSchema,
  frontier: z.array(z.string()),
  lensObligations: z.array(KnowledgeLensObligationSchema),
  decisionValidity: z.array(KnowledgeDecisionValiditySchema).optional(),
  governanceEvaluations: z.array(governanceEvaluationSchema).optional(),
  applicationEvidence: z.array(KnowledgeApplicationEvidenceAssessmentSchema),
  sourceFingerprint: ContentHashSchema,
  semanticFingerprint: ContentHashSchema,
  queryFingerprint: ContentHashSchema,
}) as unknown as z.ZodType<KnowledgeContextBranch>;

export const KnowledgeContextResultSchema = z.strictObject({
  impactBaseline: RepositoryImpactReferenceSchema.optional(),
  apiVersion: z.literal(KNOWLEDGE_API_VERSION),
  id: z.string(),
  request: z.string(),
  requestFingerprint: ContentHashSchema,
  operation: z.string(),
  requestOptions: z.strictObject({
    entities: z.array(z.string()),
    namedTargets: z.array(z.string()),
    operation: z.string(),
    policy: z.strictObject({
      maxCandidates: z.number().int().positive(),
      maxEntries: z.number().int().positive(),
      maxDepth: z.number().int().nonnegative(),
      maxTraversalCost: z.number().nonnegative(),
      minimumScore: z.number().min(0).max(1),
      maxContextCost: z.number().nonnegative(),
    }),
  }),
  capturedState: StateDigestSchema,
  discoveryBinding: StateBindingSchema,
  interpretation: KnowledgeInterpretationSchema,
  branches: z.array(KnowledgeContextBranchSchema),
  analyzerCapabilities: z.array(AnalyzerCapabilitiesSchema),
  analyzerFailures: z.array(AnalyzerFailureSchema),
  unknowns: z.array(z.string()),
  persisted: z.boolean(),
  contentHash: ContentHashSchema,
}) as unknown as z.ZodType<KnowledgeContextResult>;

export const KnowledgeReconciliationResultSchema = z.strictObject({
  impact: RepositoryImpactReportSchema.optional(),
  apiVersion: z.literal(KNOWLEDGE_API_VERSION),
  contextId: z.string(),
  capturedState: StateDigestSchema,
  currentState: StateDigestSchema,
  status: z.enum(["current", "rebound", "stale", "suspect", "unavailable"]),
  discoveryValidation: StateBindingValidationSchema,
  branches: z.array(z.strictObject({ branchId: z.string(), validation: StateBindingValidationSchema })),
  governance: z.strictObject({
    status: z.enum(["conformant", "violated", "unknown", "not-applicable"]),
    regeneratedContextId: z.string(),
    branches: z.array(z.strictObject({
      interpretationEntityId: z.string(),
      retainedBranchId: z.string().optional(),
      currentBranchId: z.string().optional(),
      decisionValidity: z.array(KnowledgeDecisionValiditySchema).optional(),
      status: z.enum(["conformant", "violated", "unknown", "not-applicable"]),
      evaluations: z.array(z.strictObject({
        unitId: z.string(),
        status: z.enum(["conformant", "violated", "unknown"]),
        findings: z.array(z.strictObject({
          id: z.string(),
          unitId: z.string(),
          ruleId: z.string(),
          predicateHash: ContentHashSchema,
          status: z.enum(["satisfied", "violated", "unknown"]),
          reason: z.string(),
          evidenceIds: z.array(z.string()),
        })),
        boundary: z.array(z.string()),
        observationHash: ContentHashSchema,
        contentHash: ContentHashSchema,
      })),
      reasons: z.array(z.string()),
    })),
    reasons: z.array(z.string()),
  }),
  applicationEvidence: z.strictObject({
    status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]),
    branches: z.array(z.strictObject({ branchId: z.string(), status: z.enum(["satisfied", "violated", "unknown", "not-applicable"]), changed: z.boolean(), reasons: z.array(z.string()) })),
  }),
  reasons: z.array(z.string()),
  contentHash: ContentHashSchema,
}) as unknown as z.ZodType<KnowledgeReconciliationResult>;
