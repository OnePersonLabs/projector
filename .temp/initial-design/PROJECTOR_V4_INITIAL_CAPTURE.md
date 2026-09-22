# Projector V4: original idea capture

This is a verbatim safety copy of Michael's initial Projector V4 message. It is not a second specification. The current organized working state belongs in `../PROJECTOR_V4_RUNNING_SPEC.md`.

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
tentative: Terms can be explicitly defined in markdown files using # <term> at the top> - term names are convertible following the same convention as codex skill names typically follow ("My Skill" = $my-skill) except we use §sone_term.... I am leaning towards underscores because hyphens in term names seem likely .lemme know what you think. so terms can be referenced via [[case-insensitive term name]] (not sure yet if I want to allow name spacing. likely not...) or §term_name.  note that at this point in the  ideation process I realize that referenced terms  may not be defined anywhere yet. which isn't necessarily a bad thing.  however, terms can only have ONE definition - if a term is defined more than once that should cause an error in the same scope as a type check error 
terms can be *explicit* (defined with "# My Term" in a markdown file, in files matching an as yet unspecified pattern match scope that limits parsing terms from MD files according to an as yet unspecified path convention. 
terms can be defined by virtue of being a logical code symbol. language agnostic.  but [[]] and § references would probably need to be resolvable from where they are - for example if a class imports a type SomeType, [[SomeType]] in a comment in that class would resolve to the imported SomeType. but in a md file, depending on its context, that reference, it not resolvable should cause an error and an auto fix for it should be provided where if ONE (no more no less) code symbol matching the name is found and is accessible from the reference context without violating import boundary rules (nx, dependency cruiser or whatever), auto fix should fully qualify the reference to resolve the error.

refactoring: We need to probably use hooks to detect symbol and term refactors and enforce completeness - package names, types, specs (spec subdir nested paths / segments for when specs are moved or a dir in the specs path is renamed), terms, etc

should be optimized though. I want it to perform the minimum number of edits necessary to complete the refactor.  if the hook picks up two name refactors and a lot of files contain both names, those files should be edited only once, applying all applicable refactors in one update pass. 

designs: imagine you have a good sized app and specs established.

then you add a requirement.

the relevant design would be re-ebaluated. a different solution / code implementation may be justified. the new design, along with its justification, citing the relevant requirements it satisfies (either by adhering to rules or fulfilling required whatever...u get the idea. if a requirement defined in a spec applies to the designs scope or whatever criteria that makes the design affected by the requirement, the design should explicitly name it and provide concise evidence that it's satisfied. same for direct / primary requirements the design exists as a minimal reasonable surface in order to satisfy, as well as peripheral / secondary / requirement-that-applies-because-of-whatever-criteria-it-says-that-is-determined-to-currently-apply-to-this-design
(note: modifying requirements must lead to automatic re-evaluation of all designs that reference it, which should trigger an invalidation - which marks design files with a dirty flag if they reference the requirement (QUICK NOTE, I JUST REALIZED WE PROBABLY SHOULD DO THIS TOO IF A DESIGN DEPENDS ON ANOTHER DESIGN AND THE DEPENDED UPON DESIGN CHANGES)  so multiple requirements can be changed in one operation, then dirty designs can be be addressed by creating a temporary tree list sorta thing that organizes dependencies so we can work through them in a "fundamental designs first" then once modified designs that other designs in our dirty list have been worked through, we can process the next group of designs so we don't reevaluate a design five times if it depends on five other dirty designs.  we probably want to work through reevaluating fundamental dependencies a dependency  optimally and intelligently. may involve something like finding  all dirty  refs in designs, groups them by impact+fix type, potentially delegating simple/mechanical/deterministic fixes to a cheap Subagent or code implemented fix, but  we would need to make such approaches play nice with the dirty roots first strategy

I have not yet fully elaborated my whole complete new idea but I want to let you process what I've written so far so I don't accidentally lose it to some catastrophic phone failure


---

## Capture protocol established by U002

This file is now the append-only design-conversation history. Its original filename and prefix above are retained unchanged. The old introductory description and relative link are historical; the current running spec is the sibling `PROJECTOR_V4_RUNNING_SPEC.md` in `.temp/initial-design/` on branch `v4`.

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

Prefer underscores provisionally: `# Player Evidence` can be referenced as `[[Player Evidence]]` or `§player_evidence`. This is a preference, not a technical necessity. Keep ordinary conceptual terms unnamespaced initially, but distinguish that choice from code-symbol identity. Two modules' distinct `Result` symbols need not be duplicate conceptual definitions. Contextual symbol lookup must follow the symbol visible at the reference, and conceptual case folding must not override the language's own semantics. The relationship between explicit concepts, names, scoped identities, and symbols is unresolved.

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

Materialized running spec: revision 0.2, through U002/A002. Original capture prefix is preserved byte-for-byte. No product implementation, OpenSpec installation, hook, schema, or runtime has been built in this step.
