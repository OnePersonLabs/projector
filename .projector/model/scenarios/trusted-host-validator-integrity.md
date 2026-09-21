+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:validate-trusted-host-source-and-execution-bounds"
key = "validate-trusted-host-source-and-execution-bounds"
lifecycle = "active"

[metadata]
aliases = [ "scenario:16:trusted-host-validator-integrity", "property:13:increasing-uncertainty-cannot-lower-approval-risk-requirements" ]
sourceClass = "authored"
+++

# Trusted host validator integrity

## Given

A pinned tracked validator and its compiled Git/content identity are available on native Windows and direct WSL.

## When

Run a pinned tracked validator through the native host on Windows and direct WSL. Exercise a denied host launch, a failing validator, a changed source before execution, source drift during execution, caller cancellation, timeout, and output exhaustion.

## Then

Projector launches only the exact resolved source whose bytes match the compiled Git/content identity. It rechecks those bytes afterward and enforces time, output, and cancellation bounds. It records the observed result and host assumptions separately. Denied launch and every failed, changed, interrupted, or cleanup-unconfirmed case cannot establish conformance. No output claims filesystem confinement, network denial, immutable overlays, or hostile same-user protection.

## Then

Property across the applicable input population: increasing uncertainty cannot lower approval/risk requirements.

## Then

Monotonic normalized risk/approval requirements operate within actual authenticated authorization and accepted host policy. Increased uncertainty is not permission to invent a mandatory new human prompt, confinement requirement, or hostile-writer guarantee.

## Then

Unit evaluation must cover: risk/policy normalization.

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
description = """Historical acceptance conditions, lines 117-123; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property 13 from the immutable testing inventory; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Accepted authorization and host-policy limit on property13; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 27; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
