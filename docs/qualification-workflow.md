# Projector workflow qualification

## Impact-aware verification protocol, 2026-09-27

This protocol was fixed before the participant runs. It qualifies the shared verification instructions through observed exercises, separately from the automated evidence-lifecycle tests. The source baseline is `77a6e50455e0c81a2636cfa0b7e516c4a5775439` on Windows with Node 24.19.0. Earlier qualification below remains historical evidence.

### Inputs and observations

Use one disposable JavaScript ESM Git repository per case. The common fixture contains a label formatter, a display consumer, formatting configuration, an unrelated module, and Node tests. The contract trims nonblank strings, preserves case, and rejects blank input. Case-specific requirements override only the named behavior. Reuse the repository's fixture file-writing helper. Do not reuse the clean-evolution participant brief, which imposes unrelated implementation and execution requirements.

Give each fresh participant only its requirement brief, fixture location, and the revised canonical verification skill. Keep this acceptance rubric and the independent probes outside participant context. Fixture reads and commands use a disposable observation helper that records timestamps, requested operations, source/test hashes, exit status, and output. Edits use normal file tools; snapshots and the final diff expose their effects. Retain the inventory before assertion reads, the test-change decisions, selected checks, actual commands, named test events or body diagnostics, and the complete baseline difference. These traces establish observed cooperating behavior, not universal agent compliance. Self-reported completion and file-level test passes alone do not establish protection.

| Case | Participant request and fixture seed | Required observation |
| --- | --- | --- |
| Bug | Correct trimming; the formatter returns surrounding whitespace and existing tests omit that input. | The independently derived whitespace expectation fails before production changes, then passes with focused nearby regression checks. |
| Refactor | Extract a private helper while preserving trimming, case, and blank rejection. Existing tests already cover those obligations. | Keep adequate assertions unchanged, state the no-red exception, and verify at the coherent checkpoint without manufacturing failures. |
| New impact | Change labels to uppercase. Pin the baseline before a task-related commit, staged consumer change, and untracked test. Reveal another consumer after the initial inventory. | Reconcile the new consumer and select its checks from the complete task difference, not only the final edit or current HEAD. |
| Shared configuration | Change the display suffix from `!` to `?`; producer and consumer both read the shared configuration. | Identify the configuration as an input, run both affected checks, and do not reuse old results for the changed input. Runtime tests separately check persisted evidence invalidation. |
| Replacement | Replace an implementation-text assertion while preserving valid-label and blank-rejection protection. | Demonstrate the behavioral replacement before removing the brittle assertion. Do not call shared code coverage proof of redundancy. |
| Empty selection | Assess an earlier diagnostic with a name filter that matches no declared test; runtime dependency selection is unavailable. | Recognize the passing file wrapper as insufficient evidence, widen selection, and confirm that expected declared tests actually execute. |

The evaluator checks behavior with independently specified valid, whitespace, mixed-case, and blank examples as applicable. It reviews read/run ordering against the skill, including the four verification checkpoints. No run after an individual edit is required. Additional diagnostics need a concrete recorded reason. A necessary full gate is not an unnecessary run.

Run each case once initially. Repeat only an affected case after a concrete failure or corrected fixture/prompt; retain the earlier result and correction reason. Also rehearse planning without a prepared checkout and branch integration without a change identity. Planning must preserve required artifact validation. Integration must retain its pinned target comparison, actual check results, independent review, and existing publication owner without inventing prepared-change operations.

### Evidence-lifecycle acceptance

Extend the existing readiness integration tests. Baseline/red records must not authorize completion or replay as final assurance. Failed or stale superseders must not hide otherwise eligible evidence; insufficient scope must be rejected. A failing rerun must prevent reuse of its earlier pass. A current passing covering superseder must retain history. Changes to declared source, test, transitive, and configuration inputs must invalidate affected checks; unrelated files may preserve scoped check eligibility without preserving overall plan/review validity. Reuse the existing checkbox-freshness check. New protection for already-correct behavior can pass immediately.

### Results

Six accepted participant runs used skill SHA-256 `f3d52b6e6272355861bbecb972c55765e84155ab714a8d0f6199fb0c185355a0`. Each recorded its obligation inventory before reading test assertions. Independent probes checked valid input, trimming, mixed case, blank rejection, decoration, display, and the newly revealed consumer where applicable. All six passed those probes. No participant ran tests automatically after each file edit.

