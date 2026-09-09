import {
  canonicalJson,
  compileWriteAuthorization,
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ChangeCertificate,
  type CompiledWriteAuthorization,
  type ContentHash,
  type EntityId,
  type ExecutionCapsule,
  type ExecutionPlan,
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

export * from "./compiler.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export interface ExecutionApproval {
  readonly id: EntityId;
  readonly planId: EntityId;
  readonly planRevision: number;
  readonly planHash: ContentHash;
  readonly dependencyDigest: ContentHash;
  readonly capsuleId: EntityId;
  readonly capsuleHash: ContentHash;
}

export function executionPlanHash(plan: ExecutionPlan): ContentHash {
  return hashFramedDomain("execution-plan", plan);
}

export function executionCapsuleHash(capsule: ExecutionCapsule): ContentHash {
  return hashFramedDomain("approved-execution-capsule", capsule);
}

export function createExecutionApproval(
  plan: ExecutionPlan,
  capsule: ExecutionCapsule,
  id: EntityId,
): Readonly<ExecutionApproval> {
  return Object.freeze({
    id,
    planId: plan.id,
    planRevision: plan.revision,
    planHash: executionPlanHash(plan),
    dependencyDigest: plan.boundState.dependencyDigest,
    capsuleId: capsule.id,
    capsuleHash: executionCapsuleHash(capsule),
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

export interface ApprovedTransformContext extends TransformContext {
  readonly approvedBoundary: readonly string[];
  readonly writeAuthorization: CompiledWriteAuthorization;
  readonly capsuleId: EntityId;
  readonly capsuleHash: ContentHash;
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

export interface CompletionAssessment {
  readonly unitStates: ReadonlyArray<{
    unitId: EntityId;
    state: "valid" | "removed" | "exception";
  }>;
  readonly newDivergenceIds: readonly EntityId[];
  readonly unknowns: readonly string[];
  readonly unavailableActions: readonly string[];
  readonly availableArtifacts: readonly string[];
  readonly cleanWorkingTree: boolean;
}

export interface CompletionAssessmentPort {
  assess(input: {
    plan: ExecutionPlan;
    capsule: ExecutionCapsule;
    transformResult: TransformResult;
    validations: readonly ValidationResult[];
  }): Promise<CompletionAssessment>;
}

export interface ChangeCertificateArtifact {
  readonly version: 1;
  readonly outcome: ChangeOutcome;
  readonly lastCheckpointId?: string;
  readonly journalPhase: TransactionPhase | "not-started";
  readonly recoveryState: "not-required" | "rolled-back" | "recovery-required";
  readonly reasons: readonly string[];
  readonly completionAssessment?: CompletionAssessment;
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

export interface PreparedStateBoundChangeSuccess {
  readonly version: 1;
  readonly preparationId: string;
  readonly checkpointId: string;
  readonly planId: EntityId;
  readonly executionApprovalId: EntityId;
  readonly beforeState: StateDigest;
  readonly afterState: StateDigest;
  readonly preview?: TransformPreview;
  readonly transformResult: TransformResult;
  readonly validations: readonly ValidationResult[];
  readonly completionAssessment: CompletionAssessment;
  readonly certificateArtifact: ChangeCertificateArtifact;
  readonly certificateHash: ContentHash;
  readonly receipt: TransactionReceipt;
  readonly receiptHash: ContentHash;
  readonly contentHash: ContentHash;
}

export interface StateBoundSuccessDurabilityPort {
  prepare(success: PreparedStateBoundChangeSuccess): Promise<void>;
}

export interface ExecuteStateBoundChangeInput<TInput> {
  readonly plan: ExecutionPlan;
  readonly capsule: ExecutionCapsule;
  readonly approval: ExecutionApproval;
  readonly transformInput: TInput;
}

export interface StateBoundChangeExecutorOptions<TInput> {
  state: CurrentStatePort;
  bindingValidator: StateBindingValidator;
  transform: DeterministicTransformPort<TInput>;
  transactions: ChangeTransactionPort;
  artifacts: ChangeArtifactStore;
  completion: CompletionAssessmentPort;
  successDurability?: StateBoundSuccessDurabilityPort;
  /** Resolves canonical entity IDs from the approved transform result for receipt provenance. */
  changedCanonicalEntityIds?: (result: TransformResult) => readonly string[];
  changedConceptIds?: (result: TransformResult) => readonly string[];
  changedRequirementIds?: (result: TransformResult) => readonly string[];
  changedScenarioIds?: (result: TransformResult) => readonly string[];
  changedRelationIds?: (result: TransformResult) => readonly string[];
  planningSurpriseIds?: (result: TransformResult) => readonly string[];
  environment: {
    readonly repositoryRoot: string;
    readonly signal: AbortSignal;
  };
  now?: () => string;
}

interface AttemptState {
  preview?: TransformPreview;
  result?: TransformResult;
  validations: ValidationResult[];
  transaction?: ChangeTransaction;
  completionAssessment?: CompletionAssessment;
}

interface PartialTransformError extends Error {
  partialResult?: TransformResult;
}

function isApprovalCurrent(plan: ExecutionPlan, capsule: ExecutionCapsule, approval: ExecutionApproval): boolean {
  return approval.planId === plan.id
    && approval.planRevision === plan.revision
    && approval.planHash === executionPlanHash(plan)
    && approval.dependencyDigest === plan.boundState.dependencyDigest
    && approval.capsuleId === capsule.id
    && approval.capsuleHash === executionCapsuleHash(capsule);
}

function outsideApprovedUnits(unitIds: readonly EntityId[], approvedUnits: ReadonlySet<EntityId>): EntityId[] {
  return sortedUnique(unitIds.filter((unitId) => !approvedUnits.has(unitId)));
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

const assuranceRank: Record<ValidationResult["assurance"], number> = {
  weak: 0,
  supporting: 1,
  strong: 2,
  exact: 3,
};

function normalizeCompletionAssessment(assessment: CompletionAssessment): CompletionAssessment {
  return {
    unitStates: [...assessment.unitStates].map((state) => structuredClone(state)).sort((left, right) =>
      compareStrings(left.unitId, right.unitId) || compareStrings(left.state, right.state)),
    newDivergenceIds: sortedUnique(assessment.newDivergenceIds),
    unknowns: sortedUnique(assessment.unknowns),
    unavailableActions: sortedUnique(assessment.unavailableActions),
    availableArtifacts: sortedUnique(assessment.availableArtifacts),
    cleanWorkingTree: assessment.cleanWorkingTree,
  };
}

function completionContractReasons(
  plan: ExecutionPlan,
  capsule: ExecutionCapsule,
  validations: readonly ValidationResult[],
  assessment: CompletionAssessment,
): string[] {
  const contract = plan.completionCriteria;
  const reasons = validationReasons(
    [...contract.requiredValidators, ...capsule.requiredValidations],
    validations,
  );
  const passed = validations.filter((validation) => validation.status === "passed");
  for (const lane of contract.requiredEvidenceLanes) {
    if (!passed.some((validation) => validation.evidenceLane === lane)) {
      reasons.push(`required evidence lane did not pass: ${lane}`);
    }
  }
  const byValidator = new Map(validations.map((validation) => [validation.validatorId, validation]));
  for (const validatorId of sortedUnique([...contract.requiredValidators, ...capsule.requiredValidations])) {
    const result = byValidator.get(validatorId);
    if (result?.status === "passed" && assuranceRank[result.assurance] < assuranceRank[contract.minimumValidationAssurance]) {
      reasons.push(`required validation ${validatorId} is below ${contract.minimumValidationAssurance} assurance`);
    }
  }
  if (contract.requireIndependentValidation && !passed.some((validation) =>
    validation.evidenceLane !== "same-packet-agent"
    && validation.independenceGroup !== "deterministic-transform")) {
    reasons.push("completion requires an independent passing validation");
  }

  const unitStates = new Map<EntityId, CompletionAssessment["unitStates"][number]["state"]>();
  for (const observed of assessment.unitStates) {
    const existing = unitStates.get(observed.unitId);
    if (existing !== undefined && existing !== observed.state) {
      reasons.push(`conflicting observed unit states: ${observed.unitId}`);
    } else {
      unitStates.set(observed.unitId, observed.state);
    }
  }
  for (const required of contract.requiredUnitStates) {
    if (unitStates.get(required.unitId) !== required.state) {
      reasons.push(`required unit state not established: ${required.unitId} must be ${required.state}`);
    }
  }
  const divergenceCount = new Set(assessment.newDivergenceIds).size;
  if (divergenceCount > contract.maximumNewDivergences) {
    reasons.push(`new divergence count ${divergenceCount} exceeds maximum ${contract.maximumNewDivergences}`);
  }
  const unknownCount = new Set([...capsule.unknowns, ...assessment.unknowns]).size;
  if (unknownCount > contract.maximumUnknowns) {
    reasons.push(`unknown count ${unknownCount} exceeds maximum ${contract.maximumUnknowns}`);
  }
  const unavailableActions = sortedUnique(assessment.unavailableActions);
  if (!contract.allowUnavailableExternalActions && unavailableActions.length > 0) {
    reasons.push(`unavailable external actions are not allowed: ${unavailableActions.join(", ")}`);
  }
  const availableArtifacts = new Set(["certificate", "receipt", ...assessment.availableArtifacts]);
  for (const artifact of contract.requiredArtifacts) {
    if (!availableArtifacts.has(artifact)) reasons.push(`required artifact is unavailable: ${artifact}`);
  }
  if (contract.cleanWorkingTree && !assessment.cleanWorkingTree) {
    reasons.push("completion requires a clean working tree");
  }
  return sortedUnique(reasons);
}

export class StateBoundChangeExecutor<TInput> {
  private readonly state: CurrentStatePort;
  private readonly bindingValidator: StateBindingValidator;
  private readonly transform: DeterministicTransformPort<TInput>;
  private readonly transactions: ChangeTransactionPort;
  private readonly artifacts: ChangeArtifactStore;
  private readonly completion: CompletionAssessmentPort;
  private readonly successDurability: StateBoundSuccessDurabilityPort | undefined;
  private readonly changedCanonicalEntityIds: (result: TransformResult) => readonly string[];
  private readonly changedConceptIds: (result: TransformResult) => readonly string[];
  private readonly changedRequirementIds: (result: TransformResult) => readonly string[];
  private readonly changedScenarioIds: (result: TransformResult) => readonly string[];
  private readonly changedRelationIds: (result: TransformResult) => readonly string[];
  private readonly planningSurpriseIds: (result: TransformResult) => readonly string[];
  private readonly environment: Readonly<{ repositoryRoot: string; signal: AbortSignal }>;
  private readonly now: () => string;

  constructor(options: StateBoundChangeExecutorOptions<TInput>) {
    this.state = options.state;
    this.bindingValidator = options.bindingValidator;
    this.transform = options.transform;
    this.transactions = options.transactions;
    this.artifacts = options.artifacts;
    this.completion = options.completion;
    this.successDurability = options.successDurability;
    this.changedCanonicalEntityIds = options.changedCanonicalEntityIds ?? (() => []);
    this.changedConceptIds = options.changedConceptIds ?? (() => []);
    this.changedRequirementIds = options.changedRequirementIds ?? (() => []);
    this.changedScenarioIds = options.changedScenarioIds ?? (() => []);
    this.changedRelationIds = options.changedRelationIds ?? (() => []);
    this.planningSurpriseIds = options.planningSurpriseIds ?? (() => []);
    if (options.environment.repositoryRoot.length === 0) throw new TypeError("execution repository root cannot be blank");
    this.environment = Object.freeze({
      repositoryRoot: options.environment.repositoryRoot,
      signal: options.environment.signal,
    });
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(input: ExecuteStateBoundChangeInput<TInput>): Promise<StateBoundChangeResult> {
    const beforeState = await this.state.current();
    const attempt: AttemptState = { validations: [] };
    const preflightReasons: string[] = [];

    const planApprovalMatches = input.approval.planId === input.plan.id
      && input.approval.planRevision === input.plan.revision
      && input.approval.planHash === executionPlanHash(input.plan)
      && input.approval.dependencyDigest === input.plan.boundState.dependencyDigest;
    if (!planApprovalMatches) {
      preflightReasons.push("approval does not match the immutable execution plan");
    } else if (!isApprovalCurrent(input.plan, input.capsule, input.approval)) {
      preflightReasons.push("approval does not match the immutable execution capsule");
    }
    if (canonicalJson(input.capsule.boundState) !== canonicalJson(input.plan.boundState)) {
      preflightReasons.push("execution capsule does not match the plan state binding");
    }
    if (canonicalJson(input.capsule.completionContract) !== canonicalJson(input.plan.completionCriteria)) {
      preflightReasons.push("execution capsule completion contract does not match the immutable plan");
    }
    const planUnits = new Set(input.plan.knownAffectedUnitIds);
    const capsuleUnitsOutsidePlan = outsideApprovedUnits(input.capsule.unitIds, planUnits);
    if (capsuleUnitsOutsidePlan.length > 0) {
      preflightReasons.push(`capsule units are outside the immutable plan: ${capsuleUnitsOutsidePlan.join(", ")}`);
    }
    const writeAuthorization = compileWriteAuthorization(input.capsule);
    preflightReasons.push(...writeAuthorization.reasons);

    const adapterContext: AdapterContext = {
      repositoryRoot: this.environment.repositoryRoot,
      stateDigest: beforeState,
      config: {},
      signal: this.environment.signal,
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

    const transformContext: ApprovedTransformContext = {
      repositoryRoot: this.environment.repositoryRoot,
      stateBinding: executionBinding,
      allowedUnits: sortedUnique(input.capsule.unitIds),
      dryRun: false,
      signal: adapterContext.signal,
      approvedBoundary: sortedUnique(input.plan.boundary),
      writeAuthorization,
      capsuleId: input.capsule.id,
      capsuleHash: input.approval.capsuleHash,
    };

    try {
      attempt.preview = await this.transform.preview(input.transformInput, transformContext);
      const approvedUnits = new Set(transformContext.allowedUnits);
      const previewOutsideScope = outsideApprovedUnits(attempt.preview.touchedUnitIds, approvedUnits);
      if (previewOutsideScope.length > 0) {
        return this.finalize(
          input,
          beforeState,
          await this.state.current(),
          "failure",
          [`transform preview touched units outside the approved capsule: ${previewOutsideScope.join(", ")}`],
          attempt,
        );
      }
      attempt.transaction = await this.transactions.begin({
        planId: input.plan.id,
        beforeState,
        boundState: executionBinding,
        allowedUnits: transformContext.allowedUnits,
      });
      await attempt.transaction.checkpoint("before-transform");
      attempt.result = await this.transform.apply(input.transformInput, transformContext);
      const resultOutsideScope = outsideApprovedUnits(
        [...attempt.result.touchedUnitIds, ...attempt.result.operations.flatMap((operation) => operation.unitIds)],
        approvedUnits,
      );
      if (resultOutsideScope.length > 0) {
        await attempt.transaction.rollback();
        return this.finalize(
          input,
          beforeState,
          await this.state.current(),
          attempt.result.changed ? "partial" : "failure",
          [`transform result touched units outside the approved capsule: ${resultOutsideScope.join(", ")}`],
          attempt,
        );
      }
      await attempt.transaction.transition("workspace-staged");
      await attempt.transaction.transition("validating");
      attempt.validations = normalizeValidations(await this.transform.verify(attempt.result, transformContext));
      attempt.completionAssessment = normalizeCompletionAssessment(await this.completion.assess({
        plan: input.plan,
        capsule: input.capsule,
        transformResult: attempt.result,
        validations: attempt.validations,
      }));
      const failedValidations = completionContractReasons(
        input.plan,
        input.capsule,
        attempt.validations,
        attempt.completionAssessment,
      );
      if (failedValidations.length > 0) {
        await attempt.transaction.rollback();
        const outcome: ChangeOutcome = attempt.result.changed ? "partial" : "failure";
        return this.finalize(input, beforeState, await this.state.current(), outcome, failedValidations, attempt);
      }
      const afterState = await this.state.current();
      const preparedSuccess = createPreparedStateBoundChangeSuccess({
        plan: input.plan,
        capsule: input.capsule,
        approval: input.approval,
        beforeState,
        afterState,
        ...(attempt.preview === undefined ? {} : { preview: attempt.preview }),
        transformResult: attempt.result,
        validations: attempt.validations,
        completionAssessment: attempt.completionAssessment,
        changedCanonicalEntityIds: this.changedCanonicalEntityIds(attempt.result),
        changedConceptIds: this.changedConceptIds(attempt.result),
        changedRequirementIds: this.changedRequirementIds(attempt.result),
        changedScenarioIds: this.changedScenarioIds(attempt.result),
        changedRelationIds: this.changedRelationIds(attempt.result),
        planningSurpriseIds: this.planningSurpriseIds(attempt.result),
        createdAt: this.now(),
      });
      await this.successDurability?.prepare(preparedSuccess);
      await attempt.transaction.checkpoint(preparedSuccess.checkpointId);
      await attempt.transaction.transition("canonical-staging");
      await attempt.transaction.transition("committing");
      await attempt.transaction.commit();
      return publishPreparedStateBoundChangeSuccess(preparedSuccess, this.artifacts);
    } catch (caught) {
      const error = caught as PartialTransformError;
      if (error.partialResult !== undefined) attempt.result = error.partialResult;
      const changed = attempt.result?.changed === true;
      if (attempt.transaction !== undefined && attempt.transaction.phase !== "committed") {
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
    const changedConceptIds = attempt.result === undefined ? [] : sortedUnique(this.changedConceptIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedRequirementIds = attempt.result === undefined ? [] : sortedUnique(this.changedRequirementIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedScenarioIds = attempt.result === undefined ? [] : sortedUnique(this.changedScenarioIds(attempt.result).filter((id) => changedUnits.includes(id)));
    const changedRelationIds = attempt.result === undefined ? [] : sortedUnique(this.changedRelationIds(attempt.result).filter((id) => changedUnits.includes(id)));
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
      changedConcepts: changedConceptIds,
      changedRequirements: changedRequirementIds,
      changedScenarios: changedScenarioIds,
      changedRelations: changedRelationIds,
      changedUnits,
      planningSurpriseIds: attempt.result === undefined ? [] : sortedUnique(this.planningSurpriseIds(attempt.result)),
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
      ...(attempt.completionAssessment === undefined
        ? {}
        : { completionAssessment: structuredClone(attempt.completionAssessment) }),
      certificate,
    };
    const certificateHash = hashFramedDomain("change-certificate-artifact", artifact);
    const certificateRef = await this.artifacts.write("certificate", certificateHash, canonicalJson(artifact));
    const validationSummaryHash = hashFramedDomain("validation-summary", certificate.validations);
    const changedCanonicalEntityIds = attempt.result === undefined ? [] : sortedUnique(
      this.changedCanonicalEntityIds(attempt.result).filter((id) => changedUnits.includes(id)),
    );
    const receiptWithoutHash: Omit<TransactionReceipt, "semanticHash"> = {
      id: `receipt:${input.plan.id}:${input.approval.id}`,
      planId: input.plan.id,
      riskClass: input.capsule.risk.class,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      changedCanonicalEntityIds,
      changedRequirementIds,
      changedScenarioIds,
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

export interface CreatePreparedStateBoundChangeSuccessInput {
  readonly plan: ExecutionPlan;
  readonly capsule: ExecutionCapsule;
  readonly approval: ExecutionApproval;
  readonly beforeState: StateDigest;
  readonly afterState: StateDigest;
  readonly preview?: TransformPreview;
  readonly transformResult: TransformResult;
  readonly validations: readonly ValidationResult[];
  readonly completionAssessment: CompletionAssessment;
  readonly changedCanonicalEntityIds: readonly string[];
  readonly changedConceptIds?: readonly string[];
  readonly changedRequirementIds: readonly string[];
  readonly changedScenarioIds: readonly string[];
  readonly changedRelationIds?: readonly string[];
  readonly planningSurpriseIds: readonly string[];
  readonly createdAt: string;
}

function preparedSuccessContentHash(success: Omit<PreparedStateBoundChangeSuccess, "contentHash">): ContentHash {
  return hashFramedDomain("prepared-state-bound-change-success", success);
}

function preparedSuccessIdentityHash(input: {
  readonly planId: EntityId;
  readonly executionApprovalId: EntityId;
  readonly beforeState: StateDigest;
  readonly afterState: StateDigest;
  readonly preview?: TransformPreview;
  readonly transformResult: TransformResult;
  readonly validations: readonly ValidationResult[];
  readonly completionAssessment: CompletionAssessment;
  readonly changedCanonicalEntityIds: readonly string[];
  readonly changedConceptIds?: readonly string[];
  readonly changedRequirementIds: readonly string[];
  readonly changedScenarioIds: readonly string[];
  readonly changedRelationIds?: readonly string[];
  readonly planningSurpriseIds: readonly string[];
}): ContentHash {
  return hashFramedDomain("state-bound-success-preparation-identity", input);
}

export function createPreparedStateBoundChangeSuccess(
  input: CreatePreparedStateBoundChangeSuccessInput,
): PreparedStateBoundChangeSuccess {
  const changedUnits = sortedUnique(input.transformResult.touchedUnitIds);
  const changedCanonicalEntityIds = sortedUnique(input.changedCanonicalEntityIds.filter((id) => changedUnits.includes(id)));
  const changedConceptIds = sortedUnique((input.changedConceptIds ?? []).filter((id) => changedUnits.includes(id)));
  const changedRequirementIds = sortedUnique(input.changedRequirementIds.filter((id) => changedUnits.includes(id)));
  const changedScenarioIds = sortedUnique(input.changedScenarioIds.filter((id) => changedUnits.includes(id)));
  const changedRelationIds = sortedUnique((input.changedRelationIds ?? []).filter((id) => changedUnits.includes(id)));
  const validations = normalizeValidations(input.validations);
  const completionAssessment = normalizeCompletionAssessment(input.completionAssessment);
  const preparationIdentityHash = preparedSuccessIdentityHash({
    planId: input.plan.id,
    executionApprovalId: input.approval.id,
    beforeState: input.beforeState,
    afterState: input.afterState,
    ...(input.preview === undefined ? {} : { preview: input.preview }),
    transformResult: input.transformResult,
    validations,
    completionAssessment,
    changedCanonicalEntityIds,
    ...(changedConceptIds.length === 0 ? {} : { changedConceptIds }),
    changedRequirementIds,
    changedScenarioIds,
    ...(changedRelationIds.length === 0 ? {} : { changedRelationIds }),
    planningSurpriseIds: sortedUnique(input.planningSurpriseIds),
  });
  const preparationId = `prepared_success_${preparationIdentityHash.slice(-32)}`;
  const checkpointId = `prepared-success:${preparationId}`;
  const certificate: ChangeCertificate = {
    id: `certificate:${input.plan.id}:${input.approval.id}`,
    planId: input.plan.id,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    changedConcepts: changedConceptIds,
    changedRequirements: changedRequirementIds,
    changedScenarios: changedScenarioIds,
    changedRelations: changedRelationIds,
    changedUnits,
    planningSurpriseIds: sortedUnique(input.planningSurpriseIds),
    deterministicOperations: structuredClone(input.transformResult.operations),
    agentOperations: [],
    validations,
    divergencesResolved: [],
    divergencesIntroduced: sortedUnique(completionAssessment.newDivergenceIds),
    modeledBoundary: sortedUnique(input.plan.boundary),
    completeness: "bounded",
    unknowns: sortedUnique(completionAssessment.unknowns),
    unavailableActions: sortedUnique(completionAssessment.unavailableActions),
    rollback: [],
    createdAt: input.createdAt,
  };
  const certificateArtifact: ChangeCertificateArtifact = {
    version: 1,
    outcome: "success",
    lastCheckpointId: checkpointId,
    journalPhase: "committed",
    recoveryState: "not-required",
    reasons: [],
    completionAssessment,
    certificate,
  };
  const certificateHash = hashFramedDomain("change-certificate-artifact", certificateArtifact);
  const receiptWithoutHash: Omit<TransactionReceipt, "semanticHash"> = {
    id: `receipt:${input.plan.id}:${input.approval.id}`,
    planId: input.plan.id,
    riskClass: input.capsule.risk.class,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    changedCanonicalEntityIds,
    changedRequirementIds,
    changedScenarioIds,
    changedUnitIds: changedUnits,
    validationSummaryHash: hashFramedDomain("validation-summary", validations),
    certificateHash,
    createdAt: input.createdAt,
  };
  const receipt: TransactionReceipt = { ...receiptWithoutHash, semanticHash: hashSemantic("transaction-receipt", receiptWithoutHash) };
  const receiptHash = hashFramedDomain("transaction-receipt-artifact", receipt);
  const basis = {
    version: 1 as const,
    preparationId,
    checkpointId,
    planId: input.plan.id,
    executionApprovalId: input.approval.id,
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    ...(input.preview === undefined ? {} : { preview: structuredClone(input.preview) }),
    transformResult: structuredClone(input.transformResult),
    validations,
    completionAssessment,
    certificateArtifact,
    certificateHash,
    receipt,
    receiptHash,
  };
  return { ...basis, contentHash: preparedSuccessContentHash(basis) };
}

export function authenticatePreparedStateBoundChangeSuccess(
  success: PreparedStateBoundChangeSuccess,
): PreparedStateBoundChangeSuccess {
  const { contentHash, ...basis } = success;
  const expectedPreparationId = `prepared_success_${preparedSuccessIdentityHash({
    planId: success.planId,
    executionApprovalId: success.executionApprovalId,
    beforeState: success.beforeState,
    afterState: success.afterState,
    ...(success.preview === undefined ? {} : { preview: success.preview }),
    transformResult: success.transformResult,
    validations: success.validations,
    completionAssessment: success.completionAssessment,
    changedCanonicalEntityIds: success.receipt.changedCanonicalEntityIds,
    ...(success.certificateArtifact.certificate.changedConcepts.length === 0 ? {} : { changedConceptIds: success.certificateArtifact.certificate.changedConcepts }),
    changedRequirementIds: success.receipt.changedRequirementIds,
    changedScenarioIds: success.receipt.changedScenarioIds,
    ...(success.certificateArtifact.certificate.changedRelations.length === 0 ? {} : { changedRelationIds: success.certificateArtifact.certificate.changedRelations }),
    planningSurpriseIds: success.certificateArtifact.certificate.planningSurpriseIds,
  }).slice(-32)}`;
  if (success.version !== 1
    || success.preparationId !== expectedPreparationId
    || success.checkpointId !== `prepared-success:${success.preparationId}`
    || contentHash !== preparedSuccessContentHash(basis)
    || success.certificateHash !== hashFramedDomain("change-certificate-artifact", success.certificateArtifact)
    || success.receiptHash !== hashFramedDomain("transaction-receipt-artifact", success.receipt)
    || success.receipt.certificateHash !== success.certificateHash
    || success.receipt.semanticHash !== hashSemantic("transaction-receipt", success.receipt)
    || success.certificateArtifact.outcome !== "success"
    || success.certificateArtifact.journalPhase !== "committed"
    || success.certificateArtifact.lastCheckpointId !== success.checkpointId
    || success.certificateArtifact.certificate.planId !== success.planId
    || success.receipt.planId !== success.planId
    || success.certificateArtifact.certificate.id !== `certificate:${success.planId}:${success.executionApprovalId}`
    || success.receipt.id !== `receipt:${success.planId}:${success.executionApprovalId}`
    || canonicalJson(success.certificateArtifact.certificate.beforeState) !== canonicalJson(success.beforeState)
    || canonicalJson(success.certificateArtifact.certificate.afterState) !== canonicalJson(success.afterState)
    || canonicalJson(success.receipt.beforeState) !== canonicalJson(success.beforeState)
    || canonicalJson(success.receipt.afterState) !== canonicalJson(success.afterState)) {
    throw new Error("prepared state-bound success failed content authentication");
  }
  return success;
}

export async function publishPreparedStateBoundChangeSuccess(
  untrusted: PreparedStateBoundChangeSuccess,
  artifacts: ChangeArtifactStore,
): Promise<StateBoundChangeResult> {
  const success = authenticatePreparedStateBoundChangeSuccess(untrusted);
  const certificateRef = await artifacts.write("certificate", success.certificateHash, canonicalJson(success.certificateArtifact));
  const receiptRef = await artifacts.write("receipt", success.receiptHash, canonicalJson(success.receipt));
  return {
    outcome: "success",
    reasons: [],
    ...(success.preview === undefined ? {} : { preview: structuredClone(success.preview) }),
    transformResult: structuredClone(success.transformResult),
    validations: structuredClone(success.validations),
    certificate: structuredClone(success.certificateArtifact.certificate),
    certificateHash: success.certificateHash,
    certificateRef,
    receipt: structuredClone(success.receipt),
    receiptHash: success.receiptHash,
    receiptRef,
  };
}
