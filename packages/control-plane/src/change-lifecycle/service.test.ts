import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { hashFramedDomain, withCanonicalHashes, type ArchitectureDecision, type AuthorityRecord, type EvidenceRef, type Requirement } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import {
  createPsychordApplicationObservationPlan,
  createStrictPsychordApplicationObserver,
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
  type PsychordApplicationObservationPlan,
  type PsychordObservationPlan,
  type PsychordObservationResult,
} from "@projector/integrations/runtime-evidence";
import { CanonicalFileRepository, FileTransactionJournal, RepositoryPathService } from "@projector/runtime";
import { describe, expect, it } from "vitest";

import { RepositoryChangeLifecycleService } from "./service.js";
import { ChangeLifecycleStore } from "./store.js";
import { RepositoryKnowledgeService } from "../knowledge/service.js";
import { createDurablePsychordObservationArtifactService } from "../application-evidence/psychord.js";

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

async function reviewedModelProposal(root: string) {
  const candidateProof = await (await RepositoryKnowledgeService.create(root)).context({ request: "Record a clock port and producer ownership independently of greeting behavior." });
  return { ...modelProposal(), identityResolution: {
    contextId: candidateProof.id, contextHash: candidateProof.contentHash, outcome: "create-new", selectedEntityIds: [],
    rationale: "The existing greeting requirement does not own time production.",
    newBoundary: { owns: ["Clock input and time production"], excludes: ["Greeting presentation"],
      nearestEntityIds: candidateProof.interpretation.candidates.map(({ entityId }) => entityId), rationale: "Time is a distinct domain boundary." },
  } };
}

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
  const scenario = proposal().scenarios[0]!;
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario", id: "scenario:greet-supplied-name", key: scenario.key, lifecycle: "active",
    payload: { ...scenario, id: "scenario:greet-supplied-name", aliases: [], status: "active", sourceClass: "authored", scope: payload.scope, evidence: [], discoveryHash: placeholder, semanticHash: placeholder } }));
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

function stripDerived<T extends Record<string, unknown>>(payload: T) {
  const { semanticHash: _semanticHash, discoveryHash: _discoveryHash, ...authored } = payload;
  return authored;
}

function psychordPlan(root: string, runId: string, scenarioSemanticHash: `sha256:v1:${string}`): PsychordObservationPlan {
  return {
    runId, case: "no-input", scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: scenarioSemanticHash },
    repository: { root, gitHead: "a".repeat(40), worktreeDigest: hashFramedDomain("test", "worktree") },
    dependencies: [{ role: "source", locator: "src/greeting.mjs", contentHash: hashFramedDomain("test", "source") }], ownedArtifactRoot: join(root, ".projector", "runtime", "application-evidence-test"),
    representativeInput: { code: "KeyA", holdMs: 1_000 },
    server: { expectedOrigin: "http://127.0.0.1:43123", readinessNonce: "nonce", readinessPath: "/.projector-ready", applicationPath: "/",
      expectedBuildArtifacts: [{ role: "application-document", buildLocator: "dist/index.html", requestPath: "/", contentHash: hashFramedDomain("test", "build") }] },
    limits: { timeoutMs: 10_000, cleanupTimeoutMs: 1_000, maximumOutputBytes: 4_096, maximumDiagnosticBytes: 4_096 },
  };
}

