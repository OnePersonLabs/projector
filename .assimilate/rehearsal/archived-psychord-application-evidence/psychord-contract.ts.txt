import {
  ContentHashSchema,
  canonicalJson,
  createApplicationObservationContractSchemas,
  hashApplicationObservationInput,
  hashApplicationObservationOutput,
  type ApplicationObservationResult,
} from "@projector/core";
import { z } from "zod";

import {
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
  type PsychordApplicationObserver,
  type PsychordObservationPlan,
} from "./psychord.js";

const text = z.string().min(1).max(4_096);
const identity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const nonnegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();
const observationCase = z.enum(["no-input", "keep-reload-replay", "save-failure"]);

const artifactIdentity = z.strictObject({ role: identity, locator: text, contentHash: ContentHashSchema });
const ownedResource = z.strictObject({
  kind: z.enum(["server-process", "browser-context", "controller-process", "artifact-attempt"]),
  handle: identity,
  runId: identity,
});
const browserCommand = z.strictObject({
  argvHash: ContentHashSchema,
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  durationMs: z.number().nonnegative().finite(),
  rootExitObserved: z.literal(true),
  stdio: z.enum(["closed", "detached-after-bounded-drain"]),
  descendantState: z.literal("not-observed"),
});
const traceEventBase = {
  eventId: identity,
  ingestSequence: nonnegativeInteger,
  atMs: z.number().nonnegative().finite(),
  sourceId: identity,
  sourceSequence: nonnegativeInteger,
  sourceTimestamp: z.strictObject({ value: z.number().finite(), clock: z.enum(["device", "host-monotonic", "unknown"]) }).nullable(),
  pitch: z.number().int().min(0).max(127),
  midiChannel: z.number().int().min(0).max(15),
  disposition: z.literal("accepted"),
};
const traceEvent = z.discriminatedUnion("type", [
  z.strictObject({ ...traceEventBase, type: z.literal("note-on"), velocity: z.number().min(0).max(1) }),
  z.strictObject({ ...traceEventBase, type: z.literal("note-off"), releaseVelocity: z.number().min(0).max(1) }),
]);
const storedTrace = z.strictObject({
  rawContentHash: ContentHashSchema,
  rawByteLength: nonnegativeInteger,
  momentCount: nonnegativeInteger,
  noteEvents: z.array(traceEvent).max(10_000),
});
const uiSnapshot = z.strictObject({
  sound: z.enum(["disabled", "running", "error"]),
  controls: z.strictObject({ listen: z.boolean(), keep: z.boolean(), clear: z.boolean() }),
  archiveCount: nonnegativeInteger,
  replay: z.enum(["idle", "active"]),
  playerNoteCount: nonnegativeInteger,
  activeVoiceCount: nonnegativeInteger,
  playerEvents: z.array(traceEvent).max(10_000),
  notice: z.string().max(4_096).optional(),
  storage: storedTrace.optional(),
});

export const PsychordObservationAdapterInputSchema = z.strictObject({
  repository: z.strictObject({ root: text, gitHead: z.string().regex(/^[a-f0-9]{40}$/u), worktreeDigest: ContentHashSchema }),
  dependencies: z.array(z.strictObject({
    role: z.enum(["source", "lockfile", "build-config", "controller", "helper", "fixture", "toolchain"]),
    locator: text,
    contentHash: ContentHashSchema,
  })).min(1).max(256),
  ownedArtifactRoot: text,
  representativeInput: z.strictObject({ code: z.literal("KeyA"), holdMs: positiveInteger }),
  server: z.strictObject({
    expectedOrigin: text,
    readinessNonce: identity,
    readinessPath: text,
    applicationPath: text,
    expectedBuildArtifacts: z.array(z.strictObject({
      role: identity,
      buildLocator: text,
      requestPath: text,
      contentHash: ContentHashSchema,
    })).min(1).max(256),
  }),
  limits: z.strictObject({
    timeoutMs: positiveInteger,
    cleanupTimeoutMs: positiveInteger,
    maximumOutputBytes: positiveInteger,
    maximumDiagnosticBytes: positiveInteger,
  }),
});

