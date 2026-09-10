import { ContentHashSchema, canonicalJson } from "@projector/core";
import {
  PsychordApplicationObservationResultSchema,
  PsychordEvidenceCurrentnessSchema,
  psychordObservationAdapterId,
  psychordObservationAdapterVersion,
  type PsychordApplicationObservationPlan,
  type PsychordArtifactSetReadResult,
  type PsychordEvidenceCurrentness,
  type PsychordObservationArtifactService,
} from "@projector/integrations/runtime-evidence";
import { z } from "zod";

const identity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const reason = z.string().min(1).max(4_096);
const observationReference = z.strictObject({
  role: z.enum(["prior", "latest"]),
  runId: identity,
  artifactSetId: identity,
});

export const PsychordApplicationEvidenceAssessmentRequestSchema = z.strictObject({
  schemaVersion: z.literal("psychord-application-evidence-assessment-request@1"),
  requirementId: identity,
  scenario: z.strictObject({ id: identity, semanticHash: ContentHashSchema }),
  case: z.enum(["no-input", "keep-reload-replay", "save-failure"]),
  predicate: z.strictObject({ id: identity, assertionIds: z.array(identity).min(1).max(64) }).superRefine((value, context) => {
    if (new Set(value.assertionIds).size !== value.assertionIds.length) context.addIssue({ code: "custom", path: ["assertionIds"], message: "predicate assertion IDs must be unique" });
  }),
  observations: z.array(observationReference).min(1).max(64),
}).superRefine((value, context) => {
  if (new Set(value.observations.map(({ artifactSetId }) => artifactSetId)).size !== value.observations.length) {
    context.addIssue({ code: "custom", path: ["observations"], message: "observation artifact references must be unique" });
  }
  if (value.observations.filter(({ role }) => role === "latest").length > 1) {
    context.addIssue({ code: "custom", path: ["observations"], message: "at most one observation may be declared latest" });
  }
});
export type PsychordApplicationEvidenceAssessmentRequest = z.infer<typeof PsychordApplicationEvidenceAssessmentRequestSchema>;

const assessedObservation = z.strictObject({
  reference: observationReference,
  predicate: z.strictObject({ id: identity, assertions: z.array(z.strictObject({ id: identity, status: z.enum(["passed", "failed", "unavailable"]) })).min(1).max(64) }),
  publicationStatus: z.enum(["published", "incomplete", "missing", "integrity-failed"]),
  historical: z.strictObject({
    operationalStatus: PsychordApplicationObservationResultSchema.shape.operationalStatus,
    outcome: PsychordApplicationObservationResultSchema.shape.outcome,
    collectedCurrentness: PsychordApplicationObservationResultSchema.shape.currentness,
    assurance: z.literal("supporting"),
    cleanupComplete: z.boolean(),
    behavioralEvidence: z.boolean(),
  }).optional(),
  reuseCurrentness: PsychordEvidenceCurrentnessSchema.optional(),
  reuseBinding: z.enum(["matched", "mismatched"]).optional(),
  eligibility: z.enum(["eligible", "violated", "open"]),
  reason,
}).superRefine((value, context) => {
  if ((value.publicationStatus === "published") !== (value.historical !== undefined)) {
    context.addIssue({ code: "custom", path: ["historical"], message: "historical outcome must exist exactly for a published observation" });
  }
  if (value.publicationStatus !== "published" && value.reuseCurrentness !== undefined) {
    context.addIssue({ code: "custom", path: ["reuseCurrentness"], message: "unpublished observations cannot carry reuse currentness" });
  }
  if ((value.reuseCurrentness === undefined) !== (value.reuseBinding === undefined)) {
    context.addIssue({ code: "custom", path: ["reuseBinding"], message: "currentness binding disposition must accompany a currentness observation" });
  }
  if (value.eligibility !== eligibilityFor(value)) {
    context.addIssue({ code: "custom", path: ["eligibility"], message: "eligibility does not match publication, behavior, currentness, and cleanup" });
  }
});

