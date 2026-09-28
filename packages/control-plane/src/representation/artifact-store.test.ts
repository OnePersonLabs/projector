import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type RepresentationProjectionRef } from "@projector/core";
import { RepresentationCompiler, createStateBinding, type CanonicalRepresentationSource } from "@projector/engine";
import { afterEach, describe, expect, it } from "vitest";

import { RepositoryRepresentationArtifactStore } from "./artifact-store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function state() {
  return {
    gitBase: "a".repeat(40),
    worktreeDigest: hashFramedDomain("fixture", "worktree"),
    canonicalProjectorDigest: hashFramedDomain("fixture", "canonical"),
    toolchainDigest: hashFramedDomain("fixture", "toolchain"),
  };
}

function source(): CanonicalRepresentationSource {
  const body = {
    sourceEntityIds: ["requirement:fixture"],
    statements: [{
      id: "requirement:fixture",
      text: "Inspect the exact bounded representation.",
      normativeForce: "require" as const,
      negated: false,
      scope: ["packages/fixture"],
      exceptions: [],
      dependencies: [],
      conceptIds: ["concept:fixture"],
      protectedLiterals: ["requirement:fixture"],
    }],
    scenarios: [],
  };
  return { ...body, sourceSemanticHash: hashFramedDomain("canonical-representation-source", body) };
}

function reference(projection: Awaited<ReturnType<RepresentationCompiler["compile"]>>["projection"]): RepresentationProjectionRef {
  return {
    projectionId: projection.id,
    profileId: projection.profileId,
    profileVersion: projection.profileVersion,
    contentHash: projection.contentHash,
    preservationHash: projection.preservation.semanticHash,
  };
}