export const PsychordObservationAdapterOutputSchema = z.strictObject({
  host: z.strictObject({
    expectedOrigin: text,
    actualOrigin: text.optional(),
    readiness: z.strictObject({ url: text, status: z.number().int().min(100).max(599), nonce: identity }).optional(),
    browserContextId: identity.optional(),
    buildArtifacts: z.array(artifactIdentity).max(256),
    servedArtifacts: z.array(artifactIdentity).max(256),
    ownedResources: z.array(ownedResource).max(256),
    browserCommands: z.array(browserCommand).max(1_024),
  }),
  currentnessObservation: z.strictObject({
    status: z.enum(["current", "stale", "unknown"]),
    observedWorktreeDigest: ContentHashSchema.optional(),
    dependencies: z.array(z.strictObject({
      role: z.enum(["source", "lockfile", "build-config", "controller", "helper", "fixture", "toolchain"]),
      locator: text,
      expectedHash: ContentHashSchema,
      observedHash: ContentHashSchema.optional(),
      status: z.enum(["current", "stale", "unavailable"]),
    })).max(256),
  }).optional(),
  assertions: z.array(z.strictObject({ id: identity, passed: z.boolean(), detail: text })).max(256),
  observations: z.strictObject({
    precondition: uiSnapshot.optional(),
    postInput: uiSnapshot.optional(),
    postSave: uiSnapshot.optional(),
    postReload: uiSnapshot.optional(),
    replayActive: uiSnapshot.optional(),
    postReplay: uiSnapshot.optional(),
    beforeFailedSave: uiSnapshot.optional(),
    afterFailedSave: uiSnapshot.optional(),
  }),
  limitations: z.array(text).min(1).max(32),
});

const baseSchemas = createApplicationObservationContractSchemas({
  adapterId: psychordObservationAdapterId,
  adapterVersion: psychordObservationAdapterVersion,
  adapterInputSchema: PsychordObservationAdapterInputSchema,
  adapterOutputSchema: PsychordObservationAdapterOutputSchema,
});

