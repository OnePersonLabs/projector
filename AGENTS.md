# Projector V5 development

The approved design and later activation/publication amendment are in docs/approved-plan.md. Keep implementation in this workspace. Preserve other checkouts. The V5 plugin is opl-projector; use it only in activated projects.

Use native execution and delegation. Keep one writer per mutable surface. Contracts are in docs/interfaces.md; runtime source is in plugins/opl-projector/runtime/. Do not add a second scheduler, implicit global semantic indexing, architecture quotas, or unrequested repository-wide guards.

Use $simplified-technical-english for instructions and implementation guidance. Use $de-ai-writing for human explanations. Write -- instead of an em dash.

Use deterministic checks for behavior. Do not run AI-consuming trials without explicit user authorization. Do not test skill invocation. Preserve supported evidence when another observation fails. Report incomplete coverage as unresolved.
