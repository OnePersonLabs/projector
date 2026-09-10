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

// The public configuration contract is the prepared, version-bound format.
// Legacy input remains available only through its explicitly named migration schema.
export const ProjectorConfigSchema = PreparedProjectorConfigSchema;

export type ProjectorConfig = z.infer<typeof ProjectorConfigSchema>;
export type LegacyUnversionedProjectorConfig = z.infer<typeof LegacyUnversionedProjectorConfigSchema>;
export type PreparedProjectorConfig = z.infer<typeof PreparedProjectorConfigSchema>;

export function parseProjectorConfig(value: unknown): ProjectorConfig {
  return ProjectorConfigSchema.parse(value);
}

export function parseLegacyUnversionedProjectorConfig(value: unknown): LegacyUnversionedProjectorConfig {
  return LegacyUnversionedProjectorConfigSchema.parse(value);
}

export function parsePreparedProjectorConfig(value: unknown): PreparedProjectorConfig {
  return PreparedProjectorConfigSchema.parse(value);
}
