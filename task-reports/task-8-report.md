# Task 8 review — deterministic transforms, state-bound plans/capsules, receipts, and certificates

## Scope

Read-only review of `1f0c642..82b17e3` in:

- `packages/runtime/src/transforms/index.ts`
- `packages/engine/src/planning/index.ts`
- `packages/engine/src/change/index.ts`
- the three corresponding Task8 test files

Checked against `spec-resolutions.md`, the execution-capsule/runtime-representation/state-binding/plans/transactions contracts, first-vertical-slice steps 8–16, and the Task8 brief. The shared package-barrel seam is intentionally not included in these findings.

## Findings

### Critical — success receipt/certificate is finalized before the transaction commits

`packages/engine/src/change/index.ts:253-258` calls `finalize()` while the transaction is still in `canonical-staging`, then transitions to `committing` and calls `commit()`. Therefore a normal success artifact records `journalPhase: "canonical-staging"` and an `afterState` sampled before commit. If the subsequent transition/commit throws, the already-written success certificate/receipt remains, and the catch path writes a second partial/failure artifact. This can expose a false committed-success record and violates the resolution ledger's receipt rule that pre-finalization receipts are not committable.

Minimal fix: complete and durably record the committing/committed journal transition, then sample the post-commit state and emit the success certificate/receipt. If commit fails, emit only a failure/partial certificate with the durable checkpoint and recovery state; do not persist a success artifact first. Add a regression that injects failure at `committing`/`commit` and asserts no success receipt exists and that the certificate phase/recovery state are truthful.

### Critical — approved plan does not bind the capsule or enforce the immutable write scope

`packages/engine/src/change/index.ts:107-115,186-225` accepts only a capsule `id`, `boundState`, and caller-supplied `requiredValidations`; approval hashes only the plan (`:33-45`), and execution checks only capsule/plan binding equality for `boundState` (`:189-191`). It never verifies capsule identity/context hash, capsule unit IDs, allowed/forbidden writes, or a plan packet/capsule relationship. `allowedUnits` is also caller-controlled and is passed directly to the transform (`:219-224`), while `MoveReferenceTransform` only checks membership in that caller-provided set and that paths are repository-relative (`packages/runtime/src/transforms/index.ts:262-335`). A caller can therefore pair an approved plan with an unrelated capsule and grant an unrelated unit/path, allowing an out-of-scope move/reference update.

Minimal fix: pass/validate the complete immutable capsule (including `contextHash`, `unitIds`, and scope grants), bind its hash/ID and the effective policy/validation set into approval, derive the effective unit/path scope from plan+capsule rather than request fields, and make the transaction/path adapter enforce that scope. Add a test for an unrelated capsule and for an `allowedUnits`/path outside the approved plan; both must fail before preview/apply.

### Important — completion policy is reduced to validator ID/status checks

`packages/engine/src/change/index.ts:243-250` only checks the union of `requiredValidators`/`requiredValidations` and whether each result has status `passed`. It ignores the rest of `CompletionContract`: required unit states, evidence lanes, minimum assurance, independent-validation requirement, divergence/unknown limits, unavailable-action policy, required artifacts, and clean-working-tree state. A weak or same-packet validator can consequently produce `success` despite a plan that requires an independent exact/runtime proof or zero unknowns.

Minimal fix: normalize and validate the full completion contract before commit (including assurance ordering, lane and independence constraints, bounded unknown/divergence counts, unit states, artifact presence, and clean-tree policy), and add failure-path tests for each policy dimension.

### Important — move/reference idempotence can silently accept the wrong destination and rejects valid overlapping replacements

At `packages/runtime/src/transforms/index.ts:283-290`, a missing source with any existing destination is treated as an already-completed move without checking destination content. A deleted source plus an unrelated file at the destination therefore returns `changed: false` and `verify()` passes. Separately, `:314-321` counts raw substring occurrences; when `to` contains/overlaps `from` (for example `a -> aa`), the second identical application sees the replacement text as remaining `from` anchors and throws instead of converging.

