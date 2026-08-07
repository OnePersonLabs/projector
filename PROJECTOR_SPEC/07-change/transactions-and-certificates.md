# Work Packets, Transactions, and Certificates

## Work packets, writer coordination, and crash-consistent transactions

Parallel workers MAY inspect, research, validate, or prepare isolated patches. One transaction coordinator owns final mutation of a worktree and canonical Projector state.

```ts
export interface WorkPacket {
  id: EntityId;
  planId: EntityId;
  title: string;
  strategy: RepairStrategy;
  unitIds: EntityId[];
  dependencies: EntityId[];
  capsuleId: EntityId;
  risk: RiskAssessment;
  executionMode: "deterministic" | "agent" | "manual" | "external";
  transformId?: string;
  validatorIds: string[];
  rollback: RollbackSpec;
  boundState: StateBinding;
  status: "pending" | "running" | "succeeded" | "failed" | "blocked" | "skipped";
}
```

## Writer lease

There is at most one writer lease per governed worktree. The lease MUST include process/session identity, acquisition time, the relevant `StateBinding` plus compiled-against snapshot identity, heartbeat or stale-lock recovery information, and explicit release.

Isolated worktrees MAY host parallel write-heavy packets, but each has its own lease. Workers MUST NOT directly write canonical authority/lens/rule state. They return proposed deltas for coordinator integration.

## Transaction journal

```ts
export type TransactionPhase =
  | "prepared"
  | "workspace-mutating"
  | "workspace-staged"
  | "validating"
  | "canonical-staging"
  | "committing"
  | "committed"
  | "rolling-back"
  | "rolled-back"
  | "recovery-required";

export interface TransactionJournalEntry {
  transactionId: EntityId;
  planId: EntityId;
  phase: TransactionPhase;
  beforeState: StateDigest;
  intendedAfterCanonicalDigest?: ContentHash;
  worktreePath: string;
  checkpointIds: string[];
  touchedPaths: string[];
  externalOperationIds: string[];
  updatedAt: string;
}
```

Startup MUST scan for incomplete journals and deterministically choose recovery, rollback, or explicit human intervention. SQLite atomicity alone is not sufficient because repository files, Git index, external operations, and canonical Projector files participate in the transaction.

## Integration rules

Before integrating a packet:

1. Verify allowed write scope.
2. Validate the packet/capsule `StateBinding` against current dependency hashes and bound query-result fingerprints. A changed global snapshot alone does not prove staleness.
3. Refresh/recompile if relevant state changed.
4. Run required validators with declared side-effect policy.
5. Serialize overlapping semantic ownership.
6. Reconcile the combined diff.
7. Checkpoint before any nontrivial next stage.

Merge/rebase conflicts in canonical governance state MUST block Govern/Autonomous execution. No automatic semantic merge is required for 1.x.

---


## Transaction receipts and change certificates

Projector separates the compact committed durability record from verbose local audit output.

## Transaction receipt

```ts
export interface TransactionReceipt {
  id: EntityId;
  planId: EntityId;
  semanticChangeId?: EntityId;
  riskClass: RiskClass;
  beforeState: StateDigest;
  afterState: StateDigest;
  changedCanonicalEntityIds: EntityId[];
  changedRequirementIds: EntityId[];
  changedScenarioIds: EntityId[];
  changedUnitIds: EntityId[];
  validationSummaryHash: ContentHash;
  certificateHash?: ContentHash;
  rollbackRef?: string;
  createdAt: string;
  semanticHash: ContentHash;
}
```

R2+ semantic/governance transactions MUST commit a receipt under `.projector/receipts/`. R1 receipts are repository-policy configurable. Ordinary scans/observations do not create committed receipts.

## Change certificate

```ts
export interface ChangeCertificate {
  id: EntityId;
  planId: EntityId;
  baseGitRevision?: string;
  resultingGitRevision?: string;
  semanticChange?: SemanticChange;
  relevanceClosureHash?: ContentHash;
  predictedImpactClosureHash?: ContentHash;
  observedImpactClosureHash?: ContentHash;
  beforeState: StateDigest;
  afterState?: StateDigest;
  changedConcepts: EntityId[];
  changedRequirements: EntityId[];
  changedScenarios: EntityId[];
  changedRelations: EntityId[];
  changedUnits: EntityId[];
  planningSurpriseIds: EntityId[];
  deterministicOperations: OperationEvidence[];
  agentOperations: OperationEvidence[];
  validations: ValidationResult[];
  divergencesResolved: EntityId[];
  divergencesIntroduced: EntityId[];
  modeledBoundary: string[];
  completeness: "proven-within-boundary" | "bounded" | "high-confidence" | "partial" | "not-established";
  unknowns: string[];
  unavailableActions: string[];
  rollback: RollbackSpec[];
  createdAt: string;
}
```

Every applied plan MUST produce a certificate, including a failed/partially applied plan. Failure produces a failure certificate with last durable checkpoint and recovery state. Certificates are ignored by default but MUST remain exportable, content-addressable, and linkable from receipts and Git commits.

---


