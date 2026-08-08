import type { ExecutionPolicy, RiskClass } from "@projector/core";

export type SliceCommand = "init" | "audit" | "change" | "plan" | "apply" | "upgrade" | "reconcile" | "explain" | "coverage" | "complete" | "cleanup" | "run" | "mcp";

export interface CliPolicyInput {
  readonly command: SliceCommand;
  readonly mode?: ExecutionPolicy["preset"];
  readonly dryRun?: boolean;
  readonly auditOnly?: boolean;
  readonly nonInteractive?: boolean;
}

export interface OperationRiskInput {
  readonly command: SliceCommand;
  readonly sideEffect: "read-only" | "derived-write" | "workspace-write" | "canonical-write" | "external-write";
  readonly externalWrite: boolean;
  readonly canonicalMutation: boolean;
}

const riskRank = (risk: RiskClass): number => ["R0", "R1", "R2", "R3", "R4"].indexOf(risk);

export function assertOperationRiskAuthorized(policy: ExecutionPolicy, risk: RiskClass): void {
  if (risk === "R4") throw new Error("R4 can never execute automatically");
  if (riskRank(risk) > riskRank(policy.maximumAutomaticRisk)) {
    throw new Error(`operation risk ${risk} exceeds automatic policy ${policy.maximumAutomaticRisk}`);
  }
}

export function deriveOperationRisk(input: OperationRiskInput): RiskClass {
  if (input.externalWrite || input.sideEffect === "external-write") return "R3";
  if (input.canonicalMutation || input.sideEffect === "canonical-write") return "R2";
  if (input.sideEffect === "workspace-write" || input.sideEffect === "derived-write") return "R1";
  return "R0";
}

export function normalizeExecutionPolicy(input: CliPolicyInput): Readonly<ExecutionPolicy> {
  if (input.auditOnly === true && input.mode !== undefined && input.mode !== "observe" && input.mode !== "guide") {
    throw new Error("contradictory audit-only and mutation-capable mode flags");
  }
  const preset = input.auditOnly === true && input.mode === undefined ? "observe" : (input.mode ?? "guide");
  const mutationCommand = input.command === "init" || input.command === "apply" || input.command === "upgrade" || input.command === "reconcile" || input.command === "cleanup" || input.command === "run";
  if (input.auditOnly === true && mutationCommand) {
    throw new Error("contradictory mutation and audit-only flags");
  }
  if (preset === "observe" && mutationCommand && input.dryRun !== true) {
    throw new Error(`observe mode cannot ${input.command}`);
  }
  if (input.auditOnly === true && input.dryRun === true) {
    throw new Error("contradictory mutation and audit-only/dry-run flags");
  }
  const allowAutoMutation = mutationCommand && input.dryRun !== true && preset !== "observe";
  const policy = Object.freeze({
    preset,
    maximumAutomaticRisk: allowAutoMutation ? "R1" : "R0",
    network: "deny",
    externalWrites: "deny",
    requireIndependentValidationAtOrAbove: "R1",
    requireWorktreeAtOrAbove: "R2",
    allowAutoPromotion: false,
    allowAutoMutation,
    maxChangedUnits: 4,
    maxChangedSurfaces: 1,
  });
  return policy;
}
