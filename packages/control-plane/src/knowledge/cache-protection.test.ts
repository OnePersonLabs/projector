import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hashFramedDomain, type ExecutionPlan, type StateBinding } from "@projector/core";
import { FileTransactionJournal, RepositoryPathService, withObservationScope } from "@projector/runtime";
import { afterEach, describe, expect, test } from "vitest";

import { ChangeLifecycleStore } from "../change-lifecycle/store.js";
import { authenticateCacheProtectionSources, readProtectedKnowledgeContextIds } from "./cache-protection.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const contextId = `knowledge_context_${"1".repeat(32)}`;
const hash = hashFramedDomain("cache-protection-test", "state");
const state: StateBinding = {
  compiledAgainst: { gitBase: "abc", worktreeDigest: hash, canonicalProjectorDigest: hash, toolchainDigest: hash },
  valueDependencies: [], queryDependencies: [], dependencyDigest: hash,
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-cache-protection-"));
  roots.push(root);
  const store = await ChangeLifecycleStore.create(root);
  const proposal = {
    apiVersion: "projector.change-proposal/v1" as const,
    requirements: [{ key: "value", title: "Value", statement: "The value changes.", aliases: [] }],
    scenarios: [{ key: "change-value", title: "Change value", aliases: [], steps: [
      { role: "trigger" as const, statement: "The value changes." },
      { role: "expected-outcome" as const, statement: "The new value is visible." },
    ] }], architecture: null,
    edits: [{ path: "src/value.mjs", before: "old", after: "new" }],
    validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] },
    analysisFacets: ["architecture" as const, "behavior" as const],
  };
  const plan: ExecutionPlan = {
    id: "plan:cache-protection", semanticChangeId: "change:cache-protection", revision: 1, sourceRunId: "run:test",
    packetIds: [], boundary: ["src/value.mjs"], knownAffectedUnitIds: [], possibleFrontierUnitIds: [],
    unavailableSurfaceIds: [], checkpoints: [], assumptions: [], boundState: state,
    completionCriteria: {
      requiredUnitStates: [], requiredValidators: [], requiredEvidenceLanes: [], minimumValidationAssurance: "strong",
      requireIndependentValidation: false, maximumNewDivergences: 0, maximumUnknowns: 0,
      allowUnavailableExternalActions: false, requiredArtifacts: [], cleanWorkingTree: false,
    },
  };
  const capture = await store.capture({
    request: "Change value.", proposal, proposalHash: hashFramedDomain("repository-change-proposal", proposal),
    semanticChangeId: "change:cache-protection", plan, capsules: [], exactPatchInputHash: hash, knowledgeContextId: contextId,
  });
  const approve = () => store.approve(capture.semanticChangeId, capture.planHash, plan, []);
  const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
  return { root, store, capture, approve, journal };
}

