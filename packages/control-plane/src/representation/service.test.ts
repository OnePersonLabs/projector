import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, withCanonicalHashes, type BehavioralScenario, type Requirement } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { RepositoryRepresentationInspectionService } from "./service.js";

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
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id: requirement.id, key: requirement.key, lifecycle: "active", payload: requirement as unknown as Record<string, unknown> }));
  const scenario: BehavioralScenario = {
    id: "scenario:greet-name", key: "greet-name", title: "Greet a name", aliases: [], status: "active", sourceClass: "authored",
    scope: requirement.scope, evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
    steps: proposal().scenarios[0]!.steps,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: scenario.id, key: scenario.key, lifecycle: "active", payload: scenario as unknown as Record<string, unknown> }));
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("RepositoryRepresentationInspectionService", () => {
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
