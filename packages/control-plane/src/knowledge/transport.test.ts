import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, withCanonicalHashes, ProjectorOperationInputSchemas } from "@projector/core";
import { CanonicalFileRepository, currentObservationScope } from "@projector/runtime";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RepositoryKnowledgeService } from "./service.js";
import { finalizeKnowledgeContext, KnowledgeContextStore } from "./store.js";
import { type KnowledgeContextResult, type KnowledgeDecisionValidity, type KnowledgeReconciliationResult } from "./types.js";
import { KnowledgeContextAgentViewSchema, KnowledgeContextInspectionOutputSchema, KnowledgeContextOperationOutputSchema, KnowledgeReconciliationAgentViewSchema, KnowledgeReconciliationOperationOutputSchema, inspectKnowledgeContext, projectKnowledgeContext, projectKnowledgeReconciliation } from "./transport.js";

const hash = hashFramedDomain("knowledge-transport-test", "fixture");
let root: string;
let service: RepositoryKnowledgeService;
let context: KnowledgeContextResult;
let reconciliation: KnowledgeReconciliationResult;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "projector-knowledge-transport-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "knowledge-transport-fixture", type: "module" }));
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "concept", id: "concept:transport", key: "transport", lifecycle: "active",
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
  it("keeps large whole records available through full output and retained detail pages", () => {
    const branch = context.branches[0]!;
    const large = { ...branch.context.items[0]!, entityId: "concept:large", content: `${"a".repeat(8_191)}😀${"b".repeat(17 * 1024 * 1024)}` };
    const report = { ...context, request: "root request ".repeat(8_000), branches: [{ ...branch, context: { ...branch.context, items: [large] } }] };
    expect(projectKnowledgeContext(report, "full")).toBe(report);
    expect(projectKnowledgeReconciliation({ ...reconciliation, reasons: ["x".repeat(17 * 1024 * 1024)] }, "full").reasons[0]).toHaveLength(17 * 1024 * 1024);
    let cursor: string | undefined;
    let rebuilt: unknown;
    let found = false;
    let total = 0;
    do {
      const page = KnowledgeContextInspectionOutputSchema.parse(inspectKnowledgeContext(report, { ...(cursor === undefined ? {} : { cursor }), limit: 100 }));
      expect(Buffer.byteLength(JSON.stringify(page), "utf8")).toBeLessThan(80 * 1024);
      expect(Buffer.byteLength(JSON.stringify({ structuredContent: page, content: [{ text: JSON.stringify(page) }] }), "utf8")).toBeLessThan(200 * 1024);
      if (page.document !== undefined) rebuilt = page.document;
      total = page.disclosure.total;
      for (const record of page.records) {
        const segments = record.path.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
        let parent = rebuilt as Record<string, unknown>;
        for (const segment of segments.slice(0, -1)) parent = parent[segment] as Record<string, unknown>;
        const key = segments.at(-1)!;
        if ("text" in record) {
          if (record.path.endsWith("/context/items/0/content")) found = true;
          const existing = parent[key] as string;
          expect(existing.length).toBe(record.textOffset);
          parent[key] = existing + record.text;
        } else parent[key] = record.value;
      }
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    expect(found).toBe(true);
    expect(total).toBeGreaterThan(2_000);
    expect(rebuilt).toEqual(report);
    expect(inspectKnowledgeContext(report, { view: "full" })).toBe(report);
  });
  it("retains and inspects a context larger than the former full response ceiling", async () => {
    const branch = context.branches[0]!;
    const large = { ...branch.context.items[0]!, entityId: "concept:persisted-large", content: "a".repeat(17 * 1024 * 1024) };
    const { id: _id, contentHash: _contentHash, ...basis } = context;
    const saved = finalizeKnowledgeContext({ ...basis, branches: [{ ...branch, context: { ...branch.context, items: [large] } }] });
    await (await KnowledgeContextStore.create(root)).write(saved);
    const retained = await service.inspectContext(saved.id);
    expect(retained.contentHash).toBe(saved.contentHash);
    expect(retained.branches[0]!.context.items[0]!.content).toBe(large.content);
    const first = inspectKnowledgeContext(retained, { limit: 1 });
    expect(first.contextId).toBe(saved.id);
    expect(first.nextCursor).toBeDefined();
  });
  it("binds detail cursors to the retained context and exposes exact page counts", () => {
    const first = inspectKnowledgeContext(context, { limit: 1 });
    expect(first.document).toBeDefined();
    expect(first.disclosure).toEqual({ total: expect.any(Number), included: 1, omitted: expect.any(Number) });
    const second = inspectKnowledgeContext(context, { cursor: first.nextCursor!, limit: 1 });
    expect(second.document).toBeUndefined();
    expect(second.records).toHaveLength(1);
    expect(() => inspectKnowledgeContext({ ...context, id: "knowledge_context_other" }, { cursor: first.nextCursor! })).toThrow(/does not match/);
    expect(() => inspectKnowledgeContext({ ...context, contentHash: hashFramedDomain("changed", "context") }, { cursor: first.nextCursor! })).toThrow(/does not match/);
    expect(() => inspectKnowledgeContext(context, { cursor: "invalid" })).toThrow(/cursor/);
    expect(() => inspectKnowledgeContext(context, { cursor: Buffer.from("null").toString("base64url") })).toThrow(/invalid.*cursor/);
    const pastEnd = Buffer.from(JSON.stringify({ contextId: context.id, contentHash: context.contentHash, offset: Number.MAX_SAFE_INTEGER })).toString("base64url");
    expect(() => inspectKnowledgeContext(context, { cursor: pastEnd })).toThrow(/exceeds.*record count/);
    expect(() => inspectKnowledgeContext(context, { limit: 101 })).toThrow(/limit/);
  });
  it("pages every JSON value needed to reconstruct the retained context", () => {
    let cursor: string | undefined;
    let rebuilt: unknown;
    let consumed = 0;
    do {
      const page = inspectKnowledgeContext(context, { ...(cursor === undefined ? {} : { cursor }), limit: 3 });
      if (page.document !== undefined) rebuilt = page.document;
      expect(page.offset).toBe(consumed);
      for (const record of page.records) {
        const segments = record.path.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
        let parent = rebuilt as Record<string, unknown>;
        for (const segment of segments.slice(0, -1)) parent = parent[segment] as Record<string, unknown>;
        const key = segments.at(-1)!;
        if ("text" in record) {
          expect((parent[key] as string).length).toBe(record.textOffset);
          parent[key] = (parent[key] as string) + record.text;
        } else parent[key] = record.value;
        consumed += 1;
      }
      cursor = page.nextCursor;
      expect(page.disclosure.total).toBeGreaterThanOrEqual(consumed);
    } while (cursor !== undefined);
    expect(rebuilt).toEqual(context);
  });
  it("honors cancellation before retained inspection", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(service.inspectContext(context.id, controller.signal)).rejects.toThrow();
  });
  it("propagates cancellation into the retained store read scope", async () => {
    const controller = new AbortController();
    let entered!: () => void;
    const inStore = new Promise<void>((resolve) => { entered = resolve; });
    const read = vi.spyOn(KnowledgeContextStore.prototype, "read").mockImplementation(async () => {
      const signal = currentObservationScope()?.signal;
      expect(signal).toBeDefined();
      entered();
      return new Promise<KnowledgeContextResult>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
    });
    try {
      const pending = service.inspectContext(context.id, controller.signal);
      await inStore;
      controller.abort(new Error("caller cancelled retained read"));
      await expect(pending).rejects.toThrow("caller cancelled retained read");
    } finally { read.mockRestore(); }
  });
  it("projects readable whole meaning while leaving raw persisted proof available for full disclosure", async () => {
    const source = JSON.stringify(context);
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(context));
    const original = context.branches[0]!.context.items.find((item) => item.entityId === "concept:transport")!;
    expect(view.branches[0]!.context.items).toContainEqual(expect.objectContaining({
      entityId: original.entityId, sourceSemanticHash: original.sourceSemanticHash, sectionDisclosure: { total: 2, included: 2, omitted: 0 },
    }));
    expect(view.meaning).toMatchObject({
      profile: { id: "human-compact", version: 1, sourceContentHash: context.contentHash },
      sections: expect.arrayContaining([expect.objectContaining({ entityId: original.entityId, kind: "statement", text: "MUST_NOT delete production data unless explicit user approval. A iff B. Exactly one." })]),
    });
    expect(JSON.stringify(view)).not.toContain('"discoveryBinding"');
    expect(JSON.stringify(view)).not.toContain('"closure"');
    expect(JSON.stringify(view)).not.toContain('"discoveryHash"');
    expect(JSON.stringify(view)).not.toContain('"evidence"');
    expect(view.contentHash).toBe(context.contentHash);
    expect(view.retainedEvidence).toEqual({ operation: "context.inspect", input: { contextId: context.id } });
    expect(KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext({ ...context, persisted: false })).retainedEvidence).toBeUndefined();
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

  it("keeps oversized raw history out of the compact view, with honest section totals and a supported full view", () => {
    const branch = context.branches[0]!;
    const original = branch.context.items[0]!;
    const huge = { ...original, entityId: "concept:large", content: `规则${"界".repeat(20_000)} MUST_NOT lose this exception` };
    const report = { ...context, unknowns: Array.from({ length: 1000 }, (_, index) => `Unknown ${index}: ${"x".repeat(100)}`),
      branches: [{ ...branch, context: { ...branch.context, items: [huge, original] } }] };
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(report));
    expect(view.branches[0]!.context.items).toHaveLength(2);
    expect(view.branches[0]!.context.itemsDisclosure).toEqual({ total: 2, included: 2, omitted: 0 });
    expect(view.branches[0]!.context.meaningDisclosure).toEqual({ total: 3, included: 2, omitted: 1 });
    expect(view.meaning.disclosure).toEqual({ total: 3, included: 2, omitted: 1 });
    expect(view.branches[0]!.context.deferredEntityIds.values).toContain("concept:large");
    expect(view.unknownDisclosure.total).toBe(1000);
    expect(view.unknownDisclosure.omitted).toBeGreaterThan(980);
    expect(Buffer.byteLength(JSON.stringify(view), "utf8")).toBeLessThan(65_536);
    expect(projectKnowledgeContext(report, "full").branches[0]!.context.items[0]).toEqual(huge);
  });

  it("deduplicates before the display budget so unique selected later branches are still represented", () => {
    const branch = context.branches[0]!;
    const shared = branch.context.items[0]!;
    const later = {
      ...shared,
      entityId: "concept:late",
      sourceSemanticHash: hashFramedDomain("knowledge-transport-test", "late"),
      content: JSON.stringify({ id: "concept:late", key: "late", name: "Late selected meaning", statement: "The later selected branch MUST keep this unique condition.", status: "active" }),
    };
    const report: KnowledgeContextResult = {
      ...context,
      branches: Array.from({ length: 13 }, (_, index) => ({
        ...branch, id: `branch:${index}`,
        context: { ...branch.context, items: index === 12 ? [shared, later] : [shared] },
      })),
    };
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(report));
    expect(view.branches.some(({ id }) => id === "branch:12")).toBe(false);
    expect(view.meaning.sections.filter(({ entityId }) => entityId === shared.entityId)).toHaveLength(2);
    expect(view.meaning.sections).toContainEqual(expect.objectContaining({
      entityId: "concept:late", text: "The later selected branch MUST keep this unique condition.", branchIds: ["branch:12"],
    }));
  });

  it("preserves current authority qualifiers without making evidence history default context", () => {
    const branch = context.branches[0]!;
    const original = branch.context.items[0]!;
    const qualified = {
      ...original,
      entityId: "decision:qualified",
      kind: "decision" as const,
      sourceSemanticHash: hashFramedDomain("knowledge-transport-test", "qualified"),
      content: JSON.stringify({
        record: { id: "decision:qualified", title: "Preserve qualifier", decision: "The system MUST retain the qualified rule.", lifecycle: "active", consequences: [{ explanation: "Keep the named exception." }] },
        authority: { payload: { rationale: "The exception applies only while evidence remains current.", assumptions: ["The producer identity is authenticated."], reconsiderWhen: [{ type: "assumption-falsified", assumptionKey: "producer-identity" }], status: "approved", conclusion: "adopt" } },
      }),
    };
    const report = { ...context, branches: [{ ...branch, context: { ...branch.context, items: [qualified] } }] };
    const view = KnowledgeContextAgentViewSchema.parse(projectKnowledgeContext(report));
    const qualifier = view.meaning.sections.find(({ entityId, kind }) => entityId === qualified.entityId && kind === "qualifier")!;
    expect(qualifier.text).toContain("Keep the named exception.");
    expect(qualifier.text).toContain("The exception applies only while evidence remains current.");
    expect(qualifier.text).toContain("The producer identity is authenticated.");
    expect(view.meaning.sections).toContainEqual(expect.objectContaining({ entityId: qualified.entityId, kind: "currentness", text: expect.stringContaining("Authority status: approved") }));
    expect(JSON.stringify(view)).not.toContain('"reconsiderWhen"');
    expect((projectKnowledgeContext(report as KnowledgeContextResult, "full") as KnowledgeContextResult).branches[0]!.context.items[0]!.content).toContain('"reconsiderWhen"');
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
