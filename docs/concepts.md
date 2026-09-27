# Concepts

Projector's concepts guide how accepted meaning relates to code and evidence. For the complete typed model and exact record schema, use the canonical [.projector/README.md](../.projector/README.md) and linked records.

## Contents

- [Accepted meaning](#accepted-meaning)
- [One authored source per fact](#one-authored-source-per-fact)
- [Stable identity](#stable-identity)
- [Source queries and typed relationships](#source-queries-and-typed-relationships)
- [Context and currentness](#context-and-currentness)
- [Implementation evidence](#implementation-evidence)
- [Working synthesis](#working-synthesis)

## Accepted meaning

Accepted meaning records what the project intends and why. It includes concepts, requirements, scenarios, decisions, concerns, constraints, and their relationships. It is the authority for project intent. Implementation, plans, context packets, and assimilation notes are evidence to assess against it.

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
