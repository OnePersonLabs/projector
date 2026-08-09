# Task 12 implementation report

## Handoff

- Branch: `codex/projector-t12`
- Worktree: `/home/zethj/dev/projector/.worktrees/task-12-governance`
- Base: `8cc2c354264dd853af7232c223652413def61b8a`
- Definitive implementation commit: `639152bbe585dd65fdf4b511b3ffb108ec2e8d4d`
- Commit count for this handoff: one
- Final worktree state: clean

## Sources read completely

- `.superpowers/sdd/2026-08-07-projector-implementation/task-12-brief.md` from the implementation coordination worktree.
- `docs/superpowers/plans/2026-08-07-projector-implementation.md` and `docs/implementation/spec-resolutions.md`.
- `PROJECTOR_SPEC/02-semantic-kernel/representation-contracts.md`.
- `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md`.
- `PROJECTOR_SPEC/04-governance/scope-and-rules.md`.
- `PROJECTOR_SPEC/05-projections/runtime-and-representations.md`, `execution-capsules.md`, and `derivations-and-invalidation.md`.
- `PROJECTOR_SPEC/07-change/plans.md` and `transactions-and-certificates.md`.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md`.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md`.
- `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` and relevant `acceptance-core.md` scenarios.
- Existing core DTO/schema definitions and the current state-binding, query, planning, change-authorization, invalidation, selector/rule, lens-SCC, reconciliation, and CLI policy/composition seams.
- `superpowers:test-driven-development`, its complete `writing-good-tests.md` reference, and `superpowers:verification-before-completion`.

## Implemented behavior

### Representations

- Added deterministic built-ins for `human-technical@1`, `behavior-gherkin@1`, `agent-compact@1`, and `machine-invariant@1`.
- Added a canonical normalized source/kernel input, deterministic profile and projection identity, and permutation/conflicting-duplicate handling.
- Added dependency-complete projection bindings for every canonical source ID, the exact source/profile hashes, and existing query/value dependencies.
- Added a host-neutral injected `RepresentationArtifactStore`; projections contain only the addressed content hash.
- Added protected-dimension hashes and exact assurance for normative force, negation, scope, cardinality, connective, guard, exception, dependency order, scenario roles, concept identity, and literals.
- Added deterministic candidate rejection for weakening or dropping those dimensions, including seeded MUST_NOT/avoid, iff/when, exactly-one/one-or-more, exception, scope, guard, ordering, concept, literal, and Gherkin role drift.
- Added strict compact-abbreviation handling: standard/protected markers survive; invented abbreviations require measured positive savings and explicit clarity validation.
- Added injected tokenizer measurement with source/output/profile-overhead/net accounting. Net-negative or unmeasured compact selection falls back conservatively; measured positive utility can select compact.
- Added deterministic controlled-technical mechanical lint that explicitly reports no semantic-equivalence or truth claim.
- Added artifact tamper/missing detection and deeply immutable projection state. Editing derived bytes never mutates canonical input.

### Governance and policy

- Added six independent layered-ignore concerns using existing deterministic selector semantics. Union is concern-local; conflicting duplicate rule identities fail.
- Reused the existing governance SCC kernel in `governance/lenses.ts`, which already detects explicit SCCs, rejects undeclared and non-monotone recursion, uses deterministic monotonic-union iteration bounds, and detects non-convergence. No parallel SCC implementation was added.
- Added pure risk-order helpers and property-tested monotonic requirements for approval, worktree isolation, independent validation, and evidence.
- Added canonical-governance conflict blocking for Govern/Autonomous presets.
- Extended CLI policy normalization so audit aliases normalize identically, dry-run retains the selected mode while removing mutation authority, contradictory read-only/mutation combinations fail, and no preset permits R4 automatic execution.

### Plans and upgrades

- Added a host-neutral `PlanRevisionStore` plus an immutable in-memory adapter.
- Added deterministic immutable revision IDs, lightweight rebind for current/rebound scoped bindings, and semantic rebase for stale value/query dependencies.
- Semantic rebase carries only independently current completed packets that remain in the recomputed plan, invalidates stale packet/capsule claims and prior approvals, and records recompiled capsule IDs.
- Suspect/unavailable bindings block instead of preserving stale claims.
- Added a strict versioned Zod schema and deterministic hash domain for serialized upgrade declarations.
- Added deterministic dependency-local upgrade invalidation. Representation-profile changes propagate only through dependent projection/context/capsule keys and preserve canonical sources/unrelated projections. Semantic interpretation upgrades require declared affected keys and reindex/revalidation/migration action.

## TDD evidence

The initial behavior tests were written before production modules. The first focused run failed for the expected missing modules and CLI mismatches:

```text
pnpm exec vitest run packages/engine/src/representation/index.test.ts \
  packages/engine/src/governance/ignore-policy.test.ts \
  packages/engine/src/governance/execution-policy.test.ts \
  packages/engine/src/planning/revisions.test.ts \
  packages/engine/src/representation/upgrades.test.ts \
  packages/cli/src/policy.test.ts

Result: 6 failed files; missing representation/governance/planning/upgrade modules,
plus failing alias and contradictory-policy expectations.
```

Subsequent behavior-specific RED cycles caught and drove:

- strict versioned upgrade declaration parsing;
- mechanical lint vs semantic claims;
- artifact edit detection;
- conflicting duplicate canonical source IDs;
- capsule invalidation/recompile reporting during semantic rebase;
- dependency-complete projection bindings and deep immutability;
- scope, guard, ordering, concept, literal, and Gherkin-role drift;
- invented abbreviation rejection and measured exception;
- dry-run preserving its selected preset.

Focused GREEN after implementation:

```text
39/39 focused tests passed across representation, layered ignores, existing governance SCC adversaries,
risk policy, immutable plan revision/rebase, upgrade protocol, and CLI policy.
Engine and CLI package typechecks passed.
```

Final repository verification includes 13 representation tests, 5 plan-revision tests, 3 upgrade tests, 2 layered-ignore tests, 2 risk-policy tests, 14 existing governance SCC tests, and 5 CLI policy tests.

## Verification evidence

- `pnpm verify` — PASS: all workspace typechecks; 40 test files and 492 tests passed; package boundaries valid.
- `pnpm build` — PASS: all six buildable workspace packages compiled.
- `pnpm check:boundaries` — PASS: `Package dependency boundaries valid.`
- `git diff --check` and cached diff check — PASS.
- Authoritative checker run from an isolated `mktemp` copy of `PROJECTOR_SPEC`, then the temporary tree was removed — PASS: 45 files, 0 errors, 121 advisory warnings.
- Focused engine suite — PASS: 276/276 before the final adversarial additions; all final focused tests also passed under the repository-wide 492-test run.
- Focused CLI suite — PASS: 22/22 before the final policy adversary; all final CLI tests also passed under the repository-wide run.
- Post-commit `git status --short --branch` — clean (`## codex/projector-t12`).

## Integration export seams

No shared root barrel was edited. Integration should selectively export these new seams from `packages/engine/src/index.ts`:

- `representation/index.ts`: `BUILT_IN_REPRESENTATION_PROFILES`, `RepresentationCompiler`, `RepresentationFidelityError`, `lintHumanTechnical`, and the canonical-source/artifact/token/measurement/lint input types.
- `representation/upgrades.ts`: `UpgradeDeclarationSchema`, `upgradeDeclarationHash`, `planUpgradeInvalidation`, and upgrade declaration/dependent types.
- `governance/ignore-policy.ts`: `compileIgnorePolicy`, `IgnorePolicyConflictError`, and `IgnoreConcern`.
- `governance/execution-policy.ts`: `riskRank`, `normalizeRiskPolicy`, `assertPolicyRiskMonotonic`, `assertGovernanceConflictPolicy`, and `RiskPolicyRequirements`.
- `planning/revisions.ts`: `PlanRevisionStore`, `InMemoryPlanRevisionStore`, `rebaseExecutionPlan`, and revision/rebase DTO types.

