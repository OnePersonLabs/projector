import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { ContentHash } from "@projector/core";
import {
  createPsychordApplicationObservationPlan,
  createStrictPsychordApplicationObserver,
  PsychordObserveAndPublishResultSchema,
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
  type PsychordApplicationObservationResult,
  type PsychordApplicationObserver,
  type PsychordObservationPlan,
  type PsychordObservationResult,
} from "@projector/integrations/runtime-evidence";
import { afterEach, expect, it } from "vitest";

import { createDurablePsychordObservationArtifactService } from "./psychord.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(tmpdir())) throw new Error("refusing to remove a non-temporary test path");
    await rm(root, { recursive: true, force: true });
  }
});

it("is durably incomplete while observation has no terminal result, then publishes passing evidence", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-incomplete");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  let finish!: (result: PsychordObservationResult) => void;
  const waiting = new Promise<PsychordObservationResult>((resolvePromise) => { finish = resolvePromise; });
  let calls = 0;
  let ownerSignal: AbortSignal | undefined;
  const observer: PsychordApplicationObserver = { async observeApplication(_plan, environment) { calls += 1; ownerSignal = environment.signal; return await waiting; } };
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: createStrictPsychordApplicationObserver(observer),
  });

  const publishing = service.observeAndPublish(plan, { signal: new AbortController().signal });
  await until(async () => (await service.read(service.artifactSetId(plan))).status === "incomplete");
  await until(async () => calls === 1);
  const cancelledStartedAt = performance.now();
  await expect(service.observeAndPublish(plan, { signal: AbortSignal.abort() })).resolves.toMatchObject({ status: "incomplete" });
  expect(performance.now() - cancelledStartedAt).toBeLessThan(250);
  expect(calls).toBe(1);
  expect(ownerSignal?.aborted).toBe(false);
  finish(observationResult(legacyPlan));

  const published = await publishing;
  expect(published).toMatchObject({ status: "published", behavioralEvidence: true, result: { outcome: "passed" } });
  expect(PsychordObserveAndPublishResultSchema.parse(published)).toEqual(published);
  expect(() => PsychordObserveAndPublishResultSchema.parse({ ...published, unexpected: true })).toThrow();
  if (published.status !== "published") throw new Error("expected a published observation");
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    ...published,
    result: { ...published.result, runId: "different-run" },
  })).toThrow(/plan binding/u);
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    ...published,
    artifactSetId: `${published.artifactSetId}-different`,
  })).toThrow(/manifest bindings/u);
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    ...published,
    manifest: { ...published.manifest, resultHash: hash("fabricated-result") },
  })).toThrow(/manifest bindings/u);
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    ...published,
    manifest: {
      ...published.manifest,
      blobs: [{ ...published.manifest.blobs[0], sha256: "f".repeat(64) }, published.manifest.blobs[1]],
    },
  })).toThrow(/manifest bindings/u);
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    ...published,
    behavioralEvidence: false,
  })).toThrow(/behavioralEvidence/u);
  expect(() => PsychordObserveAndPublishResultSchema.parse({
    status: "incomplete",
    artifactSetId: published.artifactSetId,
    recovery: {
      code: "attempt-in-flight",
      message: "owned by another collector",
      action: "await the terminal artifact",
    },
  })).toThrow();
  expect(await service.read(service.artifactSetId(plan))).toMatchObject({ status: "published", behavioralEvidence: true });
});

it("publishes an authenticated terminal unavailable result without treating it as behavioral evidence", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-unavailable");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  const unavailable = observationResult(legacyPlan, {
    operationalStatus: "cancelled",
    outcome: "unavailable",
    currentness: "unknown",
    cleanup: {
      complete: false,
      resources: [{ kind: "browser-context", handle: "browser:owned", outcome: "failed" }],
      diagnostics: ["close could not be confirmed"],
    },
    recovery: { code: "cleanup-unproved", action: "recover only browser:owned" },
  });
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: createStrictPsychordApplicationObserver({ async observeApplication() { return unavailable; } }),
  });

  await expect(service.observeAndPublish(plan, { signal: AbortSignal.abort() })).resolves.toMatchObject({
    status: "published",
    behavioralEvidence: false,
    result: { operationalStatus: "cancelled", outcome: "unavailable", cleanup: { complete: false } },
  });
});

