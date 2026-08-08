import {
  canonicalJson,
  hashFramedDomain,
  type AdapterContext,
  type AnalyzerCapabilities,
  type AnalyzerFailure,
  type ContentHash,
  type EnumerationContract,
  type ObservabilityClass,
  type RelevanceReason,
  type StateQueryDependency,
} from "@projector/core";

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
  queryVersion: string;
  producerIds: string[];
  consumerIds: string[];
  links: TopologyLink[];
  observability: ObservabilityClass;
  enumeration?: {
    method: string;
    assumptions: string[];
    blindSpots: string[];
    dynamicMechanisms: string[];
    freshnessRequirement?: string;
  };
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
export function compileEventContractTopology(
  observations: readonly TopologyObservation[],
  enumeration?: EnumerationContract,
): EventContractTopology {
  if (enumeration !== undefined && (enumeration.observability === "closed" || enumeration.observability === "bounded")
    && enumeration.method.trim().length === 0) {
    throw new Error(`${enumeration.observability} topology enumeration requires an explicit proof method`);
  }
  if (enumeration?.observability === "bounded" && enumeration.assumptions.length === 0) {
    throw new Error("bounded topology enumeration requires an explicit proof assumption");
  }
  if (enumeration?.observability === "closed" && (enumeration.blindSpots.length > 0 || enumeration.dynamicMechanisms.length > 0)) {
    throw new Error("closed topology enumeration cannot retain blind spots or dynamic mechanisms outside its proof");
  }
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
    const routeIdentity = { subjectId: head.subjectId, subjectKind: head.subjectKind };
    const defaultObservability: ObservabilityClass = "open";
    const semantic = {
      subjectId: head.subjectId,
      subjectKind: head.subjectKind,
      semanticKey: head.semanticKey,
      queryVersion: sortedUnique(links.map(({ adapterVersion }) => adapterVersion)).join("+") || "1",
      producerIds: sortedUnique(links.filter(({ role }) => role === "producer").map(({ participantId }) => participantId)),
      consumerIds: sortedUnique(links.filter(({ role }) => role === "consumer").map(({ participantId }) => participantId)),
      links,
      observability: enumeration?.observability ?? defaultObservability,
      ...(enumeration === undefined ? {} : { enumeration: {
        method: enumeration.method,
        assumptions: sortedUnique(enumeration.assumptions),
        blindSpots: sortedUnique(enumeration.blindSpots),
        dynamicMechanisms: sortedUnique(enumeration.dynamicMechanisms),
        ...(enumeration.freshnessRequirement === undefined ? {} : { freshnessRequirement: enumeration.freshnessRequirement }),
      } }),
    };
    const contentHash = hashFramedDomain("event-contract-topology-route", semantic);
    return { id: `topology_route_${hashFramedDomain("event-contract-topology-route-identity", routeIdentity).slice(-32)}`, ...semantic, contentHash };
  }).sort((left, right) => compareStrings(left.subjectId, right.subjectId));
  return { routes, contentHash: hashFramedDomain("event-contract-topology", routes) };
}

export interface AuthenticatedTopologySubject {
  readonly subjectId: string;
  readonly subjectKind: "event" | "contract";
  readonly semanticKey: string;
  readonly scopeKey: string;
  readonly artifactHash: ContentHash;
  readonly dynamic: boolean;
}

export interface AuthenticatedTopologyParticipant {
  readonly subjectId: string;
  readonly participantId: string;
  readonly role: "producer" | "consumer";
  readonly evidenceIds: readonly string[];
  readonly artifactHash: ContentHash;
}

export interface AuthenticatedTopologyInput {
  readonly subjects: readonly AuthenticatedTopologySubject[];
  readonly participants: readonly AuthenticatedTopologyParticipant[];
  readonly capabilities: readonly AnalyzerCapabilities[];
  readonly failures: readonly AnalyzerFailure[];
}