The CLI continues to use its existing local `normalizeExecutionPolicy` export. Integration may choose to expose that existing seam from the CLI facade; no engine-to-CLI dependency was introduced.

## Dependencies and residual risks

- The representation compiler consumes the existing normative core projection/profile/fingerprint DTOs. No core schema or root barrel edit is required.
- The artifact store and tokenizer remain injected ports; this task intentionally adds no filesystem, database, host, or model dependency.
- The plan revision store interface is host-neutral. Durable runtime persistence remains a later composition adapter responsibility.
- The existing lens SCC implementation was intentionally reused rather than duplicated. It supports declared monotonic-union fixed points, deterministic bounds, repeated-state stability, and conservative rejection. A future need for project-defined explicit fixed-point functions should extend that one kernel under a versioned registry rather than create another evaluator.
- The upgrade invalidation planner consumes declared dependency keys. Composition must build those keys from the persisted reverse dependency index; omission remains fail-closed through the required declaration checks but cannot discover undeclared external dependencies by itself.
- The mechanical style linter is deliberately narrow and does not claim semantic equivalence or factual truth.

## Independent skeptical review — 2026-08-08

### Verdict: FAIL

Reviewed exact range `8cc2c354264dd853af7232c223652413def61b8a..639152bbe585dd65fdf4b511b3ffb108ec2e8d4d` read-only against the Task 12 brief and its authoritative representation, governance, invalidation, plan/rebase, policy, acceptance, and adversarial-testing sources. Critical and Important findings below block merge.

### Critical findings

1. **Protected-dimension validation does not authenticate the candidate semantics, yet returns `exact` assurance.** `packages/engine/src/representation/index.ts:240-298` searches for global substrings/markers in caller-supplied text. It neither parses a candidate kernel nor derives candidate dimension hashes to compare with the source hashes. `validateCandidate` then fingerprints only the source (`:311-315`), and `fingerprint` unconditionally assigns every dimension `exact` plus overall `exact` (`:163-172`). Runtime reproductions against the built commit showed both of these candidates were accepted:
   - the generated compact representation plus `PERMIT rule:a | deletion without approval`;
   - the same representation with `FORBID NOT rule:a` changed to `PERMIT rule:a`, provided an unrelated `FORBID NOT decoy` appeared elsewhere.

   This allows contradictory additions and cross-statement marker laundering to validate as exact. Similar one-off checks cover only selected drift spellings (for example, `iff` rejects `when` but not an arbitrary changed connective), so the validator does not bind normative force, negation, connective, exception, role, and other protected values to the statement/scenario they belong to. Replace text-presence heuristics with a parsed/normalized candidate semantic form and compare every protected dimension per stable source identity; assurance must be no stronger than the weakest actually established dimension.

2. **Plan rebind/rebase can emit a new executable revision still bound to stale state and can retain stale semantic work.** `packages/engine/src/planning/revisions.ts:52-55` treats every `rebound` result as lightweight even when `validation.rebound` is absent, falling back to `original.boundState`. The semantic path accepts any `recompile().boundState` without proving that it binds `validation.currentState` (`:63-74`). Runtime reproductions showed a `rebound` validation for state `new` emitted a plan compiled against `old`, and a `stale` validation whose recompiler returned an old binding also emitted a semantic-rebase plan compiled against `old`. Moreover, optional `packetIds`, assumptions, relevance closure, and impact hash default to their stale original values, and only capsules attached to invalidated *completed* packet IDs are invalidated (`:56-83`); a stale rebase with no completion claims can therefore invalidate no old capsules at all. Require a valid rebound binding for lightweight rebind, validate every new binding against the stated current snapshot, require dependency-relevant semantic outputs from stale recompilation, and invalidate/recompile every affected old capsule/packet/closure rather than only failed completion claims.

### Important findings

1. **Canonical source hash and membership are caller assertions, producing identity collisions and incomplete bindings.** `normalizedSource` (`packages/engine/src/representation/index.ts:119-145`) never verifies that `sourceSemanticHash` authenticates the normalized statements/scenarios or that `sourceEntityIds` exactly covers their IDs. Compilation binds only the supplied `sourceEntityIds` (`:329-337`) and derives projection identity from the supplied hash (`:354-356`). Runtime reproduction compiled two semantically different sources with the same claimed source hash and received the same projection ID but different artifact content. A source containing `rule:a` with `sourceEntityIds: []` compiled successfully with no canonical-entity dependency. This breaks exact source/hash binding, stable-ID uniqueness, dependency completeness, and profile-local invalidation safety. Derive or verify the semantic hash from canonical structured input and reject missing, extra, or conflicting entity membership before rendering.

2. **Fallback output carries false token accounting and omits required conservative tiers.** On net-negative compact output, `compileBest` creates a human projection but overwrites its accounting with the rejected compact projection's accounting (`packages/engine/src/representation/index.ts:366-375`). Runtime reproduction selected `profile:human-technical` whose actual rendered output measured 10 tokens while the projection reported 32 output tokens from compact rendering. The implementation also jumps directly to human technical instead of exact machine kernel plus advisory prose and less-aggressive compact, and there is no path that converts unsupported/ambiguous compact validation into the required fallback sequence. Token accounting must describe the selected artifact/profile, and fallback selection must implement the specified conservative order and semantic-failure behavior.

3. **The in-memory revision store is mutable through caller-held references.** `InMemoryPlanRevisionStore.put/get` stores and returns the original object (`packages/engine/src/planning/revisions.ts:12-19`). Its test passes only because `createExecutionPlan` happens to freeze that fixture. Runtime reproduction inserted a structurally valid mutable clone, mutated `boundary` after `put`, and observed the stored revision change. Clone, normalize/validate, and deeply freeze on insertion; do not expose an internal mutable reference on retrieval.

4. **Upgrade declarations can silently preserve old proofs and their public hash is not canonical under order/duplicates.** A representation-profile upgrade with `requiredAction: "none"` and no affected keys bypasses the affected-key requirement (`packages/engine/src/representation/upgrades.ts:26-28`); runtime reproduction returned no invalidations for a dependent old representation proof. `upgradeDeclarationHash` hashes the raw parsed array (`:19-20`), so `['b','a','a']` and `['a','b']` produce different hashes despite equivalent dependency-key sets. Conflicting duplicate dependent IDs are also not normalized/rejected and can appear as both preserved canonical source and invalidated output. Require affected keys for every semantic/profile version change, normalize/reject duplicate/conflicting declarations and dependents, and hash the canonical normalized projection.

5. **Canonical-governance conflict and risk enforcement are test-only helpers, not production policy.** Repository search found `assertGovernanceConflictPolicy` and `assertPolicyRiskMonotonic` only in their defining module and unit test. `executeProjector` normalizes CLI flags before work, but no apply/reconcile path invokes either assertion or supplies detected canonical conflict state. Consequently the new production behavior does not establish that Govern/Autonomous execution blocks canonical conflicts or that an operation's effective risk requirements are checked before repository work. Wire these pure checks into the composition path using detected canonical conflict and actual operation risk, with an integration test proving mutation is refused before side effects.

6. **Layered-ignore conflict precedence is not represented.** `compileIgnorePolicy` (`packages/engine/src/governance/ignore-policy.ts:12-37`) correctly evaluates the six concerns independently, but reduces each concern to an unordered OR of selectors. `ruleIds` only detects two different selectors sharing one identity within one concern; it contains no authority/specificity/allow-vs-exclude precedence data or cross-layer composition. Thus the required conflict-precedence behavior cannot be expressed or verified. Add an explicit normalized layered rule model (or reuse the canonical rule composition kernel) with deterministic authority/specificity precedence, while retaining concern-local effects.

### Verified non-findings and gates

