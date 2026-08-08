# Projector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for each coherent task. This plan deliberately uses subsystem-sized tasks because the approved handoff overrides microtask decomposition. Parallel tasks have disjoint semantic ownership and are integrated by the primary agent.

**Goal:** Implement the authoritative Projector 2.0.0 specification as a host-independent TypeScript/Node.js semantic control plane, prove the mandatory misplaced-script loop, and satisfy the credible-public-release gates.

**Architecture:** A strict ESM pnpm workspace follows the required ports-and-composition-root dependency graph. Fine-grained canonical JSON is authoritative; SQLite is rebuildable derived state; bounded work uses value and query dependencies rather than global invalidation. Deterministic analyzers, governance, transforms, invalidation, and reconciliation form the kernel; model/host integrations remain injected adapters.

**Tech Stack:** Node.js 24 LTS, strict TypeScript ESM, pnpm workspaces, Zod plus exported JSON Schema, SQLite, TypeScript Compiler API, canonical JSON plus `sha256:v1`, Vitest, fast-check, Git subprocesses, JSONL telemetry.

## Global Constraints

- Authority: `PROJECTOR_SPEC/SPEC.md` plus the 43 manifest modules; `INDEX.md` is navigation and generated bundles have no authority.
- Package dependencies: `core -> none`; `engine|analyzers|runtime|integrations -> core`; `cli -> core + engine + analyzers + runtime + integrations`. Integrations may consume only a narrow engine facade.
- Core contracts cannot require a host brand, SQLite, model vendor, process runner, or concrete filesystem.
- Canonical authored/governance state is fine-grained under `.projector/`; `state.db`, caches, generated views, reports, unfinished plans, and verbose certificates are derived/ignored by default.
- Stable identity is independent of path, wording, aliases, and package containment. Relations own edges.
- Semantic, discovery, canonical-document, and root snapshot hashes are distinct, versioned, deterministic domains.
- A changed root digest triggers dependency-scoped `StateBinding` validation, not automatic invalidation. Boundary-defining queries, including empty results, are dependencies.
- Open, sampled, and unavailable lanes cannot prove absence or completeness.
- Relevance Closure is pre-change cognition; Impact Closure and exact derivation invalidation are post-delta mechanisms.
- Pattern Candidates remain descriptive until independent authority activates governance. Projector-generated conformance cannot vote for its causal rule or lens.
- Mutation is state-bound, scope-constrained, previewed, journaled, independently validated where required, reversible or explicitly recoverable, and reconciled to a fixed point.
- No production behavior is added without a failing test that names the break it catches. Each task runs its narrow suite; wave integrations run dependent and repository-wide gates.
- Default tests use fake hosts/providers and require no paid model or installed Codex/Claude.
- External live state enters deterministic work only through pinned, adapter-versioned snapshots.
- R4 is never autonomous in 1.x; uncertainty cannot lower risk.
- Do not implement a graph service, daemon, broker, hosted service, embedding dependency, generic Tree-sitter layer, or UI before a measured requirement exists.

## File and ownership map

- Shared root/configuration: primary integration authority only (`package.json`, `pnpm-workspace.yaml`, lockfile, root TypeScript/Vitest/ESLint configs, dependency-boundary checks).
- `packages/core/**`: public domain schemas, schema registry, canonical hashing/identity, and host-neutral ports.
- `packages/engine/**`: state binding, evidence/authority, governance, relevance, invalidation, representation, architecture, reconciliation, coverage, change planning.
- `packages/analyzers/**`: no-exec local filesystem/Git/package/TS/structured-data/Markdown/Actions adapters.
- `packages/runtime/**`: canonical/SQLite persistence, safe paths/processes, transforms, leases, journals, recovery, worktree execution.
- `packages/integrations/**`: model, host, MCP, and surface adapters using core ports and the narrow engine facade.
- `packages/cli/**`: composition root, commands, policy normalization, output modes.
- `packages/testkit/**` and `fixtures/**`: fake ports, fixture repositories, crash harness, held-out/mutation generators, acceptance and benchmark harnesses.

## Implementation DAG

