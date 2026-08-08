import { canonicalJson, hashFramedDomain, type ContentHash, type EntityId, type ExecutionPlan, type StateBinding, type StateBindingValidation } from "@projector/core";
import { createExecutionPlan } from "./index.js";

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export interface PlanRevisionStore {
  get(id: EntityId): Promise<Readonly<ExecutionPlan> | undefined>;
  put(plan: Readonly<ExecutionPlan>): Promise<void>;
}

export class InMemoryPlanRevisionStore implements PlanRevisionStore {
  private readonly plans = new Map<EntityId, Readonly<ExecutionPlan>>();
  async get(id: EntityId): Promise<Readonly<ExecutionPlan> | undefined> { return this.plans.get(id); }
  async put(plan: Readonly<ExecutionPlan>): Promise<void> {
    const prior = this.plans.get(plan.id);
    if (prior !== undefined && canonicalJson(prior) !== canonicalJson(plan)) throw new Error(`plan revision ${plan.id} already exists with different content`);
    this.plans.set(plan.id, plan);
  }
}

export interface RecompiledPlanFields {
  readonly boundState?: StateBinding;
  readonly packetIds?: readonly EntityId[];
  readonly assumptions?: readonly string[];
  readonly relevanceClosureId?: EntityId;
  readonly predictedImpactClosureHash?: ContentHash;
  readonly recompiledCapsuleIds?: readonly EntityId[];
}

export interface RebaseExecutionPlanInput {
  readonly original: Readonly<ExecutionPlan>;
  readonly validation: StateBindingValidation;
  readonly completedPackets: readonly EntityId[];
  readonly isCompletedPacketCurrent: (packetId: EntityId) => Promise<boolean>;
  readonly recompile: () => Promise<RecompiledPlanFields>;
  readonly capsuleIdsByPacket?: Readonly<Record<EntityId, EntityId>>;
}

export interface RebasedExecutionPlan {
  readonly kind: "lightweight-rebind" | "semantic-rebase";
  readonly plan: Readonly<ExecutionPlan>;
  readonly carriedCompletedPacketIds: EntityId[];
  readonly invalidatedPacketIds: EntityId[];
  readonly invalidatedApprovalPlanIds: EntityId[];
  readonly invalidatedCapsuleIds: EntityId[];
  readonly recompiledCapsuleIds: EntityId[];
}

export async function rebaseExecutionPlan(input: RebaseExecutionPlanInput): Promise<RebasedExecutionPlan> {
  if (input.validation.status === "suspect" || input.validation.status === "unavailable") throw new Error(`plan cannot be safely rebased from ${input.validation.status} state`);
  const lightweight = input.validation.status === "current" || input.validation.status === "rebound";
  const rebound = input.validation.rebound ?? input.original.boundState;
  const recomputed = lightweight ? {} : await input.recompile();
  if (!lightweight && recomputed.boundState === undefined) throw new Error("semantic rebase must provide a recomputed state binding");
  const nextPacketIds = recomputed.packetIds ?? input.original.packetIds;
  const carried: EntityId[] = [];
  for (const packetId of unique(input.completedPackets)) {
    if (nextPacketIds.includes(packetId) && await input.isCompletedPacketCurrent(packetId)) carried.push(packetId);
  }
  const invalidated = unique(input.completedPackets).filter((id) => !carried.includes(id));
  const revision = input.original.revision + 1;
  const { recompiledCapsuleIds = [], ...planFields } = recomputed;
  const fields = {
    ...input.original,
    ...planFields,
    revision,
    supersedesPlanId: input.original.id,
    boundState: recomputed.boundState ?? rebound,
    packetIds: recomputed.packetIds ?? input.original.packetIds,
    assumptions: recomputed.assumptions ?? input.original.assumptions,
  };
  const identity = hashFramedDomain("execution-plan-revision-id", { ...fields, id: undefined });
  const plan = createExecutionPlan({ ...fields, id: `plan:${identity}` });
  return {
    kind: lightweight ? "lightweight-rebind" : "semantic-rebase", plan,
    carriedCompletedPacketIds: carried, invalidatedPacketIds: invalidated,
    invalidatedApprovalPlanIds: [input.original.id],
    invalidatedCapsuleIds: unique(invalidated.flatMap((packetId) => {
      const capsuleId = input.capsuleIdsByPacket?.[packetId];
      return capsuleId === undefined ? [] : [capsuleId];
    })),
    recompiledCapsuleIds: unique(recompiledCapsuleIds),
  };
}
