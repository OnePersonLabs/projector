# Implementation Plan

## Vertical-slice-first delivery

Every slice:

- starts with failing fixture/property tests.
- implements the smallest complete causal loop.
- ends with tests, inspectable diff, and commit.
- avoids speculative adapters/packages not required by that slice.
- preserves normative contracts or records an explicit architecture decision changing them.
- leaves the repository in a state the next slice can govern rather than creating throwaway parallel machinery.

## Slice 0 — Foundation and correctness substrate

Deliver only:

- monorepo/package boundaries and composition root.
- complete Zod-backed normative contracts needed by early slices, including Requirements, Behavioral Scenarios, fine-grained canonical identity, `StateDigest`, `StateBinding`, `StateQuerySpec`/query-result fingerprints, Semantic Representation Profiles/Projections, and preservation fingerprints.
- fine-grained canonical `.projector/model/` storage for Concepts, Requirements, Behavioral Scenarios, and Relations plus rules/lenses/representations/authorities/decisions/exceptions/migrations/receipts.
- deterministic canonical-root digest derived from independently addressable canonical files.
- schema-defined semantic hashing and stable identity/aliases/lineage.
- core ports.
- SQLite derived store and migrations.
- transaction journal + writer lease.
- fixture harness.
- minimal CLI skeleton.

Acceptance:

- all public contract references resolve.
- canonical state survives `state.db` deletion/rebuild.
- a bounded canonical entity can be loaded/updated without loading or rewriting the full semantic graph.
- semantic hashes ignore declared volatile metadata.
- deterministic project-root digest is independent of filesystem enumeration order.
- unrelated canonical entity changes alter the root digest but do not make an unrelated dependency-scoped `StateBinding` stale.
- a newly matching semantic entity/relation/membership changes a bound query-result fingerprint and stales the affected binding even when all previously selected entity hashes are unchanged.
- an `open`/`sampled`/`unavailable` discovery lane cannot establish a negative-space absence proof.
- transaction crash harness can detect/recover an interrupted empty/sample transaction.
- package dependency-direction test passes.

Do not build broad analyzers yet.

## Slice 1 — Mandatory misplaced-script loop from start to finish

Implement only the facts needed for the first product wedge:

- filesystem inventory.
- Git identity/move facts.
- package-script invocation facts.
- minimal JavaScript role/lifecycle features.
- Projection Units and deterministic anchors.
- Pattern Candidate inference.
- descriptive-vs-normative authority distinction.
- minimal selector and blocking predicate kernel.
- candidate/active repository-script lens.
- placement/test expectation.
- deterministic move/reference transform.
- dependency-scoped state-bound plan/capsule.
- validators.
- reconciliation.
- transaction receipt/certificate.

This slice MUST prove that Projector can reject misleading path proximity and repair the anomaly safely.

## Slice 2 — Semantic signatures, invalidation, and backdating

Add:

- semantic-signature profiles with assurance.
- derivation inputs/reverse index.
- Impact Rules.
- API contract fixture.
- exact/validated backdating.
- heuristic-equality refusal.
- SCC proof-group support sufficient for fixture tests.
- rebuild and independent-conformance oracle distinction.
- localized StateBinding value-dependency and query-dependency validation/rebinding.
- deterministic registered query programs and closure-sensitive result fingerprints sufficient for identity, relation-neighborhood, selector-membership, event/contract-consumer, and implementation-binding fixtures.

Acceptance includes unchanged public contract preventing client regeneration only when assurance policy permits it, and unrelated root-state mutations not staling independent work.

## Slice 3 — Behavioral intent, identity resolution, and Relevance Engine

Add the missing change-cognition front half:

- canonical Requirement and Behavioral Scenario persistence/querying.
- Concept/Requirement/Scenario aliases.
- Semantic Identity Resolution with reuse/coordinated-change/split/create/no-entity outcomes.
- duplicate/overlap prevention before new canonical identity creation.
- WHAT/WHY intent analysis and read-only WHERE/WHAT-ELSE Relevance Scout.
- bounded Relevance Closure with direct/governing/consequence/possible bands.
- deterministic relevance traversal over canonical relations, Projection Unit bindings, selectors, package/code topology, verification bindings, and active decisions/invariants.
- minimal event/contract producer-consumer topology sufficient for fixtures.
- Analysis Facet activation framework.
- Context Compiler consumption of Relevance Closure.
- binding of closure-sensitive identity/adjacency/membership/event/contract queries so negative-space and stopping conditions cannot go stale silently.
- predicted-versus-observed impact comparison and Planning Surprise records.
- held-out relevance/over-expansion fixtures.

Acceptance:

