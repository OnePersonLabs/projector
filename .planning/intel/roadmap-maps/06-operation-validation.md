# Operation and Validation Roadmap Map

Every unchecked v1 requirement from `requirements-parts/06-operation-validation.md` is assigned exactly once to a locked phase. Cross-cutting tests land at the earliest phase where their subject is complete; release and kill gates land in Phase 14.

## Phase 01 — Slice0 foundation

Success-criteria contribution: The foundation is secure, deterministic, rebuildable, and observable enough to initialize and inspect safely.

- **CLI-001** → Phase 01 — Slice0 foundation first owns the CLI surface for `projector init`.
- **CLI-002** → Phase 01 — Slice0 foundation first owns the CLI surface for `projector status`.
- **SEC-001** → Phase 01 — Slice0 foundation first owns security controls that apply from initialization, not only during agent execution.
- **SEC-002** → Phase 01 — Slice0 foundation first owns Repository docs/comments, commit messages, issue text, model output, package metadata, web pages, and external records MUST be treated as data and MUST NOT grant tools, alter policy, authorize writes, or override system/developer instructions through their content.
- **SEC-006** → Phase 01 — Slice0 foundation first owns canonical paths that be POSIX-style relative paths.
- **SEC-007** → Phase 01 — Slice0 foundation first owns filesystem operations that resolve through a root-constrained path utility that rejects `..` escapes after normalization.
- **SEC-008** → Phase 01 — Slice0 foundation first owns the root-constrained path utility MUST validate drive/UNC semantics on Windows.
- **SEC-009** → Phase 01 — Slice0 foundation first owns the root-constrained path utility MUST resolve symlinks according to explicit policy.
- **SEC-010** → Phase 01 — Slice0 foundation first owns the root-constrained path utility MUST prevent writes through symlinks outside the governed root.
- **SEC-011** → Phase 01 — Slice0 foundation first owns the root-constrained path utility MUST record the real target for safety checks.
- **SEC-012** → Phase 01 — Slice0 foundation first owns the root-constrained path utility MUST treat case sensitivity according to the actual filesystem.
- **METR-002** → Phase 01 — Slice0 foundation first owns run telemetry for the canonical config digest.
- **METR-003** → Phase 01 — Slice0 foundation first owns run telemetry for engine/toolchain versions.
- **TEST-002** → Phase 01 — Slice0 foundation first owns unit coverage of canonical serialization and schema-defined semantic hashing.
- **TEST-003** → Phase 01 — Slice0 foundation first owns unit coverage of stable IDs, aliases, lineage, and tombstones.
- **TEST-004** → Phase 01 — Slice0 foundation first owns unit coverage of fine-grained canonical semantic persistence and deterministic project-root digest construction.
- **TEST-037** → Phase 01 — Slice0 foundation first owns the property that canonical serialization is independent of object insertion order.
- **TEST-038** → Phase 01 — Slice0 foundation first owns the property that splitting canonical entities into independent files does not alter semantic project-root identity.
- **TEST-044** → Phase 01 — Slice0 foundation first owns the property that stable semantic hash excludes declared volatile metadata.
- **TEST-058** → Phase 01 — Slice0 foundation first owns the property that rebuilding SQLite from canonical inputs preserves semantic state.
- **EVAL-004** → Phase 01 — Slice0 foundation first owns adversarial coverage of canonical rebuild closure.

## Phase 02 — Slice1 misplaced-script

Success-criteria contribution: The first vertical slice proves misplaced-script detection against copied-slop fixtures.

- **EVAL-051** → Phase 02 — Slice1 misplaced-script first owns the fixture `copied-slop`.

## Phase 03 — Slice2 signatures/invalidation/backdating

Success-criteria contribution: Signatures, scoped invalidation, rebinding, SCC fixed points, and semantic backdating are independently testable.

- **CLI-010** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the CLI surface for `projector impact <change-or-target>`.
- **SEC-026** → Phase 03 — Slice2 signatures/invalidation/backdating first owns approval, Execution Capsule, MCP capability, and Work Packet bindings MUST expire when a dependency in their `StateBinding` changes.
- **SEC-027** → Phase 03 — Slice2 signatures/invalidation/backdating first owns approval, Execution Capsule, MCP capability, and Work Packet bindings MUST expire when Projector cannot prove a query dependency unchanged.
- **SEC-028** → Phase 03 — Slice2 signatures/invalidation/backdating first owns changed global `StateDigest` MUST trigger binding validation and MUST NOT cause automatic invalidation by itself.
- **SEC-029** → Phase 03 — Slice2 signatures/invalidation/backdating first owns stale approval MUST NOT be replayed against materially different relevant state.
- **METR-004** → Phase 03 — Slice2 signatures/invalidation/backdating first owns run telemetry for Git, worktree, and canonical state digests.
- **METR-016** → Phase 03 — Slice2 signatures/invalidation/backdating first owns instrumentation for semantic backdating hit rate by assurance class.
- **METR-017** → Phase 03 — Slice2 signatures/invalidation/backdating first owns instrumentation for invalidation fan-out and frontier size.
- **METR-026** → Phase 03 — Slice2 signatures/invalidation/backdating first owns instrumentation for downstream work avoided by exact/validated equality.
- **TEST-011** → Phase 03 — Slice2 signatures/invalidation/backdating first owns unit coverage of selectors and dependency-keyed cache invalidation.
- **TEST-021** → Phase 03 — Slice2 signatures/invalidation/backdating first owns unit coverage of semantic-signature assurance.
- **TEST-022** → Phase 03 — Slice2 signatures/invalidation/backdating first owns unit coverage of derivations/SCCs/backdating.
- **TEST-025** → Phase 03 — Slice2 signatures/invalidation/backdating first owns unit coverage of dependency-scoped `StateBinding` validation/rebinding after unrelated root changes.
- **TEST-039** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the property that unrelated canonical/worktree changes do not invalidate a `StateBinding` whose value dependencies and query-result fingerprints remain unchanged.
- **TEST-040** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the property that adding/changing a bound value dependency always invalidates or revalidates the affected binding.
- **TEST-041** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the property that adding an entity/Relation/membership that changes a bound query result invalidates/revalidates the binding even when every previously returned entity hash is unchanged.
- **TEST-042** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the property that changing a `StateQuerySpec` program/version or closure-sensitive result projection invalidates the corresponding query dependency.
- **TEST-055** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the property that SCC invalidation/backdating reaches the same fixed point as a clean group recomputation.
- **EVAL-055** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the fixture `semantic-backdating`.
- **EVAL-065** → Phase 03 — Slice2 signatures/invalidation/backdating first owns the fixture `scoped-state-binding`.
- **EVAL-005** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of semantic-signature insufficiency.
- **EVAL-013** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of SCC backdating.
- **EVAL-017** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of localized cache performance.
- **EVAL-018** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of Projector engine/signature-profile upgrade invalidation.
- **EVAL-026** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of unrelated root-state mutation incorrectly staling scoped work.
- **EVAL-027** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of a missing `StateBinding` value dependency incorrectly preserving stale work.
- **EVAL-028** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of a missing negative-space/query dependency incorrectly preserving stale relevance after a newly matching entity/edge appears.
- **EVAL-029** → Phase 03 — Slice2 signatures/invalidation/backdating first owns adversarial coverage of query-program/version drift silently preserving an old result fingerprint.

