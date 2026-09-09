import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { hashFramedDomain, withCanonicalHashes, type ArchitectureDecision, type AuthorityRecord, type Requirement } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository, FileTransactionJournal, RepositoryPathService } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { RepositoryChangeLifecycleService } from "./service.js";
import { ChangeLifecycleStore } from "./store.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";

const exec = promisify(execFile);
const placeholder = hashFramedDomain("test", "placeholder");

const proposal = () => ({
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

const modelProposal = () => ({
  apiVersion: "projector.change-proposal/v1",
  requirements: [], scenarios: [], architecture: null, edits: [],
  validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
  canonicalMutations: [
    { kind: "concept", operation: "add", expectedAbsent: true, rationale: "Record the future clock boundary before implementation.", payload: { id: "concept:clock", key: "clock", kind: "invariant", name: "Clock boundary", aliases: [], statement: "All domain time enters through the clock port.", status: "active", sourceClass: "authored", confidence: 1, tags: ["time"], evidence: [] } },
    { kind: "concept", operation: "add", expectedAbsent: true, rationale: "Record producer ownership before implementation.", payload: { id: "concept:time-producer", key: "time-producer", kind: "ownership", name: "Time producer", aliases: [], statement: "The domain owns production of time values.", status: "active", sourceClass: "authored", confidence: 1, tags: ["time"], evidence: [] } },
    { kind: "relation", operation: "add", expectedAbsent: true, rationale: "Connect the clock boundary to its producer ownership meaning.", payload: { id: "relation:clock-time-producer", fromId: "concept:clock", toId: "concept:time-producer", type: "depends-on", active: true, sourceClass: "authored", confidence: 1, evidence: [] } },
  ],
});

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "projector-lifecycle-service-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "package.json"), "{\"type\":\"module\"}\n");
  await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'hello';\n");
  await writeFile(join(root, "src", "index.mjs"), "import { greet } from './greeting.mjs'; export { greet };\n");
  await writeFile(join(root, "test", "public-contract.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/index.mjs'; assert.equal(greet(), 'hello');\n");
  const payload: Requirement = { id: "requirement:legacy-greeting", key: "legacy-greeting", title: "Personalized greeting", aliases: ["named-greeting"], statement: "The greeting includes the supplied name.", status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, origin: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder };
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "requirement", id: payload.id, key: payload.key, lifecycle: "active", payload: { ...payload } }));
  await exec("git", ["init", "-q"], { cwd: root });
  await exec("git", ["config", "user.email", "projector@example.invalid"], { cwd: root });
  await exec("git", ["config", "user.name", "Projector Test"], { cwd: root });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "initial"], { cwd: root });
  return root;
}

function authority(id: string, subjectId: string): AuthorityRecord {
  return {
    id, key: id, subjectId, status: "approved", conclusion: "normalize", rationale: "test governance", alternatives: [], assumptions: [],
    reconsiderWhen: [{ type: "manual-review" }],
    vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
    assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: placeholder,
  };
}

