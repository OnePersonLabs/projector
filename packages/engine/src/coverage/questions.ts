import {
  AuthorityRecordSchema,
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type AuthorityRecord,
  type ContentHash,
  type StateBinding,
  type StateBindingValidator,
  type StateDigest,
} from "@projector/core";

import { authorityRecordHashIsValid } from "../architecture/evaluation.js";
import { createStateBinding } from "../state/index.js";

const RANKING_VERSION = "1";
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

export type CompletionQuestionKind = "blocking-architecture" | "identity-fragmentation" | "relevance-fragmentation" | "semantic" | "cleanup" | "cosmetic";

export interface CompletionQuestionCandidate {
  readonly uncertaintyKey: string;
  readonly kind: CompletionQuestionKind;
  readonly displayText: string;
  readonly scopeIds: readonly string[];
  readonly evidenceDependencyIds: readonly string[];
  readonly expectedUncertaintyReduction: number;
  readonly affectedUnitCount: number;
  readonly futureChangeFrequency: number;
  readonly divergenceLeverage: number;
  readonly decisionReuse: number;
  readonly architectureMateriality: number;
  readonly userEffort: number;
  readonly ambiguity: number;
  readonly risk: number;
}

export interface RankedCompletionQuestion extends CompletionQuestionCandidate {
  readonly id: string;
  readonly contentHash: ContentHash;
  readonly rankingVersion: string;
  readonly utility: number;
  readonly scopeIds: string[];
  readonly evidenceDependencyIds: string[];
}

export type CompletionAnswerOutcome = "approve" | "alternative" | "correction" | "exception" | "defer" | "policy";

export interface SettledQuestionAnswer {
  readonly id: string;
  readonly questionId: string;
  readonly questionContentHash: ContentHash;
  readonly boundEvidenceHash: ContentHash;
  readonly outcome: CompletionAnswerOutcome;
  readonly answer: string;
  readonly authorityRecordId: string;
  readonly authoritySemanticHash: ContentHash;
  readonly bindingDependencyDigest: ContentHash;
  readonly revision: number;
  readonly contentHash: ContentHash;
}

function finite(value: number, label: string, allowZero = true): void {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) throw new Error(`${label} ${allowZero ? "must be finite and non-negative" : "cost must be finite and positive"}`);
}

function normalizeCandidate(candidate: CompletionQuestionCandidate): Omit<RankedCompletionQuestion, "id" | "contentHash" | "utility"> {
  if (candidate.uncertaintyKey.trim() === "" || candidate.displayText.trim() === "") throw new Error("completion question uncertainty and display text must be nonblank");
  for (const [label, value] of Object.entries({ expectedUncertaintyReduction: candidate.expectedUncertaintyReduction, affectedUnitCount: candidate.affectedUnitCount, futureChangeFrequency: candidate.futureChangeFrequency, divergenceLeverage: candidate.divergenceLeverage, decisionReuse: candidate.decisionReuse, architectureMateriality: candidate.architectureMateriality })) finite(value, label);
  finite(candidate.userEffort, "user effort", false); finite(candidate.ambiguity, "ambiguity", false); finite(candidate.risk, "risk", false);
  return {
    uncertaintyKey: candidate.uncertaintyKey.trim(), kind: candidate.kind, displayText: candidate.displayText.trim(), scopeIds: unique(candidate.scopeIds), evidenceDependencyIds: unique(candidate.evidenceDependencyIds), rankingVersion: RANKING_VERSION,
    expectedUncertaintyReduction: candidate.expectedUncertaintyReduction, affectedUnitCount: candidate.affectedUnitCount, futureChangeFrequency: candidate.futureChangeFrequency,
    divergenceLeverage: candidate.divergenceLeverage, decisionReuse: candidate.decisionReuse, architectureMateriality: candidate.architectureMateriality,
    userEffort: candidate.userEffort, ambiguity: candidate.ambiguity, risk: candidate.risk,
  };
}

function identitySemantic(question: Pick<RankedCompletionQuestion, "uncertaintyKey" | "kind" | "scopeIds" | "evidenceDependencyIds" | "rankingVersion">): object {
  return { uncertaintyKey: question.uncertaintyKey, kind: question.kind, scopeIds: question.scopeIds, evidenceDependencyIds: question.evidenceDependencyIds, rankingVersion: question.rankingVersion };
}

