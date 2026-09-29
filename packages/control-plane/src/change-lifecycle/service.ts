import { resolve } from "node:path";
import { z } from "zod";

import {
  canonicalJson,
  hashFramedDomain,
  parseChangeProposal,
  AuthorityRecordSchema,
  type AuthorityRecord,
  type ChangeProposal,
  type ContentHash,
  type ExecutionCapsule,
} from "@projector/core";
import { executionCapsuleHash, type BuiltInRepresentationProfileKey } from "@projector/engine";
import { publishPreparedStateBoundChangeSuccess, type StateBoundChangeResult } from "@projector/engine";
import { FileTransactionJournal, GovernedWorktreeRuntime, RepositoryPathService, WriterLeaseManager, withObservationScope } from "@projector/runtime";

import { compileRepositoryChange, type CompiledRepositoryChange } from "./compiler.js";
import { executeCompiledRepositoryChange } from "./executor.js";
import { adjudicatedKnowledgeContext, assertIdentityDisposition, captureKnowledgeContextId } from "./identity-adjudication.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import type { KnowledgeReconciliationResult } from "../knowledge/types.js";
import type { ApplicationEvidencePort } from "../knowledge/application-evidence.js";
import { observeChangeRepository, observeRepositoryState, type ChangeRepositoryObservation } from "./repository-observer.js";
import { RepositoryRepresentationArtifactStore, type RepresentationPublicationState, type RepresentationRecoveryOutcome } from "../representation/artifact-store.js";
import { validateCompiledRepositoryChangeCurrentness } from "./currentness.js";
import {
  ChangeLifecycleStore,
  type ChangeLifecycleStoreOptions,
  type LifecycleApprovalRecord,
  type LifecycleCaptureRecord,
} from "./store.js";

export interface CaptureRepositoryChangeInput {
  readonly request: string;
  readonly proposal: unknown;
  /** Authenticated freshness/conformance evidence; it does not expand write authorization. */
  readonly knowledgeContextId?: string;
}

const compilationObservations = new WeakMap<CompiledRepositoryChange, ChangeRepositoryObservation>();

export interface PlannedRepositoryChange {
  readonly capture: LifecycleCaptureRecord;
  readonly compiled: CompiledRepositoryChange;
}

export interface CapturedRepositoryChange extends PlannedRepositoryChange {}

export interface RepositoryChangeLifecycleServiceOptions extends ChangeLifecycleStoreOptions {
  readonly leaseStaleAfterMs?: number;
  readonly applicationEvidence?: ApplicationEvidencePort;
  /** Selects an authenticated packaged profile; omitted uses the current active profile. */
  readonly representationProfileKey?: BuiltInRepresentationProfileKey;
}

export interface LifecycleRecoveryOutcome {
  readonly attemptId: string;
  readonly transactionId: string;
  readonly action: "finalized" | "rolled-back" | "no-transaction" | "recovery-required";
  readonly reason?: string;
}

export interface LifecycleOperationOptions {
  readonly signal?: AbortSignal;
}

export type LifecycleRepresentationPublicationState = RepresentationPublicationState & { readonly captureStatus: "captured" | "uncaptured" | "unassociated" };
export type LifecycleRepresentationRecoveryOutcome = RepresentationRecoveryOutcome & { readonly captureStatus: "captured" | "uncaptured" | "unassociated" };
const representationPublicationFields = {
  publicationId: z.string().regex(/^[a-f0-9]{64}$/u),
  semanticChangeId: z.string().optional(),
  projectionId: z.string().optional(),
  reason: z.string().optional(),
  captureStatus: z.enum(["captured", "uncaptured", "unassociated"]),
};
export const RepresentationPendingOutputSchema = z.array(z.object({ ...representationPublicationFields, status: z.enum(["published", "incomplete", "integrity-failed"]) }).strict());
export const RepresentationRecoveryOutputSchema = z.array(z.object({ ...representationPublicationFields, status: z.enum(["recovered", "recovery-required"]) }).strict());