function psychordResult(plan: PsychordObservationPlan): PsychordObservationResult {
  return {
    adapterId: psychordObservationAdapterId, adapterVersion: psychordObservationAdapterVersion, runId: plan.runId, case: plan.case, scenario: plan.scenario,
    operationalStatus: "completed", outcome: "passed", currentness: "current", assurance: "supporting",
    host: { expectedOrigin: plan.server.expectedOrigin, actualOrigin: plan.server.expectedOrigin,
      readiness: { url: `${plan.server.expectedOrigin}${plan.server.readinessPath}`, status: 200, nonce: plan.server.readinessNonce }, browserContextId: "browser:owned",
      buildArtifacts: [{ role: "application-document", locator: "dist/index.html", contentHash: hashFramedDomain("test", "build") }],
      servedArtifacts: [{ role: "application-document", locator: `${plan.server.expectedOrigin}/`, contentHash: hashFramedDomain("test", "build") }],
      ownedResources: [{ kind: "browser-context", handle: "browser:owned", runId: plan.runId }],
      browserCommands: [{ argvHash: hashFramedDomain("test", "argv"), exitCode: 0, signal: null, durationMs: 5, rootExitObserved: true, stdio: "closed", descendantState: "not-observed" }] },
    currentnessObservation: { status: "current", observedWorktreeDigest: plan.repository.worktreeDigest,
      dependencies: plan.dependencies.map(({ role, locator, contentHash }) => ({ role, locator, expectedHash: contentHash, observedHash: contentHash, status: "current" })) },
    assertions: ["run-binding", "endpoint-binding", "readiness-binding", "build-binding", "served-byte-binding", "fresh-browser-storage", "owned-resource-binding", "pinned-dependency-profile", "bounded-loopback-plan", "currentness-binding", "no-input-controls", "no-input-player", "no-input-persistence"].map((id) => ({ id, passed: true, detail: `${id} passed` })),
    observations: { precondition: { sound: "disabled", controls: { listen: false, keep: false, clear: false }, archiveCount: 0, replay: "idle", playerNoteCount: 0, activeVoiceCount: 0, playerEvents: [] } },
    diagnostics: [], cleanup: { complete: true, resources: [{ kind: "browser-context", handle: "browser:owned", outcome: "released" }], diagnostics: [] }, limitations: ["The fixture does not prove acoustic output."],
  };
}

function psychordCurrentness(plan: PsychordApplicationObservationPlan) {
  return { status: "current" as const, repository: { expectedGitHead: plan.adapter.input.repository.gitHead, observedGitHead: plan.adapter.input.repository.gitHead,
    expectedWorktreeDigest: plan.adapter.input.repository.worktreeDigest, observedWorktreeDigest: plan.adapter.input.repository.worktreeDigest, status: "current" as const },
    dependencies: plan.adapter.input.dependencies.map(({ role, locator, contentHash }) => ({ role, locator, expectedHash: contentHash, observedHash: contentHash, status: "current" as const })),
    buildArtifacts: plan.adapter.input.server.expectedBuildArtifacts.map(({ role, buildLocator, contentHash }) => ({ role, locator: buildLocator, expectedHash: contentHash, observedHash: contentHash, status: "current" as const })), reasons: [] };
}

function psychordEvidenceReference(plan: PsychordApplicationObservationPlan, evidenceId: string, observationRole: "prior" | "latest") {
  return { evidenceId, stance: "supports" as const, applicationPredicate: { kind: "application-observation" as const,
    adapter: { id: psychordObservationAdapterId, version: psychordObservationAdapterVersion }, scenario: plan.scenario, case: plan.case,
    predicateId: "predicate:no-input-is-not-player", assertionIds: ["no-input-player"], observationRole } };
}

