# Follow-on 2 -- late evidence consumer

Add an **Evidence register** after the prior retained plan/context and implementation already exist. It is a new consumer of persisted recognition evidence and updates, not a source of either.

## Requested change

The register shows each retained C-D-E recognition evidence item, its linked one-count update, its original player provenance, and whether audio-presentation provenance is known or unavailable. It can request replay of one evidence item through the existing shared boundary and displays `idle`, `replaying`, or `complete` for that request.

The register must not create player input, recognition evidence, or updates; mutate stored originals; infer a missing audio-presentation origin; or turn the evidence count into a learning/mastery claim. It remains correct after restart, after replay, and for evidence produced before the system-preview change.

## Pre-edit dependency requirement

Before application-source edits, create `REHEARSAL_DEPENDENCY_DELTA.md` and commit it with the fresh-context report and the OpenSpec planning artifacts. It must name:

- existing producers of player input, recognition evidence, one-count update, and audio presentation;
- their persistent representation/codec or storage owner;
- existing consumers of player/system/replay presentation; and
- the new Evidence register consumer plus the verification edges it adds.

This commit is a rehearsal measurement only. It makes the dependency change observable before source edits; it is not a proposed permanent Projector ceremony.

## Preservation and checks

Free Play, optional-offer agency, exact C-D-E recognition, early interruption, recovery exactly once, old/new provenance distinction, honest audio limits, and replay-not-player behavior remain true. Add headless tests for register state after restart/replay and unknown provenance. Repeat the browser preview exercise.

Before source edits, replace `REHEARSAL_CONTEXT.md` with the required fresh-context report, then make the pre-edit dependency commit described above.
