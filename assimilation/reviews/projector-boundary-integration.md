# Projector boundary integration review

## Delivered behavior

Projector 2.1.6 adds conversational change routing, bounded local repository observation at session/prompt boundaries, and `$projector-reconcile` for delegated investigation after user acceptance. The assimilation skill now explicitly routes capability changes before implementation and compares scope, time and branch before calling source claims contradictory.

The canonical model transaction succeeded through `semantic_change_93497a708bb835b82de31034f62558f5`, approval `lifecycle_approval_afb1b62aa04b245036846ddcae3d9351`, transaction `transaction_4266bd715bc535b409e9794c677a9a2e`. It adds four requirements and five scenarios. This is acceptance of intended behavior, not runtime proof. The earlier incomplete host-routing proposal remains unapplied historical runtime evidence.

## Verification evidence

- Full deterministic suite: 1,126 passed, 10 existing opt-in/platform tests skipped, one release-format test failed before the required migration was created.
- The existing migration tooling prepared 2.1.6 and sealed the 2.1.5-to-2.1.6 compatibility transition. It updates prepared-format identity without rewriting canonical content. The formerly failing source-severed release test then passed.
- Final affected suite: 40 tests passed across repository-check integration, operation-runner registration, hook routing, installed plugin behavior, and source-severed release packaging.
- Installed hooks were exercised against a real isolated Git repository: session observation, commit between prompts, commit-only prompt routing, retained finding identity, and suppression of duplicate offers. The installed assembly test passed again after the last hook edit.
- Type checks and package boundaries passed. The specification checker exited successfully; its prose advisories do not establish semantic equivalence or truth.
- Final reconciliation of the retained pre-edit context succeeded with `stale` reasoning and `conformant` evaluated governance. Refresh that context before reusing its conclusions. Open retrieval frontiers remain limitations, not absence proofs.

An actual Codex trial loaded the installed skill from an isolated copied plugin, consulted its bundled context operation, kept a late-target capability discussion in planning, and did not investigate an unaccepted repository notice. It made one incorrect runner-path attempt, then used the documented sibling runner successfully. Trial evidence: `C:/Users/zethj/AppData/Local/Temp/projector-boundary-agent-0zJ9jh/trial.events.jsonl`.

Initial Windows sandbox setup prevented file reads; the corrected trial used the existing elevated Windows sandbox setting. An ephemeral delegated trial could not spawn a child because the CLI reported that its parent thread did not exist. The skill reported that limitation and offered a local fallback without performing it. These failed trials are not counted as successful delegation evidence. Hook-trust bypass was restricted to the vetted isolated test invocation; personal installed hook trust and configuration were not changed.

A persisted installed-agent trial successfully spawned an investigator, independently counted README words in the root, retrieved Projector context in the child, and relayed a material design question back through the root without repairing files or accepting meaning. It also exposed premature acknowledgement after an interim report: the question was unanswered, but the root cleared the pending finding. The skill now explicitly prohibits that acknowledgement and requires a finding-specific runtime continuation note. Initial persisted evidence: `C:/Users/zethj/AppData/Local/Temp/projector-boundary-agent-24UqvH/trial.events.jsonl` (child task `01a0948e-ab95-78c2-9748-07f0ce548223`).

Noninteractive CLI trials cannot establish a successful interactive `request_user_input` answer roundtrip. The documented root fallback and actual child-to-root question relay are distinct from that UI capability. Late target recognition was behaviorally exercised; midway agent-originated capability recognition and arbitrary concurrent semantic edits are instruction/scenario coverage, not exhaustive installed behavioral proof.

The final forward trial passed the repaired safeguard: delegation and root question relay completed; `state.json` retained the pending finding and the finding-specific investigation Markdown retained its unresolved choice. README and settings were not repaired. Evidence: `C:/Users/zethj/AppData/Local/Temp/projector-boundary-agent-7PuSju/trial.events.jsonl` and `.projector/runtime/repository-check/investigations/repository_finding_f2198029869e412ca7fc4285dc0156c6.md` in that fixture. The final source-installed hook/assembly rerun passed all eight tests after this instruction change.

## Skill review

Applied `$skill-creator` to keep entrypoints focused and references conditional. `$skill-review` checked the live operation schemas, official hook documentation, reference paths, invocation metadata, and consistency across the root and investigation instructions. Its advertised auxiliary review scripts/template were unavailable; equivalent manual checks were used. Quick validation reports only the known unsupported `disable-model-invocation` key; all affected skills explicitly pair `false` with `allow_implicit_invocation: true`.

Independent `$skill-judge` assessment of `$projector-reconcile`: **110/120 (A)**, navigation/process pattern, approximately 80:15:5 expert/activation/redundant content. These are reviewer judgments, not behavioral proof.

| Dimension | Score | Evidence and remaining tradeoff |
| --- | ---: | --- |
| Knowledge delta | 18/20 | Distinguishes observation, saved reasoning, investigation and acceptance. |
| Mindset and procedure | 14/15 | Concrete comparison routes without prescribing design conclusions. |
| Anti-patterns | 15/15 | No inferred historical intent, speculative acceptance, duplicate investigator or stale acknowledgement. |
| Discovery | 14/15 | Explicit request/accepted-offer trigger; notices alone do not authorize analysis. |
| Progressive disclosure | 14/15 | Investigation reference loads only after authorization or assignment. |
| Freedom calibration | 13/15 | Exact evidence acknowledgement with flexible semantic investigation. |
| Pattern | 9/10 | Compact root routing plus delegated procedure. |
| Usability | 13/15 | Root question relay and overlap coordination; behavior still depends on host delegation support. |

Review findings repaired: hook tests now assert exact mode/session routing; explicit reconciliation with no pending finding has a defined route; unavailable question tools have a plain-text root fallback. Unsupported dirty symlinks/submodules now have a test proving `incomplete` preserves pending state. The prior assimilation score of 107/120 remains historical; its targeted changes and checks are recorded in the neighboring assimilation review.

Calibration of the supplied `$skill-judge` against its own rubric: approximately 81/120. It offers useful evaluation criteria, but repeats them across a long unlayered document and treats some stylistic preferences as universal prohibitions. Accordingly, this review prioritizes observable routing, API correctness and user constraints over adding content merely to improve a rubric score.

## Operational limits and handoff

The check is local only. Commit-only prompt checks do not detect same-HEAD dirty edits; full session checks or explicit full checks do. Hashes do not recover previous uncommitted bytes. Path omission counts are lower bounds after coalescing; offer deduplication retains the last 128 sessions. Dirty symlinks/submodules, corrupt cache, concurrent locks and exceeded bounds are explicitly incomplete rather than clean. Interrupted locks require verifying their owner stopped before targeted recovery.

Assimilation intake remains durable and unignored, and its topic notes remain independent of Projector concept records. Changes are in source and tested installed copies; the personal installed plugin has not been refreshed by this implementation. No commit, remote fetch or publication was performed by this delivery.
