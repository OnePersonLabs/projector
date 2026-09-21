+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:canonical-rebuild-closure"
key = "canonical-rebuild-closure"
lifecycle = "active"

[metadata]
aliases = [ "scenario:01:canonical-rebuild-closure", "property:22:rebuilding-sqlite-from-canonical-inputs-preserves-semantic-state", "adversary:01:canonical-rebuild-closure", "property:01:canonical-serialization-independent-of-object-insertion-order", "property:08:stable-semantic-hash-excludes-declared-volatile-metadata", "property:09:deterministic-derived-ids-are-stable-across-repeated-indexing" ]
sourceClass = "authored"
+++

# Canonical rebuild closure

## Given

Accepted semantic and governance records are independently addressable; derived SQLite and caches exist.

## When

Create independently addressable canonical files for accepted Concepts, Requirements, Behavioral Scenarios, and authored Relations. Also create rules, an active lens/profile, authority record, decision, exception, and migration. Delete `state.db` and caches.

## Then

all canonical authored/governance semantics reload identically. The deterministic canonical-root digest is identical. Derived observations are recomputed. No hidden local run history or monolithic model file is required.

## Then

Property across the applicable input population: rebuilding SQLite from canonical inputs preserves semantic state.

## Given

Adversarial evaluation must exercise this class and reject false success: Canonical rebuild closure.

## Then

Property across the applicable input population: canonical serialization independent of object insertion order.

## Then

Property across the applicable input population: stable semantic hash excludes declared volatile metadata.

## Then

Property across the applicable input population: deterministic derived IDs are stable across repeated indexing.

## Then

Unit evaluation must cover: canonical serialization and schema-defined semantic hashing.

## Then

Unit evaluation must cover: canonical schema migration.

## Then

Unit evaluation must cover: Zod/public-contract registry completeness.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:durable-meaning"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 3-9; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 22; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 1; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 1 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 8 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 9 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 1; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 8; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 9; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
