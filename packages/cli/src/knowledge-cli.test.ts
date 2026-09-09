import { describe, expect, it, vi } from "vitest";
import { executeProjector } from "./cli.js";
import { createBuiltMcpCliPort } from "./mcp-cli.js";
import { presentKnowledgeContext, presentKnowledgeReconciliation } from "./knowledge-cli.js";

function knowledgePort() {
  return {
    context: vi.fn(async ({ request, persist }: { request: string; persist: boolean }) => ({
      id: "knowledge:context:123", request, persisted: persist,
      interpretation: { status: "unresolved" as const, candidates: [], unknowns: [] }, branches: [],
      unknowns: ["No accepted meaning matches this request."],
    })),
    reconcile: vi.fn(async () => ({ contextId: "knowledge:context:123", status: "stale" as const, branches: [], reasons: ["A selected requirement changed."] })),
  };
}

describe("request-first knowledge CLI", () => {
  it("presents lexical candidates as bounded whole-record overviews with explicit drill-down", async () => {
    const largeMeaning = JSON.stringify({ statement: "x".repeat(20_000) });
    const candidate = (entityId: string) => ({ entityId, entityKind: "requirement" as const, score: 0.8, direct: false, signals: ["lexical" as const], explanation: "candidate", continuityFromIds: [] });
    const branch = (entityId: string) => ({
      id: `branch:${entityId}`, interpretation: candidate(entityId), hypothesis: true,
      context: { items: [{ entityId, kind: "requirement" as const, band: "direct" as const, disclosure: "full" as const, content: largeMeaning,
        sourceSemanticHash: "sha256:v1:item", relevanceScore: 1, relevanceReasons: [], uncertainty: [], confidence: 1 }],
        estimatedCost: largeMeaning.length, requiredBudgetOverrun: 0, requiredExpansionIds: [], unknowns: [], sourceClosureId: "closure", contentHash: "sha256:v1:context" },
      lensObligations: [], frontier: ["next:a", "next:b"], closure: {}, metrics: {}, sourceFingerprint: "sha256:v1:s", semanticFingerprint: "sha256:v1:m", queryFingerprint: "sha256:v1:q",
    });
    const report = { id: "knowledge:large", request: "--format", persisted: false,
      interpretation: { status: "candidates" as const, candidates: [candidate("requirement:a"), candidate("requirement:b")], unknowns: ["u".repeat(9_000)] },
      branches: [branch("requirement:a"), branch("requirement:b")], unknowns: ["u".repeat(9_000)] };

    const view = presentKnowledgeContext(report as never);
    expect(view.branches).toHaveLength(2);
    expect(view.branches[0]?.context.items).toEqual([]);
    expect(view.branches[0]?.context.deferredItems).toEqual([expect.objectContaining({ items: [{ entityId: "requirement:a", contentBytes: largeMeaning.length }] })]);
    expect(view.branches[0]?.fullEvidence.arguments).toEqual(["context", "--request", "--format", "--entity", "requirement:a", "--format", "json", "--mode", "observe"]);
    expect(view.unknownDisclosure).toEqual({ total: 1, included: 0, omitted: 1 });
    expect(JSON.stringify(view).length).toBeLessThan(20_000);

    const knowledge = knowledgePort();
    await executeProjector(view.branches[0]!.fullEvidence.arguments, { knowledge });
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({ request: "--format", entities: ["requirement:a"], persist: false }));
  });

  it("bounds high-cardinality deferred identity metadata with exact accounting", () => {
    const selected = { entityId: "requirement:many-units", entityKind: "requirement" as const, score: 1, direct: true, signals: ["id" as const], explanation: "explicit", continuityFromIds: [] };
    const units = Array.from({ length: 50_000 }, (_, index) => ({ entityId: `unit:${index}`, kind: "projection-unit" as const, band: "consequence" as const,
      disclosure: "summary" as const, content: `src/${index}.ts`, sourceSemanticHash: `sha256:v1:${index}`, relevanceScore: 0.5, relevanceReasons: [], uncertainty: [], confidence: 0.5 }));
    const view = presentKnowledgeContext({ id: "knowledge:many", request: "inspect many units", persisted: false,
      interpretation: { status: "direct", candidates: [selected], unknowns: [] }, unknowns: [],
      branches: [{ id: "branch:many", interpretation: selected, hypothesis: false, context: { items: units, estimatedCost: 1, requiredBudgetOverrun: 0, requiredExpansionIds: [],
        unknowns: [], sourceClosureId: "closure", contentHash: "sha256:v1:context" }, lensObligations: [], frontier: [], closure: {}, metrics: {},
        sourceFingerprint: "sha256:v1:s", semanticFingerprint: "sha256:v1:m", queryFingerprint: "sha256:v1:q" }] } as never);

    expect(view.branches[0]?.context.itemsDisclosure).toEqual({ total: 50_000, included: 8, omitted: 49_992 });
    expect(view.branches[0]?.context.deferredIdentityDisclosure).toEqual({ total: 49_992, included: 24, omitted: 49_968 });
    expect(view.branches[0]?.context.deferredItems.flatMap(({ items }) => items)).toHaveLength(24);
    expect(JSON.stringify(view).length).toBeLessThan(20_000);
  });

  it("focuses direct context, preserves governing records whole, and groups only equivalent obligations", () => {
    const selected = { entityId: "requirement:direct", entityKind: "requirement" as const, score: 1, direct: true, signals: ["id" as const], explanation: "explicit", continuityFromIds: [] };
    const item = (entityId: string, kind: "requirement" | "decision" | "projection-unit", band: "direct" | "governing" | "consequence", content: string) => ({
      entityId, kind, band, disclosure: band === "consequence" ? "summary" as const : "full" as const, content,
      sourceSemanticHash: `sha256:v1:${entityId}`, relevanceScore: 1, relevanceReasons: [], uncertainty: [], confidence: 1,
    });
    const obligation = (unitId: string, unknowns: string[] = []) => ({ lensId: "lens:boundary", lensVersion: "1", lensSemanticHash: "sha256:v1:lens", authorityRecordId: "authority:lens",
      unitId, membershipFingerprint: `sha256:v1:membership:${unitId}`, applicabilityFingerprint: `sha256:v1:applicability:${unitId}`,
      ruleIds: ["rule:boundary"], predicates: [{ kind: "path-under", path: "src" }], validatorIds: ["validator:boundary"], expectationKinds: ["static-dependency"], status: unknowns.length === 0 ? "applicable" as const : "unknown" as const, unknowns });
    const sources = Array.from({ length: 12 }, (_, index) => item(`unit:${index}`, "projection-unit", "consequence", `src/${index}.ts`));
    const report = { id: "knowledge:direct", request: "inspect direct", persisted: true,
      interpretation: { status: "direct" as const, candidates: [selected], unknowns: [] }, unknowns: [],
      branches: [{ id: "branch:direct", interpretation: selected, hypothesis: false,
        context: { items: [item("requirement:direct", "requirement", "direct", "exact direct meaning"), item("decision:governing", "decision", "governing", "exact rationale and constraint"),
          item("decision:oversized", "decision", "governing", "g".repeat(40_000)), ...sources],
          estimatedCost: 100, requiredBudgetOverrun: 0, requiredExpansionIds: [], unknowns: [], sourceClosureId: "closure", contentHash: "sha256:v1:context" },
        lensObligations: [obligation("unit:1"), obligation("unit:2"), obligation("unit:3", ["dynamic target unknown"])], frontier: [], closure: {}, metrics: {},
        sourceFingerprint: "sha256:v1:s", semanticFingerprint: "sha256:v1:m", queryFingerprint: "sha256:v1:q" }] };

    const view = presentKnowledgeContext(report as never);
    expect(view.branches[0]?.context.items.map(({ content }) => content)).toEqual(expect.arrayContaining(["exact direct meaning", "exact rationale and constraint"]));
    expect(view.branches[0]?.context.items.filter(({ kind }) => kind === "projection-unit")).toHaveLength(8);
    expect(view.branches[0]?.context.itemsDisclosure).toEqual({ total: 15, included: 10, omitted: 5 });
    expect(view.branches[0]?.context.requiredDisclosureExpansionIds).toEqual(["decision:oversized"]);
    expect(view.branches[0]?.lensObligations).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "applicable", unitCount: 2, membershipFingerprintVariants: 2, predicates: [{ kind: "path-under", path: "src" }] }),
      expect.objectContaining({ status: "unknown", unitCount: 1, unknowns: ["dynamic target unknown"] }),
    ]));
  });

  it("summarizes reconciliation volume without merging binding and governance status", () => {
    const finding = (status: "satisfied" | "violated" | "unknown", id: string) => ({ id, unitId: `unit:${id}`, ruleId: "rule", predicateHash: "sha256:v1:p", status, reason: `${status} reason`, evidenceIds: [] });
    const evaluations = Array.from({ length: 20 }, (_, index) => ({ unitId: `unit:${index}`, status: "conformant", findings: [finding("satisfied", `ok:${index}`)], boundary: [], observationHash: "sha256:v1:o", contentHash: "sha256:v1:c" }));
    evaluations.push({ unitId: "unit:bad", status: "violated", findings: [finding("violated", "bad"), finding("unknown", "unknown")], boundary: [], observationHash: "sha256:v1:o", contentHash: "sha256:v1:c" });
    const view = presentKnowledgeReconciliation({ contextId: "knowledge:context", status: "stale", reasons: ["binding changed"],
      branches: [{ branchId: "branch", validation: { status: "stale", currentState: {}, changedValueDependencyIds: ["requirement:x"], changedQueryDependencyIds: [], reasons: ["value changed"] } }],
      governance: { status: "violated", regeneratedContextId: "knowledge:new", reasons: ["active rule violated"], branches: [{ interpretationEntityId: "requirement:x", retainedBranchId: "branch", currentBranchId: "new-branch", status: "violated", evaluations, reasons: [] }] } } as never);

    expect(view).toMatchObject({ status: "stale", governance: { status: "violated", branches: [{
      evaluationCount: 21, findingCounts: { satisfied: 20, violated: 1, unknown: 1 }, criticalFindingDisclosure: { total: 2, included: 2, omitted: 0 },
    }] } });
    expect(view.governance?.branches[0]?.criticalFindings.map(({ status }) => status)).toEqual(["violated", "unknown"]);
    expect(JSON.stringify(view)).not.toContain("ok:19");
  });

  it("accepts a request and explicit meaning without an edit proposal", async () => {
    const knowledge = knowledgePort();
    const result = await executeProjector(["context", "Preserve meaning across another session", "--entity", "requirement:durable-meaning", "--format", "json"], { knowledge });
    expect(result.exitCode).toBe(0);
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({
      request: "Preserve meaning across another session", entities: ["requirement:durable-meaning"], persist: true,
    }));
    expect(JSON.parse(result.output)).toMatchObject({ persisted: true, interpretation: { status: "unresolved" } });
  });

  it.each([["--dry-run"], ["--mode", "observe"], ["--audit-only"]])("keeps context inspection nonpersisting with %j", async (...flags) => {
    const knowledge = knowledgePort();
    await executeProjector(["context", "Inspect existing meaning", ...flags], { knowledge });
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({ persist: false }));
  });

  it("reports stale knowledge as a stale result, not a successful clean check", async () => {
    const knowledge = knowledgePort();
    const result = await executeProjector(["reconcile", "knowledge:context:123"], { knowledge });
    expect(knowledge.reconcile).toHaveBeenCalledWith(expect.objectContaining({ contextId: "knowledge:context:123" }));
    expect(result.exitCode).toBe(4);
    expect(result.output).toContain("stale");
    expect(result.output).toContain("selected requirement changed");
  });

  it("does not report a successful check when current architectural predicates are violated", async () => {
    const knowledge = { ...knowledgePort(), reconcile: async () => ({ contextId: "knowledge:context:123", status: "current" as const, branches: [], reasons: [],
      governance: { status: "violated" as const, regeneratedContextId: "knowledge:context:new", branches: [], reasons: ["Forbidden dependency observed."] } }) };
    const result = await executeProjector(["reconcile", "knowledge:context:123"], { knowledge });
    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("Current architecture: violated");
  });

  it("validates knowledge arguments before invoking the service", async () => {
    const knowledge = knowledgePort();
    await expect(executeProjector(["context"], { knowledge })).rejects.toThrow(/request/iu);
    await expect(executeProjector(["reconcile"], { knowledge })).rejects.toThrow(/context/iu);
    await expect(executeProjector(["reconcile", "../outside"], { knowledge })).rejects.toThrow(/identity|selector/iu);
    await expect(executeProjector(["audit", "--entity", "requirement:one"], { knowledge })).rejects.toThrow(/only valid with context/iu);
    await expect(executeProjector(["context", "\0"], { knowledge })).rejects.toThrow(/nonblank/iu);
    expect(knowledge.context).not.toHaveBeenCalled();
    expect(knowledge.reconcile).not.toHaveBeenCalled();
  });

  it("exposes bounded context and saved-context validation through the real MCP transport", async () => {
    const knowledge = knowledgePort();
    const mcp = await createBuiltMcpCliPort({ knowledge }).start({ repositoryRoot: process.cwd(), signal: new AbortController().signal });
    const response = await mcp.transport.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
      name: "projector.context", arguments: { request: "Retain the request meaning", entities: ["requirement:durable-meaning"] },
    } });
    expect(response).toMatchObject({ result: { structuredContent: { persisted: false } } });
    expect(knowledge.context).toHaveBeenCalledWith(expect.objectContaining({ persist: false, entities: ["requirement:durable-meaning"] }));
    const validation = await mcp.transport.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "projector.validate", arguments: { contextId: "knowledge:context:123" } } });
    expect(validation).toMatchObject({ result: { structuredContent: { status: "stale" } } });
    const invalid = await mcp.transport.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "projector.context", arguments: { request: "context", repositoryRoot: "outside", persist: true } } });
    expect(invalid).toHaveProperty("error");
    expect(knowledge.context).toHaveBeenCalledTimes(1);
  });
});
