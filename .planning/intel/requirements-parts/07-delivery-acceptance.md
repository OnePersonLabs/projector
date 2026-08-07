# Delivery and Acceptance Requirements

## v1 Requirements

### Delivery method and dependency order

- [ ] **DELV-001** Every implementation slice MUST start with failing fixture or property tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-002** Every slice MUST implement the smallest complete causal loop. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-003** Every slice MUST end with tests, an inspectable diff, and a commit. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-004** A slice MUST NOT add speculative adapters or packages that the slice does not require. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-005** Every slice MUST preserve normative contracts or record an explicit architecture decision that changes them. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-006** Every slice MUST leave the repository governable by the next slice and MUST NOT create throwaway parallel machinery. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-007** Slices 0–12 are committed v1 scope; their sequence expresses dependency order, not optional, future, or v2 scope. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Complete committed scope”.

### Slice 0 — foundation and correctness substrate

- [ ] **SLICE-000** Slice 0 MUST deliver monorepo/package boundaries and a composition root. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 — Foundation and correctness substrate”.
- [ ] **SLICE-001** Slice 0 MUST deliver complete Zod-backed normative contracts needed by early slices, including Requirements, Behavioral Scenarios, fine-grained canonical identity, `StateDigest`, `StateBinding`, `StateQuerySpec`/query-result fingerprints, Semantic Representation Profiles/Projections, and preservation fingerprints. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-002** Slice 0 MUST deliver fine-grained canonical `.projector/model/` storage for Concepts, Requirements, Behavioral Scenarios, Relations, rules, lenses, representations, authorities, decisions, exceptions, migrations, and receipts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-003** Slice 0 MUST derive a deterministic canonical-root digest from independently addressable canonical files. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-004** Slice 0 MUST provide schema-defined semantic hashing and stable identity, aliases, and lineage. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-005** Slice 0 MUST deliver core ports. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-006** Slice 0 MUST deliver a SQLite derived store and migrations. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-007** Slice 0 MUST deliver a transaction journal and writer lease. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-008** Slice 0 MUST deliver a fixture harness. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-009** Slice 0 MUST deliver a minimal CLI skeleton. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **ACC-000** Slice 0 acceptance MUST prove that all public contract references resolve. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-001** Slice 0 acceptance MUST prove canonical state survives `state.db` deletion and rebuild. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-002** Slice 0 acceptance MUST prove a bounded canonical entity can be loaded and updated without loading or rewriting the full semantic graph. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-003** Slice 0 acceptance MUST prove semantic hashes ignore declared volatile metadata. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-004** Slice 0 acceptance MUST prove the deterministic project-root digest is independent of filesystem enumeration order. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-005** Slice 0 acceptance MUST prove an unrelated canonical-entity change alters the root digest without staling an unrelated dependency-scoped `StateBinding`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-006** Slice 0 acceptance MUST prove a newly matching semantic entity, relation, or membership changes a bound query-result fingerprint and stales the affected binding even when every previously selected entity hash is unchanged. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-007** Slice 0 acceptance MUST prove an `open`, `sampled`, or `unavailable` discovery lane cannot establish a negative-space absence proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-008** Slice 0 acceptance MUST prove the transaction crash harness detects or recovers an interrupted empty/sample transaction. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-009** Slice 0 acceptance MUST pass the package dependency-direction test. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **SLICE-010** Broad analyzers MUST NOT be built in Slice 0. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.

### Slice 1 — mandatory misplaced-script causal loop

- [ ] **SLICE-011** Slice 1 MUST implement filesystem inventory. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1 — Mandatory misplaced-script loop from start to finish”.
- [ ] **SLICE-012** Slice 1 MUST implement Git identity and move facts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-013** Slice 1 MUST implement package-script invocation facts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-014** Slice 1 MUST implement minimal JavaScript role/lifecycle features. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-015** Slice 1 MUST implement Projection Units and deterministic anchors. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-016** Slice 1 MUST implement Pattern Candidate inference. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-017** Slice 1 MUST distinguish descriptive evidence from normative authority. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-018** Slice 1 MUST implement a minimal selector and blocking-predicate kernel. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-019** Slice 1 MUST implement candidate and active repository-script lenses. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-020** Slice 1 MUST implement placement and test expectations. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-021** Slice 1 MUST implement a deterministic move/reference transform. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-022** Slice 1 MUST implement a dependency-scoped, state-bound plan/capsule. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-023** Slice 1 MUST implement validators. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-024** Slice 1 MUST implement reconciliation. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-025** Slice 1 MUST emit a transaction receipt and certificate. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **ACC-010** Slice 1 MUST prove Projector rejects misleading path proximity and safely repairs the anomaly. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.

The mandatory fixture contains `.codex/hooks/pre-tool.mjs`, `.codex/hooks/lib/hook-state.mjs`, `.codex/hooks/lib/validate-repo.mjs`, `.codex/hooks/validate-repo.test.mjs`, `scripts/build-index.mjs`, `scripts/build-index.test.mjs`, `scripts/check-links.mjs`, `scripts/check-links.test.mjs`, and `package.json`.

- [ ] **ACC-011** The mandatory fixture MUST establish that `validate-repo.mjs` is invoked directly from package scripts. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice / Facts”.
- [ ] **ACC-012** The fixture MUST establish that `validate-repo.mjs` has no hook lifecycle signature. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-013** The fixture MUST establish that hook code does not import `validate-repo.mjs`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-014** The fixture MUST establish that its test targets repository-automation behavior. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-015** The fixture MUST establish that generic repository scripts have colocated tests under `/scripts`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-016** The fixture MUST establish that hook-private support modules are reachable from hook entrypoints. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-017** The fixture MUST make the misplaced location intentionally misleading local precedent. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-018** Step 1: Projector MUST inventory and classify stable Projection Units without executing the repository. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-019** Step 2: Projector MUST infer descriptive families for repository automation, hook entrypoints, hook-private support, and test colocation. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-020** Step 3: Projector MUST classify `validate-repo.mjs` as repository automation using role, invocation, and dependency evidence stronger than directory proximity. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-021** Step 4: Projector MUST keep Pattern Candidate and normative Lens authority separate. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-022** Step 5: Generated or Projector-repaired occurrences MUST NOT inflate independent authority evidence. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-023** Step 6: Projector MUST compile a minimal active/shadow lens and typed rules sufficient for the scenario. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-024** Step 7: Projector MUST emit placement/test divergences with counterevidence and proof caveats. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-025** Step 8: Projector MUST preview an R1 deterministic move/reference update. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-026** Step 9: Projector MUST bind the plan, capsule, and approval to a dependency-scoped `StateBinding` compiled against a global `StateDigest`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-027** Step 10: Projector MUST obtain the writer lease and journal the transaction. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-028** Step 11: Projector MUST move the implementation and test and update references and the package script as required. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-029** Step 12: Projector MUST run declared independent-enough validators. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-030** Step 13: Projector MUST reconcile to a fixed point. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-031** Step 14: A second identical reconciliation MUST produce no material delta for this cluster. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-032** Step 15: Projector MUST emit a cleanup plan with no unresolved work for the cluster. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-033** Step 16: Projector MUST emit a compact transaction receipt and a verbose certificate. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-034** Step 17: Projector MUST prove that deleting and rebuilding `state.db` preserves accepted canonical semantics. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **SLICE-026** The mandatory first slice MUST close, in order, observe → classify → infer descriptive pattern → establish bounded authority → compile governance → plan against state → deterministic repair → independent validation → reconcile → durable canonical result. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “This slice proves the central loop”.
- [ ] **SLICE-027** Visualization, broad cloud adapters, and a universal semantic model MUST NOT begin before the mandatory first slice passes. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.

