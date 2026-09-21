import { describe, expect, it } from "vitest";

import { PsychordObservationArtifactManifestSchema } from "./psychord-artifact-set.js";
import {
  PsychordApplicationObservationPlanSchema,
  PsychordApplicationObservationResultSchema,
} from "./psychord-contract.js";
import { PsychordEvidenceCurrentnessSchema } from "./psychord-evidence-currentness.js";
import {
  createPsychordRuntimeEvidenceSchemaDescriptor,
  hashPsychordRuntimeEvidenceSchemaOwner,
  psychordRuntimeEvidenceSchemaOwner,
  psychordRuntimeEvidenceValidatorModules,
} from "./psychord-schema-bundle.js";

describe("Psychord runtime evidence schema descriptor", () => {
  it("selects the exact public owner schemas in deterministic export-name order", () => {
    const descriptor = createPsychordRuntimeEvidenceSchemaDescriptor();
    expect(descriptor.owner).toBe(psychordRuntimeEvidenceSchemaOwner);
    expect(descriptor.validatorModules).toBe(psychordRuntimeEvidenceValidatorModules);
    expect(Object.entries(descriptor.schemas)).toEqual([
      ["PsychordApplicationObservationPlanSchema", PsychordApplicationObservationPlanSchema],
      ["PsychordApplicationObservationResultSchema", PsychordApplicationObservationResultSchema],
      ["PsychordEvidenceCurrentnessSchema", PsychordEvidenceCurrentnessSchema],
      ["PsychordObservationArtifactManifestSchema", PsychordObservationArtifactManifestSchema],
    ]);
  });

  it("derives owner identity only from the exact emitted validator module closure", () => {
    const modules = psychordRuntimeEvidenceValidatorModules.map((path, index) => ({
      path,
      contentHash: `sha256:v1:${String(index).padStart(64, "0")}`,
    }));
    const expected = hashPsychordRuntimeEvidenceSchemaOwner(modules);
    expect(hashPsychordRuntimeEvidenceSchemaOwner(modules.toReversed())).toBe(expected);
    expect(() => hashPsychordRuntimeEvidenceSchemaOwner(modules.slice(1))).toThrow(/exact owner-declared/u);
    expect(() => hashPsychordRuntimeEvidenceSchemaOwner([...modules, { path: "dist/runtime-evidence/extra.js", contentHash: modules[0]!.contentHash }])).toThrow(/exact owner-declared/u);
    expect(() => hashPsychordRuntimeEvidenceSchemaOwner(modules.map((item, index) => index === 0 ? { ...item, path: "dist/runtime-evidence/tampered.js" } : item))).toThrow(/exact owner-declared/u);
    expect(() => hashPsychordRuntimeEvidenceSchemaOwner(modules.map((item, index) => index === 0 ? { ...item, contentHash: "sha256:v1:not-a-hash" } : item))).toThrow();
    expect(hashPsychordRuntimeEvidenceSchemaOwner(modules.map((item, index) => index === 0 ? { ...item, contentHash: `sha256:v1:${"f".repeat(64)}` } : item))).not.toBe(expected);
  });
});
