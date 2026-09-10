import { access, lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationChainSchema,
  canonicalJson,
  comparePackageVersions,
} from "../packages/core/dist/index.js";
import { createReleaseCandidateProjectDataFormat } from "../packages/control-plane/dist/index.js";

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
  const target = createReleaseCandidateProjectDataFormat({ candidate: { packageIdentity: input.packageIdentity, files: input.files } });
  const order = comparePackageVersions(source.packageIdentity.version, target.packageIdentity.version);
  if (order > 0) throw new Error("release candidate version is older than the released project-data format baseline");
  if (order === 0) {
    if (source.snapshotHash !== target.snapshotHash) throw new Error("release candidate changes project-data format without a newer release and migration");
    return { status: "baseline", source, target };
  }
  const chainPath = join(input.repositoryRoot, `release/project-data-migrations/chain-through-${target.packageIdentity.version}.json`);
  const chain = ProjectDataMigrationChainSchema.parse(await readCanonical(chainPath, "released project-data migration chain"));
  if (chain.manifests[0]?.sourceSnapshotHash !== source.snapshotHash || chain.manifests.at(-1)?.targetSnapshotHash !== target.snapshotHash) {
    throw new Error("released project-data migration chain does not connect the baseline to the candidate format");
  }
  const inventory = new Map(input.files.map((file) => [file.path, file.digest]));
  for (const manifest of chain.manifests) {
    for (const artifact of manifest.kind === "transform" ? [...manifest.transforms, ...manifest.validations] : []) {
      if (inventory.get(artifact.relativePath) !== artifact.contentHash) throw new Error(`release candidate does not seal migration dependency ${artifact.relativePath}`);
    }
  }
  return { status: "migration-ready", source, target, chainPath, chain };
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
