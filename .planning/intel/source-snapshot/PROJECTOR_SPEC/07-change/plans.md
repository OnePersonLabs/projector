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


