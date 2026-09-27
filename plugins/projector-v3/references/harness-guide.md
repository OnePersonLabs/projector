# Integrating Projector with Codex

Projector owns accepted meaning, evidence bindings, reconciliation and controlled-write recovery. Codex owns task execution, tools, delegation and conversation. Use ordinary host edits for implementation that preserves accepted meaning; a second run through Projector adds no behavioral assurance.

The normal installed entry is `scripts/projector.mjs`. The [operation contract](operation-contract.md) describes its short commands and the machine entry. Both call existing package services; neither keeps a parallel authority or task store.

Keep instructions at their actual scope. Plugin `AGENTS.md` provides the small shared baseline. Owning skills supply task-specific judgment. Hooks may report a meaningful session-boundary change; repeated prompts and tool calls need no reminder. Hooks never accept meaning or authorize a write.

Canonical Markdown and TOML load directly into Core schemas. Runtime caches are disposable derivations; lifecycle records and journals preserve exact acceptance/recovery evidence. A context ID is useful only with its authenticated content and checked dependencies. Current source queries must reconsider membership, including consumers that did not exist at planning time.

An integration must inspect readiness and the operation-specific outcome. Inactive, unavailable, unsupported format, lost access and interrupted writes remain explicit. Preserve uncertain evidence. Only explicit authenticated application or recovery may mutate a controlled transaction. Automatic resume is inspection and context restoration.

Test custom integration with an installed package in an isolated repository, including stale approval and interruption paths where it can mutate persistent data. A successful command or delivered instruction proves neither agent understanding nor untested behavior. Keep application-specific adapters outside the general runtime.
