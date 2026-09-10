import type { z } from "zod";

import { PsychordObservationArtifactManifestSchema } from "./psychord-artifact-set.js";
import {
  PsychordApplicationObservationPlanSchema,
  PsychordApplicationObservationResultSchema,
} from "./psychord-contract.js";
import { PsychordEvidenceCurrentnessSchema } from "./psychord-evidence-currentness.js";

export const psychordRuntimeEvidenceSchemaOwner = "@projector/integrations/runtime-evidence" as const;

export type PsychordRuntimeEvidenceSchemaDescriptor = {
  readonly owner: typeof psychordRuntimeEvidenceSchemaOwner;
  readonly schemas: Readonly<Record<string, z.ZodType>>;
};

/**
 * Returns the real public owner schemas. The authenticated release composition adds
 * PackageIdentity before canonicalizing JSON Schema projections and retains these
 * same Zod validators for semantic refinements that JSON Schema cannot represent.
 */
export function createPsychordRuntimeEvidenceSchemaDescriptor(): PsychordRuntimeEvidenceSchemaDescriptor {
  return {
    owner: psychordRuntimeEvidenceSchemaOwner,
    schemas: Object.freeze({
      PsychordApplicationObservationPlanSchema,
      PsychordApplicationObservationResultSchema,
      PsychordEvidenceCurrentnessSchema,
      PsychordObservationArtifactManifestSchema,
    }),
  };
}
