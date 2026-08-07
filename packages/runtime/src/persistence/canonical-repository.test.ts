import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
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
    const movedDirectory = join(firstRoot, ".projector", "model", "concepts", "custom-shard");
    await mkdir(movedDirectory, { recursive: true });
    await rename(originalPath, join(movedDirectory, "arbitrary.concept.json"));

    const firstSnapshot = await firstRepository.snapshot();
    const secondSnapshot = await secondRepository.snapshot();

    expect(firstSnapshot.rootDigest).toBe(secondSnapshot.rootDigest);
    expect(firstSnapshot.documents.map((document) => document.id)).toEqual(["concept-a", "concept-b"]);
  });

  test("uses case-insensitive collision-safe paths for stable IDs", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const upperPath = await repository.write(concept("Foo", "upper"));
    const lowerPath = await repository.write(concept("foo", "lower"));
    expect(upperPath.toLowerCase()).not.toBe(lowerPath.toLowerCase());
    expect((await repository.read("concept", "Foo"))?.payload.statement).toBe("upper");
    expect((await repository.read("concept", "foo"))?.payload.statement).toBe("lower");
  });

  test("refuses to overwrite or delete a path owned by another envelope ID", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const targetPath = repository.pathFor("concept", "concept-a");
    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, `${JSON.stringify(concept("concept-b", "protected"))}\n`, "utf8");
    await expect(repository.write(concept("concept-a", "overwrite"))).rejects.toThrow(/owned by concept-b/);
    await expect(repository.delete("concept", "concept-a")).rejects.toThrow(/owned by concept-b/);
    expect(JSON.parse(await readFile(targetPath, "utf8")).id).toBe("concept-b");
  });

  test("reads a legacy encoded-ID path and migrates it on the next write", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const legacyPath = join(root, ".projector", "model", "concepts", "legacy.concept.json");
    await mkdir(join(legacyPath, ".."), { recursive: true });
    await writeFile(legacyPath, `${JSON.stringify(concept("legacy", "old"))}\n`, "utf8");
    expect((await repository.read("concept", "legacy"))?.payload.statement).toBe("old");
    const newPath = await repository.write(concept("legacy", "new"));
    expect(newPath).not.toBe(legacyPath);
    await expect(readFile(legacyPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await repository.read("concept", "legacy"))?.payload.statement).toBe("new");
  });

  test("rejects duplicate stable IDs even when files use different paths", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const canonicalPath = await repository.write(concept("concept-a", "authoritative"));
    const duplicateDirectory = join(root, ".projector", "model", "concepts", "custom-shard");
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

  test("rejects canonical-looking files outside their approved family", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = join(root, ".projector", "model", "relations", "wrong.concept.json");
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(concept("concept-a", "hidden"))}\n`, "utf8");
    await expect(repository.snapshot()).rejects.toThrow(/outside approved canonical family/i);
  });

  test("does not hide canonical-looking files inside a derived directory", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = join(root, ".projector", "generated", "hidden.concept.json");
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(concept("concept-a", "hidden"))}\n`, "utf8");
    await expect(repository.snapshot()).rejects.toThrow(/outside approved canonical family/i);
  });

  test("rejects symlinked canonical entries instead of hiding them from rebuild", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const target = join(root, "target.json");
    await writeFile(target, `${JSON.stringify(concept("concept-a", "linked"))}\n`, "utf8");
    const link = join(root, ".projector", "model", "concepts", "linked.concept.json");
    await mkdir(join(link, ".."), { recursive: true });
    await symlink(target, link);
    await expect(repository.snapshot()).rejects.toThrow(/symlink.*canonical/i);
  });

  test("rejects a symlinked canonical shard directory", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const target = join(root, "external-shard");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "hidden.concept.json"), `${JSON.stringify(concept("concept-a", "linked"))}\n`);
    const link = join(root, ".projector", "model", "concepts", "shard");
    await mkdir(join(link, ".."), { recursive: true });
    await symlink(target, link, "dir");
    await expect(repository.snapshot()).rejects.toThrow(/symlink.*canonical/i);
  });

  test("rejects direct reads through a symlinked canonical file", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const external = join(root, "external.json");
    await writeFile(external, `${JSON.stringify(concept("concept-a", "external"))}\n`);
    const path = repository.pathFor("concept", "concept-a");
    await mkdir(join(path, ".."), { recursive: true });
    await symlink(external, path);
    await expect(repository.read("concept", "concept-a")).rejects.toThrow(/symlink/i);
  });

  test("rejects writes through a symlinked canonical root or ancestor", async () => {
    for (const ancestor of [".projector", join(".projector", "model", "concepts")]) {
      const root = await temporaryRepository();
      const repository = new CanonicalFileRepository(root);
      const external = join(root, "external-directory");
      await mkdir(external, { recursive: true });
      const link = join(root, ancestor);
      await mkdir(join(link, ".."), { recursive: true });
      await symlink(external, link, "dir");
      await expect(repository.write(concept("concept-a", "unsafe"))).rejects.toThrow(/symlink/i);
    }
  });

  test("deletes matching hashed and legacy files left by an interrupted migration", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const document = concept("residue", "same owner");
    await repository.write(document);
    const legacy = join(root, ".projector", "model", "concepts", "residue.concept.json");
    await writeFile(legacy, `${JSON.stringify(document)}\n`);
    expect(await repository.delete("concept", "residue")).toBe(true);
    expect((await repository.snapshot()).documents).toEqual([]);
  });
});
