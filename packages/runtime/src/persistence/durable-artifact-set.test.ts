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

function strictManifest(bytes: Uint8Array): { manifest: TestManifest; blobs: TestManifest["blobs"] } {
  const parsed: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new TypeError("manifest must be an object");
  const candidate = parsed as Partial<TestManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.blobs)) throw new TypeError("invalid manifest");
  for (const blob of candidate.blobs) {
    if (
      typeof blob !== "object" ||
      blob === null ||
      typeof blob.path !== "string" ||
      typeof blob.sha256 !== "string"
    ) throw new TypeError("invalid blob declaration");
  }
  return { manifest: candidate as TestManifest, blobs: candidate.blobs };
}

async function temporaryStore(): Promise<{ root: string; store: DurableArtifactSetStore<TestManifest> }> {
  const root = await mkdtemp(join(tmpdir(), "projector-artifact-set-"));
  roots.push(root);
  return { root, store: new DurableArtifactSetStore(root, strictManifest) };
}

describe("durable artifact set publication", () => {
  test("publishes a complete exact-byte set atomically", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from([0, 255, 13, 10, 42]);
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "evidence/output.bin", sha256: sha256(blob) }],
    }));

    await store.begin({ artifactSetId: "run-001", manifestBytes });
    await store.stageBlob({ artifactSetId: "run-001", path: "evidence/output.bin", bytes: blob });
    const published = await store.finalize("run-001");

    expect(published).toMatchObject({ status: "published", artifactSetId: "run-001" });
    if (published.status !== "published") throw new Error("expected publication");
    expect(published.manifestBytes).toEqual(manifestBytes);
    expect(published.blobs.get("evidence/output.bin")).toEqual(blob);
    expect(await readFile(join(root, "published", "run-001", "manifest.bin"))).toEqual(manifestBytes);
    await expect(readFile(join(root, "staging", "run-001", "manifest.bin"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("keeps valid staged blobs immutable when a later write has different bytes", async () => {
    const { root, store } = await temporaryStore();
    const original = Buffer.from("original");
    const replacement = Buffer.from("replacement");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "output.txt", sha256: sha256(original) }],
    }));
    await store.begin({ artifactSetId: "immutable", manifestBytes });
    await store.stageBlob({ artifactSetId: "immutable", path: "output.txt", bytes: original });

    await expect(store.stageBlob({ artifactSetId: "immutable", path: "output.txt", bytes: replacement }))
      .rejects.toThrow(/declared SHA-256/i);
    expect(await readFile(join(root, "staging", "immutable", "blobs", "output.txt"))).toEqual(original);
  });

  test("rejects a wrong declared blob hash and reports an unfinished stage as incomplete", async () => {
    const { store } = await temporaryStore();
    const expected = Buffer.from("expected");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "report.txt", sha256: sha256(expected) }],
    }));
    await store.begin({ artifactSetId: "unfinished", manifestBytes });

    expect(await store.read("unfinished")).toEqual({ status: "incomplete", artifactSetId: "unfinished" });
    await expect(store.stageBlob({ artifactSetId: "unfinished", path: "report.txt", bytes: Buffer.from("wrong") }))
      .rejects.toThrow(/declared SHA-256/i);
    await expect(store.finalize("unfinished")).rejects.toMatchObject({
      name: "ArtifactSetIncompleteError",
      missingPaths: ["report.txt"],
    });
  });

  test("rehashes published blobs on every read and distinguishes missing evidence", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from("trusted");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "result.txt", sha256: sha256(blob) }],
    }));
    expect(await store.read("absent")).toEqual({ status: "missing", artifactSetId: "absent" });
    await store.begin({ artifactSetId: "corrupted", manifestBytes });
    await store.stageBlob({ artifactSetId: "corrupted", path: "result.txt", bytes: blob });
    await store.finalize("corrupted");
    await writeFile(join(root, "published", "corrupted", "blobs", "result.txt"), "tampered");

    const result = await store.read("corrupted");
    expect(result).toMatchObject({ status: "integrity-failed", artifactSetId: "corrupted" });
    if (result.status !== "integrity-failed") throw new Error("expected integrity failure");
    expect(result.reason).toMatch(/SHA-256/i);
  });

  test("distinguishes a corrupt staged blob from a genuinely incomplete stage", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from("expected");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "result.txt", sha256: sha256(blob) }],
    }));
    await store.begin({ artifactSetId: "bad-stage", manifestBytes });
    await writeFile(join(root, "staging", "bad-stage", "blobs", "result.txt"), "corrupt");

    const result = await store.read("bad-stage");
    expect(result).toMatchObject({ status: "integrity-failed", artifactSetId: "bad-stage" });
    if (result.status !== "integrity-failed") throw new Error("expected integrity failure");
    expect(result.reason).toMatch(/SHA-256/i);
  });

  test("makes finalize idempotent while preserving the original published bytes", async () => {
    const { store } = await temporaryStore();
    const blob = Buffer.from("once");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "result.txt", sha256: sha256(blob) }],
    }));
    await store.begin({ artifactSetId: "idempotent", manifestBytes });
    await store.stageBlob({ artifactSetId: "idempotent", path: "result.txt", bytes: blob });

    const [first, second] = await Promise.all([store.finalize("idempotent"), store.finalize("idempotent")]);
    expect(second).toEqual(first);
    expect(await store.finalize("idempotent")).toEqual(first);
    await expect(store.begin({ artifactSetId: "idempotent", manifestBytes: Buffer.from("different") }))
      .rejects.toThrow();
  });

  test("runs the strict manifest validator before creating durable directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-artifact-set-"));
    roots.push(root);
    const storageRoot = join(root, "evidence-store");
    const store = new DurableArtifactSetStore(storageRoot, strictManifest);

    await expect(store.begin({ artifactSetId: "invalid", manifestBytes: Buffer.from("[]") }))
      .rejects.toThrow(/invalid manifest/i);
    await expect(readFile(join(storageRoot, "staging", "invalid", "manifest.bin")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  test("resumes an exact prepublication stage without replacing its immutable manifest", async () => {
    const { root, store } = await temporaryStore();
    const first = Buffer.from(JSON.stringify({ version: 1, blobs: [] }));
    const second = Buffer.from(JSON.stringify({ version: 1, blobs: [{ path: "other", sha256: "0".repeat(64) }] }));
    await store.begin({ artifactSetId: "recoverable", manifestBytes: first });

    await store.begin({ artifactSetId: "recoverable", manifestBytes: first });
    await expect(store.begin({ artifactSetId: "recoverable", manifestBytes: second }))
      .rejects.toThrow(/immutable/i);
    expect(await readFile(join(root, "staging", "recoverable", "manifest.bin"))).toEqual(first);
  });

  test("rejects unsafe IDs, paths, symbolic links, and unexpected published entries", async () => {
    const { root, store } = await temporaryStore();
    const blob = Buffer.from("safe");
    const manifestBytes = Buffer.from(JSON.stringify({
      version: 1,
      blobs: [{ path: "nested/result.txt", sha256: sha256(blob) }],
    }));
    await expect(store.begin({ artifactSetId: "../escape", manifestBytes })).rejects.toThrow(/ID/i);
    await store.begin({ artifactSetId: "unsafe-entry", manifestBytes });
    await expect(store.stageBlob({ artifactSetId: "unsafe-entry", path: "../escape", bytes: blob }))
      .rejects.toThrow(/path/i);
    await store.stageBlob({ artifactSetId: "unsafe-entry", path: "nested/result.txt", bytes: blob });
    await store.finalize("unsafe-entry");
    await writeFile(join(root, "published", "unsafe-entry", "extra.txt"), "unexpected");
    expect(await store.read("unsafe-entry")).toMatchObject({ status: "integrity-failed" });

    const symlinkStage = join(root, "staging", "linked");
    await mkdir(symlinkStage);
    await symlink(root, join(symlinkStage, "blobs"), "dir");
    expect(await store.read("linked")).toMatchObject({ status: "integrity-failed" });
  });
});
