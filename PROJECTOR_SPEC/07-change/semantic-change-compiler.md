# Semantic Change Compiler

## Purpose

The Semantic Change Compiler turns a human request into a governed semantic transaction. It does not assume that the request names the correct canonical concepts or repository locations.

Its front half is deliberately distinct from architecture selection and impact closure:

```text
request
→ WHAT / WHY intent analysis
↘ WHERE / WHAT-ELSE Relevance Scout
→ semantic identity resolution
→ bounded Relevance Closure
→ Requirement / Behavioral Scenario / constraint delta
→ architecture preflight
→ semantic operations
→ Impact Closure
→ state-bound plan
```

The compiler MUST NOT jump directly from request text to file edits or newly named spec entities.

---

## Intent analysis

Intent analysis extracts only information that belongs to requested behavior and constraints:

- problem / why.
- desired externally meaningful outcome.
- behavior/capability changes.
- hard constraints.
- non-goals.
- explicitly stated assumptions.
- external work-item/origin references where available.

It MUST NOT silently convert a proposed implementation technology into product intent. If a request says "use Redis" before the underlying goal is established, Projector records Redis as an implementation proposal. Projector keeps the behavioral or constraint statement separate. It then resolves whether Redis is an explicit user decision or only a candidate solution.

```ts
export interface IntentStatement {
  kind: "behavior" | "constraint" | "non-goal" | "assumption" | "implementation-proposal";
  statement: string;
  origin: IntentOriginRef[];
  confidence: Confidence;
}

export interface ChangeIntentAnalysis {
  id: EntityId;
  request: string;
  normalizedIntent: string;
  statements: IntentStatement[];
  ambiguity: string[];
  assumptions: string[];
  contentHash: ContentHash;
}
```

Intent analysis is derived work until accepted semantic deltas are committed.

---

## Relevance Scout

In parallel with WHAT/WHY analysis, the Relevance Scout investigates WHERE/WHAT-ELSE without choosing HOW.

It MAY inspect:

- explicit paths/symbols/artifacts named by the request.
- canonical Concepts, Requirements, Behavioral Scenarios, aliases, and Relations.
- Projection Unit mappings.
- package/import/call/type topology.
- event producers/consumers.
- public/message/schema contracts and their consumers.
- tests/verification bindings.
- active Decisions, invariants, assumptions, and Governance Bases.
- relevant historical/co-change evidence.

Its output seeds Semantic Identity Resolution and the Relevance Engine. It does not authorize mutation and cannot turn descriptive implementation precedent into behavioral requirements.

---

## Identity resolution and Relevance Closure

Before creating durable semantic entities, the compiler resolves requested meaning using `SemanticIdentityResolution`.

A request may resolve to:

```text
one existing entity
several existing entities requiring coordinated change
an overloaded entity that should be split
a genuinely new entity
no durable semantic identity at all
an unresolved ambiguity requiring evidence/user decision
```

The resulting identities plus the Relevance Scout output seed a `RelevanceClosure`.

The compiler MUST NOT treat repository/package containment as sufficient relevance. Cross-cutting Requirements, invariants, events, contracts, and Decisions may govern code in many unrelated physical locations.

A human-readable specification or Gherkin representation MAY be generated from the resolved Requirement/Scenario subgraph for review. Such a rendering is a Representation Projection. Human edits to it MAY be interpreted as a proposed semantic change, but the rendering itself does not become the durable canonical semantic store.

---

## Requirement and scenario delta

For behaviorally meaningful changes, Projector resolves or creates stable Requirements and Behavioral Scenarios before architecture/implementation planning. Requirement and scenario deltas remain independent because their canonical many-to-many linkage is expressed through typed `Relation` operations rather than nested ownership. All semantic mutations live in one `ChangeOperation` stream. Behavior deltas are discriminated operation variants rather than duplicated side collections.

```ts
export interface RequirementDelta {
  subjectType: "requirement";
  kind: "add" | "modify" | "remove" | "supersede";
  requirementId?: EntityId;
  proposedRequirement?: Requirement;
  rationale: string;
}

export interface BehavioralScenarioDelta {
  subjectType: "scenario";
  kind: "add" | "modify" | "remove" | "supersede";
  scenarioId?: EntityId;
  proposedScenario?: BehavioralScenario;
  rationale: string;
}
```

Not every implementation cleanup requires a Requirement. Pattern migrations, mechanical refactors, governance repairs, and other changes MAY operate directly on existing Concepts/Lenses/Projection Units when no durable behavioral semantic identity would add value.

Behavioral requirements SHOULD be demonstrable through Behavioral Scenarios where examples/branches materially improve verification. Gherkin is an optional generated representation of those scenarios rather than the canonical storage format.

---

## Change contracts

