+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "requirement:governed-migration-overlays"
key = "governed-migration-overlays"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Expose governed lens-transition phases and residue

A concrete lens or compatibility transition may expose proposed, prepared, dual-running, cutover, cleanup, complete and rolled-back phases to selectors. It identifies source and target lenses, entry and exit criteria, compatibility strategy, allowed temporary divergence, validation obligations, rollback or compensation, and a residue detector. Completion follows the declared exit criteria rather than elapsed time.

Do not create an overlay or realization merely because the type exists. A transition becomes active only when a supported consumer has an accepted scope and a concrete compatibility need. Preserve its rationale, owner, invalidation conditions and cleanup obligation.

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
value = "requirement:scoped-invalidation"

[[scope.items]]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:reverse-reconciliation"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md"
contentHash = "sha256:v1:aa322881e51538f7a9ec4a3c4a3195d50c495faf14ee598f03eb9288e22f8856"
description = """Historical general lens-transition invariant, not a persisted-data upgrade or an accepted overlay instance. \
  Source range 165-211; Git blob 04fdadb79ebfc5108b500d559e7fd6f5761138f2; content hash is SHA-256 of \
  exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/decisions/8e351edf78b532b4d4fbc05e3f5c3faf0778d6add11491f518a1cc468ce48c03.decision.json"
contentHash = "sha256:v1:f3c4d29686f50318549bb73cbd7c96ae1aabebfa44c756980af1e88d36a204f4"
description = """Accepted lifetime shared operation access, exclusive migration access, retained writer leases without \
  nested acquisition, and limits for nonparticipating legacy code. Source range complete accepted record; \
  Git blob 99353cb632158429efb49b5bb111d2f2e274800c; content hash is SHA-256 of exact blob bytes."""

```
</details>