- The existing governance SCC implementation was inspected rather than inferred from the Task 12 report. It derives explicit SCCs, rejects undeclared cycles and non-monotone recursive selectors, uses monotonic union, enforces a deterministic iteration budget, and fails non-convergence. Its 14 focused adversarial tests passed; no SCC blocker was found in this range.
- Artifact bytes are content-addressed and `verifyArtifact` detects missing or byte-tampered content. This does not cure the semantic candidate/source-authentication findings above.
- Focused Task 12/governance suite: PASS, 7 files and 44 tests.
- `pnpm verify`: PASS, 40 files and 492 tests; typechecks and boundaries passed.
- `pnpm build`: PASS.
- `pnpm check:boundaries`: PASS.
- `git diff --check 8cc2c354264dd853af7232c223652413def61b8a..639152bbe585dd65fdf4b511b3ffb108ec2e8d4d`: PASS.
- Authoritative `PROJECTOR_SPEC/scripts/check_spec.py`: PASS, 45 files, 147 exported declarations, 0 blocking human-technical errors, 121 review warnings. Its generated `PROJECTOR_SPEC/PROJECTOR_SPEC.md` bundle was removed afterward; final implementation worktree is clean.

## Review fix round 1 — 2026-08-08

### RED evidence

Behavior-first adversaries were added and observed failing against `639152bbe585dd65fdf4b511b3ffb108ec2e8d4d` before each production repair:

- Representation: contradictory additions and cross-statement marker laundering were accepted; omitted/duplicate membership and false source hashes compiled; fallback accounting described rejected compact bytes.
- Revisions: missing rebound bindings and old-bound semantic recompilation emitted executable revisions; incomplete semantic recompilation reused stale fields; caller mutation changed stored revisions.
- Upgrades: profile changes with no keys/action preserved proof; equivalent dependency-key sets hashed differently; conflicting dependent identities were accepted.
- Layered ignores: no layered compiler existed, so authority/specificity precedence, equal-precedence conflict, and unauthorized all-role erasure adversaries failed.
- Production policy: public `executeProjector` reached repository Git work for canonical-conflict and excessive-risk inputs instead of refusing first.

The combined initial focused RED runs reported 13 intended failing adversaries across these findings.

### GREEN behavior

- Canonical source membership and source semantic hashes are independently derived from normalized structured statements/scenarios and verified; entity bindings use independently derived per-entity semantic hashes.
- Exact candidate assurance now requires byte-for-byte canonical rendering from the trusted normalized kernel. Contradictory additions, marker laundering, and caller-supplied abbreviation metadata cannot self-assert exact equivalence.
- Compact fallback freshly compiles the exact machine tier with its own profile, binding, validation, artifact, and token accounting; rejected compact accounting is not reused.
- Rebind/rebase requires a current-state binding with a validated dependency digest. Semantic rebase requires freshly supplied packets, assumptions, relevance/impact closures, checkpoints, and capsule outputs; all old capsules and all non-current packets are invalidated, and only independently current completed packets may carry.
- The revision store clones and deeply freezes writes and returns an isolated deeply frozen clone on reads.
- Upgrade keys are normalized/sorted/deduplicated for parsing and hashing; every semantic/profile change requires keys and a non-none action; conflicting dependent identities fail closed.
- Layered ignore rules now encode repository/config/lens/rule authority, selector specificity, include/ignore effects, per-role decisions, deterministic normalization, conservative conflicts, and explicit all-role authorization.
- The CLI public mutation composition detects canonical Git conflicts before repository work, enforces supplied/actual operation risk, and repeats the actual prepared-risk check immediately before apply/reconcile mutation.
- Existing governance SCC behavior was unchanged; its full focused suite continues to pass.

### Verification

- Focused Task 12/CLI suite: PASS, 7 files and 46 tests.
- `pnpm verify`: PASS, 40 files and 505 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check`: PASS.
- Authoritative checker against an isolated temporary `PROJECTOR_SPEC` copy: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 review warnings; the temporary copy was automatically removed.

### Fix commit

- Definitive review-fix SHA: `41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac`

## Independent fix-round-1 re-review — 2026-08-08

### Verdict: FAIL

Reviewed exact range `639152bbe585dd65fdf4b511b3ffb108ec2e8d4d..41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac` against the full Task 12 brief, original review, and fix-round review package. The immutable store repair, canonical source-hash verification for ordinary inputs, fresh fallback accounting, normalized declaration hashing, conflict preflight wiring, and unchanged SCC kernel are real improvements. The following Critical and Important gaps still block merge.

### Critical findings

1. **Protected-dimension validation still does not independently derive candidate semantics.** `packages/engine/src/representation/index.ts:169-195` derives every dimension hash and every `exact` assurance solely from the canonical source. `assertCandidate` retains the old global marker heuristics and then requires `candidate === render(source, profileKey)` at `:256-325`; `validateCandidate` returns the source-only fingerprint at `:337-340`. Byte equality prevents the two original laundering strings, but substitutes renderer identity for the required parsed/normalized candidate kernel. It makes the public validator reject semantically unchanged serialization (runtime: exact `machine-invariant@1` output plus one trailing newline was rejected as a `normative-force` failure) and makes the measured-abbreviation input effectively unusable: even a clear, measured candidate must be byte-identical. More importantly, the validator cannot produce candidate-derived per-dimension evidence or assurance bounded by independently established dimensions. Parse/normalize the candidate representation, derive its protected-dimension projection per stable source identity, compare that projection with the canonical kernel, and normalize representation-insignificant syntax before comparison; keep canonical byte equality only as a fast path.

2. **Semantic rebase still emits plans containing stale semantic work and can silently retain all old capsules.** The required recomputation list at `packages/engine/src/planning/revisions.ts:65-72` covers packets, assumptions, two closures, checkpoints, and a bare capsule-ID list, but `:91-99` spreads the original plan and has no recompile fields for `boundary`, `knownAffectedUnitIds`, `possibleFrontierUnitIds`, `unavailableSurfaceIds`, or `completionCriteria`. The capsule ownership map remains optional, and `:106-109` silently produces no invalidations when it is absent; non-empty new packet sets are also accepted with `recompiledCapsuleIds: []`. Runtime reproduction rebased a stale plan to a new state/new packet while retaining `unit:old`, `unit:frontier-old`, and `surface:old`, and returned both capsule lists empty. Require a complete freshly compiled semantic plan payload (or an explicit independently-current proof for every retained field), make old packet-to-capsule ownership complete for semantic rebase, and prove every new/still-executable packet has a freshly bound capsule. The current-state/digest validation itself is fixed, but the original stale-work/capsule Critical is not.

### Important findings

1. **Canonical membership still permits one stable ID to name two different source kinds, leaving the binding incomplete.** `normalizedSource` builds independent statement and scenario maps and then unions their IDs at `packages/engine/src/representation/index.ts:121-160`; it never rejects an ID present in both. `entitySemanticHash` chooses the statement first at `:163-166`. Runtime reproduction supplied a statement and scenario both named `same:id`; compilation succeeded with one source ID and one canonical-entity dependency hashing only the statement. A scenario-only change can therefore leave the dependency digest current even though the authenticated aggregate source/projection changes. Reject cross-kind ID collisions (and any unsupported multi-entity ownership) before hashing, or bind a typed per-member hash that commits to every entity kind/value under the ID.

2. **Fallback accounting is fresh, but the required fallback tiers are still not implemented.** `compileBest` at `packages/engine/src/representation/index.ts:392-403` handles only net-negative compact output and jumps to a bare `machine-invariant@1` artifact. It does not produce exact machine kernel plus advisory compact prose, try a less-aggressive compact tier, proceed to human technical, or return explicit block/unknown; it also does not route semantic/unsupported compact failures through those tiers. This additionally conflicts with the compact profile's declared human fallback. Implement the ordered fallback state machine with a fresh compile/validation/accounting result at every attempted tier.

3. **Upgrade invalidation can remain non-empty only on paper while old proof survives.** `planUpgradeInvalidation` requires a non-empty string array and non-`none` action at `packages/engine/src/representation/upgrades.ts:29-32`, but it neither validates that a key is the canonical key for the upgraded component nor that it reaches a declared dependent. Runtime reproduction upgraded profile `compact` with `affectedDependencyKeys: ["nonexistent:key"]` while an old representation depended on `representation-profile:compact`; the function returned `invalidatedIds: []`. Whitespace-only keys also pass both the public schema's `z.string().min(1)` and the raw planner. Validate normalized, nonblank, kind/id-bound dependency keys and fail closed when declared old proofs for that component are not reached; preserving all old proof must be an explicit proven no-dependent result, not a misspelled declaration.

4. **Production CLI risk enforcement is not based on the actual operation before repository access and misinterprets the independent-validation threshold.** The default preflight assessor is hard-coded to `R1` at `packages/cli/src/cli.ts:128-139`; the actual prepared risk is checked only after `prepareMandatorySlice` has traversed/read the repository at `:181-183` (and similarly inside reconciliation). `assertOperationRiskAuthorized` at `packages/cli/src/policy.ts:15-22` rejects risks *below* `requireIndependentValidationAtOrAbove`; runtime `R0` was refused with “does not satisfy independent-validation policy,” while `R1` passes without the function receiving any validation evidence. “At or above R1” means R1+ operations require proof, not that R0 is forbidden. Derive/prepare the actual risk before repository work with a side-effect-free preflight, then enforce ceiling, approval, worktree, evidence, and independent-validation facts in the correct threshold direction. Canonical unmerged-path conflict refusal is now genuinely wired before mutation, but the original actual-risk half remains open.

5. **Layered-ignore “specificity” is structurally counted rather than semantically ordered.** `selectorSpecificity` at `packages/engine/src/governance/ignore-policy.ts:24-29` sums atoms for both `all` and `any`. This makes a broader `any(tag=vendor, tag=generated)` score 2 and defeat an exact `tag=vendor` selector scoring 1 at `:49-57`. Runtime reproduction with same-layer broad-ignore and exact-include rules marked the vendor unit ignored rather than letting the narrower include win or conservatively reporting incomparable precedence. Define specificity from selector-set containment/canonical authority rules (with incomparable overlaps becoming conflicts), not AST size. Also cover an explicitly authorized all-role result; current tests cover only refusal, and `:60-62` requires every concern winner to self-assert `authorizeAllRoles` without a normalized authority proof.

### Fixed original findings / non-findings

- `InMemoryPlanRevisionStore` now clones and deeply freezes on both write and read; the original mutability reproduction no longer succeeds.
- Ordinary canonical source membership and aggregate source-hash lies are rejected, per-entity hashes are used, fallback accounting describes the selected artifact, upgrade key order/duplicates hash canonically, and conflicting duplicate dependent identities fail closed. The edge cases above prevent those areas from being fully complete.
- Existing governance SCC code was unchanged. Its 14 focused tests still pass; no SCC regression was found.

### Verification evidence

- Focused Task 12 plus SCC/CLI suite: PASS, 8 files and 60 tests.
- Runtime adversaries: reproduced the concrete candidate, source-collision, stale-rebase/capsule, vacuous-upgrade, CLI-threshold, and selector-specificity claims without modifying implementation or tests.
- `pnpm verify`: PASS, 40 files and 505 tests; all workspace typechecks and boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check 639152bbe585dd65fdf4b511b3ffb108ec2e8d4d..41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac`: PASS.
- Authoritative spec checker: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 warnings. Its generated aggregate was removed afterward.
- Final implementation worktree state after review: clean (`## codex/projector-t12`).

