# Plans, Revisions, and Rebase

## Cleanup plans, immutable revisions, and rebase

Every audit, completion, migration, or interrupted semantic transaction MUST be able to emit a resumable cleanup/continuation plan.

Plans are immutable revisions. A revised plan receives a new revision identity rather than mutating a plan that prior approvals or packets reference.

```ts
export interface PlanCheckpoint {
  id: EntityId;
  afterPacketIds: EntityId[];
  requiredValidators: string[];
  rollback: RollbackSpec;
}

export interface ExecutionPlan {
  id: EntityId;
  revision: number;
  supersedesPlanId?: EntityId;
  semanticChangeId?: EntityId;
  sourceRunId: EntityId;
  boundState: StateBinding;
  relevanceClosureId?: EntityId;
  predictedImpactClosureHash?: ContentHash;
  boundary: string[];
  assumptions: string[];
  knownAffectedUnitIds: EntityId[];
  possibleFrontierUnitIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
  packetIds: EntityId[];
  checkpoints: PlanCheckpoint[];
  completionCriteria: CompletionContract;
  recommendedNextChunk?: string;
}
```

A plan MUST support partial execution without violating dependency integrity.

Resuming a plan against changed repository/canonical/toolchain/external snapshot state requires an explicit refresh/rebase step that:

1. Recomputes the global `StateDigest` and validates/rebinds the plan `StateBinding`.
2. Determines which assumptions/closures remain valid.
3. Recompiles stale capsules/packets.
4. Carries forward already-proven completed work where still valid.
5. Emits a new immutable plan revision.
6. Invalidates stale approvals.

If the global snapshot changed but all bound dependencies and query fingerprints remain current, Projector MAY perform a lightweight rebind. The rebind emits a new immutable plan revision without recomputing unaffected semantic analysis. This case MUST be distinguishable from a semantic rebase that changes relevance, impact, assumptions, or packets.

The first release does not need automatic semantic Git conflict resolution. Canonical-governance conflicts after branch merge/rebase MUST block Govern/Autonomous execution until explicitly resolved.

---

## Contributions before capture and current continuation

Before an exact proposal exists, the host owns its candidate files. A saved context and content-derived work contract may identify that preparation without creating another SemanticChange or managed workflow store. Missing pre-capture files are unavailable evidence, not proof that preparation completed.

Capture imports frozen contributions and joins them into an exact proposal. The strict versioned proposal includes complete contribution-envelope hashes and the join contract/result digest. These contribute to proposal and SemanticChange identity and the approved plan input-evidence digest. Equal edits/state with different admitted evidence MUST produce different capture/plan identities.

Required predecessor absence, hash/version mismatch, stale value/query input, and unresolved shared-contract conflict prevent readiness. Optional omission remains visible. Disjoint paths alone do not establish semantic independence. Changed joined content requires a new capture and approval. A predecessor-capture link is provenance only.

Continuation is derived from current context and authenticated lifecycle evidence. Carry forward useful work only while its bindings hold. Recover prior transactions before new mutation. Native pre-capture scheduling, automatic semantic merge and general partial multi-packet commits remain future capabilities, not assumptions of this bounded contribution path.
