# Examples

Start with the [worked Clip/Placement example](examples/clip-placement.md). It follows an initial request through Plan mode revision, authorized model acceptance, illustrative implementation checks, and a later change using the same identities. The [initial](examples/clip-placement-initial.json) and [revision](examples/clip-placement-revision.json) proposals contain the complete schema-valid model changes outside this repository's canonical `.projector/` model.

## Fix a bug without changing meaning

A placement's saved transpose is lost after reload. The accepted requirement already says that save/reload must preserve each placement's value and shared clip reference. Ask `$projector` to retrieve `requirement:placement-transposition` and the related scenario. Codex traces serialization and reload, repairs the defect, runs a two-placement check, then checks retained context. The requirement and scenario remain unchanged because the intended behavior did not change.

## Reconcile a new consumer

A pull adds a report that reads placement data directly. Ask `$projector-reconcile` to inspect the actual diff and the current model. The new reader may change an assumption about internal data, but its existence alone is not a violation or a new product promise. Trace what it consumes and how it handles transpose values; report whether the existing obligation covers it, whether a repair is needed, and what remains unknown.

## Verify a consequential diff

A candidate diff changes playback and persistence. Ask `$projector-verify` to compare it with `concept:clip`, `concept:placement`, the transposition requirement, and the save/reload scenario. A concrete counterexample uses one C4 clip in two placements at 0 and +2 semitones. If the implementation copies notes into each placement or changes the clip when one placement plays, report the location, trigger, observed effect, and affected obligation. Run the relevant application tests and state their coverage.

## Recover an interrupted controlled write

An interrupted model acceptance returns an actual approval ID. Inspect it with `projector resume <approval ID>` before any retry. If the journal is recognized and recovery is authorized, `projector recover <approval ID>` repairs that transaction without replaying the proposal. A change still needed after recovery requires a current reviewed plan. Preserve ambiguous evidence for investigation.

## Assimilate a large source pile

A design effort spans branching chats, research, and an existing app. `$projector-assimilate` inventories and synthesizes that material in `.assimilate/` with source coverage and unresolved gaps. When a candidate is mature, `$projector` compares it with accepted meaning and presents concrete proposed records. Assimilation's working notes do not become canonical merely because they are readable.

Continue with [Workflows](workflows.md) or [Review, reconcile, and recover](review-reconcile-recover.md).
