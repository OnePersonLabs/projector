# Task 10 — Semantic invalidation and backdating

Branch: `codex/projector-t10`

Commit: `8dc71e2 feat(engine): add semantic invalidation and backdating`

## Outcome

Implemented the isolated engine capability under `packages/engine/src/invalidation/**`:

- versioned semantic-signature profile registry with deterministic normalization checks, documented assurance ceilings, current-version assessment, and deterministic signatures;
- exact/validated/heuristic backdating policy, including evidence correlation and independent-assurance enforcement;
- normalized derivation records, deterministic reverse index, versioned derived snapshot, Tarjan SCC proof groups, bounded fixed-point evaluation, and cycle refusal;
- exact invalidation with public-contract pruning, material-change propagation, conservative heuristic/unavailable widening, profile-upgrade invalidation, and unrelated-work preservation;
- versioned Impact Rule registry and injected evaluation port, evaluating both before/after selector membership so additions and removals apply;
- provenance-rich, content-addressed internal Impact Closure with normative `ImpactClosureRef` projection and injected artifact store;
- explicit rebuild, independent-conformance, and historical/metamorphic oracle result separation.

## TDD evidence

Initial RED:

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts`
- failed because `./invalidation/index.js` did not exist.

Subsequent RED cycles caught expected failures for:

- SCC fixed-point iteration and oscillation bounds;
- conservative selector evaluation failure;
- numeric profile version ordering and nondeterministic normalizers;
- unrelated validation evidence and same-packet conformance;
- material SCC convergence classification;
- `widen-analysis` promotion;
- lost Impact Rule provenance;
- missing derived snapshot and artifact-store persistence seam.

Final focused GREEN:

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts`
- 25/25 tests passed.

## Verification