| Case | Observed execution and outcome | Retained trace |
| --- | --- | --- |
| Bug | Baseline passed; whitespace assertions failed while the production-source hash still matched baseline; the corrected final suite passed 9 tests. | [Bug correction](evidence/test-workflow/bug-corrected.json) |
| Refactor | Baseline and final runs passed 10 tests. All test files remained byte-identical; only the private-helper implementation changed. | [Pure refactor](evidence/test-workflow/refactor-corrected.json) |
| New impact | The first run exposed earlier unfinished expectations. The revealed menu consumer and earlier committed, staged, and new work entered the final inventory. A suffix-preservation assertion failed before its correction; the final 9 tests included the menu and earlier task checks. | [New consumer](evidence/test-workflow/impact.json) |
| Shared configuration | Baseline passed; both suffix expectations failed for the requested change; the final 8 tests exercised the changed producer and consumer inputs. | [Configuration](evidence/test-workflow/config.json) |
| Replacement | New behavioral assertions passed while the old source-text test still existed. The old test was then removed; the final suite passed 12 tests. Production source was unchanged. | [Coverage replacement](evidence/test-workflow/replacement.json) |
| Empty selection | The unmatched filter exited successfully without declared body diagnostics. The participant rejected that result as insufficient, ran all 6 declared tests, and checked additional boundary examples without modifying source or tests. | [Empty selection](evidence/test-workflow/empty.json) |

The initial [bug](evidence/test-workflow/bug.json) and [refactor](evidence/test-workflow/refactor.json) runs used an earlier skill snapshot. Both stopped because that snapshot incorrectly required independent final review for ordinary work without a repository gate. The refactor also added boundary tests, so it did not demonstrate reuse of adequate unchanged protection. The skill was corrected to preserve context-specific review gates, and the refactor seed gained explicit public-boundary protection. Only these two affected cases were repeated, from fresh fixtures. Their original records remain available; no waiver or retrospective test-first claim was used.

These are bounded observed exercises with cooperating participants. They do not prove universal instruction compliance or optimal test selection. The retained JSON records contain the requirement brief, baseline and final fixture files, timestamped observation events, actual host command/file-change events, and participant result. Local path prefixes are normalized for portability. An unavailable runtime dependency selector remained an explicit limitation rather than evidence of no impact.

[Independent probes](evidence/test-workflow/independent-probes.json) retain the independently specified assertion programs and their actual results. Inspection of host command events found no fixture reads or commands outside the observation helper in the six accepted runs.

The [context rehearsals](evidence/test-workflow/contexts.json) exercised planning and branch integration separately. Planning ran the installed strict OpenSpec validator without a prepared checkout. It first exposed a fixture omission of a surviving scenario. The fixture owner restored that scenario, and the same participant resumed: both artifacts then passed strict validation. The failed result remains retained. Implementation checks and human artifact review remained explicitly pending.

Integration used an actual divergent source and target with a detached two-parent merge. The participant inspected the complete pinned target-to-integration difference and ran seven declared tests plus direct boundary checks. That diff exposed existing assertions before its inventory. This historical-work rehearsal does not establish independent-before-assertions derivation. It left mandatory independent review pending and invoked no prepared-change API. A separate observer checked the actual code, diff, and results, while disclosing fixture authorship. Independent reviewer `/root/plan_review` then inspected the actual integration without having authored it, found no implementation defect, and corrected the observer's mistaken ordering claim. The earlier report and actual events remain retained. The target branch stayed pinned; publication was not part of this rehearsal. Direct empty/tab/newline checks establish current behavior, not permanent regression coverage for every input class.

The automated evidence tests add protection for already-correct runtime behavior, so no production red was manufactured. Initial test-authoring failures confused plan validation with completion readiness and pinned one fixture before its declared inputs existed. Those setup mistakes were corrected; their [initial](evidence/test-workflow/checks/readiness-initial.log) and [intermediate](evidence/test-workflow/checks/readiness-corrected.log) failures remain available. The corrected [input-freshness run](evidence/test-workflow/checks/readiness-inputs.log) passed. Independent review also required the successful superseder to retain its original event-retention assertion; the [affected check](evidence/test-workflow/checks/supersession-review-fix.log) passed after that correction. These failures are not presented as intended-red evidence for a product defect.

The [full repository check](evidence/test-workflow/checks/repository-check.log) passed TypeScript build, ESLint, and all 119 tests on Windows with Node 24.19.0. Its test phase took 765.71 seconds. The review correction added one assertion after that test file had loaded; the exact affected test then passed separately, and changed-test lint passed. This combined evidence covers the final test source without repeating unrelated checks. The installed two-client test compared the packaged verification skill byte for byte with the canonical source. No production installation was changed.

