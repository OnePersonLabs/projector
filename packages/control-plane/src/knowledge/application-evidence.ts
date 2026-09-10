import {
  ApplicationEvidencePredicateBindingSchema,
  ContentHashSchema,
  StateValueDependencyRefSchema,
  canonicalJson,
  hashFramedDomain,
  type ApplicationEvidencePredicateBinding,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type StateValueDependencyRef,
} from "@projector/core";
import type { PsychordObservationArtifactService } from "@projector/integrations/runtime-evidence";
import { psychordObservationAdapterId, psychordObservationAdapterVersion } from "@projector/integrations/runtime-evidence";
import { z } from "zod";

import {
  PsychordApplicationEvidenceAssessmentSchema,
  createRetainedPsychordApplicationEvidenceAssessmentService,
  psychordApplicationEvidenceDependencies,
  type PsychordApplicationEvidenceAssessment,
  type PsychordEvidenceCurrentnessPort,
} from "../application-evidence/index.js";
import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";

export interface PsychordApplicationEvidenceHost {
  readonly artifacts: PsychordObservationArtifactService;
  readonly currentness: PsychordEvidenceCurrentnessPort;
}

const unavailable = z.strictObject({
  status: z.literal("unavailable"),
  requirementId: z.string().min(1),
  requirementDocumentHash: ContentHashSchema,
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  dependencies: z.array(StateValueDependencyRefSchema),
  reason: z.string().min(1).max(4_096),
  contentHash: ContentHashSchema,
});
const assessed = z.strictObject({
  status: z.literal("assessed"),
  requirementId: z.string().min(1),
  requirementDocumentHash: ContentHashSchema,
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  assessment: PsychordApplicationEvidenceAssessmentSchema,
  dependencies: z.array(StateValueDependencyRefSchema),
  contentHash: ContentHashSchema,
});
type AssessmentBase = { readonly requirementId: string; readonly requirementDocumentHash: ContentHash; readonly binding: ApplicationEvidencePredicateBinding; readonly evidenceIds: readonly string[]; readonly dependencies: readonly StateValueDependencyRef[]; readonly contentHash: ContentHash };
export type KnowledgeApplicationEvidenceAssessment =
  | (AssessmentBase & { readonly status: "unavailable"; readonly reason: string })
  | (AssessmentBase & { readonly status: "assessed"; readonly assessment: PsychordApplicationEvidenceAssessment });
export const KnowledgeApplicationEvidenceAssessmentSchema = z.discriminatedUnion("status", [unavailable, assessed]) as unknown as z.ZodType<KnowledgeApplicationEvidenceAssessment>;

export async function assessKnowledgeApplicationEvidence(input: {
  readonly observation: ChangeRepositoryObservation;
  readonly requirementIds: readonly string[];
  readonly signal: AbortSignal;
  readonly host?: PsychordApplicationEvidenceHost;
}): Promise<readonly KnowledgeApplicationEvidenceAssessment[]> {
  const service = input.host === undefined ? undefined : createRetainedPsychordApplicationEvidenceAssessmentService({
    retained: {
      repositoryRoot: input.observation.repositoryRoot,
      canonicalProjectorDigest: input.observation.state.canonicalProjectorDigest,
      signal: input.signal,
    },
    artifacts: input.host.artifacts,
    currentness: input.host.currentness,
  });
  const results: KnowledgeApplicationEvidenceAssessment[] = [];
  for (const envelope of input.observation.canonical.documents.filter(({ kind, id }) => kind === "requirement" && input.requirementIds.includes(id))) {
    const groups = applicationGroups(envelope);
    for (const group of groups) {
      input.signal.throwIfAborted();
      const scenario = scenarioDisposition(input.observation, group.binding);
      const base = { requirementId: envelope.id, requirementDocumentHash: envelope.canonicalDocumentHash, binding: group.binding, evidenceIds: group.evidenceIds, dependencies: [scenario.dependency] };
      if (scenario.status !== "matched") {
        results.push(withHash({ status: "unavailable" as const, ...base, reason: scenario.reason }));
        continue;
      }
      if (service === undefined) {
        results.push(withHash({ status: "unavailable" as const, ...base, reason: "Psychord application evidence assessment service is unavailable for this repository observation." }));
        continue;
      }
      try {
        const assessment = PsychordApplicationEvidenceAssessmentSchema.parse(await service.assess({
          schemaVersion: "psychord-application-evidence-assessment-request@3",
          requirement: { id: envelope.id, canonicalDocumentHash: envelope.canonicalDocumentHash },
          evidenceIds: group.evidenceIds,
        }, { signal: input.signal })) as PsychordApplicationEvidenceAssessment;
        input.signal.throwIfAborted();
        results.push(withHash({ status: "assessed" as const, ...base, assessment, dependencies: [...base.dependencies, ...psychordApplicationEvidenceDependencies(assessment)] }));
      } catch (error) {
        input.signal.throwIfAborted();
        results.push(withHash({ status: "unavailable" as const, ...base, reason: (error instanceof Error ? error.message : String(error)).slice(0, 4_096) }));
      }
    }
  }
  return results.sort((left, right) => assessmentKey(left).localeCompare(assessmentKey(right)));
}

