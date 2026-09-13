import {
  BehavioralScenarioSchema, ConceptSchema, RequirementSchema, DerivedObservationBudget, hashFramedDomain,
  type BehavioralScenario, type Concept, type ContentHash, type ProjectionUnit,
  type RealizationBinding, type RealizationSelectorExpr, type Requirement,
} from "@projector/core";
import {
  evaluateSelectorMembership, projectionUnitSelectorSubject, SelectorEvaluationError,
} from "@projector/engine";
import type { LocalRepositoryAnalysis } from "@projector/analyzers";
import type { CanonicalSnapshot } from "@projector/runtime";

export interface CanonicalRealizationObservation {
  readonly entityId: string;
  readonly bindingIndex: number;
  readonly bindingHash: ContentHash;
  readonly origin: RealizationBinding["origin"];
  readonly status: "matched" | "unmatched" | "unsupported" | "unavailable";
  readonly memberIds: readonly string[];
  readonly reason: string;
}

function requiresStructuralQuery(selector: RealizationSelectorExpr): boolean {
  if (selector.op === "atom") return selector.matcher === "matches-structural-query";
  if (selector.op === "not") return requiresStructuralQuery(selector.item);
  return selector.items.some(requiresStructuralQuery);
}

/** Compose accepted declarations with raw facts; behavioral scope grants no membership. */
export function compileCanonicalRealizations(analysis: LocalRepositoryAnalysis, canonical: CanonicalSnapshot, budget = new DerivedObservationBudget(analysis.observationDescriptor.limits.maxDerivedBytes)): {
  readonly units: readonly ProjectionUnit[];
  readonly observations: readonly CanonicalRealizationObservation[];
} {
  budget.reserveItems(analysis.projectionUnits.length, 384, "realization-unit");
  const units = analysis.projectionUnits.map((unit) => ({ ...unit, conceptIds: [] as string[], requirementIds: [] as string[], scenarioIds: [] as string[] }));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const files = new Map(analysis.files.map((file) => [file.artifactId, file]));
  let subjectBytes = 0;
  const subjects = units.map((unit) => {
    const path = files.get(unit.artifactId)?.path ?? unit.key;
    const segments = path.split("/");
    const packageRoot = ["packages", "apps"].includes(segments[0]!) && segments[1] !== undefined ? `${segments[0]}/${segments[1]}` : undefined;
    const bytes = 512 + 4 * (path.length + unit.id.length + unit.key.length);
    budget.reserve(bytes, "realization-subject", unit.id);
    subjectBytes += bytes;
    return projectionUnitSelectorSubject(unit, { path, surface: analysis.surface.kind,
      ...(packageRoot === undefined ? {} : { package: packageRoot, packageKind: segments[0] }) });
  });
  const observations: CanonicalRealizationObservation[] = [];
  for (const document of [...canonical.documents].sort((a, b) => a.id.localeCompare(b.id))) {
    let entity: Concept | Requirement | BehavioralScenario;
    let field: "conceptIds" | "requirementIds" | "scenarioIds";
    if (document.kind === "concept") { entity = ConceptSchema.parse(document.payload) as Concept; field = "conceptIds"; }
    else if (document.kind === "requirement") { entity = RequirementSchema.parse(document.payload) as Requirement; field = "requirementIds"; }
    else if (document.kind === "behavioral-scenario") { entity = BehavioralScenarioSchema.parse(document.payload) as BehavioralScenario; field = "scenarioIds"; }
    else continue;
    if (entity.status !== "active") continue;
    for (const [bindingIndex, binding] of (entity.realizations ?? []).entries()) {
      budget.reserve(768 + 2 * (entity.id.length + binding.origin.locator.length), "realization-observation", entity.id);
      const basis = { entityId: entity.id, bindingIndex, bindingHash: hashFramedDomain("canonical-realization-binding", binding), origin: binding.origin };
      if (requiresStructuralQuery(binding.selector)) {
        observations.push({ ...basis, status: "unsupported", memberIds: [], reason: "Structural query realization needs an observer beyond the supported raw repository facts." });
        continue;
      }
      if (analysis.surface.access === "unavailable" || analysis.surface.enumeration.observability === "unavailable") {
        observations.push({ ...basis, status: "unavailable", memberIds: [], reason: "Repository inventory is unavailable; realization membership was not established." });
        continue;
      }
      budget.reserve(subjectBytes, "realization-selector", entity.id);
      try {
        const membership = evaluateSelectorMembership(binding.selector, subjects, {
          observability: analysis.surface.enumeration.observability,
          assumptions: analysis.surface.enumeration.assumptions,
          unavailableLanes: analysis.failures.filter(({ analyzerId }) => analyzerId === "projector.filesystem-local").map(({ capability, scope }) => `${capability}:${scope}`),
        });
        const unavailable = analysis.failures.some(({ analyzerId }) => analyzerId === "projector.filesystem-local");
        if (!unavailable) for (const id of membership.memberIds) {
          // The observation retains member IDs and the unit retains its accepted owner.
          budget.reserve(160 + 4 * (id.length + entity.id.length), "realization-membership", entity.id);
          unitsById.get(id)![field].push(entity.id);
        }
        observations.push({ ...basis, status: unavailable ? "unavailable" : membership.memberIds.length === 0 ? "unmatched" : "matched",
          memberIds: unavailable ? [] : membership.memberIds,
          reason: unavailable ? "Repository inventory has failed observations; realization membership was not established."
            : membership.memberIds.length === 0 ? "Declared realization has no members in the observed repository boundary."
              : "Declared realization matches observed raw facts; membership does not establish behavioral fulfillment." });
      } catch (error) {
        if (!(error instanceof SelectorEvaluationError)) throw error;
        observations.push({ ...basis, status: "unsupported", memberIds: [], reason: error.message });
      } finally {
        budget.release(subjectBytes);
      }
    }
  }
  // Selector subjects are an internal view; returned units and observations remain reserved.
  budget.release(subjectBytes);
  return { units: units.map((unit) => {
    const membership = { conceptIds: [...new Set(unit.conceptIds)].sort(), requirementIds: [...new Set(unit.requirementIds)].sort(), scenarioIds: [...new Set(unit.scenarioIds)].sort() };
    return { ...unit, ...membership, membershipHash: Object.values(membership).every((ids) => ids.length === 0) ? unit.membershipHash
      : hashFramedDomain("canonical-realization-membership", { rawMembershipHash: unit.membershipHash, ...membership }) };
  }), observations };
}
