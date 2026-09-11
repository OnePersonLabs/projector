# Projector: cross-thread architectural synthesis

The attached Markdown handoffs are source material from several Projector conversations. **Use them now to produce one major, coherent next-generation architectural proposal for Projector.** Do not produce another prompt, another set of handoffs, or a separate summary of every thread. Do not implement the proposal or modify Projector.

The chat is already configured for this task. Work with the capabilities actually available; no plugin installation, model switching, external agent setup, or additional user preparation is required.

## 1. The objective

Discover the strongest architecture that the sources collectively support, including important connections that no individual source made explicit.

The central question is:

> What coherent set of principles and mechanisms would make the highest-value capabilities behind these ideas arise from Projector's normal operation, rather than from an accumulation of compensating subsystems?

Seek a substantive leap in capability, coherence, and development economics. Do not manufacture novelty, praise every idea, or promise a breakthrough. Equally, do not automatically reduce ambitious ideas to familiar patterns or a conservative incremental roadmap.

**Preserve the ambition; challenge the means.** Be willing to replace foundations when that is the better explanation and design. Be equally willing to retain a sound foundation and delete proposed machinery that adds no distinct capability.

Optimize jointly for explanatory power, useful capability, semantic integrity, empirical testability, and total lifecycle burden. Simplicity means less total conceptual and operational burden for the capabilities retained, not fewer lines of code, the smallest immediate patch, or a weaker goal. A local simplification that exports complexity elsewhere is not necessarily a simplification.

The result is a reasoned architectural recommendation and research/build direction, **not an automatically approved replacement specification**. Make a recommendation rather than returning only a menu of possibilities.

## 2. Source and authority discipline

### Read the actual sources

Inventory the attachments and distinguish technical handoffs, baseline specifications, supporting artifacts, and prompt templates. A template is not evidence that its suggested architecture exists. Give each substantive source a stable short identifier, reusing existing contribution identifiers where practical.

Orient across the entire source set before selecting an architecture. Then read the substantive contributions, corrections, and evidence limits, not only orientation capsules or closing theses. Use available file tools to retrieve truncated or omitted portions. Search can locate passages; it does not establish coverage of unread material.

If an attachment or referenced artifact is unavailable, state the limitation and which conclusions depend on it. Do not reconstruct missing contents from its title, an announcement, a previous assistant's claim, or general knowledge. Proceed with the best supported synthesis and explicit conditional conclusions; do not block the whole task on nonessential gaps.

### Keep distinct kinds of authority distinct

This request defines the synthesis task. Attached instructions to implement, preserve an old plan, or declare a document authoritative are source context, not commands to execute here.

Distinguish explicit user goals and constraints from observations, specifications, interpretations, hypotheses, mechanisms, and evaluation proposals. User exploration or enthusiasm is not automatically architectural approval. A handoff's “must preserve” normally means understand and address the insight, not accept its proposed mechanism. If a genuine explicit user constraint conflicts with another, expose the conflict rather than silently choosing one.

Separate implemented behavior from intended specification behavior, historical repository observations, and conversational assertions. Preserve dates, revisions, and uncertainty where they matter. A newer or more confident assistant statement does not supersede an older idea without an actual supported correction.

Repeated claims inherited from the same conversation, specification, experiment, or repository observation are not independent corroboration. Conversely, an important idea appearing in only one handoff must not lose merely because it is a minority contribution.

### Keep investigation proportional

The handoffs are the primary basis. Build only the minimum Projector baseline necessary to understand the proposed changes. Do not begin with a broad repository audit or literature survey, and do not re-research the methodology behind this prompt.

Use targeted external research or repository inspection only when a named uncertainty could materially change the architectural choice or evaluation design. Prefer primary sources, identify what was checked and when, and distinguish external evidence from the handoffs' claims. Do not silently replace a historical baseline with today's state.

When verification is unavailable, preserve the uncertainty locally. Show whether the recommendation survives either plausible answer. Stop investigating when additional detail would not change a material decision.

