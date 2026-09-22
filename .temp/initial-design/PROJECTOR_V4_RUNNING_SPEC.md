# Projector V4: running specification

**Revision 0.7** · Captured through U009 and assistant synthesis A007.  
**Status:** incomplete conception in active conversation, not approved for implementation.  
**Authority:** Michael's stated direction. Assistant proposals remain separately labeled.

**Attribution key:** U001-U006 identify user messages in the sibling capture; A001-A006 identify assistant interpretations/proposals. User-derived meaning can be cleaned up without changing intent. Assistant assumptions are provisional until explicitly or unambiguously implicitly approved, with the specific approval evidence recorded. Neither a skim nor silence is blanket approval. This specification is a current-state view; the append-only file preserves the event trail.

## 1. Blank slate and durable conversation

**Source: U001-U003.**

V4 starts from a blank design slate. V3 remains reference material, not inherited architecture. No V3 schema, terminology, execution machinery, or obligation transfers automatically. Existing components can be considered later without an obligation to reuse them.

Maintain two files in `OnePersonLabs/projector`, branch `v4`, under `.temp/initial-design/`:

- **`PROJECTOR_V4_RUNNING_SPEC.md`:** this self-contained current-state specification. Integrate corrections here rather than accumulating contradictory historical versions.
- **`PROJECTOR_V4_INITIAL_CAPTURE.md`:** the append-only conversation capture, retaining its filename and clear attribution. Append user additions/corrections and separately attributed assistant interpretations/proposals. Replaying the capture must recover the current conception, tentative choices, and unresolved questions without earlier chats.

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

**Source: U001, with live-reference truth from U002, subreference support from U003, the reference convention established by U005, and the separate proposed resolution policy in U006.**

### Reference notation

**Established convention (U005, agreed in A005): all term references use `[[...]]`.**

| Form | Meaning |
| --- | --- |
| Leading `# My Term` in an eligible Markdown file | Explicit term definition; eligibility rules remain to be selected |
| `[[Term Name]]` | Human-readable conceptual term reference |
| `[[term_name]]` | Underscore-separated spelling of the same conceptual term |
| `[[somepackage.SomeType]]` | Qualified code-symbol reference, resolved in its document/language context |
| `@Tag` | Mentioned, but semantics not yet defined |

The spaced and underscore-separated conceptual forms denote the same identity, not competing definitions. Conceptual matching remains case-insensitive as stated in U001. Qualification and subreferences occur inside the brackets; their full grammar remains open. Supporting a qualified code name does not settle conceptual namespaces or override language-aware resolution and import boundaries.

Exact normalization of punctuation, repeated separators, Unicode, acronyms/camel case, and collisions remains open. U006 now proposes that `[[Some Type]]`, `[[SomeType]]`, and `[[some type]]` may resolve to the same uniquely named code symbol, with an eligible Markdown definition taking precedence. This is recorded below as a proposed policy, not retroactive adoption of arbitrary normalization. Michael previously leaned against namespaces for conceptual terms; that question remains open.

### Definitions and uniqueness

Explicit terms are recognized only in Markdown matching an intentionally limited, still-unspecified path/pattern scope. Arbitrary H1 headings outside that scope are not automatically definitions.

**A term may have only one definition.** Duplicate definitions produce errors with the seriousness and visibility of type-check errors, not silent nearest/newest winners. The precise identity scope, and how explicit definitions interact with same-named code symbols, still need definition.

A logical code symbol can also define a term. The intended model is language-agnostic; no initial language set or parser architecture is selected.

### Contextual resolution and qualification

**Prior direction (U001):** the contextual lookup rule below predates the separately proposed global-default rule in U006. The two priorities are alternatives for bare references, not simultaneously applicable rules; adoption of U006 remains pending. Boundary-permission constraints are not removed by the proposal.

References must resolve from where they occur. If a class imports `SomeType`, `[[SomeType]]` in its comment should resolve to that imported symbol, not an arbitrary repository-wide match.

A Markdown reference also needs a resolution context. How a document acquires an owner, imports, or explicit qualifications is open.

An unresolved code-symbol reference is an error. Offer a fully qualifying autofix only when **exactly one** matching symbol is accessible from that reference context without violating configured import/module boundaries. Zero or multiple legal candidates do not justify an automatic choice. Qualification must not bypass a boundary. Nx and dependency-cruiser are examples of boundary-policy providers, not selected dependencies. When an offered fix may be applied automatically is not settled.