export interface CurrentLifecyclePlanInspection {
  readonly capture: LifecycleCaptureRecord;
  readonly compiled: CompiledRepositoryChange;
}

export type LifecycleApplyOptions = LifecycleOperationOptions;

function capsules(compiled: CompiledRepositoryChange): ExecutionCapsule[] {
  return compiled.compiledPlan.packets.map(({ capsule }) => capsule);
}

function exactPatchInputHash(compiled: CompiledRepositoryChange): ContentHash {
  return hashFramedDomain("exact-text-patch-input", compiled.exactPatchInput);
}

function permitsDecisionReconsideration(compiled: CompiledRepositoryChange, governance: KnowledgeReconciliationResult["governance"]): boolean {
  if (compiled.executionKind !== "canonical-only" || governance.status !== "unknown") return false;
  const revised = new Set((compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation }) => operation === "revise" && (kind === "architecture-decision" || kind === "authority-record")).map(({ id }) => id));
  if (revised.size === 0) return false;
  const resolvedReasons = new Set<string>();
  for (const branch of governance.branches) {
    if (branch.evaluations.some(({ status }) => status !== "conformant")) return false;
    for (const decision of branch.decisionValidity ?? []) {
      if (!revised.has(decision.decisionId) && !revised.has(decision.authorityId)) continue;
      if (decision.assessment.blocksCurrentChange) resolvedReasons.add(decision.assessment.explanation);
      for (const check of decision.checks) if (check.status === "unknown") resolvedReasons.add(check.reason);
    }
  }
  // Only the exact decision(s) being reconsidered may cross this pre-state gate.
  // Canonical post-state validation must establish their newly accepted baseline.
  return resolvedReasons.size > 0 && governance.reasons.every((reason) => resolvedReasons.has(reason));
}

function removedUnsupportedEvidenceReasons(compiled: CompiledRepositoryChange, authorityId: string): Set<string> | undefined {
  const revisions = (compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation, id }) =>
    kind === "authority-record" && operation === "revise" && id === authorityId);
  if (revisions.length !== 1) return undefined;
  const revision = revisions[0]!;
  const before = AuthorityRecordSchema.safeParse(revision.before);
  const after = AuthorityRecordSchema.safeParse(revision.after);
  if (!before.success || !after.success) return undefined;
  const prior = before.data as AuthorityRecord;
  const revised = after.data as AuthorityRecord;
  const stableFields = ({ evidence: _evidence, rationale: _rationale, semanticHash: _semanticHash, ...fields }: AuthorityRecord) => fields;
  if (prior.id !== authorityId || revised.id !== authorityId
    || canonicalJson(stableFields(prior)) !== canonicalJson(stableFields(revised))) return undefined;
  const priorIds = new Set(prior.evidence.map(({ evidenceId }) => evidenceId));
  const revisedIds = new Set(revised.evidence.map(({ evidenceId }) => evidenceId));
  if (priorIds.size !== prior.evidence.length || revisedIds.size !== revised.evidence.length
    || revised.evidence.some((reference) => {
      const retained = prior.evidence.find(({ evidenceId }) => evidenceId === reference.evidenceId);
      return retained === undefined || canonicalJson(retained) !== canonicalJson(reference);
    })) return undefined;
  const removedIds = [...priorIds].filter((id) => !revisedIds.has(id));
  const rationalePrefix = `${prior.rationale.trimEnd()}\n\n`;
  if (!revised.rationale.startsWith(rationalePrefix)
    || removedIds.some((id) => !revised.rationale.slice(rationalePrefix.length).includes(id))) return undefined;
  return removedIds.length === 0 ? undefined : new Set(removedIds.map((id) =>
    `Evidence ${id} has no supported accepted observation; external evidence validity is unknown.`));
}

