# Task 11 report — semantic identity, relevance, facets, topology, and Planning Surprises

## Intake

- Worktree: `/home/zethj/dev/projector/.worktrees/task-11-identity`
- Branch: `codex/projector-t11`
- Base: `a642b77b8f632f8ecb27b6c4260cf25ac4ea7d05`
- Governing material read in full or at the directly relevant contract seams:
  - task-11 brief, tracked implementation plan/global constraints, progress ledger, and specification-resolution ledger
  - `02-semantic-kernel/identity-and-relations.md`
  - `02-semantic-kernel/state-binding-and-ports.md`
  - `03-knowledge/relevance-and-change-cognition.md`
  - `03-knowledge/evidence-and-authority.md`
  - `12-delivery/acceptance-relevance-and-identity.md`
  - `12-delivery/implementation-plan.md`
  - directly referenced semantic-change, execution-context, reconciliation-surprise, source-class, query, selector, evidence, and authority sections
- TDD instructions: `superpowers:test-driven-development` plus `writing-good-tests.md`.

## Delivered capability

- `packages/engine/src/identity/**`
  - deterministic `reuse-existing`, `coordinated-modification`, `split-existing`, `merge-existing`, `replace-existing`, `create-new`, `no-durable-entity`, and `unresolved` outcomes
  - active/deprecated/superseded/tombstone consideration and replacement following
  - explicit owns/excludes boundary for new identity creation
  - duplicate/overlap creation guard and separate user/policy acceptance gate so derived resolution evidence cannot mint authority
  - deterministic stable IDs/content hashes independent of paths and candidate insertion order
- `packages/engine/src/relevance/**`
  - structured WHAT/WHY intent analysis with solution proposals quarantined from behavioral meaning
  - independently injected read-only WHERE/WHAT-ELSE scout
  - deterministic four-band Relevance Closure with score/depth/entry/cost bounds
  - query dependencies for every executed expansion and empty stopping query
  - explicit frontier/unknowns for budget stops and open/sampled/unavailable observation lanes
  - value/query `StateBinding`, stale identity-snapshot refusal, observability and irrelevant-expansion metrics
  - predicted-versus-observed Planning Surprise classification, including resolution-ledger mappings
  - evidence-backed relationship proposals fixed at `status: proposed`, `canonical: false`; overreach never learns an edge
- `packages/engine/src/context/**`
  - deterministic Analysis Facet activation and obligation composition without technology/architecture selection
  - direct/governing full context, consequence summaries, possible identity-only disclosure
  - source-identity preservation and identity-fork refusal
  - content-addressed Markdown, Gherkin, compact-agent, and machine-invariant Requirement/Scenario views bound to the same canonical source IDs/hashes
- `packages/analyzers/src/topology/**`
  - stable event/contract producer-consumer routes with exact/validated/heuristic assurance
  - path-independent topology identity, deterministic sorting/deduplication, and conflicting stable-subject refusal

The 22 acceptance scenarios are covered compositionally by the new focused scenarios/properties and the existing foundation/state/persistence suites: identity synonym/history/split/merge/duplicate/path invariants; discovery-vs-semantic hashing; cross-cutting relevance, over-expansion, event/contract recall, WHAT/WHY isolation, derived behavior views, facets; dependency-local rebound/staleness/query-program and negative-space invalidation; open-world refusal; surprise learning/overreach; fine-grained canonical locality.

## RED evidence

Initial command:

```text
pnpm exec vitest run --root . \
  packages/engine/src/identity/index.test.ts \
  packages/engine/src/relevance/index.test.ts \
  packages/engine/src/context/index.test.ts \
  packages/analyzers/src/topology/topology.test.ts
```

Result: four failed suites with the expected missing task-local module implementations.

Subsequent adversarial RED cycles caught and named:

- create-new resolution incorrectly authorizing canonical creation without user/policy acceptance
- one stable topology subject accepting conflicting semantic keys
- non-empty open-world discovery failing to preserve incompleteness
- relevance compilation accepting identity evidence from a different snapshot
- TypeScript rejecting `Set` values passed where normalized arrays were required

Each was observed failing before the minimal implementation/fix.

## GREEN and verification evidence

- Focused final additions: 4 test files, 32 tests passing.
- Engine package suite: 15 files, 198 tests passing.
- Analyzer package suite: 2 files, 22 tests passing.
- Engine typecheck: pass.
- Analyzer typecheck: pass.
- Full `pnpm verify`: pass — 34 files, 398 tests; all workspace typechecks; package-boundary check valid.
- Full `pnpm build`: pass for all six buildable workspace projects.
- `git diff --cached --check`: pass before commit.
- Scope check: only the assigned engine identity/relevance/context directories and analyzer topology directory changed; no shared root barrel, runtime/SQLite, CLI, DAG, or unrelated task files changed.

## Integration seams and blockers

- No blocker.
- Per ownership constraints, shared package barrels were deliberately not edited. Integration must export:
  - `packages/engine/src/identity/index.ts`
  - `packages/engine/src/relevance/index.ts`
  - `packages/engine/src/context/index.ts`
  - `packages/analyzers/src/topology/index.ts`
- Engine remains independent of analyzer/runtime implementations: relevance/topology/state access is injected through host-neutral data/ports.
- Analyzer topology remains core-only and does not import engine/runtime.

## Commit

- `4e7d4ee` — `feat: add semantic identity and relevance closure`

---

## Independent review — 2026-08-07

### Verdict: FAIL

Commit `4e7d4ee` is not ready to merge over `a642b77`. The existing tests, typecheck, build, and boundary check pass, but concrete adversarial reproductions expose Critical and Important violations of the Task 11 brief and the normative identity/relevance/StateBinding/Planning Surprise contracts.

### Critical findings

1. **Duplicate prevention and the canonical-creation authority gate are caller-bypassable.** In `packages/engine/src/identity/index.ts:71-85`, a caller-supplied `assessment: "distinct"` plus any syntactically nonempty owns/excludes/rationale boundary returns `create-new` even when `records` contains a high-confidence active, deprecated, superseded, or tombstoned overlap. The only overlap refusal at lines 72-81 is reached when the boundary is incomplete. Then `assertCanonicalCreationAllowed` at lines 139-150 checks only that an acceptance object exists and `evidenceIds.length > 0`; it does not verify a nonblank evidence ID, evidence reliability/authority, an Authority Record, or that the resolution's candidates/lineage actually permit creation. Reproduction against built commit output:

   ```text
   active create-new allowed
   deprecated create-new allowed
   superseded create-new allowed
   tombstone create-new allowed
   ```

   The reproduction used a 0.99 similarity/ownership/boundary candidate and `assertCanonicalCreationAllowed(result, { acceptedBy: "policy", evidenceIds: [""] })`. This directly violates duplicate prevention, historical-identity consideration, and the two-stage evidence/authority rule. Remedy: derive/validate distinctness from the candidate and historical search result, refuse creation while any overlapping record remains unresolved, and require a validated authority/evidence object rather than trusting caller labels.

2. **Identity outcomes are not evidence adjudication; the caller directly selects them, allowing wrong-kind/zero-evidence reuse and deleted-identity resurrection.** `decision` at `packages/engine/src/identity/index.ts:59-97` maps the `assessment` enum to an outcome without using candidate kind, scores, evidence, explanation, lifecycle constraints, or thresholds. Confidence is calculated only after the outcome at lines 107-110, so it does not constrain the decision. A requested `requirement` with a zero-score, evidence-free `concept` candidate and `assessment: "same"` reproduced as:

   ```text
   reuse-existing [ 'concept-timing' ] 0 concept requirement
   ```

   Separately, `activeTargets` at lines 45-50 treats a tombstone with no replacement as a selectable live target; `assessment: "same"` reproduced `reuse-existing [ 'existing' ]`. This can reuse the wrong canonical contract or resurrect a deleted ID. Remedy: make the assessment an output of deterministic evidence/kind/lifecycle policy (or strongly validate an externally produced assessment), treat unreplaced tombstones as historical blockers rather than live targets, and block automatic action below explicit evidence/authority thresholds.

### Important findings

1. **Identity decisions are not dependency-complete or re-evaluable.** `resolveSemanticIdentity` merely clones the caller's `boundState` at `packages/engine/src/identity/index.ts:129`; it neither constructs/validates the binding nor requires the semantic-identity/alias search, lineage, tombstone, relation, selector, or topology query dependencies that established reuse versus creation. The committed tests deliberately pass an empty binding. Consequently a new alias/entity/tombstone/replacement can change the correct identity decision without staling it, contrary to the identity-search and negative-space requirements in `state-binding-and-ports.md` and `relevance-and-change-cognition.md`. Require a validated `StateBinding` with the exact closure-sensitive identity queries and selected value hashes, and reject malformed/incomplete bindings.

2. **Relevance compilation can bind queries observed from one snapshot to another snapshot.** `compileRelevanceClosure` checks only `identityResolution.boundState.compiledAgainst` versus `input.compiledAgainst` at `packages/engine/src/relevance/index.ts:197-201`; it never checks `input.context.stateDigest`. The discovery call at line 259 can therefore observe state B while `createStateBinding` at lines 303-304 records state A. Runtime reproduction succeeded with output:

   ```text
   binding A discovery-context B queries 1
   ```

   This creates an internally incoherent, non-re-evaluable closure. Require `context.stateDigest === compiledAgainst` (or an explicit validated snapshot/rebind protocol) before discovery.

3. **Budgeted relevance traversal is not order invariant and can report an included entity as frontier.** Edges are sorted only by band, score, and entity ID at `packages/engine/src/relevance/index.ts:268-269`. Duplicate edges for the same entity with equal rank retain input order, while the first accepted edge's `cost` controls later budget decisions at lines 279-287. With duplicate `x` edges costing 8 and 1 plus `y` costing 3 under `maxCost: 10`, reversing only the duplicate input order produced:

   ```text
   forward [ 'root', 'x' ] [ 'x', 'y' ]
   reverse [ 'root', 'x', 'y' ] [ 'x', 'y' ]
   equal false
   ```

   The forward result also contains included `x` in its frontier because a rejected duplicate adds it at line 281 and later acceptance never removes it. Normalize/merge all edges per entity before budget selection with deterministic score/band/required/cost semantics, and maintain disjoint included/frontier sets.

4. **Identity resolution is also insertion-order dependent for duplicate observations of one stable ID.** Candidates are sorted only by `entityId` at `packages/engine/src/identity/index.ts:103-104`; two records with the same ID but different observations retain caller order. Reversing scores 0.9/0.2 produced candidate arrays `[0.9, 0.2]` versus `[0.2, 0.9]` and different resolution IDs. Conflicting duplicate records should be rejected or deterministically reconciled by full canonical key, lifecycle, and evidence policy.

5. **Split/merge/replace outcomes do not produce or validate lineage/tombstones.** The entire implementation ends at a `SemanticIdentityResolution`; no Task 11 code creates an inspectable `LineageRecord`, validates from/to cardinality, records replace/delete continuity, or ensures tombstones survive the operation. Tests only assert enum mapping. This does not satisfy the brief's split/merge/replace lineage/tombstone requirement or the normative rule that these outcomes create explicit lineage. Return validated lineage proposals/operations (still noncanonical until authorized), and add split/merge/replace/tombstone adversaries.

6. **Event/contract topology is neither query-bound nor connected to Relevance Closure, and it overstates heuristic enumeration.** `compileEventContractTopology` is referenced only by its own tests; no production adapter converts routes to relevance edges or emits the required event/contract `StateQueryDependency`. Thus the acceptance path "known consumer enters relevance deterministically before model inference" is not exercised or supplied by this commit, and adding a consumer cannot automatically stale a closure. Additionally, line 119 maps every non-all-exact route—including wholly heuristic observations—to `bounded`; a heuristic link set does not itself establish a bounded enumeration or negative-space proof. Runtime output was `heuristic bounded`. Provide a host-neutral topology discovery/query adapter with explicit enumeration contract/assumptions and conservative open/sampled observability for heuristic lanes.