Minimal fix: carry an expected source/destination content hash (or durable prior-operation identity) and accept a missing source only when the destination matches it; otherwise fail closed. Reject or structurally match overlapping anchors before mutation. Add wrong-destination and `from`/`to`-overlap idempotence tests.

### Important — path claims and exclusive claims are not closed over the complete operation set

`packages/runtime/src/transforms/index.ts:268-292` does not reject duplicate move sources. Two units can claim the same source for different destinations; preflight prepares both, then the first move mutates and the second fails, producing avoidable partial state. `TransformRegistry.orderInvocations` (`:405-438`) and `orderPlannedTransforms` (`packages/engine/src/planning/index.ts:193-215`) honor `exclusiveUnitClaim` supplied by each invocation/plan item, with no registry/plan-level immutable claim requirement, and they do not detect overlapping path claims beyond duplicate destinations. This leaves path/claim exclusivity bypassable by setting the flag false or using different units.

Minimal fix: normalize and reject duplicate/overlapping source, destination, and reference-path claims during planning; make exclusivity part of the registered transform/immutable packet policy rather than a caller toggle; add duplicate-source and same-unit/nonexclusive collision tests.

### Important — declared convergent transform cycles are always rejected

`packages/runtime/src/transforms/index.ts:421-455` and `packages/engine/src/planning/index.ts:219-230` throw on every predecessor cycle. The registry metadata already declares `convergence: "bounded-fixed-point"`, but ordering never forms an SCC or executes a declared cycle to its bounded fixed point. This contradicts the runtime/transform contract, which permits cycles only when explicitly declared convergent, and can reject valid first-class reconciliation plans.

Minimal fix: compute explicit predecessor SCCs, reject non-convergent SCCs, and iterate declared bounded-fixed-point groups up to their registered maximum with terminal-state verification. Add one convergent-cycle and one non-convergent-cycle regression.

### Minor — registry identity/version can drift after registration

`packages/runtime/src/transforms/index.ts:392-399` freezes only the wrapper; it retains a mutable implementation object whose `id`/`version` fields are writable under the public `Transform` type. Mutating those fields after registration leaves the map keyed by the old identity while `get()` returns an implementation advertising a different identity/version.

Minimal fix: snapshot/freeze the registered identity/version (or freeze a registration-owned adapter) and test mutation after registration.

## Validation performed

- Focused Task8 suites: **3 files / 17 tests passed** (`runtime/transforms`, `engine/planning`, `engine/change`).
- `pnpm -r typecheck`: passed for all participating workspace packages.
- `git diff --check 1f0c642..82b17e3`: passed.
- Broader root Vitest invocation over `packages/runtime/src` and `packages/engine/src` passed for the checked worktree's existing tests; the repository-wide recursive test command stops at `@projector/analyzers` because that package reports no test files in this isolated worktree.

## Residual risk and follow-up

The focused tests cover the happy path, stale/approval preflight, transform convergence for ordinary non-overlapping anchors, and basic claim metadata, but do not exercise commit interruption, full completion-policy enforcement, capsule/scope substitution, wrong destinations, overlapping anchors, duplicate path claims, or convergent SCCs. The two Critical findings should block integration until fixed; the Important findings need regression coverage before the first-slice acceptance run.

## Fix re-review — `82b17e3..779087e`

### Fixed

