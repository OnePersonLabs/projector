# Normative Principles and Non-Goals

## Normative principles

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

## Value before declaration

Projector MUST derive useful structure before asking a user to author semantic models. `projector init` MUST provide findings before any ontology or architecture ceremony is required.

## Evidence before authority

Observed repetition describes precedent. It does not establish that the precedent should govern future work. Normative authority requires explicit decision, constraint, independently useful evidence, or a policy-permitted promotion process.

Model inference alone MUST NOT authorize a blocking rule, active Projection Lens, or architecture migration.

## Canonical intent and derived state are different things

Accepted semantic intent MUST be durable and rebuildable from version-controlled canonical Projector files. Repository observations, indexes, inferred hypotheses, caches, and run state MUST remain rebuildable derived state.

Deleting `.projector/state.db` MUST NOT destroy accepted Concepts, Requirements, Behavioral Scenarios, authored Relations, active lenses, rules, authority decisions, exceptions, or migrations.

## Deterministic first

When Projector can handle a fact, selector, transformation, validation, or invalidation dependency deterministically, it SHOULD encode that behavior as machinery. This avoids repeated model reasoning.

Repeated successful reasoning SHOULD crystallize into recognizers, rules, transforms, validators, or cached decisions when that lowers future cost without weakening correctness.

## AI at the uncertainty frontier

Models are appropriate for semantic classification, competing-pattern interpretation, rationale synthesis, architecture judgment, bounded handwritten-code repair, and adversarial review. They are not the default mechanism for hashing, parsing, selector evaluation, known dependency traversal, deterministic transforms, or invariant checking.

## Optimization is assurance-bound

Projector MUST distinguish semantic similarity from semantic proof. Any optimization that prunes downstream work, declares a unit valid, or claims exact closure MUST state the assurance level and evidence lane that justify it.

Heuristic semantic equality MAY prioritize or narrow analysis, but MUST NOT by itself prove that downstream projections remain valid.

## Exactness without false certainty

Every completeness or impact claim MUST identify:

- modeled boundary.
- known affected set.
- possible frontier.
- unavailable or open-world dependency lanes.
- stale or failed observations.
- unknowns.

## Semantic precedent over textual proximity

A nearby artifact is weak precedent unless its semantic role, relationships, and governing lens match the current work.

## No manual synchronization ceremony

Projector MUST NOT require a normal workflow in which users remember to synchronize specifications with implementation. Reconciliation observes both directions: semantic intent to surfaces and surface mutations back to semantic state.

## Accepted knowledge compounds without becoming self-justifying

Accepted decisions, lenses, mappings, validators, transforms, and rationale SHOULD be reused until relevant inputs change. However, Projector-created conformity MUST NOT become independent evidence that the rule or lens which created it was correct.

## No ontology cathedral

A modeled entity is justified only when removing it would change planning, applicability, invalidation, transformation, verification, explanation, architectural choice, authority, or completeness semantics.

## Generation may be aggressive. Acceptance is governed

Agents may explore and generate freely inside declared sandboxes. Completion is a system claim, not an agent assertion. Governed completion requires state-bound plans, applicable rules, required independent evidence, reconciliation, and explicit unknowns.

## Correctness uses layered oracles

Projector MUST distinguish:

1. **rebuild correctness** — incremental state agrees with a clean rebuild from the same canonical inputs.
2. **independent conformance** — compilers, tests, schemas, runtime evidence, property checks, or independent reviewers support the semantic claim.
3. **historical/metamorphic validity** — lenses and selectors make useful predictions on prior or perturbed states.

A clean rebuild using the same analyzer implementation is not independent behavioral proof.

## Semantic transactions are state-bound and crash-consistent

Plans, work packets, approvals, and Execution Capsules MUST bind to the repository/canonical/toolchain state they were compiled against. Mutating workflows MUST journal enough state to recover safely after process death or host interruption.

## Governance must terminate

Applicability, rule composition, projection expectation, validity, reconciliation, and architecture-decision dependency groups MUST have explicit dependency strata. Cyclic cases require declared fixed-point semantics, cycle detection, and convergence limits. Projector MUST fail visibly rather than loop or silently settle on evaluation order.

## Progressive architecture commitment

Projector MUST delay architecture decisions until their concerns become material, then resolve them before implementation creates irreversible accidental commitments. New requirements activate questions, not preselected technologies. Existing decisions are reused until a typed reconsideration input materially affects their scope or justification.

## Decisions explain governance consequences

