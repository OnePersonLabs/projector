import type { ExecutionPolicy, RiskClass } from "@projector/core";

const RISKS: RiskClass[] = ["R0", "R1", "R2", "R3", "R4"];
export const riskRank = (risk: RiskClass): number => RISKS.indexOf(risk);

export interface RiskPolicyRequirements {
  readonly approval: RiskClass;
  readonly worktree: RiskClass;
  readonly independentValidation: RiskClass;
  readonly minimumEvidence: number;
}

export function normalizeRiskPolicy(risk: RiskClass): RiskPolicyRequirements {
  const rank = riskRank(risk);
  if (rank < 0) throw new TypeError(`unknown risk class: ${risk}`);
  return { approval: risk, worktree: rank < 2 ? "R0" : risk, independentValidation: rank < 1 ? "R0" : risk, minimumEvidence: rank + 1 };
}

export function assertPolicyRiskMonotonic(policy: ExecutionPolicy): void {
  if (riskRank(policy.maximumAutomaticRisk) >= 4) throw new TypeError("R4 can never be automatic");
  if (policy.allowAutoMutation && riskRank(policy.requireIndependentValidationAtOrAbove) > riskRank(policy.maximumAutomaticRisk)) {
    throw new TypeError("automatic mutation would bypass its independent-validation threshold");
  }
}

export function assertGovernanceConflictPolicy(preset: ExecutionPolicy["preset"], conflictPaths: readonly string[]): void {
  if ((preset === "govern" || preset === "autonomous") && conflictPaths.length > 0) {
    throw new Error(`canonical governance conflict blocks ${preset}: ${[...conflictPaths].sort().join(", ")}`);
  }
}
