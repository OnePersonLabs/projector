import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, parseChangeProposal, withCanonicalHashes, type Requirement } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { expect, it } from "vitest";

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
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id: value.id, key: value.key,
    lifecycle: "active", payload: value as unknown as Record<string, unknown>,
  }));
}

async function retireInto(root: string, sourceId: string, replacementId: string): Promise<void> {
  const canonical = new CanonicalFileRepository(root);
  const source = (await canonical.read("requirement", sourceId))!;
  const context = await (await RepositoryKnowledgeService.create(root)).context({ request: `Replace ${sourceId}.`, entities: [sourceId] });
  const proposal = parseChangeProposal({
    apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
    validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
    identityResolution: {
      contextId: context.id, contextHash: context.contentHash, outcome: "replace-existing", selectedEntityIds: [sourceId],
      rationale: `${replacementId} now owns the accepted meaning.`,
      newBoundary: { owns: [`the meaning formerly owned by ${sourceId}`], excludes: [`the retired identity ${sourceId}`], nearestEntityIds: [sourceId], rationale: "The replacement boundary is explicit." },
    },
    canonicalMutations: [{
      kind: "lineage", operation: "add", lineageKind: "replace", replacementIds: [replacementId], rationale: `Replace ${sourceId} with ${replacementId}.`,
      sources: [{ id: source.id, kind: "requirement", expectedSemanticHash: source.semanticHash, expectedDocumentHash: source.canonicalDocumentHash }],
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
}, 30_000);
