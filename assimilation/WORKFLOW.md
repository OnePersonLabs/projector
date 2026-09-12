# Assimilation to Projector change

## The boundary

`$projector-assimilate` is a proposed skill for developing complex project intent from mixed material. Its output first lives in assimilation's own Markdown workspace. Projector's accepted conceptual model remains a different system with its own identities, record types, authority, and change lifecycle.

The overlap is a **candidate change**, not a shared concept object. Assimilation can describe ideas about Projector's concepts, including proposals to change how Projector represents concepts, without making those assimilation files Projector records. A reference to an existing Projector ID is a claim to check against current Projector state, not proof that a local Markdown node is identical to that record.

The normal direction is:

```text
mixed input
  -> assimilation's evolving, self-contained working synthesis
  -> mature, bounded change intent
  -> Projector context and identity review
  -> Projector change capture, plan, review, and authorized application
```

Assimilation can stop at a useful synthesis or an unanswered material question. No pile forces a change transaction. Projector may challenge the brief and return new evidence or a planning surprise; assimilation can revise its own interpretation, but the two stores do not synchronize automatically.

## What assimilation contributes

During intake, capture available material, identify branch ancestry and duplicate content, and reconstruct the strongest current interpretation. Keep exact source recovery outside the ordinary working synthesis when it is needed. Organize the resulting meaning into linked topic notes with a small index. Preserve important alternatives, objections, and uncertain assumptions rather than forcing premature agreement. Apply the [source interpretation rules](SOURCE-INTERPRETATION.md) so old chat terminology does not grant Projector authority to assimilation files. Source-specific instructions about citation and formatting do not govern the topic notes or change brief; those files should be readable with intake hidden.

When a change candidate becomes sufficiently mature, prepare a self-contained intent brief with:

- The intended outcome and the problem it solves.
- Relevant current behavior and the scope of the proposed difference.
- Required capabilities, constraints, exceptions, and preservation obligations.
- Concrete scenarios that distinguish viable interpretations or expose failure.
- Alternatives considered, rationale, and live uncertainty with its consequence.
- Evidence or current-state claims that Projector must verify before relying on them.
- Work whose necessity or timing depends on another decision.

These are content obligations, not a new fixed schema or an approval record. The brief should give a fresh Projector agent enough substance to investigate a change without having to reopen the original chats. It should not supply invented semantic hashes, infer acceptance from repetition, or encode a speculative architecture as settled simply because a source proposed it.

The skill may ask the user a focused question when competing interpretations would change the consequential path. It can continue independent assimilation while a question remains open. Cost-aware routing chooses capable models, bounded investigation, and delegation by total expected result quality and rework cost. Low quota never automatically lowers the required quality.

## What Projector owns after handoff

Projector retrieves current accepted meaning for the proposed outcome through its `context` operation. It resolves whether the proposal extends an existing requirement or scenario, revises an accepted identity, or establishes a genuinely new boundary. It checks relevant decisions, lenses, state binding, implementation evidence, and open retrieval frontiers. Source material, assimilation text, and model conclusions remain interpretation evidence until Projector's accepted route changes their status.

Projector's current `$projector-change` path uses a strict typed proposal, then `change.capture`, `change.plan`, review, and authorized `change.approve` / `change.apply`. A model-only change can preserve future obligations without pretending they are implemented. The assimilation brief does not need to precompile the strict proposal. If the handoff is ready, the Projector change owner translates it using the current schema and exact current identities; the owner must not copy assimilation slugs into Projector IDs by convention.

This is a one-way submission boundary, not a merge between assimilation topics and Projector concept records. If Projector accepts some of the proposal, assimilation may record that outcome as new input to its own evolving understanding. Rejection or revision likewise becomes evidence for the next assimilation pass. Neither outcome rewrites the other's files automatically.

## Adequacy tests

Try a branched pile in which one branch changes an implementation idea, another preserves a cross-cutting constraint, and a later source proposes a new Projector concept mechanism. Assimilation should recover the constraint, distinguish the Projector concept mechanism as subject matter, and prepare a change brief that says what behavior would improve. A fresh Projector agent should be able to begin identity review from the brief alone, detect a stale or conflicting current record, and request clarification only where that conflict changes the decision.

Test a negative case: a topic note and a Projector concept record with similar names must not produce an automatic identity match or mutation. Test a partial case: the user can retain a rich working synthesis while deferring all Projector changes. Test a return case: a rejected change can refine assimilation's state without being treated as a lost or contradictory conversation snapshot.

The current workflow description establishes ownership and a candidate interface. It does not establish that Projector's present runtime handles huge heterogeneous inputs, that all supplied source content was recovered, or that the proposed route is more economical than simpler assistance. Those claims need direct trials.
