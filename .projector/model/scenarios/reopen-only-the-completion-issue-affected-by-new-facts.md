+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:reopen-completion-obligation"
key = "reopen-completion-obligation"
lifecycle = "active"

[metadata]
aliases = [ "property:12:lowering-evidence-coverage-cannot-produce-a-stronger-completion-claim" ]
sourceClass = "authored"
+++

# Reopen only the completion issue affected by new facts

## Given

A scoped issue was settled by accepted meaning or a valid explicit deferral.

## When

A subsequent change adds an unmapped member or violates a governing rule.

## Then

Completion identifies the affected obligation with stable identity, new evidence and a repair route while unrelated settled issues remain settled.

## Then

Property across the applicable input population: lowering evidence/coverage cannot produce a stronger completion claim.

## Then

Unit evaluation must cover: coverage proof rules.

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
value = "packages/control-plane/src/coverage/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/coverage/service.test.ts"

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
description = """Recovered historical design evidence; retained conditions and limits require explicit acceptance through \
  this proposal."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 12 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 29; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/coverage/service.test.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/control-plane/src/coverage/service.test.ts"
description = """Observed implementation surface for scenario:reopen-completion-obligation; the selector is evaluated \
  from repository facts."""

```
</details>
