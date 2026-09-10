import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { deriveEntityId, hashFramedDomain, hashSemantic, parseChangeProposal, withCanonicalHashes, type AuthorityRecord, type BehavioralScenario, type ChangeProposal, type Requirement } from "@projector/core";
import { createRepositoryScriptLens, executionPlanHash } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { compileRepositoryChange } from "./compiler.js";
import type { KnowledgeContextResult } from "../knowledge/types.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("test", "placeholder");

function approvedAuthority(id: string, subjectId: string): AuthorityRecord {
  return { id, key: id, subjectId, status: "approved", conclusion: "preserve", rationale: "Explicitly adopt the bounded rule.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 0, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 0, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: placeholder };
}

function decisionPayload(id: string, authorityRecordId: string, lifecycle: "active" | "superseded", supersedesDecisionIds: string[] = []) {
  return { id, key: id, concernId: "concern:clock-source", title: id, decision: `Use ${id}.`, selectedOptionKey: id, scope: { op: "atom" as const, field: "package" as const, matcher: "equals" as const, value: "domain" }, lifecycle, authorityRecordId, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds };
}

function proposal(): ChangeProposal {
  return parseChangeProposal({
    apiVersion: "projector.change-proposal/v1",
    requirements: [{ key: "greeting-personalization", title: "Personalized greeting", statement: "The greeting includes the supplied name.", aliases: ["named-greeting"] }],
    scenarios: [{ key: "greet-supplied-name", title: "Greet a supplied name", steps: [
      { role: "precondition", statement: "A caller supplies a nonblank name." },
      { role: "trigger", statement: "The caller requests a greeting." },
      { role: "expected-outcome", statement: "The result includes that exact name." },
    ] }],
    architecture: null,
    edits: [{ path: "src/greeting.mjs", before: "export const greet = () => 'hello';\n", after: "export const greet = (name = '') => name ? `hello ${name}` : 'hello';\n" }],
    validation: { independentNodeTests: ["test/public-contract.test.mjs"], supplementalNodeTests: [] },
    analysisFacets: ["behavior", "architecture"],
  });
}

function workspaceProposal(): ChangeProposal {
  return parseChangeProposal({
    apiVersion: "projector.change-proposal/v1",
    requirements: [{ key: "greeting-workspace", title: "Greeting workspace", statement: "The greeting package has an explicit workspace manifest." }],
    scenarios: [{ key: "load-greeting-workspace", title: "Load greeting workspace", steps: [
      { role: "trigger", statement: "A caller loads the greeting workspace." },
      { role: "expected-outcome", statement: "The workspace exposes its module manifest." },
    ] }],
    architecture: {
      concernKey: "task-orchestration",
      title: "Task orchestration",
      question: "When do existing task dependencies stop being safely coordinated by simple scripts?",
      materiality: "deferable",
      deferral: {
        rationale: "This change adds one leaf workspace and does not alter root task orchestration.",
        reconsiderWhen: "A second workspace introduces an inter-package task dependency.",
        validUntil: "2027-02-26T00:00:00.000Z",
        preservedOptions: ["Retain the option to introduce orchestration after dependency evidence exists."],
        forbiddenCommitments: ["Do not select an orchestration technology in this change."],
        forbiddenWritePaths: ["package.json"],
      },
    },
    edits: [{ path: "packages/greeting/package.json", before: null, after: "{\"name\":\"greeting\",\"type\":\"module\"}\n" }],
    validation: { independentNodeTests: ["test/public-contract.test.mjs"], supplementalNodeTests: [] },
    analysisFacets: ["behavior", "architecture", "workspace-expansion"],
  });
}

async function existingRequirement(root: string, id: string, key: string, aliases: string[]): Promise<void> {
  const payload: Requirement = {
    id, key, title: "Personalized greeting", aliases, statement: "The greeting includes the supplied name.", status: "active",
    sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
    origin: [{ kind: "document", locator: "README.md" }], evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id, key, lifecycle: "active", payload: { ...payload } }));
}

async function existingScenario(root: string): Promise<void> {
  const payload: BehavioralScenario = {
    id: "scenario:greet-supplied-name", key: "greet-supplied-name", title: "Greet a supplied name", aliases: [], status: "active",
    sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
    steps: proposal().scenarios[0]!.steps.map((step) => ({ ...step })), evidence: [], discoveryHash: placeholder, semanticHash: placeholder,
  };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: payload.id, key: payload.key, lifecycle: "active", payload: { ...payload } }));
}

async function existingRelation(root: string, id: string, fromId: string, toId: string, type: "requires" | "depends-on" | "constrains" | "owns" = "requires"): Promise<void> {
  await new CanonicalFileRepository(root).write(withCanonicalHashes({
    apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id, key: `relation:${id}`, lifecycle: "active",
    payload: { id, fromId, toId, type, sourceClass: "authored", active: true, confidence: 1, evidence: [], semanticHash: placeholder },
  }));
}

function directKnowledgeContext(
  rootEntityIds: readonly string[],
  closureEntityIds: readonly string[] = rootEntityIds,
  requiredEntityIds: readonly string[] = rootEntityIds,
): KnowledgeContextResult {
  return {
    id: "knowledge-context:test",
    contentHash: hashFramedDomain("knowledge-context-test", { rootEntityIds, closureEntityIds }),
    requestOptions: { entities: rootEntityIds, namedTargets: [], operation: "change", policy: {} },
    unknowns: [],
    branches: rootEntityIds.map((entityId) => ({
      hypothesis: false,
      interpretation: { entityId, entityKind: "requirement", score: 1, direct: true, signals: ["id"], explanation: `Explicit canonical address ${entityId}.`, continuityFromIds: [] },
      closure: {
        seeds: [{ kind: "semantic-entity", subjectId: entityId, reason: "explicit canonical address", confidence: 1 }],
        entries: closureEntityIds.map((closureEntityId) => ({
          entityId: closureEntityId,
          band: closureEntityId === entityId ? "direct" : "governing",
          score: closureEntityId === entityId ? 1 : 0.9,
          requiredForPlanning: requiredEntityIds.includes(closureEntityId),
          reasons: [{ kind: closureEntityId === entityId ? "identity-match" : "depends-on", fromId: entityId, weight: 1, provenance: "declared", confidence: 1, explanation: "test context closure", evidenceIds: [] }],
        })),
      },
    })),
  } as unknown as KnowledgeContextResult;
}