Every material architecture decision MUST be inspectable as a chain from concern → selected option → authority/rationale → consequences. Every active blocking rule or lens MUST have a typed governance basis. A rule does not need its own architecture decision when a hard constraint, adopted standard, migration overlay, host safety boundary, or authorized lens justifies it.

## Preferences inform. Constraints govern

Developer and organization preferences are decision-support priors, not hidden hard rules. A preference becomes enforceable only through an explicit project decision or constraint. Projector MUST make material preference influence visible when explaining a recommendation.

## Meaning is authoritative. Encoding is derived

Canonical semantic intent, governance, and executable predicates MUST remain authoritative over any human-readable or agent-optimized rendering. Human documentation, compact agent context, generated host instructions, and machine-facing invariant serializations are **Representation Projections** derived from canonical sources.

A Representation Projection MUST identify the source semantic state and representation profile that produced it. Editing a derived representation MUST NOT silently mutate canonical intent. If the edit represents a real semantic change, reconciliation promotes it through the normal semantic-change/authority workflow. Otherwise it is regenerated or classified as divergence.

## Optimize instruction efficiency, not token count alone

Token reduction is useful only when it preserves required behavior and lowers total cost. Projector MUST optimize representation under semantic-preservation and verification constraints rather than treating shortest text as best. Representation overhead, repeated profile injection, repair/retry cost, and behavior degradation count against the optimization.

A token-saving representation MAY be skipped when the source is already terse, the profile overhead exceeds expected savings, or evidence shows worse task/conformance outcomes.

## Resolve identity before creating semantics

Before Projector creates a durable semantic entity, it MUST try to resolve the requested meaning against existing canonical identities. This includes Concepts, Requirements, and Behavioral Scenarios. Names, paths, and wording are discovery signals, not identity. Creating a new identity requires an inspectable reason why existing entities do not already own the meaning.

## Relevance precedes impact

Projector MUST distinguish **relevance discovery** from **impact closure**. Relevance discovery determines what existing project knowledge may materially affect correct interpretation and planning of a proposed change. Impact closure determines what a known semantic delta affects. Relevance MAY use confidence-ranked semantic and historical evidence to prevent omission. Mutation/completion claims remain governed by the stronger proof rules of impact, invalidation, and coverage.

## Encapsulation owns. Traversal retrieves

Each canonical semantic fact MUST have one authoritative owner/home. Cross-cutting semantics MUST NOT be copied into every package or subsystem they affect merely to make them discoverable. Repository hierarchy, semantic ownership, event topology, platform topology, and retrieval topology are separate concerns. Encapsulation determines where truth is maintained. Typed relationships, applicability, implementation topology, and bounded relevance traversal determine when that truth enters a change context.

## Behavior is canonical. Spec encodings are projections

Durable product/system behavior SHOULD be represented as canonical Requirements and Behavioral Scenarios where doing so changes planning, verification, explanation, or change closure. Markdown specifications, Gherkin, ticket text, and agent-oriented summaries are representations or origin evidence. They MAY propose authored semantic changes, but durable Projector authority is established only after normalization into stable canonical semantic entities/relations through the semantic transaction workflow. Projector MUST NOT depend on an agent remembering to browse a specification directory for correctness.

## Snapshot identity is not local validity

Projector MAY compute global repository and canonical-root digests to identify complete snapshots. A global digest change MUST NOT be the sole reason that independently scoped semantic work becomes stale. Plans, capsules, approvals, and mutation capabilities MUST bind to explicit semantic/physical dependencies and query-result fingerprints. The fingerprints establish whether relied-on state changed.

---


## Explicit non-goals

Projector 1.x does not promise:

- formal verification of arbitrary business logic.
- perfect recovery of intent that left no evidence.
- a universal ontology.
- ownership of all source bytes.
- universal support for all languages.
- autonomous destructive production changes.
- automatic acceptance of contested architecture.
- a graph database requirement.
- one monolithic canonical semantic document that must be loaded or rewritten as a unit.
- a repository/package tree serving as the semantic ontology or context-retrieval boundary.
- a conventional spec-folder workflow whose correctness depends on agents voluntarily discovering relevant documents.
- a hosted SaaS requirement.
- a visual modeling prerequisite.
- automatic rewriting of arbitrary handwritten line ranges.
- replacement of compilers, tests, static analysis, security review, or human product judgment.
- canonicalization of every repeated style detail.
- treating controlled technical prose, compressed agent language, or generated host instructions as canonical semantic authority.
- proving arbitrary natural-language equivalence from compression or paraphrase alone.
- lock-in to one model vendor or agent host.

---