## Phase 04 — Slice3 intent/identity/relevance

Success-criteria contribution: Intent, identity, relevance, impact separation, and planning-surprise behavior have executable tests and telemetry.

- **CLI-004** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector explain <target>`.
- **CLI-005** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector resolve <meaning-or-target>`.
- **CLI-006** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector relevance <intent-or-target>`.
- **CLI-007** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector requirements [<selector>]`.
- **CLI-008** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector scenarios [<selector>]`.
- **CLI-009** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector context --task <task>`.
- **CLI-016** → Phase 04 — Slice3 intent/identity/relevance first owns the CLI surface for `projector change <intent>`.
- **SEC-003** → Phase 04 — Slice3 intent/identity/relevance first owns sensitive-data handling that be removed or replaced with typed placeholders before model-context construction.
- **METR-018** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for semantic-identity resolution candidate count, reuse/create/split rates, and later duplicate/overlap findings.
- **METR-019** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for relevance recall/irrelevant-expansion on evaluated changes.
- **METR-020** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for direct/governing/consequence/possible context-band sizes.
- **METR-021** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for planning-surprise rate and accepted learned relationships.
- **METR-022** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for context tokens versus relevant-subgraph size versus repository size.
- **METR-023** → Phase 04 — Slice3 intent/identity/relevance first owns instrumentation for tokens per accepted semantic change.
- **METR-035** → Phase 04 — Slice3 intent/identity/relevance first owns measurement of active concept count.
- **TEST-005** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of Requirement and Behavioral Scenario contracts and semantic hashing.
- **TEST-006** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of Semantic Identity Resolution candidate ranking/outcome validation.
- **TEST-007** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of Relevance Closure expansion, banding, provenance, budget termination, and dependency fingerprints.
- **TEST-008** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of Analysis Facet activation without accidental governance.
- **TEST-023** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of Impact Rules and frontier widening.
- **TEST-024** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of strict separation of pre-change Relevance Closure from post-delta Impact Closure.
- **TEST-026** → Phase 04 — Slice3 intent/identity/relevance first owns unit coverage of predicted-versus-observed impact comparison and Planning Surprise classification.
- **TEST-052** → Phase 04 — Slice3 intent/identity/relevance first owns the property that Relevance Closure never gains exact-impact authority merely from semantic-similarity score.
- **TEST-053** → Phase 04 — Slice3 intent/identity/relevance first owns the property that identity-resolution renames/aliases cannot create a second identity for the same selected entity.
- **TEST-054** → Phase 04 — Slice3 intent/identity/relevance first owns the property that alias/name-only changes alter discovery/canonical-document hashes but not semantic meaning hashes, and therefore refresh affected identity/relevance queries without staling meaning-only derivations.
- **EVAL-054** → Phase 04 — Slice3 intent/identity/relevance first owns the fixture `selector-membership`.
- **EVAL-062** → Phase 04 — Slice3 intent/identity/relevance first owns the fixture `semantic-identity-overlap`.
- **EVAL-063** → Phase 04 — Slice3 intent/identity/relevance first owns the fixture `cross-cutting-relevance`.
- **EVAL-066** → Phase 04 — Slice3 intent/identity/relevance first owns the fixture `planning-surprise`.
- **EVAL-022** → Phase 04 — Slice3 intent/identity/relevance first owns adversarial coverage of semantic identity duplicate/overlap creation under synonymous requests.
- **EVAL-023** → Phase 04 — Slice3 intent/identity/relevance first owns adversarial coverage of cross-cutting governing semantics hidden outside the touched package.
- **EVAL-024** → Phase 04 — Slice3 intent/identity/relevance first owns adversarial coverage of Relevance over-expansion returning effectively project-wide context.
- **EVAL-031** → Phase 04 — Slice3 intent/identity/relevance first owns adversarial coverage of predicted-versus-observed impact surprise and relationship learning.

## Phase 05 — Slice4 governance/representations

Success-criteria contribution: Governance and representation projections compose deterministically, preserve protected semantics, and expose their economics.