### Slices 2–12

- [ ] **SLICE-028** Slice 2 MUST add semantic-signature profiles with assurance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 — Semantic signatures, invalidation, and backdating”.
- [ ] **SLICE-029** Slice 2 MUST add derivation inputs and a reverse index. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-030** Slice 2 MUST add Impact Rules. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-031** Slice 2 MUST add an API-contract fixture. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-032** Slice 2 MUST add exact/validated backdating. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-033** Slice 2 MUST refuse heuristic equality as proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-034** Slice 2 MUST add SCC proof-group support sufficient for fixture tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-035** Slice 2 MUST distinguish the rebuild oracle from independent conformance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-036** Slice 2 MUST add localized `StateBinding` value-dependency and query-dependency validation/rebinding. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-037** Slice 2 MUST add deterministic registered query programs and closure-sensitive result fingerprints sufficient for identity, relation-neighborhood, selector-membership, event/contract-consumer, and implementation-binding fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **ACC-035** Slice 2 MUST prevent client regeneration for an unchanged public contract only when assurance policy permits backdating. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 / Acceptance”.
- [ ] **ACC-036** Slice 2 MUST prove unrelated root-state mutations do not stale independent work. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 / Acceptance”.
- [ ] **SLICE-038** Slice 3 MUST add canonical Requirement and Behavioral Scenario persistence/querying. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 — Behavioral intent, identity resolution, and Relevance Engine”.
- [ ] **SLICE-039** Slice 3 MUST add Concept, Requirement, and Scenario aliases. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-040** Slice 3 MUST support Semantic Identity Resolution outcomes `reuse`, `coordinated-change`, `split`, `create`, and `no-entity`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-041** Slice 3 MUST prevent duplicate/overlapping canonical identity before creating a new identity. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-042** Slice 3 MUST add WHAT/WHY intent analysis and a read-only WHERE/WHAT-ELSE Relevance Scout. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-043** Slice 3 MUST add bounded Relevance Closure with direct, governing, consequence, and possible bands. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-044** Slice 3 MUST deterministically traverse canonical relations, Projection Unit bindings, selectors, package/code topology, verification bindings, and active decisions/invariants for relevance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-045** Slice 3 MUST add event/contract producer-consumer topology sufficient for fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-046** Slice 3 MUST add an Analysis Facet activation framework. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-047** Slice 3 MUST make the Context Compiler consume Relevance Closure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-048** Slice 3 MUST bind closure-sensitive identity, adjacency, membership, event, and contract queries so negative-space and stopping conditions cannot silently stale. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-049** Slice 3 MUST compare predicted and observed impact and record Planning Surprises. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-050** Slice 3 MUST add held-out relevance and over-expansion fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **ACC-037** Slice 3 MUST modify an existing identity for a synonymous request instead of creating a duplicate. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-038** Slice 3 MUST bring a cross-cutting invariant outside the touched package into governing context through semantic applicability. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-039** Slice 3 MUST keep unrelated semantic domains outside compiled context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-040** Slice 3 MUST bring a known event/contract consumer into relevance without model guessing. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-041** When legitimate implementation exposes a missing relationship, Slice 3 MUST produce a Planning Surprise and propose a reusable relationship instead of silently mutating the plan. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-042** Slice 3 MUST demonstrate that generated Markdown/Gherkin is derived from Requirement/Scenario identities and is not a second source of truth. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **SLICE-051** Slice 4 MUST add a semantic representation compiler with `human-technical@1`, `agent-compact@1`, and `machine-invariant@1` reference profiles. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4 — Governance robustness and representation”.
- [ ] **SLICE-052** Slice 4 MUST add protected-dimension Semantic Preservation Fingerprints. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-053** Slice 4 MUST separate deterministic controlled-prose/style lint and literal-preservation checks from semantic-fidelity proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-054** Slice 4 MUST add representation-profile dependency invalidation and fallback policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-055** Slice 4 MUST account for tokenizer/profile cost sufficiently to refuse net-negative compact context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-056** Slice 4 MUST add lens overlap roles. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-057** Slice 4 MUST add projection expectation kinds. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-058** Slice 4 MUST add governance strata and fixed-point failure handling. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-059** Slice 4 MUST add layered ignore policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-060** Slice 4 MUST add dependency-keyed selector/rule caches. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-061** Slice 4 MUST normalize risk and `ExecutionPolicy`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-062** Slice 4 MUST add immutable plan revision/rebase, including lightweight rebind when only unrelated root state changed. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-063** Slice 4 MUST add a canonical engine/schema upgrade protocol. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-064** Slice 5 MUST add complete `ArchitectureConcern`, `ArchitectureDecision`, `DecisionEvaluation`, `DecisionValidityAssessment`, `DeveloperPreference`, and `GovernanceBasis` contracts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 — Progressive architecture commitment”.
- [ ] **SLICE-065** Slice 5 MUST discover/materialize concerns from the already-compiled Relevance Closure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-066** Slice 5 MUST support scope-specific decision reuse and dirtying. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-067** Slice 5 MUST add typed reconsideration and evidence-refresh policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-068** Slice 5 MUST add preference providers/composition, with canonical adoption only at project scope. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-069** Slice 5 MUST compile decision consequences with crash-consistent governance activation. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-070** Slice 5 MUST add deferral and optionality contracts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-071** Slice 5 MUST handle decision overlap and SCC convergence. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-072** Slice 5 MUST run architecture preflight in `projector change`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-073** Slice 5 MUST deliver `projector decisions`, decision explanation, and decision-pressure audit. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-074** Slice 5 MUST include the cross-platform expansion fixture. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **ACC-043** Slice 5 MUST make a single-web-app → cross-platform request produce a concise decision frontier. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 / Acceptance”.
- [ ] **ACC-044** That frontier MUST use current research only for volatile choices, preserve unaffected decisions, avoid preselecting technologies, receive relevant cross-cutting context without unrelated domains, and permit simple tooling until evidence or reconsideration triggers justify more. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 / Acceptance”.
- [ ] **SLICE-075** Slice 6 MUST begin only after Slices 0–5 pass. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6 — Broaden analyzers and relevance/divergence topology”.
- [ ] **SLICE-076** Slice 6 MUST deliver full TypeScript/JavaScript semantic indexing. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-077** Slice 6 MUST deliver richer event/public-contract producer-consumer extraction. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-078** Slice 6 MUST analyze structured data. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-079** Slice 6 MUST analyze Markdown. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-080** Slice 6 MUST analyze GitHub Actions. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-081** Slice 6 MUST deliver richer divergence taxonomy/reporting. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-082** Slice 6 MUST degrade truthfully for analyzer capability/failure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-083** Slice 6 MUST make the Relevance Engine use newly available deterministic lanes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-084** Slice 7 MUST deliver observability-aware coverage snapshots. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7 — Coverage completion and cleanup”.
- [ ] **SLICE-085** Slice 7 MUST deliver semantic-identity/relevance coverage lanes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-086** Slice 7 MUST rank questions by information gain. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-087** Slice 7 MUST support interactive promotion, exception, and defer handling. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-088** Slice 7 MUST deliver resumable cleanup plans. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-089** Slice 7 MUST refuse open-world completeness claims. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-090** Slice 7 MUST deliver Planning Surprise and relevance-quality metrics. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-091** Slice 8 MUST deliver the complete ordered flow: intent analysis + Relevance Scout → identity resolution → Relevance Closure → Requirement/Scenario delta → Analysis Facets → architecture preflight → Impact Closure → packet grouping/SCC handling → checkpoints/rebase → bounded deterministic/agent execution → reverse-impact comparison → reconciliation → receipts/certificates. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 8 — Full Semantic Change Compiler and packet executor”.
- [ ] **SLICE-092** Slice 8 Execution Capsule compilation MUST keep the structured normative kernel authoritative while emitting the least-cost valid Representation Projection for explanatory/task context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 8”.
- [ ] **SLICE-093** Slice 9 MUST deliver capability-detected Codex and Claude adapters. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9 — Host/MCP integrations”.
- [ ] **SLICE-094** Slice 9 MUST deliver dependency-bound MCP mutation capabilities, relevance/context query tools, direct-write observation, and host tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9”.
- [ ] **SLICE-095** Host adapters MUST consume state-bound representation projections and MUST NOT treat generated compact prose as canonical governance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9”.
- [ ] **SLICE-096** Slice 10 MUST deliver friction aggregation, alternative comparison, authority-aware upgrade proposals, migration overlays, and staged execution through the same relevance/architecture/impact machinery as ordinary changes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 10 — Modernization”.
- [ ] **SLICE-097** Slice 11 MUST deliver incremental watch, CI exit policy, recovery UX, cost/complexity accounting, hostile-content/path hardening, and a benchmark harness. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11 — Watch/CI/hardening”.
- [ ] **SLICE-098** Slice 11 MUST measure relevance recall/context expansion, duplicate prevention, Planning Surprise, scoped state binding, representation fidelity, token economics, and instruction efficiency. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11”.
- [ ] **SLICE-099** Slice 11 MUST disable optimizations that do not earn their cost. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11”.
- [ ] **SLICE-100** Slice 12 MUST begin only after the local kernel is credible. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12 — External surfaces”.
- [ ] **SLICE-101** Slice 12 MUST implement, in order: (1) GitHub or another high-value external surface, (2) Generic HTTP/JSON, and (3) further providers based on actual demand. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12”.
- [ ] **ACC-045** Each external adapter MUST ship independently only after its observability/capability contract, relevance/impact relationships, drift semantics, snapshot behavior, and truthful unavailable/open-world behavior pass tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12”.