/** @internal Only an explicit canonical reconsideration may cross an unchanged, incomplete trigger query. */
export function permitsUnchangedDecisionBaselineBinding(compiled: CompiledRepositoryChange, reconciliation: KnowledgeReconciliationResult): boolean {
  if (reconciliation.status !== "suspect" || !permitsDecisionReconsideration(compiled, reconciliation.governance)) return false;
  if (reconciliation.discoveryValidation.status !== "current" && reconciliation.discoveryValidation.status !== "rebound") return false;
  const revised = new Set((compiled.intentReview.canonicalMutations ?? []).filter(({ kind, operation }) => operation === "revise" && (kind === "architecture-decision" || kind === "authority-record")).map(({ id }) => id));
  const baselineTriggers = new Set(["concept-changed", "requirement-changed", "scenario-changed", "relation-changed", "constraint-changed", "lens-changed", "scope-expanded"]);
  let qualifyingQueries = 0;
  for (const validation of [reconciliation.discoveryValidation, ...reconciliation.branches.map(({ validation }) => validation)]) {
    if (validation.changedValueDependencyIds.length !== 0 || validation.changedQueryDependencyIds.length !== 0) return false;
    if (validation.status !== "current" && validation.status !== "rebound" && validation.status !== "suspect") return false;
    if (validation.status === "suspect" && !validation.observations?.length) return false;
    for (const observed of validation.observations ?? []) {
      if (observed.status === "current") continue;
      if (observed.kind !== "query" || observed.status !== "unknown" || observed.basis === "unavailable" || observed.currentResult === undefined) return false;
      const { query, priorResult } = observed.dependency;
      const decisionId = query.input.decisionId;
      if (typeof decisionId !== "string" || query.kind !== "custom" || query.programId !== "projector.knowledge.decision-triggers" || query.programVersion !== "1" || query.id !== `knowledge-decision-triggers:${decisionId}`) return false;
      const current = observed.currentResult;
      if (priorResult.queryHash !== query.semanticHash || current.queryHash !== query.semanticHash || priorResult.observability !== "closed" || current.observability !== "closed" || priorResult.resultCount !== 1 || current.resultCount !== 1 || canonicalJson(priorResult) !== canonicalJson(current)) return false;
      const decisions = reconciliation.governance.branches.flatMap(({ decisionValidity }) => decisionValidity ?? []).filter((decision) => decision.decisionId === decisionId);
      if (decisions.length === 0) return false;
      for (const decision of decisions) {
        if ((!revised.has(decision.decisionId) && !revised.has(decision.authorityId)) || decision.checks.some(({ status }) => status === "fired")) return false;
        const lanes = new Set([...priorResult.unavailableLanes, ...current.unavailableLanes]);
        let reasons: Set<string> | undefined;
        if (decision.baseline.kind === "unavailable") {
          const unknown = decision.checks.filter(({ status }) => status === "unknown");
          if (unknown.length === 0 || unknown.some(({ trigger, reason }) => !baselineTriggers.has(trigger.type) || !reason.startsWith(`No accepted baseline observation for ${trigger.type}: `))) return false;
          reasons = new Set(unknown.map(({ reason }) => reason));
        } else if (decision.baseline.kind === "authenticated-transaction") {
          if (decision.checks.some(({ status }) => status === "unknown")) return false;
          reasons = removedUnsupportedEvidenceReasons(compiled, decision.authorityId);
        }
        if (reasons === undefined) return false;
        if (lanes.size !== reasons.size || [...lanes].some((reason) => !reasons.has(reason))) return false;
      }
      qualifyingQueries += 1;
    }
  }
  // This permits explicit canonical reconsideration, not currentness or authority.
  // Unknown evidence remains intact; post-state validation must accept the baseline.
  return qualifyingQueries > 0;
}

