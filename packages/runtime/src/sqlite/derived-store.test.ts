import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";

import { hashRootManifest, withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import { CanonicalFileRepository } from "../persistence/index.js";
import { rebuildDerivedStore, SqliteDerivedStore } from "./index.js";

const temporaryRoots: string[] = [];
const zeroHash = `sha256:v1:${"0".repeat(64)}` as const;

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-sqlite-"));
  temporaryRoots.push(root);
  return root;
}

function concept(
  id: string,
  statement = `meaning of ${id}`,
  key = `concept:${id}`,
): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "concept",
    id,
    key,
    lifecycle: "active",
    payload: {
      id,
      key,
      kind: "behavior",
      name: id,
      aliases: [],
      statement,
      status: "active",
      sourceClass: "authored",
      confidence: 1,
      tags: [],
      evidence: [],
      discoveryHash: zeroHash,
      semanticHash: zeroHash,
    },
  });
}

function relation(id: string, fromId: string, toId: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "relation",
    id,
    key: `relation:${id}`,
    lifecycle: "active",
    payload: {
      id,
      fromId,
      toId,
      type: "requires",
      sourceClass: "authored",
      confidence: 1,
      evidence: [],
      active: true,
      semanticHash: zeroHash,
    },
  });
}

function requirement(id: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "requirement",
    id,
    key: `requirement:${id}`,
    lifecycle: "active",
    payload: {
      id,
      key: `requirement:${id}`,
      title: id,
      aliases: [],
      statement: `requirement ${id}`,
      status: "active",
      sourceClass: "authored",
      scope: { op: "all", items: [] },
      origin: [],
      evidence: [],
      discoveryHash: zeroHash,
      semanticHash: zeroHash,
    },
  });
}

function scenario(id: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "behavioral-scenario",
    id,
    key: `scenario:${id}`,
    lifecycle: "active",
    payload: {
      id,
      key: `scenario:${id}`,
      title: id,
      aliases: [],
      status: "active",
      sourceClass: "authored",
      scope: { op: "all", items: [] },
      steps: [{ role: "expected-outcome", statement: "it works" }],
      evidence: [],
      discoveryHash: zeroHash,
      semanticHash: zeroHash,
    },
  });
}

function lineage(id: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "lineage",
    id,
    key: `lineage:${id}`,
    lifecycle: "active",
    payload: {
      id,
      kind: "move",
      fromIds: ["concept-a"],
      toIds: ["concept-b"],
      reason: "stable identity moved",
      stateDigest: zeroHash,
    },
  });
}

function tombstone(id: string, entityId: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "tombstone",
    id,
    key: `tombstone:${entityId}`,
    lifecycle: "deleted",
    payload: {
      entityId,
      deletedAtRevision: 7,
      lastSemanticHash: zeroHash,
      replacementIds: [],
      reason: "removed",
    },
  });
}

