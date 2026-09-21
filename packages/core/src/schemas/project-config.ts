import { z } from "zod";

import { PackageVersionSchema } from "./operations.js";

export const projectorConfigApiVersion = "projector.config/v3" as const;

export const PreparedProjectorConfigSchema = z.object({
  apiVersion: z.literal(projectorConfigApiVersion),
  enabled: z.literal(true),
  projectorVersion: PackageVersionSchema,
}).strict();

// Configuration declares the authored format. Package versions record provenance;
// a patch release does not change the format or require a data migration.
export const ProjectorConfigSchema = PreparedProjectorConfigSchema;

export type ProjectorConfig = z.infer<typeof ProjectorConfigSchema>;
export type PreparedProjectorConfig = z.infer<typeof PreparedProjectorConfigSchema>;

export function parseProjectorConfig(value: unknown): ProjectorConfig {
  return ProjectorConfigSchema.parse(value);
}

export function parsePreparedProjectorConfig(value: unknown): PreparedProjectorConfig {
  return PreparedProjectorConfigSchema.parse(value);
}