### Global default ownership (U006/A006; approved by U007)

Michael proposes that an unqualified `[[Some Type]]`, `[[SomeType]]`, or `[[some type]]` name may resolve to the unique corresponding code symbol anywhere in the project, irrespective of its namespace, unless an eligible Markdown `# <term>` definition claims that term. That Markdown definition takes precedence for unqualified references; code references then require qualification. Unqualified and qualified names may otherwise reach the same code symbol. This supplies the subject of U005's unfinished fragment, but is expressly a new proposal, not automatic acceptance of a resolver implementation.

**Provisional A006 recommendation:** use this as a global default-name rule for references, not a requirement for globally unique source-code declarations. Several legitimate code symbols may share a normalized name; in the absence of a Markdown owner, only the ambiguous bare references error and need qualification. Multiple eligible Markdown definitions for the same normalized term remain errors. An explicit qualified code reference bypasses Markdown default ownership but not any applicable boundary policy.

| Eligible Markdown definitions for the normalized name | Distinct indexed code targets | Proposed unqualified resolution |
| --- | --- | --- |
| One | Any number | The Markdown term |
| None | One | That code symbol |
| None | More than one | Ambiguous reference; qualify it |
| None | None | Unresolved reference; live-design drift under U002 |
| More than one | Any number | Duplicate definition error; no fallback winner |

**Interpretation change to make explicit:** the proposed global rule replaces import-local selection for unqualified double-bracket references. Imports would not secretly disambiguate a globally ambiguous bare name or defeat an explicit Markdown owner. Normal source-language imports and name binding are not changed. The earlier U001 contextual rule remains the prior direction until this proposed revision is adopted. Reference location can still determine whether a resolved code target is permitted and how to construct its legal qualification; lookup priority is a separate question.

**A006 normalization proposal:** compare case-folded names after removing spaces and underscores, preserving other punctuation unless separately specified. This makes `Some Type`, `SomeType`, `some type`, and the previously established `some_type` spelling share a lookup key. It is formatting normalization, not fuzzy matching. Apply the same key rule to eligible Markdown names and code default-name candidates. Exact qualified code paths retain language-aware symbol identity and punctuation; distinct symbols that collapse to one default key are ambiguous rather than merged.

**A006 population proposal:** count distinct logical, referenceable project declarations, not every local variable, member short name, or installed library symbol. Members remain available by subreference. Deduplicate several export/import aliases only when the language adapter establishes that they refer to the same logical declaration; similarly named unrelated declarations remain separate. What declarations qualify, external-library participation, and how unavailable/unsupported indexing is represented remain open. The tool must not claim global uniqueness from an incomplete candidate population. This narrows the user's broad wording and is therefore explicitly provisional.

**A006 binding-change proposal:** an added Markdown owner, a new colliding code symbol, a rename, or a removed owner must invalidate affected saved bindings. Do not silently redirect existing code references to a new Markdown term, or silently fall back from a deleted Markdown definition to same-named code. Planned/reviewed work can intentionally accept the new owner or qualify references that must preserve the former target. A delta may approve the transition in a batch; no mandatory human approval for every such change is implied.

The code remains free of required Projector design annotations. Ambiguity should be repaired at references rather than pressuring developers to rename otherwise valid classes to satisfy the plugin. Provisional implementation: cache normalized name-to-owner/candidate membership and reverse reference uses; update the affected name keys when relevant definitions change rather than globally rescanning on each lookup. The cache must watch owner absence and candidate-set membership, not only the currently selected target. No resolver, code export filter, or performance bound is implemented by recording this proposal.

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

**Source: U001-U002, extended and corrected by U004. Nested designs are now fundamental; exact design-part types and grammar remain unapproved.**

### Design responsibility and justification

A design retains a solution for a reasonably minimal, coherent responsibility surface. A new requirement can justify a different design/implementation, not merely another addition to the existing solution. Reevaluation may instead retain the current design.

Each design explicitly names the requirements it satisfies and provides concise justification/evidence:

- **Primary:** the requirements the design exists to fulfill.
- **Secondary/applicable:** other requirements that constrain it because of scope, behavior, dependencies, or another applicability criterion.