export const PsychordApplicationObservationPlanSchema = baseSchemas.ApplicationObservationPlanSchema.superRefine((plan, context) => {
  if (!observationCase.safeParse(plan.case).success) context.addIssue({ code: "custom", path: ["case"], message: "unsupported Psychord observation case" });
});
export const PsychordApplicationObservationResultSchema = baseSchemas.ApplicationObservationResultSchema.superRefine((result, context) => {
  if (!observationCase.safeParse(result.case).success) context.addIssue({ code: "custom", path: ["case"], message: "unsupported Psychord observation case" });
  if (result.outcome === "passed") {
    const output = result.adapter.output;
    if (output.assertions.length === 0 || output.assertions.some(({ passed }) => !passed)) {
      context.addIssue({ code: "custom", path: ["adapter", "output", "assertions"], message: "passed Psychord evidence requires nonempty passing assertions" });
    }
    if (output.currentnessObservation?.status !== "current") {
      context.addIssue({ code: "custom", path: ["adapter", "output", "currentnessObservation"], message: "passed Psychord evidence requires detailed current input observations" });
    }
    if (output.host.actualOrigin === undefined || output.host.readiness === undefined || output.host.browserContextId === undefined
      || output.host.buildArtifacts.length === 0 || output.host.servedArtifacts.length === 0 || output.host.ownedResources.length === 0
      || output.host.browserCommands.length === 0) {
      context.addIssue({ code: "custom", path: ["adapter", "output", "host"], message: "passed Psychord evidence requires complete host, build, browser, and resource observations" });
    }
  }
});
export const PsychordApplicationObservationExchangeSchema = baseSchemas.ApplicationObservationExchangeSchema.superRefine(({ plan, result }, context) => {
  const strictResult = PsychordApplicationObservationResultSchema.safeParse(result);
  if (!strictResult.success) for (const issue of strictResult.error.issues) {
    context.addIssue({ code: "custom", path: ["result", ...issue.path], message: issue.message });
  }
  const output = result.adapter.output;
  if (output.host.expectedOrigin !== plan.adapter.input.server.expectedOrigin) {
    context.addIssue({ code: "custom", path: ["result", "adapter", "output", "host", "expectedOrigin"], message: "Psychord host origin does not match the exact adapter input" });
  }
  if (output.host.ownedResources.some(({ runId }) => runId !== plan.runId)) {
    context.addIssue({ code: "custom", path: ["result", "adapter", "output", "host", "ownedResources"], message: "Psychord owned resource does not match the exact run" });
  }
  if (result.outcome === "passed") {
    const observed = output.currentnessObservation;
    const expectedDependencies = plan.adapter.input.dependencies.map(({ role, locator, contentHash }) => ({
      role, locator, expectedHash: contentHash, observedHash: contentHash, status: "current" as const,
    }));
    if (observed?.observedWorktreeDigest !== plan.adapter.input.repository.worktreeDigest
      || canonicalJson(observed.dependencies) !== canonicalJson(expectedDependencies)) {
      context.addIssue({ code: "custom", path: ["result", "adapter", "output", "currentnessObservation"], message: "passed Psychord currentness details do not authenticate every plan-bound dependency and worktree byte state" });
    }
    const expectedBuild = plan.adapter.input.server.expectedBuildArtifacts.map(({ role, buildLocator, contentHash }) => ({ role, locator: buildLocator, contentHash }));
    if (canonicalJson(output.host.buildArtifacts) !== canonicalJson(expectedBuild)) {
      context.addIssue({ code: "custom", path: ["result", "adapter", "output", "host", "buildArtifacts"], message: "passed Psychord build observations do not authenticate the planned build bytes" });
    }
    const expectedServed = plan.adapter.input.server.expectedBuildArtifacts.map(({ role, requestPath, contentHash }) => ({
      role,
      locator: new URL(requestPath, plan.adapter.input.server.expectedOrigin).toString(),
      contentHash,
    }));
    const readinessUrl = new URL(plan.adapter.input.server.readinessPath, plan.adapter.input.server.expectedOrigin).toString();
    if (output.host.actualOrigin !== plan.adapter.input.server.expectedOrigin
      || output.host.readiness?.url !== readinessUrl || output.host.readiness.status !== 200
      || output.host.readiness.nonce !== plan.adapter.input.server.readinessNonce
      || canonicalJson(output.host.servedArtifacts) !== canonicalJson(expectedServed)) {
      context.addIssue({ code: "custom", path: ["result", "adapter", "output", "host"], message: "passed Psychord endpoint, readiness, and served-byte observations do not authenticate the exact plan" });
    }
    const cleanupResources = result.cleanup.resources.map(({ kind, handle, outcome }) => ({ kind, handle, outcome })).sort(resourceOrder);
    const expectedCleanup = output.host.ownedResources.map(({ kind, handle }) => ({ kind, handle, outcome: "released" as const })).sort(resourceOrder);
    if (canonicalJson(cleanupResources) !== canonicalJson(expectedCleanup)) {
      context.addIssue({ code: "custom", path: ["result", "cleanup", "resources"], message: "passed Psychord cleanup does not release every exact owned resource" });
    }
    const requiredAssertions = requiredAssertionIds(plan.case);
    const assertionIds = new Set(output.assertions.filter(({ passed }) => passed).map(({ id }) => id));
    const observationsComplete = requiredObservationKeys(plan.case).every((key) => output.observations[key] !== undefined);
    if (!requiredAssertions.every((id) => assertionIds.has(id)) || !observationsComplete) {
      context.addIssue({ code: "custom", path: ["result", "adapter", "output"], message: "passed Psychord evidence omits required case assertions or observations" });
    }
  }
});
export type PsychordApplicationObservationPlan = z.infer<typeof PsychordApplicationObservationPlanSchema>;
export type PsychordApplicationObservationResult = z.infer<typeof PsychordApplicationObservationResultSchema>;

export interface StrictPsychordApplicationObserver {
  observeApplication(plan: PsychordApplicationObservationPlan, environment: { readonly signal: AbortSignal }): Promise<PsychordApplicationObservationResult>;
}

