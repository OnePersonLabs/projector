import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { canonicalJson, createDurableRepresentationArtifactRecord, hashFramedDomain, withCanonicalHashes, type BehavioralScenario, type RepresentationProjection, type Requirement } from "@projector/core";
import { createStateBinding } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect } from "vitest";
import { integrationTest as it } from "../../../../scripts/testing/integration-test.mjs";

import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { ChangeLifecycleStore } from "../change-lifecycle/store.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { RepositoryRepresentationProfileReconciliationService } from "./profile-reconciliation.js";
import { RepositoryRepresentationInspectionService, projectRepresentationInspectionOperation } from "./service.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("representation-inspection-test", "placeholder");

const proposal = () => ({
  apiVersion: "projector.change-proposal/v1",
  requirements: [{ key: "greeting", title: "Greeting", statement: "The greeting includes the supplied name.", aliases: [] }],
  scenarios: [{ key: "greet-name", title: "Greet a name", steps: [
    { role: "precondition" as const, statement: "A caller supplies a name." },
    { role: "trigger" as const, statement: "The caller requests a greeting." },
    { role: "expected-outcome" as const, statement: "The greeting includes that name." },
  ] }], architecture: null,
  edits: [{ path: "src/greeting.mjs", before: "export const greet = () => 'hello';\n", after: "export const greet = (name) => `hello ${name}`;\n" }],
  validation: { independentNodeTests: ["test/greeting.test.mjs"], supplementalNodeTests: [] },
  analysisFacets: ["behavior", "architecture"],
});

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-representation-inspection-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "src/greeting.mjs"), "export const greet = () => 'hello';\n");
  await writeFile(join(root, "test/greeting.test.mjs"), "import assert from 'node:assert/strict'; assert.equal('hello', 'hello');\n");
  const requirement: Requirement = {
    id: "requirement:greeting", key: "greeting", title: "Greeting", aliases: [], statement: "The greeting includes the supplied name.",
    status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
    origin: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "requirement", id: requirement.id, key: requirement.key, lifecycle: "active", payload: requirement as unknown as Record<string, unknown> }));
  const scenario: BehavioralScenario = {
    id: "scenario:greet-name", key: "greet-name", title: "Greet a name", aliases: [], status: "active", sourceClass: "authored",
    scope: requirement.scope, evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
    steps: proposal().scenarios[0]!.steps,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "behavioral-scenario", id: scenario.id, key: scenario.key, lifecycle: "active", payload: scenario as unknown as Record<string, unknown> }));
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("RepositoryRepresentationInspectionService", () => {
  it("reconciles an authenticated profile upgrade into a distinct current unapproved capture", async () => {
    const root = await repository();
    try {
      const request = `Change the greeting while preserving its exact accepted name behavior and repository boundary. ${"Retain authenticated intent. ".repeat(40)}`;
      const knowledge = await RepositoryKnowledgeService.create(root);
      const context = await knowledge.context({ request, entities: ["requirement:greeting"], operation: "change", persist: true });
      const historicalLifecycle = await RepositoryChangeLifecycleService.create(root, { representationProfileKey: "agent-compact@1" });
      const historical = await historicalLifecycle.capture({ request, proposal: proposal(), knowledgeContextId: context.id });
      const approval = await historicalLifecycle.approve(historical.capture.semanticChangeId, historical.capture.planHash);
      const store = await ChangeLifecycleStore.create(root);
      const oldCapture = canonicalJson(await store.readCapture(historical.capture.semanticChangeId));
      const oldApproval = canonicalJson(await store.readApproval(approval.id));
      const approvalFiles = await readdir(join(root, ".projector/runtime/change-lifecycles/approvals"));

      const result = await (await RepositoryRepresentationProfileReconciliationService.create(root)).reconcile({
        changeSelector: historical.capture.semanticChangeId,
        approvalSelector: approval.id,
      });

      expect(result).toMatchObject({
        profile: { id: "profile:agent-compact", fromVersion: "1", toVersion: "2" },
        historical: { changeSelector: historical.capture.semanticChangeId, planHash: historical.capture.planHash, approvalStatus: "authenticated-stale" },
        context: { status: expect.stringMatching(/current|rebound/u), contextId: context.id, observedContextId: expect.stringMatching(/^knowledge_context_/u) },
        reconciliation: { status: "reconciled" },
        replacement: { artifactStatus: "valid", dependencyStatus: "current", approvalStatus: "not-supplied" },
        automaticApprovalCreated: false,
        delivery: { stage: "reconciliation-service", deliveredToRunnerBoundary: false },
      });
      expect(result.replacement.changeSelector).not.toBe(historical.capture.semanticChangeId);
      expect(result.replacement.planHash).not.toBe(historical.capture.planHash);
      expect(result.invalidation.invalidatedIds).toEqual(expect.arrayContaining([
        historical.compiled.representation.projectionId,
        ...historical.capture.capsules.map(({ id }) => id),
      ]));
      expect(result.invalidation.preservedCanonicalEntityIds).toEqual(expect.arrayContaining(["requirement:greeting"]));
      expect(canonicalJson(await store.readCapture(historical.capture.semanticChangeId))).toBe(oldCapture);
      expect(canonicalJson(await store.readApproval(approval.id))).toBe(oldApproval);
      expect(await readdir(join(root, ".projector/runtime/change-lifecycles/approvals"))).toEqual(approvalFiles);
      await expect((await RepositoryRepresentationInspectionService.create(root)).inspect({
        changeSelector: historical.capture.semanticChangeId,
        approvalSelector: approval.id,
        view: "summary",
      })).resolves.toMatchObject({ dependencyFreshness: { status: "stale" }, executionAuthorization: { status: "authenticated-stale" } });
      await expect((await RepositoryRepresentationProfileReconciliationService.create(root)).reconcile({
        changeSelector: result.replacement.changeSelector,
      })).rejects.toThrow(/already current/iu);

      const oldReference = historical.capture.capsules[0]!.representation!;
      const recordPath = join(root, ".projector/runtime/representations/projections", `${hashFramedDomain("representation-projection-path", oldReference.projectionId).slice("sha256:v1:".length)}.json`);
      const record = JSON.parse(await readFile(recordPath, "utf8")) as { projection: RepresentationProjection };
      const staleBinding = createStateBinding({
        compiledAgainst: record.projection.boundState.compiledAgainst,
        valueDependencies: record.projection.boundState.valueDependencies.map((dependency) => dependency.kind === "representation-profile"
          ? { ...dependency, versionHash: hashFramedDomain("tampered-historical-profile", null) }
          : dependency),
        queryDependencies: record.projection.boundState.queryDependencies,
      });
      const { semanticHash: _oldSemanticHash, ...projectionBasis } = record.projection;
      const tamperedProjection = { ...projectionBasis, boundState: staleBinding } as Omit<RepresentationProjection, "semanticHash">;
      const projection = { ...tamperedProjection, semanticHash: hashFramedDomain("representation-projection", tamperedProjection) } as RepresentationProjection;
      await writeFile(recordPath, canonicalJson(createDurableRepresentationArtifactRecord(projection)));
      await expect((await RepositoryRepresentationProfileReconciliationService.create(root)).reconcile({
        changeSelector: historical.capture.semanticChangeId,
      })).rejects.toThrow(/historical representation profile binding is invalid/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("separates exact artifact, currentness, fidelity, approval, and delivery across reset", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const captured = await lifecycle.capture({ request: "Change the greeting.", proposal: proposal() });
      const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const capsule = captured.capture.capsules[0]!;

      const inspection = await RepositoryRepresentationInspectionService.create(root);
      const summary = await inspection.inspect({ changeSelector: captured.capture.semanticChangeId, view: "summary" });
      expect(summary).toMatchObject({
        artifactIntegrity: { status: "valid" },
        dependencyFreshness: { status: "current" },
        semanticFidelity: { status: "valid", projection: { preservation: { protectedDimensions: expect.arrayContaining(["normative-force", "negation", "scope"]) } } },
        executionAuthorization: { status: "not-supplied" },
        delivery: { stage: "inspection-service", deliveredToRunnerBoundary: false, agentUnderstandingEstablished: false, behavioralCompletionEstablished: false },
      });
      expect(summary).not.toHaveProperty("renderedText");
      expect(projectRepresentationInspectionOperation(summary)).toMatchObject({
        delivery: { stage: "operation-runner", deliveredToRunnerBoundary: true, agentUnderstandingEstablished: false, behavioralCompletionEstablished: false },
      });

      const content = await inspection.inspect({ changeSelector: captured.capture.semanticChangeId, capsuleId: capsule.id, approvalSelector: approval.id, view: "content" });
      expect(content.renderedText).toContain("src/greeting.mjs");
      expect(hashFramedDomain("representation-artifact", content.renderedText!)).toBe(capsule.representation!.contentHash);
      expect(content.executionAuthorization.status).toBe("authenticated-current");
      expect(content.association).toMatchObject({ planId: captured.capture.planId, planRevision: captured.capture.planRevision, planHash: captured.capture.planHash, capsuleId: capsule.id, normativeKernelHash: capsule.normativeKernelHash, representation: capsule.representation });
      await expect(inspection.inspect({ changeSelector: captured.capture.semanticChangeId, approvalSelector: "lifecycle_approval_not-bound", view: "summary" })).rejects.toThrow(/approval selector.*not bound/iu);

      await writeFile(join(root, "UNRELATED.md"), "unrelated worktree change\n");
      const rebound = await inspection.inspect({ changeSelector: captured.capture.semanticChangeId, approvalSelector: approval.id, view: "summary" });
      expect(rebound.dependencyFreshness).toMatchObject({ status: "stale", reasons: [expect.stringMatching(/recompil|representation content/iu)] });
      expect(rebound.executionAuthorization.status).toBe("authenticated-stale");

      await writeFile(join(root, "src/greeting.mjs"), "export const greet = () => 'changed outside the plan';\n");
      const stale = await (await RepositoryRepresentationInspectionService.create(root)).inspect({ changeSelector: captured.capture.semanticChangeId, approvalSelector: approval.id, view: "content" });
      expect(stale.artifactIntegrity.status).toBe("valid");
      expect(stale.dependencyFreshness.status).not.toBe("current");
      expect(stale.executionAuthorization.status).not.toBe("authenticated-current");
      expect(stale.renderedText).toBe(content.renderedText);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("withholds rendered text when durable bytes fail authentication", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const captured = await lifecycle.capture({ request: "Change the greeting.", proposal: proposal() });
      const reference = captured.capture.capsules[0]!.representation!;
      await writeFile(join(root, ".projector/runtime/representations/content", `${reference.contentHash.slice("sha256:v1:".length)}.txt`), "tampered");
      const result = await (await RepositoryRepresentationInspectionService.create(root)).inspect({ changeSelector: captured.capture.semanticChangeId, view: "content" });
      expect(result).toMatchObject({ artifactIntegrity: { status: "invalid" }, semanticFidelity: { status: "invalid" } });
      expect(result).not.toHaveProperty("renderedText");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("stales a same-content recompilation whose exact capsule association changed", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const captured = await lifecycle.capture({ request: "Change the greeting.", proposal: proposal() });
      const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const inspection = await RepositoryRepresentationInspectionService.create(root);
      const internals = inspection as unknown as { lifecycle: { compile: (...args: never[]) => Promise<typeof captured.compiled> } };
      const compile = internals.lifecycle.compile.bind(internals.lifecycle);
      internals.lifecycle.compile = async (...args) => {
        const current = await compile(...args);
        return {
          ...current,
          compiledPlan: {
            ...current.compiledPlan,
            packets: current.compiledPlan.packets.map((packet) => {
              if (packet.capsule.representation === undefined) throw new Error("test requires a representation-bound capsule");
              return {
                ...packet,
                capsule: {
                  ...packet.capsule,
                  normativeKernelHash: hashFramedDomain("changed-normative-kernel", packet.capsule.normativeKernelHash),
                  representation: { ...packet.capsule.representation, projectionId: "representation:changed-association" as typeof packet.capsule.representation.projectionId },
                },
              };
            }),
          },
        };
      };

      const result = await inspection.inspect({ changeSelector: captured.capture.semanticChangeId, approvalSelector: approval.id, view: "content" });

      expect(result.artifactIntegrity.status).toBe("valid");
      expect(result.dependencyFreshness).toMatchObject({ status: "stale", reasons: [expect.stringMatching(/live lifecycle recompilation/iu)] });
      expect(result.executionAuthorization.status).toBe("authenticated-stale");
      expect(result.renderedText).toContain("src/greeting.mjs");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not recreate missing durable artifacts while inspecting live currentness", async () => {
    const root = await repository();
    try {
      const lifecycle = await RepositoryChangeLifecycleService.create(root);
      const captured = await lifecycle.capture({ request: "Change the greeting.", proposal: proposal() });
      const artifactRoot = join(root, ".projector/runtime/representations");
      await rm(artifactRoot, { recursive: true, force: true });

      const result = await (await RepositoryRepresentationInspectionService.create(root)).inspect({ changeSelector: captured.capture.semanticChangeId, view: "summary" });

      expect(result.artifactIntegrity.status).toBe("unavailable");
      expect(result.dependencyFreshness.status).toBe("current");
      await expect(access(artifactRoot)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
