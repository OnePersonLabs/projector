import { hashFramedDomain, type ContentHash } from "@projector/core";

export const MANDATORY_VERTICAL_SLICE_STEPS = [
  "inventory-and-classify-without-execution",
  "infer-descriptive-pattern-families",
  "classify-misplaced-script-by-causal-evidence",
  "separate-candidate-from-lens-authority",
  "exclude-generated-occurrences-from-authority",
  "compile-active-and-shadow-governance",
  "emit-placement-and-test-divergences",
  "preview-r1-deterministic-repair",
  "bind-plan-capsule-and-approval-to-state",
  "acquire-writer-lease-and-journal",
  "move-source-test-and-update-references",
  "run-independent-validators",
  "reconcile-to-fixed-point",
  "prove-second-run-zero-material-delta",
  "emit-zero-unresolved-cleanup-plan",
  "emit-receipt-and-certificate",
  "prove-derived-state-rebuild-equivalence",
] as const;

export type MandatoryVerticalSliceStep = typeof MANDATORY_VERTICAL_SLICE_STEPS[number];

export interface MandatoryVerticalSliceStepEvidence {
  readonly step: MandatoryVerticalSliceStep;
  readonly sequence: number;
  readonly summary: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function assertMandatoryVerticalSliceEvidence(
  evidence: readonly MandatoryVerticalSliceStepEvidence[],
): void {
  if (evidence.length !== MANDATORY_VERTICAL_SLICE_STEPS.length) {
    throw new Error("mandatory vertical slice requires exactly 17 ordered steps");
  }
  for (const [index, expected] of MANDATORY_VERTICAL_SLICE_STEPS.entries()) {
    const item = evidence[index];
    if (item?.sequence !== index + 1 || item.step !== expected || item.summary.trim().length === 0) {
      throw new Error(`mandatory vertical slice step ${index + 1} must be ${expected}`);
    }
  }
}

export interface ReconciliationIteration {
  readonly governedStateDigest: ContentHash;
  readonly materialChanged: boolean;
  readonly fixedPointTerminal: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ReconciliationPort {
  iterate(iteration: number): Promise<ReconciliationIteration>;
}

export interface FixedPointReconciliation {
  readonly converged: true;
  readonly iterations: readonly ReconciliationIteration[];
  readonly materialDelta: false;
  readonly reconciliationHash: ContentHash;
}

export class NonconvergentReconciliationError extends Error {
  readonly code = "nonconvergent-reconciliation";

  constructor(message: string) {
    super(`nonconvergent-reconciliation: ${message}`);
    this.name = "NonconvergentReconciliationError";
  }
}

export async function reconcileToFixedPoint(
  port: ReconciliationPort,
  options: { readonly maximumIterations?: number } = {},
): Promise<FixedPointReconciliation> {
  const maximumIterations = options.maximumIterations ?? 8;
  if (!Number.isSafeInteger(maximumIterations) || maximumIterations < 1) {
    throw new TypeError("reconciliation maximumIterations must be a positive integer");
  }
  const iterations: ReconciliationIteration[] = [];
  const nonterminalDigests = new Set<ContentHash>();
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const outcome = structuredClone(await port.iterate(iteration));
    iterations.push(outcome);
    if (!outcome.materialChanged && outcome.fixedPointTerminal) {
      return {
        converged: true,
        iterations,
        materialDelta: false,
        reconciliationHash: hashFramedDomain("fixed-point-reconciliation", iterations),
      };
    }
    if (nonterminalDigests.has(outcome.governedStateDigest)) {
      throw new NonconvergentReconciliationError(
        `repeated nonterminal governed digest ${outcome.governedStateDigest} at iteration ${iteration}`,
      );
    }
    nonterminalDigests.add(outcome.governedStateDigest);
  }
  throw new NonconvergentReconciliationError(`iteration budget ${maximumIterations} exhausted`);
}