- **Commit/certificate ordering:** `packages/engine/src/change/index.ts:490-495` now transitions and commits before sampling `afterState` and calling `finalize()`. Commit interruption is covered by `index.test.ts:363-374`; no success artifact is written before the failure certificate.
- **Plan/capsule approval and scope:** approvals now bind `capsuleId` and a full capsule hash (`change/index.ts:25-56`), execution takes the complete capsule and compares its state/completion contract (`:150-155,352-370`), derives units/boundaries from immutable plan/capsule data (`:416-428`), and checks preview/result unit scope (`:430-469`). Runtime transforms enforce approved/forbidden path boundaries (`transforms/index.ts:276-287,320-369`).
- **CompletionContract:** `completionContractReasons` (`change/index.ts:256-319`) and the injected completion assessment enforce validator status, evidence lanes, assurance, independence, unit states, divergence/unknown bounds, unavailable actions, artifacts, and clean-tree policy; regression coverage is present at `change/index.test.ts:537-618`.
- **Move/reference idempotence and preflight claims:** expected move content hashes and overlap rejection are implemented (`transforms/index.ts:293-318,336-354`), with wrong-destination/overlap tests (`transforms/index.test.ts:252-293`); duplicate source/reference claims are rejected before mutation (`:293-318`, tests `:295-321`).
- **Runtime registry:** exclusive claims now come from registered metadata (`transforms/index.ts:405-427,561-569`), bounded SCC groups are supported by the registry (`:497-532,572-662`), and registration identity drift is detected/frozen (`:470-490,665-675`), with tests `transforms/index.test.ts:410-520`.

### Remaining Important findings (changes still requested)

1. **Engine planning still bypasses immutable exclusive claims and rejects bounded cycles.** `packages/engine/src/planning/index.ts:170-230` is unchanged: `PlannedTransform.exclusiveUnitClaim` remains caller-controlled, so two transforms can claim one unit by setting it false, and every predecessor cycle still throws `PlanningDependencyCycleError` with no convergence metadata/SCC path. The runtime registry fix does not protect the engine planner. Align planning with registered claim/convergence metadata (or remove the caller toggle and pass immutable registration metadata), then add planning regressions for a shared claim and a declared bounded SCC.

2. **Allowed path extraction over-approves `all` selectors.** `packages/engine/src/change/index.ts:196-215,372-387` flattens every nested selector's path patterns into a union. For an allowed selector `{op:"all", items:[path glob "scripts/**", path glob "tests/**"]}`, semantic matching requires both predicates (an empty intersection), but `allowedPathBoundary` becomes `scripts/**` plus `tests/**`, granting either path. A malicious/incorrect capsule can therefore widen its allowed write boundary while still passing the deterministic-selector check. Compile conjunctions to an intersection (or fail closed for multiple path atoms) and add a regression that a path satisfying only one `all` operand is refused.

3. **No-op previews bypass the full completion contract.** `packages/engine/src/change/index.ts:430-445` returns `success` immediately when `preview.applicable` is false, without invoking `completion.assess` or checking required validators, evidence lanes, assurance, unit states, unknown/divergence bounds, or clean-tree policy. An identical second run can therefore report successful completion despite a plan whose required validator is missing or whose required unit state is unproven. Run a no-op completion assessment against a synthetic unchanged `TransformResult` (or explicitly define/validate a no-op completion path) before emitting success, with a regression for a no-op missing required validator/unit state.

### Registry freeze note

The identity drift fix calls `Object.freeze(registration.implementation)` (`packages/runtime/src/transforms/index.ts:478-483`). This protects identity but also freezes every own mutable field on custom transform implementations; a valid transform that tracks invocation state as `this.calls++` will now throw in strict mode. Prefer a registration-owned immutable identity adapter/snapshot rather than freezing the entire implementation, or document/enforce a closure-only state contract and test it. This is currently a **Minor compatibility risk**, not a Critical/Important blocker.

### Re-review validation

- Focused fix suites: **2 files / 38 tests passed** (`runtime/transforms`, `engine/change`).
- `pnpm -r typecheck`: passed for all participating workspace packages.
- The original Critical paths have explicit commit-failure and capsule/scope regression tests and no longer reproduce.
- Because the engine planning file is not in the fix diff, its prior claim/cycle findings remain open.

