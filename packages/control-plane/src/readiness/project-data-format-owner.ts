import {
  PackageIdentitySchema,
  ContentHashSchema,
  DurableRepresentationArtifactRecordSchema,
  ProjectDataFormatSnapshotSchema,
  canonicalJson,
  exportContractJsonSchemas,
  hashFramedDomain,
  hashProjectDataFormatSnapshot,
  type ContentHash,
  type PackageIdentity,
  type ProjectDataFormatSnapshot,
} from "@projector/core";
import {
  createPsychordRuntimeEvidenceSchemaDescriptor,
  psychordRuntimeEvidenceValidatorModules,
} from "@projector/integrations/runtime-evidence";
import {
  createProjectorEditorSchemaBundle,
  currentSqliteSchemaVersion,
  sqliteMigrationSetHash,
} from "@projector/runtime";
import { z } from "zod";

const releaseRoot = "plugin/projector/runtime/projector/node_modules/@projector";
const coreRoot = `${releaseRoot}/core/dist`;
const integrationsRoot = `${releaseRoot}/integrations`;
const runtimeRoot = `${releaseRoot}/runtime/dist`;

export const preparedConfigOwnerModulePaths = Object.freeze([
  `${coreRoot}/schemas/application-evidence-binding.js`,
  `${coreRoot}/schemas/change-proposal.js`,
  `${coreRoot}/schemas/contracts.js`,
  `${coreRoot}/schemas/generated-contracts.js`,
  `${coreRoot}/schemas/registry.js`,
  `${coreRoot}/schemas/operations.js`,
  `${coreRoot}/schemas/project-config.js`,
] as const);

export const canonicalOwnerModulePaths = Object.freeze([
  `${coreRoot}/hashing/builtin-profiles.js`,
  `${coreRoot}/hashing/canonical-envelope.js`,
  `${coreRoot}/hashing/canonical-json.js`,
  `${coreRoot}/hashing/projections.js`,
  `${coreRoot}/schemas/application-evidence-binding.js`,
  `${coreRoot}/schemas/canonical-envelope.js`,
  `${coreRoot}/schemas/contracts.js`,
  `${coreRoot}/schemas/generated-contracts.js`,
  `${coreRoot}/schemas/registry.js`,
  `${runtimeRoot}/persistence/canonical-repository.js`,
  `${runtimeRoot}/persistence/project-schema-bundle.js`,
  `${runtimeRoot}/persistence/toml-codec.js`,
] as const);

export const runtimeEvidenceOwnerModulePaths = Object.freeze(
  [
    ...psychordRuntimeEvidenceValidatorModules.map((path) => `${integrationsRoot}/${path}`),
    `${coreRoot}/schemas/representation-artifact.js`,
    `${coreRoot}/schemas/project-data-migration.js`,
    `${releaseRoot}/control-plane/dist/representation/artifact-store.js`,
    `${runtimeRoot}/journal/transaction-journal.js`,
    `${runtimeRoot}/migrations/legacy-unversioned-project-data.js`,
    `${runtimeRoot}/migrations/pending-project-data-migration.js`,
    `${runtimeRoot}/migrations/project-backup.js`,
    `${runtimeRoot}/migrations/project-data-migration-receipt.js`,
    `${runtimeRoot}/migrations/project-data-migration-recovery.js`,
    `${runtimeRoot}/worktrees/writer-lease.js`,
    `${releaseRoot}/control-plane/dist/readiness/project-data-migration-artifact.js`,
    `${releaseRoot}/control-plane/dist/readiness/project-data-migration-execution.js`,
    `${releaseRoot}/control-plane/dist/readiness/project-data-migration-recovery.js`,
    `${releaseRoot}/control-plane/dist/readiness/project-data-migration-target.js`,
  ],
);

export interface ValidatedReleaseCandidateInventory {
  readonly packageIdentity: PackageIdentity;
  readonly files: readonly { readonly path: string; readonly digest: ContentHash }[];
}

