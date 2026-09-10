import { hashFramedDomain, type ContentHash } from "@projector/core";
import { describe, expect, it } from "vitest";

import {
  createPsychordApplicationObserver,
  type PsychordBrowserController,
  type PsychordObservationPlan,
  type PsychordPreparedAttempt,
  type PsychordUiSnapshot,
} from "./psychord.js";

const hash = (value: string): ContentHash => hashFramedDomain("psychord-observation-test", value);

const plan = (caseName: PsychordObservationPlan["case"]): PsychordObservationPlan => ({
  runId: `run:${caseName}`,
  case: caseName,
  scenario: { id: "scenario:keep-reload-replay-owned-moment", semanticHash: hash("scenario") },
  repository: { root: "C:/work/psychord", gitHead: "abc123", worktreeDigest: hash("worktree") },
  dependencies: [
    { role: "source", locator: "src/ui/App.tsx", contentHash: hash("app") },
    { role: "lockfile", locator: "pnpm-lock.yaml", contentHash: hash("lockfile") },
    { role: "build-config", locator: "vite.config.ts", contentHash: hash("build-config") },
    { role: "controller", locator: "controller.mjs", contentHash: hash("controller") },
    { role: "helper", locator: "helpers/browser.mjs", contentHash: hash("helper") },
    { role: "fixture", locator: "fixtures/save-failure.mjs", contentHash: hash("fixture") },
    { role: "toolchain", locator: "node:24.19.0", contentHash: hash("toolchain") },
  ],
  ownedArtifactRoot: "C:/work/psychord/.projector/runtime/application-evidence/run",
  server: {
    expectedOrigin: "http://127.0.0.1:43123",
    readinessNonce: "nonce:one",
    readinessPath: "/.projector-ready",
    applicationPath: "/",
    expectedBuildArtifacts: [{ role: "application-script", buildLocator: "dist/assets/app.js", requestPath: "/assets/app.js", contentHash: hash("app-js") }],
  },
  limits: { timeoutMs: 5_000, cleanupTimeoutMs: 100, maximumOutputBytes: 65_536, maximumDiagnosticBytes: 4_096 },
});

