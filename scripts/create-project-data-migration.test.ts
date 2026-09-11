import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ProjectDataMigrationDraftSchema, canonicalJson, createLegacyUnversionedProjectDataSource, createProjectDataLegacyIngressManifest, type ProjectDataMigrationDraft } from "@projector/core";
import { afterEach, describe, expect, test } from "vitest";

import {
  canonicalOwnerModulePaths,
  createReleaseCandidateProjectDataFormat,
  preparedConfigOwnerModulePaths,
  runtimeEvidenceOwnerModulePaths,
} from "../packages/control-plane/src/readiness/project-data-format-owner.js";
import { createProjectDataMigrationFile, createRepositoryProjectDataMigration } from "./create-project-data-migration.mjs";
import { assertProjectDataMigrationReleaseReady } from "./project-data-migration-release-check.mjs";
import { hashBytes, inventoryCandidateFiles } from "./release-candidate.mjs";

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

  test("blocks release packaging while a draft is pending or a newer format has no chain", async () => {
    const fixture = await authoringFixture();
    const releaseRoot = join(fixture.root, "release");
    await mkdir(releaseRoot, { recursive: true });
    await writeFile(join(releaseRoot, "project-data-format-baseline.json"), await readFile(fixture.input.sourcePath));
    await writeFile(join(releaseRoot, "project-data-migration-draft.json"), await readFile(fixture.input.draftPath));
    let files = await inventoryCandidateFiles(fixture.candidateRoot);
    await expect(assertProjectDataMigrationReleaseReady({ repositoryRoot: fixture.root, packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" }, files })).rejects.toThrow(/pending.*draft/iu);
    await rm(join(releaseRoot, "project-data-migration-draft.json"));
    await writeFile(join(fixture.candidateRoot, ...canonicalOwnerModulePaths[0]!.split("/")), "new canonical format\n");
    files = await inventoryCandidateFiles(fixture.candidateRoot);
    await expect(assertProjectDataMigrationReleaseReady({ repositoryRoot: fixture.root, packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" }, files })).rejects.toThrow(/migration chain|ENOENT/iu);
  });

  test("derives, seals, chains, and clears an ordinary no-data-change draft", async () => {
    const fixture = await authoringFixture();
    await rm(fixture.input.draftPath);
    const migrationsRoot = join(fixture.root, "release/project-data-migrations");
    const result = await createRepositoryProjectDataMigration({
      repositoryRoot: fixture.root,
      sourcePath: fixture.input.sourcePath,
      draftPath: fixture.input.draftPath,
      migrationsRoot,
      candidateRoot: fixture.candidateRoot,
      readReleaseIdentity: async () => ({ name: "@onepersonlabs/projector", version: "2.1.0" }),
      buildCandidate: async () => undefined,
    });
    expect(result).toMatchObject({ status: "sealed", version: "2.1.0", manifest: { kind: "no-data-change" } });
    await expect(access(fixture.input.draftPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.parse(await readFile(join(migrationsRoot, "chain-through-2.1.0.json"), "utf8"))).toMatchObject({ manifests: [{ id: "migration:2.0.0-to-2.1.0" }] });
  });

  test("restores the exact authored draft when final candidate verification fails", async () => {
    const fixture = await authoringFixture();
    const transformPath = canonicalOwnerModulePaths[0]!;
    const validationPath = canonicalOwnerModulePaths[1]!;
    await writeFile(join(fixture.candidateRoot, ...transformPath.split("/")), "changed format owner\n");
    await publishCandidateManifest(fixture.candidateRoot);
    const files = await inventoryCandidateFiles(fixture.candidateRoot);
    const targetSnapshot = createReleaseCandidateProjectDataFormat({ candidate: { packageIdentity: { name: "@onepersonlabs/projector", version: "2.1.0" }, files } });
    const sourceSnapshot = ProjectDataMigrationDraftSchema.parse(JSON.parse(await readFile(fixture.input.draftPath, "utf8"))).sourceSnapshot;
    const digest = (path: string) => files.find((file) => file.path === path)!.digest;
    await writeFile(fixture.input.draftPath, `${canonicalJson({
      apiVersion: "projector.project-data-migration-draft/v1",
      sourceSnapshot,
      targetSnapshot,
      operations: [{ id: "transform:canonical-wire", relativePath: transformPath, contentHash: digest(transformPath) }],
      customTransforms: [],
      validations: [{ id: "validate:canonical-wire", relativePath: validationPath, contentHash: digest(validationPath) }],
    })}\n`);
    const before = await readFile(fixture.input.draftPath, "utf8");
    let builds = 0;
    await expect(createRepositoryProjectDataMigration({
      repositoryRoot: fixture.root,
      sourcePath: fixture.input.sourcePath,
      draftPath: fixture.input.draftPath,
      migrationsRoot: join(fixture.root, "release/project-data-migrations"),
      candidateRoot: fixture.candidateRoot,
      readReleaseIdentity: async () => ({ name: "@onepersonlabs/projector", version: "2.1.0" }),
      buildCandidate: async () => { builds += 1; if (builds === 2) throw new Error("final candidate rejected"); },
    })).rejects.toThrow("final candidate rejected");
    expect(await readFile(fixture.input.draftPath, "utf8")).toBe(before);
    await expect(access(`${fixture.input.draftPath}.sealing`)).rejects.toMatchObject({ code: "ENOENT" });
    const recovered = await createRepositoryProjectDataMigration({
      repositoryRoot: fixture.root,
      sourcePath: fixture.input.sourcePath,
      draftPath: fixture.input.draftPath,
      migrationsRoot: join(fixture.root, "release/project-data-migrations"),
      candidateRoot: fixture.candidateRoot,
      readReleaseIdentity: async () => ({ name: "@onepersonlabs/projector", version: "2.1.0" }),
      buildCandidate: async () => undefined,
    });
    expect(recovered).toMatchObject({ status: "sealed", manifest: { kind: "transform", transforms: [{ id: "transform:canonical-wire" }] } });
    await expect(access(fixture.input.draftPath)).rejects.toMatchObject({ code: "ENOENT" });
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
  const legacyArtifacts = await writeArtifactPair(root, candidateRoot, "legacy-unversioned", "2.0.0");
  await writeArtifactPair(root, candidateRoot, "2.0.0", "2.1.0");
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
  await mkdir(join(root, "release"), { recursive: true });
  const legacySource = createLegacyUnversionedProjectDataSource({
    apiVersion: "projector.legacy-unversioned-project-data-source/v1",
    config: { apiVersion: "projector.config/v1", path: ".projector/config.json", versionBinding: "absent" },
    canonical: { envelopeApiVersion: "projector/v2", layout: "canonical-json" },
  });
  const ingress = createProjectDataLegacyIngressManifest({
    apiVersion: "projector.project-data-legacy-ingress-manifest/v1",
    id: "migration:legacy-unversioned-to-2.0.0",
    source: legacySource,
    targetVersion: "2.0.0",
    targetSnapshotHash: sourceSnapshot.snapshotHash,
    transforms: legacyArtifacts.transforms,
    validations: legacyArtifacts.validations,
  });
  await writeFile(join(root, "release/project-data-legacy-ingress.json"), `${canonicalJson(ingress)}\n`);
  for (const [relativePath, bytes] of [
    ["project-data/format-baseline.json", `${canonicalJson(sourceSnapshot)}\n`],
    ["project-data/legacy-ingress.json", `${canonicalJson(ingress)}\n`],
  ] as const) {
    for (const candidatePath of [relativePath, `plugin/projector/runtime/projector/${relativePath}`]) {
      const target = join(candidateRoot, ...candidatePath.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
  }
  await publishCandidateManifest(candidateRoot);
  return {
    root,
    candidateRoot,
    input: { candidateRoot, sourcePath, draftPath, outputPath, migrationId: "migration:2.0.0-to-2.1.0" },
  };
}

async function writeArtifactPair(root: string, candidateRoot: string, from: string, to: string) {
  const result = { transforms: [] as { id: string; relativePath: string; contentHash: `sha256:v1:${string}` }[], validations: [] as { id: string; relativePath: string; contentHash: `sha256:v1:${string}` }[] };
  for (const [kind, suffix] of [["transforms", "transform"], ["validations", "validation"]] as const) {
    const name = `${from}-to-${to}-${suffix}.mjs`;
    const relativePath = `project-data/migrations/artifacts/${name}`;
    const bytes = Buffer.from(`export const projectDataMigrationArtifact = { apiVersion: "projector.project-data-migration-artifact/v1", id: "${suffix}:${from}-to-${to}", kind: "${suffix}", async run() {} };\n`);
    const repositoryPath = join(root, "release/project-data-migrations/artifacts", name);
    await mkdir(dirname(repositoryPath), { recursive: true });
    await writeFile(repositoryPath, bytes);
    for (const candidatePath of [relativePath, `plugin/projector/runtime/projector/${relativePath}`]) {
      const target = join(candidateRoot, ...candidatePath.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    result[kind].push({ id: `${suffix}:${from}-to-${to}`, relativePath, contentHash: hashBytes(bytes) });
  }
  return result;
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