const fulfillment = z.strictObject({
  status: z.enum(["satisfied", "violated", "unknown"]),
  selectedArtifactSetId: identity.optional(),
  preservedPriorPassing: z.boolean(),
  reason,
});

export const PsychordApplicationEvidenceAssessmentSchema = z.strictObject({
  schemaVersion: z.literal("psychord-application-evidence-assessment@1"),
  request: PsychordApplicationEvidenceAssessmentRequestSchema,
  observations: z.array(assessedObservation).min(1).max(64),
  fulfillment,
}).superRefine((value, context) => {
  if (canonicalJson(value.request.observations) !== canonicalJson(value.observations.map(({ reference }) => reference))) {
    context.addIssue({ code: "custom", path: ["observations"], message: "assessment observations do not match the exact declared references" });
  }
  for (const [index, observation] of value.observations.entries()) {
    if (observation.predicate.id !== value.request.predicate.id
      || canonicalJson(observation.predicate.assertions.map(({ id }) => id)) !== canonicalJson(value.request.predicate.assertionIds)) {
      context.addIssue({ code: "custom", path: ["observations", index, "predicate"], message: "assessment predicate does not match the declared assertion binding" });
    }
  }
  if (canonicalJson(value.fulfillment) !== canonicalJson(deriveFulfillment(value.observations))) {
    context.addIssue({ code: "custom", path: ["fulfillment"], message: "fulfillment does not match the admitted observation states" });
  }
});
export type PsychordApplicationEvidenceAssessment = z.infer<typeof PsychordApplicationEvidenceAssessmentSchema>;

export interface PsychordEvidenceCurrentnessPort {
  observe(plan: PsychordApplicationObservationPlan, environment: { readonly signal: AbortSignal }): Promise<PsychordEvidenceCurrentness>;
}

export interface PsychordApplicationEvidenceAssessmentService {
  assess(request: PsychordApplicationEvidenceAssessmentRequest, environment: { readonly signal: AbortSignal }): Promise<PsychordApplicationEvidenceAssessment>;
}

export function createPsychordApplicationEvidenceAssessmentService(input: {
  readonly artifacts: PsychordObservationArtifactService;
  readonly currentness: PsychordEvidenceCurrentnessPort;
}): PsychordApplicationEvidenceAssessmentService {
  return {
    async assess(unparsedRequest, environment) {
      const request = PsychordApplicationEvidenceAssessmentRequestSchema.parse(unparsedRequest);
      const observations: z.infer<typeof assessedObservation>[] = [];
      for (const reference of request.observations) {
        environment.signal.throwIfAborted();
        observations.push(await assessObservation(input.artifacts, input.currentness, request, reference, environment.signal));
      }
      return PsychordApplicationEvidenceAssessmentSchema.parse({
        schemaVersion: "psychord-application-evidence-assessment@1",
        request,
        observations,
        fulfillment: deriveFulfillment(observations),
      });
    },
  };
}

