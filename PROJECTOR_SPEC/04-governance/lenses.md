# Pattern Candidates and Projection Lenses

## Pattern Candidate and Projection Lens

## Pattern Candidate

A Pattern Candidate is descriptive and non-authoritative.

```ts
export interface PatternCandidate {
  id: EntityId;
  key: string;
  purposeHypothesis: string;
  memberUnitIds: EntityId[];
  excludedUnitIds: EntityId[];
  counterExamples: EntityId[];
  independenceGroups: string[];
  alternatives: string[];
  confidence: Confidence;
  evidence: EvidenceRef[];
  semanticHash: ContentHash;
}
```

## Lens contribution roles

A lens contributes through one or more explicit roles:

```ts
export type LensContributionRole =
  | "projection-owner"
  | "constraint-contributor"
  | "validator-contributor"
  | "migration-overlay";
```

Only one unlayered exclusive `projection-owner` may own a particular projection role/unit. Cross-cutting constraint and validator lenses may compose. Projection-owner collisions without explicit layering/composition MUST fail lens compilation.

## Projection expectation kinds

A lens does not always define one exact canonical implementation.

```ts
export type ProjectionExpectation =
  | {
      kind: "exact-output";
      generatorId: string;
      expectedSignatureProfile: string;
    }
  | {
      kind: "structured-template";
      structureValidatorId: string;
      authoredHoles: string[];
    }
  | {
      kind: "predicate-constrained";
      predicateIds: string[];
      validatorIds: string[];
    }
  | {
      kind: "observed-state";
      comparisonPolicyId: string;
    }
  | {
      kind: "human-procedure";
      procedureId: string;
      evidenceRequirements: string[];
    };
```

Shared handwritten code SHOULD normally be `predicate-constrained`. Reconciliation MUST NOT compare it to an arbitrary single implementation and call valid alternatives divergent.

## Projection Lens contract

```ts
export interface ProjectionSpec {
  role: ProjectionUnit["role"];
  cardinality: "one" | "zero-or-one" | "many" | "at-least-one";
  surfaceKind: Surface["kind"];
  selector: SelectorExpr;
  control: ControlPolicy;
  expectation: ProjectionExpectation;
}

export interface ProjectionLens {
  id: EntityId;
  key: string;
  version: string;
  status: "candidate" | "shadow" | "active" | "deprecated" | "retired";
  purpose: string;
  realizesConceptKinds: Concept["kind"][];
  selector: SelectorExpr;
  contributions: LensContributionRole[];
  expectedProjections: ProjectionSpec[];
  rules: Rule[];
  impactRules: ImpactRule[];
  recognizers: RecognizerBinding[];
  validators: ValidatorBinding[];
  transforms: TransformBinding[];
  migrations: MigrationBinding[];
  conflictsWith: LensRef[];
  compatibleWith: LensRef[];
  examples: LensExample[];
  counterExamples: LensExample[];
  authorityRecordId: EntityId;
  governanceBasis: GovernanceBasis[];
  semanticHash: ContentHash;
}
```

An active lens MUST have:

- stable identity/version.
- applicability selector.
- contribution role(s).
- projection expectations.
- executable or validator-backed constraints.
- recognition behavior.
- validation behavior.
- typed governance basis and authority decision/constraint.
- invalidation/Impact Rules where conceptual consequences extend beyond exact derivations.
- migration semantics for incompatible lens-version changes.

Transforms are required only when deterministic mutation is supported. A prose-only architecture description is not an active lens.

---


