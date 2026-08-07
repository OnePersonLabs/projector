import type { ExecutionPolicy } from "@projector/core";

export type SliceCommand = "init" | "audit" | "plan" | "apply" | "reconcile" | "explain";

export interface CliPolicyInput {
  readonly command: SliceCommand;
  readonly mode?: ExecutionPolicy["preset"];
  readonly dryRun?: boolean;
  readonly auditOnly?: boolean;
  readonly nonInteractive?: boolean;
}

export function normalizeExecutionPolicy(input: CliPolicyInput): Readonly<ExecutionPolicy> {
  const preset = input.mode ?? "guide";
  const mutationCommand = input.command === "init" || input.command === "apply" || input.command === "reconcile";
  if (preset === "observe" && mutationCommand && input.dryRun !== true) {
    throw new Error(`observe mode cannot ${input.command}`);
  }
  if (input.auditOnly === true && (mutationCommand || input.dryRun === true)) {
    throw new Error("contradictory mutation and audit-only/dry-run flags");
  }
  const allowAutoMutation = mutationCommand && input.dryRun !== true && preset !== "observe";
  return Object.freeze({
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
}