## Review fix round 2 — 2026-08-08

### RED evidence

Read the complete fix-round-1 re-review plus the authoritative representation, state-binding, plan/rebase, layered-ignore, and CLI/security specifications. Behavior-first regressions were then run against clean base `41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac` before production edits. The focused RED run produced eight intended failures covering:

- candidate byte equality instead of independently parsed dimension observations;
- untyped/colliding canonical source membership and dependencies;
- missing exact+advisory, less-aggressive compact, human, and block fallback states;
- incomplete stale rebase payloads and optional old/new capsule inventories;
- misspelled and vacuous upgrade dependency keys;
- AST-count ignore specificity, including the broad-`any` versus exact-atom reproduction and property;
- constant/pre-repository CLI risk assessment and the reversed R0/R1 threshold direction;
- suspect-state refresh bypassing the required complete semantic recomputation gate.

### GREEN behavior

- Every supported rendering is deterministically parsed into statement/scenario observations. The validator compares normative force, negation, scope, cardinality, connectives, guards, exceptions, dependency order, behavior roles, concept identities, and protected literals per stable identity. Cosmetic JSON whitespace is accepted; contradictions and unparseable protected semantics block exact assurance.
- Source dependencies use typed member identities (`statement:<id>` / `scenario:<id>`), per-member semantic hashes, and kind-specific roles. Cross-kind collisions and duplicate typed binding ownership fail closed.
- Compact fallback is an explicit ordered state machine: exact machine kernel plus advisory compact projection, a distinct less-aggressive structured compact rendering, human technical, then block. Each accepted tier receives fresh validation, artifact identity, status, and token accounting.
- Stale and suspect refreshes require complete recomputed scope/boundary, closures, assumptions, affected/frontier/unavailable units, packets, checkpoints, completion criteria, current-state binding, explicit old capsule inventory, and exactly one fresh capsule for every recomputed packet. All old capsules and approvals are invalidated. Unavailable state blocks.
- Upgrade keys must resolve in a supplied normalized dependency registry and semantic changes must produce actual nonempty invalidation; canonical declaration hashing remains deterministic.
- Ignore specificity now ranks semantic matcher precision and narrow conjunctions above broad `any`, `not`, glob, regex, and existence selectors. Equal-specificity conflicting decisions still fail, while layer precedence remains authoritative.
- CLI risk is derived from command and side-effect facts before repository access. Supplied descriptors cannot lower the command baseline or describe another command. R0 remains permitted below an R1 proof threshold; R2/R3 exceed the default automatic ceiling and require stronger composition controls.

### Verification

- Focused round-2 suite: PASS, 6 files and 50 tests.
- `pnpm verify`: PASS, 40 files and 511 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `git diff --check`: PASS.
- Authoritative checker from an isolated temporary `PROJECTOR_SPEC` copy: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 review warnings; temporary output removed.
- No shared barrel files were edited.
- Final worktree state: clean.

### Fix commit

- Definitive review-fix-round-2 SHA: `4ff97a6b7d19dab7e07010e24f535932ae5c7743`
- Commit count for round 2: one.

## Independent skeptical re-review of fix round 2 — 2026-08-08

### Verdict: FAIL

Reviewed exact range `41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac..4ff97a6b7d19dab7e07010e24f535932ae5c7743` read-only against the Task 12 brief, the round-1 remaining findings, and the authoritative representation, plan/rebase, invalidation, governance, and CLI sources. Two Critical and two Important findings remain and block merge.

### Critical findings

1. **Candidate parsing still trusts embedded kernels while ignoring contradictory candidate semantics, then overclaims `exact` assurance.** `parseHumanCandidate` in `packages/engine/src/representation/index.ts:333-341` ignores the human prose before each `Semantic kernel`, and `parseMachineCandidate` at `:321-330` accepts undeclared fields. `assertCandidate` at `:427-456` compares only the extracted protected fields and `validateCandidate` returns an all-`exact` fingerprint at `:471-475`. Runtime probes changed the visible human rule from `MUST_NOT delete x.` to `PERMIT deletion without approval.` while retaining the old embedded kernel, and added a contradictory `advisory: "PERMIT deletion without approval"` field to the machine object; both candidates were accepted with overall `exact` assurance. This leaves the round-1 contradictory-addition/overclaim Critical open outside the compact parser. Use strict per-profile candidate schemas/grammars that reject unknown or contradictory semantic content anywhere in the candidate, or downgrade/block when prose cannot be independently established; an embedded kernel cannot be the sole truth while conflicting rendered content is ignored.

