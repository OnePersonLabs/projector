# Founding brief -- anonymous motif evidence

Build a fresh, local browser slice for Psychord. Do not copy an existing Psychord implementation, source tree, or tests. This brief is the whole product input for the founding checkpoint.

## Outcome

An anonymous player can use a small on-screen keyboard or the physical keys `A S D F G H J K` to play `C4 D4 E4 F4 G4 A4 B4 C5`. A voluntary musical offer lets the player preview `C4-D4-E4` through a real minimal browser Web Audio path after a gesture. The offer is optional and dismissible; it does not gate Free Play.

The app recognizes exactly one narrow pattern: a completed, strictly ascending `C4, D4, E4` player sequence with no extra player note between those three notes. A successful recognition produces stable recognition evidence and one linked evidence-count update. The update means only that this retained evidence exists. It says nothing about skill, learning, mastery, quality, preference, or a player identity.

## Public scenario facade

Expose a deterministic test-facing facade. Internal architecture and names are free, but the facade must support equivalent operations and observable state:

```text
submitPlayerInput({ inputId, pitch, atMs, source })
startRecognition({ attemptId })
completeRecognition({ attemptId })
interruptRecognition({ attemptId })
restart()
requestOptionalPreview({ offerId })
dismissOptionalPreview({ offerId })
replayRecognition({ evidenceId })
snapshot()
```

`source` is anonymous `keyboard` or `pointer`. No account, profile, or identity is collected.

The observable snapshot must expose:

- recognition evidence with a stable `evidenceId`, `attemptId`, ordered source `inputIds`, recognized motif, and explicit `origin`;
- a linked `skillEvidenceUpdate` with its own stable ID and the evidence ID it counts;
- attempt status sufficient to distinguish incomplete, recognized-but-not-applied, and applied;
- optional-offer/replay status; and
- a durable state that a new facade instance can restore.

## Behavior contract

1. **Free Play and agency.** Free Play is voluntary and remains available during an offer, recognition, persistence, restart, and replay. Do not add account, questionnaire, score, drill, punishment, server, or onboarding gate.
2. **Player provenance.** Player inputs retain stable identity, pitch, sequence order, anonymous source, and host-clock arrival timestamp. Arrival timestamps do not claim acoustic onset or latency.
3. **Recognition.** `completeRecognition` produces evidence only for the exact completed C4-D4-E4 player pattern. Nonmatching/incomplete input produces no evidence and no update. The facade accepts an injected clock/storage seam so these cases have deterministic headless tests.
4. **One narrow update.** A recognized evidence item is linked to exactly one update that increments the retained `ascendingCdeRecognitionEvidenceCount`. It is a count of evidence records, not a score or learning inference.
5. **Explicit interruption rule.** An attempt interrupted before recognition is incomplete and yields no evidence/update. If recognition evidence is durably recorded but interruption happens before its linked update is durably recorded, `restart()` recovery completes that same update exactly once. Repeating completion, recovery, or replay must never duplicate it.
6. **Persistence and honest failure.** Persist evidence and its update locally. Restart restores their relation and statuses. A storage failure visibly fails without falsely reporting success or destroying in-memory state.
7. **Offer and replay are not player input.** Requesting, hearing, or dismissing the optional offer creates no player input, recognition evidence, or update. Replay is visibly replay, may use the minimal preview, creates no player input/evidence/update, and leaves saved originals unchanged. Overlapping replay requests must not create duplicate evidence/update; a new replay may supersede the old presentation.
8. **Honest preview.** Web Audio runs only after a player gesture. If unavailable or blocked, say so honestly. Browser automation can establish control/audio-path activation; it cannot establish audible quality, device compatibility, or latency.

## Required evidence

- Runnable browser page with free keyboard/pointer input, optional preview/dismiss, recognition status, evidence-count status, restart affordance, and replay control.
- Headless tests covering the facade contract, exact C-D-E recognition, nonmatch, early interruption, recognized-but-unapplied recovery, duplicate/replay/overlap protection, persistence failure, and restart equivalence.
- Build/type check.
- Browser preview exercise that records observed controls/audio-path activation and explicit unproved limits.

## Explicit unknowns

Do not invent behavior for MIDI, sustain, physical devices, expression, audio recognition beyond this exact C-D-E rule, learning or mastery, export, sharing, cross-device synchronization, or acoustic/latency fidelity. State an unknown when it changes a requested decision or implementation path.

Before source edits, create `REHEARSAL_CONTEXT.md`. In ordinary language it must state relevant constraints, producer/consumer/persistence relations, verification, and unknowns. It is an evaluation probe, not product behavior.
