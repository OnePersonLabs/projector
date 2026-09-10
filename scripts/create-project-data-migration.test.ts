import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { canonicalJson, type ProjectDataMigrationDraft } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
} from "../packages/control-plane/src/readiness/project-data-format-owner.js";
import { createProjectDataMigrationFile } from "./create-project-data-migration.mjs";
import { inventoryCandidateFiles } from "./release-candidate.mjs";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("create-project-data-migration", () => {
  test("seals one immutable manifest from a canonical net draft and authenticated candidate", async () => {
    const fixture = await authoringFixture();
    const result = await createProjectDataMigrationFile(fixture.input);
    expect(result.manifest).toMatchObject({ kind: "no-data-change", fromVersion: "2.0.0", toVersion: "2.1.0" });
    const bytes = await readFile(fixture.input.outputPath, "utf8");
    expect(bytes).toBe(`${canonicalJson(result.manifest)}\n`);
    await expect(createProjectDataMigrationFile(fixture.input)).resolves.toEqual(result);
    await writeFile(fixture.input.outputPath, "different\n");
    await expect(createProjectDataMigrationFile(fixture.input)).rejects.toThrow(/refusing to replace/iu);
  });

  test("rejects a stale self-consistent target after candidate owner bytes change", async () => {
    const fixture = await authoringFixture();
    const ownerPath = canonicalOwnerModulePaths[0]!;
    await writeFile(join(fixture.candidateRoot, ...ownerPath.split("/")), "changed-owner\n");
    await publishCandidateManifest(fixture.candidateRoot);
    await expect(createProjectDataMigrationFile(fixture.input)).rejects.toThrow(/candidate format.*target snapshot/iu);
  });
});

async function authoringFixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-migration-authoring-"));
  roots.push(root);
  const candidateRoot = join(root, "release-candidate");
  const paths = new Set([
    ...preparedConfigOwnerModulePaths,
    ...canonicalOwnerModulePaths,
    ...runtimeEvidenceOwnerModulePaths,
    "artifacts/onepersonlabs-projector-2.1.0.tgz",
    "plugin/projector/.codex-plugin/plugin.json",
    "packed-lifecycle-acceptance.mjs",
    "source-severed-release-acceptance.mjs",
    "release-candidate.mjs",
    "fixtures/held-out-change.json",
  ]);
  for (const path of paths) {
    const target = join(candidateRoot, ...path.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `fixture:${path}\n`);
  }
  await publishCandidateManifest(candidateRoot);
  const files = await inventoryCandidateFiles(candidateRoot);
  const targetSnapshot = createReleaseCandidateProjectDataFormat({
    candidate: { packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" }, files },
  });
  const sourceSnapshot = createReleaseCandidateProjectDataFormat({
    candidate: { packageIdentity: { name: "@onepersonlabs/projector", version: "2.0.0" }, files },
  });
  const sourcePath = join(root, "released-snapshot.json");
  const draftPath = join(root, "net-draft.json");
  const outputPath = join(root, "migration.json");
  const draft: ProjectDataMigrationDraft = {
    apiVersion: "projector.project-data-migration-draft/v1",
    sourceSnapshot,
    targetSnapshot,
    operations: [],
    customTransforms: [],
    validations: [],
  };
  await writeFile(sourcePath, `${canonicalJson(sourceSnapshot)}\n`);
  await writeFile(draftPath, `${canonicalJson(draft)}\n`);
  return {
    candidateRoot,
    input: { candidateRoot, sourcePath, draftPath, outputPath, migrationId: "migration:2.0.0-to-2.1.0" },
  };
}

async function publishCandidateManifest(candidateRoot: string): Promise<void> {
  const manifestPath = join(candidateRoot, "manifest.json");
  await rm(manifestPath, { force: true });
  const files = await inventoryCandidateFiles(candidateRoot);
  const manifest = {
    apiVersion: "projector.release-candidate/v1",
    release: { name: "@onepersonlabs/projector", version: "2.1.0", sourceRevision: "0".repeat(40) },
    tarballPath: "artifacts/onepersonlabs-projector-2.1.0.tgz",
    pluginRoot: "plugin/projector",
    runnerPath: "source-severed-release-acceptance.mjs",
    fixturePath: "fixtures/held-out-change.json",
    files,
  };
  await writeFile(manifestPath, `${canonicalJson(manifest)}\n`);
}
