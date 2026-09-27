---
name: projector-reconcile
description: Explain how external edits, pulls or changed assumptions affect accepted Projector meaning and retained context.
disable-model-invocation: false
---

# Reconcile a changed repository

Use the requested scope, named commits or actual retained context as the comparison basis. With no historical anchor, inspect the current diff and retrieve fresh context; do not invent prior intent. An explicit request or existing authorization is sufficient to investigate. A hook notice is only an observation.

Use `$projector` to run `check` and restore the relevant meaning. Examine current producers, consumers, source-query membership, persistence and tests. Compare behavior with the applicable obligations and conditional rationale. A changed hash can mean a harmless edit, a changed assumption, a new consumer, a violation or unavailable evidence; state which the evidence supports.

For a consequential diff, use `$projector-review` to produce concrete counterexamples and actionable repairs. Delegate when the investigation is separable and worth its context cost. Keep ownership clear, preserve concurrent work and reuse existing evidence.

Report what changed, which conclusions remain current, what must be reconsidered and what is still unknown. Revise canonical meaning with `$projector-change` only when the user intends that revision. Fix behavior within existing authorization and check affected evidence again. Do not turn an observed implementation into accepted intent automatically.

For an existing repository finding, acknowledge it through the machine `repository.check` operation only after the investigation is delivered or explicitly dismissed. That acknowledgement does not certify conformance. The [operation contract](../../references/operation-contract.md) describes exact evidence access and lifecycle protections.
