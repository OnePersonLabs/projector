import type { ContentHash } from "@projector/core";

export const psychordObservationAdapterId = "psychord.keep-reload-replay" as const;
export const psychordObservationAdapterVersion = 1 as const;

export type PsychordObservationCase = "no-input" | "keep-reload-replay" | "save-failure";

export interface PsychordDependencyPin {
  readonly role: "source" | "lockfile" | "build-config" | "controller" | "helper" | "fixture" | "toolchain";
  readonly locator: string;
  readonly contentHash: ContentHash;
}

export interface PsychordObservationPlan {
  readonly runId: string;
  readonly case: PsychordObservationCase;
  readonly scenario: { readonly id: string; readonly semanticHash: ContentHash };
  readonly repository: {
    readonly root: string;
    readonly gitHead: string;
    readonly worktreeDigest: ContentHash;
  };
  readonly dependencies: readonly PsychordDependencyPin[];
  readonly ownedArtifactRoot: string;
  readonly server: {
    readonly expectedOrigin: string;
    readonly readinessNonce: string;
    readonly readinessPath: string;
    readonly applicationPath: string;
    readonly expectedBuildArtifacts: readonly PsychordExpectedBuildArtifact[];
  };
  readonly limits: {
    readonly timeoutMs: number;
    readonly cleanupTimeoutMs: number;
    readonly maximumOutputBytes: number;
    readonly maximumDiagnosticBytes: number;
  };
}

export interface PsychordArtifactIdentity {
  readonly role: string;
  readonly locator: string;
  readonly contentHash: ContentHash;
}

export interface PsychordExpectedBuildArtifact {
  readonly role: string;
  readonly buildLocator: string;
  readonly requestPath: string;
  readonly contentHash: ContentHash;
}

export interface PsychordStoredTraceEvidence {
  readonly rawContentHash: ContentHash;
  readonly rawByteLength: number;
  readonly momentCount: number;
  readonly noteEvents: readonly PsychordNoteTraceEvent[];
}

export type PsychordNoteTraceEvent = {
  readonly eventId: string;
  readonly atMs: number;
  readonly sourceId: string;
  readonly sourceSequence: number;
  readonly sourceTimestampMs: number;
  readonly pitch: number;
  readonly midiChannel: number;
  readonly disposition: "player" | "replay";
} & (
  | { readonly type: "note-on"; readonly velocity: number }
  | { readonly type: "note-off"; readonly releaseVelocity: number }
);

export interface PsychordUiSnapshot {
  readonly sound: "disabled" | "running" | "error";
  readonly controls: { readonly listen: boolean; readonly keep: boolean; readonly clear: boolean };
  readonly archiveCount: number;
  readonly replay: "idle" | "active";
  readonly playerNoteCount: number;
  readonly activeVoiceCount: number;
  readonly playerEvents: PsychordStoredTraceEvidence["noteEvents"];
  readonly notice?: string;
  readonly storage?: PsychordStoredTraceEvidence;
}

export interface PsychordBrowserController {
  snapshot(signal: AbortSignal): Promise<PsychordUiSnapshot>;
  enableSoundWithGesture(signal: AbortSignal): Promise<void>;
  playKeyboardNote(input: { readonly code: "KeyA"; readonly holdMs: number }, signal: AbortSignal): Promise<void>;
  keepMoment(signal: AbortSignal): Promise<void>;
  reload(signal: AbortSignal): Promise<void>;
  openArchive(signal: AbortSignal): Promise<void>;
  listenToFirstSavedMoment(signal: AbortSignal): Promise<void>;
  waitForReplay(state: "active" | "idle", signal: AbortSignal): Promise<void>;
  injectStorageWriteFailure(signal: AbortSignal): Promise<void>;
}

