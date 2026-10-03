---
id: clip
kind: concept
title: Shared Clip notes
status: accepted
conditions:
  - id: playback-isolation
    text: Per-use playback transpose returns adjusted notes and leaves the shared Clip notes unchanged.
    evidence: runtime
  - id: persistence-source
    text: Saving after playback writes the shared Clip notes, not the transient playback notes.
    evidence: runtime
relations:
  - type: projected-by
    target: clip-playback
    status: accepted
  - type: has-candidate
    target: read-time-transform
    status: observed
---

A Clip is the saved musical source. A playback use can request a different pitch without editing that source. Two simultaneous uses can therefore play the same Clip at different transpositions.

`shared/clip.json` is the example input. JS export, Rust playback, Python persistence, TSX rendering, and the C# consumer express this boundary with different syntax. Language navigation can help locate these seams, but a name match does not prove their behavior.

An explicit committed edit is different: `commitTranspose` and `commit_transpose` intentionally change saved state. The playback condition does not forbid that edit. Reopen this Concept if playback is later defined as an editing action or the source ownership model changes.