describe("repository change lifecycle service", () => {
  it("journals and applies a model-only future obligation without a code sandbox or runtime satisfaction claim", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-09-09T00:00:00.000Z" });
      const captured = await service.capture({ request: "Record the clock boundary before implementing it.", proposal: modelProposal() });
      expect(captured.compiled.executionKind).toBe("canonical-only");
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const result = await service.apply(approval.id);
      expect(result.outcome).toBe("success");
      const stored = await new CanonicalFileRepository(root).read("concept", "concept:clock");
      expect(stored?.payload).toMatchObject({ statement: "All domain time enters through the clock port.", status: "active" });
      expect((await new CanonicalFileRepository(root).read("concept", "concept:time-producer"))?.payload).toMatchObject({ status: "active" });
      expect((await new CanonicalFileRepository(root).read("relation", "relation:clock-time-producer"))?.payload).toMatchObject({ fromId: "concept:clock", toId: "concept:time-producer" });
      expect(result.certificate.changedConcepts).toEqual(["concept:clock", "concept:time-producer"]);
      expect(result.certificate.changedRelations).toEqual(["relation:clock-time-producer"]);
      expect(result.receipt.changedCanonicalEntityIds).toEqual(["concept:clock", "concept:time-producer", "relation:clock-time-producer"]);
      expect(result.validations.map(({ validatorId }) => validatorId)).toContain("projector.canonical-model-integrity");
      expect(result.validations.map(({ validatorId }) => validatorId)).not.toContain("projector.post-change-knowledge");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rolls back an interrupted multi-record model mutation and then applies the approved transaction", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Commit the clock model atomically.", proposal: modelProposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const interruptedStore = await ChangeLifecycleStore.create(root, { newId: () => "model-interrupted" });
      const attempt = await interruptedStore.beginAttempt(approval.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: captured.capture.plan.boundary });
      for (const write of captured.compiled.canonicalWrites) await transaction.writeFile(write.path, write.after);
      expect(await new CanonicalFileRepository(root).read("concept", "concept:clock")).toBeDefined();
      expect(await service.recover(approval.id)).toEqual([expect.objectContaining({ action: "rolled-back" })]);
      expect(await new CanonicalFileRepository(root).read("concept", "concept:clock")).toBeUndefined();
      expect(await new CanonicalFileRepository(root).read("concept", "concept:time-producer")).toBeUndefined();
      expect((await service.apply(approval.id)).outcome).toBe("success");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("captures, replans, and approves only the exact human-presented plan hash", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal() });
      const inspected = await service.plan(captured.capture.semanticChangeId);
      expect(inspected.capture).toEqual(captured.capture);
      expect(inspected.compiled.planHash).toBe(captured.capture.planHash);
      await expect(service.approve(captured.capture.semanticChangeId, hashFramedDomain("wrong", null))).rejects.toThrow(/plan hash/iu);
      const approved = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      expect(approved.semanticChangeId).toBe(captured.capture.semanticChangeId);
      expect(approved.approvals).toHaveLength(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("durably binds one reconciled knowledge context through capture, plan, and approval", async () => {
    const root = await repository();
    try {
      const knowledge = await RepositoryKnowledgeService.create(root);
      const context = await knowledge.context({ request: "change greeting safely", namedTargets: ["src/greeting.mjs"] });
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: context.id });
      const planned = await service.plan(captured.capture.semanticChangeId);
      const approved = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);

      expect(captured.capture.knowledgeContextId).toBe(context.id);
      expect(planned.capture.knowledgeContextId).toBe(context.id);
      expect(approved.knowledgeContextId).toBe(context.id);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects unresolved knowledge before capture and when replanning an authenticated retained capture", async () => {
    const root = await repository();
    try {
      const unresolved = await (await RepositoryKnowledgeService.create(root)).context({ request: "meaning-that-does-not-exist-anywhere" });
      expect(unresolved.interpretation.status).toBe("unresolved");
      expect(unresolved.branches).toHaveLength(0);
      const service = await RepositoryChangeLifecycleService.create(root);

      await expect(service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: unresolved.id }))
        .rejects.toThrow(/no direct, accepted, usable interpretation branch/iu);
      expect(await readdir(join(root, ".projector", "runtime", "change-lifecycles", "captures")).catch(() => [])).toHaveLength(0);

      const baseline = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal() });
      await rm(join(root, ".projector", "runtime", "change-lifecycles", "captures"), { recursive: true, force: true });
      const store = await ChangeLifecycleStore.create(root);
      await store.capture({
        request: baseline.capture.request,
        proposal: baseline.capture.proposal,
        proposalHash: baseline.capture.proposalHash,
        semanticChangeId: baseline.capture.semanticChangeId,
        plan: baseline.capture.plan,
        capsules: baseline.capture.capsules,
        exactPatchInputHash: baseline.capture.exactPatchInputHash,
        knowledgeContextId: unresolved.id,
      });
      await expect(service.plan(baseline.capture.semanticChangeId)).rejects.toThrow(/no direct, accepted, usable interpretation branch/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects a direct decision context whose referenced authority is ineligible", async () => {
    for (const variant of ["rejected", "provisional", "wrong-subject"] as const) {
      const root = await repository();
      try {
        const canonical = new CanonicalFileRepository(root);
        const authorityRecord: AuthorityRecord = {
          ...authority("authority:decision", variant === "wrong-subject" ? "concern:other" : "concern:change"),
          status: variant === "provisional" ? "provisional" : variant === "rejected" ? "rejected" : "approved",
        };
        const decision: ArchitectureDecision = {
          id: "decision:change", key: "change", concernId: "concern:change", title: "Change strategy",
          decision: "Use the selected change strategy.", selectedOptionKey: "selected",
          scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, lifecycle: "active",
          authorityRecordId: authorityRecord.id, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: placeholder,
        };
        await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "authority-record", id: authorityRecord.id, key: authorityRecord.key, lifecycle: authorityRecord.status, payload: { ...authorityRecord } }));
        await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "architecture-decision", id: decision.id, key: decision.key, lifecycle: decision.lifecycle, payload: { ...decision } }));
        const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "use decision", entities: [decision.id] });
        const service = await RepositoryChangeLifecycleService.create(root);

        await expect(service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: context.id }))
          .rejects.toThrow(/knowledge context governance is unknown.*referenced authority/iu);
      } finally { await rm(root, { recursive: true, force: true }); }
    }
  });

  it("rejects stale knowledge before replanning or starting a new apply attempt", async () => {
    const root = await repository();
    try {
      const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "preserve callers", namedTargets: ["src/index.mjs"] });
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: context.id });
      const approved = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      await writeFile(join(root, "src", "index.mjs"), "export const changedElsewhere = true;\n");

      await expect(service.plan(captured.capture.semanticChangeId)).rejects.toThrow(/knowledge context binding is stale/iu);
      await expect(service.approve(captured.capture.semanticChangeId, captured.capture.planHash)).rejects.toThrow(/knowledge context binding is stale/iu);
      await expect(service.apply(approved.id)).rejects.toThrow(/knowledge context binding is stale/iu);
      expect(await readdir(join(root, ".projector", "runtime", "journal")).catch(() => [])).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("allows rollback recovery even when retained knowledge became stale", async () => {
    const root = await repository();
    try {
      const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "preserve callers", namedTargets: ["src/index.mjs"] });
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: context.id });
      const approved = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const store = await ChangeLifecycleStore.create(root, { newId: () => "knowledge-recovery" });
      const attempt = await store.beginAttempt(approved.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/greeting.mjs"] });
      await transaction.writeFile("src/greeting.mjs", "export const greet = () => 'interrupted';\n");
      await writeFile(join(root, "src", "index.mjs"), "export const changedElsewhere = true;\n");

      expect(await service.recover(approved.id)).toEqual([expect.objectContaining({ action: "rolled-back" })]);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects violated or unavailable lens governance before capture", async () => {
    for (const invalidAuthority of [false, true]) {
      const root = await repository();
      try {
        const canonical = new CanonicalFileRepository(root);
        const authorityRecord = authority("authority:greeting-placement", "lens:greeting-placement");
        const lens = createRepositoryScriptLens({
          id: "lens:greeting-placement",
          status: "active",
          authorityRecordId: invalidAuthority ? "authority:missing" : authorityRecord.id,
          selector: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" },
          governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:repository-layout" }],
        });
        if (!invalidAuthority) await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "authority-record", id: authorityRecord.id, key: authorityRecord.key, lifecycle: authorityRecord.status, payload: { ...authorityRecord } }));
        await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: lens.status, payload: { ...lens } }));
        const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "change greeting", namedTargets: ["src/greeting.mjs"] });
        const service = await RepositoryChangeLifecycleService.create(root);

        await expect(service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal(), knowledgeContextId: context.id }))
          .rejects.toThrow(invalidAuthority ? /binding is unavailable|governance is unknown/iu : /governance is violated/iu);
      } finally { await rm(root, { recursive: true, force: true }); }
    }
  });

  it("refuses approval after governed state drifts and leaves no stale approval", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Change greeting.", proposal: proposal() });
      await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'changed elsewhere';\n");
      await expect(service.approve(captured.capture.semanticChangeId, captured.capture.planHash)).rejects.toThrow(/stale|exact before|current/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("executes the approved exact packet through the lease, journal, sandbox, and durable result", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Let greet accept a name while preserving zero-argument callers.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const applied = await service.apply(approval.id);
      expect(applied.outcome, applied.reasons.join("; ")).toBe("success");
      expect(applied.validations.map(({ validatorId, status }) => ({ validatorId, status }))).toEqual(expect.arrayContaining([
        { validatorId: "exact-text-patch.verify", status: "passed" },
        { validatorId: "projector.repository-post-observation", status: "passed" },
        { validatorId: "node-independent:test/public-contract.test.mjs", status: "passed" },
      ]));
      const independent = applied.validations.find(({ validatorId }) => validatorId.startsWith("node-independent:"));
      expect(independent?.details).toMatchObject({
        expectedContentHash: expect.stringMatching(/^sha256:v1:/u),
        beforeContentHash: expect.stringMatching(/^sha256:v1:/u),
        afterContentHash: expect.stringMatching(/^sha256:v1:/u),
        executedContentHash: expect.stringMatching(/^sha256:v1:/u),
        executionSource: "immutable-captured-overlay",
      });
      expect(independent?.details.expectedContentHash).toBe(independent?.details.afterContentHash);
      expect(independent?.evidenceIds).toHaveLength(1);
      expect(applied.receipt.changedRequirementIds).toHaveLength(0);
      expect(applied.receipt.changedScenarioIds).toHaveLength(1);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toContain("hello ${name}");
      expect((await service.apply(approval.id)).certificateHash).toBe(applied.certificateHash);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rolls back the journaled packet when the independent sandboxed validator fails", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const invalid = proposal();
      invalid.edits[0]!.after = "export const greet = (name) => `hello ${name}`;\n";
      const captured = await service.capture({ request: "Require a greeting name.", proposal: invalid });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const applied = await service.apply(approval.id);
      expect(applied.outcome).toBe("partial");
      expect(applied.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/node-independent.*failed/iu)]));
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps an approval current across an unrelated repository digest change", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Change greeting without binding unrelated files.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      await writeFile(join(root, "UNRELATED.md"), "unrelated worktree change\n");
      const applied = await service.apply(approval.id);
      expect(applied.outcome, applied.reasons.join("; ")).toBe("success");
      expect(await readFile(join(root, "UNRELATED.md"), "utf8")).toBe("unrelated worktree change\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("stales an approval when an exact path or relevant query result changes before mutation", async () => {
    for (const drift of [["src/greeting.mjs", "export const greet = () => 'drifted';\n"], ["src/index.mjs", "export const unrelated = true;\n"]] as const) {
      const root = await repository();
      try {
        const service = await RepositoryChangeLifecycleService.create(root);
        const captured = await service.capture({ request: "Change greeting only while dependencies remain current.", proposal: proposal() });
        const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
        await writeFile(join(root, drift[0]), drift[1]);
        try {
          const applied = await service.apply(approval.id);
          expect(applied).toMatchObject({ outcome: "failure", reasons: expect.arrayContaining([expect.stringMatching(/stale|dependenc|current|exact before/iu)]) });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/stale|dependenc|current|exact before/iu);
        }
        expect(await readdir(join(root, ".projector", "runtime", "journal")).catch(() => [])).toHaveLength(0);
      } finally { await rm(root, { recursive: true, force: true }); }
    }
  });

  it("refuses success when the applied change introduces a new analyzer failure", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const invalid = proposal();
      invalid.edits.push({ path: "package.json", before: "{\"type\":\"module\"}\n", after: "{\n" });
      const captured = await service.capture({ request: "Change greeting without hiding analyzer failures.", proposal: invalid });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const applied = await service.apply(approval.id);

      expect(applied.outcome).toBe("partial");
      expect(applied.validations).toEqual(expect.arrayContaining([
        expect.objectContaining({ validatorId: "projector.repository-post-observation", status: "failed" }),
      ]));
      expect(applied.certificate.planningSurpriseIds).not.toHaveLength(0);
      expect(await readFile(join(root, "package.json"), "utf8")).toBe("{\"type\":\"module\"}\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("recovers an interrupted durable transaction before a fresh approved attempt", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Change greeting.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const store = await ChangeLifecycleStore.create(root, { now: () => "2026-08-26T00:00:00.000Z", newId: () => "interrupted" });
      const attempt = await store.beginAttempt(approval.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/greeting.mjs"] });
      await transaction.writeFile("src/greeting.mjs", "export const greet = () => 'interrupted';\n");

      expect((await service.recover(approval.id))[0]).toMatchObject({ attemptId: attempt.id, action: "rolled-back" });
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
      expect((await service.apply(approval.id)).outcome).toBe("success");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("returns authenticated recovery-required detail when interrupted content is a third state", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Change greeting without overwriting third-state recovery edits.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const store = await ChangeLifecycleStore.create(root, { now: () => "2026-08-26T00:00:00.000Z", newId: () => "third-state" });
      const attempt = await store.beginAttempt(approval.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/greeting.mjs"] });
      await transaction.writeFile("src/greeting.mjs", "export const greet = () => 'interrupted';\n");
      await writeFile(join(root, "src", "greeting.mjs"), "export const greet = () => 'third state';\n");

      await expect(service.resume(approval.id)).rejects.toMatchObject({
        code: "lifecycle-recovery-required",
        outcomes: [expect.objectContaining({ attemptId: attempt.id, transactionId: attempt.transactionId, action: "recovery-required" })],
      });
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toContain("third state");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("recovers only authenticated transactions belonging to the selected approval", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Recover only this greeting approval.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const capturedB = await service.capture({ request: "A distinct approval must remain isolated from greeting recovery.", proposal: proposal() });
      const approvalB = await service.approve(capturedB.capture.semanticChangeId, capturedB.capture.planHash);
      const store = await ChangeLifecycleStore.create(root, { newId: () => "selected" });
      const selected = await store.beginAttempt(approval.id);
      const foreignStore = await ChangeLifecycleStore.create(root, { newId: () => "foreign" });
      const foreignAttempt = await foreignStore.beginAttempt(approvalB.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      await journal.begin({ transactionId: selected.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/greeting.mjs"] });
      const foreign = await journal.begin({ transactionId: foreignAttempt.transactionId, planId: capturedB.capture.planId, beforeState: capturedB.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/index.mjs"] });
      await foreign.writeFile("src/index.mjs", "export const foreign = true;\n");
      expect(await service.recover(approval.id)).toEqual([expect.objectContaining({ transactionId: selected.transactionId })]);
      expect((await journal.read(foreignAttempt.transactionId)).entry.phase).toBe("workspace-mutating");
      expect(await readFile(join(root, "src", "index.mjs"), "utf8")).toBe("export const foreign = true;\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("blocks a new apply while any governed transaction is incomplete", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Do not overlap an incomplete transaction.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      await journal.begin({ transactionId: "transaction_existing", planId: "plan:existing", beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: ["src/index.mjs"] });
      await expect(service.apply(approval.id)).rejects.toThrow(/incomplete.*transaction|recover/iu);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("survives SIGKILL during sandbox validation, takes over the stale lease, and resumes", async () => {
    const root = await repository();
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await writeFile(join(root, "test", "public-contract.test.mjs"), [
        "import assert from 'node:assert/strict';",
        "import { existsSync } from 'node:fs';",
        "import { setTimeout as delay } from 'node:timers/promises';",
        "import { greet } from '../src/index.mjs';",
        "if (existsSync('.projector/runtime/interruption-hold')) await delay(20_000);",
        "assert.equal(greet(), 'hello');",
        "",
      ].join("\n"));
      await exec("git", ["add", "test/public-contract.test.mjs"], { cwd: root });
      await exec("git", ["commit", "--amend", "--no-edit", "-q"], { cwd: root });
      await mkdir(join(root, ".projector", "runtime"), { recursive: true });
      await writeFile(join(root, ".projector", "runtime", "interruption-hold"), "hold\n");
      const service = await RepositoryChangeLifecycleService.create(root, { leaseStaleAfterMs: 300 });
      const captured = await service.capture({ request: "Change greeting across a real interruption.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const projectorRoot = fileURLToPath(new URL("../../../../", import.meta.url));
      const vitest = join(projectorRoot, "node_modules", "vitest", "vitest.mjs");
      child = spawn(process.execPath, [vitest, "run", "packages/control-plane/src/change-lifecycle/interruption-worker.test.ts", "--pool=threads", "--maxWorkers=1"], {
        cwd: projectorRoot,
        env: { ...process.env, PROJECTOR_INTERRUPTION_REPOSITORY: root, PROJECTOR_INTERRUPTION_APPROVAL: approval.id },
        stdio: "ignore",
      });

      const transactionId = await waitForValidatingTransaction(root);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toContain("hello ${name}");
      child.kill("SIGKILL");
      const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child!.once("exit", (code, signal) => resolve({ code, signal })));
      expect(exit).toMatchObject({ signal: "SIGKILL" });
      child = undefined;
      await rm(join(root, ".projector", "runtime", "interruption-hold"), { force: true });
      await new Promise((resolve) => setTimeout(resolve, 450));

      expect(await service.recover(approval.id)).toEqual([expect.objectContaining({ transactionId, action: "rolled-back" })]);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
      expect((await service.resume(approval.id)).outcome).toBe("success");
    } finally {
      child?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("finalizes a committed attempt from prepared success after publication is interrupted", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Change greeting durably.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const internal = service as unknown as { store: ChangeLifecycleStore };
      const writeArtifact = internal.store.writeArtifact.bind(internal.store);
      internal.store.writeArtifact = async () => { throw new Error("simulated process interruption after durable commit"); };

      await expect(service.apply(approval.id)).rejects.toThrow(/simulated process interruption/iu);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toContain("hello ${name}");

      internal.store.writeArtifact = writeArtifact;
      const recovered = await service.recover(approval.id);
      expect(recovered).toEqual([expect.objectContaining({ action: "finalized" })]);
      const resumed = await service.resume(approval.id);
      expect(resumed.outcome).toBe("success");
      expect(resumed.certificateHash).toMatch(/^sha256:v1:/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("fails closed when idempotent success evidence has been modified", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({ request: "Change greeting with authenticated evidence.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const applied = await service.apply(approval.id);
      await writeFile(join(root, applied.certificateRef), "{}\n");

      await expect(service.apply(approval.id)).rejects.toThrow(/artifact content authentication/iu);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("records committed-unpublished after certificate publication and finalizes the receipt idempotently", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Publish committed success safely.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const internal = service as unknown as { store: ChangeLifecycleStore };
      const writeArtifact = internal.store.writeArtifact.bind(internal.store);
      internal.store.writeArtifact = async (kind, hash, content) => kind === "receipt" ? Promise.reject(new Error("receipt publication interrupted")) : writeArtifact(kind, hash, content);
      await expect(service.apply(approval.id)).rejects.toThrow(/receipt publication interrupted/iu);
      const states = await (internal.store as unknown as { attemptStatesForApproval(id: string): Promise<Array<{ status: string }>> }).attemptStatesForApproval(approval.id);
      expect(states).toEqual([expect.objectContaining({ status: "committed-unpublished" })]);
      internal.store.writeArtifact = writeArtifact;
      expect(await service.recover(approval.id)).toEqual([expect.objectContaining({ action: "finalized" })]);
      expect(await service.recover(approval.id)).toEqual([]);
      expect((await service.apply(approval.id)).outcome).toBe("success");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("propagates cancellation into sandbox validation and rolls back exactly", async () => {
    const root = await repository();
    try {
      await writeFile(join(root, "test", "public-contract.test.mjs"), ["import { existsSync } from 'node:fs';", "import { setTimeout as delay } from 'node:timers/promises';", "if (existsSync('.projector/runtime/cancellation-hold')) await delay(20_000);", ""].join("\n"));
      await exec("git", ["add", "test/public-contract.test.mjs"], { cwd: root });
      await exec("git", ["commit", "--amend", "--no-edit", "-q"], { cwd: root });
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Cancel during validation safely.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      await mkdir(join(root, ".projector", "runtime"), { recursive: true });
      await writeFile(join(root, ".projector", "runtime", "cancellation-hold"), "hold\n");
      const controller = new AbortController();
      const applying = service.apply(approval.id, { signal: controller.signal });
      await Promise.race([
        waitForValidatingTransaction(root),
        applying.then(() => { throw new Error("apply completed before the cancellation fixture reached validation"); }),
      ]);
      controller.abort();
      const result = await applying;
      expect(result.outcome).toBe("partial");
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toBe("export const greet = () => 'hello';\n");
      const records = await (new FileTransactionJournal(await RepositoryPathService.create(root)) as unknown as { incomplete(): Promise<unknown[]> }).incomplete();
      expect(records).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 10_000);
});

async function waitForValidatingTransaction(root: string): Promise<string> {
  const journalRoot = join(root, ".projector", "runtime", "journal");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    let names: string[] = [];
    try { names = await readdir(journalRoot); } catch { /* transaction has not begun */ }
    for (const name of names.filter((candidate) => candidate.endsWith(".json"))) {
      const record = JSON.parse(await readFile(join(journalRoot, name), "utf8")) as { entry?: { transactionId?: string; phase?: string } };
      if (record.entry?.phase === "validating" && record.entry.transactionId !== undefined) return record.entry.transactionId;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("child lifecycle did not reach sandbox validation before interruption deadline");
}
