import {
  EvidenceRefSchema,
  ContentHashSchema,
  StateValueDependencyRefSchema,
  applicationEvidenceBindingIssues,
  canonicalDocumentEnvelopeSchemaForKind,
  canonicalJson,
  hashFramedDomain,
  type ApplicationEvidencePredicateBinding,
  type CanonicalDocumentEnvelope,
  type BehavioralScenario,
  type ContentHash,
  type EvidenceRef,
  type Requirement,
  type StateValueDependencyRef,
} from "@projector/core";
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
type PsychordEvidenceReference = EvidenceRef & { readonly applicationPredicate: ApplicationEvidencePredicateBinding };
const observationReference: z.ZodType<PsychordEvidenceReference> = EvidenceRefSchema.transform((value, context) => {
  const reference = value as EvidenceRef;
  const binding = reference.applicationPredicate;
  if (binding?.kind !== "application-observation"
    || binding.adapter.id !== psychordObservationAdapterId
    || binding.adapter.version !== psychordObservationAdapterVersion
    || !isPsychordCase(binding.case)) {
    context.addIssue({ code: "custom", path: ["applicationPredicate"], message: "evidence must bind the Psychord application observation adapter and case" });
    return z.NEVER;
  }
  const predicate = psychordPredicateFor(binding.case);
  if (binding.scenario.id !== "scenario:keep-reload-replay-owned-moment"
    || binding.predicateId !== predicate.id
    || canonicalJson(binding.assertionIds) !== canonicalJson(predicate.assertionIds)) {
    context.addIssue({ code: "custom", path: ["applicationPredicate"], message: "evidence predicate must match the exact canonical Psychord scenario assertion mapping" });
    return z.NEVER;
  }
  return reference as PsychordEvidenceReference;
});

export const PsychordApplicationEvidenceAssessmentRequestSchema = z.strictObject({
  schemaVersion: z.literal("psychord-application-evidence-assessment-request@4"),
  owner: z.strictObject({ kind: z.enum(["requirement", "behavioral-scenario"]), id: identity, canonicalDocumentHash: ContentHashSchema }),
  evidenceIds: z.array(identity).min(1).max(64),
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length) {
    context.addIssue({ code: "custom", path: ["evidenceIds"], message: "observation evidence references must be unique" });
  }
});
export type PsychordApplicationEvidenceAssessmentRequest = z.infer<typeof PsychordApplicationEvidenceAssessmentRequestSchema>;

