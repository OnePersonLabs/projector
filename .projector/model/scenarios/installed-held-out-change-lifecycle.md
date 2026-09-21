+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:recover-installed-held-out-change-lifecycle"
key = "recover-installed-held-out-change-lifecycle"
lifecycle = "active"

[metadata]
aliases = [ "scenario:19:installed-held-out-change-lifecycle", "adversary:33:installed-source-severed-lifecycle-interruption-recovery-and-identity-continuity" ]
sourceClass = "authored"
+++

# Recover interrupted writes without replaying authority

## Given

A controlled change has current exact approval and an authenticated journal.

## When

The applying process tree stops after durable target mutation and before completion.

## Then

A fresh process can inspect the retained invocation, journal and authority. Explicit recovery restores the journaled consistent state only after ownership is established. Preserve ambiguity as recovery-required.

## Then

A subsequent explicit apply rechecks exact plan authority and current dependencies. Reject a substituted hash, changed validator, out-of-scope write or stale dependency. An unrelated change may rebind only through the existing dependency rules.

## Then

Independent validation uses its authenticated source bytes. A completed apply retains its receipt; repeated explicit application returns the same completed result without duplicating work.

## Must not

Resume silently recovers, applies changes, renews authority or hides unavailable evidence.

## Must not

Represent native execution or disposable test isolation as protection against hostile same-user access.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:reverse-reconciliation"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 140-150; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/decisions/f1d7f82a89ecaa14199107b9aed7953eba0a14e39b42672b61b3f24db1322d51.decision.json"
contentHash = "sha256:v1:623673cf17762ec9d36c6e364e59e739ee940eb58bf4c1333f37deb6ee3f9210"
description = """Accepted registered in-process runner supersedes standalone MCP and wrapper-to-CLI delivery prescriptions. \
  Immutable Git blob d307af7324bdae70577cbec60042b4fc8ed05db1; exact-byte SHA-256."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/model/concepts/01561d6546adb32a8afb29429380b0ecdec1bd6a9dd562fbea23a395381ca5b8.concept.json"
contentHash = "sha256:v1:a4dd211d265700ff82bf503b4cedf13661ad8d9ec3aea6f147004e754a9634c3"
description = """Accepted host integrity preserves exact authority, state, provenance, cancellation and recovery without \
  confinement or hostile same-user protection. Immutable Git blob 3ccfee51b0a75179711d6ded3324b17b8279da61; \
  exact-byte SHA-256."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 33; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Complete Host tests section with explicit installed-runner supersession; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. \
  Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 31; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
