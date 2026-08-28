import { z } from "zod";

import { CONTENT_HASH_PREFIX, type ContentHash } from "../domain/contracts.js";

export const EntityIdSchema = z.string()
  .min(1)
  .regex(
    /^(?!\s)(?!.*\s$)(?!\.$)(?!\.\.$)[^\\/\0]+$/u,
    "entity ID must be trimmed, path-independent, and free of path separators",
  );
export const ConfidenceSchema = z.number().min(0).max(1).finite();

export const ContentHashSchema = z.string()
  .refine(
    (value) => value.startsWith(CONTENT_HASH_PREFIX) && /^[0-9a-f]{64}$/u.test(value.slice(CONTENT_HASH_PREFIX.length)),
    `expected a ${CONTENT_HASH_PREFIX} content hash with 64 lowercase hexadecimal characters`,
  ) as z.ZodType<ContentHash>;

export const SourceClassSchema = z.enum(["authored", "derived", "observed", "inferred"]);

export * from "./generated-contracts.js";