- `pnpm --filter @projector/engine typecheck` — passed.
- `pnpm --filter @projector/engine test` — 141/141 engine tests passed at the engine checkpoint.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm build` — passed for all workspace packages.
- `pnpm test` — 339/339 repository tests passed (29 files).
- `pnpm check:boundaries` — passed.
- `git diff --cached --check` — passed before commit.

## Integration seams

- `DerivationIndexSnapshot` is explicitly `invalidation-derived@1` and contains normalized derivation records, reverse-dependency rows, and proof groups.
- `DerivationIndexStore` is a replace-only injected port. A runtime adapter may materialize the snapshot in SQLite; no runtime schema or migration was edited concurrently.
- `ImpactClosureArtifactStore` is an injected content-addressed artifact port.
- `ImpactRuleEvaluationPort` owns before/after selector universes and bounded relation traversal, including observability and unavailable results.
- The primary integrator must export `./invalidation/index.js` from the shared engine barrel. This task intentionally did not edit `packages/engine/src/index.ts` per ownership constraints.

## Blockers and dependencies

No implementation blocker.

Integration dependency: shared engine barrel export. Optional runtime follow-up: implement `DerivationIndexStore` and `ImpactClosureArtifactStore` using derived SQLite/artifact storage and migrations owned by the integration authority.

## Independent review — 2026-08-07

Verdict: **FAIL** (Important findings remain; no Critical finding).

### Important findings

1. **A real SCC can be split into independently backdatable singleton groups.** `packages/engine/src/invalidation/index.ts:377-390` first installs Tarjan components and then overwrites each member with its declared group. With mutually recursive `a <-> b`, `a.proofGroupId = "g-a"`, and `b.proofGroupId = "g-b"`, `proofGroupFor("a")` returns `{ id: "g-a", memberIds: ["a"], cyclic: false }` and likewise for `b`. The engine can therefore revalidate/backdate one member without evaluating the cycle as a unit, contrary to the SCC rule. Reproduced against built commit `8dc71e2` with two cyclic `DerivationRecord`s carrying distinct declared group IDs.

2. **Impact Closure normalization is insertion-order dependent and can erase unavailable provenance.** At `packages/engine/src/invalidation/index.ts:470-480`, duplicate entries with the same unit/disposition merge only reasons/frontier; the first entry's `proofClass` and `observability` win. Reversing two `known` entries (`exact-derivation/closed` and `impact-rule/open`) produced different `contentHash` values. The same ranking makes `known` override `unavailable`; a closure containing both for unit `a` emitted only the known entry and `ref.unavailableSurfaceIds = []`. This is reachable when an Impact Rule seed is direct/known and traversal throws (`:598-603`, `:630-631`, `:741-745`). It violates deterministic content addressing and conservative unavailable reporting.

3. **Selector membership and reverse-traversal negative space are not captured in the closure binding.** `SelectorSubject.dependencyKeys` are discarded while mapping subjects to IDs at `packages/engine/src/invalidation/index.ts:590-592`; the engine accepts and stores the caller's arbitrary `StateBinding` unchanged at `:747-749`. A run can evaluate before/after selector membership with dependency keys while returning a closure whose `queryDependencies` are empty. No query spec/result fingerprint records membership, reverse derivation traversal, Impact Rule applicability, or producer/consumer enumeration, so a newly added member/dependent can leave the bound closure apparently current. This conflicts directly with the State Binding and Impact Closure negative-space requirements.

4. **Signature-profile changes do not invalidate every derivation that inherently uses the profile.** The reverse index at `packages/engine/src/invalidation/index.ts:296-301` indexes only explicit `record.inputs`; it does not index `outputSemanticSignature.profileId` or `outputStructuralSignature.profileId`. Thus a record whose output signature says `profileId: "p"` but lacks a duplicated `signature-profile/p` input has `reverseDependents("p") = []`, and a profile-change event misses it. The profile registry is not connected to `InvalidationEngine`, so stale/superseded profiles can also be exact-backdated when old and recomputed signatures match.

5. **Version ordering can select a prerelease/stale version as current.** The ad-hoc comparator at `packages/engine/src/invalidation/index.ts:23-35`, used by profile and Impact Rule selection at `:112-117` and `:411-415`, falls back to lexical ordering for any nonnumeric segment. Registering `1.0.0` and `1.0.0-alpha` selects `1.0.0-alpha` as current, regardless of insertion order. Numeric components are also converted through `Number`, losing ordering above `Number.MAX_SAFE_INTEGER`. Consequently a stable profile/rule can be treated as superseded or the wrong Impact Rule can execute. Require an explicit version scheme/comparator or explicit activation rather than guessing from opaque version strings.

6. **The conformance oracle can call weak, ungrouped, correlated evidence independent and grant strong completion.** `packages/engine/src/invalidation/index.ts:795-811` defines independence solely as `evidenceLane !== "same-packet-agent"`; it ignores `independenceGroup`, assurance, author source, and any policy requirement. Reproduction: equal rebuild hashes plus one passed `test` validation with `assurance: "weak"`, `independenceGroup: ""`, and a correlated `authorSource` yields `conformancePassed: true` and `strongCompletion: true`. This overclaims the independent-conformance oracle rather than merely keeping it separate from rebuild.

7. **Successful backdating does not establish a new derivation against the changed inputs.** At `packages/engine/src/invalidation/index.ts:690-693`, eligible units are only added to `backdated`; `DerivationIndex` is immutable and `RevalidatedUnit` carries no updated inputs/record. After invalidating `handler` from old to new and backdating its unchanged contract, `index.snapshot()` still contains the old handler `versionHash`, and neither the returned result nor a store receives a refreshed `DerivationRecord`. This omits the normative step that establishes the proof against the new input and leaves subsequent incremental state stale.

8. **`ImpactRule.effect: "block"` is not implemented.** At `packages/engine/src/invalidation/index.ts:604-612`, every non-advisory/non-widen effect, including `block`, is handled as ordinary known/transitive impact. Neither `InvalidationRunResult` nor the closure retains a structured blocked disposition/effect. An applicable block rule therefore cannot deny planning/mutation without parsing a generic reason string (which itself does not include the effect). This is materially different from the contract's blocking effect.

9. **The capability is absent from the package public facade.** `packages/engine/src/index.ts:1-8` does not export `./invalidation/index.js`, while `@projector/engine` exports only its root. After build, `import("./packages/engine/dist/index.js").InvalidationEngine` is `undefined`; tests pass only because they import the private relative module. The Task 10 capability is unusable through the package boundary. The task report notes this as an integration dependency, but the reviewed commit itself does not satisfy the produced public capability/package-boundary requirement.

### Minor findings

- `packages/engine/src/invalidation/index.ts:630-631` swallows traversal errors without adding a reason, proof class, or unavailable observability; the later closure may therefore report an empty/generic reason even before the normalization loss described above.
- Duplicate revalidation outputs are neither rejected nor canonically deduplicated (`:659-661`, `:677`). The output hash can depend on duplicate ordering while the final `Map` silently uses the last result.

### Verification evidence

- Full review package read: `task-10-review-package.md` (all 1,376 lines).
- Reviewed `3146c59..8dc71e2`, Task 10 plan/brief, `docs/implementation/spec-resolutions.md`, and directly relevant PROJECTOR_SPEC sections.
- `pnpm --filter @projector/engine test` — pass, 144 tests.
- `pnpm --filter @projector/engine typecheck` — pass.
- `pnpm test` — pass, all 29 test files shown passing.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check 3146c59..8dc71e2` — pass.
- Worktree remained clean; review made no source/test changes.

## Review remediation — 2026-08-07

Commit: `449afeaf1bcc265661630ca0d1d8b886077ae65b`