7. **Topology route IDs are not stable across observation/evidence refresh.** At `packages/analyzers/src/topology/index.ts:112-122`, `id` is sliced from the full route content hash, including assurance, confidence, evidence IDs, adapter version, artifact hash, and current participants. The same semantic route changed IDs between exact, validated, and heuristic observations in reproduction. Use stable subject/route semantic identity for `id` and reserve `contentHash` for changing observation content; participant membership and assurance changes should invalidate/query-refresh the route, not create a new route identity.

8. **Possible-band context drops the required rationale and uncertainty, and the claimed Gherkin view contains no Gherkin steps.** `CompiledContextItem` has no reasons/uncertainty field, and `compileContext` emits only the entity ID for `possible` at `packages/engine/src/context/index.ts:109-124`. The normative policy requires identity plus why it may matter plus uncertainty. At lines 149-154, the `gherkin` renderer emits `precondition:`, `trigger:`, and `expected-outcome:` rather than `Given`/`When`/`Then`; a Gherkin parser treats those as description text, leaving the Scenario behaviorally empty. Preserve compact reasons/confidence/unknowns for possible entries and map scenario roles to valid Gherkin keywords while retaining source IDs/hashes.

9. **Planning Surprise classification conflates authorization with category and collapses mixed surprises.** `classify` at `packages/engine/src/relevance/index.ts:363-370` considers a required unexpected impact to be scope expansion only when unauthorized; the same required impact when already authorized but lacking a proposed relation falls through to `incidental-change`. Reproduction returned `authorizedRequired incidental-change benign-discovery accept-no-model-change`. A mixed legitimate missing relation plus unrelated overreach is globally classified as overreach and drops the valid noncanonical proposal (`mixed agent-overreach ... proposals 0`). An empty unexpected set also emits a benign Planning Surprise. Classify unexpected impacts individually (or reject heterogeneous input), distinguish required scope/analysis deficiency from incidental regardless of prior authorization, validate proposed relation endpoints/evidence, and emit no surprise when nothing unexpected exists.

### Minor findings

- `compileContext` may exceed `policy.maxCost` silently for every `requiredForPlanning` item (`packages/engine/src/context/index.ts:111-125`). If the budget is intentionally soft for required semantics, expose the overrun/required expansion explicitly rather than returning an estimate above `maxCost` with no budget unknown.
- `irrelevantExpansionRate` treats every considered edge not counted as a newly included entity as irrelevant, including duplicate evidence for an included entity and budget-deferred frontier (`packages/engine/src/relevance/index.ts:318-325`). This metric can misstate both irrelevance and expansion quality; report duplicate, below-threshold, and budget/frontier counts separately.
- The focused tests are materially narrower than the report's statement that all 22 acceptance scenarios are covered. In particular, no composed test passes compiled event/contract topology into relevance, no identity test binds and re-evaluates an identity-search query, no valid-boundary overlap adversary reaches the creation gate, and no parser validates the claimed Gherkin representation.

### Verification evidence

- `pnpm test -- --runInBand`: pass (workspace Vitest run; all listed suites green).
- `pnpm typecheck`: pass.
- `pnpm build`: pass.
- `pnpm check:boundaries`: pass (`Package dependency boundaries valid`).
- `pnpm test:boundaries`: command does not exist; corrected to the repository's `pnpm check:boundaries`.
- Package inspection confirms engine imports only core plus engine-owned governance/state helpers; there is no analyzer/runtime coupling introduced in engine.
- All runtime reproductions used the built `dist` output from commit `4e7d4ee`; source and tests were not modified during review.

---

## Independent-review repair — 2026-08-07

### TDD checkpoints

- Repair base was frozen and clean at `4e7d4ee3daf5a20b40d6e937ff586e4fb843280b`.
- Identity RED: 5 failures / 17 tests reproduced wrong-kind and zero-evidence reuse, unreplaced tombstone resurrection, valid-boundary active/historical duplicate bypass, incomplete dependency acceptance, conflicting duplicate observations, weak creation authority, and absent lineage/tombstone proposals.
- Injected identity-search RED: 1 failure / 18 tests reproduced the missing production search/binding port.
- Lineage-continuity RED: 1 failure / 18 tests reproduced self-replacement and blank-target acceptance.
- Relevance/Planning Surprise RED: 4 failures / 16 tests reproduced discovery snapshot incoherence, duplicate-edge budget/order/frontier errors, authorized required-impact collapse, empty surprises, mixed-proposal loss, and malformed proposal acceptance.
- Context RED: 3 failures / 4 tests reproduced possible-band rationale/uncertainty loss, silent required budget overrun, and behaviorally empty pseudo-Gherkin.
- Topology RED: 3 failures / 7 tests reproduced observation-dependent route IDs, the absent relevance/query adapter, and heuristic enumeration overstated as bounded.

### GREEN contracts

- Semantic identity now validates caller assessments against requested kind, lifecycle, evidence, explanation, score thresholds, target cardinality, closed/bounded identity-search negative space, query-program completeness, binding digest, and candidate/replacement value hashes. Unreplaced tombstones remain historical blockers.
- Canonical creation now refuses unresolved search results and requires a directly applicable approved/auto-approved user or policy `AuthorityRecord` backed by nonblank, reliable, normatively authoritative evidence. Split/merge/replace/delete emit deterministic `canonical: false` lineage proposals; replace/delete also emit noncanonical tombstone proposals with continuity validation.
- `resolveSemanticIdentityFromSearch` supplies the host-neutral read-only identity port, constructs the re-evaluable `StateBinding`, and rejects discovery from a different snapshot.
- Relevance compilation requires discovery-context snapshot coherence, deterministically merges duplicate entity edges before budgeting, keeps included/frontier disjoint, and reports duplicate/below-threshold/budget/frontier metrics separately.
- Planning Surprises classify each unexpected impact, keep authorized required scope/analysis deficiency distinct from incidental change, preserve valid missing-relation proposals beside overreach, validate proposal endpoints/evidence, and return no surprise for empty unexpected impact.
- Topology route IDs now hash stable semantic route identity while `contentHash` tracks assurance/evidence/participant refresh. The production adapter emits deterministic event/contract relevance edges and `StateQueryDependency` fingerprints before inferred discovery. Non-exact lanes default to `open`; `bounded` requires an explicit enumeration assumption.
- Context possible entries retain reasons, uncertainty, and confidence; required budget expansion/overrun is explicit. Gherkin views contain parser-visible Given/When/Then/And/But steps and source ID/hash trace comments.

### Final verification and frozen head

- Focused task suites: 4 files, 45 tests passed.
- Engine package: 15 files, 209 tests passed.
- Analyzer package: 2 files, 25 tests passed.
- Full `pnpm verify`: 34 files, 411 tests passed; all workspace typechecks passed; package boundaries valid.
- Full `pnpm build`: all six buildable workspace projects passed.
- `git diff --cached --check` passed before commit; worktree was clean after commit.
- Repair commit / definitive head: `657f1c990145e1fd32f643e4679e6592cc911836` — `fix: harden identity and relevance contracts`.

---

## Independent re-review of repair — 2026-08-07

### Verdict: FAIL

Commit `657f1c9` is not ready to merge over `4e7d4ee`. The focused and full suites, all workspace typechecks, build, and package-boundary check pass, and the repair resolves many of the original defects. However, the explicit canonical-creation gate remains caller-bypassable, and several Important identity, StateBinding, topology, lineage, and Planning Surprise defects remain. Under the review rule, any remaining Critical or Important finding is a failing verdict.

### Critical finding

1. **The canonical-creation mutation gate still accepts fabricated resolutions, Authority Records, and Evidence.** `assertCanonicalCreationAllowed` at `packages/engine/src/identity/index.ts:313-340` consumes plain caller objects and checks only a small subset of their fields. It does not parse the public schemas, verify either semantic/content hash, verify that the resolution was produced by `resolveSemanticIdentity`, validate its `StateBinding`, retrieve an approved canonical Authority Record from authoritative state, or establish that the supplied Evidence claims actually authorize this resolution. A runtime reproduction passed a structurally incomplete object containing only `status`, `decidedBy`, `subjectId`, `rationale`, and one evidence ref, plus an equally incomplete Evidence object containing only `id`, `applicability`, `reliability`, and `normativeAuthority`:

   ```text
   fabricated acceptance allowed
   ```

   The gate also accepts `SemanticIdentityResolution` rather than the repair's adjudicated resolution type, so an arbitrary caller can supply a hand-built `create-new` result with confidence/support labels. This preserves the original authority bypass in a more elaborate shape: TypeScript interfaces are not runtime provenance or authority. Remedy: make the gate consume trusted repository lookups/validated canonical envelopes (or opaque verified handles), parse schemas at the boundary, verify canonical semantic/content hashes and resolution binding/hash, and require directly applicable evidence/claims obtained from authoritative state rather than caller assertions.

### Important findings

1. **Identity outcome kind remains caller-selected rather than evidence-adjudicated.** `supportsRequestedIdentity` at `packages/engine/src/identity/index.ts:148-155` now applies kind/evidence/score thresholds, but `decision` at lines 212-220 still maps the caller's `assessment` directly to the outcome. The identical active candidate, scores, explanation, EvidenceRefs, and StateBinding reproduced four incompatible outcomes solely by changing that enum:

   ```text
   same => reuse-existing []
   split => split-existing [ 'split' ]
   replace => replace-existing [ 'replace' ]
   delete => no-durable-entity [ 'delete' ]
   ```

   Thresholds establish candidate eligibility, not evidence for split/replace/delete semantics. The repair therefore does not fully resolve the prior finding that identity outcomes are caller commands. Derive the assessment from typed evidence/lineage facts, or validate an external assessment with outcome-specific evidence and authority policy.

2. **Identity search bindings are self-consistent but neither request-bound nor actually re-evaluable.** `validateIdentityBinding` at `packages/engine/src/identity/index.ts:105-123` checks only six program-ID strings, equality between two caller-supplied hashes, nonempty dependency keys, and closed/bounded labels. It does not recompute `StateQuerySpec.semanticHash`, require the correct query kinds/versions, validate normalized input against `requestedMeaning`/`requestedKind`, or require registered query programs. None of the six fixed `identity.*` program IDs is registered in `packages/engine/src/query/index.ts`; the available built-in identity program is `graph.semantic-identity-search`. A binding whose every query input named `OLD UNRELATED REQUEST`, with arbitrary matching query hashes, was accepted for `NEW DIFFERENT REQUEST` and produced:

   ```text
   create-new 1 [ 'OLD UNRELATED REQUEST' ]
   ```

   Thus a new alias/entity/tombstone/relation can still escape the supposed negative-space binding, and the dependency cannot be replayed by the repository's `QueryDependencyRegistry`. Construct specs through a registry (or validate with it), bind normalized requested meaning/kind and the actual search subqueries, and reject unknown/non-current programs.

3. **The topology query binding cannot be re-evaluated and omits closure-relevant fingerprint fields.** `createTopologyRelevanceAdapter` at `packages/analyzers/src/topology/index.ts:177-223` emits program `projector.topology.relevance`, which is not registered. `QueryDependencyRegistry.assertCurrent` reproduced `UnknownQueryProgramError`. Even after registering a same-ID/version/kind test program, it reproduced `InvalidQuerySpecError: query semantic hash does not match program and normalized input`, because line 185 hashes a custom `topology-relevance-query` domain and omits query kind instead of using the canonical `state-query` contract. Additionally, `resultProjection` at lines 203-205 omits `evidenceIds` and `semanticKey`, although both alter emitted Relevance reasons/content. Changing only evidence IDs yielded the same query result hash while closure evidence changed:

   ```text
   evidence refresh hashes true [ 'old' ] [ 'new' ]
   ```

   This does not satisfy query-program re-evaluation or closure-sensitive fingerprint fidelity. Supply/register a real deterministic query program, build its spec/fingerprint through the canonical registry, and include every field that changes edge membership, rank, requiredness, reasons, or unknowns.

