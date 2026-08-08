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

export const MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS = [
  "inventory",
  "pattern-families",
  "causal-classification",
  "authority-lens",
  "generated-exclusion",
  "governance",
  "divergences",
  "preview",
  "binding",
  "lease-journal",
  "operations",
  "validators",
  "fixed-point",
  "second-run",
  "cleanup",
  "receipt-certificate",
  "rebuild",
] as const;

export type MandatoryVerticalSliceEvidenceKind = typeof MANDATORY_VERTICAL_SLICE_EVIDENCE_KINDS[number];

const proofContracts: ReadonlyArray<{
  readonly kind: MandatoryVerticalSliceEvidenceKind;
  readonly required: readonly string[];
  readonly nonEmpty: readonly string[];
}> = [
  { kind: "inventory", required: ["inventoryUnitIds", "classificationIds", "executedRepositoryCode", "artifactRefs"], nonEmpty: ["inventoryUnitIds", "classificationIds", "artifactRefs"] },
  { kind: "pattern-families", required: ["familyKeys", "familyCount", "artifactRefs"], nonEmpty: ["familyKeys", "artifactRefs"] },
  { kind: "causal-classification", required: ["sourceUnitId", "testUnitId", "causalEvidenceIds", "artifactRefs"], nonEmpty: ["sourceUnitId", "testUnitId", "causalEvidenceIds", "artifactRefs"] },
  { kind: "authority-lens", required: ["authorityId", "activeLensId", "authorityStatus", "artifactRefs"], nonEmpty: ["authorityId", "activeLensId", "authorityStatus", "artifactRefs"] },
  { kind: "generated-exclusion", required: ["repairedPaths", "independenceGroups", "provenanceRef", "artifactRefs"], nonEmpty: ["repairedPaths", "provenanceRef", "artifactRefs"] },
  { kind: "governance", required: ["activeLensId", "shadowLensId", "ruleIds", "artifactRefs"], nonEmpty: ["activeLensId", "shadowLensId", "ruleIds", "artifactRefs"] },
  { kind: "divergences", required: ["divergenceIds", "counterEvidenceIds", "artifactRefs"], nonEmpty: ["divergenceIds", "counterEvidenceIds", "artifactRefs"] },
  { kind: "preview", required: ["planId", "operationKinds", "touchedUnitIds", "artifactRefs"], nonEmpty: ["planId", "operationKinds", "touchedUnitIds", "artifactRefs"] },
  { kind: "binding", required: ["planDependencyDigest", "capsuleDependencyDigest", "approvalDependencyDigest", "artifactRefs"], nonEmpty: ["planDependencyDigest", "capsuleDependencyDigest", "approvalDependencyDigest", "artifactRefs"] },
  { kind: "lease-journal", required: ["leaseId", "transactionId", "journalPhases", "touchedPaths", "artifactRefs"], nonEmpty: ["leaseId", "transactionId", "journalPhases", "touchedPaths", "artifactRefs"] },
  { kind: "operations", required: ["operationIds", "touchedUnitIds", "pathSummaries", "artifactRefs"], nonEmpty: ["operationIds", "touchedUnitIds", "pathSummaries", "artifactRefs"] },
  { kind: "validators", required: ["validatorIds", "validationStatuses", "validatorEvidenceIds", "artifactRefs"], nonEmpty: ["validatorIds", "validationStatuses", "validatorEvidenceIds", "artifactRefs"] },
  { kind: "fixed-point", required: ["iterationDigests", "materialChanged", "terminalIteration", "artifactRefs"], nonEmpty: ["iterationDigests", "artifactRefs"] },
  { kind: "second-run", required: ["invocation", "beforeDigest", "afterDigest", "materialDelta", "artifactRefs"], nonEmpty: ["beforeDigest", "afterDigest", "artifactRefs"] },
  { kind: "cleanup", required: ["unresolvedClusterWork", "unresolvedDivergenceIds", "computedFrom", "artifactRefs"], nonEmpty: ["computedFrom", "artifactRefs"] },
  { kind: "receipt-certificate", required: ["receiptRef", "certificateRef", "receiptHash", "certificateHash", "artifactRefs"], nonEmpty: ["receiptRef", "certificateRef", "receiptHash", "certificateHash", "artifactRefs"] },
  { kind: "rebuild", required: ["beforeDigest", "afterDigest", "semanticHashPairs", "artifactRefs"], nonEmpty: ["beforeDigest", "afterDigest", "semanticHashPairs", "artifactRefs"] },
];