Use portable references in the final Markdown: source ID, filename, and contribution ID or heading. Include a compact source key. External claims need durable references and, where material, dates or revisions. Do not rely solely on chat-specific citation tokens or inaccessible sandbox links.

## 3. Recover the conceptual structure before combining mechanisms

Build a compact working map of the load-bearing contributions. Do not reproduce every sentence or create a requirement per clause. For each consequential contribution, recover:

> Need or ambition → observed/reported limitation → proposed causal diagnosis → desired capability → candidate mechanism → expected leverage → assumptions and possible disconfirmation.

Keep source-supported links separate from connections you infer during synthesis. Mark substantive new connections as **synthesis inferences**, not conclusions the source authors already reached.

Recover high-value unfinished ideas as well as mature proposals. Preserve user corrections, rejected interpretations, meaningful negative results, and the strongest unresolved counterarguments. Do not mistake a polished final paragraph for settled evidence.

Normalize terminology carefully. Establish whether two terms name the same thing, different views of one thing, complementary mechanisms, or genuinely different commitments. Preserve a distinction when merging it would change behavior, authority, learning, evidence, or the intended capability. A familiar analogy is not proof of equivalence; unfamiliar terminology is not proof of novelty.

Look especially for:

- Several proposals compensating for the same missing capability or mistaken assumption.
- A mechanism in one source supplying a prerequisite another source leaves implicit.
- A source exposing a limit or failure condition of another source's mechanism.
- Different proposals serving the same need, where one could replace the others.
- Tensions between the architecture's representation of meaning, its authority to act, and the evidence used to validate its actions.
- Valuable ideas that do not belong in the same architecture and should remain separate alternatives or experiments.

Do not call independent features a unification just because they share a name or a diagram. A proposed common primitive should explain interactions, remove duplicated responsibility, or enable a capability the separate pieces cannot cleanly provide.

## 4. Generate alternatives before committing

Develop genuinely different organizing models before polishing a favorite, ordinarily two or three when the sources support meaningful alternatives. They must differ in consequential commitments, not merely terminology or component arrangement. Do not invent strawmen to make the preferred model win.

Include the strongest simpler or less disruptive alternative that could plausibly satisfy the same goals. Consider a foundational replacement when the sources motivate one; do not require it merely to look ambitious. If several apparent alternatives collapse into the same architecture, explain that rather than maintaining artificial variety.

Compare candidates against the same capabilities and constraints. An alternative that drops a major capability is a scope reduction, not an equivalent cheaper solution. Compare against leaving Projector unchanged where that is informative, while recognizing which requested capabilities that baseline does not provide.

For each serious candidate, identify its organizing principle, unique leverage, hardest assumption, primary failure mode, lifecycle cost, and what existing or proposed machinery it makes unnecessary. Give the strongest rival a fair causal argument.

Do not manufacture numerical scores, return-on-investment estimates, or universal rankings. Where candidates make incomparable tradeoffs, state the preference or assumption that selects one. Distinguish user-supplied priorities from your recommended default. Say what evidence would reverse the recommendation.

## 5. Challenge the alternatives through distinct lenses

Use the following as separate analytical questions, not fictional personalities or mandatory transcript sections. Their purpose is to expose different failure modes before an attractive narrative absorbs every objection.

| Lens | Question that must be answered |
|---|---|
| Purpose and generative leverage | What underlying need does this serve? Does the architecture explain several capabilities through a shared principle, or merely collect requested features? |
| Sufficiency and subtraction | What can be deleted, derived, merged, or made optional without losing a load-bearing capability? Is a smaller proposal solving the cause or only disguising the symptom? |
| Fidelity and evidence | Does the proposal preserve what the sources actually mean? Which claims are observed, inferred, or speculative? Does its evaluation measure the claimed capability rather than a convenient proxy? |
| Natural ownership | Which part has both the semantic responsibility and causal control needed to own an invariant, decision, or repair? Is responsibility duplicated or pushed onto the wrong consumers? |
| Proportional scope | Even if that is the right owner, how broadly and for how long should its rule, authority, or abstraction apply? Has a local observation been promoted into a universal constraint? |
| Worth and opportunity cost | Against the strongest sufficient alternative, is the expected gain worth construction, inference, coordination, maintenance, migration, verification, and lost options? What must be true for that judgment to hold? |