### RED evidence

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/invalidation/public-facade.test.ts`
- Initial remediation run failed 12 regressions: incompatible SCC proof declarations, profile reverse indexing, refreshed backdating records, selector/traversal binding dependencies, unavailable closure provenance, conservative duplicate provenance, block effect, traversal failure observability, duplicate revalidation output handling, weak conformance evidence, version ordering, and the missing public facade export.

### GREEN evidence

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/invalidation/public-facade.test.ts` — 37/37 passed.
- `pnpm --filter @projector/engine typecheck` — passed.
- `pnpm --filter @projector/engine test` — 156/156 passed.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm build` — passed for all workspace packages.
- `pnpm test` — 351/351 passed (30 files).
- `pnpm check:boundaries` — passed.
- `git diff --check` — passed.
- Built facade smoke check: `packages/engine/dist/index.js` exports `InvalidationEngine`.
- Worktree clean after commit.

### Remediation summary

- Tarjan SCC declarations are validated as whole components; incompatible declarations fail closed.
- Impact Closure duplicate merges are commutative/conservative and retain unavailable entries/provenance.
- Returned closure bindings merge deterministic selector, applicability, reverse-traversal, exact reverse-dependency, and enumeration query dependencies.
- Output signature profiles are reverse-indexed and profile currency gates backdating.
- Profiles/Impact Rules use a deterministic numeric/SemVer version contract with arbitrary-size numeric comparison.
- Conformance requires passed, adequate-assurance, nonempty independent evidence groups under policy.
- Successful backdating refreshes records/inputs, updates the in-memory index, returns records, and persists through the injected store.
- `block` Impact Rules produce structured block records and fail closed in validity.
- Traversal failures retain reasons/proof/observability; duplicate revalidation outputs are deduplicated or rejected.
- Invalidation is exported from the engine root barrel with public-facade coverage.

## Independent fix re-review — 2026-08-07

Reviewed commits: `8dc71e2..9ad51b7` (`449afea` plus selector-order follow-up `9ad51b7`)

Verdict: **FAIL** (Important findings remain; no Critical finding).

### Important findings

1. **The generated negative-space dependencies are not executable registered query programs, so a returned Impact Closure is immediately `unavailable` under the engine's own binding validator.** `packages/engine/src/invalidation/index.ts:778-789` emits `programId: "invalidation.exact-reverse-derivation"`; the selector/applicability/traversal/enumeration variants at `:817-867` and `:917-944` use five more `invalidation.*` IDs. None is registered anywhere in the repository. `QueryDependencyRegistry.assertCurrent` rejects an unknown program at `packages/engine/src/query/index.ts:383-390`. Concrete reproduction: create an otherwise empty, valid binding, call `invalidate(..., { stateBinding })`, then validate the returned binding at the same `StateDigest` with the built-in `QueryDependencyRegistry` and `DependencyScopedStateBindingValidator`. The result is `status: "unavailable"` with `unknown registered query program invalidation.exact-reverse-derivation`. These synthetic fingerprints therefore cannot be re-evaluated after a state change and do not satisfy the state-bound negative-space contract. Register deterministic programs (or use compatible existing registered programs) and ensure their normalized inputs reproduce the stored result projections.

2. **Impact Closure content addressing is still dependent on traversal return order.** The follow-up sorts selector subjects, and the reverse-traversal fingerprint sorts each disposition, but `traversalIds` is built by raw concatenation at `packages/engine/src/invalidation/index.ts:912` and hashed unchanged as the surface-enumeration result at `:931-944`. Concrete reproduction: two equivalent ports return `knownIds` as `["a", "b"]` versus `["b", "a"]` and `possibleIds` as `["c", "d"]` versus `["d", "c"]`. The resulting closure hashes were `sha256:v1:fd9ee85feab68ff83e065fc454f5b252bfbed499ff765359edeef5ca6259ca7d` and `sha256:v1:b4d323b6546eaeea30b8c01f708d4066a4428ffc40a180fae9eea7bcfd5bd629`. The enumeration result projection must be normalized (and retain disposition if that distinction is semantic) before hashing.

3. **A successful material revalidation propagates impact but leaves the derivation index and durable snapshot stale.** Refreshed records are created only inside the `groupEligible`/backdating branch at `packages/engine/src/invalidation/index.ts:1050-1057`; persistence at `:1095-1100` therefore runs only for semantic equality. Concrete reproduction: index `contract(handler@old, output public-v1) -> client`, invalidate `handler` with `newHash`, and return exact `public-v2`. The result correctly lists `client` as transitive, but `revalidatedRecords` is empty and `index.get("contract")` still contains both `handler@old` and `public-v1`. A repeated run compares against stale proof state. Every completed revalidation that establishes a current derivation, including a material output change, must refresh/persist its input and output record; unavailable/failed revalidation must remain untouched.

4. **Correlated same-packet authorship can still be counted as independent conformance and grant strong completion.** `packages/engine/src/invalidation/index.ts:1252-1268` disallows only the `same-packet-agent` evidence lane and merely requires `authorSource` to be nonempty. Concrete reproduction: equal rebuild hashes plus one passed, strong validation with `evidenceLane: "test"`, `independenceGroup: "packet"`, `authorSource: "same-packet-agent"`, and one evidence ID returns `conformancePassed: true` and `strongCompletion: true`. This is the prior author-correlation case under a different lane, not independent evidence. Independence policy must reject correlated author sources/groups (or accept an authoritative correlation predicate), rather than treating arbitrary nonempty metadata as proof.

5. **Traversal failure retains the error text but overwrites the known proof's structured provenance.** Exact dependents start as `exact-derivation/closed` at `packages/engine/src/invalidation/index.ts:795-798`, but a traversal failure overwrites the shared per-unit maps with `unavailable/unavailable` at `:995-999`; both closure entries then read those shared maps at `:1128-1133`. Concrete reproduction: make `export` both an exact reverse dependent and an Impact Rule seed, then throw `Error("reverse unavailable")` from `traverse`. The closure contains both `known` and `unavailable` entries, but the `known` entry is incorrectly `proofClass: "unavailable", observability: "unavailable"` instead of retaining its exact/closed proof. Track provenance per disposition/source before normalization so the unavailable lane cannot erase the independent known lane.

### Prior-finding disposition

- Addressed: incompatible declared IDs can no longer split a Tarjan SCC; duplicate closure entries merge commutatively and unavailable dispositions survive; output profile IDs are reverse-indexed and an injected profile registry gates currency; prerelease and arbitrary-size numeric version ordering is deterministic; unchanged backdating refreshes/persists records; successful `block` evaluation returns structured blocked state; the root engine facade exports invalidation; conflicting duplicate revalidation outputs are rejected/deduplicated.
- Not fully addressed: negative-space binding is recorded but not re-evaluable and remains order-sensitive (findings 1-2); independent conformance still accepts correlated authorship (finding 4); traversal error text survives but known structured provenance does not (finding 5).
- New stale-index breakage found while checking the remediation: material revalidation is not persisted (finding 3).

### Verification evidence

- Read the complete revised fix package `task-10-fix1-review-package-v2.md` (1,512 lines), prior review/remediation, Task 10 brief, and directly relevant derivation/invalidation, State Binding, implementation-plan, acceptance, validation, and spec-resolution sources.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/invalidation/public-facade.test.ts` — pass, 38/38 tests.
- `pnpm --filter @projector/engine typecheck` — pass.
- `pnpm --filter @projector/engine build` — pass; used built package exports for the four concrete runtime reproductions above.
- `pnpm test` — pass, 338/338 tests across 29 files.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check 8dc71e2..9ad51b7` — pass.
- Worktree was clean before and after review; no implementation or test files were modified.

Follow-up deterministic-order regression commit: `9ad51b77f6d7cd130999a9be2c74abda567da8a7`

- RED: temporarily removing subject-result sorting made the new selector-order test produce different closure hashes.
- GREEN: restored canonical subject sorting; focused invalidation/facade suite is 38/38 and engine typecheck passes.
- Post-follow-up gates: engine 157/157; full repository 352/352 (30 files); boundaries pass.

## Independent fix re-review round 2 remediation — 2026-08-07

Commit: `0baeec1 fix(engine): make invalidation proofs executable and conservative`

### RED evidence

- Added five explicit regressions in `packages/engine/src/invalidation/invalidation.test.ts` before implementation:
  - public `QueryDependencyRegistry` validation of an invalidation-returned binding;
  - traversal disposition order invariance for closure content addressing;
  - material revalidation refresh/persistence of the changed derivation record;
  - same-packet authorship rejection on a non-`same-packet-agent` evidence lane;
  - retention of exact known provenance beside an unavailable traversal lane.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts -t 'emits query dependencies|normalizes every traversal|refreshes and persists|rejects same-packet authorship|retains exact provenance'` — initial RED: 5 failures (unknown/unavailable query program, order-dependent traversal hash, empty material `revalidatedRecords`, correlated conformance accepted, known proof overwritten).