function materiality(kind: CompletionQuestionKind): number {
  if (kind === "blocking-architecture") return 1_000;
  if (kind === "identity-fragmentation" || kind === "relevance-fragmentation") return 100;
  if (kind === "semantic") return 10;
  if (kind === "cleanup") return 1;
  return 0.01;
}

function rank(candidate: CompletionQuestionCandidate): RankedCompletionQuestion {
  const normalized = normalizeCandidate(candidate);
  const identity = identitySemantic(normalized);
  const idHash = hashFramedDomain("completion-question-identity", identity);
  const numerator = normalized.expectedUncertaintyReduction * Math.max(1, normalized.affectedUnitCount) * Math.max(1, normalized.futureChangeFrequency)
    * Math.max(1, normalized.divergenceLeverage) * Math.max(1, normalized.decisionReuse) * Math.max(1, normalized.architectureMateriality) * materiality(normalized.kind);
  const utility = numerator / (normalized.userEffort * normalized.ambiguity * normalized.risk);
  if (!Number.isFinite(utility)) throw new Error("completion question utility must be finite");
  const semantic = { ...normalized, displayText: undefined, utilityInputs: { expectedUncertaintyReduction: normalized.expectedUncertaintyReduction, affectedUnitCount: normalized.affectedUnitCount, futureChangeFrequency: normalized.futureChangeFrequency, divergenceLeverage: normalized.divergenceLeverage, decisionReuse: normalized.decisionReuse, architectureMateriality: normalized.architectureMateriality, userEffort: normalized.userEffort, ambiguity: normalized.ambiguity, risk: normalized.risk } };
  return { ...normalized, id: `completion_question_${idHash.slice(-32)}`, contentHash: hashFramedDomain("completion-question", semantic), utility };
}

export async function rankCompletionQuestions(
  candidates: readonly CompletionQuestionCandidate[],
  input: { readonly store: SettledAnswerStore; readonly currentBinding: StateBinding; readonly authority: QuestionAuthorityPort },
): Promise<RankedCompletionQuestion[]> {
  const currentBinding = createStateBinding(input.currentBinding);
  if (currentBinding.dependencyDigest !== input.currentBinding.dependencyDigest) throw new Error("completion ranking StateBinding is invalid");
  const questions = new Map<string, RankedCompletionQuestion>();
  for (const candidate of candidates) {
    const question = rank(candidate);
    const existing = questions.get(question.id);
    if (existing !== undefined && existing.contentHash !== question.contentHash) throw new Error(`conflicting completion question identity ${question.id}`);
    questions.set(question.id, existing ?? question);
  }
  const unsettled: RankedCompletionQuestion[] = [];
  for (const question of questions.values()) {
    const answer = await authenticatedStoredAnswer(question, currentBinding, input.store, input.authority);
    if (answer === undefined) unsettled.push(question);
  }
  return unsettled.sort((left, right) => right.utility - left.utility || compare(left.id, right.id));
}

export interface SettledAnswerStore {
  read(questionId: string): Promise<readonly unknown[]>;
  compareAndStore(expectedRevision: number | undefined, answer: Readonly<SettledQuestionAnswer>, validateAtCommit: () => Promise<void>): Promise<{ readonly status: "stored" | "idempotent" | "conflict"; readonly answer?: Readonly<SettledQuestionAnswer> }>;
}

export class InMemorySettledAnswerStore implements SettledAnswerStore {
  private readonly answers = new Map<string, Readonly<SettledQuestionAnswer>>();
  async read(questionId: string): Promise<readonly unknown[]> { const answer = this.answers.get(questionId); return answer === undefined ? [] : [structuredClone(answer)]; }
  async compareAndStore(expectedRevision: number | undefined, answer: Readonly<SettledQuestionAnswer>, validateAtCommit: () => Promise<void>): Promise<{ status: "stored" | "idempotent" | "conflict"; answer?: Readonly<SettledQuestionAnswer> }> {
    await validateAtCommit();
    const current = this.answers.get(answer.questionId);
    if (current !== undefined && canonicalJson(current) === canonicalJson(answer)) return { status: "idempotent", answer: structuredClone(current) };
    if ((current?.revision) !== expectedRevision) return { status: "conflict" };
    this.answers.set(answer.questionId, structuredClone(answer));
    return { status: "stored", answer: structuredClone(answer) };
  }
}

