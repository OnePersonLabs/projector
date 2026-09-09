import { readFile } from "node:fs/promises";

import {
  canonicalJson,
  hashFramedDomain,
  type ExecutionCapsule,
  type ContentHash,
  type StateBinding,
  type StateDigest,
  type TransformContext,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";
import {
  DependencyScopedStateBindingValidator,
  StateBoundChangeExecutor,
  type ChangeTransaction,
  type ChangeTransactionPort,
  type ExecutionApproval,
  type StateBoundChangeResult,
} from "@projector/engine";
import {
  ExactTextPatchTransform,
  FileTransactionJournal,
  GovernedWorktreeRuntime,
  RepositoryPathService,
  WriterLeaseManager,
  createSandboxLauncher,
  type ExactTextPatchInput,
  type FileTransaction,
  type GovernedWorktreeSession,
  type ProcessLauncher,
  type TransformMutationPort,
} from "@projector/runtime";

import type { CompiledRepositoryChange } from "./compiler.js";
import { observeChangeRepository, type ChangeRepositoryObservation } from "./repository-observer.js";
import { createChangeQueryRegistry } from "./query-programs.js";
import type { ChangeLifecycleStore, LifecycleAttemptRecord } from "./store.js";
import { validateCanonicalDecisionBaselines, validatePostChangeKnowledge } from "./knowledge-validation.js";
import { buildRepositoryImpactSnapshot, persistRepositoryImpactSnapshot, predictRepositoryImpact, reconcileRepositoryImpact, repositoryImpactProofHash, type RepositoryImpactReport, type RepositoryImpactSnapshot } from "../impact/service.js";

export interface ExecuteCompiledRepositoryChangeInput {
  readonly repositoryRoot: string;
  readonly compiled: CompiledRepositoryChange;
  readonly approval: ExecutionApproval;
  readonly attempt: LifecycleAttemptRecord;
  readonly store: ChangeLifecycleStore;
  readonly now?: () => string;
  readonly leaseStaleAfterMs?: number;
  readonly signal: AbortSignal;
}

class JournalExecutionAdapter implements TransformMutationPort, ChangeTransactionPort {
  private transaction: FileTransaction | undefined;
  private session: GovernedWorktreeSession | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private heartbeatPending: Promise<void> = Promise.resolve();
  private ownershipError: unknown;
  private heartbeatStopped = true;

  constructor(
    private readonly paths: RepositoryPathService,
    private readonly worktree: GovernedWorktreeRuntime,
    private readonly boundary: readonly string[],
    private readonly attempt: LifecycleAttemptRecord,
    private readonly binding: StateBinding,
    private readonly heartbeatIntervalMs: number,
  ) {}

  async begin(input: Parameters<ChangeTransactionPort["begin"]>[0]): Promise<ChangeTransaction> {
    if (this.transaction !== undefined || this.session !== undefined) throw new Error("lifecycle attempt already owns a transaction");
    const leaseBinding = { ...this.binding, compiledAgainst: input.beforeState };
    const session = await this.worktree.open({ sessionId: this.attempt.id, processId: process.pid, stateBinding: leaseBinding });
    this.session = session;
    this.startHeartbeatKeeper(this.heartbeatIntervalMs);
    try {
      const transaction = await session.begin({
        transactionId: this.attempt.transactionId,
        planId: input.planId,
        beforeState: input.beforeState,
        allowedWriteRoots: [...this.boundary],
      });
      this.transaction = transaction;
      const close = async (): Promise<void> => {
        await this.stopHeartbeatKeeper();
        this.transaction = undefined;
        const active = this.session;
        this.session = undefined;
        if (active !== undefined) await active.close();
      };
      return {
        get phase() { return transaction.entry.phase; },
        get lastCheckpointId() { return transaction.entry.checkpointIds.at(-1); },
        checkpoint: async (id) => { await this.assertOwned(); await transaction.checkpoint(id); },
        transition: async (phase) => { await this.assertOwned(); await transaction.transition(phase); },
        commit: async () => { await this.assertOwned(); await transaction.commit(); await close(); },
        rollback: async () => {
          await this.assertOwned();
          try { await transaction.rollback(); } finally { await close(); }
        },
      };
    } catch (error) {
      await this.stopHeartbeatKeeper();
      this.session = undefined;
      try {
        await session.close();
      } catch (closeError) {
        throw new AggregateError([error, closeError], "lifecycle transaction failed and the writer lease could not be released");
      }
      throw error;
    }
  }

  async readFile(path: string): Promise<string | undefined> {
    try { return await readFile((await this.paths.resolveScopedRead(path, this.boundary)).realTarget, "utf8"); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined; throw error; }
  }

  async assertWritable(path: string): Promise<void> {
    await this.paths.resolveScopedWrite(path, this.boundary);
  }

  async moveFile(from: string, to: string): Promise<void> {
    await this.assertOwned();
    await this.active().moveFile(from, to);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.assertOwned();
    await this.active().writeFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await this.assertOwned();
    await this.active().deleteFile(path);
  }

  async checkpoint(id: string): Promise<void> {
    await this.assertOwned();
    await this.active().checkpoint(id);
  }

  async runWhileOwned<T>(operation: () => Promise<T>, intervalMs = 5_000): Promise<T> {
    void intervalMs;
    await this.assertOwned();
    const result = await operation();
    await this.assertOwned();
    return result;
  }

  private active(): FileTransaction {
    if (this.transaction === undefined) throw new Error("governed mutation attempted outside the durable lifecycle transaction");
    return this.transaction;
  }

  private async assertOwned(): Promise<void> {
    if (this.ownershipError !== undefined) throw this.ownershipError;
    if (this.session === undefined) throw new Error("governed mutation attempted without an active writer lease");
    await this.session.heartbeat();
    if (this.ownershipError !== undefined) throw this.ownershipError;
  }

  private startHeartbeatKeeper(intervalMs = 5_000): void {
    this.heartbeatStopped = false;
    this.ownershipError = undefined;
    const schedule = (): void => {
      this.heartbeatTimer = setTimeout(() => {
        const session = this.session;
        this.heartbeatPending = (session === undefined ? Promise.reject(new Error("writer lease session disappeared")) : session.heartbeat())
          .catch((error: unknown) => { this.ownershipError = error; })
          .finally(() => { if (!this.heartbeatStopped && this.ownershipError === undefined) schedule(); });
      }, intervalMs);
      this.heartbeatTimer.unref();
    };
    schedule();
  }

  private async stopHeartbeatKeeper(): Promise<void> {
    this.heartbeatStopped = true;
    if (this.heartbeatTimer !== undefined) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    await this.heartbeatPending;
  }
}

function validationPath(validatorId: string): { path: string; independenceGroup: string; authorSource: string } | undefined {
  const independent = "node-independent:";
  const supplemental = "node-supplemental:";
  if (validatorId.startsWith(independent)) return { path: validatorId.slice(independent.length), independenceGroup: `git-base:${validatorId.slice(independent.length)}`, authorSource: "tracked-git-base" };
  if (validatorId.startsWith(supplemental)) return { path: validatorId.slice(supplemental.length), independenceGroup: `proposal:${validatorId.slice(supplemental.length)}`, authorSource: "authenticated-proposal" };
  return undefined;
}

interface RepositoryPostObservation {
  readonly version: 1;
  readonly beforeState: StateDigest;
  readonly afterState: StateDigest;
  readonly exactWrites: readonly {
    readonly path: string;
    readonly unitId: string;
    readonly expectedAfterHash: string;
    readonly observedAfterHash: string;
    readonly matches: boolean;
  }[];
  readonly unitStates: readonly { readonly unitId: string; readonly state: "valid" | "removed" | "exception" }[];
  readonly changedConceptIds: readonly string[];
  readonly changedRequirementIds: readonly string[];
  readonly changedScenarioIds: readonly string[];
  readonly changedRelationIds: readonly string[];
  readonly predictedChangedPaths: readonly string[];
  readonly observedChangedPaths: readonly string[];
  readonly observedChangedCanonicalIds: readonly string[];
  readonly unexpectedChangedPaths: readonly string[];
  readonly unexpectedChangedCanonicalIds: readonly string[];
  readonly newAnalyzerFailures: readonly string[];
  readonly planningSurpriseIds: readonly string[];
  readonly unknowns: readonly string[];
  readonly reconciliationHash: string;
  readonly contentHash: string;
}

async function observeAppliedRepositoryChange(
  compiled: CompiledRepositoryChange,
  observation: ChangeRepositoryObservation,
  paths: RepositoryPathService,
): Promise<RepositoryPostObservation> {
  const exactWrites = await Promise.all(compiled.exactPatchInput.edits.map(async (edit) => {
    let content: string | null;
    try { content = await readFile((await paths.resolveRead(edit.path)).realTarget, "utf8"); }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") content = null; else throw error; }
    const expectedAfterHash = hashFramedDomain("transform-content", edit.after);
    const observedAfterHash = hashFramedDomain("transform-content", content);
    return { path: edit.path, unitId: edit.unitId, expectedAfterHash, observedAfterHash, matches: content === edit.after };
  }));
  const beforeFiles = new Map(compiled.baselineObservation.files.map(({ path, contentHash }) => [path, contentHash]));
  const afterFiles = new Map(observation.analysis.files.map(({ path, contentHash }) => [path, contentHash]));
  const observedChangedPaths = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])]
    .filter((path) => beforeFiles.get(path) !== afterFiles.get(path)).sort();
  const predictedChangedPaths = compiled.exactPatchInput.edits
    .filter(({ path, before, after }) => !path.startsWith(".projector/") && before !== after)
    .map(({ path }) => path).sort();
  const unexpectedChangedPaths = observedChangedPaths.filter((path) => !predictedChangedPaths.includes(path));
  const beforeCanonical = new Map(compiled.baselineObservation.canonicalEntries.map(({ entityId, canonicalDocumentHash }) => [entityId, canonicalDocumentHash]));
  const afterCanonical = new Map(observation.canonical.entries.map(({ entityId, canonicalDocumentHash }) => [entityId, canonicalDocumentHash]));
  const observedChangedCanonicalIds = [...new Set([...beforeCanonical.keys(), ...afterCanonical.keys()])]
    .filter((id) => beforeCanonical.get(id) !== afterCanonical.get(id)).sort();
  const predictedCanonicalIds = compiled.canonicalWrites.filter(({ before, after }) => before !== after).map(({ id }) => id).sort();
  const unexpectedChangedCanonicalIds = observedChangedCanonicalIds.filter((id) => !predictedCanonicalIds.includes(id));
  const afterUnits = new Map(observation.analysis.projectionUnits.map((unit) => [unit.id, unit]));
  const beforeUnits = new Map(compiled.baselineObservation.units.map((unit) => [unit.id, unit]));
  const exactByUnit = new Map(exactWrites.map((write) => [write.unitId, write]));
  const canonicalByUnit = new Map(compiled.canonicalWrites.map((write) => [write.id, write]));
  const unitStates = compiled.compiledPlan.plan.completionCriteria.requiredUnitStates.map(({ unitId }) => ({
    unitId,
    state: (() => {
      const exact = exactByUnit.get(unitId);
      if (exact !== undefined) return exact.matches ? "valid" as const : "exception" as const;
      const canonical = canonicalByUnit.get(unitId);
      if (canonical !== undefined) {
        const document = observation.canonical.documents.find(({ id }) => id === unitId);
        return canonical.after === null
          ? document === undefined ? "valid" as const : "exception" as const
          : document !== undefined && canonicalJson(document) === canonicalJson(canonical.envelope) ? "valid" as const : "exception" as const;
      }
      const before = beforeUnits.get(unitId);
      const after = afterUnits.get(unitId);
      return before !== undefined && after !== undefined && after.validity === "valid" && before.membershipHash === after.membershipHash
        ? "valid" as const
        : "exception" as const;
    })(),
  }));
  const changedCanonicalIdsForKind = (expectedKind: typeof compiled.canonicalWrites[number]["kind"]): string[] => compiled.canonicalWrites.filter(({ id, kind, envelope, after }) => kind === expectedKind
    && observedChangedCanonicalIds.includes(id)
    && (after === null
      ? observation.canonical.documents.every((document) => document.id !== id)
      : canonicalJson(observation.canonical.documents.find((document) => document.id === id)) === canonicalJson(envelope))).map(({ id }) => id).sort();
  const changedConceptIds = changedCanonicalIdsForKind("concept");
  const changedRequirementIds = changedCanonicalIdsForKind("requirement");
  const changedScenarioIds = changedCanonicalIdsForKind("behavioral-scenario");
  const changedRelationIds = changedCanonicalIdsForKind("relation");
  const baselineFailures = new Set(compiled.baselineObservation.analyzerFailures.map((failure) => canonicalJson(failure)));
  const newAnalyzerFailures = observation.analysis.failures.map(({ analyzerId, capability, scope, message, affectedClaimKinds }) => ({ analyzerId, capability, scope, message, affectedClaimKinds: [...affectedClaimKinds].sort() }))
    .filter((failure) => !baselineFailures.has(canonicalJson(failure)))
    .map((failure) => `${failure.analyzerId}:${failure.capability}:${failure.scope}:${failure.message}`).sort();
  const surpriseClaims = [
    ...unexpectedChangedPaths.map((path) => `unexpected-path:${path}`),
    ...unexpectedChangedCanonicalIds.map((id) => `unexpected-canonical-entity:${id}`),
    ...newAnalyzerFailures.map((failure) => `new-analyzer-failure:${failure}`),
  ];
  const planningSurpriseIds = surpriseClaims.map((claim) => `planning_surprise_${hashFramedDomain("repository-change-planning-surprise", claim).slice(-32)}`).sort();
  const unknowns = newAnalyzerFailures.map((failure) => `new analyzer failure: ${failure}`);
  const reconciliation = {
    exactWrites,
    unitStates,
    baselineObservationHash: compiled.baselineObservation.contentHash,
    canonicalRootDigest: observation.canonical.rootDigest,
    changedConceptIds,
    changedRequirementIds,
    changedScenarioIds,
    changedRelationIds,
    predictedChangedPaths,
    observedChangedPaths,
    observedChangedCanonicalIds,
    unexpectedChangedPaths,
    unexpectedChangedCanonicalIds,
    newAnalyzerFailures,
    planningSurpriseIds,
    unknowns,
  };
  const reconciliationHash = hashFramedDomain("repository-change-reconciliation", reconciliation);
  const basis = {
    version: 1 as const,
    beforeState: compiled.compiledPlan.plan.boundState.compiledAgainst,
    afterState: observation.state,
    exactWrites,
    unitStates,
    changedConceptIds,
    changedRequirementIds,
    changedScenarioIds,
    changedRelationIds,
    predictedChangedPaths,
    observedChangedPaths,
    observedChangedCanonicalIds,
    unexpectedChangedPaths,
    unexpectedChangedCanonicalIds,
    newAnalyzerFailures,
    planningSurpriseIds,
    unknowns,
    reconciliationHash,
  };
  return { ...basis, contentHash: hashFramedDomain("repository-change-post-observation", basis) };
}

