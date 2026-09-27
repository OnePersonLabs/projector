import { createRequire as __projectorCreateRequire } from "node:module"; const require = __projectorCreateRequire(import.meta.url);
import {
  InMemoryGraphReader,
  QueryDependencyRegistry
} from "./shared-ZKECJVYF.js";
import {
  BehavioralScenarioSchema,
  RequirementSchema,
  deriveEntityId,
  hashFramedDomain
} from "./shared-6VIFAIKJ.js";

// node_modules/@projector/control-plane/dist/change-lifecycle/query-programs.js
var CHANGE_QUERY_PROGRAM_IDS = Object.freeze({
  identityExact: "projector.change.identity-exact",
  reverseImporters: "projector.change.reverse-importers",
  boundedDeferral: "projector.change.bounded-deferral"
});
var compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
var unique = (values) => [...new Set(values)].sort(compare);
function string(value, label) {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be nonblank text`);
  return value.normalize("NFKC").trim();
}
function strings(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === ""))
    throw new Error(`${label} must be a nonempty text array`);
  return unique(value.map((item) => item.normalize("NFKC").trim()));
}
function textArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === ""))
    throw new Error(`${label} must be a text array`);
  return unique(value.map((item) => item.normalize("NFKC").trim()));
}
function normalizedIdentity(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}
function exactIdentityCandidates(observation, kind, claims) {
  const normalizedClaims = new Set(claims.map(normalizedIdentity));
  const values = observation.canonical.documents.filter((document) => document.kind === (kind === "requirement" ? "requirement" : "behavioral-scenario")).map(({ payload }) => kind === "requirement" ? RequirementSchema.parse(payload) : BehavioralScenarioSchema.parse(payload));
  return values.filter((item) => [item.key, ...item.aliases].some((claim) => normalizedClaims.has(normalizedIdentity(claim)))).sort((left, right) => compare(left.id, right.id));
}
function calculateRepositoryRelevance(observation, editedPaths, budget) {
  if (budget !== void 0) {
    const stage = "repository-relevance";
    budget.reserve(4096, stage);
    for (const path of editedPaths)
      budget.reserve(768 + 8 * path.length, stage);
    for (const dependency of observation.analysis.dependencies) {
      budget.reserve(896 + 8 * (dependency.importerPath.length + (dependency.resolvedPath?.length ?? 0)), stage);
    }
    budget.reserveItems(observation.analysis.projectionUnits.length, 128, stage);
    for (const failure of observation.analysis.failures) {
      budget.reserve(512 + 8 * (failure.scope.length + failure.analyzerId.length + failure.capability.length), stage);
    }
    budget.reserveItems(observation.analysis.javaScript.files.length, 64, stage);
    for (const file of observation.analysis.javaScript.files) {
      for (const unknown of file.unknowns)
        budget.reserve(512 + 8 * unknown.length, stage);
    }
    for (const mechanism of observation.analysis.surface.enumeration.dynamicMechanisms)
      budget.reserve(512 + 8 * mechanism.length, stage);
    for (const assumption of observation.analysis.surface.enumeration.assumptions)
      budget.reserve(64 + 8 * assumption.length, stage);
  }
  const seeds = unique(editedPaths);
  const seedSet = new Set(seeds);
  const affected = new Set(seeds);
  const importersByPath = /* @__PURE__ */ new Map();
  for (const dependency of observation.analysis.dependencies) {
    const resolvedPath = dependency.resolvedPath;
    if (resolvedPath === void 0)
      continue;
    let importers = importersByPath.get(resolvedPath);
    if (importers === void 0) {
      importers = [];
      importersByPath.set(resolvedPath, importers);
    }
    importers.push(dependency.importerPath);
  }
  const queue = [...seeds];
  for (let index = 0; index < queue.length; index += 1) {
    const importers = importersByPath.get(queue[index]);
    if (importers === void 0)
      continue;
    for (const importer of importers) {
      if (affected.has(importer))
        continue;
      affected.add(importer);
      queue.push(importer);
    }
  }
  const paths = [...affected].sort(compare);
  const unitByPath = new Map(observation.analysis.projectionUnits.map((unit) => [unit.key, unit.id]));
  const knownUnitIds = paths.map((path) => unitByPath.get(path) ?? deriveEntityId("projector.proposed-unit", path));
  const relevantFailures = observation.analysis.failures.filter(({ scope }) => scope === "." || affected.has(scope));
  const unavailableSurfaceIds = unique([
    ...observation.analysis.surface.enumeration.observability === "unavailable" ? [observation.analysis.surface.id] : [],
    ...relevantFailures.map(({ analyzerId, capability, scope }) => `unavailable:${hashFramedDomain("repository-change-analyzer-unavailable", { analyzerId, capability, scope }).slice(-24)}`)
  ]);
  const dynamicMechanisms = unique([
    ...observation.analysis.surface.enumeration.dynamicMechanisms,
    ...observation.analysis.javaScript.files.filter(({ path }) => affected.has(path)).flatMap(({ unknowns }) => unknowns)
  ]);
  const possibleFrontierUnitIds = dynamicMechanisms.map((mechanism) => `frontier:${hashFramedDomain("repository-change-dynamic-frontier", mechanism).slice(-24)}`);
  return {
    knownAffectedPaths: paths,
    knownAffectedUnitIds: unique(knownUnitIds),
    possibleFrontierUnitIds,
    unavailableSurfaceIds,
    reasons: [
      ...paths.map((path, index) => ({ unitId: knownUnitIds[index], kind: "exact", reason: seedSet.has(path) ? "exact proposed edit" : "transitive static reverse importer" })),
      ...possibleFrontierUnitIds.map((unitId, index) => ({ unitId, kind: "open", reason: `dynamic frontier: ${dynamicMechanisms[index]}` }))
    ],
    observability: observation.analysis.surface.enumeration.observability,
    assumptions: unique(observation.analysis.surface.enumeration.assumptions),
    dependencyKeys: ["repository-module-dependencies", ...seeds.map((path) => `path:${path}`)]
  };
}
function identityProgram(observation) {
  return {
    id: CHANGE_QUERY_PROGRAM_IDS.identityExact,
    version: "1",
    kind: "semantic-identity-search",
    normalizeInput(input) {
      const kind = string(input.kind, "identity kind");
      if (kind !== "requirement" && kind !== "scenario")
        throw new Error("identity kind must be requirement or scenario");
      return { kind, claims: strings(input.claims, "identity claims").map(normalizedIdentity) };
    },
    evaluate({ input }) {
      const kind = input.kind;
      const claims = input.claims;
      return {
        results: exactIdentityCandidates(observation, kind, claims).map(({ id }) => ({ id })),
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: [`canonical-identities:${kind}`]
      };
    }
  };
}
function relevanceProgram(observation, derivedBudget) {
  return {
    id: CHANGE_QUERY_PROGRAM_IDS.reverseImporters,
    version: "1",
    kind: "package-dependency",
    normalizeInput: (input) => ({ editedPaths: textArray(input.editedPaths, "edited paths") }),
    evaluate({ input }) {
      const relevance = calculateRepositoryRelevance(observation, input.editedPaths, derivedBudget);
      return {
        results: [
          ...relevance.knownAffectedUnitIds.map((id) => ({ id, disposition: "known" })),
          ...relevance.possibleFrontierUnitIds.map((id) => ({ id, disposition: "possible" })),
          ...relevance.unavailableSurfaceIds.map((id) => ({ id, disposition: "unavailable" }))
        ],
        observability: relevance.observability,
        assumptions: relevance.assumptions,
        unavailableLanes: [],
        dependencyKeys: relevance.dependencyKeys
      };
    }
  };
}
function deferralProgram(now) {
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
      editedPaths: strings(input.editedPaths, "edited paths")
    }),
    evaluate({ input }) {
      const forbidden = new Set(input.forbiddenWritePaths);
      const overlaps = input.editedPaths.some((path) => forbidden.has(path));
      const current = Number.isFinite(Date.parse(input.validUntil)) && Date.parse(input.validUntil) > Date.parse(now);
      return {
        results: current && !overlaps ? [{ id: input.deferralId, disposition: "valid", concernId: input.concernId, discoveryHash: input.discoveryHash }] : [],
        observability: "closed",
        assumptions: [],
        unavailableLanes: [],
        dependencyKeys: [`architecture-concern:${input.concernKey}`, `architecture-discovery:${input.discoveryHash}`, ...strings(input.forbiddenWritePaths, "forbidden write paths").map((path) => `path:${path}`)]
      };
    }
  };
}
function createChangeQueryRegistry(input) {
  const registry = new QueryDependencyRegistry(new InMemoryGraphReader(), false);
  registry.register(identityProgram(input.observation));
  registry.register(relevanceProgram(input.observation, input.derivedBudget));
  registry.register(deferralProgram(input.now));
  return registry;
}

export {
  CHANGE_QUERY_PROGRAM_IDS,
  exactIdentityCandidates,
  calculateRepositoryRelevance,
  createChangeQueryRegistry
};
