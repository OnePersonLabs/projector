# Derivations, Invalidation, and Repair Routing

## Derivations, semantic signatures, and proof groups

Invalidation means a prior proof is no longer current. A hash alone is not a proof unless its signature profile and assurance make the semantics explicit.

## Derivation inputs

```ts
export interface DerivationInput {
  kind:
    | "concept"
    | "requirement"
    | "scenario"
    | "relation"
    | "lens"
    | "rule-bundle"
    | "unit"
    | "artifact"
    | "external-constraint"
    | "toolchain"
    | "adapter"
    | "signature-profile"
    | "representation-profile"
    | "representation-projection";
  id: EntityId | string;
  versionHash: ContentHash;
  role: string;
}

export interface DerivationRecord {
  unitId: EntityId;
  proofGroupId?: EntityId;
  engineVersion: string;
  adapterVersion: string;
  inputs: DerivationInput[];
  ruleBundleHash: ContentHash;
  outputSemanticSignature: SemanticSignature;
  outputStructuralSignature: SemanticSignature;
  membershipHash: ContentHash;
  establishedAt: string;
  validators: ValidationResult[];
}
```

## Signature profiles

Each semantic-signature profile MUST document:

- semantic scope represented.
- normalization performed.
- differences intentionally ignored.
- evidence that justifies `exact` or `validated` assurance.
- adapter/profile version.
- failure/unsupported constructs.

Examples:

- formatting-insensitive AST shape may be exact for a structural projection but only heuristic for business behavior.
- exported TypeScript declaration shape may be exact for a public type-surface signature while saying nothing about runtime semantics.
- test equivalence may validate behavior in the tested domain but not prove untested side effects.

A profile-version change invalidates all derivations depending on that profile.

## Backdating eligibility

Downstream invalidation MAY be pruned only when the relevant semantic signature is:

- `exact`. Or
- `validated` by evidence meeting the current policy's required independence/assurance.

`heuristic` equality may prioritize revalidation or reduce model context, but MUST NOT establish downstream validity by itself.

## Derivation cycles

Real software can contain mutually recursive semantic units. The derivation graph therefore MAY contain SCCs.

Within a derivation SCC:

1. Mark the whole proof group suspect when a relevant external input changes.
2. Recompute/revalidate member signatures using the declared group strategy.
3. Iterate until group signatures stabilize or the limit is reached.
4. Backdate the SCC as a unit only when every externally visible relevant signature has eligible assurance.
5. Propagate downstream only from signatures that materially changed.

Unresolved cyclic proof emits `derivation-cycle-unresolved` and widens analysis.

---


## Semantic invalidation and correctness oracles

Exact dependency invalidation and conceptual impact widening are separate mechanisms. They operate **after a semantic delta is known**. Pre-change Relevance Closure is an upstream cognition mechanism and MUST NOT be used as a substitute for exact derivation dependencies or Impact Rules. A relevance edge may later become a canonical/derived relation or Impact Rule only through the normal evidence/governance path.

## Impact Rules

```ts
export interface ImpactRule {
  id: EntityId;
  key: string;
  version: string;
  selector: SelectorExpr;
  trigger:
    | "concept-change"
    | "interface-change"
    | "membership-change"
    | "removal"
    | "lens-change"
    | "rule-change"
    | "decision-change"
    | "concern-resolution"
    | "representation-profile-change"
    | "external-change"
    | "manual";
  direction: "forward" | "reverse" | "both";
  relationTypes?: RelationType[];
  maxDepth?: number;
  effect: "invalidate" | "revalidate" | "widen-analysis" | "advisory" | "block";
  requiredRelationConfidence?: number;
  semanticHash: ContentHash;
}
```

Exact invalidation first follows reverse `DerivationInput` dependencies. Impact Rules then add architecture-specific conceptual consequences. Low-confidence inferred relations MAY widen the frontier, but MUST NOT silently become exact deterministic dependency edges.

## Invalidation causes and result

