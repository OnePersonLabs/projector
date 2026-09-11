import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataLegacyIngressManifestSchema,
  ProjectDataMigrationChainSchema,
  StateDigestSchema,
  canonicalJson,
  hashFramedDomain,
  parseCanonicalJson,
  type ContentHash,
  type PendingProjectDataMigration,
  type ProjectDataFormatSnapshot,
  type ProjectDataMigrationArtifactRef,
  type ProjectDataMigrationSourceAuthority,
  type StateDigest,
} from "@projector/core";
import {
  CanonicalFileRepository,
  FileTransactionJournal,
  PendingProjectDataMigrationStore,
  RepositoryPathService,
  SqliteDerivedStore,
  WriterLeaseManager,
  createProjectBackup,
  inspectLegacyUnversionedProjectData,
  installProjectorEditorSchemaBundle,
  prepareObservedLegacyUnversionedProjectData,
  rebuildDerivedStore,
  stringifyTomlDocument,
  withProjectOperationAccess,
  type ProjectBackupManifestFile,
} from "@projector/runtime";

import { loadProjectDataMigrationArtifact, type ProjectDataMigrationSourceObservation } from "./project-data-migration-artifact.js";
import { createPreparedProjectDataMigrationRecoveryService } from "./project-data-migration-recovery.js";
import { observePreparedMigrationTarget } from "./project-data-migration-target.js";

const writerLeaseStaleAfterMs = 30_000;

export interface PackagedProjectDataMigrationResult {
  readonly status: "migrated" | "reconciled" | "not-required";
  readonly attemptId?: string;
  readonly migrationId?: string;
}

