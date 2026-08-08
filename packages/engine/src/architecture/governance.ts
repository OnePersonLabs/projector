import {
  ArchitectureDecisionSchema,
  AuthorityRecordSchema,
  canonicalJson,
  hashFramedDomain,
  type ArchitectureDecision,
  type AuthorityRecord,
  type ContentHash,
  type DecisionConsequence,
} from "@projector/core";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export type DecisionOverlapAssessment = "disjoint" | "compatible" | "incompatible" | "unknown";

export interface DecisionOverlapPort {
  assess(left: ArchitectureDecision, right: ArchitectureDecision): Promise<DecisionOverlapAssessment>;
}

export interface SemanticGovernanceBatch {
  decisions: readonly ArchitectureDecision[];
  consequences: readonly DecisionConsequence[];
  semanticHash: ContentHash;
}

export interface SemanticGovernanceTransactionPort {
  /** The implementation must durably commit the complete batch or leave canonical state unchanged. */
  transact(batch: SemanticGovernanceBatch): Promise<void>;
}

export interface AcceptArchitectureDecisionsInput {
  decisions: readonly ArchitectureDecision[];
  existingDecisions: readonly ArchitectureDecision[];
  authorityRecords: readonly AuthorityRecord[];
}

export type ArchitectureAcceptanceResult =
  | { activated: true; batchHash: ContentHash }
  | { activated: false; code: "invalid-decision" | "unauthorized-decision" | "incompatible-decision-overlap" | "transaction-failure"; reasons: string[] };

function normalizeDecisions(decisions: readonly ArchitectureDecision[]): ArchitectureDecision[] {
  const byId = new Map<string, ArchitectureDecision>();
  for (const raw of decisions) {
    const decision = ArchitectureDecisionSchema.parse(structuredClone(raw)) as ArchitectureDecision;
    const existing = byId.get(decision.id);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(decision)) throw new Error(`conflicting decision ${decision.id}`);
    byId.set(decision.id, decision);
  }
  return [...byId.values()].sort((left, right) => compareStrings(left.id, right.id));
}

function authorityAllows(decision: ArchitectureDecision, records: ReadonlyMap<string, AuthorityRecord>): string | undefined {
  const record = records.get(decision.authorityRecordId);
  if (record === undefined) return `authority record ${decision.authorityRecordId} is missing`;
  if (record.subjectId !== decision.concernId) return `authority record ${record.id} is bound to another concern`;
  if (record.status !== "approved" && record.status !== "auto-approved") return `authority record ${record.id} is not active`;
  if (record.conclusion === "unknown" || record.conclusion === "exception") return `authority record ${record.id} does not authorize general decision activation`;
  if (record.decidedBy === "system" && record.status !== "auto-approved") return `system authority ${record.id} lacks auto-approval`;
  return undefined;
}

