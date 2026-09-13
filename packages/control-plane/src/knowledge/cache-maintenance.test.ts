import { mkdir, mkdtemp, open, readFile, readdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, hashFramedDomain, type ExecutionPlan } from "@projector/core";
import { withDerivedCacheAdmission, withProjectOperationAccess, withObservationScope } from "@projector/runtime";
import { expect, it } from "vitest";
import { ChangeLifecycleStore } from "../change-lifecycle/store.js";
import { impactReference, type RepositoryImpactSnapshot } from "../impact/service.js";
import { maintainDerivedCache } from "./cache-maintenance.js";
import { finalizeKnowledgeContext, knowledgeContextWrite, KnowledgeContextStore } from "./store.js";

const hash = hashFramedDomain("cache-maintenance-fixture", "state");
const state = { gitBase: "abc", worktreeDigest: hash, canonicalProjectorDigest: hash, toolchainDigest: hash };
const snapshotBasis = { version: "repository-impact@1" as const, state, records: [], files: [], canonical: [], subjects: [], rules: [], relations: [], possibleUnitIds: [], unknowns: [] };
const snapshot: RepositoryImpactSnapshot = { ...snapshotBasis, contentHash: hashFramedDomain("repository-impact@1", snapshotBasis) };
function context(request: string) {
  return finalizeKnowledgeContext({
    apiVersion: "projector.knowledge/v1", request, requestFingerprint: hash, operation: "context",
    requestOptions: { entities: [], namedTargets: [], operation: "context", policy: { maxCandidates: 1, maxEntries: 1, maxDepth: 1, maxTraversalCost: 1, minimumScore: 0, maxContextCost: 1 } },
    capturedState: state, discoveryBinding: { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hash },
    interpretation: { status: "unresolved", candidates: [], unknowns: [] }, branches: [], analyzerCapabilities: [], analyzerFailures: [], unknowns: [], persisted: true,
    impactBaseline: impactReference(snapshot),
  });
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-maintenance-"));
  await mkdir(join(root, ".projector/runtime"), { recursive: true });
  const older = context("older"); const newer = context("newer");
  const writes = [{ relativePath: `.projector/runtime/impact/${snapshot.contentHash.slice("sha256:v1:".length)}.json`, content: `${canonicalJson(snapshot)}\n` }, knowledgeContextWrite(older), knowledgeContextWrite(newer)];
  await withDerivedCacheAdmission(root, (cache) => cache.publishAll(writes));
  await utimes(join(root, writes[1]!.relativePath), new Date(1), new Date(1));
  await utimes(join(root, writes[2]!.relativePath), new Date(2), new Date(2));
  return { root, older, newer, writes };
}

it("evicts least recently used context while retaining a snapshot shared by a retained context", async () => {
  const { root, older, newer, writes } = await fixture();
  const targetBytes = Buffer.byteLength(writes[0]!.content) + Buffer.byteLength(writes[2]!.content);
  const result = await maintainDerivedCache(root, { targetBytes });
  expect(result).toMatchObject({ status: "collected", removedEntries: 1, retainedBytes: targetBytes });
  const store = await KnowledgeContextStore.create(root);
  await expect(store.read(older.id)).rejects.toThrow("request fresh persisted context");
  expect((await store.read(newer.id)).id).toBe(newer.id);
  expect(await readFile(join(root, writes[0]!.relativePath), "utf8")).toBe(writes[0]!.content);
  expect(await maintainDerivedCache(root, { targetBytes: 0 })).toMatchObject({ removedEntries: 2, retainedBytes: 0 });
});

it("does no deletion when lifecycle ownership or the protection budget is incomplete", async () => {
  const { root, writes } = await fixture();
  await mkdir(join(root, ".projector/runtime/change-lifecycles/captures"), { recursive: true });
  await writeFile(join(root, ".projector/runtime/change-lifecycles/captures/unknown.json"), "{}");
  await expect(maintainDerivedCache(root, { targetBytes: 0 })).rejects.toThrow();
  for (const write of writes) expect(await readFile(join(root, write.relativePath), "utf8")).toBe(write.content);
});

it("does not wait behind a live reader or leave a collector request", async () => {
  const { root } = await fixture();
  await withProjectOperationAccess(root, { mode: "shared", operation: "read" }, async () => {
    expect(await maintainDerivedCache(root, { targetBytes: 0 })).toEqual({ status: "busy", removedEntries: 0 });
    expect(await readdir(join(root, ".projector/runtime/operation-access/requests"))).toEqual([]);
  });
});

