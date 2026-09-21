+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:heuristic-signature-cannot-prove-behavior"
key = "heuristic-signature-cannot-prove-behavior"
lifecycle = "active"

[metadata]
aliases = [ "scenario:03:semantic-signature-insufficiency", "adversary:02:semantic-signature-insufficiency" ]
sourceClass = "authored"
+++

# Semantic-signature insufficiency

## Given

Two implementations share a heuristic signature while observable behavior differs outside its assurance scope.

## When

Create two implementations with the same heuristic semantic hash/profile but an observable behavior difference outside that profile.

## Then

heuristic equality cannot backdate downstream validity. The unit requires independent revalidation or widened analysis.

## Given

Adversarial evaluation must exercise this class and reject false success: Semantic-signature insufficiency.

## Then

Unit evaluation must cover: semantic-signature assurance.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:scoped-invalidation"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 22-28; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 2; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 20; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
