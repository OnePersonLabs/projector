+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:preserve-valid-work-across-plan-revisions"
key = "preserve-valid-work-across-plan-revisions"
lifecycle = "active"

[metadata]
aliases = [ "scenario:21:partial-completion-and-plan-rebase" ]
sourceClass = "authored"
+++

# Preserve valid work across a changed plan

## Given

A controlled change has completed some accepted work and retains its bound dependencies.

## When

Work stops and a later change affects the repository before continuation.

## Then

Keep settled canonical decisions. Reconsider only completed work whose bound dependencies changed; carry unaffected valid work into a new plan or rebind it when all recorded dependencies remain current.

## Must not

Resume a stale plan blindly, discard unaffected completed work, or require a named test technique as product behavior.

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
description = """Historical acceptance conditions, lines 158-164; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 30; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
