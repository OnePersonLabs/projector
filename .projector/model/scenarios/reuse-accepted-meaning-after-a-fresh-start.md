+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:reuse-after-reset"
key = "reuse-after-reset"
lifecycle = "active"

[metadata]
aliases = [ "scenario:40:unrelated-canonical-change-does-not-stale-local-work", "property:03:unrelated-canonical-worktree-changes-do-not-invalidate-a-statebinding-whose-value-dependencies-and-query-result-fingerprints-remain-unchanged", "adversary:23:unrelated-root-state-mutation-incorrectly-staling-scoped-work" ]
sourceClass = "authored"
+++

# Reuse accepted meaning after a fresh start

## Given

Accepted requirements and relations exist in canonical storage. Derived context from an earlier request exists.

## When

A new process requests a subsequent related change after unrelated repository edits.

## Then

Projector retrieves the existing identities and distant obligations, and reuses or rebinds reasoning whose dependencies are unchanged.

## Must not

Projector creates duplicate meaning or treats an unrelated root digest change as sufficient to invalidate every decision.

## Given

Acceptance case "Unrelated canonical change does not stale local work": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Compile an Execution Capsule for a MIDI change. Then change an unrelated avatar Requirement, causing the global canonical-root digest to change.

## Then

- Projector notices the global snapshot changed.
- all bound semantic/physical/query dependencies for the MIDI capsule are unchanged.
- the binding is safely rebound or remains usable according to policy without recomputing the MIDI semantic plan.
- global snapshot identity remains different and receipts still distinguish the snapshots.

## Then

Property across the applicable input population: unrelated canonical/worktree changes do not invalidate a `StateBinding` whose value dependencies and query-result fingerprints remain unchanged.

## Given

Adversarial evaluation must exercise this class and reject false success: Unrelated root-state mutation incorrectly staling scoped work.

## Then

Unit evaluation must cover: dependency-scoped `StateBinding` validation/rebinding after unrelated root changes.

## Given

A resumed agent has the actual retained context ID and, when applicable, change and approval selectors from the earlier work.

## When

The agent continues that work in a fresh session.

## Then

The agent inspects cleanup using those selectors and its current, stale, unknown and recovery-required evidence; it refreshes affected reasoning or recovers unfinished effects before following an authorized next action.

## Must not

The agent guesses a latest selector, treats an earlier result as current authority, or executes nextAction without inspecting its evidence and authorization.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/knowledge/service.test.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/coverage/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/skills/**"

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/08-agents/hosts-and-mcp.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/10-operation/cli-modes-and-security.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/release-and-directive.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Unrelated canonical change does not stale local work\", starting line 110; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 3; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 23; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 24; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[origin]]
kind = "user-request"
locator = "conversation:2026-09-13:complete-existing-projector-control-loop"
description = """The user approved explicit skill, hook, runner, and service ownership; selector-based continuation; \
  installed consumption and recovery verification."""

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/knowledge/service.test.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/control-plane/src/knowledge/service.test.ts"
description = """Observed implementation surface for scenario:reuse-after-reset; the selector is evaluated from repository \
  facts."""

```
</details>