## Fix re-review round 2 — `779087e..809f856`

### Verified fixed

- **Planning claim/convergence metadata:** `packages/engine/src/planning/index.ts:170-385` now requires transform `version`, resolves immutable `unitClaim`/predecessors/convergence through `PlanningTransformRegistry`, rejects duplicate exclusive unit claims independent of caller fields, and orders explicit SCCs. `:388-421` converges declared bounded SCCs and throws `PlanningFixedPointError` on exhaustion. Tests cover caller attempts to disable claims, bounded convergence, and undeclared cycles (`packages/engine/src/planning/index.test.ts:132-203`).
- **Allowed path selector semantics:** `packages/engine/src/change/index.ts:198-231,388-450` compiles only deterministic `all` selectors; path patterns inside one grant are conjunctive and grants are disjunctive. `MoveReferenceTransform` consumes the nested scopes with `some(scope => every(pattern => matches))` (`packages/runtime/src/transforms/index.ts:276-287`). The regression at `change/index.test.ts:492-517` confirms an `all` selector is preserved rather than union-expanded; unsupported `any`/`not` remains fail-closed.
- **No-op completion:** the early no-op return is gone. `change/index.ts:452-514` now invokes `apply`, `verify`, completion assessment, and the full CompletionContract before committing even when preview is not applicable. `change/index.test.ts:519-540` covers both passing and failing no-op assessments and asserts validation/artifact evidence.
- **Registry mutable state:** `packages/runtime/src/transforms/index.ts:470-490` no longer freezes the implementation object; only normalized registration metadata/wrapper is immutable while `:665-675` detects identity drift. `transforms/index.test.ts:543-560` proves mutable implementation state remains writable.

### Round-2 finding status

No Critical or Important defects were found in the requested four areas. Focused verification: **3 files / 49 tests passed**; `pnpm -r typecheck` passed. Residual Minor concerns from prior rounds remain documented (for example artifact-store failure after commit), but they are outside this scoped re-review.

## Round 1 corrective resolution

- Corrective commit: `779087eede633055a3976b4f37c9a351fc2f4ef1` (separate from `82b17e3`).
- C1 resolved: success artifacts are now created only after transaction commit and post-commit `StateDigest` sampling. Commit failure produces one honest partial/failure certificate+receipt pair and never stages false success evidence.
- C2 resolved: approvals bind immutable plan and full capsule ID/content hash. Repository root/signal, units, risk, operation grants, plan boundary, allowed path selectors, and forbidden path selectors are derived from injected/approved context; caller widening is ignored. Unsupported write selectors fail closed.
- I1 resolved: an injected assessment now enforces every `CompletionContract` field: required validators/status, evidence lanes, assurance, independence, required unit states, divergence/unknown bounds, unavailable actions, artifacts, and clean-tree policy. Assessment evidence is normalized before content addressing.
- I2 resolved: moves bind expected content identity; missing sources are accepted only for an identity-matching destination. Overlapping/non-convergent replacements fail closed, and a no-delta second apply is re-read and verified.
- I3 resolved: duplicate source/reference and destination claims fail before mutation; registry exclusivity is derived from immutable metadata rather than caller flags.
- I4 resolved: declared bounded fixed-point SCCs execute in stable order to convergence or their explicit bound; undeclared/nonconvergent cycles reject.
- I5 resolved: registered implementation ID/version are snapshotted, the implementation and metadata are frozen, and runtime identity drift is rejected.
- Round 1 focused GREEN: 3 files / 42 tests.
- Round 1 package GREEN: runtime 9 files / 113 tests; engine 5 files / 59 tests.
- Round 1 repository GREEN: 20 files / 217 tests; root typecheck, build, and dependency boundaries passed.
- Ownership/diff: four modified files, all under Task 8-owned `engine/change` and `runtime/transforms`; `git diff --check` clean; post-commit worktree clean.
- New dependencies/blockers: none.