```ts
export interface SemanticOperation {
  kind:
    | "add"
    | "modify"
    | "remove"
    | "replace"
    | "migrate"
    | "adopt-rule"
    | "deprecate-rule"
    | "resolve-divergence";
  subjectType:
    | "concept"
    | "relation"
    | "decision"
    | "lens"
    | "rule"
    | "projection"
    | "surface"
    | "other";
  subjectKey: string;
  subjectId?: EntityId;
  payload: Record<string, unknown>;
}

export type ChangeOperation =
  | SemanticOperation
  | RequirementDelta
  | BehavioralScenarioDelta;

export interface ImpactClosureRef {
  contentHash: ContentHash;
  knownAffectedUnitIds: EntityId[];
  possibleFrontierUnitIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
}

export interface SemanticChange {
  id: EntityId;
  request: string;
  normalizedIntent: string;
  intentAnalysisId: EntityId;
  identityResolutionIds: EntityId[];
  relevanceClosureId: EntityId;
  analysisFacetKeys: string[];
  operations: ChangeOperation[];
  decisionIds: EntityId[];
  assumptions: string[];
  boundary: string[];
  predictedImpact?: ImpactClosureRef;
  risk: RiskAssessment;
  status: "draft" | "analyzed" | "approved" | "executing" | "complete" | "blocked";
}
```

The interpreter MUST distinguish behavioral change, implementation-pattern change, technology replacement, architecture-boundary change, migration, cleanup, exception, and external-surface change. Ambiguous interpretations remain explicit alternatives.

The Semantic Change is not canonical merely because it was inferred. Accepted Requirement/Scenario/Concept/Decision/governance deltas become canonical through the normal semantic transaction. Transient analyses remain derived/inferred.

---

## Analysis Facet activation

The compiler activates only Analysis Facets relevant to the change.

Examples:

```text
behavior
architecture
events
security
realtime
migration
public-contract
persistence
performance
observability
compatibility
distribution
```

Facet activation MAY add questions, relevance lanes, evidence requirements, concern triggers, or verification obligations. It MUST NOT itself select a technology or create a hard rule.

Facet selection SHOULD scale process depth to the actual change. Trivial low-risk changes MUST NOT be forced through architecture/event/security ceremony without an applicability reason.

---

## Architecture preflight

Before impact closure, the compiler MUST run architecture preflight from [Progressive Architecture Commitment](../03-knowledge/architecture-decisions.md) for material Requirement/Scenario/constraint deltas.

Architecture preflight consumes the Relevance Closure and behavior/constraint delta. It SHOULD NOT rescan the whole repository to reconstruct context already compiled by change cognition.

The resulting `SemanticChange` records architecture decisions/deferrals that are prerequisites of planning. It MUST NOT silently treat a model-selected technology as normalized user intent.

A durable plan may proceed only when the affected-scope decision frontier contains no unresolved `blocking-now` concern, unless policy explicitly permits a recorded override.

---

## Impact Closure

After the semantic delta is sufficiently known, Impact Closure combines:

- exact reverse derivation dependencies.
- active Lens projection expectations.
- active Impact Rules.
- selector membership changes.
- authored semantic Relations where an Impact Rule says they matter.
- event/contract producer-consumer topology where encoded as exact/validated dependency or applicable Impact Rule.
- external surface mappings.
- observability-aware widening.

Every affected or frontier unit MUST record **why** it entered closure and whether that inclusion is exact, rule-derived, heuristic, or open-world widening.

Impact Closure has the same negative-space obligation as Relevance Closure. A plan can depend on reverse-derivation traversal, Impact Rule applicability, selector membership, event/contract consumer enumeration, external mapping, or other bounded queries. If correctness depends on finding only the current affected set, the plan/capsule binding MUST record those query results as `StateQueryDependency`s. A new dependent/consumer/membership that changes such a query result stales or revalidates the bound plan even if every previously affected unit hash remains unchanged. Open/sampled/unavailable lanes cannot prove exhaustive impact absence.

A Relevance Closure entry does not automatically become an affected unit. Conversely, Impact Closure MAY discover additional affected units once the exact semantic delta is known.

---

## Plan construction

A plan binds to a dependency-scoped `StateBinding` compiled against a global `StateDigest` and SHOULD order work so that:

- behavior/contracts/schemas precede consumers when those semantics changed.
- compatibility bridges precede cutover.
- source/generator fixes precede generated output.
- deterministic narrowing precedes agent semantic work.
- shared units serialize.
- independent surfaces parallelize where safe.
- cleanup follows validated target behavior.

Strongly connected semantic work groups require explicit grouped execution rather than forcing a fake DAG.

The plan records both the Relevance Closure used for planning and the predicted Impact Closure used for execution. These become comparison inputs during reconciliation.

---

## Post-implementation reverse impact

After work executes, Projector derives an observed semantic/code impact set from the actual diff and changed external surfaces. It compares this with the planned Relevance and Impact Closures.

Unexpected material entries produce `PlanningSurprise` records rather than being silently folded into the plan after the fact.

This comparison is a learning mechanism:

```text
missed relevant relationship
→ implementation exposes unexpected semantic impact
→ reconciliation classifies the surprise
→ accepted relationship/analyzer/facet improvement is proposed
→ future related changes discover it earlier
```

A Planning Surprise MUST NOT weaken validation or expand authorized write scope retroactively. Legitimate new scope requires plan refresh/rebase and any newly applicable governance.
