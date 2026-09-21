import { ContentHashSchema, hashFramedDomain, type ContentHash } from "@projector/core";
import { z } from "zod";

import { PsychordObservationArtifactManifestSchema } from "./psychord-artifact-set.js";
import {
  PsychordApplicationObservationPlanSchema,
  PsychordApplicationObservationResultSchema,
} from "./psychord-contract.js";
import { PsychordEvidenceCurrentnessSchema } from "./psychord-evidence-currentness.js";

export const psychordRuntimeEvidenceSchemaOwner = "@projector/integrations/runtime-evidence" as const;
export const psychordRuntimeEvidenceValidatorModules = Object.freeze([
  "dist/runtime-evidence/agent-browser-protocol.js",
  "dist/runtime-evidence/psychord-agent-browser-host.js",
  "dist/runtime-evidence/psychord-artifact-set.js",
  "dist/runtime-evidence/psychord-contract.js",
  "dist/runtime-evidence/psychord-evidence-currentness.js",
  "dist/runtime-evidence/psychord-schema-bundle.js",
  "dist/runtime-evidence/psychord.js",
] as const);

const observedValidatorModule = z.strictObject({
  path: z.string().min(1),
  contentHash: ContentHashSchema,
});

export type PsychordRuntimeEvidenceSchemaDescriptor = {
  readonly owner: typeof psychordRuntimeEvidenceSchemaOwner;
  readonly schemas: Readonly<Record<string, z.ZodType>>;
  readonly validatorModules: typeof psychordRuntimeEvidenceValidatorModules;
};

/**
 * Returns the real public owner schemas. Release composition resolves the fixed
 * module closure against its validated candidate inventory before hashing and
 * retains these same Zod validators for refinements JSON Schema cannot represent.
 */
export function createPsychordRuntimeEvidenceSchemaDescriptor(): PsychordRuntimeEvidenceSchemaDescriptor {
  return {
    owner: psychordRuntimeEvidenceSchemaOwner,
    validatorModules: psychordRuntimeEvidenceValidatorModules,
    schemas: Object.freeze({
      PsychordApplicationObservationPlanSchema,
      PsychordApplicationObservationResultSchema,
      PsychordEvidenceCurrentnessSchema,
      PsychordObservationArtifactManifestSchema,
    }),
  };
}

export function hashPsychordRuntimeEvidenceSchemaOwner(unparsedModules: unknown): ContentHash {
  const modules = z.array(observedValidatorModule).parse(unparsedModules)
    .toSorted((left, right) => left.path.localeCompare(right.path));
  if (new Set(modules.map(({ path }) => path)).size !== modules.length
    || modules.length !== psychordRuntimeEvidenceValidatorModules.length
    || modules.some(({ path }, index) => path !== psychordRuntimeEvidenceValidatorModules[index])) {
    throw new Error("Observed Psychord validator modules do not match the exact owner-declared module closure");
  }
  return hashFramedDomain("psychord-runtime-evidence-schema-owner/v1", modules);
}
