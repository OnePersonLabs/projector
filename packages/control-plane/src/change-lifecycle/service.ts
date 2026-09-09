import { canonicalJson, hashFramedDomain, parseChangeProposal, type ChangeProposal, type ContentHash, type ExecutionCapsule } from "@projector/core";
import { executionCapsuleHash } from "@projector/engine";
import { publishPreparedStateBoundChangeSuccess, type StateBoundChangeResult } from "@projector/engine";
import { FileTransactionJournal, GovernedWorktreeRuntime, RepositoryPathService, WriterLeaseManager } from "@projector/runtime";

import { compileRepositoryChange, type CompiledRepositoryChange } from "./compiler.js";
import { executeCompiledRepositoryChange } from "./executor.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
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
}

export interface LifecycleRecoveryOutcome {
  readonly attemptId: string;
  readonly transactionId: string;
  readonly action: "finalized" | "rolled-back" | "no-transaction" | "recovery-required";
  readonly reason?: string;
}

export interface LifecycleApplyOptions {
  readonly signal?: AbortSignal;
}

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

  private constructor(
    private readonly repositoryRoot: string,
    private readonly store: ChangeLifecycleStore,
    options: RepositoryChangeLifecycleServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseStaleAfterMs = options.leaseStaleAfterMs ?? 30_000;
  }

  static async create(
    repositoryRoot: string,
    options: RepositoryChangeLifecycleServiceOptions = {},
  ): Promise<RepositoryChangeLifecycleService> {
    const store = await ChangeLifecycleStore.create(repositoryRoot, options);
    return new RepositoryChangeLifecycleService(repositoryRoot, store, options);
  }

  async capture(input: CaptureRepositoryChangeInput): Promise<CapturedRepositoryChange> {
    const proposal = parseChangeProposal(input.proposal);
    const knowledgeContextId = input.knowledgeContextId?.normalize("NFKC").trim();
    if (input.knowledgeContextId !== undefined && !knowledgeContextId) throw new Error("knowledge context ID must be nonblank");
    const compiled = await this.compile(input.request, proposal, knowledgeContextId);
    if (knowledgeContextId !== undefined) await this.assertKnowledgeContext(knowledgeContextId, compiled.compiledPlan.plan.boundState.compiledAgainst);
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

  async plan(selector: string): Promise<PlannedRepositoryChange> {
    const capture = await this.store.readCapture(selector);
    const proposal = parseChangeProposal(capture.proposal);
    const compiled = await this.compile(capture.request, proposal, capture.knowledgeContextId);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, compiled.compiledPlan.plan.boundState.compiledAgainst);
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

  async approve(selector: string, presentedPlanHash: ContentHash): Promise<LifecycleApprovalRecord> {
    const planned = await this.plan(selector);
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
    const currentCompilation = await this.compile(capture.request, proposal, capture.knowledgeContextId);
    if (capture.knowledgeContextId !== undefined) await this.assertKnowledgeContext(capture.knowledgeContextId, currentCompilation.compiledPlan.plan.boundState.compiledAgainst);
    const compiled = approvedCompilation(currentCompilation, capture);
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

  async recover(approvalSelector: string): Promise<LifecycleRecoveryOutcome[]> {
    const approval = await this.store.readApproval(approvalSelector);
    const capture = await this.store.readCapture(approval.semanticChangeId);
    if (approval.knowledgeContextId !== capture.knowledgeContextId) throw new Error("lifecycle approval knowledge context does not match the authenticated capture");
    const attempts = await this.store.incompleteAttemptsForApproval(approval.id);
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
      recovered = await session.recover(attempts.map(({ transactionId }) => transactionId));
      const byTransaction = new Map(recovered.map((result) => [result.transactionId, result]));
      const outcomes: LifecycleRecoveryOutcome[] = [];
      for (const attempt of attempts) {
        let record;
        try {
          record = await journal.read(attempt.transactionId);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
        const recovery = byTransaction.get(attempt.transactionId);
        if (record?.entry.phase === "committed") {
          let prepared;
          try {
            prepared = await this.store.readPreparedSuccess(attempt.id);
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
          const result = await publishPreparedStateBoundChangeSuccess(prepared.prepared, {
            write: (kind, hash, content) => this.store.writeArtifact(kind, hash, content),
          });
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
        await this.store.completeAttempt(attempt.id, "failure", { kind: "recovery", ...outcome });
        outcomes.push(outcome);
      }
      return outcomes;
    } finally {
      await session.close();
    }
  }

  async resume(approvalSelector: string, options: LifecycleApplyOptions = {}): Promise<StateBoundChangeResult> {
    const outcomes = await this.recover(approvalSelector);
    const blocked = outcomes.filter(({ action }) => action === "recovery-required");
    if (blocked.length > 0) throw new LifecycleRecoveryRequiredError(blocked);
    return this.apply(approvalSelector, options);
  }

  private async compile(request: string, proposal: ChangeProposal, contextId?: string): Promise<CompiledRepositoryChange> {
    const knowledgeContext = contextId === undefined ? undefined : await (await RepositoryKnowledgeService.create(this.repositoryRoot)).read(contextId);
    return compileRepositoryChange({ repositoryRoot: this.repositoryRoot, request, proposal, now: this.now(), ...(knowledgeContext === undefined ? {} : { knowledgeContext }) });
  }

  private async assertKnowledgeContext(contextId: string, expectedState: CompiledRepositoryChange["compiledPlan"]["plan"]["boundState"]["compiledAgainst"]): Promise<void> {
    const knowledge = await RepositoryKnowledgeService.create(this.repositoryRoot);
    const retained = await knowledge.read(contextId);
    const usableBranches = retained.branches.filter((branch) => !branch.hypothesis && branch.interpretation.direct);
    if (retained.interpretation.status === "unresolved"
      || retained.interpretation.candidates.length === 0
      || usableBranches.length === 0) {
      throw new Error("knowledge context has no direct, accepted, usable interpretation branch");
    }
    const reconciliation = await knowledge.reconcile(contextId);
    if (canonicalJson(reconciliation.currentState) !== canonicalJson(expectedState)) {
      throw new Error("knowledge context and lifecycle compilation observed different repository states; retry before mutation");
    }
    if (reconciliation.status !== "current" && reconciliation.status !== "rebound") {
      throw new Error(`knowledge context binding is ${reconciliation.status}: ${reconciliation.reasons.join("; ")}`);
    }
    if (reconciliation.governance.status !== "conformant" && reconciliation.governance.status !== "not-applicable") {
      throw new Error(`knowledge context governance is ${reconciliation.governance.status}: ${reconciliation.governance.reasons.join("; ")}`);
    }
  }
}
