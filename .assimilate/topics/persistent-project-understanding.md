# Persistent project understanding

The ambition is to make accumulated project understanding computationally available across development acts. A project should retain the reasons its distinctions exist and use those reasons when it changes. The user favors a persistent, project-specific learned model as a counterpart to the frontier agent. This topic note is assimilation's account of a Projector research direction. It is not a requirement that assimilation use a learned model, and the note's name is independent of any Projector concept record. It does not claim an implemented model or authorize replacing Projector's specification.

The motivating diagnosis is repeated reconstruction. An agent receives selected code, prose, and history, reconstructs a temporary understanding, then changes the artifacts from which another agent will reason. A locally plausible improvement can lose an ownership distinction, an exception, or a rationale. Repetition may compound that loss. This is a plausible failure mechanism to investigate, not a demonstrated explanation of every development failure or a finding from an audit of the current repository.

## What persists, and what it does

Project conception includes purpose, relationships, authority, architecture, conditional tradeoffs, meaningful exceptions, and the possibilities the product should develop. It exceeds a catalog of current choices. Knowing that a backend was selected is weaker than understanding which scheduling or deployment property justified it and when that choice should be reconsidered.

The desired counterpart performs project-specific judgment. Given a proposal to move assessment into sessions, it might derive that session lifetime now governs evidence authority, investigate a deduplication consequence, and produce a counterexample. Returning relevant passages can help this work, but does not establish that the counterpart has performed it. Its distinctive contribution is integrating relationships and deriving consequences the implementing agent would otherwise have to rediscover.

This makes textual collaboration compatible with learned persistence. The counterpart can use its understanding where it resides and communicate a consequential result. The frontier agent supplies broad expertise, invention, implementation, and responsibility for unresolved coupled judgment. It can challenge the counterpart. Neither needs to be treated as an oracle.

Concrete shared work makes that division useful: both reason about the same candidate change, source revision, proposed test, execution trace, or patch. The counterpart's warning should connect to evidence that can contradict it. A tool called “challenge” is only a surface; the value comes from the investigation and construction behind its answer. Difficult joint reasoning can still require substantial communication. The aim is less necessary reconstruction, not an assumption that all project knowledge fits into a tiny message.

## Durable evidence and rebuildable learning

The lifecycle separates durable experience from the learned interpretation of that experience. Accepted intent, observed implementation behavior, inferred explanations, proposals, rejected alternatives, and unresolved questions retain their distinct status. A developer can decide a product preference without thereby proving a technical fact. Successful code is an observation, not retrospective permission to invent the rationale that supposedly required it.

Event-sourced rebuilding is the user's proposed way to avoid making successive weight updates the only carrier of project understanding. Recorded experience remains available; project-specific learned state can be reconstructed after a bad adaptation or a better interpretation of earlier evidence. A practical candidate is fresh project-specific state against a pinned pretrained base. Foundation pretraining from zero is not required by the idea. Model manifests could bind accepted artifacts to evidence and training revisions without requiring large weights in ordinary Git.

Rebuilding offers recoverability, not guaranteed fidelity. A fresh run can still learn the wrong distinctions, miss exceptions, or vary behavior. Exact accepted artifacts support rollback; independently rebuilt artifacts need behavioral assessment. Branches can reconcile divergent decisions and evidence before rebuilding, rather than assume that combining learned weights reconciles meaning.

The evidence needs two complementary reductions. Current-state reconciliation establishes the shortest faithful account of what is accepted now. Historical selection retains what still improves future judgment. An incidental spelling correction usually contributes the final name. A rejected audio dependency may contribute its assumptions, observed limitation, and reconsideration conditions. If an old spelling became a public identifier, its compatibility consequences make that history relevant. Retention therefore follows consequences, not a fixed category such as “discard renames.”

A proposed curriculum compiler performs this reconciliation and selection. Its output should include useful learning experiences: competing interpretations, failed and successful transformations, behavioral traces, counterexamples, rationale, and cross-concept combinations. The episode “this revision gained flexibility but erased an authority boundary” may teach more than its final formulation alone. Raw evidence remains recoverable when later work reveals that an omitted distinction mattered.

This compiler is itself a possible source of distortion. It can mistake exploration for acceptance, manufacture a plausible explanation, or flatten a refinement into wholesale supersession. A coherent model trained on such material can make consistently wrong decisions. Provenance, unresolved alternatives, and independent observation constrain this risk; polished prose and model agreement do not resolve it.

## Learning with the developer and the current project

The user's hardening loop uses strategically selected questions to distinguish materially different interpretations. A concrete scenario can expose disagreement hidden by easy agreement with a general principle. Multiple-choice answers are useful when they leave room for nuance, combinations, or rejection of all options. The developer may recognize that a design loses something before being able to name the missing distinction. The system should help articulate and test that recognition before treating its interpretation as accepted intent.

Questions should target consequential uncertainty near the work being attempted. Independent models disagreeing can identify a useful investigation, but disagreement can also reflect learning or reasoning failure. It does not automatically require another developer decision. Likewise, agreement may preserve a shared mistake.

Learned judgment must remain bound to the project state it concerns. Between an accepted revision and the next rebuild, explicit current changes must remain accessible and take precedence over superseded commitments. Merely placing a new rule in the prompt does not prove that an older model has integrated its consequences. Materially affected judgment may need fresh reasoning or explicit uncertainty. Retraining cadence and disposable incremental adaptation are candidate policies whose costs must be measured.

## Reconstruction and the larger horizon

The user's strongest adequacy criterion is semantic reconstructability: remove a meaningful implementation region and regenerate recognizably this project from its maintained conception and allowed external contracts. Success includes material behavior, architecture, ownership, exceptions, migration obligations, and relevant quality properties. A generic replacement passing a shallow suite is insufficient. Exact source duplication is unnecessary where implementation details are genuinely free to vary.

This horizon requires learning from implementation. A material decision discovered while coding must already follow from the conception or become retained, properly classified experience. Otherwise source code becomes the only place important choices survive. Further along the horizon, code can be one execution projection alongside specialized models and adaptive interfaces. Deterministic artifacts retain value for precision, latency, transactions, and efficient execution. Model-mediated runtime software is a further research scope, not a prerequisite for investigating learned development judgment.

## What would establish value

The experiment must preserve coupled concepts and accumulated change. An isolated concept can test machinery but cannot establish the claimed system benefit. Evolving trials should include distant consequences, altered premises, legitimate exceptions, and attractive changes that damage another quality. [Semantic dynamics](semantic-dynamics.md) develops this target.

Strong comparisons should share accepted evidence and developer input while varying curation, retrieval, a generic counterpart, and project training. Shared-intervention and compiled-context interfaces should also be compared without assuming their benefits are separable from learning. Track valid changes completed, consequential degradation, false objections, developer repair, and total cost across sustained trajectories. Curriculum production, training, local inference, communication, and verification all count. A learned counterpart earns its place through better project evolution; the unresolved questions are how reliably it learns, how it remains current, and where its benefit exceeds its burden.