### GREEN evidence

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/invalidation/public-facade.test.ts packages/engine/src/state/state-binding.test.ts` — 76/76 passed.
- `pnpm --filter @projector/engine typecheck` — passed.
- `pnpm --filter @projector/engine build` — passed.
- `pnpm --filter @projector/engine test` — 162/162 passed.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm build` — passed for all workspace packages.
- `pnpm test` — 357/357 passed (30 files).
- `pnpm check:boundaries` — passed.
- `git diff --check` — passed before commit.

### Remediation summary

- Added deterministic, normalized, graph-backed `invalidation.*` query programs to the public `QueryDependencyRegistry`; generated fingerprints now use executable stable-ID projections and canonical traversal dispositions.
- Material successful revalidation now refreshes/persists derivation proofs and changed inputs regardless of semantic equality; unavailable outputs remain untouched.
- Conformance independence rejects same-packet/correlated author source or group metadata independent of evidence lane, with assurance and evidence requirements retained.
- Proof class, observability, and reason handling now preserves exact known provenance independently from unavailable traversal provenance, including disposition-specific maps.

Follow-up test assertion commit: `a63ebba test(engine): assert isolated unavailable provenance`

- Added an explicit assertion that traversal failure text does not leak into the separate exact-known closure entry.
- Focused provenance regression: 1/1 passed.

Conformance policy hardening commit: `4f35470 fix(engine): reject packet-correlated conformance groups`

- Expanded the conservative correlation predicate to reject packet-marked author/group metadata regardless of lane spelling; same-packet/correlated regression subset is 3/3 green.

## Independent fix re-review round 2 — 2026-08-07

Reviewed commits: `9ad51b7..4f35470` (`0baeec1`, `a63ebba`, and `4f35470`)

Verdict: **FAIL** (three Important findings remain; no Critical finding).

### Important findings

1. **The registered Impact Rule query programs do not reproduce the fingerprints emitted by invalidation, so an unrelated snapshot change falsely stales the closure.** The synthetic fingerprints at `packages/engine/src/invalidation/index.ts:879-928` use the Impact Rule port's before/after subjects and caller dependency keys, while `packages/engine/src/query/index.ts:402-430` re-evaluates both membership phases and applicability as one current `GraphReader.querySelectorDependencies()` result with a different dependency key. The invalidation-only selector hash at `packages/engine/src/invalidation/index.ts:615-617` also hashes the raw selector under `impact-rule-selector`, whereas the graph's canonical membership contract uses the normalized `selector` domain at `packages/engine/src/governance/selectors.ts:127-129`. Traversal is likewise non-equivalent: invalidation stores known/possible/unavailable dispositions, observability, assumptions, unavailable lanes, and adapter dependency keys at `packages/engine/src/invalidation/index.ts:972-1007`, but the registry programs at `packages/engine/src/query/index.ts:434-462` compute only graph reverse closure, label every result `known`, and force `closed` observability. The transitive SCC program has the same mismatch: invalidation excludes proof-group seeds at `:1137-1148`, but query `reverseClosure` has no exclusion input and returns cyclic seeds again at `packages/engine/src/query/index.ts:386-399`. The new same-state test does not exercise this path because `DependencyScopedStateBindingValidator` calls only `assertCurrent` when the compiled snapshot matches (`packages/engine/src/state/index.ts:159-178`). Concrete built-package reproduction: create an Impact Rule closure with `before-export`, `after-export`, bounded traversal `{ known: [docs], possible: [unknown-consumer] }`, then validate it at an unrelated new `StateDigest` using a graph carrying the same current selector/reverse data. Validation returns `status: "stale"` and marks all five Impact Rule query IDs changed (before, after, applicability, reverse traversal, enumeration). These dependencies are registered and deterministic, but still are not evaluator-backed representations of the operations that produced their stored fingerprints.

