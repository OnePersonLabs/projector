**Kerf assessment: human comprehension without loss of Projector capability**

Assessment date: 2026-09-27. Kerf HEAD: `ffbf52a64508f5ed04a5fcd0ada1ebabb290b055`. Its README and musical-example README have local changes; `docs/` is untracked. Runtime findings below come from implementation and tests. Local documentation is identified separately. V3 is also changing concurrently, so its current presentation work is evidence of overlap, not a completed integration baseline.

**Conclusion**

Keep V3 as the semantic foundation, incorporate V4's implementation lifecycle, and adopt Kerf's approach to helping people understand and explore the model. The useful contribution is a short reading path through purpose, behavior, reasons, relationships, realizations, and uncertainty. It does not require reducing Projector's typed model.

This was the recommendation from the Kerf assessment. Subsequent user clarification makes efficiency, parallel worktrees, ordinary merge/PR compatibility, and the concurrently implemented verification policy explicit decision criteria. The [completion plan](projector-completion-plan.md) therefore keeps V3 provisional and requires a fresh comparison of V3 and V4 after the workers finish. The Kerf findings and capability-preservation requirement remain applicable whichever foundation is selected.

The user's constraint is decisive: comprehension must improve without sacrificing capability. Kerf's smaller ontology and absence of a separate acceptance ledger do not satisfy that constraint as a replacement. Its focus brief, exploration procedure, and bounded retrieval offer mechanisms that can operate over the richer V3 authority instead.

This revises one premise of the earlier comparison. V3's readable Markdown and TOML establish a storage format, not human comprehension. A person can read individual sentences and still have no usable picture of the system.

**What the independent cold read found**

The reviewer first inspected names and artifacts before reading explanatory workflows. In V3, descriptive concept and requirement filenames offered a starting point. The inventory did not explain the direction or authority of relations, evidence strength, or how to reach a decision's rationale. Following the selected pre-edit relevance requirement required a stable-ID search that found 14 relation files. Each relation exposed endpoints, but the reader then had to locate the destination record.

The second reading path ran from a concern to a decision and then to an authority record for assumptions, rejected alternatives, evidence, and reconsideration conditions. Those are valuable distinctions. Their distribution creates navigation work that the user should not have to reconstruct manually. The current model index is a 231-line categorized catalogue with 93 relation entries; it helps locate files but does not itself explain the model.

Sources: [V3 requirement](../../../projector-v3/.projector/model/requirements/determine-relevance-before-choosing-edits.md:17), [model index](../../../projector-v3/.projector/README.md:1), [concern](../../../projector-v3/.projector/concerns/core-host-independence.md:14), [decision](../../../projector-v3/.projector/decisions/keep-core-independent-of-implementation-packages.md:25), and [authority](../../../projector-v3/.projector/authorities/concern-core-host-independence.md:23).

Kerf's musical example presents a much shorter path: a project purpose, event origin, player evidence, and their shared lens. Its prose explains that replay does not create new player performance evidence, and the authored relationships connect the rule to its reason. However, this is a two-concept example, not a controlled comparison with V3's larger model. It does not establish equal comprehensibility at comparable scale.

Kerf also has presentation ambiguity. The example's `evidence` metadata contains projection parameters such as allowed origins and kinds, not observations proving the rule. `immutableOrigins: true` is not consumed as a general policy by the lens; the implementation and check directly encode origin preservation. A human view should distinguish parameters, observed evidence, provenance, and acceptance authority.

Sources: [project purpose](../../../kerf/examples/music-events/.kerf/project.md:1), [event origin](../../../kerf/examples/music-events/.kerf/concepts/event-origin.md:14), [player evidence](../../../kerf/examples/music-events/.kerf/concepts/player-evidence.md:14), and [lens](../../../kerf/examples/music-events/.kerf/lenses/event-provenance.mjs:36).

This was an independent agent navigation exercise, not a human-user study. It identifies concrete friction and candidate improvements; it does not certify usability.

**What Kerf actually provides**

