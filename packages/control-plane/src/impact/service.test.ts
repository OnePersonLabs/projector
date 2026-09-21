import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DerivedObservationBudget, ObservationError, hashFramedDomain, withCanonicalHashes, type AuthorityRecord, type ImpactRule } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { buildRepositoryImpactSnapshot, impactReference, persistRepositoryImpactSnapshot, predictRepositoryImpact, readRepositoryImpactSnapshot, reconcileRepositoryImpact, reconcileRetainedImpact, type RepositoryImpactSnapshot } from "./service.js";

const roots: string[] = [];
async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-impact-")); roots.push(root);
  await writeFile(join(root, "package.json"), '{"name":"impact-fixture","type":"module"}\n');
  await writeFile(join(root, "value.ts"), "export const value = () => 1;\n");
  await writeFile(join(root, "consumer.ts"), "import { value } from './value.js'; export const consume = () => value();\n");
  await writeFile(join(root, "entry.ts"), "import { consume } from './consumer.js'; export const run = () => consume();\n");
  await writeFile(join(root, "other.ts"), "export const other = 1;\n");
  return root;
}
const snapshot = async (root: string) => buildRepositoryImpactSnapshot(await observeChangeRepository(root));
const unit = (value: RepositoryImpactSnapshot, path: string) => value.files.find((file) => file.path === path)!.unitIds[0]!;
const rehash = (value: RepositoryImpactSnapshot): RepositoryImpactSnapshot => { const { contentHash: _hash, ...basis } = value; return { ...basis, contentHash: hashFramedDomain(value.version, basis) }; };
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("observed derivation impact", () => {
  it("folds independent event proofs without accumulating full per-event repository results", async () => {
    const root = await repository();
    const paths = Array.from({ length: 20 }, (_, index) => `independent-${index}.ts`);
    for (const path of paths) await writeFile(join(root, path), "export const independent = 1;\n");
    const before = await snapshot(root);
    const budget = new DerivedObservationBudget(48_000);
    const prediction = await predictRepositoryImpact(before, paths, [], budget);
    expect(prediction.knownAffectedUnitIds).toEqual(paths.map((path) => unit(before, path)).sort());
    expect(budget.usedBytes).toBeLessThan(48_000);
  });
  it("rejects derived record expansion before publishing an oversized impact snapshot", async () => {
    const observation = await observeChangeRepository(await repository());
    const graph = new KnowledgeGraph(observation, {}, new DerivedObservationBudget(2048));
    expect(() => buildRepositoryImpactSnapshot(observation, graph)).toThrow(ObservationError);
  });
  it("distinguishes ordinary context changes from an actual plan predicting no changes", async () => {
    const root = await repository(); const before = await snapshot(root);
    await writeFile(join(root, "other.ts"), "export const other = 2;\n");
    const after = await snapshot(root);
    const ordinary = await reconcileRepositoryImpact(before, after, [], "context:ordinary", [], false);
    expect(ordinary.observedChangedUnitIds).toContain(unit(before, "other.ts"));
    expect(ordinary.surprises).toEqual([]);
    expect(ordinary.candidateRelations).toEqual([]);
    const planned = await reconcileRepositoryImpact(before, after, [], "plan:empty");
    expect(planned.surprises).toHaveLength(1);
    expect(planned.surprises[0]?.unexpectedEntityIds).toContain(unit(before, "other.ts"));
  });

  it("rejects changed ignore scope and enumeration method without reporting removed files", async () => {
    const root = await repository(); const before = await snapshot(root);
    const descriptor = before.observationDescriptor!;
    for (const changed of [
      { ...descriptor, ignoreSources: [{ path: ".git/info/exclude", contentHash: "changed-exclusions" }] },
      { ...descriptor, enumerationMethod: "git-index-and-nonignored-untracked" as const },
    ]) {
      const after = rehash({ ...before, observationDescriptor: changed, files: [] });
      const result = await reconcileRepositoryImpact(before, after, [], "plan:changed-scope");
      expect(result).toMatchObject({ status: "unavailable", observedChangedUnitIds: [], knownAffectedUnitIds: [], surprises: [], candidateRelations: [] });
      expect(result.diagnostics.join(" ")).toContain("Capture fresh context");
    }
    const largerLimits = rehash({ ...before, observationDescriptor: { ...descriptor, limits: { ...descriptor.limits, maxFiles: descriptor.limits.maxFiles + 1 } } });
    expect(await reconcileRepositoryImpact(before, largerLimits, [], "plan:compatible-limits")).toMatchObject({ repairRoute: "reuse", observedChangedUnitIds: [], surprises: [] });
  });

  it("treats authenticated legacy snapshots without observation coverage as unavailable", async () => {
    const root = await repository(); const current = await snapshot(root);
    const { observationDescriptor: _descriptor, ...rest } = current;
    const legacy = rehash({ ...rest, version: "repository-impact@1" });
    const result = await reconcileRepositoryImpact(legacy, current, [], "plan:legacy");
    expect(result).toMatchObject({ status: "unavailable", observedChangedUnitIds: [], surprises: [] });
    expect(result.diagnostics.join(" ")).toContain("legacy proof");
    expect(await predictRepositoryImpact(legacy, ["value.ts"])).toMatchObject({ status: "unavailable", knownAffectedUnitIds: [] });
  });
  it("propagates a behavior-only literal change through transitive static consumers and repeats after refresh", async () => {
    const root = await repository(); const before = await snapshot(root);
    const prediction = await predictRepositoryImpact(before, ["value.ts"]);
    expect(prediction.knownAffectedUnitIds).toEqual(expect.arrayContaining([unit(before, "value.ts"), unit(before, "consumer.ts"), unit(before, "entry.ts")]));
    expect(prediction.knownAffectedUnitIds).not.toContain(unit(before, "other.ts"));
    await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
    const after = await snapshot(root);
    const first = await reconcileRepositoryImpact(before, after, prediction.knownAffectedUnitIds, "plan:first");
    expect(first.knownAffectedUnitIds).toEqual(expect.arrayContaining([unit(before, "consumer.ts"), unit(before, "entry.ts")]));
    expect(first.backdatedUnitIds).not.toContain(unit(before, "value.ts"));
    expect(first.surprises).toEqual([]);
    await persistRepositoryImpactSnapshot(root, after);
    const retained = await readRepositoryImpactSnapshot(root, impactReference(after));
    await writeFile(join(root, "value.ts"), "export const value = () => 3;\n");
    const second = await reconcileRepositoryImpact(retained, await snapshot(root), prediction.knownAffectedUnitIds, "plan:second");
    expect(second.knownAffectedUnitIds).toContain(unit(after, "entry.ts"));
    expect(second.repairRoute, JSON.stringify(second)).toBe("revalidate");
    const unchanged = await reconcileRepositoryImpact(after, after, prediction.knownAffectedUnitIds, "plan:unchanged");
    expect(unchanged).toMatchObject({ status: "current", repairRoute: "reuse", knownAffectedUnitIds: [], surprises: [] });
  });

  it("reports saved context changes without inventing a planning prediction", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "Change value", namedTargets: ["value.ts"] });
    const before = await snapshot(root);
    await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
    await writeFile(join(root, "other.ts"), "export const other = 2;\n");
    const result = await service.reconcile(retained.id);
    expect(result.impact?.surprises).toEqual([]);
    expect(result.impact?.observedChangedUnitIds).toContain(unit(before, "other.ts"));
    expect(result.impact?.candidateRelations).toEqual([]);
    expect(result.impact?.repairRoute).toBe("revalidate");
    const actualPlan = await reconcileRepositoryImpact(before, await snapshot(root), [unit(before, "value.ts")], "plan:value");
    expect(actualPlan.surprises).toHaveLength(1);
    expect(actualPlan.surprises[0]?.unexpectedEntityIds).toContain(unit(before, "other.ts"));
    expect(actualPlan.candidateRelations.length).toBeGreaterThan(0);
    expect(actualPlan.candidateRelations.every(({ sourceClass }) => sourceClass === "inferred")).toBe(true);
    expect((await observeChangeRepository(root)).canonical.documents).toHaveLength(0);
    expect((await service.reconcile(retained.id)).impact?.contentHash).toBe(result.impact?.contentHash);
  });

  it("rejects tampered cached proof without overwriting corruption during fresh capture", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const context = await service.context({ request: "Value", namedTargets: ["value.ts"] });
    const directory = join(root, ".projector", "runtime", "impact");
    const path = join(directory, (await readdir(directory))[0]!);
    const original = await readFile(path, "utf8");
    const tampered = JSON.parse(original) as RepositoryImpactSnapshot;
    await writeFile(path, JSON.stringify({ ...tampered, records: [] }));
    expect((await service.reconcile(context.id)).impact).toMatchObject({ status: "unavailable", repairRoute: "widen-analysis" });
    await expect(service.context({ request: "Value", namedTargets: ["value.ts"] })).rejects.toThrow(/corrupt|mismatch|differ|conflict/i);
    expect(await readFile(path, "utf8")).not.toBe(original);
    // Explicitly restoring the original authenticated proof repairs this fixture's corrupted slot.
    await writeFile(path, original);
    expect((await service.reconcile(context.id)).impact?.status).toBe("current");
    const current = await snapshot(root);
    const { canonical: _canonical, contentHash: _hash, ...incompatible } = current;
    const malformed = { ...incompatible, contentHash: hashFramedDomain(current.version, incompatible) };
    const reference = { version: current.version, contentHash: malformed.contentHash, state: current.state };
    await writeFile(join(directory, `${reference.contentHash.slice("sha256:v1:".length)}.json`), JSON.stringify(malformed));
    const unavailable = await reconcileRetainedImpact(root, reference, current, [], context.id);
    expect(unavailable).toMatchObject({ status: "unavailable", repairRoute: "widen-analysis" });
    expect(unavailable.diagnostics.join(" ")).toContain("canonical");
  });

  it("does not persist impact artifacts for an observing-only context or compilation", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    await service.context({ request: "Value", namedTargets: ["value.ts"], persist: false });
    await predictRepositoryImpact(await snapshot(root), ["value.ts"]);
    await expect(readdir(join(root, ".projector", "runtime", "impact"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps dynamic importers on the possible frontier without fabricating exact inputs", async () => {
    const root = await repository();
    await writeFile(join(root, "other.ts"), "export const load = (path: string) => import(path);\n");
    const before = await snapshot(root); const otherId = unit(before, "other.ts");
    const predicted = await predictRepositoryImpact(before, ["value.ts"]);
    expect(predicted.possibleFrontierUnitIds).toContain(otherId);
    expect(before.records.find(({ unitId }) => unitId === otherId)?.inputs.some(({ kind }) => kind === "unit")).toBe(false);
    expect(predicted.repairRoute).toBe("widen-analysis");
  });

  it("never backdates an unknown profile or an AST-shaped approximation as business behavior", async () => {
    const root = await repository(); const actual = await snapshot(root);
    const targetId = unit(actual, "value.ts");
    const before = rehash({ ...actual, records: actual.records.map((record) => record.unitId !== targetId ? record : { ...record, outputSemanticSignature: { ...record.outputSemanticSignature, profileId: "unknown.ast-shape" }, outputStructuralSignature: { ...record.outputStructuralSignature, profileId: "unknown.ast-shape" } }) });
    await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
    const result = await reconcileRepositoryImpact(before, await snapshot(root), [targetId], "plan:unknown-profile");
    expect(result.backdatedUnitIds).not.toContain(targetId);
    expect(result.knownAffectedUnitIds).toContain(unit(actual, "entry.ts"));
  });

  it("runs active lens Impact Rules while keeping inferred relations out of exact derivations", async () => {
    const root = await repository(); const initial = await snapshot(root);
    const sourceId = unit(initial, "value.ts"); const otherId = unit(initial, "other.ts");
    const canonicalStore = new CanonicalFileRepository(root);
    const placeholder = hashFramedDomain("impact-test", null);
    const authority: AuthorityRecord = { id: "authority:impact", key: "authority:impact", subjectId: "lens:impact", status: "approved", conclusion: "preserve", rationale: "Inspect the bounded dependent relation.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 0, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 0, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: placeholder };
    const selector = { op: "atom" as const, field: "path" as const, matcher: "equals" as const, value: "value.ts" };
    const impactRule: ImpactRule = { id: "impact:consumer", key: "consumer", version: "1", selector, trigger: "external-change", direction: "forward", relationTypes: ["depends-on"], maxDepth: 2, effect: "widen-analysis", semanticHash: placeholder };
    const lens = { ...createRepositoryScriptLens({ id: "lens:impact", status: "active", selector, authorityRecordId: authority.id, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:impact" }] }), impactRules: [impactRule] };
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "concept", id: "concept:impact", key: "impact", lifecycle: "active", payload: { id: "concept:impact", key: "impact", name: "Impact", kind: "constraint", aliases: [], statement: "Inspect changed dependencies.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "authority-record", id: authority.id, key: authority.key, lifecycle: "approved", payload: { ...authority } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: "active", payload: { ...lens } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "relation", id: "relation:possible-impact", key: "relation:relation:possible-impact", lifecycle: "active", payload: { id: "relation:possible-impact", fromId: sourceId, toId: otherId, type: "depends-on", sourceClass: "inferred", confidence: 1, evidence: [], active: true, semanticHash: placeholder } }));
    const governed = await observeChangeRepository(root);
    expect(() => new KnowledgeGraph(governed, {}, new DerivedObservationBudget(1))).toThrow(ObservationError);
    const obligationBudget = new DerivedObservationBudget(2048);
    const guardedGraph = new KnowledgeGraph(governed, {}, obligationBudget);
    expect(() => guardedGraph.lensObligations(new Set([lens.id, ...guardedGraph.units.map(({ id }) => id)]), "inspect")).toThrow(ObservationError);
    const requestBudget = new DerivedObservationBudget(1_000_000);
    const requestGraph = new KnowledgeGraph(governed, {}, requestBudget);
    const selected = new Set([lens.id, ...requestGraph.units.map(({ id }) => id)]);
    const beforeObligations = requestBudget.usedBytes;
    requestGraph.lensObligations(selected, "inspect");
    const obligationBytes = requestBudget.usedBytes - beforeObligations;
    requestBudget.reserve(1_000_000 - requestBudget.usedBytes - obligationBytes, "test-existing-derived-data");
    let requestError: unknown;
    try { requestGraph.validatorRequests(selected, "inspect"); } catch (error) { requestError = error; }
    expect(requestError).toMatchObject({ code: "observation-limit-exceeded", stage: "validator-request" });
    const before = await snapshot(root);
    expect(before.rules).toHaveLength(1);
    expect(before.records.find(({ unitId }) => unitId === sourceId)?.inputs.some(({ id }) => id === otherId)).toBe(false);
    const prediction = await predictRepositoryImpact(before, ["value.ts"]);
    expect(prediction.possibleFrontierUnitIds).toContain(otherId);
    expect(prediction.knownAffectedUnitIds).not.toContain(otherId);
    await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
    const result = await reconcileRepositoryImpact(before, await snapshot(root), prediction.knownAffectedUnitIds, "plan:rule");
    expect(result.possibleFrontierUnitIds).toContain(otherId);
    expect(result.repairRoute).toBe("widen-analysis");
    const conceptualLens = { ...lens, impactRules: [{ ...impactRule, trigger: "concept-change" as const }] };
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: "active", payload: { ...conceptualLens } }));
    const beforeMeaning = await snapshot(root);
    const concept = (await canonicalStore.snapshot()).documents.find(({ kind }) => kind === "concept")!;
    await canonicalStore.write(withCanonicalHashes({ ...concept, payload: { ...concept.payload, statement: "Changed behavior requires review even when current source bytes are identical." } }));
    const meaningResult = await reconcileRepositoryImpact(beforeMeaning, await snapshot(root), [sourceId], "plan:meaning");
    expect(meaningResult.backdatedUnitIds).not.toContain(sourceId);
    expect(meaningResult.repairRoute).toBe("widen-analysis");
  });
});