2. **SCC refresh is neither atomic nor sufficient to establish current group records.** The proof-loop hash at `packages/engine/src/invalidation/index.ts:1093-1104` can repeat even when the output omits members. Once that happens, the new refresh block at `:1114-1121` persists every returned member without requiring complete group coverage; only afterward does `:1128-1133` diagnose the group as unresolved. Concrete built-package reproduction: for cyclic proof group `a <-> b`, invalidate an external input of `a`, set two iterations, and return only material output `a@new` each round. The result reports `derivation-cycle-unresolved` and both `a` and `b` unavailable, yet returns `revalidatedRecords: [a]` and calls the store once with `a@new` beside stale `b@old`. Even with complete `a@new` and `b@new` outputs, `refreshDerivationRecord` updates only inputs whose ID equals the original event subject and never refreshes `outputStructuralSignature` (`:1255-1274`): the persisted `unit:a`/`unit:b` input hashes and both structural signatures remain old. The spec requires SCC recomputation/backdating as a unit and a newly established derivation against its current inputs; incomplete groups must not persist partially, and complete material groups must update the full proof record.

3. **Successful traversal-unavailable results still leak unavailable-lane reasons into the independent exact-known entry.** Disposition-specific proof class and observability are now retained, but port-supplied `traversal.reasons` are added to the shared per-unit reason set at `packages/engine/src/invalidation/index.ts:1022-1028`; the known-entry filter at `:1197-1202` removes only strings routed through `addUnavailableReason`. Concrete built-package reproduction: make `export` an exact reverse dependent and an Impact Rule seed; return `unavailableIds: ["export"]` with `reasons.export: ["external reverse lane unavailable"]`. The closure correctly contains exact-known/closed and unavailable/unavailable entries, but the known entry still contains `external reverse lane unavailable`. The follow-up test covers only a thrown traversal's internally generated error text, not unavailable provenance supplied by a successful traversal result.

### Five-finding disposition

- Not addressed: generated negative-space query dependencies are registered, but Impact Rule membership/applicability/traversal/enumeration evaluators cannot reproduce their stored semantic projections or dependency fingerprints (finding 1).
- Addressed: traversal enumeration is canonically ordered and retains disposition, so reversing lane enumeration no longer changes the closure hash.
- Partially addressed: ordinary successful equal/material revalidations refresh and persist, while thrown/omitted non-cyclic outputs do not; incomplete SCCs can still persist a partial group (finding 2).
- Addressed for the represented metadata: packet/correlated author/group markers are rejected independent of evidence lane, and assurance/evidence requirements remain in force.
- Partially addressed: exact known `proofClass` and `observability` survive beside unavailable traversal provenance, but arbitrary port-supplied unavailable reasons still contaminate the known entry (finding 3).

### Verification evidence

- Read the complete final package `task-10-fix2-review-package-v3.md` (960 lines), the latest prior re-review/remediation in this report, and the directly relevant State Binding/query, derivation/invalidation, acceptance, validation, implementation-plan, and spec-resolution sources.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts` — pass, 76/76 tests.
- `pnpm --filter @projector/engine build` — pass; built public exports were used for all three concrete reproductions.
- `pnpm test` — pass, 357/357 tests across 30 files.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check 9ad51b7..4f35470` — pass.
- Source and tests were not modified. The worktree remained clean after verification; only this requested review report was appended.

## Independent fix re-review round 3 remediation — 2026-08-07

Definitive remediation commit: `1c5b9e4` (`fix(engine): make invalidation proofs rebindable and atomic`), based on `4f35470`.

### Design decisions

- Invalidation now creates built-in query dependencies through the query registry's canonical program descriptors and result-fingerprint normalizer. Program IDs, input normalization, projection normalization, and traversal evaluation live in the query module rather than being reimplemented by invalidation.
- Impact Rule selector identities use governance's normalized `selector` hash. The membership contract retains frozen `before` membership separately from GraphReader-re-evaluated `after` membership; applicability is the union of those distinct phases.
- Graph-reproducible known reverse traversal re-evaluates from canonical seeds and excludes proof-group seeds. Port-only possible/unavailable traversal projections are marked with an explicit non-rebindable observation contract and fail closed on changed-state validation instead of asserting false evaluator equivalence. Observability, assumptions, unavailable lanes, dependency keys, and dispositions remain in the recorded fingerprint.
- Cyclic refresh requires complete converged group output, both output signatures, complete declared inputs, event-current hashes, and peer-input hashes equal to the corresponding current peer semantic output. A partial or internally inconsistent group publishes and stores no records. The coherent replacement snapshot is stored before the in-memory index is replaced.
- Successful traversal reasons attached to unavailable IDs are routed through unavailable provenance, keeping independent known entries free of unavailable-lane reasons.

### TDD evidence

RED, before production changes:

`pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts`

