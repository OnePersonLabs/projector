# Vision and North-Star Behavior

## Executive summary

Projector is a self-starting semantic control plane for software evolution.

Projector observes a software system and infers concepts and recurring implementation patterns. It separates precedent from authority.

Projector also models durable behavioral intent: capabilities, requirements, scenarios, constraints, events/contracts, and the relationships that connect them across implementation boundaries. Before a request becomes a semantic delta, Projector resolves existing semantic identities. It then compiles a bounded relevance subgraph that prevents tunnel vision.

Projector compiles approved patterns into executable Projection Lenses and records derivations from their inputs. It calculates semantic impact and invalidates only expired validity proofs. It routes repair to the least costly sufficient mechanism and reconciles observed reality with intended semantic state.

Projector also governs **progressive architecture commitment**. Requirements, constraints, target platforms, scale, and operations can change. Projector identifies new material architecture concerns. It reevaluates only decisions whose assumptions or scope changed. It refreshes external evidence when needed.

Projector evaluates alternatives against hard constraints and explicit developer or project preferences. It shows the smallest decision frontier required for safe implementation.

A feature request MUST NOT hide a technology choice in intent. A suspect old decision MUST NOT be treated as proof that migration is required.

Projector also treats **human prose, agent context, and machine-checkable constraints as derived representations of the same canonical semantics**. Canonical concepts, decisions, rules, and predicates remain authoritative. Target-specific representation profiles may optimize readability or token cost. They MUST preserve normative force, negation, scope, cardinality, conditions, exceptions, dependency/order, and protected identifiers/literals. A compressed or polished rendering MUST NOT become authority merely because it is convenient to read or cheap to transmit.

Projector changes the development unit from:

```text
files + prompts + remembered conventions
```

to:

```text
semantic transaction
→ intent interpretation
→ semantic identity resolution
→ bounded relevance closure
→ requirement / scenario / constraint delta
→ architecture concern + decision preflight
→ concept + relationship delta
→ impact closure
→ invalidation
→ bounded projection work
→ reverse-impact comparison
→ verification
→ reconciliation
→ certificate
```

A user MUST be able to run:

```bash
projector init
```

in an existing repository that Projector can inspect and get useful findings without writing an ontology, architecture manifest, or rule inventory.

After enough coverage exists, a user MUST be able to request a conceptual change such as:

```bash
projector change "All repository automation scripts use the root script pattern with colocated tests"
```

and receive:

- normalized semantic intent.
- resolved existing semantic identities and any justified new identities.
- relevant canonical requirements, scenarios, invariants, decisions, events/contracts, and implementation bindings.
- a bounded relevance closure with explicit reasons and uncertainty.
- applicable decisions and lenses.
- known affected projection closure.
- possible uncertainty frontier.
- dependency-ordered execution plan.
- deterministic repairs where possible.
- bounded agent work only for semantic residue.
- required validations.
- a truthful completeness statement.
- a change certificate.

The system MUST make this causal loop cheaper over time:

```text
observe reality
→ infer concepts, relationships, and patterns
→ establish authority
→ resolve semantic identities before creating new ones
→ compile behavioral intent and relevance relationships
→ discover the bounded knowledge subgraph for each requested change
→ compile executable lenses and rules
→ compile target-specific semantic representations
→ record derivations
→ detect divergence
→ invalidate minimally
→ repair deterministically when possible
→ dispatch agents only for semantic residue
→ compare predicted and observed impact
→ verify
→ reconcile
→ promote accepted newly learned relationships
→ certify
→ convert accepted reasoning into reusable machinery
```

---


## North-star product behavior

## Zero-ceremony initialization

```bash
projector init
```

MUST:

1. Detect repository root and Git state.
2. Generate minimal `.projector/config.json`.
3. Inventory repository surfaces.
4. Build deterministic indexes.
5. Classify stable Projection Units.
6. Infer candidate concepts and relationships.
7. Cluster recurring descriptive patterns.
8. Inspect Git history for stability, migration direction, and copy ancestry.
9. Evaluate high-value pattern authority.
10. Produce candidate or shadow lenses where justified.
11. Calculate multi-dimensional coverage.
12. Emit a divergence/anomaly report.
13. Offer policy-allowed deterministic repairs.
14. Generate a cleanup plan.
15. Install or update requested host adapters.
16. Report the next highest-information unresolved architecture concern, decision, or semantic question.

