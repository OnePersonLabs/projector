import { canonicalJson, hashFramedDomain, type AdapterContext, type ContentHash, type StateBinding, type StateBindingValidator, type StateDigest } from "@projector/core";

import { createStateBinding } from "../state/index.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export interface CleanupWorkItem { readonly id: string; readonly tokenCost: number; readonly monetaryCost: number }
export interface CleanupCheckpoint { readonly id: string; readonly afterWorkIds: readonly string[]; readonly requiredValidators: readonly string[] }
export interface CleanupExternalAction { readonly id: string; readonly description: string; readonly owner?: string }

export interface CleanupContinuationPlan {
  readonly id: string;
  readonly key: string;
  readonly revision: number;
  readonly supersedesPlanId?: string;
  readonly boundState: StateBinding;
  readonly frontierIds: string[];
  readonly completedWorkIds: string[];
  readonly remainingWork: CleanupWorkItem[];
  readonly checkpoints: CleanupCheckpoint[];
  readonly assumptions: string[];
  readonly externalActions: CleanupExternalAction[];
  readonly approvalIds: string[];
  readonly recommendedNextChunk?: string;
  readonly contentHash: ContentHash;
}

export interface CreateCleanupPlanInput extends Omit<CleanupContinuationPlan, "id" | "contentHash" | "approvalIds"> {
  readonly id?: string;
  readonly approvalIds?: readonly string[];
}

function validateCost(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
}

