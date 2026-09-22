# Projector V4: original idea capture

This file captures Michael's Projector V4 design direction and separately attributed assistant proposals. It is not a second specification. The current organized working state belongs in the sibling `PROJECTOR_V4_RUNNING_SPEC.md`.

---

EUREKA!!!!

TAKE DOWN THE PROJECTOR V3 WHITEBOARD, KEEP FOR REFERENCE BUT 

I THINK I JUST SOLVED EVERYTHING ALMOST

---

BLANK SLATE: "PROJECTOR V4" 

(at end of every response, I want you to update a running spec file for this to avoid context rot)

* Symbiotic with OpenSpec. Assumes /  Requires OpenSpec to be initialized in the project. This is the spec layer.  WE MONITOR AND REACT TO added, modified, removed requirements in specs (the live specs for not the changes dir)

* # Term, [[term reference]], @Tag 
dunno if terms should have name spacing support or how they should work yet.
tentative: Terms can be explicitly defined in markdown files using # <term> at the top. Terms can be referenced via [[case-insensitive term name]] or [[term_name]] (not sure yet if I want to allow name spacing. likely not...). note that at this point in the ideation process I realize that referenced terms may not be defined anywhere yet. which isn't necessarily a bad thing. however, terms can only have ONE definition - if a term is defined more than once that should cause an error in the same scope as a type check error
terms can be *explicit* (defined with "# My Term" in a markdown file, in files matching an as yet unspecified pattern match scope that limits parsing terms from MD files according to an as yet unspecified path convention. 
terms can be defined by virtue of being a logical code symbol. language agnostic.  but [[...]] references would probably need to be resolvable from where they are - for example if a class imports a type SomeType, [[SomeType]] in a comment in that class would resolve to the imported SomeType. but in a md file, depending on its context, that reference, it not resolvable should cause an error and an auto fix for it should be provided where if ONE (no more no less) code symbol matching the name is found and is accessible from the reference context without violating import boundary rules (nx, dependency cruiser or whatever), auto fix should fully qualify the reference to resolve the error.

refactoring: We need to probably use hooks to detect symbol and term refactors and enforce completeness - package names, types, specs (spec subdir nested paths / segments for when specs are moved or a dir in the specs path is renamed), terms, etc

should be optimized though. I want it to perform the minimum number of edits necessary to complete the refactor.  if the hook picks up two name refactors and a lot of files contain both names, those files should be edited only once, applying all applicable refactors in one update pass. 

designs: imagine you have a good sized app and specs established.

then you add a requirement.

the relevant design would be re-ebaluated. a different solution / code implementation may be justified. the new design, along with its justification, citing the relevant requirements it satisfies (either by adhering to rules or fulfilling required whatever...u get the idea. if a requirement defined in a spec applies to the designs scope or whatever criteria that makes the design affected by the requirement, the design should explicitly name it and provide concise evidence that it's satisfied. same for direct / primary requirements the design exists as a minimal reasonable surface in order to satisfy, as well as peripheral / secondary / requirement-that-applies-because-of-whatever-criteria-it-says-that-is-determined-to-currently-apply-to-this-design
(note: modifying requirements must lead to automatic re-evaluation of all designs that reference it, which should trigger an invalidation - which marks design files with a dirty flag if they reference the requirement (QUICK NOTE, I JUST REALIZED WE PROBABLY SHOULD DO THIS TOO IF A DESIGN DEPENDS ON ANOTHER DESIGN AND THE DEPENDED UPON DESIGN CHANGES)  so multiple requirements can be changed in one operation, then dirty designs can be be addressed by creating a temporary tree list sorta thing that organizes dependencies so we can work through them in a "fundamental designs first" then once modified designs that other designs in our dirty list have been worked through, we can process the next group of designs so we don't reevaluate a design five times if it depends on five other dirty designs.  we probably want to work through reevaluating fundamental dependencies a dependency  optimally and intelligently. may involve something like finding  all dirty  refs in designs, groups them by impact+fix type, potentially delegating simple/mechanical/deterministic fixes to a cheap Subagent or code implemented fix, but  we would need to make such approaches play nice with the dirty roots first strategy

I have not yet fully elaborated my whole complete new idea but I want to let you process what I've written so far so I don't accidentally lose it to some catastrophic phone failure


---

## Capture protocol established by U002

This file is the append-only design-conversation history. User content and assistant interpretations remain separately attributed. The current running spec is the sibling `PROJECTOR_V4_RUNNING_SPEC.md` in `.temp/initial-design/` on branch `v4`.

Replay in recorded order. The original message above is **U001**. User events establish, change, or qualify working direction. Assistant events are proposals/interpretations unless a user explicitly accepts them. Later corrections supersede earlier meaning without erasing earlier events. Preserve tentative decisions as tentative; do not infer blanket acceptance from agreement with one particular point. Operational records describe repository actions, not additional product requirements.

A001 is a labeled substantive reconstruction of the first assistant response and the framing used in the initial running spec. U002 is the next user message, transcribed below. A002 records this response's design payload. Future substantive user messages should be captured verbatim; assistant suggestions and adopted decisions must be distinguishable. A faithful replay produces the current conceptual state; no byte-identical natural-language reconstruction is claimed.

The history is required alongside the running snapshot. The snapshot must be understandable alone; the history preserves the material from which to recover it. Do not turn this documentation workflow into a requirement for a V4 event-store subsystem.

---

## A001: first response, assistant interpretation and proposals

Authority: assistant proposals and explanations, not user acceptance. This entry is a substantive reconstruction of the prior response, not a verbatim transcript. It also identifies background framing used by revision 0.1 so replay need not consult earlier chats.

### Background framing used in the initial running spec

The conversation motivating V4 concerned human-understandable artifacts, concern-aligned boundaries, encapsulation, contracts, progressive disclosure, and avoiding repeated expensive reconstruction of a project's meaning. The user had directed a fresh Psychord implementation using OpenSpec, not a requirement to finish V3 or Kerf first. The V4 reset retains that motivation but does not inherit V3 machinery, declare the whole repository irreparable, or mandate one package/file/entity per concern. Requirements and designs may have hierarchical and cross-cutting relationships.

### Interpretation of U001

OpenSpec owns live requirements. Projector keeps designs accountable to those requirements, maintains resolvable references, and reopens affected design decisions when their basis changes. The captured loop is: live requirement change, find affected designs, accumulate invalidations in a dependency-organized batch, reevaluate prerequisites before dependents, and update designs/justifications/references. The later implementation loop is not yet specified.

The spec remains a partial conception. Tags, definition-scope patterns, namespaces, requirement addressing, design placement, and the remaining execution loop stay open. Do not assume an arbitrary Markdown H1 is a definition outside the eligible pattern scope. No namespace grammar, hook API, routing framework, or language adapter has been selected.

### P1: notation and identity

`# Player Evidence` can be referenced as `[[Player Evidence]]` or `[[player_evidence]]`. Keep ordinary conceptual terms unnamespaced initially, but distinguish that choice from code-symbol identity. Two modules' distinct `Result` symbols need not be duplicate conceptual definitions. Contextual symbol lookup must follow the symbol visible at the reference, and conceptual case folding must not override the language's own semantics. The relationship between explicit concepts, names, scoped identities, and symbols is unresolved.

### P2: unfinished ideas versus broken references

U001 permits conceptual mentions before definition while ideating, and separately requires errors for unresolved code-symbol references. Preserve a distinguishable undefined/draft state instead of silently making every unresolved name valid or invalid. Duplicate definitions remain hard errors. The precise distinction was unresolved at this point; U002 below clarifies the live-design case.

A qualification fix needs exactly one permitted candidate, not merely one repository-wide spelling match. Reuse existing boundary policy rather than an inconsistent duplicate. The unanswered question is how Markdown acquires the context used for lookup and permission; this does not automatically require namespaces everywhere.

### P3: applicability and dependency scheduling

A newly added requirement has no existing reverse links. Applicability discovery is required in addition to following references, including when scope broadens. New provenance constraints can apply to playback and evidence designs that never referenced them. A removed requirement reopens justification; it does not automatically delete its design.

The work unit for reevaluation should see a settled set of changed inputs rather than a file-save event. For a diamond, reevaluate A and B before C, which depends on both. Group by fix type within the ready dependency frontier, not across an unresolved prerequisite. Cycles need an explicit policy, still undecided. Changes to derived dirty flags must not themselves cause recursive substantive invalidation. Once per settled input set is the aim, not a guarantee against all future revisits.

### P4: prune changes only at the actual dependency boundary

Dirty does not mean the promises exposed to dependents have changed. A may need reevaluation but keep its relevant contract, potentially sparing C unnecessary work. Skip only when the particular relied-on promises/evidence can reliably be shown unchanged; a model's impression that prose is equivalent is not sufficient. C's own changed requirements still require work. The equality rules are unresolved. Bazel Skyframe incremental evaluation was cited as precedent, not proof of semantic equivalence for prose: https://bazel.build/versions/8.6.0/reference/skyframe .

### P5: refactor against original bindings

Resolve references in the original state, collect all renames/moves, group edits by file, and construct one combined update per affected file for that pass. Sequential `A -> B` then `B -> C` replacement can incorrectly send original A references to C. Use bindings, not unrelated prose matches. Preserve known logical identity when justified; do not automatically call every move deletion plus addition. Public names can themselves be required behavior. Conflicts, concurrent edits, and ambiguous rename inference remain open.

### P6: justification is not implementation proof

Distinguish requirements that motivate a design from those that constrain it; secondary does not mean optional. Concise explanations may establish the intended way to satisfy a requirement, while actual implementation evidence establishes only what it observed. A latency rationale is not a latency measurement. State checks and missing verification honestly without introducing a certification subsystem.

### External reference scope

Nx module-boundary project-tag constraints were cited as a possible policy input, not an implemented Markdown resolver: https://nx.dev/docs/features/enforce-module-boundaries . Neither cited tool is a V4 dependency or authority. All six refinements above remain assistant proposals unless the user expressly adopts or supersedes them.

---

## U002: user clarification and repository request

Capture mode: verbatim message body.

```text
(yes should maintain a running spec + append-only capture file sorta like an ARD that the spec can be reconstructed from by "playing it back" like event sourcing. go ahead and make a new branch in the projector repo called v4 (just copy the .gitignore from main branch) and put these files in .temp\initial-design (make sure it's not excluded by the .gitignore file) and update the files there as we go.)

scenario: design has a reference to an undefined term =  code drift.  live designs like live specs are expected to be "true" except when implementing a design delta 

concept: design deltas are similar to spec deltas. I'm not certain yet on the best actual form this should take - perhaps designs can have a structural schema like specs that is optimal for adding/removing/modifying parts of designs. not sure what exactly "parts" should mean yet.

drift repair:
drift repair should be a fully planned, reviewed (ideally human review can be skipped based on some reasonable safe criteria, like if the agent judges that the drift repair  plan does not involve plausible risk or ambiguity such as a meaningfully  pivotal decision either regarding decisions like "which of these plausible meaningfully impactful interpretations should we proceed with?" or similarly criteria'd repair decisions where there's more than one plausible path meaningfully impactful enough to escalate the decision for - potentially up to a parent more intelligent agent like a root Astra agent, or to the parent agent which may choose to delegate to the question to a higher intelligence/effort Subagent, or raise the question to the user (preceding behavior description applies to interpretation and repair implementation choices) lhen executed unit of work 
```

---

## A002: second response, assistant interpretation and proposed refinements

Authority: interpretation of U002 and new assistant proposals. The user has accepted the running-spec/capture arrangement, not all earlier assistant proposals.

### Integrated user direction

A design reference to an undefined term is code drift. Live designs are expected to be true except while implementing a design delta. Unfinished ideation remains distinguishable from accepted live design. Design deltas are analogous to spec deltas, but their parts, schema, location, and lifecycle format are undecided.

A drift repair is planned in full, reviewed, and then executed as a unit. Human review may be skipped under reasonable safe criteria; planning and review are not skipped. Material ambiguities in either interpretation or repair choice can be escalated to a parent/root agent, to a higher-capability or higher-effort agent chosen by the parent, or to the user. This does not impose a fixed escalation ladder or selected model configuration. The repair work must remain compatible with prerequisite-first batching and combined per-file refactors.

### P7: the diagnostic does not choose the repair

An undefined reference could be a rename not propagated, a removed definition, a bad binding, or a missing implementation. Do not choose an explanation merely because it is easy to make the reference resolve. Creating a definition or rewriting a design to fit current code can conceal the mismatch rather than repair it. Resolve consequential ambiguity in the plan.

Consider binding expected temporary inconsistency to the specific implementing delta and its scope; an open delta should not excuse unrelated drift. This is a proposed refinement, not a finalized tracking schema or permission system.

### P8: consequential uncertainty, not edit count

Human escalation should depend on the material consequences of plausible alternatives and the evidence for selecting a repair, not how many lines change. A large mechanically resolved rename might be routine; a one-word contract change may be pivotal. Review needs explicit grounds, not unqualified model confidence. More capable reasoning can reduce uncertainty but does not itself authorize a new product intention. No extra universal review ritual or V3 machinery is adopted.

### Unsettled by this response

No design-delta schema, granularity of parts, namespace system, dirty-state storage, specific reviewer arrangement, numerical risk threshold, completion mechanism, or implementation-generation architecture is selected. The natural-language history supports faithful semantic reconstruction, not a promise of byte-identical replay.

---

## O002: repository setup record

Scope: `OnePersonLabs/projector`, new branch `v4`; no changes to `main` or existing branches. Starting reference: main commit `0a01dacc694793daea28f416372671554ac9b4e7`. A new commit has that parent but a fresh tracked tree consisting only of `.gitignore` and these two design records. Thus V3 remains in history without V3 working-tree files.

The main `.gitignore` contents are retained and a narrow exception admits `.temp/initial-design/` and descendants while other `.temp` contents remain ignored. Before publication, local Git ignore checks verify this distinction. Branch creation and the resulting remote tree are verified through GitHub; the actual commit identity is available from the commit carrying this event, rather than embedded circularly in its own content.

Materialized running spec: revision 0.2, through U002/A002. No product implementation, OpenSpec installation, hook, schema, or runtime has been built in this step.


---

## U003: attribution policy, subreferences, unjustified code, and requirement retirement

Capture mode: user message body, with its informal wording and line layout retained. U003 explicitly preserves assistant suggestions as provisional unless explicitly or unambiguously implicitly approved; the positive skim is not blanket acceptance.

````text
yes without reading deeply but skimming dangerously your reply (i.e. the very behavior I should dub The Slop Attractor, aka MichaelsBane) what you said looked good at a glance. don't lose that shit.      
      
 by default, include your suggestions / clarifications but mark them as provisional until explicitly or unambiguously implicitly approved. keep clear attribution in append only file and spec file, just to easily distinguish  assumption threads on your part from material based directly or near directly (obvious leeway for cleaning up my sloppy prose, formatting with formal placeholders and such, etc) on what I say        
        
 btw can u begin to see where I'm going with this? 😎 if you think theres some big gaping hole hiding a dealbreaker or value neuterer, CONCISELY list them with minimal but sufficient explanations. I don't wanna forget the entire eureka idea so point out the holes real quick but don't be pedantic. first point out the highest leverage assumptions you are filling in that reduce the list of exception holes as much as you possibly can.  (so only the lingering holes are listed). number and give 1-2 simple shorthand names to the assumptions & holes. for each hole, cite assumptions that contributed materially to identifying it in like [2, 4] citation number form at the end of the hole item. in other words, if the referenced assumptions changed or didn't exist,v the hole wouldn't make sense (though other hole(s) might have been listed instead)   
  
---  
  
oH I SHOULD HAVE SAID THIS IN PRIOR MSG:  
[[]] reference syntax should support in-thing sub reference specificity.. idk how better to describe that . but think of pointing to a specific property on a typescript class.  or a specific "part" (as yet to be determined what exactly parts are) of a design or a subheading path in a term definition md doc.(like $ term definition > ## blahblah > ### yipyap" but don't use my off the cuff arrow convention. pick something as aligned with established conventions as possible. what im describing may or may not be more powerfully useful to be elevated to something like css selectors .. I'll leave that to you to explore and come up with defensible scenarios justifying promoting what I'm describing to a css selectorlike capability)  
  
 (again, regarding design, "parts" types are as yet undefined - though you may have proposed a specification already I just haven't read and approved it yet in that case. anyways...)   
  
  
we should be also able to, using some optimized smart hidden caching / hashing hook magic, raise errors in the same context as type checking for code that isn't justified by a design!!

one end result use case scenario I am trying to achieve, which sparked this inspiration, is "removing a requirement should efficiently and optimally, **AVOIDING ANY MASSIVE CHURN OR PLUGIN OVERHEAD THAT ISNT STRICTLY NARROWLY THE MINIMUM POSSIBLE COST ON LOCAL COMPUTE RESOURCES AND AI TOKEN BURN**, result in the corresponding code implementation snapping back to a similar shape as it would've been before the requirement was added. this should scale non-explosively or even less than linearly (I.e. optimizations that can batch and structure work in the most efficient way, so the more that changes with derivable provenance/cause (i.e. im distinguishing that from mystery drift where we can't determine we're in the middle of a process and expect XYZ changes to occur blah blah blah, I.e. we can assume we have excellent injection points to integrate with a cohesive integrated workflow process, something quite different than "audit drift caused by jr dev who accidentally used Claude to add a feature, so our plugin wasn't involved")  before the plugin has its turn, the more ... you know what I am gonna let you finish my thought I am sure you can see where I'm going with this
````

---

## A003: provisional interpretation and proposals

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


---

## O003: two-file design update

Prepared against verified `v4` head `eaff7f650b338761ed5d63e80412404bd81b0705` and its tree `94c550f4278395293d5b44e8b6deef9b410071f2`. Local starting bytes matched the remote blobs: running spec `3e98de8679f181f0eba0f460cf9edfc0c79dc4df`, capture `c062dd109b96f554246106f1199b6cccefbe0178`.

U003/A003/O003 are recorded below the prior entries. Running specification revision 0.3 integrates U003 and explicitly marks A003 provisional. Only the two files in `.temp/initial-design/` are in this update; `.gitignore`, V3, and `main` are not edited. Publish both in one commit based on the observed head, without a forced branch update. The containing Git commit provides publication identity without circular self-hashing. No product implementation or new automation is part of this update.


---

## U004: design-side evidence, replaceability, and nested subdesigns

Capture mode: verbatim user message body. This explicitly rejects mandatory code-to-design references and requires nested subdesigns/progressive disclosure. It does not approve a particular part grammar.

````text
I would say we can establish some criteria or like a decision matrix sort of thing and like use that to determine what evidence needs to go in the design justifying a distinct artifact or modification of an artifact. whole number five this code references a design is explicitly the wrong direction. I do not want the code to have to reference designs because that tightly couples an entire repo code base to this plug-in or at least as a slippery slope to ending up with that tight coupling. I want this plugin to sit happily in the code base without dominating it and making it more difficult for humans to understand or for the developers to switch tools

I'm jumping back to the design justifying the shape of the implementation I just had a glimmer of a thought and I'm going to just ramble it at you hoping you can take the sloppy fart and see what I'm pointing at: my intuition is showing me "parts" (perhaps part type specific sub parts like you know subheaders with specific rules / schemas for child sub sub headers or expected lists or what have you) and very vaguely and fuzzly I'm something like here are the architectural decisions made at this design level or NESTED SUB DESIGN LEVEL **I THINK WE SHOULD DEFINITELY HAVE NESTED SUB DESIGN STRUCTURE AND PROGRESSIVE DISCLOSURE LIKE SPECS FORMALIZE THAT SHIT UNLESS THAT'S INSANE OR JUST OBVIOUSLY YEAH I THINK IT'S OBVIOUSLY AWESOME AND WE NEED TO MAKE THAT A FUNDAMENTAL ASPECT OF DESIGNS**
and those architectural decisions can be written according to formal rules like the specs are (I don't mean the exact "GIVEN" 'WHEN" "AND" "THEN" "MUST" "MAY" or whatever specs have, but like a schema and Rose structured in a similarly formal syntax that can be linted anyway blah blah blah I forgot what I started this ramble about figure out what I was saying and you know figure that out.
oh yeah I was saying I feel like something is in reach where we can trace architectural decisions with evidence supporting those decisions versus other alternative decisions concisely in line like a minimal convention format for compact efficient validatable form. 

I guess like this tool does: https://github.com/wrtnlabs/evidence
````

---

## A004: interpretation, proposals, and source inspection

Capture mode: substantive assistant response payload, not a verbatim transcript. User-derived direction and provisional proposals are separated.

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

### A004: revised justification direction, nested designs, and Evidence

**Attribution:** the three headings added to section 5 record U004's correction and direction. P14-P18 below are assistant-provisional refinements. U004 adopts nested design structure explicitly, not every earlier proposal about ownership, hashing, or reference grammar.

### P14. One-way authored bindings; derived reverse lookup

Keep required implementation bindings, reasons, evidence, and review detail in readable designs. A disposable reverse index can map observed code units back to those bindings and issue diagnostics without injecting design references into the code. Coverage population must still be observed independently: querying only already-bound artifacts cannot discover unjustified additions.

Proposed removability test: removing Projector and its explicit checking/hook integration should leave ordinary code, builds, and tests understandable and usable without rewriting source annotations or importing a Projector runtime. This is a test of tool independence, not a promise that deleting the checker retains its enforcement or that generated product code is forbidden. No duplicate authored code-to-design registry is needed by this proposal.

### P15. Concern hierarchy, contract-directed disclosure

Nest subdesigns by responsibility, not by artifact category or an automatic one-to-one mirror of folders/classes. A parent explains the concern, its externally relevant promises, and the responsibilities delegated to children; a child owns its internal decisions. Readers should not have to load every child's internals to understand the parent.

Keep applicable parent obligations available by reference rather than copying their prose into each child. Inheritance does not mean every global rule applies to every descendant, or that a child can silently weaken a parent contract. Cross-cutting requirements and dependencies still form explicit graph links; the containment tree is not a complete dependency graph.

A child implementation change need not dirty all ancestors and siblings merely because it is nested. Proposed invalidation follows actually relied-on parts and guarantees, including changed child membership where the parent relies on that composition. This reuses P4's still-provisional unchanged-contract pruning. A child's exported guarantee changing does affect its users. Do not manufacture an all-descendants hash as every parent's universal dependency.

### P16. A small candidate part structure

Candidate readable parts are **Contract**, **Decisions**, **Realization**, and **Subdesigns**. This is a proposal, not an approved universal document template or four required files. A Decision may have typed subparts for its requirement basis, chosen option, rationale, material alternatives, implementation consequences, evidence, and reopening conditions. The policy matrix determines which are required for the case; routine work should not expand into a full architectural essay.

The useful primitive is a small argument: under these requirements and conditions, choose this option rather than that credible alternative, producing this implementation consequence, supported by this evidence. Record why the implementation has its shape, not a post-hoc story for arbitrary code. The same Decision part could be an addressable delta/invalidation unit; this is a candidate answer to 'parts', not a settled design-delta schema.

### P17. Evidence obligations are conditional, not universal paperwork

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

### P18. Connect evidence to requirement retirement

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


---

## O004: two-file update preparation

Prepared from verified `v4` head `f11ef7a67d5d3fd6c4bc0afc73a753c867e2efd6`, tree `f9be841ce5e1c020ad0f5d30d3c1351a17dabcf3`. Mounted starting files matched remote Git blobs: spec `2b5d4afa5b993e1b7c1c122c59bf1cc2f3b99fd2`, capture `6e6fac479ae974ccfedc711f19da80bfc775a889`. U004/A004/O004 are appended; the running spec is revised in place to 0.4, correcting obsolete wording rather than leaving it authoritative.

Only the two `.temp/initial-design/` Markdown files are prepared for a single commit on `v4`; main, V3, and `.gitignore` are not changed. Publication is identified by the containing commit, subject to the verified non-forced ref update; no runtime code or Evidence installation is part of this change.


---

## U005: reference convention

Capture mode: normalized user direction. Reference forms are retained exactly; the incomplete final fragment is not completed by inference.

Use one reference convention: `[[Term Name]]`, `[[term_name]]`, and `[[somepackage.SomeType]]`. The user asks the assistant to formalize it on agreement and keep both Markdown records consistent with it.

Unfinished continuation:

```text
[[Some Type]] should,
```

---

## A005: agreement and scope

The assistant agrees: all term references use double brackets. Spaced and underscore-separated conceptual names are spellings of the same term; qualified code names remain subject to actual contextual symbol resolution. One delimiter makes references consistently recognizable while allowing readable names and qualification inside it.

This establishes the notation from U005, not a new namespace system, fuzzy code-symbol matcher, or design-part schema. Existing provisional mechanisms remain provisional except for the reference-form decision. The incomplete `[[Some Type]] should,` rule remains unresolved, particularly any intended relationship to a symbol spelled `SomeType`.


---

## U006: proposed default code-symbol ownership and Markdown precedence

Capture mode: verbatim user message body. Status: user proposal inviting evaluation, not an implementation instruction or blanket approval.

````text
separately, proposal: should a reference like [[Some Type]] or [[SomeType]] be interpreted as referring to a code symbol, no matter what namespace / scope it exists in, unless the term is defined in a pattern matched md file with the "# <term>" convention - in which case that would be the assumed term owner, and references to the symbol would need to be qualified code symbol references - but the un-md-overridden, unqualified code symbol ownership would require that no other code symbol share that exact name / spaceless name ([[Some Type]] and [[SomeType]] and [[some type]] all are treated as referring to = `class SomeType` type so long as only one thing is named that and no overriding md '# <term definition>` overrides it.. , should that code symbol be treated as the default term definition, with no namespacing / scoping required for [[references]] to it?  (doesnt preclude a namespaced ref to the same term - presumably there would be no issue with both)
````

---

## A006: global defaults with explicit ambiguity and rebinding

Attribution: assistant-provisional recommendation and clarifications; not a verbatim transcript.

The assistant recommends the proposal as a global default-name rule, with explicit refinements. Markdown owns an unqualified normalized name when exactly one eligible definition exists; otherwise exactly one distinct indexed logical code symbol may own it. Duplicate code names invalidate ambiguous references, not source declarations. Qualified code references can reach the same symbol and bypass the Markdown default without bypassing boundary policy.

The provisional formatting key removes spaces and underscores and case-folds names; it does not perform fuzzy matching, rewrite program identifiers, or relax qualified language binding. The provisional candidate population is referenceable project declarations rather than every local variable or installed library declaration. Several aliases of one logical symbol count once only when actual language resolution establishes identity. Candidate scope and completeness still require a decision.

Three examples distinguish outcomes: with only `audio.SomeType`, all proposed bare spellings and the explicit qualified form can target it; adding a second distinct `network.SomeType` makes the bare name ambiguous but leaves both declarations valid; adding one eligible Markdown `# Some Type` makes it the proposed default even when several code candidates exist. Qualified code links remain available.

This is a deliberate alternative to U001's import-local selection. The assistant favors one repository-wide meaning for a bare conceptual reference, with qualifications where needed; normal source imports still behave normally. The running spec must keep the policy change visibly proposed rather than applying both incompatible rules simultaneously. Source context still matters to boundary eligibility, not to silently choosing between global candidates.

Existing reference targets must not silently change when a Markdown owner or colliding symbol appears or disappears. Invalidate only affected name-key bindings, then let the planned change intentionally accept the new target or qualify the old code target. This is a proposed binding-change check integrated with existing reviewed batches, not source annotations or another approval subsystem.

The direct benefit is that namespaces are available when needed without being mandatory ceremony for every unambiguous reference. Agreement with the idea is not a claim that it is implemented, nor blanket adoption of its population, normalization, cache, or rebinding details.

---

## O006: two-file update preparation

Prepared against verified `v4` head `109b58909e885f87099306bf6c13b7a942a526bc`. Starting mounted bytes match remote Git blobs: running spec `1d843bb6f3c0a5c3ef2c5b2f96d543c18fe344b6`, capture `90252329dd90ffe263194c83cbd3235e9104c68d`. The prior capture is retained as an exact byte prefix; U006/A006/O006 are appended. The current-state spec advances to revision 0.6, records this resolution change as proposed, and marks the former unfinished-input note as addressed by U006. Earlier accepted directions and provisional proposals otherwise remain unchanged.

Only the two `.temp/initial-design/` Markdown records are prepared for publication on `v4`. No runtime, source annotations, new tooling, or changes to main/V3 are part of this update. Publication is identified by the carrying Git commit after a non-forced branch update.


---

## U007: approve A004-A006 and request reassessment

Capture mode: verbatim user message body.

```text
all proposals from your last 3 replies are approved.  re-evaluate and list new assumptions and holes
```

---

## U008: clean reconstruction after design change

Capture mode: verbatim user message body.

```text
had to interrupt you because i Thought of something while you were preparing your last reply:

need a heavily optimized efficient way of effectively doing this: when a design changes or is removed, we want to illuminate the implementation artifacts (by that i mean, usually, code) that the previous version of the design had total or partial ownership of (i.e. code thats existence was justified due to satisfying the design) and determine what to cut, what to rewrite, refactor, and add.  since agents seem to be hell bent on dishing out slop and acting like "pre-existing" code is sacred and holy and tend to be inclined to work around, preserve, and build technical debt bridges over existing code, that tendency must be *stamped out* / dealt with cleverly and subjected to suitable testing to prove clean implementations consistently  prevail - an area of code should end up effectively the same after a change to a design as it would have been if the design had been initially created that way (as the modified design state after modification) to begin with.  same with removing parts and adding parts.  removing, adding, and refactoring should be tested and pass a reasonable bar of evidence that those operations are... i want to say idempotent but thats not quite right or im missing some words i need to say prior to idempotent or something lol you get what i mean though 

so.. yeah.. regather your marbles, deal with what i just said, redo whatever you were doin and all that
```

---

## U009: efficiency is a governing constraint

Capture mode: verbatim user message body.

```text
right and that needs to be implemented in a EFFICIENT OPTIMIZED WAY.  EVERY BIT of this needs to justify local compute and token spend and aggressively aim to be as lightweight and nimble with as little overhead - or rather the minimum overhead achievable with clever optimization strategies and design. that means ANY BRUTE FORCE OR SWEEPING CHECKS / ITERATIVE IN PLACE PROCESSING (doing a bunch of reads and edits that could instead be done in a single efficient batch pass way sorta stuff) LOOKING CODE IS A BIG RED FLAG
```

---

## A007: reassessment after approval, clean reconstruction, and efficiency

**Attribution:** assistant synthesis. U007 directly approves all proposals in A004-A006. U008-U009 directly establish clean-reconstruction and aggressive work-economics requirements. The terminology, mechanisms, assumptions, and holes below are provisional unless entailed by those user requirements or later approved.

### Approved state
All proposals in A004/P14-P18 and associated matrix/refinements, A005's single `[[...]]` convention, and A006's global-default term ownership/resolution rule and safeguards are approved. Earlier proposals outside those replies are not blanket-approved.

### Interpretation
The previous design's implementation ownership is an impact seed, not a preservation set. Existing code is not authority. A changed accepted design should produce a clean implementation of the new state rather than compatibility bridges from historical code. Efficiency is architectural: normal operation should use causal events, maintained indexes, narrow invalidation, batching, memoization, and net edits rather than repeated sweeps or repeated AI reasoning.

### Provisional terminology/mechanisms
Call the endpoint property **history-independent convergence** or **clean-reconstruction equivalence**: equivalent accepted design states should converge to materially equivalent justified implementation shapes, allowing multiple clean realizations and surviving compatibility obligations. Separately, settled reconciliation should be idempotent: a second pass proposes no substantive changes.

Propose a cached design-to-implementation footprint derived from design-side realization bindings, structural ancestry, accepted decisions, and dependency relationships, never required source annotations. Retain enough previous footprint/basis around a design delta to compute lost/gained/changed justification and reconcile from those differences.

Propose evidence proportionality: deterministic residue/dependency/reference/coverage checks first; focused tests/evals for changed contracts; expensive clean-counterfactual comparison only when material enough to justify it; then a no-op/idempotence check.

### Provisional assumptions
1. **Causal workflow / Managed provenance.** Normal operation sees changes through integrated workflow injection points; mystery drift is recovery mode.
2. **One-way design ownership / Derived footprint.** Designs author justification; reverse implementation maps are disposable derived indexes.
3. **Current-state authority / No sacred code.** Live accepted meaning and surviving obligations outrank historical code shape.
4. **Stable addressability / Fine invalidation.** Requirements, design parts/decisions, and implementation artifacts can have stable enough logical identities for narrow invalidation.
5. **Evidence proportionality / Escalating proof.** Evidence cost follows claim/risk; expensive semantic/counterfactual work is selective.
6. **Convergence over history / Clean endpoint.** Managed paths to the same accepted design converge to materially equivalent clean structure without demanding one canonical text.

### Remaining holes
1. **Footprint completeness / Hidden ownership.** Need cheap detection of affected implementation absent from existing bindings/indexes, without source annotations or repeated semantic sweeps. [1, 2, 4]
2. **Applicability frontier / New obligations.** Reverse edges cannot reveal a brand-new requirement/newly applicable constraint; need bounded discovery including changed/empty query populations. [1, 4]
3. **Cleanliness oracle / Counterfactual proof.** No unique canonical clean code; need criteria that reject residue without whole-subsystem regeneration/comparison on every change. [3, 5, 6]
4. **Granularity / Stable identity.** Too coarse causes churn; too fine causes bureaucracy/index overhead. [2, 4]
5. **Cache soundness / Dependency capture.** Missing invalidators create fast silent wrongness; overcapturing recreates sweeping churn. [1, 4, 5]
6. **Simplification stopping rule / Churn economics.** Need a stopping criterion so clean reconstruction does not authorize unrelated rewrites. [3, 5, 6]

These are unresolved design problems, not identified dealbreakers.

---

## O007: two-file update publication

Started from verified `v4` head `ba949a09d2c93bcaf323b8f704ad4087df32647d`, whose design blobs matched the mounted working copies. The running spec was advanced first to revision 0.7, then this capture was appended in a second fast-forward commit because the available repository contents API updates one path per commit. Only the two initial-design records changed; main, V3, runtime code, and tooling did not.