function postObservationValidation(observation: RepositoryPostObservation, startedAt: string, completedAt: string, impact: RepositoryImpactReport, impactProofHash: ContentHash): ValidationResult {
  const invalidWrites = observation.exactWrites.filter(({ matches }) => !matches).map(({ path }) => path);
  const invalidUnits = observation.unitStates.filter(({ state }) => state !== "valid").map(({ unitId }) => unitId);
  const passed = invalidWrites.length === 0 && invalidUnits.length === 0 && observation.planningSurpriseIds.length === 0 && observation.unknowns.length === 0 && impact.surprises.length === 0 && impact.blockedUnitIds.length === 0;
  return {
    validatorId: "projector.repository-post-observation",
    status: passed ? "passed" : "failed",
    summary: passed ? "authenticated post-change observation matches the approved writes and required unit states" : "post-change repository observation does not reconcile with the approved plan",
    evidenceIds: [`evidence_${observation.contentHash.slice(-32)}`],
    evidenceLane: "runtime",
    independenceGroup: "projector.repository-observer",
    assurance: "exact",
    authorSource: "projector.local-repository@1",
    sideEffectClass: "none",
    details: { observation, impact, impactProofHash },
    startedAt,
    completedAt,
  };
}

async function runNodeValidators(
  launcher: ProcessLauncher,
  repositoryRoot: string,
  paths: RepositoryPathService,
  validatorIds: readonly string[],
  independentValidators: CompiledRepositoryChange["independentValidators"],
  independentValidatorProjections: ReadonlyMap<string, string>,
  signal: AbortSignal,
  now: () => string,
  runWhileOwned: <T>(operation: () => Promise<T>) => Promise<T>,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const validatorId of validatorIds) {
    const validator = validationPath(validatorId);
    if (validator === undefined) continue;
    const startedAt = now();
    const expected = independentValidators.find(({ path }) => path === validator.path)?.contentHash;
    const projectionSource = independentValidatorProjections.get(validator.path);
    const contentPath = (await paths.resolveRead(validator.path)).realTarget;
    const beforeContentHash = hashFramedDomain("transform-content", await readFile(contentPath, "utf8"));
    const identityEvidenceId = `evidence_${hashFramedDomain("validator-execution-identity", {
      validatorId,
      expectedContentHash: expected ?? beforeContentHash,
      beforeContentHash,
    }).slice(-32)}`;
    if (expected !== undefined && (beforeContentHash !== expected || projectionSource === undefined)) {
      results.push({
        validatorId,
        status: "blocked",
        summary: `sandboxed Node validator identity changed before execution: ${validator.path}`,
        evidenceIds: [identityEvidenceId],
        evidenceLane: "test",
        independenceGroup: validator.independenceGroup,
        assurance: "strong",
        authorSource: validator.authorSource,
        sideEffectClass: "none",
        details: { expectedContentHash: expected, beforeContentHash, projectionAvailable: projectionSource !== undefined },
        startedAt,
        completedAt: now(),
      });
      continue;
    }
    const execution = await runWhileOwned(() => launcher.launch({
      executable: process.execPath,
      args: [validator.path],
      cwd: repositoryRoot,
      env: {},
      readRoots: [repositoryRoot],
      writeRoots: [],
      ...(projectionSource === undefined ? {} : {
        readOnlyFileOverlays: [{ source: projectionSource, target: contentPath }],
      }),
      network: "deny",
      timeoutMs: 30_000,
      maxOutputBytes: 256 * 1_024,
      signal,
    }));
    const afterContentHash = hashFramedDomain("transform-content", await readFile(contentPath, "utf8"));
    const identityCurrent = afterContentHash === beforeContentHash && (expected === undefined || afterContentHash === expected);
    const passed = execution.exitCode === 0 && identityCurrent;
    results.push({
      validatorId,
      status: passed ? "passed" : "failed",
      summary: passed
        ? `sandboxed Node validator passed with stable content identity: ${validator.path}`
        : identityCurrent
          ? `sandboxed Node validator failed: ${validator.path}`
          : `sandboxed Node validator identity changed during execution: ${validator.path}`,
      evidenceIds: [identityEvidenceId],
      evidenceLane: "test",
      independenceGroup: validator.independenceGroup,
      assurance: "strong",
      authorSource: validator.authorSource,
      sideEffectClass: "none",
      details: {
        expectedContentHash: expected ?? beforeContentHash,
        beforeContentHash,
        afterContentHash,
        executedContentHash: expected ?? beforeContentHash,
        executionSource: projectionSource === undefined ? "live-proposal-validator" : "immutable-captured-overlay",
        exitCode: execution.exitCode,
        signal: execution.signal,
        stdout: execution.stdout,
        stderr: execution.stderr,
      },
      startedAt,
      completedAt: now(),
    });
  }
  return results;
}

