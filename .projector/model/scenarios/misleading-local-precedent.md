+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:prefer-semantic-precedent-over-file-proximity"
key = "prefer-semantic-precedent-over-file-proximity"
lifecycle = "active"

[metadata]
aliases = [ "scenario:26:misleading-local-precedent", "adversary:16:misleading-local-precedent" ]
sourceClass = "authored"
+++

# Misleading local precedent

## Given

A nearby file uses the wrong architectural pattern while semantically matching precedents exist elsewhere.

## When

Seed a nearby file with the wrong architectural pattern while semantically matching precedents exist elsewhere.

## Then

semantic role/relationship evidence outranks proximity. No new accidental fork is created.

## Given

Adversarial evaluation must exercise this class and reject false success: Misleading local precedent.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:pre-edit-relevance"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 193-199; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 16; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