describe("repository change lifecycle service", () => {
  it("honors caller cancellation across capture, plan, approve, and recover", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Change greeting.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const controller = new AbortController();
      controller.abort();
      const options = { signal: controller.signal };

      await expect(service.capture({ request: "Do not capture after cancellation.", proposal: proposal() }, options)).rejects.toMatchObject({ name: "AbortError" });
      await expect(service.plan(captured.capture.semanticChangeId, options)).rejects.toMatchObject({ name: "AbortError" });
      await expect(service.approve(captured.capture.semanticChangeId, captured.capture.planHash, options)).rejects.toMatchObject({ name: "AbortError" });
      await expect(service.recover(approval.id, options)).rejects.toMatchObject({ name: "AbortError" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("blocks lifecycle planning when a selected requirement's declared application predicate is unknown", async () => {
    const root = await repository();
    const evidenceId = "psychord-artifact:lifecycle";
    try {
      const canonical = new CanonicalFileRepository(root);
      const requirement = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      await canonical.write(withCanonicalHashes({ ...requirement, payload: { ...requirement.payload, evidence: [{ evidenceId, stance: "supports", applicationPredicate: {
        kind: "application-observation", adapter: { id: "psychord.keep-reload-replay", version: "1" },
        scenario: { id: "scenario:greet-supplied-name", semanticHash: placeholder }, case: "supplied-name",
        predicateId: "predicate:greeting-preserves-name", assertionIds: ["exact-name"], observationRole: "latest",
      } }] } }));
      const applicationEvidence = {
        artifacts: { artifactSetId: () => evidenceId, observeAndPublish: async () => ({ status: "missing" as const, artifactSetId: evidenceId }), read: async () => ({ status: "missing" as const, artifactSetId: evidenceId }) },
        currentness: { observe: async () => { throw new Error("currentness is not invoked for missing evidence"); } },
      } as const;
      const context = await (await RepositoryKnowledgeService.create({ repositoryRoot: root, applicationEvidence })).context({ request: "Change greeting.", entities: ["requirement:legacy-greeting"] });
      const selected = { ...proposal(), identityResolution: { contextId: context.id, contextHash: context.contentHash, outcome: "reuse-existing" as const, selectedEntityIds: ["requirement:legacy-greeting"], rationale: "The existing requirement owns greeting behavior." } };
      const service = await RepositoryChangeLifecycleService.create(root, { applicationEvidence });
      await expect(service.capture({ request: "Change greeting.", proposal: selected })).rejects.toThrow(/application evidence is unknown/iu);
      expect(await readdir(join(root, ".projector", "runtime", "change-lifecycles", "captures")).catch(() => [])).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("admits only a current same-predicate evidence replacement without changing normative meaning", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const scenario = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "behavioral-scenario" as const,
        id: "scenario:keep-reload-replay-owned-moment", key: "keep-reload-replay-owned-moment", lifecycle: "active",
        payload: { id: "scenario:keep-reload-replay-owned-moment", key: "keep-reload-replay-owned-moment", title: "Keep and replay", aliases: [], status: "active" as const,
          sourceClass: "authored" as const, scope: { op: "atom" as const, field: "path" as const, matcher: "equals" as const, value: "src/greeting.mjs" },
          steps: [{ role: "expected-outcome" as const, statement: "No input is represented as player activity." }], evidence: [], discoveryHash: placeholder, semanticHash: placeholder } });
      await canonical.write(scenario);
      const artifactRoot = join(root, ".projector", "runtime", "application-evidence-test");
      await mkdir(artifactRoot, { recursive: true });
      const artifacts = createDurablePsychordObservationArtifactService({ storageRoot: artifactRoot, observer: createStrictPsychordApplicationObserver({
        async observeApplication(plan): Promise<PsychordObservationResult> { return psychordResult(plan); },
      }) });
      const oldPlan = createPsychordApplicationObservationPlan(psychordPlan(root, "old", scenario.semanticHash));
      const newPlan = createPsychordApplicationObservationPlan(psychordPlan(root, "new", scenario.semanticHash));
      const oldPublished = await artifacts.observeAndPublish(oldPlan, { signal: new AbortController().signal });
      const newPublished = await artifacts.observeAndPublish(newPlan, { signal: new AbortController().signal });
      expect(oldPublished.status).toBe("published");
      expect(newPublished.status).toBe("published");
      const oldReference = psychordEvidenceReference(oldPlan, oldPublished.artifactSetId, "latest");
      const ordinaryReference = { evidenceId: "evidence:reviewed-design", stance: "context" as const, weight: 0.5 };
      const requirement = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      await canonical.write(withCanonicalHashes({ ...requirement, payload: { ...requirement.payload, evidence: [ordinaryReference, oldReference] } }));
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-qm", "bind stale evidence"], { cwd: root });

      let newStatus: "current" | "stale" = "stale";
      const applicationEvidence = { artifacts, currentness: { async observe(plan: PsychordApplicationObservationPlan) {
        const current = psychordCurrentness(plan);
        return plan.runId === "old" || newStatus === "stale" ? { ...current, status: "stale" as const, repository: { ...current.repository, status: "stale" as const, observedWorktreeDigest: hashFramedDomain("test", "changed") }, reasons: ["source changed"] } : current;
      } } };
      const context = await (await RepositoryKnowledgeService.create({ repositoryRoot: root, applicationEvidence })).context({ request: "Replace stale application evidence without changing the requirement.", entities: [requirement.id] });
      const currentRequirement = (await canonical.read("requirement", requirement.id))!;
      const replacement = (evidence: EvidenceRef[], statement = currentRequirement.payload.statement) => ({
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        identityResolution: { contextId: context.id, contextHash: context.contentHash, outcome: "reuse-existing", selectedEntityIds: [requirement.id], rationale: "Preserve the same requirement while replacing stale evidence." },
        canonicalMutations: [{ kind: "requirement", operation: "revise", expectedSemanticHash: currentRequirement.semanticHash, expectedDocumentHash: currentRequirement.canonicalDocumentHash, rationale: "Retain prior evidence history and attach its current same-predicate successor.",
          payload: stripDerived({ ...currentRequirement.payload, statement, evidence }) }],
      });
      const missing = psychordEvidenceReference(newPlan, "psychord-missing-replacement", "latest");
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([ordinaryReference, { ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, missing]) })).rejects.toThrow(/application evidence is unknown/iu);
      const newReference = psychordEvidenceReference(newPlan, newPublished.artifactSetId, "latest");
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([ordinaryReference, { ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, newReference]) })).rejects.toThrow(/application evidence is unknown/iu);
      newStatus = "current";
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([ordinaryReference, { ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, newReference], "A weaker greeting is acceptable.") })).rejects.toThrow(/application evidence is unknown/iu);
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([ordinaryReference, { ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, { ...newReference, applicationPredicate: { ...newReference.applicationPredicate, assertionIds: ["easier-assertion"] } }]) })).rejects.toThrow(/application evidence is unknown/iu);
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([{ ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, newReference]) })).rejects.toThrow(/application evidence is unknown/iu);
      await expect((await RepositoryChangeLifecycleService.create(root, { applicationEvidence })).capture({ request: "Replace evidence.", proposal: replacement([ordinaryReference, { ...oldReference, applicationPredicate: { ...oldReference.applicationPredicate, observationRole: "prior" } }, newReference]) })).resolves.toMatchObject({ compiled: { executionKind: "canonical-only" } });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("cancels apply during authenticated replanning before persisting an attempt", async () => {
    const root = await repository();
    try {
      const controller = new AbortController();
      let phase: "setup" | "apply" = "setup";
      const service = await RepositoryChangeLifecycleService.create(root, {
        now: () => {
          if (phase === "apply") controller.abort();
          return "2026-09-10T00:00:00.000Z";
        },
      });
      const captured = await service.capture({ request: "Change greeting.", proposal: proposal() });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      phase = "apply";

      await expect(service.apply(approval.id, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
      expect(await (await ChangeLifecycleStore.create(root)).incompleteAttemptsForApproval(approval.id)).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("cannot bypass unresolved new meaning by omitting pre-edit context", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      await expect(service.capture({ request: "Introduce a clock port", proposal: modelProposal() })).rejects.toThrow(/Pre-edit meaning is unresolved|newBoundary/u);
      expect(await readdir(join(root, ".projector", "runtime", "change-lifecycles", "captures")).catch(() => [])).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("does not label a newly introduced scenario as reuse of existing meaning", async () => {
    const root = await repository();
    try {
      const context = await (await RepositoryKnowledgeService.create(root)).context({ request: "Reuse greeting", entities: ["requirement:legacy-greeting"] });
      const proposed = proposal();
      proposed.scenarios[0]!.key = "new-greeting-scenario";
      await expect((await RepositoryChangeLifecycleService.create(root)).capture({ request: "Introduce a new scenario", proposal: { ...proposed,
        identityResolution: { contextId: context.id, contextHash: context.contentHash, outcome: "reuse-existing", selectedEntityIds: ["requirement:legacy-greeting"], rationale: "Reuse this behavior" } } })).rejects.toThrow(/newBoundary|new durable ownership/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("accepts an explicit candidate selection and keeps its rationale in the exact plan", async () => {
    const root = await repository();
    try {
      const knowledge = await RepositoryKnowledgeService.create(root);
      const candidates = await knowledge.context({ request: "personalized greeting supplied name" });
      expect(candidates.branches.some(({ hypothesis }) => hypothesis)).toBe(true);
      const resolution = { contextId: candidates.id, contextHash: candidates.contentHash, outcome: "reuse-existing", selectedEntityIds: ["requirement:legacy-greeting"], rationale: "This requirement already owns personalization; preserve its accepted meaning." };
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Preserve greeting ownership", proposal: { ...proposal(), identityResolution: resolution } });
      expect(captured.capture.knowledgeContextId).toBe(candidates.id);
      expect(captured.compiled.knowledgeContext?.branches.some(({ hypothesis, interpretation }) => !hypothesis && interpretation.entityId === "requirement:legacy-greeting")).toBe(true);
      expect(captured.compiled.intentReview.identityResolution).toEqual(resolution);
      expect((await service.plan(captured.capture.semanticChangeId)).compiled.planHash).toBe(captured.capture.planHash);
      await expect(service.capture({ request: "Preserve greeting ownership", proposal: { ...proposal(), identityResolution: { ...resolution, contextHash: placeholder } } })).rejects.toThrow(/candidate proof/u);
      await expect(service.capture({ request: "Preserve greeting ownership", proposal: { ...proposal(), identityResolution: { ...resolution, selectedEntityIds: ["concept:not-inspected"] } } })).rejects.toThrow(/uninspected candidate/u);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("invalidates an approved new boundary when its inspected candidate knowledge changes", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const proposed = await reviewedModelProposal(root);
      const captured = await service.capture({ request: "Record new clock ownership", proposal: proposed });
      await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const canonical = new CanonicalFileRepository(root);
      const before = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      await canonical.write(withCanonicalHashes({ ...before, payload: { ...before.payload, title: "Clock and greeting", statement: "The greeting owns clock production too." } }));
      await expect(service.plan(captured.capture.semanticChangeId)).rejects.toThrow(/stale|different repository states|candidate/u);
      expect(await canonical.read("concept", "concept:clock")).toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("journals and applies a model-only future obligation without host code execution or runtime satisfaction claim", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-09-09T00:00:00.000Z" });
      const captured = await service.capture({ request: "Record the clock boundary before implementing it.", proposal: await reviewedModelProposal(root) });
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

  it("recovers and applies an interrupted lineage transaction with source retirement", async () => {
    const root = await repository();
    try {
      const canonical = new CanonicalFileRepository(root);
      const source = (await canonical.read("requirement", "requirement:legacy-greeting"))!;
      await canonical.write(withCanonicalHashes({
        ...source,
        id: "requirement:replacement-greeting",
        key: "replacement-greeting",
        lifecycle: "active",
        payload: { ...source.payload, id: "requirement:replacement-greeting", key: "replacement-greeting", aliases: ["current-greeting"] },
      }));
      const knowledge = await RepositoryKnowledgeService.create(root);
      const candidates = await knowledge.context({ request: "named-greeting personalized greeting" });
      const proposal = {
        apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [],
        validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"],
        identityResolution: {
          contextId: candidates.id, contextHash: candidates.contentHash, outcome: "replace-existing",
          selectedEntityIds: [source.id], rationale: "The replacement now owns this meaning.",
          newBoundary: { owns: ["the current greeting identity"], excludes: ["the retired identity"], nearestEntityIds: [source.id], rationale: "Ownership moved explicitly." },
        },
        canonicalMutations: [{
          kind: "lineage", operation: "add", lineageKind: "replace",
          sources: [{ id: source.id, kind: "requirement", expectedSemanticHash: source.semanticHash, expectedDocumentHash: source.canonicalDocumentHash }],
          replacementIds: ["requirement:replacement-greeting"], rationale: "Preserve replacement continuity.",
        }],
      };
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Replace the legacy greeting identity.", proposal });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const interruptedStore = await ChangeLifecycleStore.create(root, { newId: () => "lineage-interrupted" });
      const attempt = await interruptedStore.beginAttempt(approval.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: captured.capture.plan.boundary });
      for (const write of captured.compiled.canonicalWrites) {
        if (write.after === null) await transaction.deleteFile(write.path);
        else await transaction.writeFile(write.path, write.after);
      }
      expect(await canonical.read("requirement", source.id)).toBeUndefined();
      expect(await service.recover(approval.id)).toEqual([expect.objectContaining({ action: "rolled-back" })]);
      expect(await canonical.read("requirement", source.id)).toBeDefined();
      expect((await canonical.snapshot()).documents.some(({ kind }) => kind === "lineage" || kind === "tombstone")).toBe(false);

      const result = await service.apply(approval.id);
      expect(result.outcome).toBe("success");
      expect(await canonical.read("requirement", source.id)).toBeUndefined();
      const finalDocuments = (await canonical.snapshot()).documents;
      const lineage = finalDocuments.find(({ kind }) => kind === "lineage")!;
      const tombstone = finalDocuments.find(({ kind }) => kind === "tombstone")!;
      expect(lineage.payload).toMatchObject({ fromIds: [source.id], toIds: ["requirement:replacement-greeting"] });
      expect(tombstone.payload).toMatchObject({ entityId: source.id, replacementIds: ["requirement:replacement-greeting"] });
      expect(result.certificate.changedRequirements).toContain(source.id);
      expect(result.receipt.changedCanonicalEntityIds).toEqual(expect.arrayContaining([source.id, lineage.id, tombstone.id]));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rolls back an interrupted multi-record model mutation and then applies the approved transaction", async () => {
    const root = await repository();
    try {
      const service = await RepositoryChangeLifecycleService.create(root);
      const captured = await service.capture({ request: "Commit the clock model atomically.", proposal: await reviewedModelProposal(root) });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);
      const interruptedStore = await ChangeLifecycleStore.create(root, { newId: () => "model-interrupted" });
      const attempt = await interruptedStore.beginAttempt(approval.id);
      const journal = new FileTransactionJournal(await RepositoryPathService.create(root));
      const transaction = await journal.begin({ transactionId: attempt.transactionId, planId: captured.capture.planId, beforeState: captured.capture.stateBinding.compiledAgainst, allowedWriteRoots: captured.capture.plan.boundary });
      for (const write of captured.compiled.canonicalWrites) {
        if (write.after === null) throw new Error("this model-add fixture must not delete a canonical document");
        await transaction.writeFile(write.path, write.after);
      }
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
        if (variant === "rejected") {
          const payload = modelProposal().canonicalMutations[0]!.payload;
          await canonical.write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: payload.id, key: payload.key!, lifecycle: "active", payload: { ...payload, discoveryHash: placeholder, semanticHash: placeholder } }));
          const unrelated = await (await RepositoryKnowledgeService.create(root)).context({ request: "Inspect clock", entities: [payload.id] });
          expect(JSON.stringify(unrelated)).not.toContain(decision.id);
          const accepted = await service.capture({ request: "Change greeting with unrelated supplied knowledge", proposal: proposal(), knowledgeContextId: unrelated.id });
          expect(accepted.compiled.knowledgeContext?.branches.flatMap((branch) => (branch.decisionValidity ?? []).map(({ decisionId }) => decisionId))).not.toContain(decision.id);
        }
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

  it("executes the approved exact packet through the lease, journal, host validator, and durable result", async () => {
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
      expect(captured.capture.stateBinding.valueDependencies?.find(({ id }) => id === "repository-impact-proof")?.versionHash).toBe(captured.compiled.derivationImpact.contentHash);
      expect(applied.validations.find(({ validatorId }) => validatorId === "projector.repository-post-observation")?.details).toMatchObject({ impact: {
        baseline: { contentHash: captured.compiled.derivationImpact.baseline.contentHash },
        status: "changed", surprises: [], candidateRelations: [],
        current: { contentHash: expect.stringMatching(/^sha256:v1:/u) },
      } });
      const independent = applied.validations.find(({ validatorId }) => validatorId.startsWith("node-independent:"));
      expect(independent?.details).toMatchObject({
        expectedContentHash: expect.stringMatching(/^sha256:v1:/u),
        beforeContentHash: expect.stringMatching(/^sha256:v1:/u),
        afterContentHash: expect.stringMatching(/^sha256:v1:/u),
        executedContentHash: expect.stringMatching(/^sha256:v1:/u),
        executionSource: "exact-live-tracked-validator",
        hostAssumptions: {
          permissions: process.platform === "win32" ? "codex-unelevated-read-only" : "configured-host",
          filesystemConfinement: false,
          networkDenial: false,
          hostileSameUserProtection: false,
        },
      });
      expect(independent?.details.expectedContentHash).toBe(independent?.details.afterContentHash);
      expect(independent?.evidenceIds).toHaveLength(1);
      expect(applied.receipt.changedRequirementIds).toHaveLength(0);
      // The existing scenario is reused, so the receipt must not claim a meaning edit.
      expect(applied.receipt.changedScenarioIds).toHaveLength(0);
      expect(await readFile(join(root, "src", "greeting.mjs"), "utf8")).toContain("hello ${name}");
      expect((await service.apply(approval.id)).certificateHash).toBe(applied.certificateHash);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("executes a supplemental validator from its exact approved post-edit bytes", async () => {
    const root = await repository();
    try {
      const supplementalPath = "test/named-greeting.test.mjs";
      const supplementalSource = "import assert from 'node:assert/strict'; import { greet } from '../src/index.mjs'; assert.equal(greet('Ada'), 'hello Ada');\n";
      const baseProposal = proposal();
      const service = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-08-26T00:00:00.000Z" });
      const captured = await service.capture({
        request: "Let greet accept a name and verify the new behavior with an approved supplemental test.",
        proposal: {
          ...baseProposal,
          edits: [...baseProposal.edits, { path: supplementalPath, before: null, after: supplementalSource }],
          validation: { ...baseProposal.validation, supplementalNodeTests: [supplementalPath] },
        },
      });
      const approval = await service.approve(captured.capture.semanticChangeId, captured.capture.planHash);

      const applied = await service.apply(approval.id);

      expect(applied.outcome, applied.reasons.join("; ")).toBe("success");
      const supplemental = applied.validations.find(({ validatorId }) => validatorId === `node-supplemental:${supplementalPath}`);
      expect(supplemental).toMatchObject({
        status: "passed",
        authorSource: "authenticated-proposal",
        details: {
          expectedContentHash: hashFramedDomain("transform-content", supplementalSource),
          beforeContentHash: hashFramedDomain("transform-content", supplementalSource),
          afterContentHash: hashFramedDomain("transform-content", supplementalSource),
          executedContentHash: hashFramedDomain("transform-content", supplementalSource),
          executionSource: "exact-live-approved-validator",
        },
      });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rolls back the journaled packet when the independent host validator fails", async () => {
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

  it("survives SIGKILL during host validation, takes over the stale lease, and resumes", async () => {
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
        stdio: ["ignore", "pipe", "pipe"],
      });
      let workerOutput = "";
      const captureOutput = (chunk: Buffer) => { workerOutput = (workerOutput + chunk.toString("utf8")).slice(-8_192); };
      child.stdout!.on("data", captureOutput);
      child.stderr!.on("data", captureOutput);
      const prematureExit = new Promise<never>((_resolve, reject) => child!.once("exit", (code, signal) => {
        reject(new Error(`interruption worker exited before validation (${code ?? signal}): ${workerOutput}`));
      }));
      const transactionId = await Promise.race([waitForValidatingTransaction(root), prematureExit]);
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
      const readPreparedSuccess = internal.store.readPreparedSuccess.bind(internal.store);
      const readController = new AbortController();
      internal.store.readPreparedSuccess = async (attemptId) => {
        const prepared = await readPreparedSuccess(attemptId);
        readController.abort();
        return prepared;
      };
      await expect(service.recover(approval.id, { signal: readController.signal })).rejects.toMatchObject({ name: "AbortError" });
      expect(await internal.store.incompleteAttemptsForApproval(approval.id)).toHaveLength(1);

      internal.store.readPreparedSuccess = readPreparedSuccess;
      const publishController = new AbortController();
      internal.store.writeArtifact = async (kind, hash, content) => {
        const path = await writeArtifact(kind, hash, content);
        publishController.abort();
        return path;
      };
      await expect(service.recover(approval.id, { signal: publishController.signal })).rejects.toMatchObject({ name: "AbortError" });
      expect(await internal.store.incompleteAttemptsForApproval(approval.id)).toHaveLength(1);

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

  it("propagates cancellation into host validation and rolls back exactly", async () => {
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
  throw new Error("child lifecycle did not reach host validation before interruption deadline");
}