function rule(id: string): CanonicalDocumentEnvelope {
  return withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "rule",
    id,
    key: `rule:${id}`,
    lifecycle: "active",
    payload: {
      id,
      key: `rule:${id}`,
      version: "1",
      effect: "require",
      authorityClass: "approved-user-intent",
      governanceBasis: [],
      selector: { op: "all", items: [] },
      predicates: [],
      rationale: "governed",
      evidence: [],
      conflictPolicy: "error",
      validatorIds: [],
      transformIds: [],
      semanticHash: zeroHash,
    },
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("SQLite derived canonical index", () => {
  test("rebuilds equivalently after restart and deletion of state.db", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    await canonical.write(concept("concept-b"));
    await canonical.write(relation("relation-a-b", "concept-a", "concept-b"));
    const databasePath = join(root, ".projector", "state.db");

    const initialStore = new SqliteDerivedStore(databasePath);
    const initialResult = await rebuildDerivedStore(canonical, initialStore);
    const initialRows = initialStore.canonicalRows();
    expect(initialResult).toMatchObject({ revision: 1, documentCount: 3 });
    expect(initialStore.relationCount()).toBe(1);
    initialStore.close();

    const restartedStore = new SqliteDerivedStore(databasePath);
    expect(restartedStore.revision()).toEqual(initialResult);
    expect(restartedStore.canonicalRows()).toEqual(initialRows);
    restartedStore.close();

    await rm(databasePath, { force: true });
    await rm(`${databasePath}-wal`, { force: true });
    await rm(`${databasePath}-shm`, { force: true });
    const rebuiltStore = new SqliteDerivedStore(databasePath);
    const rebuiltResult = await rebuildDerivedStore(canonical, rebuiltStore);
    expect(rebuiltResult).toEqual(initialResult);
    expect(rebuiltStore.canonicalRows()).toEqual(initialRows);
    rebuiltStore.close();
  });

  test("indexes one canonical update without reindexing unrelated documents", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a", "before"));
    await canonical.write(concept("concept-b", "unrelated"));
    const databasePath = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(databasePath);
    const initial = await rebuildDerivedStore(canonical, store);

    const updated = concept("concept-a", "after");
    await canonical.write(updated);
    const currentSnapshot = await canonical.snapshot();
    const result = store.applyCanonicalUpdate(updated, currentSnapshot.rootDigest);

    expect(result.revision).toBe(2);
    expect(result.rootDigest).toBe(currentSnapshot.rootDigest);
    expect(result.rootDigest).not.toBe(initial.rootDigest);
    expect(Object.fromEntries(store.canonicalRows().map((row) => [row.id, row.indexedRevision]))).toEqual({
      "concept-a": 2,
      "concept-b": 1,
    });
    expect(store.readCanonicalDocument("concept-a")?.payload.statement).toBe("after");
    store.close();
  });

  test("rejects a bounded update whose claimed canonical root is stale", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a", "before"));
    await canonical.write(concept("concept-b", "unrelated"));
    const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));
    const beforeRevision = await rebuildDerivedStore(canonical, store);
    const beforeRows = store.canonicalRows();
    const updated = concept("concept-a", "after");

    expect(() => store.applyCanonicalUpdate(updated, beforeRevision.rootDigest)).toThrow(/canonical root mismatch/i);
    expect(store.revision()).toEqual(beforeRevision);
    expect(store.canonicalRows()).toEqual(beforeRows);
    store.close();
  });

  test("removes one derived row after a bounded canonical deletion", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    await canonical.write(concept("concept-b"));
    const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));
    await rebuildDerivedStore(canonical, store);
    await canonical.delete("concept", "concept-a");
    const snapshot = await canonical.snapshot();

    const result = store.applyCanonicalDelete("concept-a", snapshot.rootDigest);

    expect(result).toMatchObject({ revision: 2, rootDigest: snapshot.rootDigest, documentCount: 1 });
    expect(store.canonicalRows().map((row) => [row.id, row.indexedRevision])).toEqual([["concept-b", 1]]);
    store.close();
  });

  test("materializes semantic document kinds into their logical query tables", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    await canonical.write(requirement("requirement-a"));
    await canonical.write(scenario("scenario-a"));
    await canonical.write(relation("relation-a", "requirement-a", "scenario-a"));
    await canonical.write(lineage("lineage-a"));
    await canonical.write(tombstone("tombstone-a", "deleted-concept"));
    await canonical.write(rule("rule-a"));
    const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));

    await rebuildDerivedStore(canonical, store);

    expect(store.logicalCounts()).toEqual({
      entities: 1,
      requirements: 1,
      behavioralScenarios: 1,
      relations: 1,
      lineageRecords: 1,
      tombstones: 1,
      governanceDocuments: 1,
    });
    store.close();
  });

  test("rolls back the graph revision when a canonical conflict aborts replacement", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    const original = concept("concept-a");
    await canonical.write(original);
    const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));
    const beforeRevision = await rebuildDerivedStore(canonical, store);
    const beforeRows = store.canonicalRows();
    const conflicting = concept("concept-b", "different entity", original.key);
    const documents = [original, conflicting];
    const entries = documents.map((document) => ({
      entityId: document.id,
      canonicalDocumentHash: document.canonicalDocumentHash,
    }));

    expect(() => store.replaceCanonicalSnapshot({
      documents,
      entries,
      rootDigest: hashRootManifest(entries),
    })).toThrow(/unique constraint/i);
    expect(store.revision()).toEqual(beforeRevision);
    expect(store.canonicalRows()).toEqual(beforeRows);
    store.close();
  });

  test("opens state.db with foreign keys, trusted-schema isolation, and defensive mode", async () => {
    const root = await temporaryRepository();
    const store = new SqliteDerivedStore(join(root, ".projector", "state.db"));

    expect(store.securityPosture()).toEqual({
      foreignKeysEnabled: true,
      trustedSchemaDisabled: true,
      defensiveModeEnabled: true,
      integrity: "ok",
    });
    store.close();
  });

  test.each([
    ["semantic hash column", "UPDATE canonical_documents SET semantic_hash = 'sha256:v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'"],
    ["canonical root", "UPDATE graph_state SET canonical_root_digest = 'sha256:v1:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'"],
  ])("fails closed when state.db has a tampered %s", async (_label, sql) => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    store.close();
    const raw = new DatabaseSync(path);
    raw.exec(sql);
    raw.close();
    expect(() => new SqliteDerivedStore(path)).toThrow(/corrupt|mismatch/i);
  });

  test("rejects a row whose JSON envelope ID differs from the requested database ID", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    store.close();
    const raw = new DatabaseSync(path);
    raw.prepare("UPDATE canonical_documents SET document_json = ? WHERE id = 'concept-a'")
      .run(JSON.stringify(concept("concept-b")));
    raw.close();
    expect(() => new SqliteDerivedStore(path)).toThrow(/requested|column|mismatch/i);
  });

  test("rechecks canonical root consistency when reading from an already-open store", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    const raw = new DatabaseSync(path);
    raw.exec("UPDATE graph_state SET canonical_root_digest = 'sha256:v1:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'");
    raw.close();
    expect(() => store.readCanonicalDocument("concept-a")).toThrow(/root mismatch/i);
    store.close();
  });

  test("assigns distinct monotonic revisions across multiple store connections", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const first = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, first);
    const second = new SqliteDerivedStore(path);
    await canonical.write(concept("concept-a", "revision two"));
    const snapshotTwo = await canonical.snapshot();
    const revisionTwo = first.applyCanonicalUpdate(snapshotTwo.documents[0]!, snapshotTwo.rootDigest);
    await canonical.write(concept("concept-a", "revision three"));
    const snapshotThree = await canonical.snapshot();
    const revisionThree = second.applyCanonicalUpdate(snapshotThree.documents[0]!, snapshotThree.rootDigest);
    expect([revisionTwo.revision, revisionThree.revision]).toEqual([2, 3]);
    first.close();
    second.close();
  });

  test("waits for a concurrent fresh-database migration lock", async () => {
    const root = await temporaryRepository();
    const path = join(root, ".projector", "state.db");
    await mkdir(join(path, ".."), { recursive: true });
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(workerData, { timeout: 5000 });
      db.exec('BEGIN IMMEDIATE');
      parentPort.postMessage('locked');
      setTimeout(() => { db.exec('COMMIT'); db.close(); parentPort.postMessage('done'); }, 75);
    `, { eval: true, workerData: path });
    await new Promise<void>((resolve, reject) => {
      worker.once("message", () => resolve());
      worker.once("error", reject);
    });
    const store = new SqliteDerivedStore(path);
    expect(store.securityPosture().integrity).toBe("ok");
    store.close();
    await worker.terminate();
  });

  test("revision rejects live canonical-root tampering", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    const raw = new DatabaseSync(path);
    raw.exec("UPDATE graph_state SET canonical_root_digest = 'sha256:v1:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'");
    raw.close();
    expect(() => store.revision()).toThrow(/root mismatch/i);
    store.close();
  });

  test("open rejects NULL root after a nonempty revision", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    store.close();
    const raw = new DatabaseSync(path);
    raw.exec("UPDATE graph_state SET canonical_root_digest = NULL");
    raw.close();
    expect(() => new SqliteDerivedStore(path)).toThrow(/NULL canonical root/i);
  });

  test("open and public reads reject a missing graph_state singleton", async () => {
    const root = await temporaryRepository();
    const canonical = new CanonicalFileRepository(root);
    await canonical.write(concept("concept-a"));
    const path = join(root, ".projector", "state.db");
    const store = new SqliteDerivedStore(path);
    await rebuildDerivedStore(canonical, store);
    const raw = new DatabaseSync(path);
    raw.exec("DELETE FROM graph_state");
    raw.close();
    expect(() => store.canonicalRows()).toThrow(/missing graph_state/i);
    store.close();
    expect(() => new SqliteDerivedStore(path)).toThrow(/missing graph_state/i);
  });
});