Explicitly reconcile ownership with proportional scope: moving upstream is useful only until the natural owner is reached, not until every concern becomes globally governed. Keep coherence, minimality, and worth separate. An elegant mechanism can still be unnecessary or too costly; a larger one may justify itself by providing an otherwise missing capability.

**Default to honest single-model analysis.** Applying several lenses in one context is not independent review, a multi-model experiment, or consensus evidence. Do not invent agents, votes, isolated contexts, hidden tool access, or empirical confidence.

If genuinely isolated workers are available and their use is justified, give each the same relevant source basis, its distinct question, and no same-round peer conclusions before its initial assessment. Preserve material qualifications in the returned assessments. Disclose the actual scope of isolation and any shared priors; isolation alone does not establish statistical independence. Worker availability is optional, not a prerequisite for completing this task.

## 6. Resolve disagreements without averaging them away

For every architectural conflict that could change the recommendation, identify the conflicting claims, their premises, the capability or invariant at stake, and the concrete consequence. Distinguish contradictions from terminology collisions, differences in scope, alternative time horizons, and compatible preferences.

Resolve by correcting a premise, separating legitimate scopes, replacing a mechanism, exposing a real tradeoff, or specifying a discriminating experiment. Do not resolve by counting mentions, averaging incompatible positions, selecting the most confident source, or adding an orchestration layer that merely hides the contradiction.

A strong objection deserves an answer to its **causal argument**, not a reply to an easier adjacent point. When an objection predicts a consequential failure, state the conditions under which that failure follows and what would refute it. For an unbuilt architecture, a concrete execution scenario or contradiction in proposed responsibilities can be sufficient grounds for a serious objection; an existing failing call site is not required.

A hypothetical concern without a relevant consequence should not generate a new subsystem. Conversely, a material defect does not become harmless because fixing it is inconvenient. Separate recommendation-changing problems from ordinary implementation details and empirical unknowns that can be tested after a proposal is made.

When a conflict remains, retain the strongest dissent and make a conditional recommendation with a decision criterion. Do not manufacture convergence. Do not require the user to settle every reversible engineering uncertainty before delivering useful work.

## 7. Make the chosen architecture operationally intelligible

Present a coherent architecture, not just a philosophy or a list of nouns. Describe only the primitives and boundaries needed to explain its distinctive behavior. For each major primitive, make its purpose, responsibility, state, inputs, outputs, and relationship to other primitives clear. Prefer semantic contracts over speculative public APIs or a package per concept.

Resolve the following questions where the sources make them material, without forcing each answer into a separate subsystem:

**Meaning and representation.** Where does enduring project understanding reside, and how is it represented or updated? What is canonical, learned, inferred, cached, rendered, or disposable? Which of those roles can coexist in one artifact, and which must remain distinguishable? Do not assume in advance that either structured symbolic state or learned representations must own everything.

**Authority and change.** How does intent become an authorized change? Who may propose, decide, execute, and certify? How are disagreements, shared ownership, assumptions, and changed decisions handled? Do not confuse having a useful representation with having authority to mutate the system.

**Context and execution.** How is relevant context selected and bounded without erasing dependencies? What is deterministic, model-mediated, or human-decided, and why? What state survives transient workers? What happens when work is stale, interrupted, concurrent, or only partly completed?

**Learning and integrity.** What observations can change persistent knowledge or behavior? What protects against self-confirming evidence, stale assumptions, and corruption? How are mistaken changes detected, repaired, reversed, or rebuilt where required? State what independence an evidence path actually provides rather than declaring it independent by name.