export function applicationEvidenceDisposition(items: readonly KnowledgeApplicationEvidenceAssessment[]): "not-applicable" | "satisfied" | "violated" | "unknown" {
  if (items.length === 0) return "not-applicable";
  const assessedItems = items.filter((item): item is Extract<KnowledgeApplicationEvidenceAssessment, { status: "assessed" }> => item.status === "assessed");
  if (assessedItems.some(({ assessment }) => assessment.fulfillment.status === "violated")) return "violated";
  if (items.some(({ status }) => status === "unavailable")) return "unknown";
  if (assessedItems.some(({ assessment }) => assessment.fulfillment.status === "unknown")) return "unknown";
  return "satisfied";
}

export function applicationEvidenceDependencies(items: readonly KnowledgeApplicationEvidenceAssessment[]): readonly StateValueDependencyRef[] {
  return items.flatMap((item) => item.dependencies as StateValueDependencyRef[]);
}

export function assessmentKey(item: Pick<KnowledgeApplicationEvidenceAssessment, "requirementId" | "binding">): string {
  const binding = item.binding;
  return canonicalJson([item.requirementId, binding.adapter.id, binding.adapter.version, binding.scenario, binding.case, binding.predicateId, binding.assertionIds]);
}

function applicationGroups(envelope: CanonicalDocumentEnvelope) {
  const groups = new Map<string, { binding: ApplicationEvidencePredicateBinding; evidenceIds: string[] }>();
  const evidence = Array.isArray(envelope.payload.evidence) ? envelope.payload.evidence : [];
  for (const raw of evidence) {
    if (typeof raw !== "object" || raw === null || !("applicationPredicate" in raw) || !("evidenceId" in raw)) continue;
    const parsed = ApplicationEvidencePredicateBindingSchema.safeParse(raw.applicationPredicate);
    if (!parsed.success || typeof raw.evidenceId !== "string") continue;
    const binding = parsed.data as ApplicationEvidencePredicateBinding;
    if (binding.adapter.id !== psychordObservationAdapterId || binding.adapter.version !== psychordObservationAdapterVersion) continue;
    const key = canonicalJson([binding.adapter.id, binding.adapter.version, binding.scenario, binding.case, binding.predicateId, binding.assertionIds]);
    const group = groups.get(key) ?? { binding, evidenceIds: [] };
    group.evidenceIds.push(raw.evidenceId);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, evidenceIds: [...new Set(group.evidenceIds)].sort() }));
}

function withHash<T extends Record<string, unknown>>(body: T): T & { contentHash: ContentHash } {
  return { ...body, contentHash: hashFramedDomain("knowledge-application-evidence-assessment/v1", body) };
}

function scenarioDisposition(observation: ChangeRepositoryObservation, binding: ApplicationEvidencePredicateBinding): {
  readonly status: "matched" | "missing" | "mismatched";
  readonly reason: string;
  readonly dependency: StateValueDependencyRef;
} {
  const envelope = observation.canonical.documents.find(({ kind, id }) => kind === "behavioral-scenario" && id === binding.scenario.id);
  const observedSemanticHash = envelope !== undefined && typeof envelope.payload.semanticHash === "string" ? envelope.payload.semanticHash : null;
  const status = envelope === undefined ? "missing" as const : observedSemanticHash === binding.scenario.semanticHash ? "matched" as const : "mismatched" as const;
  const versionHash = hashFramedDomain("application-evidence-scenario-disposition/v1", { scenarioId: binding.scenario.id, status, canonicalDocumentHash: envelope?.canonicalDocumentHash ?? null, semanticHash: observedSemanticHash });
  return {
    status,
    reason: status === "matched" ? "The referenced canonical scenario meaning is current." : status === "missing" ? `Referenced application-evidence scenario ${binding.scenario.id} is absent.` : `Referenced application-evidence scenario ${binding.scenario.id} no longer has semantic hash ${binding.scenario.semanticHash}.`,
    dependency: StateValueDependencyRefSchema.parse({ kind: "external-snapshot", id: `application-evidence-scenario:${binding.scenario.id}`, versionHash, role: "Observed canonical scenario meaning referenced by the application predicate" }) as StateValueDependencyRef,
  };
}
