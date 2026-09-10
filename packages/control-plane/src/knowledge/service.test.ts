import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  hashFramedDomain,
  withCanonicalHashes,
  type ArchitectureDecision,
  type AuthorityRecord,
  type Concept,
  type ProjectionLens,
  type Relation,
} from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { afterEach, describe, expect, it } from "vitest";

import { RepositoryKnowledgeService } from "./service.js";
import { KnowledgeGraph } from "./graph.js";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";

const roots: string[] = [];
const hash = (label: string) => hashFramedDomain("knowledge-test", label);

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-knowledge-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "knowledge-fixture", type: "module" })}\n`, "utf8");
  await writeFile(join(root, "index.ts"), "export const value = 1;\n", "utf8");
  return root;
}

function concept(id: string, key: string, statement: string, aliases: readonly string[] = []): Concept {
  return {
    id,
    key,
    kind: "capability",
    name: key,
    aliases: [...aliases],
    statement,
    status: "active",
    sourceClass: "authored",
    confidence: 1,
    tags: [],
    evidence: [],
    discoveryHash: hash(`discovery:${id}:${aliases.join("|")}`),
    semanticHash: hash(`semantic:${id}:${statement}`),
  };
}

async function writeConcept(root: string, value: Concept): Promise<void> {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "concept",
    id: value.id,
    key: value.key,
    lifecycle: value.status,
    payload: { ...value },
  }));
}

async function writeRelation(root: string, value: Relation): Promise<void> {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2",
    schemaVersion: "2.0.0",
    kind: "relation",
    id: value.id,
    key: `relation:${value.id}`,
    lifecycle: "active",
    payload: { ...value },
  }));
}

function authority(id: string, subjectId: string): AuthorityRecord {
  return {
    id,
    key: id,
    subjectId,
    status: "approved",
    conclusion: "normalize",
    rationale: "accepted repository organization",
    alternatives: [],
    assumptions: [],
    reconsiderWhen: [{ type: "manual-review" }],
    vector: {
      explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1,
      historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1,
      platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0,
      reversibility: 1, migrationCost: 0, counterEvidence: 0,
    },
    assessmentConfidence: "high",
    evidence: [],
    governanceRiskClass: "R1",
    decidedBy: "user",
    createdAt: "2026-09-09T00:00:00.000Z",
    semanticHash: hash(`authority:${id}`),
  };
}

async function writeCanonical(root: string, kind: "architecture-decision" | "authority-record" | "projection-lens" | "tombstone", id: string, key: string, lifecycle: string, payload: Record<string, unknown>): Promise<void> {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id, key, lifecycle, payload }));
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("RepositoryKnowledgeService", () => {
  it("directly addresses accepted aliases and follows typed canonical relations", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Projector closes its conceptual loop.", ["loop"]));
    await writeConcept(root, concept("concept:evidence", "truthful-evidence", "Evidence remains independently inspectable."));
    await writeRelation(root, {
      id: "relation:loop-evidence",
      fromId: "concept:loop",
      toId: "concept:evidence",
      type: "requires",
      sourceClass: "authored",
      confidence: 1,
      evidence: [],
      active: true,
      semanticHash: hash("relation:loop-evidence"),
    });

    const service = await RepositoryKnowledgeService.create(root);
    const result = await service.context({ request: "prepare the edit", entities: ["loop"], persist: false });

    expect(result.persisted).toBe(false);
    expect(result.interpretation.status).toBe("direct");
    expect(result.interpretation.candidates[0]).toMatchObject({ entityId: "concept:loop", entityKind: "concept", direct: true, signals: ["alias"] });
    expect(result.branches[0]?.closure.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: "concept:loop", band: "direct" }),
      expect.objectContaining({ entityId: "concept:evidence", band: "governing" }),
    ]));
    expect(result.branches[0]?.closure.boundState.queryDependencies.map(({ query }) => query.programId)).toEqual(expect.arrayContaining([
      "projector.knowledge.identity",
      "projector.knowledge.relations",
      "projector.knowledge.implementation-binding",
    ]));
  });

  it("keeps free-text lexical retrieval as candidate interpretation", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:clock", "session-clock", "Preserve monotonic multiplayer ordering."));

    const result = await (await RepositoryKnowledgeService.create(root)).context({ request: "change multiplayer clock ordering", persist: false });

    expect(result.interpretation.status).toBe("candidates");
    expect(result.interpretation.candidates[0]).toMatchObject({ entityId: "concept:clock", direct: false, signals: ["lexical"] });
    expect(result.branches[0]?.hypothesis).toBe(true);
    expect(result.branches[0]?.interpretation.explanation).toMatch(/not proof of semantic identity/i);
  });

  it("does not treat an exact address as accepted identity when the record is rejected", async () => {
    const root = await repository();
    await writeConcept(root, { ...concept("concept:rejected", "rejected-concept", "Rejected semantics."), status: "rejected" });

    const result = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect", entities: ["concept:rejected"], persist: false });

    expect(result.interpretation.status).toBe("candidates");
    expect(result.interpretation.candidates[0]).toMatchObject({ entityId: "concept:rejected", direct: false, signals: ["id"] });
    expect(result.branches[0]?.hypothesis).toBe(true);
  });

  it("persists authenticated context for a fresh service and reconciles unchanged state", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop."));
    const first = await RepositoryKnowledgeService.create(root);
    const context = await first.context({ request: "inspect", entities: ["concept:loop"] });

    const second = await RepositoryKnowledgeService.create(root);
    expect(await second.read(context.id)).toEqual(context);
    expect((await second.reconcile(context.id)).status).toBe("current");
  });

  it("rejects a modified persisted context record", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop."));
    const service = await RepositoryKnowledgeService.create(root);
    const context = await service.context({ request: "inspect", entities: ["concept:loop"] });
    const path = join(root, ".projector", "runtime", "knowledge", "contexts", `${context.id.slice("knowledge_context_".length)}.json`);
    const tampered = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    tampered.request = "tampered";
    await writeFile(path, JSON.stringify(tampered), "utf8");

    await expect(service.read(context.id)).rejects.toThrow(/content authentication/i);
  });

  it("rebinds an unrelated canonical root change and stales a selected semantic change", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop."));
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect", entities: ["concept:loop"] });

    await writeConcept(root, concept("concept:other", "unrelated", "Unrelated semantics."));
    expect((await service.reconcile(retained.id)).status).toBe("rebound");

    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop with retained provenance."));
    const changed = await service.reconcile(retained.id);
    expect(changed.status).toBe("stale");
    expect(changed.branches[0]?.validation.changedValueDependencyIds).toContain("concept:loop");
  });

  it("stales an exact selected source change even when its semantic signature is stable", async () => {
    const root = await repository();
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect source", namedTargets: ["index.ts"] });
    await writeFile(join(root, "index.ts"), "export   const value = 1;\n", "utf8");

    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.status).toBe("stale");
    expect(reconciliation.branches[0]?.validation.changedValueDependencyIds).toContain(`knowledge-source:${retained.interpretation.candidates[0]!.entityId}`);
  });

  it("stales when a new typed relation changes an earlier empty neighborhood", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop."));
    await writeConcept(root, concept("concept:other", "other", "Other semantics."));
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect", entities: ["concept:loop"] });
    await writeRelation(root, {
      id: "relation:new-governance",
      fromId: "concept:loop",
      toId: "concept:other",
      type: "requires",
      sourceClass: "authored",
      confidence: 1,
      evidence: [],
      active: true,
      semanticHash: hash("relation:new-governance"),
    });

    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.status).toBe("stale");
    expect(reconciliation.branches[0]?.validation.changedQueryDependencyIds).toContain("knowledge-relations:concept:loop");
  });

  it("reports unavailable when a selected canonical source disappears", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:loop", "conceptual-loop", "Close the loop."));
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect", entities: ["concept:loop"] });
    await new CanonicalFileRepository(root).delete("concept", "concept:loop");

    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.status).toBe("unavailable");
    expect(reconciliation.branches[0]?.validation.reasons.join(" ")).toMatch(/unavailable/i);
  });

  it("uses tombstone continuity without collapsing the replacement into lexical identity proof", async () => {
    const root = await repository();
    await writeConcept(root, concept("concept:replacement", "replacement", "Replacement semantics."));
    await writeCanonical(root, "tombstone", "tombstone:old", "tombstone:concept:old", "deleted", {
      entityId: "concept:old",
      deletedAtRevision: 2,
      lastSemanticHash: hash("old"),
      replacementIds: ["concept:replacement"],
      reason: "explicit replacement",
    });

    const result = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect", entities: ["concept:old"], persist: false });
    expect(result.interpretation.candidates[0]).toMatchObject({ entityId: "concept:replacement", direct: true, signals: ["tombstone"], continuityFromIds: ["concept:old"] });
  });

  it("includes and binds an architecture decision's authenticated authority rationale", async () => {
    const root = await repository();
    const authorityRecord = { ...authority("authority:runtime", "concern:runtime"), rationale: "Windows and POSIX need one durable runtime path." };
    const decision: ArchitectureDecision = {
      id: "decision:runtime",
      key: "runtime",
      concernId: "concern:runtime",
      title: "Runtime",
      decision: "Use the native runtime.",
      selectedOptionKey: "native",
      scope: { op: "atom", field: "surface", matcher: "equals", value: "repository" },
      lifecycle: "active",
      authorityRecordId: authorityRecord.id,
      governanceBasis: [],
      consequences: [],
      appliedPreferences: [],
      supersedesDecisionIds: [],
      semanticHash: hash("decision:runtime"),
    };
    await writeCanonical(root, "authority-record", authorityRecord.id, authorityRecord.key, authorityRecord.status, { ...authorityRecord });
    await writeCanonical(root, "architecture-decision", decision.id, decision.key, decision.lifecycle, { ...decision });
    const first = await RepositoryKnowledgeService.create(root);
    const retained = await first.context({ request: "inspect runtime", entities: [decision.id] });

    expect(retained.branches[0]?.context.items.find(({ entityId }) => entityId === decision.id)?.content).toContain(authorityRecord.rationale);
    expect(retained.branches[0]?.closure.boundState.valueDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: authorityRecord.id, kind: "canonical-governance" }),
      expect.objectContaining({ id: `knowledge-source:${authorityRecord.id}` }),
    ]));

    const changedAuthority = { ...authorityRecord, status: "provisional" as const, assumptions: ["native filesystem semantics remain available"], semanticHash: hash("authority:runtime:changed") };
    await writeCanonical(root, "authority-record", changedAuthority.id, changedAuthority.key, changedAuthority.status, { ...changedAuthority });
    const reconciliation = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(reconciliation.status).toBe("stale");
    expect(reconciliation.branches[0]?.validation.changedValueDependencyIds).toContain(authorityRecord.id);
    const currentService = await RepositoryKnowledgeService.create(root);
    const current = await currentService.context({ request: "inspect runtime", entities: [decision.id] });
    expect(current.unknowns.join(" ")).toMatch(/referenced authority.*unavailable/i);
    expect(current.branches[0]?.context.items.find(({ entityId }) => entityId === decision.id)?.content).not.toContain(authorityRecord.rationale);
    const currentReconciliation = await (await RepositoryKnowledgeService.create(root)).reconcile(current.id);
    expect(currentReconciliation.status).toBe("current");
    expect(currentReconciliation.governance.status).toBe("unknown");
    expect(currentReconciliation.governance.reasons.join(" ")).toMatch(/referenced authority.*unavailable/i);
  });

  it("exposes a missing decision authority as context uncertainty", async () => {
    const root = await repository();
    const decision: ArchitectureDecision = {
      id: "decision:missing-authority", key: "missing-authority", concernId: "concern:missing", title: "Missing authority",
      decision: "No authority record exists.", selectedOptionKey: "none",
      scope: { op: "atom", field: "surface", matcher: "equals", value: "repository" }, lifecycle: "active",
      authorityRecordId: "authority:missing", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [],
      semanticHash: hash("decision:missing-authority"),
    };
    await writeCanonical(root, "architecture-decision", decision.id, decision.key, decision.lifecycle, { ...decision });

    const result = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect", entities: [decision.id], persist: false });
    expect(result.unknowns.join(" ")).toMatch(/referenced authority.*unavailable/i);
  });

  it("rebinds a nonmatching observed unit but stales a newly matching scoped member", async () => {
    const root = await repository();
    await mkdir(join(root, "src", "matched"), { recursive: true });
    await writeFile(join(root, "src", "matched", "one.ts"), "export const one = 1;\n", "utf8");
    const authorityRecord = authority("authority:scoped", "concern:scoped");
    const decision: ArchitectureDecision = {
      id: "decision:scoped", key: "scoped", concernId: "concern:scoped", title: "Scoped decision",
      decision: "Apply only to the selected source tree.", selectedOptionKey: "selected",
      scope: { op: "atom", field: "path", matcher: "glob", value: "src/matched/**" }, lifecycle: "active",
      authorityRecordId: authorityRecord.id, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [],
      semanticHash: hash("decision:scoped"),
    };
    await writeCanonical(root, "authority-record", authorityRecord.id, authorityRecord.key, authorityRecord.status, { ...authorityRecord });
    await writeCanonical(root, "architecture-decision", decision.id, decision.key, decision.lifecycle, { ...decision });
    const retained = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect scope", entities: [decision.id] });
    const graph = new KnowledgeGraph(await observeChangeRepository(root));
    const originalBindings = graph.implementationBindings(decision.id);
    expect(originalBindings).toHaveLength(1);
    const callerBindings = graph.implementationBindings(decision.id);
    callerBindings[0]!.id = "caller-changed";
    callerBindings.push({ id: "caller-added" });
    expect(graph.implementationBindings(decision.id)).toEqual(originalBindings);
    expect(graph.implementationBindings("decision:unrelated")).toEqual([]);

    await writeFile(join(root, "unrelated.ts"), "export const unrelated = 2;\n", "utf8");
    expect((await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id)).status).toBe("rebound");

    await writeFile(join(root, "src", "matched", "two.ts"), "export const two = 2;\n", "utf8");
    const changed = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(changed.status).toBe("stale");
    expect(changed.branches[0]?.validation.changedQueryDependencyIds).toContain(`knowledge-implementation:${decision.id}`);
    const currentGraph = new KnowledgeGraph(await observeChangeRepository(root));
    expect(currentGraph.implementationBindings(decision.id)).toHaveLength(2);
    expect(graph.implementationBindings(decision.id)).toEqual(originalBindings);
  });

  it("places only an applicable active lens and its obligations inside the bounded branch", async () => {
    const root = await repository();
    await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "knowledge-fixture", type: "module", scripts: { inspect: "node tools/runner.ts" } })}\n`, "utf8");
    await mkdir(join(root, "tools"), { recursive: true });
    await writeFile(join(root, "tools", "runner.ts"), "export const run = () => 1;\n", "utf8");
    const authorityRecord = authority("authority:repository-script", "lens:repository-script");
    const lens = createRepositoryScriptLens({ id: "lens:repository-script", status: "active", authorityRecordId: authorityRecord.id, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:repository-layout" }] });
    await writeCanonical(root, "authority-record", authorityRecord.id, authorityRecord.key, authorityRecord.status, { ...authorityRecord });
    await writeCanonical(root, "projection-lens", lens.id, lens.key, lens.status, { ...lens });

    const result = await (await RepositoryKnowledgeService.create(root)).context({ request: "inspect repository automation", namedTargets: ["tools/runner.ts"], persist: false });
    const branch = result.branches[0]!;
    expect(branch.closure.entries).toEqual(expect.arrayContaining([expect.objectContaining({ entityId: lens.id, band: "governing" })]));
    expect(branch.lensObligations).toEqual(expect.arrayContaining([expect.objectContaining({ lensId: lens.id, status: "applicable", validatorIds: expect.arrayContaining(["repository-script-placement@1"]) })]));
  });

  it("fails reconciliation closed when current lens compilation is unavailable", async () => {
    const root = await repository();
    const lens = createRepositoryScriptLens({ id: "lens:missing-authority", status: "active", authorityRecordId: "authority:missing", governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:repository-layout" }] });
    await writeCanonical(root, "projection-lens", lens.id, lens.key, lens.status, { ...lens });
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "inspect", namedTargets: ["index.ts"] });

    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.governance.status).toBe("unknown");
    expect(reconciliation.governance.reasons.join(" ")).toMatch(/lens compilation.*unavailable/i);
  });

  it("aggregates multiple topology reasons for one stable neighbor", async () => {
    const root = await repository();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "value.ts"), "export const topologyValue = 17;\n", "utf8");
    await writeFile(join(root, "src", "value.test.ts"), "import { topologyValue } from './value.js';\nvoid topologyValue;\n", "utf8");

    const service = await RepositoryKnowledgeService.create(root);
    const testUnitId = (await service.context({ request: "identify test", namedTargets: ["src/value.test.ts"], persist: false })).interpretation.candidates[0]!.entityId;
    const result = await service.context({ request: "inspect topology", namedTargets: ["src/value.ts"], persist: false });
    const testEntries = result.branches[0]!.closure.entries.filter(({ entityId }) => entityId === testUnitId);
    expect(testEntries).toHaveLength(1);
  });

  it("keeps static topology bindings current when unsupported dependency syntax is confined to another source", async () => {
    const root = await repository();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "static.ts"), "export const staticValue = 17;\n", "utf8");
    await writeFile(join(root, "src", "dynamic.ts"), "import missing from './missing.js';\nexport const load = (name: string) => import(name) ?? missing;\n", "utf8");

    const first = await RepositoryKnowledgeService.create(root);
    const retained = await first.context({ request: "inspect static source", namedTargets: ["src/static.ts"] });
    const reconciliation = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);

    expect(reconciliation.status).toBe("current");
    expect(reconciliation.branches[0]?.validation.reasons.join(" ")).not.toMatch(/observation boundary is incomplete/i);
  });

  it("binds unchanged dynamic dependency uncertainty without treating the static lane as unavailable", async () => {
    const root = await repository();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "dynamic.ts"), "export const load = (name: string) => import(name);\n", "utf8");

    const first = await RepositoryKnowledgeService.create(root);
    const retained = await first.context({ request: "inspect dynamic source", namedTargets: ["src/dynamic.ts"] });
    const reconciliation = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);

    expect(retained.unknowns.join(" ")).toMatch(/runtime dependency target remains unknown in src\/dynamic\.ts/i);
    expect(reconciliation.status).toBe("current");
    expect(reconciliation.branches[0]?.validation.reasons.join(" ")).not.toMatch(/proof-eligible|unavailable/i);

    await writeFile(join(root, "src", "dynamic.ts"), "export const load = (name: string) => import(`./${name}.js`);\n", "utf8");
    const changed = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(changed.status).toBe("stale");
    expect(changed.branches[0]?.validation.changedQueryDependencyIds).toContain(`knowledge-topology:${retained.interpretation.candidates[0]!.entityId}`);
  });

  it("stales inbound topology when a new uncertain importer appears and retains that uncertainty on recapture", async () => {
    const root = await repository();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "value.ts"), "export const value = 17;\n", "utf8");
    const first = await RepositoryKnowledgeService.create(root);
    const retained = await first.context({ request: "inspect inbound users", namedTargets: ["src/value.ts"] });
    const selected = retained.interpretation.candidates.find(({ direct, entityKind }) => direct && entityKind === "projection-unit")!;

    await writeFile(join(root, "src", "consumer.ts"), "export const load = (target: string) => import(target);\n", "utf8");
    const changed = await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(changed.status).toBe("stale");
    expect(changed.branches.find(({ branchId }) => branchId === retained.branches.find(({ interpretation }) => interpretation.entityId === selected.entityId)?.id)?.validation.changedQueryDependencyIds)
      .toContain(`knowledge-topology:${selected.entityId}`);

    const currentService = await RepositoryKnowledgeService.create(root);
    const current = await currentService.context({ request: "inspect inbound users", namedTargets: ["src/value.ts"] });
    expect(current.unknowns.join(" ")).toMatch(/runtime dependency target remains unknown in src\/consumer\.ts/i);
    expect((await (await RepositoryKnowledgeService.create(root)).reconcile(current.id)).status).toBe("current");
  });

  it("re-evaluates current observed files and reports a stale forbidden dependency separately", async () => {
    const root = await repository();
    await mkdir(join(root, "packages", "core", "src"), { recursive: true });
    const sourcePath = join(root, "packages", "core", "src", "value.ts");
    await writeFile(sourcePath, "export const coreValue = 41;\n", "utf8");
    const authorityRecord = authority("authority:core-boundary", "lens:core-boundary");
    const selector = { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" } as const;
    const base = createRepositoryScriptLens({ id: "lens:core-boundary", status: "active", authorityRecordId: authorityRecord.id, selector, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:core-boundary" }] });
    const ruleBasis = {
      key: "lens:core-boundary:dependency",
      version: "1",
      effect: "validate" as const,
      authorityClass: "active-lens" as const,
      governanceBasis: [{ kind: "hard-constraint" as const, conceptId: "concept:core-boundary" }],
      selector,
      predicates: [{
        kind: "dependency-forbidden" as const,
        from: selector,
        to: { op: "any" as const, items: [
          { op: "atom" as const, field: "path" as const, matcher: "glob" as const, value: "packages/forbidden/**" },
          { op: "atom" as const, field: "package" as const, matcher: "equals" as const, value: "@forbidden/pkg" },
        ] },
      }],
      rationale: "core cannot depend on the forbidden package",
      evidence: [],
      conflictPolicy: "error" as const,
      validatorIds: ["projector.builtin.static-dependency-boundary@1"],
      transformIds: [],
    };
    const lens: ProjectionLens = {
      ...base,
      rules: [{ id: "rule:core-boundary", ...ruleBasis, semanticHash: hashFramedDomain("rule", ruleBasis) }],
      validators: [{ id: "projector.builtin.static-dependency-boundary", version: "1", provider: "deterministic-governance", input: { ruleIds: ["rule:core-boundary"] }, required: true }],
      expectedProjections: base.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained", predicateIds: ["rule:core-boundary"], validatorIds: ["projector.builtin.static-dependency-boundary@1"] } })),
    };
    await writeCanonical(root, "authority-record", authorityRecord.id, authorityRecord.key, authorityRecord.status, { ...authorityRecord });
    await writeCanonical(root, "projection-lens", lens.id, lens.key, lens.status, { ...lens });
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await service.context({ request: "change core implementation", namedTargets: ["packages/core/src/value.ts"] });

    expect((await service.reconcile(retained.id)).governance.status).toBe("conformant");

    await writeFile(sourcePath, "import value from './missing.js';\nexport { value };\n", "utf8");
    expect((await service.reconcile(retained.id)).governance.status).toBe("unknown");

    await writeFile(sourcePath, "import value from '@forbidden/pkg/subpath';\nexport { value };\n", "utf8");
    const reconciliation = await service.reconcile(retained.id);
    expect(reconciliation.status).toBe("stale");
    expect(reconciliation.governance.status).toBe("violated");
    expect(reconciliation.governance.branches.flatMap(({ evaluations }) => evaluations).flatMap(({ findings }) => findings)).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "violated", reason: expect.stringContaining("@forbidden/pkg/subpath") }),
    ]));
  });
});