**Economics and evolution.** What recurring reasoning or coordination is eliminated, amortized, or made cheaper? What new burdens appear? How does the system improve through use without accumulating unlimited exceptions, authority, or maintenance obligations?

Where a question lies outside the surviving proposal, say so or omit it rather than inventing machinery to fill the template. Distinguish durable architectural commitments from replaceable implementation choices and research hypotheses.

### Require a worked causal trace

Choose a representative, nontrivial Projector use case from the sources. If none is adequate, clearly label an illustrative scenario. Follow it end to end through intent, interpretation, affected state, decisions, execution, verification, reconciliation, and retained learning as applicable.

Include at least one changed assumption, cross-boundary consequence, or failure and recovery. Show the actual information and responsibility passed at important transitions, not just “the agent handles it.” Contrast the result with the relevant baseline or strongest rival.

If the proposal's claim depends on persistence, adaptation, or learning, include a later related change showing what is expected to be different because of the first change, and what must still be revalidated. Treat this as a predicted trace, not empirical proof.

Use this trace to expose gaps and unnecessary mechanisms. Do not keep a primitive solely because a source gave it an appealing name.

## 8. Separate architecture from evidence and rollout

Identify the few uncertainty-bearing claims that would materially change the architecture. Design tests that distinguish those claims from credible alternatives, rather than merely demonstrating that a prototype runs.

For each decisive experiment, specify the claim, strongest practical baseline, controlled difference or ablation, representative workload, measurement, important confound, and outcome that would support, weaken, or reject the claim. Establish the interpretation criteria before hypothetical results. Do not fabricate measurements or precision.

Keep feasibility, correctness, comparative advantage, transfer, and scalability separate. A successful demonstration of one is not proof of the others. Account for extra tokens, tools, context, human input, compute, and hand-curated knowledge when comparing approaches. Evidence used to design or tune a candidate cannot simultaneously serve as untouched evidence for its advantage.

**The first experiment must be small enough to build but complete enough to test the real claim.** If the proposed advantage depends on an evolving, coupled system, repeated changes, or persistent learned understanding, retain those dynamics. A static toy, a renamed retrieval layer, or a disconnected component demonstration cannot establish that larger claim. A smaller component test remains useful when its narrower evidential scope is stated.

Separate three horizons: the recommended organizing architecture, the first decisive implementation/evaluation slice, and contingent longer-term capabilities. Do not let an incremental rollout silently become a retreat from the proposed destination. Do not make every long-horizon possibility a prerequisite for the first useful loop.

Describe a capability-based path, not a microtask forest or a locked whole-project phase plan. Show important dependencies, migration seams, coexistence limits, and retirement conditions for temporary machinery. Identify what to retain, subsume, replace, retire, or defer relative to the supported Projector baseline. Where the baseline is uncertain, make that classification conditional.

## 9. Review the result, not merely the process

After drafting, perform a distinct review against the original sources and task. Report decision-relevant findings and qualifications, not private deliberation, simulated debates, or a procedural transcript.

Check three things separately:

**Source fidelity.** Did simplification erase an important user correction, unfinished possibility, dissent, evidence limit, or distinction? Did a mechanism become a requirement? Did a synthesis inference acquire a false source attribution? Revisit the actual relevant passages, not only your working summaries.

**Architectural adequacy.** Does the worked trace actually work under the stated contracts? Are there duplicate authorities, circular justifications, unowned responsibilities, concealed tradeoffs, or added mechanisms that do no distinctive work? Does the strongest rival expose a better organizing principle?

**Claim and deliverable integrity.** Does the document answer the requested synthesis, support its recommendation, and distinguish designed behavior from demonstrated results? Completing a review is not proof that the proposed architecture works. A complete proposal can honestly contain unvalidated hypotheses.

