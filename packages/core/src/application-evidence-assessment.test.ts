import { describe, expect, it } from "vitest";

import {
  ApplicationEvidenceAssessmentSchema,
  assessApplicationEvidence,
  hashApplicationEvidenceAssessment,
  type ApplicationEvidenceAssessmentRequest,
} from "./index.js";

const hash = (value: string) => `sha256:v1:${value.length.toString(16).padStart(2, "0").repeat(32)}` as const;
const request: ApplicationEvidenceAssessmentRequest = {
  schemaVersion: "application-evidence-assessment-request@1",
  owner: { kind: "requirement", id: "requirement:owned-evidence", canonicalDocumentHash: hash("owner") },
  binding: {
    kind: "application-observation", adapter: { id: "test.adapter", version: "1" },
    scenario: { id: "scenario:owned-evidence", semanticHash: hash("scenario") }, case: "round-trip",
    predicateId: "predicate:round-trip", assertionIds: ["result-retained"], observationRole: "latest",
  },
  evidenceIds: ["artifact:round-trip"],
};

function assessment(overrides: Record<string, unknown> = {}) {
  const basis = {
    schemaVersion: "application-evidence-assessment@1" as const,
    request,
    custody: { status: "authenticated" as const, receiptHash: hash("receipt") },
    currentness: { status: "current" as const, observationHash: hash("current") },
    fulfillment: { status: "satisfied" as const, reason: "The exact current observation satisfies its declared predicate." },
    dependencies: [{ kind: "artifact" as const, id: "application-evidence:artifact:round-trip", versionHash: hash("artifact"), role: "Exact authenticated observation artifact" }],
    ...overrides,
  };
  return { ...basis, contentHash: hashApplicationEvidenceAssessment(basis) };
}

describe("generic application evidence contract", () => {
  it("accepts an exact hashed, current, authenticated host assessment", async () => {
    const result = assessment();
    expect(ApplicationEvidenceAssessmentSchema.safeParse(result).success).toBe(true);
    await expect(assessApplicationEvidence({ async assess() { return result; } }, request, { signal: new AbortController().signal })).resolves.toEqual(result);
  });

  it("rejects unbound host results and non-current fulfillment", async () => {
    const otherRequest = { ...request, evidenceIds: ["artifact:other"] };
    const wrong = assessment({ request: otherRequest });
    await expect(assessApplicationEvidence({ async assess() { return wrong; } }, request, { signal: new AbortController().signal })).rejects.toThrow(/different exact request/i);
    const { contentHash: _contentHash, ...oldBasis } = assessment();
    const staleBasis = { ...oldBasis, currentness: { status: "stale" as const, observationHash: hash("stale"), reason: "A bound producer input changed." } };
    const stale = { ...staleBasis, contentHash: hashApplicationEvidenceAssessment(staleBasis) };
    expect(ApplicationEvidenceAssessmentSchema.safeParse(stale).success).toBe(false);
  });
});