/** Builds route completeness and link assurance only from authenticated analyzer evidence. */
export function compileAuthenticatedAnalyzerTopology(input: AuthenticatedTopologyInput): EventContractTopology {
  const subjects = new Map<string, AuthenticatedTopologySubject>();
  for (const subject of input.subjects) {
    const existing = subjects.get(subject.subjectId);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(subject)) throw new Error(`conflicting authenticated topology subject ${subject.subjectId}`);
    subjects.set(subject.subjectId, subject);
  }
  const capabilities = input.capabilities.filter(({ executesRepositoryCode }) => !executesRepositoryCode);
  const routes = [...subjects.values()].map((subject): EventContractTopologyRoute => {
    const semantic = subject.subjectKind === "event" ? "event-topology" : "public-contract-topology";
    const capability = capabilities.find(({ supportedSemantics }) => supportedSemantics.includes(semantic));
    const localFailures = input.failures.filter(({ analyzerId, scope, affectedClaimKinds, capability: failedCapability }) =>
      capability?.analyzerId === analyzerId && (scope === subject.scopeKey || scope === subject.subjectId) && (affectedClaimKinds.includes(semantic) || failedCapability === semantic));
    const authenticated = capability !== undefined && localFailures.length === 0;
    const links: TopologyLink[] = input.participants.filter(({ subjectId }) => subjectId === subject.subjectId).map((participant): TopologyLink => ({
      participantId: participant.participantId,
      role: participant.role,
      assurance: authenticated ? "exact" : "heuristic",
      confidence: authenticated ? 1 : 0.5,
      evidenceIds: sortedUnique(participant.evidenceIds),
      adapterVersion: capability?.adapterVersion ?? "unavailable",
      artifactHash: participant.artifactHash,
    })).sort((left, right) => compareStrings(left.participantId, right.participantId) || compareStrings(left.role, right.role));
    const queryVersion = capability?.adapterVersion ?? "unavailable";
    const observability: ObservabilityClass = subject.dynamic || !authenticated ? "open" : capability.enumeration.observability;
    const enumeration = capability === undefined ? undefined : {
      method: capability.enumeration.method,
      assumptions: sortedUnique(capability.enumeration.assumptions),
      blindSpots: sortedUnique(capability.enumeration.blindSpots),
      dynamicMechanisms: sortedUnique(capability.enumeration.dynamicMechanisms),
      ...(capability.enumeration.freshnessRequirement === undefined ? {} : { freshnessRequirement: capability.enumeration.freshnessRequirement }),
    };
    const routeSemantic = {
      subjectId: subject.subjectId, subjectKind: subject.subjectKind, semanticKey: subject.semanticKey, queryVersion,
      producerIds: sortedUnique(links.filter(({ role }) => role === "producer").map(({ participantId }) => participantId)),
      consumerIds: sortedUnique(links.filter(({ role }) => role === "consumer").map(({ participantId }) => participantId)),
      links, observability, ...(enumeration === undefined ? {} : { enumeration }),
    };
    return { id: `topology_route_${hashFramedDomain("event-contract-topology-route-identity", { subjectId: subject.subjectId, subjectKind: subject.subjectKind }).slice(-32)}`, ...routeSemantic, contentHash: hashFramedDomain("event-contract-topology-route", routeSemantic) };
  }).sort((left, right) => compareStrings(left.subjectId, right.subjectId));
  return { routes, contentHash: hashFramedDomain("event-contract-topology", routes) };
}

export interface TopologyRelevanceEdge {
  entityId: string;
  band: "consequence";
  score: number;
  requiredForPlanning: boolean;
  reason: RelevanceReason;
  cost: number;
}

export interface TopologyRelevanceDiscoveryResult {
  edges: TopologyRelevanceEdge[];
  dependency: StateQueryDependency;
}

export interface TopologyRelevanceAdapter {
  discover(subjectId: string, depth: number, context: AdapterContext): Promise<TopologyRelevanceDiscoveryResult>;
}

export interface TopologyQueryBindingPort {
  bind(subjectId: string, subjectKind: "event" | "contract", context: AdapterContext): Promise<StateQueryDependency>;
}