4. **Planning Surprise can learn a relationship whose other endpoint is classified as agent overreach.** Endpoint validation at `packages/engine/src/relevance/index.ts:428-438` permits the other endpoint merely because it appears anywhere in `observedEntityIds`; proposal construction at lines 442-456 checks only that the proposal-owning row is `required`. A mixed observation where `needed` is legitimate but proposes `needed -> avatar`, while `avatar` is unexplained unauthorized overreach, reproduced:

   ```text
   agent-overreach [
     { entityId: 'avatar', classification: 'agent-overreach' },
     { entityId: 'needed', classification: 'legitimate-new-relationship' }
   ] [ 'needed->avatar' ]
   ```

   This violates the rule that overreach must not teach a false edge. Require both endpoints to be canonical/predicted or independently legitimate/authorized and evidence-backed; quarantine every proposal touching an overreach impact.

5. **Replace/delete tombstones can record the wrong hash dimension.** At `packages/engine/src/identity/index.ts:258-263`, `lastSemanticHash` selects the first value dependency with the same ID, regardless of dependency kind or role, and falls back to the first dependency globally. `validateCandidateValueDependencies` only proves that some separate `canonical-entity` dependency whose role contains `identity candidate` exists. With both a discovery-like same-ID dependency and the correct identity-candidate semantic dependency, the reproduction emitted `WRONG-DISCOVERY` as the tombstone's `lastSemanticHash`. Tombstone continuity requires the source entity's actual semantic hash, not an arbitrary same-ID or unrelated fallback. Select an explicit typed semantic dependency, reject ambiguity/missing hashes, and bind proposed replacement endpoints as appropriate.

6. **Topology observability and route identity still overclaim stability/negative space.** `compileEventContractTopology` at `packages/analyzers/src/topology/index.ts:134-153` defaults a route to `closed` whenever all individual links have exact assurance, even when no `EnumerationContract` was supplied. Exact evidence for observed links does not by itself prove exhaustive consumer enumeration. It also hashes `semanticKey` into the stable route ID, so changing a discovery/canonical key for the same stable subject changes route identity, contrary to the project's rule that keys/names do not replace stable entity identity. Default missing enumeration to `open` (or require an explicit proof-eligible enumeration contract for `closed`/`bounded`) and base stable route identity on the stable subject identity/kind while keeping mutable semantic observation in `contentHash`.

### Prior-finding disposition and Minors

- Fixed: wrong-kind/zero-evidence reuse, supported unreplaced-tombstone reuse, high-confidence active/historical overlap bypass, snapshot-coherent relevance discovery, deterministic within-call duplicate-edge and duplicate-identity handling, lineage/tombstone proposal presence and cardinality checks, basic topology-to-relevance composition, heuristic default `open`, assurance/evidence/participant-stable route IDs, possible-context rationale/uncertainty, required context budget signal, parser-visible Gherkin steps/source traces, per-impact classifications, preservation of a valid predicted-to-legitimate proposal beside unrelated overreach, malformed blank endpoints/evidence, and empty-surprise suppression.
- Fixed Minor: context reports `requiredBudgetOverrun`/`requiredExpansionIds`; relevance separates duplicate, below-threshold, budget-deferred, and frontier metrics.
- Remaining acceptance-coverage Minor: focused tests do not exercise canonical schema/hash/provenance validation at the creation gate, registry-backed identity/topology query replay, topology fingerprint changes from evidence/semantic-key refresh, an overreach endpoint in a mixed proposal, or competing same-ID value hash roles for tombstones. The claimed 22-scenario coverage remains stronger than the tests demonstrate.

### Verification evidence

- Focused Task 11 suites: 4 files, 45 tests passed.
- Full `pnpm verify`: 34 files, 411 tests passed; all workspace typechecks passed; package boundaries valid.
- Full `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 4e7d4ee..657f1c9`: passed.
- Worktree was clean before the requested report append. Source and tests were not modified; reproductions used built `dist` modules.

## Repair of independent re-review — round 2 — 2026-08-07

### Design

- Replaced caller-supplied creation authority/provenance with an asynchronous `TrustedIdentityCreationRepository` boundary. The gate loads the stored public resolution, canonical Authority Record envelope, and Evidence; parses every public schema; verifies canonical envelope, resolution content/ID, and `StateBinding` hashes; requires repository-verified adjudication provenance and a current binding validation; and checks direct resolution-support and normative approval claims.
- Registered six canonical identity boundary query programs. Resolution now requires a registry-compatible current-program verifier and request-bound normalized meaning/kind inputs. A discriminated outcome-fact contract plus supporting evidence is required, so the assessment enum alone cannot command lifecycle outcomes.
- Added engine-owned registered event/contract topology query factories and a binding port. The analyzer remains host-neutral, exports a complete closure-sensitive topology state projection, validates the injected canonical query spec/fingerprint, defaults to open without proof, and keeps route identity on stable subject ID/kind while semantic-key and evidence refreshes alter content/fingerprint hashes.
- Quarantined every relationship proposal touching an overreach endpoint. Tombstones now select exactly one typed identity-candidate semantic dependency, reject ambiguity, and require lineage target bindings.

### RED checkpoints

- `pnpm exec vitest run packages/analyzers/src/topology/topology.test.ts packages/engine/src/relevance/index.test.ts`: 4 expected failures — exact-only topology overclaimed `closed`, mutable semantic keys changed route IDs, evidence/key refreshes did not change the query result fingerprint, and a required-to-overreach proposal was emitted.
- `pnpm exec vitest run packages/engine/src/identity/index.test.ts`: 4 expected failures — fabricated caller provenance was accepted, unrelated self-consistent identity queries were accepted, assessment labels yielded incompatible outcomes, and a competing discovery hash became `lastSemanticHash`.
- `pnpm exec vitest run packages/engine/src/query/query.test.ts -t "registered topology"`: expected failure because no registered topology query factory existed.
- `pnpm exec vitest run packages/engine/src/identity/index.test.ts -t "self-rehashed|directly applicable"`: 2 expected failures — a self-rehashed forged binding was accepted and irrelevant trusted evidence was accepted.
- `pnpm exec vitest run packages/analyzers/src/topology/topology.test.ts -t "unrelated or noncanonical"`: expected failure because an unrelated injected query program was accepted.
- `pnpm exec vitest run packages/analyzers/src/topology/topology.test.ts -t "exhaustive proof"`: expected failure because a bare `closed` label without a proof method was accepted.

### GREEN and verification

- Focused identity/query/topology/relevance suites: 4 files, 65 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 424 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 657f1c9..2054716`: passed.
- Definitive repair commit: `2054716400f7471d492435ed3b42fad2945f1a00` (`fix(engine): enforce trusted identity adjudication`).
- Repair base: `657f1c990145e1fd32f643e4679e6592cc911836`.
- Worktree clean after commit; this is the frozen repair head and no follow-up commit was made.

---

## Independent re-review of round-2 repair — 2026-08-07

### Verdict: FAIL

Commit `2054716` is not ready to merge over `657f1c9`. The focused and full suites, all workspace typechecks, build, and package-boundary check pass. The patch fixes the prior topology observability/route-identity/fingerprint defects, overreach proposal leakage, tombstone hash-role ambiguity, request-bound query-spec registration, and canonical Authority Record envelope verification. However, the canonical-creation authority chain still accepts Evidence without hash integrity, and three Important identity/query/StateBinding defects remain. Under the requested rule, any remaining Critical or Important finding is a failing verdict.

### Critical finding

1. **The trusted creation gate does not authenticate the Evidence records whose claims authorize canonical creation.** `assertCanonicalCreationAllowed` schema-parses repository-loaded Evidence at `packages/engine/src/identity/index.ts:418-430` and `443-453`, but it never validates `Evidence.contentHash`, loads an evidence envelope, or calls a repository integrity primitive that binds the loaded claims to that hash. The Authority Record envelope itself is correctly schema- and hash-verified, but its decisive evidence references resolve to unhashed plain Evidence objects. A runtime adversary supplied two schema-valid Evidence records (resolution support and binding approval) with different claim-bearing payloads but the same arbitrary content hash unrelated to either loaded record; the gate accepted canonical creation:

   ```text
   accepted evidence with unverified shared contentHash sha256:v1:2ca05b9449f20997b750bcf470859ddad342e97e0622e5ff7af1f08c04d927ff
   ```

   This leaves repository substitution/replay at the decisive authority seam undetectable: a claim can be changed while preserving the declared hash. Schema validity and a trusted lookup port do not establish content integrity. Remedy: load Evidence through a canonical/hash-verified envelope or require an authoritative verification result that binds evidence ID, complete claim-bearing semantic projection, and content hash; reject any mismatch before evaluating applicability, reliability, or normative authority.

### Important findings

1. **The six registered identity boundary programs are names for one semantic-identity text search, not faithful evaluators for their declared lanes.** `identityBoundaryProgram` at `packages/engine/src/query/index.ts:359-379` implements exact search, alias search, lineage, tombstone, relation neighborhood, and topology by calling the same `graph.searchSemanticIdentities` operation and returning only entity IDs. `GraphReader` does not expose lineage or tombstone reads, and the relation/topology programs do not inspect relations or topology. Runtime replay produced the same result hash for all six programs; after adding a new Relation, `identity.relations` remained unchanged:

   ```text
   identity.exact-search   17b3a6e2... 1
   identity.alias-search   17b3a6e2... 1
   identity.lineage        17b3a6e2... 1
   identity.tombstone      17b3a6e2... 1
   identity.relations      17b3a6e2... 1
   identity.topology       17b3a6e2... 1
   relation-addition-stales? false
   ```

   Their dependency keys (`identity.<lane>:<kind>`) are also disconnected from the graph facts they purport to observe, so changed-key optimization can skip replay even before the inadequate evaluator runs. This does not establish dependency-complete lineage/tombstone/relation/topology negative space, and newly relevant historical or relational state can leave a creation resolution current. Implement lane-specific host-neutral read ports/programs and closure-sensitive result projections/dependency keys, or replace the six claims with one honestly scoped search dependency plus real dependencies for every additional lane.

2. **Outcome-specific “evidence” remains caller assertions; the same underlying evidence still selects incompatible lifecycle outcomes.** `hasOutcomeEvidence` at `packages/engine/src/identity/index.ts:168-182` checks a caller-provided discriminant and trivial boolean/string fields, then proves only that their IDs occur in generic supporting `EvidenceRef`s. It does not load or validate Evidence claims for the outcome facts, and `outcomeEvidence` is omitted from the public resolution/content hash. With the same candidate, scores, StateBinding, one EvidenceRef (`same-proof`), and the same rationale, changing only the outcome discriminant plus its required assertion produced:

   ```text
   same    => reuse-existing [ 'source' ]
   split   => split-existing [ 'source' ]
   replace => replace-existing [ 'source' ]
   delete  => no-durable-entity [ 'source' ]
   ```

   Thus the enum is no longer sufficient alone, but it still commands the outcome when accompanied by an unverified self-assertion backed by the same unrelated evidence reference. Bind each outcome to typed, repository-loaded applicable Evidence claims (including partition/target/cessation facts), persist/hash those adjudication facts or an opaque adjudication handle, and reject mutually incompatible facts for the same evidence basis.

3. **The creation gate mishandles dependency-local changed-state validation.** At `packages/engine/src/identity/index.ts:407-410`, the gate accepts only `status: "current"` with `currentState` byte-equal to the old `compiledAgainst` snapshot. A correct `DependencyScopedStateBindingValidator` returns `status: "rebound"` when the global snapshot changed but all bound values and query fingerprints remain current (`packages/engine/src/state/index.ts:315-327`). The gate therefore converts every unrelated snapshot change into mandatory identity re-adjudication, contrary to the normative rule that a global digest mismatch must not automatically invalidate local work. Conversely, it does not require `changedValueDependencyIds` and `changedQueryDependencyIds` to be empty for a purported `current` result. Accept and consume a schema-valid `rebound` binding (and bind the mutation receipt to it), or explicitly re-store a content-addressed rebound resolution; reject internally inconsistent validation results.

### Prior-finding disposition

- Fixed: canonical Authority Record envelope schema/semantic/document-hash checks; stored resolution schema/content-hash/ID and StateBinding digest checks; request/kind-bound normalized query specs and current-program assertion; exact observed topology defaults to open; closed/bounded proof-contract guards; stable route ID excludes mutable `semanticKey`; semantic-key/evidence/enumeration/link data changes topology content and query fingerprints; topology query program/binding port remains host-neutral across analyzer/engine; overreach endpoints quarantine proposals; tombstones require exactly one explicit semantic candidate hash and replacement target bindings.
- Not fixed: actual lineage/tombstone/relation/topology identity-query replay, evidence-backed outcome adjudication, and end-to-end Evidence hash integrity at the canonical-creation gate.
- New Important: valid dependency-local `rebound` state is refused, recreating global invalidation for canonical creation.
- No additional Critical/Important defect was found in deterministic topology ordering, route stability, topology closure-sensitive projection, Planning Surprise quarantine, or tombstone target ordering during this round.

### Verification evidence

- Focused identity/query/topology/relevance suites: 4 files, 66 tests passed.
- Full `pnpm verify`: 34 files, 424 tests passed; all workspace typechecks passed; package boundaries valid.
- Full `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 657f1c9..2054716`: passed.
- Runtime adversaries used the built `dist` output from frozen commit `2054716`. Source and tests were not modified during review; only this requested report was appended.

---

## Repair of independent re-review — round 3 — 2026-08-07

### Design

- Evidence integrity is now established before any claim, applicability, reliability, or normative-authority evaluation. The trusted repository returns schema-valid Evidence, and the engine recomputes a framed content hash over the complete Evidence projection except the declared hash itself. ID or content mismatch rejects repository substitution/replay. The creation gate also checks persisted adjudication claims against freshly loaded, hash-verified Evidence.
- The six identity boundary names are no longer generic `GraphReader` built-ins. `createIdentityBoundaryQueryPrograms` registers canonical v2 exact, alias, lineage, tombstone, relation, and topology specs against a host-authoritative lane port. Each lane supplies its own closure-sensitive projection, observability, assumptions, unavailable lanes, and dependency keys; an unregistered lane fails closed.
- Durable identity outcomes now use `resolveSemanticIdentityFromEvidence`, which asynchronously loads directly applicable, non-low/untrusted Evidence and derives typed equivalence, coordination, partition, convergence, supersession, cessation/no-durable-entity, distinct-boundary, or conflict facts. Direct caller booleans/discriminants cannot authorize an outcome. The selected facts, Evidence IDs, full claim refs, and claim hashes are persisted in a hash-bound adjudication extension; mutually inconsistent facts reject and an incompatible requested outcome resolves closed.
- Canonical creation accepts either an internally consistent `current` validation or a dependency-local `rebound`. A rebound must have empty changed dependency sets, a schema-valid/digest-valid rebound binding compiled against `currentState`, and the same dependency digest; the returned binding is the one the mutation must use. Stale/suspect/unavailable or inconsistent current/rebound results reject.

### RED checkpoints

- Focused identity/query RED: 6 failures / 43 tests. Missing lane-program factory, dishonest built-in lineage registration, unhashed Evidence substitution, missing trusted Evidence adjudication, direct caller outcome authority, and valid rebound refusal all failed for their intended reasons.
- Persisted-adjudication RED: a hash-consistent fabricated `create-new` resolution without adjudication facts was accepted; the gate now rejects it before authority use.

### GREEN and verification

- Focused identity/query suites: 2 files, 45 tests passed.
- Engine package: 15 files, 224 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 432 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check`: passed.
- Scope remained within `packages/engine/src/identity/**` and `packages/engine/src/query/**`; no shared/root barrel, analyzer, relevance, runtime, or canonical contract file changed.