const assessedObservation = z.strictObject({
  reference: observationReference,
  predicate: z.strictObject({ id: identity, assertions: z.array(z.strictObject({ id: identity, status: z.enum(["passed", "failed", "unavailable"]) })).min(1).max(64) }),
  publicationStatus: z.enum(["published", "incomplete", "missing", "integrity-failed"]),
  historical: z.strictObject({
    planHash: ContentHashSchema,
    resultHash: ContentHashSchema,
    publicationHash: ContentHashSchema,
    operationalStatus: PsychordApplicationObservationResultSchema.shape.operationalStatus,
    outcome: PsychordApplicationObservationResultSchema.shape.outcome,
    collectedCurrentness: PsychordApplicationObservationResultSchema.shape.currentness,
    assurance: z.literal("supporting"),
    cleanupComplete: z.boolean(),
    behavioralEvidence: z.boolean(),
  }).optional(),
  reuseCurrentness: PsychordEvidenceCurrentnessSchema.optional(),
  reuseCurrentnessHash: ContentHashSchema.optional(),
  reuseBinding: z.enum(["matched", "mismatched"]).optional(),
  artifactDispositionHash: ContentHashSchema,
  currentnessDispositionHash: ContentHashSchema,
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
  if ((value.reuseCurrentness === undefined) !== (value.reuseCurrentnessHash === undefined)) {
    context.addIssue({ code: "custom", path: ["reuseCurrentnessHash"], message: "currentness hash must accompany exactly one currentness observation" });
  } else if (value.reuseCurrentness !== undefined
    && value.reuseCurrentnessHash !== hashFramedDomain("psychord-application-evidence-currentness/v1", value.reuseCurrentness)) {
    context.addIssue({ code: "custom", path: ["reuseCurrentnessHash"], message: "currentness hash does not match the exact reuse observation" });
  }
  if (value.historical !== undefined && value.historical.publicationHash !== publicationHash(
    value.reference.evidenceId,
    value.historical.planHash,
    value.historical.resultHash,
  )) {
    context.addIssue({ code: "custom", path: ["historical", "publicationHash"], message: "publication hash does not match the authenticated plan and result identities" });
  }
  if (value.artifactDispositionHash !== artifactDispositionHash(value)) {
    context.addIssue({ code: "custom", path: ["artifactDispositionHash"], message: "artifact disposition hash does not match the exact read result" });
  }
  if (value.currentnessDispositionHash !== currentnessDispositionHash(value)) {
    context.addIssue({ code: "custom", path: ["currentnessDispositionHash"], message: "currentness disposition hash does not match the exact observation result" });
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

export type PsychordRequirementEnvelope = Omit<CanonicalDocumentEnvelope, "kind" | "payload"> & { readonly kind: "requirement"; readonly payload: Requirement };
export type PsychordScenarioEnvelope = Omit<CanonicalDocumentEnvelope, "kind" | "payload"> & { readonly kind: "behavioral-scenario"; readonly payload: BehavioralScenario };
export type PsychordEvidenceOwnerEnvelope = PsychordRequirementEnvelope | PsychordScenarioEnvelope;
export const PsychordEvidenceOwnerEnvelopeSchema = z.union([
  canonicalDocumentEnvelopeSchemaForKind("requirement"),
  canonicalDocumentEnvelopeSchemaForKind("behavioral-scenario"),
]) as z.ZodType<PsychordEvidenceOwnerEnvelope>;

export const PsychordApplicationEvidenceAssessmentSchema = z.strictObject({
  schemaVersion: z.literal("psychord-application-evidence-assessment@4"),
  request: PsychordApplicationEvidenceAssessmentRequestSchema,
  owner: PsychordEvidenceOwnerEnvelopeSchema,
  observations: z.array(assessedObservation).min(1).max(64),
  fulfillment,
}).superRefine((value, context) => {
  if (value.owner.kind !== value.request.owner.kind
    || value.owner.id !== value.request.owner.id
    || value.owner.canonicalDocumentHash !== value.request.owner.canonicalDocumentHash) {
    context.addIssue({ code: "custom", path: ["owner"], message: "assessment owner does not match its state-bound request" });
  }
  const selected = selectOwnerEvidence(value.request.evidenceIds, value.owner, context);
  if (canonicalJson(selected) !== canonicalJson(value.observations.map(({ reference }) => reference))) {
    context.addIssue({ code: "custom", path: ["observations"], message: "assessment observations do not match the exact declared references" });
  }
  for (const [index, observation] of value.observations.entries()) {
    const binding = observation.reference.applicationPredicate;
    if (observation.predicate.id !== binding.predicateId
      || canonicalJson(observation.predicate.assertions.map(({ id }) => id)) !== canonicalJson(binding.assertionIds)) {
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

export interface PsychordEvidenceOwnerCustodyPort {
  readCurrent(
    owner: PsychordApplicationEvidenceAssessmentRequest["owner"],
    environment: { readonly signal: AbortSignal },
  ): Promise<PsychordEvidenceOwnerEnvelope>;
}

export function createPsychordApplicationEvidenceAssessmentService(input: {
  readonly artifacts: PsychordObservationArtifactService;
  readonly currentness: PsychordEvidenceCurrentnessPort;
  readonly owners: PsychordEvidenceOwnerCustodyPort;
}): PsychordApplicationEvidenceAssessmentService {
  return {
    async assess(unparsedRequest, environment) {
      const request = PsychordApplicationEvidenceAssessmentRequestSchema.parse(unparsedRequest);
      environment.signal.throwIfAborted();
      const owner = PsychordEvidenceOwnerEnvelopeSchema.parse(await input.owners.readCurrent(request.owner, environment));
      if (owner.kind !== request.owner.kind
        || owner.id !== request.owner.id
        || owner.canonicalDocumentHash !== request.owner.canonicalDocumentHash
        || owner.payload.id !== request.owner.id) {
        throw new Error("Current canonical evidence owner does not match the state-bound owner document");
      }
      const evidence = selectOwnerEvidence(request.evidenceIds, owner);
      const observations: z.infer<typeof assessedObservation>[] = [];
      for (const reference of evidence) {
        environment.signal.throwIfAborted();
        observations.push(await assessObservation(input.artifacts, input.currentness, reference, environment.signal));
      }
      return PsychordApplicationEvidenceAssessmentSchema.parse({
        schemaVersion: "psychord-application-evidence-assessment@4",
        request,
        owner,
        observations,
        fulfillment: deriveFulfillment(observations),
      });
    },
  };
}

async function assessObservation(
  artifacts: PsychordObservationArtifactService,
  currentness: PsychordEvidenceCurrentnessPort,
  reference: PsychordEvidenceReference,
  signal: AbortSignal,
): Promise<z.infer<typeof assessedObservation>> {
  const stored = await artifacts.read(reference.evidenceId);
  if (stored.status !== "published") return unavailableObservation(reference, stored);
  const predicate = observedPredicate(reference, stored);
  if (!matchesRequest(stored, reference)) {
    return bindDisposition({ reference, predicate, publicationStatus: "integrity-failed", eligibility: "open", reason: "Published observation does not match its declared scenario, case, or adapter binding." });
  }
  const historical = {
    planHash: stored.manifest.planHash,
    resultHash: stored.manifest.resultHash,
    publicationHash: publicationHash(stored.artifactSetId, stored.manifest.planHash, stored.manifest.resultHash),
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
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, eligibility: "open", reason: `Currentness observation unavailable: ${errorMessage(error)}`.slice(0, 4_096) });
  }
  const reuseBinding = currentnessMatchesPlan(stored.plan, reuseCurrentness) ? "matched" as const : "mismatched" as const;
  const reuseCurrentnessHash = hashFramedDomain("psychord-application-evidence-currentness/v1", reuseCurrentness);
  if (reuseBinding === "mismatched") {
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "open", reason: "Currentness observation does not cover the exact repository, dependency, and build bindings in the published plan." });
  }
  if (reuseCurrentness.status !== "current") {
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "open", reason: reuseCurrentness.status === "stale" ? "Published behavior is historical because a bound input changed." : "Published behavior cannot be reused because a bound input is unavailable." });
  }
  if (reference.stance !== "supports") {
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "open", reason: "This positive predicate evaluator retains context and contradictory evidence without treating it as fulfillment." });
  }
  if (stored.behavioralEvidence && predicate.assertions.every(({ status }) => status === "passed")) {
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "eligible", reason: "Authenticated behavior and the declared predicate assertions passed while every bound dependency remains current at supporting assurance." });
  }
  if (predicate.assertions.some(({ status }) => status === "failed")) {
    return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "violated", reason: "An authenticated current observation failed a declared predicate assertion." });
  }
  return bindDisposition({ reference, predicate, publicationStatus: "published", historical, reuseCurrentness, reuseCurrentnessHash, reuseBinding, eligibility: "open", reason: "The current publication is unavailable or does not evaluate the declared predicate with passing behavioral evidence." });
}

