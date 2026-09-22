# Projector V4: running specification

**Revision 0.3** · Captured through U003 and provisional assistant response A003.  
**Status:** incomplete conception in active conversation, not approved for implementation.  
**Authority:** Michael's stated direction. Assistant proposals remain separately labeled.

**Attribution key:** U001-U003 identify user messages in the sibling capture; A001-A003 identify assistant interpretations/proposals. User-derived meaning can be cleaned up without changing intent. Assistant assumptions are provisional until explicitly or unambiguously implicitly approved, with the specific approval evidence recorded. Neither a skim nor silence is blanket approval. This specification is a current-state view; the append-only file preserves the event trail.

## 1. Blank slate and durable conversation

**Source: U001-U003.**

V4 starts from a blank design slate. V3 remains reference material, not inherited architecture. No V3 schema, terminology, execution machinery, or obligation transfers automatically. Existing components can be considered later without an obligation to reuse them.

Maintain two files in `OnePersonLabs/projector`, branch `v4`, under `.temp/initial-design/`:

- **`PROJECTOR_V4_RUNNING_SPEC.md`:** this self-contained current-state specification. Integrate corrections here rather than accumulating contradictory historical versions.
- **`PROJECTOR_V4_INITIAL_CAPTURE.md`:** the append-only conversation capture, retaining its original filename and original bytes. Append user additions/corrections and separately attributed assistant interpretations/proposals. Replaying the capture must recover the current conception, tentative choices, and unresolved questions without earlier chats.

Update both at the end of each response in this continuing design conversation. Later user direction supersedes earlier direction; an assistant suggestion is not adopted merely because it appears in the spec. U003 explicitly asks to include suggestions by default while marking them provisional until explicit or unambiguous implicit approval. Record adoption per claim, with its supporting user event; ambiguous agreement remains provisional. Append corrections to the history instead of rewriting old entries. Read the branch's current files before subsequent updates and keep both updates in one commit where possible; do not overwrite intervening work. Prose replay supports faithful semantic reconstruction, not a promise of byte-identical synthesis.

U003 calls the dangerous-skimming failure mode **The Slop Attractor**, also **MichaelsBane**. This is conversational shorthand, not a required product entity or subsystem. U003 does not blanket-approve P1-P8.

The `v4` working tree starts with only these records and `.gitignore` copied from main commit `0a01dacc694793daea28f416372671554ac9b4e7`, adjusted to track this directory while excluding other temporary output. Main and V3 remain untouched; the new branch retains Git ancestry without carrying V3 working-tree files. This authorizes repository setup, not a V4 implementation. The documentation capture arrangement does not prescribe a product event-store subsystem.

## 2. OpenSpec and the purpose of V4

**Source: U001; retirement/economics elaboration in U003.**

**Projector is symbiotic with OpenSpec.** An initialized OpenSpec project is required. OpenSpec owns the requirement/specification layer; assume its latest version is sufficient, including nested live specs.

Monitor **added, modified, and removed requirements in live specs**, not proposed requirements in OpenSpec's `changes/` directory. A proposed change is not accepted live meaning merely because it appears there.

The captured direction combines resolvable terms and code symbols, complete economical refactoring, designs justified against their applicable requirements, and automatic invalidation with dependency-ordered reevaluation. U003 adds design-justification diagnostics and economical requirement retirement. The rest of the implementation-generation loop is not yet specified.

**Background interpretation (A001, restating earlier user direction):** the motivation is understandable concern ownership: humans and agents should locate a concern, understand its contract, and work within its responsibility without reconstructing unrelated implementation. Some relationships are hierarchical and others cross-cutting. Specifications, designs, and code should express compatible ownership. This is not a mandate for one package, file, or entity per term, or for a global ontology. Human understanding and total work economics matter, not just machine-readable completeness.

## 3. Terms, references, and tags

**Source: U001, with live-reference truth from U002 and subreference support from U003.**

### Proposed notation

| Form | Meaning under consideration |
| --- | --- |
| Leading `# My Term` in an eligible Markdown file | Explicit term definition |
| `[[My Term]]` | Readable term/symbol reference; conceptual term matching is intended to be case-insensitive |
| `§my_term` | Compact reference to the same term; Michael leans toward underscores |
| `@Tag` | Mentioned, but semantics not yet defined |