```ts
export interface InvalidationCause {
  eventKind: string;
  subjectId: EntityId | string;
  oldHash?: ContentHash;
  newHash?: ContentHash;
}

export interface InvalidationEvent extends InvalidationCause {
  graphRevision: number;
  stateDigest: StateDigest;
}

export interface InvalidationResult {
  directlyAffected: EntityId[];
  transitivelyAffected: EntityId[];
  possibleFrontier: EntityId[];
  unavailable: EntityId[];
  reasons: Record<EntityId, string[]>;
}
```

Required causes include changes to Concepts, Requirements, Behavioral Scenarios, authored Relations, architecture decisions, concern dispositions, lenses, rules, Semantic Representation Profiles, selector membership, and authority. They also include changes to artifacts, units, signature profiles, toolchains, adapters, exceptions, migration phases, pinned observations, and surface availability.

## Invalidation algorithm

```text
1. Find exact reverse derivation dependents of the changed input.
2. Mark those units/proof SCCs suspect.
3. Evaluate applicable versioned Impact Rules.
4. Add proven Impact-Rule dependencies to affected work.
5. Put weak/inferred/open-world consequences into the possible frontier.
6. Revalidate suspect semantic signatures before propagating expensive downstream work.
7. Backdate only exact or policy-sufficient independently validated equality.
8. Propagate material semantic output changes through exact derivation dependents.
9. Widen for analyzer failures, open-world lanes, unstable anchors, or insufficient assurance.
10. Return known affected, possible frontier, unavailable surfaces, and reasons.
```

The algorithm MUST be deterministic for a fixed canonical state, repository snapshot, pinned external snapshot, adapter/profile set, and policy.

## Semantic backdating

Example:

```text
internal API handler changes
→ public contract proof becomes suspect
→ contract is recomputed
→ public-interface signature is exact and unchanged
→ new derivation is established against the new handler input
→ client generation proof remains current
→ no client regeneration
```

If the equality profile is only heuristic, the contract remains `suspect` until an adequate validator proves it or the frontier is widened.

## Rebuild oracle

`projector verify --clean` MUST rebuild local derived state from:

- repository/Git snapshot.
- canonical `.projector/` state.
- explicitly pinned external observation snapshot if requested.
- declared toolchain/adapter/signature-profile versions.

It compares clean state with incremental state and detects stale caches, missing invalidation, revision errors, and nondeterministic rebuild behavior.

## Independent conformance oracle

A rebuild using the same semantic extractor is correlated with incremental state and cannot alone prove business correctness. Independent conformance evidence may come from:

- compiler/type checker.
- pre-existing or independently designed tests.
- schema/contract validators.
- runtime/remote observations.
- architecture/property/metamorphic checks.
- independent human/model review.

Validation policy decides which lanes and independence groups are required for a risk class.

## Historical/metamorphic oracle

Historical replay and mutation-generated variants test whether a lens, selector, transform, or authority decision predicts useful outcomes beyond the exact fixtures that produced it.

Projector MUST never describe these three oracles as interchangeable proof.

---


## Repair routing and upstream-first generated repair

```ts
export type RepairStrategy =
  | "reuse"
  | "revalidate"
  | "deterministic-patch"
  | "regenerate"
  | "agent-repair"
  | "widen-analysis"
  | "human-decision";

export interface RepairCapabilities {
  validatorCanProveValidity: boolean;
  deterministicPatch: boolean;
  patchIsReversible: boolean;
  generator: boolean;
  upstreamSourceKnown: boolean;
}
```

Routing order:

1. If an eligible exact/validated signature can be backdated, `reuse`.
2. If a validator can establish sufficient proof, `revalidate`.
3. If a generated unit has a known upstream source/generator, repair upstream and `regenerate`.
4. If a reversible deterministic transform safely applies to a non-generated governed unit, `deterministic-patch`.
5. If shared handwritten semantics require bounded reasoning and policy allows it, `agent-repair`.
6. If coverage/proof is insufficient, `widen-analysis`.
7. Otherwise `human-decision`.

Direct editing of a generated output or Representation Projection with a known generator/source is forbidden by default. The normal invariant is:

```text
repair upstream canonical semantics/profile
→ regenerate
→ validate generated result + semantic preservation
```

A temporary generated-output overlay MAY exist only as an explicit migration/debt record with an owner, rationale, invalidation conditions, and exit criteria.

Every routing decision MUST record why cheaper/safer strategies were unavailable or insufficient.

---


