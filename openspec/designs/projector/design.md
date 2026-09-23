---
projectorDesign: 1
id: projector
scope: src
---
# Projector's concern map

## Contract

Projector connects accepted requirements, prospective changes, nested explanations and ordinary implementation. It reports what its supported observation profile establishes and returns explicit obligations for semantic judgment. Its deterministic kernel makes no model calls. The host agent supplies interpretation and independent review.

Applies: [[spec:projector/documents#External design ownership]] | {"kind":"path","root":".","prefix":"src/"} | All implementation remains tooling rather than an application runtime requirement.

## Decision: one-package

Choice: Keep documents, index, kernel, change and host as internal modules in one TypeScript package.
Reason: The small runtime needs explicit responsibility boundaries without package orchestration overhead.
Requires: [[spec:projector/documents#External design ownership]]
Consequential: boundary
Alternative: Separate packages for each concern.
Tradeoff: One package simplifies installation while ESLint import restrictions and public entries maintain direction.
Realizes: [[code:eslint.config.js]] [[code:package.json]]
Evidence: npm run check verifies compilation, module direction and observable behavior.

## Subdesigns

[[design:projector/documents]] owns authored addresses and deterministic deltas.
[[design:projector/kernel]] owns exact facts, observed mutations, shared extraction and bounded storage.
[[design:projector/change]] owns prospective targets, evidence obligations and coherent completion.
[[design:projector/host]] owns the authenticated shared endpoint, relays and plugin installation.
