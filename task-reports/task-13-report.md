# Task 13 — Progressive architecture commitment

## Delivery

- Branch: `codex/projector-t13`
- Base: `9a46bd1b61b8afa27b503dc7805857421085320c`
- Commit: `155d328` (`feat(engine): add progressive architecture commitment`)
- Ownership respected: architecture implementation stays under `packages/engine/src/architecture/**`; the engine root barrel was not edited. A package subpath export exposes the composition API.

## Material behavior shipped

- Bounded Relevance Closure signals activate deterministic, technology-neutral architecture questions. Deterministic platform/public-contract minima dominate inferred materiality; circular decision-origin candidates are rejected.
- Applicability and negative-space query fingerprints are included in `StateBinding`. Open/unavailable evidence remains uncertain; disjoint decisions remain valid; `suspect` explicitly means lost proof rather than forced migration.
- Current option sets are verified through an injected research port. Required unavailable evidence blocks automatic acceptance while explicit-user acceptance retains visible uncertainty.
- Hard failures are eliminated before ranking; unknowns remain explicit. Project preferences dominate lower scopes, conflicts remain visible, only influential preference hashes are recorded, and preferences emit no governance authority.
- Negative/simple decisions are valid. Deferral has structural validation plus an injected neutrality/optionality assessment so a hidden temporary selection is rejected.
- Authority records and normative decision schemas are verified before activation. Batch/new-existing overlap is checked before one atomic semantic-governance transaction. SCC evaluation uses normalized stable digests, immutable fixed inputs, repeated-cycle detection, and bounded `decision-convergence-failure` with no partial state.
- Pure preflight consumes the supplied bounded closure. Observe/Guide can explore without governed completion; Govern/Autonomous R2+ block unresolved blocking concerns unless an approved user/policy exception exists.
- Public `@projector/engine/architecture` APIs are composed by CLI `audit --decisions`, `explain decision:<id>`, and optional plan preflight. Audit reports equivalent decisions, incompatible/unknown overlap, closed-world no-population staleness, and unproven open-world population.

## RED/GREEN evidence

- RED was captured independently for discovery, evaluation/validity, governance/convergence, preflight/audit, and CLI composition as missing modules or missing CLI authority.
- Focused GREEN: 17 architecture/CLI tests across 5 files; affected engine and CLI typechecks passed during iteration.

## Frozen gate

