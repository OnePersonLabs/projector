import { hashFramedDomain } from "@projector/core";
import { describe, expect, it } from "vitest";

import { applicationEvidenceDisposition, assessmentKey, type KnowledgeApplicationEvidenceAssessment } from "./application-evidence.js";

const hash = hashFramedDomain("application-evidence-helper-test", "value");
const binding = {
  kind: "application-observation" as const,
  adapter: { id: "psychord.keep-reload-replay", version: "1" },
  scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: hash },
  case: "no-input",
  predicateId: "predicate:no-input-is-not-player",
  assertionIds: ["no-input-player"],
  observationRole: "latest" as const,
};

describe("knowledge application evidence projection", () => {
  it("keeps exact scenario and assertion revisions in separate assessment identities", () => {
    const base = { owner: { kind: "requirement" as const, id: "requirement:psychord", canonicalDocumentHash: hash }, binding };
    expect(assessmentKey(base)).not.toBe(assessmentKey({ ...base, binding: { ...binding, scenario: { ...binding.scenario, semanticHash: hashFramedDomain("application-evidence-helper-test", "revision") } } }));
    expect(assessmentKey(base)).not.toBe(assessmentKey({ ...base, binding: { ...binding, assertionIds: ["revised-assertion"] } }));
  });

  it("retains an authenticated violation when another assessment is unavailable", () => {
    const violated = { status: "assessed", assessment: { fulfillment: { status: "violated" } } } as KnowledgeApplicationEvidenceAssessment;
    const unavailable = { status: "unavailable" } as KnowledgeApplicationEvidenceAssessment;
    expect(applicationEvidenceDisposition([unavailable, violated])).toBe("violated");
  });
});
