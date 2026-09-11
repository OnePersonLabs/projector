import { access, lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataLegacyIngressManifestSchema,
  ProjectDataMigrationChainSchema,
  canonicalJson,
  comparePackageVersions,
} from "@projector/core";
import { createReleaseCandidateProjectDataFormat } from "@projector/control-plane";
import { hashBytes } from "./release-candidate.mjs";

export async function assertProjectDataMigrationReleaseReady(input) {
  const baselinePath = join(input.repositoryRoot, "release/project-data-format-baseline.json");
  try { await access(baselinePath); }
  catch (error) { if (error?.code === "ENOENT") return { status: "baseline-pending" }; throw error; }
  const draftPath = join(input.repositoryRoot, "release/project-data-migration-draft.json");
  try { await access(draftPath); throw new Error("release candidate cannot contain a pending project-data migration draft"); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (input.allowActiveSeal !== true) {
    try { await access(`${draftPath}.sealing`); throw new Error("release candidate cannot contain an unfinished project-data migration seal"); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const source = ProjectDataFormatSnapshotSchema.parse(await readCanonical(baselinePath, "released project-data format baseline"));
  const legacyIngress = ProjectDataLegacyIngressManifestSchema.parse(await readCanonical(
    join(input.repositoryRoot, "release/project-data-legacy-ingress.json"),
    "released legacy project-data ingress manifest",
  ));
  if (legacyIngress.targetVersion !== source.packageIdentity.version || legacyIngress.targetSnapshotHash !== source.snapshotHash) {
    throw new Error("legacy project-data ingress must target the exact released format baseline");
  }
  const target = createReleaseCandidateProjectDataFormat({ candidate: { packageIdentity: input.packageIdentity, files: input.files } });
  const inventory = new Map(input.files.map((file) => [file.path, file.digest]));
  authenticatePackagedReleaseData("project-data/format-baseline.json", source, inventory);
  authenticatePackagedReleaseData("project-data/legacy-ingress.json", legacyIngress, inventory);
  authenticateArtifacts([...legacyIngress.transforms, ...legacyIngress.validations], inventory);
  const order = comparePackageVersions(source.packageIdentity.version, target.packageIdentity.version);
  if (order > 0) throw new Error("release candidate version is older than the released project-data format baseline");
  if (order === 0) {
    if (source.snapshotHash !== target.snapshotHash) throw new Error("release candidate changes project-data format without a newer release and migration");
    return { status: "baseline", source, target, legacyIngress };
  }
  const chainPath = join(input.repositoryRoot, `release/project-data-migrations/chain-through-${target.packageIdentity.version}.json`);
  const chain = ProjectDataMigrationChainSchema.parse(await readCanonical(chainPath, "released project-data migration chain"));
  if (chain.manifests[0]?.sourceSnapshotHash !== source.snapshotHash || chain.manifests.at(-1)?.targetSnapshotHash !== target.snapshotHash) {
    throw new Error("released project-data migration chain does not connect the baseline to the candidate format");
  }
  for (const manifest of chain.manifests) {
    authenticateArtifacts(manifest.kind === "transform" ? [...manifest.transforms, ...manifest.validations] : [], inventory);
  }
  const packagedTarget = ProjectDataFormatSnapshotSchema.parse(await readCanonical(
    join(input.repositoryRoot, "release/project-data-format-target.json"),
    "released project-data target format",
  ));
  if (canonicalJson(packagedTarget) !== canonicalJson(target)) {
    throw new Error("packaged project-data target format does not match the authenticated candidate owners");
  }
  authenticatePackagedReleaseData("project-data/format-target.json", target, inventory);
  return { status: "migration-ready", source, target, chainPath, chain, legacyIngress };
}

function authenticatePackagedReleaseData(path, value, inventory) {
  const digest = hashBytes(Buffer.from(`${canonicalJson(value)}\n`, "utf8"));
  if (inventory.get(path) !== digest) throw new Error(`release candidate does not seal ${path}`);
  const installedPath = `plugin/projector/runtime/projector/${path}`;
  if (inventory.get(installedPath) !== digest) throw new Error(`installed release package does not seal ${installedPath}`);
}

function authenticateArtifacts(artifacts, inventory) {
  for (const artifact of artifacts) {
    if (inventory.get(artifact.relativePath) !== artifact.contentHash) throw new Error(`release candidate does not seal migration dependency ${artifact.relativePath}`);
    const installedPath = `plugin/projector/runtime/projector/${artifact.relativePath}`;
    if (inventory.get(installedPath) !== artifact.contentHash) throw new Error(`installed release package does not seal migration dependency ${installedPath}`);
  }
}

async function readCanonical(path, label) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const bytes = await readFile(path, "utf8");
  let value;
  try { value = JSON.parse(bytes); } catch { throw new Error(`${label} is malformed JSON`); }
  if (`${canonicalJson(value)}\n` !== bytes) throw new Error(`${label} must use canonical JSON bytes`);
  return value;
}