export function createPackagedProjectDataMigrationService(input: {
  readonly packagedRoot: string;
  readonly codexDataRoot: string;
}) {
  const packagedRoot = resolve(input.packagedRoot);
  return {
    async migrate(repositoryRoot: string, request: {
      readonly requestId: string;
      readonly processId: number;
      readonly signal?: AbortSignal;
    }): Promise<PackagedProjectDataMigrationResult> {
      const targetFormat = await readCanonicalFile(
        join(packagedRoot, "project-data/format-target.json"),
        ProjectDataFormatSnapshotSchema,
        "packaged target format",
      );
      const pending = await new PendingProjectDataMigrationStore(repositoryRoot).read();
      if (pending !== undefined) {
        const recovered = await createPreparedProjectDataMigrationRecoveryService({
          targetFormat,
          codexDataRoot: input.codexDataRoot,
        }).recover(repositoryRoot, request);
        if (recovered.status !== "reconciled") {
          throw new Error(recovered.status === "no-pending" ? "Pending migration disappeared before recovery" : recovered.reason);
        }
        return { status: "reconciled", attemptId: recovered.attemptId, migrationId: recovered.migrationId };
      }

      const attemptId = `migration-attempt:${randomUUID()}`;
      const stagingRoot = await mkdtemp(join(repositoryRoot, ".projector-migration-stage-"));
      const stagingLocation = relative(repositoryRoot, stagingRoot).replaceAll("\\", "/");
      let committed = false;
      let selectedForResult: SelectedMigration | undefined;
      try {
        await withProjectOperationAccess(repositoryRoot, {
          operation: "project-data-migration",
          mode: "exclusive",
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        }, async (access) => {
          const selection = await selectPackagedProjectDataMigration(packagedRoot, repositoryRoot, targetFormat);
          if (selection === undefined) return;
          selectedForResult = selection;
          const paths = await RepositoryPathService.create(repositoryRoot);
          const lease = await new WriterLeaseManager(paths, { staleAfterMs: writerLeaseStaleAfterMs })
            .acquireProjectDataMigration({
              sessionId: request.requestId,
              processId: request.processId,
              attemptId,
              migrationId: selection.manifest.id,
              manifestHash: selection.manifest.manifestHash,
              sourceAuthority: selection.sourceAuthority,
              targetSnapshotHash: targetFormat.snapshotHash,
            });
          const assertOwned = async () => {
            throwIfAborted(access.signal);
            await access.assertOwned();
            await lease.heartbeat();
            throwIfAborted(access.signal);
          };
          try {
            await assertOwned();
            const backup = await createProjectBackup({
              repositoryRoot,
              codexDataRoot: input.codexDataRoot,
              coordination: { operationAccess: access, writerLease: lease },
            });
            await assertOwned();
            const source = await observeSource(repositoryRoot, selection, backup.manifest.files, access.signal);
            if (source.kind === "release-format") {
              await prepareStageFromBackup(repositoryRoot, stagingRoot, backup.manifest.files);
            }
            let stagedSource: ProjectDataMigrationSourceObservation = source;
            for (const step of selection.steps) {
              const artifactContext = {
                sourceAuthority: selection.sourceAuthority,
                targetFormat: step.targetFormat,
                source: stagedSource,
                stagingRoot,
                signal: access.signal,
                prepareTarget: async () => prepareTarget(stagedSource, stagingRoot, step.targetFormat),
                validateTarget: async () => validateStagedTarget(stagingRoot, step.targetFormat, access.signal),
              };
              await runArtifacts(packagedRoot, step.transforms, "transform", artifactContext);
              if (stagedSource.kind === "legacy-unversioned") {
                await mergeRetainedBackupFiles(repositoryRoot, stagingRoot, backup.manifest.files, new Set(stagedSource.retiredPaths));
              }
              await runArtifacts(packagedRoot, step.validations, "validation", artifactContext);
              await validateStagedTarget(stagingRoot, step.targetFormat, access.signal);
              stagedSource = { kind: "release-format", snapshot: step.targetFormat };
            }
            const stagedFiles = await inventoryProjectorFiles(stagingRoot);
            const stagedSnapshot = await new CanonicalFileRepository(stagingRoot).snapshot();
            await validateStagedTarget(stagingRoot, targetFormat, access.signal, stagedFiles);
            await assertOwned();
            const marker: PendingProjectDataMigration = {
              apiVersion: "projector.pending-project-data-migration/v2",
              attemptId,
              migrationId: selection.manifest.id,
              sourceAuthority: selection.sourceAuthority,
              targetSnapshotHash: targetFormat.snapshotHash,
              manifestHash: selection.manifest.manifestHash,
              backup: {
                id: backup.backupId,
                location: backup.backupLocation,
                manifestHash: backup.manifestHash,
              },
              stagingLocation,
              phase: "backed-up",
              createdAt: new Date().toISOString(),
            };
            const pendingStore = new PendingProjectDataMigrationStore(repositoryRoot);
            await pendingStore.create(marker);
            const beforeState = StateDigestSchema.parse({
              gitBase: `project-data-migration:${selection.manifest.id}`,
              worktreeDigest: hashFramedDomain("project-data-migration-source-files/v1", backup.manifest.files),
              canonicalProjectorDigest: source.kind === "legacy-unversioned"
                ? hashFramedDomain("legacy-canonical-documents/v1", source.documents.map(({ id, canonicalDocumentHash }) => ({ id, canonicalDocumentHash })))
                : (await new CanonicalFileRepository(repositoryRoot).snapshot()).rootDigest,
              toolchainDigest: targetFormat.snapshotHash,
            }) as StateDigest;
            const journal = new FileTransactionJournal(paths);
            const transaction = await journal.begin({
              transactionId: attemptId,
              planId: selection.manifest.manifestHash,
              beforeState,
              intendedAfterCanonicalDigest: stagedSnapshot.rootDigest,
              allowedWriteRoots: [".projector"],
              pendingMigration: marker,
            });
            await pendingStore.transition(marker, "staged");
            const sourceFiles = new Map(backup.manifest.files.map((file) => [file.path, file]));
            for (const [path, staged] of [...stagedFiles].sort(([left], [right]) => left.localeCompare(right))) {
              if (path === ".projector/config.toml") continue;
              const prior = sourceFiles.get(path);
              if (prior?.length === staged.bytes.byteLength && prior.sha256 === rawSha256(staged.bytes)) continue;
              await transaction.writeFile(path, staged.bytes);
              await assertOwned();
            }
            const retiredPaths = source.kind === "legacy-unversioned" ? source.retiredPaths : [];
            for (const path of retiredPaths) {
              if (sourceFiles.has(path)) await transaction.deleteFile(path);
              await assertOwned();
            }
            await pendingStore.transition(marker, "publishing");
            const config = stagedFiles.get(".projector/config.toml");
            if (config === undefined) throw new Error("Migration stage omits prepared config.toml");
            await transaction.writeFile(config.path, config.bytes);
            await assertOwned();
            for (const phase of ["workspace-staged", "validating", "canonical-staging", "committing"] as const) {
              await transaction.transition(phase);
            }
            await transaction.commit();
            committed = true;
            await assertOwned();
          } finally {
            await lease.release();
          }
        });
        if (selectedForResult === undefined) return { status: "not-required" };
        const recovered = await createPreparedProjectDataMigrationRecoveryService({
          targetFormat,
          codexDataRoot: input.codexDataRoot,
        }).recover(repositoryRoot, request);
        if (recovered.status !== "reconciled") {
          throw new Error(recovered.status === "no-pending" ? "Committed migration lost its Pending marker" : recovered.reason);
        }
        return { status: "migrated", attemptId, migrationId: selectedForResult.manifest.id };
      } finally {
        if (!committed) {
          // A published Pending/journal is retained for authenticated recovery; staging is disposable only before effects.
          const pendingAfter = await new PendingProjectDataMigrationStore(repositoryRoot).read().catch(() => undefined);
          if (pendingAfter === undefined) await rm(stagingRoot, { recursive: true, force: true });
        } else {
          await rm(stagingRoot, { recursive: true, force: true });
        }
      }
    },
  };
}