function approvedCompilation(compiled: CompiledRepositoryChange, capture: LifecycleCaptureRecord): CompiledRepositoryChange {
  if (compiled.proposalHash !== capture.proposalHash || exactPatchInputHash(compiled) !== capture.exactPatchInputHash) {
    throw new Error("lifecycle approval dependencies are stale for the current repository observation");
  }
  if (compiled.compiledPlan.packets.length !== capture.capsules.length) throw new Error("lifecycle approved packet composition changed");
  const packets = compiled.compiledPlan.packets.map((current, index) => {
    const capsule = capture.capsules[index]!;
    const packetId = capture.plan.packetIds[index];
    if (packetId === undefined || capsule.taskId !== packetId) throw new Error("lifecycle captured plan and capsule identities do not compose");
    const packet = { ...current.packet, id: packetId, planId: capture.plan.id, capsuleId: capsule.id, boundState: capture.stateBinding };
    return { ...current, packet, capsule, packetHash: hashFramedDomain("semantic-change-work-packet", packet), capsuleHash: executionCapsuleHash(capsule) };
  });
  return {
    ...compiled,
    compiledPlan: {
      plan: capture.plan,
      packets,
      executionOrder: packets,
      packetHash: hashFramedDomain("semantic-change-packet-set", packets.map(({ packetHash, capsuleHash }) => ({ packetHash, capsuleHash }))),
    },
    planHash: capture.planHash,
  };
}

export class RepositoryChangeLifecycleService {
  private readonly now: () => string;
  private readonly leaseStaleAfterMs: number;
  private readonly applicationEvidence: ApplicationEvidencePort | undefined;
  private readonly representationProfileKey: BuiltInRepresentationProfileKey | undefined;

  private constructor(
    private readonly repositoryRoot: string,
    private readonly store: ChangeLifecycleStore,
    private readonly representationArtifacts: RepositoryRepresentationArtifactStore,
    options: RepositoryChangeLifecycleServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseStaleAfterMs = options.leaseStaleAfterMs ?? 30_000;
    this.applicationEvidence = options.applicationEvidence;
    this.representationProfileKey = options.representationProfileKey;
  }

  static async create(
    repositoryRoot: string,
    options: RepositoryChangeLifecycleServiceOptions = {},
  ): Promise<RepositoryChangeLifecycleService> {
    repositoryRoot = resolve(repositoryRoot);
    const store = await ChangeLifecycleStore.create(repositoryRoot, options);
    const representationArtifacts = await RepositoryRepresentationArtifactStore.create(repositoryRoot);
    return new RepositoryChangeLifecycleService(repositoryRoot, store, representationArtifacts, options);
  }

  async capture(input: CaptureRepositoryChangeInput, options: LifecycleOperationOptions = {}): Promise<CapturedRepositoryChange> {
    options.signal?.throwIfAborted();
    const proposal = parseChangeProposal(input.proposal);
    const suppliedId = input.knowledgeContextId?.normalize("NFKC").trim();
    if (input.knowledgeContextId !== undefined && !suppliedId) throw new Error("knowledge context ID must be nonblank");
    const knowledgeContextId = await captureKnowledgeContextId(this.repositoryRoot, input.request, proposal, suppliedId, options.signal, this.applicationEvidence);
    const compiled = await this.compile(input.request, proposal, knowledgeContextId, options.signal, true, true);
    if (knowledgeContextId !== undefined) await this.assertKnowledgeContext(knowledgeContextId, compiled, proposal, options.signal);
    else await this.assertObservationFresh(compiled, options.signal);
    options.signal?.throwIfAborted();
    const capture = await this.store.capture({
      request: input.request.normalize("NFKC").trim(),
      proposal,
      proposalHash: compiled.proposalHash,
      semanticChangeId: compiled.compiledChange.change.id,
      plan: compiled.compiledPlan.plan,
      capsules: capsules(compiled),
      exactPatchInputHash: exactPatchInputHash(compiled),
      ...(knowledgeContextId === undefined ? {} : { knowledgeContextId }),
    });
    await this.representationArtifacts.acknowledgeCapture(capture.semanticChangeId);
    return { capture, compiled };
  }

