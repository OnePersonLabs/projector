import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, hashFramedDomain, type ExecutionPlan } from "@projector/core";
import { SqliteObservationStore, readDerivedCacheSource, withDerivedCacheAdmission, withProjectOperationAccess, withObservationScope } from "@projector/runtime";
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
  await cacheRow(root, writes[1]!.relativePath, writes[1]!.content, 1);
  await cacheRow(root, writes[2]!.relativePath, writes[2]!.content, 2);
  return { root, older, newer, writes };
}

async function cacheRow(root: string, key: string, content: string, lastUsedMs = 0): Promise<void> {
  const store = await SqliteObservationStore.open(root);
  try { const head = store.head()!; store.publish(head.generation, head, { upserts: [{ kind: "cache-source", key, value: { content, lastUsedMs } }] }, { retainGeneration: true, preserveMetadata: true }); }
  finally { store.close(); }
}

it("evicts least recently used context while retaining a snapshot shared by a retained context", async () => {
  const { root, older, newer, writes } = await fixture();
  const targetBytes = Buffer.byteLength(writes[0]!.content) + Buffer.byteLength(writes[2]!.content);
  const result = await maintainDerivedCache(root, { targetBytes });
  expect(result).toMatchObject({ status: "collected", removedEntries: 1, retainedBytes: targetBytes });
  const store = await KnowledgeContextStore.create(root);
  await expect(store.read(older.id)).rejects.toThrow("request fresh persisted context");
  expect((await store.read(newer.id)).id).toBe(newer.id);
  expect(await readDerivedCacheSource(root, writes[0]!.relativePath)).toBe(writes[0]!.content);
  expect(await maintainDerivedCache(root, { targetBytes: 0 })).toMatchObject({ removedEntries: 2, retainedBytes: 0 });
});

it("does no deletion when lifecycle ownership or the protection budget is incomplete", async () => {
  const { root, writes } = await fixture();
  await mkdir(join(root, ".projector/runtime/change-lifecycles/captures"), { recursive: true });
  await writeFile(join(root, ".projector/runtime/change-lifecycles/captures/unknown.json"), "{}");
  await expect(maintainDerivedCache(root, { targetBytes: 0 })).rejects.toThrow();
  for (const write of writes) expect(await readDerivedCacheSource(root, write.relativePath)).toBe(write.content);
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
  const oversized = `.projector/runtime/knowledge/contexts/${"d".repeat(32)}.json`;
  await cacheRow(root, oversized, "not valid context JSON".repeat(1_000));
  const targetBytes = Buffer.byteLength(writes[0]!.content) + Buffer.byteLength(writes[1]!.content);
  expect(await withObservationScope({ limits: { maxDerivedBytes: targetBytes + 256 } }, () => maintainDerivedCache(root, { targetBytes, preserveContextIds: [older.id.slice("knowledge_context_".length)] }))).toMatchObject({ status: "collected", removedEntries: 2, retainedBytes: targetBytes });
  const store = await KnowledgeContextStore.create(root);
  expect((await store.read(older.id)).id).toBe(older.id);
  await expect(store.read(newer.id)).rejects.toThrow("request fresh persisted context");
  expect(await readDerivedCacheSource(root, writes[0]!.relativePath)).toBe(writes[0]!.content);
  expect(await readDerivedCacheSource(root, oversized)).toBeUndefined();
});

it("does not delete any cache entries when an explicitly retained context is invalid", async () => {
  const { root, newer, writes } = await fixture();
  const corrupted = "{}".padEnd(Buffer.byteLength(writes[2]!.content), " ");
  await cacheRow(root, writes[2]!.relativePath, corrupted, 2);
  await expect(maintainDerivedCache(root, { targetBytes: 0, preserveContextIds: [newer.id] })).rejects.toThrow();
  expect(await readDerivedCacheSource(root, writes[0]!.relativePath)).toBe(writes[0]!.content);
  expect(await readDerivedCacheSource(root, writes[1]!.relativePath)).toBe(writes[1]!.content);
  expect(await readDerivedCacheSource(root, writes[2]!.relativePath)).toBe(corrupted);
});

it("rejects retained context larger than the operation's derived-data allowance before parsing", async () => {
  const { root, older } = await fixture();
  const store = await KnowledgeContextStore.create(root);
  await expect(withObservationScope({ limits: { maxDerivedBytes: 8 } }, async () => store.read(older.id))).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" });
});

it("does not evict fitting disposable payloads because the shared source index is larger than the retention target", async () => {
  const { root, writes } = await fixture();
  const store = await SqliteObservationStore.open(root);
  try {
    const head = store.head()!;
    store.publish(head.generation, head, { upserts: [{ kind: "file", key: "src/unrelated.mjs", value: "x".repeat(32_000) }] });
  } finally { store.close(); }
  const targetBytes = writes.reduce((bytes, write) => bytes + Buffer.byteLength(write.content), 0);
  expect(await maintainDerivedCache(root, { targetBytes })).toEqual({ status: "unchanged", removedEntries: 0, retainedBytes: targetBytes });
  for (const write of writes) expect(await readDerivedCacheSource(root, write.relativePath)).toBe(write.content);
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
  expect(await readDerivedCacheSource(root, writes[0]!.relativePath)).toBe(writes[0]!.content);
});
