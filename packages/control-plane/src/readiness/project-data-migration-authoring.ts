import {
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationDraftSchema,
  ProjectDataMigrationManifestSchema,
  comparePackageVersions,
  hashFramedDomain,
  type ContentHash,
  type ProjectDataFormatSnapshot,
  type ProjectDataMigrationArtifactRef,
  type ProjectDataMigrationDraft,
  type ProjectDataMigrationManifest,
} from "@projector/core";

import type { ValidatedReleaseCandidateInventory } from "./project-data-format-owner.js";

export const projectDataFormatDimensions = [
  "prepared-config",
  "canonical",
  "runtime-evidence",
  "sqlite",
] as const;

export type ProjectDataFormatDimension = (typeof projectDataFormatDimensions)[number];

export function compareProjectDataFormats(
  unparsedSource: ProjectDataFormatSnapshot,
  unparsedTarget: ProjectDataFormatSnapshot,
): readonly ProjectDataFormatDimension[] {
  const source = ProjectDataFormatSnapshotSchema.parse(unparsedSource);
  const target = ProjectDataFormatSnapshotSchema.parse(unparsedTarget);
  requireReleaseProgression(source, target);
  const changed: ProjectDataFormatDimension[] = [];
  if (source.preparedConfig.apiVersion !== target.preparedConfig.apiVersion ||
      source.preparedConfig.schemaHash !== target.preparedConfig.schemaHash) changed.push("prepared-config");
  if (source.canonical.envelopeApiVersion !== target.canonical.envelopeApiVersion ||
      source.canonical.schemaBundleHash !== target.canonical.schemaBundleHash) changed.push("canonical");
  if (source.runtimeEvidence.schemaHash !== target.runtimeEvidence.schemaHash) changed.push("runtime-evidence");
  if (source.sqlite.schemaVersion !== target.sqlite.schemaVersion ||
      source.sqlite.migrationSetHash !== target.sqlite.migrationSetHash) changed.push("sqlite");
  return changed;
}

export function createProjectDataMigrationDraft(input: {
  readonly sourceSnapshot: ProjectDataFormatSnapshot;
  readonly targetSnapshot: ProjectDataFormatSnapshot;
  readonly operations?: readonly ProjectDataMigrationArtifactRef[];
  readonly customTransforms?: readonly ProjectDataMigrationArtifactRef[];
  readonly validations?: readonly ProjectDataMigrationArtifactRef[];
}): ProjectDataMigrationDraft {
  compareProjectDataFormats(input.sourceSnapshot, input.targetSnapshot);
  const draft = ProjectDataMigrationDraftSchema.parse({
    apiVersion: "projector.project-data-migration-draft/v1",
    sourceSnapshot: input.sourceSnapshot,
    targetSnapshot: input.targetSnapshot,
    operations: input.operations ?? [],
    customTransforms: input.customTransforms ?? [],
    validations: input.validations ?? [],
  });
  requireUniqueArtifacts([...draft.operations, ...draft.customTransforms, ...draft.validations]);
  return draft;
}

export function createReleaseCandidateProjectDataMigration(input: {
  readonly id: string;
  readonly draft: ProjectDataMigrationDraft;
  readonly candidate: ValidatedReleaseCandidateInventory;
}): ProjectDataMigrationManifest {
  const draft = ProjectDataMigrationDraftSchema.parse(input.draft);
  const changes = compareProjectDataFormats(draft.sourceSnapshot, draft.targetSnapshot);
  if (input.candidate.packageIdentity.name !== draft.targetSnapshot.packageIdentity.name ||
      input.candidate.packageIdentity.version !== draft.targetSnapshot.packageIdentity.version) {
    throw new Error("Authenticated release candidate identity does not match the migration target release");
  }
  const transforms = [...draft.operations, ...draft.customTransforms];
  requireUniqueArtifacts([...transforms, ...draft.validations]);
  if (changes.length === 0 && (transforms.length > 0 || draft.validations.length > 0)) {
    throw new Error("A release with no project-data format change cannot publish migration artifacts");
  }
  if (changes.length > 0 && (transforms.length === 0 || draft.validations.length === 0)) {
    throw new Error(`Changed project-data formats require ordered transforms and validations: ${changes.join(", ")}`);
  }
  const inventory = new Map(input.candidate.files.map((file) => [file.path, file.digest] as const));
  for (const artifact of [...transforms, ...draft.validations]) {
    if (inventory.get(artifact.relativePath) !== artifact.contentHash) {
      throw new Error(`Migration artifact is absent or changed in the authenticated release candidate: ${artifact.relativePath}`);
    }
  }
  const body = changes.length === 0 ? {
    apiVersion: "projector.project-data-migration-manifest/v1" as const,
    id: input.id,
    fromVersion: draft.sourceSnapshot.packageIdentity.version,
    toVersion: draft.targetSnapshot.packageIdentity.version,
    sourceSnapshotHash: draft.sourceSnapshot.snapshotHash,
    targetSnapshotHash: draft.targetSnapshot.snapshotHash,
    kind: "no-data-change" as const,
  } : {
    apiVersion: "projector.project-data-migration-manifest/v1" as const,
    id: input.id,
    fromVersion: draft.sourceSnapshot.packageIdentity.version,
    toVersion: draft.targetSnapshot.packageIdentity.version,
    sourceSnapshotHash: draft.sourceSnapshot.snapshotHash,
    targetSnapshotHash: draft.targetSnapshot.snapshotHash,
    kind: "transform" as const,
    transforms,
    validations: draft.validations,
  };
  return ProjectDataMigrationManifestSchema.parse({
    ...body,
    manifestHash: hashProjectDataMigrationManifestBody(body),
  });
}

export function verifyProjectDataMigrationManifest(manifest: ProjectDataMigrationManifest): ProjectDataMigrationManifest {
  const parsed = ProjectDataMigrationManifestSchema.parse(manifest);
  const { manifestHash, ...body } = parsed;
  if (manifestHash !== hashProjectDataMigrationManifestBody(body)) {
    throw new Error("Project-data migration manifest hash does not authenticate its strict body");
  }
  return parsed;
}

function hashProjectDataMigrationManifestBody(body: Omit<ProjectDataMigrationManifest, "manifestHash">): ContentHash {
  return hashFramedDomain("project-data-migration-manifest:v1", body);
}

function requireReleaseProgression(source: ProjectDataFormatSnapshot, target: ProjectDataFormatSnapshot): void {
  if (source.packageIdentity.name !== target.packageIdentity.name) {
    throw new Error("Project-data migration releases must belong to the same package");
  }
  if (comparePackageVersions(source.packageIdentity.version, target.packageIdentity.version) >= 0) {
    throw new Error("Project-data migration target release must be newer than its source release");
  }
}

function requireUniqueArtifacts(artifacts: readonly ProjectDataMigrationArtifactRef[]): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const artifact of artifacts) {
    if (ids.has(artifact.id)) throw new Error(`Project-data migration artifact ID is repeated: ${artifact.id}`);
    if (paths.has(artifact.relativePath)) throw new Error(`Project-data migration artifact path is repeated: ${artifact.relativePath}`);
    ids.add(artifact.id);
    paths.add(artifact.relativePath);
  }
}