```text
T1 foundation/contracts/hashing/ports
 ├─ T2 canonical + SQLite persistence/rebuild
 ├─ T3 security + lease/journal/recovery runtime
 ├─ T4 state binding + registered queries + graph revision
 └─ T5 testkit + fixture corpus substrate
      T2+T3+T4+T5
       ├─ T6 local analyzers + projection units
       ├─ T7 evidence/authority + selector/rule/lens kernel
       └─ T8 transform + plan/capsule/receipt runtime
            T6+T7+T8 → T9 mandatory misplaced-script reconciliation loop + CLI
              → T10 signatures/derivations/invalidation/backdating
                → T11 semantic identity + relevance + facets + surprises
                  → T12 governance robustness + representations + plan rebind/rebase
                    → T13 progressive architecture commitment
                      → T14 broad analyzers/topology
                        → T15 coverage/completion
                          → T16 full semantic change compiler/packet executor
                            ├─ T17 model/host/MCP integrations
                            └─ T18 modernization/research/surface framework
                                 T17+T18 → T19 watch/CI/security/observability/benchmarks/dogfood
                                           → T20 full acceptance + public package
                                             → T21 external adapters (post-credible-local-kernel)
```

Critical path through one longest branch: `T1 → T2 → T6 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T19 → T20`. T3, T4, and T5 are join prerequisites co-critical to the T6/T8 wave; T7 and T8 are parallel join prerequisites for T9.

Maximum initial independent implementation wave after T1: T2, T3, T4, and T5. Maximum Slice-1 wave after that integration: T6, T7, and T8.

Wave boundary after T2–T5: the primary integration authority runs the complete Slice-0 gate—root typecheck/tests/build, registry/reference coverage, package-boundary enforcement, canonical delete/rebuild and locality properties, state-binding locality/query-membership properties, journal empty/sample crash recovery, fixture isolation, and minimal CLI `--help`/`--version` smoke tests—before T6–T8 can become integrated.

### Task 1: Workspace, normative contracts, hashing, identity, and ports

**Files:** shared root configs; `packages/core/**`; minimal `packages/cli` package/entrypoint skeleton; package-boundary test under `scripts/` or `packages/testkit/`.

**Produces:** all 147 exported normative declarations represented as TypeScript types where applicable; Zod schemas for every serialized public contract; JSON Schema export and reference-resolution validation; stable IDs; canonical serialization; schema-defined semantic/discovery/document/root hashing; host-neutral ports; package dependency guard; buildable minimal CLI entrypoint exposing `--help` and `--version` without composing unfinished subsystems.

**Verification:** schema registry completeness, typecheck, JSON Schema cross-reference resolution, insertion-order/root-order properties, hash-domain and volatile-field tests, ID/path/alias/lineage properties, dependency-direction test, CLI build/help/version smoke test.

- [ ] Implement with contract tests first, verify locally, commit one coherent foundation unit, and record exact test evidence in the task report.

### Task 2: Fine-grained canonical repository and SQLite rebuild substrate

**Files:** `packages/runtime/src/persistence/**`; `packages/runtime/src/sqlite/**`; persistence tests and fixtures only.

**Consumes:** core canonical envelopes, registry, hashes, graph/persistence ports.

**Produces:** independently addressable canonical entity/governance repository; deterministic root manifest; SQLite migrations and atomic graph revisions; canonical-to-derived rebuild; bounded load/update; duplicate-ID/conflict detection.

**Verification:** delete/rebuild equivalence, filesystem-enumeration independence, bounded entity update without whole-graph rewrite, exact root changes, fine-grained merge locality, storage-path identity independence.

- [ ] Implement via failing persistence/property tests, verify package scope, commit, and report.

### Task 3: Root-constrained execution, writer lease, transaction journal, and recovery

**Files:** `packages/runtime/src/security/**`, `packages/runtime/src/execution/**`, `packages/runtime/src/journal/**`, `packages/runtime/src/worktrees/**`; matching tests.

**Consumes:** core `StateDigest`, operation evidence, rollback, validation, risk and command contracts.

**Produces:** cross-platform repository path service; argv-only declared command executor; one-writer lease; durable journal state machine; deterministic resume/rollback/recovery-required outcomes; checkpoints and compensation records.

**Verification:** path traversal/symlink/Windows drive/UNC refusal; crash injection at every specified journal phase; lease contention/recovery; rollback restoration; no undeclared command scope.

- [ ] Implement via failing safety/recovery tests, verify package scope, commit, and report.

### Task 4: Dependency-scoped state binding, query programs, and derived graph reader

**Files:** `packages/engine/src/state/**`, `packages/engine/src/query/**`; engine tests only.

**Consumes:** core state/query/observability contracts and fakeable graph/query ports.

**Produces:** deterministic registered query programs; normalized result fingerprints; dependency digest; conservative dependency-key optimization; current/rebound/stale/suspect/unavailable validator; minimal in-memory graph reader.

**Verification:** unrelated root change safely rebinds; value change stales; new member/edge/consumer changes query fingerprint; query program/version change stales; empty open/sampled/unavailable result never proves absence; insertion ordering is irrelevant.

