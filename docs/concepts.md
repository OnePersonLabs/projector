# Concepts

Projector's concepts guide how accepted meaning relates to code and evidence. For the complete typed model and exact record schema, use the canonical [.projector/README.md](../.projector/README.md) and linked records.

## Contents

- [Accepted meaning](#accepted-meaning)
- [A concept in the clip reuse example](#a-concept-in-the-clip-reuse-example)
- [One authored source per fact](#one-authored-source-per-fact)
- [Stable identity](#stable-identity)
- [Source queries and typed relationships](#source-queries-and-typed-relationships)
- [Context and currentness](#context-and-currentness)
- [Implementation evidence](#implementation-evidence)
- [Working synthesis](#working-synthesis)

## Accepted meaning

Accepted meaning records what the project intends and why. It includes concepts, requirements, scenarios, decisions, concerns, constraints, and their relationships. It is the authority for project intent. Implementation, plans, context packets, and assimilation notes are evidence to assess against it.

## A concept in the clip reuse example

A **concept** names a durable part of the domain and states its boundary. In the [worked example](examples/clip-use.md), `concept:clip` owns reusable notes and timing. The requirement describes what each arrangement use stores and how playback applies its transpose without changing the shared clip. The example keeps those per-use details in the requirement and scenario instead of promoting each use into another concept.

The **requirement** `requirement:independent-transposition-per-use` states what the app must do: store a transpose value for each use of a clip, apply it during playback, and preserve it with the shared clip reference after reload. The **scenario** `scenario:two-uses-of-one-clip-save-reload` supplies observable C4 and D4 cases. Typed relations connect the Clip concept to the requirement and the requirement to its scenario. Their complete schema-valid form is in the [initial proposal](examples/clip-use-initial.json).

A later implementation can change its classes, tables, or UI while preserving the clip's shared-content boundary and the per-use behavior. A later user decision about allowed transpose values revises the same requirement and scenario IDs; see the [revision](examples/clip-use-revision.json).

## One authored source per fact

Readable Markdown records hold the human-authored prose. TOML metadata binds identity, scope, and typed relationships. Relations and executable policies remain TOML. Derived hashes and projections are not another editable copy of the same fact.

## Stable identity

A record has an identity inside its authored record; its filename is a convenient path. Renaming the path does not change the identity. Similar wording does not prove two records have the same meaning. Reuse an existing identity when it owns the intended boundary; establish a new identity only after inspecting nearby records and stating its distinct boundary.

## Source queries and typed relationships

Source queries bind an obligation to inspected implementation areas. Typed relationships represent dependencies such as a requirement demonstrated by a scenario. Together they help Projector select context and inspect consequences beyond changed files.

A query result is evidence about current source membership. A new result may reveal a consumer that changes an assumption. A missing result does not prove absence when the query is open or its source is unavailable.

## Context and currentness

A context packet is a bounded selection of accepted meaning for one task. It includes selected meaning and disclosure about omitted, open, or unavailable material. Its retained ID lets Projector check dependencies later. Context supports retrieval; it does not establish applicability by itself.

## Implementation evidence

Code and behavior checks show how the current system behaves. A check can establish the tested behavior under its inputs. It cannot prove the entire design correct or every consumer accounted for. Keep observed facts, accepted decisions, and unresolved hypotheses distinct.

## Working synthesis

An assimilation topic note belongs to the separate `.assimilate/` working synthesis. It is not a Projector concept record, even when it discusses one. Assimilation can develop candidate meaning and provide evidence for a change; Projector remains the authority for accepted canonical meaning.

Continue with [Model and context](model-and-context.md) or [Changing accepted meaning](changing-accepted-meaning.md).