async function assessObservation(
  artifacts: PsychordObservationArtifactService,
  currentness: PsychordEvidenceCurrentnessPort,
  request: PsychordApplicationEvidenceAssessmentRequest,
  reference: PsychordApplicationEvidenceAssessmentRequest["observations"][number],
  signal: AbortSignal,
): Promise<z.infer<typeof assessedObservation>> {
  const stored = await artifacts.read(reference.artifactSetId);
  if (stored.status !== "published") return unavailableObservation(reference, request, stored);
  const predicate = observedPredicate(request, stored);
  if (!matchesRequest(stored, request, reference)) {
    return { reference, predicate, publicationStatus: "integrity-failed", eligibility: "open", reason: "Published observation does not match its declared requirement, scenario, case, adapter, or run." };
  }
  const historical = {
    operationalStatus: stored.result.operationalStatus,
    outcome: stored.result.outcome,
    collectedCurrentness: stored.result.currentness,
    assurance: stored.result.assurance,
    cleanupComplete: stored.result.cleanup.complete,
    behavioralEvidence: stored.behavioralEvidence,
  } as const;
  let reuseCurrentness: PsychordEvidenceCurrentness;
  try { reuseCurrentness = PsychordEvidenceCurrentnessSchema.parse(await currentness.observe(stored.plan, { signal })); }
  catch (error) {
    signal.throwIfAborted();
    return { reference, predicate, publicationStatus: "published", historical, eligibility: "open", reason: `Currentness observation unavailable: ${errorMessage(error)}`.slice(0, 4_096) };
  }
  const reuseBinding = currentnessMatchesPlan(stored.plan, reuseCurrentness) ? "matched" as const : "mismatched" as const;
  if (reuseBinding === "mismatched") {
    return { reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseBinding, eligibility: "open", reason: "Currentness observation does not cover the exact repository, dependency, and build bindings in the published plan." };
  }
  if (reuseCurrentness.status !== "current") {
    return { reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseBinding, eligibility: "open", reason: reuseCurrentness.status === "stale" ? "Published behavior is historical because a bound input changed." : "Published behavior cannot be reused because a bound input is unavailable." };
  }
  if (stored.behavioralEvidence && predicate.assertions.every(({ status }) => status === "passed")) {
    return { reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseBinding, eligibility: "eligible", reason: "Authenticated behavior and the declared predicate assertions passed while every bound dependency remains current at supporting assurance." };
  }
  if (predicate.assertions.some(({ status }) => status === "failed")) {
    return { reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseBinding, eligibility: "violated", reason: "An authenticated current observation failed a declared predicate assertion." };
  }
  return { reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseBinding, eligibility: "open", reason: "The current publication is unavailable or does not evaluate the declared predicate with passing behavioral evidence." };
}

function unavailableObservation(
  reference: PsychordApplicationEvidenceAssessmentRequest["observations"][number],
  request: PsychordApplicationEvidenceAssessmentRequest,
  stored: Exclude<PsychordArtifactSetReadResult, { readonly status: "published" }>,
): z.infer<typeof assessedObservation> {
  const detail = stored.status === "integrity-failed" ? `: ${stored.reason}` : "";
  return { reference, predicate: unavailablePredicate(request), publicationStatus: stored.status, eligibility: "open", reason: `Observation artifact is ${stored.status}${detail}`.slice(0, 4_096) };
}

function matchesRequest(
  stored: Extract<PsychordArtifactSetReadResult, { readonly status: "published" }>,
  request: PsychordApplicationEvidenceAssessmentRequest,
  reference: PsychordApplicationEvidenceAssessmentRequest["observations"][number],
): boolean {
  return stored.artifactSetId === reference.artifactSetId
    && stored.plan.runId === reference.runId
    && stored.plan.scenario.id === request.scenario.id
    && stored.plan.scenario.semanticHash === request.scenario.semanticHash
    && stored.plan.case === request.case
    && stored.plan.adapter.id === psychordObservationAdapterId
    && stored.plan.adapter.version === psychordObservationAdapterVersion;
}

function deriveFulfillment(observations: readonly z.infer<typeof assessedObservation>[]) {
  const latest = observations.find(({ reference }) => reference.role === "latest");
  if (latest?.eligibility === "eligible") return selected("satisfied", latest, false, "The declared latest observation is eligible.");
  if (latest?.eligibility === "violated") return selected("violated", latest, false, "The declared latest current observation failed.");
  const priorEligible = observations.filter(({ reference, eligibility }) => reference.role === "prior" && eligibility === "eligible");
  const priorViolated = observations.filter(({ reference, eligibility }) => reference.role === "prior" && eligibility === "violated");
  if (priorEligible.length > 0 && priorViolated.length > 0) {
    return { status: "unknown" as const, preservedPriorPassing: false, reason: "Current prior observations contradict each other; none is selected as fulfillment." };
  }
  if (priorEligible.length > 0) return selected("satisfied", priorEligible[0]!, latest !== undefined, latest === undefined ? "A declared prior observation is eligible." : "The later observation is open; a still-current prior passing observation remains eligible.");
  if (priorViolated.length > 0) return selected("violated", priorViolated[0]!, false, "A declared current prior observation failed and no passing current observation exists.");
  return { status: "unknown" as const, preservedPriorPassing: false, reason: "No declared observation currently fulfills or disproves the required behavior." };
}

