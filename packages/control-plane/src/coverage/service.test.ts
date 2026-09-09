import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, withCanonicalHashes, type AuthorityRecord, type CanonicalDocumentEnvelope, type ProjectionLens } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { deriveCompletionQuestions } from "./issues.js";
import { inspectRepositoryCoverage } from "./service.js";

const hash = hashFramedDomain("coverage-test", "fixture");
const scope = { op: "atom", field: "path", matcher: "glob", value: "src/**" } as const;
async function canonical(root: string, kind: CanonicalDocumentEnvelope["kind"], payload: Record<string, unknown>) {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id: String(payload.id), key: String(payload.key), lifecycle: String(payload.status ?? payload.lifecycle), payload: { ...payload, semanticHash: hash, ...(["requirement", "behavioral-scenario"].includes(kind) ? { discoveryHash: hash } : {}) } }));
}
function authority(): AuthorityRecord {
  return { id: "authority:boundary", key: "boundary", subjectId: "lens:boundary", status: "approved", conclusion: "preserve", rationale: "Accepted boundary.", alternatives: [], assumptions: [], reconsiderWhen: [], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hash };
}

describe("observed progressive coverage", () => {
  it("keeps future behavior ahead of mapping noise and exposes every remaining question through bounded pages", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-completion-pages-"));
    try {
      for (let index = 0; index < 21; index += 1) { await mkdir(join(root, `group-${index}`)); await writeFile(join(root, `group-${index}/value.mjs`), "export const value = 1;\n"); }
      await canonical(root, "behavioral-scenario", { id: "scenario:future", key: "future", title: "Future behavior", aliases: [], status: "active", sourceClass: "authored", scope: { ...scope, value: "future/**" }, steps: [{ role: "trigger", statement: "The user requests future behavior." }, { role: "expected-outcome", statement: "The accepted behavior becomes available." }], evidence: [] });
      const pages = [];
      let questionOffset: number | null = 0;
      do {
        const result = await inspectRepositoryCoverage(root, { scope: ".", questionOffset }, "complete");
        pages.push(result); questionOffset = result.completion.questionPage.nextOffset;
      } while (questionOffset !== null);
      expect(pages[0]!.completion.questions[0]?.ownerIds).toEqual(["scenario:future"]);
      expect(pages.map(({ completion }) => completion.questions.length)).toEqual([10, 10, 2]);
      expect(new Set(pages.flatMap(({ completion }) => completion.questions.map(({ id }) => id))).size).toBe(22);
      expect(new Set(pages.map(({ bindingIdentity }) => bindingIdentity)).size).toBe(1);
      const tooSmall = await inspectRepositoryCoverage(root, { scope: ".", budgetTokens: 1 }, "complete");
      expect(tooSmall).toMatchObject({ budgetExhausted: true, completion: { questions: [], questionPage: { nextOffset: 0 } } });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps a standalone future scenario visible until it gains observed members without claiming conformance", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-coverage-future-scenario-"));
    try {
      await mkdir(join(root, "src")); await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
      const scenario = { id: "scenario:future-export", key: "future-export", title: "Future export preserves provenance", aliases: [], status: "active", sourceClass: "authored", scope: { ...scope, value: "future/**" }, steps: [{ role: "trigger", statement: "The user exports a record." }, { role: "expected-outcome", statement: "The export preserves original provenance." }], evidence: [] };
      await canonical(root, "behavioral-scenario", scenario);
      await canonical(root, "behavioral-scenario", { ...scenario, id: "scenario:rejected", key: "rejected-export", status: "rejected" });
      const first = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
      const questions = first.completion.questions.filter(({ kind }) => kind === "unrealized-scenario");
      expect(questions).toHaveLength(1);
      expect(questions[0]).toMatchObject({ ownerIds: [scenario.id], blocking: false, affectedCount: 0, subjectCount: 1, resolution: { context: { entities: [scenario.id] } } });
      expect(questions[0]!.reasons.join(" ")).toContain("Membership alone does not prove these outcomes");
      await writeFile(join(root, "unrelated.txt"), "unrelated change");
      expect((await inspectRepositoryCoverage(root, { scope: "." }, "complete")).completion.questions.find(({ id }) => id === questions[0]!.id)).toEqual(questions[0]);
      await canonical(root, "behavioral-scenario", { ...scenario, scope });
      const realizedMembership = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
      expect(realizedMembership.completion.questions.some(({ kind }) => kind === "unrealized-scenario")).toBe(false);
      expect(realizedMembership.proofStatement).toBe("not-established");
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });
  it("groups executable violations by governing rule and binds changed members without claiming mapping satisfaction", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-coverage-rules-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/a.mjs"), "import '@forbidden/pkg';\n");
      await writeFile(join(root, "src/b.mjs"), "import '@forbidden/pkg';\n");
      const basis = [{ kind: "hard-constraint" as const, conceptId: "concept:boundary" }];
      const base = createRepositoryScriptLens({ id: "lens:boundary", status: "active", authorityRecordId: authority().id, selector: scope, governanceBasis: basis });
      const rule = { id: "rule:boundary", key: "boundary", version: "1", effect: "validate" as const, authorityClass: "active-lens" as const, governanceBasis: basis, selector: scope,
        predicates: [{ kind: "dependency-forbidden" as const, from: scope, to: { op: "atom" as const, field: "package" as const, matcher: "equals" as const, value: "@forbidden/pkg" } }], rationale: "Preserve boundary.", evidence: [], conflictPolicy: "error" as const, validatorIds: ["projector.builtin.static-dependency-boundary@1"], transformIds: [], semanticHash: hash };
      const lens: ProjectionLens = { ...base, rules: [rule], validators: [{ id: "projector.builtin.static-dependency-boundary", version: "1", provider: "deterministic-governance", input: { ruleIds: [rule.id] }, required: true }], expectedProjections: base.expectedProjections.map((item) => ({ ...item, expectation: { kind: "predicate-constrained", predicateIds: [rule.id], validatorIds: ["projector.builtin.static-dependency-boundary@1"] } })) };
      await canonical(root, "authority-record", { ...authority() }); await canonical(root, "projection-lens", { ...lens });
      const first = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
      const question = first.completion.questions.find(({ kind }) => kind === "governance")!;
      expect(question).toMatchObject({ blocking: true, affectedCount: 2, ownerIds: ["authority:boundary", "lens:boundary", "rule:boundary"] });
      expect(first.lanes.find(({ key }) => key === "rule-enforceability")).toMatchObject({ numerator: 2, denominator: 2 });
      expect(first.lanes.find(({ key }) => key === "validation-evidence")).toMatchObject({ numerator: 0, denominator: 2 });
      expect(first.lanes.find(({ key }) => key === "concept-mapping")).toMatchObject({ numerator: 0, denominator: 2 });
      await writeFile(join(root, "unrelated.txt"), "unrelated");
      expect((await inspectRepositoryCoverage(root, { scope: "." }, "complete")).completion.questions.find(({ id }) => id === question.id)).toEqual(question);
      await writeFile(join(root, "src/c.mjs"), "import '@forbidden/pkg';\n");
      const expanded = (await inspectRepositoryCoverage(root, { scope: "." }, "complete")).completion.questions.find(({ id }) => id === question.id)!;
      expect(expanded.affectedCount).toBe(3); expect(expanded.evidenceHash).not.toBe(question.evidenceHash);
      await canonical(root, "authority-record", { ...authority(), status: "rejected" });
      const untrusted = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
      expect(untrusted.lanes.find(({ key }) => key === "authority")).toMatchObject({ numerator: 0, denominator: 1 });
      expect(untrusted.lanes.find(({ key }) => key === "rule-enforceability")?.observability).toBe("unavailable");
      expect(untrusted.completion.questions[0]?.reasons.join(" ")).toContain("non-active status rejected");
      await canonical(root, "authority-record", { ...authority() });
      const secondRule = { ...rule, id: "rule:other", key: "other", predicates: [{ ...rule.predicates[0]!, to: { ...rule.predicates[0]!.to, value: "@other/pkg" } }] };
      const secondLens: ProjectionLens = { ...lens, id: "lens:other", key: "other", contributions: lens.contributions.filter((kind) => kind !== "projection-owner"), authorityRecordId: "authority:other", rules: [secondRule], validators: lens.validators.map((validator) => ({ ...validator, input: { ruleIds: [secondRule.id] } })), expectedProjections: lens.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained", predicateIds: [secondRule.id], validatorIds: ["projector.builtin.static-dependency-boundary@1"] } })) };
      await canonical(root, "authority-record", { ...authority(), id: "authority:other", key: "authority:other", subjectId: secondLens.id });
      await canonical(root, "projection-lens", { ...secondLens });
      const multiple = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
      expect(multiple.lanes.find(({ key }) => key === "rule-enforceability"), JSON.stringify(multiple.completion.questions)).toMatchObject({ numerator: 6, denominator: 6 });
      expect(multiple.lanes.find(({ key }) => key === "validation-evidence")).toMatchObject({ numerator: 3, denominator: 6 });
      expect(multiple.completion.questions.filter(({ kind }) => kind === "governance")).toEqual([expanded]);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });

  it("exposes exact accepted identity ambiguity, unrealized requirements, and expired canonical deferrals", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-coverage-meaning-"));
    try {
      await mkdir(join(root, "src")); await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
      const requirement = { id: "requirement:a", key: "a", title: "Future behavior", aliases: ["shared"], statement: "Retain future behavior.", status: "active", sourceClass: "authored", scope: { ...scope, value: "future/**" }, origin: [], evidence: [] };
      await canonical(root, "requirement", requirement);
      await canonical(root, "requirement", { ...requirement, id: "requirement:b", key: "b" });
      await canonical(root, "requirement", { ...requirement, id: "requirement:rejected", key: "rejected", status: "rejected" });
      const concern = { id: "concern:later", key: "later", title: "Future storage", question: "Which storage?", scope, sourceClass: "authored", status: "deferred", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [], evidence: [],
        deferral: { rationale: "Keep options available.", preserveOptionality: ["Keep the port generic."], forbiddenCommitments: ["No vendor-specific implementation."], reconsiderWhen: [{ type: "date", at: "2027-01-01T00:00:00.000Z" }] } };
      await canonical(root, "architecture-concern", concern);
      const graph = new KnowledgeGraph(await observeChangeRepository(root));
      const input = { graph, unitIds: new Set(graph.units.map(({ id }) => id)), decisions: [], evaluations: [], authorityProblems: [], includeUnrealized: true };
      const current = deriveCompletionQuestions({ ...input, now: "2026-01-01T00:00:00.000Z" });
      expect(current.filter(({ kind }) => kind === "unrealized-requirement")).toHaveLength(2);
      expect(current.find(({ kind }) => kind === "identity-overlap")?.ownerIds).toEqual(["requirement:a", "requirement:b"]);
      expect(current.some(({ kind }) => kind === "architecture-concern")).toBe(false);
      const expired = deriveCompletionQuestions({ ...input, now: "2028-01-01T00:00:00.000Z" });
      expect(expired.filter(({ kind }) => kind !== "architecture-concern")).toEqual(current);
      expect(expired.find(({ kind }) => kind === "architecture-concern")?.reasons).toEqual(["The canonical deferral review date has expired."]);
      const limited = await inspectRepositoryCoverage(root, { scope: ".", budgetTokens: 1 }, "complete");
      expect(limited.completion.questionDisclosure).toMatchObject({ included: 0, total: expect.any(Number) });
      expect(limited.continuationPersisted).toBe(false);
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }); }
  });
});