Kerf starts focus from request terms, known concepts, or file paths. It follows authored requirements/governance relationships and observed file dependencies. Its saved brief groups project purpose, relevant meaning, implicated implementation, and questions and limits. Each included concept has a source link and a selection reason. The skill tells the agent to read that brief before choosing implementation files and expand only for a concrete dependency, conflict, or missing consequence.

The default concept-text budget is 24,000 characters, with bounds of 32 concepts and 128 files. Missing records, ambiguous terms, unsupported relationships, and overflow become explicit unknowns. These are local runtime bounds, not demonstrated model-token savings. The implementation records only the first selection reason for an item; it does not retain every alternative path or provide a complete causal explanation.

Sources: [exploration procedure](../../../kerf/skills/kerf/SKILL.md:10), [focus bounds and selection](../../../kerf/src/focus.mjs:25), [relationship expansion](../../../kerf/src/focus.mjs:80), and [brief rendering](../../../kerf/src/focus.mjs:141).

Kerf keeps authored conceptual relationships separate from observed code edges. Source observation is limited to static local JavaScript/TypeScript import and re-export relationships. Warm indexing uses changed inputs and selected index partitions rather than building a whole-project TypeScript program. The test suite checks that a warm explicit focus parses none of 90 unrelated added concepts. Repository discovery and metadata still have costs; this is not a measured general performance advantage over Projector.

Saved work records source and query identities. A new consumer or changed selected input can reopen review. A passing check refreshes the scoped baseline; failed or review results preserve it. The index is disposable, with an interrupted-update marker and explicit rebuild recovery. Ordinary operations are designed to be serialized per project.

Sources: [observation limits](../../../kerf/src/observe.mjs:55), [incremental sync](../../../kerf/src/index.mjs:296), [query/currentness comparisons](../../../kerf/src/focus.mjs:162), [check settlement](../../../kerf/src/work.mjs:86), and [locality/recovery tests](../../../kerf/test/workflow.test.mjs:232).

Kerf lenses are trusted project modules that declare inputs and owned output paths, render previews, and check selected behavior. Helper-mediated reads are tracked. Arbitrary module execution is not sandboxed and can have dependencies outside that helper. Output writes are atomic per file, not a recoverable transaction over the whole output set. These useful hooks need Projector's stronger provenance and lifecycle guarantees when adopted.

Sources: [lens loading and inputs](../../../kerf/src/lenses.mjs:55), [preview/write checks](../../../kerf/src/work.mjs:23), and [output write loop](../../../kerf/src/work.mjs:54).

**What to take, and how to preserve capability**

| ID | Take from Kerf | Adaptation for Projector |
| --- | --- | --- |
| K01 | Project purpose and named entry concepts provide a place to start. | Provide a human overview and curated reading routes into V3 authority. Navigation metadata may organize facts but must not become a second owner of their meaning. Keep the full typed catalogue available beneath the overview. |
| K02 | A brief puts related meaning and implementation in one reading path. | Assemble read-only neighborhoods from canonical records: behavior, scope, scenarios, prerequisites, governors, decisions, rationale, realizations, evidence, history, and open questions. Show one coherent source revision and links to exact records. Preserve each record's type and authority. |
| K03 | “Why here” makes retrieval explainable. | Retain complete relevant selection paths, typed relation directions, and alternative reasons when needed. Explain how an obligation governs the requested change. Keep identifiers accessible without making them the entry requirement. |
| K04 | A skill expands context for a concrete question. | Extend the existing V3 context/inspect workflow into question-led exploration: what exists, why, what governs it, what depends on it, what changed, what evidence supports it, and what remains unknown. Reuse runtime retrieval and currentness; do not implement a second retrieval engine inside the skill. |
| K05 | Bounded focus exposes omissions and stale scope. | Preserve whole normative sections and exact constraints in relevant detail views. Label summaries, omitted populations, and unresolved frontiers. Offer targeted continuation. A bounded result cannot claim complete coverage, and a new relationship or consumer must invalidate affected views. |
| K06 | Local project lenses supply previews and checks. | Build on V3's existing lens system, using readable configuration and results where useful. Preserve governed authority, input identities, validator provenance, and recovery. Use V4's integrated lifecycle for mutations and multi-file publication. |