export interface PsychordPreparedAttempt {
  readonly runId: string;
  readonly actualOrigin: string;
  readonly readiness: { readonly url: string; readonly status: number; readonly nonce: string };
  readonly buildArtifacts: readonly PsychordArtifactIdentity[];
  readonly servedArtifacts: readonly PsychordArtifactIdentity[];
  readonly browserContext: { readonly id: string; readonly freshStorage: boolean };
  readonly ownedResources: readonly PsychordOwnedResource[];
  readonly controller: PsychordBrowserController;
  observeCurrentness(signal: AbortSignal): Promise<PsychordCurrentnessObservation>;
  collectDiagnostics(signal: AbortSignal): Promise<readonly string[]>;
  cleanup(signal: AbortSignal): Promise<PsychordCleanupObservation>;
}

export interface PsychordOwnedResource {
  readonly kind: "server-process" | "browser-context" | "controller-process" | "artifact-attempt";
  readonly handle: string;
  readonly runId: string;
}

export interface PsychordCleanupObservation {
  readonly complete: boolean;
  readonly resources: readonly {
    readonly kind: PsychordOwnedResource["kind"];
    readonly handle: string;
    readonly outcome: "released" | "not-found" | "failed";
  }[];
  readonly diagnostics: readonly string[];
}

export interface PsychordCurrentnessObservation {
  readonly status: "current" | "stale" | "unknown";
  readonly observedWorktreeDigest?: ContentHash;
  readonly dependencies: readonly {
    readonly role: PsychordDependencyPin["role"];
    readonly locator: string;
    readonly expectedHash: ContentHash;
    readonly observedHash?: ContentHash;
    readonly status: "current" | "stale" | "unavailable";
  }[];
}