No manual semantic modeling is required before step 12.

Required variants:

```bash
projector init --audit-only
projector init --offline
projector init --deep
projector init --interactive
projector init --autonomous
```

`init` MUST be idempotent.

## Explain any governed target

```bash
projector explain scripts/generate-icons.mjs
projector explain concept:repository-script
projector explain lens:repository-automation@2
projector explain divergence:div_...
projector explain --context-for scripts/generate-icons.mjs --operation modify
projector explain representation:agent-compact@1
projector explain requirement:REQ-...
projector explain relevance:rel_...
```

The explanation MUST trace:

- semantic classification.
- canonical identity and aliases.
- governing requirements and behavioral scenarios.
- why related entities entered the relevance closure.
- applicable Projection Lenses.
- effective rules.
- why each selector matched.
- relevant authority decisions.
- supporting and contradicting evidence.
- upstream semantic inputs.
- downstream dependents.
- current derivation and validity state.
- Control Policy.
- exceptions.
- invalidation conditions.
- compiled execution context.
- representation profile, protected semantic dimensions, and fidelity/token accounting when a derived representation applies.

## Audit at any time

```bash
projector audit
projector audit --scope packages/api
projector audit --since HEAD~20
projector audit --format json
projector audit --fail-on severity:high
```

The report MUST remain useful under partial coverage.

## Reconcile arbitrary agent work

```bash
projector reconcile
projector reconcile --base origin/main
projector reconcile --fix
```

Projector MUST treat the working tree as observed state, not assume work was performed through Projector.

Direct edits MUST resolve to one of:

1. Conforming change under an existing projection.
2. Semantic change requiring graph/model update.
3. Legitimate pattern or exception proposal.
4. Unexplained divergence.

## Compile and execute semantic changes

```bash
projector change "Replace handwritten REST client calls with generated typed clients"
projector plan change:chg_...
projector apply plan:plan_...
```

Before impact planning, Projector MUST resolve the request against existing semantic identities and compile a bounded relevance closure. It MUST then produce exact known impact and explicit uncertainty. Relevance discovery determines what knowledge must be considered to understand the change. Impact closure determines what a known semantic delta affects.

## Complete semantic coverage progressively

```bash
projector complete
projector complete --scope packages/api
projector complete --budget 20
```

A user may stop at any point. Accepted knowledge and cleanup work MUST remain resumable.

## Recommend and execute modernization

```bash
projector upgrade
projector upgrade --category architecture
projector upgrade --scope packages/api
```

Recommendations MUST start with demonstrated repository friction or platform constraints, not novelty.

## Progressively disclose architecture decisions

Ordinary feature/change requests MUST trigger architecture preflight when the requirement delta introduces or materially affects architectural concerns. Projector MUST:

1. Separate requested behavior/constraints from possible implementation solutions.
2. Discover newly material architecture concerns.
3. Identify existing decisions whose material assumptions, scope, platform/toolchain constraints, or evidence obligations were affected.
4. Reuse unaffected valid decisions without asking again.
5. Classify unresolved concerns as `blocking-now`, `material-soon`, or `deferable`.
6. Refresh live research only when a decision materially depends on mutable external facts and its evidence is not fresh enough for the changed question.
7. Evaluate current viable alternatives against hard constraints, local evidence, migration/operational cost, and applicable developer/project preferences.
8. Present the smallest high-information decision set needed for the next safe commitment.
9. Compile accepted decisions into explicit consequences such as rules, lenses, Impact Rules, constraints, migrations, or intentionally empty "keep it simple for now" outcomes.
10. Block governed completion only when an unresolved concern is actually blocking for the affected scope.

Progressive disclosure is a semantic planning property, not only a UI style. Projector SHOULD avoid premature architecture and accidental architecture.

---


