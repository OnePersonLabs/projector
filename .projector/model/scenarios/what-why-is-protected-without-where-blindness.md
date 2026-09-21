+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:separate-intent-from-solution-with-topology-context"
key = "separate-intent-from-solution-with-topology-context"
lifecycle = "active"

[metadata]
aliases = [ "scenario:39:what-why-is-protected-without-where-blindness" ]
sourceClass = "authored"
+++

# WHAT/WHY is protected without WHERE blindness

## Given

Acceptance case "WHAT/WHY is protected without WHERE blindness": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Request a change phrased partly as a solution. Seed existing code/decisions that make several affected areas non-obvious.

## Then

- Intent Analysis separates behavioral goal/constraints from implementation proposal.
- Relevance Scout may inspect code/graph topology to find WHERE/WHAT-ELSE.
- architecture choice is not accepted merely because nearby code uses one technology.
- the resulting Relevance Closure informs architecture preflight without contaminating the Requirement with implementation detail.

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
description = """Full acceptance case \"WHAT/WHY is protected without WHERE blindness\", starting line 99; immutable \
  Git blob 5d6f3dca8cdea899e17922829e54d0561c8f940a. Hash binds original Git bytes."""

```
</details>