Secondary does not mean optional. These labels explain the distinction; they do not prescribe a schema. A design can depend on another design, affecting understanding, invalidation, and scheduling.

### Design-side bindings and tool independence

**User correction (U004), superseding A003 hole 5's code-to-design wording:** designs justify and reference implementation artifacts; source code must not be required to reference designs. Projector must remain a non-dominating plugin that preserves human understandability and developers' ability to change tools.

Store the required justification in the design, including why a distinct artifact exists or why it was modified. Reverse lookup for diagnostics does not imply a reverse annotation in code. A003's question about substantive justification remains relevant, but mandatory source-side design citations are explicitly rejected.

U001's optional contextual term/symbol references in source comments are not silently forbidden by this correction. They must not become required design-coverage annotations across the codebase. No mandatory Projector imports, decorators, IDs, or source tags are inferred.

### Nested designs and progressive disclosure

**User requirement (U004): nested subdesign structure and progressive disclosure are fundamental to designs**, not an optional future viewer feature. Designs can contain architectural decisions at their own level and at nested subdesign levels. They must allow readers to start with higher-level meaning and enter deeper detail as needed.

**User direction under elaboration (U004):** use a formal, lintable structure for design parts and potentially part-type-specific children, subheadings, or expected lists. The desired form is analogous to specs in structural discipline, not a requirement to reuse OpenSpec scenario keywords. No exact part taxonomy, header grammar, directory layout, file-per-node policy, inheritance model, or delta schema has yet been approved. Nested-design support is settled; those mechanics remain open.

### Criteria-driven evidence and concise decisions

**User direction (U004):** establish criteria, potentially a decision matrix, to determine what evidence belongs in a design to justify a distinct artifact or artifact modification. Retain architectural choices and concise evidence supporting them versus plausible alternatives in an efficient, validatable inline form.

This is not permission to replace justification with a bare address, invent alternatives to fill a quota, or label an untested assertion as an observed result. Those safeguards and the concrete matrix below are assistant proposals. The user has not selected an evidence engine, prescribed every field, or adopted Evidence's workflow wholesale.

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

Raise errors in the same context as type checking for code that is not justified by a design. Use efficient internal caching/hashing and workflow integration rather than repeatedly paying compute or model cost. U004 explicitly places the required justification and references in designs, not annotations in source code, and proposes criteria/a decision matrix to determine the needed evidence. Coverage granularity, exact conformance witnesses, language integration, and diagnostic format remain open. A003/2, A003/4, and P11 remain provisional except that hole 5's code-to-design wording is superseded below.

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

The bracketed reference forms are established in section 3 by U005. The following identity-related proposals remain provisional: Unnamespaced concepts can coexist with actual qualified code-symbol identities: two modules' separate `Result` symbols should not automatically become duplicate conceptual definitions. Do not apply conceptual case folding blindly to language binding. The one-definition rule should ultimately apply to the resolved identity in its declared scope. An explicit-definition/code-symbol collision rule remains needed.


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

The following block remains **assistant-provisional** except where an explicit U004 correction is noted. Its numbered assumptions/holes are local to A003 and are not new user requirements. The outcome being interpreted is U003; only a later explicit or unambiguous implicit user approval can adopt an individual mechanism.

### A003: provisional interpretation and proposals

**Attribution:** assistant interpretation, not blanket user approval. U003 retains suggestions as provisional until explicit or unambiguous implicit acceptance. Numbers 1-7 are local to A003. The running view corrects hole 5 under U004; the original wording remains untouched in the append-only capture.

### Direction and high-leverage assumptions

The assistant sees software growing and contracting with its current reasons for existing, not merely accumulating patches. Proposed completion of the unfinished thought: more causally understood, overlapping edits before reconciliation can collapse into one net change instead of repeated repair cascades. This is an optimization target, not a measured result.

1. **Managed batches / Known causes.** Extend the user's integrated-workflow premise into explicit batch boundaries, expected changes, and a final state to reconcile. Record events cheaply rather than repair after every save. Use deltas as transition context, not permission to treat unaccepted requirement drafts as live truth. Unknown external changes require recovery rather than defining normal cost.

2. **Concern coverage / Inherited ownership.** Justify code at coherent responsibility boundaries; internal helpers may inherit the owner's design accountability, with finer bindings where independent behavior warrants them. Do not require a handwritten miniature design for every line or helper. Inheritance is accountability, not automatic conformance or a blanket directory-glob permission. Granularity remains undecided.

