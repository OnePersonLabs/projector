import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationChainSchema,
  ProjectDataMigrationDraftSchema,
  createLegacyUnversionedProjectDataSource,
  createProjectDataLegacyIngressManifest,
  canonicalJson,
} from "@projector/core";
import {
  createProjectDataMigrationDraft,
  createReleaseCandidateProjectDataFormat,
  createReleaseCandidateProjectDataMigration,
  compareProjectDataFormats,
} from "@projector/control-plane";

import { buildSourceSeveredReleaseBundle } from "./build-source-severed-release-bundle.mjs";
import { readAuthoredReleaseIdentity } from "./release-identity.mjs";
import { validateReleaseCandidate } from "./release-candidate.mjs";
import { hashBytes } from "./release-candidate.mjs";
import { isReleaseCommandCleanupUnconfirmed } from "./npm-command.mjs";
import { selectProjectDataMigrationReleaseVersion, synchronizeWorkspaceReleaseVersion } from "./project-data-migration-workflow.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export async function createProjectDataMigrationFile(input) {
  const sourceSnapshot = ProjectDataFormatSnapshotSchema.parse(await readStrictJsonFile(input.sourcePath, "released format snapshot"));
  const suppliedDraft = ProjectDataMigrationDraftSchema.parse(await readStrictJsonFile(input.draftPath, "project-data migration draft"));
  if (sourceSnapshot.snapshotHash !== suppliedDraft.sourceSnapshot.snapshotHash) {
    throw new Error("Migration draft source does not match the authenticated released format snapshot");
  }
  const candidate = await validateReleaseCandidate(input.candidateRoot);
  const draft = createProjectDataMigrationDraft({
    sourceSnapshot,
    targetSnapshot: suppliedDraft.targetSnapshot,
    operations: suppliedDraft.operations,
    customTransforms: suppliedDraft.customTransforms,
    validations: suppliedDraft.validations,
  });
  const manifest = createReleaseCandidateProjectDataMigration({
    id: input.migrationId,
    draft,
    candidate: {
      packageIdentity: { name: candidate.manifest.release.name, version: candidate.manifest.release.version },
      files: candidate.files,
    },
  });
  const bytes = `${canonicalJson(manifest)}\n`;
  await writeImmutable(input.outputPath, bytes);
  return { manifest, outputPath: resolve(input.outputPath) };
}

