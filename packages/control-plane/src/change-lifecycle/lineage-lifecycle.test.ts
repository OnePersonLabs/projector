import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, parseChangeProposal, withCanonicalHashes, type Requirement } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { expect } from "vitest";
import { integrationTest as it } from "../../../../scripts/testing/integration-test.mjs";

import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { RepositoryChangeLifecycleService } from "./service.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("test", "lineage-chain");

function requirement(id: string, key: string): Requirement {
  return {
    id, key, title: key, aliases: [], statement: `${key} owns the durable behavior.`, status: "active", sourceClass: "authored",
    scope: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, origin: [], evidence: [],
    discoveryHash: placeholder, semanticHash: placeholder,
  };
}

async function writeRequirement(root: string, value: Requirement): Promise<void> {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "requirement", id: value.id, key: value.key,
    lifecycle: "active", payload: value as unknown as Record<string, unknown>,
  }));
}

async function retireInto(root: string, sourceId: string, replacementId: string): Promise<void> {
  await transition(root, "replace", [sourceId], [replacementId]);
}

async function transition(root: string, kind: "move" | "split" | "merge" | "replace" | "delete", sourceIds: string[], replacementIds: string[]): Promise<void> {
  const canonical = new CanonicalFileRepository(root);
  const sourceId = sourceIds[0]!, replacementId = replacementIds.join(", ") || "retirement";
  const sources = await Promise.all(sourceIds.map(async (id) => (await canonical.read("requirement", id))!));
  const context = await (await RepositoryKnowledgeService.create(root)).context({ request: `Replace ${sourceId}.`, entities: sourceIds });
  const proposal = parseChangeProposal({
    apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
    validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
    identityResolution: {
      contextId: context.id, contextHash: context.contentHash,
      outcome: kind === "split" ? "split-existing" : kind === "merge" ? "merge-existing" : kind === "replace" ? "replace-existing" : "coordinated-modification", selectedEntityIds: sourceIds,
      rationale: `${replacementId} now owns the accepted meaning.`,
      newBoundary: { owns: [`the meaning formerly owned by ${sourceId}`], excludes: [`the retired identity ${sourceId}`], nearestEntityIds: [sourceId], rationale: "The replacement boundary is explicit." },
    },
    canonicalMutations: [{
      kind: "lineage", operation: "add", lineageKind: kind, replacementIds, rationale: `Apply ${kind} to ${sourceIds.join(", ")}.`,
      sources: sources.map((source) => ({ id: source.id, kind: "requirement", expectedSemanticHash: source.semanticHash, expectedDocumentHash: source.canonicalDocumentHash })),
    }],
  });
  const service = await RepositoryChangeLifecycleService.create(root);
  const captured = await service.capture({ request: `Replace ${sourceId}.`, proposal, knowledgeContextId: context.id });
  const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
  expect((await service.apply(approval.id)).outcome).toBe("success");
}

it("retrieves the current identity through two public lineage transactions after cloning", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-lineage-chain-"));
  const cloneRoot = `${root}-clone`;
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
    await writeFile(join(root, "src", "index.ts"), "export const durable = true;\n");
    await writeRequirement(root, requirement("requirement:a", "durable-a"));
    await writeRequirement(root, requirement("requirement:b", "durable-b"));
    await writeRequirement(root, requirement("requirement:c", "durable-c"));
    await exec("git", ["init", "-q"], { cwd: root });
    await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
    await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-qm", "initial identities"], { cwd: root });

    await retireInto(root, "requirement:a", "requirement:b");
    await retireInto(root, "requirement:b", "requirement:c");
    await exec("git", ["add", ".projector/model"], { cwd: root });
    await exec("git", ["commit", "-qm", "retain chained identity continuity"], { cwd: root });
    await exec("git", ["clone", "-q", root, cloneRoot]);

    const result = await (await RepositoryKnowledgeService.create(cloneRoot)).context({ request: "Find the original durable behavior.", entities: ["requirement:a"], persist: false });
    expect(result.interpretation.candidates[0]).toMatchObject({ entityId: "requirement:c", direct: true });
    expect(result.interpretation.candidates[0]?.continuityFromIds).toEqual(expect.arrayContaining(["requirement:a", "requirement:b"]));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(cloneRoot, { recursive: true, force: true });
  }
});

it("preserves move, split, merge and retirement records in a fresh clone without source runtime state", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-lineage-matrix-"));
  const cloneRoot = `${root}-clone`;
  const cases = [
    { kind: "move" as const, sources: ["requirement:move-old"], replacements: ["requirement:move-new"] },
    { kind: "split" as const, sources: ["requirement:split-old"], replacements: ["requirement:split-a", "requirement:split-b"] },
    { kind: "merge" as const, sources: ["requirement:merge-a", "requirement:merge-b"], replacements: ["requirement:merged"] },
    { kind: "delete" as const, sources: ["requirement:deleted"], replacements: [] },
  ];
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(join(root, "src", "index.ts"), "export const durable = true;\n");
    for (const entry of cases) for (const id of [...entry.sources, ...entry.replacements]) await writeRequirement(root, requirement(id, id.slice("requirement:".length)));
    await exec("git", ["init", "-q"], { cwd: root });
    await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
    await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-qm", "initial matrix"], { cwd: root });
    for (const entry of cases) await transition(root, entry.kind, entry.sources, entry.replacements);
    await exec("git", ["add", ".projector/model"], { cwd: root });
    await exec("git", ["commit", "-qm", "accepted continuity matrix"], { cwd: root });
    await exec("git", ["clone", "-q", root, cloneRoot]);
    await rm(root, { recursive: true, force: true });
    const canonical = new CanonicalFileRepository(cloneRoot);
    const snapshot = await canonical.snapshot();
    for (const entry of cases) {
      expect(snapshot.documents.filter(({ kind }) => kind === "lineage").map(({ payload }) => payload)).toContainEqual(expect.objectContaining({ kind: entry.kind, fromIds: [...entry.sources].sort(), toIds: [...entry.replacements].sort() }));
      for (const id of entry.sources) {
        expect(snapshot.documents.filter(({ kind }) => kind === "tombstone").map(({ payload }) => payload)).toContainEqual(expect.objectContaining({ entityId: id }));
        const result = await (await RepositoryKnowledgeService.create(cloneRoot)).context({ request: "Retrieve accepted continuity.", entities: [id], persist: false });
        const current = result.interpretation.candidates.filter(({ direct }) => direct).map(({ entityId }) => entityId);
        expect(current.sort()).toEqual([...entry.replacements].sort());
        for (const replacement of entry.replacements) expect(result.interpretation.candidates.find(({ entityId }) => entityId === replacement)?.continuityFromIds).toContain(id);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(cloneRoot, { recursive: true, force: true });
  }
});