type SelectedMigration = {
  manifest: { id: string; manifestHash: ContentHash };
  sourceAuthority: ProjectDataMigrationSourceAuthority;
  sourceFormat?: ProjectDataFormatSnapshot;
  steps: readonly {
    targetFormat: ProjectDataFormatSnapshot;
    transforms: readonly ProjectDataMigrationArtifactRef[];
    validations: readonly ProjectDataMigrationArtifactRef[];
  }[];
};

export async function selectPackagedProjectDataMigration(packagedRoot: string, repositoryRoot: string, target: ProjectDataFormatSnapshot): Promise<SelectedMigration | undefined> {
  const legacyPath = join(repositoryRoot, ".projector/config.json");
  if (await exists(legacyPath)) {
    const ingress = await readCanonicalFile(join(packagedRoot, "project-data/legacy-ingress.json"), ProjectDataLegacyIngressManifestSchema, "legacy ingress manifest");
    const source = await inspectLegacyUnversionedProjectData(repositoryRoot);
    if (source.descriptor.sourceHash !== ingress.source.sourceHash) throw new Error("Legacy source does not match the packaged ingress authority");
    const baseline = await readCanonicalFile(join(packagedRoot, "project-data/format-baseline.json"), ProjectDataFormatSnapshotSchema, "packaged format baseline");
    if (baseline.snapshotHash !== ingress.targetSnapshotHash) throw new Error("Legacy ingress does not target the packaged released baseline");
    const steps: SelectedMigration["steps"][number][] = [{ targetFormat: baseline, transforms: ingress.transforms, validations: ingress.validations }];
    let manifest: { id: string; manifestHash: ContentHash } = ingress;
    if (ingress.targetSnapshotHash !== target.snapshotHash) {
      const chain = await readCanonicalFile(join(packagedRoot, `project-data/migrations/chain-through-${target.packageIdentity.version}.json`), ProjectDataMigrationChainSchema, "packaged migration chain");
      if (chain.manifests[0]?.sourceSnapshotHash !== ingress.targetSnapshotHash || chain.manifests.at(-1)?.targetSnapshotHash !== target.snapshotHash) {
        throw new Error("Packaged SemVer chain does not continue the legacy ingress baseline to the target format");
      }
      for (const edge of chain.manifests) {
        const stepTarget = edge.targetSnapshotHash === target.snapshotHash
          ? target
          : await readCanonicalFile(join(packagedRoot, `project-data/formats/${edge.toVersion}.json`), ProjectDataFormatSnapshotSchema, `packaged ${edge.toVersion} format`);
        if (stepTarget.snapshotHash !== edge.targetSnapshotHash) throw new Error(`Packaged format descriptor does not match migration edge ${edge.id}`);
        steps.push({
          targetFormat: stepTarget,
          transforms: edge.kind === "transform" ? edge.transforms : [],
          validations: edge.kind === "transform" ? edge.validations : [],
        });
      }
      manifest = {
        id: `migration:legacy-unversioned-through-${target.packageIdentity.version}`,
        manifestHash: hashFramedDomain("project-data-legacy-through-chain/v1", {
          ingressManifestHash: ingress.manifestHash,
          chainManifestHashes: chain.manifests.map(({ manifestHash }) => manifestHash),
          targetSnapshotHash: target.snapshotHash,
        }),
      };
    }
    return {
      manifest,
      sourceAuthority: { kind: "legacy-unversioned", sourceHash: ingress.source.sourceHash },
      steps,
    };
  }
  const configSource = await readFile(join(repositoryRoot, ".projector/config.toml"), "utf8");
  const match = /^projectorVersion\s*=\s*"([^"]+)"/mu.exec(configSource);
  if (match === null) throw new Error("Prepared config omits projectorVersion");
  if (match[1] === target.packageIdentity.version) return undefined;
  const chain = await readCanonicalFile(join(packagedRoot, `project-data/migrations/chain-through-${target.packageIdentity.version}.json`), ProjectDataMigrationChainSchema, "packaged migration chain");
  const start = chain.manifests.findIndex((candidate) => candidate.fromVersion === match[1]);
  const manifests = start < 0 ? [] : chain.manifests.slice(start);
  if (manifests.length === 0 || manifests.at(-1)?.targetSnapshotHash !== target.snapshotHash) {
    throw new Error(`Packaged migration chain does not connect ${match[1]} to ${target.packageIdentity.version}`);
  }
  const baseline = await readCanonicalFile(join(packagedRoot, "project-data/format-baseline.json"), ProjectDataFormatSnapshotSchema, "packaged format baseline");
  const sourceFormat = match[1] === baseline.packageIdentity.version
    ? baseline
    : await readCanonicalFile(join(packagedRoot, `project-data/formats/${match[1]}.json`), ProjectDataFormatSnapshotSchema, `packaged ${match[1]} format`);
  if (sourceFormat.packageIdentity.version !== match[1] || manifests[0]!.sourceSnapshotHash !== sourceFormat.snapshotHash) {
    throw new Error(`Packaged source format does not authenticate migration edge from ${match[1]}`);
  }
  const steps: SelectedMigration["steps"][number][] = [];
  for (const edge of manifests) {
    const stepTarget = edge.targetSnapshotHash === target.snapshotHash
      ? target
      : await readCanonicalFile(join(packagedRoot, `project-data/formats/${edge.toVersion}.json`), ProjectDataFormatSnapshotSchema, `packaged ${edge.toVersion} format`);
    if (stepTarget.snapshotHash !== edge.targetSnapshotHash) throw new Error(`Packaged format descriptor does not match migration edge ${edge.id}`);
    steps.push({ targetFormat: stepTarget, transforms: edge.kind === "transform" ? edge.transforms : [], validations: edge.kind === "transform" ? edge.validations : [] });
  }
  const manifest = manifests.length === 1 ? manifests[0]! : {
    id: `migration:${match[1]}-through-${target.packageIdentity.version}`,
    manifestHash: hashFramedDomain("project-data-release-format-through-chain/v1", {
      manifestHashes: manifests.map(({ manifestHash }) => manifestHash),
      sourceSnapshotHash: sourceFormat.snapshotHash,
      targetSnapshotHash: target.snapshotHash,
    }),
  };
  return {
    manifest,
    sourceAuthority: { kind: "release-format", snapshotHash: sourceFormat.snapshotHash },
    sourceFormat,
    steps,
  };
}