export interface MandatoryVerticalSliceEvidenceDetails {
  readonly outputDigest: ContentHash;
  readonly evidenceKind: MandatoryVerticalSliceEvidenceKind;
  readonly artifactRefs: readonly string[];
  readonly proof: Readonly<Record<string, unknown>>;
  readonly assertions: readonly {
    readonly claim: string;
    readonly observed: unknown;
    readonly expected: unknown;
    readonly passed: boolean;
  }[];
}

export function mandatoryVerticalSliceEvidenceDigest(
  step: MandatoryVerticalSliceStep,
  evidenceKind: MandatoryVerticalSliceEvidenceKind,
  artifactRefs: readonly string[],
  proof: Readonly<Record<string, unknown>>,
): ContentHash {
  return hashFramedDomain("mandatory-vertical-slice-proof", { step, evidenceKind, artifactRefs, proof });
}

export interface MandatoryVerticalSliceStepEvidence {
  readonly step: MandatoryVerticalSliceStep;
  readonly sequence: number;
  readonly summary: string;
  readonly details: MandatoryVerticalSliceEvidenceDetails;
}

export function assertMandatoryVerticalSliceEvidence(
  evidence: readonly MandatoryVerticalSliceStepEvidence[],
): void {
  if (evidence.length !== MANDATORY_VERTICAL_SLICE_STEPS.length) {
    throw new Error("mandatory vertical slice requires exactly 17 ordered steps");
  }
  for (const [index, expected] of MANDATORY_VERTICAL_SLICE_STEPS.entries()) {
    const item = evidence[index];
    const contract = proofContracts[index];
    if (item?.sequence !== index + 1 || item.step !== expected || item.summary.trim().length === 0) {
      throw new Error(`mandatory vertical slice step ${index + 1} must be ${expected}`);
    }
    if (item.details === undefined || !item.details.outputDigest.startsWith("sha256:v1:")
      || item.details.evidenceKind !== contract?.kind
      || item.details.artifactRefs.length === 0 || item.details.assertions.length === 0
      || !isConcreteArtifactRefs(item.details.artifactRefs)
      || item.details.proof === undefined
      || canonicalComparable(item.details.proof.artifactRefs) !== canonicalComparable(item.details.artifactRefs)) {
      throw new Error(`mandatory vertical slice step ${index + 1} requires structured details linked to outputs`);
    }
    if (item.details.outputDigest !== mandatoryVerticalSliceEvidenceDigest(item.step, item.details.evidenceKind, item.details.artifactRefs, item.details.proof)) {
      throw new Error(`mandatory vertical slice step ${index + 1} output digest does not match proof`);
    }
    for (const key of contract?.required ?? []) {
      if (!Object.hasOwn(item.details.proof, key)) {
        throw new Error(`mandatory vertical slice step ${index + 1} is missing proof field ${key}`);
      }
    }
    for (const key of contract?.nonEmpty ?? []) {
      const value = item.details.proof[key];
      if ((typeof value === "string" && value.trim().length === 0)
        || (Array.isArray(value) && value.length === 0)
        || value === undefined || value === null) {
        throw new Error(`mandatory vertical slice step ${index + 1} has empty proof field ${key}`);
      }
    }
    if (!validateProofContract(contract?.kind, item.details.proof)) {
      throw new Error(`mandatory vertical slice step ${index + 1} proof failed its typed predicate`);
    }
    if (Object.values(item.details.proof).some((value) => typeof value === "string" && (value === expected || value === item.summary || value === item.step))) {
      throw new Error(`mandatory vertical slice step ${index + 1} proof is self-corresponding rather than concrete`);
    }
    if (item.details.assertions.some((assertion) => !assertion.passed
      || assertion.claim.trim().length === 0
      || canonicalComparable(assertion.observed) !== canonicalComparable(assertion.expected))) {
      throw new Error(`mandatory vertical slice step ${index + 1} contains a failed assertion`);
    }
  }
}

function isConcreteArtifactRefs(refs: readonly string[]): boolean {
  return refs.every((ref) => ref.trim().length > 2 && /^[a-z][a-z0-9_-]*:/u.test(ref) && !/^artifact:(?:step-)?[a-z0-9-]+$/u.test(ref));
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:v1:[0-9a-f]{64}$/u.test(value);
}

