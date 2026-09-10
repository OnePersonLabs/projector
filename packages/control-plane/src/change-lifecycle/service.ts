import { canonicalJson, hashFramedDomain, parseChangeProposal, type ChangeProposal, type ContentHash, type ExecutionCapsule } from "@projector/core";
import { executionCapsuleHash } from "@projector/engine";
import { publishPreparedStateBoundChangeSuccess, type StateBoundChangeResult } from "@projector/engine";
import { FileTransactionJournal, GovernedWorktreeRuntime, RepositoryPathService, WriterLeaseManager } from "@projector/runtime";

import { compileRepositoryChange, type CompiledRepositoryChange } from "./compiler.js";
import { executeCompiledRepositoryChange } from "./executor.js";
import { adjudicatedKnowledgeContext, assertIdentityDisposition, captureKnowledgeContextId } from "./identity-adjudication.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import type { KnowledgeReconciliationResult } from "../knowledge/types.js";
import type { PsychordApplicationEvidenceHost } from "../knowledge/application-evidence.js";
import { RepositoryRepresentationArtifactStore } from "../representation/artifact-store.js";
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

export interface PlannedRepositoryChange {
  readonly capture: LifecycleCaptureRecord;
  readonly compiled: CompiledRepositoryChange;
}

export interface CapturedRepositoryChange extends PlannedRepositoryChange {}

export interface RepositoryChangeLifecycleServiceOptions extends ChangeLifecycleStoreOptions {
  readonly leaseStaleAfterMs?: number;
  readonly applicationEvidence?: PsychordApplicationEvidenceHost;
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

export interface CurrentLifecyclePlanInspection {
  readonly capture: LifecycleCaptureRecord;
  readonly compiled: CompiledRepositoryChange;
}

export type LifecycleApplyOptions = LifecycleOperationOptions;

export class LifecycleRecoveryRequiredError extends Error {
  readonly code = "lifecycle-recovery-required";

  constructor(readonly outcomes: readonly LifecycleRecoveryOutcome[]) {
    super(`lifecycle recovery requires manual action: ${outcomes.map(({ transactionId, reason }) => `${transactionId}: ${reason ?? "unknown"}`).join("; ")}`);
    this.name = "LifecycleRecoveryRequiredError";
  }
}

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
  private readonly applicationEvidence: PsychordApplicationEvidenceHost | undefined;

  private constructor(
    private readonly repositoryRoot: string,
    private readonly store: ChangeLifecycleStore,
    private readonly representationArtifacts: RepositoryRepresentationArtifactStore,
    options: RepositoryChangeLifecycleServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseStaleAfterMs = options.leaseStaleAfterMs ?? 30_000;
    this.applicationEvidence = options.applicationEvidence;
  }

  static async create(
    repositoryRoot: string,
    options: RepositoryChangeLifecycleServiceOptions = {},
  ): Promise<RepositoryChangeLifecycleService> {
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
    const compiled = await this.compile(input.request, proposal, knowledgeContextId, options.signal);
    if (knowledgeContextId !== undefined) await this.assertKnowledgeContext(knowledgeContextId, compiled, proposal, options.signal);
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
    return { capture, compiled };
  }

  async plan(selector: string, options: LifecycleOperationOptions = {}): Promise<PlannedRepositoryChange> {
    options.signal?.throwIfAborted();
    const capture = await this.store.readCapture(selector);
    options.signal?.throwIfAborted();
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId, options.signal);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, compiled, proposal, options.signal);
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
        await this.store.completeAttempt(attempt.id, "failure", { kind: "recovery", ...outcome });
        outcomes.push(outcome);
      }
      return outcomes;
    } finally {
      await session.close();
    }
  }

  async resume(approvalSelector: string, options: LifecycleApplyOptions = {}): Promise<StateBoundChangeResult> {
    const outcomes = await this.recover(approvalSelector, options);
    const blocked = outcomes.filter(({ action }) => action === "recovery-required");
    if (blocked.length > 0) throw new LifecycleRecoveryRequiredError(blocked);
    return this.apply(approvalSelector, options);
  }

  private async compile(request: string, proposal: ChangeProposal, contextId?: string, signal?: AbortSignal, publishRepresentation = true): Promise<CompiledRepositoryChange> {
    const knowledgeContext = await adjudicatedKnowledgeContext(this.repositoryRoot, proposal, contextId, signal, this.applicationEvidence);
    const compiled = await compileRepositoryChange(
      { repositoryRoot: this.repositoryRoot, request, proposal, now: this.now(), ...(knowledgeContext === undefined ? {} : { knowledgeContext }) },
      { ...(publishRepresentation ? { representationArtifacts: this.representationArtifacts } : {}), ...(signal === undefined ? {} : { signal }) },
    );
    assertIdentityDisposition(compiled, proposal);
    if (publishRepresentation) await this.representationArtifacts.publish(compiled.representationDetails);
    return compiled;
  }

  private async assertKnowledgeContext(contextId: string, compiled: CompiledRepositoryChange, proposal: ChangeProposal, signal?: AbortSignal): Promise<void> {
    const knowledge = await RepositoryKnowledgeService.create(this.applicationEvidence === undefined ? this.repositoryRoot : { repositoryRoot: this.repositoryRoot, applicationEvidence: this.applicationEvidence });
    const reconciliation = await knowledge.reconcile(contextId, signal === undefined ? {} : { signal });
    const expectedState = compiled.compiledPlan.plan.boundState.compiledAgainst;
    if (canonicalJson(reconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("knowledge context and lifecycle compilation observed different repository states; retry before mutation");
    }
    if (reconciliation.status !== "current" && reconciliation.status !== "rebound") {
      throw new Error(`knowledge context binding is ${reconciliation.status}: ${reconciliation.reasons.join("; ")}`);
    }
    // Candidate discovery is retained for freshness. Only the reviewed selection
    // supplies governing meaning; unrelated hypothetical branches do not veto it.
    const selected = compiled.knowledgeContext;
    const selectedReconciliation = selected !== undefined && selected.id !== contextId ? await knowledge.reconcile(selected.id, signal === undefined ? {} : { signal }) : reconciliation;
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
  }
}