[Strict OpenSpec validation](evidence/test-workflow/checks/openspec.json) passed both active changes and all four live capabilities. It retained an existing informational message that the older workflow change adds a requirement already present in live authority. No archive was attempted or authorized by that validation result. Whitespace, local-link, and new-file handoff-isolation checks also passed. Mechanical writing-lint findings in unchanged historical sections were retained; the new section's possessive was not a contraction.

Independent reviewer `/root/plan_review` accepted the final scoped implementation and rehearsal integration with no unresolved findings after the assertion and reporting corrections. The final remediation review reused matching check evidence.

## Readiness repair qualification

The portable readiness workload extends the existing clean-evolution evaluator. It does not add a production classifier or a second authority model. Run `node --test test/readiness-evaluation.test.ts` to exercise the authored control and six negative controls.

The control executes producer and consumer behavior: an unwired model runtime reports unavailable; load, inference, warm-up and unload identify missing wiring; the consumer dispatches the first note while model readiness is pending; and dispatch-only observations cannot qualify native audio output. The provider rehearsal resolves a registered Tauri command through a frontend wrapper calling an imported API alias, imported React Native styles and array composition. Removing command registration and advertising unavailable runtime wiring as available both fail their relevant checks. Assets remain fixture-owned inputs; the fixture bank is not executable audio data.

The six negative controls reuse existing observable checks for an undeclared consumer, a nonexistent requirement cited as justification, an external dependency in an explicitly dependency-free workload, incomplete migration, surviving withdrawn structure, and a dispatch-only observation advertised as native audio evidence. These checks identify concrete inconsistencies. They do not establish that prose citing a valid requirement is a sound rationale, that every abstraction is necessary, or that arbitrary obsolete code is discoverable. Those judgments require an independent reviewer reading the requirements and actual implementation.

The authored controls passed on Windows with Node 24.19.0. The separate installed and hosted results below establish the additional workflow evidence. Production gates enforce current contributions, required artifact dispositions, recorded check freshness and review attribution. They cannot establish semantic correctness merely from a review string or a successful process exit.

### Repository and installed checks, 2026-09-26

The final Windows `npm run check` passed TypeScript build, ESLint and all 116 tests. Ubuntu used the official Node 24.19.0 distribution with a verified checksum. Its build and lint passed; 115 tests passed in the full run, and the remaining hook-recovery test passed after correcting its fixture to make the hook executable and select its own hook directory. The user's global hook configuration remained unchanged. The original failures remain recorded.

Both platforms passed the installed two-client MCP tests and the complete prepare, revision, synchronization, evidence, archive, integrated publication and repeated-finish lifecycle. A real check exceeding thirty seconds completed through the installed transport with one recorded result. Linux qualification exposed and corrected the installer's npm path lookup for the official Linux Node layout.

Nine real Git publication tests cover disjoint staged and unstaged edits, shared-file authority edits, prior managed synchronization, ref advancement and interrupted installation, index locking, and recovery after Git pruning. Additional lifecycle tests cover refreshed target commits, selected-tree realization validation, legacy finalized sessions, prerequisites in a fresh clone, and renewal of verification and review after hook mutations. Unresolved hook authority edits remain explicit until incorporated or discarded with a recorded reason.

Strict OpenSpec validation passed for all four live capabilities and both active changes. Projecting the readiness change from the accepted baseline reproduced all nine changed specification and design artifacts. The projection contains 25 changed requirements. The task template remains a change-specific checklist; reusable execution and verification policy lives in the workflow skills.

### Actual Psychord inventory

The read-only rebuilt specification inventory contained 118 capability specifications. The provider extracted 633 units with no diagnostics in approximately 185 milliseconds. This is extraction evidence; strict OpenSpec validation remains a separate check.

The first complete working-code inventory exposed a real cache-capacity/error-reporting failure after approximately 12.8 seconds. The SQLite transaction had already rolled back before the cleanup attempted another rollback, masking the initiating error. The repair removes unused duplicate unit/reference persistence, evicts extraction records by serialized bytes before insertion, retains a 48 MiB payload allowance inside the existing 64 MiB database cap, and preserves the initiating SQLite error when a transaction has already rolled back. Missing cache entries are extracted normally; eviction does not reduce the returned inventory.

The affected read-only inventory then passed: 2,853 files, 22,490,105 raw bytes, approximately 5.53 seconds and a 51,458,048-byte disposable cache. It contained 1,388 Markdown files, 883 TypeScript-family files, 61 Python files, six Rust files, six HTML files, three CSS files, 68 configuration files and 438 opaque files. Its 688 diagnostics remain explicit, including dynamic/native framework relationships and unresolved imports. A passing inventory does not make those relationships complete. Observed process RSS was approximately 474 MB, including worker/WASM runtime allocation; Node worker heap limits are not a WASM memory cap.

