# Release, Dogfooding, and Final Directive

## Minimum credible public release

A public release is credible when a new user can:

1. Install one package.
2. Run `projector init` in a TypeScript/JavaScript monorepo.
3. Receive useful findings without handwritten modeling.
4. Inspect why a finding and its expectation exist.
5. Distinguish Pattern Candidate from active authority.
6. Persist canonical Concepts, Requirements, Behavioral Scenarios, and Relations as independently addressable semantic state and rebuild the derived graph from them.
7. Request behavior using terminology different from the canonical name and see Projector reuse the existing semantic identity rather than create a duplicate.
8. Request a cross-cutting change and receive a bounded Relevance Closure that finds governing semantics outside the touched package without loading unrelated domains.
9. Inspect separately why something was relevant to planning and why something entered Impact Closure.
10. Request a feature that expands architecture and receive a concise decision frontier with prior decisions, required research, alternatives, preference influence, and decision consequences.
11. Compile an Execution Capsule whose context is selected from the relevant semantic subgraph rather than the complete project graph.
12. Change unrelated canonical/repository state. Show safe `StateBinding` rebinding without globally staling unrelated approved work.
13. Auto-fix supported R1 divergences through dependency-bound journaled transactions.
14. Run a partial completion session and resume/rebase its plan.
15. Allow a coding agent to make a deliberate fixture mistake and reconcile it.
16. Compile one cross-file semantic change with narrow invalidation.
17. Compare predicted vs actual implementation impact and surface a Planning Surprise when the plan missed a real semantic relationship or the agent exceeded scope.
18. Show exact/validated semantic backdating and heuristic refusal.
19. Run `verify --clean` and an independent conformance check.
20. Recover correctly from injected transaction interruption.
21. Refuse a false completeness claim on an open/unavailable surface.
22. Emit a compact R2+ transaction receipt and truthful certificate.
23. Rebuild `state.db` from canonical state with equivalent semantics.
24. Compile one canonical semantic scope into human-technical, Gherkin/human behavioral, agent-compact, and machine-invariant representations where applicable, rejecting seeded protected-semantic drift.
25. Show that compact context selection uses measured net utility/cost rather than token count alone. Include a net-negative fallback case.

A release that primarily writes Markdown, prompts, static graphs, or advice does not satisfy Projector.

---


## Dogfooding requirement

Before public release, Projector MUST govern its own repository with active lenses for:

- workspace package boundaries.
- analyzer implementation.
- CLI commands.
- transform implementation + tests.
- serialized contract changes.
- Projector's own Requirements/Behavioral Scenarios and semantic identity resolution.
- Relevance Closure and context compilation for Projector feature work.
- event/public-contract relationships where applicable.
- DB migrations.
- host adapter generation.
- docs references.
- semantic representation profiles for Projector's own human docs, agent capsules/host instructions, and machine-invariant rule products.

Projector’s own audit MUST be clean or contain explicit accepted debt.

The authoritative Projector specification MUST pass the blocking `human-technical@1` mechanical style gate. Code blocks and exact technical literals are outside that prose gate. Passive voice and nominalization remain review signals when a deterministic checker cannot identify a better actor or verb safely.

Before public release, represent the reference technology and package choices in [Reference Implementation Architecture](../02-semantic-kernel/reference-implementation.md) as Projector Architecture Decisions, Authority Records, and Governance Bases. Projector MUST explain its package, runtime, storage, test, and analyzer choices. It MUST show the rules and lenses they produce and the typed triggers that cause reconsideration.

---


## Final implementer checklist

Before claiming any slice or release complete, verify:

