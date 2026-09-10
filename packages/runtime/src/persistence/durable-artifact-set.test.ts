import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { DurableArtifactSetStore } from "./durable-artifact-set.js";

interface TestManifest {
  version: 1;
  blobs: Array<{ path: string; sha256: string }>;
}

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifest(blobs: Array<{ path: string; bytes: Uint8Array }>): Buffer {
  return Buffer.from(JSON.stringify({
    version: 1,
    blobs: blobs.map(({ path, bytes }) => ({ path, sha256: sha256(bytes) })),
  }));
}

function strictManifest(bytes: Uint8Array): { manifest: TestManifest; blobs: TestManifest["blobs"] } {
  const parsed: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new TypeError("manifest must be an object");
  const candidate = parsed as Partial<TestManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.blobs) || Object.keys(candidate).some((key) => key !== "version" && key !== "blobs")) {
    throw new TypeError("invalid manifest");
  }
  for (const blob of candidate.blobs) {
    if (typeof blob !== "object" || blob === null || Object.keys(blob).some((key) => key !== "path" && key !== "sha256") ||
        typeof blob.path !== "string" || typeof blob.sha256 !== "string") throw new TypeError("invalid blob declaration");
  }
  return { manifest: candidate as TestManifest, blobs: candidate.blobs };
}

async function temporaryStore(storageSuffix?: string): Promise<{ root: string; storageRoot: string; store: DurableArtifactSetStore<TestManifest> }> {
  const root = await mkdtemp(join(tmpdir(), "projector-artifact-set-"));
  roots.push(root);
  const storageRoot = storageSuffix === undefined ? root : join(root, storageSuffix);
  return { root, storageRoot, store: new DurableArtifactSetStore(storageRoot, strictManifest) };
}

