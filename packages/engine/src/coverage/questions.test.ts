import { hashSemantic, hashFramedDomain, type AuthorityRecord, type ContentHash, type StateDigest } from "@projector/core";
import { describe, expect, it, vi } from "vitest";

import { InMemorySettledAnswerStore, rankCompletionQuestions, settleCompletionQuestion } from "./questions.js";
import { createStateBinding } from "../state/index.js";

const hash = (value: string): ContentHash => hashFramedDomain("question-test", value);
const state: StateDigest = { gitBase: "base", worktreeDigest: hash("w"), canonicalProjectorDigest: hash("c"), toolchainDigest: hash("t") };
const binding = createStateBinding({ compiledAgainst: state, valueDependencies: [{ kind: "canonical-entity", id: "evidence:a", versionHash: hash("evidence-a"), role: "completion evidence" }], queryDependencies: [] });
const candidate = (patch: Record<string, unknown> = {}) => ({ uncertaintyKey: "identity:checkout", kind: "identity-fragmentation" as const, displayText: "Which Checkout is canonical?", scopeIds: ["pkg:b", "pkg:a"], evidenceDependencyIds: ["evidence:a"], expectedUncertaintyReduction: 0.9, affectedUnitCount: 8, futureChangeFrequency: 3, divergenceLeverage: 2, decisionReuse: 2, architectureMateriality: 1, userEffort: 1, ambiguity: 0.2, risk: 1, ...patch });

function authority(questionId: string): AuthorityRecord {
  const base: Omit<AuthorityRecord, "semanticHash"> = { id: "authority:answer", key: "answer", subjectId: questionId, status: "approved", conclusion: "preserve", rationale: "user answer", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 1, ecosystemHealth: 1, securitySupport: 1, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-08-08" };
  return { ...base, semanticHash: hashSemantic("authority-record", base) };
}

describe("completion questions and settled answers", () => {
  it("uses stable semantic identities, collapses display/order duplicates, rejects conflicts, and prioritizes material questions", async () => {
    const store = new InMemorySettledAnswerStore();
    const ranked = await rankCompletionQuestions([candidate(), candidate({ displayText: "Different wording", scopeIds: ["pkg:a", "pkg:b"] }), candidate({ uncertaintyKey: "architecture:block", kind: "blocking-architecture", displayText: "Choose platform", affectedUnitCount: 1 })], { store, currentBindingDependencyDigest: binding.dependencyDigest });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.kind).toBe("blocking-architecture");
    await expect(rankCompletionQuestions([candidate(), candidate({ affectedUnitCount: 9 })], { store, currentBindingDependencyDigest: binding.dependencyDigest })).rejects.toThrow(/conflicting.*question/iu);
    await expect(rankCompletionQuestions([candidate({ userEffort: 0 })], { store, currentBindingDependencyDigest: binding.dependencyDigest })).rejects.toThrow(/cost|effort/iu);
  });

  it("atomically authenticates answers, is idempotent, rejects races, and reopens only changed evidence", async () => {
    const store = new InMemorySettledAnswerStore();
    const [question] = await rankCompletionQuestions([candidate()], { store, currentBindingDependencyDigest: binding.dependencyDigest });
    const record = authority(question!.id);
    const ports = { authority: { read: async () => record }, bindingValidator: { validate: async () => ({ status: "current" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] }) }, store };
    const first = await settleCompletionQuestion({ question: question!, outcome: "approve", answer: "canonical checkout", authorityRecordId: record.id, boundState: binding, currentState: state, context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } }, ports);
    const replay = await settleCompletionQuestion({ question: question!, outcome: "approve", answer: "canonical checkout", authorityRecordId: record.id, boundState: binding, currentState: state, context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } }, ports);
    expect(replay).toEqual(first);
    expect(await rankCompletionQuestions([candidate()], { store, currentBindingDependencyDigest: binding.dependencyDigest })).toHaveLength(0);
    expect(await rankCompletionQuestions([candidate()], { store, currentBindingDependencyDigest: hash("new-binding") })).toHaveLength(1);
    expect(await rankCompletionQuestions([candidate({ evidenceDependencyIds: ["evidence:changed"] })], { store, currentBindingDependencyDigest: binding.dependencyDigest })).toHaveLength(1);
    const racing = vi.spyOn(store, "compareAndStore").mockResolvedValueOnce({ status: "conflict" });
    await expect(settleCompletionQuestion({ question: question!, outcome: "correction", answer: "new", authorityRecordId: record.id, boundState: binding, currentState: state, context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } }, ports)).rejects.toThrow(/race|conflict/iu);
    racing.mockRestore();
  });

  it("ignores forged answer DTOs and binds rebound/evidence/exception proof at CAS", async () => {
    const store = new InMemorySettledAnswerStore();
    const [question] = await rankCompletionQuestions([candidate({ kind: "blocking-architecture" })], { store, currentBindingDependencyDigest: binding.dependencyDigest });
    const forgedInput = { store, currentBindingDependencyDigest: binding.dependencyDigest, settled: [{ questionId: question!.id, questionContentHash: question!.contentHash }] } as unknown as { store: InMemorySettledAnswerStore; currentBindingDependencyDigest: ContentHash };
    expect(await rankCompletionQuestions([candidate({ kind: "blocking-architecture" })], forgedInput)).toHaveLength(1);
    const rebound = createStateBinding({ ...binding, compiledAgainst: state, valueDependencies: [{ ...binding.valueDependencies[0]!, versionHash: hash("rebound-evidence") }] });
    const reboundValidation = { status: "rebound" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [], rebound };
    const validate = vi.fn().mockResolvedValueOnce(reboundValidation).mockResolvedValueOnce(reboundValidation).mockResolvedValue({ status: "current" as const, currentState: state, changedValueDependencyIds: [], changedQueryDependencyIds: [], reasons: [] });
    const exceptional = { authenticate: vi.fn().mockResolvedValue(false) };
    await expect(settleCompletionQuestion({ question: question!, outcome: "exception", answer: "temporary", authorityRecordId: authority(question!.id).id, boundState: binding, currentState: state, context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } }, { authority: { read: async () => authority(question!.id) }, bindingValidator: { validate }, store, exceptional })).rejects.toThrow(/exception|defer|contract/iu);
    exceptional.authenticate.mockResolvedValue(true);
    const settled = await settleCompletionQuestion({ question: question!, outcome: "exception", answer: "temporary", authorityRecordId: authority(question!.id).id, boundState: binding, currentState: state, context: { repositoryRoot: "/repo", stateDigest: state, config: {}, signal: new AbortController().signal } }, { authority: { read: async () => authority(question!.id) }, bindingValidator: { validate }, store, exceptional });
    expect(settled.bindingDependencyDigest).toBe(rebound.dependencyDigest);
    expect(validate).toHaveBeenCalledTimes(3);
  });
});