The first implementation slice should use current V3 records and services to produce the overview, a linked neighborhood, and an exploratory skill. This isolates navigation improvements from format migration. It is not a substitute for readable primary artifacts: where a controlled reading exercise still exposes dense or fragmented prose, improve its organization while retaining every qualification and structured field. Existing folded details and whole-section rendering are useful starting points, not evidence that the problem is solved.

A generated view has no independent acceptance authority. An interpretive summary identifies itself as such and links to exact governing text. If an editable view is introduced, it needs an explicit translation and round-trip contract; ambiguous edits cannot silently change several canonical facts. Presentation can group records without merging their identities or weakening their guarantees.

**What not to copy as the combined product's guarantee**

Kerf's ordinary direct edits and absence of an acceptance ledger do not preserve V3's authority and lineage semantics. Its generic concept relationships do not replace independently identified scenarios, typed relations, evidence predicates, or governed decisions. Those omissions are product-scope differences, not mechanisms that close Projector's holes.

Kerf's local selection reasons are not full why-traces. Scanner codes under “Questions and limits” still require translation into what is unknown, why it matters, and what would resolve it. Passing selected lens checks does not establish all behavior. CLI `review` is not success even though it can return exit code zero; any Projector integration must consume semantic status. Multi-output writes and trusted modules do not inherit stronger recovery or dependency guarantees merely by being called lenses.

Sources: [Kerf authority boundary](../../../kerf/.kerf/concepts/conceptual-authority.md:17), [selection reason storage](../../../kerf/src/focus.mjs:34), [check status](../../../kerf/src/work.mjs:86), and [CLI](../../../kerf/src/cli.mjs:1).

**How to verify the combined result**

Use the same V3 semantic content for the current presentation and the proposed presentation. Do not compare a reduced example with the full model and attribute the difference to interface quality. Before giving a reader the intended interpretation, ask them to find a behavior, explain its reason and scope, locate its governing authority and evidence, follow an affected relationship, and identify unresolved uncertainty. Record incorrect interpretations and navigation obstacles, not only whether a command ran.

Before collecting results, record success/failure criteria, reader familiarity, bounded sampling, and stopping rules. Include semantic omissions and misunderstood authority as failures. Keep presentation-tuning examples separate from the independent check.

Run preservation checks alongside those tasks. Verify stable IDs, relation direction/types, conditions, exceptions, normative force, scenario identity, evidence status, history, and available operations. Check stale inputs, newly added consumers, and truncated views. A faster explanation that omits a governing exception fails; a complete dump that leaves the reader unable to navigate also fails.

The current V3 working tree already adds human rendering for context and acceptance previews, disclosures, completion auditing, analyzer improvements, and observation reuse. Reconcile those changes before building the new view. Do not overwrite the active task or assume it has closed C16 without comprehension evidence. The current rendering explicitly says it is a view that does not change acceptance or currentness: that is the correct ownership boundary to extend.

Sources: [V3 current public renderer](../../../projector-v3/packages/cli/src/public-command.ts:152) and [current workflow skill](../../../projector-v3/plugins/projector-v3/skills/projector/SKILL.md:11). These paths refer to the observed working tree and must be revalidated after concurrent work settles.

**Verification performed and remaining work**

Kerf's six existing workflow tests passed on Node v24.19.0. They cover focus/render/check, changed consumers, selected-scope freshness, declared lens behavior, locality, and disposable-index recovery. The raw run is retained at `C:/Users/zethj/.codex/opl/research/projector-kerf/kerf-runtime-tests.log`. No installed workflow was executed in this assessment, and no product source was changed. The cold read was a limited proxy for usability, not a human-user study.

The recommendation is to retain K01--K06 in the [completion plan](projector-completion-plan.md) and preserve its expanded C01--C19 register. Re-analyze both versions after the active workers finish before finalizing the combined architecture. Kerf provides mechanisms to test for improving how people encounter Projector's richness. It does not justify removing that richness.
