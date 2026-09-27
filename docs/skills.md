# Skill invocations

These skill invocations guide Codex through Projector workflows. They are not CLI commands. Use the terminal `projector` operations for exact command-line actions; see the [CLI reference](reference/cli.md).

## Contents

- [`$projector`](#projector)
- [`$projector-change`](#projector-change)
- [`$projector-review`](#projector-review)
- [`$projector-reconcile`](#projector-reconcile)
- [`$projector-assimilate`](#projector-assimilate)
- [A typical handoff between skills](#a-typical-handoff-between-skills)

## `$projector`

Use this for the everyday work loop: retrieve accepted meaning, continue an actual retained context, inspect records, check consequences, or explicitly recover a recognized interrupted controlled write. It helps the agent select relevant meaning before work and revisit it afterward.

## `$projector-change`

Use this when intended project meaning changes. The skill resolves existing identities, drafts a strict proposal, previews affected meaning, and applies only the exact reviewed plan. Then use normal implementation tools and behavior checks to realize it.

## `$projector-review`

Use this to review an actual candidate diff against accepted meaning and current dependencies. It traces producers, persistence, consumers, registrations, and tests, and looks for concrete failure traces.

## `$projector-reconcile`

Use this when a pull, direct edit, new consumer, or changed assumption affects the repository outside an existing Projector context. The skill identifies what remains current and what requires reconsideration.

## `$projector-assimilate`

Use this to turn a large or branching body of source material into a durable working synthesis. It keeps its notes and intake separate from Projector's canonical model. Use it when the source intake itself is substantial; a simple summary or ordinary change does not need it.

## A typical handoff between skills

Routine work starts with `$projector`, then uses normal code tools and checks. If implementation changes accepted meaning, route that boundary through `$projector-change`. For a high consequence diff, add `$projector-review`; when edits arrived from outside the retained work, use `$projector-reconcile`. For a source pile that needs its own durable synthesis, use `$projector-assimilate` before preparing a canonical change.

The full instructions ship with the installed plugin under `plugins/projector-v3/skills/`. Continue with [Workflows](workflows.md) or the [CLI reference](reference/cli.md).
