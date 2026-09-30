# Worked example: use a clip more than once

This illustrative music app reuses one clip in an arrangement. The initial proposal is [clip-use-initial.json](clip-use-initial.json); the later requirement and scenario revision is [clip-use-revision.json](clip-use-revision.json). Both files live in `docs/examples/` and do not activate or alter this repository's canonical model.

## The request and plan

The user wants one clip to appear more than once in an arrangement. Each use can transpose the shared notes independently. Saving and reloading must preserve the shared clip and each use's settings.

In Codex Plan mode, the conversation can look like this:

```text
You: Use $projector. Let one clip be used more than once in an arrangement,
     with a separate transpose value for each use. Save and reload must preserve
     the shared clip reference.

Codex: I propose concept:clip at .projector/model/concepts/clip.md:
       "A clip owns reusable notes and timing."
       requirement:independent-transposition-per-use at
       .projector/model/requirements/transpose-each-clip-use-independently--independent-transposition-per-use.md
       says each use stores its own semitone value and save/reload preserves the
       shared clip reference.
       scenario:two-uses-of-one-clip-save-reload at
       .projector/model/scenarios/save-and-reload-two-uses-of-one-clip--two-uses-of-one-clip-save-reload.md
       exercises one C4 clip used twice. I would add Clip -> Requirement and
       Requirement -> Scenario relations under .projector/model/relations/.
       The app needs a clip reference, position, and transpose value for each
       use, plus playback and save/reload behavior that preserves them.

You: Make it clear that playing either use never edits the shared C4 note.

Codex: Revised scenario: transpose 0 plays C4 and +2 plays D4 before and after
       reload. Playing or saving either use must not rewrite the clip's note or
       the other use's transpose. Here are the full proposed records...
```

These are the canonical paths proposed by the disposable example fixture. Stable IDs inside the records identify their meaning; filenames are readable paths. A use of a clip is described by the requirement and scenario. It is not introduced as another concept.

The proposal contains one concept:

```markdown
# Clip

A clip owns reusable notes and timing. An arrangement can use the same clip
more than once, with a separate position and transpose value for each use.
Editing the clip changes the shared musical content; it does not change those
per-use values.
```

The requirement says:

> Each use of a clip in an arrangement MUST store its own transpose value in semitones. Playback MUST apply that value to the referenced clip's notes without changing the clip. The same clip MAY be used more than once with different transpose values. Saving and reloading an arrangement MUST preserve the shared clip reference and each use's transpose value.

The scenario starts with one C4 note and uses its clip twice with transpose values of 0 and 2. Playing, saving, reloading, and playing again must yield C4 and D4 from that same clip. Neither operation may rewrite the note or the other use's transpose.

The two typed relationships connect `concept:clip` to `requirement:independent-transposition-per-use`, then connect that requirement to `scenario:two-uses-of-one-clip-save-reload`. In Plan mode, feedback revises proposed text and consequences in conversation without writing `.projector/` or editing code.

## Authorized execution

The user then says, “Implement this plan.” `$projector` accepts the exact model through its lifecycle and implements the app under the user's authorization. An illustrative handoff might report:

```text
Accepted concept:clip, requirement:independent-transposition-per-use, and
scenario:two-uses-of-one-clip-save-reload, with their two relations.
Implemented per-use clip references, transpose playback, and save/reload handling.
Checked one C4 clip used twice: C4 and D4 before and after reload; the clip note
and the other use's transpose stayed unchanged.
Unobserved: import from older arrangement files.
```

That is an illustrative application result, not a test run in this repository. The model-only fixture was accepted in a disposable repository, which yielded the canonical paths above. Application code and test commands depend on the target app.

## A later change to the same meaning

Later, the user decides that transpose values must be integer semitones from -24 through 24, inclusive. Values such as 25 or 1.5 must be rejected without changing the clip or either use. Codex retrieves `requirement:independent-transposition-per-use` and `scenario:two-uses-of-one-clip-save-reload`, then proposes revised contents under those same IDs. The [revision proposal](clip-use-revision.json) binds the new contents to the initial records' current semantic and document hashes.

```text
You: Limit transpose for each use to integer semitones from -24 through 24.
     Reject values outside that range, including fractions, without changing
     the clip or either use. Keep the earlier save/reload behavior.

Codex: I will revise requirement:independent-transposition-per-use and
       scenario:two-uses-of-one-clip-save-reload, preserving their IDs. The new
       scenario tries 25 and 1.5 after the successful save/reload case; each is
       rejected and +2 remains stored. Here are the revised records...

You: Implement the revision.

Codex: Projector accepted the revision. I updated input validation and checked
       rejected 25 and 1.5 plus the original two-use reload case.
```

The JSON revision contains only model changes. The Clip concept and its relationship to the requirement stay unchanged; the requirement and scenario retain their IDs because the boundary is still independent transposition for each use.

See [Changing accepted meaning](../changing-accepted-meaning.md) for the planning and execution boundary, or [Model and context](../model-and-context.md) for identity and retrieval details.
