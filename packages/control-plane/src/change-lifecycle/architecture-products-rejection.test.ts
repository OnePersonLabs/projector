import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";
import { RepositoryChangeLifecycleService } from "./service.js";

const scope = { op: "atom", field: "path", matcher: "glob", value: "src/**" } as const;
const decision = (key: string, consequences: object[] = [], governanceBasis: object[] = []) => ({ id: `decision:${key}`, key: `decision-${key}`, concernId: `concern:${key}`, title: key, decision: "Use the accepted option.", selectedOptionKey: "simple", scope, lifecycle: "active", authorityRecordId: `authority:${key}`, governanceBasis, consequences, appliedPreferences: [], supersedesDecisionIds: [] });
const concern = (key: string) => ({ id: `concern:${key}`, key: `concern-${key}`, title: key, question: "Which option?", scope, sourceClass: "authored", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [`decision:${key}`], evidence: [] });
const authority = (key: string) => ({ id: `authority:${key}`, key: `authority-${key}`, subjectId: `concern:${key}`, status: "approved", conclusion: "preserve", rationale: "Accepted choice.", alternatives: [], assumptions: [], reconsiderWhen: [], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z" });
const proposal = (mutations: object[]) => ({ apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"], canonicalMutations: mutations });
const addition = (kind: string, payload: object) => ({ kind, payload, operation: "add", expectedAbsent: true, rationale: "Accept these exact canonical records." });
async function repository() {
  const root = await mkdtemp(join(tmpdir(), "projector-architecture-rejection-"));
  await mkdir(join(root, "src")); await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
  return root;
}
async function applyModel(service: RepositoryChangeLifecycleService, mutations: object[]) {
  const accepted = await service.capture({ request: "Accept coherent architecture ownership", proposal: proposal(mutations) });
  const approved = await service.approve(accepted.capture.semanticChangeId, accepted.capture.planHash);
  expect((await service.apply(approved.id)).outcome).toBe("success");
}
async function revision(root: string, kind: "architecture-concern" | "architecture-decision" | "authority-record", id: string, fields: object) {
  const before = (await new CanonicalFileRepository(root).read(kind, id))!;
  const { semanticHash: _semantic, discoveryHash: _discovery, ...payload } = before.payload;
  return { kind, operation: "revise", expectedSemanticHash: before.semanticHash, expectedDocumentHash: before.canonicalDocumentHash, payload: { ...payload, ...fields }, rationale: "Revise the affected canonical architecture coherently." };
}

describe("public architecture product proof", () => {
  it("revalidates concern indexes, retirement and old ownership when a decision changes", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      await expect(service.capture({ request: "Add an unindexed decision", proposal: proposal([
        addition("architecture-concern", { ...concern("a"), decisionIds: [] }), addition("architecture-decision", decision("a")), addition("authority-record", authority("a")),
      ]) })).rejects.toThrow(/must index active decision decision:a/);
      await applyModel(service, [addition("architecture-concern", concern("a")), addition("architecture-concern", { ...concern("b"), status: "active", decisionIds: [] }), addition("architecture-decision", decision("a")), addition("authority-record", authority("a"))]);
      const retire = await revision(root, "architecture-decision", "decision:a", { lifecycle: "retired" });
      await expect(service.capture({ request: "Retire the only decision without updating its concern", proposal: proposal([retire]) })).rejects.toThrow(/resolved concern concern:a has no active decision/);
      const replace = await revision(root, "architecture-decision", "decision:a", { lifecycle: "superseded" });
      await expect(service.capture({ request: "Supersede without updating the owning index", proposal: proposal([
        replace, addition("architecture-decision", { ...decision("replacement"), concernId: "concern:a", supersedesDecisionIds: ["decision:a"] }), addition("authority-record", { ...authority("replacement"), subjectId: "concern:a" }),
      ]) })).rejects.toThrow(/must index active decision decision:replacement/);
      await expect(service.capture({ request: "Reparent a decision without repairing its former concern", proposal: proposal([
        await revision(root, "architecture-decision", "decision:a", { concernId: "concern:b" }),
        await revision(root, "authority-record", "authority:a", { subjectId: "concern:b" }),
        await revision(root, "architecture-concern", "concern:b", { status: "resolved", decisionIds: ["decision:a"] }),
      ]) })).rejects.toThrow(/concern concern:a lists decision decision:a owned by another concern/);
      expect((await new CanonicalFileRepository(root).read("architecture-decision", "decision:a"))?.payload.lifecycle).toBe("active");
      await applyModel(service, [retire, await revision(root, "architecture-concern", "concern:a", { status: "dismissed" })]);
      expect((await new CanonicalFileRepository(root).read("architecture-concern", "concern:a"))?.payload.status).toBe("dismissed");
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("requires normalized owning concern scope even when both observed populations are empty", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      await expect(service.capture({ request: "Accept a decision under a different future boundary", proposal: proposal([
        addition("architecture-concern", { ...concern("a"), scope: { ...scope, value: "future-a/**" } }), addition("architecture-decision", { ...decision("a"), scope: { ...scope, value: "future-b/**" } }), addition("authority-record", authority("a")),
      ]) })).rejects.toThrow(/scope must match the normalized scope.*explicitly scoped concern/);
      const parts = [scope, { ...scope, value: "future/**" }];
      const accepted = await service.capture({ request: "Accept equal normalized scope", proposal: proposal([
        addition("architecture-concern", { ...concern("a"), scope: { op: "any", items: parts } }), addition("architecture-decision", { ...decision("a"), scope: { op: "any", items: [...parts].reverse() } }), addition("authority-record", authority("a")),
      ]) });
      const approved = await service.approve(accepted.capture.semanticChangeId, accepted.capture.planHash);
      expect((await service.apply(approved.id)).outcome).toBe("success");
      await expect(service.capture({ request: "Change only the owning concern boundary", proposal: proposal([
        await revision(root, "architecture-concern", "concern:a", { scope: { ...scope, value: "future/**" } }),
      ]) })).rejects.toThrow(/scope must match the normalized scope/);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("refuses unauthenticated user and organization preferences and unsupported technology products", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const hash = hashFramedDomain("architecture-test", "untrusted-preference");
      for (const preferenceScope of ["user", "organization"] as const) await expect(service.capture({ request: "Claim a preference without its provider", proposal: proposal([
        addition("architecture-concern", concern("a")), addition("architecture-decision", { ...decision("a"), appliedPreferences: [{ key: "simple", scope: preferenceScope, semanticHash: hash, influence: "Prefer this option." }] }), addition("authority-record", authority("a")),
      ]) })).rejects.toThrow(new RegExp(`cannot claim ${preferenceScope} preference.*explicitly adopt`));
      const concept = { id: "concept:placeholder", key: "placeholder", kind: "capability", name: "Unrelated capability", aliases: [], statement: "An ordinary capability is not a typed technology product.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] };
      for (const kind of ["select-technology", "deprecate-technology"]) await expect(service.capture({ request: "Claim a technology product from an arbitrary concept", proposal: proposal([
        addition("architecture-concern", concern("a")), addition("concept", concept), addition("architecture-decision", decision("a", [{ kind, targetId: concept.id, explanation: "Treat the concept as a technology choice." }])), addition("authority-record", authority("a")),
      ]) })).rejects.toThrow(new RegExp(`${kind} is unsupported.*explicit constraint concept`));
      expect((await new CanonicalFileRepository(root).snapshot()).documents).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("rejects a changed active decision without its concern before canonical mutation", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      await expect(service.capture({ request: "Accept the storage choice", proposal: proposal([addition("architecture-decision", decision("a")), addition("authority-record", authority("a"))]) })).rejects.toThrow(/requires a real architecture-concern concern:a/);
      expect((await new CanonicalFileRepository(root).snapshot()).documents).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("verifies material consequence scope and payload against the actual canonical product", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const target = { ...concern("target"), status: "active", decisionIds: [] };
      const capture = (consequence: object, product: object = target) => service.capture({ request: "Activate the exact concern product", proposal: proposal([
        addition("architecture-concern", concern("a")), addition("architecture-concern", product),
        addition("architecture-decision", decision("a", [{ kind: "activate-concern", targetId: target.id, explanation: "Activate the target question.", ...consequence }])), addition("authority-record", authority("a")),
      ]) });
      await expect(capture({ scope }, { ...target, scope: { ...scope, value: "other/**" } })).rejects.toThrow(/declared scope does not match/);
      await expect(capture({ payload: { question: "A different question" } })).rejects.toThrow(/payload field question does not match/);
      await expect(capture({ payload: { unsupported: true } })).rejects.toThrow(/payload field unsupported is unsupported/);
      const noScopeConcept = { id: "concept:constraint", key: "constraint", kind: "constraint", name: "Boundary", aliases: [], statement: "Preserve the boundary.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] };
      await expect(service.capture({ request: "Declare an unsupported scoped concept consequence", proposal: proposal([
        addition("architecture-concern", concern("a")), addition("concept", noScopeConcept), addition("authority-record", authority("a")),
        addition("architecture-decision", decision("a", [{ kind: "introduce-constraint", targetId: noScopeConcept.id, scope, explanation: "Introduce the scoped constraint." }])),
      ]) })).rejects.toThrow(/no supported target scope or selector/);
      expect((await new CanonicalFileRepository(root).snapshot()).documents).toHaveLength(0);
      const accepted = await capture({ scope, payload: { question: target.question, status: "active" } });
      const approved = await service.approve(accepted.capture.semanticChangeId, accepted.capture.planHash);
      expect((await service.apply(approved.id)).outcome).toBe("success");
      expect((await new CanonicalFileRepository(root).read("architecture-concern", target.id))?.payload.question).toBe(target.question);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("rejects touched constrain-decision cycles while unrelated legacy cycles and missing concerns remain usable", async () => {
    const root = await repository();
    const a = decision("a", [{ kind: "constrain-decision", targetId: "decision:b", explanation: "A constrains B." }], [{ kind: "architecture-decision", decisionId: "decision:b" }]);
    const b = decision("b", [{ kind: "constrain-decision", targetId: "decision:a", explanation: "B constrains A." }], [{ kind: "architecture-decision", decisionId: "decision:a" }]);
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      await expect(service.capture({ request: "Accept a mutually constraining decision cycle", proposal: proposal([
        addition("architecture-concern", concern("a")), addition("architecture-concern", concern("b")), addition("architecture-decision", a), addition("architecture-decision", b), addition("authority-record", authority("a")), addition("authority-record", authority("b")),
      ]) })).rejects.toThrow(/constraint cycle.*lacks a supported convergence proof/);
      const files = new CanonicalFileRepository(root); const hash = hashFramedDomain("architecture-test", "legacy");
      const note = { id: "concept:note", key: "note", kind: "capability", name: "Independent meaning", aliases: [], statement: "Retain independent behavior.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], semanticHash: hash, discoveryHash: hash };
      // Seed historical records deliberately outside this authoring path. New unrelated
      // work must not silently rewrite or require repair of these old decisions.
      for (const [kind, payload] of [["architecture-decision", { ...a, appliedPreferences: [{ key: "historical-user-preference", scope: "user", semanticHash: hash, influence: "Historical influence retained without reauthoring." }], scope: { ...scope, value: "legacy/**" } }], ["architecture-decision", { ...b, scope: { ...scope, value: "legacy/**" } }], ["authority-record", authority("a")], ["authority-record", authority("b")], ["concept", note]] as const) {
        await files.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: kind as CanonicalDocumentEnvelope["kind"], id: payload.id, key: payload.key, lifecycle: "status" in payload ? payload.status : payload.lifecycle, payload: { ...payload, semanticHash: hash } }));
      }
      const before = (await files.read("concept", note.id))!;
      const { semanticHash: _semantic, discoveryHash: _discovery, ...notePayload } = note;
      const unrelated = await service.capture({ request: "Clarify independent meaning", proposal: proposal([{ kind: "concept", operation: "revise", expectedSemanticHash: before.semanticHash, expectedDocumentHash: before.canonicalDocumentHash, payload: { ...notePayload, statement: "Retain and clarify independent behavior." }, rationale: "This meaning does not depend on the legacy decision cycle." }]) });
      const approved = await service.approve(unrelated.capture.semanticChangeId, unrelated.capture.planHash);
      expect((await service.apply(approved.id)).outcome).toBe("success");
      expect((await files.read("architecture-decision", a.id))?.payload.consequences).toEqual(a.consequences);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });
});