it("leaves the attempt incomplete when a terminal result fails exact plan binding", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-mismatch");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  const valid = await createStrictPsychordApplicationObserver({ async observeApplication() { return observationResult(legacyPlan); } })
    .observeApplication(plan, { signal: new AbortController().signal });
  const mismatched: PsychordApplicationObservationResult = { ...valid, runId: "different-run" };
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: { async observeApplication() { return mismatched; } },
  });

  await expect(service.observeAndPublish(plan, { signal: new AbortController().signal })).rejects.toThrow(/plan binding/u);
  await expect(service.read(service.artifactSetId(plan))).resolves.toMatchObject({ status: "incomplete" });
});

it("preserves an incomplete attempt when collection ends without a terminal result", async () => {
  const root = await temporaryRoot();
  const plan = createPsychordApplicationObservationPlan(observationPlan(root, "run-interrupted"));
  let calls = 0;
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: { async observeApplication() { calls += 1; throw new Error("collector interrupted before cleanup disposition"); } },
  });

  await expect(service.observeAndPublish(plan, { signal: AbortSignal.abort() })).rejects.toThrow(/interrupted/u);
  await expect(service.read(service.artifactSetId(plan))).resolves.toMatchObject({ status: "incomplete" });
  const ownerPath = join(root, "attempt-claims", `${service.artifactSetId(plan)}.claim`, "owner.json");
  const abandoned = JSON.parse(await readFile(ownerPath, "utf8")) as Record<string, unknown>;
  abandoned.state = "active";
  abandoned.expiresAt = "2020-01-01T00:00:00.000Z";
  delete abandoned.recoveryReason;
  await writeFile(ownerPath, `${JSON.stringify(abandoned)}\n`, "utf8");
  const reopened = createDurablePsychordObservationArtifactService({ storageRoot: root, observer: serviceObserver(() => { calls += 1; }) });
  const changed = createPsychordApplicationObservationPlan({
    ...observationPlan(root, "run-interrupted"),
    scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: hash("different-scenario") },
  });
  await expect(reopened.observeAndPublish(changed, { signal: AbortSignal.abort() })).rejects.toThrow(/runId was reused/u);
  await expect(reopened.observeAndPublish(plan, { signal: AbortSignal.abort() })).resolves.toMatchObject({
    status: "incomplete",
    recovery: { code: "attempt-owner-unavailable" },
  });
  expect(calls).toBe(1);
});

it("rejects symlinked artifact roots and attempt-claim entries before collection", async () => {
  const parent = await temporaryRoot();
  const target = join(parent, "target");
  const linked = join(parent, "linked");
  await mkdir(target);
  await symlink(target, linked, "junction");
  let calls = 0;
  const observer = serviceObserver(() => { calls += 1; });
  const linkedPlan = createPsychordApplicationObservationPlan(observationPlan(linked, "run-linked-root"));
  const linkedService = createDurablePsychordObservationArtifactService({ storageRoot: linked, observer });
  await expect(linkedService.observeAndPublish(linkedPlan, { signal: new AbortController().signal })).rejects.toThrow(/symbolic-link|junction/u);

  const root = await temporaryRoot();
  const redirected = await temporaryRoot();
  await symlink(redirected, join(root, "attempt-claims"), "junction");
  const entryPlan = createPsychordApplicationObservationPlan(observationPlan(root, "run-linked-claim"));
  const entryService = createDurablePsychordObservationArtifactService({ storageRoot: root, observer });
  await expect(entryService.observeAndPublish(entryPlan, { signal: new AbortController().signal })).rejects.toThrow(/symbolic-link|junction/u);
  expect(calls).toBe(0);
});

it("keeps one attempt identity for a runId and gives a fresh runId a new identity", async () => {
  const root = await temporaryRoot();
  const first = createPsychordApplicationObservationPlan(observationPlan(root, "run-binding"));
  const changed = createPsychordApplicationObservationPlan({
    ...observationPlan(root, "run-binding"),
    repository: { ...observationPlan(root, "run-binding").repository, worktreeDigest: hash("changed-worktree") },
  });
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: { async observeApplication() { throw new Error("not called"); } },
  });
  const fresh = createPsychordApplicationObservationPlan(observationPlan(root, "run-binding-fresh"));
  expect(service.artifactSetId(first)).toBe(service.artifactSetId(changed));
  expect(service.artifactSetId(first)).not.toBe(service.artifactSetId(fresh));
});

