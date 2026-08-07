import {
  canonicalJson,
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ChangeCertificate,
  type ContentHash,
  type EntityId,
  type ExecutionPlan,
  type RiskClass,
  type StateBinding,
  type StateBindingValidator,
  type StateDigest,
  type TransactionPhase,
  type TransactionReceipt,
  type TransformContext,
  type TransformPreview,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export interface ExecutionApproval {
  readonly id: EntityId;
  readonly planId: EntityId;
  readonly planRevision: number;
  readonly planHash: ContentHash;
  readonly dependencyDigest: ContentHash;
}

export function executionPlanHash(plan: ExecutionPlan): ContentHash {
  return hashFramedDomain("execution-plan", plan);
}

export function createExecutionApproval(plan: ExecutionPlan, id: EntityId): Readonly<ExecutionApproval> {
  return Object.freeze({
    id,
    planId: plan.id,
    planRevision: plan.revision,
    planHash: executionPlanHash(plan),
    dependencyDigest: plan.boundState.dependencyDigest,
  });
}

export interface CurrentStatePort {
  current(): Promise<StateDigest>;
}

/** Engine-only transform facade; the composition root may adapt a runtime registry entry. */
export interface DeterministicTransformPort<TInput> {
  preview(input: TInput, context: TransformContext): Promise<TransformPreview>;
  apply(input: TInput, context: TransformContext): Promise<TransformResult>;
  verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]>;
}

export interface ChangeTransaction {
  readonly phase: TransactionPhase;
  readonly lastCheckpointId: string | undefined;
  checkpoint(id: string): Promise<void>;
  transition(phase: "workspace-staged" | "validating" | "canonical-staging" | "committing"): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ChangeTransactionPort {
  begin(input: {
    planId: EntityId;
    beforeState: StateDigest;
    boundState: StateBinding;
    allowedUnits: readonly EntityId[];
  }): Promise<ChangeTransaction>;
}

/** Implementations persist under policy-selected ignored/canonical roots. */
export interface ChangeArtifactStore {
  write(kind: "certificate" | "receipt", hash: ContentHash, content: string): Promise<string>;
}

export interface ChangeCertificateArtifact {
  readonly version: 1;
  readonly outcome: ChangeOutcome;
  readonly lastCheckpointId?: string;
  readonly journalPhase: TransactionPhase | "not-started";
  readonly recoveryState: "not-required" | "rolled-back" | "recovery-required";
  readonly reasons: readonly string[];
  readonly certificate: ChangeCertificate;
}

export type ChangeOutcome = "success" | "failure" | "partial";

export interface StateBoundChangeResult {
  readonly outcome: ChangeOutcome;
  readonly reasons: readonly string[];
  readonly preview?: TransformPreview;
  readonly transformResult?: TransformResult;
  readonly validations: readonly ValidationResult[];
  readonly certificate: ChangeCertificate;
  readonly certificateHash: ContentHash;
  readonly certificateRef: string;
  readonly receipt: TransactionReceipt;
  readonly receiptHash: ContentHash;
  readonly receiptRef: string;
}

export interface ExecuteStateBoundChangeInput<TInput> {
  readonly plan: ExecutionPlan;
  readonly capsule: Pick<import("@projector/core").ExecutionCapsule, "id" | "boundState" | "requiredValidations">;
  readonly approval: ExecutionApproval;
  readonly transformInput: TInput;
  readonly repositoryRoot: string;
  readonly riskClass: RiskClass;
  readonly allowedUnits: readonly EntityId[];
}

export interface StateBoundChangeExecutorOptions<TInput> {
  state: CurrentStatePort;
  bindingValidator: StateBindingValidator;
  transform: DeterministicTransformPort<TInput>;
  transactions: ChangeTransactionPort;
  artifacts: ChangeArtifactStore;
  now?: () => string;
}

interface AttemptState {
  preview?: TransformPreview;
  result?: TransformResult;
  validations: ValidationResult[];
  transaction?: ChangeTransaction;
}

interface PartialTransformError extends Error {
  partialResult?: TransformResult;
}

function isApprovalCurrent(plan: ExecutionPlan, approval: ExecutionApproval): boolean {
  return approval.planId === plan.id
    && approval.planRevision === plan.revision
    && approval.planHash === executionPlanHash(plan)
    && approval.dependencyDigest === plan.boundState.dependencyDigest;
}

function normalizeValidations(validations: readonly ValidationResult[]): ValidationResult[] {
  return [...validations].map((validation) => ({
    ...structuredClone(validation),
    evidenceIds: sortedUnique(validation.evidenceIds),
  })).sort((left, right) =>
    compareStrings(left.validatorId, right.validatorId)
    || compareStrings(left.independenceGroup, right.independenceGroup));
}

function validationReasons(required: readonly string[], validations: readonly ValidationResult[]): string[] {
  const byId = new Map(validations.map((validation) => [validation.validatorId, validation]));
  const reasons: string[] = [];
  for (const validatorId of sortedUnique(required)) {
    const result = byId.get(validatorId);
    if (result === undefined) reasons.push(`required validation missing: ${validatorId}`);
    else if (result.status !== "passed") reasons.push(`required validation ${validatorId} ${result.status}`);
  }
  return reasons;
}

export class StateBoundChangeExecutor<TInput> {
  private readonly state: CurrentStatePort;
  private readonly bindingValidator: StateBindingValidator;
  private readonly transform: DeterministicTransformPort<TInput>;
  private readonly transactions: ChangeTransactionPort;
  private readonly artifacts: ChangeArtifactStore;
  private readonly now: () => string;

