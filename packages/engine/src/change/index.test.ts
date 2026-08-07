import { describe, expect, it } from "vitest";

import {
  hashFramedDomain,
  hashSemantic,
  type AdapterContext,
  type ChangeCertificate,
  type ExecutionPlan,
  type StateBinding,
  type StateBindingValidation,
  type StateDigest,
  type TransformContext,
  type TransformPreview,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";

import { createExecutionPlan } from "../planning/index.js";
import {
  StateBoundChangeExecutor,
  createExecutionApproval,
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

const plan = (id = "plan:move"): ExecutionPlan => createExecutionPlan({
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
  },
});

const validation = (status: ValidationResult["status"]): ValidationResult => ({
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
  readonly events: string[] = [];

  async checkpoint(id: string): Promise<void> {
    this.lastCheckpointId = id;
    this.events.push(`checkpoint:${id}`);
  }

  async transition(phase: "workspace-staged" | "validating" | "canonical-staging" | "committing"): Promise<void> {
    (this as { phase: ChangeTransaction["phase"] }).phase = phase;
    this.events.push(`phase:${phase}`);
  }

  async commit(): Promise<void> {
    (this as { phase: ChangeTransaction["phase"] }).phase = "committed";
    this.events.push("commit");
  }

  async rollback(): Promise<void> {
    (this as { phase: ChangeTransaction["phase"] }).phase = "rolled-back";
    this.events.push("rollback");
  }
}

class MemoryTransactionPort implements ChangeTransactionPort {
  readonly transaction = new MemoryTransaction();
  begins = 0;

  async begin(): Promise<ChangeTransaction> {
    this.begins += 1;
    return this.transaction;
  }
}

const transformPort = (options: { changed?: boolean; verify?: ValidationResult[]; throwAfterChange?: boolean } = {}): DeterministicTransformPort<{}> & { applies: number } => ({
  applies: 0,
  async preview(_input: {}, _context: TransformContext): Promise<TransformPreview> {
    return { applicable: true, operations: [{ kind: "move" }], touchedUnitIds: ["unit:move"], expectedDiff: "move", warnings: [] };
  },
  async apply(_input: {}, _context: TransformContext): Promise<TransformResult> {
    this.applies += 1;
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
}) => {
  const artifacts = new MemoryArtifactStore();
  const transactions = new MemoryTransactionPort();
  const subjectPlan = plan();
  const states = [initialState, afterState];
  const executor = new StateBoundChangeExecutor({
    state: { async current(): Promise<StateDigest> { return states.shift() ?? afterState; } },
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
    now: () => "2026-08-07T12:00:00.000Z",
  });
  const approved = input.approvalPlan ?? subjectPlan;
  const result = await executor.execute({
    plan: subjectPlan,
    capsule: { id: "capsule:move", boundState: binding, requiredValidations: ["move-reference-update.verify"] },
    approval: createExecutionApproval(approved, "approval:1"),
    transformInput: {},
    repositoryRoot: "/repo",
    riskClass: "R1",
    allowedUnits: ["unit:move"],
  });
  return { result, artifacts, transactions };
};

describe("state-bound deterministic change execution", () => {
  it("emits a compact receipt linked to a verbose content-addressed success certificate", async () => {
    const { result, artifacts, transactions } = await execute({});

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
      "checkpoint:before-transform",
      "phase:workspace-staged",
      "phase:validating",
      "checkpoint:after-validation",
      "phase:canonical-staging",
      "phase:committing",
      "commit",
    ]);
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
    const approval = createExecutionApproval(subject, "approval:1");
    expect(approval.planHash).toBe(executionPlanHash(subject));
    expect(approval.dependencyDigest).toBe(subject.boundState.dependencyDigest);
  });
});