### Architecture acceptance scenarios

- [ ] **ACC-046** For web → desktop/Android/iOS expansion, requirement intent MUST record target capabilities without preselecting a stack. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` — “Architecture expansion: web app → cross-platform product”.
- [ ] **ACC-047** The expansion MUST activate material concerns including workspace topology, cross-platform runtime/shared-code boundary, dependency coherence, API contract, build/test/release, and distribution obligations. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-048** Projector MUST classify concerns as `blocking-now`, `material-soon`, or `deferable` for the requested slice and MUST NOT require every concern immediately. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-049** Prior web decisions MUST remain valid for web unless their assumptions changed. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-050** Volatile technology options MUST be checked against current official or authoritative evidence before recommendation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-051** If pnpm is a viable selected package manager, workspace catalog capability MAY be evaluated for dependency-version coherence, but MUST NOT be independently mandated. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-052** Task orchestration MUST be evaluated, but Nx, Turbo, or another orchestrator MUST NOT be adopted merely because the repository became a monorepo; plain workspace scripts are a valid decision with reconsideration triggers. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-053** User, organization, and project preferences MUST influence only otherwise viable choices, and material influence MUST be shown. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-054** Accepted decisions MUST compile rules, lenses, and migrations transactionally. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-055** Implementation planning MUST start only after the blocking decision frontier is resolved or validly deferred. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-056** A local developer preference MAY rank otherwise viable options, but MUST NOT create a repository rule or change another developer's accepted project state; project adoption makes it shared input, while enforcement still requires a constraint/decision. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Preference scope isolation”.
- [ ] **ACC-057** When a platform/version change fires an accepted decision's refresh policy, only affected evidence MUST refresh; broad trend scanning is prohibited, and refresh MAY reaffirm the decision without migration. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Stale architecture research”.
- [ ] **ACC-058** A task-orchestration concern MAY be deferred with explicit optionality-preserving constraints and revisit triggers; if implementation would irreversibly depend on one orchestrator, the concern becomes blocking or requires a temporary explicit decision. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Decision deferral preserves optionality”.
- [ ] **ACC-059** “Do not add a monorepo orchestrator yet” MUST be a valid accepted decision when scripts are fast and ordering is simple; it MUST carry rationale and triggers and MUST NOT require a synthetic implementation rule merely to prove existence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Negative/simple decision”.
- [ ] **ACC-060** Incompatible consequences from unexpectedly overlapping accepted technology decisions MUST block before governance activation until narrowing, supersession, migration, or exception resolves the conflict. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Decision overlap conflict”.
- [ ] **ACC-061** Held-out and mutation-generated architecture fixtures MUST measure concern recall, irrelevant-concern rate, decision-question count, correctly deferred concerns, stale-decision detection, and current-research correctness. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Held-out concern-discovery robustness”.
- [ ] **ACC-062** Architecture fixture success MUST NOT require fixture-specific names. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.

### Core acceptance scenarios

- [ ] **ACC-063** Deleting `state.db` and caches after authoring independently addressable Concepts, Requirements, Behavioral Scenarios, Relations, rules, active lens/profile, authority, decision, exception, and migration MUST reload all authored/governance semantics identically, reproduce the deterministic canonical-root digest, recompute observations, and require neither hidden run history nor a monolithic model. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Canonical rebuild closure”.
- [ ] **ACC-064** In the fixture where forty generated packages share a weak pattern, two independently authored newer implementations use a better pattern, incidents support the latter, and Projector normalizes several packages under the proposed lens, the forty generated copies MUST collapse into one independence group. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Copied-slop majority and endogenous-evidence defense”.
- [ ] **ACC-065** Projector-normalized copies MUST NOT become independent votes for their causal lens. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-066** Dominant descriptive precedent MUST NOT automatically become normative. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-067** A migration recommendation MUST require stronger independent evidence and approval appropriate to risk. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-068** When two implementations have the same heuristic semantic hash/profile but an observable behavior difference outside that profile, heuristic semantic equality MUST NOT backdate downstream validity; independent revalidation or widened analysis is required. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Semantic-signature insufficiency”.
- [ ] **ACC-069** When an internal API implementation changes but an exact public-interface signature does not, implementation MUST invalidate, the public contract MUST revalidate/backdate, downstream clients MUST remain valid, and client regeneration MUST NOT occur. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Semantic backdating”.
- [ ] **ACC-070** A clean rebuild agreeing with a shared buggy analyzer MUST NOT support strong completion when an independent test/schema/runtime lane contradicts it; the contradiction MUST surface. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Shared-bug rebuild oracle”.
- [ ] **ACC-071** Mutually recursive contract units MUST be evaluated as one SCC proof group to a fixed point; downstream consumers remain valid only after all relevant group signatures regain eligible assurance. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “SCC backdating”.
- [ ] **ACC-072** Making a private symbol public MUST change selector membership, newly apply public API rules/projection expectations, update docs/compatibility/contract closure, and invalidate only affected dependency-keyed caches. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Selector membership change”.
- [ ] **ACC-073** A `predicate-constrained` expectation MUST accept structurally different handwritten implementations that satisfy the same predicates/tests, and Projector MUST NOT invent one exact canonical body. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Multiple valid shared implementations”.
- [ ] **ACC-074** Recursive rule/lens membership without declared fixed-point semantics MUST emit `governance-cycle` and refuse order-dependent resolution. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Governance-cycle detection”.
- [ ] **ACC-075** An explicitly monotonic governance SCC MUST converge deterministically or fail with bounded `nonconvergent-reconciliation`. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-076** Failure injection after journal phases prepared, during workspace mutation, staged, validating, canonical staging, commit, and rollback MUST restart by safe resume, rollback, or `recovery-required`; canonical state MUST NOT claim completion while workspace state is partial. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Crash recovery matrix”.
- [ ] **ACC-077** Incompatible active lens/rule changes merged from branches MUST produce canonical conflict, block Govern/Autonomous execution and stale approvals/plans, and require explicit resolution that creates new valid state. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Branch governance conflict”.
- [ ] **ACC-078** A sampled/open-world dependency MUST refuse `proven-within-boundary` for any closure claim requiring complete enumeration, though local work MAY remain high-confidence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Open-world completeness refusal”.
- [ ] **ACC-079** An indicated iOS surface without store credentials MUST be known/unavailable, include human/external action in the plan, allow safe local work, and refuse a global-completeness certificate. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Unreachable external surface”.
- [ ] **ACC-080** Resampling identical normalized evidence into different plausible hypotheses MUST leave accepted canonical state unchanged absent explicit promotion/decision, while inference artifacts remain distinguishable and replayable. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Model resampling idempotence”.
- [ ] **ACC-081** Tests generated by the same wrong packet MUST NOT satisfy an R2+ independent-validation requirement; an independent contract/property/runtime contradiction MUST block completion. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Validator independence”.
- [ ] **ACC-082** A known generated-output defect MUST be repaired in source/generator and regenerated/validated by default; a direct output patch is rejected unless an explicit temporary overlay has debt/migration exit criteria. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Generated-output upstream repair”.
- [ ] **ACC-083** After partial completion, settled decisions MUST persist; if an intervening change touches a bound dependency, the old plan MUST NOT resume blindly and plan rebase MUST carry forward still-valid completed work into a new revision/capsules; only when unrelated snapshot state changed and every `StateBinding` dependency/membership fingerprint is unchanged MAY Projector perform a lightweight rebind without recomputing unaffected semantic work. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Partial completion and plan rebase”.
- [ ] **ACC-084** Changing an unrelated leaf MUST preserve selector/rule caches whose declared dependencies are untouched; graph revision alone MUST NOT trigger near-global recomputation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Localized cache performance”.
- [ ] **ACC-085** Analyzer/signature-profile semantic changes MUST declare reindex/revalidation, make dependent old derivations suspect, and MUST NOT silently preserve old proof. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Engine/signature-profile upgrade”.
- [ ] **ACC-086** Partial Markdown or TypeScript analyzer failure MUST preserve unaffected observations and widen/block only dependent coverage and claims. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Analyzer partial failure”.
- [ ] **ACC-087** Symlink/platform path observation MAY follow policy, but mutation MUST remain repository-root-constrained and refuse out-of-root writes. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Path/symlink escape”.
- [ ] **ACC-088** Semantic role/relationship evidence MUST outrank misleading nearby precedent, and no accidental pattern fork may be created. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Misleading local precedent”.
- [ ] **ACC-089** Alternating repair transforms MUST detect a repeated state digest and fail reconciliation as non-convergent instead of looping. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Projector repair oscillation”.
- [ ] **ACC-090** Held-out, mutation-generated structurally varied repositories MUST keep reported precision/recall and completeness behavior within release thresholds and demonstrate generalization beyond golden-fixture memorization. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Held-out/mutation-generated benchmark”.

### Relevance and semantic identity acceptance scenarios

- [ ] **ACC-091** When canonical state contains `CAP-MIDI-DEVICE-DISCOVERY` with aliases including `midi devices` and `device enumeration`, a request to “add wireless MIDI device enumeration” MUST rank that existing capability as owner and MUST NOT create a duplicate merely due to wording, even with nearby code/docs using different phrases. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Synonymous request reuses canonical identity”.
- [ ] **ACC-092** If BLE behavior is distinct, Projector MUST modify the existing capability/Requirements or propose a narrower identity with owns/excludes boundaries and nearest candidates, and the resolution MUST remain inspectable. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` heading.
- [ ] **ACC-093** Adding only an accepted synonym MUST preserve stable ID and `semanticHash`, change `discoveryHash` and complete snapshot/document hash, reevaluate affected identity-search/Relevance queries, preserve derivations bound only to unchanged meaning, and resolve later synonymous requests to the existing identity. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Alias change refreshes discovery without semantic invalidation”.
- [ ] **ACC-094** Identity resolution after rename/move/supersession MUST inspect active identities, aliases, lineage, tombstones, and superseded entities; it MUST resolve to the survivor/replacement or expose split/new-identity choice and MUST NOT resurrect a duplicate due to absent old name/path. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Superseded/renamed identity is not resurrected as a duplicate”.
- [ ] **ACC-095** Bluetooth-MIDI timing context MUST include direct timing semantics, the physically separate Session Clock invariant/applicable decision as governing context, typed downstream multiplayer/recording consumers as consequence context, and MUST exclude unrelated identity/avatar/UI domains. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Cross-cutting governing concern outside touched package”.
- [ ] **ACC-096** An invariant authored once and bound to three capabilities through Relations/selectors MUST be discovered for all three and MUST NOT be duplicated into package-local specs for discoverability. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Encapsulation is not retrieval”.
- [ ] **ACC-097** Relevance Closure MUST contain all planning-relevant concepts, Impact Closure only justified changed units/consequences, and context loading MUST NOT itself invalidate relevance entries. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Relevance is not impact”.
- [ ] **ACC-098** Localized relevance MUST remain bounded, weak neighbors MUST be dropped or placed only in the possible band with rationale, whole-graph serialization is prohibited, and metrics MUST expose irrelevant expansion. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Relevance over-expansion refusal”.
- [ ] **ACC-099** Known `MidiNoteCaptured` consumers in recording, multiplayer, scoring, and visualization MUST enter relevance deterministically before model inference; model recall failure MUST NOT hide graph-known consumers. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Event topology discovers non-obvious consumers”.
- [ ] **ACC-100** Public API/message/schema producer-consumer edges MUST route unrelated consumers into change cognition and then Impact Closure with the appropriate proof class once the delta is known. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Contract topology discovers consumers”.
- [ ] **ACC-101** Human Markdown, Gherkin, compact-agent, and applicable machine-invariant projections MUST bind to the same canonical Requirement/Scenario identities/hashes; generated edits MUST NOT silently rewrite behavior, intentional edits MUST reconcile as proposed semantic changes, and wording/format changes MUST NOT mint identities. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Requirement and scenario projections are derived”.
- [ ] **ACC-102** Intent Analysis MUST separate behavioral goal/constraints from implementation proposal; Relevance Scout MAY inspect code/topology for WHERE/WHAT-ELSE; nearby technology MUST NOT decide architecture; Relevance Closure MUST inform preflight without contaminating Requirements with HOW. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “WHAT/WHY is protected without WHERE blindness”.
- [ ] **ACC-103** An unrelated canonical change MUST change global snapshot identity while permitting safe rebind/use when every bound semantic/physical/query dependency remains unchanged; receipts MUST distinguish snapshots without recomputing the semantic plan. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Unrelated canonical change does not stale local work”.
- [ ] **ACC-104** Changing a bound Session Clock invariant MUST fail/revalidate binding and MUST block execution under old approval until required relevance/impact/context refresh completes. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Bound dependency change does stale local work”.
- [ ] **ACC-105** Export-membership change MUST invalidate/recompile a capsule when a new selector-dependent rule applies even if previously loaded entity bodies are byte-identical. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Membership-changing fact invalidates context even when loaded entities are unchanged”.
- [ ] **ACC-106** Adding newly query-matching semantic state MUST change the query result hash, stale and recompute the prior closure/binding, and include the new state even if old selected hashes are unchanged; unrelated additions that change no bound query result MUST NOT stale it. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Newly relevant semantic state invalidates negative-space proof”.
- [ ] **ACC-107** Changing a registered query program/version or declared closure-sensitive projection MUST stale the old query dependency and require policy-driven recompile/rebind even when entities are unchanged. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Query semantics are part of state binding”.
- [ ] **ACC-108** Empty results from a `sampled` or `open` event/consumer lane MAY support context but MUST record lane/assumptions and unknown frontier, MUST NOT prove absence, and MAY become stronger only after eligible `closed`/`bounded` reevaluation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Open-world emptiness is not absence proof”.
- [ ] **ACC-109** Legitimate reverse impact omitted from predicted MIDI timing closure MUST emit a Planning Surprise, classify scope growth vs missing relation/analyzer/facet vs overreach, propose reusable relations only through authority rules, and improve future discovery. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Planning Surprise learns a missing relationship”.
- [ ] **ACC-110** Unrelated avatar refactoring during a MIDI task MUST be identified as unexplained impact/overreach, trigger repair/revert policy absent a valid relevance path, and MUST NOT manufacture a MIDI/avatar relation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Planning Surprise rejects agent overreach”.
- [ ] **ACC-111** Concurrent unrelated Requirement edits MUST remain in independent canonical files/identities and avoid synthetic monolithic-model conflicts; semantic root hashes MUST differ appropriately. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Fine-grained canonical merge locality”.
- [ ] **ACC-112** Moving a canonical Concept to a deterministic shard without semantic change MUST preserve identity, relationships, relevance, and semantic hash; only storage/index metadata may change. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Semantic storage path does not define meaning”.
- [ ] **ACC-113** A simple behavior change MUST activate only minimal useful Analysis Facets; a realtime event/public-contract change MUST activate behavior, events, realtime, and public-contract facets; facets add discovery/verification without preselecting technology. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Analysis Facets compose without methodology lock-in”.

