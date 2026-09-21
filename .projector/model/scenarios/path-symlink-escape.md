+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:reject-controlled-out-of-root-mutation"
key = "reject-controlled-out-of-root-mutation"
lifecycle = "active"

[metadata]
aliases = [ "scenario:25:path-symlink-escape" ]
sourceClass = "authored"
+++

# Path/symlink escape

## Given

Symlinks or platform-specific paths would escape the repository if naively resolved.

## When

Create symlinks and platform-specific paths that would escape repository root if naively resolved.

## Then

observation may describe them according to policy, but mutation is root-constrained and refuses out-of-root writes.

## Must not

This controlled-mutation path check is presented as confinement of arbitrary host validators or protection against hostile same-user code. Observation and host permissions retain their accepted separate limits.

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
description = """Historical acceptance conditions, lines 186-192; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/model/concepts/01561d6546adb32a8afb29429380b0ecdec1bd6a9dd562fbea23a395381ca5b8.concept.json"
contentHash = "sha256:v1:a4dd211d265700ff82bf503b4cedf13661ad8d9ec3aea6f147004e754a9634c3"
description = """Accepted host integrity preserves exact authority, state, provenance, cancellation and recovery without \
  confinement or hostile same-user protection. Immutable Git blob 3ccfee51b0a75179711d6ded3324b17b8279da61; \
  exact-byte SHA-256."""

```
</details>