export async function acceptArchitectureDecisions(
  input: AcceptArchitectureDecisionsInput,
  ports: { overlap: DecisionOverlapPort; transaction: SemanticGovernanceTransactionPort },
): Promise<ArchitectureAcceptanceResult> {
  let decisions: ArchitectureDecision[];
  let existingDecisions: ArchitectureDecision[];
  const records = new Map<string, AuthorityRecord>();
  try {
    decisions = normalizeDecisions(input.decisions);
    existingDecisions = normalizeDecisions(input.existingDecisions).filter(({ lifecycle }) => lifecycle === "active");
    for (const raw of input.authorityRecords) {
      const record = AuthorityRecordSchema.parse(structuredClone(raw)) as AuthorityRecord;
      const existing = records.get(record.id);
      if (existing !== undefined && canonicalJson(existing) !== canonicalJson(record)) throw new Error(`conflicting authority record ${record.id}`);
      records.set(record.id, record);
    }
  } catch (error) {
    return { activated: false, code: "invalid-decision", reasons: [error instanceof Error ? error.message : "invalid architecture decision batch"] };
  }
  const authorityReasons = decisions.map((decision) => authorityAllows(decision, records)).filter((reason): reason is string => reason !== undefined);
  if (authorityReasons.length > 0) return { activated: false, code: "unauthorized-decision", reasons: authorityReasons.sort(compareStrings) };

  const comparisons: Array<readonly [ArchitectureDecision, ArchitectureDecision]> = [];
  for (let leftIndex = 0; leftIndex < decisions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < decisions.length; rightIndex += 1) comparisons.push([decisions[leftIndex]!, decisions[rightIndex]!]);
  }
  for (const candidate of decisions) {
    for (const existing of existingDecisions) if (candidate.id !== existing.id) comparisons.push([candidate, existing]);
  }
  const overlapReasons: string[] = [];
  for (const [left, right] of comparisons) {
    const assessment = await ports.overlap.assess(structuredClone(left), structuredClone(right));
    if (assessment === "incompatible" || assessment === "unknown") overlapReasons.push(`${left.id} and ${right.id} have ${assessment} overlap compatibility`);
  }
  if (overlapReasons.length > 0) return { activated: false, code: "incompatible-decision-overlap", reasons: overlapReasons.sort(compareStrings) };

  const consequences = decisions.flatMap(({ consequences: items }) => items).map((item) => structuredClone(item));
  const semanticHash = hashFramedDomain("semantic-governance-decision-batch", { decisions, consequences });
  try {
    await ports.transaction.transact({ decisions, consequences, semanticHash });
    return { activated: true, batchHash: semanticHash };
  } catch (error) {
    return { activated: false, code: "transaction-failure", reasons: [error instanceof Error ? error.message : "semantic governance transaction failed"] };
  }
}

export interface DecisionConvergenceInput<T extends Record<string, unknown>, F> {
  members: readonly string[];
  initialState: T;
  fixedInputs: F;
  maxIterations: number;
}

export interface DecisionConvergencePort<T extends Record<string, unknown>, F> {
  evaluate(input: { previousState: Readonly<T>; fixedInputs: Readonly<F>; iteration: number }): Promise<T>;
}

export type DecisionConvergenceResult<T extends Record<string, unknown>> =
  | { status: "converged"; digest: ContentHash; iterations: number; activatedState: T }
  | { status: "decision-convergence-failure"; digest: ContentHash; iterations: number; activatedState?: undefined };

function normalizeDecisionState<T extends Record<string, unknown>>(members: readonly string[], state: T): T {
  const normalizedMembers = [...new Set(members)].sort(compareStrings);
  if (normalizedMembers.length === 0) throw new Error("decision convergence group cannot be empty");
  const actual = Object.keys(state).sort(compareStrings);
  if (canonicalJson(normalizedMembers) !== canonicalJson(actual)) throw new Error("decision convergence state must contain exactly the SCC members");
  return Object.fromEntries(normalizedMembers.map((member) => [member, structuredClone(state[member])])) as T;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export async function convergeDecisionGroup<T extends Record<string, unknown>, F>(
  input: DecisionConvergenceInput<T, F>,
  port: DecisionConvergencePort<T, F>,
): Promise<DecisionConvergenceResult<T>> {
  if (!Number.isInteger(input.maxIterations) || input.maxIterations < 1) throw new Error("decision convergence maxIterations must be a positive integer");
  let current = normalizeDecisionState(input.members, input.initialState);
  let digest = hashFramedDomain("decision-convergence-state", current);
  const seen = new Set<ContentHash>([digest]);
  const fixedInputs = deepFreeze(structuredClone(input.fixedInputs));
  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    const next = normalizeDecisionState(input.members, await port.evaluate({ previousState: deepFreeze(structuredClone(current)), fixedInputs, iteration }));
    const nextDigest = hashFramedDomain("decision-convergence-state", next);
    if (nextDigest === digest) return { status: "converged", digest: nextDigest, iterations: iteration, activatedState: next };
    if (seen.has(nextDigest)) return { status: "decision-convergence-failure", digest: nextDigest, iterations: iteration, activatedState: undefined };
    seen.add(nextDigest);
    current = next;
    digest = nextDigest;
  }
  return { status: "decision-convergence-failure", digest, iterations: input.maxIterations, activatedState: undefined };
}