3. **Current reasons / Shared support.** Retain why a design choice or implementation is still needed, not merely which event introduced it. Distinguish motivating requirements, constraints, and dependencies, including shared/conditional support. Requirement removal retracts a reason and reopens choices while preserving other live obligations and independent later improvements. Compatibility or durable-state obligations count when relevant. This interprets snap-back as current-state simplification, not historical commit reversal; no dependency algebra is selected.

4. **Incremental checks / Bounded reasoning.** Deterministically check references, coverage, structural rules, and current verification. Restrict AI reasoning to changed semantic obligations during planned work, not every save. Cache against actual dependency-relevant inputs, referenced parts, membership queries, and applicable checker/resolver/policy versions. Hashes establish identity/currentness, not truth. Narrow invalidation requires a complete-enough relevant contract, not simply a short link.

### Remaining material holes

5. **Justification gap (direction corrected by U004).** Designs must justify code, not require code to reference designs. A design-side binding still does not alone prove the implementation belongs there. U004 supplies the direction for addressing this: criteria or a decision matrix determine the evidence required to justify an artifact or its modification. P17 proposes a matrix; exact evidence/conformance rules remain open. A broad design must not become a permission slip, and repeated whole-project AI audits would defeat the economics. [2, 4]

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

Resolve through document/language context, not spelling alone. Refactoring should update bound subreferences when headings/members move or rename. A part's relevant enclosing contract may also need tracking; hashing its text alone can miss a changed meaning. Escaping, duplicate headings, overloads, and stable identity versus path remain open.

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

### A004: revised justification direction, nested designs, and Evidence

**Status:** P14-P18 and the proposals in A004 are approved by U007. Exact syntax remains illustrative where it was explicitly labeled illustrative.

### P14 (approved by U007). One-way authored bindings; derived reverse lookup

Keep required implementation bindings, reasons, evidence, and review detail in readable designs. A disposable reverse index can map observed code units back to those bindings and issue diagnostics without injecting design references into the code. Coverage population must still be observed independently: querying only already-bound artifacts cannot discover unjustified additions.

Proposed removability test: removing Projector and its explicit checking/hook integration should leave ordinary code, builds, and tests understandable and usable without rewriting source annotations or importing a Projector runtime. This is a test of tool independence, not a promise that deleting the checker retains its enforcement or that generated product code is forbidden. No duplicate authored code-to-design registry is needed by this proposal.

### P15 (approved by U007). Concern hierarchy, contract-directed disclosure

Nest subdesigns by responsibility, not by artifact category or an automatic one-to-one mirror of folders/classes. A parent explains the concern, its externally relevant promises, and the responsibilities delegated to children; a child owns its internal decisions. Readers should not have to load every child's internals to understand the parent.

Keep applicable parent obligations available by reference rather than copying their prose into each child. Inheritance does not mean every global rule applies to every descendant, or that a child can silently weaken a parent contract. Cross-cutting requirements and dependencies still form explicit graph links; the containment tree is not a complete dependency graph.

A child implementation change need not dirty all ancestors and siblings merely because it is nested. Proposed invalidation follows actually relied-on parts and guarantees, including changed child membership where the parent relies on that composition. This reuses P4's still-provisional unchanged-contract pruning. A child's exported guarantee changing does affect its users. Do not manufacture an all-descendants hash as every parent's universal dependency.

### P16 (approved by U007). A small candidate part structure

Candidate readable parts are **Contract**, **Decisions**, **Realization**, and **Subdesigns**. This is a proposal, not an approved universal document template or four required files. A Decision may have typed subparts for its requirement basis, chosen option, rationale, material alternatives, implementation consequences, evidence, and reopening conditions. The policy matrix determines which are required for the case; routine work should not expand into a full architectural essay.

The useful primitive is a small argument: under these requirements and conditions, choose this option rather than that credible alternative, producing this implementation consequence, supported by this evidence. Record why the implementation has its shape, not a post-hoc story for arbitrary code. The same Decision part could be an addressable delta/invalidation unit; this is a candidate answer to 'parts', not a settled design-delta schema.

### P17 (approved by U007). Evidence obligations are conditional, not universal paperwork