function unavailableObservation(
  reference: PsychordEvidenceReference,
  stored: Exclude<PsychordArtifactSetReadResult, { readonly status: "published" }>,
): z.infer<typeof assessedObservation> {
  const detail = stored.status === "integrity-failed" ? `: ${stored.reason}` : "";
  return bindDisposition({ reference, predicate: unavailablePredicate(reference), publicationStatus: stored.status, eligibility: "open", reason: `Observation artifact is ${stored.status}${detail}`.slice(0, 4_096) });
}

function matchesRequest(
  stored: Extract<PsychordArtifactSetReadResult, { readonly status: "published" }>,
  reference: PsychordEvidenceReference,
): boolean {
  const binding = reference.applicationPredicate;
  return stored.artifactSetId === reference.evidenceId
    && stored.plan.scenario.id === binding.scenario.id
    && stored.plan.scenario.semanticHash === binding.scenario.semanticHash
    && stored.plan.case === binding.case
    && stored.plan.adapter.id === binding.adapter.id
    && stored.plan.adapter.version === binding.adapter.version;
}

function deriveFulfillment(observations: readonly z.infer<typeof assessedObservation>[]) {
  const latest = observations.find(({ reference }) => reference.applicationPredicate.observationRole === "latest");
  if (latest?.eligibility === "eligible") return selected("satisfied", latest, false, "The declared latest observation is eligible.");
  if (latest?.eligibility === "violated") return selected("violated", latest, false, "The declared latest current observation failed.");
  const priorEligible = observations.filter(({ reference, eligibility }) => reference.applicationPredicate.observationRole === "prior" && eligibility === "eligible");
  const priorViolated = observations.filter(({ reference, eligibility }) => reference.applicationPredicate.observationRole === "prior" && eligibility === "violated");
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
    readonly planHash: `sha256:v1:${string}`;
    readonly resultHash: `sha256:v1:${string}`;
    readonly publicationHash: `sha256:v1:${string}`;
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
  readonly reference: { readonly stance: "supports" | "contradicts" | "context" };
}): "eligible" | "violated" | "open" {
  const historical = observation.historical;
  if (observation.reference.stance !== "supports" || observation.publicationStatus !== "published" || historical === undefined || observation.reuseBinding !== "matched" || observation.reuseCurrentness?.status !== "current") return "open";
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
  reference: PsychordEvidenceReference,
  stored: Extract<PsychordArtifactSetReadResult, { readonly status: "published" }>,
) {
  const assertions = new Map(stored.result.adapter.output.assertions.map(({ id, passed }) => [id, passed]));
  const binding = reference.applicationPredicate;
  return {
    id: binding.predicateId,
    assertions: binding.assertionIds.map((id) => ({ id, status: assertions.has(id) ? assertions.get(id) ? "passed" as const : "failed" as const : "unavailable" as const })),
  };
}

