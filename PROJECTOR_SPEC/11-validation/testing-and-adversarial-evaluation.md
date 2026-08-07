# Testing and Adversarial Evaluation

## Testing and adversarial evaluation strategy

Testing must attack both implementation bugs and Projector's ability to become confidently self-consistent while wrong.

## Unit tests

Cover:

- canonical serialization and schema-defined semantic hashing.
- stable IDs, aliases, lineage, tombstones.
- fine-grained canonical semantic persistence and deterministic project-root digest construction.
- Requirement and Behavioral Scenario contracts and semantic hashing.
- Semantic Identity Resolution candidate ranking/outcome validation.
- Relevance Closure expansion, banding, provenance, budget termination, and dependency fingerprints.
- Analysis Facet activation without accidental governance.
- canonical schema migration.
- Zod/public-contract registry completeness.
- selectors and dependency-keyed cache invalidation.
- typed rule predicate composition/conflicts.
- lens overlap/composition.
- authority independence and reconsideration triggers.
- Architecture Concern materiality, promotion, and causal deduplication.
- scope-specific Decision Validity Assessment.
- decision overlap/SCC convergence.
- preference scope/composition and non-blocking type semantics.
- research freshness policy and current-option verification.
- decision consequence atomicity and deferral contracts.
- semantic-signature assurance.
- derivations/SCCs/backdating.
- Impact Rules and frontier widening.
- strict separation of pre-change Relevance Closure from post-delta Impact Closure.
- dependency-scoped `StateBinding` validation/rebinding after unrelated root changes.
- predicted-versus-observed impact comparison and Planning Surprise classification.
- transaction journal/recovery.
- risk/policy normalization.
- transform routing and upstream generated repair.
- coverage proof rules.
- plan rebase.
- receipts/certificates.
- Semantic Representation Profile compilation and canonical rebuild.
- Semantic Preservation Fingerprints across normative force, negation, cardinality, logical connectives, conditions, exceptions, scope, order/dependencies, behavioral step roles, and literals.
- controlled-technical style linting vs semantic-fidelity validation separation.
- tokenizer/profile overhead accounting and fallback selection.

## Property-based tests

Mandatory properties include:

- canonical serialization independent of object insertion order.
- splitting canonical entities into independent files does not alter semantic project-root identity.
- unrelated canonical/worktree changes do not invalidate a `StateBinding` whose value dependencies and query-result fingerprints remain unchanged.
- adding/changing a bound value dependency always invalidates or revalidates the affected binding.
- adding an entity/Relation/membership that changes a bound query result invalidates/revalidates the binding even when every previously returned entity hash is unchanged.
- changing a `StateQuerySpec` program/version or closure-sensitive result projection invalidates the corresponding query dependency.
- an empty query on an open/sampled/unavailable lane never upgrades a negative-space claim to proof.
- stable semantic hash excludes declared volatile metadata.
- deterministic derived IDs are stable across repeated indexing.
- hard-rule composition is order-independent.
- selector/lens/rule applicability is deterministic for fixed dependencies.
- lowering evidence/coverage cannot produce a stronger completion claim.
- increasing uncertainty cannot lower approval/risk requirements.
- idempotent transforms converge.
- exact reverse derivation dependencies are never lost.
- Relevance Closure never gains exact-impact authority merely from semantic-similarity score.
- identity-resolution renames/aliases cannot create a second identity for the same selected entity.
- alias/name-only changes alter discovery/canonical-document hashes but not semantic meaning hashes, and therefore refresh affected identity/relevance queries without staling meaning-only derivations.
- SCC invalidation/backdating reaches the same fixed point as a clean group recomputation.
- reconciliation terminates or emits an explicit non-convergence failure.
- rollback restores fixture-supported physical and canonical state.
- rebuilding SQLite from canonical inputs preserves semantic state.
- a Projector-caused conforming occurrence never becomes independent support for its causal lens/rule.
- changing only a Representation Profile never changes canonical semantic hashes of its source entities.
- a Representation Projection cannot validate when any required protected-dimension fingerprint differs.
- reducing text/token count cannot strengthen a fidelity/completion claim.
- profile selection is deterministic for fixed inputs, tokenizer profile, policy, and measured cost model.

## Golden and held-out fixture repositories

Training/development fixtures:

- `clean-monorepo`.
- `slop-monorepo`.
- `incomplete-refactor`.
- `copied-slop`.
- `cross-platform-product`.
- `external-surfaces`.
- `selector-membership`.
- `semantic-backdating`.
- `governance-cycle`.
- `transaction-crash`.
- `multiple-valid-implementations`.
- `generated-upstream`.
- `representation-semantic-drift`.
- `representation-token-economics`.
- `semantic-identity-overlap`.
- `cross-cutting-relevance`.
- `event-contract-relevance`.
- `scoped-state-binding`.
- `planning-surprise`.

Maintain **held-out** fixture repositories and mutation-generated variants whose exact anomalies are not encoded as one-off detectors. Release metrics MUST include held-out performance.

## Anti-self-deception tests

Mandatory adversarial classes:

1. Canonical rebuild closure.
2. Semantic-signature insufficiency.
3. Shared analyzer bug fooling both incremental and rebuild paths.
4. Crash at every semantic transaction phase.
5. Branch/merge canonical-governance conflict.
6. Projector-endogenous authority evidence.
7. Governance cycle and non-convergence.
8. Open-world completeness refusal.
9. Multiple valid handwritten implementations.
10. SCC backdating.
11. Model resampling/idempotence.
12. Correlated/self-authored validator evidence.
13. Generated-output upstream repair.
14. Localized cache performance.
15. Projector engine/signature-profile upgrade invalidation.
16. Misleading local precedent.
17. Mutation-generated near misses.
18. Unsupported analyzer capability degradation.
19. Semantic identity duplicate/overlap creation under synonymous requests.
20. Cross-cutting governing semantics hidden outside the touched package.
21. Relevance over-expansion returning effectively project-wide context.
22. Event/contract consumer omission despite deterministic topology.
23. Unrelated root-state mutation incorrectly staling scoped work.
24. Missing StateBinding value dependency incorrectly preserving stale work.
25. Missing negative-space/query dependency incorrectly preserving stale relevance after a newly matching entity/edge appears.
26. Query-program/version drift silently preserving an old result fingerprint.
27. Open/sampled discovery lane incorrectly proving absence.
28. Predicted-versus-observed impact surprise and relationship learning.
29. Representation modal/negation/cardinality/logical-connective/condition/exception drift.
30. Token compression that passes style lint while changing semantics.
31. Net-negative representation overhead and fallback selection.
32. Human/agent/machine/Gherkin projections with different text but one canonical semantic source.

## Host tests

Use fake host processes and golden capability/packet/context outputs. Default tests MUST NOT require paid models or installed Codex/Claude hosts.

Test stale dependency-bound capability rejection, safe rebinding after unrelated root changes, out-of-scope write detection, interrupted session recovery, and direct host writes observed outside Projector tools.

## Live evaluation

Live-model/provider evaluation is opt-in, budgeted, reproducible at the input/program/schema level, and graded structurally. It MUST NOT be the only test for semantic behavior.

---


