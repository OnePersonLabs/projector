import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, withCanonicalHashes, ProjectorOperationInputSchemas } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RepositoryKnowledgeService } from "./service.js";
import { type KnowledgeContextResult, type KnowledgeDecisionValidity, type KnowledgeReconciliationResult } from "./types.js";
import { KnowledgeContextAgentViewSchema, KnowledgeContextOperationOutputSchema, KnowledgeReconciliationAgentViewSchema, KnowledgeReconciliationOperationOutputSchema, projectKnowledgeContext, projectKnowledgeReconciliation } from "./transport.js";

const hash = hashFramedDomain("knowledge-transport-test", "fixture");
let root: string;
let service: RepositoryKnowledgeService;
let context: KnowledgeContextResult;
let reconciliation: KnowledgeReconciliationResult;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "projector-knowledge-transport-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "knowledge-transport-fixture", type: "module" }));
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: "concept:transport", key: "transport", lifecycle: "active",
    payload: { id: "concept:transport", key: "transport", kind: "capability", name: "Transport", aliases: [],
      statement: "MUST_NOT delete production data unless explicit user approval. A iff B. Exactly one.",
      status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: hash, semanticHash: hash },
  }));
  service = await RepositoryKnowledgeService.create(root);
  context = await service.context({ request: "Read transport meaning", entities: ["concept:transport"], persist: true });
  reconciliation = await service.reconcile(context.id);
});
afterAll(async () => { if (root !== undefined) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });

function blockingDecision(): KnowledgeDecisionValidity {
  return {
    decisionId: "decision:blocked", authorityId: "authority:blocked", baseline: { kind: "unavailable", reason: "No baseline" },
    checks: [{ trigger: { type: "manual-review" }, status: "unknown", reason: "Requires investigation" }],
    assessment: { decisionId: "decision:blocked", scope: { op: "atom", field: "path", matcher: "glob", value: "**" },
      state: "invalid-for-scope", firedTriggers: [], invalidatedAssumptions: [], staleEvidenceIds: [], blocksCurrentChange: true, explanation: "Blocking evidence" },
    contentHash: hash,
  };
}