- `pnpm verify` — pass: 45 files, 549 tests; repository typecheck and boundary check pass.
- `pnpm build` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check` — pass.
- `diff -u packages/core/src/schemas/generated-contracts.ts <(node scripts/generate-contract-schemas.mjs)` — pass; normative schema generation is unchanged.

## Residuals

- The CLI composition root requires a host-provided architecture store, overlap evaluator, population reader, and validity reader. Filesystem/host adapters remain later host-integration work; absent providers fail closed.
- Broad analyzer coverage and held-out topology expansion remain Task 14.

## Independent comprehensive review — MATERIAL FINDINGS BATCH

Range reviewed: `9a46bd1..155d328`. Focused architecture/CLI tests pass (17/17); engine and CLI typechecks pass. The frozen 549-test/build gate was accepted as reported. Six material blockers remain:

1. **Caller assertions can clear architecture authority/proof gates.** `assessDecisionValidity` accepts caller-provided `applicable` and `StateBindingValidation`; `evaluateDecisionOptions` accepts an unauthenticated `"explicit-user"` flag plus unverified preference hashes/matches; preflight overrides and decision acceptance schema-parse authority/decision objects without authenticating their semantic hashes. Runtime probes showed a caller-declared non-applicable decision clearing a Govern/R2 blocking frontier, unavailable research producing a recommendation from only `acceptance: "explicit-user"`, and all-`a` forged decision/authority hashes reaching the semantic-governance transaction. Bind applicability to evaluated query dependencies, validate the binding at the composition boundary, authenticate canonical hashes/preferences/authority, and require a verified user-authority proof for the uncertainty exception. (`evaluation.ts:49-101,121-128,183-223`; `preflight.ts:43-64`; `governance.ts:41-82`.)
2. **Semantic deferral validation is not on the preflight path.** `assessDecisionDeferral` correctly checks compatibility, optionality, hidden selection, and irreversible commitments, but `runArchitecturePreflight` calls only structural `validateDecisionDeferral`. A structurally complete deferred blocking concern therefore returned `planningAllowed: true, governedCompletion: true` without invoking the neutrality port. Preflight must consume a verified deferral assessment, so hidden temporary choices/irreversible commitments remain blocking. (`evaluation.ts:246-281`; `preflight.ts:53-57`.)
3. **Concern discovery is name-bound, over-expands public-contract work, and does not enforce causal-origin circularity.** A public `surface-added` input for `windows` with no preselected facet produced zero concerns; a narrow `public-contract` constraint delta produced the entire eight-item cross-platform frontier including distribution/signing; an inferred candidate caused by an originating decision was accepted whenever that decision ID was not also repeated in `subjectIds`. This violates held-out-name robustness, minimal causally supported activation, deterministic minima, and endogenous-origin refusal, causing either missing blocking decisions or spurious architecture ceremony. Replace token/facet-wide activation with typed change/facet rules per concern and carry verifiable originating-decision provenance. (`discovery.ts:55-77,125-153`.)
4. **SCC convergence is an unused acceptance prerequisite.** `convergeDecisionGroup` detects cycles in isolation, but `acceptArchitectureDecisions` neither detects decision dependency SCCs nor requires a successful convergence proof. A runtime probe submitted two mutually `constrain-decision` decisions and they committed successfully without convergence. Compose convergence into acceptance before opening the transaction and reject absent/stale/failing convergence evidence. (`governance.ts:62-106,108-157`.)
5. **CLI preflight policy is supplied by the architecture provider instead of bound to the normalized command policy.** `executeProjector` passes the provider's `mode` and `risk` directly to preflight. A public `projector plan --mode guide` probe was blocked when the provider returned `mode: govern`; conversely a Govern request can be weakened by a provider returning Guide. Override/bind preflight mode and risk from the normalized CLI policy and derived operation risk. (`cli.ts:152-169,205-209`.)
6. **`audit --decisions` misses reordered semantic equivalents and silently collapses conflicting duplicate IDs.** The equivalence key preserves raw `appliedPreferences`/consequence ordering, and input normalization uses a last-write `Map`. Two otherwise equivalent decisions with reversed preference refs produced no `equivalent-decisions` finding. Normalize set-like decision fields and fail closed on conflicting duplicate IDs before auditing. (`preflight.ts:131-153`.)

## Consolidated repair closure

- Repair commit: `4594406`.
- Closed all six findings: authenticated current-state proofs/hashes, semantic deferral, typed minimal discovery/provenance, SCC proof gating, CLI-bound mode/risk, and fail-closed canonical audit sets.
- RED/GREEN: seven sibling assertions; focused suite 24/24.
- Frozen gate: `pnpm verify` 46 files/556 tests; build, boundaries, staged diff, and isolated schema comparison passed.

## Independent targeted closure — PASS

- Reviewed only `155d328..4594406` against the six recorded blockers and likely direct regressions.
- Verified authenticated applicability/current binding, preference and authority hashes/matches, explicit-user uncertainty authority, semantic deferral assessment in preflight, typed minimal held-out discovery with originating-decision refusal, fresh SCC convergence proof before transaction, CLI-owned mode/risk, and canonical audit set ordering/conflicting-duplicate rejection.
- Focused architecture/CLI runtime suite: 24/24 passed. Engine and CLI typechecks passed. Relied on the reported frozen 556-test/build/boundary/schema gate.
- No material blocker remains on the agreed Task 13 matrix.