- a synonymous request modifies an existing identity instead of creating a duplicate.
- a cross-cutting invariant outside the touched package enters governing context through semantic applicability.
- unrelated semantic domains remain outside the compiled context.
- a known event/contract consumer enters relevance without model guessing.
- an implementation that legitimately exposes a missing relationship yields a Planning Surprise and proposed reusable relationship rather than silent plan mutation.
- a generated Markdown/Gherkin view is demonstrably derived from Requirement/Scenario identities rather than becoming a second source of truth.

## Slice 4 — Governance robustness and representation

Add:

- semantic representation compiler with `human-technical@1`, `agent-compact@1`, and `machine-invariant@1` reference profiles.
- protected-dimension Semantic Preservation Fingerprints.
- deterministic controlled-prose/style lint and literal-preservation checks separated from semantic-fidelity proof.
- representation-profile dependency invalidation and fallback policy.
- tokenizer/profile cost accounting sufficient to refuse net-negative compact context.
- lens overlap roles.
- projection expectation kinds.
- governance strata/fixed-point failure handling.
- layered ignore policy.
- dependency-keyed selector/rule caches.
- risk and `ExecutionPolicy` normalization.
- plan immutable revision/rebase including lightweight rebind when only unrelated root state changed.
- canonical engine/schema upgrade protocol.

## Slice 5 — Progressive architecture commitment

Add:

- complete `ArchitectureConcern`, `ArchitectureDecision`, `DecisionEvaluation`, `DecisionValidityAssessment`, `DeveloperPreference`, and `GovernanceBasis` contracts.
- concern discovery/materiality from the already-compiled Relevance Closure.
- scope-specific decision reuse/dirtying.
- typed reconsideration and evidence-refresh policy.
- preference providers/composition with project-only canonical adoption.
- decision consequences and crash-consistent governance activation.
- deferral/optionality contracts.
- decision overlap/SCC convergence.
- architecture preflight in `projector change`.
- `projector decisions`, decision explanation, and decision-pressure audit.
- cross-platform expansion fixture.

Acceptance: A single-web-app → cross-platform request produces a concise decision frontier. It uses current research only for volatile choices, preserves unaffected decisions, does not preselect technologies, and receives relevant cross-cutting context without loading unrelated semantic domains. It may keep simple tooling until evidence or reconsideration triggers justify more.

## Slice 6 — Broaden analyzers and relevance/divergence topology

Only after Slices 0–5 pass, broaden:

- full TypeScript/JavaScript semantic indexing.
- richer event/public-contract producer-consumer extraction.
- structured data.
- Markdown.
- GitHub Actions.
- richer divergence taxonomy/reporting.
- analyzer capability/failure degradation.
- Relevance Engine use of newly available deterministic lanes.

## Slice 7 — Coverage completion and cleanup

Deliver:

- observability-aware coverage snapshots.
- semantic-identity/relevance coverage lanes.
- information-gain question ranking.
- interactive promotion/exception/defer handling.
- resumable cleanup plans.
- open-world completeness refusal.
- Planning Surprise/relevance-quality metrics.

## Slice 8 — Full Semantic Change Compiler and packet executor

Deliver the complete request-to-plan flow:

```text
intent analysis + Relevance Scout
→ identity resolution
→ Relevance Closure
→ Requirement/Scenario delta
→ Analysis Facets
→ architecture preflight
→ Impact Closure
→ packet grouping/SCC handling
→ checkpoints/rebase
→ bounded deterministic/agent execution
→ reverse-impact comparison
→ reconciliation
→ receipts/certificates
```

Execution Capsule compilation MUST keep the structured normative kernel authoritative while emitting the least-cost valid Representation Projection for explanatory/task context.

## Slice 9 — Host/MCP integrations

Deliver capability-detected Codex/Claude adapters, dependency-bound MCP mutation capabilities, relevance/context query tools, direct-write observation, and host tests. Host adapters MUST consume state-bound representation projections without treating generated compact prose as canonical governance.

## Slice 10 — Modernization

Deliver friction aggregation, alternative comparison, authority-aware upgrade proposals, migration overlays, and staged execution through the same relevance/architecture/impact machinery used by ordinary changes.

## Slice 11 — Watch/CI/hardening

Deliver incremental watch, CI exit policy, recovery UX, cost/complexity accounting, hostile-content/path hardening, and benchmark harness. Measure relevance recall/context expansion, duplicate prevention, Planning Surprise, scoped state binding, representation fidelity, token economics, and instruction efficiency. Disable optimizations that do not earn their cost.

## Slice 12 — External surfaces

Implement only after the local kernel is credible:

1. GitHub or another high-value external surface.
2. Generic HTTP/JSON.
3. Further providers based on actual demand.

Each adapter ships independently when its observability/capability contract, relevance/impact relationships, drift semantics, snapshot behavior, and truthful unavailable/open-world behavior pass tests.
