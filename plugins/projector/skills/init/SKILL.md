---
name: init
description: Initialize a repository for Projector or adopt an existing OpenSpec project while preserving its configuration and history.
---

Read [the runtime contract](../apply/references/runtime.md) before calling tools.

1. Resolve the intended local Git repository root and inspect its instructions, status, existing OpenSpec configuration, schema, active changes, and archives. Setup is authorized by this invocation; do not ask the user to operate a terminal. The helper requires a Git repository and does not create or commit a baseline. If the intended directory is not yet a Git repository, establish that prerequisite within the authorized setup scope before calling it, preserving existing files and any enclosing repository. Report an unborn HEAD as a later prepare prerequisite; planning can proceed without a baseline commit.
2. Call `initProject({root})`. Report conflicts with the exact affected files and preserve custom configuration and schemas. Resolve conflicts only within the user's authorized scope; never silently replace a customized schema.
3. Verify the returned readiness and created scaffolding. An existing project's default schema may remain unchanged: new Projector changes explicitly select `schema: projector`.
4. For adoption, inspect one selected active change. Read [artifact authoring](../propose/references/artifacts.md), preserve its intent and nested capabilities, and translate its relevant design decisions into Projector deltas. Preserve historical archives and unrelated instructions. OpenSpec store-backed configuration is unsupported by initProject: preserve the store declaration, report the returned error, and do not manufacture local scaffolding or redirect its authority. A separate store migration requires an explicit scoped request.
5. Finish with the repository, setup outcome, and a concrete example such as “Use $projector:propose to add password reset.” If the user already supplied a change request, continue into that skill without asking them to repeat it.

Completion: setup can be repeated without destructive changes, and the next skill can create a Projector change using the installed schema.