  constructor(options: StateBoundChangeExecutorOptions<TInput>) {
    this.state = options.state;
    this.bindingValidator = options.bindingValidator;
    this.transform = options.transform;
    this.transactions = options.transactions;
    this.artifacts = options.artifacts;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(input: ExecuteStateBoundChangeInput<TInput>): Promise<StateBoundChangeResult> {
    const beforeState = await this.state.current();
    const attempt: AttemptState = { validations: [] };
    const preflightReasons: string[] = [];

    if (!isApprovalCurrent(input.plan, input.approval)) {
      preflightReasons.push("approval does not match the immutable execution plan");
    }
    if (canonicalJson(input.capsule.boundState) !== canonicalJson(input.plan.boundState)) {
      preflightReasons.push("execution capsule does not match the plan state binding");
    }

    const adapterContext: AdapterContext = {
      repositoryRoot: input.repositoryRoot,
      stateDigest: beforeState,
      config: {},
      signal: new AbortController().signal,
    };
    const executionBinding = input.plan.boundState;
    if (preflightReasons.length === 0) {
      const bindingValidation = await this.bindingValidator.validate(input.plan.boundState, beforeState, adapterContext);
      if (bindingValidation.status === "rebound") {
        preflightReasons.push(
          "state binding requires an explicit plan rebind and new approval",
          ...bindingValidation.reasons,
        );
      } else if (bindingValidation.status !== "current") {
        preflightReasons.push(
          `state binding is ${bindingValidation.status}`,
          ...bindingValidation.reasons,
        );
      }
    }

    if (preflightReasons.length > 0) {
      return this.finalize(input, beforeState, await this.state.current(), "failure", preflightReasons, attempt);
    }

    const transformContext: TransformContext = {
      repositoryRoot: input.repositoryRoot,
      stateBinding: executionBinding,
      allowedUnits: sortedUnique(input.allowedUnits),
      dryRun: false,
      signal: adapterContext.signal,
    };

    try {
      attempt.preview = await this.transform.preview(input.transformInput, transformContext);
      if (!attempt.preview.applicable) {
        return this.finalize(input, beforeState, await this.state.current(), "success", [], attempt);
      }
      attempt.transaction = await this.transactions.begin({
        planId: input.plan.id,
        beforeState,
        boundState: executionBinding,
        allowedUnits: transformContext.allowedUnits,
      });
      await attempt.transaction.checkpoint("before-transform");
      attempt.result = await this.transform.apply(input.transformInput, transformContext);
      await attempt.transaction.transition("workspace-staged");
      await attempt.transaction.transition("validating");
      attempt.validations = normalizeValidations(await this.transform.verify(attempt.result, transformContext));
      const failedValidations = validationReasons(
        [...input.plan.completionCriteria.requiredValidators, ...input.capsule.requiredValidations],
        attempt.validations,
      );
      if (failedValidations.length > 0) {
        await attempt.transaction.rollback();
        const outcome: ChangeOutcome = attempt.result.changed ? "partial" : "failure";
        return this.finalize(input, beforeState, await this.state.current(), outcome, failedValidations, attempt);
      }
      await attempt.transaction.checkpoint("after-validation");
      await attempt.transaction.transition("canonical-staging");
      const afterState = await this.state.current();
      const finalized = await this.finalize(input, beforeState, afterState, "success", [], attempt);
      await attempt.transaction.transition("committing");
      await attempt.transaction.commit();
      return finalized;
    } catch (caught) {
      const error = caught as PartialTransformError;
      if (error.partialResult !== undefined) attempt.result = error.partialResult;
      const changed = attempt.result?.changed === true;
      if (attempt.transaction !== undefined) {
        try {
          await attempt.transaction.rollback();
        } catch {
          // The certificate carries the journal phase and recovery requirement below.
        }
      }
      return this.finalize(
        input,
        beforeState,
        await this.state.current(),
        changed ? "partial" : "failure",
        [error instanceof Error ? error.message : "deterministic transform failed"],
        attempt,
      );
    }
  }

  private async finalize(
    input: ExecuteStateBoundChangeInput<TInput>,
    beforeState: StateDigest,
    afterState: StateDigest,
    outcome: ChangeOutcome,
    reasons: readonly string[],
    attempt: AttemptState,
  ): Promise<StateBoundChangeResult> {
    const createdAt = this.now();
    const operations = attempt.result?.operations ?? [];
    const changedUnits = sortedUnique(attempt.result?.touchedUnitIds ?? []);
    const transactionPhase = attempt.transaction?.phase ?? "not-started";
    const rollbackSucceeded = transactionPhase === "rolled-back";
    const recoveryState = outcome === "success" || transactionPhase === "not-started" || transactionPhase === "committed"
      ? "not-required"
      : rollbackSucceeded ? "rolled-back" : "recovery-required";
    const certificate: ChangeCertificate = {
      id: `certificate:${input.plan.id}:${input.approval.id}`,
      planId: input.plan.id,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      changedConcepts: [],
      changedRequirements: [],
      changedScenarios: [],
      changedRelations: [],
      changedUnits,
      planningSurpriseIds: [],
      deterministicOperations: structuredClone(operations),
      agentOperations: [],
      validations: normalizeValidations(attempt.validations),
      divergencesResolved: [],
      divergencesIntroduced: [],
      modeledBoundary: sortedUnique(input.plan.boundary),
      completeness: outcome === "success" ? "bounded" : outcome === "partial" ? "partial" : "not-established",
      unknowns: sortedUnique(reasons),
      unavailableActions: [],
      rollback: outcome === "success" ? [] : [{
        kind: recoveryState === "rolled-back" ? "git-checkpoint" : "manual",
        ...(attempt.transaction?.lastCheckpointId === undefined
          ? {}
          : { checkpointId: attempt.transaction.lastCheckpointId }),
        ...(recoveryState === "recovery-required" ? { instructions: "inspect the durable transaction journal" } : {}),
      }],
      createdAt,
    };
    const artifact: ChangeCertificateArtifact = {
      version: 1,
      outcome,
      ...(attempt.transaction?.lastCheckpointId === undefined
        ? {}
        : { lastCheckpointId: attempt.transaction.lastCheckpointId }),
      journalPhase: transactionPhase,
      recoveryState,
      reasons: sortedUnique(reasons),
      certificate,
    };
    const certificateHash = hashFramedDomain("change-certificate-artifact", artifact);
    const certificateRef = await this.artifacts.write("certificate", certificateHash, canonicalJson(artifact));
    const validationSummaryHash = hashFramedDomain("validation-summary", certificate.validations);
    const receiptWithoutHash: Omit<TransactionReceipt, "semanticHash"> = {
      id: `receipt:${input.plan.id}:${input.approval.id}`,
      planId: input.plan.id,
      riskClass: input.riskClass,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      changedCanonicalEntityIds: [],
      changedRequirementIds: [],
      changedScenarioIds: [],
      changedUnitIds: changedUnits,
      validationSummaryHash,
      certificateHash,
      createdAt,
    };
    const receipt: TransactionReceipt = {
      ...receiptWithoutHash,
      semanticHash: hashSemantic("transaction-receipt", receiptWithoutHash),
    };
    const receiptHash = hashFramedDomain("transaction-receipt-artifact", receipt);
    const receiptRef = await this.artifacts.write("receipt", receiptHash, canonicalJson(receipt));
    return {
      outcome,
      reasons: sortedUnique(reasons),
      ...(attempt.preview === undefined ? {} : { preview: attempt.preview }),
      ...(attempt.result === undefined ? {} : { transformResult: attempt.result }),
      validations: certificate.validations,
      certificate,
      certificateHash,
      certificateRef,
      receipt,
      receiptHash,
      receiptRef,
    };
  }
}
