import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withCanonicalHashes, type EvidenceRef, type Requirement } from "@projector/core";
import { CanonicalFileRepository, withProjectOperationAccess } from "@projector/runtime";
import { afterEach, expect, it } from "vitest";

import { createCanonicalPsychordRequirementCustody } from "./psychord-custody.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

it("resolves the exact current requirement from an actual canonical snapshot held by shared access", async () => {
  const root = await temporaryRoot();
  const repository = new CanonicalFileRepository(root);
  const requirement = requirementEnvelope("requirement:owned", "artifact-owned");
  await repository.write(requirement);

  await withProjectOperationAccess(root, { operation: "application-evidence-test", mode: "shared" }, async ({ signal }) => {
    const snapshot = await repository.snapshot();
    const custody = createCanonicalPsychordRequirementCustody({ repositoryRoot: root, canonicalProjectorDigest: snapshot.rootDigest, signal });
    await expect(custody.readCurrent({ id: requirement.id, canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal }))
      .resolves.toEqual(requirement);
    await expect(custody.readCurrent({ id: "requirement:absent", canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal }))
      .rejects.toThrow(/absent or ambiguous/u);
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
    const custody = createCanonicalPsychordRequirementCustody({ repositoryRoot: root, canonicalProjectorDigest: retainedDigest, signal });
    await expect(custody.readCurrent({ id: before.id, canonicalDocumentHash: before.canonicalDocumentHash }, { signal }))
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
  const custody = createCanonicalPsychordRequirementCustody({ repositoryRoot: root, canonicalProjectorDigest: snapshot.rootDigest, signal: retained.signal });
  await expect(custody.readCurrent({ id: requirement.id, canonicalDocumentHash: requirement.canonicalDocumentHash }, { signal: new AbortController().signal }))
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
