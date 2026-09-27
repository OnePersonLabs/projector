# Overview

Projector gives a project a durable place to record intended behavior, architectural reasons, and obligations that can affect future changes. Its model links those records to source queries and typed relationships. Codex can retrieve a bounded context before work and revisit it after implementation.

## The problem it addresses

Important project decisions often outlive the session in which someone made them. A code comment may explain one line but omit alternatives, constraints, or the reason a behavior matters. A broad architecture note may be readable but hard to connect to a specific change. Projector keeps accepted meaning in structured, human-readable records and relates that meaning to inspected source.

## The everyday use

Use `$projector` when a task needs existing project context. It retrieves related concepts, requirements, scenarios, decisions, evidence, and unresolved questions. Codex then inspects current code and makes authorized edits with ordinary tools. After behavior checks, Projector checks the retained context against current source and dependencies.

Use `$projector-change` when the intended meaning itself must change. It prepares a readable preview of the canonical changes and affected obligations. Applying that preview requires the exact reviewed plan and its current hash. This is a controlled change to the model, not a replacement for normal implementation work.

## What Projector does not establish

Retrieval is not proof that every relevant obligation appeared in the packet. An open query, omitted item, or unavailable source remains an uncertainty to inspect. A passing check does not show that the software is correct, that the model is complete, or that a behavior test covered every case. A hash establishes agreement about bytes or normalized values, not truth.

For a consequential code review, use `$projector-review` to inspect the actual diff, trace concrete producers and consumers, and try counterexamples. Run application behavior checks that cover the changed path.

## Where state lives

The canonical `.projector/` model and configuration are project data. Runtime receipts, contexts, and recovery journals live in `.projector/runtime/`. The model index at `.projector/README.md` links to the records and is the starting point for direct inspection. See [Model and context](model-and-context.md) for ownership and identity.

## Next steps

Activate and try Projector with [Getting started](getting-started.md). For a tour through one use case, see [Examples](examples.md). For skill selection, see [Skills](skills.md).
