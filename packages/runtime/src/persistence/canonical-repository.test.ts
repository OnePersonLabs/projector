import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withCanonicalHashes, type CanonicalDocumentEnvelope } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import { CanonicalFileRepository } from "./canonical-repository.js";
import { parseTomlDocument, stringifyTomlDocument } from "./toml-codec.js";

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
  test("writes readable TOML paths with a document-relative bundled schema directive", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);

    const path = await repository.write(concept("concept:durable-meaning", "Readable meaning."));
    const source = await readFile(path, "utf8");

    expect(path.replaceAll("\\", "/")).toMatch(/\/model\/concepts\/concept-durable-meaning--[a-f0-9]{64}\.concept\.toml$/u);
    expect(source).toMatch(/^#:schema \.\.\/\.\.\/schemas\/canonical-document-v2\.schema\.json\n/u);
    expect(source).toContain('statement = "Readable meaning."');
  });

  test("keeps canonical currentness stable across comments and presentation whitespace", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = await repository.write(concept("concept:durable-meaning", "Readable meaning."));
    const before = await repository.snapshot();
    const source = await readFile(path, "utf8");

    await writeFile(path, `# local explanation\n${source.replace('lifecycle = "active"', 'lifecycle="active"')}`, "utf8");

    expect((await repository.snapshot()).rootDigest).toBe(before.rootDigest);
  });

  test("prepares the exact canonical bytes later published by the repository", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const document = concept("concept:planned-write", "Exact reviewed bytes.");

    const prepared = repository.prepareWrite(document);
    const publishedPath = await repository.write(document);

    expect(prepared.path).toBe(publishedPath);
    expect(await readFile(publishedPath, "utf8")).toBe(prepared.contents);
  });

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
    await rename(originalPath, join(movedDirectory, "arbitrary.concept.toml"));

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
    await writeFile(targetPath, stringifyTomlDocument(concept("concept-b", "protected") as unknown as Record<string, unknown>), "utf8");
    await expect(repository.write(concept("concept-a", "overwrite"))).rejects.toThrow(/owned by concept-b/);
    await expect(repository.delete("concept", "concept-a")).rejects.toThrow(/owned by concept-b/);
    expect((parseTomlDocument(await readFile(targetPath, "utf8")) as { id: string }).id).toBe("concept-b");
  });

  test("rejects a legacy JSON layout instead of keeping a permanent compatibility reader", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const legacyPath = join(root, ".projector", "model", "concepts", "legacy.concept.json");
    await mkdir(join(legacyPath, ".."), { recursive: true });
    await writeFile(legacyPath, `${JSON.stringify(concept("legacy", "old"))}\n`, "utf8");

    await expect(repository.snapshot()).rejects.toThrow(/legacy or mixed canonical JSON requires project readiness migration/i);
  });

  test("rejects duplicate stable IDs even when files use different paths", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const canonicalPath = await repository.write(concept("concept-a", "authoritative"));
    const duplicateDirectory = join(root, ".projector", "model", "concepts", "custom-shard");
    await mkdir(duplicateDirectory, { recursive: true });
    await writeFile(
      join(duplicateDirectory, "duplicate.concept.toml"),
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
    const corrupted = (await readFile(path, "utf8")).replace('lifecycle = "active"', 'lifecycle = "deprecated"');
    await writeFile(path, corrupted, "utf8");

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

  test("round-trips standalone Exception and Migration governance documents through canonical rebuild", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const exception = withCanonicalHashes({
      apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "exception", id: "exception:one", key: "exception:one", lifecycle: "active",
      payload: { id: "exception:one", key: "exception:one", selector: { op: "atom", field: "lens", matcher: "equals", value: "lens:old" }, exceptedRuleIds: ["rule:one"], exceptedLensIds: ["lens:old"], exceptedExpectationIds: ["expectation:one"], rationale: "Bounded compatibility exception", evidence: [], owner: "team:architecture", reviewOrExpiryTrigger: { type: "date", at: "2027-01-01" }, invalidationConditions: [{ type: "lens-changed", lensId: "lens:old" }], exitCriteria: ["migration complete"], status: "active", semanticHash: zeroHash },
    });
    const migration = withCanonicalHashes({
      apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "migration", id: "migration:one", key: "migration:one", lifecycle: "active",
      payload: { id: "migration:one", key: "migration:one", sourceLensRef: { lensId: "lens:old", version: "1", semanticHash: zeroHash }, targetLensRef: { lensId: "lens:new", version: "2", semanticHash: zeroHash }, phase: "dual-running", entryCriteria: ["shadow validated"], exitCriteria: ["cutover validated"], compatibilityStrategy: "dual write", allowedTemporaryDivergenceIds: ["divergence:one"], generatedOutputOverlays: ["generated/compat"], validationObligations: ["compare both projections"], rollbackPlan: "restore source lens", compensationPlan: "remove target output", cleanupResidueDetector: "no source-lens projections remain", semanticHash: zeroHash },
    });
    await repository.write(exception);
    await repository.write(migration);
    const before = await repository.snapshot();
    const rebuilt = new CanonicalFileRepository(root);
    const after = await rebuilt.snapshot();
    expect(after.documents.map(({ kind, id }) => `${kind}:${id}`)).toEqual(["exception:exception:one", "migration:migration:one"]);
    expect(after.rootDigest).toBe(before.rootDigest);
  });

  test("accepts the strict project activation config without treating it as an entity envelope", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await mkdir(join(root, ".projector"), { recursive: true });
    await writeFile(join(root, ".projector", "config.toml"), 'apiVersion = "projector.config/v1"\nenabled = true\n');

    expect((await repository.snapshot()).documents).toEqual([]);
  });

  test("fails closed for malformed project activation config", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    await mkdir(join(root, ".projector"), { recursive: true });
    await writeFile(join(root, ".projector", "config.toml"), "enabled = true\n");

    await expect(repository.snapshot()).rejects.toThrow(/invalid Projector config/iu);
  });

  test("rejects canonical-looking files outside their approved family", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = join(root, ".projector", "model", "relations", "wrong.concept.toml");
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, stringifyTomlDocument(concept("concept-a", "hidden") as unknown as Record<string, unknown>), "utf8");
    await expect(repository.snapshot()).rejects.toThrow(/outside approved canonical family/i);
  });

  test("does not hide canonical-looking files inside a derived directory", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const path = join(root, ".projector", "generated", "hidden.concept.toml");
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, stringifyTomlDocument(concept("concept-a", "hidden") as unknown as Record<string, unknown>), "utf8");
    await expect(repository.snapshot()).rejects.toThrow(/outside approved canonical family/i);
  });

  test("excludes authenticated operational journals and receipts from canonical rebuild input", async () => {
    const root = await temporaryRepository(); const repository = new CanonicalFileRepository(root); await repository.write(concept("concept-a", "owned"));
    const journal = join(root, ".projector", "runtime", "journal", "operation.json"); const receipt = join(root, ".projector", "receipts", "content-addressed.json");
    await mkdir(join(journal, ".."), { recursive: true }); await mkdir(join(receipt, ".."), { recursive: true }); await writeFile(journal, JSON.stringify({ phase: "committed" })); await writeFile(receipt, JSON.stringify({ status: "success" }));
    for (const namespace of ["task17-sessions", "task17-capabilities", "task18-upgrades"]) { const artifact = join(root, ".projector", namespace, "lifecycle.json"); await mkdir(join(artifact, ".."), { recursive: true }); await writeFile(artifact, JSON.stringify({ version: 1, status: "active" })); }
    expect((await repository.snapshot()).documents.map(({ id }) => id)).toEqual(["concept-a"]);
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

  test("reports legacy residue after deleting a current TOML document", async () => {
    const root = await temporaryRepository();
    const repository = new CanonicalFileRepository(root);
    const document = concept("residue", "same owner");
    await repository.write(document);
    const legacy = join(root, ".projector", "model", "concepts", "residue.concept.json");
    await writeFile(legacy, `${JSON.stringify(document)}\n`);
    expect(await repository.delete("concept", "residue")).toBe(true);
    await expect(repository.snapshot()).rejects.toThrow(/legacy or mixed canonical JSON requires project readiness migration/i);
  });
});
