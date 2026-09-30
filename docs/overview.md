# Overview

Projector lets you develop from a readable conceptual model. The model defines the system's concepts, relationships, requirements, scenarios and architectural decisions. It owns intended behavior; the current code is a realization that can change as the system develops.

## Start with the concepts

In a music app, a Clip owns reusable notes. An arrangement can reference that Clip more than once, with separate positions and transpose values for its uses. The requirement states that each value belongs to its use and playback leaves the shared Clip unchanged. The scenario makes this concrete with one C4 clip playing C4 and D4 before and after save and reload.

Those records govern later work even if the implementation changes its classes, database tables or playback engine. The model also retains accepted future capabilities that have no implementation yet. Typed relationships connect the records, and source queries connect relevant meaning to inspected code. Read the [worked example](examples/clip-use.md) to see the proposed contents and a later revision under the same identities.

## The everyday use

Start with `$projector` and describe your task: ask what a feature involves, discuss a change in native Codex Plan mode, or request a feature or fix directly. Codex retrieves the relevant model and inspects current code, dependencies and unresolved questions before choosing changes.

When intended meaning changes, `$projector` shows readable proposed records and their implementation consequences. In native Codex Plan mode, you inspect and revise the contents, IDs, paths and reasons without changing canonical files or code. Once authorized execution is available, Codex accepts the model change through Projector's lifecycle, implements it and verifies the task. The completion report links the actual model changes and explains the code and evidence. A repair can change code under the existing model and report that the model was unchanged.

## What Projector does not establish

Retrieval is not proof that every relevant obligation appeared in the packet. An open query, omitted item, or unavailable source remains an uncertainty to inspect. A passing check does not show that the software is correct, that the model is complete, or that a behavior test covered every case. A hash establishes agreement about bytes or normalized values, not truth.

Use `$projector-verify` to inspect actual code against concepts, requirements, and scenarios, trace concrete producers and consumers, and try counterexamples. Run application behavior checks that cover the changed path.

## Where state lives

The canonical `.projector/` model and configuration are project data. Runtime receipts, contexts, and recovery journals live in `.projector/runtime/`. The model index at `.projector/README.md` links to the records and is the starting point for direct inspection. See [Model and context](model-and-context.md) for ownership and identity.

## Next steps

Activate and try Projector with [Getting started](getting-started.md). For a tour through one use case, see [Examples](examples.md). For skill selection, see [Skills](skills.md).
