# Audit: Reconciliation and Change Requirements

## Scope

Reviewed only:

- `.planning/intel/requirements-parts/04-reconcile-change.md`
- `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md`
- `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md`
- `PROJECTOR_SPEC/07-change/semantic-change-compiler.md`
- `PROJECTOR_SPEC/07-change/plans.md`
- `PROJECTOR_SPEC/07-change/transactions-and-certificates.md`

The audit checked every source H1/H2 heading represented in the fragment, all normative MUST/SHOULD/MAY clauses, lifecycle phases and transitions, list members, enum/status literals, ordering constraints, proof/negative-space boundaries, exception and migration conditions, non-goals, checkboxes, IDs, and source-coverage mappings.

## Result

- **One high-confidence omission found and fixed.** The analyzer-failure requirement preserved unaffected observations and narrowed dependent conclusions, but did not carry the source's explicit independence guard: a failure in one capability must not invalidate a proof from another capability unless that proof depended on the failed capability. Added **COVR-026** immediately after the existing maximum `COVR-025` and mapped it to “Analyzer failure degradation”.
- No other omissions, weakened lifecycle transitions, missing list members, enum/status literals, order constraints, proof boundaries, exception/migration conditions, non-goals, or source headings were found.

## Evidence and remediation

### P1 — Analyzer failure could be read as invalidating unrelated proofs (fixed)

- **Source evidence:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md`, “Analyzer failure degradation” explicitly requires that a Markdown parsing failure not invalidate a proven package dependency edge unless that proof depended on Markdown.
- **Before:** `COVR-007` required preserving useful observations and lowering/widening dependent coverage, but did not state the explicit proof-independence constraint or its concrete edge case.
- **Fix:** `COVR-026` now states the capability-independence rule and the Markdown/package-dependency example, with the same source citation. This closes the false proof-invalidation gap without changing existing IDs.

## Validation performed

1. **Normal reconciliation path:** matched the declared `RECN-001` loop order against the source sequence, including reverse impact, Planning Surprise classification, migration/exception correlation, repair/reindex, SCC iteration, convergence verification, and receipt/certificate/report emission.
2. **Failure path:** matched digest/repetition, SCC budget, membership oscillation, repeated-repair, analyzer degradation, stale/open/unavailable proof boundaries, failure certificates, and recovery phases. The newly added COVR-026 covers the previously missing analyzer-isolation failure edge.
3. **Integration edge:** matched state-bound plan refresh/rebase and query-fingerprint behavior (`PLAN-015`–`PLAN-022`, `TXN-012`–`TXN-014`), canonical conflict blocking (`PLAN-023`, `TXN-018`), and receipt/certificate distinctions and failure artifacts (`CERT-001`–`CERT-009`).
4. **Structural checks:** 156 unique requirement/non-goal IDs across the fragment; each prefix is contiguous through its maximum (`COVR-026`, `RECN-030`, `CHNG-049`, `PLAN-024`, `TXN-018`, `CERT-009`); 150 unchecked v1 requirement boxes; 156 source citations; and 38 source-heading rows in the H1/H2 coverage table. No duplicate IDs were found.

## Residual risk and follow-up

This is a source-to-requirements document audit; it does not verify a runtime implementation or validator behavior. Runtime validation should exercise partial analyzer failure with both dependent and independent proof lanes, plus reconciliation restart and certificate emission, when those components exist.

