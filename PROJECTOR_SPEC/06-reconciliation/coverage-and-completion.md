# Coverage and Progressive Completion

## Coverage, observability, and proof boundaries

Coverage is multi-dimensional and proof-sensitive. A percentage without its observable universe and evidence assumptions is not a completeness claim.

Required dimensions:

1. Inventory coverage.
2. Projection Unit classification coverage.
3. Concept mapping coverage.
4. Relationship coverage.
5. Lens coverage.
6. Rule enforceability.
7. Derivation coverage.
8. Validation/evidence-lane coverage.
9. Surface coverage.
10. Authority coverage.
11. Historical/metamorphic coverage.
12. Architecture-decision coverage and decision-frontier state.
13. Semantic-identity resolution/overlap coverage.
14. Pre-change relevance coverage for supported dependency lanes.
15. Representation-projection fidelity and protected-dimension coverage.
16. Change-closure confidence.
17. Predicted-versus-observed impact surprise rate for executed changes.

Each dimension MUST report its observability class and the assumptions behind its denominator.

```ts
export interface CoverageLane {
  key: string;
  observability: ObservabilityClass;
  numerator: number;
  denominator?: number;
  confidence: Confidence;
  assumptions: string[];
  blindSpots: string[];
  analyzerFailures: AnalyzerFailure[];
  staleObservationIds: string[];
  exactClosureProvable: boolean;
}

export interface CoverageSnapshot {
  graphRevision: number;
  boundary: string[];
  lanes: CoverageLane[];
  completeWithinBoundary: boolean;
  allowsBoundedAgentRepair: boolean;
  unknownFrontierIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
  proofStatement: "proven-within-boundary" | "bounded" | "high-confidence" | "partial" | "not-established";
}
```

Example:

```text
Boundary: repository + GitHub Actions

Inventory:               99.2%   closed
Unit classification:     91.3%   closed
Concept mapping:         83.4%   bounded
Identity resolution:     82.7%   bounded
Relevance discovery:     80.5%   bounded
Relationship coverage:   78.1%   bounded
Lens coverage:           71.6%   bounded
Rule enforceability:     64.1%   closed for active hard rules
Derivation coverage:     58.7%   bounded
External deployment:     sampled; exact remote closure unavailable

Exact change closure currently provable for:
  - repository scripts
  - package exports
  - supported TypeScript public API relations

Global completeness: not established
```

## `proven-within-boundary`

This statement is legal only when every dependency lane required by the claim is:

- `closed`. Or
- `bounded` with all stated assumptions satisfied.

Any required `open`, `sampled`, `unavailable`, failed, or stale lane prevents proof and must appear in the frontier/unknown statement.

## Analyzer failure degradation

A partial analyzer failure MUST NOT erase useful observations from other capabilities. It lowers or widens only the coverage and conclusions that depend on the failed capability. A failure in Markdown parsing, for example, MUST NOT invalidate a proven package dependency edge unless that proof depended on Markdown.

## Complete-within-boundary definition

Within a proof-eligible boundary:

1. Every enumerated artifact is classified as managed, external/manual, intentionally excluded from the denominator, or supporting.
2. Every governed Projection Unit maps to semantic intent or a justified supporting role.
3. Active Concepts, Requirements, and Behavioral Scenarios in scope are uniquely resolved or have an explicit overlap/uncertainty disposition.
4. Active concepts have expected projections or are explicitly abstract.
5. Required relevance lanes for the claimed change class are closed/bounded enough that omitted governing semantics are not silently treated as absent.
6. Active lenses have recognition, validation, impact, and expectation behavior.
7. Hard rules are executable or validator-backed.
8. External/manual projections have an owner/procedure.
9. Unresolved blocking findings are zero.
10. Unknown units are zero for closed/bounded required lanes.
11. Required validation independence constraints are satisfied.
12. Unresolved `blocking-now` architecture concerns are zero for the claimed scope, and accepted decisions required by the scope have valid or explicitly bounded validity assessments.

---


## Maximum-information-gain completion

`projector complete` ranks questions approximately by:

```text
utility =
    expected_uncertainty_reduction
  × affected_unit_count
  × future_change_frequency
  × divergence_leverage
  × decision_reuse
  × architecture_materiality
  ÷ (user_effort × ambiguity × risk)
```

A good question resolves clusters, not artifacts. Identity/ownership ambiguities that could fragment canonical semantics and missing relevance relationships that repeatedly cause planning surprises are high-information questions. Blocking architecture questions outrank low-value cleanup questions when they constrain the next safe plan. Projector MUST NOT show non-blocking architecture questions only because they are interesting.

Example:

```text
17 general scripts use /scripts with colocated tests.
3 hook-support modules use /.codex/hooks/lib.
1 icon-generation script is inside hook support.

Interpretations:
A. misplaced general script              0.91
B. general scripts are allowed in hooks  0.06
C. third semantic class exists           0.03

Approving A will:
- classify the script;
- activate the repository-script lens;
- resolve placement/test anomalies;
- create a move transform;
- narrow the hook-support selector;
- update two dependent documentation references.
```

Answers MAY:

- approve.
- choose alternative.
- provide semantic correction.
- create an intentional exception.
- defer.
- permit policy selection.

Settled questions MUST NOT repeat unless relevant evidence changes.

---


