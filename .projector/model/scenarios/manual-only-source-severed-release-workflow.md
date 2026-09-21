+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:manual-release-tests-exact-candidate-without-source-checkout"
key = "manual-release-tests-exact-candidate-without-source-checkout"
lifecycle = "active"

[metadata]
aliases = [ "scenario:17:manual-only-source-severed-release-workflow" ]
sourceClass = "authored"
+++

# Exercise the package as installed

## Given

The release package and plugin have been assembled from verified source.

## When

Exercise their public commands in a fresh ordinary repository with workspace module resolution removed.

## Then

Initialization, context retrieval, canonical preview/apply, checks, inspection and read-only resumption work using the bundled runtime. Retain the exact package and observed results.

## Must not

Claim that successful compilation or a copied source checkout proves the installed package works. Treat test isolation as a mandatory product confinement backend.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:self-hosted-value"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 124-132; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

```
</details>