describe("durable artifact set publication", () => {
  test("preserves begun and partially staged attempts as incomplete across store instances", async () => {
    const { storageRoot, store } = await temporaryStore();
    await store.begin({ artifactSetId: "begun" });
    expect(await store.read("begun")).toEqual({ status: "incomplete", artifactSetId: "begun" });

    await store.stageBlob({ artifactSetId: "begun", path: "evidence/partial.bin", bytes: Buffer.from([0, 255]) });
    const reopened = new DurableArtifactSetStore(storageRoot, strictManifest);
    expect(await reopened.read("begun")).toEqual({ status: "incomplete", artifactSetId: "begun" });
  });

  test("publishes exact manifest and blob bytes only after successful final validation", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from([0, 255, 13, 10, 42]);
    const manifestBytes = manifest([{ path: "evidence/output.bin", bytes: blob }]);
    await store.begin({ artifactSetId: "run-001" });
    await store.stageBlob({ artifactSetId: "run-001", path: "evidence/output.bin", bytes: blob });

    const published = await store.finalize({ artifactSetId: "run-001", manifestBytes });

    expect(published).toMatchObject({ status: "published", artifactSetId: "run-001" });
    expect(published.manifestBytes).toEqual(manifestBytes);
    expect(published.blobs.get("evidence/output.bin")).toEqual(blob);
    expect(await readFile(join(root, "published", "run-001", "manifest.bin"))).toEqual(manifestBytes);
    await expect(readFile(join(root, "staging", "run-001", "blobs", "evidence", "output.bin")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("refuses manifests with undeclared staged blobs or missing declared blobs and preserves staging", async () => {
    const { root, store } = await temporaryStore();
    const staged = Buffer.from("staged");
    await store.begin({ artifactSetId: "set-mismatch" });
    await store.stageBlob({ artifactSetId: "set-mismatch", path: "actual.txt", bytes: staged });

    await expect(store.finalize({
      artifactSetId: "set-mismatch",
      manifestBytes: manifest([{ path: "declared.txt", bytes: staged }]),
    })).rejects.toThrow(/missing.*declared\.txt.*undeclared.*actual\.txt/i);
    expect(await store.read("set-mismatch")).toEqual({ status: "incomplete", artifactSetId: "set-mismatch" });
    expect(await readFile(join(root, "staging", "set-mismatch", "blobs", "actual.txt"))).toEqual(staged);
  });

  test("refuses a declared hash mismatch without publishing or replacing the staged blob", async () => {
    const { root, store } = await temporaryStore();
    const staged = Buffer.from("actual");
    await store.begin({ artifactSetId: "hash-mismatch" });
    await store.stageBlob({ artifactSetId: "hash-mismatch", path: "result.txt", bytes: staged });

    await expect(store.finalize({
      artifactSetId: "hash-mismatch",
      manifestBytes: manifest([{ path: "result.txt", bytes: Buffer.from("expected") }]),
    })).rejects.toThrow(/SHA-256/i);
    expect(await readFile(join(root, "staging", "hash-mismatch", "blobs", "result.txt"))).toEqual(staged);
    expect(await store.read("hash-mismatch")).toEqual({ status: "incomplete", artifactSetId: "hash-mismatch" });
  });

  test("keeps staged blobs immutable and makes exact repeated staging idempotent", async () => {
    const { root, store } = await temporaryStore();
    await store.begin({ artifactSetId: "immutable" });
    await store.stageBlob({ artifactSetId: "immutable", path: "output.txt", bytes: Buffer.from("original") });

    await store.stageBlob({ artifactSetId: "immutable", path: "output.txt", bytes: Buffer.from("original") });
    await expect(store.stageBlob({ artifactSetId: "immutable", path: "output.txt", bytes: Buffer.from("replacement") }))
      .rejects.toThrow(/immutable/i);
    expect(await readFile(join(root, "staging", "immutable", "blobs", "output.txt"))).toEqual(Buffer.from("original"));
  });

  test("validates the manifest at finalize before changing durable staged state", async () => {
    const { root, store } = await temporaryStore();
    await store.begin({ artifactSetId: "invalid-manifest" });

    await expect(store.finalize({ artifactSetId: "invalid-manifest", manifestBytes: Buffer.from("[]") }))
      .rejects.toThrow(/manifest must be an object/i);
    await expect(readFile(join(root, "staging", "invalid-manifest", "manifest.bin")))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(await store.read("invalid-manifest")).toEqual({ status: "incomplete", artifactSetId: "invalid-manifest" });
  });

  test("durably creates a nested storage layout and nested blob parents", async () => {
    const { storageRoot, store } = await temporaryStore("deep/evidence/store");
    const blob = Buffer.from("nested");
    await store.begin({ artifactSetId: "nested-layout" });
    await store.stageBlob({ artifactSetId: "nested-layout", path: "a/b/c/result.txt", bytes: blob });

    const reopened = new DurableArtifactSetStore(storageRoot, strictManifest);
    const published = await reopened.finalize({
      artifactSetId: "nested-layout",
      manifestBytes: manifest([{ path: "a/b/c/result.txt", bytes: blob }]),
    });
    expect(published.blobs.get("a/b/c/result.txt")).toEqual(blob);
  });

  test("recovers an interrupted finalization whose exact manifest was made durable before publication", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from("recoverable");
    const manifestBytes = manifest([{ path: "result.txt", bytes: blob }]);
    await store.begin({ artifactSetId: "resume-finalize" });
    await store.stageBlob({ artifactSetId: "resume-finalize", path: "result.txt", bytes: blob });
    await writeFile(join(root, "staging", "resume-finalize", "manifest.bin"), manifestBytes);

    expect(await store.read("resume-finalize")).toEqual({ status: "incomplete", artifactSetId: "resume-finalize" });
    const published = await store.finalize({ artifactSetId: "resume-finalize", manifestBytes });
    expect(published.blobs.get("result.txt")).toEqual(blob);
  });

  test("preserves published evidence, rehashes reads, and rejects unsafe filesystem entries", async () => {
    const { root, store } = await temporaryStore();
    expect(await store.read("absent")).toEqual({ status: "missing", artifactSetId: "absent" });
    const blob = Buffer.from("trusted");
    const manifestBytes = manifest([{ path: "result.txt", bytes: blob }]);
    await store.begin({ artifactSetId: "published" });
    await store.stageBlob({ artifactSetId: "published", path: "result.txt", bytes: blob });
    const first = await store.finalize({ artifactSetId: "published", manifestBytes });
    expect(await store.finalize({ artifactSetId: "published", manifestBytes })).toEqual(first);
    await expect(store.finalize({ artifactSetId: "published", manifestBytes: manifest([]) }))
      .rejects.toThrow(/different manifest/i);
    await writeFile(join(root, "published", "published", "blobs", "result.txt"), "tampered");
    expect(await store.read("published")).toMatchObject({ status: "integrity-failed" });

    await expect(store.begin({ artifactSetId: "../escape" })).rejects.toThrow(/ID/i);
    const linked = join(root, "staging", "linked");
    await mkdir(linked);
    await symlink(root, join(linked, "blobs"), "dir");
    expect(await store.read("linked")).toMatchObject({ status: "integrity-failed" });
  });
});
