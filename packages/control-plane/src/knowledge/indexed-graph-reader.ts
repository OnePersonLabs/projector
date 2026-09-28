import type {
  BehavioralScenario, CanonicalDocumentEnvelope, Concept, ContentHash,
  DerivationInput, EntityId, GraphReader, ProjectionUnit, Relation, Requirement,
} from "@projector/core";
import type { SqliteObservationStore } from "@projector/runtime";

/** Addressed implementation of the existing graph contract. The caller holds a
 * readGeneration snapshot; lexical search explicitly enumerates its population. */
export class IndexedGraphReader implements GraphReader {
  constructor(private readonly store: SqliteObservationStore, private readonly generation: number) {}
  private population(selector: string, namespace?: string): string[] {
    if (this.store.getAt(this.generation, "population-version", selector) === undefined
      && (namespace === undefined || this.store.getAt(this.generation, "population-version", namespace) === undefined)) throw new Error(`Indexed graph population ${selector} is not enrolled; rebuild the complete observation`);
    return this.store.populationAt(this.generation, selector);
  }
  private canonical<T>(kind: string, id: string): T | undefined {
    const envelope = this.store.getAt<CanonicalDocumentEnvelope>(this.generation, "canonical", id);
    return envelope?.kind === kind ? envelope.payload as T : undefined;
  }
  getConcept(id: EntityId): Concept | undefined { return this.canonical("concept", id); }
  getRequirement(id: EntityId): Requirement | undefined { return this.canonical("requirement", id); }
  getBehavioralScenario(id: EntityId): BehavioralScenario | undefined { return this.canonical("behavioral-scenario", id); }
  getProjectionUnit(id: EntityId): ProjectionUnit | undefined { return this.store.getAt<ProjectionUnit>(this.generation, "unit", id); }
  getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[] {
    return this.population(`relations:${direction}:${id}`, "relations").map((relationId) => {
      const relation = this.canonical<Relation>("relation", relationId);
      if (relation === undefined) throw new Error(`Indexed relation population references missing relation ${relationId}`);
      return relation;
    });
  }
  reverseDerivationDependents(subjectId: EntityId | string): EntityId[] {
    if (this.store.getAt(this.generation, "population-version", "reverse-derivations") === undefined) throw new Error(`Indexed reverse derivation population for ${subjectId} is not enrolled; rebuild the complete observation`);
    return this.store.dependentsAt(this.generation, `derivation:${subjectId}`);
  }
  getDerivationInputs(unitId: EntityId): DerivationInput[] { return this.store.getAt<DerivationInput[]>(this.generation, "derivation-inputs", unitId) ?? []; }
  querySelectorDependencies(selectorHash: ContentHash): EntityId[] { return this.population(`selector-membership:${selectorHash}`); }
  searchSemanticIdentities(query: string, kinds: Array<"concept" | "requirement" | "scenario"> = ["concept", "requirement", "scenario"]): EntityId[] {
    const needle = query.trim().toLocaleLowerCase("en-US");
    if (needle.length === 0) return [];
    const matches: string[] = [];
    for (const kind of kinds) {
      const envelopeKind = kind === "scenario" ? "behavioral-scenario" : kind;
      for (const id of this.population(`canonical-kind:${envelopeKind}`)) {
        const entity = this.canonical<Concept | Requirement | BehavioralScenario>(envelopeKind, id);
        if (entity === undefined) throw new Error(`Indexed identity population references missing ${envelopeKind} ${id}`);
        const values = "name" in entity ? [entity.key, entity.name, entity.statement, ...entity.aliases]
          : "steps" in entity ? [entity.key, entity.title, ...entity.aliases, ...entity.steps.map(({ statement }) => statement)]
            : [entity.key, entity.title, entity.statement, ...entity.aliases];
        if (values.some((value) => value.toLocaleLowerCase("en-US").includes(needle))) matches.push(id);
      }
    }
    return [...new Set(matches)].sort();
  }
}