- zero-ceremony value still exists.
- canonical authored/governance state is closed under rebuild.
- canonical semantic entities are independently addressable. No bounded change requires loading/rewriting a monolithic project model.
- global canonical/worktree digests identify snapshots but are not the sole local validity dependency.
- every plan/capsule/approval/capability uses a dependency-complete `StateBinding` whose query dependencies are explicit.
- every public normative contract is schema-defined.
- package dependencies follow ports + composition-root architecture.
- semantic hashes use explicit schema projections.
- stable semantic identity does not depend on filename, package location, or mutable wording. Aliases do not create identities.
- new durable semantics are resolved against existing identities before creation.
- Requirements/Behavioral Scenarios exist only where they materially improve planning, relevance, verification, or explanation.
- semantic equality states its profile and assurance.
- canonical semantics remain authoritative over every Representation Projection.
- human/agent/machine representations bind to source semantic hashes and an explicit profile version.
- protected normative force, negation, scope, cardinality, logical connectives, conditions, exceptions, dependency/order, behavioral step roles, concept identity, and literals cannot silently drift during rendering/compression.
- style/clarity linting is never mislabeled as semantic-equivalence proof.
- compact context accounts for tokenizer/profile overhead and can fall back when net-negative or behaviorally worse.
- heuristic equality never prunes downstream validity by itself.
- Relevance Closure is explicitly distinct from Impact Closure and exact invalidation.
- context selection follows bounded relevance rather than package/file hierarchy or whole-graph dumping.
- deterministic event/contract/implementation topology is preferred to model rediscovery when available.
- exact invalidation follows derivation inputs and conceptual widening follows versioned Impact Rules.
- predicted-versus-observed impact is reconciled and Planning Surprises cannot silently rewrite the original plan.
- governance strata and recursive SCCs have termination semantics.
- architecture concerns are materiality-gated and transient unless durably dispositioned.
- accepted architecture decisions are scoped and have explicit Authority Records + Governance Bases.
- decision validity is reevaluated only when typed relevant inputs fire.
- local/user preferences remain non-blocking and do not silently become repository governance.
- live research is concern-scoped, freshness-aware, and never implies automatic migration.
- unresolved `blocking-now` concerns cannot disappear through implementation.
- decision consequences activate atomically and overlapping scoped decisions are conflict-checked.
- Projector-generated conformity cannot vote independently for its causal rule/lens/decision.
- risk cannot decrease when uncertainty increases.
- plans, packets, approvals, and MCP mutation capabilities are dependency-scoped state-bound, with safe rebinding when only unrelated root state changes.
- transaction journal/recovery paths are tested at each phase.
- repair generated outputs upstream by default.
- selector/rule caches are dependency-keyed.
- analyzer failures degrade only dependent claims.
- external live state enters deterministic work only through pinned snapshots.
- blocking rules normalize to the supported predicate kernel or explicit validator.
- R2+ validation independence policy is satisfiable and tested.
- multiple valid shared implementations are not falsely canonicalized.
- merge/rebase canonical conflicts block stale automation.
- engine/schema/signature upgrades invalidate old proofs when required.
- sensitive data is removed before model-context construction.
- path/symlink boundaries prevent out-of-root mutation.
- second identical reconciliation has no material semantic delta.
- held-out/mutation-generated evaluation accompanies golden fixtures.
- semantic model complexity is measured against use.
- no unsupported `proven-within-boundary` claim is emitted.
- changing only a representation profile invalidates dependent projections/contexts without mutating canonical intent.

---


## Final implementation directive

Build the smallest system that closes this loop with explicit proof boundaries:

```text
observe reality without executing it by default
→ derive deterministic structure
→ interpret WHAT / WHY while independently scouting WHERE / WHAT-ELSE
→ resolve requested meaning against existing stable semantic identities
→ compile a bounded Relevance Closure across semantic, code, event, contract, decision, invariant, and verification topology
→ create/modify canonical Requirements and Behavioral Scenarios only where they add durable semantic value
→ normalize requirement/scenario/constraint deltas without preselecting HOW
→ disclose newly material architecture concerns
→ reuse valid scoped decisions and dirty only affected decision bases
→ refresh current evidence and evaluate preferences only where decision materiality requires it
→ accept/defer architecture decisions and compile their governance consequences
→ infer semantic classifications and Pattern Candidates
→ establish authority from independent, causally valid evidence
→ compile Projection Lenses, typed rules, expectations, and Impact Rules
→ compile human, behavioral/Gherkin, agent, and machine representations from the same canonical semantic kernel
→ reject or fall back from any representation that weakens protected semantics or loses net utility
→ bind plans/capsules/approvals to explicit semantic/physical dependencies rather than a global snapshot alone
→ record derivations and semantic signatures
→ calculate Impact Closure, invalidate exact dependents, and widen uncertain impact
→ backdate only with sufficient assurance
→ repair upstream and deterministically where possible
→ dispatch bounded agents only for semantic residue
→ derive reverse impact from actual mutations and compare it with predicted relevance/impact
→ classify Planning Surprises; propose learned relationships without manufacturing authority
→ validate through required independent evidence lanes
→ reconcile to an explicit fixed point
→ commit fine-grained canonical intent + material transaction receipt
→ preserve a resumable cleanup frontier
→ turn repeated reasoning and newly proven relationships into cheaper executable machinery
```

Projector succeeds when the control plane owns globally coherent change reasoning. It determines which accumulated intent and architecture matter before local agent reasoning dominates. It then verifies what reality actually touched.

The governing constraint is:

> **Projector may optimize aggressively only when all required conditions hold:**
>
> - It names the evidence lane that justifies the optimization.
> - It binds the action to the dependencies it analyzed.
> - It preserves the semantic dimensions that the target representation requires.
> - It explains why the relevant subgraph is sufficient for the claim.
> - It states the uncertainty boundary that remains.

