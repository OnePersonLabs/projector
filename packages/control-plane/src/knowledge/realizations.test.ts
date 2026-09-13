import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DerivedObservationBudget, hashFramedDomain, withCanonicalHashes, type CanonicalDocumentEnvelope, type RealizationBinding } from "@projector/core";
import { evaluateSelectorMembership, projectionUnitSelectorSubject } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { inspectRepositoryCoverage } from "../coverage/service.js";
import { KnowledgeGraph } from "./graph.js";
import { RepositoryKnowledgeService } from "./service.js";
import { compileCanonicalRealizations } from "./realizations.js";

const roots: string[] = [];
const origin: RealizationBinding["origin"] = { kind: "content", locator: "fixture:accepted-realization", contentHash: hashFramedDomain("realization-test-source", "accepted-realization") };
const legacyScope = { op: "any" as const, items: ["packages/control-plane/src/knowledge/**", "packages/engine/src/relevance/**", "packages/engine/src/context/**", "packages/cli/src/knowledge-cli.ts", "packages/cli/src/mcp-cli.ts"].map((value) => ({ op: "atom" as const, field: "path" as const, matcher: "glob" as const, value })) };

async function file(root: string, path: string, contents = "export const value = 1;\n") {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
}
async function repository() {
  const root = await mkdtemp(join(tmpdir(), "projector-realizations-")); roots.push(root);
  await file(root, "package.json", '{"name":"realization-fixture","type":"module"}\n');
  await file(root, ".gitignore", ".projector/runtime/\n");
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
  return root;
}
async function canonical(root: string, kind: CanonicalDocumentEnvelope["kind"], payload: Record<string, unknown>) {
  const placeholder = hashFramedDomain("realization-fixture-placeholder", payload.id);
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id: String(payload.id), key: String(payload.key), lifecycle: String(payload.status), payload: { ...payload, semanticHash: placeholder, discoveryHash: placeholder } }));
}
const requirement = (realizations?: RealizationBinding[]) => ({ id: "requirement:pre-edit-relevance", key: "pre-edit-relevance", title: "Recover relevant meaning", aliases: [], statement: "Recover relevant meaning before editing.", status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, origin: [], evidence: [], ...(realizations === undefined ? {} : { realizations }) });
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 }))); });