- 42 passed, 5 failed.
- Failures reproduced partial SCC publication, stale peer inputs/structural outputs, false staleness for an unrelated changed StateDigest, lack of explicit non-rebindable failure, and successful unavailable-reason contamination.

Additional SCC adversary RED:

`pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts -t "claimed current peer input|port-only traversal"`

- 1 passed, 1 failed: an SCC with `contract-a` claiming stale `contract-b` input still published and persisted both refreshed records.

GREEN after implementation:

`pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts`

- 4 files passed, 82/82 tests passed.

The runtime regression coverage now demonstrates:

- an Impact Rule closure created through the port rebinds across an unrelated changed StateDigest when canonical selector/reverse observations are unchanged, and stales when a new reverse consumer appears;
- a bounded port-only traversal with known/possible/unavailable dispositions fails closed as explicitly non-rebindable and retains its observation metadata;
- incomplete and peer-inconsistent SCC outputs do not mutate the index or call the store;
- a complete material SCC refresh atomically stores every peer's current input hash and both semantic and structural output signatures;
- successful unavailable traversal reasons appear only on the unavailable entry, not the independent exact-known entry.

### Final verification

- `pnpm --filter @projector/engine build` — pass.
- `pnpm test` — pass, 363/363 tests across 30 files.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check` — pass.
- Definitive source/test head is `1c5b9e4`; no follow-up source or test commit was created.

## Independent fix re-review round 3 — 2026-08-07

Reviewed commit: `1c5b9e4` over base `4f35470`

Verdict: **FAIL** (two Important findings remain; no Critical finding).

### Important findings

1. **Known-only Impact Rule traversal is declared rebindable even when the registered evaluator does not implement the rule/port traversal semantics.** `packages/engine/src/invalidation/index.ts:970-1006` records the port's result and sets `rebindable` solely from the absence of `possibleIds` and `unavailableIds` (`:977`). The shared registered programs at `packages/engine/src/query/index.ts:336-358` then re-evaluate an unbounded exact reverse-derivation closure; they do not implement `ImpactRule.direction`, `relationTypes`, `maxDepth`, `requiredRelationConfidence`, or any other injected-port traversal contract. Concrete built-package reproduction: an Impact Rule with `direction: "reverse"` and `maxDepth: 1` returned known result `docs` from seed `export`; the unchanged graph contained `export -> docs -> deep-consumer`. Validation at an unrelated changed `StateDigest` returned `status: "stale"` and marked both `reverse-traversal` and `enumeration` changed because the registered evaluator incorrectly added `deep-consumer`. Possible/unavailable results do fail closed as intended, but known-only port results are not automatically GraphReader-reproducible. Either the canonical program must encode and execute the complete traversal contract, or traversal must be explicitly non-rebindable unless the producing port supplies a compatible canonical descriptor/evaluator.

2. **A cyclic group can be backdated without a complete current proof, leaving the old derivation records authoritative.** The new current-proof gate at `packages/engine/src/invalidation/index.ts:1122-1143` correctly prevents refresh/persistence when a cyclic output omits `inputs` or `structuralSignature`. However, `groupEligible` at `:1144-1147` checks only semantic backdating assessments and does not require `fixedPointReached`, `completeCoverage`, or `hasCompleteCurrentProof`; it marks the whole SCC backdated and continues. Concrete built-package reproduction: for `a <-> b` with changed external input `internal`, revalidation returned complete exact semantic signatures equal to the prior signatures but omitted current inputs and structural signatures. The result reported `backdatedUnitIds: ["a", "b"]`, no `derivation-cycle-unresolved`, both units valid, and `revalidatedRecords: []`; the in-memory index remained byte-for-byte unchanged with the old external input hash. This violates the required new derivation against the changed input and makes the SCC current without establishing/persisting its current group proof. Cyclic eligibility must be gated by the same complete, converged, coherent current-proof predicate used for publication; failure must remain unresolved/widened.

### Prior-category disposition

- Addressed: canonical governance selector hashing and distinct frozen-before/current-after membership evaluation; SCC seed exclusions in both engine and registered reverse closure; disposition-specific unavailable reasons no longer leak into the independent exact-known entry.
- Addressed for the represented case: possible/unavailable traversal projections are explicitly non-rebindable and changed-state validation fails closed with preserved observation metadata.
- Addressed: result projection normalization is shared and deterministic, registered program IDs are centralized, query specs are accepted by the public registry, no duplicate literal invalidation program definitions were found, and the public engine facade remains intact.
- Addressed: complete coherent cyclic material output publishes the full group only; partial/peer-inconsistent output does not persist; persistence is attempted before in-memory replacement. A store-throw reproduction returned `store failed` and left the in-memory index unchanged.
- Not addressed: known-only bounded/port traversal is still assumed rebindable without semantic compatibility (finding 1), and SCC backdating bypasses the complete-current-proof publication gate (finding 2).

### Verification evidence

- Read the complete `task-10-fix3-review-package.md` (all 1,289 lines), the full prior review/remediation history in this report, and directly relevant State Binding/query, governance selector, derivation/invalidation, and spec-resolution sources.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts` — pass, 82/82 tests.
- `pnpm --filter @projector/engine build` — pass; built public exports were used for both Important reproductions and the store-failure atomicity check.
- `pnpm test` — pass, 363/363 tests across 30 files.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm check:boundaries` — pass.
- `git diff --check 4f35470..1c5b9e4` — pass.
- Source and tests were not modified. Only this requested review report was appended.

## Independent fix re-review round 4 remediation — 2026-08-07

Definitive commit: `46cfb757eaf74098f8d3aea3d570de8925d9917a` (`fix(engine): gate traversal rebinding and cyclic backdating`), based on `1c5b9e4`.

### RED evidence

Before production changes, the two exact runtime regressions failed:

- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts -t "known-only bounded"` — failed because a known-only bounded `maxDepth: 1` port traversal validated as `stale` against a deeper graph instead of `unavailable` under a non-rebindable contract.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts -t "does not backdate a cyclic group"` — failed because a cyclic group with equal semantic outputs but missing current inputs/structural signatures was backdated as `contract-a` and `contract-b`.

### GREEN evidence

- Injected Impact Rule traversal observations are now always recorded with `rebindable: false` because the current port API supplies no canonical traversal descriptor/evaluator. Same-state validation still asserts registered query currency and preserves bounded observability, assumptions, and dependency-key metadata; changed-state validation fails closed as unavailable.
- Cyclic backdating now requires the same `fixedPointReached && completeCoverage && hasCompleteCurrentProof` predicate used for SCC publication. Missing proof marks the group unresolved/unavailable, prevents backdating and valid status, and leaves both the in-memory index and injected store unchanged.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts` — 84/84 passed.
- `pnpm --filter @projector/engine typecheck` — passed.
- `pnpm --filter @projector/engine test` — 170/170 passed.
- `pnpm typecheck` — passed.
- `pnpm build` — passed.
- `pnpm test` — 365/365 passed across 30 files.
- `pnpm check:boundaries` — passed.
- `git diff --check` — passed before commit.

