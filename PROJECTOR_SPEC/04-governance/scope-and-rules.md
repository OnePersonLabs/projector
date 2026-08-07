# Scope, Selectors, and Rules

## Scope algebra, selectors, and layered ignore policy

Selectors are serialized deterministic data, not arbitrary executable code. Semantic scope is primary. Path is one useful bootstrap dimension.

## Selector expression

```ts
export type SelectorExpr =
  | { op: "all"; items: SelectorExpr[] }
  | { op: "any"; items: SelectorExpr[] }
  | { op: "not"; item: SelectorExpr }
  | {
      op: "atom";
      field:
        | "path"
        | "language"
        | "artifact-role"
        | "concept"
        | "concept-kind"
        | "requirement"
        | "scenario"
        | "lens"
        | "surface"
        | "package"
        | "package-kind"
        | "operation"
        | "platform"
        | "migration-phase"
        | "risk"
        | "tag"
        | "control-ownership"
        | "control-mutation"
        | "ast-pattern"
        | "relation"
        | "causal-origin";
      matcher:
        | "equals"
        | "in"
        | "glob"
        | "regex"
        | "contains"
        | "exists"
        | "matches-structural-query";
      value: unknown;
    };
```

Requirements:

- canonical serializable form.
- deterministic evaluation.
- safe regex engine or strict timeout.
- structural queries defined by deterministic adapter contracts.
- match explanation identifying which atoms matched.
- declared selector dependencies sufficient for localized cache invalidation.
- membership changes are explicit invalidation causes.

Changing a selector MUST evaluate both newly entering and newly leaving units.

## Selector dependency keys

Selector and rule caches MUST NOT use global graph revision as their primary invalidator. Cache identity MUST include the selector semantic hash and fingerprints of its inputs. Inputs include unit attributes, Concept/Requirement/Scenario or lens membership, queried Relations, relevance-affecting query results, adapter and profile versions, and canonical policy.

When selector/membership results participate in a plan/capsule/approval boundary, the same deterministic query semantics MUST be representable as a `StateQueryDependency`. A cache hit is not itself a validity proof. Query-program version and closure-sensitive result fingerprints are part of that dependency.

Graph revision MAY remain in diagnostics and stale-plan checks, but an unrelated edit MUST NOT evict every cached selector result. If dependency keys cannot prove that a changed snapshot leaves a bound query untouched, Projector re-evaluates the query rather than assuming locality.

## Layered ignore policy

Projector MUST separate exclusion policy by purpose:

```ts
export interface IgnorePolicy {
  inventory: SelectorExpr[];
  inferenceAuthority: SelectorExpr[];
  mutation: SelectorExpr[];
  reporting: SelectorExpr[];
  modelContext: SelectorExpr[];
  coverageDenominator: SelectorExpr[];
}
```

Examples:

- vendored code may be inventoried for dependencies while excluded from mutation and pattern authority.
- generated outputs may be included in reconciliation while excluded as independent authority evidence.
- secrets/config values may be inventoried structurally while excluded from model context.

A single ignore rule MUST NOT silently erase an artifact from all semantic roles.

---


## Rule kernel, composition, and governance evaluation

Projector rules must be executable enough to govern without becoming a general theorem prover.

## Rule effects and authority classes

```ts
export type RuleEffect =
  | "require"
  | "forbid"
  | "prefer"
  | "validate"
  | "transform"
  | "route"
  | "grant"
  | "restrict"
  | "explain";

export type AuthorityClass =
  | "host-safety"
  | "platform-constraint"
  | "approved-user-intent"
  | "active-lens"
  | "adopted-external-standard"
  | "migration-overlay"
  | "local-convention"
  | "inferred-candidate"
  | "task-suggestion";
```

## Blocking predicate kernel

A hard/blocking rule MUST normalize to a supported predicate/permission form or an explicit validator contract.