- [ ] Implement via failing state-binding/property tests, verify package scope, commit, and report.

### Task 5: Testkit and fixture corpus substrate

**Files:** `packages/testkit/**`; `fixtures/misplaced-repository-script/**`; reusable fixture builders and mutation/crash harnesses.

**Consumes:** core public contracts only.

**Produces:** fake graph/query/model/host/surface ports, temp Git repository harness, deterministic clocks/IDs, crash injector, exact mandatory misplaced-script fixture, held-out/mutation fixture conventions.

**Verification:** testkit self-tests prove fixture fidelity, isolation, no repository execution during inventory, deterministic fixture cloning, and injected phase selection.

- [ ] Build the reusable test substrate and fixture as one coherent unit, verify, commit, and report.

### Task 6: No-exec local analyzers and stable Projection Units

**Files:** `packages/analyzers/src/filesystem/**`, `git/**`, `typescript/**` limited to package scripts and minimal JS role/lifecycle facts; analyzer tests.

**Consumes:** core analyzer/surface/artifact/projection contracts and testkit fixture.

**Produces:** inventory, Git identity/move facts, package-script invocation facts, imports/dependencies, test-target facts, hook lifecycle/entrypoint facts, deterministic anchors and Projection Units, localized analyzer failures.

**Verification:** misleading path proximity loses to role/invocation/dependency evidence; inventory is no-exec; anchors survive harmless edits/moves; failures degrade only affected claims.

- [ ] Implement the Slice-1 analyzer wedge with failing fixture tests, verify, commit, and report.

### Task 7: Evidence, Pattern Candidates, authority, selectors, rules, and minimal lenses

**Files:** `packages/engine/src/inference/**`, `authority/**`, `governance/**`; engine tests.

**Consumes:** core evidence/authority/selector/rule/lens contracts, graph/query ports, and Projection Unit fixtures conforming to the analyzer output contract. T9 integrates this kernel with T6's concrete analyzer output, preserving T6/T7 parallelism.

**Produces:** causal evidence grouping; copied/generated-occurrence discounting; descriptive family inference; Pattern Candidate/authority separation; deterministic selector normalization/evaluation; authority ordering; hard predicate/conflict compiler; active/shadow repository-script lens.

**Verification:** Projector-generated conformity cannot inflate authority; selector truth tables/order independence/membership deltas; blocking conflicts fail; advisory payloads cannot override policy; lens owner collision and fixed-point cycle handling.

- [ ] Implement the minimal governance kernel with failing adversarial tests, verify, commit, and report.

### Task 8: Deterministic transform, state-bound plan/capsule, receipts, and certificates

**Files:** `packages/runtime/src/transforms/**`; `packages/engine/src/planning/**`; minimal `packages/engine/src/change/**`; tests.

**Consumes:** core transform/plan/capsule/transaction contracts, state binding, runtime journal/checkpoint ports.

**Produces:** declarative registered-transform metadata; move/reference transform; preview/apply/verify/idempotence; immutable minimal plan and Execution Capsule; validation-set normalization; compact receipt and verbose certificate artifact writer.

**Verification:** transform convergence/idempotence, exclusive claims, out-of-scope refusal, stale binding refusal, source-before-generated ordering, required certificate for success/failure/partial outcomes, content-addressable linkage.

- [ ] Implement the state-bound deterministic execution capability with failing tests, verify, commit, and report.

### Task 9: Mandatory misplaced-script fixed-point loop and CLI composition

**Files:** `packages/engine/src/reconciliation/**`; `packages/cli/**`; cross-package Slice-1 acceptance tests.

**Consumes:** the engine reconciliation implementation consumes only core contracts and injected ports/facades. The CLI composition root and cross-package acceptance tests consume T2–T8 public package facades; engine code must not import runtime/analyzer implementations.

**Produces:** `projector init|audit|plan|apply|reconcile|explain`; minimal mode/flag-to-`ExecutionPolicy` normalization and R1 approval binding; complete 17-step misplaced-script causal loop; divergence rationale/counterevidence/caveats; independent validation; cleanup state; canonical semantic result; recovery UX. T12 broadens policy presets and contradictory-flag coverage without changing semantic interpretation.

**Verification:** the mandated fixture is detected, previewed, repaired, validated, and reconciled through an acquired lease and durable journal; source and test move to `/scripts`, all package-script/import references are updated, validators pass, and the cleanup plan reports no unresolved cluster work; second identical run has zero material delta; receipt/certificate exist; deleting `state.db` and rebuilding preserves accepted canonical semantics; clean and incremental results agree; package-boundary guard confirms only CLI/tests compose concrete packages.