  private async representationCaptureStatus(semanticChangeId?: string, projectionId?: string): Promise<"captured" | "uncaptured" | "unassociated"> {
    if (semanticChangeId === undefined) return "unassociated";
    try {
      const capture = await this.store.readCapture(semanticChangeId);
      if (projectionId === undefined || !capture.capsules.some((capsule) => capsule.representation?.projectionId === projectionId)) throw new Error("representation publication does not match its authenticated lifecycle capture");
      return "captured";
    }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return "uncaptured";
      throw error;
    }
  }

  async pendingRepresentations(options: LifecycleOperationOptions = {}): Promise<LifecycleRepresentationPublicationState[]> {
    const states = await this.representationArtifacts.pending(options);
    return Promise.all(states.map(async (state) => ({ ...state, captureStatus: await this.representationCaptureStatus(state.semanticChangeId, state.projectionId) })));
  }

  async recoverRepresentations(options: LifecycleOperationOptions = {}): Promise<LifecycleRepresentationRecoveryOutcome[]> {
    const outcomes = await this.representationArtifacts.recover(options);
    const results: LifecycleRepresentationRecoveryOutcome[] = [];
    for (const outcome of outcomes) {
      options.signal?.throwIfAborted();
      const captureStatus = await this.representationCaptureStatus(outcome.semanticChangeId, outcome.projectionId);
      if (outcome.status === "recovered" && captureStatus === "captured") await this.representationArtifacts.acknowledgeCapture(outcome.semanticChangeId!);
      if (outcome.status === "recovered" && captureStatus === "uncaptured") {
        results.push({ ...outcome, status: "recovery-required", captureStatus,
          reason: `Change ${outcome.semanticChangeId} has authenticated representation bytes but no lifecycle capture. Use inspect --representations to inspect the retained publication for projection ${outcome.projectionId}. If this change was never applied, re-present the original exact proposal to capture it. Recovery cannot reconstruct the missing capture or establish whether an external mutation occurred.` });
      } else results.push({ ...outcome, captureStatus });
    }
    return results;
  }

  async plan(selector: string, options: LifecycleOperationOptions = {}): Promise<PlannedRepositoryChange> {
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(selector);
    options.signal?.throwIfAborted();
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, compiled, proposal, options.signal);
    else await this.assertObservationFresh(compiled, options.signal);
    const mismatches: string[] = [];
    if (compiled.compiledChange.change.id !== capture.semanticChangeId) mismatches.push("semantic change identity");
    if (compiled.proposalHash !== capture.proposalHash) mismatches.push("proposal hash");
    if (compiled.compiledPlan.plan.id !== capture.planId || compiled.compiledPlan.plan.revision !== capture.planRevision) mismatches.push("plan identity or revision");
    if (compiled.planHash !== capture.planHash) mismatches.push("plan hash");
    if (exactPatchInputHash(compiled) !== capture.exactPatchInputHash) mismatches.push("exact patch input hash");
    const currentCapsules = capsules(compiled).map((capsule) => ({ packetId: capsule.taskId, capsuleId: capsule.id, capsuleHash: executionCapsuleHash(capsule) }));
    if (canonicalJson(currentCapsules) !== canonicalJson(capture.capsuleBindings)) mismatches.push("capsule bindings");
    if (mismatches.length > 0) throw new Error(`lifecycle plan is stale or unauthenticated: ${mismatches.join(", ")}`);
    return { capture, compiled };
  }

  /**
   * Re-observes only the dependencies that authorize reuse of a captured plan.
   * The global compiledAgainst digest may rebind when every value/query and
   * representation-profile dependency remains identical.
   */
  async inspectCurrentPlan(selector: string, options: LifecycleOperationOptions = {}): Promise<CurrentLifecyclePlanInspection> {
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(selector);
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal, false);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, compiled, proposal, options.signal);
    else await this.assertObservationFresh(compiled, options.signal);
    const validation = await validateCompiledRepositoryChangeCurrentness({ repositoryRoot: this.repositoryRoot, compiled, binding: capture.stateBinding, ...(options.signal === undefined ? {} : { signal: options.signal }), now: this.now });
    if (validation.status !== "current") throw new Error(`lifecycle plan dependencies are ${validation.status}: ${validation.reasons.join("; ")}`);
    return { capture, compiled };
  }

  async approve(selector: string, presentedPlanHash: ContentHash, options: LifecycleOperationOptions = {}): Promise<LifecycleApprovalRecord> {
    const planned = await this.plan(selector, options);
    options.signal?.throwIfAborted();
    return this.store.approve(
      selector,
      presentedPlanHash,
      planned.compiled.compiledPlan.plan,
      capsules(planned.compiled),
    );
  }

  async readApproval(selector: string): Promise<LifecycleApprovalRecord> {
    return this.store.readApproval(selector);
  }

  async apply(approvalSelector: string, options: LifecycleApplyOptions = {}): Promise<StateBoundChangeResult> {
    options.signal?.throwIfAborted();
    const prior = await this.store.successfulResultForApproval<StateBoundChangeResult>(approvalSelector);
    if (prior !== undefined) return prior.result;
    const approvalRecord = await this.store.readApproval(approvalSelector);
    const capture = await this.store.readCapture(approvalRecord.semanticChangeId);
    if (approvalRecord.planHash !== capture.planHash) throw new Error("lifecycle approval is stale for the current authenticated plan");
    if (approvalRecord.knowledgeContextId !== capture.knowledgeContextId) throw new Error("lifecycle approval knowledge context does not match the authenticated capture");
    if (approvalRecord.approvals.length !== 1) throw new Error("initial repository lifecycle requires exactly one packet approval");
    const paths = await RepositoryPathService.create(this.repositoryRoot);
    const journal = new FileTransactionJournal(paths);
    const incomplete = await journal.incomplete();
    if (incomplete.length > 0) throw new Error(`incomplete governed transaction requires recovery before apply: ${incomplete.map(({ entry }) => entry.transactionId).join(", ")}`);
    const proposal = parseChangeProposal(capture.proposal);
    const currentCompilation = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, currentCompilation, proposal, options.signal);
    else await this.assertObservationFresh(currentCompilation, options.signal);
    const compiled = approvedCompilation(currentCompilation, capture);
    options.signal?.throwIfAborted();
    const attempt = await this.store.beginAttempt(approvalRecord.id);
    let result: StateBoundChangeResult;
    try {
      result = await executeCompiledRepositoryChange({
        repositoryRoot: this.repositoryRoot,
        compiled,
        approval: approvalRecord.approvals[0]!,
        attempt,
        store: this.store,
        now: this.now,
        leaseStaleAfterMs: this.leaseStaleAfterMs,
        signal: options.signal ?? new AbortController().signal,
      });
    } catch (error) {
      try {
        const transaction = await journal.read(attempt.transactionId);
        if (transaction.entry.phase === "committed") await this.store.markCommittedUnpublished(attempt.id, transaction);
      } catch (inspectionError) {
        if (!(inspectionError instanceof Error && "code" in inspectionError && inspectionError.code === "ENOENT")) throw inspectionError;
      }
      throw error;
    }
    if (result.outcome === "success") {
      const transaction = await journal.read(attempt.transactionId);
      await this.store.completeSuccessfulAttempt(attempt.id, result, transaction);
    } else {
      await this.store.completeAttempt(attempt.id, result.outcome, result);
    }
    return result;
  }

  async recover(approvalSelector: string, options: LifecycleOperationOptions = {}): Promise<LifecycleRecoveryOutcome[]> {
    options.signal?.throwIfAborted();
    const approval = await this.store.readApproval(approvalSelector);
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(approval.semanticChangeId);
    if (approval.knowledgeContextId !== capture.knowledgeContextId) throw new Error("lifecycle approval knowledge context does not match the authenticated capture");
    const attempts = await this.store.incompleteAttemptsForApproval(approval.id);
    options.signal?.throwIfAborted();
    if (attempts.length === 0) return [];
    const paths = await RepositoryPathService.create(this.repositoryRoot);
    const journal = new FileTransactionJournal(paths);
    const worktree = new GovernedWorktreeRuntime(new WriterLeaseManager(paths, { staleAfterMs: this.leaseStaleAfterMs }), journal);
    const session = await worktree.open({
      sessionId: `recovery_${hashFramedDomain("change-lifecycle-recovery-session", attempts.map(({ id }) => id)).slice(-32)}`,
      processId: process.pid,
      stateBinding: capture.stateBinding,
    });
    let recovered;
    try {
      options.signal?.throwIfAborted();
      recovered = await session.recover(attempts.map(({ transactionId }) => transactionId), options.signal === undefined ? {} : { signal: options.signal });
      options.signal?.throwIfAborted();
      const byTransaction = new Map(recovered.map((result) => [result.transactionId, result]));
      const outcomes: LifecycleRecoveryOutcome[] = [];
      for (const attempt of attempts) {
        options.signal?.throwIfAborted();
        let record;
        try {
          record = await journal.read(attempt.transactionId);
          options.signal?.throwIfAborted();
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
        const recovery = byTransaction.get(attempt.transactionId);
        if (record?.entry.phase === "committed") {
          let prepared;
          try {
            prepared = await this.store.readPreparedSuccess(attempt.id);
            options.signal?.throwIfAborted();
          } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
              outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: "committed transaction has no authenticated prepared-success checkpoint" });
              continue;
            }
            throw error;
          }
          if (!record.entry.checkpointIds.includes(prepared.prepared.checkpointId)) {
            outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: "committed journal does not bind the authenticated prepared-success identity" });
            continue;
          }
          options.signal?.throwIfAborted();
          const result = await publishPreparedStateBoundChangeSuccess(prepared.prepared, {
            write: async (kind, hash, content) => {
              options.signal?.throwIfAborted();
              const published = await this.store.writeArtifact(kind, hash, content);
              options.signal?.throwIfAborted();
              return published;
            },
          });
          options.signal?.throwIfAborted();
          await this.store.completeSuccessfulAttempt(attempt.id, result, record);
          outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "finalized" });
          continue;
        }
        if (record?.entry.phase === "recovery-required" || recovery?.action === "recovery-required") {
          outcomes.push({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required", reason: recovery?.reason ?? "journal requires manual recovery" });
          continue;
        }
        const outcome: LifecycleRecoveryOutcome = record === undefined
          ? { attemptId: attempt.id, transactionId: attempt.transactionId, action: "no-transaction", reason: "attempt stopped before a governed transaction began" }
          : { attemptId: attempt.id, transactionId: attempt.transactionId, action: "rolled-back" };
        options.signal?.throwIfAborted();
        // Recovery closes effects; a published failure/partial result remains
        // authenticated history and must not be overwritten with a new result.
        try { await this.store.readAttemptResult(attempt.id); }
        catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
          await this.store.completeAttempt(attempt.id, "failure", { kind: "recovery", ...outcome });
        }
        outcomes.push(outcome);
      }
      return outcomes;
    } finally {
      await session.close();
    }
  }

  private async compile(request: string, proposal: ChangeProposal, contextId?: string, signal?: AbortSignal, publishRepresentation = true, retainCaptureAssociation = false): Promise<CompiledRepositoryChange> {
    return withObservationScope(signal === undefined ? {} : { signal }, async () => {
    const observation = await observeChangeRepository(this.repositoryRoot);
    const knowledgeContext = await adjudicatedKnowledgeContext(this.repositoryRoot, proposal, contextId, signal, this.applicationEvidence, observation);
    const compiled = await compileRepositoryChange(
      { repositoryRoot: this.repositoryRoot, request, proposal, now: this.now(), ...(knowledgeContext === undefined ? {} : { knowledgeContext }) },
      {
        ...(publishRepresentation ? { representationArtifacts: this.representationArtifacts } : {}),
        ...(this.representationProfileKey === undefined ? {} : { representationProfileKey: this.representationProfileKey }),
        ...(signal === undefined ? {} : { signal }),
        observation,
      },
    );
    assertIdentityDisposition(compiled, proposal);
    compilationObservations.set(compiled, observation);
    if (publishRepresentation) await this.representationArtifacts.publish(compiled.representationDetails, retainCaptureAssociation ? compiled.compiledChange.change.id : undefined);
    return compiled;
    });
  }

  private async assertKnowledgeContext(contextId: string, compiled: CompiledRepositoryChange, proposal: ChangeProposal, signal?: AbortSignal): Promise<void> {
    const observation = compilationObservations.get(compiled);
    if (observation === undefined) throw new Error("Lifecycle compilation has no request-local repository observation");
    const knowledge = await RepositoryKnowledgeService.create(this.applicationEvidence === undefined ? this.repositoryRoot : { repositoryRoot: this.repositoryRoot, applicationEvidence: this.applicationEvidence });
    const reconciliation = await knowledge.reconcile(contextId, { ...(signal === undefined ? {} : { signal }), observation });
    const expectedState = compiled.compiledPlan.plan.boundState.compiledAgainst;
    if (canonicalJson(reconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("knowledge context and lifecycle compilation observed different repository states; retry before mutation");
    }
    if (reconciliation.status !== "current" && reconciliation.status !== "rebound" && !permitsUnchangedDecisionBaselineBinding(compiled, reconciliation)) {
      throw new Error(`knowledge context binding is ${reconciliation.status}: ${reconciliation.reasons.join("; ")}`);
    }
    // Candidate discovery is retained for freshness. Only the reviewed selection
    // supplies governing meaning; unrelated hypothetical branches do not veto it.
    const selected = compiled.knowledgeContext;
    const selectedReconciliation = selected !== undefined && selected.id !== contextId ? await knowledge.reconcile(selected.id, { ...(signal === undefined ? {} : { signal }), observation }) : reconciliation;
    if (selectedReconciliation.status !== "current" && selectedReconciliation.status !== "rebound" && !permitsUnchangedDecisionBaselineBinding(compiled, selectedReconciliation)) {
      throw new Error(`selected knowledge context binding is ${selectedReconciliation.status}: ${selectedReconciliation.reasons.join("; ")}`);
    }
    const governance = selectedReconciliation.governance;
    if (selectedReconciliation.applicationEvidence.status === "violated" || selectedReconciliation.applicationEvidence.status === "unknown") {
      throw new Error(`knowledge context application evidence is ${selectedReconciliation.applicationEvidence.status}: ${selectedReconciliation.applicationEvidence.branches.flatMap(({ reasons }) => reasons).join("; ")}`);
    }
    if (proposal.identityResolution?.selectedEntityIds.length !== 0 && governance.status !== "conformant" && governance.status !== "not-applicable" && !permitsDecisionReconsideration(compiled, governance)) {
      throw new Error(`knowledge context governance is ${governance.status}: ${governance.reasons.join("; ")}`);
    }
    if (canonicalJson(selectedReconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("selected knowledge and lifecycle compilation observed different repository states; retry before mutation");
    }
    await this.assertObservationFresh(compiled, signal);
  }

  private async assertObservationFresh(compiled: CompiledRepositoryChange, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    const observation = compilationObservations.get(compiled);
    if (observation === undefined) throw new Error("Lifecycle compilation has no request-local repository observation");
    const current = await observeRepositoryState(observation);
    signal?.throwIfAborted();
    if (canonicalJson(current) !== canonicalJson(compiled.compiledPlan.plan.boundState.compiledAgainst)) throw new Error("Repository changed during lifecycle compilation or knowledge reconciliation; retry before mutation");
  }
}
