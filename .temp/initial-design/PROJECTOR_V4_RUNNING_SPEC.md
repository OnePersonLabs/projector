# Projector V4: running specification

**Revision 0.2** · Captured through U002 and assistant proposals A002.  
**Status:** incomplete conception in active conversation, not approved for implementation.  
**Authority:** Michael's stated direction. Assistant proposals remain separately labeled.

## 1. Blank slate and durable conversation

V4 starts from a blank design slate. V3 remains reference material, not inherited architecture. No V3 schema, terminology, execution machinery, or obligation transfers automatically. Existing components can be considered later without an obligation to reuse them.

Maintain two files in `OnePersonLabs/projector`, branch `v4`, under `.temp/initial-design/`:

- **`PROJECTOR_V4_RUNNING_SPEC.md`:** this self-contained current-state specification. Integrate corrections here rather than accumulating contradictory historical versions.
- **`PROJECTOR_V4_INITIAL_CAPTURE.md`:** the append-only conversation capture, retaining its original filename and original bytes. Append user additions/corrections and separately attributed assistant interpretations/proposals. Replaying the capture must recover the current conception, tentative choices, and unresolved questions without earlier chats.

Update both at the end of each response in this continuing design conversation. Later user direction supersedes earlier direction; an assistant suggestion is not adopted merely because it appears in the spec. Append corrections to the history instead of rewriting old entries. Read the branch's current files before subsequent updates and keep both updates in one commit where possible; do not overwrite intervening work. Prose replay supports faithful semantic reconstruction, not a promise of byte-identical synthesis.

The `v4` working tree starts with only these records and `.gitignore` copied from main commit `0a01dacc694793daea28f416372671554ac9b4e7`, adjusted to track this directory while excluding other temporary output. Main and V3 remain untouched; the new branch retains Git ancestry without carrying V3 working-tree files. This authorizes repository setup, not a V4 implementation. The documentation capture arrangement does not prescribe a product event-store subsystem.

## 2. OpenSpec and the purpose of V4

**Projector is symbiotic with OpenSpec.** An initialized OpenSpec project is required. OpenSpec owns the requirement/specification layer; assume its latest version is sufficient, including nested live specs.

Monitor **added, modified, and removed requirements in live specs**, not proposed requirements in OpenSpec's `changes/` directory. A proposed change is not accepted live meaning merely because it appears there.

The captured direction combines resolvable terms and code symbols, complete economical refactoring, designs justified against their applicable requirements, and automatic invalidation with dependency-ordered reevaluation. The remaining implementation-generation loop has not been specified.

The motivation is understandable concern ownership: humans and agents should locate a concern, understand its contract, and work within its responsibility without reconstructing unrelated implementation. Some relationships are hierarchical and others cross-cutting. Specifications, designs, and code should express compatible ownership. This is not a mandate for one package, file, or entity per term, or for a global ontology. Human understanding and total work economics matter, not just machine-readable completeness.

## 3. Terms, references, and tags

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

## 4. Complete refactoring with minimal edits

Detect renames/moves and enforce completeness for supported references to terms, code symbols/types, package names, specs, nested spec paths, and renamed ancestor path segments. Hooks are a candidate mechanism, not a chosen host API.

Collect related refactors before updating files. If two renames affect many of the same files, combine their applicable changes and update each affected file **once per refactor pass**, rather than running a separate whole-repository pass for each rename.

Completeness concerns supported reference bindings, not arbitrary prose matches or unrelated formatting. Logical rename detection versus deletion/addition, collisions, swaps, simultaneous changes, verification, and concurrent edits remain open. No string-only or filename-only inference is approved.

## 5. Designs, live truth, and design deltas

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

### Detect affected designs

Modifying a live requirement automatically invalidates referencing designs and arranges reevaluation. Michael proposes dirty flags on design files; storage/serialization is open. Changes to a depended-on design must also lead to consideration of its dependents. Accumulate multiple invalidation reasons instead of immediately repeating evaluations.

Removing a requirement cannot leave a design appearing valid while still relying on it. Reevaluation determines whether other requirements still justify the design; removal does not automatically imply deleting it.

**New applicability requires discovery, not just reverse references.** A newly added requirement has no existing incoming links. Added requirements and broadened applicability must find affected designs that did not previously reference them. This follows from the requested behavior; a complete discovery mechanism has not been selected.

Undefined references in live designs also enter drift handling. Their presence detects an inconsistency, not which interpretation or repair is right. Expected intermediate conditions during an implementing delta need a still-unspecified handling policy.

### Batch and order the work

Several live requirements can change in one operation. Build a temporary dependency-organized view of affected designs, process fundamental prerequisites first, then work through the next ready group after upstream revisions settle.

Example: A and B both change, and C depends on both. Reevaluate C with both settled results, not once for each incoming event. The aim is to avoid reevaluating a design five times because five dirty prerequisites belong to the same batch.

The temporary view is derived work state, not automatically a new persistent task tracker. Grouping by impact/fix type can use deterministic code or cheaper subagents for mechanical work and stronger reasoning for judgment. Such grouping must respect dependency order; similar fixes are not permission to process an unready dependent.

No fixed routing policy, quota estimator, worker count, or mandatory multi-agent protocol is selected. Open scheduling choices include batch boundaries, newly arriving changes, eager versus progressive invalidation, cycles, unchanged-contract pruning, parallel ready work, shared-file coordination, and when a design becomes clean.

## 7. Drift repair is a unit of work

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

## 8. Concrete examples

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

## 9. Assistant proposals, not accepted design decisions

These proposals are retained for consideration, not adopted by default. U002's agreement with the capture arrangement does not accept every prior suggestion.

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

### External precedents retained from A001

These informed assistant suggestions, not V4 authority or required dependencies. Their relevant contributions are described above; understanding this spec does not require opening them.

- Bazel Skyframe: dependency tracking and change pruning when recomputed values are unchanged. https://bazel.build/versions/8.6.0/reference/skyframe
- Nx module boundaries: project-tag dependency constraints as a possible permission input. This is not an implementation of Markdown reference resolution. https://nx.dev/docs/features/enforce-module-boundaries

## 10. Remaining design frontier

Michael has not finished elaborating V4. Preserve that fact rather than filling gaps with V3 machinery.

Unselected details include term normalization/namespaces/definition scope; symbol and document contexts; supported languages; tag semantics; design placement; stable requirement addressing through wording and path changes; applicability discovery; the exact dependency-relevant design surface; design-delta parts/schema/lifecycle; dirty-state representation and cycle handling; refactor detection and concurrency; safe review/escalation policy; completion evidence; and the remaining implementation-generation loop.

**This revision establishes:** repository-backed snapshot plus append-only capture, undefined references in live designs as drift, live truth except during implementing design deltas, tentative design deltas, and planned/reviewed repair with conditional human review and escalation for consequential interpretation or implementation choices. P7 and P8 are additional assistant proposals. No V4 runtime has been implemented.