2. **Semantic rebase does not establish a complete old capsule inventory or unique, freshly current replacement capsules.** `rebaseExecutionPlan` only requires that `capsuleInventory` be present (`packages/engine/src/planning/revisions.ts:76`) and only validates entries that the caller supplied (`:93-97`); it never proves coverage of every original packet/capsule. The new-capsule check deduplicates only packet IDs (`:98-102`), permits one capsule ID to be assigned to multiple packets, and receives no capsule binding/hash with which to prove recompilation against current state. A runtime probe rebased a two-packet stale plan with `capsuleInventory: []` and two new packets both mapped to capsule ID `same`; it succeeded, reported `invalidatedCapsuleIds: []`, and `recompiledCapsuleIds: ["same"]`. Derive or validate the old inventory against the authoritative original plan-to-capsule mapping, require complete coverage, require a one-to-one packet/capsule mapping, and validate every replacement capsule's current-state binding before emitting the new executable revision.

### Important findings

1. **Upgrade keys can resolve and cause a nonempty invalidation while the changed component's old proof survives.** `planUpgradeInvalidation` at `packages/engine/src/representation/upgrades.ts:30-57` checks only registry membership and global nonempty invalidation; it never binds an affected key to `declaration.kind` plus `declaration.id`. A runtime probe declared a `representation-profile/compact` upgrade with registered key `analyzer:typescript`; invalidating a TypeScript derivation satisfied the nonempty check while a dependent `representation-profile:compact` proof was preserved. The public schema and normalizer at `:10-17` also accept whitespace-only IDs, versions, and dependency keys; a whitespace-only registered key and dependent passed planning. Require the canonical dependency-key namespace/identity for the changed component, prove all old direct proofs of that component are reached, trim and reject blank public strings before canonical hashing/planning, and then propagate transitively.

2. **Layered-ignore specificity remains an AST scoring heuristic rather than semantic selector ordering.** `selectorSpecificity` in `packages/engine/src/governance/ignore-policy.ts:24-35` assigns fixed matcher weights and arithmetic bonuses/penalties. It does not compare selector result-set containment. A runtime probe used a broad `tag in [vendor, generated]` ignore and a narrower `tag in [vendor]` include at the same layer; both receive the same score and the compiler throws a conflict instead of recognizing the strict subset. Replace numeric syntax scoring with normalized semantic containment/equivalence for supported selector forms; where containment is not provable, fail closed with an explicit incomparable-precedence result rather than pretending a matcher/AST weight is specificity.

### Verified fixes and non-findings

- Canonical representation source membership/hash authentication, cross-kind collision refusal, and typed per-member source dependencies are fixed for the supported source model.
- The ordered compact fallback tiers can be exercised in order through the injected gate, use fresh accounting, carry an exact machine projection plus the compact advisory at tier one, and explicitly block when all gates refuse.
- Stale/suspect rebase now requires the recomputed plan fields listed by its DTO, validates the plan binding against current state, invalidates the old approval, and replaces closure/scope/assumption/checkpoint fields. The capsule completeness/binding Critical above prevents the overall rebase guarantee from passing.
- The in-memory plan revision store still clones and deeply freezes writes and reads.
- CLI command/side-effect descriptors are evaluated before repository access, cannot lower the command baseline, and the erroneous R0-below-R1-threshold refusal is removed. No additional exact-range CLI blocker was established for the fixed mandatory R1 slice.
- Existing governance SCC production code was unchanged; its 14 focused tests pass and no SCC regression was found.

### Verification evidence

- Focused Task 12, CLI, and SCC suite: PASS, 8 files and 66 tests.
- `pnpm verify`: PASS, 40 files and 511 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check 41d0fd2f705d9ab7c2c6ad457eb41fea5f5b28ac..4ff97a6b7d19dab7e07010e24f535932ae5c7743`: PASS.
- Runtime adversaries reproduced the candidate exact-assurance overclaim, incomplete/aliased capsule inventory, component-unbound and blank upgrade keys, and non-semantic ignore specificity without editing implementation or tests.
- Implementation worktree remained clean after review (`## codex/projector-t12`).

## Independent skeptical re-review of fix round 3 — 2026-08-08

### Verdict: FAIL

Reviewed exact range `4ff97a6b7d19dab7e07010e24f535932ae5c7743..cbb823f37cd912b10cbf82f18cda385417632353` against the latest Task 12 report/brief, authoritative representation, plan/rebase, invalidation, governance, and acceptance sources, and the exact round-3 review package. The machine top-level schema is now strict, old/new packet cardinalities and capsule aliases are checked, upgrade strings are trimmed and declared keys are target-owned, and ignore precedence uses a containment relation. Two Critical and two Important gaps still block merge.

### Critical findings

1. **Non-machine embedded semantic kernels still accept contradictory duplicate JSON keys, while modeled advisory content is overconstrained.** `assertNoDuplicateJsonKeys` is called only by `parseMachineCandidate` at `packages/engine/src/representation/index.ts:325-377`. `parseHumanCandidate`, `parseGherkinCandidate`, and the less-aggressive compact parser pass embedded JSON directly to `JSON.parse` at `:380-427`, so an earlier contradictory protected value is silently overwritten by the later expected value. A runtime human candidate containing `"force":"permit","force":"forbid"` was accepted with exact assurance. At the same time, `assertCandidate` at `:514-517` requires advisory text to be byte-equivalent to the trusted source; changing only `Never delete.` to `Never delete!` was rejected. Apply duplicate-key rejection to every embedded JSON fragment before parsing, validate the complete per-profile AST, and model an explicitly non-authoritative advisory/cosmetic lane whose harmless changes are allowed while semantic claims or contradictions are rejected/downgraded.

2. **Old capsule inventories and no-capsule claims are complete only by caller assertion, not authenticated fact.** `capsuleProofHash` and `noCapsuleProofHash` at `packages/engine/src/planning/revisions.ts:84-85` are self-computable hashes of fields entirely supplied by the caller. The trusted callback at `:130-135` authenticates only the packet hash; it does not authenticate the packet-to-capsule mapping, capsule identity, approval inventory, or capsule absence. A caller that knows an authentic packet hash can therefore fabricate a valid no-capsule hash (or a capsule with an incomplete approval list), satisfy the one-entry-per-packet check at `:136-150`, and prevent real old capsules/approvals from appearing in the invalidation result at `:187-190`. Obtain the old inventory from a trusted store/lookup or authenticate each mapping/absence assertion with trusted registry evidence; a hash of the assertion itself is not proof of absence or completeness.

### Important findings

1. **Target-owned upgrade keys do not prove complete invalidation of the upgraded target.** `planUpgradeInvalidation` verifies only that each *declared* key is owned by the target at `packages/engine/src/representation/upgrades.ts:56-61`, then accepts any globally nonempty invalidation at `:63-77`. It does not require all affected/direct target-owned dependency keys or all old direct proofs of the component to be reached. A runtime declaration selected one of two `compact`-owned keys, invalidated a decoy context on that key, and left `projection:old-compact` depending on the other `compact`-owned key intact. Require the registry to identify the complete affected target-owned key set/direct-proof set for the version transition and fail unless every such old proof is invalidated before transitive propagation.

2. **Selector containment is conservative for unsupported forms but reimplements glob semantics inconsistently, producing false incomparable conflicts.** The equality-to-glob branch at `packages/engine/src/governance/ignore-policy.ts:43-45` converts `**` and `*` but does not implement the canonical selector evaluator's `**/` zero-directory behavior or `?` wildcard (`packages/engine/src/governance/selectors.ts:128-147`). Thus exact selectors that are true subsets of matching globs such as `vendor` versus `**/vendor`, or `foo` versus `f?o`, can be treated as non-contained and conflicting instead of allowing the exact selector to win. Reuse the canonical matcher/normalized selector semantics in containment (or a shared proven containment helper); reserve fail-closed conflicts for genuinely incomparable or unprovable pairs.