function isEntityReference(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 2 && (value.includes(":") || /^[a-z][a-z0-9_-]+_[0-9a-f]{16,}$/u.test(value));
}

function validateProofContract(kind: MandatoryVerticalSliceEvidenceKind | undefined, proof: Readonly<Record<string, unknown>>): boolean {
  switch (kind) {
    case "inventory":
      return isStringArray(proof.inventoryUnitIds) && isStringArray(proof.classificationIds) && proof.executedRepositoryCode === false;
    case "pattern-families":
      return isStringArray(proof.familyKeys) && typeof proof.familyCount === "number" && proof.familyCount === proof.familyKeys.length && proof.familyCount > 0;
    case "causal-classification":
      return isEntityReference(proof.sourceUnitId) && isEntityReference(proof.testUnitId) && isStringArray(proof.causalEvidenceIds);
    case "authority-lens":
      return typeof proof.authorityId === "string" && proof.authorityId.startsWith("authority:") && typeof proof.activeLensId === "string" && proof.activeLensId.startsWith("lens:") && proof.authorityStatus === "approved";
    case "generated-exclusion":
      return isStringArray(proof.repairedPaths) && proof.repairedPaths.some((path) => path.includes("scripts/validate-repo")) && Array.isArray(proof.independenceGroups) && typeof proof.provenanceRef === "string" && proof.provenanceRef.startsWith("receipt:");
    case "governance":
      return typeof proof.activeLensId === "string" && proof.activeLensId.startsWith("lens:") && typeof proof.shadowLensId === "string" && proof.shadowLensId.startsWith("lens:") && proof.activeLensId !== proof.shadowLensId && isStringArray(proof.ruleIds);
    case "divergences":
      return isStringArray(proof.divergenceIds) && isStringArray(proof.counterEvidenceIds);
    case "preview":
      return typeof proof.planId === "string" && proof.planId.length > 3 && isStringArray(proof.operationKinds) && isStringArray(proof.touchedUnitIds);
    case "binding":
      return isHash(proof.planDependencyDigest) && proof.planDependencyDigest === proof.capsuleDependencyDigest && proof.planDependencyDigest === proof.approvalDependencyDigest;
    case "lease-journal":
      return typeof proof.leaseId === "string" && (proof.leaseId.startsWith("lease:") || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/u.test(proof.leaseId)) && typeof proof.transactionId === "string" && proof.transactionId.startsWith("transaction:") && isStringArray(proof.journalPhases) && proof.journalPhases.includes("committed") && isStringArray(proof.touchedPaths);
    case "operations":
      return isStringArray(proof.operationIds) && isStringArray(proof.touchedUnitIds) && isStringArray(proof.pathSummaries) && proof.pathSummaries.some((summary) => summary.startsWith("moved ")) && proof.pathSummaries.some((summary) => summary.includes("reference"));
    case "validators":
      return isStringArray(proof.validatorIds) && Array.isArray(proof.validationStatuses) && proof.validationStatuses.length === proof.validatorIds.length && proof.validationStatuses.every((status) => status === "passed") && isStringArray(proof.validatorEvidenceIds);
    case "fixed-point":
      return Array.isArray(proof.iterationDigests) && proof.iterationDigests.length > 0 && proof.iterationDigests.every(isHash) && Array.isArray(proof.materialChanged) && proof.materialChanged.length === proof.iterationDigests.length && proof.materialChanged.some((changed) => changed === true) && proof.terminalIteration === true;
    case "second-run":
      return proof.invocation === 2 && isHash(proof.beforeDigest) && isHash(proof.afterDigest) && proof.beforeDigest === proof.afterDigest && proof.materialDelta === false;
    case "cleanup":
      return proof.unresolvedClusterWork === 0 && Array.isArray(proof.unresolvedDivergenceIds) && proof.unresolvedDivergenceIds.length === 0 && typeof proof.computedFrom === "string" && proof.computedFrom.startsWith("state:");
    case "receipt-certificate":
      return typeof proof.receiptRef === "string" && proof.receiptRef.startsWith("/") && typeof proof.certificateRef === "string" && proof.certificateRef.startsWith("/") && isHash(proof.receiptHash) && isHash(proof.certificateHash);
    case "rebuild":
      return isHash(proof.beforeDigest) && isHash(proof.afterDigest) && proof.beforeDigest === proof.afterDigest && proof.semanticHashPairs !== undefined;
    default:
      return false;
  }
}

function canonicalComparable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
    }
    return item;
  });
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
