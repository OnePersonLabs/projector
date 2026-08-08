import { canonicalJson, hashFramedDomain, type ContentHash, type ObservabilityClass } from "@projector/core";

export type TopologyAssurance = "exact" | "validated" | "heuristic";

export interface TopologyObservation {
  subjectId: string;
  subjectKind: "event" | "contract";
  semanticKey: string;
  participantId: string;
  role: "producer" | "consumer";
  assurance: TopologyAssurance;
  confidence: number;
  evidenceIds: readonly string[];
  adapterVersion: string;
  artifactHash: ContentHash;
  /** Used only to locate evidence; never participates in semantic topology identity. */
  incidentalPath?: string;
}

export interface TopologyLink {
  participantId: string;
  role: TopologyObservation["role"];
  assurance: TopologyAssurance;
  confidence: number;
  evidenceIds: string[];
  adapterVersion: string;
  artifactHash: ContentHash;
}

export interface EventContractTopologyRoute {
  id: string;
  subjectId: string;
  subjectKind: TopologyObservation["subjectKind"];
  semanticKey: string;
  producerIds: string[];
  consumerIds: string[];
  links: TopologyLink[];
  observability: ObservabilityClass;
  contentHash: ContentHash;
}

export interface EventContractTopology {
  routes: EventContractTopologyRoute[];
  contentHash: ContentHash;
}

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

function normalize(observation: TopologyObservation): Omit<TopologyObservation, "incidentalPath"> {
  if (observation.subjectId.trim() === "" || observation.semanticKey.trim() === "" || observation.participantId.trim() === "") {
    throw new Error("topology observations require stable semantic subject and participant identities");
  }
  if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) {
    throw new Error("topology confidence must be within 0..1");
  }
  return {
    subjectId: observation.subjectId,
    subjectKind: observation.subjectKind,
    semanticKey: observation.semanticKey,
    participantId: observation.participantId,
    role: observation.role,
    assurance: observation.assurance,
    confidence: observation.confidence,
    evidenceIds: sortedUnique(observation.evidenceIds),
    adapterVersion: observation.adapterVersion,
    artifactHash: observation.artifactHash,
  };
}

/** Compiles no-exec, evidence-backed relevance routes. File moves cannot change route identity. */
export function compileEventContractTopology(observations: readonly TopologyObservation[]): EventContractTopology {
  const unique = new Map<string, ReturnType<typeof normalize>>();
  const subjectSemantics = new Map<string, string>();
  for (const observation of observations) {
    const normalized = normalize(observation);
    const subjectSemantic = canonicalJson({ subjectKind: normalized.subjectKind, semanticKey: normalized.semanticKey });
    const existingSubjectSemantic = subjectSemantics.get(normalized.subjectId);
    if (existingSubjectSemantic !== undefined && existingSubjectSemantic !== subjectSemantic) {
      throw new Error(`conflicting stable subject identity ${normalized.subjectId}`);
    }
    subjectSemantics.set(normalized.subjectId, subjectSemantic);
    const key = canonicalJson({
      subjectId: normalized.subjectId,
      subjectKind: normalized.subjectKind,
      semanticKey: normalized.semanticKey,
      participantId: normalized.participantId,
      role: normalized.role,
    });
    const existing = unique.get(key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalized)) {
      throw new Error(`conflicting duplicate topology observation for ${normalized.subjectId}/${normalized.participantId}`);
    }
    unique.set(key, normalized);
  }
  const groups = new Map<string, ReturnType<typeof normalize>[]>();
  for (const observation of unique.values()) {
    const key = canonicalJson({
      subjectId: observation.subjectId,
      subjectKind: observation.subjectKind,
      semanticKey: observation.semanticKey,
    });
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  const routes = [...groups.values()].map((group) => {
    const head = group[0]!;
    const links: TopologyLink[] = group
      .sort((left, right) => compareStrings(left.participantId, right.participantId) || compareStrings(left.role, right.role))
      .map(({ participantId, role, assurance, confidence, evidenceIds, adapterVersion, artifactHash }) => ({
        participantId, role, assurance, confidence, evidenceIds: [...evidenceIds], adapterVersion, artifactHash,
      }));
    const semantic = {
      subjectId: head.subjectId,
      subjectKind: head.subjectKind,
      semanticKey: head.semanticKey,
      producerIds: sortedUnique(links.filter(({ role }) => role === "producer").map(({ participantId }) => participantId)),
      consumerIds: sortedUnique(links.filter(({ role }) => role === "consumer").map(({ participantId }) => participantId)),
      links,
      observability: links.every(({ assurance }) => assurance === "exact") ? "closed" as const : "bounded" as const,
    };
    const contentHash = hashFramedDomain("event-contract-topology-route", semantic);
    return { id: `topology_route_${contentHash.slice(-32)}`, ...semantic, contentHash };
  }).sort((left, right) => compareStrings(left.subjectId, right.subjectId));
  return { routes, contentHash: hashFramedDomain("event-contract-topology", routes) };
}