export function createStrictPsychordApplicationObserver(observer: PsychordApplicationObserver): StrictPsychordApplicationObserver {
  return {
    async observeApplication(unparsedPlan, environment) {
      const plan = PsychordApplicationObservationPlanSchema.parse(unparsedPlan);
      const caseName = observationCase.parse(plan.case);
      const legacyPlan: PsychordObservationPlan = {
        runId: plan.runId,
        case: caseName,
        scenario: plan.scenario,
        ...plan.adapter.input,
      };
      const legacy = await observer.observeApplication(legacyPlan, environment);
      const output = PsychordObservationAdapterOutputSchema.parse({
        host: legacy.host,
        ...(legacy.currentnessObservation === undefined ? {} : { currentnessObservation: legacy.currentnessObservation }),
        assertions: legacy.assertions,
        observations: legacy.observations,
        limitations: legacy.limitations,
      });
      const result: ApplicationObservationResult<typeof output, typeof psychordObservationAdapterId, typeof psychordObservationAdapterVersion> = {
        schemaVersion: "application-observation-result@1",
        runId: legacy.runId,
        scenario: legacy.scenario,
        case: legacy.case,
        adapter: {
          id: psychordObservationAdapterId,
          version: psychordObservationAdapterVersion,
          inputHash: plan.adapter.inputHash,
          outputHash: hashApplicationObservationOutput(psychordObservationAdapterId, psychordObservationAdapterVersion, output),
          output,
        },
        operationalStatus: legacy.operationalStatus,
        outcome: legacy.outcome,
        currentness: legacy.currentness,
        assurance: legacy.assurance,
        diagnostics: structuredDiagnostics("psychord-observation", legacy.diagnostics),
        cleanup: {
          complete: legacy.cleanup.complete,
          resources: legacy.cleanup.resources.map((resource) => ({
            kind: resource.kind,
            handle: resource.handle,
            outcome: resource.outcome === "failed" ? "release-failed" as const : resource.outcome,
          })),
          diagnostics: structuredDiagnostics("psychord-cleanup", legacy.cleanup.diagnostics),
        },
        ...(legacy.recovery === undefined ? {} : {
          recovery: {
            code: legacy.recovery.code,
            message: "One or more Psychord observation resources were not proved released.",
            action: legacy.recovery.action,
            artifactRefs: legacy.cleanup.resources.filter(({ outcome }) => outcome === "failed").map(({ handle }) => handle),
          },
        }),
      };
      return PsychordApplicationObservationExchangeSchema.parse({ plan, result }).result;
    },
  };
}

export function createPsychordApplicationObservationPlan(plan: PsychordObservationPlan): PsychordApplicationObservationPlan {
  const { runId, scenario, case: caseName, ...adapterInput } = plan;
  const input = PsychordObservationAdapterInputSchema.parse(adapterInput);
  return PsychordApplicationObservationPlanSchema.parse({
    schemaVersion: "application-observation-plan@1",
    runId,
    scenario,
    case: caseName,
    adapter: {
      id: psychordObservationAdapterId,
      version: psychordObservationAdapterVersion,
      inputHash: hashApplicationObservationInput(psychordObservationAdapterId, psychordObservationAdapterVersion, input),
      input,
    },
  });
}

function structuredDiagnostics(prefix: string, values: readonly string[]): readonly { code: string; message: string }[] {
  return values.flatMap((value, valueIndex) => {
    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += 4_096) chunks.push(value.slice(offset, offset + 4_096));
    if (chunks.length === 0) chunks.push("No diagnostic detail was supplied.");
    return chunks.map((message, chunkIndex) => ({ code: `${prefix}-${valueIndex + 1}-${chunkIndex + 1}`, message }));
  }).slice(0, 64);
}

const commonAssertionIds = [
  "run-binding", "endpoint-binding", "readiness-binding", "build-binding", "served-byte-binding", "fresh-browser-storage",
  "owned-resource-binding", "pinned-dependency-profile", "bounded-loopback-plan", "currentness-binding",
] as const;
function requiredAssertionIds(caseName: string): readonly string[] {
  if (caseName === "no-input") return [...commonAssertionIds, "no-input-controls", "no-input-player", "no-input-persistence"];
  if (caseName === "keep-reload-replay") return [...commonAssertionIds, "fresh-precondition", "representative-keyboard-input", "input-enables-explicit-save", "explicit-save", "saved-trace-provenance", "reload-restores-archive", "reload-clears-live-player", "explicit-replay-transition", "replay-is-not-player-input", "replay-preserves-persisted-provenance", "replay-completes-without-player-evidence"];
  return [...commonAssertionIds, "fresh-precondition", "representative-keyboard-input", "failure-control-seed", "failure-control-reload", "failure-control-input", "save-failure-visible", "save-failure-preserves-archive"];
}
function requiredObservationKeys(caseName: string): readonly (keyof z.infer<typeof PsychordObservationAdapterOutputSchema>["observations"])[] {
  if (caseName === "no-input") return ["precondition"];
  if (caseName === "keep-reload-replay") return ["precondition", "postInput", "postSave", "postReload", "replayActive", "postReplay"];
  return ["precondition", "postInput", "postSave", "postReload", "beforeFailedSave", "afterFailedSave"];
}
function resourceOrder(left: { kind: string; handle: string }, right: { kind: string; handle: string }): number {
  const leftKey = `${left.kind}\0${left.handle}`;
  const rightKey = `${right.kind}\0${right.handle}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