### Representation acceptance scenarios

- [ ] **ACC-114** Compacting `MUST_NOT delete production data unless explicit user approval` into weaker force, `A iff B` into `A when B`, or `exactly one` into `one or more` MUST fail protected-dimension validation and leave canonical rules untouched; a provably equivalent deterministic invariant encoding MAY pass, such as `FORBID delete-production-data EXCEPT explicit-user-approval` when the normalized kernel proves equivalence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Representation semantic-fidelity rejection”.
- [ ] **ACC-115** Valid `human-technical@1`, `agent-compact@1`, and `machine-invariant@1` projections MAY differ textually but MUST share source semantic hash and compatible preservation fingerprints; derived edits MUST regenerate or reconcile as proposed semantic change and MUST NOT mutate source directly. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Cross-projection consistency”.
- [ ] **ACC-116** When compact-profile instruction/tokenizer overhead exceeds savings, the Context Compiler MUST select source/less-compressed representation; it MAY select compact mode later only when measured net cost improves without fidelity loss. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Net-negative compact-context fallback”.
- [ ] **ACC-117** Changing only `agent-compact@1` MUST suspect/regenerate dependent agent projections/capsules, preserve independent human/machine projections, and MUST NOT dirty canonical source hashes or architecture decisions. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Representation-profile invalidation”.
- [ ] **ACC-118** The authoritative `SPEC.md`, `INDEX.md`, and every authoritative module MUST have zero blocking `human-technical@1` errors; lint MUST NOT rewrite code blocks/literals, passive voice and nominalization remain review signals where deterministic rewrites risk meaning, and style MUST NOT claim semantic equivalence or truth. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Authoritative specification human-technical conformance”.
- [ ] **ACC-119** Compact context MUST preserve negation, scope, order, exact code symbols, paths, API names, numbers, units, a standard acronym, and all protected dimensions; it MAY remove nonessential narration/repetition when host policy permits, MUST reject invented prose abbreviations unless measured token savings justify them and clarity remains acceptable, and MUST fall back when ambiguity, semantic weakening, or net-negative profile overhead occurs. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Compact context preserves critical tokens and avoids false compression”.

