---
name: projector-lean-delivery
description: Implement and review Projector changes against observable behavior, including context reuse, invalidation, architectural predicates, and recovery. Use for Projector implementation or repair work.
disable-model-invocation: false
---

# Projector delivery

Before choosing edit paths, follow the repository's `AGENTS.md` context and reconciliation procedure. Treat existing specifications, reports, status fields, and tests as claims to check against the user's intent and current code.

Keep tightly coupled work with its current owner. Delegate substantial independent work only when it is expected to reduce total effort, latency, or context load; reuse prior findings and assign nonoverlapping ownership. There is no standing agent pair, model mandate, or per-change review quota.

Treat the delivery plan as a hypothesis. Update the same plan when implementation changes its assumptions, ordering, or verification method. Preserve required outcomes and challenge amendments against concrete failure modes; explicitly revise canonical meaning when the intended behavior changes. Do not retain a costly procedure merely because an earlier plan prescribed it.

Use [$projector-verify](../../../plugins/projector-v3/skills/projector-verify/SKILL.md) as the canonical verification procedure. Derive obligations before inspecting assertions, keep test-change decisions separate from execution selection, and check coherent slices. Retain stronger checks for stale mutation authority, persistent data, upgrades, and interrupted writes. Retain context and lifecycle identities in their actual Projector owners; no parallel report ledger is required.

During implementation, reuse the canonical schemas, identity, relevance, state binding, lens, and lifecycle components. Rebuild packages before testing consumers that import their `dist` outputs.

Run `pnpm verify` for an integrated executable change or final release. Reuse a passing gate only when its relevant inputs and coverage still match. Run `pnpm release:check` for installed release qualification. Instruction or deletion-only cleanup needs applicable validity checks, not an automatic full suite. Use the installed workflow exercise to cover host wiring that unit tests cannot observe; rerun it when those dependencies change. Unsupported capabilities remain explicit.

Use independent review for consequential authority, persistence, or architectural changes and where it adds a distinct perspective. Review the integrated change once, consolidate material repairs, and check their closure narrowly. A blocker needs a concrete requirement, supported failure path, and material consequence. Do not create additional certificate or transcript-processing machinery merely to record that a check ran.

Before calling work complete, distinguish specified intent, implemented behavior, public integration, and demonstrated advantage. Passing self-authored tests proves only their exercised behavior. Comparative quality and economics require a strong ordinary-agent baseline, including a later change and stale-knowledge detection.