function unavailablePredicate(reference: PsychordEvidenceReference) {
  const binding = reference.applicationPredicate;
  return { id: binding.predicateId, assertions: binding.assertionIds.map((id) => ({ id, status: "unavailable" as const })) };
}

function selected(
  status: "satisfied" | "violated",
  observation: z.infer<typeof assessedObservation>,
  preservedPriorPassing: boolean,
  selectedReason: string,
) {
  return { status, selectedArtifactSetId: observation.reference.evidenceId, preservedPriorPassing, reason: selectedReason };
}

function selectOwnerEvidence(
  evidenceIds: readonly string[],
  owner: PsychordEvidenceOwnerEnvelope,
  context?: z.RefinementCtx,
): PsychordEvidenceReference[] {
  const selected: PsychordEvidenceReference[] = [];
  if (owner.payload.status !== "active") {
    if (context !== undefined) context.addIssue({ code: "custom", path: ["owner", "payload", "status"], message: "application evidence custody requires an active canonical owner" });
    else throw new Error("Application evidence custody requires an active canonical owner");
  }
  for (const [index, evidenceId] of evidenceIds.entries()) {
    const matches = owner.payload.evidence.filter((reference) => reference.evidenceId === evidenceId);
    if (matches.length !== 1) {
      if (context !== undefined) context.addIssue({ code: "custom", path: ["evidenceIds", index], message: "evidence ID must identify exactly one reference in the authenticated owner" });
      else throw new Error("Evidence ID does not belong exactly once to the current canonical owner");
      continue;
    }
    const parsed = observationReference.safeParse(matches[0]);
    if (!parsed.success) {
      if (context !== undefined) for (const issue of parsed.error.issues) context.addIssue({ code: "custom", path: ["evidenceIds", index, ...issue.path], message: issue.message });
      else throw parsed.error;
      continue;
    }
    selected.push(parsed.data);
  }
  if (owner.kind === "behavioral-scenario") {
    for (const [index, reference] of selected.entries()) {
      const scenario = reference.applicationPredicate.scenario;
      if (scenario.id === owner.id && scenario.semanticHash === owner.semanticHash) continue;
      if (context !== undefined) context.addIssue({ code: "custom", path: ["evidenceIds", index, "applicationPredicate", "scenario"], message: "scenario-owned evidence must bind the exact current owner meaning" });
      else throw new Error("Scenario-owned evidence must bind the exact current owner meaning");
    }
  }
  for (const issue of applicationEvidenceBindingIssues(selected)) {
    if (context !== undefined) context.addIssue({ code: "custom", path: ["evidenceIds", issue.index], message: issue.message });
    else throw new Error(issue.message);
  }
  if (selected.length === 0) return selected;
  const expected = exactPredicateBinding(selected[0]!.applicationPredicate);
  for (const [index, reference] of selected.entries()) {
    if (canonicalJson(exactPredicateBinding(reference.applicationPredicate)) === canonicalJson(expected)) continue;
    if (context !== undefined) context.addIssue({ code: "custom", path: ["evidenceIds", index], message: "one assessment must contain one exact scenario and predicate binding" });
    else throw new Error("One assessment must contain one exact scenario and predicate binding");
  }
  return selected;
}

