---
name: projector-change
description: Execute a Projector-approved state-bound change with preview, capability, observation, and recovery checks.
---

# Projector change

Before changing anything, compile or load the plan and capsule through Projector. Confirm the current state binding, exact semantic scopes, write paths, risk class, required validators, and completion contract. A merely plausible plan is not approved.

Use dry-run or preview first. For a mutation, use only the issued capability-bound operation or the public `change` to `plan` to `apply`/`reconcile` sequence. Do not use a raw shell command, repository script, or external provider as a substitute for the authorized operation.

After execution, require authenticated before-and-after observations, validator results, journal or receipt artifacts, and fixed-point reconciliation. If the result is ambiguous, stale, unavailable, partially applied, or recovery-required, preserve that status and stop rather than retrying by guesswork.