### Commit and worktree evidence

- Exactly one source/test commit was created: `46cfb757eaf74098f8d3aea3d570de8925d9917a`.
- `git status --short --branch` — clean on `codex/projector-t10`.
- Definitive source/test head is frozen at `46cfb757eaf74098f8d3aea3d570de8925d9917a`; no follow-up source or test commit was created.

## Independent fix re-review round 4 — 2026-08-07

Reviewed commit: `46cfb757eaf74098f8d3aea3d570de8925d9917a` over base `1c5b9e4`

Verdict: **FAIL** (one Important finding remains; no Critical finding).

### Important finding

1. **Semantic equality bypasses cyclic proof-group convergence, so unstable structural proofs can be backdated and persisted after one iteration.** The proof-loop hash intentionally covers semantic signatures, structural signatures, inputs, and validations at `packages/engine/src/invalidation/index.ts:1103-1105`, but `matchesEstablished` assesses only the prior and current semantic signatures at `:1108-1111`. The condition at `:1112-1114` treats that semantic equality as a fixed point on the first round, before any second output exists to show that the full group proof stabilized. `hasCompleteCurrentProof` at `:1126-1138` requires structural signatures to be present but does not make them participate in this shortcut's equality/convergence decision. Consequently, complete current inputs and peer-consistent semantic hashes are sufficient to publish arbitrary first-round structural signatures and backdate the SCC even when the revalidator would return different structural signatures on every round. This contradicts the required SCC fixed-point/group-signature convergence and the requested semantic-plus-structural proof gate.

   Exact built-package reproduction: create `contract-a <-> contract-b`, invalidate `contract-a`'s external `internal` input, set `maximumProofGroupIterations: 3`, and have every `revalidate` call return complete event-current inputs and peer-consistent unchanged exact semantic signatures (`a-v1`, `b-v1`) while returning structural signatures containing the invocation number. The callback was invoked only once (`round: 1`); the result had `backdatedUnitIds: ["contract-a", "contract-b"]`, `diagnostics: []`, `invalidation.unavailable: []`, both cyclic units plus the consumer in `validUnitIds`, and two `revalidatedRecords` containing the first-round structural hashes. The reproduction script used for this read-only review is `/tmp/task10-structural-convergence-repro.mjs`; after `pnpm --filter @projector/engine build`, `node /tmp/task10-structural-convergence-repro.mjs` prints that result. The cyclic group should iterate the complete proof projection to equality (or otherwise establish structural stability under an explicit strategy); if it does not converge within the bound, it must remain unresolved/unavailable and publish/store no group records.

### Remediation disposition

- Addressed: every traversal observation produced by the injected `ImpactRuleEvaluationPort` now records `rebindable: false`, including known-only closed, bounded, and custom traversal results. The public registry still accepts/asserts those normalized specs on the compiled snapshot; prior fingerprints retain result count/dispositions, observability, assumptions, unavailable lanes, and dependency keys. On a changed snapshot the traversal and enumeration evaluators throw the explicit non-rebindable error, which the binding validator maps to `status: "unavailable"` rather than false `stale`.
- Addressed: selector-membership and Impact Rule applicability remain separate canonical, rebindable queries. Changed-state validation continues evaluating them even when traversal is unavailable, so their changes can still appear in `changedQueryDependencyIds`; traversal non-rebindability does not silently relabel those query contracts.
- Addressed: incomplete equal cyclic outputs lacking current inputs or structural signatures now produce `derivation-cycle-unresolved`, make all group members unavailable, do not backdate them or report them valid, return no refreshed records, and leave the in-memory index and injected store unchanged. Complete peer-consistent proofs still publish atomically, and store replacement still precedes in-memory replacement.
- Not addressed: the convergence predicate does not cover the same complete semantic-plus-structural proof projection used for persistence when semantic signatures match the old records (finding 1).
- No test weakening was found in the narrow diff. Updating the earlier SCC tests to provide complete proof records matches the strengthened contract, but the convergence regression lacks coverage because the existing oscillation test changes semantic and structural signatures together.