- **CLI-013** → Phase 05 — Slice4 governance/representations first owns the CLI surface for `projector reconcile`.
- **CLI-022** → Phase 05 — Slice4 governance/representations first owns the CLI surface for the `projector exception ...` command family.
- **CLI-023** → Phase 05 — Slice4 governance/representations first owns the CLI surface for the `projector lens ...` command family.
- **CLI-024** → Phase 05 — Slice4 governance/representations first owns the CLI surface for the `projector rule ...` command family.
- **SEC-004** → Phase 05 — Slice4 governance/representations first owns sensitive-data handling that be removed or replaced with typed placeholders before model-assisted representation rendering.
- **METR-015** → Phase 05 — Slice4 governance/representations first owns instrumentation for selector/rule/derivation cache hit rate.
- **METR-030** → Phase 05 — Slice4 governance/representations first owns instrumentation for source versus projected context tokens by Representation Profile.
- **METR-031** → Phase 05 — Slice4 governance/representations first owns instrumentation for representation-profile overhead tokens and net token delta.
- **METR-032** → Phase 05 — Slice4 governance/representations first owns instrumentation for representation fallback/rejection rate.
- **METR-033** → Phase 05 — Slice4 governance/representations first owns instrumentation for protected-dimension fidelity failures by category.
- **METR-034** → Phase 05 — Slice4 governance/representations first owns instrumentation for task/conformance outcome deltas for compact versus uncompressed context on benchmarked workloads.
- **METR-036** → Phase 05 — Slice4 governance/representations first owns measurement of active lens/rule count.
- **METR-037** → Phase 05 — Slice4 governance/representations first owns measurement of exceptions per lens/rule.
- **METR-038** → Phase 05 — Slice4 governance/representations first owns measurement of average rule pressure per unit.
- **METR-039** → Phase 05 — Slice4 governance/representations first owns measurement of canonical-state churn.
- **METR-040** → Phase 05 — Slice4 governance/representations first owns measurement of model-maintenance time/cost.
- **METR-041** → Phase 05 — Slice4 governance/representations first owns measurement of the number of governance entities removed by simplification.
- **METR-042** → Phase 05 — Slice4 governance/representations first owns representation reporting of **Instruction Efficiency** only with an explicit workload-specific numerator, such as validated task success, passed conformance obligations, or accepted semantic changes.
- **METR-043** → Phase 05 — Slice4 governance/representations first owns instruction efficiency SHOULD compare `validated behavioral/conformance utility / total instruction/context tokens consumed (including representation overhead and retries)`.
- **METR-044** → Phase 05 — Slice4 governance/representations first owns instruction-efficiency constraints that NOT reward shorter output that loses required semantic content; correctness/preservation MUST be a constraint before token optimization and MUST NOT be traded to zero.
- **TEST-012** → Phase 05 — Slice4 governance/representations first owns unit coverage of typed rule predicate composition/conflicts.
- **TEST-013** → Phase 05 — Slice4 governance/representations first owns unit coverage of lens overlap/composition.
- **TEST-014** → Phase 05 — Slice4 governance/representations first owns unit coverage of authority independence and reconsideration triggers.
- **TEST-033** → Phase 05 — Slice4 governance/representations first owns unit coverage of Semantic Representation Profile compilation and canonical rebuild.
- **TEST-034** → Phase 05 — Slice4 governance/representations first owns unit coverage of Semantic Preservation Fingerprints across normative force, negation, cardinality, logical connectives, conditions, exceptions, scope, order/dependencies, behavioral step roles, and literals.
- **TEST-035** → Phase 05 — Slice4 governance/representations first owns unit coverage of the separation of controlled-technical style linting from semantic-fidelity validation.
- **TEST-036** → Phase 05 — Slice4 governance/representations first owns unit coverage of tokenizer/profile overhead accounting and fallback selection.
- **TEST-046** → Phase 05 — Slice4 governance/representations first owns the property that hard-rule composition is order-independent.
- **TEST-047** → Phase 05 — Slice4 governance/representations first owns the property that selector/lens/rule applicability is deterministic for fixed dependencies.
- **TEST-059** → Phase 05 — Slice4 governance/representations first owns the property that a Projector-caused conforming occurrence never becomes independent support for its causal lens/rule.
- **TEST-060** → Phase 05 — Slice4 governance/representations first owns the property that changing only a Representation Profile never changes canonical semantic hashes of its source entities.
- **TEST-061** → Phase 05 — Slice4 governance/representations first owns the property that a Representation Projection cannot validate when any required protected-dimension fingerprint differs.
- **TEST-062** → Phase 05 — Slice4 governance/representations first owns the property that reducing text/token count cannot strengthen a fidelity/completion claim.
- **TEST-063** → Phase 05 — Slice4 governance/representations first owns the property that profile selection is deterministic for fixed inputs, tokenizer profile, policy, and measured cost model.
- **EVAL-056** → Phase 05 — Slice4 governance/representations first owns the fixture `governance-cycle`.
- **EVAL-060** → Phase 05 — Slice4 governance/representations first owns the fixture `representation-semantic-drift`.
- **EVAL-061** → Phase 05 — Slice4 governance/representations first owns the fixture `representation-token-economics`.
- **EVAL-008** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of branch/merge canonical-governance conflict.
- **EVAL-009** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of Projector-endogenous authority evidence.
- **EVAL-010** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of governance cycle and non-convergence.
- **EVAL-032** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of Representation modal/negation/cardinality/logical-connective/condition/exception drift.
- **EVAL-033** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of token compression that passes style lint while changing semantics.
- **EVAL-034** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of net-negative representation overhead and fallback selection.
- **EVAL-035** → Phase 05 — Slice4 governance/representations first owns adversarial coverage of human/agent/machine/Gherkin projections with different text but one canonical semantic source.

## Phase 06 — Slice5 architecture

Success-criteria contribution: Architecture concerns, decisions, preferences, and consequence handling are validated as one coherent decision system.