After the packaged declaration-query update, a fresh-cache repetition also passed: the same 2,853 files and 688 diagnostics, approximately 7.54 seconds, a 53,108,736-byte cache and approximately 560 MB observed process RSS. The failed result and both repaired results are retained in the operating-system temporary directory as `projector-readiness-inventory.json`. Published fixtures contain no machine-specific source paths. These timings describe local working inventories, not a portable performance guarantee.

### Final installed Psychord inventory

The final installed provider/index/kernel files matched all 48 corresponding built files by SHA-256. Provider fingerprint `6158d8c80182852d3802eb3f22d23487cba897e81c96512469745236e0506b88` indexed the same 2,853 files and 22,490,105 raw bytes in approximately 10.90 seconds. The cache occupied 53,112,832 bytes and observed process RSS was approximately 555 MB. The 665 remaining diagnostics describe scoped uncertainty rather than an incomplete file inventory. The 118 rebuilt specifications again yielded 633 units with no diagnostics.

The actual desktop adapter produced five command links within its owning application and five explicit uncertainties for injected overrides. Module qualifiers no longer appear as command registrations. Two 1,658,912-byte FMOD banks retained raw-byte hashes without text decoding. An installed imported-style probe resolved aliased React Native styles in array composition. An unrelated object's `invoke` method produced no false Tauri relationship.

### Hosted implementation and correction

An actual participant, `/root/implement_workflow`, used the installed runtime in a disposable checkout. It received the participant brief, copied rebuilt model/audio requirements and prior Psychord adapter code, without access to the evaluator's authored control or oracle. It implemented playback, a late recorder, current ownership reconciliation and the unwired model boundary through the real prepare, revise, plan, apply and evidence operations.

The participant's initial tests passed, but the independent oracle found nested event-data aliasing. Independent reviewer `/root/implement_index` also reproduced replay order `[1,3,2]` when a callback published a new event during historical replay. The participant first recorded two failing regressions, then corrected ownership with deep snapshots and per-subscriber queues. The reviewer independently confirmed historical order `[1,2,3]`, cross-subscriber order and nested-data isolation. Five participant tests, the platform probe, reconciliation and evidence-note checks passed. The failed receipt remained in history.

Review also required a specific model-runtime owner instead of attributing model wiring to the playback decision. The trial adopted the rebuilt model specification byte for byte and added a bounded design tied to its availability and immediate-dispatch requirements. The four requirements for real artifacts, backends and sessions remain intact in the canonical text; they are explicitly outside this unwired rehearsal. This does not qualify a real target adapter.

After independent review of the corrected code and revised authority, finish integrated code and accepted authority in trial commit `8b293b58df80c94a8e0f9377bf8b8f617d50d8b6`. Repeated finish reused that commit. The published result also passed the independent oracle. Its history contains 18 executed evidence records, including the failed regression run. The real producer/consumer probe reports unavailable models, four explicit missing-wiring failures, immediate dispatch while readiness is pending, and `qualified: false` for dispatch-only audio observations.

These results qualify the Projector workflow and the stated rehearsal. Native model round trips, physical audio playback/capture and MIDI remain separate Psychord adapter obligations. Static relationships and dispatch checks cannot establish those outcomes.

Detailed logs are retained in the operating-system temporary directory: `projector-final-check.log`, `projector-linux-qa-71PJi2/commands.txt`, `projector-readiness-target.json`, `projector-installed-inventory-final.json`, `projector-installed-relations-final.json`, `projector-hosted-semantic-review.md`, `projector-hosted-semantic-recheck.log`, `projector-hosted-oracle-published.log` and `projector-hosted-finish.json`. The earlier failed results are preserved alongside the successful checks.

## Projector 4.2.0 reviewed integration

Qualification performed on 2026-09-24 using Windows, Node 24.19.0, Git 2.55.0 and the bundled OpenSpec 1.13.1.

### Executed checks

The reviewed candidate passed TypeScript build, ESLint and all 66 repository tests. The final integration passed TypeScript build, ESLint and all 67 tests after adding the archived-prerequisite regression check. The installed-client acceptance test verified version 4.2.0 and all 12 packaged workflow skills, including `$projector:merge`. The merge skill also passed the skill-package validator and Simplified Technical English lint.

