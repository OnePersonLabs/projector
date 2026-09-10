import { describe, expect, it } from "vitest";

import { PsychordObservationArtifactManifestSchema } from "./psychord-artifact-set.js";
import {
  PsychordApplicationObservationPlanSchema,
  PsychordApplicationObservationResultSchema,
} from "./psychord-contract.js";
import { PsychordEvidenceCurrentnessSchema } from "./psychord-evidence-currentness.js";
import {
  createPsychordRuntimeEvidenceSchemaDescriptor,
  psychordRuntimeEvidenceSchemaOwner,
} from "./psychord-schema-bundle.js";

describe("Psychord runtime evidence schema descriptor", () => {
  it("selects the exact public owner schemas in deterministic export-name order", () => {
    const descriptor = createPsychordRuntimeEvidenceSchemaDescriptor();
    expect(descriptor.owner).toBe(psychordRuntimeEvidenceSchemaOwner);
    expect(Object.entries(descriptor.schemas)).toEqual([
      ["PsychordApplicationObservationPlanSchema", PsychordApplicationObservationPlanSchema],
      ["PsychordApplicationObservationResultSchema", PsychordApplicationObservationResultSchema],
      ["PsychordEvidenceCurrentnessSchema", PsychordEvidenceCurrentnessSchema],
      ["PsychordObservationArtifactManifestSchema", PsychordObservationArtifactManifestSchema],
    ]);
  });
});
