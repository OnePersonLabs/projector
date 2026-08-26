import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson, hashFramedDomain, type ExecutionCapsule, type ExecutionPlan, type RepresentationProjectionRef, type StateDigest } from "@projector/core";
import { createExecutionApproval, createStateBinding } from "@projector/engine";
import { afterEach, describe, expect, it } from "vitest";

import { createHostSessionRecord, hostSessionSelector, loadAuthenticatedRepositorySession } from "./index.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const state = (gitBase = "revision:one"): StateDigest => ({
  gitBase,
  worktreeDigest: hashFramedDomain("session-test", "worktree"),
  canonicalProjectorDigest: hashFramedDomain("session-test", "canonical"),
  toolchainDigest: hashFramedDomain("session-test", "toolchain"),
});
const projection = (): RepresentationProjectionRef => ({
  projectionId: "representation:session",
  profileId: "profile:agent-compact",
  profileVersion: "1",
  contentHash: hashFramedDomain("representation-artifact", "authenticated instructions"),
  preservationHash: hashFramedDomain("session-test", "preservation"),
});

async function fixture(options: { readonly capsuleRepresentation?: "valid" | "absent"; readonly instructionText?: string; readonly host?: "codex" | "claude" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "projector-session-")); roots.push(root);
  const boundState = createStateBinding({ compiledAgainst: state(), valueDependencies: [], queryDependencies: [] });
  const plan = { id: "plan:session", revision: 3, boundState } as unknown as ExecutionPlan;
  const representation = projection();
  const capsule = { id: "capsule:session", taskId: "packet:session", boundState, normativeKernelHash: hashFramedDomain("session-test", "kernel"), ...(options.capsuleRepresentation === "absent" ? {} : { representation }) } as unknown as ExecutionCapsule;
  const reorderedRepresentation = { preservationHash: representation.preservationHash, contentHash: representation.contentHash, profileVersion: representation.profileVersion, profileId: representation.profileId, projectionId: representation.projectionId } as RepresentationProjectionRef;
  const input = { kind: "task17-host-session" as const, host: options.host ?? "codex", sessionId: "session:repository", repositoryRootHash: hashFramedDomain("task17-host-repository-root", await realpath(root)), plan, capsule, approval: createExecutionApproval(plan, capsule, "approval:session"), instructions: { text: options.instructionText ?? "authenticated instructions", sourceHashes: [capsule.normativeKernelHash], representation: reorderedRepresentation } };
  const record = createHostSessionRecord(input);
  const selector = hostSessionSelector(record); const id = selector.slice("session:".length);
  await mkdir(join(root, ".projector", "task17-sessions"), { recursive: true });
  await writeFile(join(root, ".projector", "task17-sessions", `session-${id}.json`), JSON.stringify(record));
  return { root, record, selector, input, plan, capsule };
}

describe("authenticated repository sessions", () => {
  it("preserves the legacy record hash/selector and accepts canonical representation equality", async () => {
    const value = await fixture();
    const { contentHash, ...body } = value.record;
    expect(contentHash).toBe(hashFramedDomain("task17-host-session", body));
    expect(value.selector).toBe(`session:${contentHash.slice("sha256:v1:".length)}`);
    const loaded = await loadAuthenticatedRepositorySession({ repositoryRoot: value.root, sessionSelector: value.selector, host: "codex" });
    expect(canonicalJson(loaded.record)).toBe(canonicalJson(value.record));
    expect(loaded.representation).toMatchObject({ status: "valid", projection: value.capsule.representation, text: "authenticated instructions" });
  });

  it("classifies absent and invalid representation bindings without making them valid", async () => {
    const absent = await fixture({ capsuleRepresentation: "absent" });
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: absent.root, sessionSelector: absent.selector })).resolves.toMatchObject({ representation: { status: "absent" } });
    const invalid = await fixture({ instructionText: "tampered instructions" });
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: invalid.root, sessionSelector: invalid.selector })).resolves.toMatchObject({ representation: { status: "invalid", reason: expect.stringMatching(/artifact hash/iu) } });
  });

  it("rejects route, envelope, approval revision, and exact binding tampering", async () => {
    const route = await fixture();
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: route.root, sessionSelector: route.selector, host: "claude" })).rejects.toThrow(/route|host/iu);
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: route.root, sessionSelector: "session:not-a-hash" })).rejects.toThrow(/immutable.*selector/iu);

    const wrongRoot = await mkdtemp(join(tmpdir(), "projector-session-wrong-root-")); roots.push(wrongRoot); await mkdir(join(wrongRoot, ".projector", "task17-sessions"), { recursive: true }); await writeFile(join(wrongRoot, ".projector", "task17-sessions", `session-${route.selector.slice("session:".length)}.json`), JSON.stringify(route.record));
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: wrongRoot, sessionSelector: route.selector })).rejects.toThrow(/root/iu);

    const tampered = await fixture(); const { contentHash: ignoredHash, ...tamperedBody } = tampered.record; void ignoredHash;
    await writeFile(join(tampered.root, ".projector", "task17-sessions", `session-${tampered.selector.slice("session:".length)}.json`), JSON.stringify({ ...tamperedBody, sessionId: "forged", contentHash: tampered.record.contentHash }));
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: tampered.root, sessionSelector: tampered.selector })).rejects.toThrow(/unauthenticated/iu);

    const revision = await fixture(); const revisionRecord = createHostSessionRecord({ ...revision.input, approval: { ...revision.input.approval, planRevision: revision.plan.revision - 1 } }); const revisionSelector = hostSessionSelector(revisionRecord); await writeFile(join(revision.root, ".projector", "task17-sessions", `session-${revisionSelector.slice("session:".length)}.json`), JSON.stringify(revisionRecord));
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: revision.root, sessionSelector: revisionSelector })).rejects.toThrow(/approval/iu);

    const binding = await fixture(); const rebound = createStateBinding({ compiledAgainst: state("revision:other"), valueDependencies: [], queryDependencies: [] }); const reboundCapsule = { ...binding.capsule, boundState: rebound } as ExecutionCapsule; const reboundRecord = createHostSessionRecord({ ...binding.input, capsule: reboundCapsule, approval: createExecutionApproval(binding.plan, reboundCapsule, "approval:rebound") }); const reboundSelector = hostSessionSelector(reboundRecord); await writeFile(join(binding.root, ".projector", "task17-sessions", `session-${reboundSelector.slice("session:".length)}.json`), JSON.stringify(reboundRecord));
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: binding.root, sessionSelector: reboundSelector })).rejects.toThrow(/binding|approval/iu);

    const digest = await fixture(); const forgedBinding = { ...digest.plan.boundState, dependencyDigest: hashFramedDomain("session-test", "forged-dependency-digest") }; const forgedPlan = { ...digest.plan, boundState: forgedBinding } as ExecutionPlan; const forgedCapsule = { ...digest.capsule, boundState: forgedBinding } as ExecutionCapsule; const forgedRecord = createHostSessionRecord({ ...digest.input, plan: forgedPlan, capsule: forgedCapsule, approval: createExecutionApproval(forgedPlan, forgedCapsule, "approval:forged-binding") }); const forgedSelector = hostSessionSelector(forgedRecord); await writeFile(join(digest.root, ".projector", "task17-sessions", `session-${forgedSelector.slice("session:".length)}.json`), JSON.stringify(forgedRecord));
    await expect(loadAuthenticatedRepositorySession({ repositoryRoot: digest.root, sessionSelector: forgedSelector })).rejects.toThrow(/binding|approval/iu);
  });
});