async function prepareTarget(
  source: ProjectDataMigrationSourceObservation,
  stagingRoot: string,
  targetFormat: ProjectDataFormatSnapshot,
): Promise<void> {
  if (source.kind === "legacy-unversioned") {
    await prepareObservedLegacyUnversionedProjectData({
      source,
      stagingRoot,
      targetProjectorVersion: targetFormat.packageIdentity.version,
    });
    return;
  }
  // Editor schemas are release-owned persisted format. Replace them only in the
  // disposable staging tree so the immutable ordinary installer can verify the
  // complete new bundle rather than accepting files from the source release.
  await rm(join(stagingRoot, ".projector", "schemas"), { recursive: true, force: true });
  await installProjectorEditorSchemaBundle(stagingRoot);
  await writeFile(
    join(stagingRoot, ".projector/config.toml"),
    stringifyTomlDocument({
      apiVersion: targetFormat.preparedConfig.apiVersion,
      enabled: true,
      projectorVersion: targetFormat.packageIdentity.version,
    }, { schemaPath: "schemas/projector-config-v1.schema.json" }),
    "utf8",
  );
  const canonical = new CanonicalFileRepository(stagingRoot);
  const snapshot = await canonical.snapshot();
  const database = new SqliteDerivedStore(join(stagingRoot, ".projector/state.db"));
  try { await rebuildDerivedStore(canonical, database); }
  finally { database.close(); }
  if ((await canonical.snapshot()).rootDigest !== snapshot.rootDigest) throw new Error("Target preparation changed canonical meaning");
}