Proposed matrix:

| Trigger | Minimum proposed design content |
| --- | --- |
| Internal artifact or modification already explained by an accepted decision | Bind the artifact/change to the applicable decision; reuse current relevant evidence and run the affected checks. No invented alternatives. |
| New owner, boundary, dependency, abstraction, or meaningful implementation strategy | Name the motivating requirements and criteria; explain the chosen shape versus the strongest credible simpler alternative, including not adding the structure where viable; record the consequential tradeoff. |
| A decision depends on an empirical or failure-sensitive claim, such as latency, concurrency, or persistence | Add the discriminating measurement, test, trace, or review needed for that claim, its conditions, and actual result; mark missing evidence explicitly. Existing interpretation/repair escalation policy still applies. |

Rows can accumulate; they are triggers, not exclusive risk tiers or a score claiming objectivity. Criteria route the evidence burden, not an automatic winner. A measured tradeoff needs a measurement; a rationale need not invent numeric scoring. Selecting criteria, mandatory proof kinds, exceptions, and materiality remains open. Existing binding and conformance gaps are addressed by this policy direction, not magically proved solved.

Propose linting part shape, required fields selected by the matrix, reference resolution, conflicting evidence/exclusion statements, applicable coverage, and evidence currentness. Content truth still depends on the relevant observations/checks and reviewed reasoning. A fingerprint proves neither an empirical outcome nor reviewer independence. Relevant dependencies include the decision/criteria, cited requirements, implementation target, and checker environment where material; hashing only the target can miss changed reasons.

Illustrative format only, with invented requirement and code/test names:

```markdown
## Decision: retain the prepared preview
Requires: [[Preview#Immediate replay]]
Choice: Keep the current decoded buffer until replacement or closure.
Alternative: Regenerate the buffer on each replay.
Reason: Avoid regeneration during replay; retain one buffer instead.
Realizes: [[PreviewPlayer.replay]]
Evidence: [[PreviewTests.reusesPreparedBuffer]]; pending execution.
Evidence: Replay-latency measurement; not yet available.
Reopen: Replay timing or buffer-lifetime requirements change.
```

This is a rationale awaiting appropriate evidence, not a claim that a cache is required or that a test proves latency. Identifiers, field names, and grammar are examples, not adopted schema. Canonical review information should remain visible enough for a human to understand; do not assume hidden HTML annotations are the desired authoring UX.

### P18 (approved by U007). Connect evidence to requirement retirement

The decision's requirement basis, tradeoff, and implementation consequences provide a place to retain current reasons for a structure. Removing a replay-timing requirement can reopen the buffer-retention decision rather than merely delete a requirement link. Remaining consumers, requirements, and other legitimate benefits still count; simplify only where the structure loses sufficient justification. Prefer current-state reevaluation over replaying a historic Git inverse.

This sharpens A003 hole 7 (structural residue). The matrix supplies a candidate answer to hole 5's evidence question while U004 rejects its source-annotation direction. Hole 6 (new applicability) remains: neither nested documents nor existing citations discover all newly relevant requirements by themselves. No new mandatory framework or comparative research campaign follows.

### Evidence repository: inspected facts versus proposed transfer

**Source-derived, not V4 authority:** inspected `wrtnlabs/evidence` repository snapshot `9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e`, README, its Evidence Graph project contract, and `IEvidenceConfig.ts`. This was a source/documentation review, not an installation or benchmark run.

The documented convention is `@evidence <target> <reason>`, with separate justified exclusions and reviews. Claim/reference configuration selects the populations that must be acknowledged. Explicit structural ancestry can let an acknowledgement cover selected descendants, rather than relying on string-prefix containment. Reviews are separate from acknowledgements and can be required to match a current cited-unit/subtree fingerprint. The source expressly distinguishes graph completeness/currentness from whether reasons are true; the checker cannot establish who actually reviewed something.

Its common examples put annotations in source documentation, but the project contract permits every supported artifact family to be both claim host and reference target. Thus Markdown designs citing programming targets fit its documented general model; the mechanism is not intrinsically code-annotation-only. This is a source-grounded compatibility observation, not a tested V4 configuration or a claim of sufficient coverage of every implementation artifact. The public config interface also describes cross-family populations.