function exactPredicateBinding(binding: ApplicationEvidencePredicateBinding) {
  const { observationRole: _observationRole, ...exact } = binding;
  return exact;
}

function isPsychordCase(value: string): value is "no-input" | "keep-reload-replay" | "save-failure" {
  return value === "no-input" || value === "keep-reload-replay" || value === "save-failure";
}

function psychordPredicateFor(caseName: "no-input" | "keep-reload-replay" | "save-failure") {
  if (caseName === "keep-reload-replay") return { id: "predicate:keep-reload-replay", assertionIds: ["explicit-save", "reload-restores-archive", "replay-is-not-player-input", "replay-preserves-persisted-provenance"] } as const;
  if (caseName === "save-failure") return { id: "predicate:save-failure-preservation", assertionIds: ["save-failure-visible", "save-failure-preserves-archive"] } as const;
  return { id: "predicate:no-input-is-not-player", assertionIds: ["no-input-player"] } as const;
}

export function psychordApplicationEvidenceDependencies(unparsedAssessment: unknown): readonly StateValueDependencyRef[] {
  const assessment = PsychordApplicationEvidenceAssessmentSchema.parse(unparsedAssessment);
  const dependencies: StateValueDependencyRef[] = [{
    kind: "canonical-entity",
    id: assessment.owner.id,
    versionHash: assessment.owner.canonicalDocumentHash,
    role: "Current canonical meaning owning the application evidence predicate",
  }];
  for (const observation of assessment.observations) {
    dependencies.push({
      kind: "artifact",
      id: `application-evidence:${observation.reference.evidenceId}`,
      versionHash: observation.artifactDispositionHash,
      role: "Exact application observation publication or absence disposition",
    });
    dependencies.push({
      kind: "external-snapshot",
      id: `application-evidence-currentness:${observation.reference.evidenceId}`,
      versionHash: observation.currentnessDispositionHash,
      role: "Exact application evidence currentness or unavailability disposition",
    });
  }
  return dependencies.map((dependency) => StateValueDependencyRefSchema.parse(dependency) as StateValueDependencyRef);
}

type ObservationDisposition = {
  readonly reference: PsychordEvidenceReference;
  readonly publicationStatus: "published" | "incomplete" | "missing" | "integrity-failed";
  readonly historical?: { readonly publicationHash: ContentHash } | undefined;
  readonly reuseCurrentnessHash?: ContentHash | undefined;
  readonly reason: string;
};

function bindDisposition<const T extends ObservationDisposition>(value: T): T & {
  readonly artifactDispositionHash: ContentHash;
  readonly currentnessDispositionHash: ContentHash;
} {
  return {
    ...value,
    artifactDispositionHash: artifactDispositionHash(value),
    currentnessDispositionHash: currentnessDispositionHash(value),
  };
}

function artifactDispositionHash(value: ObservationDisposition): ContentHash {
  return value.publicationStatus === "published" && value.historical !== undefined
    ? value.historical.publicationHash
    : hashFramedDomain("psychord-application-evidence-artifact-disposition/v1", {
      artifactSetId: value.reference.evidenceId,
      status: value.publicationStatus,
      reason: value.reason,
    });
}

function currentnessDispositionHash(value: ObservationDisposition): ContentHash {
  return value.reuseCurrentnessHash ?? hashFramedDomain("psychord-application-evidence-currentness-disposition/v1", {
    artifactSetId: value.reference.evidenceId,
    status: value.publicationStatus === "published" ? "unavailable" : "not-observed",
    reason: value.reason,
  });
}

function publicationHash(artifactSetId: string, planHash: ContentHash, resultHash: ContentHash): ContentHash {
  return hashFramedDomain("psychord-application-evidence-publication/v1", { artifactSetId, planHash, resultHash });
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
