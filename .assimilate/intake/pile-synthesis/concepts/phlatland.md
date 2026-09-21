# Phlatland

`§phlatland` · A live, purpose-steered project explorer.

## Core

Phlatland is the exploratory surface for understanding a project through changing perspectives rather than maintaining a separate pile of manually authored diagrams. Its name combines “phat” with the dimensional-perspective idea of Flatland.

The desired interaction is to focus on something, choose a useful lens, explore nearby relationships, change depth, and ask questions without losing contact with the underlying project evidence.

## Four responsibilities

**Reality substrate.** Queryable observations about packages, symbols, imports, specifications, responsibilities, state transitions, user capabilities, and optionally runtime traces and history. Assertions should have evidence and a revision basis.

**Lens and projection.** A lens determines what counts as relevant, nearby, prominent, or causally connected for the current purpose. A runtime-causality view differs from a user-experience, data-lifecycle, ownership, change-impact, or failure-propagation view.

**Exploration controller.** An agent interprets the user's question, selects queries and views, explains distinctions, and suggests useful next perspectives. It does not get to invent project facts because a diagram needs another node.

**Presentation surface.** A trusted client renders diagrams, tables, code views, timelines, or interactive controls. Declarative UI protocols are potential adapters, not the perception or reasoning mechanism itself.

## Lens-dependent proximity

The same session concept can connect to transport through a runtime lens, to joining and playing through a user-experience lens, to stale presence and timing divergence through a failure lens, and to lifecycle ownership through an architecture lens.

“Nearby” can therefore involve structural coupling, causal adjacency, shared state, semantic similarity, capability membership, or likely change impact. These dimensions should be chosen for the question, not collapsed into one supposedly objective distance.

A useful view exposes its scope and what it omits. It should be possible to distinguish a confirmed edge, an inferred relationship, and an exploratory hypothesis.

## Documentation becomes a view

A saved explanation or diagram can be a reproducible projection with a focus, lens, scope, and revision. It need not become a second manually maintained truth source.

This does not eliminate the need to record intent that cannot be inferred from code. It links the exploration surface to [system conception](system-conception.md), rather than equating the filesystem with the whole project meaning.

## UI technology boundary

The design considers A2UI-like declarative surfaces and MCP Apps-like embedded interfaces as candidate presentation approaches. Their current APIs, renderer maturity, and client support were not re-evaluated for this pack. The architectural requirement is an evidence-grounded, incrementally updateable interface with host-controlled behavior, not loyalty to a protocol.

Do not build the whole explorer around a framework before proving that its underlying queries answer useful project questions.

## Smallest meaningful prototype

Choose one capability and support two substantially different lenses, each grounded in real source or specification evidence. Let a user move from a high-level claim to the exact supporting artifact and see where evidence is missing.

Test whether the explorer helps a developer correctly predict change impact or explain a failure faster than ordinary search. A visually impressive but unsupported graph is not a successful prototype.
