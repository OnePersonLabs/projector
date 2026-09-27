---
name: propose
description: Turn a natural-language request into a complete Projector proposal, requirements, designs, and tasks; also start a change or draft its artifacts incrementally.
---

Read [artifact authoring](references/artifacts.md) and [the runtime contract](../apply/references/runtime.md).

1. Establish the repository and requested outcome. Inspect relevant code, live requirements/designs, existing changes, and instructions. Reuse an explicitly selected change; otherwise derive a unique kebab-case name. Ask only when multiple existing changes plausibly own the request.
2. If setup is missing and Projector use is explicitly requested, run $projector:init. Do not impose Projector setup on an unrelated coding request merely because this skill is available.
3. Author the artifacts yourself in dependency order: proposal, nested requirement deltas when behavior changes, nested design deltas when decisions change, then concrete tasks. For legitimate work without requirement deltas use `skip_specs: true` in metadata and preserve existing authority. Read installed schema instructions and the artifact reference. Replace instructional text with repository-specific meaning; never invent a target, digest, reference, selector, requirement, or design merely to complete a dependency. For a new design use Add: design; for an existing design use its exact baseline digest. Record material alternatives and acceptance criteria.
4. Default to a complete proposal. For “start a change” or “one step at a time,” author only the next requested artifact layer, report what is ready, and leave later layers absent. A fast-forward request means author all planning layers, not permission to skip review or checks.
5. Validate complete artifacts with the bundled OpenSpec strict validator. Correct structural errors and inspect cross-artifact meaning. For legitimate work without requirement deltas, use `skip_specs: true` in change metadata and preserve existing authority; do not invent requirements to satisfy dependencies. Use $projector:verify to derive obligations before inspecting existing assertions for fresh work. Do not prepare an implementation checkout merely to validate an incomplete draft.
6. Show a short behavior/scope summary and links to the authored artifacts. Default to human review before implementation. When the user already authorized end-to-end execution, continue to $projector:apply and $projector:finish without another approval ceremony. Material changes of intent still need clarification.

Completion: the requested planning frontier is coherent and validated to the extent possible, with the next action identified. Humans review the proposal; they do not fill in templates.