```ts
export type NormalizedPredicate =
  | { kind: "path-under"; root: string }
  | { kind: "path-not-under"; root: string }
  | { kind: "relation-required"; relation: RelationType; targetSelector: SelectorExpr }
  | { kind: "relation-forbidden"; relation: RelationType; targetSelector: SelectorExpr }
  | { kind: "cardinality"; selector: SelectorExpr; min?: number; max?: number }
  | { kind: "dependency-allowed"; from: SelectorExpr; to: SelectorExpr }
  | { kind: "dependency-forbidden"; from: SelectorExpr; to: SelectorExpr }
  | { kind: "permission"; operation: string; allowed: boolean }
  | { kind: "unit-state"; state: ValidityState }
  | { kind: "schema-valid"; schemaId: string }
  | { kind: "validator"; validatorId: string };

export interface Rule {
  id: EntityId;
  key: string;
  version: string;
  effect: RuleEffect;
  authorityClass: AuthorityClass;
  governanceBasis: GovernanceBasis[];
  selector: SelectorExpr;
  predicates: NormalizedPredicate[];
  advisoryPayload?: Record<string, unknown>;
  rationale: string;
  evidence: EvidenceRef[];
  conflictPolicy: "error" | "merge" | "higher-authority" | "explicit-exception-only";
  validatorIds: string[];
  transformIds: string[];
  semanticHash: ContentHash;
}
```

Opaque `advisoryPayload` MAY inform context or UI but MUST NOT independently block execution or override another hard rule.

Unknown semantic conflict must fail conservatively or require an explicit validator/decision. Projector MUST NOT pretend to have mechanically proven a conflict it cannot represent.

## Effective rule bundle

```ts
export interface RuleConflict {
  ruleIds: EntityId[];
  unitId: EntityId;
  kind:
    | "require-forbid"
    | "exclusive-transform"
    | "authority-override"
    | "ambiguous-selector"
    | "incompatible-predicate";
  explanation: string;
  evidenceIds: EntityId[];
}

export interface EffectiveRuleBundle {
  unitId: EntityId;
  operation: string;
  rules: Rule[];
  suppressedRules: Array<{ ruleId: EntityId; reason: string; supersededBy?: EntityId }>;
  predicates: NormalizedPredicate[];
  conflicts: RuleConflict[];
  dependencyFingerprint: ContentHash;
  bundleHash: ContentHash;
}
```

## Composition order

1. Immutable host safety.
2. Hard platform constraints.
3. Approved user/product intent.
4. Active Projection Lens contributions.
5. Adopted standards.
6. Migration overlays.
7. Local conventions.
8. Inferred candidate advisories.
9. Task suggestions.

Specificity breaks ties only within equivalent authority. A direct user request that changes architecture creates/proposes semantic intent. It is not a prompt-level bypass around active governance.

## Hard conflicts

Context compilation MUST fail before mutation when:

- mutually exclusive requirements apply.
- requirement and prohibition target the same representable state.
- exclusive transforms claim the same unit without layering/order.
- lower authority attempts to override higher authority without explicit exception.
- selector ambiguity prevents reproducible applicability.
- projection-owner lens overlap is unresolved.

## Rule products

One canonical rule MAY compile into several products:

- concise agent-context consequence compiled through an applicable Semantic Representation Profile.
- machine-invariant representation of normative predicates/permissions.
- write-scope permission.
- deterministic validator.
- transform binding.
- linter/check.
- divergence query.
- Impact Rule dependency.
- subagent route.
- required test.

This keeps prompts, hooks, validators, and codemods from drifting into independent copies of policy.

## Stratified evaluation and recursion

Selectors, lens memberships, and effective rules MUST respect the governance strata in [Conceptual Architecture](../02-semantic-kernel/conceptual-architecture.md). Cross-cutting constraints may depend on lower-layer classifications. They MUST NOT create feedback in which a rule changes the facts that make the rule authoritative.

Declared recursive rule/lens groups are evaluated as SCCs with monotonic semantics or an explicit fixed-point function. Repeating state digest means either convergence or a detected cycle. An iteration limit MUST terminate the run.

## Rule pressure

`projector audit --rules` MUST detect:

- contradictions.
- unreachable selectors.
- excessive exceptions.
- duplicate or semantically equivalent rules.
- overbroad selectors.
- stale authority triggers.
- blocking rules lacking executable predicates/validators.
- deterministic mechanics expressed only as prose.
- transforms lacking idempotency evidence.
- rules causing disproportionate invalidation.
- rule/model growth whose maintenance cost exceeds the divergence it prevents.

---