describe("bounded knowledge transport", () => {
  it("rejects oversized complete responses instead of emitting partial or oversized JSON", () => {
    expect(() => projectKnowledgeContext({ ...context, request: "x".repeat(1024 * 1024) })).toThrow(/response.*limit/i);
    expect(() => projectKnowledgeContext({ ...context, request: "x".repeat(16 * 1024 * 1024) }, "full")).toThrow(/response.*limit/i);
    expect(() => projectKnowledgeReconciliation({ ...reconciliation, reasons: ["x".repeat(16 * 1024 * 1024)] }, "full")).toThrow(/response.*limit/i);
  });
  it("retains whole selected meaning and leaves persisted proof available for full disclosure", async () => {
    const source = JSON.stringify(context);
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(context));
    const original = context.branches[0]!.context.items.find((item) => item.entityId === "concept:transport")!;
    expect(view.branches[0]!.context.items).toContainEqual(original);
    expect(JSON.stringify(view)).not.toContain('"discoveryBinding"');
    expect(JSON.stringify(view)).not.toContain('"closure"');
    expect(view.contentHash).toBe(context.contentHash);
    expect(projectKnowledgeContext(context, "full")).toBe(context);
    expect(KnowledgeContextOperationOutputSchema.safeParse(projectKnowledgeContext(context, "full")).success).toBe(true);
    expect(ProjectorOperationInputSchemas.context.safeParse({ request: context.request, entities: ["concept:transport"], ...view.fullEvidence.inputPatch }).success).toBe(true);
    const originalInput = { request: context.request, entities: ["concept:transport"], namedTargets: ["index.ts"], operation: "inspect", persist: true, policy: { maxEntries: 7, maxDepth: 2, maxContextCost: 4000 } };
    expect(ProjectorOperationInputSchemas.context.parse({ ...originalInput, ...view.fullEvidence.inputPatch })).toEqual({ ...originalInput, view: "full" });
    expect(ProjectorOperationInputSchemas.context.safeParse(view.fullEvidence.inputPatch).success).toBe(false);
    expect(view.fullEvidence.note).toContain("not a complete request");
    expect(JSON.stringify(context)).toBe(source);
    expect((await service.reconcile(view.id)).contextId).toBe(view.id);
  });

  it("omits oversized Unicode records whole, with honest totals and a supported full view", () => {
    const branch = context.branches[0]!;
    const original = branch.context.items[0]!;
    const huge = { ...original, entityId: "concept:large", content: `规则${"界".repeat(20_000)} MUST_NOT lose this exception` };
    const report = { ...context, unknowns: Array.from({ length: 1000 }, (_, index) => `Unknown ${index}: ${"x".repeat(100)}`),
      branches: [{ ...branch, context: { ...branch.context, items: [huge, original] } }] };
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(report));
    expect(view.branches[0]!.context.items).toEqual([original]);
    expect(view.branches[0]!.context.itemsDisclosure).toEqual({ total: 2, included: 1, omitted: 1 });
    expect(view.branches[0]!.context.deferredEntityIds.values).toContain("concept:large");
    expect(view.unknownDisclosure.total).toBe(1000);
    expect(view.unknownDisclosure.omitted).toBeGreaterThan(980);
    expect(Buffer.byteLength(JSON.stringify(view), "utf8")).toBeLessThan(65_536);
    expect(projectKnowledgeContext(report, "full").branches[0]!.context.items[0]).toEqual(huge);
  });

  it("retains blocked and unknown totals even when the responsible branches and records are omitted", () => {
    const branch = context.branches[0]!;
    const report: KnowledgeContextResult = { ...context, branches: Array.from({ length: 30 }, (_, index) => ({
      ...branch, id: `branch:${index}`, decisionValidity: index === 29 ? [blockingDecision()] : [],
      governanceEvaluations: index === 29 ? [{ unitId: "unit:unknown", status: "unknown", boundary: [], observationHash: hash, contentHash: hash,
        findings: [{ id: "finding:unknown", unitId: "unit:unknown", ruleId: "rule:unknown", predicateHash: hash, status: "unknown", reason: "Missing evidence", evidenceIds: [] }] }] : [],
    })) };
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(report));
    expect(view.branchDisclosure.total).toBe(30);
    expect(view.branchDisclosure.omitted).toBeGreaterThanOrEqual(18);
    expect(view.branches.some((value) => value.id === "branch:29")).toBe(false);
    expect(view.safety).toMatchObject({ blockedDecisions: 1, unknownDecisions: 1, unknownDecisionChecks: 1, unknownGovernance: 1, unknownFindings: 1 });
    expect(Buffer.byteLength(JSON.stringify(view), "utf8")).toBeLessThan(65_536);
  });

  it("bounds reconciliation proof while preserving stale, governance and application evidence signals", () => {
    const report: KnowledgeReconciliationResult = { ...reconciliation, status: "stale", reasons: ["x".repeat(100_000)],
      governance: { ...reconciliation.governance, status: "unknown", branches: Array.from({ length: 30 }, (_, index) => ({
        interpretationEntityId: `concept:${index}`, status: index === 29 ? "unknown" : "not-applicable", evaluations: [], reasons: [],
        decisionValidity: index === 29 ? [blockingDecision()] : [],
      })) }, applicationEvidence: { status: "violated", branches: [{ branchId: "application", status: "violated", changed: true, reasons: ["x".repeat(100_000)] }] } };
    const view = KnowledgeReconciliationAgentViewSchema.parse(projectKnowledgeReconciliation(report));
    expect(view).toMatchObject({ status: "stale", reasonDisclosure: { total: 1, included: 0, omitted: 1 }, governance: { status: "unknown", safety: { blockedDecisions: 1, unknownDecisionChecks: 1 } }, applicationEvidence: { status: "violated", branchDisclosure: { omitted: 1 } } });
    expect(view.governance.branchDisclosure.omitted).toBeGreaterThanOrEqual(18);
    expect(Buffer.byteLength(JSON.stringify(view), "utf8")).toBeLessThan(65_536);
    expect(projectKnowledgeReconciliation(report, "full")).toBe(report);
    expect(KnowledgeReconciliationOperationOutputSchema.safeParse(projectKnowledgeReconciliation(report, "full")).success).toBe(true);
    expect(ProjectorOperationInputSchemas.reconcile.safeParse(view.fullEvidence.input).success).toBe(true);
    expect(KnowledgeReconciliationOperationOutputSchema.safeParse({ ...view, secretProof: {} }).success).toBe(false);
  });
});