it("rejects reuse of a published runId with changed input, scenario, or case", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-reuse-binding");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  const initial = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: createStrictPsychordApplicationObserver({ async observeApplication() { return observationResult(legacyPlan); } }),
  });
  await expect(initial.observeAndPublish(plan, { signal: new AbortController().signal })).resolves.toMatchObject({ status: "published" });
  const reopened = createDurablePsychordObservationArtifactService({ storageRoot: root, observer: serviceObserver(() => undefined) });
  const changes: PsychordObservationPlan[] = [
    { ...legacyPlan, repository: { ...legacyPlan.repository, worktreeDigest: hash("changed") } },
    { ...legacyPlan, scenario: { ...legacyPlan.scenario, semanticHash: hash("changed-scenario") } },
    { ...legacyPlan, case: "save-failure" },
  ];
  for (const changed of changes) {
    await expect(reopened.observeAndPublish(createPsychordApplicationObservationPlan(changed), { signal: new AbortController().signal }))
      .rejects.toThrow(/runId was reused/u);
  }
});

it("rejects a passing result whose detailed currentness omits plan-bound dependencies", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-currentness-binding");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  const legacy = observationResult(legacyPlan);
  const incompleteCurrentness: PsychordObservationResult = { ...legacy, currentnessObservation: { ...legacy.currentnessObservation!, dependencies: [] } };
  const observer = createStrictPsychordApplicationObserver({ async observeApplication() { return incompleteCurrentness; } });
  await expect(observer.observeApplication(plan, { signal: new AbortController().signal })).rejects.toThrow(/currentness details/u);
});

it("returns the authenticated publication to concurrent callers for the same strict plan", async () => {
  const root = await temporaryRoot();
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const legacyPlan = observationPlan(root, `run-concurrent-${iteration}`);
    const plan = createPsychordApplicationObservationPlan(legacyPlan);
    let calls = 0;
    const observer = createStrictPsychordApplicationObserver({
      async observeApplication() {
        calls += 1;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
        return observationResult(legacyPlan);
      },
    });
    const first = createDurablePsychordObservationArtifactService({ storageRoot: root, observer });
    const second = createDurablePsychordObservationArtifactService({ storageRoot: root, observer });
    const results = await Promise.all([
      first.observeAndPublish(plan, { signal: new AbortController().signal }),
      second.observeAndPublish(plan, { signal: new AbortController().signal }),
    ]);
    for (const result of results) if (result.status === "integrity-failed") throw new Error(result.reason);
    expect(results.map(({ status }) => status)).toEqual(["published", "published"]);
    expect(results[0]).toEqual(results[1]);
    expect(calls).toBe(1);
    expect(results[0]).toMatchObject({ result: { cleanup: { complete: true, resources: [{ outcome: "released" }] } } });
  }
});

it("refuses passing publication after attempt claim ownership is lost", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-owner-loss");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  let finish!: (result: PsychordObservationResult) => void;
  const waiting = new Promise<PsychordObservationResult>((resolvePromise) => { finish = resolvePromise; });
  const service = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: createStrictPsychordApplicationObserver({ async observeApplication() { return await waiting; } }),
  });
  const publishing = service.observeAndPublish(plan, { signal: new AbortController().signal });
  await until(async () => (await service.read(service.artifactSetId(plan))).status === "incomplete");
  await rm(join(root, "attempt-claims", `${service.artifactSetId(plan)}.claim`), { recursive: true, force: true });
  finish(observationResult(legacyPlan));
  await expect(publishing).rejects.toThrow(/claim|ENOENT/iu);
  await expect(service.read(service.artifactSetId(plan))).resolves.toMatchObject({ status: "incomplete" });
});

it("resumes an exact durable finalizing manifest without recollecting behavior", async () => {
  const root = await temporaryRoot();
  const legacyPlan = observationPlan(root, "run-resume-finalize");
  const plan = createPsychordApplicationObservationPlan(legacyPlan);
  const initial = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: createStrictPsychordApplicationObserver({ async observeApplication() { return observationResult(legacyPlan); } }),
  });
  const published = await initial.observeAndPublish(plan, { signal: new AbortController().signal });
  expect(published.status).toBe("published");
  const id = initial.artifactSetId(plan);
  await rename(join(root, "published", id), join(root, "finalizing", id));

  const reopened = createDurablePsychordObservationArtifactService({
    storageRoot: root,
    observer: { async observeApplication() { throw new Error("recollection must not run"); } },
  });
  await expect(reopened.observeAndPublish(plan, { signal: new AbortController().signal })).resolves.toMatchObject({
    status: "published",
    artifactSetId: id,
    behavioralEvidence: true,
  });
});