Its Markdown adapter documents file/H1-H4 structural units. That supplies a nested outline/addressing precedent, not V4's typed design-part schema or progressive-disclosure ownership policy. Its documentation explicitly says standalone code references are file-qualified and do not provide compiler import-scoped symbol lookup; that does not satisfy U001's imported-symbol reference example by itself. General language support and source populations have declared limitations. No perfect conformance or economic advantage for V4 is inferred from the repository's promotional claims or upstream benchmark.

**Proposed transfer:** concise target-plus-reason, scoped coverage, explicit non-applicability when relevant, and separately checkable review currentness, authored in designs. Do not automatically inherit source tags, all-functions-by-all-rules checklist policies, hidden rationale, manual fingerprint editing, Evidence as a dependency, or a new requirement authority. Bulk cross-products would conflict with V4's narrowly minimal work goal.

Sources retained for checking; the description above is self-contained:
- https://github.com/wrtnlabs/evidence/blob/9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e/README.md
- https://github.com/wrtnlabs/evidence/blob/9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e/.agents/skills/project/evidence/SKILL.md
- https://github.com/wrtnlabs/evidence/blob/9b5bfdd7f7affed0c27bd74cd2f425ac008fd25e/packages/evidence/src/structures/IEvidenceConfig.ts

## 11. Remaining design frontier

Michael has not finished elaborating V4. Preserve that fact rather than filling gaps with V3 machinery.

Unselected details include term normalization/namespaces/definition scope; symbol and document contexts; supported languages; tag semantics; design placement; stable requirement addressing through wording and path changes; applicability discovery; the exact dependency-relevant design surface; design-delta parts/schema/lifecycle; dirty-state representation and cycle handling; refactor detection and concurrency; safe review/escalation policy; completion evidence; subreference grammar and stable part identity; exact-reference versus set-query syntax and query invalidation; code-justification coverage and conformance evidence; surviving support and simplification on retirement; cost bounds and accounting; and the remaining implementation-generation loop.

**Retained user direction (U004):** design-side rather than mandatory code-side references; a non-dominating, replaceable plugin; nested subdesigns and progressive disclosure as fundamental; formal lintable design parts with exact types still open; and criteria-driven evidence for artifacts/modifications and decisions versus alternatives. A003 hole 5 is corrected, not silently preserved as code-annotation policy. **Assistant-provisional:** P14-P18, their matrix, candidate part taxonomy, sample grammar, invalidation/removability refinements, and the proposed selective transfer from Evidence. Earlier provisional material is not blanket-approved. No V4 runtime, conformance checker, Evidence integration, or performance result has been implemented or established.


## 12. Reference convention confirmation

**User direction U005, agreed in A005:** use `[[...]]` consistently for conceptual and code-symbol term references. `[[Term Name]]` and `[[term_name]]` are two spellings of the same conceptual term; `[[somepackage.SomeType]]` demonstrates a qualified code-symbol form. This is a notation decision, not adoption of every provisional resolver, namespace, selector, or design-part proposal.

**Assistant reasoning (A005):** one delimiter makes reference recognition uniform; readability and qualification can vary within it. This is a design judgment, not a benchmark claim.

**U006/A006 resolution, approved by U007:** the previously unfinished `[[Some Type]] should,` topic now has a concrete user proposal: a uniquely named code symbol can own an unqualified normalized reference unless an eligible Markdown definition owns that term. The proposed priority, assistant refinements, and explicit conflict with the earlier import-local lookup rule are recorded in section 3. No fuzzy matching is inferred.


## 13. Clean reconstruction and aggressive work economics

**Sources: U007-U009. U007 approves all proposals in A004-A006. U008-U009 add new user requirements. A007 mechanisms below are provisional unless directly entailed.**

### Previous design ownership illuminates implementation, not preserves it
When a design, subdesign, or design part changes or is removed, Projector must efficiently identify implementation artifacts the previous accepted design wholly or partly justified. That footprint is an **impact seed for reconsideration**, not a preservation list. Decide what to remove, rewrite, refactor, retain under surviving justification, and add under the new design. Existing code has no authority merely because it exists.

### Clean-reconstruction equivalence
The resulting implementation should meet a reasonable evidence bar that it is materially as clean and well-shaped as if the resulting design had been intended from the beginning. This applies to add, modify, remove, and refactor operations. It is not byte equality or historical rollback.