export interface PsychordAssertion {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface PsychordObservationResult {
  readonly adapterId: typeof psychordObservationAdapterId;
  readonly adapterVersion: typeof psychordObservationAdapterVersion;
  readonly runId: string;
  readonly case: PsychordObservationCase;
  readonly operationalStatus: "completed" | "failed" | "cancelled";
  readonly outcome: "passed" | "failed" | "unavailable";
  readonly currentness: "current" | "stale" | "unknown";
  readonly assurance: "supporting";
  readonly host: {
    readonly expectedOrigin: string;
    readonly actualOrigin?: string;
    readonly readiness?: { readonly url: string; readonly status: number; readonly nonce: string };
    readonly browserContextId?: string;
    readonly buildArtifacts: readonly PsychordArtifactIdentity[];
    readonly servedArtifacts: readonly PsychordArtifactIdentity[];
    readonly ownedResources: readonly PsychordOwnedResource[];
  };
  readonly currentnessObservation?: PsychordCurrentnessObservation;
  readonly assertions: readonly PsychordAssertion[];
  readonly observations: {
    readonly precondition?: PsychordUiSnapshot;
    readonly postInput?: PsychordUiSnapshot;
    readonly postSave?: PsychordUiSnapshot;
    readonly postReload?: PsychordUiSnapshot;
    readonly replayActive?: PsychordUiSnapshot;
    readonly postReplay?: PsychordUiSnapshot;
    readonly beforeFailedSave?: PsychordUiSnapshot;
    readonly afterFailedSave?: PsychordUiSnapshot;
  };
  readonly diagnostics: readonly string[];
  readonly cleanup: PsychordCleanupObservation;
  readonly recovery?: { readonly code: string; readonly action: string };
  readonly limitations: readonly string[];
}

export type PsychordPreparationResult =
  | { readonly status: "prepared"; readonly attempt: PsychordPreparedAttempt }
  | {
      readonly status: "unavailable";
      readonly diagnostics: readonly string[];
      readonly ownedResources: readonly PsychordOwnedResource[];
      readonly cleanup: PsychordCleanupObservation;
      readonly recovery?: { readonly code: string; readonly action: string };
    };

export interface PsychordObservationHost {
  prepare(plan: PsychordObservationPlan, environment: { readonly signal: AbortSignal }): Promise<PsychordPreparationResult>;
}

export interface PsychordApplicationObserver {
  observeApplication(plan: PsychordObservationPlan, environment: { readonly signal: AbortSignal }): Promise<PsychordObservationResult>;
}

export function createPsychordApplicationObserver(host: PsychordObservationHost): PsychordApplicationObserver {
  return {
    async observeApplication(plan, environment) {
      if (!validObservationPlan(plan) || !hasPinnedDependencyProfile(plan.dependencies)) {
        return unavailableResult(
          plan,
          ["application observation plan is invalid"],
          [],
          { complete: true, resources: [], diagnostics: [] },
          undefined,
          false,
        );
      }
      const deadline = new AbortController();
      const timeout = setTimeout(() => deadline.abort(new Error(`application observation exceeded ${plan.limits.timeoutMs}ms`)), plan.limits.timeoutMs);
      const cancel = (): void => deadline.abort(environment.signal.reason);
      environment.signal.addEventListener("abort", cancel, { once: true });
      try {
        if (environment.signal.aborted) cancel();
        const preparation = await awaitAbortable(host.prepare(plan, { signal: deadline.signal }), deadline.signal);
        if (preparation.status === "unavailable") {
          const cleanup = authenticateCleanup(preparation.ownedResources, preparation.cleanup);
          return unavailableResult(plan, preparation.diagnostics, preparation.ownedResources, cleanup, preparation.recovery, deadline.signal.aborted);
        }
        return await observePreparedPsychordApplication(plan, preparation.attempt, deadline.signal);
      } catch (error) {
        return unavailableResult(
          plan,
          [error instanceof Error ? error.message : String(error)],
          [],
          { complete: false, resources: [], diagnostics: ["host preparation did not return an owned-resource cleanup result"] },
          { code: "application-observation-preparation-unknown", action: "inspect the host attempt and recover only resources owned by its run identity" },
          deadline.signal.aborted,
        );
      } finally {
        clearTimeout(timeout);
        environment.signal.removeEventListener("abort", cancel);
      }
    },
  };
}

async function observePreparedPsychordApplication(
  plan: PsychordObservationPlan,
  attempt: PsychordPreparedAttempt,
  signal: AbortSignal,
): Promise<PsychordObservationResult> {
  const assertions: PsychordAssertion[] = [];
  const observations: {
    precondition?: PsychordUiSnapshot;
    postInput?: PsychordUiSnapshot;
    postSave?: PsychordUiSnapshot;
    postReload?: PsychordUiSnapshot;
    replayActive?: PsychordUiSnapshot;
    postReplay?: PsychordUiSnapshot;
    beforeFailedSave?: PsychordUiSnapshot;
    afterFailedSave?: PsychordUiSnapshot;
  } = {};
  let operationalStatus: PsychordObservationResult["operationalStatus"] = "completed";
  let outcome: PsychordObservationResult["outcome"] = "failed";
  let currentness: PsychordObservationResult["currentness"] = "unknown";
  let diagnostics: readonly string[] = [];
  let cleanup: PsychordObservationResult["cleanup"] = { complete: false, resources: [], diagnostics: ["cleanup did not run"] };
  let currentnessObservation: PsychordCurrentnessObservation | undefined;
  let recovery: PsychordObservationResult["recovery"];
  const controller = boundedController(attempt.controller);

  const assert = (id: string, passed: boolean, detail: string): void => { assertions.push({ id, passed, detail }); };
  try {
    signal.throwIfAborted();
    assert("run-binding", attempt.runId === plan.runId, "prepared attempt must retain the planned run identity");
    assert("endpoint-binding", attempt.actualOrigin === plan.server.expectedOrigin, "actual server origin must equal the allocated plan origin");
    assert("readiness-binding", attempt.readiness.status === 200
      && attempt.readiness.url === resolveOriginPath(plan.server.expectedOrigin, plan.server.readinessPath)
      && attempt.readiness.nonce === plan.server.readinessNonce, "readiness response URL, status, and nonce must match the plan");
    assert("build-binding", buildArtifactsMatch(plan.server.expectedBuildArtifacts, attempt.buildArtifacts), "built artifact locators and bytes must equal the plan-bound identities");
    assert("served-byte-binding", servedArtifactsMatch(plan.server.expectedOrigin, plan.server.expectedBuildArtifacts, attempt.servedArtifacts), "served response URLs and bytes must equal the plan-bound build artifacts");
    assert("fresh-browser-storage", attempt.browserContext.freshStorage, "browser context must begin with fresh origin storage");
    assert("owned-resource-binding", attempt.ownedResources.length > 0 && attempt.ownedResources.every(({ runId }) => runId === plan.runId), "every owned resource handle must be bound to the planned run identity");
    assert("pinned-dependency-profile", hasPinnedDependencyProfile(plan.dependencies), "source, lockfile, build config, controller, helper, fixture, and toolchain inputs must be pinned exactly once or more as applicable");
    assert("bounded-loopback-plan", validObservationPlan(plan), "observation plan must bind the accepted scenario, loopback endpoint, artifact root, build responses, and positive limits");
    if (assertions.some(({ passed }) => !passed)) {
      outcome = "unavailable";
    } else if (plan.case === "no-input") {
      observations.precondition = await controller.snapshot(signal);
      const snapshot = observations.precondition;
      assert("no-input-controls", !snapshot.controls.listen && !snapshot.controls.keep && !snapshot.controls.clear, "no-input controls must remain disabled");
      assert("no-input-player", snapshot.playerNoteCount === 0 && snapshot.replay === "idle", "no-input state must contain neither player nor replay activity");
      assert("no-input-persistence", snapshot.archiveCount === 0 && snapshot.storage === undefined, "fresh no-input state must not contain a saved moment");
      outcome = assertions.every(({ passed }) => passed) ? "passed" : "failed";
    } else if (plan.case === "keep-reload-replay") {
      observations.precondition = await controller.snapshot(signal);
      assertFreshPrecondition(observations.precondition, assert);
      await controller.enableSoundWithGesture(signal);
      await controller.playKeyboardNote({ code: "KeyA", holdMs: 120 }, signal);
      observations.postInput = await controller.snapshot(signal);
      assertRepresentativeKeyboardTrace(observations.postInput, assert);
      assert("input-enables-explicit-save", observations.postInput.controls.keep && observations.postInput.controls.clear, "released player input must enable explicit save and clear controls");
      await controller.keepMoment(signal);
      observations.postSave = await controller.snapshot(signal);
      const savedStorage = observations.postSave.storage;
      assert("explicit-save", observations.postSave.archiveCount === 1 && savedStorage?.momentCount === 1 && observations.postSave.notice === "Moment kept on this device.", "explicit Keep must publish one locally stored moment before reporting success");
      await controller.reload(signal);
      observations.postReload = await controller.snapshot(signal);
      assert("reload-restores-archive", savedStorage !== undefined
        && observations.postReload.archiveCount === 1
        && observations.postReload.storage?.rawContentHash === savedStorage.rawContentHash
        && observations.postReload.storage.rawByteLength === savedStorage.rawByteLength, "reload must restore the exact persisted archive bytes");
      assert("reload-clears-live-player", observations.postReload.sound === "disabled"
        && observations.postReload.playerNoteCount === 0
        && observations.postReload.activeVoiceCount === 0
        && !observations.postReload.controls.keep
        && !observations.postReload.controls.clear, "reload must begin with sound disabled and no live player evidence");
      await controller.enableSoundWithGesture(signal);
      await controller.openArchive(signal);
      await controller.listenToFirstSavedMoment(signal);
      await controller.waitForReplay("active", signal);
      observations.replayActive = await controller.snapshot(signal);
      assert("explicit-replay-transition", observations.replayActive.replay === "active", "saved Listen must expose an active replay transition");
      assert("replay-is-not-player-input", observations.replayActive.playerNoteCount === 0
        && observations.replayActive.activeVoiceCount === 0
        && !observations.replayActive.controls.keep
        && !observations.replayActive.controls.clear, "replay must not create live player evidence or enable save controls");
      await controller.waitForReplay("idle", signal);
      observations.postReplay = await controller.snapshot(signal);
      assert("replay-preserves-persisted-provenance", savedStorage !== undefined
        && observations.postReplay.storage?.rawContentHash === savedStorage.rawContentHash
        && observations.postReplay.storage.rawByteLength === savedStorage.rawByteLength
        && observations.postReplay.storage.momentCount === savedStorage.momentCount, "replay must preserve the exact stored trace bytes and archive count");
      assert("replay-completes-without-player-evidence", observations.postReplay.replay === "idle"
        && observations.postReplay.playerNoteCount === 0
        && observations.postReplay.activeVoiceCount === 0, "completed replay must leave live player evidence empty");
      outcome = assertions.every(({ passed }) => passed) ? "passed" : "failed";
    } else if (plan.case === "save-failure") {
      observations.precondition = await controller.snapshot(signal);
      assertFreshPrecondition(observations.precondition, assert);
      await controller.enableSoundWithGesture(signal);
      await controller.playKeyboardNote({ code: "KeyA", holdMs: 120 }, signal);
      observations.postInput = await controller.snapshot(signal);
      assertRepresentativeKeyboardTrace(observations.postInput, assert);
      await controller.keepMoment(signal);
      observations.postSave = await controller.snapshot(signal);
      const existingStorage = observations.postSave.storage;
      assert("failure-control-seed", observations.postSave.archiveCount === 1
        && existingStorage?.momentCount === 1
        && observations.postSave.notice === "Moment kept on this device.", "save-failure control must first establish one real persisted moment");
      await controller.reload(signal);
      observations.postReload = await controller.snapshot(signal);
      assert("failure-control-reload", existingStorage !== undefined
        && observations.postReload.storage?.rawContentHash === existingStorage.rawContentHash
        && observations.postReload.storage.rawByteLength === existingStorage.rawByteLength, "save-failure control must reload the existing bytes before injection");
      await controller.enableSoundWithGesture(signal);
      await controller.playKeyboardNote({ code: "KeyA", holdMs: 120 }, signal);
      observations.beforeFailedSave = await controller.snapshot(signal);
      assert("failure-control-input", observations.beforeFailedSave.controls.keep, "a second real player trace must be eligible for explicit save before rejection is injected");
      await controller.injectStorageWriteFailure(signal);
      await controller.keepMoment(signal);
      observations.afterFailedSave = await controller.snapshot(signal);
      assert("save-failure-visible", observations.afterFailedSave.notice === "Could not keep this moment. Local storage may be full or unavailable.", "rejected persistence must produce the production failure notice");
      assert("save-failure-preserves-archive", existingStorage !== undefined
        && observations.afterFailedSave.archiveCount === 1
        && observations.afterFailedSave.storage?.momentCount === 1
        && observations.afterFailedSave.storage.rawContentHash === existingStorage.rawContentHash
        && observations.afterFailedSave.storage.rawByteLength === existingStorage.rawByteLength, "rejected persistence must not add, replace, or rewrite the existing archive");
      outcome = assertions.every(({ passed }) => passed) ? "passed" : "failed";
    } else {
      throw new Error(`unsupported Psychord observation case ${plan.case}`);
    }
    currentnessObservation = await awaitAbortable(attempt.observeCurrentness(signal), signal);
    currentness = authenticateCurrentness(plan, currentnessObservation) ? currentnessObservation.status : "unknown";
    assert("currentness-binding", currentness === currentnessObservation.status, "currentness details must authenticate every plan-bound dependency and the live worktree digest");
    if (currentness !== "current" && outcome === "passed") outcome = "unavailable";
    diagnostics = await awaitAbortable(attempt.collectDiagnostics(signal), signal);
  } catch (error) {
    if (signal.aborted) {
      operationalStatus = "cancelled";
      outcome = "unavailable";
      diagnostics = ["application observation was cancelled"];
    } else {
      operationalStatus = "failed";
      outcome = "unavailable";
      diagnostics = [error instanceof Error ? error.message : String(error)];
    }
  } finally {
    const cleanupDeadline = new AbortController();
    const cleanupTimeout = setTimeout(() => cleanupDeadline.abort(new Error(`application cleanup exceeded ${plan.limits.cleanupTimeoutMs}ms`)), plan.limits.cleanupTimeoutMs);
    try { cleanup = await awaitAbortable(attempt.cleanup(cleanupDeadline.signal), cleanupDeadline.signal); }
    catch (error) {
      cleanup = { complete: false, resources: [], diagnostics: [error instanceof Error ? error.message : String(error)] };
      recovery = { code: "application-observation-cleanup-unproved", action: "inspect the recorded owned resource handles and recover only resources bound to this run identity" };
    } finally { clearTimeout(cleanupTimeout); }
    cleanup = authenticateCleanup(attempt.ownedResources, cleanup);
    if (!cleanup.complete) {
      if (operationalStatus === "completed") operationalStatus = "failed";
      recovery ??= { code: "application-observation-cleanup-unproved", action: "inspect the recorded owned resource handles and recover only resources bound to this run identity" };
    }
    diagnostics = boundDiagnostics([...diagnostics, ...cleanup.diagnostics], plan.limits.maximumDiagnosticBytes);
  }

  return {
    adapterId: psychordObservationAdapterId,
    adapterVersion: psychordObservationAdapterVersion,
    runId: plan.runId,
    case: plan.case,
    operationalStatus,
    outcome,
    currentness,
    assurance: "supporting",
    host: {
      expectedOrigin: plan.server.expectedOrigin,
      actualOrigin: attempt.actualOrigin,
      readiness: attempt.readiness,
      browserContextId: attempt.browserContext.id,
      buildArtifacts: attempt.buildArtifacts,
      servedArtifacts: attempt.servedArtifacts,
      ownedResources: attempt.ownedResources,
    },
    ...(currentnessObservation === undefined ? {} : { currentnessObservation }),
    assertions,
    observations,
    diagnostics,
    cleanup,
    ...(recovery === undefined ? {} : { recovery }),
    limitations: [
      "trusted workspace and same-user host; no operating-system confinement or anti-forgery independence was established",
      "browser and controller observations do not prove acoustic output, device routing, latency, timbre, learning, or mastery",
    ],
  };
}

function unavailableResult(
  plan: PsychordObservationPlan,
  diagnostics: readonly string[],
  ownedResources: readonly PsychordOwnedResource[],
  cleanup: PsychordObservationResult["cleanup"],
  recovery: PsychordObservationResult["recovery"],
  cancelled: boolean,
): PsychordObservationResult {
  return {
    adapterId: psychordObservationAdapterId,
    adapterVersion: psychordObservationAdapterVersion,
    runId: plan.runId,
    case: plan.case,
    operationalStatus: cancelled ? "cancelled" : "failed",
    outcome: "unavailable",
    currentness: "unknown",
    assurance: "supporting",
    host: {
      expectedOrigin: plan.server.expectedOrigin,
      buildArtifacts: [],
      servedArtifacts: [],
      ownedResources,
    },
    assertions: [],
    observations: {},
    diagnostics: boundDiagnostics([...diagnostics, ...cleanup.diagnostics], plan.limits.maximumDiagnosticBytes),
    cleanup,
    ...(recovery === undefined ? {} : { recovery }),
    limitations: [
      "trusted workspace and same-user host; no operating-system confinement or anti-forgery independence was established",
      "browser and controller observations do not prove acoustic output, device routing, latency, timbre, learning, or mastery",
    ],
  };
}

function authenticateCurrentness(plan: PsychordObservationPlan, observation: PsychordCurrentnessObservation): boolean {
  const identities = new Set<string>();
  let hasStaleDependency = false;
  let hasUnavailableDependency = false;
  for (const dependency of observation.dependencies) {
    const identity = `${dependency.role}\u0000${dependency.locator}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
    const pin = plan.dependencies.find((candidate) => candidate.role === dependency.role && candidate.locator === dependency.locator);
    if (pin === undefined || dependency.expectedHash !== pin.contentHash) return false;
    if (dependency.status === "current" && dependency.observedHash !== pin.contentHash) return false;
    if (dependency.status === "stale" && (dependency.observedHash === undefined || dependency.observedHash === pin.contentHash)) return false;
    if (dependency.status === "unavailable" && dependency.observedHash !== undefined) return false;
    hasStaleDependency ||= dependency.status === "stale";
    hasUnavailableDependency ||= dependency.status === "unavailable";
  }
  if (identities.size !== plan.dependencies.length) return false;
  const worktreeUnavailable = observation.observedWorktreeDigest === undefined;
  const worktreeStale = !worktreeUnavailable && observation.observedWorktreeDigest !== plan.repository.worktreeDigest;
  if (observation.status === "current") return !worktreeUnavailable && !worktreeStale && !hasStaleDependency && !hasUnavailableDependency;
  if (observation.status === "stale") return !hasUnavailableDependency && (worktreeStale || hasStaleDependency);
  return worktreeUnavailable || hasUnavailableDependency;
}

function authenticateCleanup(resources: readonly PsychordOwnedResource[], cleanup: PsychordCleanupObservation): PsychordCleanupObservation {
  const planned = new Set(resources.map(({ kind, handle }) => `${kind}\u0000${handle}`));
  const observed = new Set(cleanup.resources.map(({ kind, handle }) => `${kind}\u0000${handle}`));
  const authentic = resources.every(({ runId }) => runId.trim() !== "")
    && planned.size === resources.length
    && observed.size === cleanup.resources.length
    && planned.size === observed.size
    && [...planned].every((key) => observed.has(key))
    && cleanup.resources.every(({ outcome }) => outcome === "released" || outcome === "not-found");
  if (authentic) return cleanup;
  return { ...cleanup, complete: false, diagnostics: [...cleanup.diagnostics, "cleanup did not authenticate every owned resource handle"] };
}

function assertFreshPrecondition(snapshot: PsychordUiSnapshot, assert: (id: string, passed: boolean, detail: string) => void): void {
  assert("fresh-precondition", snapshot.sound === "disabled"
    && snapshot.archiveCount === 0
    && snapshot.storage === undefined
    && snapshot.playerNoteCount === 0
    && snapshot.activeVoiceCount === 0
    && snapshot.replay === "idle"
    && !snapshot.controls.listen
    && !snapshot.controls.keep
    && !snapshot.controls.clear, "scenario must begin in a fresh browser context without archive, player, replay, or sound state");
}

function assertRepresentativeKeyboardTrace(snapshot: PsychordUiSnapshot, assert: (id: string, passed: boolean, detail: string) => void): void {
  const noteOn = snapshot.playerEvents.find((event) => event.type === "note-on" && event.sourceId === "keyboard" && event.pitch === 60);
  const noteOff = snapshot.playerEvents.find((event) => event.type === "note-off" && event.sourceId === "keyboard" && event.pitch === 60);
  assert("representative-keyboard-input", snapshot.sound === "running"
    && snapshot.activeVoiceCount === 0
    && noteOn?.disposition === "player"
    && noteOff?.disposition === "player"
    && noteOn.eventId !== noteOff.eventId
    && noteOn.sourceSequence < noteOff.sourceSequence
    && noteOn.sourceTimestampMs <= noteOff.sourceTimestampMs
    && noteOn.atMs <= noteOff.atMs
    && noteOn.midiChannel === noteOff.midiChannel,
  "KeyA must produce an ordered, released keyboard C4 player trace with timing, expression, and source provenance");
}

function buildArtifactsMatch(expected: readonly PsychordExpectedBuildArtifact[], actual: readonly PsychordArtifactIdentity[]): boolean {
  const expectedKeys = expected.map(({ role, buildLocator, contentHash }) => `${role}\u0000${buildLocator}\u0000${contentHash}`).sort();
  const actualKeys = actual.map(({ role, locator, contentHash }) => `${role}\u0000${locator}\u0000${contentHash}`).sort();
  return expectedKeys.length === actualKeys.length && expectedKeys.every((value, index) => value === actualKeys[index]);
}

function servedArtifactsMatch(origin: string, expected: readonly PsychordExpectedBuildArtifact[], actual: readonly PsychordArtifactIdentity[]): boolean {
  const expectedKeys = expected.map(({ role, requestPath, contentHash }) => `${role}\u0000${resolveOriginPath(origin, requestPath)}\u0000${contentHash}`).sort();
  const actualKeys = actual.map(({ role, locator, contentHash }) => `${role}\u0000${locator}\u0000${contentHash}`).sort();
  return expectedKeys.length === actualKeys.length && expectedKeys.every((value, index) => value === actualKeys[index]);
}

function resolveOriginPath(origin: string, path: string): string {
  try { return new URL(path, `${origin}/`).href; }
  catch { return "invalid-url"; }
}

function validObservationPlan(plan: PsychordObservationPlan): boolean {
  let origin: URL;
  try { origin = new URL(plan.server.expectedOrigin); }
  catch { return false; }
  const loopback = origin.protocol === "http:"
    && (origin.hostname === "127.0.0.1" || origin.hostname === "[::1]")
    && origin.username === ""
    && origin.password === ""
    && origin.pathname === "/"
    && origin.search === ""
    && origin.hash === "";
  return plan.scenario.id === "scenario:keep-reload-replay-owned-moment"
    && loopback
    && plan.server.readinessNonce.trim() !== ""
    && plan.server.readinessPath.startsWith("/")
    && plan.server.applicationPath.startsWith("/")
    && plan.server.expectedBuildArtifacts.length > 0
    && plan.server.expectedBuildArtifacts.every(({ role, buildLocator, requestPath, contentHash }) => role.trim() !== ""
      && buildLocator.trim() !== ""
      && requestPath.startsWith("/")
      && /^sha256:v1:[a-f0-9]{64}$/u.test(contentHash))
    && plan.ownedArtifactRoot.trim() !== ""
    && Number.isSafeInteger(plan.limits.timeoutMs)
    && plan.limits.timeoutMs > 0
    && Number.isSafeInteger(plan.limits.cleanupTimeoutMs)
    && plan.limits.cleanupTimeoutMs > 0
    && Number.isSafeInteger(plan.limits.maximumOutputBytes)
    && plan.limits.maximumOutputBytes > 0
    && Number.isSafeInteger(plan.limits.maximumDiagnosticBytes)
    && plan.limits.maximumDiagnosticBytes >= 0;
}

function hasPinnedDependencyProfile(dependencies: readonly PsychordDependencyPin[]): boolean {
  const required = new Set<PsychordDependencyPin["role"]>(["source", "lockfile", "build-config", "controller", "helper", "fixture", "toolchain"]);
  const identities = new Set<string>();
  for (const dependency of dependencies) {
    if (dependency.locator.trim() === "" || !/^sha256:v1:[a-f0-9]{64}$/u.test(dependency.contentHash)) return false;
    const identity = `${dependency.role}\u0000${dependency.locator}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
    required.delete(dependency.role);
  }
  return required.size === 0;
}

function boundDiagnostics(diagnostics: readonly string[], maximumBytes: number): readonly string[] {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) return ["invalid diagnostic byte limit"];
  const retained: string[] = [];
  const truncationNotice = "diagnostics truncated at declared byte limit";
  let used = 0;
  for (const diagnostic of diagnostics) {
    const bytes = Buffer.byteLength(diagnostic, "utf8");
    if (used + bytes > maximumBytes) {
      const noticeBytes = Buffer.byteLength(truncationNotice, "utf8");
      if (used + noticeBytes <= maximumBytes) retained.push(truncationNotice);
      break;
    }
    retained.push(diagnostic);
    used += bytes;
  }
  return retained;
}

function awaitAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("operation aborted"));
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new Error("operation aborted"));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

function boundedController(controller: PsychordBrowserController): PsychordBrowserController {
  return {
    snapshot: async (signal) => await awaitAbortable(controller.snapshot(signal), signal),
    enableSoundWithGesture: async (signal) => await awaitAbortable(controller.enableSoundWithGesture(signal), signal),
    playKeyboardNote: async (input, signal) => await awaitAbortable(controller.playKeyboardNote(input, signal), signal),
    keepMoment: async (signal) => await awaitAbortable(controller.keepMoment(signal), signal),
    reload: async (signal) => await awaitAbortable(controller.reload(signal), signal),
    openArchive: async (signal) => await awaitAbortable(controller.openArchive(signal), signal),
    listenToFirstSavedMoment: async (signal) => await awaitAbortable(controller.listenToFirstSavedMoment(signal), signal),
    waitForReplay: async (state, signal) => await awaitAbortable(controller.waitForReplay(state, signal), signal),
    injectStorageWriteFailure: async (signal) => await awaitAbortable(controller.injectStorageWriteFailure(signal), signal),
  };
}
