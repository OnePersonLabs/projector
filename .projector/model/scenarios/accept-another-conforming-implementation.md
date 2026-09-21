+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:alternate-conforming-code"
key = "alternate-conforming-code"
lifecycle = "active"

[metadata]
aliases = [ "scenario:08:multiple-valid-shared-implementations", "adversary:09:multiple-valid-handwritten-implementations", "property:10:hard-rule-composition-is-order-independent", "property:11:selector-lens-rule-applicability-is-deterministic-for-fixed-dependencies" ]
sourceClass = "authored"
+++

# Accept another conforming implementation

## Given

An applicable active lens defines a predicate-constrained implementation boundary.

## When

An ordinary agent changes the implementation without using a Projector transform.

## Then

Current predicates determine conformance; changed source bindings may still make earlier reasoning stale.

## Must not

Projector demands canonical bytes from a predicate-constrained handwritten implementation or calls stale reasoning a semantic violation.

## Given

Additional acceptance case: Two structurally different handwritten implementations satisfy the same active predicates and tests.

## When

Additional acceptance case: Two handwritten implementations satisfy the same active predicates and tests but are structurally different.

## Then

Additional acceptance case: a `predicate-constrained` expectation accepts both. Projector does not invent one exact canonical body and flag the other as divergent.

## Given

Adversarial evaluation must exercise this class and reject false success: Multiple valid handwritten implementations.

## Then

Property across the applicable input population: hard-rule composition is order-independent.

## Then

Property across the applicable input population: selector/lens/rule applicability is deterministic for fixed dependencies.

## Then

Unit evaluation must cover: typed rule predicate composition/conflicts.

## Then

Unit evaluation must cover: lens overlap/composition.

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
locator = "git:4ae2774b8d84359fbfdb5d20e7c276b5cff41d18:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
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
description = """Historical acceptance conditions, lines 57-63; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 9; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 10 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 11 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 11; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 12; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[realizations]]
[realizations.selector]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/control-plane/src/knowledge/service.test.ts"

[realizations.origin]
kind = "git"
locator = "git:fbb691eb4b7bb62ef51e8d94ff97474782abb95a:packages/control-plane/src/knowledge/service.test.ts"
description = """Observed implementation surface for scenario:alternate-conforming-code; the selector is evaluated from \
  repository facts."""

```
</details>