export async function executeCompiledRepositoryChange(
  input: ExecuteCompiledRepositoryChangeInput,
): Promise<StateBoundChangeResult> {
  const packet = input.compiled.compiledPlan.packets[0];
  if (packet === undefined || input.compiled.compiledPlan.packets.length !== 1) throw new Error("initial repository lifecycle requires exactly one compiled packet");
  const plan = input.compiled.compiledPlan.plan;
  const capsule: ExecutionCapsule = packet.capsule;
  if (input.approval.capsuleId !== capsule.id) throw new Error("execution approval belongs to another capsule");

  // Selection performs a live isolation probe. It must succeed before a lease or journal begins.
  const launcher = input.compiled.executionKind === "canonical-only" ? undefined : await createSandboxLauncher();
  if (input.compiled.independentValidators.length > 0 && launcher?.capabilities.readOnlyFileOverlays !== true) {
    throw new Error("selected sandbox cannot capability-prove immutable validator file overlays");
  }
  const paths = await RepositoryPathService.create(input.repositoryRoot);
  const independentValidatorProjections = new Map<string, string>();
  for (const validator of input.compiled.independentValidators) {
    const reference = await input.store.writeValidatorProjection(validator.contentHash, validator.content);
    independentValidatorProjections.set(validator.path, (await paths.resolveRead(reference)).realTarget);
  }
  const journal = new FileTransactionJournal(paths);
  const leaseStaleAfterMs = input.leaseStaleAfterMs ?? 30_000;
  const worktree = new GovernedWorktreeRuntime(new WriterLeaseManager(paths, { staleAfterMs: leaseStaleAfterMs }), journal);
  const transaction = new JournalExecutionAdapter(paths, worktree, plan.boundary, input.attempt, plan.boundState, Math.max(10, Math.min(5_000, Math.floor(leaseStaleAfterMs / 3))));
  const exact = new ExactTextPatchTransform(transaction, { ...(input.now === undefined ? {} : { now: input.now }) });
  const now = input.now ?? (() => new Date().toISOString());
  const liveObservation = async (): Promise<ChangeRepositoryObservation> => observeChangeRepository(input.repositoryRoot);
  const dependencyScopedValidator = new DependencyScopedStateBindingValidator({
    values: {
      readVersionHash: async (dependency) => {
        const observation = await liveObservation();
        if (dependency.id.startsWith("path:")) {
          const path = dependency.id.slice("path:".length);
          let content: string | null;
          try { content = await readFile((await paths.resolveRead(path)).realTarget, "utf8"); }
          catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") content = null; else throw error; }
          return hashFramedDomain("transform-content", content);
        }
        if (dependency.id.startsWith("independent-validator:")) return (await observation.independentValidator(dependency.id.slice("independent-validator:".length))).contentHash;
        if (dependency.id === "canonical-root") return observation.canonical.rootDigest;
        if (dependency.id === "projector.local-repository") return observation.state.toolchainDigest;
        if (dependency.id.startsWith("proposal:")) return input.compiled.proposalHash;
        if (dependency.id === "repository-impact-proof") {
          const snapshot = buildRepositoryImpactSnapshot(observation);
          const prediction = await predictRepositoryImpact(snapshot, input.compiled.exactPatchInput.edits.filter(({ path }) => !path.startsWith(".projector/")).map(({ path }) => path), input.compiled.canonicalWrites);
          return repositoryImpactProofHash(snapshot, prediction);
        }
        if (dependency.id.startsWith("knowledge-context:")) {
          const retained = input.compiled.knowledgeContext;
          return retained !== undefined && dependency.id === `knowledge-context:${retained.id}` ? retained.contentHash : undefined;
        }
        if (dependency.id === "architecture-discovery") return dependency.versionHash;
        return undefined;
      },
    },
    queries: {
      evaluate: async (query, context) => createChangeQueryRegistry({ observation: await liveObservation(), now: now() }).evaluate(query, context),
    },
  });
  const bindingValidator = {
    validate: async (...arguments_: Parameters<typeof dependencyScopedValidator.validate>) => {
      const validation = await dependencyScopedValidator.validate(...arguments_);
      return validation.status === "rebound"
        ? { ...validation, status: "current" as const, reasons: ["all approval-scoped value and query dependencies remain current"] }
        : validation;
    },
  };
  let postObservation: RepositoryPostObservation | undefined;
  let refreshedImpact: RepositoryImpactSnapshot | undefined;
  const transform = {
    preview: (transformInput: ExactTextPatchInput, context: TransformContext) => exact.preview(transformInput, context),
    apply: (transformInput: ExactTextPatchInput, context: TransformContext) => exact.apply(transformInput, context),
    verify: async (result: TransformResult, context: TransformContext) => {
      const validations = [
        ...await exact.verify(result, context),
        ...(launcher === undefined ? [] : await runNodeValidators(
        launcher,
        input.repositoryRoot,
        paths,
        capsule.requiredValidations,
        input.compiled.independentValidators,
        independentValidatorProjections,
        context.signal,
        now,
        (operation) => transaction.runWhileOwned(operation),
      )),
      ];
      const observationStartedAt = now();
      const observation = await observeChangeRepository(input.repositoryRoot);
      postObservation = await observeAppliedRepositoryChange(input.compiled, observation, paths);
      refreshedImpact = buildRepositoryImpactSnapshot(observation);
      const impact = await reconcileRepositoryImpact(input.compiled.derivationImpact.baseline, refreshedImpact, plan.completionCriteria.requiredUnitStates.map(({ unitId }) => unitId), plan.id, input.compiled.exactPatchInput.edits.map(({ path }) => path));
      const modelIntegrity: ValidationResult = {
        validatorId: "projector.canonical-model-integrity",
        status: "passed",
        summary: "authenticated canonical documents, references, and eligible active lenses match the approved model-only transaction",
        evidenceIds: [`evidence_${postObservation.contentHash.slice(-32)}`],
        evidenceLane: "runtime",
        independenceGroup: "projector.canonical-repository",
        assurance: "exact",
        authorSource: "projector.canonical-repository@2",
        sideEffectClass: "none",
        details: { canonicalEntityIds: input.compiled.canonicalWrites.map(({ id }) => id), implementationFidelityAssessed: false },
        startedAt: observationStartedAt,
        completedAt: now(),
      };
      return [...validations, postObservationValidation(postObservation, observationStartedAt, now(), impact, input.compiled.derivationImpact.contentHash),
        ...(input.compiled.executionKind === "canonical-only"
          ? [modelIntegrity, await validateCanonicalDecisionBaselines(input.compiled, observation, observationStartedAt, now, context.signal)]
          : [await validatePostChangeKnowledge(input.compiled, observation, observationStartedAt, now, context.signal)])];
    },
  };
  const executor = new StateBoundChangeExecutor<ExactTextPatchInput>({
    state: { current: async () => (await observeChangeRepository(input.repositoryRoot)).state },
    bindingValidator,
    transform,
    transactions: transaction,
    artifacts: { write: (kind, hash, content) => input.store.writeArtifact(kind, hash, content) },
    completion: {
      assess: async () => {
        if (postObservation === undefined) throw new Error("completion requires an authenticated post-change repository observation");
        return {
        unitStates: postObservation.unitStates,
        newDivergenceIds: postObservation.planningSurpriseIds,
        unknowns: postObservation.unknowns,
        unavailableActions: [], availableArtifacts: [], cleanWorkingTree: false,
        };
      },
    },
    successDurability: {
      prepare: async (success) => {
        if (postObservation === undefined || canonicalJson(success.afterState) !== canonicalJson(postObservation.afterState)) {
          throw new Error("prepared success state does not match the authenticated post-change observation");
        }
        await input.store.prepareAttemptSuccess(input.attempt.id, success);
      },
    },
    changedCanonicalEntityIds: () => input.compiled.canonicalWrites.map(({ id }) => id),
    changedConceptIds: () => postObservation?.changedConceptIds ?? [],
    changedRequirementIds: () => postObservation?.changedRequirementIds ?? [],
    changedScenarioIds: () => postObservation?.changedScenarioIds ?? [],
    changedRelationIds: () => postObservation?.changedRelationIds ?? [],
    planningSurpriseIds: () => postObservation?.planningSurpriseIds ?? [],
    environment: { repositoryRoot: input.repositoryRoot, signal: input.signal },
    ...(input.now === undefined ? {} : { now: input.now }),
  });
  const result = await executor.execute({ plan, capsule, approval: input.approval, transformInput: input.compiled.exactPatchInput });
  if (result.outcome === "success" && refreshedImpact !== undefined) await persistRepositoryImpactSnapshot(input.repositoryRoot, refreshedImpact);
  return result;
}