- [ ] Integrate the first vertical slice, run all dependent package tests and the exact acceptance fixture, commit, and report.

### Task 10: Semantic signatures, derivations, invalidation, Impact Rules, SCCs, and backdating

**Files:** `packages/engine/src/invalidation/**`; derived persistence tables/migrations owned through integration; fixtures/tests.

**Produces:** signature profile registry and assurance; derivation/reverse index; provenance-rich internal Impact Closure; versioned Impact Rules; exact invalidation; SCC proof groups; exact/validated backdating; heuristic refusal; rebuild-vs-conformance oracle separation.

**Verification:** all Slice-2 core scenarios and properties, including public-contract narrow invalidation, shared-bug oracle, SCC equivalence, selector membership, profile upgrade, unrelated work validity.

- [ ] Implement Slice 2 as one coherent capability, verify integration, commit, and report.

### Task 11: Semantic identity resolution, Relevance Closure, facets, topology, and Planning Surprises

**Files:** `packages/engine/src/identity/**`, `relevance/**`, `context/**`; minimal event/contract topology in analyzers; fixtures/tests.

**Produces:** reuse/coordinated/split/merge/replace/create/no-entity/unresolved identity outcomes; duplicate prevention; WHAT/WHY analyzer; independent WHERE/WHAT-ELSE scout; bounded four-band closure; facet activation; context compiler; event/contract consumers; predicted-vs-observed surprise classifier and relationship proposals.

**Verification:** all 22 relevance/identity acceptance scenarios, held-out over-expansion/recall fixtures, query-bound stopping/negative space, derived Requirement/Scenario views, agent overreach refusal.

- [ ] Implement Slice 3 with failing identity/relevance fixtures and properties, verify, commit, and report.

### Task 12: Governance robustness, representations, policy normalization, and plan rebind/rebase

**Files:** `packages/engine/src/representation/**`, governance extensions, plan revision store; `packages/cli` policy/output extensions; tests.

**Produces:** `human-technical@1`, `agent-compact@1`, `machine-invariant@1`, and behavioral/Gherkin profiles; protected-dimension fingerprints; artifact store; deterministic lint/literal/fidelity checks; measured token utility and fallback; layered ignores; SCC governance; risk/policy normalization; immutable plan rebind/rebase; upgrade protocol.

**Verification:** six representation scenarios, 27 relevant properties, net-negative fallback, profile-only invalidation, risk monotonicity, contradictory policy flags, partial completion/rebase, governance non-convergence.

- [ ] Implement Slice 4, verify dependent packages and spec lint, commit, and report.

### Task 13: Progressive architecture commitment

**Files:** `packages/engine/src/architecture/**`, authority/evidence extensions, decision CLI commands; tests/fixtures.

**Produces:** concern discovery/materiality; scoped decision validity/reuse/dirtying; evidence freshness/research boundary; preferences and adoption; option evaluation/deferral; atomic consequences; overlap/SCC convergence; architecture preflight and audits.

**Verification:** all seven architecture acceptance scenarios, held-out concern discovery, stale-evidence locality, preference isolation, negative/simple decision, overlap rollback.

- [ ] Implement Slice 5 with failing architecture fixtures, verify, commit, and report.

### Task 14: Broaden analyzers and deterministic relevance/divergence topology

**Files:** remaining `packages/analyzers/**`; analyzer capability and fixture tests.

**Produces:** full supported TS/JS semantic index, richer event/public-contract topology, structured-data, Markdown, GitHub Actions, capability/failure degradation, richer divergence facts.

**Verification:** supported-syntax source locations and identities, partial failure isolation, event/contract consumer acceptance, held-out analyzer variants, no-exec default.

- [ ] Implement Slice 6 only after Slices 0–5 are integrated and passing; verify, commit, and report.

### Task 15: Proof-sensitive coverage and progressive completion

**Files:** `packages/engine/src/coverage/**`; CLI cleanup/complete; tests.

**Produces:** all required coverage lanes/dimensions; legal proof statements; analyzer-failure locality; information-gain question ranking; promotion/exception/defer workflow; resumable cleanup; open-world refusal and relevance metrics.

**Verification:** open/unavailable surface scenarios, dimension correlation, monotone proof weakening, settled-question invalidation, cleanup resume, no false completeness.

- [ ] Implement Slice 7, verify, commit, and report.

### Task 16: Full Semantic Change Compiler and packet executor

**Files:** `packages/engine/src/change/**`, `planning/**`; `packages/runtime/src/execution/**`; CLI change commands; tests.