export function createCleanupPlan(input: CreateCleanupPlanInput): CleanupContinuationPlan {
  if (input.key.trim() === "" || !Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error("cleanup plan key and positive revision are required");
  const binding = createStateBinding(input.boundState);
  if (binding.dependencyDigest !== input.boundState.dependencyDigest) throw new Error("cleanup plan StateBinding is invalid");
  const completedWorkIds = unique(input.completedWorkIds);
  const remaining = new Map<string, CleanupWorkItem>();
  for (const item of input.remainingWork) {
    if (item.id.trim() === "" || completedWorkIds.includes(item.id) || remaining.has(item.id)) throw new Error(`conflicting cleanup work identity ${item.id}`);
    validateCost(item.tokenCost, `${item.id} token cost`); validateCost(item.monetaryCost, `${item.id} monetary cost`);
    remaining.set(item.id, { ...item });
  }
  const fields = {
    key: input.key.trim(), revision: input.revision, ...(input.supersedesPlanId === undefined ? {} : { supersedesPlanId: input.supersedesPlanId }), boundState: binding,
    frontierIds: unique(input.frontierIds), completedWorkIds, remainingWork: [...remaining.values()].sort((a, b) => compare(a.id, b.id)),
    checkpoints: [...input.checkpoints].map((item) => ({ ...item, afterWorkIds: unique(item.afterWorkIds), requiredValidators: unique(item.requiredValidators) })).sort((a, b) => compare(a.id, b.id)),
    assumptions: unique(input.assumptions), externalActions: [...input.externalActions].sort((a, b) => compare(a.id, b.id)), approvalIds: unique(input.approvalIds ?? []),
    ...(input.recommendedNextChunk === undefined ? {} : { recommendedNextChunk: input.recommendedNextChunk }),
  };
  const contentHash = hashFramedDomain("cleanup-continuation-plan", fields);
  return { id: input.id ?? `cleanup_plan_${hashFramedDomain("cleanup-continuation-plan-identity", { key: fields.key, revision: fields.revision, contentHash }).slice(-32)}`, ...fields, contentHash };
}

export interface CleanupPlanStore {
  lookupAuthenticated(selector: string): Promise<readonly Readonly<CleanupContinuationPlan>[]>;
  compareAndStore(expectedRevision: number | undefined, plan: Readonly<CleanupContinuationPlan>): Promise<"stored" | "idempotent" | "conflict">;
  reserve(expectedRevision: number, plan: Readonly<CleanupContinuationPlan>, workIds: readonly string[]): Promise<{ readonly status: "reserved"; readonly reservationId: string } | { readonly status: "conflict" }>;
  commitReservation(reservationId: string, plan: Readonly<CleanupContinuationPlan>): Promise<"stored" | "conflict">;
}

export class InMemoryCleanupPlanStore implements CleanupPlanStore {
  private readonly plans = new Map<string, Readonly<CleanupContinuationPlan>>();
  private readonly reservations = new Map<string, { readonly planId: string; readonly revision: number; readonly workIds: string[] }>();
  async lookupAuthenticated(selector: string): Promise<readonly Readonly<CleanupContinuationPlan>[]> {
    return [...this.plans.values()].filter((plan) => plan.id === selector || plan.key === selector).map((plan) => structuredClone(plan)).sort((a, b) => b.revision - a.revision);
  }
  async compareAndStore(expectedRevision: number | undefined, plan: Readonly<CleanupContinuationPlan>): Promise<"stored" | "idempotent" | "conflict"> {
    const existing = this.plans.get(plan.id);
    if (existing !== undefined) return canonicalJson(existing) === canonicalJson(plan) ? "idempotent" : "conflict";
    const latest = [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (latest?.revision !== expectedRevision || (latest !== undefined && [...this.reservations.values()].some((item) => item.planId === latest.id))) return "conflict";
    this.plans.set(plan.id, structuredClone(plan)); return "stored";
  }
  async reserve(expectedRevision: number, plan: Readonly<CleanupContinuationPlan>, workIds: readonly string[]): Promise<{ status: "reserved"; reservationId: string } | { status: "conflict" }> {
    const latest = [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (latest?.id !== plan.id || latest.revision !== expectedRevision || [...this.reservations.values()].some((item) => item.planId === plan.id)) return { status: "conflict" };
    const normalizedWorkIds = unique(workIds);
    const reservationId = `cleanup_reservation_${hashFramedDomain("cleanup-work-reservation", { planId: plan.id, revision: plan.revision, workIds: normalizedWorkIds }).slice(-32)}`;
    this.reservations.set(reservationId, { planId: plan.id, revision: plan.revision, workIds: normalizedWorkIds });
    return { status: "reserved", reservationId };
  }
  async commitReservation(reservationId: string, plan: Readonly<CleanupContinuationPlan>): Promise<"stored" | "conflict"> {
    const reservation = this.reservations.get(reservationId);
    const latest = reservation === undefined ? undefined : [...this.plans.values()].filter(({ key }) => key === plan.key).sort((a, b) => b.revision - a.revision)[0];
    if (reservation === undefined || latest?.id !== reservation.planId || latest.revision !== reservation.revision || plan.revision !== reservation.revision + 1 || plan.supersedesPlanId !== reservation.planId
      || reservation.workIds.some((id) => !plan.completedWorkIds.includes(id) || plan.remainingWork.some((item) => item.id === id))) return "conflict";
    this.plans.set(plan.id, structuredClone(plan)); this.reservations.delete(reservationId); return "stored";
  }
}

export interface CleanupProgressProof { readonly completedWorkIds: readonly string[]; readonly remainingWorkIds: readonly string[]; readonly boundDependencyDigest: ContentHash }
export interface CleanupProgressPort { authenticate(plan: Readonly<CleanupContinuationPlan>): Promise<CleanupProgressProof> }
export interface CleanupCheckpointPort {
  validate(input: { readonly plan: Readonly<CleanupContinuationPlan>; readonly checkpoint: Readonly<CleanupCheckpoint>; readonly selectedWorkIds: readonly string[] }): Promise<readonly { readonly validatorId: string; readonly status: "passed" | "failed" | "skipped" | "blocked" }[]>;
}

export interface ResumeCleanupResult {
  readonly kind: "advanced" | "no-op" | "rebound" | "semantic-rebase";
  readonly plan: Readonly<CleanupContinuationPlan>;
  readonly executedWorkIds: string[];
  readonly authenticatedCompletedWorkIds: string[];
  readonly authenticatedRemainingWorkIds: string[];
  readonly budgetExhausted: boolean;
  readonly continuationPersisted: boolean;
}

export async function resumeCleanupPlan(
  input: { readonly selector: string; readonly currentState: StateDigest; readonly context: AdapterContext; readonly budget: { readonly tokens: number; readonly cost: number } },
  ports: {
    readonly store: CleanupPlanStore;
    readonly bindingValidator: StateBindingValidator;
    readonly progress: CleanupProgressPort;
    readonly checkpoints?: CleanupCheckpointPort;
    readonly runChunk: (workIds: readonly string[]) => Promise<{ readonly completedWorkIds: readonly string[]; readonly externalActions: readonly CleanupExternalAction[] }>;
    readonly recompile?: (plan: Readonly<CleanupContinuationPlan>, currentState: StateDigest) => Promise<CreateCleanupPlanInput>;
  },
): Promise<ResumeCleanupResult> {
  validateCost(input.budget.tokens, "cleanup token budget"); validateCost(input.budget.cost, "cleanup cost budget");
  if (input.budget.tokens === 0 || input.budget.cost === 0) throw new Error("cleanup budgets must be positive");
  const matches = await ports.store.lookupAuthenticated(input.selector);
  if (matches.length === 0) throw new Error(`cleanup plan selector ${input.selector} is missing`);
  if (matches.length > 1) throw new Error(`cleanup plan selector ${input.selector} is ambiguous`);
  const storedPlan = matches[0]!;
  let plan = createCleanupPlan(storedPlan);
  if (plan.id !== storedPlan.id || plan.contentHash !== storedPlan.contentHash) throw new Error("cleanup store returned a plan with invalid authenticated identity or content hash");
  const validation = await ports.bindingValidator.validate(plan.boundState, input.currentState, input.context);
  let rebaseKind: ResumeCleanupResult["kind"] | undefined;
  let reboundBinding: StateBinding | undefined;
  if (validation.status === "stale") {
    if (ports.recompile === undefined) throw new Error("stale cleanup plan requires semantic rebase before resume");
    const recomputed = await ports.recompile(plan, input.currentState);
    const { id: _recomputedId, ...recomputedFields } = recomputed;
    plan = createCleanupPlan({ ...recomputedFields, revision: plan.revision + 1, supersedesPlanId: plan.id, approvalIds: [] });
    if (canonicalJson(plan.boundState.compiledAgainst) !== canonicalJson(input.currentState)) throw new Error("semantic cleanup rebase is not bound to current state");
    if (await ports.store.compareAndStore(plan.revision - 1, plan) === "conflict") throw new Error("cleanup semantic rebase compare-and-store conflict");
    rebaseKind = "semantic-rebase";
  } else if (validation.status === "suspect" || validation.status === "unavailable") throw new Error(`cleanup plan state is ${validation.status}`);
  else if (validation.status === "rebound") {
    if (validation.rebound === undefined) throw new Error("cleanup lightweight rebind lacks authenticated StateBinding");
    reboundBinding = validation.rebound;
  }
  const progress = await ports.progress.authenticate(plan);
  if (progress.boundDependencyDigest !== plan.boundState.dependencyDigest) throw new Error("cleanup progress proof is bound to different state dependencies");
  const completed = unique(progress.completedWorkIds); const remainingIds = unique(progress.remainingWorkIds);
  const allWork = unique([...plan.completedWorkIds, ...plan.remainingWork.map(({ id }) => id)]);
  if (completed.some((id) => remainingIds.includes(id)) || canonicalJson(unique([...completed, ...remainingIds])) !== canonicalJson(allWork)) throw new Error("cleanup progress proof must account for every work item exactly once");
  if (plan.completedWorkIds.some((id) => !completed.includes(id))) throw new Error("previously completed cleanup work lost authenticated progress and requires semantic rebase");
  if (remainingIds.length === 0) return { kind: "no-op", plan, executedWorkIds: [], authenticatedCompletedWorkIds: completed, authenticatedRemainingWorkIds: [], budgetExhausted: false, continuationPersisted: true };
  if (reboundBinding !== undefined) {
    const { id: _oldId, contentHash: _oldHash, ...planFields } = plan;
    const rebound = createCleanupPlan({ ...planFields, revision: plan.revision + 1, supersedesPlanId: plan.id, boundState: reboundBinding, approvalIds: [] });
    if (await ports.store.compareAndStore(plan.revision, rebound) === "conflict") throw new Error("cleanup lightweight rebind compare-and-store conflict");
    plan = rebound; rebaseKind = "rebound";
  }
  const byId = new Map(plan.remainingWork.map((item) => [item.id, item]));
  let tokens = 0; let cost = 0; const selected: string[] = [];
  for (const id of remainingIds) {
    const item = byId.get(id); if (item === undefined) continue;
    if (tokens + item.tokenCost > input.budget.tokens || cost + item.monetaryCost > input.budget.cost) continue;
    selected.push(id); tokens += item.tokenCost; cost += item.monetaryCost;
  }
  if (selected.length === 0) return { kind: rebaseKind ?? "no-op", plan, executedWorkIds: [], authenticatedCompletedWorkIds: completed, authenticatedRemainingWorkIds: remainingIds, budgetExhausted: true, continuationPersisted: true };
  const prospectiveCompleted = unique([...completed, ...selected]);
  for (const checkpoint of plan.checkpoints.filter(({ afterWorkIds }) => afterWorkIds.every((id) => prospectiveCompleted.includes(id)))) {
    if (checkpoint.requiredValidators.length === 0) continue;
    if (ports.checkpoints === undefined) throw new Error(`cleanup checkpoint ${checkpoint.id} validator proof is unavailable`);
    const results = await ports.checkpoints.validate({ plan, checkpoint, selectedWorkIds: selected });
    const byValidator = new Map(results.map((result) => [result.validatorId, result.status]));
    if (checkpoint.requiredValidators.some((id) => byValidator.get(id) !== "passed")) throw new Error(`cleanup checkpoint ${checkpoint.id} required validator did not pass`);
  }
  const reservation = await ports.store.reserve(plan.revision, plan, selected);
  if (reservation.status === "conflict") throw new Error("cleanup durable work reservation conflict");
  const execution = await ports.runChunk(selected);
  if (canonicalJson(unique(execution.completedWorkIds)) !== canonicalJson(unique(selected))) throw new Error("cleanup chunk did not authenticate completion of exactly the selected work");
  const nextCompleted = unique([...completed, ...execution.completedWorkIds]); const nextRemaining = plan.remainingWork.filter(({ id }) => !nextCompleted.includes(id));
  const { id: _oldId, contentHash: _oldHash, ...planFields } = plan;
  const next = createCleanupPlan({ ...planFields, revision: plan.revision + 1, supersedesPlanId: plan.id, completedWorkIds: nextCompleted, remainingWork: nextRemaining, externalActions: [...plan.externalActions, ...execution.externalActions], approvalIds: [], ...(nextRemaining[0] === undefined ? {} : { recommendedNextChunk: nextRemaining[0].id }) });
  const stored = await ports.store.commitReservation(reservation.reservationId, next);
  if (stored === "conflict") throw new Error("cleanup continuation reservation commit conflict");
  return { kind: rebaseKind ?? "advanced", plan: next, executedWorkIds: unique(selected), authenticatedCompletedWorkIds: nextCompleted, authenticatedRemainingWorkIds: nextRemaining.map(({ id }) => id), budgetExhausted: nextRemaining.length > 0, continuationPersisted: true };
}