### Design blockers

- None. GraphReader intentionally remains incapable of claiming lineage/tombstone/topology completeness; hosts that possess those authoritative facts must register the corresponding identity boundary programs.
- Definitive frozen commit: `4c5a0beb5c2ed860db1f6332c714c0c3f099d589` (`fix(engine): verify identity evidence and replay lanes`). The Task 11 worktree was clean after this single round-3 commit.

---

## Independent re-review of round-3 repair — 2026-08-08

### Verdict: FAIL

Commit `4c5a0be` is not ready to merge over `2054716`. The focused and full suites, all workspace typechecks, build, package-boundary check, and diff check pass. The patch fixes Evidence payload substitution, removes the dishonest generic identity-lane programs, persists hash-bound claim references, and correctly accepts a dependency-local rebound. However, three Important defects remain in claim applicability, lineage integrity, and the final Authority Record decision. Under the requested rule, any remaining Critical or Important finding is a failing verdict.

### Important findings

1. **Typed identity claims are not bound to the requested kind, the compared source identities, or the exact lifecycle operation they authorize.** `outcomeFactFromEvidence` at `packages/engine/src/identity/index.ts:230-289` considers a claim applicable when its `subjectKey` equals only the normalized request text or any candidate ID. It never binds a claim to `requestedKind`, a request identity/hash, a source-ID set, or the proposed lineage destinations. The partition/convergence/supersession payload parsers at lines 256-261 accept generic strings/arrays but never compare them with `proposedTargetIds`; source and target cardinality is checked later without evidence linkage at lines 397-415. Runtime adversaries reproduced all of the following:

   ```text
   cross-kind same Evidence claim: concept create-new | requirement create-new
   same convergence Evidence authorized: [ 'a', 'b' ] -> [ 'merged-ab' ] and [ 'c', 'd' ] -> [ 'merged-cd' ]
   split claim payload: ["authorized-A","authorized-B"]
   split proposed targets: [ 'evil-a', 'evil-b' ] [ 'other-a', 'other-b' ]
   ```

   Conflicting facts are also modeled incorrectly. Lines 249-270 reject only when more than one *outcome kind* is present, while multiple incompatible claims of the same predicate silently select the first payload. A record containing two different `identity-partition` arrays was accepted as `split-existing`, and both contradictory claim refs were persisted. Conversely, different outcome predicates about different applicable candidate subjects are treated as one global conflict. Remedy: define a typed claim object that binds normalized requested meaning plus requested kind, exact ordered/set-normalized source IDs, operation kind, and exact split/merge/replace destination IDs/meanings; enforce claim-specific cardinality/uniqueness and detect conflicts per subject and operation rather than per Evidence bundle.

2. **Lineage/tombstone destinations are outside the resolution and adjudication hashes, and delete can emit schema-invalid replacement continuity.** `proposedTargetIds` drives proposals at `packages/engine/src/identity/index.ts:397-434`, but neither it nor `lineageProposals`/`tombstoneProposals` is included in the semantic resolution basis at lines 435-467. Two split resolutions using the same evidence and binding but different target pairs therefore produced identical resolution IDs, resolution content hashes, and adjudication content hashes while proposing different lineage:

   ```text
   split resolution identity/hash equal despite targets? true true true
   ```

   The delete validation at lines 403-415 also never requires an empty target set. A verified cessation claim plus `proposedTargetIds: ["illegal-successor"]` emitted both delete `toIds` and tombstone `replacementIds` containing that successor, contrary to `validateLineage` and `LineageRecordSchema` (`packages/core/src/identity/identity.ts:76-77`; `packages/core/src/schemas/generated-contracts.ts:189`). Runtime output:

   ```text
   delete accepted nonempty toIds: [ 'illegal-successor' ] tombstone replacements: [ 'illegal-successor' ]
   ```

   This allows one hash-bound adjudication/resolution identity to be replayed with materially different split/merge/replace continuity and permits a delete operation that is semantically a replacement. Remedy: include the normalized lineage/tombstone operation, exact source and destination IDs, and operation-specific fact payload in the adjudication and resolution semantic hashes; validate every proposal through the canonical lineage/tombstone schemas; require delete destinations/replacements to be empty.

3. **The canonical-creation gate ignores the Authority Record's normative conclusion.** At `packages/engine/src/identity/index.ts:640-661`, the gate verifies the canonical envelope, approved status, user/policy decider, subject, rationale, and supporting authoritative Evidence, but never checks `authority.conclusion`. A canonical, hash-valid, user-approved Authority Record with `conclusion: "unknown"` and rationale `decision remains unknown` was accepted for canonical creation when its supporting Evidence contained `canonical-creation-approved: true`:

   ```text
   approved AuthorityRecord with conclusion=unknown accepted: true
   ```

   Evidence is support for a normative selection; it must not silently override the Authority Record's actual selection. Accepting an explicitly unknown (and likewise potentially preservation-oriented) conclusion collapses the required descriptive-inference/normative-selection boundary. Remedy: define the conclusion(s) that authorize creation and reject `unknown` or conflicting conclusions regardless of an Evidence claim; ideally use an explicit typed creation decision rather than overloading generic `normalize`/`migrate` conclusions.

### Prior-finding disposition and additional audit

- Fixed Critical: repository-loaded Evidence is schema-parsed and its complete JSON claim-bearing projection is recomputed before use; declared-hash substitution is rejected.
- Fixed Important: the six identity lane IDs are no longer aliases for generic text search. They are version-2 host-registered programs with canonical normalized request inputs, lane-specific host projections, observability, assumptions, unavailable lanes, and dependency keys. No generic fake lineage/tombstone/relation/topology evaluator remains.
- Fixed Important: direct caller outcome booleans/discriminants are not trusted; the selected Evidence claim refs and claim hashes are persisted and covered by the adjudication/resolution hash.
- Fixed Important: internally consistent dependency-local `rebound` validation is accepted and returned as the mutation binding; inconsistent current/rebound results and changed dependency sets are rejected.
- No additional Critical/Important defect was found in Evidence canonicalization, query program ID/version/request-input currency, lane result canonicalization, creation-resolution/Authority-envelope hash verification, or rebound dependency-digest/current-state checks beyond the findings above.
- Remaining coverage gap: the committed tests do not exercise cross-kind/cross-source claim replay, exact target/payload binding, conflicting same-predicate facts, target-sensitive resolution identity, delete-with-destination rejection, or an approved Authority Record whose conclusion is `unknown`.

### Verification evidence

- Focused identity/query suites: 2 files, 45 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 432 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `git diff --check 2054716 4c5a0be`: passed.
- Frozen head confirmed as `4c5a0beb5c2ed860db1f6332c714c0c3f099d589`; Task 11 worktree remained clean after verification.
- Runtime adversaries used the built `dist` modules from the frozen commit. Source and tests were not modified; only this requested report was appended.

---

## Repair of independent re-review — round 4 — 2026-08-08

### Design

- Identity Evidence now uses a strict versioned fact payload bound to a deterministic request identity, normalized requested meaning, requested kind, operation, exact set-normalized source IDs, and exact destination IDs. Equivalence, coordination, partition, convergence, supersession, cessation/no-durable-entity, distinct-boundary, and conflict facts each carry an operation-specific payload. Cross-kind/request facts fail closed; cross-source or cross-target facts reject as incompatible.
- Conflict evaluation is limited to the requested subject and operation. Multiple incompatible payloads for the same applicable predicate reject, while facts for a different request do not poison the current adjudication. Only the exact contributing Evidence IDs, claim refs, claim hashes, and fact payloads are persisted.
- Adjudication and resolution hash bases now include the exact operation, source IDs, proposed target IDs, fact payloads, lineage proposals, and tombstone proposals. Different split/merge/replace targets therefore produce different adjudication hashes, resolution content hashes, and resolution IDs.
- Raw proposed targets must be nonblank and unique. Every generated lineage proposal is checked with `validateLineage` and `LineageRecordSchema`; every generated tombstone proposal is checked with `TombstoneSchema`. Delete requires empty destinations and replacement IDs, while replace remains an explicit replace outcome with replacement continuity.
- Canonical create-new authorization now requires an approved/auto-approved user or policy Authority Record whose explicit normative conclusion is `normalize`. `unknown`, `preserve`, `migrate`, and `exception` do not authorize creation, regardless of supportive Evidence. Conflicting creation-approval claim values also reject.

