import {
  ArchitectureConcernSchema,
  canonicalJson,
  hashFramedDomain,
  type ArchitectureConcern,
  type ConcernActivationReason,
  type ConcernMateriality,
  type ContentHash,
  type RelevanceClosure,
  type SelectorExpr,
} from "@projector/core";

import { normalizeSelector } from "../governance/selectors.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);
const materialityRank: Record<ConcernMateriality, number> = { deferable: 0, "material-soon": 1, "blocking-now": 2 };

export interface ArchitectureChangeSignal {
  kind: Extract<ConcernActivationReason["kind"], "requirement-delta" | "scenario-delta" | "constraint-delta" | "surface-added" | "scale-signal" | "pattern-friction" | "planning-surprise" | "user-request">;
  subjectIds: readonly string[];
  explanation: string;
  scope: SelectorExpr;
}

export interface InferredConcernCandidate {
  key: string;
  title: string;
  question: string;
  scope: SelectorExpr;
  materiality: ConcernMateriality;
  subjectIds: readonly string[];
  causedByDecisionId?: string;
}

export interface DiscoverArchitectureConcernsInput {
  closure: RelevanceClosure;
  changes: readonly ArchitectureChangeSignal[];
  inferred?: readonly InferredConcernCandidate[];
}

export interface ArchitectureConcernDiscovery {
  concerns: ArchitectureConcern[];
  unknowns: string[];
  contentHash: ContentHash;
}

interface CandidateDefinition {
  key: string;
  title: string;
  question: string;
  minimum: ConcernMateriality;
}

const platformFrontier: readonly CandidateDefinition[] = [
  { key: "workspace-topology", title: "Workspace topology", question: "What workspace boundaries preserve coherent ownership across the target surfaces?", minimum: "material-soon" },
  { key: "cross-platform-runtime", title: "Cross-platform runtime", question: "Which runtime boundaries safely support the requested target capabilities?", minimum: "blocking-now" },
  { key: "shared-code-boundary", title: "Shared-code boundary", question: "Which behavior is safe to share and which remains platform-specific?", minimum: "blocking-now" },
  { key: "dependency-version-coherence", title: "Dependency coherence", question: "How will compatible dependency versions remain coherent across governed packages?", minimum: "material-soon" },
  { key: "api-contract", title: "API contract", question: "Which public compatibility contract connects the new surfaces?", minimum: "blocking-now" },
  { key: "build-release", title: "Build and release", question: "How will each target be built, verified, and released reproducibly?", minimum: "blocking-now" },
  { key: "distribution-signing", title: "Distribution and signing", question: "Which distribution, signing, and platform obligations must the product satisfy?", minimum: "blocking-now" },
  { key: "task-orchestration", title: "Task orchestration", question: "When do existing task dependencies stop being safely coordinated by simple scripts?", minimum: "deferable" },
];

function stronger(left: ConcernMateriality, right: ConcernMateriality): ConcernMateriality {
  return materialityRank[left] >= materialityRank[right] ? left : right;
}

function architectureId(hash: ContentHash): string {
  return `architecture-concern:${hash.slice("sha256:v1:".length, "sha256:v1:".length + 24)}`;
}

function relevantToPlatformFrontier(input: DiscoverArchitectureConcernsInput): boolean {
  const subjects = input.changes.flatMap(({ subjectIds }) => subjectIds).map((item) => item.toLocaleLowerCase("en-US"));
  return input.closure.activatedFacetKeys.some((key) => key === "platform" || key === "public-contract")
    || subjects.some((subject) => ["desktop", "android", "ios", "mobile", "platform"].some((token) => subject.includes(token)));
}

interface AccumulatedCandidate {
  key: string;
  title: string;
  question: string;
  scope: SelectorExpr;
  sourceClass: "derived" | "inferred";
  materiality: ConcernMateriality;
  reasons: ConcernActivationReason[];
}

function reasonKey(reason: ConcernActivationReason): string {
  return canonicalJson(reason);
}

