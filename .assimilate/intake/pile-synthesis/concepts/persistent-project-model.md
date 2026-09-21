# Persistent project model

`§persistent-project-model` · Project-specific judgment that can be reused across changes.

## Core hypothesis

A local learned counterpart may internalize useful project relationships and consequences so that a frontier agent need not reconstruct all of them from prose during every change. Its proposed advantage is **amortized understanding and division of reasoning responsibility**, not simply shorter messages.

The counterpart should do useful reasoning where its project knowledge already resides: identify a conflict, propose a counterexample, assess an actual change, or suggest a coherent alternative. A system that only retrieves or rephrases documentation may still be valuable, but that is a different mechanism and should be measured separately.

## The division of labor

The frontier agent supplies general reasoning, unfamiliar-domain competence, and implementation ability. The local counterpart supplies project-specific judgment about interactions, conditional rationale, and accumulated lessons. Deterministic tools resolve current particulars and check executable obligations.

For example, the counterpart might identify that moving assessment ownership into a session changes reconnection semantics and construct a trace in which one observation is assessed twice. The frontier agent can inspect that trace, question the diagnosis, and implement a better repair. This is more useful than exchanging many pages of abstract definitions, even though the exchange still contains text.

Communication can remain a bottleneck when neither participant can resolve a tightly coupled question independently. The architecture does not eliminate that limit by renaming prose as a tool call.

## What belongs outside learned weights

Exact identifiers, current repository membership, authoritative revisions, executable checks, and source evidence need inspectable external representations. A learned memory should not be the only record of a contract or the only way to establish which consumer exists now.

Treat weights or adapters as derived, versioned artifacts tied to a known base model, curriculum, and accepted conception revision. The evidence journal and current accepted state must remain recoverable without them.

This also enables a strong baseline: the same reconciled knowledge delivered through explicit structures and retrieval rather than training.

## Freshness

After an accepted change, a checkpoint can be stale in a specific region. Supply a revision-bound delta, re-evaluate affected judgments, and abstain or escalate when the model cannot establish applicability.

A prompt note saying “the architecture changed” does not prove the model has integrated the change. Unrelated knowledge may remain useful, but use must respect the affected dependency boundary.

Branch reconciliation is a semantic problem. Combining weights or replaying conflicting assertions is not a substitute for deciding which claims apply under which conditions.

## Rebuilding

A clean rebuild means constructing fresh project-specific learned state on a pinned pretrained base. It does not mean training a foundation model from scratch.

Rebuilding from reconciled evidence can make the training path more inspectable and reduce dependence on an arbitrary sequence of incremental updates. It does not guarantee faithful learning, reproducibility at the byte level, or lower cost. Those are experimental questions.

A meaningful reconstruction test asks whether relevant behavior, constraints, and architectural distinctions can be recovered after evolution. It should not demand identical source code unless exact generation is part of the contract. Any deletion experiment belongs in a disposable benchmark copy, not the user's working repository.

## Candidate approaches

Keep several hypotheses live: explicit concept records with strong retrieval; a generic local model using the same tools and memory; project-specific adapters or fine-tuning; other learned context or memory mechanisms; and hybrid systems.

Named techniques such as document-to-adapter methods or learned context representations are research leads, not established components or proof of the Projector hypothesis. Their relevance depends on update economics, fidelity, controllability, and integration constraints.

The learning target and examples are described in [learning curriculum](learning-curriculum.md). The practical collaboration interface is described in [executable collaboration](executable-collaboration.md). The comparison that can isolate genuine advantage is in [coupled evolution](../experiments/coupled-evolution.md).

The more speculative [model-native runtime](model-native-runtime.md) remains a separate research branch, not a prerequisite.
