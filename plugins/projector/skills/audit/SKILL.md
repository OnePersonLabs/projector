---
name: audit
description: Audit drift between Projector requirements, designs, tasks, and implementation, including stale claims and missing verification.
---

Read [the runtime contract](../apply/references/runtime.md) when using Projector tools. This is a read-only assessment unless the user also requests fixes.

1. Fix the scope and basis: accepted revision, selected active change, or managed candidate. Inspect authority and actual source at that same basis; do not compare a proposed target with unrelated current code.
2. Trace observable requirements to responsible concerns, realization bindings, implementation, and evidence. Inspect relevant consumers and tests. Identify unsupported retained structure, missing or contradictory behavior, stale references, incomplete tasks, and untested assertions.
3. Separate confirmed defects from plausible risks and unverified claims. Existing checkboxes and narrative evidence do not demonstrate that checks ran against current code.
4. Report findings in consequence order with concrete file/reference evidence, expected versus actual behavior, and the smallest useful fix. State scope and checks actually performed; do not claim exhaustive coverage from a partial scan.
5. If fixes are authorized, route changed intent/artifacts to $projector:revise, existing dirty implementation to $projector:reconcile, or implementation defects to $projector:apply. Audit does not silently rewrite accepted authority to match bugs.

Completion: the user receives actionable, evidence-backed drift findings or a bounded no-findings report with verification limits.