export async function createRepositoryProjectDataMigration(options = {}) {
  const root = options.repositoryRoot ?? repositoryRoot;
  const targetFormatPath = join(root, "release/project-data-format-target.json");
  const sourcePath = options.sourcePath ?? targetFormatPath;
  const draftPath = options.draftPath ?? join(root, "release/project-data-migration-draft.json");
  const migrationsRoot = options.migrationsRoot ?? join(root, "release/project-data-migrations");
  const sealingDraftPath = `${draftPath}.sealing`;
  try {
    await lstat(draftPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    try { await rename(sealingDraftPath, draftPath); await syncDirectoryIfSupported(dirname(draftPath)); }
    catch (recoveryError) { if (recoveryError?.code !== "ENOENT") throw recoveryError; }
  }
  let pendingDraft;
  try { pendingDraft = ProjectDataMigrationDraftSchema.parse(await readStrictJsonFile(draftPath, "project-data migration draft")); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const sourceSnapshot = pendingDraft?.sourceSnapshot ?? ProjectDataFormatSnapshotSchema.parse(await readStrictJsonFile(sourcePath, "released format snapshot"));
  const authored = await (options.readReleaseIdentity ?? readAuthoredReleaseIdentity)(root);
  const selection = selectProjectDataMigrationReleaseVersion(authored.version, sourceSnapshot.packageIdentity.version);
  if (selection.changed) {
    const synchronized = await (options.synchronizeVersion ?? synchronizeWorkspaceReleaseVersion)(root, selection.version);
    return { status: "version-prepared", version: selection.version, changedPaths: synchronized.changedPaths };
  }
  let legacyBaseline;
  try { legacyBaseline = ProjectDataFormatSnapshotSchema.parse(await readStrictJsonFile(join(root, "release/project-data-format-baseline.json"), "released legacy ingress baseline")); }
  catch (error) {
    if (error?.code !== "ENOENT" || options.sourcePath === undefined) throw error;
    legacyBaseline = sourceSnapshot;
  }
  await ensureLegacyIngressManifest(root, legacyBaseline);
  const formatsRoot = join(root, "release/project-data-formats");
  await mkdir(formatsRoot, { recursive: true });
  await writeImmutable(join(formatsRoot, `${sourceSnapshot.packageIdentity.version}.json`), `${canonicalJson(sourceSnapshot)}\n`);
  const buildCandidate = options.buildCandidate ?? buildSourceSeveredReleaseBundle;
  const ownedWorkspaces = [];
  const buildFreshCandidate = async (phase, buildOptions, explicitRoot) => {
    let workspace;
    if (explicitRoot === undefined) {
      const parent = options.candidateRoot === undefined
        ? join(root, ".projector/runtime/project-data-authoring")
        : dirname(resolve(options.candidateRoot));
      await mkdir(parent, { recursive: true });
      workspace = { path: await mkdtemp(join(parent, `${phase}-`)), retain: false };
      ownedWorkspaces.push(workspace);
    }
    const output = explicitRoot ?? join(workspace.path, "release-candidate");
    try {
      await buildCandidate(output, { ...buildOptions, signal: options.signal });
    } catch (error) {
      if (workspace !== undefined && isReleaseCommandCleanupUnconfirmed(error)) workspace.retain = true;
      throw error;
    }
    return output;
  };
  try {
  // An explicitly supplied first output remains caller-owned. Never remove or overwrite it.
  const candidateRoot = await buildFreshCandidate("draft", { allowPendingProjectDataMigration: true }, options.candidateRoot);
  const candidate = await validateReleaseCandidate(candidateRoot);
  if (candidate.manifest.release.version !== selection.version) throw new Error("Built release candidate does not use the selected release version");
  const targetSnapshot = createReleaseCandidateProjectDataFormat({
    candidate: { packageIdentity: { name: candidate.manifest.release.name, version: candidate.manifest.release.version }, files: candidate.files },
  });
  let draft = pendingDraft;
  if (draft !== undefined) {
    if (draft.sourceSnapshot.snapshotHash !== sourceSnapshot.snapshotHash || draft.targetSnapshot.snapshotHash !== targetSnapshot.snapshotHash) {
      throw new Error("Pending project-data migration draft does not match the current released source and authenticated candidate target");
    }
  } else {
    const changes = compareProjectDataFormats(sourceSnapshot, targetSnapshot);
    const authoredArtifacts = changes.length === 0
      ? { transforms: [], validations: [] }
      : await readAuthoredMigrationArtifacts(root, sourceSnapshot.packageIdentity.version, targetSnapshot.packageIdentity.version);
    draft = createProjectDataMigrationDraft({
      sourceSnapshot,
      targetSnapshot,
      customTransforms: authoredArtifacts.transforms,
      validations: authoredArtifacts.validations,
    });
    await mkdir(dirname(draftPath), { recursive: true });
    await writeExclusive(draftPath, `${canonicalJson(draft)}\n`);
    if (changes.length > 0) {
      return { status: "draft-created", version: selection.version, draftPath: resolve(draftPath), targetSnapshot };
    }
  }
  await mkdir(migrationsRoot, { recursive: true });
  const migrationId = `migration:${sourceSnapshot.packageIdentity.version}-to-${selection.version}`;
  const outputPath = join(migrationsRoot, `${sourceSnapshot.packageIdentity.version}-to-${selection.version}.json`);
  const result = await createProjectDataMigrationFile({ candidateRoot, sourcePath, draftPath, migrationId, outputPath });
  const priorChainPath = join(migrationsRoot, `chain-through-${sourceSnapshot.packageIdentity.version}.json`);
  let prior = [];
  try { prior = ProjectDataMigrationChainSchema.parse(await readStrictJsonFile(priorChainPath, "prior project-data migration chain")).manifests; }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const chain = ProjectDataMigrationChainSchema.parse({ apiVersion: "projector.data-migration-chain/v1", manifests: [...prior, result.manifest] });
  const chainPath = join(migrationsRoot, `chain-through-${selection.version}.json`);
  await writeImmutable(chainPath, `${canonicalJson(chain)}\n`);
  await rename(draftPath, sealingDraftPath);
  await syncDirectoryIfSupported(dirname(draftPath));
  const previousTarget = await readOptionalFile(targetFormatPath);
  try {
    await replaceCurrentTarget(targetFormatPath, `${canonicalJson(targetSnapshot)}\n`);
    await buildFreshCandidate("seal", { allowActiveProjectDataMigrationSeal: true });
    await rm(sealingDraftPath);
    await syncDirectoryIfSupported(dirname(draftPath));
  } catch (error) {
    await restoreCurrentTarget(targetFormatPath, previousTarget);
    await rename(sealingDraftPath, draftPath);
    await syncDirectoryIfSupported(dirname(draftPath));
    throw error;
  }
  return { status: "sealed", version: selection.version, manifest: result.manifest, outputPath: result.outputPath, chainPath: resolve(chainPath) };
  } finally {
    // Only exact mkdtemp-owned parents are disposable, and only after their build settled.
    for (const workspace of ownedWorkspaces) {
      if (!workspace.retain) await rm(workspace.path, { recursive: true, force: true });
    }
  }
}

async function readOptionalFile(path) {
  try { return await readFile(path); }
  catch (error) { if (error?.code === "ENOENT") return undefined; throw error; }
}

async function replaceCurrentTarget(path, bytes) {
  const temporary = `${path}.projector-target-${process.pid}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
  try { await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
  await syncDirectoryIfSupported(dirname(resolve(path)));
}

async function restoreCurrentTarget(path, bytes) {
  if (bytes === undefined) {
    await rm(path, { force: true });
    await syncDirectoryIfSupported(dirname(resolve(path)));
    return;
  }
  await replaceCurrentTarget(path, bytes);
}

async function ensureLegacyIngressManifest(root, targetSnapshot) {
  const ingressPath = join(root, "release/project-data-legacy-ingress.json");
  const artifacts = await readLegacyIngressArtifacts(root);
  const source = createLegacyUnversionedProjectDataSource({
    apiVersion: "projector.legacy-unversioned-project-data-source/v1",
    config: { apiVersion: "projector.config/v1", path: ".projector/config.json", versionBinding: "absent" },
    canonical: { envelopeApiVersion: "projector/v2", layout: "canonical-json" },
  });
  const manifest = createProjectDataLegacyIngressManifest({
    apiVersion: "projector.project-data-legacy-ingress-manifest/v1",
    id: `migration:legacy-unversioned-to-${targetSnapshot.packageIdentity.version}`,
    source,
    targetVersion: targetSnapshot.packageIdentity.version,
    targetSnapshotHash: targetSnapshot.snapshotHash,
    transforms: artifacts.transforms,
    validations: artifacts.validations,
  });
  await mkdir(dirname(ingressPath), { recursive: true });
  await writeImmutable(ingressPath, `${canonicalJson(manifest)}\n`);
  return { ingressPath, manifest };
}

async function readLegacyIngressArtifacts(root) {
  const specs = [
    {
      kind: "transforms",
      id: "migration-artifact:legacy-unversioned-to-baseline",
      name: "legacy-unversioned-to-baseline.mjs",
    },
    {
      kind: "validations",
      id: "migration-artifact:legacy-unversioned-baseline-validation",
      name: "legacy-unversioned-baseline-validation.mjs",
    },
  ];
  return readArtifactSpecs(root, specs);
}

async function readAuthoredMigrationArtifacts(root, from, to) {
  const prefix = `${from}-to-${to}`;
  const specs = [
    { kind: "transforms", id: `transform:${prefix}`, name: `${prefix}-transform.mjs` },
    { kind: "validations", id: `validation:${prefix}`, name: `${prefix}-validation.mjs` },
  ];
  const directory = join(root, "release/project-data-migrations/artifacts");
  await mkdir(directory, { recursive: true });
  for (const spec of specs) {
    const transform = spec.kind === "transforms";
    const kind = transform ? "transform" : "validation";
    const method = transform ? "prepareTarget" : "validateTarget";
    const status = transform ? "prepared" : "passed";
    const bytes = `export const projectDataMigrationArtifact = Object.freeze({\n  apiVersion: "projector.project-data-migration-artifact/v1",\n  id: ${JSON.stringify(spec.id)},\n  kind: ${JSON.stringify(kind)},\n  async run(context) {\n    if (context.signal.aborted) throw context.signal.reason;\n    if (context.source.kind !== "release-format") throw new Error("This adapter requires an authenticated released-format source");\n    await context.${method}();\n    if (context.signal.aborted) throw context.signal.reason;\n    return { apiVersion: "projector.project-data-migration-${kind}-result/v1", status: ${JSON.stringify(status)} };\n  },\n});\n`;
    try { await writeExclusive(join(directory, spec.name), bytes); }
    catch (error) { if (error?.code !== "EEXIST") throw error; }
  }
  return readArtifactSpecs(root, specs);
}

async function readArtifactSpecs(root, specs) {
  const result = { transforms: [], validations: [] };
  for (const spec of specs) {
    const sourcePath = join(root, "release/project-data-migrations/artifacts", spec.name);
    const metadata = await lstat(sourcePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Migration artifact must be a regular file: ${sourcePath}`);
    const bytes = await readFile(sourcePath);
    result[spec.kind].push({
      id: spec.id,
      relativePath: `project-data/migrations/artifacts/${spec.name}`,
      contentHash: hashBytes(bytes),
    });
  }
  return result;
}