### Public release criteria

- [ ] **REL-001** A new user MUST be able to install one package. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”, item 1.
- [ ] **REL-002** A new user MUST be able to run `projector init` in a TypeScript/JavaScript monorepo. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 2.
- [ ] **REL-003** Initialization MUST produce useful findings without handwritten modeling. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 3.
- [ ] **REL-004** A user MUST be able to inspect why a finding and expectation exist. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 4.
- [ ] **REL-005** A user MUST be able to distinguish Pattern Candidate from active authority. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 5.
- [ ] **REL-006** Projector MUST persist independently addressable Concepts, Requirements, Behavioral Scenarios, and Relations and rebuild the derived graph from them. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 6.
- [ ] **REL-007** Different terminology MUST resolve to an existing semantic identity rather than create a duplicate. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 7.
- [ ] **REL-008** A cross-cutting request MUST produce bounded Relevance Closure that finds governing semantics outside the touched package without unrelated domains. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 8.
- [ ] **REL-009** Users MUST separately inspect why something was relevant and why it entered Impact Closure. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 9.
- [ ] **REL-010** Architecture-expanding work MUST produce a concise decision frontier with prior decisions, required research, alternatives, preference influence, and consequences. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 10.
- [ ] **REL-011** Execution Capsule context MUST be selected from the relevant semantic subgraph, not the complete graph. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 11.
- [ ] **REL-012** Unrelated canonical/repository change MUST demonstrate safe `StateBinding` rebind without global staleness. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 12.
- [ ] **REL-013** Projector MUST auto-fix supported R1 divergences through dependency-bound journaled transactions. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 13.
- [ ] **REL-014** Projector MUST resume/rebase a partially completed plan. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 14.
- [ ] **REL-015** Projector MUST reconcile a deliberate coding-agent fixture mistake. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 15.
- [ ] **REL-016** Projector MUST compile one cross-file semantic change with narrow invalidation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 16.
- [ ] **REL-017** Projector MUST compare predicted and actual impact and surface Planning Surprise for a missed relationship or exceeded scope. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 17.
- [ ] **REL-018** Projector MUST demonstrate exact/validated semantic backdating and heuristic refusal. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 18.
- [ ] **REL-019** Projector MUST run `verify --clean` and an independent conformance check. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 19.
- [ ] **REL-020** Projector MUST recover correctly from injected transaction interruption. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 20.
- [ ] **REL-021** Projector MUST refuse false completeness on open/unavailable surfaces. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 21.
- [ ] **REL-022** Projector MUST emit a compact R2+ transaction receipt and truthful certificate. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 22.
- [ ] **REL-023** Rebuilding `state.db` from canonical state MUST preserve equivalent semantics. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 23.
- [ ] **REL-024** One canonical scope MUST compile to applicable human-technical, Gherkin/human behavioral, agent-compact, and machine-invariant representations and reject seeded protected-semantic drift. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 24.
- [ ] **REL-025** Compact context selection MUST use measured net utility/cost rather than token count alone and MUST include a net-negative fallback case. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 25.
- [ ] **REL-026** A release primarily producing Markdown, prompts, static graphs, or advice MUST NOT qualify as Projector. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”.

