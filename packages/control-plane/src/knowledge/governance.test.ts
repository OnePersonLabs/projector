import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { hashFramedDomain, withCanonicalHashes, type ArchitectureDecision, type AuthorityRecord, type CanonicalDocumentEnvelope, type Concept, type ProjectionLens } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository, NativeProcessLauncher, parseTomlDocument, stringifyTomlDocument, type ProcessLauncher, type ProcessLaunchRequest } from "@projector/runtime";
import { afterEach, describe, expect, it } from "vitest";

import { RepositoryChangeLifecycleService } from "../change-lifecycle/service.js";
import { RepositoryKnowledgeService } from "./service.js";

const execute = promisify(execFile);
const roots: string[] = [];
const hash = hashFramedDomain("test", "placeholder");
const scope = { op: "atom", field: "path", matcher: "glob", value: "src/**" } as const;
const subject: Concept = { id: "concept:behavior", key: "behavior", kind: "invariant", name: "Behavior", aliases: [], statement: "Values remain positive.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], discoveryHash: hash, semanticHash: hash };
const decision: ArchitectureDecision = { id: "decision:boundary", key: "boundary", concernId: "concern:boundary", title: "Boundary", decision: "Keep behavior in src.", selectedOptionKey: "src", scope, lifecycle: "active", authorityRecordId: "authority:boundary", governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hash };
function authority(overrides: Partial<AuthorityRecord> = {}): AuthorityRecord {
  return { id: "authority:boundary", key: "authority:boundary", subjectId: decision.concernId, status: "approved", conclusion: "preserve", rationale: "Accepted boundary.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "concept-changed", conceptId: subject.id }], vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 }, assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hash, ...overrides };
}
async function canonical(root: string, kind: CanonicalDocumentEnvelope["kind"], value: object) {
  const payload = value as Record<string, unknown>;
  await new CanonicalFileRepository(root).write(withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id: String(payload.id), key: String(payload.key), lifecycle: String(payload.status ?? payload.lifecycle), payload }));
}
async function git(root: string, args: string[]) { return (await execute("git", args, { cwd: root })).stdout.trim(); }
async function commit(root: string) {
  await git(root, ["add", "package.json", "src", ".projector/model", ".projector/decisions", ".projector/authorities"]);
  await git(root, ["commit", "-qm", "accepted fixture"]);
}
async function repository(record = authority(), tracked = true) {
  const root = await mkdtemp(join(tmpdir(), "projector-public-governance-")); roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "src/value.mjs"), "export const value = 1;\n");
  await canonical(root, "concept", subject);
  await canonical(root, "architecture-decision", decision);
  await canonical(root, "authority-record", record);
  await git(root, ["init", "-q"]);
  await git(root, ["config", "user.email", "projector@example.invalid"]);
  await git(root, ["config", "user.name", "Projector Test"]);
  if (tracked) await commit(root);
  return root;
}
const firstDecision = (context: Awaited<ReturnType<RepositoryKnowledgeService["context"]>>) => context.branches.flatMap((branch) => branch.decisionValidity ?? [])[0]!;
const query = (service: RepositoryKnowledgeService) => service.context({ request: "change boundary", entities: [decision.id] });
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("public architectural decision validity", () => {
  it("detects changed meaning in fresh context and retained proof without invalidating unrelated meaning", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const retained = await query(service);
    expect(firstDecision(retained)).toMatchObject({ baseline: { kind: "tracked-git-history" }, assessment: { blocksCurrentChange: false } });
    await canonical(root, "concept", { ...subject, id: "concept:other", key: "other", statement: "Other meaning." });
    expect((await service.reconcile(retained.id)).governance.status).toBe("conformant");
    await canonical(root, "concept", { ...subject, statement: "Values may be negative." });
    const changed = await service.reconcile(retained.id);
    expect(changed.status).toBe("stale"); expect(changed.governance.status).toBe("unknown");
    expect(firstDecision(await query(await RepositoryKnowledgeService.create(root)))).toMatchObject({ checks: [expect.objectContaining({ status: "fired" })], assessment: { blocksCurrentChange: true } });
    const alreadyStale = await query(service);
    await canonical(root, "concept", { ...subject, statement: "Values may also be imaginary." });
    expect((await service.reconcile(alreadyStale.id)).status).toBe("stale");
  });

  it("does not launder a semantic baseline through canonical envelope formatting", async () => {
    const root = await repository(); const service = await RepositoryKnowledgeService.create(root);
    const before = firstDecision(await query(service));
    await canonical(root, "concept", { ...subject, statement: "Changed after authority." });
    const file = new CanonicalFileRepository(root).pathFor("authority-record", "authority:boundary");
    const parsed = parseTomlDocument(await readFile(file, "utf8"), file) as Record<string, unknown>;
    const encoded = stringifyTomlDocument(parsed, { schemaPath: "../schemas/canonical-document-v2.schema.json" });
    const [directive, ...body] = encoded.split("\n");
    await writeFile(file, `${directive}\n# formatting-only authority edit\n${body.join("\n")}`);
    await commit(root);
    const after = firstDecision(await query(service));
    expect(after.baseline.reference).toBe(before.baseline.reference);
    expect(after.assessment.blocksCurrentChange).toBe(true);
    await canonical(root, "authority-record", authority({ rationale: "A distinct intervening authority rationale." })); await commit(root);
    await canonical(root, "authority-record", authority()); await commit(root);
    const restored = firstDecision(await query(service));
    expect(restored.baseline.reference).toBe(before.baseline.reference);
    expect(restored.assessment.blocksCurrentChange).toBe(true);
  });

  it("requires an anchor for automatic checks while manual assumptions remain disclosed and usable", async () => {
    const root = await repository(authority(), false);
    expect(firstDecision(await query(await RepositoryKnowledgeService.create(root)))).toMatchObject({ baseline: { kind: "unavailable" }, assessment: { blocksCurrentChange: true } });
    await canonical(root, "authority-record", authority({ reconsiderWhen: [{ type: "manual-review" }, { type: "assumption-falsified", assumptionKey: "human-observation" }] }));
    const service = await RepositoryKnowledgeService.create(root);
    expect(firstDecision(await query(service))).toMatchObject({ checks: [expect.objectContaining({ status: "unobserved" }), expect.objectContaining({ status: "unobserved" })], assessment: { blocksCurrentChange: false } });
    expect(firstDecision(await service.context({ request: "review", entities: [decision.id], operation: "review" })).assessment.blocksCurrentChange).toBe(true);
  });

  it("rechecks dates and max-age with no repository change", async () => {
    const root = await repository(authority({ reconsiderWhen: [{ type: "date", at: "2026-09-10T00:00:00.000Z" }], evidenceRefreshPolicy: { key: "daily", mode: "max-age", maxAgeDays: 1, requireOfficialSourceWhenAvailable: false } }));
    let clock = "2026-09-09T12:00:00.000Z";
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, now: () => clock });
    const retained = await query(service); expect(firstDecision(retained).assessment.blocksCurrentChange).toBe(false);
    clock = "2026-09-11T00:00:00.000Z";
    const after = await service.reconcile(retained.id);
    expect(after.status).toBe("stale"); expect(after.governance.status).toBe("unknown");
    expect(firstDecision(await query(service)).checks.filter(({ status }) => status === "fired")).toHaveLength(2);
    await canonical(root, "authority-record", authority({ createdAt: "2027-01-01T00:00:00.000Z", reconsiderWhen: [{ type: "date", at: "2026-09-10T00:00:00.000Z" }], evidenceRefreshPolicy: { key: "daily", mode: "max-age", maxAgeDays: 1, requireOfficialSourceWhenAvailable: false } }));
    await commit(root);
    expect(firstDecision(await query(service)).checks.filter(({ status }) => status === "fired")).toHaveLength(2);
  });

  it("observes new scope members but leaves unrelated decisions and files alone", async () => {
    const root = await repository(authority({ reconsiderWhen: [{ type: "scope-expanded", scopeKey: "src" }] }));
    await canonical(root, "architecture-decision", { ...decision, id: "decision:other", key: "other", scope: { ...scope, value: "other/**" }, authorityRecordId: "authority:other" });
    await canonical(root, "authority-record", authority({ id: "authority:other", key: "authority:other", subjectId: "decision:other", reconsiderWhen: [{ type: "date", at: "2000-01-01" }] }));
    const service = await RepositoryKnowledgeService.create(root); const retained = await query(service);
    expect(retained.branches.flatMap((branch) => branch.decisionValidity ?? []).map(({ decisionId }) => decisionId)).toEqual([decision.id]);
    await writeFile(join(root, "unrelated.txt"), "unrelated");
    expect((await service.reconcile(retained.id)).governance.status).toBe("conformant");
    await writeFile(join(root, "src/new.mjs"), "export const next = 2;\n");
    expect((await service.reconcile(retained.id))).toMatchObject({ status: "stale", governance: { status: "unknown" } });
  });

  it("discloses unsupported required freshness observations", async () => {
    const root = await repository(authority({ reconsiderWhen: [{ type: "toolchain-version", tool: "custom", constraint: ">=4" }], evidenceRefreshPolicy: { key: "versions", mode: "version-sensitive", trackedTechnologies: ["custom"], requireOfficialSourceWhenAvailable: true } }));
    const result = firstDecision(await query(await RepositoryKnowledgeService.create(root)));
    expect(result.checks.map(({ status }) => status)).toEqual(["unobserved", "unknown"]);
    expect(result.assessment.blocksCurrentChange).toBe(true);
  });

  it("distinguishes an empty implementation population without suppressing conceptual reconsideration", async () => {
    const root = await repository(authority(), false);
    await canonical(root, "architecture-decision", { ...decision, scope: { ...scope, value: "future/**" } });
    await commit(root);
    const service = await RepositoryKnowledgeService.create(root);
    const retained = await query(service);
    expect(firstDecision(retained).assessment).toMatchObject({ state: "valid", blocksCurrentChange: false, explanation: expect.stringMatching(/no observed governed repository units; implementation satisfaction is not established/u) });
    await canonical(root, "concept", { ...subject, statement: "Changed before any implementation exists." });
    const reconsidered = firstDecision(await query(service));
    expect(reconsidered.assessment).toMatchObject({ state: "suspect", blocksCurrentChange: true });
    expect(reconsidered.checks).toContainEqual(expect.objectContaining({ status: "fired" }));
  });

  it("uses a successful reviewed canonical transaction baseline before any Git commit", async () => {
    const root = await repository(authority(), false);
    // A new accepted decision is authored through the public model-only route.
    const files = new CanonicalFileRepository(root);
    await rm(files.pathFor("architecture-decision", decision.id)); await rm(files.pathFor("authority-record", "authority:boundary"));
    const knowledge = await RepositoryKnowledgeService.create(root);
    const proof = await knowledge.context({ request: "record behavior architecture", entities: [subject.id] });
    const lifecycle = await RepositoryChangeLifecycleService.create(root, { now: () => "2026-09-09T12:00:00.000Z" });
    const stripHash = ({ semanticHash: _hash, ...payload }: ArchitectureDecision | AuthorityRecord) => payload;
    const captured = await lifecycle.capture({ request: "Record accepted behavior architecture", proposal: { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"], identityResolution: { contextId: proof.id, contextHash: proof.contentHash, outcome: "create-new", selectedEntityIds: [], rationale: "Introduce an architectural decision for the existing behavior.", newBoundary: { owns: ["Architecture placement of behavior"], excludes: ["The behavior definition itself"], nearestEntityIds: [subject.id], rationale: "Decision authority is distinct from behavioral meaning." } }, canonicalMutations: [
      { kind: "architecture-concern", operation: "add", expectedAbsent: true, rationale: "Retain the decision's actual concern.", payload: { id: decision.concernId, key: "boundary-concern", title: "Behavior boundary", question: "Where does this behavior belong?", scope: decision.scope, sourceClass: "authored", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [subject.id], relatedRequirementIds: [], decisionIds: [decision.id], evidence: [] } },
      { kind: "architecture-decision", operation: "add", expectedAbsent: true, rationale: "Accept boundary.", payload: stripHash(decision) },
      { kind: "authority-record", operation: "add", expectedAbsent: true, rationale: "Explicitly accept authority.", payload: stripHash(authority()) },
    ] } });
    const approval = await lifecycle.approve(captured.capture.semanticChangeId, captured.capture.planHash);
    const result = await lifecycle.apply(approval.id);
    expect(result.outcome, JSON.stringify(result)).toBe("success");
    expect(firstDecision(await query(await RepositoryKnowledgeService.create(root)))).toMatchObject({ baseline: { kind: "authenticated-transaction" }, assessment: { blocksCurrentChange: false } });
    await canonical(root, "concept", { ...subject, statement: "Changed after transaction." });
    expect(firstDecision(await query(await RepositoryKnowledgeService.create(root))).assessment.blocksCurrentChange).toBe(true);
    const currentAuthority = (await files.read("authority-record", "authority:boundary"))!;
    const reconsideration = await query(await RepositoryKnowledgeService.create(root));
    const revision = await lifecycle.capture({ request: "Reaffirm the boundary after the changed concept", proposal: { ...captured.capture.proposal,
      identityResolution: { contextId: reconsideration.id, contextHash: reconsideration.contentHash, outcome: "reuse-existing", selectedEntityIds: [decision.id], rationale: "Reaffirm the existing decision with reviewed changed meaning." },
      canonicalMutations: [{ kind: "authority-record", operation: "revise", expectedSemanticHash: currentAuthority.semanticHash, expectedDocumentHash: currentAuthority.canonicalDocumentHash, rationale: "Reviewed the changed concept and reaffirmed the existing boundary.", payload: stripHash({ ...authority(), rationale: "Changed concept reviewed; keep the boundary." }) }],
    } });
    const revisedApproval = await lifecycle.approve(revision.capture.semanticChangeId, revision.capture.planHash);
    expect((await lifecycle.apply(revisedApproval.id)).outcome).toBe("success");
    const reaffirmed = firstDecision(await query(await RepositoryKnowledgeService.create(root)));
    expect(reaffirmed, JSON.stringify(reaffirmed)).toMatchObject({ baseline: { kind: "authenticated-transaction" }, assessment: { blocksCurrentChange: false } });
  });
});