describe("RepositoryRepresentationArtifactStore", () => {
  it("accepts concurrent exact content publication without overwriting either writer", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const content = "concurrent exact content";
    const contentHash = hashFramedDomain("representation-artifact", content);
    let release!: () => void;
    let staged!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const staging = new Promise<void>((resolve) => { staged = resolve; });
    const first = await RepositoryRepresentationArtifactStore.create(root, { afterStage: async () => { staged(); await released; } });
    const second = await RepositoryRepresentationArtifactStore.create(root);
    const firstWrite = first.put(contentHash, content);
    await staging;
    await second.put(contentHash, content);
    release();
    await firstWrite;
    await expect(first.get(contentHash)).resolves.toBe(content);
  });
  it("inspects an interrupted production publication without recovery and explicitly recovers exact bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const content = "exact durable representation\n";
    const contentHash = hashFramedDomain("representation-artifact", content);
    const store = await RepositoryRepresentationArtifactStore.create(root, {
      afterStage: () => { throw new Error("interrupted publication"); },
    });
    await expect(store.put(contentHash, content)).rejects.toThrow("interrupted publication");
    const reopened = await RepositoryRepresentationArtifactStore.create(root);
    await expect(reopened.get(contentHash)).resolves.toBeUndefined();
    expect(await reopened.pending()).toHaveLength(1);
    await expect(reopened.recover()).resolves.toEqual([expect.objectContaining({ status: "recovered" })]);
    await expect(reopened.get(contentHash)).resolves.toBe(content);
    expect(await reopened.pending()).toHaveLength(0);
  });

  it("retains a change association until capture acknowledges a published projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const store = await RepositoryRepresentationArtifactStore.create(root);
    const compiler = new RepresentationCompiler({ artifacts: store });
    const { projection } = await compiler.compile({ source: source(), binding: createStateBinding({ compiledAgainst: state(), valueDependencies: [], queryDependencies: [] }), profileKey: "human-technical@1" });
    await store.publish(projection, "change:interrupted-capture");
    const reopened = await RepositoryRepresentationArtifactStore.create(root);
    expect(await reopened.pending()).toEqual([expect.objectContaining({ semanticChangeId: "change:interrupted-capture", projectionId: projection.id })]);
    await reopened.recover();
    await expect(reopened.read(reference(projection))).resolves.toMatchObject({ projection: { id: projection.id } });
    expect(await reopened.pending()).toHaveLength(1);
    await reopened.acknowledgeCapture("change:interrupted-capture");
    expect(await reopened.pending()).toHaveLength(0);
  });

  it("recovers finalizing content and reports staging without a manifest as recovery-required", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const content = "recover finalizing bytes";
    const contentHash = hashFramedDomain("representation-artifact", content);
    const store = await RepositoryRepresentationArtifactStore.create(root, { afterStage: () => { throw new Error("crash"); } });
    await expect(store.put(contentHash, content)).rejects.toThrow("crash");
    const [publication] = await store.pending();
    const journalRoot = join(root, ".projector/runtime/representation-publication");
    await rename(join(journalRoot, "published", publication!.publicationId), join(journalRoot, "finalizing", publication!.publicationId));
    const incompleteId = "a".repeat(64);
    await mkdir(join(journalRoot, "staging", incompleteId, "blobs"), { recursive: true });
    const reopened = await RepositoryRepresentationArtifactStore.create(root);
    await expect(reopened.get(contentHash)).resolves.toBeUndefined();
    expect(await reopened.pending()).toEqual(expect.arrayContaining([expect.objectContaining({ publicationId: publication!.publicationId, status: "incomplete" })]));
    expect(await reopened.recover()).toEqual(expect.arrayContaining([
      expect.objectContaining({ publicationId: publication!.publicationId, status: "recovered" }),
      expect.objectContaining({ publicationId: incompleteId, status: "recovery-required", reason: expect.stringContaining("incomplete") }),
    ]));
    await expect(reopened.get(contentHash)).resolves.toBe(content);
  });

  it("preserves conflicting final bytes and reports recovery-required", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const content = "authenticated original";
    const contentHash = hashFramedDomain("representation-artifact", content);
    const store = await RepositoryRepresentationArtifactStore.create(root, { afterStage: () => { throw new Error("crash"); } });
    await expect(store.put(contentHash, content)).rejects.toThrow("crash");
    const contentRoot = join(root, ".projector/runtime/representations/content");
    await mkdir(contentRoot, { recursive: true });
    const finalPath = join(contentRoot, `${contentHash.slice("sha256:v1:".length)}.txt`);
    await writeFile(finalPath, "partial historical write");
    expect(await store.recover()).toEqual([expect.objectContaining({ status: "recovery-required", reason: expect.stringContaining("conflicting") })]);
    expect(await readFile(finalPath, "utf8")).toBe("partial historical write");
    expect(await store.pending()).toHaveLength(1);
  });
  it("reopens exact rendered bytes and compiler fidelity evidence after process-local state is gone", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const store = await RepositoryRepresentationArtifactStore.create(root);
    const compiler = new RepresentationCompiler({ artifacts: store });
    const { projection } = await compiler.compile({ source: source(), binding: createStateBinding({ compiledAgainst: state(), valueDependencies: [], queryDependencies: [] }), profileKey: "human-technical@1" });
    await store.publish(projection);

    const reopened = await RepositoryRepresentationArtifactStore.create(root);
    await expect(reopened.read(reference(projection))).resolves.toMatchObject({
      content: expect.stringContaining("Inspect the exact bounded representation"),
      projection: { id: projection.id, preservation: { protectedDimensions: expect.arrayContaining(["normative-force", "negation", "scope"]) } },
      recordHash: expect.stringMatching(/^sha256:v1:/u),
    });
  });

  it("refuses content changed after publication", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const store = await RepositoryRepresentationArtifactStore.create(root);
    const compiler = new RepresentationCompiler({ artifacts: store });
    const { projection } = await compiler.compile({ source: source(), binding: createStateBinding({ compiledAgainst: state(), valueDependencies: [], queryDependencies: [] }), profileKey: "human-technical@1" });
    await store.publish(projection);
    await writeFile(join(root, ".projector/runtime/representations/content", `${projection.contentHash.slice("sha256:v1:".length)}.txt`), "tampered");

    await expect(store.read(reference(projection))).rejects.toThrow(/content.*invalid/iu);
  });

  it("refuses a projection record whose authenticated body changed", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-representation-")); roots.push(root);
    await mkdir(join(root, ".projector"));
    const store = await RepositoryRepresentationArtifactStore.create(root);
    const compiler = new RepresentationCompiler({ artifacts: store });
    const { projection } = await compiler.compile({ source: source(), binding: createStateBinding({ compiledAgainst: state(), valueDependencies: [], queryDependencies: [] }), profileKey: "human-technical@1" });
    await store.publish(projection);
    const recordPath = join(root, ".projector/runtime/representations/projections", `${hashFramedDomain("representation-projection-path", projection.id).slice("sha256:v1:".length)}.json`);
    const record = JSON.parse(await readFile(recordPath, "utf8")) as { projection: { profileVersion: string } };
    record.projection.profileVersion = `${record.projection.profileVersion}-tampered`;
    await writeFile(recordPath, JSON.stringify(record));

    await expect(store.read(reference(projection))).rejects.toThrow(/record hash/iu);
  });
});