async function validateStagedTarget(
  stagingRoot: string,
  targetFormat: ProjectDataFormatSnapshot,
  signal: AbortSignal,
  existingFiles?: Map<string, { path: string; bytes: Buffer }>,
): Promise<void> {
  const stagedFiles = existingFiles ?? await inventoryProjectorFiles(stagingRoot);
  await observePreparedMigrationTarget({
    repositoryRoot: stagingRoot,
    targetFormat,
    authenticatedFiles: [...stagedFiles.values()].map(({ path, bytes }) => ({
      path,
      length: bytes.byteLength,
      sha256: rawSha256(bytes),
    })),
    signal,
  });
}

async function observeSource(
  repositoryRoot: string,
  selection: SelectedMigration,
  authenticatedFiles: readonly ProjectBackupManifestFile[],
  signal: AbortSignal,
): Promise<ProjectDataMigrationSourceObservation> {
  if (selection.sourceAuthority.kind === "legacy-unversioned") return inspectLegacyUnversionedProjectData(repositoryRoot);
  if (selection.sourceFormat === undefined) throw new Error("Released migration source format is unavailable");
  await observePreparedMigrationTarget({
    repositoryRoot,
    targetFormat: selection.sourceFormat,
    authenticatedFiles,
    signal,
    requireSqlite: false,
  });
  return { kind: "release-format", snapshot: selection.sourceFormat };
}

async function runArtifacts(
  packagedRoot: string,
  references: readonly ProjectDataMigrationArtifactRef[],
  kind: "transform" | "validation",
  context: Parameters<Awaited<ReturnType<typeof loadProjectDataMigrationArtifact>>["run"]>[0],
): Promise<void> {
  for (const reference of references) {
    throwIfAborted(context.signal);
    const artifact = await loadProjectDataMigrationArtifact({ packagedRoot, expectedKind: kind, reference });
    await artifact.run(context);
  }
}

async function prepareStageFromBackup(repositoryRoot: string, stagingRoot: string, files: readonly ProjectBackupManifestFile[]): Promise<void> {
  for (const file of files) {
    const source = join(repositoryRoot, ...file.path.split("/"));
    const target = join(stagingRoot, ...file.path.split("/"));
    const bytes = await readStableFile(source);
    if (bytes.byteLength !== file.length || rawSha256(bytes) !== file.sha256) throw new Error(`Source changed after backup: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: false, errorOnExist: true });
  }
}

async function mergeRetainedBackupFiles(
  repositoryRoot: string,
  stagingRoot: string,
  files: readonly ProjectBackupManifestFile[],
  retiredPaths: ReadonlySet<string>,
): Promise<void> {
  for (const file of files) {
    if (retiredPaths.has(file.path)) continue;
    const target = join(stagingRoot, ...file.path.split("/"));
    if (await exists(target)) continue;
    const source = join(repositoryRoot, ...file.path.split("/"));
    const bytes = await readStableFile(source);
    if (bytes.byteLength !== file.length || rawSha256(bytes) !== file.sha256) throw new Error(`Retained source changed after backup: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: false, errorOnExist: true });
  }
}

async function inventoryProjectorFiles(root: string): Promise<Map<string, { path: string; bytes: Buffer }>> {
  const found = new Map<string, { path: string; bytes: Buffer }>();
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Migration stage contains a symbolic link: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const relativePath = relative(root, path).replaceAll("\\", "/");
        found.set(relativePath, { path: relativePath, bytes: await readStableFile(path) });
      }
    }
  };
  await visit(join(root, ".projector"));
  return found;
}

async function readCanonicalFile<T>(path: string, schema: { parse(value: unknown): T }, label: string): Promise<T> {
  const source = (await readStableFile(path)).toString("utf8");
  const value = parseCanonicalJson(source);
  if (`${canonicalJson(value)}\n` !== source) throw new Error(`${label} does not use canonical JSON bytes`);
  return schema.parse(value);
}

async function readStableFile(path: string): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`Expected a regular non-symlink file: ${path}`);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || bytes.byteLength !== before.size) throw new Error(`File changed while reading: ${path}`);
    return bytes;
  } finally { await handle.close(); }
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return false; throw error; }
}

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