function observationPlan(root: string, runId: string): PsychordObservationPlan {
  return {
    runId,
    case: "no-input",
    scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: hash("scenario") },
    repository: { root: "C:/psychord", gitHead: "a".repeat(40), worktreeDigest: hash("worktree") },
    dependencies: [{ role: "source", locator: "src/ui/App.tsx", contentHash: hash("source") }],
    ownedArtifactRoot: root,
    representativeInput: { code: "KeyA", holdMs: 1_000 },
    server: {
      expectedOrigin: "http://127.0.0.1:43123",
      readinessNonce: "nonce",
      readinessPath: "/.projector-ready",
      applicationPath: "/",
      expectedBuildArtifacts: [{ role: "application-document", buildLocator: "dist/index.html", requestPath: "/", contentHash: hash("build") }],
    },
    limits: { timeoutMs: 10_000, cleanupTimeoutMs: 1_000, maximumOutputBytes: 4_096, maximumDiagnosticBytes: 4_096 },
  };
}

function observationResult(
  plan: PsychordObservationPlan,
  overrides: Partial<PsychordObservationResult> = {},
): PsychordObservationResult {
  return {
    adapterId: psychordObservationAdapterId,
    adapterVersion: psychordObservationAdapterVersion,
    runId: plan.runId,
    case: plan.case,
    scenario: plan.scenario,
    operationalStatus: "completed",
    outcome: "passed",
    currentness: "current",
    assurance: "supporting",
    host: {
      expectedOrigin: plan.server.expectedOrigin,
      actualOrigin: plan.server.expectedOrigin,
      readiness: { url: `${plan.server.expectedOrigin}${plan.server.readinessPath}`, status: 200, nonce: plan.server.readinessNonce },
      browserContextId: "browser:owned",
      buildArtifacts: [{ role: "application-document", locator: "dist/index.html", contentHash: hash("build") }],
      servedArtifacts: [{ role: "application-document", locator: `${plan.server.expectedOrigin}/`, contentHash: hash("build") }],
      ownedResources: [{ kind: "browser-context", handle: "browser:owned", runId: plan.runId }],
      browserCommands: [{ argvHash: hash("argv"), exitCode: 0, signal: null, durationMs: 5, rootExitObserved: true, stdio: "closed", descendantState: "not-observed" }],
    },
    currentnessObservation: {
      status: "current",
      observedWorktreeDigest: plan.repository.worktreeDigest,
      dependencies: plan.dependencies.map(({ role, locator, contentHash }) => ({ role, locator, expectedHash: contentHash, observedHash: contentHash, status: "current" })),
    },
    assertions: [
      "run-binding", "endpoint-binding", "readiness-binding", "build-binding", "served-byte-binding", "fresh-browser-storage",
      "owned-resource-binding", "pinned-dependency-profile", "bounded-loopback-plan", "currentness-binding",
      "no-input-controls", "no-input-player", "no-input-persistence",
    ].map((id) => ({ id, passed: true, detail: `${id} passed` })),
    observations: { precondition: noInputSnapshot() },
    diagnostics: [],
    cleanup: { complete: true, resources: [{ kind: "browser-context", handle: "browser:owned", outcome: "released" }], diagnostics: [] },
    limitations: ["browser fixture evidence does not prove acoustic output"],
    ...overrides,
  };
}

async function temporaryRoot(): Promise<string> { const root = await mkdtemp(join(tmpdir(), "projector-psychord-artifacts-")); roots.push(root); return root; }
function serviceObserver(onCall: () => void) {
  return { async observeApplication(): Promise<never> { onCall(); throw new Error("observation must not run"); } };
}
async function until(predicate: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
  }
  throw new Error("condition was not observed");
}
function hash(value: string): ContentHash { return `sha256:v1:${createHash("sha256").update(value).digest("hex")}`; }
function noInputSnapshot() {
  return {
    sound: "disabled" as const,
    controls: { listen: false, keep: false, clear: false },
    archiveCount: 0,
    replay: "idle" as const,
    playerNoteCount: 0,
    activeVoiceCount: 0,
    playerEvents: [],
  };
}
