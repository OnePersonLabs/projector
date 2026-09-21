import {
  ApplicationEvidenceAssessmentSchema,
  ApplicationEvidenceAssessmentRequestSchema,
  ApplicationEvidencePredicateBindingSchema,
  ContentHashSchema,
  StateValueDependencyRefSchema,
  applicationEvidenceDependencies as assessmentDependencies,
  assessApplicationEvidence,
  canonicalJson,
  hashFramedDomain,
  type ApplicationEvidenceAssessment,
  type ApplicationEvidencePort,
  type ApplicationEvidencePredicateBinding,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type StateValueDependencyRef,
} from "@projector/core";
import { z } from "zod";

import type { ChangeRepositoryObservation } from "../change-lifecycle/repository-observer.js";

export type { ApplicationEvidencePort } from "@projector/core";

const unavailable = z.strictObject({
  status: z.literal("unavailable"),
  owner: z.strictObject({ kind: z.enum(["requirement", "behavioral-scenario"]), id: z.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  dependencies: z.array(StateValueDependencyRefSchema),
  reason: z.string().min(1).max(4_096),
  contentHash: ContentHashSchema,
});
const assessed = z.strictObject({
  status: z.literal("assessed"),
  owner: z.strictObject({ kind: z.enum(["requirement", "behavioral-scenario"]), id: z.string().min(1), canonicalDocumentHash: ContentHashSchema }),
  binding: ApplicationEvidencePredicateBindingSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  assessment: ApplicationEvidenceAssessmentSchema,
  dependencies: z.array(StateValueDependencyRefSchema),
  contentHash: ContentHashSchema,
});
type AssessmentBase = {
  readonly owner: { readonly kind: "requirement" | "behavioral-scenario"; readonly id: string; readonly canonicalDocumentHash: ContentHash };
  readonly binding: ApplicationEvidencePredicateBinding;
  readonly evidenceIds: readonly string[];
  readonly dependencies: readonly StateValueDependencyRef[];
  readonly contentHash: ContentHash;
};
export type KnowledgeApplicationEvidenceAssessment =
  | (AssessmentBase & { readonly status: "unavailable"; readonly reason: string })
  | (AssessmentBase & { readonly status: "assessed"; readonly assessment: ApplicationEvidenceAssessment });
export const KnowledgeApplicationEvidenceAssessmentSchema = z.discriminatedUnion("status", [unavailable, assessed]) as unknown as z.ZodType<KnowledgeApplicationEvidenceAssessment>;

/**
 * The control plane authenticates canonical owner and scenario revision. A
 * supplied port is still a trusted producer boundary: its hash binds a reply,
 * but cannot itself prove a real-world observation.
 */
export async function assessKnowledgeApplicationEvidence(input: {
  readonly observation: ChangeRepositoryObservation;
  readonly ownerIds: readonly string[];
  readonly signal: AbortSignal;
  readonly port?: ApplicationEvidencePort;
}): Promise<readonly KnowledgeApplicationEvidenceAssessment[]> {
  const results: KnowledgeApplicationEvidenceAssessment[] = [];
  for (const envelope of input.observation.canonical.documents.filter(({ kind, id }) => (kind === "requirement" || kind === "behavioral-scenario") && input.ownerIds.includes(id))) {
    if (envelope.kind !== "requirement" && envelope.kind !== "behavioral-scenario") continue;
    for (const group of applicationGroups(envelope)) {
      input.signal.throwIfAborted();
      const scenario = scenarioDisposition(input.observation, group.binding);
      const owner: AssessmentBase["owner"] = { kind: envelope.kind, id: envelope.id, canonicalDocumentHash: envelope.canonicalDocumentHash };
      const base = { owner, binding: group.binding, evidenceIds: group.evidenceIds, dependencies: [scenario.dependency] };
      if (scenario.status !== "matched") {
        results.push(withHash({ status: "unavailable" as const, ...base, reason: scenario.reason }));
        continue;
      }
      if (input.port === undefined) {
        results.push(withHash({ status: "unavailable" as const, ...base, reason: "Authenticated application evidence assessment is unavailable for this repository observation." }));
        continue;
      }
      try {
        const request = ApplicationEvidenceAssessmentRequestSchema.parse({
          schemaVersion: "application-evidence-assessment-request@1", owner, binding: group.binding, evidenceIds: group.evidenceIds,
        });
        const assessment = ApplicationEvidenceAssessmentSchema.parse(await assessApplicationEvidence(input.port, request, { signal: input.signal }));
        input.signal.throwIfAborted();
        results.push(withHash({ status: "assessed" as const, ...base, assessment, dependencies: [...base.dependencies, ...assessmentDependencies(assessment)] }));
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

export function assessmentKey(item: Pick<KnowledgeApplicationEvidenceAssessment, "owner" | "binding">): string {
  const binding = item.binding;
  return canonicalJson([item.owner.kind, item.owner.id, binding.adapter.id, binding.adapter.version, binding.scenario, binding.case, binding.predicateId, binding.assertionIds]);
}

function applicationGroups(envelope: CanonicalDocumentEnvelope) {
  const groups = new Map<string, { binding: ApplicationEvidencePredicateBinding; evidenceIds: string[] }>();
  const evidence = Array.isArray(envelope.payload.evidence) ? envelope.payload.evidence : [];
  for (const raw of evidence) {
    if (typeof raw !== "object" || raw === null || !("applicationPredicate" in raw) || !("evidenceId" in raw)) continue;
    const parsed = ApplicationEvidencePredicateBindingSchema.safeParse(raw.applicationPredicate);
    if (!parsed.success || typeof raw.evidenceId !== "string") continue;
    const binding = parsed.data as ApplicationEvidencePredicateBinding;
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
