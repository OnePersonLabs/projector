import { z } from "zod";

import { PackageVersionSchema } from "./operations.js";

export const projectorConfigApiVersion = "projector.config/v1" as const;

export const LegacyUnversionedProjectorConfigSchema = z.object({
  apiVersion: z.literal(projectorConfigApiVersion),
  enabled: z.literal(true),
}).strict();

export const PreparedProjectorConfigSchema = z.object({
  apiVersion: z.literal(projectorConfigApiVersion),
  enabled: z.literal(true),
  projectorVersion: PackageVersionSchema,
}).strict();

// Transitional alias for current readers. Task 6A switches readers and writers
// atomically after Projector's own configuration has been staged and verified.
export const ProjectorConfigSchema = LegacyUnversionedProjectorConfigSchema;

export type ProjectorConfig = z.infer<typeof ProjectorConfigSchema>;
export type LegacyUnversionedProjectorConfig = z.infer<typeof LegacyUnversionedProjectorConfigSchema>;
export type PreparedProjectorConfig = z.infer<typeof PreparedProjectorConfigSchema>;

export const defaultProjectorConfig: ProjectorConfig = Object.freeze({
  apiVersion: projectorConfigApiVersion,
  enabled: true,
});

export function parseProjectorConfig(value: unknown): ProjectorConfig {
  return ProjectorConfigSchema.parse(value);
}

export function parseLegacyUnversionedProjectorConfig(value: unknown): LegacyUnversionedProjectorConfig {
  return LegacyUnversionedProjectorConfigSchema.parse(value);
}

export function parsePreparedProjectorConfig(value: unknown): PreparedProjectorConfig {
  return PreparedProjectorConfigSchema.parse(value);
}
