import { expect, test } from "vitest";
import { hashFramedDomain, type ArchitectureDecision, type AuthorityRecord } from "@projector/core";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";
import { captureDecisionTriggerObservations } from "./decision-baselines.js";
import { KnowledgeDecisionRun } from "./governance.js";

const hash = hashFramedDomain("decision-test", "a");
const changed = hashFramedDomain("decision-test", "b");
const decision = { id: "decision:test", authorityRecordId: "authority:test", semanticHash: hash, scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" } } as ArchitectureDecision;
const authority = { id: "authority:test", semanticHash: hash, evidence: [{ evidenceId: "requirement:evidence", stance: "supports" }], assumptions: ["Storage remains supported"], reconsiderWhen: [{ type: "assumption-falsified", assumptionKey: "support" }] } as AuthorityRecord;
function document(id: string, kind: string, semanticHash: string, payload: unknown = {}) { return { id, kind, semanticHash, payload }; }
function fixture(currentHash: string) {
  const before = [document("requirement:evidence", "requirement", hash)] as unknown as ChangeRepositoryObservation["canonical"]["documents"];
  const observation = { canonical: { documents: [document(authority.id, "authority-record", hash, authority), document("requirement:evidence", "requirement", currentHash)] }, analysis: { files: [], surface: { kind: "repository" } } } as unknown as ChangeRepositoryObservation;
  return new KnowledgeDecisionRun(observation, { readDecisionBaseline: async () => ({ kind: "authenticated-transaction", baseline: { decisionId: decision.id, authorityId: authority.id, decisionSemanticHash: hash, authoritySemanticHash: hash, observations: captureDecisionTriggerObservations(decision, authority, before, [], "repository") } }) });
}
test("changed linked evidence loses proof without falsifying an assumption", async () => {
  const result = await fixture(changed).observe(decision, "inspect");
  expect(result.staleEvidenceIds).toEqual(["requirement:evidence"]);
  expect(result.checks.find(({ trigger }) => trigger.type === "assumption-falsified")?.status).toBe("unobserved");
});
test("matching relevant evidence stays current", async () => {
  expect((await fixture(hash).observe(decision, "inspect")).staleEvidenceIds).toEqual([]);
});
