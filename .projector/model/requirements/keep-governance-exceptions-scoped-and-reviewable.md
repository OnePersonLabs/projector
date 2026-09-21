+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:scoped-governance-exceptions"
key = "scoped-governance-exceptions"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Keep governance exceptions scoped and reviewable

A governance exception is an explicit scoped deviation, not a rewrite of underlying authority to erase a conflict. It must identify a stable ID/key, exact semantic selector, excepted rule/lens/expectation, rationale, supporting evidence, owner, typed review or expiry trigger and invalidation conditions. Remediation or exit criteria are optional. Prefer narrower semantic selectors; broad path-wide suppression should be rejected when a narrower selector is available. Expired or invalidated exceptions re-enter divergence evaluation.

The general acceptance, reevaluation and retirement workflow remains active but explicitly unrealized by this ingestion. Reconsider when a supported change/reconciliation flow needs a real temporary deviation and can demonstrate expiry/invalidation and any declared exit behavior. Do not create an exception instance from generic design. Internal types and completion dispositions do not prove a connected public lifecycle. Scope follows existing executable-governance and reconsideration meaning, not fabricated implementation mappings.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:executable-lenses"

[[scope.items]]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:scoped-reconsideration"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md"
contentHash = "sha256:v1:aa322881e51538f7a9ec4a3c4a3195d50c495faf14ee598f03eb9288e22f8856"
description = """Historical scoped-deviation invariant with optional remediation/exit criteria; not an exception instance. \
  Source range 126-163; Git blob 04fdadb79ebfc5108b500d559e7fd6f5761138f2; content hash is SHA-256 of \
  exact blob bytes."""

```
</details>
