import { z } from "zod";

export const projectorConfigApiVersion = "projector.config/v1" as const;

export const ProjectorConfigSchema = z.object({
  apiVersion: z.literal(projectorConfigApiVersion),
  enabled: z.literal(true),
}).strict();

export type ProjectorConfig = z.infer<typeof ProjectorConfigSchema>;

export const defaultProjectorConfig: ProjectorConfig = Object.freeze({
  apiVersion: projectorConfigApiVersion,
  enabled: true,
});

export function parseProjectorConfig(value: unknown): ProjectorConfig {
  return ProjectorConfigSchema.parse(value);
}