describe("knowledge cache protection from durable owners", () => {
  test("authenticates valid metadata above 16 MiB within the shared derived-data allowance", async () => {
    const { root, approve, journal, capture } = await fixture();
    await approve();
    for (let index = 0; index < 4; index += 1) {
      await journal.begin({ transactionId: `large-proof-${index}`, planId: capture.planId, beforeState: state.compiledAgainst, allowedWriteRoots: ["src"] });
    }
    for (const directory of [".projector/runtime/change-lifecycles/captures", ".projector/runtime/change-lifecycles/approvals", ".projector/runtime/journal"]) {
      for (const name of await readdir(join(root, directory))) {
        const path = join(root, directory, name);
        await writeFile(path, (await readFile(path, "utf8")).padEnd(3 * 1024 * 1024, " "));
      }
    }
    const result = await withObservationScope({}, async (scope) => ({ ids: [...await readProtectedKnowledgeContextIds(root)], remainingBytes: scope.budget.remaining("maxTotalBytes") }));
    expect(result).toEqual({ ids: [contextId], remainingBytes: 238 * 1024 * 1024 });
  });
  test("authenticates only collected source bytes when backing metadata is enlarged afterward", async () => {
    const { root, approve } = await fixture();
    await approve();
    const sources: Record<string, string> = {};
    for (const kind of ["captures", "approvals"]) {
      const directory = `.projector/runtime/change-lifecycles/${kind}`;
      for (const name of await readdir(join(root, directory))) {
        const path = `${directory}/${name}`;
        sources[path] = await readFile(join(root, path), "utf8");
        await writeFile(join(root, path), "invalid".padEnd(17 * 1024 * 1024, " "));
      }
    }
    expect(await authenticateCacheProtectionSources({ repositoryRoot: root, sources, deadline: Date.now() + 5_000 })).toEqual([contextId]);
    await expect(readProtectedKnowledgeContextIds(root, { deadline: Date.now() + 5_000, remainingEntries: 10_000, remainingBytes: 16 * 1024 * 1024 })).rejects.toThrow(/bound/iu);
  });
  test("does not initialize absent lifecycle or journal owners during discovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "projector-cache-protection-empty-"));
    roots.push(root);
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  test("protects pending approved work, but permits a dormant unapproved capture to expire", async () => {
    const { root, approve } = await fixture();
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([]);
    await approve();
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([contextId]);
  });

  test("protects an attempt without a result even before its journal is created", async () => {
    const { root, approve, store } = await fixture();
    await store.beginAttempt((await approve()).id);
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([contextId]);
  });

  test("protects a known journal's captured context even without a lifecycle attempt", async () => {
    const { root, capture, journal } = await fixture();
    await journal.begin({ transactionId: "direct-transaction", planId: capture.planId, beforeState: state.compiledAgainst, allowedWriteRoots: ["src"] });
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([contextId]);
  });

  test("keeps a published partial result protected until its actual journal is terminal", async () => {
    const { root, approve, store, journal, capture } = await fixture();
    const attempt = await store.beginAttempt((await approve()).id);
    await journal.begin({ transactionId: attempt.transactionId, planId: capture.planId, beforeState: state.compiledAgainst, allowedWriteRoots: ["src"] });
    await store.completeAttempt(attempt.id, "partial", { kind: "recovery", attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required" });
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([contextId]);
    await journal.recover([attempt.transactionId]);
    expect([...await readProtectedKnowledgeContextIds(root)]).toEqual([]);
  });

  test("refuses an incomplete proof from corrupt lifecycle metadata or unknown open journals", async () => {
    const { root, approve, journal } = await fixture();
    await approve();
    const directory = join(root, ".projector/runtime/change-lifecycles/approvals");
    const [name] = await readdir(directory);
    const path = join(directory, name!);
    const original = await readFile(path, "utf8");
    const corrupt = JSON.parse(original);
    corrupt.knowledgeContextId = `knowledge_context_${"2".repeat(32)}`;
    await writeFile(path, JSON.stringify(corrupt));
    await expect(readProtectedKnowledgeContextIds(root)).rejects.toThrow(/authentication/iu);
    await writeFile(path, original);
    await journal.begin({ transactionId: "unknown-transaction", planId: "plan:unknown", beforeState: state.compiledAgainst, allowedWriteRoots: ["src"] });
    await expect(readProtectedKnowledgeContextIds(root)).rejects.toThrow(/unknown.*journal|journal.*unknown/iu);
  });

  test("refuses entry, metadata-byte, and elapsed-time bounds without returning a partial set", async () => {
    const { root, approve } = await fixture();
    await approve();
    const budget = () => ({ deadline: Date.now() + 5_000, remainingEntries: 10_000, remainingBytes: 16 * 1024 * 1024 });
    await expect(readProtectedKnowledgeContextIds(root, { ...budget(), remainingEntries: 1 })).rejects.toThrow(/bound/iu);
    await expect(readProtectedKnowledgeContextIds(root, { ...budget(), remainingBytes: 1 })).rejects.toThrow(/bound/iu);
    await expect(readProtectedKnowledgeContextIds(root, { ...budget(), deadline: Date.now() - 1 })).rejects.toThrow(/bound/iu);
    await mkdir(join(root, ".projector/runtime/change-lifecycles/unknown"));
    await expect(readProtectedKnowledgeContextIds(root)).rejects.toThrow(/unknown/iu);
  });
});