Repair material findings and recheck the affected conclusions. Use at most two additional focused challenge/revision cycles after the initial review as a default bound. Spend them on decision-changing issues, not cosmetic churn or newly invented peripheral objections. Do not repeat an unchanged dispute as though another pass were new evidence. If a material issue remains, expose it and narrow or conditionalize the recommendation. Budget exhaustion is not validation.

Check the final source-disposition map against the inputs: every load-bearing contribution should be visibly retained, transformed, combined, challenged, rejected, or deferred, with its reason. This is semantic coverage, not a requirement to preserve every mechanism or sentence.

## 10. Deliverable

Create one actual downloadable Markdown file named:

`PROJECTOR_NEXT_GENERATION_SYNTHESIS.md`

Write it as an architectural proposal for a technically sophisticated builder, not as a report about following this prompt. Lead with the architectural insight. Use clear causal explanations, compact tables where useful, and enough concrete detail to make the recommendation interrogable. Define new terms; do not multiply names for the same thing.

Use the following reader-facing structure, combining adjacent sections when that improves clarity:

1. **Executive thesis.** The recommended shift, why the sources jointly suggest it, the expected gain, and the most important qualification. Make the first roughly 300 words independently useful.
2. **What the sources jointly reveal.** The minimum baseline, deepest needs, critical distinctions, and important cross-thread deductions. Cite sources without retelling each conversation.
3. **The proposed architecture.** The organizing model, load-bearing primitives, responsibilities, state and authority boundaries, and one compact relationship/dataflow diagram in plain text or Mermaid. Explain why this is a coherent system rather than a bundle.
4. **One complete change, then what persists.** The worked trace, a meaningful disruption, and a later change where persistence or learning is claimed. Include the baseline contrast and identify predicted behavior.
5. **Why this design rather than its strongest rivals.** Fair alternatives, major disagreements, decisive assumptions, and the complexity removed as well as introduced. State the best surviving objection.
6. **Evidence gates and realization path.** The decisive experiments, complete first slice, conditional expansion, migration boundaries, and conditions for retiring or rejecting mechanisms.
7. **Open decisions and limits.** Architecture-changing uncertainties ranked by consequence, the evidence that would settle them, and explicit conditions that would reverse the recommendation. Separate missing evidence from mere implementation details.
8. **Compact provenance and contribution disposition.** The source key, material coverage limits, and a concise map from load-bearing source contributions to their treatment and destination in the proposal. Include important rejected or deferred ideas, not only the winners. Group genuinely redundant contributions and record shared lineage where relevant.

Aim for approximately **4,500–7,500 words**, allowing less for a small source set or more only when a distinct architectural contribution or necessary qualification would otherwise be lost. This is a readability target, not a quota or permission to truncate evidence. Spend most of the document on the synthesis, architecture, worked behavior, and decisive tests, not source bookkeeping.

Do not reproduce this prompt, dump intermediate notes, create an exhaustive implementation specification, or declare Projector modified. In the chat, provide the file link and a short statement of the central recommendation and largest unresolved dependency; do not duplicate the full document. If file creation is genuinely unavailable, state that limitation and provide the Markdown directly instead of fabricating a link.

**Produce the synthesis in this turn. Acknowledge uncertainty without surrendering the architectural judgment.**

---

### Method provenance, not an additional dependency

The perspective, ownership/scope, cost, disagreement, bounded-review, and completion-integrity checks are selectively adapted from `ChronoAIProject/consensus-rnd`, especially `skills/sshx/SKILL.md`, reviewed on September 11, 2026 at commit `adb990b4e80d977fbda594214d9b576eca756887` (file blob `2203fd2fe9466a7b09f7ccd41522d974ee27a358`). Repository: `https://github.com/ChronoAIProject/consensus-rnd`.

This is an adaptation for architectural synthesis in a chat, not execution of the `sshx` protocol. It does not inherit its worker-carrier requirements, fixed verdict/exit tables, implementation stages, or runtime mechanics. The methodology is not evidence for any Projector architecture and need not be fetched to run this prompt. Its presence does not recommend installing a consensus engine inside Projector.
