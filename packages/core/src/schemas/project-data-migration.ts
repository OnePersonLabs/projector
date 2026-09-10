import { z } from "zod";

import { hashFramedDomain } from "../hashing/canonical-json.js";
import { ContentHashSchema } from "./contracts.js";
import { PackageIdentitySchema, PackageVersionSchema } from "./operations.js";

export const projectDataFormatSnapshotApiVersion = "projector.project-data-format-snapshot/v1" as const;
export const projectDataMigrationManifestApiVersion = "projector.project-data-migration-manifest/v1" as const;
export const projectDataMigrationChainApiVersion = "projector.data-migration-chain/v1" as const;
export const projectDataMigrationDraftApiVersion = "projector.project-data-migration-draft/v1" as const;
export const pendingProjectDataMigrationApiVersion = "projector.pending-project-data-migration/v1" as const;
export const projectDataMigrationReceiptApiVersion = "projector.project-data-migration-receipt/v1" as const;

export const PortableRelativePathSchema = z.string().min(1).max(1_024).regex(
  /^(?!\/)(?!.*:)(?!.*\\)(?!.*\0)(?!.*\/\/)(?!.*[. ](?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.[^/]*)?(?:\/|$))(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u,
  "must be a portable canonical relative path without aliases, device names, or alternate data streams",
);

const migrationRelativePathSchema = PortableRelativePathSchema;

const stableId = z.string().min(1).max(512).regex(
  /^[a-z0-9][a-z0-9._:-]*$/u,
  "must be a stable lowercase identifier",
);

const projectDataMigrationBackupRefSchema = z.strictObject({
  id: stableId,
  location: z.strictObject({
    kind: z.literal("codex-data-relative"),
    path: migrationRelativePathSchema,
  }),
  manifestHash: ContentHashSchema,
});

export const ProjectDataMigrationArtifactRefSchema = z.strictObject({
  id: stableId,
  relativePath: migrationRelativePathSchema,
  contentHash: ContentHashSchema,
});

export type ProjectDataMigrationArtifactRef = z.infer<typeof ProjectDataMigrationArtifactRefSchema>;

const ProjectDataFormatSnapshotBodySchema = z.strictObject({
  apiVersion: z.literal(projectDataFormatSnapshotApiVersion),
  packageIdentity: PackageIdentitySchema,
  preparedConfig: z.strictObject({
    apiVersion: z.literal("projector.config/v1"),
    projectorVersion: PackageVersionSchema,
    schemaHash: ContentHashSchema,
  }),
  canonical: z.strictObject({
    envelopeApiVersion: z.literal("projector/v2"),
    schemaBundleHash: ContentHashSchema,
  }),
  runtimeEvidence: z.strictObject({
    schemaVersion: PackageVersionSchema,
    schemaHash: ContentHashSchema,
  }),
  sqlite: z.strictObject({
    schemaVersion: z.number().int().nonnegative(),
    migrationSetHash: ContentHashSchema,
  }),
});

export type ProjectDataFormatSnapshotInput = z.infer<typeof ProjectDataFormatSnapshotBodySchema>;

export function hashProjectDataFormatSnapshot(input: ProjectDataFormatSnapshotInput) {
  return hashFramedDomain("project-data-format-snapshot:v1", ProjectDataFormatSnapshotBodySchema.parse(input));
}

export const ProjectDataFormatSnapshotSchema = ProjectDataFormatSnapshotBodySchema.extend({
  snapshotHash: ContentHashSchema,
}).superRefine((snapshot, context) => {
  const { snapshotHash, ...body } = snapshot;
  if (snapshotHash !== hashProjectDataFormatSnapshot(body)) {
    context.addIssue({
      code: "custom",
      message: "snapshotHash does not authenticate the project-data format snapshot",
      path: ["snapshotHash"],
    });
  }
});

export type ProjectDataFormatSnapshot = z.infer<typeof ProjectDataFormatSnapshotSchema>;

type ParsedSemVer = {
  readonly core: readonly [bigint, bigint, bigint];
  readonly prerelease: readonly string[] | undefined;
};

function parsePackageVersion(value: string): ParsedSemVer {
  PackageVersionSchema.parse(value);
  const withoutBuild = value.split("+", 1)[0]!;
  const separator = withoutBuild.indexOf("-");
  const coreText = separator === -1 ? withoutBuild : withoutBuild.slice(0, separator);
  const prerelease = separator === -1 ? undefined : withoutBuild.slice(separator + 1).split(".");
  const [major, minor, patch] = coreText.split(".").map((part) => BigInt(part));
  return { core: [major!, minor!, patch!], prerelease };
}

export function comparePackageVersions(left: string, right: string): number {
  const leftVersion = parsePackageVersion(left);
  const rightVersion = parsePackageVersion(right);
  for (let index = 0; index < leftVersion.core.length; index += 1) {
    if (leftVersion.core[index]! < rightVersion.core[index]!) return -1;
    if (leftVersion.core[index]! > rightVersion.core[index]!) return 1;
  }
  if (leftVersion.prerelease === undefined) return rightVersion.prerelease === undefined ? 0 : 1;
  if (rightVersion.prerelease === undefined) return -1;
  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/u.test(leftPart);
    const rightNumeric = /^\d+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) return BigInt(leftPart) < BigInt(rightPart) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

const migrationManifestBaseFields = {
  apiVersion: z.literal(projectDataMigrationManifestApiVersion),
  id: stableId,
  fromVersion: PackageVersionSchema,
  toVersion: PackageVersionSchema,
  sourceSnapshotHash: ContentHashSchema,
  targetSnapshotHash: ContentHashSchema,
} as const;

const projectDataMigrationManifestBodySchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...migrationManifestBaseFields, kind: z.literal("no-data-change") }),
  z.strictObject({
    ...migrationManifestBaseFields,
    kind: z.literal("transform"),
    transforms: z.array(ProjectDataMigrationArtifactRefSchema).min(1).max(256),
    validations: z.array(ProjectDataMigrationArtifactRefSchema).min(1).max(256),
  }),
]);

