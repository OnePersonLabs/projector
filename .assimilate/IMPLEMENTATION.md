# Projector 3 implementation

The readable artifact and command workflow is implemented. All twelve saved
wording revisions are accepted, with the affected host-execution authority
explicitly reaffirmed. Change: `semantic_change_f7acadf43659aa3411aa5e208a815dc1`.
No content-cleanup proposal remains pending.

The format-only conversion preserved all 202 canonical records. The subsequent
semantic transaction changed 13 owners. Every proposed field was checked against
the stored canonical payload; `.temp/projector-finished-model-check.json` records
that check. The ordinary Markdown index now uses the accepted titles.

The self-hosting failure had concrete implementation causes: a full canonical
scan per write, rebuilding an already selected context, hundreds of Git subprocesses
for deleted paths, and temporary rename analysis accumulating against its memory
budget. Those paths are repaired. Non-code reference files are not parsed as
JavaScript, and archived Psychord modules are preserved as text rather than
treated as executable Projector source. The accepted bulk change used the normal
limits: context took about 11 seconds, capture and preview about 21 seconds each,
approval about 22 seconds, and application about 59 seconds in this working tree.
This is working evidence, not a claim that further performance work has no value.

Consumer guidance no longer contains internal rehearsal or compression terminology.
Node has a minimum supported version, without the arbitrary upper-major cap.
Developer tool selection remains in workspace metadata.

Build, type checking, package boundaries, proposal-schema generation and canonical
schema checks passed. The isolated installed exercise also passed, recorded in
`.temp/projector-release-finished/result.json`.

The full suite recorded 1,103 passing tests, two skipped tests and one Windows
interruption-test race in `.temp/projector-finished-tests.json`. The repaired test
waits for the independent validator's actual pause point before killing its worker;
the journal's validation phase was too early. The crash-and-recovery case passes.
The affected suite's follow-up passed all 34 tests, recorded in
`.temp/projector-finished-recovery-tests.json`. The original failure remains
recorded; there are no unresolved test failures. The new marker reader propagates
read errors other than a not-yet-created file, and its final type check passed.

The final local refresh succeeded through `$refresh-local-plugins` on Windows
and WSL. Projector 3.0.0 is installed and enabled in each native Codex home;
the installer verified trust for the single installed hook in each environment.
Start a fresh Codex session to load the updated plugin. The consolidated check
record is `.temp/projector-finish-validation.json`, which retains the initial
failed run alongside the successful repair and remaining checks.

The restricted Windows workspace-write Git-spawn issue remains a host integration
limit; ordinary full-access installation was exercised. The small reconstruction
is not a verdict on large-project comparative value. No further comparison run
is planned; subsequent development should follow actual use.

Pre-conversion model/runtime evidence remains in `.temp/projector3-before-format`,
with original directories in `.temp/projector3-format-original`. Failed transactions
retain their journals and receipts, including the clean rollback that exposed the
host-execution decision dependency. The earlier progress record is preserved in
`.temp/projector-implementation-before-finish.md`.