### Verified fixes and non-findings

- The top-level `machine-invariant@1` object rejects unknown/missing keys and duplicate JSON keys; source IDs and structured kernel membership are compared.
- Semantic rebase now requires one inventory entry and authenticated packet hash per original packet, rejects old/new capsule-ID aliases, requires one current-state capsule per new packet, and exposes old/new mappings. The trusted-authentication Critical above prevents the old inventory/approval guarantee from passing.
- Upgrade declaration IDs, versions, keys, and dependent IDs/keys reject blanks and surrounding whitespace; declaration key order/duplicates hash canonically; declared key ownership is enforced.
- Supported `equals`/`in` and conjunction/disjunction containment cases are semantically ordered, and unprovable conflicting selector pairs fail closed. The shared-glob semantic mismatch above remains.
- Prior canonical-source, fallback, current-state/rebase-field, risk/preflight, immutable-store, and SCC repairs remain intact. No regression was found in those areas.

### Verification evidence

- Focused Task 12, CLI, and SCC suite: PASS, 8 files and 81 tests.
- Runtime adversaries reproduced the accepted duplicate protected field, rejected cosmetic advisory edit, and partial target-owned upgrade invalidation without modifying implementation or tests. The no-capsule authentication failure follows directly from the exported self-hash constructor and the absence of any trusted inventory/mapping authenticator.
- `pnpm verify`: PASS, 40 files and 517 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check 4ff97a6b7d19dab7e07010e24f535932ae5c7743..cbb823f37cd912b10cbf82f18cda385417632353`: PASS.
- Authoritative spec checker: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 warnings; its generated aggregate was removed afterward.
- No implementation or test files were edited during review.

## Review fix round 4 — 2026-08-08

### RED evidence

Read the complete round-3 re-review and the authoritative representation, capsule/rebase, upgrade, and governance selector specifications. Added behavior-first adversaries against clean base `cbb823f37cd912b10cbf82f18cda385417632353`. The initial focused run produced exactly four intended failures while 44 existing tests passed:

- human/Gherkin/less-aggressive compact embedded kernels accepted recursively duplicated protected JSON keys, and cosmetic advisory punctuation/spacing was rejected;
- caller-self-hashed no-capsule inventory and caller-produced replacement capsules remained authoritative instead of separate trusted ports;
- a caller-selected target-owned decoy key could leave another direct target proof and its transitive capsule current;
- ignore containment disagreed with canonical selector glob matching for `**/` zero-segment and `?` cases.

A second upgrade-coverage RED proved that an unregistered reachable dependency key could truncate transitive closure.

### GREEN behavior

- All representation candidate JSON now passes through one recursive duplicate-key detector before parsing. Machine, human, Gherkin, and structured compact kernels use exact object schemas and complete profile grammars. Human advisory text is an explicit nonsemantic envelope: punctuation and whitespace cosmetic variants normalize identically, while changed words or semantic material outside the envelope fail closed. Property/adversarial coverage includes duplicate force and negation across every embedded-kernel profile and cosmetic advisory variants.
- Semantic rebase no longer accepts caller packet-hash inventories, capsule/no-capsule proof hashes, or caller replacement capsules. `PlanCapsuleInventoryPort` provides complete authenticated persisted packet/capsule/approval enumeration for the original plan; absence exists only as a trusted store entry. `PlanCapsuleCompilerVerifierPort` independently provides one unique current-state replacement capsule per recomputed packet. Plan/packet/state/content-hash coverage, old/new identity uniqueness, approval uniqueness, and invalidation of every trusted old capsule/approval are enforced. Hidden-capsule and forged-no-capsule adversaries are covered.
- The upgrade registry now provides complete reverse direct-dependent enumeration. Declarations must exactly cover every dependency key owned by the changed target, every dependent key must be registered, registry/direct-dependent coverage must agree, and the planner computes the transitive invalidation closure from the registry. Decoy-key, omitted-real-key, missing-dependent, and missing-reachable-key adversaries fail closed.
- Canonical governance glob matching is exported as one shared helper used by selector evaluation and exact-to-glob containment. `**` zero segments, `?`, path normalization, exact-vs-glob precedence, and property-generated basename paths now have matcher/containment parity; genuinely incomparable selectors still fail closed.
- Existing SCC, representation fallback/source binding, immutable revision-store, risk/preflight, and prior governance fixes remain unchanged and covered. No shared barrel was edited.

### Verification

- Focused Task 12/CLI/SCC suite: PASS, 7 files and 71 tests.
- Focused changed-area suite: PASS, 4 files and 45 tests.
- `pnpm verify`: PASS, 40 files and 518 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check`: PASS.
- Authoritative checker from an isolated `mktemp` copy of `PROJECTOR_SPEC`: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 review warnings; the temporary copy was removed.

### Fix commit

- Definitive review-fix-round-4 SHA: `8e93c74cb34c819079f8c7f0f0d827f03544ca37`.
- Commit count for round 4: one.

## Independent skeptical re-review of fix round 4 — 2026-08-08

### Verdict: FAIL

Reviewed exact range `cbb823f37cd912b10cbf82f18cda385417632353..8e93c74cb34c819079f8c7f0f0d827f03544ca37` read-only against the latest Task 12 report/brief, the authoritative representation, plan/rebase, invalidation, governance, and acceptance sources, and the exact round-4 review package. The recursive duplicate-key parser, trusted capsule ports, target-key enumeration, and shared canonical glob matcher are real fixes. One Critical and two Important findings still block merge.

### Critical finding

1. **The modeled human advisory envelope still accepts semantic punctuation changes and returns `exact` assurance.** `normalizeAdvisoryText` at `packages/engine/src/representation/index.ts:500-502` removes every non-letter/number/underscore character. The human comparison at `:526-529` therefore treats all punctuation placement as cosmetic even when punctuation changes the sentence's meaning. A runtime probe compiled source advisory `No users allowed.` and changed only the candidate advisory to `No, users allowed.` while retaining the authenticated semantic kernel; `validateCandidate` accepted the candidate with overall assurance `exact`. This leaves the prior contradictory-visible-semantics Critical open through the newly introduced cosmetic lane. Preserve punctuation with semantic force, restrict cosmetic equivalence to transformations proven harmless, or classify a changed advisory as semantic/unproven and downgrade/block instead of claiming exact fidelity.

### Important findings

1. **Analyzer/schema/interpreter upgrades can still preserve a directly target-dependent canonical derivation proof.** The closure walker at `packages/engine/src/representation/upgrades.ts:84-87` unconditionally skips every dependent whose kind is `canonical-source`, and the result at `:98` unconditionally reports all such IDs as preserved. A runtime registry with an authenticated `analyzer:ts` target key, a directly dependent `canonical:ast` proof, and a directly dependent decoy projection returned only the projection as invalidated and reported `canonical:ast` preserved. The profile-only rule protects canonical source *entity hashes* from profile invalidation; it does not permit an analyzer/schema semantic-interpretation derivation proof to survive. Invalidate every direct target proof for semantic interpreter upgrades while leaving the underlying authored canonical entity/hash unchanged; make the profile-only preservation exception explicit rather than applying it to every upgrade kind.

2. **The trusted capsule protocol rejects a valid authenticated empty packet set.** `packetHashMap` at `packages/engine/src/planning/revisions.ts:98-102` rejects every empty proof list, even when `expectedPacketIds` is also empty. `ExecutionPlan.packetIds` permits an empty array, and complete semantic recomputation can legitimately conclude that no executable packets remain. A runtime rebase from one old packet to `packetIds: []`, with complete recomputed plan fields and a trusted compiler/verifier returning `[]`, failed with `verified recompiled packet hash inventory must prove every packet exactly once`. The same helper also prevents a semantic rebase of an originally empty plan. Treat `[]` as the complete authenticated inventory exactly when the expected packet set is empty; continue rejecting empty inventory for nonempty expected sets.

### Verified fixes and non-findings