The name-conversion analogy is a human skill name becoming a command-like identifier; no other tool's implementation is selected. Exact normalization, punctuation, Unicode, acronyms/camel case, collisions, and the relationship to language-sensitive symbol names are open. Michael currently leans against namespaces for terms; namespace support and fully qualified code-reference syntax remain undecided.

### Definitions and uniqueness

Explicit terms are recognized only in Markdown matching an intentionally limited, still-unspecified path/pattern scope. Arbitrary H1 headings outside that scope are not automatically definitions.

**A term may have only one definition.** Duplicate definitions produce errors with the seriousness and visibility of type-check errors, not silent nearest/newest winners. The precise identity scope, and how explicit definitions interact with same-named code symbols, still need definition.

A logical code symbol can also define a term. The intended model is language-agnostic; no initial language set or parser architecture is selected.

### Contextual resolution and qualification

References must resolve from where they occur. If a class imports `SomeType`, `[[SomeType]]` in its comment should resolve to that imported symbol, not an arbitrary repository-wide match.

A Markdown reference also needs a resolution context. How a document acquires an owner, imports, or explicit qualifications is open.

An unresolved code-symbol reference is an error. Offer a fully qualifying autofix only when **exactly one** matching symbol is accessible from that reference context without violating configured import/module boundaries. Zero or multiple legal candidates do not justify an automatic choice. Qualification must not bypass a boundary. Nx and dependency-cruiser are examples of boundary-policy providers, not selected dependencies. When an offered fix may be applied automatically is not settled.

### Undefined references in ideation versus live designs

Unfinished ideation may mention a term before defining it. U002 resolves the live-design case:

> **A live design referencing an undefined term is code drift.**

It is not an acceptable implicit placeholder merely because undefined vocabulary was permitted while brainstorming. Live designs, like live specs, are expected to be **true**, except while implementing a design delta. How draft/live status and delta-scoped temporary inconsistency are represented, and exactly when checks block work, remain open. This does not establish that every proposed delta permits every kind of unresolved reference. Duplicate definitions remain errors.

### Subreferences

**User direction (U003):** `[[...]]` must support precise reference inside a target: a code-symbol property/member, a particular design part, or a nested Markdown subheading path in a term definition. Use established conventions rather than the user's illustrative arrow notation.

Design-part types and schema remain undefined and unapproved. The user invites exploration of stronger CSS-selector-like capabilities when defensible scenarios justify them; this is not approval of a selector language. Exact syntax, identity, cardinality, and escaping proposals appear in A003/P9-P10 below. `@Tag` semantics remain open.

## 4. Complete refactoring with minimal edits

**Source: U001.**

Detect renames/moves and enforce completeness for supported references to terms, code symbols/types, package names, specs, nested spec paths, and renamed ancestor path segments. Hooks are a candidate mechanism, not a chosen host API.

Collect related refactors before updating files. If two renames affect many of the same files, combine their applicable changes and update each affected file **once per refactor pass**, rather than running a separate whole-repository pass for each rename.

Completeness concerns supported reference bindings, not arbitrary prose matches or unrelated formatting. Logical rename detection versus deletion/addition, collisions, swaps, simultaneous changes, verification, and concurrent edits remain open. No string-only or filename-only inference is approved.

## 5. Designs, live truth, and design deltas

**Source: U001-U002. U003 explicitly reiterates that design-part types are not yet approved.**

### Design responsibility and justification

A design retains a solution for a reasonably minimal, coherent responsibility surface. A new requirement can justify a different design/implementation, not merely another addition to the existing solution. Reevaluation may instead retain the current design.

Each design explicitly names the requirements it satisfies and provides concise justification/evidence:

- **Primary:** the requirements the design exists to fulfill.
- **Secondary/applicable:** other requirements that constrain it because of scope, behavior, dependencies, or another applicability criterion.

Secondary does not mean optional. These labels explain the distinction; they do not prescribe a schema. A design can depend on another design, affecting understanding, invalidation, and scheduling.

### Live-design truth

