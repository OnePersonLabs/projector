import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFramedDomain, withCanonicalHashes, type AuthorityRecord, type ImpactRule } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
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
const rehash = (value: RepositoryImpactSnapshot): RepositoryImpactSnapshot => { const { contentHash: _hash, ...basis } = value; return { ...basis, contentHash: hashFramedDomain("repository-impact@1", basis) }; };
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("observed derivation impact", () => {
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

  it("reports outside edits and evidence-only relation candidates through saved context reconciliation", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "Change value", namedTargets: ["value.ts"] });
    const before = await snapshot(root);
    await writeFile(join(root, "value.ts"), "export const value = () => 2;\n");
    await writeFile(join(root, "other.ts"), "export const other = 2;\n");
    const result = await service.reconcile(retained.id);
    expect(result.impact?.surprises).toHaveLength(1);
    expect(result.impact?.surprises[0]?.unexpectedEntityIds).toContain(unit(before, "other.ts"));
    expect(result.impact?.candidateRelations.length).toBeGreaterThan(0);
    expect(result.impact?.candidateRelations.every(({ sourceClass }) => sourceClass === "inferred")).toBe(true);
    expect(result.impact?.repairRoute).toBe("widen-analysis");
    expect((await observeChangeRepository(root)).canonical.documents).toHaveLength(0);
    expect((await service.reconcile(retained.id)).impact?.contentHash).toBe(result.impact?.contentHash);
  });

  it("rejects tampered cached proof and deterministically rebuilds it on fresh persisted capture", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const context = await service.context({ request: "Value", namedTargets: ["value.ts"] });
    const directory = join(root, ".projector", "runtime", "impact");
    const path = join(directory, (await readdir(directory))[0]!);
    const original = await readFile(path, "utf8");
    const tampered = JSON.parse(original) as RepositoryImpactSnapshot;
    await writeFile(path, JSON.stringify({ ...tampered, records: [] }));
    expect((await service.reconcile(context.id)).impact).toMatchObject({ status: "unavailable", repairRoute: "widen-analysis" });
    const rebuilt = await service.context({ request: "Value", namedTargets: ["value.ts"] });
    expect(rebuilt.impactBaseline).toEqual(context.impactBaseline);
    expect(await readFile(path, "utf8")).toBe(original);
    expect((await service.reconcile(context.id)).impact?.status).toBe("current");
    const current = await snapshot(root);
    const { canonical: _canonical, contentHash: _hash, ...incompatible } = current;
    const malformed = { ...incompatible, contentHash: hashFramedDomain("repository-impact@1", incompatible) };
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
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: "concept:impact", key: "impact", lifecycle: "active", payload: { id: "concept:impact", key: "impact", name: "Impact", kind: "constraint", aliases: [], statement: "Inspect changed dependencies.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "authority-record", id: authority.id, key: authority.key, lifecycle: "approved", payload: { ...authority } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: "active", payload: { ...lens } }));
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: "relation:possible-impact", key: "relation:relation:possible-impact", lifecycle: "active", payload: { id: "relation:possible-impact", fromId: sourceId, toId: otherId, type: "depends-on", sourceClass: "inferred", confidence: 1, evidence: [], active: true, semanticHash: placeholder } }));
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
    await canonicalStore.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: "active", payload: { ...conceptualLens } }));
    const beforeMeaning = await snapshot(root);
    const concept = (await canonicalStore.snapshot()).documents.find(({ kind }) => kind === "concept")!;
    await canonicalStore.write(withCanonicalHashes({ ...concept, payload: { ...concept.payload, statement: "Changed behavior requires review even when current source bytes are identical." } }));
    const meaningResult = await reconcileRepositoryImpact(beforeMeaning, await snapshot(root), [sourceId], "plan:meaning");
    expect(meaningResult.backdatedUnitIds).not.toContain(sourceId);
    expect(meaningResult.repairRoute).toBe("widen-analysis");
  });
});
