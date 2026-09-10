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

## Host preparation and current continuation

The host owns candidate notes and files before exact capture. The coordinator resolves shared contracts and observes the combined result before submitting one concrete proposal. Disjoint paths and worker success do not prove semantic compatibility. Missing required investigation remains explicit.

The existing proposal, plan, approval, and currentness contracts govern accepted mutation. Reconcile saved value/query dependencies before reuse, including relevant dirty edits and changed empty-query membership. Refresh affected reasoning without discarding independently current work.

Derive bounded continuation from saved context, plans, approvals, attempts, recovery state, and current evidence. Report missing local artifacts as unavailable. No new contribution importer, approval hash profile, scheduler, or mutable completion store is required for this host-owned workflow.