Live designs are expected to be true just as live specs are, except during implementation of a design delta. An undefined referenced term is an explicit case of code drift. Reference resolution alone is not proof of behavior; the exact meaning and verification of other forms of design conformance remain to be elaborated.

A dirty flag indicates that reevaluation is required. It does not identify the intended repair or authorize changing meaning to fit the code.

### Design deltas

**Design deltas are analogous to spec deltas.** Michael is considering a structural schema that supports adding, removing, and modifying design parts. What those parts are is not yet decided.

No whole-file, section-patch, structured-record, custom-language, or directory-layout choice is made. How design deltas relate to OpenSpec changes, when live designs are updated during implementation, and how a delta completes remain open. This idea does not replace OpenSpec or establish another backlog authority.

## 6. Invalidation and dependency-first reevaluation

**Source: U001 for dirtying and dependency-first batching; the applicability/removal interpretations below are attributed separately.**

### Detect affected designs

Modifying a live requirement automatically invalidates referencing designs and arranges reevaluation. Michael proposes dirty flags on design files; storage/serialization is open. Changes to a depended-on design must also lead to consideration of its dependents. Accumulate multiple invalidation reasons instead of immediately repeating evaluations.

**Assistant interpretation (A001), extended by U003's retirement goal:** removing a requirement cannot leave a design appearing valid while still relying on it. Reevaluation determines whether other requirements still justify the design; removal does not automatically imply deleting it.

**Logical consequence identified by A001 from U001: new applicability requires discovery, not just reverse references.** A newly added requirement has no existing incoming links. Added requirements and broadened applicability must find affected designs that did not previously reference them. This follows from the requested behavior; a complete discovery mechanism has not been selected.

Undefined references in live designs also enter drift handling. Their presence detects an inconsistency, not which interpretation or repair is right. Expected intermediate conditions during an implementing delta need a still-unspecified handling policy.

### Batch and order the work

Several live requirements can change in one operation. Build a temporary dependency-organized view of affected designs, process fundamental prerequisites first, then work through the next ready group after upstream revisions settle.

Example: A and B both change, and C depends on both. Reevaluate C with both settled results, not once for each incoming event. The aim is to avoid reevaluating a design five times because five dirty prerequisites belong to the same batch.

**Assistant clarification (A001, provisional):** the temporary view is derived work state, not automatically a new persistent task tracker. **User direction (U001):** Grouping by impact/fix type can use deterministic code or cheaper subagents for mechanical work and stronger reasoning for judgment. Such grouping must respect dependency order; similar fixes are not permission to process an unready dependent.

No fixed routing policy, quota estimator, worker count, or mandatory multi-agent protocol is selected. Open scheduling choices include batch boundaries, newly arriving changes, eager versus progressive invalidation, cycles, unchanged-contract pruning, parallel ready work, shared-file coordination, and when a design becomes clean.

## 7. Drift repair is a unit of work

**Source: U002. Assistant refinements are P7-P8, not automatically accepted by U003.**

### Plan, review, then execute

**Drift repair must be fully planned, reviewed, and then executed.** Detecting drift is not authorization to improvise an expanding sequence of edits. Planning and review still occur when human review is skipped.

The plan format, review record, scope relative to a design delta or dirty-design batch, independent-review requirement, and completion checks are open. Fully planned does not currently prescribe planning the entire product or importing a V3 execution framework.

Repair must cooperate with dependency-first work and combined per-file edits. The plan and the delta may share structure, but they have not been declared identical.

### Human review and material choices

Michael would ideally skip human review when reasonable safe criteria are met. A candidate criterion is an agent judgment that the repair plan involves no plausible material risk or ambiguity warranting escalation. This is a policy direction, not a finished classifier or a claim that agent confidence proves safety.

The gate applies to **both interpretation and repair implementation**:

- Which of several plausible, meaningfully impactful interpretations should be followed?
- Which of several plausible, meaningfully impactful design or implementation paths should be chosen?

Pivotal choices are escalation candidates. Finding a workable edit does not settle a material choice among alternatives. Skipping human review does not skip review or grant arbitrary authority to change meaning.

### Escalation options