export function createReleaseCandidateProjectDataFormat(input: {
  readonly candidate: ValidatedReleaseCandidateInventory;
}): ProjectDataFormatSnapshot {
  const packageIdentity = PackageIdentitySchema.parse(input.candidate.packageIdentity);
  const schemas = exportContractJsonSchemas();
  const preparedSchema = schemas.PreparedProjectorConfig;
  if (preparedSchema === undefined) throw new Error("Prepared config JSON Schema is unavailable");
  const editorBundle = createProjectorEditorSchemaBundle();
  const runtimeDescriptor = createPsychordRuntimeEvidenceSchemaDescriptor();
  const runtimeSchemas: Record<string, unknown> = Object.fromEntries(Object.entries(runtimeDescriptor.schemas).sort(([left], [right]) => left.localeCompare(right)).map(
    ([name, schema]) => [name, z.toJSONSchema(schema, { target: "draft-2020-12", reused: "ref", cycles: "ref", io: "input" })],
  ));
  runtimeSchemas.DurableRepresentationArtifactRecord = z.toJSONSchema(DurableRepresentationArtifactRecordSchema, {
    target: "draft-2020-12",
    reused: "ref",
    cycles: "ref",
    io: "input",
  });
  for (const name of [
    "LegacyUnversionedProjectDataSource",
    "PendingProjectDataMigration",
    "ProjectDataLegacyIngressManifest",
    "ProjectDataMigrationReceipt",
    "ProjectDataMigrationSourceAuthority",
  ] as const) {
    const schema = schemas[name];
    if (schema === undefined) throw new Error(`${name} JSON Schema is unavailable`);
    runtimeSchemas[name] = schema;
  }
  const preparedConfig = ownerHash("prepared-config", canonicalJson(preparedSchema), preparedConfigOwnerModulePaths, input.candidate.files);
  const canonical = ownerHash("canonical", canonicalJson(editorBundle), canonicalOwnerModulePaths, input.candidate.files);
  const runtimeEvidence = ownerHash("runtime-evidence", canonicalJson(runtimeSchemas), runtimeEvidenceOwnerModulePaths, input.candidate.files);
  const body = {
    apiVersion: "projector.project-data-format-snapshot/v1" as const,
    packageIdentity,
    preparedConfig: {
      apiVersion: "projector.config/v1" as const,
      projectorVersion: packageIdentity.version,
      schemaHash: preparedConfig,
    },
    canonical: { envelopeApiVersion: "projector/v2" as const, schemaBundleHash: canonical },
    runtimeEvidence: { schemaVersion: packageIdentity.version, schemaHash: runtimeEvidence },
    sqlite: { schemaVersion: currentSqliteSchemaVersion, migrationSetHash: sqliteMigrationSetHash },
  };
  return ProjectDataFormatSnapshotSchema.parse({ ...body, snapshotHash: hashProjectDataFormatSnapshot(body) });
}

function ownerHash(
  kind: "prepared-config" | "canonical" | "runtime-evidence",
  schemaBytes: string,
  paths: readonly string[],
  candidateFiles: ValidatedReleaseCandidateInventory["files"],
): ContentHash {
  const inventory = new Map<string, ContentHash>();
  for (const file of candidateFiles) {
    if (inventory.has(file.path)) throw new Error(`Release candidate inventory repeats ${file.path}`);
    inventory.set(file.path, ContentHashSchema.parse(file.digest));
  }
  const files = paths.map((path) => {
    const digest = inventory.get(path);
    if (digest === undefined) throw new Error(`Release candidate omits ${kind} owner module ${path}`);
    return { path, digest };
  });
  return hashFramedDomain("project-data-format-owner-closure/v1", {
    kind,
    schemaBytesHash: hashFramedDomain("project-data-format-schema-bytes/v1", schemaBytes),
    files,
  });
}
