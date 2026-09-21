+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:independent-conformance-detects-shared-rebuild-bug"
key = "independent-conformance-detects-shared-rebuild-bug"
lifecycle = "active"

[metadata]
aliases = [ "scenario:05:shared-bug-rebuild-oracle", "adversary:03:shared-analyzer-bug-fooling-both-incremental-and-rebuild-paths" ]
sourceClass = "authored"
+++

# Shared-bug rebuild oracle

## Given

Incremental and clean rebuild paths share the same semantic analyzer.

## When

Inject a bug into a semantic analyzer used by both incremental and clean rebuild paths so both produce the same incorrect interpretation. Provide an independent test/schema/runtime lane that contradicts it.

## Then

rebuild oracle alone appears consistent, but independent conformance prevents a strong completion claim and surfaces the contradiction.

## Given

Adversarial evaluation must exercise this class and reject false success: Shared analyzer bug fooling both incremental and rebuild paths.

## Then

Testing must attack both implementation bugs and Projector's ability to become confidently self-consistent while wrong.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:evidence-bound-completion"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 36-42; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 3; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Testing and adversarial evaluation strategy; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

```
</details>
