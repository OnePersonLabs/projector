// node_modules/@projector/control-plane/dist/knowledge/indexed-graph-reader.js
var IndexedGraphReader = class {
  store;
  generation;
  constructor(store, generation) {
    this.store = store;
    this.generation = generation;
  }
  population(selector, namespace) {
    if (this.store.getAt(this.generation, "population-version", selector) === void 0 && (namespace === void 0 || this.store.getAt(this.generation, "population-version", namespace) === void 0))
      throw new Error(`Indexed graph population ${selector} is not enrolled; rebuild the complete observation`);
    return this.store.populationAt(this.generation, selector);
  }
  canonical(kind, id) {
    const envelope = this.store.getAt(this.generation, "canonical", id);
    return envelope?.kind === kind ? envelope.payload : void 0;
  }
  getConcept(id) {
    return this.canonical("concept", id);
  }
  getRequirement(id) {
    return this.canonical("requirement", id);
  }
  getBehavioralScenario(id) {
    return this.canonical("behavioral-scenario", id);
  }
  getProjectionUnit(id) {
    return this.store.getAt(this.generation, "unit", id);
  }
  getRelations(id, direction) {
    return this.population(`relations:${direction}:${id}`, "relations").map((relationId) => {
      const relation = this.canonical("relation", relationId);
      if (relation === void 0)
        throw new Error(`Indexed relation population references missing relation ${relationId}`);
      return relation;
    });
  }
  reverseDerivationDependents(subjectId) {
    if (this.store.getAt(this.generation, "population-version", "reverse-derivations") === void 0)
      throw new Error(`Indexed reverse derivation population for ${subjectId} is not enrolled; rebuild the complete observation`);
    return this.store.dependentsAt(this.generation, `derivation:${subjectId}`);
  }
  getDerivationInputs(unitId) {
    return this.store.getAt(this.generation, "derivation-inputs", unitId) ?? [];
  }
  querySelectorDependencies(selectorHash) {
    return this.population(`selector-membership:${selectorHash}`);
  }
  searchSemanticIdentities(query, kinds = ["concept", "requirement", "scenario"]) {
    const needle = query.trim().toLocaleLowerCase("en-US");
    if (needle.length === 0)
      return [];
    const matches = [];
    for (const kind of kinds) {
      const envelopeKind = kind === "scenario" ? "behavioral-scenario" : kind;
      for (const id of this.population(`canonical-kind:${envelopeKind}`)) {
        const entity = this.canonical(envelopeKind, id);
        if (entity === void 0)
          throw new Error(`Indexed identity population references missing ${envelopeKind} ${id}`);
        const values = "name" in entity ? [entity.key, entity.name, entity.statement, ...entity.aliases] : "steps" in entity ? [entity.key, entity.title, ...entity.aliases, ...entity.steps.map(({ statement }) => statement)] : [entity.key, entity.title, entity.statement, ...entity.aliases];
        if (values.some((value) => value.toLocaleLowerCase("en-US").includes(needle)))
          matches.push(id);
      }
    }
    return [...new Set(matches)].sort();
  }
};

export {
  IndexedGraphReader
};