function requirementRevisionProposal(document: Awaited<ReturnType<CanonicalFileRepository["read"]>>): ChangeProposal {
  if (document?.kind !== "requirement") throw new Error("test requires a canonical requirement");
  const { discoveryHash: _discoveryHash, semanticHash: _semanticHash, ...payload } = document.payload;
  return parseChangeProposal({
    apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
    validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
    canonicalMutations: [{
      kind: "requirement", operation: "revise", expectedSemanticHash: document.semanticHash, expectedDocumentHash: document.canonicalDocumentHash,
      rationale: "Clarify the canonical requirement without implementation edits.", payload: { ...payload, statement: `${String(payload.statement)} Clarified.` },
    }],
  });
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-change-compiler-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'hello';\n");
  await writeFile(join(root, "src", "index.mjs"), "import { greet } from './greeting.mjs'; export { greet };\n");
  await writeFile(join(root, "test", "public-contract.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/index.mjs'; assert.equal(greet(), 'hello');\n");
  await existingRequirement(root, "requirement:legacy-greeting", "legacy-greeting", ["named-greeting"]);
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

describe("repository change compiler", () => {
  it("requires explicit same-concern decision supersession and one active decision", async () => {
    const root = await repository();
    try {
      const olderAuthority = approvedAuthority("authority:clock-old", "concern:clock-source");
      const newerAuthority = approvedAuthority("authority:clock-new", "concern:clock-source");
      const withoutHash = (record: AuthorityRecord) => { const { semanticHash: _hash, ...payload } = record; return payload; };
      const mutations = (olderLifecycle: "active" | "superseded", supersedesDecisionIds: string[]) => [
        { kind: "architecture-concern", operation: "add", expectedAbsent: true, rationale: "Retain the question behind both clock choices.", payload: { id: "concern:clock-source", key: "clock-source-concern", title: "Clock source", question: "Which clock source should be used?", scope: decisionPayload("decision:clock-new", newerAuthority.id, "active").scope, sourceClass: "authored", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: ["decision:clock-old", "decision:clock-new"], evidence: [] } },
        { kind: "authority-record", operation: "add", expectedAbsent: true, rationale: "Bind the prior decision.", payload: withoutHash(olderAuthority) },
        { kind: "authority-record", operation: "add", expectedAbsent: true, rationale: "Bind the replacement decision.", payload: withoutHash(newerAuthority) },
        { kind: "architecture-decision", operation: "add", expectedAbsent: true, rationale: "Record the prior choice.", payload: decisionPayload("decision:clock-old", olderAuthority.id, olderLifecycle) },
        { kind: "architecture-decision", operation: "add", expectedAbsent: true, rationale: "Record the replacement choice.", payload: decisionPayload("decision:clock-new", newerAuthority.id, "active", supersedesDecisionIds) },
      ];
      const parse = (items: ReturnType<typeof mutations>) => parseChangeProposal({ apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], canonicalMutations: items, architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Adopt contradictory clock decisions.", proposal: parse(mutations("active", [])) })).rejects.toThrow(/multiple active decisions/iu);
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Claim supersession without changing prior state.", proposal: parse(mutations("active", ["decision:clock-old"])) })).rejects.toThrow(/must be superseded/iu);
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Replace the clock decision explicitly.", proposal: parse(mutations("superseded", ["decision:clock-old"])) })).resolves.toMatchObject({ executionKind: "canonical-only" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("accepts a jointly authorized active lens and rejects ineligible authority", async () => {
    const root = await repository();
    try {
      const authority = approvedAuthority("authority:repository-layout", "lens:repository-layout");
      const lens = createRepositoryScriptLens({ id: "lens:repository-layout", status: "active", authorityRecordId: authority.id, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:repository-layout" }] });
      const { semanticHash: _authorityHash, ...authorityPayload } = authority;
      const { semanticHash: _lensHash, ...lensWithNestedHashes } = lens;
      const lensPayload = {
        ...lensWithNestedHashes,
        rules: lensWithNestedHashes.rules.map(({ semanticHash: _ruleHash, ...rule }) => rule),
        impactRules: lensWithNestedHashes.impactRules.map(({ semanticHash: _impactHash, ...rule }) => rule),
      };
      const mutations = [
        { kind: "concept", operation: "add", expectedAbsent: true, rationale: "Name the governing constraint.", payload: { id: "concept:repository-layout", key: "repository-layout", kind: "constraint", name: "Repository layout", aliases: [], statement: "Repository automation stays in its governed location.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] } },
        { kind: "authority-record", operation: "add", expectedAbsent: true, rationale: "Approve the bounded structural rule.", payload: authorityPayload },
        { kind: "projection-lens", operation: "add", expectedAbsent: true, rationale: "Make the structural rule reusable.", payload: lensPayload },
      ];
      const proposal = parseChangeProposal({ apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], canonicalMutations: mutations, architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Adopt the repository automation boundary.", proposal })).resolves.toMatchObject({ executionKind: "canonical-only", canonicalWrites: expect.arrayContaining([expect.objectContaining({ kind: "projection-lens" })]) });
      const governed = await compileRepositoryChange({ repositoryRoot: root, request: "Adopt the repository automation boundary.", proposal });
      expect(governed.compiledChange.change.risk).toMatchObject({ class: "R2", inherentOperationRisk: 2, affectedUnitCount: 3 });
      const rejected = parseChangeProposal({ ...proposal, canonicalMutations: mutations.map((mutation) => mutation.kind === "authority-record" ? { ...mutation, payload: { ...mutation.payload, status: "provisional" } } : mutation) });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Adopt an unauthorized boundary.", proposal: rejected })).rejects.toThrow(/authority|approved|active/iu);
      const wrongKind = parseChangeProposal({ ...proposal, canonicalMutations: mutations.map((mutation) => mutation.kind === "projection-lens" ? { ...mutation, payload: { ...mutation.payload, governanceBasis: [{ kind: "hard-constraint", conceptId: authority.id }] } } : mutation) });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Use a wrong-kind governance basis.", proposal: wrongKind })).rejects.toThrow(/wrong-kind/iu);
      const unrelatedStandard = approvedAuthority("authority:unrelated-standard", "concept:repository-layout");
      const { semanticHash: _standardHash, ...standardPayload } = unrelatedStandard;
      const unrelatedBasis = parseChangeProposal({ ...proposal, canonicalMutations: [
        ...mutations,
        { kind: "authority-record", operation: "add", expectedAbsent: true, rationale: "A separately scoped authority.", payload: standardPayload },
      ].map((mutation) => mutation.kind === "projection-lens" ? { ...mutation, payload: { ...mutation.payload, governanceBasis: [...((mutation.payload as { governanceBasis: unknown[] }).governanceBasis), { kind: "adopted-standard", authorityRecordId: unrelatedStandard.id }] } } : mutation) });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Use unrelated authority as the lens basis.", proposal: unrelatedBasis })).rejects.toThrow(/adopted-standard.*bound/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("compiles an authenticated model-only concept addition without runtime-test claims", async () => {
    const root = await repository();
    try {
      const model = parseChangeProposal({
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
        validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        canonicalMutations: [{
          kind: "concept", operation: "add", expectedAbsent: true, rationale: "Establish the clock boundary before implementation.",
          payload: { id: "concept:clock", key: "clock", kind: "invariant", name: "Clock boundary", aliases: [], statement: "All domain time enters through the clock port.", status: "active", sourceClass: "authored", confidence: 1, tags: ["time"], evidence: [] },
        }],
      });
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Establish the domain clock boundary before implementing it.", proposal: model });
      expect(compiled.executionKind).toBe("canonical-only");
      expect(compiled.compiledChange.change.risk).toMatchObject({ inherentOperationRisk: 1, affectedUnitCount: 1 });
      expect(compiled.canonicalWrites).toEqual([expect.objectContaining({ id: "concept:clock", kind: "concept", before: null })]);
      expect(compiled.intentReview.canonicalMutations).toEqual([expect.objectContaining({ id: "concept:clock", operation: "add" })]);
      expect(compiled.compiledPlan.packets[0]?.packet.transformId).toBe("canonical-model-write");
      expect(compiled.compiledPlan.plan.completionCriteria.requiredValidators).toContain("projector.canonical-model-integrity");
      expect(compiled.compiledPlan.plan.completionCriteria.requiredValidators).not.toContain("projector.post-change-knowledge");
      const canonical = new CanonicalFileRepository(root);
      expect(compiled.canonicalWrites[0]!.after).toBe(canonical.prepareWrite(compiled.canonicalWrites[0]!.envelope).contents);
      await canonical.write(compiled.canonicalWrites[0]!.envelope);
      const current = compiled.canonicalWrites[0]!.envelope;
      const modelConcept = model.canonicalMutations!.find((mutation) => mutation.kind === "concept")!;
      const revision = parseChangeProposal({
        ...model,
        canonicalMutations: [{
          kind: "concept", operation: "revise", rationale: "Clarify ownership while preserving the boundary.",
          expectedSemanticHash: current.semanticHash, expectedDocumentHash: current.canonicalDocumentHash,
          payload: { ...modelConcept.payload, statement: "All domain time enters through the producer-owned clock port." },
        }],
      });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Clarify the clock boundary.", proposal: revision })).resolves.toMatchObject({ executionKind: "canonical-only" });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Use stale evidence.", proposal: parseChangeProposal({ ...revision, canonicalMutations: [{ ...revision.canonicalMutations![0], expectedDocumentHash: hashFramedDomain("stale", null) }] }) }))
        .rejects.toThrow(/hashes are stale/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("derives scenario meaning before validating self-owned application evidence", async () => {
    const root = await repository();
    try {
      const base = { id: "scenario:self-owned-evidence", key: "self-owned-evidence", title: "Self-owned evidence", aliases: [], status: "active" as const, sourceClass: "authored" as const, scope: { op: "all" as const, items: [] }, steps: [{ role: "trigger" as const, statement: "The application is observed." }, { role: "expected-outcome" as const, statement: "Its declared predicate is evaluated." }], origin: [] };
      const semanticHash = hashSemantic("behavioral-scenario", base);
      const evidence = [{ evidenceId: "artifact:self-owned-evidence", stance: "supports" as const, applicationPredicate: { kind: "application-observation" as const, adapter: { id: "psychord", version: "1" }, scenario: { id: base.id, semanticHash }, case: "self-owned", predicateId: "predicate:self-owned", assertionIds: ["assertion:self-owned"], observationRole: "latest" as const } }];
      const model = parseChangeProposal({ apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"], canonicalMutations: [{ kind: "behavioral-scenario", operation: "add", expectedAbsent: true, rationale: "Bind the observation to its accepted scenario owner.", payload: { ...base, evidence } }] });
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Bind application evidence to its scenario owner.", proposal: model });
      expect(compiled.canonicalWrites[0]?.envelope).toMatchObject({ kind: "behavioral-scenario", semanticHash, payload: { semanticHash, evidence } });
      expect(compiled.canonicalWrites[0]?.envelope.canonicalDocumentHash).not.toBe(withCanonicalHashes({ ...compiled.canonicalWrites[0]!.envelope, payload: { ...compiled.canonicalWrites[0]!.envelope.payload, evidence: [] } }).canonicalDocumentHash);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("compiles exact replacement lineage, tombstone continuity, and source retirement atomically", async () => {
    const root = await repository();
    try {
      await existingRequirement(root, "requirement:new-greeting", "new-greeting", ["replacement-greeting"]);
      const canonical = new CanonicalFileRepository(root);
      const source = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      const proposal = parseChangeProposal({
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
        validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        identityResolution: {
          contextId: "knowledge_context_replacement", contextHash: placeholder, outcome: "replace-existing",
          selectedEntityIds: [source.id], rationale: "The replacement owns the clarified boundary.",
          newBoundary: { owns: ["the clarified greeting contract"], excludes: ["the retired greeting identity"], nearestEntityIds: [source.id], rationale: "Responsibility moved to the accepted replacement." },
        },
        canonicalMutations: [{
          kind: "lineage", operation: "add", lineageKind: "replace",
          sources: [{ id: source.id, kind: "requirement", expectedSemanticHash: source.semanticHash, expectedDocumentHash: source.canonicalDocumentHash }],
          replacementIds: ["requirement:new-greeting"], rationale: "Replace the legacy identity without losing continuity.",
        }],
      });

      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Replace the legacy greeting identity.", proposal });
      expect(compiled.canonicalWrites).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: source.id, kind: "requirement", after: null }),
        expect.objectContaining({ kind: "lineage", before: null, after: expect.any(String) }),
        expect.objectContaining({ kind: "tombstone", before: null, after: expect.any(String) }),
      ]));
      expect(compiled.exactPatchInput.edits).toEqual(expect.arrayContaining([expect.objectContaining({ unitId: source.id, after: null })]));
      expect(compiled.intentReview).toMatchObject({
        identityResolution: proposal.identityResolution,
        canonicalMutations: expect.arrayContaining([
          expect.objectContaining({ id: source.id, operation: "retire", after: null }),
          expect.objectContaining({ kind: "lineage", operation: "add" }),
          expect.objectContaining({ kind: "tombstone", operation: "add" }),
        ]),
      });
      const lineage = compiled.canonicalWrites.find(({ kind }) => kind === "lineage")!.envelope.payload;
      const tombstone = compiled.canonicalWrites.find(({ kind }) => kind === "tombstone")!.envelope.payload;
      expect(lineage).toMatchObject({ kind: "replace", fromIds: [source.id], toIds: ["requirement:new-greeting"], stateDigest: expect.stringMatching(/^sha256:v1:/u) });
      expect(tombstone).toMatchObject({ entityId: source.id, lastSemanticHash: source.semanticHash, replacementIds: ["requirement:new-greeting"], deletedAtRevision: 1 });

      const disposition = proposal.canonicalMutations!.find((mutation) => mutation.kind === "lineage")!;
      const stale = parseChangeProposal({ ...proposal, canonicalMutations: [{ ...disposition, sources: [{ ...disposition.sources[0]!, expectedDocumentHash: hashFramedDomain("stale", null) }] }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Use stale retirement evidence.", proposal: stale })).rejects.toThrow(/source hashes are stale/iu);
      const wrongKind = parseChangeProposal({ ...proposal, canonicalMutations: [{ ...disposition, replacementIds: ["scenario:greet-supplied-name"] }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Use a wrong-kind replacement.", proposal: wrongKind })).rejects.toThrow(/replacement is absent or has another kind/iu);

      await existingScenario(root);
      const scenario = (await canonical.read("behavioral-scenario", "scenario:greet-supplied-name"))!;
      const deletion = parseChangeProposal({
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
        validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        canonicalMutations: [{
          kind: "lineage", operation: "add", lineageKind: "delete", replacementIds: [], rationale: "Retire the obsolete scenario while retaining deletion continuity.",
          sources: [{ id: scenario.id, kind: "behavioral-scenario", expectedSemanticHash: scenario.semanticHash, expectedDocumentHash: scenario.canonicalDocumentHash }],
        }],
      });
      const deletedScenario = await compileRepositoryChange({ repositoryRoot: root, request: "Retire the obsolete scenario.", proposal: deletion });
      expect(deletedScenario.canonicalWrites).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: scenario.id, kind: "behavioral-scenario", after: null }),
        expect.objectContaining({ kind: "tombstone", envelope: expect.objectContaining({ payload: expect.objectContaining({ entityId: scenario.id, replacementIds: [] }) }) }),
      ]));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects resurrection of tombstoned requirement, scenario, and concept identities", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const requirementId = deriveEntityId("projector.requirement", "retired-requirement");
      const scenarioId = deriveEntityId("projector.scenario", "retired-scenario");
      const conceptId = "concept:retired-clock";
      for (const entityId of [requirementId, scenarioId, conceptId]) {
        const id = deriveEntityId("projector.tombstone", entityId);
        await canonical.write(withCanonicalHashes({
          apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "tombstone", id,
          key: `tombstone:${entityId}`, lifecycle: "deleted",
          payload: { entityId, deletedAtRevision: 1, lastSemanticHash: placeholder, replacementIds: [], reason: "Retain the retired identity." },
        }));
      }
      const base = { apiVersion: "projector.change-proposal/v1", architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] };
      const requirement = parseChangeProposal({ ...base, requirements: [{ key: "retired-requirement", title: "Retired requirement", statement: "This stable identity remains retired.", aliases: [] }], scenarios: [] });
      const scenario = parseChangeProposal({ ...base, requirements: [], scenarios: [{ key: "retired-scenario", title: "Retired scenario", aliases: [], steps: [
        { role: "trigger", statement: "A caller attempts to recreate the scenario." },
        { role: "expected-outcome", statement: "This stable identity remains retired." },
      ] }] });
      const concept = parseChangeProposal({ ...base, requirements: [], scenarios: [], canonicalMutations: [{
        kind: "concept", operation: "add", expectedAbsent: true, rationale: "Attempt to reuse a retired stable ID.",
        payload: { id: conceptId, key: "retired-clock", kind: "invariant", name: "Retired clock", aliases: [], statement: "This stable identity remains retired.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] },
      }] });

      for (const proposal of [requirement, scenario, concept]) {
        await expect(compileRepositoryChange({ repositoryRoot: root, request: "Attempt to reuse a retired identity.", proposal }))
          .rejects.toThrow(/stable ID is retired by an immutable tombstone/iu);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("requires active references to be retired with their source identity", async () => {
    const root = await repository();
    try {
      await existingRequirement(root, "requirement:new-greeting", "new-greeting", ["replacement-greeting"]);
      const canonical = new CanonicalFileRepository(root);
      const source = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      const relationPayload = { id: "relation:legacy-replacement", fromId: source.id, toId: "requirement:new-greeting", type: "supersedes", sourceClass: "authored", confidence: 1, evidence: [], active: true, semanticHash: placeholder };
      const relationEnvelope = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: relationPayload.id, key: `relation:${relationPayload.id}`, lifecycle: "active", payload: relationPayload });
      await canonical.write(relationEnvelope);
      const disposition = {
        kind: "lineage", operation: "add", lineageKind: "replace",
        sources: [{ id: source.id, kind: "requirement", expectedSemanticHash: source.semanticHash, expectedDocumentHash: source.canonicalDocumentHash }],
        replacementIds: ["requirement:new-greeting"], rationale: "Retire the legacy identity.",
      };
      const base = { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] };
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Retire with a live reference.", proposal: parseChangeProposal({ ...base, canonicalMutations: [disposition] }) }))
        .rejects.toThrow(/active relation.*retired identity/iu);
      const { semanticHash: _relationHash, ...inactivePayload } = relationEnvelope.payload;
      const proposal = parseChangeProposal({ ...base, canonicalMutations: [
        {
          kind: "relation", operation: "revise", expectedSemanticHash: relationEnvelope.semanticHash,
          expectedDocumentHash: relationEnvelope.canonicalDocumentHash, rationale: "Retain the relationship as inactive history.",
          payload: { ...inactivePayload, active: false },
        },
        disposition,
      ] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Retire the reference and identity together.", proposal })).resolves.toMatchObject({
        canonicalWrites: expect.arrayContaining([
          expect.objectContaining({ id: relationPayload.id, kind: "relation" }),
          expect.objectContaining({ id: source.id, after: null }),
        ]),
      });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("reuses semantic identity, binds reverse relevance, projects a spec, and compiles one exact packet", async () => {
    const root = await repository();
    try {
      const request = "Let greet accept a name while preserving callers that do not pass one.";
      const first = await compileRepositoryChange({ repositoryRoot: root, request, proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });
      const second = await compileRepositoryChange({ repositoryRoot: root, request, proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });

      expect(first.compiledChange.change.id).toBe(second.compiledChange.change.id);
      expect(first.compiledChange.change.risk.inherentOperationRisk).toBe(2);
      expect(first.planHash).toBe(second.planHash);
      expect(first.identityResolutions).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "requirement", outcome: "reuse-existing", targetId: "requirement:legacy-greeting" }),
        expect.objectContaining({ kind: "scenario", outcome: "create-new" }),
      ]));
      expect(first.canonicalWrites.map(({ id }) => id)).not.toContain("requirement:legacy-greeting");
      expect(first.intentReview.subjects).toEqual(expect.arrayContaining([expect.objectContaining({ id: "requirement:legacy-greeting", operation: "preserve" })]));
      expect(first.compiledChange.change.operations.filter(({ subjectType }) => subjectType === "requirement")).toHaveLength(0);
      expect(first.relevance.knownAffectedPaths).toEqual(["src/greeting.mjs", "src/index.mjs", "test/public-contract.test.mjs"]);
      expect(first.compiledChange.boundState.queryDependencies.map(({ query }) => query.id)).toEqual(expect.arrayContaining([
        expect.stringMatching(/^identity:/u),
        expect.stringMatching(/^relevance:/u),
      ]));
      expect(first.compiledChange.boundState.queryDependencies.map(({ query }) => query.id)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^architecture-deferral:/u)]));
      expect(first.representation).toMatchObject({ profileId: expect.any(String), preservationHash: expect.stringMatching(/^sha256:v1:/u) });
      expect(first.compiledPlan.plan.semanticChangeId).toBe(first.compiledChange.change.id);
      expect(first.planHash).toBe(executionPlanHash(first.compiledPlan.plan));
      expect(first.compiledPlan.packets).toHaveLength(1);
      expect(first.compiledPlan.packets[0]?.packet.transformId).toBe("exact-text-patch");
      expect(first.compiledPlan.packets[0]?.capsule.decisionIds).toEqual([]);
      expect(first.architectureDeferral).toBeUndefined();
      expect(first.relevance.possibleFrontierUnitIds.length).toBeGreaterThan(0);
      expect(first.relevance.unavailableSurfaceIds).toEqual([]);
      expect(first.independentValidators[0]).toMatchObject({ path: "test/public-contract.test.mjs", tracked: true });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("stops a mid-compilation cancellation after representation publication", async () => {
    const root = await repository();
    try {
      const controller = new AbortController();
      await expect(compileRepositoryChange(
        { repositoryRoot: root, request: "Change greeting.", proposal: proposal(), now: "2026-08-26T00:00:00.000Z" },
        {
          signal: controller.signal,
          representationArtifacts: {
            put: async () => { controller.abort(); },
            get: async () => undefined,
          },
        },
      )).rejects.toMatchObject({ name: "AbortError" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("blocks duplicate identity candidates and invalid or expired deferrals", async () => {
    const root = await repository();
    try {
      await existingRequirement(root, "requirement:other-greeting", "other-greeting", ["named-greeting"]);
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Change greeting", proposal: proposal(), now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/ambiguous|duplicate.*identity/iu);
    } finally { await rm(root, { recursive: true, force: true }); }

    const clean = await repository();
    try {
      const bounded = workspaceProposal();
      const secretlySelecting = {
        ...bounded,
        architecture: {
          ...bounded.architecture!,
          deferral: { ...bounded.architecture!.deferral, forbiddenCommitments: ["Must use Redis."] },
        },
      };
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: secretlySelecting, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/deferral.*invalid|selects.*option/iu);
      const invented = { ...bounded, architecture: { ...bounded.architecture!, concernKey: "invented-concern" } };
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: invented, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/not.*derived|mismatch|discovered/iu);
      const deferred = await compileRepositoryChange({ repositoryRoot: clean, request: "Add a leaf greeting workspace", proposal: bounded, now: "2026-08-26T00:00:00.000Z" });
      expect(deferred.architectureDeferral).toMatchObject({ concernKey: "task-orchestration", materiality: "deferable", authoritativeDecision: false });
      expect(deferred.compiledPlan.packets[0]?.capsule.forbiddenWrites).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: expect.objectContaining({ value: "package.json" }) }),
      ]));
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change greeting", proposal: bounded, now: "2028-08-26T00:00:00.000Z" })).rejects.toThrow(/deferral.*expired/iu);
      const blocking = parseChangeProposal({ ...proposal(), analysisFacets: ["behavior", "architecture", "public-contract"] });
      await expect(compileRepositoryChange({ repositoryRoot: clean, request: "Change public greeting API", proposal: blocking, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/blocking.*architecture|canonical decision/iu);
    } finally { await rm(clean, { recursive: true, force: true }); }
  });

  it("creates stable new identities without colliding with an occupied derived ID", async () => {
    const root = await repository();
    try {
      const occupied = deriveEntityId("projector.requirement", "new-requirement");
      await existingRequirement(root, occupied, "unrelated", []);
      const changed = parseChangeProposal({ ...proposal(), requirements: [{ key: "new-requirement", title: "New", statement: "New behavior." }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "New behavior", proposal: changed, now: "2026-08-26T00:00:00.000Z" })).rejects.toThrow(/stable ID.*occupied|identity.*collision/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("reuses an unchanged scenario without compiling a no-op canonical edit", async () => {
    const root = await repository();
    try {
      await existingScenario(root);
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Change greeting without rewriting its existing scenario.", proposal: proposal(), now: "2026-08-26T00:00:00.000Z" });
      expect(compiled.identityResolutions).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "scenario", outcome: "reuse-existing", targetId: "scenario:greet-supplied-name" }),
      ]));
      expect(compiled.canonicalWrites).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "scenario:greet-supplied-name" })]));
      expect(compiled.compiledChange.change.operations).not.toEqual(expect.arrayContaining([expect.objectContaining({ subjectType: "scenario", scenarioId: "scenario:greet-supplied-name" })]));
      expect(compiled.exactPatchInput.edits.every(({ before, after }) => before !== after)).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects a test-passing simplification of existing meaning and preserves reference bytes", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const path = canonical.pathFor("requirement", "requirement:legacy-greeting");
      const before = await readFile(path, "utf8");
      const reduced = parseChangeProposal({ ...proposal(), requirements: [{ ...proposal().requirements[0], statement: "The greeting returns text." }],
        edits: [{ path: "src/greeting.mjs", before: proposal().edits[0]!.before, after: 'export const greet = () => "hello";\n' }] });
      await writeFile(join(root, "src/greeting.mjs"), reduced.edits[0]!.after!);
      await exec(process.execPath, ["--test", "test/public-contract.test.mjs"], { cwd: root });
      await writeFile(join(root, "src/greeting.mjs"), reduced.edits[0]!.before!);
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Refactor greeting without changing its behavior.", proposal: reduced }))
        .rejects.toThrow(/implicit canonical revision is forbidden/iu);
      const reference = await compileRepositoryChange({ repositoryRoot: root, request: "Implement the recorded greeting behavior.", proposal: proposal() });
      expect(reference.canonicalWrites.some(({ id }) => id === "requirement:legacy-greeting")).toBe(false);
      expect(await readFile(path, "utf8")).toBe(before);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("binds explicit revisions to prior meaning and retains related future commitments", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const existing = (await canonical.snapshot()).documents.find(({ id }) => id === "requirement:legacy-greeting")!;
      await existingRequirement(root, "requirement:future", "future-personalization", []);
      await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: "relation:future", key: "relation:relation:future", lifecycle: "active",
        payload: { id: "relation:future", fromId: existing.id, toId: "requirement:future", type: "requires", active: true, sourceClass: "authored", confidence: 1, evidence: [], semanticHash: placeholder } }));
      const revised = parseChangeProposal({ ...proposal(), requirements: [{ ...proposal().requirements[0], statement: "The greeting includes the supplied name and preserves its case.",
        revision: { id: existing.id, expectedSemanticHash: existing.payload.semanticHash, rationale: "Make the previously implicit case-preservation requirement explicit." } }] });
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Clarify case preservation.", proposal: revised });
      const review = compiled.intentReview.subjects.find(({ id }) => id === existing.id)!;
      expect(review.operation).toBe("revise");
      expect(review.before?.semanticHash).toBe(existing.payload.semanticHash);
      expect(review.after.semanticHash).not.toBe(review.before?.semanticHash);
      expect(compiled.intentReview.relatedObligations.map(({ id }) => id)).toContain("requirement:future");
      expect(compiled.intentReview.relations.map(({ id }) => id)).toEqual(["relation:future"]);
      expect(compiled.intentReview.blockingUnknowns).toEqual([]);
      expect(compiled.compiledChange.change.operations).toEqual(expect.arrayContaining([expect.objectContaining({ subjectType: "requirement", rationale: expect.stringContaining("case-preservation") })]));
      expect(compiled.compiledChange.change.assumptions.join(" ")).toContain("requirement:future");
      const stale = parseChangeProposal({ ...revised, requirements: [{ ...revised.requirements[0], revision: { ...revised.requirements[0]!.revision, expectedSemanticHash: placeholder } }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Clarify case preservation.", proposal: stale })).rejects.toThrow(/semantic hash is stale/iu);
      await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: "relation:unimplemented", key: "relation:relation:unimplemented", lifecycle: "active",
        payload: { id: "relation:unimplemented", fromId: "requirement:future", toId: "concept:not-yet-modeled", type: "depends-on", active: true, sourceClass: "authored", confidence: 1, evidence: [], semanticHash: placeholder } }));
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Clarify case preservation.", proposal: revised })).rejects.toThrow(/unresolved conceptual obligations.*concept:not-yet-modeled/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("requires an explicit revision for a weakened scenario outcome", async () => {
    const root = await repository();
    try {
      await existingScenario(root);
      const weaker = parseChangeProposal({ ...proposal(), scenarios: [{ ...proposal().scenarios[0], steps: [
        { role: "trigger", statement: "The caller requests a greeting." }, { role: "expected-outcome", statement: "A greeting is returned." },
      ] }] });
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Refactor greeting.", proposal: weaker })).rejects.toThrow(/implicit canonical revision/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not promote descriptive or inferred relations to obligations", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      for (const [id, type, sourceClass] of [["relation:descriptive", "documents", "authored"], ["relation:inferred", "requires", "inferred"]] as const) {
        await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id, key: `relation:${id}`, lifecycle: "active",
          payload: { id, fromId: "requirement:legacy-greeting", toId: "unaccepted:meaning", type, sourceClass, active: true, confidence: 1, evidence: [], semanticHash: placeholder } }));
      }
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Implement greeting.", proposal: proposal() });
      expect(compiled.intentReview.relations).toEqual([]);
      expect(compiled.intentReview.blockingUnknowns).toEqual([]);
      expect(compiled.intentReview.unknowns.join(" ")).toContain("inferred relation remains a candidate");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("follows explicit ownership forward without importing an unrelated owner's commitments", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      await existingRequirement(root, "requirement:owned", "owned", []);
      for (const [id, fromId, toId] of [["relation:owned", "requirement:legacy-greeting", "requirement:owned"], ["relation:other-owner", "concept:unrelated-owner", "requirement:legacy-greeting"]]) {
        await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "relation", id: id!, key: `relation:${id}`, lifecycle: "active",
          payload: { id, fromId, toId, type: "owns", sourceClass: "authored", active: true, confidence: 1, evidence: [], semanticHash: placeholder } }));
      }
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Implement greeting.", proposal: proposal() });
      expect(compiled.intentReview.relations.map(({ id }) => id)).toEqual(["relation:owned"]);
      expect(compiled.intentReview.relatedObligations.map(({ id }) => id)).toContain("requirement:owned");
      expect(compiled.intentReview.blockingUnknowns).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps prerequisite and dependent traversal directional across shared prerequisites and cycles", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const existing = (await canonical.snapshot()).documents.find(({ id }) => id === "requirement:legacy-greeting")!;
      for (const [id, key] of [["requirement:shared", "shared"], ["requirement:sibling", "sibling"], ["requirement:transitive", "transitive"], ["requirement:dependent", "dependent"], ["requirement:dependent-prerequisite", "dependent-prerequisite"], ["requirement:prerequisite-sibling", "prerequisite-sibling"]] as const) {
        await existingRequirement(root, id, key, []);
      }
      await existingRelation(root, "relation:root-shared", existing.id, "requirement:shared");
      await existingRelation(root, "relation:sibling-shared", "requirement:sibling", "requirement:shared");
      await existingRelation(root, "relation:shared-transitive", "requirement:shared", "requirement:transitive");
      await existingRelation(root, "relation:transitive-shared", "requirement:transitive", "requirement:shared");
      await existingRelation(root, "relation:dependent-root", "requirement:dependent", existing.id);
      await existingRelation(root, "relation:dependent-prerequisite", "requirement:dependent", "requirement:dependent-prerequisite");
      await existingRelation(root, "relation:prerequisite-sibling", "requirement:prerequisite-sibling", "requirement:dependent-prerequisite");

      const revised = parseChangeProposal({ ...proposal(), requirements: [{ ...proposal().requirements[0], statement: "The greeting includes the supplied name and preserves its case.",
        revision: { id: existing.id, expectedSemanticHash: existing.payload.semanticHash, rationale: "Clarify the existing requirement." } }] });
      const fromRoot = await compileRepositoryChange({
        repositoryRoot: root,
        request: "Clarify the greeting requirement.",
        proposal: revised,
        knowledgeContext: directKnowledgeContext([existing.id], [existing.id, "requirement:shared"], [existing.id, "requirement:shared"]),
      });
      expect(fromRoot.intentReview.relatedObligations.map(({ id }) => id)).toEqual([
        "requirement:dependent", "requirement:dependent-prerequisite", "requirement:legacy-greeting", "requirement:shared", "requirement:transitive",
      ]);
      expect(fromRoot.intentReview.relations.map(({ id }) => id)).toEqual([
        "relation:dependent-prerequisite", "relation:dependent-root", "relation:root-shared", "relation:shared-transitive", "relation:transitive-shared",
      ]);

      const shared = (await canonical.snapshot()).documents.find(({ id }) => id === "requirement:shared")!;
      const sharedProposal = parseChangeProposal({ ...proposal(), requirements: [{ key: "shared", title: "Personalized greeting", aliases: [], statement: "The greeting includes the supplied name and preserves its case.",
        revision: { id: shared.id, expectedSemanticHash: shared.payload.semanticHash, rationale: "Clarify the shared prerequisite." } }] });
      const fromShared = await compileRepositoryChange({ repositoryRoot: root, request: "Clarify the shared prerequisite.", proposal: sharedProposal });
      expect(fromShared.intentReview.relatedObligations.map(({ id }) => id)).toEqual([
        "requirement:dependent", "requirement:dependent-prerequisite", "requirement:legacy-greeting", "requirement:shared", "requirement:sibling", "requirement:transitive",
      ]);
      expect(fromShared.intentReview.blockingUnknowns).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not spend the conceptual-obligation bound on projection context entries", async () => {
    const root = await repository();
    try {
      await existingRequirement(root, "requirement:shared", "shared", []);
      await existingRelation(root, "relation:root-shared", "requirement:legacy-greeting", "requirement:shared");
      const projections = Array.from({ length: 160 }, (_, index) => `projector-projection-unit_${String(index).padStart(3, "0")}`);
      const modelOnly = requirementRevisionProposal(await new CanonicalFileRepository(root).read("requirement", "requirement:legacy-greeting"));
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Implement greeting.", proposal: modelOnly, knowledgeContext: directKnowledgeContext(["requirement:legacy-greeting"], ["requirement:legacy-greeting", ...projections]) });
      expect(compiled.intentReview.relatedObligations.map(({ id }) => id)).toEqual([
        "requirement:legacy-greeting", "requirement:shared",
      ]);
      expect(compiled.intentReview.blockingUnknowns).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("blocks a required context obligation that has no canonical or observed entity", async () => {
    const root = await repository();
    try {
      const modelOnly = requirementRevisionProposal(await new CanonicalFileRepository(root).read("requirement", "requirement:legacy-greeting"));
      await expect(compileRepositoryChange({
        repositoryRoot: root,
        request: "Implement greeting.",
        proposal: modelOnly,
        knowledgeContext: directKnowledgeContext(
          ["requirement:legacy-greeting"],
          ["requirement:legacy-greeting", "requirement:missing-governing-obligation"],
          ["requirement:legacy-greeting", "requirement:missing-governing-obligation"],
        ),
      })).rejects.toThrow(/unresolved conceptual obligations.*requirement:missing-governing-obligation/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("seeds both former and new endpoints when a dependency relation changes", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      for (const [id, key] of [["requirement:former", "former"], ["requirement:replacement", "replacement"], ["requirement:former-dependent", "former-dependent"]] as const) {
        await existingRequirement(root, id, key, []);
      }
      await existingRelation(root, "relation:root-target", "requirement:legacy-greeting", "requirement:former");
      await existingRelation(root, "relation:former-dependent", "requirement:former-dependent", "requirement:former");
      const relation = await canonical.read("relation", "relation:root-target");
      if (relation?.kind !== "relation") throw new Error("test requires a canonical relation");
      const { semanticHash: _semanticHash, ...payload } = relation.payload;
      const changedRelation = parseChangeProposal({
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
        validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        canonicalMutations: [{
          kind: "relation", operation: "revise", expectedSemanticHash: relation.semanticHash, expectedDocumentHash: relation.canonicalDocumentHash,
          rationale: "Move the requirement dependency to its accepted replacement.", payload: { ...payload, toId: "requirement:replacement" },
        }],
      });
      const compiled = await compileRepositoryChange({ repositoryRoot: root, request: "Move the greeting dependency.", proposal: changedRelation });
      expect(compiled.intentReview.relatedObligations.map(({ id }) => id)).toEqual([
        "requirement:former", "requirement:former-dependent", "requirement:legacy-greeting", "requirement:replacement",
      ]);
      expect(compiled.intentReview.relations.map(({ id }) => id)).toEqual([
        "relation:former-dependent", "relation:root-target",
      ]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("reports a deterministic frontier when directed canonical obligations exceed the bound", async () => {
    const root = await repository();
    try {
      let fromId = "requirement:legacy-greeting";
      for (let index = 1; index <= 128; index += 1) {
        const toId = `requirement:chain-${String(index).padStart(3, "0")}`;
        await existingRequirement(root, toId, `chain-${String(index).padStart(3, "0")}`, []);
        await existingRelation(root, `relation:chain-${String(index).padStart(3, "0")}`, fromId, toId);
        fromId = toId;
      }
      const oneSemanticRoot = requirementRevisionProposal(await new CanonicalFileRepository(root).read("requirement", "requirement:legacy-greeting"));
      await expect(compileRepositoryChange({ repositoryRoot: root, request: "Implement greeting.", proposal: oneSemanticRoot }))
        .rejects.toThrow(/conceptual obligation traversal reached its 128-entity bound before resolving requirement:chain-128/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
