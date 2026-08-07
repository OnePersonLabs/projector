import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import { CanonicalFileRepository } from "./canonical-repository.js";

const temporaryRoots: string[] = [];
const zeroHash = `sha256:v1:${"0".repeat(64)}` as const;

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-canonical-"));
  temporaryRoots.push(root);
  return root;
}

function concept(id: string, statement: string, key = `concept:${id}`): CanonicalDocumentEnvelope {
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

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CanonicalFileRepository", () => {
  test("updates one canonical entity without rewriting an unrelated entity", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const first = concept("concept-a", "first version");
    const unrelated = concept("concept-b", "unchanged");

    await repository.write(first);
    const unrelatedPath = await repository.write(unrelated);
    const unrelatedBefore = await readFile(unrelatedPath, "utf8");
    const unrelatedStatBefore = await stat(unrelatedPath);

    await repository.write(concept("concept-a", "second version"));

    expect((await repository.read("concept", "concept-a"))?.payload.statement).toBe("second version");
    expect(await readFile(unrelatedPath, "utf8")).toBe(unrelatedBefore);
    expect((await stat(unrelatedPath)).ino).toBe(unrelatedStatBefore.ino);
  });

  test("deletes one canonical entity without touching an unrelated file", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await repository.write(concept("concept-a", "remove me"));
    const unrelatedPath = await repository.write(concept("concept-b", "keep me"));
    const before = await repository.snapshot();
    const unrelatedStatBefore = await stat(unrelatedPath);

    expect(await repository.delete("concept", "concept-a")).toBe(true);

    const after = await repository.snapshot();
    expect(after.documents.map((document) => document.id)).toEqual(["concept-b"]);
    expect(after.rootDigest).not.toBe(before.rootDigest);
    expect((await stat(unrelatedPath)).ino).toBe(unrelatedStatBefore.ino);
  });

  test("derives the same root from document identity regardless of write order or storage path", async () => {
    const firstRoot = await temporaryRepository();
    const secondRoot = await temporaryRepository();
    const firstRepository = new CanonicalFileRepository(firstRoot);
    const secondRepository = new CanonicalFileRepository(secondRoot);
    const a = concept("concept-a", "a");
    const b = concept("concept-b", "b");
    const originalPath = await firstRepository.write(a);
    await firstRepository.write(b);
    await secondRepository.write(b);
    await secondRepository.write(a);
    const movedDirectory = join(firstRoot, ".projector", "model", "custom-shard");
    await mkdir(movedDirectory, { recursive: true });
    await rename(originalPath, join(movedDirectory, "arbitrary.concept.json"));

    const firstSnapshot = await firstRepository.snapshot();
    const secondSnapshot = await secondRepository.snapshot();

    expect(firstSnapshot.rootDigest).toBe(secondSnapshot.rootDigest);
    expect(firstSnapshot.documents.map((document) => document.id)).toEqual(["concept-a", "concept-b"]);
  });

  test("rejects duplicate stable IDs even when files use different paths", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const canonicalPath = await repository.write(concept("concept-a", "authoritative"));
    const duplicateDirectory = join(root, ".projector", "model", "custom-shard");
    await mkdir(duplicateDirectory, { recursive: true });
    await writeFile(
      join(duplicateDirectory, "duplicate.concept.json"),
      await readFile(canonicalPath, "utf8"),
      "utf8",
    );

    await expect(repository.snapshot()).rejects.toThrow(/duplicate canonical root entity ID: concept-a/);
  });

  test("rejects conflicting canonical keys owned by different stable IDs", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await repository.write(concept("concept-a", "a", "shared-key"));
    await repository.write(concept("concept-b", "b", "shared-key"));

    await expect(repository.snapshot()).rejects.toThrow(/duplicate canonical key shared-key/);
  });

  test("rejects a canonical file whose exact document hash was corrupted", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = await repository.write(concept("concept-a", "original"));
    const corrupted = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    corrupted.lifecycle = "deprecated";
    await writeFile(path, JSON.stringify(corrupted), "utf8");

    await expect(repository.snapshot()).rejects.toThrow(/canonical document hash mismatch/);
  });

  test.each([
    ["apiVersion", "projector/v3"],
    ["schemaVersion", "3.0.0"],
  ])("rejects an unsupported canonical %s", async (field, value) => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const valid = concept("concept-a", "meaning");
    const unsupported = withCanonicalHashes({
      apiVersion: field === "apiVersion" ? value : valid.apiVersion,
      schemaVersion: field === "schemaVersion" ? value : valid.schemaVersion,
      kind: valid.kind,
      id: valid.id,
      key: valid.key,
      lifecycle: valid.lifecycle,
      payload: valid.payload,
    });

    await expect(repository.write(unsupported)).rejects.toThrow(new RegExp(`unsupported canonical ${field}`, "i"));
  });

  test.each([
    ["Config", ["config.json"]],
    ["Exception", ["exceptions", "unsafe.exception.json"]],
    ["Migration", ["migrations", "future.migration.json"]],
  ])("fails closed for unsupported %s canonical files", async (kind, pathParts) => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = join(root, ".projector", ...pathParts);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, "{}\n", "utf8");

    await expect(repository.snapshot()).rejects.toThrow(new RegExp(`unsupported canonical ${kind} kind`, "i"));
  });
});
