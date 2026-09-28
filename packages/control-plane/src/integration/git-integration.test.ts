import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";
import { CanonicalFileRepository, canonicalApiVersion, canonicalSchemaVersion } from "@projector/runtime";
import { withCanonicalHashes } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { assessGitIntegration } from "./git-integration.js";

const execute = promisify(execFile), roots: string[] = [];
async function git(root: string, ...args: string[]) { return (await execute("git", args, { cwd: root })).stdout.trim(); }
async function meaning(root: string, id: string, statement: string) {
  const hash = `sha256:v1:${"0".repeat(64)}`;
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind: "concept", id: `concept:${id}`, key: id, lifecycle: "active", payload: { id: `concept:${id}`, key: id, kind: "invariant", name: id, aliases: [], statement, status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: hash, semanticHash: hash } }));
}
async function commit(root: string) { await git(root, "add", "."); await git(root, "commit", "-qm", "fixture"); return git(root, "rev-parse", "HEAD"); }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "projector-git-integration-")); roots.push(root);
  await git(root, "init", "-q"); await git(root, "config", "user.email", "test@example.invalid"); await git(root, "config", "user.name", "Test");
  await meaning(root, "base", "Base meaning."); const base = await commit(root);
  await meaning(root, "target", "Target meaning."); await writeFile(join(root, "target.txt"), "target\n"); const target = await commit(root);
  await git(root, "checkout", "-q", base); await meaning(root, "incoming", "Incoming meaning."); await writeFile(join(root, "incoming.txt"), "incoming\n"); const incoming = await commit(root);
  return { root, base, target, incoming };
}
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
test("reconciles a previously empty static consumer query from the actual merge tree in both orders", async () => {
  const f = await fixture();
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "shared.ts"), "export const value = 1;\n"); const base = await commit(f.root);
  await writeFile(join(f.root, "shared.ts"), "export const value = 2;\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", base);
  await mkdir(join(f.root, "distant"));
  await writeFile(join(f.root, "distant/consumer.ts"), "import { value } from '../shared.js'; export const result = value;\n"); const incoming = await commit(f.root);
  await writeFile(join(f.root, "shared.ts"), "staged checkout must not be analyzed\n"); await git(f.root, "add", "shared.ts");
  await writeFile(join(f.root, "dirty.txt"), "preserve dirty\n");
  const before = await git(f.root, "status", "--porcelain=v1");
  for (const [a, b] of [[target, incoming], [incoming, target]]) {
    const report = await assessGitIntegration(f.root, { target: a!, incoming: b! });
    expect(report.resultReconciliation?.consumerQueries).toContainEqual(expect.objectContaining({ dependencyPath: "shared.ts", resultConsumers: ["distant/consumer.ts"], newlyRelevantConsumers: ["distant/consumer.ts"] }));
    expect(report.resultReconciliation?.behavior).toEqual({ status: "not-assessed", reusable: false });
  }
  expect(await git(f.root, "status", "--porcelain=v1")).toBe(before);
  expect(await git(f.root, "rev-parse", "HEAD")).toBe(incoming);
});
test("uses supplied result-only source changes, exposes unsupported dynamic imports, and rejects source contradictions", async () => {
  const f = await fixture();
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "shared.ts"), "export const value = 1;\n"); const base = await commit(f.root);
  await writeFile(join(f.root, "shared.ts"), "export const value = 2;\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", base);
  await writeFile(join(f.root, "other.ts"), "export const other = 1;\n"); const incoming = await commit(f.root);
  await git(f.root, "merge", "--no-edit", target);
  await writeFile(join(f.root, "result-only.ts"), "import { value } from './shared.js'; export const integrated = value;\n");
  await writeFile(join(f.root, "dynamic.ts"), "const specifier = './shared.js'; export const load = () => import(specifier);\n");
  const result = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target, incoming, result });
  expect(report.resultOnlyPaths).toContain("result-only.ts");
  expect(report.resultReconciliation.consumerQueries).toContainEqual(expect.objectContaining({ dependencyPath: "shared.ts", targetConsumers: [], incomingConsumers: [], resultConsumers: ["result-only.ts"] }));
  expect(report.resultReconciliation.status).toBe("incomplete");
  expect(report.resultReconciliation.unknowns.join(" ")).toMatch(/dynamic|import|dependency/i);
  expect(report.resultReconciliation.semanticChanges).toContainEqual(expect.objectContaining({ path: "result-only.ts" }));
  await writeFile(join(f.root, "broken.ts"), "import { absent } from './missing.js'; export const broken = absent;\n");
  const broken = await commit(f.root);
  const invalid = await assessGitIntegration(f.root, { target, incoming, result: broken });
  expect(invalid.status).toBe("invalid");
  expect(invalid.resultReconciliation.contradictions.join(" ")).toMatch(/broken-static-import/);
  expect(invalid.resultReconciliation.behavior.reusable).toBe(false);
});
test("recomputes event consumers even when the producer branch population was empty", async () => {
  const f = await fixture();
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "producer.ts"), "export function send(bus) { bus.emit('changed'); }\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "listener.ts"), "export function listen(bus) { bus.on('changed', () => {}); }\n"); const incoming = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target, incoming });
  expect(report.resultReconciliation.topologyQueries).toContainEqual(expect.objectContaining({ subjectKind: "event", targetConsumers: [], resultConsumers: expect.arrayContaining([expect.any(String)]), newlyRelevantConsumers: expect.arrayContaining([expect.any(String)]) }));
});
test("recomputes a previously empty active lens selector and exposes its new result obligations", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.base);
  const placeholder = `sha256:v1:${"0".repeat(64)}`;
  const authority = { id: "authority:integration", key: "authority:integration", subjectId: "lens:integration", status: "approved", conclusion: "preserve", rationale: "Require script placement.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 0, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 0, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: placeholder };
  const lens = createRepositoryScriptLens({ id: "lens:integration", status: "active", selector: { op: "atom", field: "path", matcher: "equals", value: "new-script.ts" }, authorityRecordId: authority.id, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:base" }] });
  const store = new CanonicalFileRepository(f.root);
  await store.write(withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind: "authority-record", id: authority.id, key: authority.key, lifecycle: "approved", payload: authority }));
  await store.write(withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: "active", payload: { ...lens } }));
  const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "new-script.ts"), "export const run = () => 1;\n"); const incoming = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target, incoming });
  const population = report.resultReconciliation.lensPopulations.find(item => item.lensId === lens.id)!;
  expect(population.targetMembers).toEqual([]); expect(population.incomingMembers).toEqual([]);
  expect(population.newlyApplicableUnitIds).toEqual(population.resultMembers);
  expect(population.resultObligations).toHaveLength(1);
  expect(population.resultObligations[0]!.validatorIds.length).toBeGreaterThan(0);
  expect(report.resultReconciliation.status).toBe("failed");
  expect(report.resultReconciliation.contradictions.join(" ")).toContain("static governance violated");
  expect(report.contributions.every(item => item.status === "preserved")).toBe(true);
});
test("does not promote same-named exports in separate modules into a source contradiction", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "first.ts"), "export const value = 1;\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.base);
  await writeFile(join(f.root, "second.ts"), "export const value = 2;\n"); const incoming = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target, incoming });
  expect(report.status).toBe("review-required");
  expect(report.resultReconciliation.contradictions).toEqual([]);
  expect(report.resultReconciliation.unknowns.join(" ")).toContain("duplicate-public-export");
});
test("applies finite source-tree byte limits without changing HEAD or the dirty index", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.target);
  await writeFile(join(f.root, "large.ts"), `export const value = '${"x".repeat(10_000)}';\n`); const target = await commit(f.root);
  await writeFile(join(f.root, "large.ts"), "staged dirty bytes\n"); await git(f.root, "add", "large.ts");
  const before = await git(f.root, "status", "--porcelain=v1");
  await expect(assessGitIntegration(f.root, { target, incoming: f.incoming }, { limits: { maxFileBytes: 4096 } })).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxFileBytes", scope: "large.ts" });
  expect(await git(f.root, "status", "--porcelain=v1")).toBe(before);
  expect(await git(f.root, "rev-parse", "HEAD")).toBe(target);
});
test("compares both semantic contributions against a calculated tree in either merge order", async () => {
  const f = await fixture(); await writeFile(join(f.root, "dirty.txt"), "untouched");
  for (const [target, incoming] of [[f.target, f.incoming], [f.incoming, f.target]]) {
    const result = await assessGitIntegration(f.root, { target: target!, incoming: incoming! });
    expect(result.contributions).toHaveLength(2); expect(result.contributions.every(c => c.status === "preserved")).toBe(true);
    expect(result.canonicalValidation.status).toBe("passed"); expect(result.requiresReview).toBe(true);
  }
  expect(await readFile(join(f.root, "dirty.txt"), "utf8")).toBe("untouched");
});
test("reports lost incoming meaning even when the supplied tree is coherent", async () => {
  const f = await fixture(); const result = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: f.target });
  expect(result.contributions).toContainEqual(expect.objectContaining({ side: "incoming", entityId: "concept:incoming", status: "lost" }));
  expect(result.resultSource).toBe("supplied");
});
test("rejects an explicit base that is not an ancestor of both branches and bounded/cancelled observation", async () => {
  const f = await fixture(); await expect(assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, base: f.target })).rejects.toThrow(/ancestor/);
  const request = { target: f.target, incoming: f.incoming };
  await expect(assessGitIntegration(f.root, request, { limits: { maxGitOutputBytes: 1 } })).rejects.toMatchObject({ code: "observation-limit-exceeded" });
  await expect(assessGitIntegration(f.root, request, { limits: { maxDerivedBytes: 32 } })).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxDerivedBytes" });
  await expect(assessGitIntegration(f.root, request, { limits: { maxFileBytes: 32 } })).rejects.toMatchObject({ code: "observation-limit-exceeded", limit: "maxFileBytes" });
  const c = new AbortController(); c.abort(new Error("cancel integration")); await expect(assessGitIntegration(f.root, request, { signal: c.signal })).rejects.toThrow(/cancel/);
});
test("fetches contributions from independent clones and survives removal of their source checkouts", async () => {
  const f = await fixture();
  const cloneA = await mkdtemp(join(tmpdir(), "projector-source-a-")), cloneB = await mkdtemp(join(tmpdir(), "projector-source-b-")); roots.push(cloneA, cloneB);
  await git(cloneA, "clone", "-q", f.root, "."); await git(cloneB, "clone", "-q", f.root, ".");
  for (const [clone, id] of [[cloneA, "a"], [cloneB, "b"]]) {
    await git(clone!, "config", "user.email", "test@example.invalid"); await git(clone!, "config", "user.name", "Test"); await git(clone!, "checkout", "-q", f.base);
    await meaning(clone!, id!, `${id} meaning.`); await writeFile(join(clone!, `${id}.txt`), id!); await commit(clone!);
  }
  await git(f.root, "fetch", "-q", cloneA, "HEAD:refs/heads/a"); await git(f.root, "fetch", "-q", cloneB, "HEAD:refs/heads/b");
  await rm(cloneA, { recursive: true }); await rm(cloneB, { recursive: true });
  const result = await assessGitIntegration(f.root, { target: "a", incoming: "b" });
  expect(result.contributions.map(c => [c.entityId, c.status])).toEqual([["concept:a", "preserved"], ["concept:b", "preserved"]]);
  expect(result.codeContributions.every(c => c.status === "preserved")).toBe(true);
});
test("preserves an ordinary rebased contribution after the first branch lands and its source clone is removed", async () => {
  // The plan's oracle is unchanged authored meaning and file content, independent of commit/session identity.
  const f = await fixture(), source = await mkdtemp(join(tmpdir(), "projector-rebase-source-")); roots.push(source);
  await git(source, "clone", "-q", f.root, ".");
  await git(source, "config", "user.email", "test@example.invalid"); await git(source, "config", "user.name", "Test");
  await git(source, "fetch", "-q", f.root, f.target); await git(source, "checkout", "-qb", "incoming", f.incoming);
  await git(source, "rebase", "--onto", f.target, f.base);
  const rebased = await git(source, "rev-parse", "HEAD"); expect(rebased).not.toBe(f.incoming);
  expect(await git(source, "merge-base", "--is-ancestor", f.target, rebased)).toBe("");
  await git(f.root, "fetch", "-q", source, "HEAD:refs/heads/rebased");
  await meaning(source, "incoming", "Resolution materially changes incoming meaning."); await writeFile(join(source, "incoming.txt"), "changed during resolution\n");
  const altered = await commit(source); await git(f.root, "fetch", "-q", source, "HEAD:refs/heads/rebased-altered");
  await rm(source, { recursive: true });
  const report = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: rebased });
  expect(report.contributions.map(c => [c.side, c.entityId, c.status])).toEqual([["target", "concept:target", "preserved"], ["incoming", "concept:incoming", "preserved"]]);
  expect(report.codeContributions.every(c => c.status === "preserved")).toBe(true); expect(report.resultCommit).toBe(rebased);
  const refreshed = await assessGitIntegration(f.root, { target: f.target, incoming: rebased });
  expect(refreshed.baseCommit).toBe(f.target); expect(refreshed.contributions).toEqual([expect.objectContaining({ side: "incoming", entityId: "concept:incoming", status: "preserved" })]);
  const changed = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: altered });
  expect(changed.contributions).toContainEqual(expect.objectContaining({ side: "incoming", entityId: "concept:incoming", status: "altered" }));
  expect(changed.codeContributions).toContainEqual({ side: "incoming", path: "incoming.txt", change: "added", status: "altered" }); expect(changed.requiresReview).toBe(true);
});
test("assesses ordinary linked-worktree commits through shared objects without changing either checkout", async () => {
  const f = await fixture(), linked = await mkdtemp(join(tmpdir(), "projector-integration-worktree-")); roots.push(linked);
  await git(f.root, "worktree", "add", "--detach", linked, f.target);
  await meaning(linked, "worktree", "Ordinary linked-worktree contribution."); await writeFile(join(linked, "worktree.txt"), "linked contribution\n"); const target = await commit(linked);
  await writeFile(join(linked, "dirty.txt"), "linked dirty\n"); await writeFile(join(f.root, "dirty.txt"), "main dirty\n");
  const before = await Promise.all([git(f.root, "rev-parse", "HEAD"), git(linked, "rev-parse", "HEAD"), git(f.root, "status", "--porcelain=v1"), git(linked, "status", "--porcelain=v1")]);
  const indexPaths = await Promise.all([git(f.root, "rev-parse", "--path-format=absolute", "--git-path", "index"), git(linked, "rev-parse", "--path-format=absolute", "--git-path", "index")]);
  const indicesBefore = await Promise.all(indexPaths.map(path => readFile(path)));
  const fromMain = await assessGitIntegration(f.root, { target, incoming: f.incoming });
  const fromLinked = await assessGitIntegration(linked, { target, incoming: f.incoming });
  expect(fromLinked.resultTree).toBe(fromMain.resultTree); expect(fromLinked.contributions).toEqual(fromMain.contributions);
  expect(fromLinked.contributions).toContainEqual(expect.objectContaining({ side: "target", entityId: "concept:worktree", status: "preserved" }));
  expect(fromLinked.codeContributions.every(c => c.status === "preserved")).toBe(true);
  expect(await Promise.all([git(f.root, "rev-parse", "HEAD"), git(linked, "rev-parse", "HEAD"), git(f.root, "status", "--porcelain=v1"), git(linked, "status", "--porcelain=v1")])).toEqual(before);
  expect(await Promise.all(indexPaths.map(path => readFile(path)))).toEqual(indicesBefore);
  expect(await readFile(join(linked, "dirty.txt"), "utf8")).toBe("linked dirty\n"); expect(await readFile(join(f.root, "dirty.txt"), "utf8")).toBe("main dirty\n");
});
test("reports unresolved text conflicts without parsing conflict-marked canonical content", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.target); await writeFile(join(f.root, "shared.txt"), "target\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.incoming); await writeFile(join(f.root, "shared.txt"), "incoming\n"); const incoming = await commit(f.root);
  const result = await assessGitIntegration(f.root, { target, incoming }); expect(result.conflictPaths).toContain("shared.txt"); expect(result.status).toBe("conflicted"); expect(result.canonicalValidation.status).toBe("not-assessed");
});
test("compares overlapping semantic edits after a clean textual merge and detects altered meaning", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.target); await meaning(f.root, "base", "Target changes the invariant."); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.incoming); const files = new CanonicalFileRepository(f.root); const located = await files.locate("concept", "concept:base");
  const text = await readFile(located!.path, "utf8"); await writeFile(located!.path, text.replace("# base", "# Incoming name")); const incoming = await commit(f.root);
  const result = await assessGitIntegration(f.root, { target, incoming });
  expect(result.conflictPaths).toEqual([]); expect(result.semanticOverlapIds).toContain("concept:base"); expect(result.contributions.filter(c => c.entityId === "concept:base").every(c => c.status === "altered")).toBe(true);
});
test("reports a dropped authored alias change even though native semantic fields are unchanged", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.incoming);
  const file = (await new CanonicalFileRepository(f.root).locate("concept", "concept:base"))!.path;
  const source = await readFile(file, "utf8"); await writeFile(file, source.replace("aliases = []", 'aliases = ["Additional lookup"]')); const incoming = await commit(f.root);
  const result = await assessGitIntegration(f.root, { target: f.target, incoming, result: f.target });
  expect(result.contributions).toContainEqual(expect.objectContaining({ entityId: "concept:base", side: "incoming", status: "lost" }));
});
test("accepts content-equivalent squashed results and rejects invalid canonical final sources", async () => {
  const f = await fixture(); const calculated = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming });
  const squash = await git(f.root, "commit-tree", calculated.resultTree, "-p", f.base, "-m", "squash");
  const report = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: squash });
  expect(report.contributions.every(c => c.status === "preserved")).toBe(true); expect(report.resultCommit).toBe(squash);
  await writeFile(join(f.root, ".projector/model/concepts/broken.md"), "not canonical metadata"); const broken = await commit(f.root);
  expect((await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: broken })).canonicalValidation.status).toBe("failed");
});
test("refuses an included repository merge driver without executing it", async () => {
  const f = await fixture(); const marker = join(f.root, "executed-driver.txt");
  const config = join(f.root, ".git", "included-config");
  await writeFile(config, '[merge "unsafe"]\n driver = echo executed > executed-driver.txt\n'); await git(f.root, "config", "include.path", config);
  await expect(assessGitIntegration(f.root, { target: f.target, incoming: f.incoming })).rejects.toThrow(/custom merge drivers/);
  await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result: f.target })).resultSource).toBe("supplied");
});
test("pins committed attributes despite dirty worktree attributes and refuses info overrides", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.target); await writeFile(join(f.root, "shared.txt"), "target\n"); const target = await commit(f.root);
  await git(f.root, "checkout", "-q", f.incoming); await writeFile(join(f.root, "shared.txt"), "incoming\n"); const incoming = await commit(f.root);
  await writeFile(join(f.root, ".gitattributes"), "shared.txt merge=union\n");
  const report = await assessGitIntegration(f.root, { target, incoming }); expect(report.conflictPaths).toContain("shared.txt");
  expect(await readFile(join(f.root, ".gitattributes"), "utf8")).toBe("shared.txt merge=union\n");
  await writeFile(join(f.root, ".git/info/attributes"), "shared.txt merge=union\n");
  await expect(assessGitIntegration(f.root, { target, incoming })).rejects.toThrow(/info\/attributes/);
});
test("reports altered code and novel result-only edits", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.target); await writeFile(join(f.root, "target.txt"), "novel result\n"); const result = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result });
  expect(report.codeContributions).toContainEqual({ side: "target", path: "target.txt", change: "added", status: "altered" }); expect(report.resultOnlyPaths).toContain("target.txt");
});
test("accounts for authored config and unchanged-hash relationship records", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.incoming);
  await writeFile(join(f.root, ".projector/config.toml"), 'apiVersion = "projector.config/v3"\nenabled = true\nprojectorVersion = "3.0.0"\n');
  const hash = `sha256:v1:${"0".repeat(64)}`;
  const relation = withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind: "relation", id: "relation:link", key: "relation:relation:link", lifecycle: "active", payload: { id: "relation:link", fromId: "concept:base", toId: "concept:incoming", type: "depends-on", sourceClass: "authored", confidence: 1, evidence: [], active: true, semanticHash: hash } });
  await new CanonicalFileRepository(f.root).write(relation); const incoming = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target: f.target, incoming, result: f.target });
  expect(report.codeContributions).toContainEqual({ side: "incoming", path: ".projector/config.toml", change: "added", status: "lost" });
  expect(report.contributions).toContainEqual(expect.objectContaining({ entityId: "relation:link", side: "incoming", status: "lost" }));
});
test("reports a retained relation to a demonstrably removed canonical identity as invalid", async () => {
  const f = await fixture(); await git(f.root, "checkout", "-q", f.incoming);
  const hash = `sha256:v1:${"0".repeat(64)}`;
  await new CanonicalFileRepository(f.root).write(withCanonicalHashes({ apiVersion: canonicalApiVersion, schemaVersion: canonicalSchemaVersion, kind: "relation", id: "relation:link", key: "relation:relation:link", lifecycle: "active", payload: { id: "relation:link", fromId: "concept:base", toId: "concept:incoming", type: "depends-on", sourceClass: "authored", confidence: 1, evidence: [], active: true, semanticHash: hash } }));
  const file = (await new CanonicalFileRepository(f.root).locate("concept", "concept:base"))!.path; await rm(file); const result = await commit(f.root);
  const report = await assessGitIntegration(f.root, { target: f.target, incoming: f.incoming, result });
  expect(report.canonicalValidation.status).toBe("passed"); expect(report.staticGovernanceValidation.status).toBe("failed"); expect(report.status).toBe("invalid");
});
