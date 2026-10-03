---
id: read-time-transform
kind: pattern
title: Apply per-use transforms at the read boundary
status: candidate
concepts: [clip]
examples:
  - js/playback.mjs#playback
  - js/playback.mjs#handwrittenPlayback
  - rust/playback.rs#playback
counterexamples:
  - js/playback.mjs#commitTranspose intentionally edits shared notes.
  - python/persistence.py#commit_transpose persists an explicit edit.
alternatives:
  - Copy the Clip into a separately owned editable draft before an editing workflow.
  - Cache a projected view with a source fingerprint and per-use transpose in its key.
lens: clip-playback
---

Compute transient notes at the use boundary when multiple uses share an authoritative Clip. The copied notes belong to that use. This approach can keep playback and export independent of saved state without a common generator.

Do not apply this candidate to committed editing. A command that changes the source needs different ownership and persistence evidence. A cache is an alternative when projection cost justifies invalidation work.

This is a Pattern Candidate. The observed examples do not make it a universal rule. Reopen it if consumers need stable mutable note identity, projection becomes expensive, or ownership changes. Promotion requires an explicit accepted-meaning edit.
