import { BehavioralScenarioSchema, RequirementSchema, deriveEntityId, hashFramedDomain, type BehavioralScenario, type Requirement } from "@projector/core";
import { InMemoryGraphReader, QueryDependencyRegistry, type RegisteredQueryProgram } from "@projector/engine";

import type { ChangeRepositoryObservation } from "./repository-observer.js";

export const CHANGE_QUERY_PROGRAM_IDS = Object.freeze({
  identityExact: "projector.change.identity-exact",
  reverseImporters: "projector.change.reverse-importers",
  boundedDeferral: "projector.change.bounded-deferral",
});

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be nonblank text`);
  return value.normalize("NFKC").trim();
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) throw new Error(`${label} must be a nonempty text array`);
  return unique(value.map((item) => (item as string).normalize("NFKC").trim()));
}

function normalizedIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function exactIdentityCandidates(
  observation: ChangeRepositoryObservation,
  kind: "requirement" | "scenario",
  claims: readonly string[],
): Array<Requirement | BehavioralScenario> {
  const normalizedClaims = new Set(claims.map(normalizedIdentity));
  const values = observation.canonical.documents
    .filter((document) => document.kind === (kind === "requirement" ? "requirement" : "behavioral-scenario"))
    .map(({ payload }) => kind === "requirement" ? RequirementSchema.parse(payload) as Requirement : BehavioralScenarioSchema.parse(payload) as BehavioralScenario);
  return values.filter((item) => [item.key, ...item.aliases].some((claim) => normalizedClaims.has(normalizedIdentity(claim)))).sort((left, right) => compare(left.id, right.id));
}

export interface CalculatedRepositoryRelevance {
  readonly knownAffectedPaths: readonly string[];
  readonly knownAffectedUnitIds: readonly string[];
  readonly possibleFrontierUnitIds: readonly string[];
  readonly unavailableSurfaceIds: readonly string[];
  readonly reasons: readonly { readonly unitId: string; readonly kind: "exact" | "open"; readonly reason: string }[];
  readonly observability: ChangeRepositoryObservation["analysis"]["surface"]["enumeration"]["observability"];
  readonly assumptions: readonly string[];
  readonly dependencyKeys: readonly string[];
}

export function calculateRepositoryRelevance(
  observation: ChangeRepositoryObservation,
  editedPaths: readonly string[],
): CalculatedRepositoryRelevance {
  const seeds = unique(editedPaths);
  const affected = new Set(seeds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const dependency of observation.analysis.dependencies) {
      if (dependency.resolvedPath !== undefined && affected.has(dependency.resolvedPath) && !affected.has(dependency.importerPath)) {
        affected.add(dependency.importerPath);
        changed = true;
      }
    }
  }
  const paths = [...affected].sort(compare);
  const unitByPath = new Map(observation.analysis.projectionUnits.map((unit) => [unit.key, unit.id]));
  const knownUnitIds = paths.map((path) => unitByPath.get(path) ?? deriveEntityId("projector.proposed-unit", path));
  const relevantFailures = observation.analysis.failures.filter(({ scope }) => scope === "." || paths.includes(scope));
  const unavailableSurfaceIds = unique([
    ...(observation.analysis.surface.enumeration.observability === "closed" ? [] : [observation.analysis.surface.id]),
    ...relevantFailures.map(({ analyzerId, capability, scope }) => `unavailable:${hashFramedDomain("repository-change-analyzer-unavailable", { analyzerId, capability, scope }).slice(-24)}`),
  ]);
  const dynamicMechanisms = unique([
    ...observation.analysis.surface.enumeration.dynamicMechanisms,
    ...observation.analysis.javaScript.files.filter(({ path }) => paths.includes(path)).flatMap(({ unknowns }) => unknowns),
  ]);
  const possibleFrontierUnitIds = dynamicMechanisms.map((mechanism) => `frontier:${hashFramedDomain("repository-change-dynamic-frontier", mechanism).slice(-24)}`);
  return {
    knownAffectedPaths: paths,
    knownAffectedUnitIds: unique(knownUnitIds),
    possibleFrontierUnitIds,
    unavailableSurfaceIds,
    reasons: [
      ...paths.map((path) => ({ unitId: unitByPath.get(path) ?? deriveEntityId("projector.proposed-unit", path), kind: "exact" as const, reason: seeds.includes(path) ? "exact proposed edit" : "transitive static reverse importer" })),
      ...possibleFrontierUnitIds.map((unitId, index) => ({ unitId, kind: "open" as const, reason: `dynamic frontier: ${dynamicMechanisms[index]}` })),
    ],
    observability: observation.analysis.surface.enumeration.observability,
    assumptions: unique(observation.analysis.surface.enumeration.assumptions),
    dependencyKeys: ["repository-module-dependencies", ...seeds.map((path) => `path:${path}`)],
  };
}

function identityProgram(observation: ChangeRepositoryObservation): RegisteredQueryProgram {
  return {
    id: CHANGE_QUERY_PROGRAM_IDS.identityExact,
    version: "1",
    kind: "semantic-identity-search",
    normalizeInput(input) {
      const kind = string(input.kind, "identity kind");
      if (kind !== "requirement" && kind !== "scenario") throw new Error("identity kind must be requirement or scenario");
      return { kind, claims: strings(input.claims, "identity claims").map(normalizedIdentity) };
    },
    evaluate({ input }) {
      const kind = input.kind as "requirement" | "scenario";
      const claims = input.claims as string[];
      return {
        results: exactIdentityCandidates(observation, kind, claims).map(({ id }) => ({ id })),
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: [`canonical-identities:${kind}`],
      };
    },
  };
}

function relevanceProgram(observation: ChangeRepositoryObservation): RegisteredQueryProgram {
  return {
    id: CHANGE_QUERY_PROGRAM_IDS.reverseImporters,
    version: "1",
    kind: "package-dependency",
    normalizeInput: (input) => ({ editedPaths: strings(input.editedPaths, "edited paths") }),
    evaluate({ input }) {
      const relevance = calculateRepositoryRelevance(observation, input.editedPaths as string[]);
      return {
        results: [
          ...relevance.knownAffectedUnitIds.map((id) => ({ id, disposition: "known" })),
          ...relevance.possibleFrontierUnitIds.map((id) => ({ id, disposition: "possible" })),
          ...relevance.unavailableSurfaceIds.map((id) => ({ id, disposition: "unavailable" })),
        ],
        observability: relevance.observability,
        assumptions: relevance.assumptions,
        unavailableLanes: [],
        dependencyKeys: relevance.dependencyKeys,
      };
    },
  };
}

function deferralProgram(now: string): RegisteredQueryProgram {
  return {
    id: CHANGE_QUERY_PROGRAM_IDS.boundedDeferral,
    version: "1",
    kind: "decision-applicability",
    normalizeInput: (input) => ({
      concernId: string(input.concernId, "concern ID"),
      concernKey: string(input.concernKey, "concern key"),
      discoveryHash: string(input.discoveryHash, "discovery hash"),
      deferralId: string(input.deferralId, "deferral ID"),
      validUntil: string(input.validUntil, "deferral validity horizon"),
      forbiddenWritePaths: strings(input.forbiddenWritePaths, "forbidden write paths"),
      editedPaths: strings(input.editedPaths, "edited paths"),
    }),
    evaluate({ input }) {
      const forbidden = new Set(input.forbiddenWritePaths as string[]);
      const overlaps = (input.editedPaths as string[]).some((path) => forbidden.has(path));
      const current = Number.isFinite(Date.parse(input.validUntil as string)) && Date.parse(input.validUntil as string) > Date.parse(now);
      return {
        results: current && !overlaps ? [{ id: input.deferralId as string, disposition: "valid", concernId: input.concernId, discoveryHash: input.discoveryHash }] : [],
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: [`architecture-concern:${input.concernKey as string}`, `architecture-discovery:${input.discoveryHash as string}`, ...strings(input.forbiddenWritePaths, "forbidden write paths").map((path) => `path:${path}`)],
      };
    },
  };
}

export function createChangeQueryRegistry(input: { readonly observation: ChangeRepositoryObservation; readonly now: string }): QueryDependencyRegistry {
  const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
  registry.register(identityProgram(input.observation));
  registry.register(relevanceProgram(input.observation));
  registry.register(deferralProgram(input.now));
  return registry;
}
