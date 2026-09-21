+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:detect-new-consumer"
key = "detect-new-consumer"
lifecycle = "active"

[metadata]
aliases = [ "scenario:07:selector-membership-change", "scenario:42:membership-changing-fact-invalidates-context-even-when-loaded-entities-are-unchanged", "scenario:43:newly-relevant-semantic-state-invalidates-negative-space-proof", "property:05:adding-an-entity-relation-membership-that-changes-a-bound-query-result-invalidates-revalidates-the-binding-even-when-every-previously-returned-entity-hash-is-unchanged", "adversary:25:missing-negative-space-query-dependency-incorrectly-preserving-stale-relevance-after-a-newly-matching-entity-edge-appears" ]
sourceClass = "authored"
+++

# Detect a newly relevant consumer

## Given

A saved context includes a relation or selector query, even if its result was empty.

## When

A new consumer or binding changes that query result outside Projector.

## Then

Reconciliation identifies the affected context as stale and a new context includes the consumer with an inspectable reason.

## Must not

An empty prior result is treated as permanent proof that no consumer exists.

## Given

Additional acceptance case: A private symbol is not a member of public-API selectors before it becomes exported.

## When

Additional acceptance case: A private symbol becomes exported.

## Then

Additional acceptance case: membership changes. Public API rules and projection expectations newly apply. Docs/compatibility/contract closure updates even though the path is unchanged. Localized caches invalidate only affected dependencies.

## Given

Acceptance case "Membership-changing fact invalidates context even when loaded entities are unchanged": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Compile a capsule whose applicable rules depend on whether a symbol is public. Change only the export membership so a new public-contract rule applies.

## Then

the selector/query membership dependency changes, invalidating/recompiling the capsule even if the previously loaded Requirement/Concept bodies are byte-identical.

## Given

Acceptance case "Newly relevant semantic state invalidates negative-space proof": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Compile a Relevance Closure whose bound identity, relation-adjacency, and selector-membership queries establish the current relevant subgraph. Keep every entity already present in that closure unchanged. Add a new canonical Relation or semantic entity that now matches one bound query. The new result makes another governing concern relevant.

## Then

- hashes of the previously selected entities may remain unchanged.
- the corresponding `StateQueryDependency.priorResult.resultHash` changes when the deterministic query is re-evaluated.
- the prior Relevance Closure/StateBinding is not treated as current merely because its previously returned entities are unchanged.
- Projector recomputes the affected closure and includes the newly relevant semantic state.
- unrelated additions that do not change any bound query result do not stale the closure.

## Then

Property across the applicable input population: adding an entity/Relation/membership that changes a bound query result invalidates/revalidates the binding even when every previously returned entity hash is unchanged.

## Given

Adversarial evaluation must exercise this class and reject false success: Missing negative-space/query dependency incorrectly preserving stale relevance after a newly matching entity/edge appears.

## Then

Unit evaluation must cover: selectors and dependency-keyed cache invalidation.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 50-56; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Membership-changing fact invalidates context even when loaded entities are unchanged\", \
  starting line 127; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original \
  Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Newly relevant semantic state invalidates negative-space proof\", starting line \
  134; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 5; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 25; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 10; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/knowledge/service.test.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/control-plane/src/knowledge/service.test.ts"
description = """Observed implementation surface for scenario:detect-new-consumer; the selector is evaluated from repository \
  facts."""

```
</details>