export type ProjectDataMigrationManifestInput = z.infer<typeof projectDataMigrationManifestBodySchema>;

export function hashProjectDataMigrationManifest(input: ProjectDataMigrationManifestInput) {
  return hashFramedDomain("project-data-migration-manifest:v1", projectDataMigrationManifestBodySchema.parse(input));
}

export const ProjectDataMigrationManifestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...migrationManifestBaseFields, kind: z.literal("no-data-change"), manifestHash: ContentHashSchema }),
  z.strictObject({
    ...migrationManifestBaseFields,
    kind: z.literal("transform"),
    transforms: z.array(ProjectDataMigrationArtifactRefSchema).min(1).max(256),
    validations: z.array(ProjectDataMigrationArtifactRefSchema).min(1).max(256),
    manifestHash: ContentHashSchema,
  }),
]).superRefine((manifest, context) => {
  if (comparePackageVersions(manifest.fromVersion, manifest.toVersion) >= 0) {
    context.addIssue({
      code: "custom",
      path: ["toVersion"],
      message: "migration target version must be numerically greater than source version",
    });
  }
  const { manifestHash, ...body } = manifest;
  if (manifestHash !== hashFramedDomain("project-data-migration-manifest:v1", body)) {
    context.addIssue({
      code: "custom",
      path: ["manifestHash"],
      message: "manifestHash does not authenticate the strict migration manifest body",
    });
  }
});

export type ProjectDataMigrationManifest = z.infer<typeof ProjectDataMigrationManifestSchema>;

export function createProjectDataMigrationManifest(input: ProjectDataMigrationManifestInput): ProjectDataMigrationManifest {
  const body = projectDataMigrationManifestBodySchema.parse(input);
  return ProjectDataMigrationManifestSchema.parse({ ...body, manifestHash: hashProjectDataMigrationManifest(body) });
}

export const ProjectDataMigrationChainSchema = z.strictObject({
  apiVersion: z.literal(projectDataMigrationChainApiVersion),
  manifests: z.array(ProjectDataMigrationManifestSchema).min(1).max(256),
}).superRefine(({ manifests }, context) => {
  const ids = new Set<string>();
  for (let index = 0; index < manifests.length; index += 1) {
    const manifest = manifests[index]!;
    if (ids.has(manifest.id)) {
      context.addIssue({ code: "custom", path: ["manifests", index, "id"], message: "migration manifest IDs must be unique within a chain" });
    }
    ids.add(manifest.id);
    const previous = manifests[index - 1];
    if (previous === undefined) continue;
    if (previous.toVersion !== manifest.fromVersion) {
      context.addIssue({ code: "custom", path: ["manifests", index, "fromVersion"], message: "migration versions must form a contiguous declared chain" });
    }
    if (previous.targetSnapshotHash !== manifest.sourceSnapshotHash) {
      context.addIssue({ code: "custom", path: ["manifests", index, "sourceSnapshotHash"], message: "migration snapshot hashes must form a contiguous declared chain" });
    }
    if (comparePackageVersions(previous.toVersion, manifest.toVersion) >= 0) {
      context.addIssue({ code: "custom", path: ["manifests", index, "toVersion"], message: "migration chain versions must be strictly increasing" });
    }
  }
});