Forward exercises in disposable repositories covered a clean divergent merge, an already-integrated no-op, staged, unstaged and untracked dirty targets, an ambiguous conflict, target movement before publication and deliberate whole-merge rejection. The target stayed unchanged in every blocked or rejected case. The clean merge produced the expected two-parent commit and fast-forward publication. Ambiguous work remained in its locked linked worktree with a complete decision brief. Target movement preserved both the moved target and the reviewed integration. Deliberate rejection removed only the identified temporary worktree and branch. Every disposable repository was removed after its assertions passed.

### Review and limitations

Independent adversarial reviewer `/root/merge_adversarial_review` examined the proposal, requirement, design, tasks, full candidate diff, merge and recovery instructions, finish routing, documentation, version surfaces and installed-skill test. The review compared the isolated locked-worktree workflow with an in-place merge or autostash. It found the isolated workflow safer because conflicts, checks and review finish before the target changes.

Review findings led to prepublication final checks, ignored-file protection on publication, staged whitespace validation, post-check candidate cleanliness validation, immediate target revalidation and exact cleanup for a deliberately rejected merge. A focused integration review also found that prerequisite validation could not discover a published record after archival. The runtime lookup, live requirement, design and regression coverage were updated. The reviewer accepted the final integration with no remaining blocker, high or medium findings.

Git porcelain does not combine working-tree validation and ref advancement in one compare-and-swap operation. The workflow narrows that race by checking the exact branch, target commit, worktree, index and operation state immediately before a fast-forward-only publication. A concurrent ref can succeed only when it already points to an ancestor of the reviewed integration; it cannot introduce an unreviewed tree through that race.

## Projector 4.1.2 lifecycle

Qualification performed on 2026-09-23 using Windows, Node 24.19.0 and the bundled OpenSpec 1.13.1.

### Executed checks

The implementation passed build, ESLint and the full acceptance suite. Checks cover installed MCP initialization, schema setup and idempotence, configuration preservation, synchronization/revision/finish, interrupted recovery, stale evidence, candidate-only publication and settled repeated finish.

An independent native reviewer reproduced and verified fixes for interrupted synchronization after source edits, synchronized target retention through Git pruning, and adopted config.yml preservation through finish. Negative deletion probes confirmed that retained and nonexistent files cannot use the removed-baseline-file disposition.

The mixed-edit import exercise included staged addition/deletion, a file with both staged and unstaged edits, and an untracked binary. Selected bytes matched the candidate, unrelated work remained excluded, and source file content, status, diffs and index bytes remained unchanged. Candidate behavior assertions passed. This exercise validates import mechanics; it is separate from the installed lifecycle tests.

### Installed host discovery

Codex's supported installer refreshes `projector@projector-v4-local` into the user cache at version 4.1.2. A fresh actual Codex app-server verifies eleven workflow skills, named `projector:init`, `projector:propose`, and their peers, plus seventeen tools including initProject and syncChange. Discovery uses the registered installed package, without a replacement MCP configuration. Qualification applies process-local exclusions for unrelated integrations; persistent configuration remains unchanged by discovery.

The installed-client tests execute initProject through the packaged MCP relay, verify all skill directories, and exercise sync followed by revision and finish. Registration, skill discovery, MCP handshake and actual tool execution are distinct checks.

### Review and limitations

A separate agent exercised the installed 4.1 runtime from the natural-language request to add a greeting function with trimmed names and blank-name rejection. It authored the proposal, requirements, design and tasks; initialized twice; validated the artifacts with bundled OpenSpec; implemented through managed batches; and ran two tests covering eight inputs. A separate native reviewer examined the actual candidate and found no blockers. Finish archived and published the candidate, repeated finish reused the same publication, and the source branch remained unchanged. This was an executed agent workflow, not a simulated review fixture. The naming patch shortens public skill names to the host's canonical namespace. Version 4.1.2 also preserves repository-owned schema edits through revision; initialization verifies the new-design template can be applied.

Independent review attribution: native reviewer `/root/review`. Review covered initialization, lifecycle changes, configuration adoption, deletion gates, the complete skill suite, and user documentation. It compared shared lifecycle operations with separate workflow state machines and mutable versus retained synchronization targets.

The production runtime makes no model calls. Automated fixture review strings test the attestation protocol; they are not represented as independent semantic review. The independent review above is separate actual agent work.

The supported runtime remains local Git repositories, JavaScript/TypeScript and Markdown. OpenSpec stores are explicitly unsupported. Bulk finish cannot silently repin a prepared dependent candidate or merge conflicting branches. Completed candidates still require separately authorized integration.
