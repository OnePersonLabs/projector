import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, withCanonicalHashes, type Requirement } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { observeChangeRepository } from "./repository-observer.js";
import { CHANGE_QUERY_PROGRAM_IDS, createChangeQueryRegistry } from "./query-programs.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("test", "placeholder");

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-change-queries-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "value.mjs"), "export const value = 1;\n");
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("change query programs", () => {
  it("reruns identity and reverse-import negative space against current observations", async () => {
    const root = await repository();
    try {
      const before = await observeChangeRepository(root);
      const registry = createChangeQueryRegistry({ observation: before, now: "2026-08-26T00:00:00.000Z" });
      const identity = registry.createSpec({ id: "identity:test", programId: CHANGE_QUERY_PROGRAM_IDS.identityExact, input: { kind: "requirement", claims: ["named-value"] } });
      const relevance = registry.createSpec({ id: "relevance:test", programId: CHANGE_QUERY_PROGRAM_IDS.reverseImporters, input: { editedPaths: ["src/value.mjs"] } });
      const identityBefore = await registry.evaluate(identity, { repositoryRoot: root, stateDigest: before.state, config: {}, signal: new AbortController().signal });
      const relevanceBefore = await registry.evaluate(relevance, { repositoryRoot: root, stateDigest: before.state, config: {}, signal: new AbortController().signal });

      const id = "requirement:named-value";
      const payload: Requirement = { id, key: "named-value", title: "Named value", aliases: [], statement: "A named value exists.", status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/value.mjs" }, origin: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder };
      await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id, key: "named-value", lifecycle: "active", payload: { ...payload } }));
      await writeFile(join(root, "src", "consumer.mjs"), "import { value } from './value.mjs'; export const doubled = value * 2;\n");
      const after = await observeChangeRepository(root);
      const current = createChangeQueryRegistry({ observation: after, now: "2026-08-26T00:00:00.000Z" });
      const identityAfter = await current.evaluate(identity, { repositoryRoot: root, stateDigest: after.state, config: {}, signal: new AbortController().signal });
      const relevanceAfter = await current.evaluate(relevance, { repositoryRoot: root, stateDigest: after.state, config: {}, signal: new AbortController().signal });
      expect(identityBefore.resultCount).toBe(0);
      expect(identityAfter.resultCount).toBe(1);
      expect(identityAfter.resultHash).not.toBe(identityBefore.resultHash);
      expect(relevanceAfter.resultHash).not.toBe(relevanceBefore.resultHash);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("makes deferral validity rerunnable instead of trusting a claimed fingerprint", async () => {
    const root = await repository();
    try {
      const observation = await observeChangeRepository(root);
      const input = { concernId: "concern:1", concernKey: "api-shape", discoveryHash: hashFramedDomain("test", "discovery"), deferralId: "deferral:1", validUntil: "2026-09-01T00:00:00.000Z", forbiddenWritePaths: ["package.json"], editedPaths: ["src/value.mjs"] };
      const before = createChangeQueryRegistry({ observation, now: "2026-08-26T00:00:00.000Z" });
      const query = before.createSpec({ id: "deferral:test", programId: CHANGE_QUERY_PROGRAM_IDS.boundedDeferral, input });
      expect((await before.evaluate(query, { repositoryRoot: root, stateDigest: observation.state, config: {}, signal: new AbortController().signal })).resultCount).toBe(1);
      const expired = createChangeQueryRegistry({ observation, now: "2026-10-01T00:00:00.000Z" });
      expect((await expired.evaluate(query, { repositoryRoot: root, stateDigest: observation.state, config: {}, signal: new AbortController().signal })).resultCount).toBe(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
