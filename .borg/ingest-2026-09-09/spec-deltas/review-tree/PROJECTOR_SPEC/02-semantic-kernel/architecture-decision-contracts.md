# Architecture Decision Contracts

## Architecture concern, decision, preference, and governance-basis contracts

```ts
export type ConcernMateriality = "blocking-now" | "material-soon" | "deferable";

export interface ConcernActivationReason {
  kind:
    | "requirement-delta"
    | "scenario-delta"
    | "relevance-discovery"
    | "planning-surprise"
    | "constraint-delta"
    | "surface-added"
    | "scale-signal"
    | "pattern-friction"
    | "decision-trigger"
    | "research"
    | "user-request"
    | "inference";
  subjectIds: Array<EntityId | string>;
  explanation: string;
  causalOrigin: CausalOrigin;
}

export interface DecisionDeferral {
  rationale: string;
  preserveOptionality: string[];
  forbiddenCommitments: string[];
  reconsiderWhen: AuthorityReconsiderTrigger[];
  reviewBy?: string;
}

export interface ArchitectureConcern {
  id: EntityId;
  key: string;
  title: string;
  question: string;
  scope: SelectorExpr;
  sourceClass: SourceClass;
  status: "candidate" | "active" | "deferred" | "resolved" | "dismissed" | "superseded";
  materiality: ConcernMateriality;
  activationReasons: ConcernActivationReason[];
  relatedConceptIds: EntityId[];
  relatedRequirementIds: EntityId[];
  relevanceClosureId?: EntityId;
  decisionIds: EntityId[];
  deferral?: DecisionDeferral;
  evidence: EvidenceRef[];
  semanticHash: ContentHash;
}

export interface DecisionConsequence {
  kind:
    | "activate-governance"
    | "deactivate-governance"
    | "introduce-constraint"
    | "retire-constraint"
    | "select-technology"
    | "deprecate-technology"
    | "require-migration"
    | "activate-concern"
    | "constrain-decision"
    | "advisory";
  targetId?: EntityId;
  scope?: SelectorExpr;
  payload?: Record<string, unknown>;
  explanation: string;
}

export interface AppliedPreferenceRef {
  key: string;
  scope: "user" | "organization" | "project";
  semanticHash: ContentHash;
  influence: string;
}

export interface ArchitectureDecision {
  id: EntityId;
  key: string;
  concernId: EntityId;
  title: string;
  decision: string;
  selectedOptionKey: string;
  scope: SelectorExpr;
  lifecycle: "active" | "superseded" | "retired";
  authorityRecordId: EntityId;
  governanceBasis: GovernanceBasis[];
  consequences: DecisionConsequence[];
  appliedPreferences: AppliedPreferenceRef[];
  supersedesDecisionIds: EntityId[];
  migrationId?: EntityId;
  semanticHash: ContentHash;
}

export interface DecisionOption {
  key: string;
  title: string;
  description: string;
  hardConstraintStatus: "passes" | "fails" | "unknown";
  tradeoffs: string[];
  evidence: EvidenceRef[];
  preferenceFit: AppliedPreferenceRef[];
}

export interface DecisionEvaluation {
  id: EntityId;
  concernId: EntityId;
  scope: SelectorExpr;
  options: DecisionOption[];
  eliminatedOptionKeys: string[];
  recommendedOptionKey?: string;
  outcome: "recommended" | "contested" | "insufficient-evidence";
  hardConstraints: EntityId[];
  preferenceSnapshotHash: ContentHash;
  researchEvidenceIds: EntityId[];
  unknowns: string[];
  evaluatedAt: string;
  semanticHash: ContentHash;
}

export interface DecisionValidityAssessment {
  decisionId: EntityId;
  scope: SelectorExpr;
  state: "valid" | "suspect" | "contested" | "invalid-for-scope";
  firedTriggers: AuthorityReconsiderTrigger[];
  invalidatedAssumptions: string[];
  staleEvidenceIds: EntityId[];
  blocksCurrentChange: boolean;
  explanation: string;
}

export interface DeveloperPreference {
  id: EntityId;
  key: string;
  scope: "user" | "organization" | "project";
  selector: SelectorExpr;
  strength: "prefer" | "strongly-prefer" | "avoid";
  statement: string;
  rationale?: string;
  status: "active" | "retired";
  sourceClass: SourceClass;
  semanticHash: ContentHash;
}

export type GovernanceBasis =
  | { kind: "architecture-decision"; decisionId: EntityId }
  | { kind: "hard-constraint"; conceptId: EntityId }
  | { kind: "adopted-standard"; authorityRecordId: EntityId }
  | { kind: "migration-overlay"; migrationId: EntityId }
  | { kind: "host-safety"; key: string }
  | { kind: "active-lens"; lensId: EntityId };
```

Candidate concerns and `DecisionEvaluation` artifacts are derived/inferred by default. A concern becomes canonical only when it has a durable material disposition. `ArchitectureDecision` is the complete canonical schema for `.projector/decisions/*.decision.json`. This closes the decision-document contract explicitly.

A `DeveloperPreference` MUST NOT compile directly into a blocking rule. If a preference must govern, Projector creates or accepts an explicit constraint/decision whose authority can be reviewed independently.