### Dogfooding obligations

- [ ] **DOG-001** Before public release, Projector MUST govern its own workspace package boundaries with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Dogfooding requirement”.
- [ ] **DOG-002** It MUST govern analyzer implementation with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-003** It MUST govern CLI commands with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-004** It MUST govern transform implementation and tests with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-005** It MUST govern serialized contract changes with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-006** It MUST govern its own Requirements, Behavioral Scenarios, and semantic identity resolution. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-007** It MUST govern Relevance Closure and context compilation for Projector feature work. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-008** It MUST govern applicable event/public-contract relationships. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-009** It MUST govern DB migrations. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-010** It MUST govern host-adapter generation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-011** It MUST govern documentation references. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-012** It MUST govern semantic representation profiles for its human docs, agent capsules/host instructions, and machine-invariant rule products. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-013** Projector's self-audit MUST be clean or contain explicit accepted debt. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-014** The authoritative specification MUST pass the blocking `human-technical@1` mechanical style gate; code blocks and exact technical literals are outside that prose gate, while passive voice and nominalization remain review signals when a deterministic checker cannot identify a better actor or verb safely. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-015** Before public release, the reference technology and package choices in `Reference Implementation Architecture` (`PROJECTOR_SPEC/02-semantic-kernel/reference-implementation.md`) MUST be represented as Projector Architecture Decisions, Authority Records, and Governance Bases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-016** Projector MUST explain its package, runtime, storage, test, and analyzer choices. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-017** Projector MUST show the rules/lenses those choices produce and the typed reconsideration triggers. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.

### Final implementer checklist and directive