class ScriptedController implements PsychordBrowserController {
  readonly #snapshots: PsychordUiSnapshot[];
  readonly actions: string[] = [];
  constructor(...snapshots: PsychordUiSnapshot[]) { this.#snapshots = snapshots; }
  async snapshot(): Promise<PsychordUiSnapshot> {
    const next = this.#snapshots.shift();
    if (next === undefined) throw new Error("unexpected snapshot");
    return next;
  }
  async enableSoundWithGesture(): Promise<void> { this.actions.push("enable-sound"); }
  async playKeyboardNote(input: { readonly code: "KeyA"; readonly holdMs: number }): Promise<void> { this.actions.push(`play:${input.code}:${input.holdMs}`); }
  async keepMoment(): Promise<void> { this.actions.push("keep"); }
  async reload(): Promise<void> { this.actions.push("reload"); }
  async openArchive(): Promise<void> { this.actions.push("open-archive"); }
  async listenToFirstSavedMoment(): Promise<void> { this.actions.push("listen-saved"); }
  async waitForReplay(state: "active" | "idle"): Promise<void> { this.actions.push(`wait-replay:${state}`); }
  async injectStorageWriteFailure(): Promise<void> { this.actions.push("inject-save-failure"); }
}

const preparedAttempt = (controller: PsychordBrowserController, runId = "run:no-input"): PsychordPreparedAttempt => ({
  runId,
  actualOrigin: "http://127.0.0.1:43123",
  readiness: { url: "http://127.0.0.1:43123/.projector-ready", status: 200, nonce: "nonce:one" },
  buildArtifacts: [{ role: "application-script", locator: "dist/assets/app.js", contentHash: hash("app-js") }],
  servedArtifacts: [{ role: "application-script", locator: "http://127.0.0.1:43123/assets/app.js", contentHash: hash("app-js") }],
  browserContext: { id: "browser:one", freshStorage: true },
  ownedResources: [
    { kind: "server-process", handle: "pid:101", runId },
    { kind: "browser-context", handle: "browser:one", runId },
  ],
  controller,
  async observeCurrentness() {
    return {
      status: "current" as const,
      observedWorktreeDigest: hash("worktree"),
      dependencies: [
        { role: "source" as const, locator: "src/ui/App.tsx", expectedHash: hash("app"), observedHash: hash("app"), status: "current" as const },
        { role: "lockfile" as const, locator: "pnpm-lock.yaml", expectedHash: hash("lockfile"), observedHash: hash("lockfile"), status: "current" as const },
        { role: "build-config" as const, locator: "vite.config.ts", expectedHash: hash("build-config"), observedHash: hash("build-config"), status: "current" as const },
        { role: "controller" as const, locator: "controller.mjs", expectedHash: hash("controller"), observedHash: hash("controller"), status: "current" as const },
        { role: "helper" as const, locator: "helpers/browser.mjs", expectedHash: hash("helper"), observedHash: hash("helper"), status: "current" as const },
        { role: "fixture" as const, locator: "fixtures/save-failure.mjs", expectedHash: hash("fixture"), observedHash: hash("fixture"), status: "current" as const },
        { role: "toolchain" as const, locator: "node:24.19.0", expectedHash: hash("toolchain"), observedHash: hash("toolchain"), status: "current" as const },
      ],
    };
  },
  async collectDiagnostics() { return []; },
  async cleanup() {
    return {
      complete: true,
      resources: [
        { kind: "server-process" as const, handle: "pid:101", outcome: "released" as const },
        { kind: "browser-context" as const, handle: "browser:one", outcome: "released" as const },
      ],
      diagnostics: [],
    };
  },
});

const observe = (caseName: PsychordObservationPlan["case"], attempt: PsychordPreparedAttempt) => createPsychordApplicationObserver({
  async prepare() { return { status: "prepared", attempt }; },
}).observeApplication(plan(caseName), { signal: new AbortController().signal });

describe("Psychord application observation", () => {
  it("refuses an invalid plan before allocating host resources", async () => {
    let prepared = false;
    const invalidPlan = { ...plan("no-input"), limits: { ...plan("no-input").limits, maximumOutputBytes: 0 } };
    const observer = createPsychordApplicationObserver({
      async prepare() {
        prepared = true;
        throw new Error("host must not be called");
      },
    });

    const result = await observer.observeApplication(invalidPlan, { signal: new AbortController().signal });

    expect(prepared).toBe(false);
    expect(result).toMatchObject({
      operationalStatus: "failed",
      outcome: "unavailable",
      cleanup: { complete: true, resources: [] },
      diagnostics: ["application observation plan is invalid"],
    });
  });

  it("accepts a fresh no-input state only when persistence and player controls are empty", async () => {
    const controller = new ScriptedController({
      sound: "disabled",
      controls: { listen: false, keep: false, clear: false },
      archiveCount: 0,
      replay: "idle",
      playerNoteCount: 0,
      activeVoiceCount: 0,
      playerEvents: [],
    });

    const result = await observe("no-input", preparedAttempt(controller));

    expect(result).toMatchObject({
      operationalStatus: "completed",
      outcome: "passed",
      currentness: "current",
      cleanup: { complete: true },
    });
    expect(result.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it("keeps a real keyboard trace, reloads, and observes replay without new player evidence", async () => {
    const stored = {
      rawContentHash: hash("saved-moment"),
      rawByteLength: 1_458,
      momentCount: 1,
      noteEvents: [
        { type: "note-on" as const, eventId: "event:1", atMs: 0, sourceId: "keyboard", sourceSequence: 1, sourceTimestampMs: 100, pitch: 60, midiChannel: 0, disposition: "player" as const, velocity: 0.72 },
        { type: "note-off" as const, eventId: "event:2", atMs: 120, sourceId: "keyboard", sourceSequence: 2, sourceTimestampMs: 220, pitch: 60, midiChannel: 0, disposition: "player" as const, releaseVelocity: 0 },
      ],
    };
    const empty = { sound: "disabled" as const, controls: { listen: false, keep: false, clear: false }, archiveCount: 0, replay: "idle" as const, playerNoteCount: 0, activeVoiceCount: 0, playerEvents: [] };
    const controller = new ScriptedController(
      empty,
      { ...empty, sound: "running", controls: { listen: true, keep: true, clear: true }, playerNoteCount: 1, playerEvents: stored.noteEvents },
      { ...empty, sound: "running", controls: { listen: true, keep: true, clear: true }, archiveCount: 1, playerNoteCount: 1, playerEvents: stored.noteEvents, storage: stored, notice: "Moment kept on this device." },
      { ...empty, archiveCount: 1, storage: stored },
      { ...empty, sound: "running", archiveCount: 1, replay: "active", storage: stored },
      { ...empty, sound: "running", archiveCount: 1, storage: stored },
    );
    const attempt = preparedAttempt(controller, "run:keep-reload-replay");

    const result = await observe("keep-reload-replay", attempt);

    expect(result).toMatchObject({ operationalStatus: "completed", outcome: "passed", currentness: "current" });
    expect(controller.actions).toEqual([
      "enable-sound",
      "play:KeyA:120",
      "keep",
      "reload",
      "enable-sound",
      "open-archive",
      "listen-saved",
      "wait-replay:active",
      "wait-replay:idle",
    ]);
    expect(result.observations.replayActive).toMatchObject({ replay: "active", playerNoteCount: 0 });
    expect(result.observations.postReplay?.storage?.rawContentHash).toBe(stored.rawContentHash);
    expect(result.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it("reports a rejected save and preserves the previously stored moment byte for byte", async () => {
    const stored = {
      rawContentHash: hash("existing-moment"),
      rawByteLength: 1_371,
      momentCount: 1,
      noteEvents: [
        { type: "note-on" as const, eventId: "event:1", atMs: 0, sourceId: "keyboard", sourceSequence: 1, sourceTimestampMs: 100, pitch: 60, midiChannel: 0, disposition: "player" as const, velocity: 0.72 },
        { type: "note-off" as const, eventId: "event:2", atMs: 120, sourceId: "keyboard", sourceSequence: 2, sourceTimestampMs: 220, pitch: 60, midiChannel: 0, disposition: "player" as const, releaseVelocity: 0 },
      ],
    };
    const empty = { sound: "disabled" as const, controls: { listen: false, keep: false, clear: false }, archiveCount: 0, replay: "idle" as const, playerNoteCount: 0, activeVoiceCount: 0, playerEvents: [] };
    const input = { ...empty, sound: "running" as const, controls: { listen: true, keep: true, clear: true }, playerNoteCount: 1, playerEvents: stored.noteEvents };
    const controller = new ScriptedController(
      empty,
      input,
      { ...input, archiveCount: 1, storage: stored, notice: "Moment kept on this device." },
      { ...empty, archiveCount: 1, storage: stored },
      { ...input, archiveCount: 1, storage: stored },
      { ...input, archiveCount: 1, storage: stored, notice: "Could not keep this moment. Local storage may be full or unavailable." },
    );
    const attempt = preparedAttempt(controller, "run:save-failure");

    const result = await observe("save-failure", attempt);

    expect(result).toMatchObject({ operationalStatus: "completed", outcome: "passed", currentness: "current" });
    expect(controller.actions).toEqual([
      "enable-sound", "play:KeyA:120", "keep", "reload", "enable-sound", "play:KeyA:120", "inject-save-failure", "keep",
    ]);
    expect(result.observations.afterFailedSave).toMatchObject({
      archiveCount: 1,
      notice: "Could not keep this moment. Local storage may be full or unavailable.",
      storage: { rawContentHash: stored.rawContentHash, rawByteLength: stored.rawByteLength, momentCount: 1 },
    });
    expect(result.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it("blocks browser collection when the owned server endpoint differs from the plan", async () => {
    const controller = new ScriptedController();
    const result = await observe("no-input", {
      ...preparedAttempt(controller),
      actualOrigin: "http://127.0.0.1:43124",
    });

    expect(result).toMatchObject({
      operationalStatus: "completed",
      outcome: "unavailable",
      currentness: "current",
      cleanup: { complete: true },
    });
    expect(result.assertions).toContainEqual({
      id: "endpoint-binding",
      passed: false,
      detail: "actual server origin must equal the allocated plan origin",
    });
    expect(result.observations).toEqual({});
  });

  it("blocks collection when a controller helper is absent from the pinned dependency profile", async () => {
    const controller = new ScriptedController();
    const missingHelper = {
      ...plan("no-input"),
      dependencies: plan("no-input").dependencies.filter(({ role }) => role !== "helper"),
    };
    const result = await createPsychordApplicationObserver({
      async prepare() { return { status: "prepared", attempt: preparedAttempt(controller) }; },
    }).observeApplication(missingHelper, { signal: new AbortController().signal });

    expect(result.outcome).toBe("unavailable");
    expect(result.diagnostics).toEqual(["application observation plan is invalid"]);
    expect(result.observations).toEqual({});
  });

  it("does not admit passing behavior when live dependencies are stale", async () => {
    const controller = new ScriptedController({
      sound: "disabled",
      controls: { listen: false, keep: false, clear: false },
      archiveCount: 0,
      replay: "idle",
      playerNoteCount: 0,
      activeVoiceCount: 0,
      playerEvents: [],
    });
    const baseAttempt = preparedAttempt(controller);
    const attempt: PsychordPreparedAttempt = {
      ...baseAttempt,
      async observeCurrentness(signal) {
        return { ...await baseAttempt.observeCurrentness(signal), status: "stale" as const, observedWorktreeDigest: hash("changed-worktree") };
      },
    };

    const result = await observe("no-input", attempt);

    expect(result).toMatchObject({
      operationalStatus: "completed",
      outcome: "unavailable",
      currentness: "stale",
      cleanup: { complete: true },
    });
    expect(result.assertions.every(({ passed }) => passed)).toBe(true);
  });

  it("rejects a currentness claim whose dependency bytes differ from the plan", async () => {
    const controller = new ScriptedController({
      sound: "disabled",
      controls: { listen: false, keep: false, clear: false },
      archiveCount: 0,
      replay: "idle",
      playerNoteCount: 0,
      activeVoiceCount: 0,
      playerEvents: [],
    });
    const baseAttempt = preparedAttempt(controller);
    const attempt: PsychordPreparedAttempt = {
      ...baseAttempt,
      async observeCurrentness(signal) {
        const observation = await baseAttempt.observeCurrentness(signal);
        return {
          ...observation,
          dependencies: observation.dependencies.map((dependency) => dependency.role === "source"
            ? { ...dependency, observedHash: hash("changed-source"), status: "stale" as const }
            : dependency),
        };
      },
    };

    const result = await observe("no-input", attempt);

    expect(result).toMatchObject({ outcome: "unavailable", currentness: "unknown" });
    expect(result.assertions).toContainEqual({
      id: "currentness-binding",
      passed: false,
      detail: "currentness details must authenticate every plan-bound dependency and the live worktree digest",
    });
  });

  it("keeps a passing behavior outcome distinct when owned cleanup fails", async () => {
    const controller = new ScriptedController({
      sound: "disabled",
      controls: { listen: false, keep: false, clear: false },
      archiveCount: 0,
      replay: "idle",
      playerNoteCount: 0,
      activeVoiceCount: 0,
      playerEvents: [],
    });
    const attempt: PsychordPreparedAttempt = {
      ...preparedAttempt(controller),
      async cleanup() {
        return {
          complete: false,
          resources: [
            { kind: "server-process" as const, handle: "pid:101", outcome: "failed" as const },
            { kind: "browser-context" as const, handle: "browser:one", outcome: "released" as const },
          ],
          diagnostics: ["owned server process still present"],
        };
      },
    };

    const result = await observe("no-input", attempt);

    expect(result).toMatchObject({
      operationalStatus: "failed",
      outcome: "passed",
      currentness: "current",
      cleanup: { complete: false },
    });
    expect(result.assertions.every(({ passed }) => passed)).toBe(true);
    expect(result.diagnostics).toContain("owned server process still present");
  });

  it("returns bounded cancellation when host preparation ignores the abort signal", async () => {
    const boundedPlan = { ...plan("no-input"), limits: { timeoutMs: 10, cleanupTimeoutMs: 10, maximumOutputBytes: 65_536, maximumDiagnosticBytes: 4_096 } };
    const observer = createPsychordApplicationObserver({
      async prepare() { return await new Promise<never>(() => undefined); },
    });

    const winner = await Promise.race([
      observer.observeApplication(boundedPlan, { signal: new AbortController().signal }),
      new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 100)),
    ]);

    expect(winner).not.toBe("hung");
    expect(winner).toMatchObject({
      operationalStatus: "cancelled",
      outcome: "unavailable",
      currentness: "unknown",
      cleanup: { complete: false },
      recovery: { code: "application-observation-preparation-unknown" },
    });
  });

  it("cancels an uncooperative controller step and still cleans the prepared resources", async () => {
    let cleaned = false;
    const controller = new ScriptedController();
    controller.snapshot = async () => await new Promise<never>(() => undefined);
    const attempt: PsychordPreparedAttempt = {
      ...preparedAttempt(controller),
      async cleanup() {
        cleaned = true;
        return preparedAttempt(controller).cleanup(new AbortController().signal);
      },
    };
    const boundedPlan = { ...plan("no-input"), limits: { timeoutMs: 10, cleanupTimeoutMs: 10, maximumOutputBytes: 65_536, maximumDiagnosticBytes: 4_096 } };
    const observer = createPsychordApplicationObserver({
      async prepare() { return { status: "prepared", attempt }; },
    });

    const winner = await Promise.race([
      observer.observeApplication(boundedPlan, { signal: new AbortController().signal }),
      new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 100)),
    ]);

    expect(winner).not.toBe("hung");
    expect(winner).toMatchObject({ operationalStatus: "cancelled", outcome: "unavailable", cleanup: { complete: true } });
    expect(cleaned).toBe(true);
  });

  it("bounds uncooperative cleanup and returns an owned-resource recovery action", async () => {
    const controller = new ScriptedController({
      sound: "disabled",
      controls: { listen: false, keep: false, clear: false },
      archiveCount: 0,
      replay: "idle",
      playerNoteCount: 0,
      activeVoiceCount: 0,
      playerEvents: [],
    });
    const attempt: PsychordPreparedAttempt = {
      ...preparedAttempt(controller),
      async cleanup() { return await new Promise<never>(() => undefined); },
    };
    const boundedPlan = { ...plan("no-input"), limits: { timeoutMs: 1_000, cleanupTimeoutMs: 10, maximumOutputBytes: 65_536, maximumDiagnosticBytes: 4_096 } };
    const observer = createPsychordApplicationObserver({ async prepare() { return { status: "prepared", attempt }; } });

    const winner = await Promise.race([
      observer.observeApplication(boundedPlan, { signal: new AbortController().signal }),
      new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 100)),
    ]);

    expect(winner).not.toBe("hung");
    expect(winner).toMatchObject({
      operationalStatus: "failed",
      outcome: "passed",
      cleanup: { complete: false },
      recovery: { code: "application-observation-cleanup-unproved" },
    });
  });
});
