import { z } from "zod";

import type { ContentHash } from "../domain/contracts.js";

export const EntityIdSchema = z.string()
  .min(1)
  .regex(
    /^(?!\s)(?!.*\s$)(?!\.$)(?!\.\.$)[^\\/\0]+$/u,
    "entity ID must be trimmed, path-independent, and free of path separators",
  );
export const ConfidenceSchema = z.number().min(0).max(1).finite();

export const ContentHashSchema = z.string()
  .regex(
    /^sha256:v1:[0-9a-f]{64}$/u,
    "expected a sha256:v1 content hash with 64 lowercase hexadecimal characters",
  ) as z.ZodType<ContentHash>;

export const SourceClassSchema = z.enum(["authored", "derived", "observed", "inferred"]);

export * from "./generated-contracts.js";
