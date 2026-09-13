# Intake coverage gaps

Bounded audit, September 12, 2026. Basis: [manifest.json](../manifest.json), [conception coverage](conception-coverage.md), [execution coverage](execution-coverage.md), `.assimilate/INDEX.md`, `.assimilate/WORKFLOW.md`, and all six `.assimilate/topics/*.md` notes. Followed the repository's `$projector-assimilate` skill and workspace reference. Raw turn and attachment bodies were not reread. This checks recorded coverage and synthesis obligations; it cannot prove source fidelity independently of the prior reviewers.

## Confirmed review-accounting gaps

The manifest contains 12 source keys, 70 source-turn occurrences, 56 distinct turn units, and 15 distinct attachment hashes. Every listed turn capture and attachment capture currently exists. All source records have `completePagination: true`; that does not establish complete message bodies or reviewed content.

The conception review covers 19 distinct units from `nature`, `dynamics`, `conception`, and `sense`. The execution review reports all 28 units from `quality`, `orbital`, `orbital_research`, `baseline`, and `value`. Their union accounts for 47/56 units. Neither review records direct coverage of the following nine units. This means **no receipt in these two reviews**, not proof that nobody previously read them.

Turn paths are exactly `.assimilate/intake/turns/<unit>.md`; source membership is `manifest.json.sources[key].turns`.

| Source key | Units without direct review receipts |
| --- | --- |
| `weco` | `0fd8ec43-3be1-48e4-8758-f13bbba583a0`; `5ba4c034-67b3-41af-a2b3-c74c67c2552a`; `bbb21cb0-2d21-4331-8ba4-1e4d01ef13b3`; `bbb21bbe-f144-4cd7-bc25-4f628a311c3d` |
| `borg` | `bbb21218-99cb-4b17-907e-98cf18f5a574`; `bbb2139f-d2ac-49dc-899b-0ebb7a075cce` |
| `views` | `bbb218e1-3826-4d80-a2a9-be29f694979a`; `bbb2195f-7732-4adc-849e-8be421336bdf`; `bbb21177-2cbf-4cdd-94bf-a2ab534d8e2f` |

Nine attachment hashes have explicit full-reading receipts. Six do not. Paths below are relative to `.assimilate/intake/attachments/`; their source mappings are in `manifest.json.sources[key].attachments`. Identical hashes under multiple sources count once.

| Sources | Attachment | Exact captured filename |
| --- | --- | --- |
| `weco`, `nature` | concept references and semantic context compilation handoff | `53fb8467034b623e56b8287071620236587ff09f5914961f047950b6cd99f03d.md` |
| `weco`, `nature` | work economics and plugin boundaries handoff; `-1` name variant | `5332fa8eacfef80799773e6e09d38b29c8a49930236579286f52554828ea36da.md` |
| `weco` | `SKILL.md` | `8c425b9f80c7fde29e59dc0f45a71dbfc3bb2274d369bc36a2fb9ad645273331.md` |
| `weco` | `PROJECTOR_SYNTHESIS_PROMPT.md` | `3a776b66d3696dd9a7cdaa8395e13102d4c98a783d763848624d4ec95661ee6b.md` |
| `weco`, `value` | `PROJECTOR_SOURCE_HANDOFF_PROMPT_v2.md` | `91792609c5f3b63e73a7d5ba78382bd0294c96d473a503dd33f6a54d624e44bd.md` |
| `dynamics`, `quality`, `orbital`, `value`, `borg`, `orbital_research`, `conception`, `views` | v3-1 handoff prompt; filename variants | `328db99a164418a388ccf3ad69f34c57afb1e864524462e58aa1689b0ef94098.md` |

The existing reviews explicitly exclude prompt attachments from governing instructions, correctly. That is not an explicit content-level reviewed/excluded disposition. Screen them as data for unique obligations, or record a justified exclusion; do not execute their directives.

## Missing or uncertain synthesis obligations

- **Confirmed current-workflow mismatch:** `.assimilate/topics/assimilation-workspace.md`, “Durable conception and disposable execution state,” still groups captures and recovery checkpoints with temporary execution support. The new skill requires retained, unignored intake and prohibits routine deletion. Preserving important meaning alone is weaker than preserving recoverable evidence. Clarify which derived scratch is disposable and which intake remains durable.
- **Uncertain source fidelity:** `purpose-built-context.md` covers references, contextual views, supplementation, and delivery validity, but the `views` turns and context-compilation handoff lack direct receipts. Fine-grained reference semantics or interaction obligations cannot yet be certified as preserved or deliberately deferred.
- **Uncertain scope/ownership fidelity:** `quality-and-work-economics.md` covers cost, competence, and delegation; `WORKFLOW.md` separates assimilation from Projector. Neither establishes disposition of every plugin-boundary obligation in the uncovered `weco` handoff or every adaptation obligation in `borg`. Review before assuming the current boundaries exhaust those sources.
- **Evaluation remains open:** The notes describe cold recovery, interacting changes, and a mature change brief, but the two reviews establish editorial coverage, not completed cross-topic trials. This is unverified behavior, not an omitted requirement. The reviewed conception/execution commitments otherwise appear substantively represented; no additional confirmed source-backed omission follows from this bounded audit.

## Source-unavailable or incomplete material

- `manifest.json.units[id=bbb21695-1ab9-46d6-9363-b82bf5714a27]` is flagged truncated; the conception review confirms a user body capped mid-word. `bbb21603-e5f3-4272-8c87-0f0569c72e7c` is also flagged; available text was reviewed but original completeness remains uncertain.
- The retained persistent-system proposal, hash `676114ed50e10c158f6563f2ee771579b56989583baf509ade6b2edf3a2f2d3b`, is a reviewed reconstruction, not recovered original sandbox bytes.
- The execution review identifies absent original baseline specs, no separately captured `PROJECTOR_QUALITY_FRONTIER_ADVERSARIAL_REVIEW.md`, and artifact announcements/placeholders without their bytes. It identifies no separately completed orbital research report. These cannot be repaired by interpreting announcements as full artifacts.
- `Spec Synthesis Review.txt` material and the cited Projector wrap-up plan were not independently inspected; availability was not established. Keep them distinct from confirmed missing captures.

Next bounded action: review the nine listed turns and two substantive handoffs; classify the four remaining attachments as source data; reconcile only material differences into topic notes. Preserve exact unrecoverable limits. Do not repeat the 47 already-accounted units without a concrete remaining question.

## Resolution in this pass

The nine turn captures now have direct dispositions in [remaining-turn-coverage.md](remaining-turn-coverage.md). The six attachment captures now have full-reading dispositions in [attachment-disposition.md](attachment-disposition.md). The durable-intake wording was corrected in `topics/assimilation-workspace.md`; context-supplement idempotence was made explicit in `topics/purpose-built-context.md`; and worthwhile-but-premature deferral with a reactivation condition was added to `topics/quality-and-work-economics.md`. The original source truncation and unavailable-artifact limits above remain open. This closes the *review-accounting* gaps, not a claim that every upstream source was recoverable or that the synthesis has been validated on a context-window-scale run.