it("retires oversized unprotected payloads by metadata while preserving an explicit context and shared snapshot", async () => {
  const { root, older, newer, writes } = await fixture();
  const oversized = join(root, `.projector/runtime/knowledge/contexts/${"d".repeat(32)}.json`);
  const handle = await open(oversized, "wx");
  try { await handle.truncate(512 * 1024 * 1024); } finally { await handle.close(); }
  await utimes(oversized, new Date(0), new Date(0));
  const targetBytes = Buffer.byteLength(writes[0]!.content) + Buffer.byteLength(writes[1]!.content);
  expect(await maintainDerivedCache(root, { targetBytes, preserveContextIds: [older.id.slice("knowledge_context_".length)] })).toMatchObject({ status: "collected", removedEntries: 2, retainedBytes: targetBytes });
  const store = await KnowledgeContextStore.create(root);
  expect((await store.read(older.id)).id).toBe(older.id);
  await expect(store.read(newer.id)).rejects.toThrow("request fresh persisted context");
  expect(await readFile(join(root, writes[0]!.relativePath), "utf8")).toBe(writes[0]!.content);
  await expect(readFile(oversized)).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not delete any cache entries when an explicitly retained context is invalid", async () => {
  const { root, newer, writes } = await fixture();
  const corrupted = "{}".padEnd(Buffer.byteLength(writes[2]!.content), " ");
  await writeFile(join(root, writes[2]!.relativePath), corrupted);
  await expect(maintainDerivedCache(root, { targetBytes: 0, preserveContextIds: [newer.id] })).rejects.toThrow();
  expect(await readFile(join(root, writes[0]!.relativePath), "utf8")).toBe(writes[0]!.content);
  expect(await readFile(join(root, writes[1]!.relativePath), "utf8")).toBe(writes[1]!.content);
  expect(await readFile(join(root, writes[2]!.relativePath), "utf8")).toBe(corrupted);
});

it("rejects retained context larger than the operation's derived-data allowance before parsing", async () => {
  const { root, older } = await fixture();
  const store = await KnowledgeContextStore.create(root);
  await expect(withObservationScope({ limits: { maxDerivedBytes: 8 } }, async () => store.read(older.id))).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" });
});

it("retains pending approved context and its shared dependency when collecting all disposable work", async () => {
  const { root, older, newer, writes } = await fixture();
  const lifecycles = await ChangeLifecycleStore.create(root);
  const proposal = {
    apiVersion: "projector.change-proposal/v1" as const,
    requirements: [{ key: "value", title: "Value", statement: "The value changes.", aliases: [] }],
    scenarios: [{ key: "change", title: "Change value", aliases: [], steps: [{ role: "trigger" as const, statement: "The value changes." }, { role: "expected-outcome" as const, statement: "The value is visible." }] }],
    architecture: null, edits: [{ path: "src/value.mjs", before: "old", after: "new" }],
    validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["architecture" as const, "behavior" as const],
  };
  const plan: ExecutionPlan = {
    id: "plan:maintenance", semanticChangeId: "change:maintenance", revision: 1, sourceRunId: "run:test", packetIds: [], boundary: ["src/value.mjs"], knownAffectedUnitIds: [], possibleFrontierUnitIds: [], unavailableSurfaceIds: [], checkpoints: [], assumptions: [],
    boundState: { compiledAgainst: state, valueDependencies: [], queryDependencies: [], dependencyDigest: hash },
    completionCriteria: { requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong", requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0, allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: false },
  };
  const capture = await lifecycles.capture({ request: "Change value", proposal, proposalHash: hashFramedDomain("repository-change-proposal", proposal), semanticChangeId: "change:maintenance", plan, capsules: [], exactPatchInputHash: hash, knowledgeContextId: older.id });
  await lifecycles.approve(capture.semanticChangeId, capture.planHash, plan, []);
  const result = await maintainDerivedCache(root, { targetBytes: 0 });
  expect(result.removedEntries).toBe(1);
  const store = await KnowledgeContextStore.create(root);
  expect((await store.read(older.id)).id).toBe(older.id);
  await expect(store.read(newer.id)).rejects.toThrow("request fresh persisted context");
  expect(await readFile(join(root, writes[0]!.relativePath), "utf8")).toBe(writes[0]!.content);
});