export interface QuestionAuthorityPort { read(id: string): Promise<AuthorityRecord | undefined> }
export interface QuestionExceptionalOutcomePort {
  authenticate(input: { readonly outcome: "exception" | "defer"; readonly question: RankedCompletionQuestion; readonly authority: AuthorityRecord; readonly boundState: StateBinding; readonly answer: string }): Promise<boolean>;
}

function boundEvidence(question: RankedCompletionQuestion, binding: StateBinding): { hash: ContentHash; dependencies: unknown[] } {
  const dependencies: unknown[] = [];
  for (const id of question.evidenceDependencyIds) {
    const value = binding.valueDependencies.find((item) => item.id === id);
    const query = binding.queryDependencies.find((item) => item.query.id === id || item.priorResult.dependencyKeys.includes(id));
    if (value === undefined && query === undefined) throw new Error(`settled answer evidence dependency ${id} is absent from the authenticated StateBinding`);
    dependencies.push(value ?? query);
  }
  return { hash: hashFramedDomain("completion-question-bound-evidence", { evidenceDependencyIds: question.evidenceDependencyIds, questionContentHash: question.contentHash, bindingDependencyDigest: binding.dependencyDigest, dependencies }), dependencies };
}

const answerKeys = ["answer", "authorityRecordId", "authoritySemanticHash", "bindingDependencyDigest", "boundEvidenceHash", "contentHash", "id", "outcome", "questionContentHash", "questionId", "revision"];
function parseStoredAnswer(raw: unknown): SettledQuestionAnswer {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw) || canonicalJson(Object.keys(raw).sort(compare)) !== canonicalJson(answerKeys)) throw new Error("stored settled answer is malformed");
  const item = raw as Record<string, unknown>;
  const strings = ["id", "questionId", "questionContentHash", "boundEvidenceHash", "outcome", "answer", "authorityRecordId", "authoritySemanticHash", "bindingDependencyDigest", "contentHash"];
  if (strings.some((key) => typeof item[key] !== "string" || (item[key] as string).trim() === "") || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1
    || !["approve", "alternative", "correction", "exception", "defer", "policy"].includes(item.outcome as string)) throw new Error("stored settled answer is malformed");
  const semantic = { questionId: item.questionId, questionContentHash: item.questionContentHash, boundEvidenceHash: item.boundEvidenceHash, outcome: item.outcome, answer: item.answer, authorityRecordId: item.authorityRecordId, authoritySemanticHash: item.authoritySemanticHash, bindingDependencyDigest: item.bindingDependencyDigest, revision: item.revision };
  const contentHash = hashFramedDomain("settled-completion-answer", semantic);
  if (item.contentHash !== contentHash || item.id !== `settled_answer_${contentHash.slice(-32)}`) throw new Error("stored settled answer semantic hash is invalid");
  return raw as SettledQuestionAnswer;
}

function oneStoredAnswer(rows: readonly unknown[]): SettledQuestionAnswer | undefined {
  if (rows.length === 0) return undefined;
  const parsed = rows.map(parseStoredAnswer);
  if (parsed.some((item) => canonicalJson(item) !== canonicalJson(parsed[0]))) throw new Error("conflicting stored settled answers");
  return parsed[0];
}

async function authenticatedStoredAnswer(question: RankedCompletionQuestion, binding: StateBinding, store: SettledAnswerStore, authorityPort: QuestionAuthorityPort): Promise<SettledQuestionAnswer | undefined> {
  const answer = oneStoredAnswer(await store.read(question.id));
  if (answer === undefined || answer.questionContentHash !== question.contentHash || answer.bindingDependencyDigest !== binding.dependencyDigest) return undefined;
  if (answer.boundEvidenceHash !== boundEvidence(question, binding).hash) throw new Error("stored settled answer evidence authentication failed");
  const parsed = AuthorityRecordSchema.safeParse(await authorityPort.read(answer.authorityRecordId));
  if (!parsed.success) throw new Error("stored settled answer authority authentication failed");
  const authority = parsed.data as AuthorityRecord;
  if (!authorityRecordHashIsValid(authority) || authority.semanticHash !== answer.authoritySemanticHash || authority.subjectId !== question.id || !["approved", "auto-approved"].includes(authority.status)) throw new Error("stored settled answer authority authentication failed");
  return answer;
}