async function readStrictJsonFile(path, label) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const bytes = await readFile(path, "utf8");
  let value;
  try { value = JSON.parse(bytes); } catch { throw new Error(`${label} is malformed JSON`); }
  if (`${canonicalJson(value)}\n` !== bytes) throw new Error(`${label} must use canonical JSON bytes`);
  return value;
}

async function writeImmutable(path, bytes) {
  try {
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(bytes, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await syncDirectoryIfSupported(dirname(resolve(path)));
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Existing migration manifest is not a regular file: ${path}`);
    const file = await open(path, "r+");
    try {
      if (await file.readFile("utf8") !== bytes) throw new Error(`Refusing to replace an existing migration manifest with different bytes: ${path}`);
      await file.sync();
    } finally {
      await file.close();
    }
    await syncDirectoryIfSupported(dirname(resolve(path)));
  }
}

async function writeExclusive(path, bytes) {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(bytes, "utf8"); await file.sync(); }
  finally { await file.close(); }
  await syncDirectoryIfSupported(dirname(resolve(path)));
}

async function syncDirectoryIfSupported(path) {
  const directory = await open(path, "r");
  try { await directory.sync(); }
  catch (error) {
    if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error?.code)) throw error;
  } finally { await directory.close(); }
}

function parseArguments(argv) {
  if (argv.length === 0) return null;
  const allowed = new Set(["--candidate", "--source", "--draft", "--id", "--output"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || value === undefined || value.length === 0 || values.has(key)) {
      throw new Error("Usage: pnpm create-migration -- --candidate <release-candidate> --source <released-snapshot.json> --draft <net-draft.json> --id <migration-id> --output <manifest.json>");
    }
    values.set(key, value);
  }
  if (values.size !== allowed.size) throw new Error("Every create-migration option is required");
  return {
    candidateRoot: values.get("--candidate"),
    sourcePath: values.get("--source"),
    draftPath: values.get("--draft"),
    migrationId: values.get("--id"),
    outputPath: values.get("--output"),
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const parsed = parseArguments(process.argv.slice(2));
    const result = parsed === null ? await createRepositoryProjectDataMigration() : await createProjectDataMigrationFile(parsed);
    process.stdout.write(`${JSON.stringify(result.status === "draft-created" || result.status === "version-prepared" ? result : { status: "created", id: result.manifest.id, manifestHash: result.manifest.manifestHash, outputPath: result.outputPath, ...(result.chainPath === undefined ? {} : { chainPath: result.chainPath }) })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