describe("canonical realization composition", () => {
  it("bounds accepted-owner by unit expansion without returning partial realization memberships", async () => {
    const root = await repository();
    for (let index = 0; index < 24; index += 1) await file(root, `src/value-${index}.ts`);
    const raw = await observeChangeRepository(root);
    for (let index = 0; index < 24; index += 1) {
      await canonical(root, "requirement", { ...requirement([{ selector: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, origin }]), id: `requirement:bounded-${index}`, key: `bounded-${index}` });
    }
    const accepted = await new CanonicalFileRepository(root).snapshot();
    let failure: unknown;
    try { compileCanonicalRealizations(raw.analysis, accepted, new DerivedObservationBudget(128_000)); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "observation-limit-exceeded", limit: "maxDerivedBytes", stage: "realization-membership" });
  });
  it("preserves the explicit five-glob set and stales a moved realization at unchanged HEAD", async () => {
    const root = await repository();
    for (const path of ["packages/control-plane/src/knowledge/service.ts", "packages/engine/src/relevance/index.ts", "packages/engine/src/context/index.ts", "packages/cli/src/knowledge-cli.ts", "packages/cli/src/mcp-cli.ts", "packages/runtime/src/unrelated.ts"]) await file(root, path);
    await canonical(root, "requirement", requirement([{ selector: legacyScope, origin }]));
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["-c", "user.name=Projector Test", "-c", "user.email=projector-test@localhost", "commit", "--quiet", "-m", "fixture"], { cwd: root });
    const observation = await observeChangeRepository(root);
    const graph = new KnowledgeGraph(observation);
    const expected = evaluateSelectorMembership(legacyScope, graph.units.map((unit) => projectionUnitSelectorSubject(unit, { path: unit.key })), { observability: "bounded" }).memberIds;
    expect(expected).toHaveLength(5);
    expect(graph.implementationBindings("requirement:pre-edit-relevance").map(({ id }) => id).sort()).toEqual(expected);
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect relevance", entities: ["requirement:pre-edit-relevance"] });
    const dependency = retained.branches[0]!.closure.boundState.queryDependencies.find(({ query }) => query.programId === "projector.knowledge.implementation-binding" && query.input.subjectId === "requirement:pre-edit-relevance")!;
    expect(dependency.query.programVersion).toBe("2");
    expect(dependency.priorResult.dependencyKeys).toContain("canonical-realizations");
    await canonical(root, "requirement", requirement([{ selector: { op: "atom", field: "path", matcher: "glob", value: "not-present/**" }, origin }]));
    expect((await observeChangeRepository(root)).state.gitBase).toBe(observation.state.gitBase);
    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.status).toBe("stale");
    expect(reconciliation.branches[0]!.validation.changedQueryDependencyIds).toContain("knowledge-implementation:requirement:pre-edit-relevance");
    const current = await service.context({ request: "inspect relevance", entities: ["requirement:pre-edit-relevance"] });
    expect(current.unknowns.join(" ")).toContain("Declared realization has no members");
    expect(new KnowledgeGraph(await observeChangeRepository(root)).implementationBindings("requirement:pre-edit-relevance")).toEqual([]);
    const completion = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
    expect(completion.completion.questions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "unrealized-requirement", ownerIds: ["requirement:pre-edit-relevance"] })]));
    expect(completion.localAnalysis.realizations).toMatchObject({ unmatched: 1 });
    expect(completion.proofStatement).toBe("not-established");
  });

  it("keeps broad behavioral scope separate and reports unsupported declarations conservatively", async () => {
    const root = await repository(); await file(root, "src/value.ts");
    await canonical(root, "requirement", requirement());
    expect(new KnowledgeGraph(await observeChangeRepository(root)).implementationBindings("requirement:pre-edit-relevance")).toEqual([]);
    await canonical(root, "requirement", requirement([{ selector: { op: "atom", field: "path", matcher: "matches-structural-query", value: "src/value.ts" }, origin }]));
    const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect relevance", entities: ["requirement:pre-edit-relevance"] });
    expect(context.unknowns.join(" ")).toContain("Structural query realization needs an observer");
    const dependency = context.branches[0]!.closure.boundState.queryDependencies.find(({ query }) => query.programId === "projector.knowledge.implementation-binding")!;
    expect(dependency.priorResult.observability).toBe("unavailable");
    const completion = await inspectRepositoryCoverage(root, { scope: "." }, "complete");
    expect(completion.localAnalysis.realizations).toMatchObject({ unsupported: 1, matched: 0 });
  });

  it("composes each active entity kind from raw facts without admitting rejected owners", async () => {
    const root = await repository(); await file(root, "src/value.ts");
    const rawUnit = (await observeChangeRepository(root)).analysis.projectionUnits.find(({ key }) => key === "src/value.ts")!;
    const realizations: RealizationBinding[] = [{ selector: { op: "atom", field: "path", matcher: "glob", value: "src/**" }, origin }];
    await canonical(root, "requirement", requirement(realizations));
    await canonical(root, "concept", { id: "concept:owner", key: "owner", kind: "capability", name: "Owner", aliases: [], statement: "Own value.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], realizations });
    const scenario = { id: "scenario:owner", key: "owner-scenario", title: "Observe value", aliases: [], status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, steps: [{ role: "expected-outcome", statement: "Value is observed." }], evidence: [], realizations };
    await canonical(root, "behavioral-scenario", scenario);
    await canonical(root, "behavioral-scenario", { ...scenario, id: "scenario:rejected", key: "rejected", status: "rejected" });
    const observed = await observeChangeRepository(root);
    const realizedUnit = observed.analysis.projectionUnits.find(({ key }) => key === "src/value.ts")!;
    const membership = { conceptIds: ["concept:owner"], requirementIds: ["requirement:pre-edit-relevance"], scenarioIds: ["scenario:owner"] };
    expect(realizedUnit).toMatchObject(membership);
    expect(realizedUnit.membershipHash).toBe(hashFramedDomain("canonical-realization-membership", { rawMembershipHash: rawUnit.membershipHash, ...membership }));
    expect(await readFile(join(root, "src/value.ts"), "utf8")).toBe("export const value = 1;\n");
    expect((await inspectRepositoryCoverage(root, { scope: "." }, "complete")).proofStatement).toBe("not-established");
  });
});