/** Host-neutral current-state projection consumed by the engine's registered topology query factory. */
export function createTopologyRelevanceQueryStatePort(topology: EventContractTopology): {
  inspect(subjectId: string, subjectKind: "event" | "contract"): {
    results: Array<Record<string, unknown>>;
    observability: ObservabilityClass;
    assumptions: string[];
    unavailableLanes: string[];
    dependencyKeys: string[];
  };
} {
  const routes = new Map(topology.routes.map((route) => [route.subjectId, route]));
  return {
    inspect: (subjectId, subjectKind) => {
      const route = routes.get(subjectId);
      if (route === undefined || route.subjectKind !== subjectKind) {
        return { results: [], observability: "unavailable", assumptions: [], unavailableLanes: [`topology:${subjectId}`], dependencyKeys: [`topology:${subjectId}`] };
      }
      return {
        results: route.links.filter(({ role }) => role === "consumer").map((link) => ({
          id: `${link.role}:${link.participantId}`,
          subjectId: route.subjectId,
          subjectKind: route.subjectKind,
          semanticKey: route.semanticKey,
          observability: route.observability,
          enumeration: route.enumeration ?? null,
          participantId: link.participantId,
          role: link.role,
          assurance: link.assurance,
          confidence: link.confidence,
          evidenceIds: link.evidenceIds,
          adapterVersion: link.adapterVersion,
          artifactHash: link.artifactHash,
          requiredForPlanning: link.assurance !== "heuristic",
          reasonKind: route.subjectKind === "contract" ? "contract-producer-consumer" : "event-producer-consumer",
          reasonExplanation: `${link.role} of ${route.semanticKey} observed with ${link.assurance} assurance`,
        })),
        observability: route.observability,
        assumptions: route.enumeration?.assumptions ?? [],
        unavailableLanes: [],
        dependencyKeys: [`topology:${subjectId}`],
      };
    },
  };
}

/** Host-neutral structural adapter: engine consumers can inject it as a relevance discovery port without analyzer coupling. */
export function createTopologyRelevanceAdapter(topology: EventContractTopology, queryBinding: TopologyQueryBindingPort): TopologyRelevanceAdapter {
  const routes = new Map(topology.routes.map((route) => [route.subjectId, route]));
  return {
    discover: async (subjectId, _depth, context) => {
      const route = routes.get(subjectId);
      if (route === undefined) throw new Error(`topology route ${subjectId} is unavailable for registered query binding`);
      const links = route?.links.filter(({ role }) => role === "consumer") ?? [];
      const edges = links.map((link): TopologyRelevanceEdge => ({
        entityId: link.participantId,
        band: "consequence",
        score: link.confidence,
        requiredForPlanning: link.assurance !== "heuristic",
        reason: {
          kind: route?.subjectKind === "contract" ? "contract-producer-consumer" : "event-producer-consumer",
          fromId: subjectId,
          weight: link.confidence,
          provenance: link.assurance === "exact" ? "derived" : "observed",
          confidence: link.confidence,
          explanation: `${link.role} of ${route?.semanticKey ?? subjectId} observed with ${link.assurance} assurance`,
          evidenceIds: [...link.evidenceIds],
        },
        cost: 1,
      })).sort((left, right) => compareStrings(left.entityId, right.entityId));
      const dependency = await queryBinding.bind(subjectId, route.subjectKind, context);
      const programId = `projector.topology.${route.subjectKind}-relevance`;
      const kind = `${route.subjectKind}-topology` as "event-topology" | "contract-topology";
      const input = { subjectId };
      const queryHash = hashFramedDomain("state-query", { kind, programId, programVersion: route.queryVersion, input });
      const snapshot = createTopologyRelevanceQueryStatePort(topology).inspect(subjectId, route.subjectKind);
      const expectedFingerprint = {
        queryHash,
        resultHash: hashFramedDomain("state-query-result", snapshot.results),
        resultCount: snapshot.results.length,
        observability: snapshot.observability,
        assumptions: snapshot.assumptions,
        unavailableLanes: snapshot.unavailableLanes,
        dependencyKeys: snapshot.dependencyKeys,
      };
      if (dependency.query.kind !== kind || dependency.query.programId !== programId || dependency.query.programVersion !== route.queryVersion
        || canonicalJson(dependency.query.input) !== canonicalJson(input) || dependency.query.semanticHash !== queryHash
        || canonicalJson(dependency.priorResult) !== canonicalJson(expectedFingerprint)) {
        throw new Error(`topology query binding for ${subjectId} is not the canonical registered query fingerprint`);
      }
      return {
        edges,
        dependency,
      };
    },
  };
}