- [ ] **REL-027** Before any slice/release completion claim, verify zero-ceremony value still exists. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Final implementer checklist”.
- [ ] **REL-028** Verify canonical authored/governance state is closed under rebuild. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-029** Verify canonical semantic entities are independently addressable and no bounded change requires loading or rewriting a monolithic project model. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-030** Verify global canonical/worktree digests identify snapshots but are not the sole local-validity dependency. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-031** Verify every plan/capsule/approval/capability uses dependency-complete `StateBinding` with explicit query dependencies. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-032** Verify every public normative contract is schema-defined. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-033** Verify package dependencies follow ports plus composition-root architecture. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-034** Verify semantic hashes use explicit schema projections. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-035** Verify stable semantic identity does not depend on filename, package location, or mutable wording, and aliases do not create identities. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-036** Verify durable semantics resolve against existing identities before creation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-037** Verify Requirements/Scenarios exist only where they materially improve planning, relevance, verification, or explanation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-038** Verify semantic equality states profile and assurance. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-039** Verify canonical semantics remain authoritative over every Representation Projection. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-040** Verify human/agent/machine representations bind to source semantic hashes and explicit profile version. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-041** Verify rendering/compression cannot silently drift protected normative force, negation, scope, cardinality, logical connectives, conditions, exceptions, dependency/order, behavioral step roles, concept identity, or literals. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-042** Verify style/clarity lint is never labeled semantic-equivalence proof. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-043** Verify compact context accounts for tokenizer/profile overhead and falls back when net-negative or behaviorally worse. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-044** Verify heuristic equality never independently prunes downstream validity. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-045** Verify Relevance Closure remains distinct from Impact Closure and exact invalidation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-046** Verify bounded relevance, not hierarchy or whole-graph dumping, selects context. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-047** Verify deterministic event/contract/implementation topology is preferred over model rediscovery. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-048** Verify exact invalidation follows derivation inputs and versioned Impact Rules widen conceptually. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-049** Verify predicted and observed impact reconcile and Planning Surprises never silently rewrite the plan. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-050** Verify governance strata and recursive SCCs have termination semantics. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-051** Verify architecture concerns are materiality-gated and transient unless durably dispositioned. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-052** Verify accepted architecture decisions are scoped and have explicit Authority Records and Governance Bases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-053** Verify decision validity reevaluates only when typed relevant inputs fire. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-054** Verify local/user preferences are non-blocking and cannot silently become repository governance. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-055** Verify live research is concern-scoped, freshness-aware, and never automatically migrates. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-056** Verify unresolved `blocking-now` concerns cannot disappear through implementation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-057** Verify decision consequences activate atomically and overlapping scoped decisions are conflict-checked. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-058** Verify Projector-generated conformity cannot vote independently for its causal rule/lens/decision. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-059** Verify risk cannot decrease as uncertainty increases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-060** Verify plans, packets, approvals, and MCP mutation capabilities are dependency-scoped/state-bound and safely rebind only for unrelated root change. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-061** Verify transaction journal/recovery paths at every phase. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-062** Verify generated outputs are repaired upstream by default. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-063** Verify selector/rule caches are dependency-keyed. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-064** Verify analyzer failure degrades only dependent claims. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-065** Verify external live state enters deterministic work only through pinned snapshots. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-066** Verify blocking rules normalize to the supported predicate kernel or an explicit validator. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-067** Verify R2+ independent-validation policy is satisfiable and tested. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-068** Verify multiple valid shared implementations are not falsely canonicalized. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-069** Verify merge/rebase canonical conflicts block stale automation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-070** Verify engine/schema/signature upgrades invalidate old proofs when required. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-071** Verify sensitive data is removed before model-context construction. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-072** Verify path/symlink boundaries prevent out-of-root mutation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-073** Verify the second identical reconciliation has no material semantic delta. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-074** Verify held-out/mutation-generated evaluation accompanies golden fixtures. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-075** Verify semantic-model complexity is measured against use. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-076** Verify no unsupported `proven-within-boundary` claim is emitted. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-077** Verify a representation-profile-only change invalidates dependent projections/contexts without mutating canonical intent. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DELV-008** The final system MUST implement the full ordered control loop in “Final implementation directive”: observe reality without executing it by default; derive deterministic structure; interpret WHAT/WHY while independently scouting WHERE/WHAT-ELSE; resolve requested meaning against existing stable semantic identities; compile a bounded Relevance Closure across semantic, code, event, contract, decision, invariant, and verification topology; create or modify canonical Requirements and Behavioral Scenarios only where they add durable semantic value; normalize requirement/scenario/constraint deltas without preselecting HOW; disclose newly material architecture concerns; reuse valid scoped decisions and dirty only affected decision bases; refresh current evidence and evaluate preferences only where decision materiality requires it; accept/defer architecture decisions and compile their governance consequences; infer semantic classifications and Pattern Candidates; establish authority from independent, causally valid evidence; compile Projection Lenses, typed rules, expectations, and Impact Rules; compile human, behavioral/Gherkin, agent, and machine representations from the same canonical semantic kernel; reject or fall back from any representation that weakens protected semantics or loses net utility; bind plans/capsules/approvals to explicit semantic/physical dependencies rather than a global snapshot alone; record derivations and semantic signatures; calculate Impact Closure, invalidate exact dependents, and widen uncertain impact; backdate only with sufficient assurance; repair upstream and deterministically where possible; dispatch bounded agents only for semantic residue; derive reverse impact from actual mutations and compare it with predicted relevance/impact; classify Planning Surprises and propose learned relationships without manufacturing authority; validate through required independent evidence lanes; reconcile to an explicit fixed point; commit fine-grained canonical intent plus a material transaction receipt; preserve a resumable cleanup frontier; and turn repeated reasoning and newly proven relationships into cheaper executable machinery. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` file — “Final implementation directive”.
- [ ] **DELV-009** The control plane MUST own globally coherent change reasoning, determine relevant accumulated intent and architecture before local agent reasoning dominates, and verify what reality touched. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DELV-010** Aggressive optimization is permitted only when all five conditions hold: the evidence lane is named; the action binds to analyzed dependencies; required semantic dimensions are preserved; sufficiency of the relevant subgraph is explained; and remaining uncertainty is stated. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading — “The governing constraint”.

### GSD bootstrap handoff

- [ ] **HANDOFF-001** Before source removal, every normative clause in `PROJECTOR_SPEC/` MUST be absorbed into self-contained GSD requirements, decisions, constraints, acceptance criteria, phase context, and plans with checksummed provenance and clause-level source-to-destination coverage. Source: `.planning/PROJECT.md` — “What This Is”, “Requirements / Active”, and “Context”.
- [ ] **HANDOFF-002** The complete GSD bootstrap artifact set MUST be ingested into Projector's canonical managed model after the implementation can represent it. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-003** Projector MUST produce semantic-equivalence and coverage evidence showing that imported canonical artifacts preserve all GSD bootstrap semantics, including normative force, negation, scope, cardinality, conditions, exceptions, ordering, literals, identity, and proof boundaries. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Context”.
- [ ] **HANDOFF-004** `PROJECTOR_SPEC/` MUST NOT be removed until every authoritative clause has a self-contained verified destination, no remaining references or semantic dependencies exist, and omission, contradiction, weakened-language, dangling-reference, and semantic-equivalence audits pass with no unique semantics remaining. Source: `.planning/PROJECT.md` — “Requirements / Active”, “Context”, and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-005** The project-local GSD installation, `.planning/`, and project-local GSD support MUST NOT be removed until Projector can plan, execute, verify, reconcile, recover, explain, and continue development of its repository without GSD and no bootstrap artifact retains unique semantics. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-006** After both semantic-equivalence removal gates pass, Projector MUST continue self-development under its own canonical governance without GSD. Source: `.planning/PROJECT.md` — “What This Is” and “Context”.
- [ ] **HANDOFF-007** Before final handoff, Projector MUST provide the named primary execution-host integrations for Codex and Claude Code, using capability-detected adapters. Source: `.planning/PROJECT.md` — “Key Decisions” (Require Codex and Claude Code integrations before final handoff).
- [ ] **HANDOFF-008** The bootstrap and end-to-end proof MUST optimize for the Projector maintainer/developer, whose self-governance of Projector’s own repository is the decisive product proof. Source: `.planning/PROJECT.md` — “Key Decisions” (Optimize the bootstrap for the Projector maintainer/developer).

## Locked Constraints and Decisions

- **DELV-011** The vertical-slice-first sequence and all Slice 0–12 deliverables are locked committed v1 scope; implementation MUST NOT reinterpret later slices as deferred or v2 work. Source: `.planning/PROJECT.md` — “Constraints / Complete committed scope” and “Key Decisions”.
- **DELV-012** The mandatory misplaced-script loop is the first broadening gate and MUST pass before broad analyzers, host integration, modernization, or external surfaces. Source: `.planning/PROJECT.md` — “Requirements / Active” and `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.
- **DELV-013** Completion means the entire specified system passes release and redesign gates, governs its own repository, imports GSD bootstrap state, and continues without GSD; the first slice alone is not project completion. Source: `.planning/PROJECT.md` — “Context”.
- **DELV-014** Source deletion is an audited semantic migration, not file cleanup; an exact checksummed source snapshot MUST remain available as migration evidence until full GSD re-expression and equivalence gates pass. Source: `.planning/PROJECT.md` — “Context” and “Key Decisions”.
- **DELV-015** GSD is a removable bootstrap dependency and MUST NOT remain a permanent runtime or development dependency after the self-hosting handoff. Source: `.planning/PROJECT.md` — “Key Decisions”.

## Explicit Non-Goals

