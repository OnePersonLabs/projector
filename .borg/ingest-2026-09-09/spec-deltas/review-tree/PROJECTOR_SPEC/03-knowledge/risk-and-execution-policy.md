# Risk, Approval, and Execution Policy

## Risk, approval, and execution policy

R0–R4 remains the user-facing risk vocabulary, but risk is contextual rather than an intrinsic property of a file or transform.

```ts
export type RiskClass = "R0" | "R1" | "R2" | "R3" | "R4";

export interface RiskAssessment {
  class: RiskClass;
  inherentOperationRisk: number;
  affectedUnitCount: number;
  affectedSurfaceCount: number;
  publicContractImpact: boolean;
  externalImpact: boolean;
  dataImpact: boolean;
  reversibility: "full" | "strong" | "partial" | "none";
  validationStrength: "weak" | "supporting" | "strong" | "exact";
  closureConfidence: "proven" | "bounded" | "high" | "partial" | "unknown";
  unresolvedIdentityCount: number;
  relevanceFrontierCount: number;
  openWorldDependencies: boolean;
  unresolvedBlockingConcernCount: number;
  suspectDecisionCount: number;
  compensationAvailable: boolean;
  reasons: string[];
}

export interface ExecutionPolicy {
  preset: "observe" | "guide" | "govern" | "autonomous" | "salvage";
  maximumAutomaticRisk: RiskClass;
  network: "deny" | "ask" | "allow";
  externalWrites: "deny" | "approval" | "allow-with-capability";
  requireIndependentValidationAtOrAbove: RiskClass;
  requireWorktreeAtOrAbove: RiskClass;
  allowAutoPromotion: boolean;
  allowAutoMutation: boolean;
  maxChangedUnits?: number;
  maxChangedSurfaces?: number;
  maxCost?: number;
  maxTokens?: number;
}
```

Default meaning:

| Class | Typical consequence | Default policy |
|---|---|---|
| R0 | read-only inference/reporting | automatic |
| R1 | reversible deterministic normalization with strong local proof | automatic in conservative/guide policy where allowed |
| R2 | local semantic change with strong rollback and validation | plan automatically. Approval before apply |
| R3 | cross-package, public API, schema, CI, architecture, or external-surface change | explicit approval |
| R4 | destructive data, production security boundary, billing, identity, irreversible release action | never autonomous in 1.x |

Risk MUST increase or stay the same as uncertainty increases. Unresolved semantic identity/ownership, weak relevance coverage, lower coverage, weaker validation, stale observations, larger unknown frontiers, or weaker rollback MAY raise approval requirements. These conditions MUST NEVER lower them.

Projector assesses lens/rule promotion by **governance impact**, not only physical mutation risk. A rule that would block future cross-package work can be R3 governance even if accepting its JSON file is mechanically reversible.

CLI flags and friendly modes normalize into one `ExecutionPolicy`. Contradictory combinations are errors rather than precedence puzzles.

---