function eligibilityFor(observation: {
  readonly publicationStatus: "published" | "incomplete" | "missing" | "integrity-failed";
  readonly historical?: {
    readonly operationalStatus: "completed" | "failed" | "cancelled";
    readonly outcome: "passed" | "failed" | "unavailable";
    readonly collectedCurrentness: "current" | "stale" | "unknown";
    readonly assurance: "supporting";
    readonly cleanupComplete: boolean;
    readonly behavioralEvidence: boolean;
  } | undefined;
  readonly reuseCurrentness?: PsychordEvidenceCurrentness | undefined;
  readonly reuseBinding?: "matched" | "mismatched" | undefined;
  readonly predicate: { readonly assertions: readonly { readonly status: "passed" | "failed" | "unavailable" }[] };
}): "eligible" | "violated" | "open" {
  const historical = observation.historical;
  if (observation.publicationStatus !== "published" || historical === undefined || observation.reuseBinding !== "matched" || observation.reuseCurrentness?.status !== "current") return "open";
  if (historical.behavioralEvidence && observation.predicate.assertions.every(({ status }) => status === "passed")
    && historical.operationalStatus === "completed" && historical.outcome === "passed"
    && historical.collectedCurrentness === "current" && historical.assurance === "supporting" && historical.cleanupComplete) return "eligible";
  return observation.predicate.assertions.some(({ status }) => status === "failed") ? "violated" : "open";
}

function currentnessMatchesPlan(plan: PsychordApplicationObservationPlan, currentness: PsychordEvidenceCurrentness): boolean {
  const input = plan.adapter.input;
  return currentness.repository.expectedGitHead === input.repository.gitHead
    && currentness.repository.expectedWorktreeDigest === input.repository.worktreeDigest
    && canonicalJson(currentness.dependencies.map(({ role, locator, expectedHash }) => ({ role, locator, expectedHash })))
      === canonicalJson(input.dependencies.map(({ role, locator, contentHash }) => ({ role, locator, expectedHash: contentHash })))
    && canonicalJson(currentness.buildArtifacts.map(({ role, locator, expectedHash }) => ({ role, locator, expectedHash })))
      === canonicalJson(input.server.expectedBuildArtifacts.map(({ role, buildLocator, contentHash }) => ({ role, locator: buildLocator, expectedHash: contentHash })));
}

function observedPredicate(
  request: PsychordApplicationEvidenceAssessmentRequest,
  stored: Extract<PsychordArtifactSetReadResult, { readonly status: "published" }>,
) {
  const assertions = new Map(stored.result.adapter.output.assertions.map(({ id, passed }) => [id, passed]));
  return {
    id: request.predicate.id,
    assertions: request.predicate.assertionIds.map((id) => ({ id, status: assertions.has(id) ? assertions.get(id) ? "passed" as const : "failed" as const : "unavailable" as const })),
  };
}

function unavailablePredicate(request: PsychordApplicationEvidenceAssessmentRequest) {
  return { id: request.predicate.id, assertions: request.predicate.assertionIds.map((id) => ({ id, status: "unavailable" as const })) };
}

function selected(
  status: "satisfied" | "violated",
  observation: z.infer<typeof assessedObservation>,
  preservedPriorPassing: boolean,
  selectedReason: string,
) {
  return { status, selectedArtifactSetId: observation.reference.artifactSetId, preservedPriorPassing, reason: selectedReason };
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