/** Protocol simulation under the selected trusted-host contract. */
function protocolLauncher(calls: ProcessLaunchRequest[]): ProcessLauncher {
  return { capabilities: { cpuLimits: false, memoryLimits: false }, async launch(request) {
    calls.push(request);
    expect(request).toMatchObject({ env: {}, timeoutMs: 30_000 });
    expect(request).not.toHaveProperty("network");
    expect(request).not.toHaveProperty("readRoots");
    expect(request).not.toHaveProperty("writeRoots");
    expect(request.args[0]).toBe(join(request.cwd, "validators/check.cjs"));
    const { stdout, stderr } = await execute(process.execPath, [request.args[0]!, request.args[1]!], { cwd: request.cwd, env: {}, timeout: request.timeoutMs });
    return { exitCode: 0, signal: null, stdout, stderr, durationMs: 0 };
  } };
}
async function validatorFixture() {
  const root = await repository(authority({ reconsiderWhen: [] }));
  await mkdir(join(root, "validators"));
  const source = `const input = JSON.parse(process.argv.at(-1)); const content = require('node:fs').readFileSync(input.unitPath, 'utf8'); process.stdout.write(JSON.stringify({status: content.includes('forbidden') ? 'violated' : 'satisfied', reason: 'checked retained source'}));`;
  await writeFile(join(root, "validators/check.cjs"), source);
  await git(root, ["add", "validators"]); await git(root, ["commit", "-qm", "independent validator"]);
  const oid = await git(root, ["rev-parse", "HEAD:validators/check.cjs"]);
  const version = `git:${oid}`; const validatorId = `validator:positive@${version}`;
  const lensAuthority = authority({ id: "authority:validator", key: "authority:validator", subjectId: "lens:validator", reconsiderWhen: [] });
  const base = createRepositoryScriptLens({ id: "lens:validator", status: "active", authorityRecordId: lensAuthority.id, selector: scope, governanceBasis: [{ kind: "hard-constraint", conceptId: subject.id }] });
  const lens: ProjectionLens = { ...base, rules: [], validators: [{ id: "validator:positive", version, provider: "repository-node", input: { path: "validators/check.cjs", parameters: { literal: "--format" } }, required: true }], expectedProjections: base.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained", predicateIds: [], validatorIds: [validatorId] } })) };
  await canonical(root, "authority-record", lensAuthority); await canonical(root, "projection-lens", lens);
  return { root, lens, source };
}

describe("public durable repository validators", () => {
  it("executes the pinned tracked validator through the native host with explicit trust limits", async () => {
    const { root } = await validatorFixture();
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => new NativeProcessLauncher() });
    const inspected = await service.context({ request: "inspect", entities: ["lens:validator"] });
    expect(inspected.branches[0]?.governanceEvaluations?.[0]?.status).toBe("conformant");
    expect(JSON.stringify(inspected.branches[0]?.governanceEvaluations?.[0])).toContain("configured host permissions");
  });

  it("passes caller cancellation into a running native validator and reports unavailable evidence", async () => {
    const { root, lens } = await validatorFixture();
    const slow = "setInterval(() => {}, 1000);";
    await writeFile(join(root, "validators/check.cjs"), slow);
    await git(root, ["add", "validators/check.cjs"]);
    await git(root, ["commit", "-qm", "slow validator"]);
    const oid = await git(root, ["rev-parse", "HEAD:validators/check.cjs"]);
    const version = `git:${oid}`;
    await canonical(root, "projection-lens", {
      ...lens,
      validators: [{ ...lens.validators[0]!, version }],
      expectedProjections: lens.expectedProjections.map((projection) => ({
        ...projection,
        expectation: { kind: "predicate-constrained", predicateIds: [], validatorIds: [`validator:positive@${version}`] },
      })),
    });
    const controller = new AbortController();
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => new NativeProcessLauncher() });
    const pending = service.context({ request: "inspect", entities: ["lens:validator"], signal: controller.signal });
    setTimeout(() => controller.abort(), 20).unref();
    const inspected = await pending;
    expect(inspected.branches[0]?.governanceEvaluations?.[0]?.status).toBe("unknown");
    expect(JSON.stringify(inspected.branches[0]?.governanceEvaluations?.[0])).toContain("aborted");
  });

  it("reports denied host execution as unavailable without claiming validator conformance", async () => {
    const { root } = await validatorFixture();
    const denied = Object.assign(new Error("spawn EACCES"), { code: "EACCES" });
    const service = await RepositoryKnowledgeService.create({
      repositoryRoot: root,
      createLauncher: async () => ({
        capabilities: { cpuLimits: false, memoryLimits: false },
        async launch() { throw denied; },
      }),
    });
    const inspected = await service.context({ request: "inspect", entities: ["lens:validator"] });
    expect(inspected.branches[0]?.governanceEvaluations?.[0]).toMatchObject({ status: "unknown" });
    expect(JSON.stringify(inspected.branches[0]?.governanceEvaluations?.[0])).toContain("EACCES");
  });

  it("rejects validator success when the exact tracked source changes during execution", async () => {
    const { root, source } = await validatorFixture();
    const calls: ProcessLaunchRequest[] = [];
    const launcher = protocolLauncher(calls);
    const service = await RepositoryKnowledgeService.create({
      repositoryRoot: root,
      createLauncher: async () => ({
        ...launcher,
        async launch(request) {
          calls.push(request);
          await writeFile(join(root, "validators/check.cjs"), `${source}\n// changed while running`);
          return { exitCode: 0, signal: null, stdout: '{"status":"satisfied","reason":"ok"}', stderr: "", durationMs: 1 };
        },
      }),
    });
    await expect(service.context({ request: "inspect", entities: ["lens:validator"] })).rejects.toThrow(
      "Repository changed while custom validators ran",
    );
    expect(calls[0]?.args[0]).toBe(join(root, "validators/check.cjs"));
  });

  it("rechecks out-of-band content and new consumers while code drift becomes unknown without execution", async () => {
    const { root, source } = await validatorFixture(); const calls: ProcessLaunchRequest[] = [];
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => protocolLauncher(calls) });
    const retained = await service.context({ request: "change governed implementation", entities: ["lens:validator"] });
    expect(retained.branches[0]?.governanceEvaluations?.map(({ status }) => status)).toEqual(["conformant"]);
    await writeFile(join(root, "src/value.mjs"), "export const forbidden = 1;\n");
    expect(await service.reconcile(retained.id)).toMatchObject({ status: "stale", governance: { status: "violated" } });
    await writeFile(join(root, "src/new.mjs"), "export const next = 2;\n");
    const newConsumer = await service.reconcile(retained.id);
    expect(newConsumer.status).toBe("stale"); expect(newConsumer.governance.branches[0]?.evaluations).toHaveLength(2);
    const beforeDrift = calls.length;
    await writeFile(join(root, "validators/check.cjs"), `${source}\n// changed test`);
    expect((await service.reconcile(retained.id)).governance.status).toBe("unknown"); expect(calls).toHaveLength(beforeDrift);
    expect(JSON.parse(calls[0]!.args[1]!)).toMatchObject({ apiVersion: "projector.knowledge-validator/v1", parameters: { literal: "--format" } });
  });

  it("rejects an unpinned Git blob and ignores an optional unreferenced unsupported binding", async () => {
    const { root, lens } = await validatorFixture(); const calls: ProcessLaunchRequest[] = [];
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => protocolLauncher(calls) });
    await canonical(root, "projection-lens", { ...lens, validators: [{ ...lens.validators[0]!, version: `git:${"0".repeat(40)}` }], expectedProjections: lens.expectedProjections.map((projection) => ({ ...projection, expectation: { kind: "predicate-constrained", predicateIds: [], validatorIds: [] } })) });
    const unknown = await service.context({ request: "inspect", entities: [lens.id] });
    expect(unknown.branches[0]?.governanceEvaluations?.[0]?.status).toBe("unknown"); expect(calls).toHaveLength(0);
    await canonical(root, "projection-lens", { ...lens, validators: [...lens.validators, { id: "optional", version: "1", provider: "unsupported", input: {}, required: false }] });
    const valid = await service.context({ request: "inspect", entities: [lens.id] });
    expect(valid.branches[0]?.governanceEvaluations?.[0]?.status).toBe("conformant"); expect(calls).toHaveLength(1);
  });

  it("does not accept malformed, failed, or aborted validator output and retries on a fresh observation", async () => {
    const { root } = await validatorFixture(); const calls: ProcessLaunchRequest[] = [];
    let result = { exitCode: 0, signal: null, stdout: '{"status":"satisfied","reason":"ok","extra":true}', stderr: "", durationMs: 0 };
    const launcher = protocolLauncher(calls);
    const service = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => ({ ...launcher, async launch(request) { calls.push(request); return result; } }) });
    const inspect = () => service.context({ request: "inspect", entities: ["lens:validator"] });
    expect((await inspect()).branches[0]?.governanceEvaluations?.[0]?.status).toBe("unknown");
    result = { ...result, exitCode: 1, stdout: '{"status":"satisfied","reason":"ok"}' };
    expect((await inspect()).branches[0]?.governanceEvaluations?.[0]?.status).toBe("unknown");
    result = { ...result, exitCode: 0 };
    expect((await inspect()).branches[0]?.governanceEvaluations?.[0]?.status).toBe("conformant");
    expect(calls).toHaveLength(3);
    const aborting = await RepositoryKnowledgeService.create({ repositoryRoot: root, createLauncher: async () => ({ ...launcher, async launch() { throw new Error("aborted by timeout"); } }) });
    const aborted = await aborting.context({ request: "inspect", entities: ["lens:validator"] });
    expect(aborted.branches[0]?.governanceEvaluations?.[0]?.status).toBe("unknown");
  });
});