A choice can go to the parent agent, a more capable root agent (Michael's example is a root Astra agent), a higher-intelligence/higher-effort subagent chosen by the parent, or the user. These are alternatives, not a mandatory sequence through every tier.

Exact safe-to-proceed criteria, reviewer independence, authority boundaries, routing thresholds, unavailable escalation, unresolved questions, and invalidation of a reviewed plan remain open. No fixed model configuration or assumption about host capabilities is adopted.

## 8. New user outcomes: unjustified code and economical contraction

**Source: U003; these are user-stated outcomes, not implemented features.**

### Code must be justified by design

Raise errors in the same context as type checking for code that is not justified by a design. Use efficient internal caching/hashing and workflow integration rather than repeatedly paying compute or model cost. The user has not yet defined the coverage granularity, exact meaning of justification, conformance witness, language integration, or diagnostics format. A003/2, A003/4, hole 5, and P11 propose an implementation distinction without claiming that a link or hash proves behavior.

### Requirement removal should remove its unnecessary complexity

Removing a requirement should efficiently cause the corresponding implementation to contract toward a similar shape to what it would have had before that requirement was added. Preserve the strength of the goal: avoid massive churn and plugin overhead; narrowly minimize local compute and AI-token consumption, not merely make a plausible cleanup plan.

Michael explicitly assumes good integration points into a cohesive workflow, with known causes and expected in-progress changes. This is different from reconstructing arbitrary mystery drift from an uninvolved outside tool. The plugin should exploit accumulated, causally understood changes and batch/structure their effects; the user invites the assistant to finish the performance thought. A003/P12-P13 give the provisional interpretation, including preserving surviving obligations rather than blindly reverting history.

The user wants non-explosive scaling, potentially sublinear savings through batching. This records an objective, not a proven complexity bound. No global-minimum algorithm, benchmark result, unlimited mutation permission, or new event-store subsystem follows from this requirement.

## 9. Concrete examples

**Source: restatements of U001-U003 except where explicitly called an assistant example.**

These preserve intended behavior, not implemented tests.

**Duplicate definitions:** two eligible Markdown files define the same term under the eventual normalization rule. Report an error; do not choose one.

**Imported symbol:** `[[SomeType]]` in the relevant source-comment context resolves to the imported `SomeType`.

**Qualification:** offer a fully qualified Markdown reference only for exactly one legal matching symbol. Multiple candidates need disambiguation; a forbidden target stays forbidden.

**Combined rename:** two confirmed renames affect one file; apply both in one update for the batch.

**Joined dependencies:** dirty A and B settle before dependent C is reevaluated.

**New constraint:** a new requirement may affect several designs before any reference to it exists. Discover applicability before updating their justifications.

**Live undefined term:** a design references a term absent from its resolution context. This is drift, but the diagnostic alone does not identify the repair.

**Pivotal ambiguity:** two interpretations of the drift would change ownership or behavior differently. Address the choice in planning and consider escalation rather than silently selecting an edit.

**Reviewed unattended work:** an eligible repair may proceed without human review, but still has a plan and a review before execution. Eligibility remains to be specified.

## 10. Assistant proposals, not accepted design decisions

These proposals are retained for consideration, not adopted by default. U002's agreement with the capture arrangement and U003's skim do not accept every prior suggestion. Under U003, preserve provisional suggestions by default and record any explicit or unambiguous implicit acceptance per claim.

### P1. Separate term spelling from code-symbol identity

Prefer `[[My Term]]` and `§my_term` provisionally. Underscores are a preference, not a necessity. Unnamespaced concepts can coexist with actual qualified code-symbol identities: two modules' separate `Result` symbols should not automatically become duplicate conceptual definitions. Do not apply conceptual case folding blindly to language binding. The one-definition rule should ultimately apply to the resolved identity in its declared scope. An explicit-definition/code-symbol collision rule remains needed.

### P2. Distinguish draft vocabulary and broken bindings

Keep undefined ideation vocabulary distinguishable from broken code references or deleted definitions. U002 supersedes the earlier unresolved live case: undefined references in live designs are drift. Draft notation and implementing-delta exceptions remain open. Markdown needs enough ownership/context to apply the existing boundary policy, not a competing permission list. No resolver integration is claimed to exist.

### P3. Schedule settled inputs rather than file-save events

Combine reverse dependencies with applicability discovery and reevaluate a shared dependent after all dirty prerequisites settle. The aim is once per settled input set, not a guarantee against revisiting after new facts or revisions. Cycles need an explicit policy, such as an actionable error or deliberate joint review; none is selected. Updating derived dirty flags must not itself trigger substantive design-change loops.

### P4. Prune only when dependency-relevant promises stay unchanged

A dirty design can be reevaluated without changing the guarantees its dependents rely on. Avoid downstream work only when those particular guarantees/evidence can reliably be shown unchanged; any dependent with independently changed requirements still needs attention. Model impressions of prose equivalence are insufficient. The equality/contract rules remain open; this is not a new mandatory semantic-equivalence subsystem.

Bazel Skyframe provides an incremental-evaluation precedent, not a solution to arbitrary prose equality or complete dependency discovery.

### P5. Compute refactors from original bindings

Resolve original references, collect renames/moves, group by file, and construct one final edit per file. Sequential `A -> B` and `B -> C` string replacement could otherwise turn an original A reference into C. Reference bindings are not arbitrary text matches. Preserve justified logical identity through moves, while recognizing that public names/paths can themselves be contractual. Conflicts, ambiguity, and concurrent edits require handling, still undecided. A later genuine change can require another edit; the minimum-edit promise is per batch.

### P6. Distinguish intended satisfaction from observed behavior

A design rationale explains how a requirement is intended to be met. It does not establish measured implementation behavior. Retain checkable evidence where available and explicit unverified status otherwise. Hashes, lexical checks, and import checks prove their own properties, not the complete product. This requires honest evidence, not another certification bureaucracy.

### P7. Do not let the diagnostic silently choose the repair

A missing term can reflect an incomplete rename, a removed definition, a wrong binding, or missing implementation. Do not invent definitions, weaken requirements, or rewrite live designs to fit code just to clear the error. Resolve consequential interpretation in the repair plan.

Consider associating each allowed temporary mismatch with the implementing delta and its scope, rather than allowing any open delta to excuse unrelated drift. The mechanism and completion rule are unselected.

### P8. Escalate consequential uncertainty, not edit count

One changed token can alter a public contract, while many resolved rename edits can share an unambiguous meaning. Consider plausible alternatives, consequences, evidence, affected contracts, and reversibility. A review needs grounds beyond the implementer's confidence. A stronger model can investigate uncertainty but does not acquire user authority to choose new product intent merely by being stronger. Exact policy remains open; no universal extra review ritual is proposed.

### A003 additions: numbered assumptions, holes, and proposals P9-P13

The following entire block is **assistant-provisional**. Its numbered assumptions/holes are local to A003 and are not new user requirements. The outcome being interpreted is U003; only a later explicit or unambiguous implicit user approval can adopt an individual mechanism.

### A003: provisional interpretation and proposals

**Attribution:** assistant interpretation, not blanket user approval. U003 explicitly retains suggestions as provisional until explicit or unambiguous implicit acceptance. Numbers 1-7 are local to A003; bracketed numbers in the holes refer to these assumptions. This is a substantive capture, not a verbatim transcript.

### Direction and high-leverage assumptions

The assistant sees software growing and contracting with its current reasons for existing, not merely accumulating patches. Proposed completion of the unfinished thought: more causally understood, overlapping edits before reconciliation can collapse into one net change instead of repeated repair cascades. This is an optimization target, not a measured result.

1. **Managed batches / Known causes.** Extend the user's integrated-workflow premise into explicit batch boundaries, expected changes, and a final state to reconcile. Record events cheaply rather than repair after every save. Use deltas as transition context, not permission to treat unaccepted requirement drafts as live truth. Unknown external changes require recovery rather than defining normal cost.

2. **Concern coverage / Inherited ownership.** Justify code at coherent responsibility boundaries; internal helpers may inherit the owner's design accountability, with finer bindings where independent behavior warrants them. Do not require a handwritten miniature design for every line or helper. Inheritance is accountability, not automatic conformance or a blanket directory-glob permission. Granularity remains undecided.

3. **Current reasons / Shared support.** Retain why a design choice or implementation is still needed, not merely which event introduced it. Distinguish motivating requirements, constraints, and dependencies, including shared/conditional support. Requirement removal retracts a reason and reopens choices while preserving other live obligations and independent later improvements. Compatibility or durable-state obligations count when relevant. This interprets snap-back as current-state simplification, not historical commit reversal; no dependency algebra is selected.

4. **Incremental checks / Bounded reasoning.** Deterministically check references, coverage, structural rules, and current verification. Restrict AI reasoning to changed semantic obligations during planned work, not every save. Cache against actual dependency-relevant inputs, referenced parts, membership queries, and applicable checker/resolver/policy versions. Hashes establish identity/currentness, not truth. Narrow invalidation requires a complete-enough relevant contract, not simply a short link.

### Remaining material holes

5. **Rubber-stamp coverage / Justification gap.** A valid code-to-design link can prove that an owner exists without proving the behavior belongs there. Need an operational definition of justified code, scoped contract checks, and meaningful delta review; otherwise a broad design becomes a permission slip. Repeated whole-project AI audits would defeat the economics. [2, 4]

6. **Missing edges / Applicability gap.** New requirements, broadened scopes, or new consumers can matter before any link exists. Bounded discovery must notice newly applicable obligations and changed or previously empty query populations, or the system efficiently ignores necessary work. [3, 4]

7. **Structural residue / Sticky choices.** Deleting orphaned code is insufficient when a retired requirement justified a framework, extra layer, or storage strategy that still has dependents. Reconsider those choices and surviving support, not only reference counts, or the code shrinks superficially while the complexity remains. The gap is bounded, causally informed simplification, not a universal inverse edit or unique global optimum. [2, 3]

These are value-critical gaps to solve, not demonstrated fatal flaws. Existing open questions about cycles, names, and recovery are not relabeled as new headline objections.

### P9: subreference syntax

Propose familiar forms:

```text
[[Player Evidence#Origin#System events]]
[[SomeClass.someProperty]]
[[Playback Design#<part-id>]]
```

The first follows Obsidian nested heading links. The second follows familiar symbol-member reference syntax; TypeDoc also uses `#` for instance members, making `[[SomeClass#someProperty]]` a possible disambiguation. Neither example settles a cross-language grammar. The third is deliberately a placeholder: design-part types, identities, and schema are still undefined.

Resolve through document/language context, not spelling alone. Refactoring should update bound subreferences when headings/members move or rename. A part's relevant enclosing contract may also need tracking; hashing its text alone can miss a changed meaning. Escaping, duplicate headings, overloads, stable identity versus path, and section-sign shorthand remain open.

### P10: bounded selectors, separate from exact references

Defensible uses are 'every implementation of this audio interface' and 'all design elements governed by this requirement'. These cover newly added members without maintaining a manual list. Propose a distinct scoped set-query form rather than silently making `[[...]]` return multiple targets. Exact references expect one legal target; queries deliberately return sets. No full CSS language, cascade, specificity policy, positional identity, design-part taxonomy, or tag semantics are selected.

Track query definitions, bounded search populations, and changing membership, including initially empty sets. Hashing only previous matches misses newcomers. Use indexed, change-driven query maintenance rather than unconditional rescans. Structural selection is not semantic understanding of arbitrary prose.

### P11: unjustified-code diagnostics

U003 requests errors alongside type checking. Proposed mechanical errors cover missing design ownership, broken bindings, prohibited dependencies, and absent/stale required conformance evidence. Changed behavioral justification still requires relevant checks/review. A hash or design link cannot certify arbitrary semantic correctness. Unchanged previously checked code should not trigger another model call on every editor check.

Illustrative diagnostic: `Unjustified implementation: AudioPreview.cache has no current design owner.` It does not fix the checking granularity or diagnostic syntax. The allowed temporary state during an implementing delta remains to be defined and must not excuse unrelated live drift.

### P12: retirement and simplification

Proposed target: preserve surviving accepted meaning and justified later improvements, remove requirement-specific behavior and avoidable support machinery, and simplify affected designs under the remaining obligations. Do not promise byte-identical history, a unique canonical architecture, or automatic deletion of shared infrastructure.

Example: R1 needs playback, R2 adds a cache/strategy, and R3 later needs part of it. Removing R2 should reevaluate the cache/strategy, retain what R1/R3 still need, and simplify the remainder. A pivotal alternative uses planned/reviewed escalation. Support may be alternative or conjunctive; raw reference counts are insufficient. Cyclic references without a live justification root must not preserve orphaned machinery. These are proposed requirements on a future support model, not a selected schema.

Minimum immediate edits and minimum lasting structural complexity are not identical. Avoiding churn should not mean preserving unnecessary architecture; neither should simplifying justify global rewrites or cosmetic renaming.

### P13: net-change economics

Propose: ingest known events cheaply; coalesce safely canceling or superseded intermediate changes within the batch; determine the union of affected dependencies; settle upstream designs before downstream review; prune propagation where the relevant guarantees demonstrably remain unchanged; combine all final changes into one update per affected file. Events already producing durable/external effects cannot be canceled merely because their input text later reverts. Preserve the historical record.

Expensive work should track distinct net-affected regions and real semantic decisions, not event count multiplied by repository size or repeated traversal of overlapping closures. Related edits can share work. Independent consequences still require independent necessary work; a global requirement may genuinely have repository-wide impact. N distinct files that must change still require N writes.

Sublinear savings are plausible relative to repository size for local warm changes, or relative to separate overlapping passes, not universally below necessary input/output work. Count ingestion, index maintenance, cold start, recovery, review, validation, and writes. No benchmark or mathematically minimal implementation is claimed. The user's strict compute/token/churn objective remains a governing requirement, not an optional nicety.

### Research context, not product authority

- Obsidian internal links: https://help.obsidian.md/links . Successive `#` components address headings/subheadings in wikilinks. This is an Obsidian convention, not standard Markdown.
- TypeDoc: https://typedoc.org/documents/Declaration_References.html and https://typedoc.org/documents/Tags.__link_.html . Context-aware symbol/member links and `.`/`#` resolution are precedent, not a language-agnostic resolver implementation.
- ESLint: https://eslint.org/docs/latest/extend/selectors . CSS-like AST selectors can match structural/attribute patterns. They do not establish semantic applicability or require CSS cascade semantics.
- Bazel Skyframe: https://bazel.build/versions/8.6.0/reference/skyframe . Tracked dependencies and unchanged-value pruning are precedent for avoiding repeated downstream work; they do not solve prose equivalence or unknown dependency discovery.


### External precedents retained from A001

These informed assistant suggestions, not V4 authority or required dependencies. Their relevant contributions are described above; understanding this spec does not require opening them.

- Bazel Skyframe: dependency tracking and change pruning when recomputed values are unchanged. https://bazel.build/versions/8.6.0/reference/skyframe
- Nx module boundaries: project-tag dependency constraints as a possible permission input. This is not an implementation of Markdown reference resolution. https://nx.dev/docs/features/enforce-module-boundaries

## 11. Remaining design frontier

Michael has not finished elaborating V4. Preserve that fact rather than filling gaps with V3 machinery.

Unselected details include term normalization/namespaces/definition scope; symbol and document contexts; supported languages; tag semantics; design placement; stable requirement addressing through wording and path changes; applicability discovery; the exact dependency-relevant design surface; design-delta parts/schema/lifecycle; dirty-state representation and cycle handling; refactor detection and concurrency; safe review/escalation policy; completion evidence; subreference grammar and stable part identity; exact-reference versus set-query syntax and query invalidation; code-justification coverage and conformance evidence; surviving support and simplification on retirement; cost bounds and accounting; and the remaining implementation-generation loop.

**This revision adds user direction (U003):** default retention of clearly attributed provisional suggestions, precise subreferences, typecheck-context diagnostics for code without design justification, and low-overhead requirement retirement under a causally integrated workflow. **It retains assistant-provisional:** A003 assumptions 1-4, holes 5-7, and P9-P13. P1-P8 are not silently promoted. Existing U001/U002 direction is retained. No V4 runtime, selector engine, conformance checker, or performance claim has been implemented or established.