- Recursive duplicate JSON keys are rejected through the shared strict parser for machine, human, Gherkin, and structured compact embedded kernels; complete structured kernels and scenario ASTs remain compared to the source.
- Old capsule identities, approvals, and explicit absence now originate only from the trusted inventory port, and new capsules originate only from the separate compiler/verifier port. Complete nonempty packet coverage, plan/state binding, content-hash presence, and old/new identity uniqueness are enforced; no caller self-hash authority remains.
- Upgrade declarations exactly enumerate the registry's target-owned keys, reverse direct-dependent coverage is cross-checked against dependents, and ordinary non-canonical transitive closure is computed. The unconditional canonical-proof exemption above prevents the complete-direct-proof guarantee from passing.
- Selector evaluation and exact-to-glob containment share `matchesCanonicalGlob`; tested `**/` zero-segment and `?` cases resolve correctly. Existing exact/`in` precedence remains supported, and incomparable conflicting selectors still fail closed.
- Prior canonical source binding, ordered fallback, immutable revision store, current-state/full-field semantic rebase, risk/preflight, and SCC repairs remain covered by the passing repository suite.

### Verification evidence

- Focused changed-area suite: PASS, 4 files and 45 tests.
- `pnpm verify`: PASS, 40 files and 518 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check cbb823f37cd912b10cbf82f18cda385417632353..8e93c74cb34c819079f8c7f0f0d827f03544ca37`: PASS.
- Runtime adversaries reproduced the semantic-punctuation exact-assurance overclaim, preservation of a directly analyzer-dependent canonical derivation proof, and rejection of an authenticated empty replacement packet/capsule set without editing implementation or tests.
- Implementation worktree remained clean after review (`## codex/projector-t12`).

## Review fix round 5 — 2026-08-08

### RED evidence

Read the complete round-4 re-review and the authoritative representation, derivation/invalidation, and plan/rebase specifications. Added behavior-first regressions against clean base `8e93c74cb34c819079f8c7f0f0d827f03544ca37` before production edits:

- Representation RED: 2 intended failures proved punctuation-only advisory mutations, including `No users allowed.` to `No, users allowed.`, still received `exact`; whitespace/line-wrap positives remained covered.
- Upgrade RED: 5 intended failures proved the unconditional `canonical-source` proof exemption and missing canonical-entity distinction across engine, schema, analyzer, and signature-profile interpretation changes.
- Revision RED: 2 intended failures proved authenticated empty old/new inventory was rejected for nonempty-to-empty and empty-to-empty semantic rebases; mismatch negatives already rejected and received explicit coverage.

### GREEN behavior

- Human advisory exact comparison now normalizes only Unicode presentation and whitespace/line wrapping. Punctuation is preserved, so punctuation changes capable of changing force, scope, or negation fail closed instead of receiving exact assurance.
- Upgrade dependents now distinguish authoritative `canonical-entity` records from `canonical-source` derivation/proof rows. Only canonical entities are preserved; directly target-dependent canonical-source proofs and their registered reverse-dependency closure are invalidated. Profile-only invalidation remains local to the profile dependency closure.
- Trusted packet/capsule inventories accept `[]` exactly when the corresponding expected packet IDs are also empty. Nonempty-to-empty rebases invalidate all old packet, capsule, and approval claims, while empty-to-empty rebases remain valid and immutable. Empty/nonempty mismatches continue to fail closed.
- Existing representation parsing, canonical source binding, upgrade registry completeness, trusted capsule authority, selector containment, immutable revision storage, CLI risk/preflight, and SCC behavior remain covered. No shared barrel was edited.

### Verification

- Focused changed-area suite: PASS, 3 files and 44 tests.
- `pnpm verify`: PASS, 40 files and 526 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check` and cached diff check: PASS.
- Authoritative checker from an isolated `mktemp` copy of `PROJECTOR_SPEC`: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 review warnings; temporary output removed.
- Final implementation worktree state: clean.

### Fix commit

- Definitive review-fix-round-5 SHA: `bb8b74176cb88e99e7d2b03e426d994a4a67108b`.
- Commit count for round 5: one.

## Independent skeptical re-review of fix round 5 — 2026-08-08

### Verdict: FAIL

Reviewed exact range `8e93c74cb34c819079f8c7f0f0d827f03544ca37..bb8b74176cb88e99e7d2b03e426d994a4a67108b` read-only against the latest Task 12 report/brief, the authoritative representation, derivation/invalidation, capsule/rebase, acceptance, and adversarial-testing sources, and the exact round-5 review package. Interpretation upgrades now invalidate directly and transitively dependent canonical-source proof rows while preserving canonical entities, and authenticated empty packet/capsule inventories are accepted exactly for empty packet sets. One Critical representation-fidelity gap remains and blocks merge.

### Critical finding

1. **Whitespace normalization still permits semantic changes inside protected literals while returning `exact` assurance.** `normalizeAdvisoryText` at `packages/engine/src/representation/index.ts:500-502` globally collapses every whitespace run with `replace(/\s+/gu, " ")`. That admits ordinary paragraph wrapping, but it does not distinguish a harmless wrap between prose words from whitespace that is part of an exact command, code fragment, error, or other protected literal. A concrete runtime probe compiled a human source whose advisory and protected literal contained `X  Y`, changed only the visible advisory to `X Y` while retaining the authenticated kernel's exact `X  Y`, and `validateCandidate` accepted it with overall assurance `exact`. This is the same visible-advisory/kernel contradiction class as the punctuation bug for a representation dimension the specification explicitly requires to remain exact. Normalize proven prose wrapping around tokens, but preserve and compare protected literal spans byte-exactly (or reject/downgrade when the validator cannot prove that changed whitespace lies outside them).

### Verified fixes and non-findings

- Advisory punctuation is no longer erased. The semantic punctuation probes from round 4, including `No users allowed.` versus `No, users allowed.`, reject; ordinary spacing and line-wrap variants outside protected-literal distinctions normalize successfully. The protected-literal whitespace case above prevents the overall advisory exact-assurance guarantee from passing.
- Canonical entities remain preserved, while engine, schema, analyzer, and signature-profile interpretation upgrades invalidate directly target-dependent `canonical-source` proof rows and their registered transitive derivation/capsule closure. A separate runtime chain probe invalidated `proof:a`, `consumer:a`, and `capsule:a` while preserving `entity:a`; unrelated dependents stayed current. Profile-only invalidation remains dependency-local.
- Authenticated nonempty-to-empty and empty-to-empty semantic rebases succeed. Every old packet/capsule/approval is invalidated in the nonempty-to-empty case. Empty old or replacement inventories still reject when their corresponding plan has packets, and nonempty inventory still rejects for an empty original plan.
- Prior recursive duplicate-key/schema checks, canonical source/hash binding, complete upgrade registry coverage, trusted capsule authority, selector containment, immutable revision storage, complete/current-state semantic rebase, CLI risk/preflight, and governance SCC repairs remain covered by the passing suite. No additional exact-diff hash/schema or runtime blocker was established.

### Verification evidence

- Focused Task 12/CLI/SCC suite: PASS, 7 files and 75 tests.
- Concrete runtime upgrade-closure probe: PASS; directly/transitively dependent proof, derivation, and capsule rows invalidated while the canonical entity remained preserved.
- Concrete runtime protected-literal advisory probe: FAIL as described above; `X  Y` to `X Y` was accepted with `exact` assurance.
- `pnpm verify`: PASS, 40 files and 526 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check 8e93c74cb34c819079f8c7f0f0d827f03544ca37..bb8b74176cb88e99e7d2b03e426d994a4a67108b`: PASS.
- No implementation or test files were edited during review.

## Independent closure re-review of fix round 6 — 2026-08-08

### Verdict: FAIL

Reviewed exact range `bb8b74176cb88e99e7d2b03e426d994a4a67108b..40c73de` read-only against the latest Task 12 report/brief, the authoritative representation and acceptance sources, and the exact round-6 review package. The new mapper preserves every declared/recognized literal byte-for-byte, requires one unique ordered mapping, rejects omission/duplication/boundary drift, and permits whitespace changes only in the mapped prose gaps. One directly reproduced exact-literal coverage gap remains and blocks closure.

