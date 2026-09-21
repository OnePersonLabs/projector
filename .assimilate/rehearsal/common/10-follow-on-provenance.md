# Follow-on 1 -- shared system-preview boundary

The founding slice has anonymous player input, recognition evidence, a voluntary audible offer, local persistence, restart, and replay. Route system preview through an explicit shared input/audio boundary without making system activity look like player performance.

## Requested change

Introduce one shared boundary that accepts both player-originated presentation and non-input audio presentation. The optional C-D-E offer must enter it as `origin: system-preview`; replay must enter it as `origin: replay`; player input remains explicit `origin: player`. The boundary may send sound to Web Audio and visible presentation, but only the player-input path may feed recognition.

Persisted recognition evidence produced before this change has no audio-presentation provenance field. It remains readable, replayable, and retains its original player origin. If a new display needs a missing audio-presentation origin, it reports that fact as unavailable. It must not silently infer `player`, `system-preview`, or `replay`.

## Preservation and checks

- The exact C-D-E rule, stable evidence/update relation, early-interruption rule, recovery-exactly-once rule, local persistence, and honest preview limit remain true.
- Requesting/dismissing the system offer and replaying evidence produce no player input/evidence/update.
- New system-preview traffic is observable through the shared boundary and remains excluded from recognition.
- Old evidence with absent audio-presentation provenance remains explicitly unknown where that field is requested.
- Add/update headless tests and repeat the browser preview exercise.

Before source edits, replace `REHEARSAL_CONTEXT.md` with a fresh-context report that identifies player/system/replay provenance, old/new data behavior, producers, persistence, consumers, and unknowns.