### Verification evidence

- Read the complete supplied `task-10-fix4-review-package.md`, the latest round-3 review and round-4 remediation in this report, Task 10 brief, and the directly relevant derivation/invalidation, state-binding, SCC acceptance, and adversarial-evaluation specifications.
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts` — pass, 84/84 tests.
- `pnpm --filter @projector/engine build` — pass; built public exports were used for the structural-convergence reproduction above.
- `pnpm typecheck` — pass for all workspace packages.
- `pnpm test` — pass, 365/365 tests across 30 files.
- `pnpm check:boundaries` — pass.
- `git diff --check 1c5b9e4..46cfb75` — pass.
- Implementation and tests were not modified. The source/test worktree remained clean; only this requested review report was appended.

## Independent fix re-review round 5 remediation — 2026-08-07

Definitive commit: `829fae863533f3f1e9244572cc16bf0b2b0266bd` (`fix(engine): require complete cyclic proof convergence`), based on `46cfb757eaf74098f8d3aea3d570de8925d9917a`.

- RED: the exact cyclic regression with stable semantic signatures but per-invocation structural signatures stopped after round 1 on the baseline, failing the expected three-round bound.
- GREEN: removed the cyclic semantic-only `matchesEstablished` shortcut; cyclic convergence now requires equality of the canonical complete proof projection across successive rounds.
- Proof hashing canonically normalizes signatures, input ordering, and validation evidence before comparison.
- Stable cyclic proofs converge after two matching rounds; transitional proofs converge only after a subsequent matching round; structurally unstable proofs exhaust the bound and remain unresolved/unavailable with no backdating, persistence, or index mutation.
- Verification: focused 3/3, invalidation 51/51, engine 171/171, workspace 366/366, engine/workspace build and typecheck, boundaries, and diff-check all passed.
- Worktree clean; exactly one source/test commit was created.

## Independent fix re-review round 5 — 2026-08-07

Reviewed commit: `829fae863533f3f1e9244572cc16bf0b2b0266bd` over base `46cfb757eaf74098f8d3aea3d570de8925d9917a`

Verdict: **PASS** (no Critical or Important findings).

### Review disposition

- Cyclic convergence no longer has a semantic-equality shortcut. A cyclic proof group requires complete output coverage and equality of two successive normalized full-proof hashes; stable proofs therefore require two matching rounds, transitional proofs require the first subsequent matching pair, and unstable proofs exhaust the declared bound.
- The convergence projection contains each unit ID, semantic signature, structural signature, current derivation inputs, and validation results. Signature and validation evidence IDs are normalized as sets; units, inputs, and validations are deterministically ordered with full canonical tie-breaking. All other signature/input/validation fields remain in the canonical projection, so meaningful structural, semantic, input-version, assurance, validator, provenance, timing, or detail changes remain observable.
- Canonicalization does not introduce callback-order dependence. A built-package reproduction reversed unit order, input order, validator order, and evidence-ID order between otherwise identical rounds; it converged on round 2, backdated both SCC members, refreshed both records, called the store exactly once, and left the stored snapshot equal to the in-memory index.
- The exact prior structural-instability reproduction now invokes the callback for all three allowed rounds and returns `derivation-cycle-unresolved`, both SCC members unavailable, no backdated IDs, no refreshed records, and no valid cyclic/group-dependent units. The injected-store regression and snapshot assertions confirm there is no record, store, or index mutation on exhaustion.
- Complete stable proofs still refresh the whole SCC and persist it atomically: store replacement precedes in-memory index replacement, current event and peer input hashes are checked, and both output signatures plus validations are published together. Existing partial, missing-proof, and peer-inconsistent adversaries remain fail-closed.
- Noncyclic groups retain one-pass behavior because the noncyclic fixed-point flag is established on complete first-round coverage. Existing noncyclic backdating/input-refresh coverage and the full suite remain green; no backdating regression was found.

### Verification evidence

- Read the complete supplied `task-10-fix5-review-package.md`, the latest round-4 finding and round-5 remediation in this report, and the directly relevant derivation/SCC, acceptance, and adversarial-evaluation specifications.
- Built public-package exact reproduction: `pnpm --filter @projector/engine build && node /tmp/task10-structural-convergence-repro.mjs` — round 3, no backdating, `derivation-cycle-unresolved`, both SCC members unavailable, no persisted structures.
- Independent canonical-order/stable-persistence reproduction: `node /tmp/task10-proof-order-repro.mjs` — round 2, both SCC members backdated/refreshed, one store call, stored snapshot equal to the updated index.
- Focused SCC regressions — 8/8 passed (43 unrelated invalidation tests skipped).
- `pnpm exec vitest run packages/engine/src/invalidation/invalidation.test.ts packages/engine/src/query/query.test.ts packages/engine/src/state/state-binding.test.ts packages/engine/src/invalidation/public-facade.test.ts` — 85/85 passed.
- `pnpm --filter @projector/engine typecheck` — passed.
- `pnpm build` — passed for all workspace packages.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm test` — 366/366 passed across 30 files.
- `pnpm check:boundaries` — passed.
- `git diff --check 46cfb75..829fae8` — passed.
- Implementation and tests were not modified. Only this requested review report was appended.
