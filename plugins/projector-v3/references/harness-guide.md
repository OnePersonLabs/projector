# Integrating Projector with Codex

Projector owns accepted meaning, evidence bindings, reconciliation and controlled-write recovery. Codex owns task execution, tools, delegation and conversation. Use native Codex Plan mode for a concrete model and implementation proposal without canonical capture or code writes. Authorized execution through [$projector](../skills/projector/SKILL.md) can accept changed meaning, edit code and verify the result as one task. Ordinary host edits need no Projector-controlled code execution. A behavior repair can keep the model unchanged.

The installed shell entry is `scripts/projector.mjs`. The [operation contract](operation-contract.md) describes its short commands and machine entry. Both call the same package services and keep no parallel authority or task store. Default operations have no execution deadline or repository-size ceiling.

Keep instructions at their actual scope. Plugin `AGENTS.md` provides the small shared baseline. Owning skills supply task-specific judgment. Hooks may report a meaningful session-boundary change; repeated prompts and tool calls need no reminder. Hooks never accept meaning or authorize a write.

Canonical Markdown and TOML load directly into Core schemas. Runtime caches are disposable derivations; lifecycle records and journals preserve exact acceptance/recovery evidence. A context ID is useful only with its authenticated content and checked dependencies. Current source queries must reconsider membership, including consumers that did not exist at planning time.

An integration must inspect readiness and the operation-specific outcome. Inactive, unavailable, unsupported format, lost access and interrupted writes remain explicit. Preserve uncertain evidence. Only explicit authenticated application or recovery may mutate a controlled transaction. Automatic resume is inspection and context restoration.

Test custom integration with an installed package in an isolated repository, including stale approval and interruption paths where it can mutate persistent data. A successful command or delivered instruction proves neither agent understanding nor untested behavior. Keep application-specific adapters outside the general runtime.
