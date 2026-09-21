+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:discover-single-authored-invariant-across-packages"
key = "discover-single-authored-invariant-across-packages"
lifecycle = "active"

[metadata]
aliases = [ "scenario:33:encapsulation-is-not-retrieval" ]
sourceClass = "authored"
+++

# Encapsulation is not retrieval

## Given

Acceptance case "Encapsulation is not retrieval": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Store one invariant in a single canonical semantic file. Bind it to three capabilities in unrelated packages through typed Relations/selectors.

## Then

the invariant is authored once, discovered for each relevant change, and never duplicated into package-local specs solely for discoverability.

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
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md"
contentHash = "sha256:v1:11d59a588b7fa0a781ace0a04b81e0856a45b59bbaba6fe0cf433e7200a16b39"
description = """Full acceptance case \"Encapsulation is not retrieval\", starting line 49; immutable Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. \
  Hash binds original Git bytes."""

```
</details>
