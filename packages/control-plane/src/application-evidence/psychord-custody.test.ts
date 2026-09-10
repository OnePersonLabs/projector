import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withCanonicalHashes, type BehavioralScenario, type EvidenceRef, type Requirement } from "@projector/core";
import { CanonicalFileRepository, withProjectOperationAccess } from "@projector/runtime";
import { afterEach, expect, it } from "vitest";

import { createCanonicalPsychordEvidenceOwnerCustody } from "./psychord-custody.js";
import { createPsychordApplicationEvidenceAssessmentService } from "./psychord-assessment.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

it("resolves the exact current requirement from an actual canonical snapshot held by shared access", async () => {
  const root = await temporaryRoot();
  const repository = new CanonicalFileRepository(root);
  const requirement = requirementEnvelope("requirement:owned", "artifact-owned");
  await repository.write(requirement);

  await withProjectOperationAccess(root, { operation: "application-evidence-test", mode: "shared" }, async ({ signal }) => {
    const snapshot = await repository.snapshot();
    const custody = createCanonicalPsychordEvidenceOwnerCustody({ repositoryRoot: root, canonicalProjectorDigest: snapshot.rootDigest, signal });
    await expect(custody.readCurrent({ kind: "requirement", id: requirement.id, canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal }))
      .resolves.toEqual(requirement);
    await expect(custody.readCurrent({ kind: "requirement", id: "requirement:absent", canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal }))
      .rejects.toThrow(/absent or ambiguous/u);
  });
});

it("resolves the existing scenario as its own evidence owner without changing its semantic hash", async () => {
  const root = await temporaryRoot();
  const repository = new CanonicalFileRepository(root);
  const scenario = scenarioEnvelope("artifact-scenario-owned");
  await repository.write(scenario);

  await withProjectOperationAccess(root, { operation: "application-evidence-test", mode: "shared" }, async ({ signal }) => {
    const snapshot = await repository.snapshot();
    const custody = createCanonicalPsychordEvidenceOwnerCustody({ repositoryRoot: root, canonicalProjectorDigest: snapshot.rootDigest, signal });
    const service = createPsychordApplicationEvidenceAssessmentService({
      owners: custody,
      artifacts: {
        artifactSetId: () => "artifact-scenario-owned",
        observeAndPublish: async () => ({ status: "missing", artifactSetId: "artifact-scenario-owned" }),
        read: async () => ({ status: "missing", artifactSetId: "artifact-scenario-owned" }),
      },
      currentness: { async observe() { throw new Error("currentness is not read for a missing artifact"); } },
    });
    await expect(service.assess({
      schemaVersion: "psychord-application-evidence-assessment-request@4",
      owner: { kind: "behavioral-scenario", id: scenario.id, canonicalDocumentHash: scenario.canonicalDocumentHash },
      evidenceIds: ["artifact-scenario-owned"],
    }, { signal })).resolves.toMatchObject({
      owner: { kind: "behavioral-scenario", id: scenario.id, semanticHash: scenario.semanticHash },
      fulfillment: { status: "unknown" },
      observations: [{ publicationStatus: "missing" }],
    });
  });
});

it("rejects a valid stale requirement after the retained canonical snapshot changes", async () => {
  const root = await temporaryRoot();
  const repository = new CanonicalFileRepository(root);
  const before = requirementEnvelope("requirement:owned", "artifact-before");
  await repository.write(before);
  const retainedDigest = (await repository.snapshot()).rootDigest;
  const after = requirementEnvelope("requirement:owned", "artifact-after");
  await repository.write(after);

  await withProjectOperationAccess(root, { operation: "application-evidence-test", mode: "shared" }, async ({ signal }) => {
    const custody = createCanonicalPsychordEvidenceOwnerCustody({ repositoryRoot: root, canonicalProjectorDigest: retainedDigest, signal });
    await expect(custody.readCurrent({ kind: "requirement", id: before.id, canonicalDocumentHash: before.canonicalDocumentHash }, { signal }))
      .rejects.toThrow(/differs from the retained shared-access state/u);
  });
});

it("honors caller and retained-access cancellation", async () => {
  const root = await temporaryRoot();
  const repository = new CanonicalFileRepository(root);
  const requirement = requirementEnvelope("requirement:owned", "artifact-owned");
  await repository.write(requirement);
  const snapshot = await repository.snapshot();
  const retained = new AbortController();
  retained.abort(new Error("shared access released"));
  const custody = createCanonicalPsychordEvidenceOwnerCustody({ repositoryRoot: root, canonicalProjectorDigest: snapshot.rootDigest, signal: retained.signal });
  await expect(custody.readCurrent({ kind: "requirement", id: requirement.id, canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal: new AbortController().signal }))
    .rejects.toThrow(/shared access released/u);
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-psychord-custody-"));
  roots.push(root);
  return root;
}

function requirementEnvelope(id: string, evidenceId: string) {
  const zero = `sha256:v1:${"0".repeat(64)}` as const;
  const evidence: EvidenceRef = {
    evidenceId,
    stance: "supports",
    applicationPredicate: {
      kind: "application-observation",
      adapter: { id: "psychord.keep-reload-replay", version: "1" },
      scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: zero },
      case: "no-input",
      predicateId: "predicate:no-input-is-not-player",
      assertionIds: ["no-input-player"],
      observationRole: "latest",
    },
  };
  const payload: Requirement = {
    id,
    key: id.replace("requirement:", ""),
    title: "Owned application behavior",
    aliases: [],
    statement: "The application preserves the declared behavior.",
    status: "active",
    sourceClass: "authored",
    scope: { op: "atom", field: "scenario", matcher: "equals", value: evidence.applicationPredicate!.scenario.id },
    origin: [],
    evidence: [evidence],
    discoveryHash: zero,
    semanticHash: zero,
  };
  const canonical = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id, key: payload.key, lifecycle: "active", payload: { ...payload } });
  return canonical;
}

function scenarioEnvelope(evidenceId: string) {
  const zero = `sha256:v1:${"0".repeat(64)}` as const;
  const payload: BehavioralScenario = {
    id: "scenario:keep-reload-replay-owned-moment",
    key: "keep-reload-replay-owned-moment",
    title: "Keep and replay a player-owned musical moment",
    aliases: [],
    status: "active",
    sourceClass: "authored",
    scope: { op: "all", items: [] },
    steps: [
      { role: "trigger", statement: "The player performs no input." },
      { role: "expected-outcome", statement: "No player evidence appears." },
    ],
    evidence: [],
    discoveryHash: zero,
    semanticHash: zero,
  };
  const withoutEvidence = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: payload.id, key: payload.key, lifecycle: payload.status, payload: { ...payload } });
  const evidence: EvidenceRef = {
    evidenceId,
    stance: "supports",
    applicationPredicate: {
      kind: "application-observation",
      adapter: { id: "psychord.keep-reload-replay", version: "1" },
      scenario: { id: payload.id, semanticHash: withoutEvidence.semanticHash },
      case: "no-input",
      predicateId: "predicate:no-input-is-not-player",
      assertionIds: ["no-input-player"],
      observationRole: "latest",
    },
  };
  const withEvidence = withCanonicalHashes({ ...withoutEvidence, payload: { ...payload, evidence: [evidence] } });
  expect(withEvidence.semanticHash).toBe(withoutEvidence.semanticHash);
  expect(withEvidence.canonicalDocumentHash).not.toBe(withoutEvidence.canonicalDocumentHash);
  return withEvidence;
}