export function discoverArchitectureConcerns(input: DiscoverArchitectureConcernsInput): ArchitectureConcernDiscovery {
  const unknowns = sortedUnique(input.closure.unknowns);
  const accumulated = new Map<string, AccumulatedCandidate>();
  const sortedChanges = [...input.changes].map((change) => ({
    ...change,
    subjectIds: sortedUnique(change.subjectIds),
    scope: normalizeSelector(change.scope),
  })).sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)));
  const defaultScope = sortedChanges[0]?.scope ?? { op: "all", items: [] } satisfies SelectorExpr;

  const add = (definition: CandidateDefinition, scope: SelectorExpr, sourceClass: "derived" | "inferred", materiality: ConcernMateriality, reason: ConcernActivationReason): void => {
    const normalizedScope = normalizeSelector(scope);
    const mapKey = canonicalJson({ key: definition.key.normalize("NFKC").trim(), scope: normalizedScope });
    const existing = accumulated.get(mapKey);
    if (existing === undefined) {
      accumulated.set(mapKey, {
        key: definition.key.normalize("NFKC").trim(),
        title: definition.title.normalize("NFKC").trim(),
        question: definition.question.normalize("NFKC").trim(),
        scope: normalizedScope,
        sourceClass,
        materiality: stronger(definition.minimum, materiality),
        reasons: [reason],
      });
      return;
    }
    existing.materiality = stronger(existing.materiality, stronger(definition.minimum, materiality));
    if (sourceClass === "derived") existing.sourceClass = "derived";
    if (!existing.reasons.some((candidate) => reasonKey(candidate) === reasonKey(reason))) existing.reasons.push(reason);
  };

  if (relevantToPlatformFrontier(input)) {
    const reasonSource = sortedChanges.find(({ kind }) => kind === "surface-added") ?? sortedChanges[0];
    const reason: ConcernActivationReason = {
      kind: reasonSource?.kind ?? "relevance-discovery",
      subjectIds: reasonSource?.subjectIds ?? input.closure.entries.map(({ entityId }) => entityId).sort(compareStrings),
      explanation: reasonSource?.explanation ?? "bounded relevance closure activated the platform frontier",
      causalOrigin: { kind: "relevance-analysis", causedByRelevanceClosureId: input.closure.id },
    };
    for (const definition of platformFrontier) add(definition, reasonSource?.scope ?? defaultScope, "derived", definition.minimum, reason);
  }

  for (const candidate of [...(input.inferred ?? [])].sort((left, right) => compareStrings(canonicalJson(left), canonicalJson(right)))) {
    if (candidate.causedByDecisionId !== undefined && candidate.subjectIds.includes(candidate.causedByDecisionId)) {
      unknowns.push(`circular architecture justification rejected for ${candidate.key}`);
      continue;
    }
    add(
      { key: candidate.key, title: candidate.title, question: candidate.question, minimum: "deferable" },
      candidate.scope,
      "inferred",
      candidate.materiality,
      {
        kind: "inference",
        subjectIds: sortedUnique(candidate.subjectIds),
        explanation: `inferred from the remaining bounded decision frontier for ${candidate.key}`,
        causalOrigin: { kind: "model-inference", causedByRelevanceClosureId: input.closure.id },
      },
    );
  }

  const concerns = [...accumulated.values()].sort((left, right) => compareStrings(canonicalJson({ key: left.key, scope: left.scope }), canonicalJson({ key: right.key, scope: right.scope }))).map((candidate) => {
    const activationReasons = [...candidate.reasons].sort((left, right) => compareStrings(reasonKey(left), reasonKey(right)));
    const identityHash = hashFramedDomain("architecture-concern-identity", {
      key: candidate.key,
      scope: candidate.scope,
      causalContext: activationReasons.map(({ kind, subjectIds, causalOrigin }) => ({ kind, subjectIds, causalOrigin })),
    });
    const withoutHash: Omit<ArchitectureConcern, "semanticHash"> = {
      id: architectureId(identityHash),
      key: candidate.key,
      title: candidate.title,
      question: candidate.question,
      scope: candidate.scope,
      sourceClass: candidate.sourceClass,
      status: "candidate",
      materiality: candidate.materiality,
      activationReasons,
      relatedConceptIds: [],
      relatedRequirementIds: sortedUnique(input.closure.entries.map(({ entityId }) => entityId).filter((id) => id.startsWith("requirement:"))),
      relevanceClosureId: input.closure.id,
      decisionIds: [],
      evidence: [],
    };
    return ArchitectureConcernSchema.parse({ ...withoutHash, semanticHash: hashFramedDomain("architecture-concern", withoutHash) }) as ArchitectureConcern;
  });
  const normalizedUnknowns = sortedUnique(unknowns);
  return {
    concerns,
    unknowns: normalizedUnknowns,
    contentHash: hashFramedDomain("architecture-concern-discovery", { concerns, unknowns: normalizedUnknowns, closureHash: input.closure.contentHash }),
  };
}