**A007 provisional terminology:** **history-independent convergence** / **clean-reconstruction equivalence**. Equivalent accepted design states should converge on materially equivalent justified implementation shapes, allowing multiple clean realizations and surviving external compatibility obligations. Separately, reconciliation should be ordinarily idempotent once settled: a second pass proposes no substantive changes.

Testing must include representative add/modify/remove/refactor trajectories and show clean implementations prevailing over compatibility bridges, dead scaffolding, duplicate paths, and accidental abstractions.

### Efficiency is a governing constraint
Every operation must justify local compute, filesystem I/O, and AI-token cost. Minimum practical overhead through clever incremental design is a first-order requirement, not later polish.

**Presumptive red flags:** broad/repeated sweeps when maintained indexes or changed sets suffice; repeated model calls over unchanged meaning; iterative read/edit/read/edit loops when final affected edits can be computed once; per-event recomputation when causal events can be coalesced; whole-file/design invalidation when a stable referenced part suffices; and repeated parsing/hash work for known-unchanged inputs. Broad checks require justification, such as cold-start indexing, explicit recovery from mystery drift, or a genuinely global changed obligation.

**A007 provisional optimization principle:** managed-work cost should approach **delta cost + affected-closure cost**, not repository-size cost. Maintain cheap indexes from known workflow events, batch causal changes, compute union/difference once, settle dependencies in order, and construct one net edit per affected file where feasible. Cache hits must be sound for every dependency relevant to the cached conclusion.

### Implementation-footprint provenance
**A007 provisional mechanism:** derive/cache design-to-implementation footprints from design-side realization bindings, structural ancestry, accepted decisions, and dependency relationships, never required source annotations. Before accepting a design delta, retain enough previous footprint and decision basis to compute lost/gained/changed justification. Reconcile from that difference rather than rescanning everything. Shared artifacts may retain multiple live justifications.

### Reconciliation evidence
**A007 provisional strategy:** deterministic residue/dependency/reference/coverage checks first; focused tests/evals from changed contracts and affected closure; targeted clean-counterfactual comparison only when material enough to justify token spend; then a second-pass no-op/idempotence check. A clean reconstruction candidate is evidence, not canonical authority.

### Newly reassessed assumptions
1. **Causal workflow / Managed provenance.** Normal operation sees changes through integrated workflow injection points; mystery drift is recovery mode.
2. **One-way design ownership / Derived footprint.** Designs author justification; reverse implementation maps are disposable derived indexes.
3. **Current-state authority / No sacred code.** Accepted live meaning and surviving obligations outrank historical code shape.
4. **Stable addressability / Fine invalidation.** Requirements, design parts/decisions, and implementation artifacts can have stable enough logical identities for narrow invalidation.
5. **Evidence proportionality / Escalating proof.** Evidence cost follows claim/risk; expensive semantic/counterfactual work is selective.
6. **Convergence over history / Clean endpoint.** Managed paths to the same accepted design should converge to materially equivalent clean structure without demanding one canonical text.

### Remaining high-leverage holes
1. **Footprint completeness / Hidden ownership.** Need cheap detection of implementation artifacts affected by a design but absent from existing bindings/indexes, without source annotations or repeated semantic sweeps. [1, 2, 4]
2. **Applicability frontier / New obligations.** Reverse edges cannot reveal a brand-new requirement or newly applicable constraint. Need bounded discovery, including changed or previously empty query populations. [1, 4]
3. **Cleanliness oracle / Counterfactual proof.** “As if designed this way from the start” has no unique answer. Need practical criteria that reject historical residue without regenerating/comparing whole subsystems routinely. [3, 5, 6]
4. **Granularity / Stable identity.** Too-coarse parts cause churn; too-fine parts recreate bureaucracy/index overhead. Part schema and identity must support narrow invalidation across moves/refactors without source coupling. [2, 4]
5. **Cache soundness / Dependency capture.** Missing invalidators create fast silent wrongness; overcapturing recreates sweeping churn. Cache keys must cover exactly the facts relevant to each conclusion. [1, 4, 5]
6. **Simplification stopping rule / Churn economics.** Cleanliness can always be pushed further. Need a criterion for when more restructuring is not justified by the changed obligation, so clean reconstruction does not authorize unrelated rewrites. [3, 5, 6]

These are unresolved design problems, not identified dealbreakers.
