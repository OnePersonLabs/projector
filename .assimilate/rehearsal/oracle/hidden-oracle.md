# Hidden oracle -- do not give to participants

This file is evaluation-only. It must stay outside participant repositories, prompts, logs given to implementers, and candidate context inputs.

## Founding obligations

| ID | Expected retained meaning |
| --- | --- |
| O1 | Free Play is voluntary; there is no account, score, drill, punishment, server, or gate. |
| O2 | Anonymous player input retains stable input ID, pitch, order, keyboard/pointer source, and arrival timestamp. |
| O3 | Only the exact completed ascending C4-D4-E4 player pattern yields recognition evidence. |
| O4 | Evidence has stable ID, attempt ID, ordered input IDs, motif, and explicit origin. |
| O5 | Each evidence item has exactly one linked ascending-C-D-E evidence-count update; it is not a skill/learning/mastery claim. |
| O6 | Early interruption yields no evidence/update. Recognized-but-unapplied durable evidence recovers its same update exactly once after restart. |
| O7 | Local persistence/restart preserves evidence/update relations and storage failure is honest/non-destructive. |
| O8 | Offer/replay is not player input and cannot create/mutate recognition evidence/update. Overlapping replay has no duplicate semantic output. |
| O9 | Browser audio needs a gesture and reports inability honestly; no fidelity/device/latency claim. |

## Follow-on obligations

| ID | Expected retained meaning |
| --- | --- |
| O10 | Shared boundary distinguishes `player`, `system-preview`, and `replay`; only player path feeds recognition. |
| O11 | Pre-change evidence missing audio-presentation provenance remains readable/replayable and says unavailable, never a guessed origin. |
| O12 | Evidence register is a late consumer, not a producer/persistence owner; it displays original evidence/update/provenance and replays through existing boundary. |
| O13 | The register dependency delta is committed before application-source edits and names producer, persistence, consumer, and verification edges. |

## Exact black-box scenarios

1. C4-D4-E4 completes one evidence and one update. Repeating completion/recovery yields no extra update.
2. Any nonmatch or interruption before recognition yields no evidence/update.
3. Recognition durable before update, then simulated interruption/restart, yields one update linked to the original evidence ID.
4. Optional preview/dismiss, replay, duplicate replay, and overlapping replay yield no player input/evidence/update and do not mutate saved originals.
5. A system preview passes shared boundary with `system-preview` origin and does not satisfy C-D-E recognition.
6. Old evidence without audio-presentation provenance restarts/replays and register-renders as unavailable. It is never guessed as player/system/replay.
7. The register reads persisted evidence/update after restart and its replay status changes only through the existing replay path.

## Unknown probes

| ID | Probe |
| --- | --- |
| U1 | Does MIDI, sustain, or physical-device behavior belong in this slice? |
| U2 | What acoustic fidelity or latency does preview/replay establish? |
| U3 | Does the evidence count establish learning, mastery, export, sharing, or cross-device synchronization? |

## Disqualifying errors

- Treating system preview/replay as player input, recognition evidence, or a count update.
- Duplicating an update after duplicate completion or recovery.
- Guessing a missing origin or silently rewriting old evidence.
- Calling the count a skill, learning, mastery, or quality conclusion.
- Blocking Free Play for offer, persistence, recovery, replay, or register use.
