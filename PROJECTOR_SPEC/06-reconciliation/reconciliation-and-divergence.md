# Reconciliation, Divergence, Exceptions, and Migrations

## Reconciliation, convergence, and divergence

## Reconciliation loop

```text
load state-bound inputs
→ index observations
→ refresh deterministic facts
→ update semantic classifications/hypotheses
→ compute lens memberships
→ compile rules + projection expectations
→ refresh invalidated Representation Projections
→ evaluate derivations/validity
→ derive reverse semantic impact from actual mutations
→ compare predicted relevance/impact vs observed impact
→ classify Planning Surprises and propose missing relationships where justified
→ compare governed expectation vs observed state
→ correlate migrations/exceptions
→ classify divergence/anomaly
→ optionally plan/execute repairs
→ reindex affected state
→ iterate declared SCC/fixed-point groups
→ verify convergence + required evidence
→ emit receipt/certificate/report
```

A second reconciliation with identical inputs SHOULD produce no material semantic-state delta, no new patch, and no new finding identity. It MAY still emit a run record or unchanged report.

## Termination

Every reconciliation iteration MUST calculate a deterministic state digest over the governed incremental state. The engine stops when:

- no material semantic state changed. Or
- all declared fixed-point groups satisfy their convergence criteria.

It MUST fail with `nonconvergent-reconciliation` when:

- an earlier nonterminal state digest repeats.
- a declared SCC exceeds its iteration budget.
- rule/lens membership oscillates.
- a repair repeatedly recreates the same divergence.

No evaluation order may silently determine the winning state of a cycle.

## Divergence taxonomy

At minimum:

- `pattern-inconsistency`.
- `misplaced-artifact`.
- `missing-projection`.
- `orphan-projection`.
- `stale-projection`.
- `conflicting-authority`.
- `duplicate-concept`.
- `semantic-identity-overlap`.
- `unpredicted-impact`.
- `accidental-fork`.
- `dependency-boundary`.
- `documentation-drift`.
- `test-projection`.
- `migration-residue`.
- `obsolete-technology`.
- `external-surface-drift`.
- `unmodeled-surface`.
- `rule-quality`.
- `representation-drift`.
- `representation-fidelity`.
- `governance-cycle`.
- `nonconvergent-reconciliation`.
- `derivation-cycle-unresolved`.
- `uncertain-anomaly`.

A difference is technical debt only when an accepted condition supports that classification. Examples include an invariant or lens violation, a demonstrated maintenance or security cost, an unfinished migration, duplicated responsibility, a platform constraint, or an accepted-debt record.

## Divergence contract

```ts
export interface Divergence {
  id: EntityId;
  type: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: Confidence;
  leverage: number;
  status: "open" | "auto-fixed" | "planned" | "accepted-exception" | "dismissed" | "blocked";
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  conceptIds: EntityId[];
  requirementIds: EntityId[];
  scenarioIds: EntityId[];
  unitIds: EntityId[];
  ruleIds: EntityId[];
  evidence: EvidenceRef[];
  counterEvidence: EvidenceRef[];
  rationale: string;
  possibleIntentionality: string[];
  recommendedDisposition: string;
  repairStrategies: RepairStrategy[];
  coverageCaveat: string;
  semanticHash: ContentHash;
}
```

Every finding MUST explain why the expectation applies and which proof/coverage limitations prevent a stronger claim.

## Planning Surprise reconciliation

For executed plans, reconciliation MUST compare the planned Relevance Closure and Impact Closure with the semantic/code closure implied by the actual diff and observed mutations.

Unexpected impact is classified before it is treated as failure:

1. **legitimate newly discovered relationship** — propose the relationship/evidence for acceptance or derived indexing so future changes discover it earlier.
2. **legitimate scope expansion** — refresh/rebase the plan and require any newly applicable governance/validation.
3. **agent overreach** — repair or revert work outside the authorized semantic/write scope.
4. **analysis deficiency** — retain a Planning Surprise and improve the relevant analyzer, facet, relation, or relevance rule where justified.
5. **benign incidental mutation** — record why it does not alter semantic closure.

One surprise MUST NOT automatically become canonical truth. Promotion follows normal source-class, evidence, authority, and causal-independence rules.

---


## Exceptions and migrations

## Exceptions

An exception MUST include:

- stable ID/key.
- exact semantic selector.
- rule/lens/expectation being excepted.
- rationale.
- supporting evidence.
- owner.
- typed review/expiry trigger.
- invalidation conditions.
- optional remediation/exit criteria.

Broad path-wide suppressions SHOULD be rejected when a narrower semantic selector is available. Expired or invalidated exceptions re-enter divergence evaluation.

An exception MUST NOT mutate the underlying authority record to make a conflict disappear. It is an explicit scoped deviation.

## Migration overlays

Required phases:

```text
proposed
prepared
dual-running
cutover
cleanup
complete
rolled-back
```

Migration phase is selector-visible and may temporarily alter applicable rules, projection expectations, or compatibility obligations.

A migration definition MUST include:

- source and target lens references.
- entry and exit criteria.
- compatibility strategy.
- allowed temporary divergences.
- generated-output overlays, if any.
- validation obligations.
- rollback/compensation.
- cleanup residue detector.

Migration residue is determined from explicit exit criteria, not merely age.

---