- **CLI-025** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector concerns`.
- **CLI-026** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector decisions`.
- **CLI-027** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector decision explain <id>`.
- **CLI-028** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector decision resolve <concern-id>`.
- **CLI-029** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector preferences`.
- **CLI-030** → Phase 06 — Slice5 architecture first owns the CLI surface for `projector preference adopt <key>`.
- **METR-009** → Phase 06 — Slice5 architecture first owns run telemetry for decisions and authority changes.
- **TEST-015** → Phase 06 — Slice5 architecture first owns unit coverage of Architecture Concern materiality, promotion, and causal deduplication.
- **TEST-016** → Phase 06 — Slice5 architecture first owns unit coverage of scope-specific Decision Validity Assessment.
- **TEST-017** → Phase 06 — Slice5 architecture first owns unit coverage of decision overlap/SCC convergence.
- **TEST-018** → Phase 06 — Slice5 architecture first owns unit coverage of preference scope/composition and non-blocking type semantics.
- **TEST-019** → Phase 06 — Slice5 architecture first owns unit coverage of research freshness policy and current-option verification.
- **TEST-020** → Phase 06 — Slice5 architecture first owns unit coverage of decision consequence atomicity and deferral contracts.
- **EVAL-058** → Phase 06 — Slice5 architecture first owns the fixture `multiple-valid-implementations`.
- **EVAL-012** → Phase 06 — Slice5 architecture first owns adversarial coverage of multiple valid handwritten implementations.

## Phase 07 — Slice6 analyzers/topology

Success-criteria contribution: Analyzers and deterministic topology degrade honestly and are challenged by cross-platform and event/contract fixtures.

- **METR-005** → Phase 07 — Slice6 analyzers/topology first owns run telemetry for graph revision.
- **METR-006** → Phase 07 — Slice6 analyzers/topology first owns run telemetry for analyzers and capability failures.
- **METR-028** → Phase 07 — Slice6 analyzers/topology first owns instrumentation for analyzer failure rate.
- **TEST-045** → Phase 07 — Slice6 analyzers/topology first owns the property that deterministic derived IDs are stable across repeated indexing.
- **EVAL-048** → Phase 07 — Slice6 analyzers/topology first owns the fixture `clean-monorepo`.
- **EVAL-052** → Phase 07 — Slice6 analyzers/topology first owns the fixture `cross-platform-product`.
- **EVAL-064** → Phase 07 — Slice6 analyzers/topology first owns the fixture `event-contract-relevance`.
- **EVAL-006** → Phase 07 — Slice6 analyzers/topology first owns adversarial coverage of a shared analyzer bug fooling both incremental and rebuild paths.
- **EVAL-019** → Phase 07 — Slice6 analyzers/topology first owns adversarial coverage of misleading local precedent.
- **EVAL-020** → Phase 07 — Slice6 analyzers/topology first owns adversarial coverage of mutation-generated near misses.
- **EVAL-021** → Phase 07 — Slice6 analyzers/topology first owns adversarial coverage of unsupported analyzer capability degradation.
- **EVAL-025** → Phase 07 — Slice6 analyzers/topology first owns adversarial coverage of event/contract consumer omission despite deterministic topology.

## Phase 08 — Slice7 coverage/completion

Success-criteria contribution: Coverage, evidence independence, completion monotonicity, receipts, and open-world refusal are enforceable.

- **CLI-011** → Phase 08 — Slice7 coverage/completion first owns the CLI surface for `projector coverage`.
- **CLI-012** → Phase 08 — Slice7 coverage/completion first owns the CLI surface for `projector complete`.
- **METR-011** → Phase 08 — Slice7 coverage/completion first owns run telemetry for validations and evidence lanes.
- **TEST-030** → Phase 08 — Slice7 coverage/completion first owns unit coverage of coverage proof rules.
- **TEST-032** → Phase 08 — Slice7 coverage/completion first owns unit coverage of receipts/certificates.
- **TEST-043** → Phase 08 — Slice7 coverage/completion first owns the property that an empty query on an open/sampled/unavailable lane never upgrades a negative-space claim to proof.
- **TEST-048** → Phase 08 — Slice7 coverage/completion first owns the property that lowering evidence/coverage cannot produce a stronger completion claim.
- **EVAL-011** → Phase 08 — Slice7 coverage/completion first owns adversarial coverage of open-world completeness refusal.
- **EVAL-015** → Phase 08 — Slice7 coverage/completion first owns adversarial coverage of correlated/self-authored validator evidence.
- **EVAL-030** → Phase 08 — Slice7 coverage/completion first owns adversarial coverage of an open/sampled discovery lane incorrectly proving absence.

## Phase 09 — Slice8 compiler/executor

Success-criteria contribution: Policy-normalized planning and execution are transactional, bounded, recoverable, and idempotent.

- **CLI-017** → Phase 09 — Slice8 compiler/executor first owns the CLI surface for `projector plan <change>`.
- **CLI-018** → Phase 09 — Slice8 compiler/executor first owns the CLI surface for `projector plan rebase <plan>`.
- **CLI-019** → Phase 09 — Slice8 compiler/executor first owns the CLI surface for `projector apply <plan>`.
- **CLI-020** → Phase 09 — Slice8 compiler/executor first owns the CLI surface for `projector recover`.
- **CLI-036** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--format text|json|md|sarif`.
- **CLI-037** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--mode observe|guide|govern|autonomous|salvage`.
- **CLI-038** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--audit-only`.
- **CLI-039** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--scope <selector>`.
- **CLI-040** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--non-interactive`.
- **CLI-041** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--offline`.
- **CLI-042** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--dry-run`.
- **CLI-043** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--budget-tokens <n>`.
- **CLI-044** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--budget-cost <amount>`.
- **CLI-045** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--confidence-threshold <0..1>`.
- **CLI-046** → Phase 09 — Slice8 compiler/executor first owns the friendly flag `--verbose`.
- **CLI-047** → Phase 09 — Slice8 compiler/executor first owns every command and flag MUST normalize to one internal `ExecutionPolicy`; aliases such as `--audit-only` MUST map to equivalent policy fields.
- **CLI-048** → Phase 09 — Slice8 compiler/executor first owns Contradictory flags MUST be rejected.
- **CLI-049** → Phase 09 — Slice8 compiler/executor first owns exit code `0` MUST mean success / no blocking findings.
- **CLI-050** → Phase 09 — Slice8 compiler/executor first owns exit code `1` MUST mean command failure.
- **CLI-051** → Phase 09 — Slice8 compiler/executor first owns exit code `2` MUST mean blocking divergence/invariant/governance failure.
- **CLI-052** → Phase 09 — Slice8 compiler/executor first owns exit code `3` MUST mean approval required.
- **CLI-053** → Phase 09 — Slice8 compiler/executor first owns exit code `4` MUST mean incomplete coverage under requested strictness.
- **CLI-054** → Phase 09 — Slice8 compiler/executor first owns exit code `5` MUST mean required surface unavailable.
- **CLI-055** → Phase 09 — Slice8 compiler/executor first owns exit code `6` MUST mean rebuild/nondeterminism/corruption/recovery failure.
- **CLI-056** → Phase 09 — Slice8 compiler/executor first owns exit code `7` MUST mean budget exhausted with resumable state.
- **MODE-001** → Phase 09 — Slice8 compiler/executor first owns mode presets that be friendly presets over `ExecutionPolicy` and MUST NOT create separate semantic behavior.
- **MODE-002** → Phase 09 — Slice8 compiler/executor first owns observe mode behavior that permit read-only inference/reporting and MUST NOT mutate the repository or canonical state.
- **MODE-003** → Phase 09 — Slice8 compiler/executor first owns guide mode behavior that compile context, warn, reconcile, and offer plans; only immutable safety boundaries may block.
- **MODE-004** → Phase 09 — Slice8 compiler/executor first owns guide mode behavior that be the default after `init`.
- **MODE-005** → Phase 09 — Slice8 compiler/executor first owns govern mode behavior that block representable hard invariant violations.
- **MODE-006** → Phase 09 — Slice8 compiler/executor first owns govern mode behavior that block unapproved write-scope expansion.
- **MODE-007** → Phase 09 — Slice8 compiler/executor first owns govern mode behavior that block stale-state execution.
- **MODE-008** → Phase 09 — Slice8 compiler/executor first owns govern mode behavior that block completion with unexplained governed changes.
- **MODE-009** → Phase 09 — Slice8 compiler/executor first owns autonomous mode behavior that execute policy-authorized, state-bound plans only until completion, ambiguity, verification failure, budget, risk ceiling, or approval boundary.
- **MODE-012** → Phase 09 — Slice8 compiler/executor first owns changing mode behavior that NOT change what Projector believes the repository means; it changes only what actions are permitted automatically.
- **SEC-013** → Phase 09 — Slice8 compiler/executor first owns command execution that use explicit argv arrays where possible.
- **SEC-014** → Phase 09 — Slice8 compiler/executor first owns command execution that NOT shell-interpolate untrusted values.
- **SEC-015** → Phase 09 — Slice8 compiler/executor first owns command execution that declare cwd and read/write scope.
- **SEC-016** → Phase 09 — Slice8 compiler/executor first owns command execution that declare network/environment keys.
- **SEC-017** → Phase 09 — Slice8 compiler/executor first owns command execution that have a timeout/resource budget.
- **SEC-018** → Phase 09 — Slice8 compiler/executor first owns command risk that be included in risk.
- **SEC-019** → Phase 09 — Slice8 compiler/executor first owns mutation policy that normally require Git; mutation without Git is allowed only when `--unsafe-no-git` is explicitly provided.
- **SEC-023** → Phase 09 — Slice8 compiler/executor first owns failed validation behavior that NOT auto-merge worktrees.
- **METR-001** → Phase 09 — Slice8 compiler/executor first owns run telemetry for the command and resolved `ExecutionPolicy`.
- **METR-010** → Phase 09 — Slice8 compiler/executor first owns run telemetry for transforms/agent operations.
- **METR-012** → Phase 09 — Slice8 compiler/executor first owns run telemetry for transaction journal/recovery events.
- **METR-013** → Phase 09 — Slice8 compiler/executor first owns run telemetry for duration and errors.
- **METR-014** → Phase 09 — Slice8 compiler/executor first owns instrumentation for deterministic compute.
- **METR-024** → Phase 09 — Slice8 compiler/executor first owns instrumentation for deterministic mutation percentage.
- **METR-025** → Phase 09 — Slice8 compiler/executor first owns instrumentation for repeated-change marginal cost.
- **METR-027** → Phase 09 — Slice8 compiler/executor first owns instrumentation for transaction rollback/recovery rate.
- **TEST-027** → Phase 09 — Slice8 compiler/executor first owns unit coverage of transaction journal/recovery.
- **TEST-028** → Phase 09 — Slice8 compiler/executor first owns unit coverage of risk/policy normalization.
- **TEST-031** → Phase 09 — Slice8 compiler/executor first owns unit coverage of plan rebase.
- **TEST-049** → Phase 09 — Slice8 compiler/executor first owns the property that increasing uncertainty cannot lower approval/risk requirements.
- **TEST-050** → Phase 09 — Slice8 compiler/executor first owns the property that idempotent transforms converge.
- **TEST-051** → Phase 09 — Slice8 compiler/executor first owns the property that exact reverse derivation dependencies are never lost.
- **TEST-056** → Phase 09 — Slice8 compiler/executor first owns the property that reconciliation terminates or emits an explicit non-convergence failure.
- **TEST-057** → Phase 09 — Slice8 compiler/executor first owns the property that rollback restores fixture-supported physical and canonical state.
- **EVAL-050** → Phase 09 — Slice8 compiler/executor first owns the fixture `incomplete-refactor`.
- **EVAL-057** → Phase 09 — Slice8 compiler/executor first owns the fixture `transaction-crash`.
- **EVAL-007** → Phase 09 — Slice8 compiler/executor first owns adversarial coverage of a crash at every semantic transaction phase.
- **EVAL-014** → Phase 09 — Slice8 compiler/executor first owns adversarial coverage of model resampling/idempotence.
- **EVAL-041** → Phase 09 — Slice8 compiler/executor first owns host tests that test interrupted session recovery.

## Phase 10 — Slice9 hosts/MCP

Success-criteria contribution: Host and MCP execution is capability-bound, fake-host testable, recoverable, and safe without paid providers.

- **CLI-031** → Phase 10 — Slice9 hosts/MCP first owns the CLI surface for `projector run codex -- ...`.
- **CLI-032** → Phase 10 — Slice9 hosts/MCP first owns the CLI surface for `projector run claude -- ...`.
- **CLI-033** → Phase 10 — Slice9 hosts/MCP first owns the CLI surface for `projector mcp`.
- **SEC-020** → Phase 10 — Slice9 hosts/MCP first owns external-write authorization that require both adapter capability and plan-bound approval/capability.
- **SEC-021** → Phase 10 — Slice9 hosts/MCP first owns R3/R4 external writes that default to explicit approval.
- **SEC-022** → Phase 10 — Slice9 hosts/MCP first owns R4 policy that never be autonomous in 1.x.
- **METR-007** → Phase 10 — Slice9 hosts/MCP first owns run telemetry for model calls, purpose, cache/replay status, and token/cost metadata where available.
- **METR-029** → Phase 10 — Slice9 hosts/MCP first owns instrumentation for model inference reuse rate.
- **EVAL-036** → Phase 10 — Slice9 hosts/MCP first owns host tests that use fake host processes and golden capability/packet/context outputs.
- **EVAL-037** → Phase 10 — Slice9 hosts/MCP first owns default tests that NOT require paid models or installed Codex/Claude hosts.
- **EVAL-038** → Phase 10 — Slice9 hosts/MCP first owns host tests that test stale dependency-bound capability rejection.
- **EVAL-039** → Phase 10 — Slice9 hosts/MCP first owns host tests that test safe rebinding after unrelated root changes.
- **EVAL-040** → Phase 10 — Slice9 hosts/MCP first owns host tests that test out-of-scope write detection.
- **EVAL-042** → Phase 10 — Slice9 hosts/MCP first owns host tests that test direct host writes observed outside Projector tools.
- **EVAL-043** → Phase 10 — Slice9 hosts/MCP first owns live-provider evaluation that be opt-in.
- **EVAL-044** → Phase 10 — Slice9 hosts/MCP first owns live-provider evaluation that be budgeted.
- **EVAL-045** → Phase 10 — Slice9 hosts/MCP first owns live-provider evaluation that be reproducible at the input/program/schema level.
- **EVAL-046** → Phase 10 — Slice9 hosts/MCP first owns live-provider evaluation that be graded structurally.
- **EVAL-047** → Phase 10 — Slice9 hosts/MCP first owns live-provider evaluation that NOT be the only test for semantic behavior.

## Phase 11 — Slice10 modernization

Success-criteria contribution: Modernization, migration, generated-upstream repair, and salvage behavior work on deliberately messy repositories.

- **CLI-021** → Phase 11 — Slice10 modernization first owns the CLI surface for `projector upgrade`.
- **MODE-010** → Phase 11 — Slice10 modernization first owns salvage mode behavior that be a deep reconstruction/modernization preset with a larger inference/research budget and worktree isolation.
- **MODE-011** → Phase 11 — Slice10 modernization first owns salvage mode behavior that NOT weaken approval or proof requirements because a repository is messy.
- **SEC-024** → Phase 11 — Slice10 modernization first owns remote transforms that be disabled by default.
- **SEC-025** → Phase 11 — Slice10 modernization first owns installed transforms that record version, hash, and permission requirements.
- **TEST-009** → Phase 11 — Slice10 modernization first owns unit coverage of canonical schema migration.
- **TEST-029** → Phase 11 — Slice10 modernization first owns unit coverage of transform routing and upstream generated repair.
- **EVAL-049** → Phase 11 — Slice10 modernization first owns the fixture `slop-monorepo`.
- **EVAL-059** → Phase 11 — Slice10 modernization first owns the fixture `generated-upstream`.
- **EVAL-016** → Phase 11 — Slice10 modernization first owns adversarial coverage of generated-output upstream repair.

## Phase 12 — Slice11 watch/CI/hardening

Success-criteria contribution: Audit, verify, watch, CI, reporting, redaction, and exit behavior are hardened for operators.

- **CLI-003** → Phase 12 — Slice11 watch/CI/hardening first owns the CLI surface for `projector audit`.
- **CLI-014** → Phase 12 — Slice11 watch/CI/hardening first owns the CLI surface for `projector verify`.
- **CLI-015** → Phase 12 — Slice11 watch/CI/hardening first owns the CLI surface for `projector verify --clean`.
- **CLI-034** → Phase 12 — Slice11 watch/CI/hardening first owns the CLI surface for `projector ci`.
- **CLI-035** → Phase 12 — Slice11 watch/CI/hardening first owns the CLI surface for `projector watch`.
- **SEC-005** → Phase 12 — Slice11 watch/CI/hardening first owns logs and certificates that redact secrets; post-hoc log redaction MUST NOT substitute for preventing model disclosure.
- **OPER-001** → Phase 12 — Slice11 watch/CI/hardening first owns report support for terminal format.
- **OPER-002** → Phase 12 — Slice11 watch/CI/hardening first owns report support for JSON format.
- **OPER-003** → Phase 12 — Slice11 watch/CI/hardening first owns report support for Markdown format.
- **OPER-004** → Phase 12 — Slice11 watch/CI/hardening first owns report support for SARIF for findings/CI where practical.
- **OPER-005** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that answer what happened.
- **OPER-006** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that answer what semantic role was inferred.
- **OPER-007** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that identify which canonical identity was resolved or explain why a new one is justified.
- **OPER-008** → Phase 12 — Slice11 watch/CI/hardening first owns change findings that explain why the item entered the relevant subgraph.
- **OPER-009** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that identify which lens/rules apply.
- **OPER-010** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that explain why the item is anomalous.
- **OPER-011** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that provide evidence and counterevidence.
- **OPER-012** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that provide confidence.
- **OPER-013** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that provide the smallest safe repair.
- **OPER-014** → Phase 12 — Slice11 watch/CI/hardening first owns applicable findings that provide Relevance Closure and affected Impact Closure without conflating them.
- **OPER-015** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that provide any predicted-versus-observed Planning Surprise.
- **OPER-016** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that provide the deferral consequence.
- **OPER-017** → Phase 12 — Slice11 watch/CI/hardening first owns material findings that provide the applicable architecture concern/decision chain.
- **OPER-018** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that explain why relevant existing decisions were or were not reconsidered.
- **OPER-019** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that state material preference influences on a recommendation.
- **OPER-020** → Phase 12 — Slice11 watch/CI/hardening first owns report findings that state its coverage caveat.

## Phase 13 — Slice12 external surfaces

Success-criteria contribution: External snapshots and surfaces are represented and validated without weakening the canonical core.

- **METR-008** → Phase 13 — Slice12 external surfaces first owns run telemetry for external snapshot IDs.
- **TEST-010** → Phase 13 — Slice12 external surfaces first owns unit coverage of Zod/public-contract registry completeness.
- **EVAL-053** → Phase 13 — Slice12 external surfaces first owns the fixture `external-surfaces`.

## Phase 14 — dogfood/release/GSD handoff

Success-criteria contribution: Dogfood and release use held-out evidence, publish every benchmark gate, and act honestly on every redesign trigger.

- **METR-045** → Phase 14 — dogfood/release/GSD handoff first owns semantic-model optimization that target lower marginal reasoning/review cost at acceptable correctness, not maximum modeling; a semantic model that grows faster than the use it creates MUST be treated as technical debt.
- **TEST-001** → Phase 14 — dogfood/release/GSD handoff first owns testing that attack both implementation bugs and Projector's ability to become confidently self-consistent while wrong.
- **EVAL-002** → Phase 14 — dogfood/release/GSD handoff first owns maintenance of held-out fixture repositories and mutation-generated variants whose exact anomalies are not encoded as one-off detectors.
- **EVAL-003** → Phase 14 — dogfood/release/GSD handoff first owns release metrics for held-out performance.
- **BENCH-001** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of semantic-identity reuse/create/split accuracy and duplicate/overlap prevention.
- **BENCH-002** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of known-relevant semantic entity recall during pre-change discovery.
- **BENCH-003** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of irrelevant relevance-context expansion.
- **BENCH-004** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of required-change recall.
- **BENCH-005** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of irrelevant blast-radius expansion.
- **BENCH-006** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of divergence precision/recall.
- **BENCH-007** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of secondary projection omissions.
- **BENCH-008** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of deterministic event/contract consumer omissions.
- **BENCH-009** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of Planning Surprise rate attributable to missed relevance.
- **BENCH-010** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of accepted learned-relationship precision.
- **BENCH-011** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of intentional-variant false-positive rate.
- **BENCH-012** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of pattern violations introduced.
- **BENCH-013** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of human review time.
- **BENCH-014** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of deterministic mutation percentage.
- **BENCH-015** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of model tokens/cost.
- **BENCH-016** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of context-size reduction relative to both repository size and full semantic-graph size.
- **BENCH-017** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of direct/governing/consequence/possible band distribution.
- **BENCH-018** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of scoped-`StateBinding` false-stale and false-current rates.
- **BENCH-019** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of clean-vs-incremental agreement.
- **BENCH-020** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of independent-validation coverage.
- **BENCH-021** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of receipt/certificate accuracy.
- **BENCH-022** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of repeated-change marginal cost.
- **BENCH-023** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of recovery from deliberate agent slop.
- **BENCH-024** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of transaction recovery success.
- **BENCH-025** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of exact/validated versus heuristic backdating rates.
- **BENCH-026** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of semantic-model complexity/churn.
- **BENCH-027** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of held-out repository generalization.
- **BENCH-028** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of protected-dimension representation fidelity.
- **BENCH-029** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of representation compression ratio and net token savings after profile overhead.
- **BENCH-030** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of compact-context task/conformance delta versus uncompressed/human-technical baselines.
- **BENCH-031** → Phase 14 — dogfood/release/GSD handoff first owns release measurement of workload-scoped instruction efficiency.
- **BENCH-032** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that achieve `>=95%` recall on fixture-known required refactor surfaces where the relevant dependency lanes are closed/bounded.
- **BENCH-033** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that achieve `>=95%` recall of fixture-known governing semantic entities for supported change classes on held-out/high-coverage fixtures.
- **BENCH-034** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that keep irrelevant impact expansion `<10%` on high-coverage local fixtures.
- **BENCH-035** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that keep irrelevant semantic-context expansion `<20%` on relevance fixtures after excluding explicitly requested possible-band exploration.
- **BENCH-036** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that produce zero seeded duplicate canonical identities when an existing identity owns the synonymous requested behavior.
- **BENCH-037** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that achieve a `>=50%` deterministic mutation rate for supported pattern migrations.
- **BENCH-038** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that produce zero undetected seeded hard-pattern violations after reconciliation.
- **BENCH-039** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that achieve a `>=2x` context-size reduction for supported scoped tasks.
- **BENCH-040** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that produce zero material state-changing output on a second identical reconcile.
- **BENCH-041** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that produce zero stale-plan/capsule rejection caused solely by an unrelated root-state change when all explicit binding dependencies and bound query-result fingerprints are unchanged.
- **BENCH-042** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that have zero successful stale binding validations when a required semantic/physical dependency changed.
- **BENCH-043** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that produce zero false `proven-within-boundary` claims in open/sampled/unavailable fixtures.
- **BENCH-044** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that achieve 100% recovery or deterministic recovery-required classification for injected transaction crashes.
- **BENCH-045** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that have no authority-score increase from same-lens Projector-generated conformity.
- **BENCH-046** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that have no silent preservation of old derivation proof after incompatible engine/signature-profile upgrades.
- **BENCH-047** → Phase 14 — dogfood/release/GSD handoff first owns the engineering gate that have zero accepted Representation Projections with a known protected-dimension mismatch.
- **BENCH-048** → Phase 14 — dogfood/release/GSD handoff first owns compact-context gating that NOT be enabled by default when measured profile overhead is net-negative.
- **BENCH-049** → Phase 14 — dogfood/release/GSD handoff first owns compact-context gating that be disabled when measured task/conformance quality materially regresses.
- **BENCH-050** → Phase 14 — dogfood/release/GSD handoff first owns accuracy claims that NOT be based on fixture success alone; held-out/mutation-generated performance MUST be published before making them.
- **KILL-001** → Phase 14 — dogfood/release/GSD handoff first owns the semantic-model subsystem or architecture MUST be reconsidered if semantic-model maintenance costs approach or exceed ordinary agent review cost.
- **KILL-002** → Phase 14 — dogfood/release/GSD handoff first owns Exact invalidation MUST be reconsidered if high-coverage exact invalidation still misses known dependencies systematically.
- **KILL-003** → Phase 14 — dogfood/release/GSD handoff first owns Canonical-state architecture MUST be reconsidered if canonical state cannot rebuild without hidden local history.
- **KILL-004** → Phase 14 — dogfood/release/GSD handoff first owns Semantic-signature profiles MUST be reconsidered if they routinely overclaim assurance.
- **KILL-005** → Phase 14 — dogfood/release/GSD handoff first owns Independent conformance MUST be reconsidered if it cannot distinguish Projector's own shared bugs.
- **KILL-006** → Phase 14 — dogfood/release/GSD handoff first owns Governance MUST be reconsidered if it frequently cycles or requires ad hoc evaluation ordering.
- **KILL-007** → Phase 14 — dogfood/release/GSD handoff first owns Branch/canonical collaboration design MUST be reconsidered if conflicts make ordinary collaboration impractical.
- **KILL-008** → Phase 14 — dogfood/release/GSD handoff first owns Rule-conflict handling MUST be reconsidered if conflicts require manual prompt surgery.
- **KILL-009** → Phase 14 — dogfood/release/GSD handoff first owns the architecture MUST be reconsidered if ordinary repository instructions plus codemods nearly match Projector on held-out benchmarks.
- **KILL-010** → Phase 14 — dogfood/release/GSD handoff first owns Execution Capsule design MUST be reconsidered if capsules remain repository-sized or routinely approach full semantic-graph size.
- **KILL-011** → Phase 14 — dogfood/release/GSD handoff first owns Relevance Closure design MUST be reconsidered if it requires package-tree duplication of cross-cutting semantics to achieve acceptable recall.
- **KILL-012** → Phase 14 — dogfood/release/GSD handoff first owns Semantic identity resolution MUST be reconsidered if it permits recurring synonymous/overlapping canonical entities at rates requiring manual cleanup.
- **KILL-013** → Phase 14 — dogfood/release/GSD handoff first owns Scoped state binding MUST be reconsidered if it cannot avoid global false-stale invalidation without unsafe missed dependencies.
- **KILL-014** → Phase 14 — dogfood/release/GSD handoff first owns Compact-context profiles MUST be reconsidered if they routinely save tokens only by weakening protected semantics.
- **KILL-015** → Phase 14 — dogfood/release/GSD handoff first owns Representation profiles MUST be reconsidered if their overhead is net-negative on workloads where they are enabled.
- **KILL-016** → Phase 14 — dogfood/release/GSD handoff first owns Compressed context MUST be reconsidered if it materially reduces task/conformance success compared with the source representation.
- **KILL-017** → Phase 14 — dogfood/release/GSD handoff first owns Authority design MUST be reconsidered if authority becomes dominated by Projector-endogenous evidence.
- **KILL-018** → Phase 14 — dogfood/release/GSD handoff first owns Divergence detection MUST be reconsidered if precision is too low to remain actionable.
- **KILL-019** → Phase 14 — dogfood/release/GSD handoff first owns Generated-output repair MUST be reconsidered if generated outputs routinely require forbidden direct patches.
- **KILL-020** → Phase 14 — dogfood/release/GSD handoff first owns Transaction recovery MUST be reconsidered if it cannot guarantee an honest state after interruption.
- **KILL-021** → Phase 14 — dogfood/release/GSD handoff first owns Adoption design MUST be reconsidered if adoption requires manual ontology authoring.
- **KILL-022** → Phase 14 — dogfood/release/GSD handoff first owns the semantic model/rule architecture MUST be reconsidered if complexity grows without falling marginal reasoning/review cost.
- **KILL-023** → Phase 14 — dogfood/release/GSD handoff first owns Kill criteria MUST be treated as design feedback and MUST NOT be hidden by adding more rules.