- **DELV-016** Package-completion planning is prohibited; delivery is by complete causal vertical slices. Source: `.planning/PROJECT.md` — “Constraints / Vertical delivery”.
- **DELV-017** Visualization, broad cloud adapters, and a universal semantic model are not valid starting points before the mandatory vertical slice passes. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.
- **DELV-018** Broad analyzers are not Slice 0 scope. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- **DELV-019** External surfaces are not permitted before the local kernel is credible. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Slice 12 — External surfaces”.
- **DELV-020** A Markdown-, prompt-, static-graph-, or advice-primary release is explicitly insufficient. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”.
- **DELV-021** Fixture-specific names are not an acceptable mechanism for architecture concern-discovery success. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` — “Held-out concern-discovery robustness”.
- **DELV-022** Golden-fixture memorization is not an acceptable benchmark strategy; held-out mutation-generated generalization is required. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Held-out/mutation-generated benchmark”.

## Source Coverage

Every H1/H2/H3 heading in `PROJECTOR_SPEC/12-delivery/*.md` is mapped below. `CONTEXT` means the heading is structural and its substantive descendants are mapped to requirement IDs.

| Source heading | Requirement IDs / disposition |
|---|---|
| `acceptance-architecture.md` — H1 Architecture Acceptance Scenarios | CONTEXT: ACC-046–ACC-062 |
| H2 Architecture expansion: web app → cross-platform product | ACC-046–ACC-055 |
| H2 Preference scope isolation | ACC-056 |
| H2 Stale architecture research | ACC-057 |
| H2 Decision deferral preserves optionality | ACC-058 |
| H2 Negative/simple decision | ACC-059 |
| H2 Decision overlap conflict | ACC-060 |
| H2 Held-out concern-discovery robustness | ACC-061–ACC-062, DELV-021 |
| `acceptance-core.md` — H1 Core Acceptance Scenarios | CONTEXT: ACC-063–ACC-090 |
| H2 Canonical rebuild closure | ACC-063 |
| H2 Copied-slop majority and endogenous-evidence defense | ACC-064–ACC-067 |
| H2 Semantic-signature insufficiency | ACC-068 |
| H2 Semantic backdating | ACC-069 |
| H2 Shared-bug rebuild oracle | ACC-070 |
| H2 SCC backdating | ACC-071 |
| H2 Selector membership change | ACC-072 |
| H2 Multiple valid shared implementations | ACC-073 |
| H2 Governance-cycle detection | ACC-074–ACC-075 |
| H2 Crash recovery matrix | ACC-076 |
| H2 Branch governance conflict | ACC-077 |
| H2 Open-world completeness refusal | ACC-078 |
| H2 Unreachable external surface | ACC-079 |
| H2 Model resampling idempotence | ACC-080 |
| H2 Validator independence | ACC-081 |
| H2 Generated-output upstream repair | ACC-082 |
| H2 Partial completion and plan rebase | ACC-083 |
| H2 Localized cache performance | ACC-084 |
| H2 Engine/signature-profile upgrade | ACC-085 |
| H2 Analyzer partial failure | ACC-086 |
| H2 Path/symlink escape | ACC-087 |
| H2 Misleading local precedent | ACC-088 |
| H2 Projector repair oscillation | ACC-089 |
| H2 Held-out/mutation-generated benchmark | ACC-090, DELV-022 |
| `acceptance-relevance-and-identity.md` — H1 Relevance and Semantic Identity Acceptance Scenarios | CONTEXT: ACC-091–ACC-113 |
| H2 Synonymous request reuses canonical identity | ACC-091–ACC-092 |
| H2 Alias change refreshes discovery without semantic invalidation | ACC-093 |
| H2 Superseded/renamed identity is not resurrected as a duplicate | ACC-094 |
| H2 Cross-cutting governing concern outside touched package | ACC-095 |
| H2 Encapsulation is not retrieval | ACC-096 |
| H2 Relevance is not impact | ACC-097 |
| H2 Relevance over-expansion refusal | ACC-098 |
| H2 Event topology discovers non-obvious consumers | ACC-099 |
| H2 Contract topology discovers consumers | ACC-100 |
| H2 Requirement and scenario projections are derived | ACC-101 |
| H2 WHAT/WHY is protected without WHERE blindness | ACC-102 |
| H2 Unrelated canonical change does not stale local work | ACC-103 |
| H2 Bound dependency change does stale local work | ACC-104 |
| H2 Membership-changing fact invalidates context even when loaded entities are unchanged | ACC-105 |
| H2 Newly relevant semantic state invalidates negative-space proof | ACC-106 |
| H2 Query semantics are part of state binding | ACC-107 |
| H2 Open-world emptiness is not absence proof | ACC-108 |
| H2 Planning Surprise learns a missing relationship | ACC-109 |
| H2 Planning Surprise rejects agent overreach | ACC-110 |
| H2 Fine-grained canonical merge locality | ACC-111 |
| H2 Semantic storage path does not define meaning | ACC-112 |
| H2 Analysis Facets compose without methodology lock-in | ACC-113 |
| `acceptance-representation.md` — H1 Representation Acceptance Scenarios | CONTEXT: ACC-114–ACC-119 |
| H2 Representation semantic-fidelity rejection | ACC-114 |
| H2 Cross-projection consistency | ACC-115 |
| H2 Net-negative compact-context fallback | ACC-116 |
| H2 Representation-profile invalidation | ACC-117 |
| H2 Authoritative specification human-technical conformance | ACC-118, DOG-014 |
| H2 Compact context preserves critical tokens and avoids false compression | ACC-119 |
| `first-vertical-slice.md` — H1 Mandatory First Vertical Slice | CONTEXT: ACC-011–ACC-034, SLICE-026–SLICE-027 |
| H2 Mandatory first vertical slice | ACC-011–ACC-034, SLICE-026–SLICE-027, DELV-012, DELV-017 |
| `implementation-plan.md` — H1 Implementation Plan | CONTEXT: DELV-001–DELV-007, SLICE-000–SLICE-101, ACC-000–ACC-045 |
| H2 Vertical-slice-first delivery | DELV-001–DELV-006 |
| H2 Slice 0 — Foundation and correctness substrate | SLICE-000–SLICE-010, ACC-000–ACC-009, DELV-018 |
| H2 Slice 1 — Mandatory misplaced-script loop from start to finish | SLICE-011–SLICE-025, ACC-010 |
| H2 Slice 2 — Semantic signatures, invalidation, and backdating | SLICE-028–SLICE-037, ACC-035–ACC-036 |
| H2 Slice 3 — Behavioral intent, identity resolution, and Relevance Engine | SLICE-038–SLICE-050, ACC-037–ACC-042 |
| H2 Slice 4 — Governance robustness and representation | SLICE-051–SLICE-063 |
| H2 Slice 5 — Progressive architecture commitment | SLICE-064–SLICE-074, ACC-043–ACC-044 |
| H2 Slice 6 — Broaden analyzers and relevance/divergence topology | SLICE-075–SLICE-083 |
| H2 Slice 7 — Coverage completion and cleanup | SLICE-084–SLICE-090 |
| H2 Slice 8 — Full Semantic Change Compiler and packet executor | SLICE-091–SLICE-092 |
| H2 Slice 9 — Host/MCP integrations | SLICE-093–SLICE-095 |
| H2 Slice 10 — Modernization | SLICE-096 |
| H2 Slice 11 — Watch/CI/hardening | SLICE-097–SLICE-099 |
| H2 Slice 12 — External surfaces | SLICE-100–SLICE-101, ACC-045, DELV-019 |
| `release-and-directive.md` — H1 Release, Dogfooding, and Final Directive | CONTEXT: REL-001–REL-077, DOG-001–DOG-017, DELV-008–DELV-010 |
| H2 Minimum credible public release | REL-001–REL-026, DELV-020 |
| H2 Dogfooding requirement | DOG-001–DOG-017 |
| H2 Final implementer checklist | REL-027–REL-077 |
| H2 Final implementation directive | DELV-008–DELV-010 |
