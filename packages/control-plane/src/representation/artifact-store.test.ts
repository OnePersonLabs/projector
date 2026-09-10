import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
});
