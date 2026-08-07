import { describe, expect, it } from "vitest";

import {
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ChangeCertificate,
  type CompletionContract,
  type ExecutionCapsule,
  type ExecutionPlan,
  type StateBinding,
  type StateBindingValidation,
  type StateDigest,
  type TransformContext,
  type TransformPreview,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";

import { createExecutionCapsule, createExecutionPlan } from "../planning/index.js";
import {
  StateBoundChangeExecutor,
  createExecutionApproval,
  executionCapsuleHash,
  executionPlanHash,
  type ChangeArtifactStore,
  type ChangeTransaction,
  type ChangeTransactionPort,
  type DeterministicTransformPort,
} from "./index.js";

const state = (suffix: string): StateDigest => ({
  gitBase: "base",
  worktreeDigest: hashFramedDomain("test", `worktree:${suffix}`),
  canonicalProjectorDigest: hashFramedDomain("test", `canonical:${suffix}`),
  toolchainDigest: hashFramedDomain("test", "toolchain"),
});

const initialState = state("before");
const afterState = state("after");
const binding: StateBinding = {
  compiledAgainst: initialState,
  valueDependencies: [],
  queryDependencies: [],
  dependencyDigest: hashFramedDomain("state-binding-dependencies", { valueDependencies: [], queryDependencies: [] }),
};

const plan = (
  id = "plan:move",
  completionOverrides: Partial<ExecutionPlan["completionCriteria"]> = {},
): ExecutionPlan => createExecutionPlan({
  id,
  revision: 1,
  sourceRunId: "run:1",
  boundState: binding,
  boundary: ["package.json", "scripts/**"],
  assumptions: [],
  knownAffectedUnitIds: ["unit:move"],
  possibleFrontierUnitIds: [],
  unavailableSurfaceIds: [],
  packetIds: ["packet:move"],
  checkpoints: [],
  completionCriteria: {
    requiredUnitStates: [{ unitId: "unit:move", state: "valid" }],
    requiredValidators: ["move-reference-update.verify"],
    requiredEvidenceLanes: ["runtime"],
    minimumValidationAssurance: "exact",
    requireIndependentValidation: false,
    maximumNewDivergences: 0,
    maximumUnknowns: 0,
    allowUnavailableExternalActions: false,
    requiredArtifacts: ["certificate", "receipt"],
    cleanWorkingTree: true,
    ...completionOverrides,
  },
});

const capsule = (overrides: Partial<ExecutionCapsule> = {}): ExecutionCapsule => createExecutionCapsule({
  id: "capsule:move",
  taskId: "task:move",
  objective: "move repository automation",
  operation: "move-reference-update",
  unitIds: ["unit:move"],
  boundState: binding,
  relevanceClosureId: "closure:move",
  analysisFacetKeys: [],
  requirementIds: [],
  scenarioIds: [],
  conceptSummary: "repository automation",
  decisionIds: [],
  decisionSummary: "",
  unresolvedArchitectureConcerns: [],
  lensSummary: "repository script lens",
  effectiveRules: [],
  normativeKernelHash: hashFramedDomain("test", "kernel"),
  relevantPrecedents: [],
  allowedWrites: [{
    selector: { op: "atom", field: "operation", matcher: "equals", value: "move-reference-update" },
    operations: ["move-reference-update"],
    reason: "approved deterministic repair",
  }],
  forbiddenWrites: [],
  availablePrimitives: ["move artifact", "update reference"],
  requiredValidations: ["move-reference-update.verify"],
  upstreamImplications: [],
  downstreamImplications: [],
  knownExceptions: [],
  unknowns: [],
  risk: {
    class: "R1", inherentOperationRisk: 1, affectedUnitCount: 1, affectedSurfaceCount: 1,
    publicContractImpact: false, externalImpact: false, dataImpact: false, reversibility: "full",
    validationStrength: "exact", closureConfidence: "bounded", unresolvedIdentityCount: 0,
    relevanceFrontierCount: 0, openWorldDependencies: false, unresolvedBlockingConcernCount: 0,
    suspectDecisionCount: 0, compensationAvailable: true, reasons: [],
  },
  completionContract: plan().completionCriteria,
  ...overrides,
});

const validation = (
  status: ValidationResult["status"],
  overrides: Partial<ValidationResult> = {},
): ValidationResult => ({
  validatorId: "move-reference-update.verify",
  status,
  summary: status,
  evidenceIds: [],
  evidenceLane: "runtime",
  independenceGroup: "deterministic-transform",
  assurance: "exact",
  authorSource: "move-reference-update@1",
  sideEffectClass: "none",
  details: {},
  startedAt: "2026-08-07T12:00:00.000Z",
  completedAt: "2026-08-07T12:00:00.000Z",
  ...overrides,
});

interface TestCompletionAssessment {
  unitStates: Array<{ unitId: string; state: "valid" | "removed" | "exception" }>;
  newDivergenceIds: string[];
  unknowns: string[];
  unavailableActions: string[];
  availableArtifacts: string[];
  cleanWorkingTree: boolean;
}

const completeAssessment = (overrides: Partial<TestCompletionAssessment> = {}): TestCompletionAssessment => ({
  unitStates: [{ unitId: "unit:move", state: "valid" }],
  newDivergenceIds: [],
  unknowns: [],
  unavailableActions: [],
  availableArtifacts: [],
  cleanWorkingTree: true,
  ...overrides,
});

class MemoryArtifactStore implements ChangeArtifactStore {
  readonly writes: Array<{ kind: string; hash: string; content: string }> = [];

  async write(kind: "certificate" | "receipt", hash: `sha256:v1:${string}`, content: string): Promise<string> {
    this.writes.push({ kind, hash, content });
    return `.projector/${kind === "receipt" ? "receipts" : "runtime/certificates"}/${hash}.json`;
  }
}

class MemoryTransaction implements ChangeTransaction {
  phase = "prepared" as const satisfies ChangeTransaction["phase"];
  lastCheckpointId: string | undefined;
  readonly events: string[];

  constructor(
    events: string[] = [],
    private readonly commitFails = false,
  ) {
    this.events = events;
  }

  async checkpoint(id: string): Promise<void> {
    this.lastCheckpointId = id;
    this.events.push(`checkpoint:${id}`);
  }

  async transition(phase: "workspace-staged" | "validating" | "canonical-staging" | "committing"): Promise<void> {
    (this as { phase: ChangeTransaction["phase"] }).phase = phase;
    this.events.push(`phase:${phase}`);
  }

  async commit(): Promise<void> {
    if (this.commitFails) {
      this.events.push("commit-failed");
      throw new Error("durable commit failed");
    }
    (this as { phase: ChangeTransaction["phase"] }).phase = "committed";
    this.events.push("commit");
  }

  async rollback(): Promise<void> {
    (this as { phase: ChangeTransaction["phase"] }).phase = "rolled-back";
    this.events.push("rollback");
  }
}

class MemoryTransactionPort implements ChangeTransactionPort {
  readonly transaction: MemoryTransaction;
  begins = 0;

  constructor(events: string[] = [], commitFails = false) {
    this.transaction = new MemoryTransaction(events, commitFails);
  }

  async begin(): Promise<ChangeTransaction> {
    this.begins += 1;
    return this.transaction;
  }
}

const transformPort = (options: {
  changed?: boolean;
  verify?: ValidationResult[];
  throwAfterChange?: boolean;
  touchedUnitId?: string;
} = {}): DeterministicTransformPort<{}> & { applies: number; contexts: TransformContext[] } => ({
  applies: 0,
  contexts: [],
  async preview(_input: {}, transformContext: TransformContext): Promise<TransformPreview> {
    this.contexts.push(transformContext);
    return { applicable: true, operations: [{ kind: "move" }], touchedUnitIds: [options.touchedUnitId ?? "unit:move"], expectedDiff: "move", warnings: [] };
  },
  async apply(_input: {}, transformContext: TransformContext): Promise<TransformResult> {
    this.applies += 1;
    this.contexts.push(transformContext);
    if (options.throwAfterChange === true) {
      const error = new Error("crash after mutation") as Error & { partialResult?: TransformResult };
      error.partialResult = {
        transformId: "move-reference-update",
        changed: true,
        touchedUnitIds: ["unit:move"],
        operations: [{
          operationId: "move:1",
          executor: "transform",
          unitIds: ["unit:move"],
          beforeHashes: [hashFramedDomain("content", "before")],
          afterHashes: [hashFramedDomain("content", "after")],
          evidenceIds: [],
          summary: "moved",
        }],
      };
      throw error;
    }
    return {
      transformId: "move-reference-update",
      changed: options.changed ?? true,
      touchedUnitIds: [options.touchedUnitId ?? "unit:move"],
      operations: [{
        operationId: "move:1",
        executor: "transform",
        unitIds: [options.touchedUnitId ?? "unit:move"],
        beforeHashes: [hashFramedDomain("content", "before")],
        afterHashes: [hashFramedDomain("content", "after")],
        evidenceIds: [],
        summary: "moved",
      }],
    };
  },
  async verify(_result: TransformResult, _context: TransformContext): Promise<ValidationResult[]> {
    return options.verify ?? [validation("passed")];
  },
});

const validator = (result: StateBindingValidation) => ({
  async validate(_binding: StateBinding, _current: StateDigest, _context: AdapterContext): Promise<StateBindingValidation> {
    return result;
  },
});

const execute = async (input: {
  validation?: StateBindingValidation;
  transform?: DeterministicTransformPort<{}>;
  approvalPlan?: ExecutionPlan;
  approvalCapsule?: ExecutionCapsule;
  executionCapsule?: ExecutionCapsule;
  commitFails?: boolean;
  allowedUnits?: string[];
  subjectPlan?: ExecutionPlan;
  completionAssessment?: TestCompletionAssessment;
  callerRiskClass?: "R0" | "R1" | "R2" | "R3" | "R4";
}) => {
  const artifacts = new MemoryArtifactStore();
  const lifecycle: string[] = [];
  const transactions = new MemoryTransactionPort(lifecycle, input.commitFails);
  const subjectPlan = input.subjectPlan ?? plan();
  const states = [initialState, afterState];
  const executor = new StateBoundChangeExecutor({
    state: { async current(): Promise<StateDigest> {
      lifecycle.push("state-sampled");
      return states.shift() ?? afterState;
    } },
    bindingValidator: validator(input.validation ?? {
      status: "current",
      currentState: initialState,
      changedValueDependencyIds: [],
      changedQueryDependencyIds: [],
      reasons: [],
    }),
    transform: input.transform ?? transformPort(),
    transactions,
    artifacts,
    completion: {
      async assess(): Promise<TestCompletionAssessment> {
        return input.completionAssessment ?? completeAssessment();
      },
    },
    environment: { repositoryRoot: "/approved/repo", signal: new AbortController().signal },
    now: () => "2026-08-07T12:00:00.000Z",
  });
  const approved = input.approvalPlan ?? subjectPlan;
  const subjectCapsule = input.executionCapsule ?? capsule({ completionContract: subjectPlan.completionCriteria });
  const approvedCapsule = input.approvalCapsule ?? subjectCapsule;
  const result = await executor.execute({
    plan: subjectPlan,
    capsule: subjectCapsule,
    approval: createExecutionApproval(approved, approvedCapsule, "approval:1"),
    transformInput: {},
    ...({ repositoryRoot: "/caller-controlled/repo" } as Record<string, unknown>),
    ...({ riskClass: input.callerRiskClass ?? "R1" } as Record<string, unknown>),
    ...({ allowedUnits: input.allowedUnits ?? ["unit:move"] } as Record<string, unknown>),
  });
  return { result, artifacts, transactions, lifecycle, approvedCapsule };
};

describe("state-bound deterministic change execution", () => {
  it("emits a compact receipt linked to a verbose content-addressed success certificate", async () => {
    const { result, artifacts, transactions, lifecycle } = await execute({});

    expect(result.outcome).toBe("success");
    expect(result.receipt.certificateHash).toBe(result.certificateHash);
    expect(result.receipt.semanticHash).toBe(hashSemantic("transaction-receipt", result.receipt));
    expect(artifacts.writes.map((write) => write.kind)).toEqual(["certificate", "receipt"]);
    expect(artifacts.writes[0]?.hash).toBe(result.certificateHash);
    expect(result.certificateHash).toBe(hashFramedDomain(
      "change-certificate-artifact",
      JSON.parse(artifacts.writes[0]?.content ?? "{}"),
    ));
    expect(JSON.parse(artifacts.writes[0]?.content ?? "{}")).toMatchObject({
      outcome: "success",
      recoveryState: "not-required",
    });
    expect(transactions.transaction.events).toEqual([
      "state-sampled",
      "checkpoint:before-transform",
      "phase:workspace-staged",
      "phase:validating",
      "checkpoint:after-validation",
      "phase:canonical-staging",
      "phase:committing",
      "commit",
      "state-sampled",
    ]);
    expect(lifecycle.lastIndexOf("commit")).toBeLessThan(lifecycle.lastIndexOf("state-sampled"));
  });

  it("does not persist false success evidence when durable commit fails", async () => {
    const { result, artifacts, transactions } = await execute({ commitFails: true });

    expect(result.outcome).toBe("partial");
    expect(transactions.transaction.phase).toBe("rolled-back");
    expect(artifacts.writes).toHaveLength(2);
    expect(JSON.parse(artifacts.writes[0]?.content ?? "{}")).toMatchObject({
      outcome: "partial",
      recoveryState: "rolled-back",
      reasons: ["durable commit failed"],
    });
  });

  it("refuses stale bindings and approval mismatches before preview/apply while still recording failure evidence", async () => {
    const staleTransform = transformPort();
    const stale = await execute({
      transform: staleTransform,
      validation: {
        status: "stale",
        currentState: afterState,
        changedValueDependencyIds: ["unit:move"],
        changedQueryDependencyIds: [],
        reasons: ["projection unit changed"],
      },
    });
    expect(stale.result.outcome).toBe("failure");
    expect(staleTransform.applies).toBe(0);
    expect(stale.transactions.begins).toBe(0);
    expect(stale.artifacts.writes.map((write) => write.kind)).toEqual(["certificate", "receipt"]);

    const mismatchedPlan = plan("plan:other");
    const mismatchTransform = transformPort();
    const mismatch = await execute({ transform: mismatchTransform, approvalPlan: mismatchedPlan });
    expect(mismatch.result.outcome).toBe("failure");
    expect(mismatch.result.reasons).toContain("approval does not match the immutable execution plan");
    expect(mismatchTransform.applies).toBe(0);
  });

  it("requires an explicit immutable plan revision and new approval for a safe state rebind", async () => {
    const reboundTransform = transformPort();
    const reboundState = state("unrelated-change");
    const reboundBinding: StateBinding = { ...binding, compiledAgainst: reboundState };
    const rebound = await execute({
      transform: reboundTransform,
      validation: {
        status: "rebound",
        currentState: reboundState,
        changedValueDependencyIds: [],
        changedQueryDependencyIds: [],
        reasons: ["dependencies unchanged"],
        rebound: reboundBinding,
      },
    });

    expect(rebound.result.outcome).toBe("failure");
    expect(rebound.result.reasons).toContain("state binding requires an explicit plan rebind and new approval");
    expect(reboundTransform.applies).toBe(0);
  });

  it.each([
    { name: "failed validation", transform: transformPort({ verify: [validation("failed")] }), outcome: "partial" },
    { name: "mutation interruption", transform: transformPort({ throwAfterChange: true }), outcome: "partial" },
  ] as const)("emits a certificate and receipt for $name", async ({ transform, outcome }) => {
    const { result, artifacts } = await execute({ transform });
    expect(result.outcome).toBe(outcome);
    expect(result.receipt.certificateHash).toBe(result.certificateHash);
    const certificateEnvelope = JSON.parse(artifacts.writes[0]?.content ?? "{}") as {
      outcome?: string;
      certificate?: ChangeCertificate;
      lastCheckpointId?: string;
    };
    expect(certificateEnvelope.outcome).toBe(outcome);
    expect(certificateEnvelope.certificate?.planId).toBe("plan:move");
    expect(certificateEnvelope.lastCheckpointId).toBe("before-transform");
  });

  it("binds approvals to immutable plan content and dependency scope", () => {
    const subject = plan();
    const subjectCapsule = capsule();
    const approval = createExecutionApproval(subject, subjectCapsule, "approval:1");
    expect(approval.planHash).toBe(executionPlanHash(subject));
    expect(approval.dependencyDigest).toBe(subject.boundState.dependencyDigest);
    expect(approval.capsuleId).toBe(subjectCapsule.id);
    expect(approval.capsuleHash).toBe(executionCapsuleHash(subjectCapsule));
  });

  it("refuses a capsule whose immutable content differs from the approved capsule", async () => {
    const approvedCapsule = capsule();
    const changedCapsule = capsule({ objective: "widened objective" });
    const transform = transformPort();
    const { result } = await execute({ approvalCapsule: approvedCapsule, executionCapsule: changedCapsule, transform });

    expect(result.outcome).toBe("failure");
    expect(result.reasons).toContain("approval does not match the immutable execution capsule");
    expect(transform.applies).toBe(0);
  });

  it("fails closed when a capsule write selector cannot be compiled into deterministic scope", async () => {
    const unsupportedCapsule = capsule({
      allowedWrites: [{
        selector: {
          op: "not",
          item: { op: "atom", field: "path", matcher: "glob", value: "private/**" },
        },
        operations: ["move-reference-update"],
        reason: "unsupported negative scope",
      }],
    });
    const transform = transformPort();
    const { result } = await execute({
      transform,
      executionCapsule: unsupportedCapsule,
      approvalCapsule: unsupportedCapsule,
    });

    expect(result.outcome).toBe("failure");
    expect(result.reasons).toContain("capsule write selector cannot be enforced deterministically");
    expect(transform.applies).toBe(0);
  });

  it("derives unit and path scope from the approved plan and capsule instead of caller input", async () => {
    const transform = transformPort({ touchedUnitId: "unit:outside" });
    const scopedCapsule = capsule({
      forbiddenWrites: [{
        selector: { op: "atom", field: "path", matcher: "glob", value: "scripts/private/**" },
        operations: ["move-reference-update"],
        reason: "private scripts are excluded",
      }],
    });
    const { result, transactions } = await execute({
      transform,
      executionCapsule: scopedCapsule,
      approvalCapsule: scopedCapsule,
      allowedUnits: ["unit:move", "unit:outside"],
    });

    expect(result.outcome).toBe("failure");
    expect(result.reasons).toContain("transform preview touched units outside the approved capsule: unit:outside");
    expect(transactions.begins).toBe(0);
    expect(transform.contexts[0]?.allowedUnits).toEqual(["unit:move"]);
    expect(transform.contexts[0]?.repositoryRoot).toBe("/approved/repo");
    expect((transform.contexts[0] as TransformContext & { approvedBoundary?: string[] }).approvedBoundary).toEqual([
      "package.json",
      "scripts/**",
    ]);
    expect((transform.contexts[0] as TransformContext & { forbiddenBoundary?: string[] }).forbiddenBoundary)
      .toEqual(["scripts/private/**"]);
  });

  it("derives receipt risk from the approved capsule rather than caller input", async () => {
    const { result } = await execute({ callerRiskClass: "R0" });
    expect(result.receipt.riskClass).toBe("R1");
  });

  it("content-addresses completion evidence independently of assessment insertion order", async () => {
    const subjectPlan = plan("plan:move", { maximumUnknowns: 2 });
    const left = await execute({
      subjectPlan,
      completionAssessment: completeAssessment({
        unknowns: ["zeta", "alpha"],
        availableArtifacts: ["trace", "diff"],
      }),
    });
    const right = await execute({
      subjectPlan,
      completionAssessment: completeAssessment({
        unknowns: ["alpha", "zeta"],
        availableArtifacts: ["diff", "trace"],
      }),
    });

    expect(left.result.certificateHash).toBe(right.result.certificateHash);
  });

  it.each([
    {
      name: "required evidence lane",
      completion: { requiredEvidenceLanes: ["test"] },
      assessment: {},
      validations: [validation("passed")],
      reason: "required evidence lane did not pass: test",
    },
    {
      name: "minimum assurance",
      completion: { minimumValidationAssurance: "exact" as const },
      assessment: {},
      validations: [validation("passed", { assurance: "strong" })],
      reason: "required validation move-reference-update.verify is below exact assurance",
    },
    {
      name: "independent validation",
      completion: { requireIndependentValidation: true },
      assessment: {},
      validations: [validation("passed")],
      reason: "completion requires an independent passing validation",
    },
    {
      name: "required unit state",
      completion: {},
      assessment: { unitStates: [{ unitId: "unit:move", state: "removed" as const }] },
      validations: [validation("passed")],
      reason: "required unit state not established: unit:move must be valid",
    },
    {
      name: "divergence bound",
      completion: { maximumNewDivergences: 0 },
      assessment: { newDivergenceIds: ["divergence:new"] },
      validations: [validation("passed")],
      reason: "new divergence count 1 exceeds maximum 0",
    },
    {
      name: "unknown bound",
      completion: { maximumUnknowns: 0 },
      assessment: { unknowns: ["unresolved consumer"] },
      validations: [validation("passed")],
      reason: "unknown count 1 exceeds maximum 0",
    },
    {
      name: "unavailable action policy",
      completion: { allowUnavailableExternalActions: false },
      assessment: { unavailableActions: ["publish"] },
      validations: [validation("passed")],
      reason: "unavailable external actions are not allowed: publish",
    },
    {
      name: "artifact policy",
      completion: { requiredArtifacts: ["certificate", "receipt", "diff"] },
      assessment: {},
      validations: [validation("passed")],
      reason: "required artifact is unavailable: diff",
    },
    {
      name: "clean working tree policy",
      completion: { cleanWorkingTree: true },
      assessment: { cleanWorkingTree: false },
      validations: [validation("passed")],
      reason: "completion requires a clean working tree",
    },
  ] satisfies Array<{
    name: string;
    completion: Partial<CompletionContract>;
    assessment: Partial<TestCompletionAssessment>;
    validations: ValidationResult[];
    reason: string;
  }>)("enforces CompletionContract $name", async ({ completion, assessment, validations, reason }) => {
    const subjectPlan = plan("plan:move", completion);
    const { result, transactions } = await execute({
      subjectPlan,
      transform: transformPort({ verify: validations }),
      completionAssessment: completeAssessment(assessment),
    });

    expect(result.outcome).toBe("partial");
    expect(result.reasons).toContain(reason);
    expect(transactions.transaction.phase).toBe("rolled-back");
  });
});