**Produces:** complete request-to-plan pipeline, immutable Semantic Change binding, architecture/impact sequencing, packet DAG/SCC grouping, bounded agent residue, checkpoints, combined-diff reverse impact, reconciliation, receipts/certificates.

**Verification:** Slice-8 end-to-end changes, deterministic-before-agent ordering, stale approval refusal, R2 validator independence, partial/failure certificates, legitimate surprise learning and overreach rejection.

- [ ] Implement Slice 8, run clean/incremental equivalence, commit, and report.

### Task 17: Provider-neutral model gateway, host wrappers, and MCP capabilities

**Files:** `packages/integrations/src/models/**`, `codex/**`, `claude/**`, `mcp/**`; fake-host/provider tests.

**Produces:** structured provider schema/retry/cache/replay; capability detection; generated state-bound instructions; wrapper lifecycle; read tools; unforgeable dependency-bound mutation capabilities; cancellation and direct-write observation.

**Verification:** fake-host golden suite, retry exhaustion, model-resampling idempotence, stale/unrelated-rebound capabilities, out-of-scope writes, interruption recovery, no host/model dependency in core.

- [ ] Implement Slice 9 independently after T16, verify with fakes, commit, and report.

### Task 18: Modernization, scoped research, and external-surface framework

**Files:** `packages/engine/src/modernization/**`; `packages/integrations/src/surfaces/**`; tests.

**Produces:** friction aggregation; current concern-scoped research with offline degradation; preference/authority-aware alternatives; staged reversible migration overlays; snapshot-aware `SurfaceAdapter` framework and truthful unavailable/open-world behavior.

**Verification:** endogenous evidence refusal, stale research locality, offline operation, external snapshot pinning, unavailable surface refusal, migration rollback/residue criteria.

- [ ] Implement Slice 10 in parallel with T17 when ready, verify, commit, and report.

### Task 19: Watch/CI hardening, observability, reporting, benchmarks, and dogfooding

**Files:** `packages/cli/**`, runtime watch/recovery, JSONL telemetry/reporters, CI/scripts, self-governance `.projector/**`, benchmark harness.

**Produces:** watch/CI exit policy; secret redaction before context; recovery UX; terminal/JSON/Markdown/SARIF; required metrics; reference architecture decisions/authorities/bases; active self-governance lenses; held-out/mutation benchmarks.

**Verification:** path/secret/approval hardening, output parity, incremental cache locality, all 17 numeric/absolute release gates, self-audit clean or explicit accepted debt, authoritative spec blocking lint.

- [ ] Implement Slice 11 and dogfood Projector on its repository, verify, commit, and report.

### Task 20: Full acceptance, public package, and adversarial compliance review

**Files:** acceptance/benchmark suites, package publication/bundling config, release docs only as generated from executable behavior.

**Produces:** one-package install and `projector init`; traceability for all 59 acceptance scenarios; public-release evidence; deterministic clean/incremental comparison; final spec-deviation ledger.

**Verification:** repository typecheck/lint/test/build, all 59 scenarios, 27 property classes, 32 anti-self-deception classes, held-out/mutation fixtures, benchmark gates, canonical rebuild, independent conformance, host fakes, final adversarial spec review.

- [ ] Run the complete release gate on fresh fixtures/install state, remediate concrete findings, and commit the verified release boundary.

### Task 21: Demand-driven external adapters

**Files:** independent adapters under `packages/integrations/src/surfaces/**` plus adapter fixtures.

**Produces:** first high-value provider, generic HTTP/JSON, and only demand-justified later providers. Each adapter declares inventory/observability/capability/drift/snapshot/write semantics.

**Verification:** per-adapter truthful observability, pinned snapshots, state-bound plans, unavailable/open-world behavior, compensation/recovery for external writes.

- [x] Start only after T20 establishes the credible local kernel; ship each adapter as an independent unit. Codex CLI shipped first by explicit demand.

## Plan self-review

- Spec coverage: the 13 delivery slices, 59 acceptance scenarios, mandatory property/adversarial/fixture strata, 17 release gates, dogfooding, and explicit post-release external adapters all map to tasks.
- Dependency consistency: shared contracts are stabilized in T1; every later task consumes only packages allowed by the reference dependency graph; CLI is the sole broad composition root.
- Placeholder scan: no implementation placeholder is used; underspecified normative seams have explicit minimal resolutions in `docs/implementation/spec-resolutions.md`.
- TDD scope: each checkbox represents one independently reviewable subsystem capability with its complete red/green/refactor and verification cycle, matching the approved handoff’s granularity override.
