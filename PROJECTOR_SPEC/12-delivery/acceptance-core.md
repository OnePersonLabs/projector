# Core Acceptance Scenarios

## Canonical rebuild closure

Create independently addressable canonical files for accepted Concepts, Requirements, Behavioral Scenarios, and authored Relations. Also create rules, an active lens/profile, authority record, decision, exception, and migration. Delete `state.db` and caches.

Expected: all canonical authored/governance semantics reload identically. The deterministic canonical-root digest is identical. Derived observations are recomputed. No hidden local run history or monolithic model file is required.


## Copied-slop majority and endogenous-evidence defense

Forty generated packages share a weak pattern. Two independently authored newer implementations use a better pattern, and incidents support the latter. Then let Projector normalize several packages under the proposed lens.

Expected:

- forty generated copies collapse into one independence group.
- Projector-normalized copies do not become independent votes for the same lens.
- dominant descriptive precedent is not automatically normative.
- a migration recommendation requires the stronger independent evidence and approval appropriate to risk.


## Semantic-signature insufficiency

Create two implementations with the same heuristic semantic hash/profile but an observable behavior difference outside that profile.

Expected: heuristic equality cannot backdate downstream validity. The unit requires independent revalidation or widened analysis.


## Semantic backdating

Internal API implementation changes while an exact public-interface signature remains unchanged.

Expected: implementation invalidates. Public contract revalidates/backdates. Downstream clients remain valid. No client regeneration.


## Shared-bug rebuild oracle

Inject a bug into a semantic analyzer used by both incremental and clean rebuild paths so both produce the same incorrect interpretation. Provide an independent test/schema/runtime lane that contradicts it.

Expected: rebuild oracle alone appears consistent, but independent conformance prevents a strong completion claim and surfaces the contradiction.


## SCC backdating

Create mutually recursive contract units whose externally visible exact signatures remain unchanged after an internal change.

Expected: Projector evaluates the SCC as one proof group and reaches a fixed point. Downstream consumers remain valid only after all relevant group signatures regain eligible assurance.


## Selector membership change

A private symbol becomes exported.

Expected: membership changes. Public API rules and projection expectations newly apply. Docs/compatibility/contract closure updates even though the path is unchanged. Localized caches invalidate only affected dependencies.


## Multiple valid shared implementations

Two handwritten implementations satisfy the same active predicates and tests but are structurally different.

Expected: a `predicate-constrained` expectation accepts both. Projector does not invent one exact canonical body and flag the other as divergent.


## Governance-cycle detection

Create two rules/lenses whose memberships depend recursively on each other's resulting state without declared fixed-point semantics.

Expected: compilation/reconciliation emits `governance-cycle` and refuses order-dependent resolution.

Then provide an explicitly declared monotonic SCC case.

Expected: deterministic convergence or bounded `nonconvergent-reconciliation` failure.


## Crash recovery matrix

Inject process failure after every transaction journal phase: prepared, during workspace mutation, staged, validating, canonical staging, commit, rollback.

Expected: restart either resumes safely, rolls back, or reports `recovery-required`. Canonical state never claims a transaction completed when workspace state is partial.


## Branch governance conflict

Create two branches that independently change the same active lens/rule incompatibly, then merge/rebase.

Expected: canonical conflict is detected. Govern/Autonomous execution blocks. Stale approvals/plans cannot apply. Explicit resolution creates new valid state.


## Open-world completeness refusal

Model an external/runtime dependency that is only sampled or open-world.

Expected: local work may be high-confidence, but `proven-within-boundary` is refused for any closure claim requiring complete enumeration of that lane.


## Unreachable external surface

Repository indicates an iOS application but store credentials are unavailable.

Expected: surface is known/unavailable. Plan contains human/external action. Local work proceeds where safe. Certificate refuses global completeness.


## Model resampling idempotence

Run inference twice against identical normalized evidence but force the provider to return two plausible different hypotheses.

Expected: accepted canonical state remains unchanged unless explicit promotion/decision occurs. Recorded inference artifacts remain distinguishable and replayable.


## Validator independence

Have an implementation packet generate both code and tests that agree with the same wrong interpretation. Add an independent contract/property/runtime validator that disagrees.

Expected: same-packet tests cannot satisfy an R2+ independent-validation requirement. Completion blocks on the independent contradiction.


## Generated-output upstream repair

A generated client contains a fixable defect whose generator/source schema is known.

Expected: direct client patch is rejected by default. Plan modifies upstream source/generator, regenerates, and validates. Temporary output overlay requires explicit debt/migration exit criteria.


## Partial completion and plan rebase

Resolve only script/hook architecture, stop, then modify the repository before resuming.

Expected: settled canonical decisions persist. If the intervening change touches a bound dependency, the old plan cannot blindly resume and `plan rebase` carries forward still-valid completed work into a new revision/capsules. If only unrelated snapshot state changed and every StateBinding dependency/membership fingerprint is unchanged, Projector can perform a lightweight rebind without recomputing unaffected semantic work.


## Localized cache performance

On a large synthetic semantic graph, modify an unrelated leaf unit.

Expected: selector/rule caches whose declared dependencies are untouched remain valid. Graph revision alone does not cause near-global recomputation.


## Engine/signature-profile upgrade

Change an analyzer or signature profile in a way that alters semantic interpretation.

Expected: Projector migration declares required reindex/revalidation. Dependent old derivations become suspect. No old proof silently survives.


## Analyzer partial failure

Force Markdown or TS sub-capability failure while filesystem/package facts remain available.

Expected: unaffected observations remain usable. Only dependent coverage/claims widen or block.


## Path/symlink escape

Create symlinks and platform-specific paths that would escape repository root if naively resolved.

Expected: observation may describe them according to policy, but mutation is root-constrained and refuses out-of-root writes.


## Misleading local precedent

Seed a nearby file with the wrong architectural pattern while semantically matching precedents exist elsewhere.

Expected: semantic role/relationship evidence outranks proximity. No new accidental fork is created.


## Projector repair oscillation

Create two transforms/rules that alternately recreate each other's divergence.

Expected: repeated state digest is detected and reconciliation fails with non-convergence instead of looping.


## Held-out/mutation-generated benchmark

Generate structurally varied repositories from pattern-preserving and pattern-breaking mutations not directly encoded in fixture-specific detectors.

Expected: reported precision/recall and completeness behavior remain within release thresholds, showing generalization beyond golden fixture memorization.

---