export async function settleCompletionQuestion(
  input: { readonly question: RankedCompletionQuestion; readonly outcome: CompletionAnswerOutcome; readonly answer: string; readonly authorityRecordId: string; readonly boundState: StateBinding; readonly currentState: StateDigest; readonly context: AdapterContext },
  ports: { readonly authority: QuestionAuthorityPort; readonly bindingValidator: StateBindingValidator; readonly store: SettledAnswerStore; readonly exceptional?: QuestionExceptionalOutcomePort },
): Promise<SettledQuestionAnswer> {
  if (input.answer.trim() === "") throw new Error("settled answer must not be blank");
  const reranked = rank(input.question);
  if (reranked.id !== input.question.id || reranked.contentHash !== input.question.contentHash) throw new Error("question contract or semantic hash is invalid");
  const normalizedBinding = createStateBinding(input.boundState);
  if (normalizedBinding.dependencyDigest !== input.boundState.dependencyDigest) throw new Error("settled answer StateBinding is invalid");
  const validation = await ports.bindingValidator.validate(normalizedBinding, input.currentState, input.context);
  if (validation.status !== "current" && validation.status !== "rebound") throw new Error(`settled answer binding is ${validation.status}`);
  const effectiveBinding = createStateBinding(validation.status === "rebound" ? validation.rebound! : normalizedBinding);
  if (canonicalJson(effectiveBinding.compiledAgainst) !== canonicalJson(input.currentState)) throw new Error("settled answer rebound binding is not compiled against current state");
  const current = oneStoredAnswer(await ports.store.read(input.question.id));
  const boundEvidenceHash = boundEvidence(input.question, effectiveBinding).hash;
  const revision = current === undefined ? 1 : current.revision + 1;
  const authorityRaw = await ports.authority.read(input.authorityRecordId);
  const parsed = AuthorityRecordSchema.safeParse(authorityRaw);
  if (!parsed.success) throw new Error("settled answer authority record is unavailable or invalid");
  const authority = parsed.data as AuthorityRecord;
  if (!authorityRecordHashIsValid(authority) || authority.subjectId !== input.question.id || !["approved", "auto-approved"].includes(authority.status)) throw new Error("settled answer authority proof is not approved for this question");
  if ((input.outcome === "exception" || input.outcome === "defer") && (ports.exceptional === undefined || !(await ports.exceptional.authenticate({ outcome: input.outcome, question: input.question, authority, boundState: effectiveBinding, answer: input.answer.trim() })))) throw new Error(`${input.outcome} requires an authenticated exceptional-outcome contract`);
  const semantic = { questionId: input.question.id, questionContentHash: input.question.contentHash, boundEvidenceHash, outcome: input.outcome, answer: input.answer.trim(), authorityRecordId: authority.id, authoritySemanticHash: authority.semanticHash, bindingDependencyDigest: effectiveBinding.dependencyDigest, revision };
  const contentHash = hashFramedDomain("settled-completion-answer", semantic);
  const answer: SettledQuestionAnswer = { id: `settled_answer_${contentHash.slice(-32)}`, ...semantic, contentHash };
  if (current !== undefined && current.questionContentHash === answer.questionContentHash && current.boundEvidenceHash === answer.boundEvidenceHash && current.outcome === answer.outcome && current.answer === answer.answer && current.authoritySemanticHash === answer.authoritySemanticHash) return current as SettledQuestionAnswer;
  if (current !== undefined && input.outcome !== "correction") throw new Error("conflicting settled answer requires an explicit correction revision");
  const stored = await ports.store.compareAndStore(current?.revision, answer, async () => {
    const commitValidation = await ports.bindingValidator.validate(effectiveBinding, input.currentState, input.context);
    if (commitValidation.status !== "current") throw new Error(`settled answer binding changed before atomic commit: ${commitValidation.status}`);
    boundEvidence(input.question, effectiveBinding);
  });
  if (stored.status === "conflict") throw new Error("settled answer compare-and-store race conflict");
  return (stored.answer ?? answer) as SettledQuestionAnswer;
}