### RED checkpoints

- Typed-claim/continuity RED: the focused identity suite failed after adding exact typed fixtures and adversaries. The intended failures demonstrated acceptance of incompatible same-predicate partitions, cross-source replay, and split/merge/replace claims whose payload named different targets.
- Hash/lineage RED: two splits with different target pairs retained the same resolution ID, resolution content hash, and adjudication content hash. Duplicate split targets were silently set-normalized, and delete accepted a successor target/replacement.
- Authority RED: a canonical hash-valid, user-approved Authority Record with `conclusion: "unknown"` passed the create-new gate.

### GREEN and verification

- Focused identity suite: 35 tests passed.
- Engine package: 15 files, 230 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 437 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check` and `git diff --cached --check`: passed.
- Scope remained within `packages/engine/src/identity/**`; no query/core schema, shared/root barrel, runtime, CLI, DAG, analyzer, relevance, or context file changed.

### Frozen head

- Repair base: `4c5a0beb5c2ed860db1f6332c714c0c3f099d589`.
- Definitive single repair commit: `944b5f841f4bfec162453dcc2169eeb791107d01` (`fix(engine): bind identity claims and continuity`).
- Task 11 worktree clean after commit; no follow-up commit was made.

---

## Independent re-review of round-4 repair — 2026-08-08

### Verdict: FAIL

Commit `944b5f8` is not ready to merge over `4c5a0be`. The patch directly fixes the three round-3 findings: typed claims now compare request/kind/operation/source/target payloads, continuity and proposal material participates in the resolution/adjudication hashes with delete destinations refused, and canonical creation requires an approved user/policy Authority Record whose explicit conclusion is `normalize`. Focused and full gates pass. However, three Important defects remain in exact outcome-target binding, the public serialized contract, and normalized identity determinism. Under the requested rule, any remaining Critical or Important finding is a failing verdict.

### Important findings

1. **A verified same/overlap claim can name targets that the resolution does not select.** `outcomeFactFromEvidence` computes claim `targetIds` from `activeTargets(input.records)` at `packages/engine/src/identity/index.ts:250-255`, before candidate kind/score/evidence eligibility is applied. The actual decision filters records through `supportsRequestedIdentity` and computes a second target set at lines 351-352, returning only that set at line 398. A runtime adversary supplied one supported candidate (`good`, score `0.95`) and one ineligible candidate (`weak`, score `0.1`) plus a hash-valid typed same claim whose exact payload named both input targets. The resolver accepted it as `reuse-existing`, selected only `good`, and persisted a fact payload whose `targetIds` remained `["good", "weak"]`:

   ```text
   outcome: reuse-existing
   selectedEntityIds: ["good"]
   adjudication fact targetIds: ["good", "weak"]
   ```

   Thus the new exact-target claim is not exact for the operation it authorizes. The same split between raw records and supported records also affects overlap. Derive one normalized operation endpoint set after eligibility/lifecycle resolution and use it consistently for expected claims, selected identities, adjudication, and continuity; alternatively reject any claim whose target set contains an ineligible/unselected endpoint.

2. **The new persisted resolution shape has no public schema and is rejected by the canonical resolution schema.** The exported `AdjudicatedSemanticIdentityResolution` adds `operation`, `proposedTargetIds`, `adjudication`, `lineageProposals`, and `tombstoneProposals` at `packages/engine/src/identity/index.ts:116-139`, and every resolver result includes those fields at lines 510-518. No corresponding Zod schema was added. `SemanticIdentityResolutionSchema` is strict, so a runtime `safeParse` of an actual trusted result failed with:

   ```text
   Unrecognized keys: "operation", "proposedTargetIds", "adjudication", "lineageProposals", "tombstoneProposals"
   ```

   The creation gate works around this at lines 590-600 by manually stripping all extension fields before parsing the core schema. That does not satisfy the normative rule that every public serialized contract has a schema, and it means a consumer cannot schema-validate/persist the complete hash-bound object that the gate later requires. Define and export a strict schema for the adjudicated resolution and its nested adjudication/proposal contracts (or move these fields into a schema-defined canonical contract) and parse the complete stored object through it.

3. **Semantically identical normalized distinct boundaries produce different adjudication hashes and resolution IDs.** The returned semantic boundary sorts/deduplicates `owns`, `excludes`, and `nearestEntityIds` at `packages/engine/src/identity/index.ts:473-478`, but the typed distinct fact embeds `input.newBoundary` without normalization at line 273. Because the raw fact payload is persisted and hashed at lines 486-508, reversing only the order of the boundary set members produced equal normalized `newBoundary` values but different adjudication hashes and resolution IDs:

   ```text
   same normalized boundary: true
   same adjudication hash: false
   same resolution ID: false
   ```

   This is a noncyclic identity/order regression introduced by binding the raw operation-specific payload. Normalize the boundary once before both claim comparison and semantic construction; validate uniqueness/blank members at that same boundary.

### Prior-finding disposition and additional audit

- Fixed: cross-kind/request/source/target replay of a single incompatible typed claim fails closed or rejects; incompatible same-predicate payloads reject; facts scoped to another request no longer create a global false conflict.
- Fixed: split/merge/replace target cardinality and duplicate raw target IDs are checked; different target sets change adjudication/resolution hashes and IDs; generated lineage is passed through `validateLineage` and `LineageRecordSchema`; generated tombstones are checked with `TombstoneSchema`; delete rejects successors/replacements.
- Fixed: claim-reference ordering is canonicalized before adjudication hashing, and request-ID derivation is noncircular (meaning/kind derive the request subject; operation/endpoints remain in the fact payload).
- Fixed: canonical creation rejects `unknown`, `preserve`, `migrate`, and `exception` conclusions despite supportive Evidence; only explicit `normalize` on an approved/auto-approved user/policy record authorizes this create-new gate.
- No additional Critical/Important defect was found in cross-operation single-claim replay, delete tombstone continuity, replace target ordering, proposal hash sensitivity, Authority evidence hash verification, or dependency-local rebound handling beyond the findings above.
- Remaining coverage gaps: committed tests do not compare typed claim targets with the post-eligibility selected target set, validate the complete returned adjudicated object against a public schema, or check distinct-boundary set-order invariance.

### Verification evidence

- Focused identity suite: 35 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 437 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- `git diff --check 4c5a0be..944b5f8`: passed.
- Frozen head confirmed as `944b5f841f4bfec162453dcc2169eeb791107d01` before the requested report append. Source and tests were not modified; runtime adversaries used freshly built `dist` modules. Only this requested report was appended.

---

## Repair of independent re-review — round 5 — 2026-08-08

### Design

- Same/overlap evidence comparison, adjudication, and decision now share one post-normalization eligibility endpoint calculation. Low-score, wrong-kind, evidence-free, and unsupported lifecycle observations remain inspectable candidates but cannot enter the operation source/target fact set. Exact typed fact targets are also schema-constrained to equal the persisted selected entity IDs.
- The engine now exports an explicit version-1 strict Zod persistence/API contract for the complete `AdjudicatedSemanticIdentityResolution`, including typed operation fact variants, verified claim refs, adjudication, lineage proposals, tombstone proposals, operation/target fields, and all core resolution fields. The creation gate parses the complete stored object through that schema and then independently recomputes adjudication, resolution, binding, and ID hashes; it no longer strips engine extension fields before schema validation.
- Boundary ownership, exclusion, and nearest-entity sets are NFKC-normalized, trimmed, deduplicated, sorted, and validated once before trusted claim comparison or semantic construction. Blank members, invalid entity IDs, blank rationale, and normalized owns/excludes overlap reject. Equivalent reordered/duplicated boundaries now yield byte-identical facts, adjudications, resolution hashes, and IDs.

### RED checkpoints

- Focused identity RED: 3 failures / 38 tests. A same claim naming one supported target plus a `0.1` weak target was accepted, the complete schema export was absent, and reordered equivalent distinct boundaries changed adjudication and resolution identity.
- The same/overlap adversary was frozen to exercise both operations: overbroad facts reject while exact facts select and persist only the supported endpoint.

### GREEN and verification

- Focused identity suite: 38 tests passed.
- Full engine package: 15 files, 233 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 440 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 944b5f8`: passed.
- Scope stayed in the engine identity module/tests plus the engine-local Zod dependency declaration and lockfile; no core generated schema, shared barrel, analyzer, runtime, or canonical DTO changed.
- Definitive frozen commit: `9d4c5235d686435977b2226bd5782af043f6db0e` (`fix(engine): freeze identity resolution contract`). The Task 11 worktree was clean after this single round-5 commit; no follow-up commit was made.

---

## Independent re-review of round-5 repair — 2026-08-08

### Verdict: FAIL

Commit `9d4c523` is not ready to merge over `944b5f8`. The patch fixes the three round-4 findings in the resolver path: same/overlap claims now use the post-eligibility operation endpoints, actual complete results round-trip through an exported strict version-1 schema, the creation gate parses the full stored object, and distinct-boundary input is normalized before claim construction and hashing. Focused and full gates pass. However, the new public schema does not enforce the semantic relationships among outcome, operation, typed facts, proposals, and boundaries, and the canonical-creation gate accepts a fully hash-consistent impossible object. Two Important defects remain, so the requested PASS condition is not met.

### Important findings

1. **The versioned adjudicated schema accepts impossible operation/fact/proposal combinations, and the creation gate authenticates rather than rejects them.** `IdentityAdjudicationSchema` at `packages/engine/src/identity/index.ts:103-129` proves only `kind === operation` plus ordering of four arrays. It does not require each fact/claim object's `operation`, request identity, source/target endpoints, or predicate to match the adjudication; it does not require operation-specific fact cardinality; and it does not restrict lineage/tombstone proposal kinds and endpoints to the operation/outcome. The outer refinement at lines 151-168 checks extension continuity and same/overlap target equality only when the *outer* operation is same/overlap. `parseIdentityAdjudication` at lines 775-823 verifies claim hashes, fact equality to claims, generic proposal validity, and the adjudication hash, but restores none of those semantic relationships. The creation gate then requires only `outcome === "create-new"` and `adjudication.kind === "distinct"` at lines 877-881. A runtime adversary built a complete schema-valid, adjudication-hash-valid, resolution-hash/ID-valid object with `outcome/operation/kind = create-new/distinct/distinct`, but its only persisted fact and Evidence claim were `operation: "same"` / `identity-equivalent`, and it carried a valid `kind: "split"` lineage proposal. With hash-valid Evidence, a canonical hash-valid normalize Authority Record, current binding, and the repository adjudication verifier returning true, `assertCanonicalCreationAllowed` accepted it. This makes the advertised strict persistence contract unable to distinguish resolver output from impossible lifecycle/provenance combinations. Encode the operation/outcome discriminant matrix in the schema and gate: bind every fact/claim predicate and endpoint set to the request/adjudication, require exact operation-specific fact sets/cardinalities, require exact allowed proposal shapes (none for distinct/same/overlap/ambiguous; matching lineage and tombstones for lifecycle operations), and verify proposal IDs/bases.

2. **Boundary normalization/validation exists only on live resolver input; the exported schema and creation gate accept malformed persisted boundaries.** `normalizeBoundary` at `packages/engine/src/identity/index.ts:495-511` correctly NFKC-normalizes, trims, deduplicates, sorts, rejects blanks/overlap, and validates nearest IDs before resolver facts/hashes. But `AdjudicatedSemanticIdentityResolutionSchema` uses the permissive core `NewSemanticBoundarySchema` directly at line 140, and the distinct fact variant does the same at line 61. Neither local schema refinement requires normalized/sorted/unique nonblank members, disjoint owns/excludes, nonblank normalized rationale, or equality between the resolution boundary and the distinct fact boundary. At the mutation boundary, `validBoundary` only tests that each main list has *some* nonblank member and the rationale is nonblank; the gate calls that weak check at line 883. The same runtime adversary was accepted with `newBoundary = { owns: [" x ", ""], excludes: ["x"], nearestEntityIds: [], rationale: " r " }`: it contains a blank member, is not normalized, and owns/excludes overlap after normalization. Therefore the claimed normalize-once invariant is not preserved across serialization/reload, and a self-consistently rehashed repository object can bypass the resolver normalization. Export/use a refined normalized-boundary schema for both resolution and distinct facts, require byte equality between them, and apply the same invariant at the creation gate before hash/provenance acceptance.

### Prior-finding disposition and additional audit

- Fixed in resolver output: one post-eligibility endpoint calculation feeds same/overlap expected claims and selected identities; weak and wrong-kind candidate records do not enter those persisted endpoint sets.
- Fixed for structural round-trip: the engine exports strict schemas for the complete version-1 result, nested typed facts/claim refs/adjudication/lineage/tombstones; actual JSON-round-tripped results validate, nested extras and structurally malformed facts reject, and the gate parses the full object without stripping extensions.
- Fixed for live inputs: equivalent reordered/duplicated distinct-boundary sets normalize before facts, adjudication hashes, resolution hashes, and IDs; blank members, invalid nearest IDs, and normalized owns/excludes overlap reject during resolution.
- `contractVersion: 1` participates in the resolution hash because it is part of `semantic`; deterministic candidate/boundary ordering and Zod dependency/lock/package-boundary wiring showed no additional Critical/Important defect.
- The core `SemanticIdentityResolutionSchema` remains intentionally strict and does not accept the versioned engine extension, but the new exported versioned schema provides the complete engine contract; no separate compatibility finding is raised.

### Verification evidence

- Focused identity suite: 38 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 440 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 944b5f8..9d4c523`: passed; frozen head confirmed as `9d4c5235d686435977b2226bd5782af043f6db0e`.
- Two read-only runtime adversaries used freshly built `dist` modules: the public schema returned success for the impossible/malformed complete object, and the creation gate accepted its fully recomputed adjudication hash, resolution hash/ID, Evidence hashes, Authority envelope, and current StateBinding. Source and tests were not modified; only this requested report was appended.

---

## Repair of independent re-review — round 6 — 2026-08-08

### Semantic persistence contract

- The complete version-1 adjudicated resolution schema now shares one cross-field semantic invariant validator across persisted parsing, resolver output, and the canonical-creation gate. It binds outer operation/outcome, adjudication kind/operation, request identity/kind/meaning, exact typed facts, allowed claim predicates, evidence endpoints, selected/proposed IDs, lineage, tombstones, and proposal basis IDs into one coherent lifecycle operation.
- The operation matrix is explicit: same/equivalence and overlap/coordination have exact selected targets and no continuity proposals; split is one-to-many with split lineage; merge is many-to-one with merge lineage; replace is exactly one-to-one with replace lineage and a source tombstone; delete is one-to-none with delete lineage and an empty-replacement tombstone; distinct/create-new has exactly its distinct-boundary fact and no continuity proposals; unresolved/conflict cannot authorize selected/proposed targets, lineage, or tombstones.
- Lineage state digests must equal the resolution's canonical state digest. Replace/delete tombstone entity, replacements, reason, last semantic hash, and deterministic ID must match the exact source value dependency and lineage. Resolver results are parsed through the complete schema before return, and the creation gate parses/refines the full stored result before provenance, binding, or hash trust decisions.
- A refined normalize-once boundary schema is used by both the outer resolution and distinct facts. Owns, excludes, and nearest arrays must be NFKC-normalized, trimmed, nonblank-member, sorted, and unique; owns/excludes are disjoint; rationale is normalized, trimmed, and nonblank; the fact boundary must exactly equal the outer boundary. Resolver input normalization remains order/duplicate invariant and emits only the refined persisted shape.
- Unresolved non-conflict attempts no longer persist authorizing adjudication or proposed targets. Replace continuity is narrowed to the canonical one-source/one-target contract.

### Exact TDD checkpoints

- RED: focused identity suite ran 40 tests with exactly 2 failures and 38 passes. A fully rehashed `create-new`/`distinct` object carrying an `identity-equivalent` same fact plus a valid split lineage proposal was schema-accepted. A fully rehashed create-new object whose outer and fact boundary contained whitespace, a blank member, normalized owns/excludes overlap, and untrimmed rationale was also schema-accepted.
- GREEN: both adversaries are rejected by `AdjudicatedSemanticIdentityResolutionSchema.safeParse` and by `assertCanonicalCreationAllowed` before trusted provenance. An actual trusted create-new result JSON-round-trips through the schema and passes the creation gate. Focused identity suite: 40/40 passing. Engine suite: 15 files, 235/235 passing.

### Verification

- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 442 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check`: passed. Scope remained only `packages/engine/src/identity/index.ts` and `packages/engine/src/identity/index.test.ts`; no core schema, query, analyzer, runtime, CLI, barrel, or unrelated task file changed.
- Definitive frozen commit: `902848d85efbb5b44fddf6bc240eba481d3c93e9` (`fix(engine): enforce identity operation coherence`). The Task 11 worktree was clean after this single round-6 commit; no follow-up commit was made.

---

## Independent re-review of round-6 repair — 2026-08-08

### Verdict: FAIL

Commit `902848d` is not ready to merge over `9d4c523`. The round-6 patch fixes both round-5 reproductions: mixed operation/fact/predicate/proposal objects and malformed persisted boundaries now fail the complete schema before the creation gate, authentic resolver outputs for the exercised outcomes parse, and the intended create-new gate succeeds. Focused and full gates pass. However, two Important semantic gaps remain in the advertised complete persistence contract, including a fully hash-valid duplicate-creation object that the mutation gate accepts.

### Important findings

1. **Persisted candidates are not bound to adjudication sources, so a fully rehashed create-new object can still mint a duplicate canonical identity.** `reportResolutionSemanticIssues` at `packages/engine/src/identity/index.ts:485-579` binds outcome, outer IDs, facts, proposals, boundary, and state, but never relates `resolution.candidates` to `adjudication.sourceIds` or re-applies the existing eligible-candidate predicate used by the live resolver. The create-new branch at lines 557-562 therefore accepts `sourceIds: []` solely because the forged distinct fact repeats that empty set, even when `candidates` contains an exact-kind, supported, explained candidate with `similarity/ownershipFit/boundaryFit = 0.99`. The creation gate at lines 1130-1205 parses and rehashes that same internally incomplete relationship but never rechecks duplicate eligibility. Exact runtime adversary: a complete `contractVersion: 1`, `outcome: "create-new"`, `operation/kind/fact: "distinct"` object retained a candidate `{ entityId: "existing", entityKind: "concept", similarity: 0.99, ownershipFit: 0.99, boundaryFit: 0.99, supporting evidence, nonblank explanation }`, while its fact/adjudication sources were empty. After recomputing adjudication hash, resolution hash/ID, Evidence hashes, and providing a valid approved user Authority envelope, current binding validation, and `verifyAdjudication: true`, `AdjudicatedSemanticIdentityResolutionSchema.safeParse` returned `true` and `assertCanonicalCreationAllowed` resolved successfully. This reopens canonical duplicate creation at the stored-object trust boundary. Bind adjudication source/selected endpoint sets to the persisted candidate projection (including the same eligibility semantics needed for creation), and have the gate reject any create-new object whose persisted/search-bound candidates still establish an existing or historical owner.

2. **Lifecycle endpoint equality does not require source/destination disjointness, so the schema accepts fully hash-valid self-replacement and analogous split/merge cycles that the live resolver rejects.** The operation cases at `packages/engine/src/identity/index.ts:430-453` enforce cardinality and equality among fact, adjudication, and lineage arrays, but `exactLineage` at lines 397-408 delegates only to proposal shape/ID checks. Core `validateLineage` checks cardinality and per-array uniqueness, not intersection between `fromIds` and `toIds`. A complete, fully rehashed `replace-existing` object with source/selected `a`, proposed target `a`, supersession `a -> [a]`, replace lineage `a -> [a]`, and matching tombstone replacement `[a]` was accepted by `AdjudicatedSemanticIdentityResolutionSchema` with no issues. The live resolver explicitly rejects this at its continuity guard, so persisted parsing is weaker than production construction. Require disjoint source/destination sets for split, merge, and replace in the shared semantic validator (and retain delete's empty destination contract); this closes the same gap for split `[a] -> [a,b]` and merge `[a,b] -> [a]`.

### Prior-finding disposition and additional audit

- Fixed: outer outcome/operation, adjudication kind/operation, exact operation predicates and fact variants/cardinalities, request ID/meaning/kind, selected/proposed IDs, lineage kind/endpoints, tombstone fields/IDs, claim payloads/evidence endpoints, lineage state digest, and boundary equality are now cross-checked.
- Fixed: canonical persisted boundary arrays are NFKC-normalized, trimmed, nonblank-member, sorted, unique, and owns/excludes-disjoint; rationale is normalized/trimmed/nonblank; fact and outer boundaries must be byte-equal.
- Fixed: the original fully rehashed create-new/same/split adversary and malformed-boundary adversary fail both schema and gate. Mixed operation variants and unresolved authorizing target/proposal combinations are rejected by the matrix.
- Positive path: the focused suite exercises schema-parsed same, overlap, split, merge, replace, delete, distinct/create-new, ambiguous/unresolved, and no-durable resolver behavior; the intended trusted create-new result still JSON-round-trips and passes the gate.
- No additional Critical/Important issue was found in claim hash/adjudication hash versus resolution hash verification order, tombstone last-semantic-hash binding, contract version hashing, deterministic sorting, package boundaries, or the exercised rebound/current binding paths.

### Verification evidence

- Focused identity suite: 40/40 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 442/442 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`: passed (`Package dependency boundaries valid`).
- `git diff --check 9d4c523..902848d`: passed; head confirmed as `902848d85efbb5b44fddf6bc240eba481d3c93e9`.
- Two read-only built-output adversaries were executed without changing source/tests: the duplicate create-new object was accepted by both schema and gate, and the self-replace object was accepted by the schema. Only this requested report was appended.

---

## Repair of independent re-review — round 7 — 2026-08-08

### Shared candidate and continuity invariant

- The complete version-1 resolution now persists canonical `candidateRecords` containing the candidate, lifecycle, and replacement endpoints. The legacy/core `candidates` projection must exactly equal those records, so score-only candidates cannot drift from lifecycle adjudication after serialization.
- One candidate analysis now drives repository Evidence claim endpoints, resolver decisions, complete-schema refinement, and the canonical-creation gate. It applies requested-kind matching, the existing similarity/ownership/boundary/evidence/explanation support thresholds, lifecycle replacement resolution, and conservative exact-kind historical blockers.
- Supported active/deprecated candidates resolve to their own IDs; supported superseded/tombstoned candidates resolve through their replacement IDs. Exact-kind superseded or tombstoned records with no replacement remain unresolved historical duplicate blockers even if their scores or supporting evidence have decayed below overlap thresholds.
- Persisted adjudication sources must exactly equal the lifecycle-resolved eligible endpoints. Same/overlap selected IDs, lifecycle selected/source IDs, operation facts, distinct empty endpoints, normalized distinct boundary, lineage, and tombstones are all checked against that same analysis. Create-new fails both complete schema parsing and the explicit mutation gate when any supported overlap, unresolved historical blocker, or unresolved candidate-search result remains.
- Lineage schemas now enforce operation-local cardinality and source/target disjointness: split is one-to-many, merge many-to-one, replace one-to-one, and delete one-to-none. Tombstone replacements cannot contain the deleted entity, candidate replacement continuity cannot self-reference, and active/deprecated candidates cannot declare replacement endpoints. The resolver retains its construction-time disjointness and delete-empty guards.

### RED checkpoints

- Reviewer duplicate RED: a fully rehashed create-new object with a bound, exact-kind `0.99` supported active candidate was accepted by the complete schema. The forged distinct fact and adjudication retained empty source/target sets while trusted Evidence, Authority, and current binding checks remained otherwise valid.
- Continuity RED: fully rehashed replace `a -> a`, split `[a] -> [a, child-b]`, and merge `[a, b] -> [a]` objects were each accepted by the complete schema.
- Conservative-history RED: after the first repair, a fully rehashed create-new object retaining an exact-kind tombstone with no replacement, `0.1` scores, no supporting Evidence, and blank explanation was still schema-valid. This proved unresolved history had incorrectly inherited the supported-overlap filter.

### GREEN and verification

- Focused identity suite: 47/47 tests passed, including the exact reviewer gate adversary, conservative historical blocker, positive weak-active distinct/no-overlap case, three rehashed source/target overlap adversaries, and authentic split/merge/replace/delete continuity.
- Full engine package: 15 files, 242/242 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 449/449 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`, `git diff --check`, and `git diff --cached --check`: passed.
- Scope remained in `packages/engine/src/identity/index.ts` and its focused test only. No core generated schema, barrel, query, analyzer, runtime, CLI, DAG, relevance, or context file changed.

### Frozen head

- Repair base: `902848d85efbb5b44fddf6bc240eba481d3c93e9`.
- Definitive single repair commit: `3d2f118` (`fix(engine): bind identity candidates and continuity`).
- Task 11 worktree was clean after the commit; no follow-up commit was made.

## Independent re-review of round-7 repair — 2026-08-08

### Scope and verdict

- Reviewed only `902848d85efbb5b44fddf6bc240eba481d3c93e9..3d2f118a6af8f80f63b1f221494d08baade3ea96` in `/home/zethj/dev/projector/.worktrees/task-11-identity`.
- Read the Task 11 brief, the round-6 findings, the round-7 review package, and the identity/StateBinding contracts governing lifecycle history, negative-space binding, and lineage.
- **Verdict: FAIL (Important).** The round-7 patch fixes both prior Important classes in the exercised paths, but replacement continuity still allows selected/source IDs that are missing, wrong-kind, weak/non-live, chained, or cyclic rather than requiring one eligible surviving candidate.

### Prior Important disposition

- **Fixed:** A fully rehashed create-new result carrying a supported exact-kind active duplicate is rejected by `AdjudicatedSemanticIdentityResolutionSchema.safeParse` and by the canonical creation gate. The same is true for an exact-kind unreplaced tombstone/superseded record with decayed scores and no Evidence.
- **Fixed:** A weak active candidate with no overlap remains a valid create-new path and passes the trusted creation gate.
- **Fixed:** Fully rehashed split/merge/replace source-target self/intersection cases are rejected; authentic disjoint split, merge, replace, and delete resolutions parse successfully.

### Important finding

1. **Replacement continuity is not bound to an eligible terminal candidate record.** `activeTargets` in `packages/engine/src/identity/index.ts:639-644` replaces every supported superseded/tombstone record with its raw `replacementIds`, while `candidateAnalysis` at `:831-843` never checks that each replacement exists exactly once in `candidateRecords`, has the requested kind, is an eligible live lifecycle, or resolves to a terminal replacement. The full resolution schema therefore accepts and the resolver returns non-create outputs with untrusted endpoints.

   Read-only built-output reproductions through `resolveSemanticIdentityFromEvidence` (all otherwise-valid closed identity bindings and hash-verified request Evidence) produced:

   ```text
   old superseded -> missing mid                  => overlap selected/source ["mid"]
   old superseded -> mid (mid active, score .1)   => overlap selected/source ["mid"]
   old concept superseded -> req (requirement)    => overlap selected/source ["req"]
   old -> mid -> new (mid itself superseded)      => overlap selected/source ["mid", "new"]
   old <-> mid replacement cycle                  => overlap selected/source ["mid", "old"]
   ```

   The corresponding candidate records contain only the historical source, or contain weak/wrong-kind/non-live replacement records; no operation rejects the endpoint or follows the chain. This violates the required rule that non-create selected/source endpoints correspond to eligible candidate records and the identity contract's requirement to resolve superseded/renamed semantics to the surviving replacement rather than a historical/cyclic ID. It also leaves schema and resolver semantics weaker than the intended lifecycle model even though candidate value hashes are present.

   **Smallest fix:** resolve each superseded/tombstone replacement graph to exactly one terminal active/deprecated candidate of the requested kind; require that endpoint to appear exactly once in `candidateRecords` and have its semantic value bound; reject missing, ambiguous, wrong-kind, non-live, or cyclic chains. Keep raw replacement IDs in persisted history, but use only the validated terminal endpoint for adjudication/source/selected IDs.

### Verification evidence

- Focused identity suite: `pnpm exec vitest run --root . packages/engine/src/identity/index.test.ts` — **47/47 passing**.
- Full `pnpm verify` — **34 files, 449/449 tests passing**, all workspace typechecks passing, package boundaries valid.
- Full `pnpm build` — all six buildable workspace projects passing.
- `git diff --check 902848d85efbb5b44fddf6bc240eba481d3c93e9..3d2f118a6af8f80f63b1f221494d08baade3ea96` — passing.

### Residual risk and follow-up

- No new Critical finding was observed; the Important lifecycle gap blocks merge under the review policy because malformed replacement history can steer otherwise-valid reuse/coordination to an unverified identity.
- Add focused schema and resolver adversaries for missing, weak, wrong-kind, non-live, multi-hop, and cyclic replacement targets, plus a positive one-hop active/deprecated replacement case. Re-run the trusted creation/current-binding gates after the endpoint policy is shared by resolver, schema refinement, and repository verification.

---

## Repair of independent re-review — round 8 — 2026-08-08

### Deterministic replacement lifecycle resolution

- Raw `replacementIds` no longer become live identity endpoints. One candidate lifecycle graph analysis is shared by live resolution/evidence matching, complete persisted-schema refinement, and the canonical-creation gate.
- Every relevant replacement edge must resolve to a persisted candidate record of the requested kind with exactly one semantic candidate value dependency. Replacement records must satisfy the same meaning-support thresholds as ordinary eligible candidates.
- Superseded/tombstone chains resolve recursively to terminal active/deprecated candidates only. Missing records, weak/ineligible replacements, wrong-kind replacements, self-edges, cycles, and historical nonterminal endpoints fail closed.
- Plural replacements remain permitted by the normative tombstone contract for split history, but every branch must be valid. The terminal endpoint set is normalized, unique, and sorted deterministically; non-create selected/source endpoints can contain only those eligible persisted terminals.
- Round-7 behavior remains intact: supported active/deprecated/history overlaps block create-new, exact-kind historical records without replacements remain conservative blockers, weak active candidates may permit a genuinely distinct boundary, and lifecycle operation source/destination disjointness is preserved.

### Exact TDD checkpoints

- RED at base `3d2f118`: focused identity ran 52 tests with exactly 5 failures and 47 passes. Missing persisted replacement, weak replacement, and wrong-kind replacement were accepted as live endpoints; a valid persisted two-edge chain was rejected because an intermediate historical ID leaked into the endpoint set; a two-record cycle degraded to an ordinary unresolved result instead of being rejected.
- GREEN: the five exact public trusted-flow adversaries now behave correctly. Positive direct replacement and valid chain cases select and persist only the terminal active candidate in both `selectedEntityIds` and adjudication `sourceIds`.

### Verification and frozen head

- Focused identity suite: 52/52 passed.
- Full engine package: 15 files, 247/247 passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 454/454 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`, `git diff --check`, and `git diff --cached --check`: passed.
- Scope remained only `packages/engine/src/identity/index.ts` and `packages/engine/src/identity/index.test.ts`; no barrel or unrelated file changed.
- Definitive single repair commit: `1411b89` (`fix(engine): resolve identity replacement lifecycle`). No follow-up commit was made.

---

## Independent re-review of round-8 repair — 2026-08-08

### Scope and verdict

- Reviewed exactly `3d2f118a6af8f80f63b1f221494d08baade3ea96..1411b899123b5e88790cd6da9248ae6fb2ca68d5` in `/home/zethj/dev/projector/.worktrees/task-11-identity`, covering the shared lifecycle analyzer, resolver, complete persisted schema refinement, trusted creation gate, and the new lifecycle tests.
- **Verdict: FAIL (Important).** The replacement graph repair is correct for the exercised direct, deprecated, multi-hop, missing, weak-target, wrong-kind, nonterminal, cyclic, and valid-branch cases. Two Important risks remain in the affected public persistence/lifecycle boundary.

### Important findings

1. **A reordered equivalent create-new evidence set passes the public schema and trusted gate but mints a different resolution identity.** The live resolver sorts `resolution.evidence` by canonical JSON at `packages/engine/src/identity/index.ts:1034`, but `AdjudicatedSemanticIdentityResolutionSchema` has no sorted/unique refinement for `evidence` (and likewise does not canonicalize `unknowns`). `assertCanonicalCreationAllowed` hashes the loaded `resolutionSemantic` as supplied at `:1264-1268` and checks only supporting evidence membership; it does not normalize or reject equivalent reference order. A read-only built-output adversary produced a valid trusted `distinct`/`create-new` result with context and supporting refs. The resolver result had refs `[{evidenceId:"ctx", stance:"context"},{evidenceId:"request", stance:"supports"}]`; reversing only that array, recomputing the resolution hash and ID, yielded `schema.safeParse === true` and a successful trusted creation gate. The two accepted IDs were `identity_resolution_faf6fb90f88b2a435dfd0c09160c8ad3` and `identity_resolution_b27628dfc8c6ccc4282705a9c021ac01`. Evidence references are an unordered set at this contract boundary, so equivalent persisted decisions can acquire distinct hash-bound identities and bypass deterministic duplicate prevention. **Smallest fix:** share one canonical evidence/unknown normalization invariant with resolver, schema, and gate (sort by the full ref, reject duplicate refs, and hash only the canonical projection).

2. **The shared lifecycle analyzer over-constrains a weak historical root even when its persisted terminal replacement is valid.** `candidateAnalysis.resolveReplacement` calls `supportsRequestedIdentity(record, requestedKind)` before checking whether the node is the historical source at `packages/engine/src/identity/index.ts:844-853`. Thus a source record `old` with lifecycle `superseded`, replacement `new`, and scores `0.1` throws `invalid identity lifecycle replacement graph: ... old is not eligible`, despite a persisted active `new` with scores `0.95`, exactly one bound semantic value dependency, and an exact trusted same claim naming only `new`. The same direct/chain flow succeeds when the historical source is a normal supported candidate, and weak *replacement targets* correctly fail. The acceptance contract requires inspecting superseded history and resolving to the surviving/replacement identity (`PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md:27-35`); the round-8 invariant says replacement records—not the root historical source—must meet ordinary eligibility thresholds. This false rejection prevents valid renamed/superseded identities from reusing their terminal identity whenever the historical observation's current-query score is low. **Smallest fix:** traverse a requested-kind historical root without applying the ordinary score/evidence threshold to that root; apply eligibility, semantic dependency, lifecycle terminality, and ambiguity checks to each replacement node/terminal endpoint, while retaining conservative blockers for unreplaced history.

### Prior-finding disposition and additional audit

- **Fixed:** Missing replacement records, weak/ineligible replacement records, wrong-kind replacements, self-edges, cycles, and historical nonterminal replacement endpoints now fail closed through the same lifecycle analysis used by the live resolver, persisted schema, and trusted gate.
- **Fixed:** Direct active/deprecated replacements and valid multi-hop chains resolve only to the deterministic terminal endpoint; selected IDs and adjudication source IDs match that terminal set. Valid plural branches remain deterministic; single-target operations become unresolved when their terminal set is ambiguous, while overlap/merge cardinalities remain operation-governed.
- **Fixed:** Round-7 duplicate/history blocking and source/destination disjointness remain intact in focused checks; no new Critical finding was observed.
- Residual contract risk is limited to canonical persisted ordering and the weak-root overconstraint above; malformed lifecycle graph endpoints cannot currently bypass the gate.

### Verification evidence

- Focused identity suite: `pnpm exec vitest run --root . packages/engine/src/identity/index.test.ts` — **52/52 passing**.
- Full `pnpm verify` — **34 files, 454/454 tests passing**, all workspace typechecks passing, package boundaries valid.
- Fresh `pnpm build` — all six buildable workspace projects passing.
- `git diff --check 3d2f118a6af8f80f63b1f221494d08baade3ea96..1411b89` and `git diff --cached --check` — passing.
- Read-only built-output lifecycle probes: direct active/deprecated and multi-hop terminal success; missing/weak/wrong-kind/nonterminal/cyclic failures; valid multi-branch endpoint normalization; weak-root false rejection; create-new evidence-order hash/gate adversary. No source or test files were modified; only this report was appended.

---

## Repair of independent re-review — round 9 — 2026-08-08

### Canonical persisted identity sets

- One canonical JSON set helper now owns full-value ordering and deduplication for structured set-like identity data. Resolver output canonicalizes resolution Evidence references and candidate Evidence references before hashing.
- The complete persisted schema rejects noncanonical or duplicate resolution Evidence, candidate Evidence, unknowns, adjudication claims/fact projections, and lineage/tombstone proposal arrays. Candidate records and their candidate projection remain normalized, uniquely identified, and deterministically ordered; endpoint and hash arrays retain their normalized string-set checks.
- Adjudication facts are emitted from the same canonical claim order. A rehashed create-new object with reversed Evidence now fails the public complete schema and therefore the trusted canonical-creation gate before provenance acceptance. Reordered delete claims/facts likewise fail persisted parsing.

### Replacement lifecycle eligibility

- Historical superseded/tombstone roots are traversed as bound context without applying current-query score/evidence thresholds to the root itself.
- Every node reached through a replacement edge—including historical intermediates and active/deprecated terminal endpoints—still must satisfy requested-kind/support eligibility and have exactly one bound semantic candidate value. Existing missing, weak, wrong-kind, self-edge, cycle, nonterminal, and terminal ambiguity adversaries remain fail-closed.
- Positive direct and multi-hop cases with a weak historical root now resolve only to the eligible terminal active identity in both selected IDs and adjudication sources.

### Exact TDD checkpoints

- RED at frozen base `1411b899123b5e88790cd6da9248ae6fb2ca68d5`: focused identity ran 57 tests with exactly 5 failures and 52 passes. The public schema accepted reversed rehashed create-new Evidence; it accepted reordered rehashed delete claims/facts; weak historical direct and chain roots were rejected; and the property test exposed duplicate/order-dependent semantic set hashes.
- GREEN: focused identity suite passed 57/57. The property test permutes and duplicates resolution Evidence, unknowns, and candidate Evidence and proves byte-identical resolution objects and IDs.

### Verification and frozen head

- Full engine package: 15 files, 252/252 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 459/459 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`, `git diff --check`, and `git diff --cached --check`: passed.
- Scope remained only `packages/engine/src/identity/index.ts` and `packages/engine/src/identity/index.test.ts`; no barrel or unrelated source file changed.
- Definitive single repair commit: `2ef28a3ccd00114d6640312f27a53bcdf9128112` (`fix(engine): canonicalize identity decision sets`). The Task 11 worktree was clean after this commit; the ignored report append did not alter worktree status.

## Independent re-review of round-9 repair — 2026-08-08

### Scope and verdict

- Reviewed exactly `1411b899123b5e88790cd6da9248ae6fb2ca68d5..2ef28a3ccd00114d6640312f27a53bcdf9128112` in `/home/zethj/dev/projector/.worktrees/task-11-identity`, covering the round-9 identity set canonicalization and replacement-root eligibility changes.
- **Verdict: FAIL (Important).** The requested Evidence/unknown/claim/fact/proposal set checks and weak historical replacement behavior are correct, but an equivalent rehashed resolution can still mint a different trusted identity by reordering the persisted StateBinding dependency arrays.

### Important finding

1. **The persisted StateBinding projection is not required to be canonical before hashing or mutation.** `AdjudicatedSemanticIdentityResolutionSchema` accepts `boundState` through the permissive core `StateBindingSchema` (`packages/engine/src/identity/index.ts:216-235`) without comparing its `valueDependencies`/`queryDependencies` arrays to the canonical `createStateBinding` projection. The gate at `:1310-1312` checks only that `createStateBinding(resolution.boundState).dependencyDigest` equals the supplied digest; it does not reject a raw array order different from that canonical projection. A read-only built-output adversary reversed only `resolution.boundState.queryDependencies`, recomputed the (unchanged) canonical dependency digest, recomputed the resolution content hash/ID, and obtained:

   ```text
   AdjudicatedSemanticIdentityResolutionSchema.safeParse(...) === true
   original ID !== forged ID
   assertCanonicalCreationAllowed(...) => ACCEPTED
   ```

   The forged object retained a valid create-new adjudication, Evidence/Authority envelopes, current binding validation, and all other hashes. Thus two semantically equivalent StateBinding sets can pass the schema and trusted mutation gate under different identity IDs, reopening deterministic duplicate/identity drift at the persistence boundary. **Smallest fix:** before schema acceptance/hash trust and in `assertCanonicalCreationAllowed`, recompute `createStateBinding(boundState)`, require byte equality of its dependency arrays and digest with the stored `boundState`, and hash only that canonical projection (or expose an engine-local refined schema with the same invariant). Apply this to both value and query dependency arrays; keep the existing core schema unchanged.

### Prior-finding and lifecycle disposition

- **Fixed/verified:** reordered or duplicate resolution Evidence, candidate Evidence, unknowns, adjudication claims, delete fact payloads, lineage/tombstone proposal sets, and candidate-record projections are rejected after rehash; resolver outputs canonicalize those set-like fields. Semantically ordered StateBinding dependency arrays were not sorted by the round-9 patch, which is why the finding remains.
- **Fixed/verified:** a weak superseded/tombstone root resolves through a valid strong direct or multi-hop terminal active identity; replacement-reached weak, wrong-kind, missing, nonterminal, self-edge, and cyclic records fail closed. Selected/source endpoint IDs are terminal-only and require exactly one bound semantic candidate value.
- Round-7 duplicate prevention, conservative unreplaced historical blockers, source/destination continuity, tombstone semantic-hash binding, and current/rebound gate checks remained green in the focused/full runs.

### Verification evidence

- Focused identity suite: `pnpm exec vitest run --root . packages/engine/src/identity/index.test.ts` — **57/57 passing**.
- Full `pnpm verify` — **34 files, 459/459 tests passing**, all workspace typechecks passing, package boundaries valid.
- Full `pnpm build` — all six buildable workspace projects passing.
- `git diff --check 1411b899123b5e88790cd6da9248ae6fb2ca68d5..2ef28a3ccd00114d6640312f27a53bcdf9128112` — passing; worktree source/tests remained clean.
- Read-only runtime probes used freshly built `dist` modules; only this report was appended.

### Residual risk and follow-up

- No new Critical finding observed. The Important StateBinding canonicalization gap blocks merge because it permits trusted, hash-valid identity drift from equivalent dependency sets.
- Add a focused persisted/gate adversary for reordered and duplicate value/query dependency arrays, plus a positive canonical round-trip assertion; rerun the focused/full gates after the shared invariant is applied.

---

## Repair of independent re-review — round 10 — 2026-08-08

### Canonical StateBinding invariant

- Added one identity-local invariant backed by the existing public `createStateBinding` canonicalizer. It requires stored value dependencies, query dependencies, nested fingerprint `assumptions`/`unavailableLanes`/`dependencyKeys`, and `dependencyDigest` to exactly equal the canonical projection.
- The complete adjudicated-resolution schema and trusted canonical-creation gate share this invariant. The gate also applies it to dependency-local rebound bindings before returning a mutation binding.
- Resolver preparation canonicalizes caller/search bindings before candidate analysis and hash-bound resolution emission. Set-like dependency permutations and duplicates therefore produce one identity, while arrays not normalized by the StateBinding contract retain their semantic order.

### RED checkpoints

- At frozen clean base `2ef28a3ccd00114d6640312f27a53bcdf9128112`, focused identity ran 59 tests with exactly 2 failures and 57 passes. A fully rehashed create-new resolution with reversed raw `queryDependencies` remained public-schema-valid, and the trusted gate accepted it; the property adversary also showed duplicate value dependencies reaching lifecycle analysis before normalization.
- A separate rebound-gate RED ran one selected test with exactly 1 failure: the trusted gate returned a raw reordered rebound binding instead of rejecting it.

### GREEN and verification

- Focused identity suite: 60/60 tests passed.
- Full engine package: 15 files, 255/255 tests passed.
- Fresh `pnpm verify`: all workspace typechecks passed; 34 files, 462/462 tests passed; package boundaries valid.
- Fresh `pnpm build`: all six buildable workspace projects passed.
- Explicit `pnpm check:boundaries`, `git diff --check`, and `git diff --cached --check`: passed.
- Scope remained only `packages/engine/src/identity/index.ts` and `packages/engine/src/identity/index.test.ts`; no barrel or shared-core file changed.
- Definitive single repair commit: `ea6b2b39dcc984a4ac795b48c5f2afb5a452b701` (`fix(engine): canonicalize identity state bindings`).

## Independent re-review of round-10 repair — 2026-08-08

### Verdict: PASS

- Reviewed exactly `2ef28a3ccd00114d6640312f27a53bcdf9128112..ea6b2b39dcc984a4ac795b48c5f2afb5a452b701` in `/home/zethj/dev/projector/.worktrees/task-11-identity`, limited to the public adjudicated identity schema, identity resolver preparation/emission, trusted canonical-creation gate, dependency-local rebound gate, and their focused tests.
- The exact diff is coherent with the StateBinding contract. `canonicalStateBinding` delegates to the existing `createStateBinding` projection, which sorts/deduplicates value and query dependency sets, normalizes/deduplicates nested fingerprint `assumptions`, `unavailableLanes`, and `dependencyKeys`, rejects conflicting duplicate keys, and recomputes the dependency digest. `reportCanonicalStateBindingIssues` requires byte-equivalent canonical arrays and digest in the public schema. Resolver preparation canonicalizes before analysis/hash emission, so semantically equivalent dependency permutations collapse to one resolution ID. The trusted gate rejects noncanonical persisted bindings before provenance and applies the same exact check to rebound bindings while preserving the legitimate current/rebound dependency-digest continuity path.
- No concrete correctness, integration, or overconstraint regression was found in this exact range. Existing lifecycle/candidate continuity and prior canonical-array invariants remained green; valid current and dependency-local rebound creation paths still pass, while reordered/duplicated StateBinding dependencies and nested fingerprint sets are rejected or canonicalized as intended.

### Verification

- Focused identity suite: `pnpm exec vitest run --root . packages/engine/src/identity/index.test.ts` — 60/60 passed.
- Full engine suite: `pnpm --filter @projector/engine test` — 15 files, 255/255 passed.
- Workspace verification: `pnpm verify` — all typechecks, 34 files/462 tests, and package-boundary checks passed.
- Build: `pnpm build` — all six buildable workspace projects passed.
- Diff hygiene: `git diff --check` passed.

Residual risk is limited to runtime behavior outside this exact identity diff (for example, host repositories must still provide truthful binding validation and authoritative provenance); no release-blocking issue remains in the reviewed path.