### Critical finding

1. **Unicode-quoted literals and ordinary exact-error forms still admit internal whitespace drift with `exact` assurance.** `protectedAdvisorySpans` at `packages/engine/src/representation/index.ts:502-525` derives only ASCII backtick/single/double-quoted spans and only errors beginning exactly `Error:` or `Exception:`. When none of those patterns matches, `advisoryMatchesWithExactLiterals` at `:563-565` collapses all whitespace across the advisory. A runtime probe compiled `Preserve “Exact  error” and ENOENT:  file missing.` with an authenticated unchanged semantic kernel and no manually duplicated literal declarations. Both candidate edits—`“Exact error”` and `ENOENT: file missing.`—were accepted with overall assurance `exact`. This contradicts the `human-technical@1` requirement to preserve exact errors (`PROJECTOR_SPEC/02-semantic-kernel/representation-contracts.md:116-130`), the required deterministic literal checks (`PROJECTOR_SPEC/05-projections/runtime-and-representations.md:101-112`), and the acceptance requirement that exact technical literals remain unchanged (`PROJECTOR_SPEC/12-delivery/acceptance-representation.md:52-54`). The material consequence is a projection that authenticates an unchanged kernel while visibly changing a copy/paste-sensitive quoted value or diagnostic, so users and agents can act on bytes different from the source under an `exact` claim. Complete the independently derived/declared span inventory for the agreed Unicode-quote and exact-error matrix, or fail closed when exact-literal boundaries cannot be proven.

### Verified fixes and non-findings

- Declared literals and recognized ASCII commands/quotes, paths, identifiers, numeric-unit pairs, and prefixed errors are mapped exactly once, uniquely, and in source order. Internal byte/whitespace/Unicode/quote/escape/path/identifier/numeric-unit changes, duplicate/omitted spans, and token-boundary changes covered by the round-6 matrix reject.
- Cosmetic space, tab, CRLF, and line-wrap changes in prose immediately outside recognized literals remain accepted. Punctuation and non-whitespace prose changes continue to reject, so no new normative-force normalization was found.
- The round-6 diff introduces no new public contract, cross-package dependency, or unrelated semantic behavior. Prior canonical-source binding, recursive duplicate-key/schema validation, fallback ordering, upgrade closure, trusted rebase inventory, selector containment, immutable revision storage, CLI policy/preflight, and SCC fixes remain intact under the full suite.
- A possible conservative overmatch of trailing prose after `Error:` is left as residual hardening rather than an additional blocker; it rejects instead of overstating fidelity.

### Verification evidence

- Focused representation/upgrade/revision/governance/CLI suite: PASS, 5 files and 61 tests.
- Concrete runtime literal probe: FAIL as described above; both internal whitespace mutations were accepted with `exact` assurance.
- `pnpm verify`: PASS, 40 files and 528 tests; all workspace typechecks and package boundaries passed.
- `pnpm build`: PASS for all six buildable packages.
- `pnpm check:boundaries`: PASS.
- `git diff --check bb8b74176cb88e99e7d2b03e426d994a4a67108b..40c73de`: PASS.
- Authoritative checker from an isolated temporary `PROJECTOR_SPEC` copy: PASS, 45 files, 147 exported declarations, 0 blocking errors, 121 review warnings; temporary output was removed.
- No implementation or test files were edited during review; only this required verdict was appended to the central report.

## Closure repair follow-up — 2026-08-08

### RED

- Public `RepresentationCompiler.compile`/`validateCandidate` properties reproduced both blockers from clean `40c73de`: collapsing `“Exact  error”`/`‘Exact  error’` and `ENOENT:  file missing`/`EACCES:  permission denied` resolved with `assurance: "exact"` instead of rejecting.

### GREEN

- Deterministic literal extraction now recognizes paired Unicode smart single/double quotes and structured `E[A-Z0-9_]+:` system-error messages. Their exact spans use the existing unique ordered mapper; cosmetic whitespace outside spans remains permitted.
- Focused representation suite: PASS, 23 tests. Engine typecheck: PASS. Frozen full gate: `pnpm verify` PASS, 40 files and 530 tests with boundaries; `pnpm build` PASS; `git diff --check` PASS.

### Fix commit

- Targeted closure SHA: `5d476d3` (`fix task 12 smart quote and error literals`).

## Targeted closure re-review of smart-quote/error repair — 2026-08-08

### Verdict: FAIL

Reviewed only `40c73de..5d476d3eaa52bf688f3e26804dd436f6a79a3c9c` under the lean three-part material test. The public compile → artifact → validate path now correctly rejects internal whitespace drift for smart double/single quotes and the required `ENOENT:`/`EACCES:` exact-error forms. One direct regression in the same acceptance matrix remains.

- **The error-code pattern turns arbitrary `E…:` prose labels into protected exact-error spans.** `protectedAdvisorySpans` now uses `\bE[A-Z0-9_]{2,}:[^\r\n]+`, so ordinary text such as `EXAMPLE: ordinary  prose remains readable.` is classified as one exact-error span through end of line. A supported-path runtime probe compiled that source, changed only the cosmetic prose spacing to `EXAMPLE: ordinary prose remains readable.`, and `validateCandidate` rejected it as `identifier-literal`. This directly violates the closure acceptance that cosmetic whitespace outside protected literals remains accepted and that arbitrary prose is not promoted to a protected span. The material outcome is failure of the required human-representation validation workflow for an ordinary prose label, introduced by this repair. Narrow derivation to proven error-code forms (including the required ENOENT/EACCES cases) instead of every all-caps word beginning with `E`.

Focused evidence: representation suite PASS (23 tests); engine typecheck PASS; smart double/single quote and ENOENT/EACCES runtime mutations all rejected as required; the ordinary `EXAMPLE:` runtime control failed as described; exact-diff whitespace check PASS. Per closure policy, the implementor's frozen `pnpm verify` 530-test/build/boundary gate was not repeated. No implementation or test files were edited; only this verdict was appended.

## Error-code overmatch closure — 2026-08-08

- **RED:** Public compile/validate rejected the cosmetic `EXAMPLE: ordinary  prose remains readable.` to one-space candidate because the generic `E[A-Z0-9_]+:` detector treated an ordinary label as an exact error.
- **GREEN:** Error extraction is bounded to repository-used Node/POSIX codes `EACCES`, `EEXIST`, `EINVAL`, `ENOENT`, `ENOTSUP`, and `EPERM`. `EXAMPLE:` whitespace remains exact-valid; ENOENT/EACCES drift and smart-quote drift still reject.
- **Verification:** representation 24/24; engine typecheck; `pnpm verify` 40 files/531 tests plus boundaries; `pnpm build`; and diff check all passed.
- **SHA:** `9c51f0a` (`fix task 12 bound system error literals`).

## Final targeted literal closure re-review — 2026-08-08

### Verdict: PASS

Reviewed only `5d476d3..9c51f0a5b85c4307c9b15d2dca2cd926b13289bb` under the lean material test. The public compile → artifact → validate path accepts cosmetic whitespace normalization after `EXAMPLE:` and the obvious ordinary uppercase controls `ENVIRONMENT:`, `EPILOGUE:`, `ERROR:`, and `EVENT:`. It rejects internal whitespace drift for smart single/double quoted literals and for every bounded repository-used system code: `EACCES`, `EEXIST`, `EINVAL`, `ENOENT`, `ENOTSUP`, and `EPERM`. No direct literal-mapping regression or remaining material blocker was found.

Focused representation suite PASS (24 tests); the explicit runtime matrix PASS (13/13 cases); exact-diff whitespace check PASS. Relied on the implementor's frozen full `pnpm verify` 531-test/build/boundary gate as directed. No implementation or test files were edited; only this verdict was appended.
