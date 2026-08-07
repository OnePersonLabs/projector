# Benchmarks and Redesign Criteria

## Benchmarks and release metrics

Required metrics:

- semantic-identity reuse/create/split accuracy and duplicate/overlap prevention.
- known-relevant semantic entity recall during pre-change discovery.
- irrelevant relevance-context expansion.
- required-change recall.
- irrelevant blast-radius expansion.
- divergence precision/recall.
- secondary projection omissions.
- deterministic event/contract consumer omissions.
- Planning Surprise rate attributable to missed relevance.
- accepted learned-relationship precision.
- intentional-variant false-positive rate.
- pattern violations introduced.
- human review time.
- deterministic mutation percentage.
- model tokens/cost.
- context-size reduction relative to both repository size and full semantic-graph size.
- direct/governing/consequence/possible band distribution.
- scoped-StateBinding false-stale and false-current rates.
- clean-vs-incremental agreement.
- independent-validation coverage.
- receipt/certificate accuracy.
- repeated-change marginal cost.
- recovery from deliberate agent slop.
- transaction recovery success.
- exact/validated vs heuristic backdating rates.
- semantic-model complexity/churn.
- held-out repository generalization.
- protected-dimension representation fidelity.
- representation compression ratio and net token savings after profile overhead.
- compact-context task/conformance delta versus uncompressed/human-technical baselines.
- workload-scoped instruction efficiency.

Initial engineering gates:

- `>=95%` recall on fixture-known required refactor surfaces where the relevant dependency lanes are closed/bounded.
- `>=95%` recall of fixture-known governing semantic entities for supported change classes on held-out/high-coverage fixtures.
- `<10%` irrelevant impact expansion on high-coverage local fixtures.
- `<20%` irrelevant semantic-context expansion on relevance fixtures after excluding explicitly requested possible-band exploration.
- zero seeded duplicate canonical identities when an existing identity owns the synonymous requested behavior.
- `>=50%` deterministic mutation rate for supported pattern migrations.
- zero undetected seeded hard-pattern violations after reconciliation.
- `>=2x` context-size reduction for supported scoped tasks.
- zero material state-changing output on second identical reconcile.
- zero stale-plan/capsule rejection caused solely by an unrelated root-state change when all explicit binding dependencies and bound query-result fingerprints are unchanged.
- zero successful stale binding validations when a required semantic/physical dependency changed.
- zero false `proven-within-boundary` claims in open/sampled/unavailable fixtures.
- 100% recovery or deterministic recovery-required classification for injected transaction crashes.
- no authority-score increase from same-lens Projector-generated conformity.
- no silent preservation of old derivation proof after incompatible engine/signature-profile upgrades.
- zero accepted Representation Projections with a known protected-dimension mismatch.
- do not enable compact agent context by default when measured profile overhead is net-negative. Also disable it when measured task/conformance quality materially regresses.

Fixture success is insufficient by itself. Publish held-out/mutation-generated performance before making broad accuracy claims.

---


## Kill / redesign criteria

Reconsider a subsystem or the architecture if:

- semantic-model maintenance costs approach or exceed ordinary agent review cost.
- high-coverage exact invalidation still misses known dependencies systematically.
- canonical state cannot rebuild without hidden local history.
- semantic-signature profiles routinely overclaim assurance.
- independent conformance cannot distinguish Projector's own shared bugs.
- governance frequently cycles or requires ad hoc evaluation ordering.
- branch/canonical conflicts make ordinary collaboration impractical.
- rule conflicts require manual prompt surgery.
- ordinary repository instructions plus codemods nearly match Projector on held-out benchmarks.
- Execution Capsules remain repository-sized or routinely approach full semantic-graph size.
- Relevance Closure requires package-tree duplication of cross-cutting semantics to achieve acceptable recall.
- semantic identity resolution still permits recurring synonymous/overlapping canonical entities at rates that require manual cleanup.
- scoped state binding cannot avoid global false-stale invalidation without unsafe missed dependencies.
- compact-context profiles routinely save tokens only by weakening protected semantics.
- representation-profile overhead is net-negative on the workloads where it is enabled.
- compressed context materially reduces task/conformance success compared with the source representation.
- authority becomes dominated by Projector-endogenous evidence.
- divergence precision is too low to remain actionable.
- generated outputs routinely require forbidden direct patches.
- transaction recovery cannot guarantee an honest state after interruption.
- adoption requires manual ontology authoring.
- semantic model/rule complexity grows without falling marginal reasoning/review cost.

Kill criteria are design feedback, not failure to be hidden by adding more rules.

---


