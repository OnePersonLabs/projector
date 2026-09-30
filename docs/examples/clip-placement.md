# Worked example: reusable clips and timeline placements

This is a small illustrative music app, not Projector's own canonical model. Its complete initial proposal is [clip-placement-initial.json](clip-placement-initial.json). The proposal uses the same strict schema as Projector's lifecycle, but lives in `docs/examples/` so reading this guide does not activate or alter a project.

## The request and the plan

The user wants one musical clip to appear more than once on a timeline. Each placement can change pitch without copying or editing the clip. The arrangement must preserve that structure after save and reload.

In Codex Plan mode, the conversation can look like this:

```text
You: Use $projector. Plan reusable clips that can appear several times on a
     timeline. Give each placement its own transpose value and preserve the
     shared clip when the arrangement is saved and reloaded.

Codex: I propose concept:clip for shared notes and timing, and
       concept:placement for the clip reference, position, and transpose.
       requirement:placement-transposition owns the playback and persistence
       obligations. scenario:two-placements-save-reload checks one C4 clip
       through two placements. I would add a Placement -> Clip dependency and
       link the requirement to its scenario. The app needs a placement-to-clip
       reference, a placement transpose field, playback calculation, and a
       save/reload path that preserves those identities.

You: Make it clear that playing one placement never edits the shared C4 note.

Codex: Revised scenario: 0 semitones plays C4; +2 plays D4 before and after
       reload. Playing or saving either placement must not rewrite C4 or the
       other placement's transpose. Here are the full proposed records...
```

The proposed canonical paths are `.projector/model/concepts/clip.md`, `.projector/model/concepts/placement.md`, `.projector/model/requirements/transpose-each-placement-independently--placement-transposition.md`, `.projector/model/scenarios/play-and-reload-two-placements-of-one-clip--two-placements-save-reload.md`, and three TOML relation files under `.projector/model/relations/`. Those are paths produced in the disposable example fixture; stable IDs inside the records, rather than filenames, identify the meaning.

For example, the concept excerpts are:

```markdown
# Clip

A clip owns reusable notes and timing. Editing a clip changes the musical content
shared by its placements; it does not give the clip a timeline position or a
placement-specific transpose value.

# Placement

A placement references a clip and owns its timeline position and transpose value.
Several placements can reference the same clip while retaining different
positions and transpose values.
```

The [complete proposal](clip-placement-initial.json) supplies their IDs, status, source class, metadata, requirement, scenario steps, and typed relations. It is schema-valid; the readable snippets above are excerpts.

The plan shows readable contents, not only filenames or a generated checklist. For example, the requirement says:

> Each placement MUST store its own transpose value in semitones. Playback MUST apply that value to the referenced clip's notes without changing the clip. Two placements of one clip MAY have different transpose values. Saving and reloading an arrangement MUST preserve both the shared clip reference and each placement's transpose value.

The scenario starts with a C4 note in one clip and two placements with transpose values of 0 and 2. Playing, saving, reloading, and playing again must yield C4 and D4 from the same referenced clip. Neither operation may rewrite the clip's note or the other placement's transpose.

The two relevant typed relationships are `concept:placement` `depends-on` `concept:clip` and `requirement:placement-transposition` `demonstrated-by` `scenario:two-placements-save-reload`. A third relationship connects placement to its requirement. In Plan mode, feedback revises the proposed text and consequences in conversation without writing `.projector/` or editing code.

## Authorized execution

The user then says, “Implement this plan.” `$projector` accepts the exact model through its lifecycle and implements the app under the user's authorization. A completed handoff might report:

```text
Accepted concept:clip, concept:placement, requirement:placement-transposition,
and scenario:two-placements-save-reload, with their three relations.
Implemented placement references, transpose playback, and save/reload handling.
Checked two placements of one C4 clip: C4 and D4 before and after reload;
the clip note and the other placement's transpose stayed unchanged.
Unobserved: import from older arrangement files.
```

That is an illustrative application result, not a test run in this repository. The actual model-only fixture was accepted in a disposable repository, which yielded the canonical paths above. Application code and test commands depend on the target app.

The proposal contains no code patch or independent test claim. After acceptance, Projector writes readable canonical Markdown and TOML in the target repository.

## A later change to the same meaning

Later, the user decides that transpose values must be integer semitones from -24 through 24, inclusive. Values such as 25 or 1.5 must be rejected without changing the placement or clip. Codex retrieves `requirement:placement-transposition` and `scenario:two-placements-save-reload`, then shows revised contents under those same IDs. The full [revision proposal](clip-placement-revision.json) binds the exact semantic and document hashes observed after the initial acceptance.

```text
You: Limit placement transpose to integer semitones from -24 through 24.
     Reject values outside that range, including fractions, without changing
     the placement or clip. Keep the earlier save/reload behavior.

Codex: I will revise requirement:placement-transposition and
       scenario:two-placements-save-reload, preserving their IDs. The new
       scenario tries 25 and 1.5 after the successful save/reload case;
       each request is rejected and +2 remains stored. Input validation and
       persistence tests need to cover that result. Here are the revised records...

You: Implement the revision.

Codex: Projector accepted the revision. I updated input validation and checked
       rejected 25 and 1.5 values plus the original two-placement reload case.
```

The last line illustrates the application work that follows an accepted model revision. The JSON fixture itself contains only model changes. Both revisions retain the same IDs because the boundary is still placement-owned transposition.

## Reuse across tasks

You can request the same later change in one shot, outside Plan mode:

```text
You: $projector Limit transpose to integer semitones from -24 to 24.
     Reject invalid values without changing the placement or clip.
     Implement it and preserve the existing two-placement save/reload behavior.
```

That request authorizes the model revision, implementation and verification together. Codex checks the existing records and current dependencies, accepts the exact revision, changes the app, runs the relevant checks, and reports the result. It asks about a material unresolved product choice when necessary. A completion report for the illustrative app would include:

| Changed artifact | What changed |
| --- | --- |
| `.projector/model/requirements/transpose-each-placement-independently--placement-transposition.md` | `requirement:placement-transposition` now requires integer semitones from -24 through 24 and rejects invalid inputs without mutation. Its earlier playback and persistence obligations remain. |
| `.projector/model/scenarios/play-and-reload-two-placements-of-one-clip--two-placements-save-reload.md` | `scenario:two-placements-save-reload` adds attempts to set 25 and 1.5; each is rejected and +2 remains stored. |
| Application input validation and its tests | Reject invalid values before mutating placement state. Test both range boundaries, fractional inputs, shared clip identity and save/reload. |

The report links the actual files in the target repository, names the commands and cases that ran, and reports unavailable evidence. For this illustrated change, the Clip and Placement concepts and their three relations remain unchanged. The [complete model revision](clip-placement-revision.json) shows the exact proposed values.

A follow-up such as “Make the range -48 to 48” revises the same requirement and scenario again. In a fresh session, `$projector` can retrieve those identities and the still-applicable obligations. A bug repair that makes reload preserve placement values can change code without changing the model; the completion report then says that the model was unchanged. `$projector-verify` compares actual code with that model, and `$projector-reconcile` investigates a new consumer or outside edit.

See [Changing accepted meaning](../changing-accepted-meaning.md) for the planning and execution boundary, or [Model and context](../model-and-context.md) for identity and retrieval details.
