import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ProjectDataMigrationArtifactRefSchema,
  type ProjectDataFormatSnapshot,
  type ProjectDataMigrationArtifactRef,
  type ProjectDataMigrationSourceAuthority,
} from "@projector/core";
import type { LegacyUnversionedProjectDataObservation } from "@projector/runtime";
import { z } from "zod";

const artifactApiVersion = "projector.project-data-migration-artifact/v1" as const;
const maximumArtifactBytes = 16 * 1024 * 1024;

export const ProjectDataMigrationTransformResultSchema = z.strictObject({
  apiVersion: z.literal("projector.project-data-migration-transform-result/v1"),
  status: z.literal("prepared"),
});

export const ProjectDataMigrationValidationResultSchema = z.strictObject({
  apiVersion: z.literal("projector.project-data-migration-validation-result/v1"),
  status: z.literal("passed"),
});

export type ProjectDataMigrationTransformResult = z.infer<typeof ProjectDataMigrationTransformResultSchema>;
export type ProjectDataMigrationValidationResult = z.infer<typeof ProjectDataMigrationValidationResultSchema>;

export type ProjectDataMigrationSourceObservation =
  | LegacyUnversionedProjectDataObservation
  | {
      readonly kind: "release-format";
      readonly snapshot: ProjectDataFormatSnapshot;
    };

export interface ProjectDataMigrationArtifactContext {
  readonly sourceAuthority: ProjectDataMigrationSourceAuthority;
  readonly targetFormat: ProjectDataFormatSnapshot;
  readonly source: ProjectDataMigrationSourceObservation;
  readonly stagingRoot: string;
  readonly signal: AbortSignal;
}

export interface LoadedProjectDataMigrationArtifact<TKind extends "transform" | "validation"> {
  readonly apiVersion: typeof artifactApiVersion;
  readonly id: string;
  readonly kind: TKind;
  readonly run: (
    context: ProjectDataMigrationArtifactContext,
  ) => Promise<TKind extends "transform" ? ProjectDataMigrationTransformResult : ProjectDataMigrationValidationResult>;
}

export async function loadProjectDataMigrationArtifact<TKind extends "transform" | "validation">(input: {
  readonly packagedRoot: string;
  readonly expectedKind: TKind;
  readonly reference: ProjectDataMigrationArtifactRef;
}): Promise<LoadedProjectDataMigrationArtifact<TKind>> {
  const reference = ProjectDataMigrationArtifactRefSchema.parse(input.reference);
  const prefix = "project-data/migrations/artifacts/";
  if (!reference.relativePath.startsWith(prefix) || !reference.relativePath.endsWith(".mjs")) {
    throw new Error(`Migration artifact is outside the packaged artifact root: ${reference.relativePath}`);
  }
  const projectDataRoot = resolve(input.packagedRoot, "project-data");
  const path = resolve(input.packagedRoot, ...reference.relativePath.split("/"));
  const contained = relative(projectDataRoot, path);
  if (contained.length === 0 || isAbsolute(contained) || contained === ".." || contained.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`Migration artifact escapes the packaged project-data root: ${reference.relativePath}`);
  }
  const bytes = await readArtifact(path);
  const observedHash = `sha256:v1:${createHash("sha256").update(bytes).digest("hex")}`;
  if (observedHash !== reference.contentHash) throw new Error(`Migration artifact content hash does not match its manifest reference: ${reference.relativePath}`);
  const imported = await import(`${pathToFileURL(path).href}?contentHash=${reference.contentHash.slice("sha256:v1:".length)}`) as Record<string, unknown>;
  const moduleResult = z.strictObject({
    projectDataMigrationArtifact: z.strictObject({
      apiVersion: z.literal(artifactApiVersion),
      id: z.string().min(1).max(512),
      kind: z.enum(["transform", "validation"]),
      run: z.custom<(context: ProjectDataMigrationArtifactContext) => Promise<unknown>>((value) => typeof value === "function"),
    }),
  }).safeParse(imported);
  if (!moduleResult.success) throw new Error(`Migration artifact module has an invalid export: ${reference.relativePath}: ${moduleResult.error.message}`);
  const artifact = moduleResult.data.projectDataMigrationArtifact;
  if (artifact.id !== reference.id) throw new Error(`Migration artifact ID does not match its manifest reference: ${reference.relativePath}`);
  if (artifact.kind !== input.expectedKind) throw new Error(`Migration artifact kind does not match its manifest position: ${reference.relativePath}`);
  if (input.expectedKind === "transform") {
    return {
      apiVersion: artifact.apiVersion,
      id: artifact.id,
      kind: "transform",
      run: async (context) => ProjectDataMigrationTransformResultSchema.parse(await artifact.run(context)),
    } as LoadedProjectDataMigrationArtifact<TKind>;
  }
  return {
    apiVersion: artifact.apiVersion,
    id: artifact.id,
    kind: "validation",
    run: async (context) => ProjectDataMigrationValidationResultSchema.parse(await artifact.run(context)),
  } as LoadedProjectDataMigrationArtifact<TKind>;
}

async function readArtifact(path: string): Promise<Buffer> {
  const before = await lstat(path);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`Migration artifact must be a regular non-symlink file: ${path}`);
  if (before.size > maximumArtifactBytes) throw new Error(`Migration artifact exceeds ${maximumArtifactBytes} bytes: ${path}`);
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      throw new Error(`Migration artifact changed before reading: ${path}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new Error(`Migration artifact changed while reading: ${path}`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