export type ProjectDataMigrationChain = z.infer<typeof ProjectDataMigrationChainSchema>;

export const ProjectDataMigrationDraftSchema = z.strictObject({
  apiVersion: z.literal(projectDataMigrationDraftApiVersion),
  sourceSnapshot: ProjectDataFormatSnapshotSchema,
  targetSnapshot: ProjectDataFormatSnapshotSchema,
  operations: z.array(ProjectDataMigrationArtifactRefSchema).max(256),
  customTransforms: z.array(ProjectDataMigrationArtifactRefSchema).max(256),
  validations: z.array(ProjectDataMigrationArtifactRefSchema).max(256),
});

export type ProjectDataMigrationDraft = z.infer<typeof ProjectDataMigrationDraftSchema>;

export const PendingProjectDataMigrationSchema = z.strictObject({
  apiVersion: z.literal(pendingProjectDataMigrationApiVersion),
  attemptId: stableId,
  migrationId: stableId,
  sourceSnapshotHash: ContentHashSchema,
  targetSnapshotHash: ContentHashSchema,
  manifestHash: ContentHashSchema,
  backup: projectDataMigrationBackupRefSchema,
  stagingLocation: migrationRelativePathSchema,
  phase: z.enum(["backed-up", "staged", "publishing"]),
  createdAt: z.iso.datetime({ offset: true }),
});

export type PendingProjectDataMigration = z.infer<typeof PendingProjectDataMigrationSchema>;

const projectDataMigrationReceiptBodyFields = {
  apiVersion: z.literal(projectDataMigrationReceiptApiVersion),
  attemptId: stableId,
  migrationId: stableId,
  manifestHash: ContentHashSchema,
  sourceSnapshotHash: ContentHashSchema,
  targetSnapshotHash: ContentHashSchema,
  journalId: stableId,
  journalHash: ContentHashSchema,
  backup: projectDataMigrationBackupRefSchema,
  outcome: z.literal("completed"),
  completedAt: z.iso.datetime({ offset: true }),
} as const;

function requireAttemptJournalIdentity(
  receipt: { readonly attemptId: string; readonly journalId: string },
  context: z.RefinementCtx,
): boolean {
  if (receipt.journalId !== receipt.attemptId) {
    context.addIssue({
      code: "custom",
      path: ["journalId"],
      message: "migration receipt journalId must equal its unique attemptId",
    });
    return false;
  }
  return true;
}

const projectDataMigrationReceiptBodySchema = z.strictObject(projectDataMigrationReceiptBodyFields)
  .superRefine((receipt, context) => {
    requireAttemptJournalIdentity(receipt, context);
  });

export type ProjectDataMigrationReceiptInput = z.infer<typeof projectDataMigrationReceiptBodySchema>;

export function hashProjectDataMigrationReceipt(input: ProjectDataMigrationReceiptInput) {
  return hashFramedDomain(
    "project-data-migration-receipt:v1",
    projectDataMigrationReceiptBodySchema.parse(input),
  );
}

export const ProjectDataMigrationReceiptSchema = z.strictObject({
  ...projectDataMigrationReceiptBodyFields,
  receiptHash: ContentHashSchema,
}).superRefine((receipt, context) => {
  if (!requireAttemptJournalIdentity(receipt, context)) return;
  const { receiptHash, ...body } = receipt;
  if (receiptHash !== hashProjectDataMigrationReceipt(body)) {
    context.addIssue({
      code: "custom",
      path: ["receiptHash"],
      message: "migration receipt hash does not match the strict receipt body",
    });
  }
});

export type ProjectDataMigrationReceipt = z.infer<typeof ProjectDataMigrationReceiptSchema>;

export function createProjectDataMigrationReceipt(input: ProjectDataMigrationReceiptInput): ProjectDataMigrationReceipt {
  const body = projectDataMigrationReceiptBodySchema.parse(input);
  return ProjectDataMigrationReceiptSchema.parse({
    ...body,
    receiptHash: hashProjectDataMigrationReceipt(body),
  });
}
