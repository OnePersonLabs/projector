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

Allowed-write verification MUST use the capsule's operation-aware, fail-closed authorization contract. The coordinator MUST reject an unenforceable or ungranted operation before it invokes an effect. It MUST retain the authenticated plan boundary and compiled capsule authorization from one immutable preflight snapshot. It MUST NOT read or compile authority again from caller-owned objects after a port or effect can run.

After the effect, it MUST authorize the authoritative observed path set with that same snapshot. A scope violation MUST prevent commit and enter rollback or recovery-required handling. The effect's claimed path list is not authority evidence.

Merge/rebase conflicts in canonical governance state MUST block Govern/Autonomous execution. No automatic semantic merge is required for 1.x.

---

## Public repository change lifecycle

`SemanticChange.id` is the only change identity for the installed local lifecycle. Projector MUST store authenticated captures, approvals, attempts, prepared-success records, and results under `.projector/runtime/change-lifecycles/`. These records are operational evidence and MUST remain outside canonical semantic snapshots. Agent wrappers MUST NOT create a second continuation or transaction authority.

The public lifecycle is `change` to `plan` to `approve` to `apply`. `change` captures the request and strict proposal. `plan` reauthenticates the capture and emits one immutable plan hash plus preview. `approve` requires the exact human-presented plan hash and persists a plan/capsule-bound approval. `apply` accepts only that approval identity. General permission, a change selector, or a similar hash MUST NOT substitute for exact approval.

Before a mutation, Projector MUST select a capability-proven sandbox and capture immutable validator projections. If isolation or immutable overlays are unavailable, Projector MUST stop before it takes the writer lease or starts the journal. It MUST NOT run a validator natively.

Each apply attempt MUST have a durable unique identity and transaction identity. The writer lease heartbeat MUST remain active from transaction start through every mutation, validation, checkpoint, commit, or rollback. The coordinator MUST reassert lease ownership at each authoritative transition.

After mutation, Projector MUST authenticate a new repository observation. It MUST compare predicted and observed paths, canonical entities, unit states, and analyzer failures. Unexpected paths, canonical identities, or failures become Planning Surprises or unknowns and MUST block success. Claimed transform output is not observed-impact evidence.

Projector MUST run each independent validator from immutable Git-base bytes overlaid at its original repository path. The validator runs against the proposed repository state with read-only source identity. Projector MUST record expected, before, after, and executed content hashes plus the selected sandbox evidence.

Before commit, Projector MUST persist one authenticated prepared-success record that binds the after-state observation, validations, certificate, receipt, and journal checkpoint. It then checkpoints the journal, commits the transaction, and publishes artifacts. Recovery MAY finalize a committed journal only when that journal binds the authenticated prepared-success identity. A committed journal without that proof enters `recovery-required`.

After an interruption, `recover` MUST take or safely replace the stale writer lease. Recovery MUST be scoped by an authenticated approval-to-attempt-to-journal binding. It MUST NOT inspect, roll back, or finalize another approval's transaction. An incomplete governed transaction MUST block a new attempt until recovery resolves it. Recovery MUST restore exact snapshots in reverse order or report `recovery-required` when live content is a third state. `resume` MUST recover first and then create a new attempt under the same still-current approval.

Repeating a successful approval MUST return the same authenticated certificate and receipt after it reauthenticates the prepared record, journal, and artifacts. A failure after journal commit MUST preserve a typed committed-but-unpublished attempt for idempotent publication. It MUST NOT rerun the committed mutation.

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
