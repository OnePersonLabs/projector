# Delivery and Acceptance Requirements Audit

## Scope

Audited [07-delivery-acceptance.md](../requirements-parts/07-delivery-acceptance.md) against every Markdown file in `PROJECTOR_SPEC/12-delivery/` and the handoff-related requirements/decisions in `.planning/PROJECT.md` (`Requirements / Active`, `Context`, `Constraints`, and `Key Decisions`). The audit covered delivery rules, Slice 0–12 items and gates, the mandatory fixture facts and ordered steps, all acceptance scenarios, public-release criteria, dogfooding obligations, the final checklist/directive, explicit non-goals, source-heading coverage, and self-hosting deletion gates.

## Result

**PASS after patching.** The fragment now preserves the canonical conditions, thresholds, ordering, exceptions, protected dimensions, and handoff gates reviewed below.

### Coverage and identifier counts

| Area | IDs | Range | Duplicates/gaps |
|---|---:|---|---|
| Delivery | 22 | `DELV-001`–`DELV-022` | none |
| Slices | 102 | `SLICE-000`–`SLICE-101` | none |
| Acceptance | 120 | `ACC-000`–`ACC-119` | none |
| Release | 77 | `REL-001`–`REL-077` | none |
| Dogfooding | 17 | `DOG-001`–`DOG-017` | none |
| Handoff | 8 | `HANDOFF-001`–`HANDOFF-008` | none |
| **Total** | **346** |  | **none** |

All requirement entries remain unchecked (`[ ]`). The source corpus has 7 H1, 78 H2, and 0 H3 headings (85 total); all 85 are represented in the fragment's Source Coverage table. No source H1/H2/H3 heading is unmapped.

## Findings corrected

1. **High — final directive was materially compressed.** `DELV-008` previously collapsed the final implementation directive into broad phases and omitted deterministic structure, WHAT/WHY vs WHERE/WHAT-ELSE, requirement/scenario creation bounds, scoped-decision dirtying, materiality-gated evidence/preferences, causal authority, representation fidelity/net utility, derivation/signature recording, uncertain-impact widening, upstream repair, semantic-residue-only agents, mutation-based reverse impact, no manufactured authority, fine-grained intent commit, and resumable cleanup. It now preserves the full ordered loop and those conditions.
2. **High — self-hosting deletion gates were incomplete.** `HANDOFF-004` now requires no remaining references or semantic dependencies in addition to clause destinations and all five audits. `DELV-014` now explicitly keeps an exact checksummed source snapshot available as migration evidence until equivalence gates pass.
3. **Medium — partial-plan rebase condition was weakened.** `ACC-083` now requires every `StateBinding` dependency/membership fingerprint to remain unchanged, forbids blind resume on bound dependency changes, and preserves the no-recompute condition for unaffected work.
4. **Medium — representation and style exceptions were under-specified.** `ACC-114` now retains the valid deterministic invariant encoding exception. `ACC-119` retains the host-policy, measured-savings, and clarity conditions for compression/abbreviation. `DOG-014` retains the exact actor/verb safety exception for passive voice and nominalization signals.
5. **Medium — two project-level handoff decisions lacked explicit IDs.** Added `HANDOFF-007` for Codex and Claude Code integrations before final handoff and `HANDOFF-008` for maintainer-focused self-governance as the decisive end-to-end proof. Existing Slice 9 and dogfooding entries remain in place.
6. **Low — several fixture/checklist predicates were shortened.** `ACC-064`, `ACC-068`, and `ACC-091` now retain their fixture setup and exact identity/hash conditions. `REL-029`, `REL-030`, `REL-035`, and `REL-041` now retain loading/rewriting, canonical/worktree, alias-identity, and full protected-dimension language.

## Validation performed

- Parsed all requirement IDs: contiguous ranges, no duplicates, no gaps.
- Counted 85 canonical delivery headings and matched all 85 Source Coverage rows; confirmed zero H3 headings exist.
- Checked every implementation-plan bullet, Slice 0–12 order gate, first-slice fixture fact and steps 1–17, acceptance scenario, release item 1–25 plus prohibition, dogfood item, final checklist item, directive condition, non-goal, and project handoff gate against its source.
- Confirmed every changed requirement retains a source citation and all source mappings remain in the same fragment.

## Residual risk and follow-up

This is a text/coverage audit; no runtime implementation or fixture execution exists to validate behavior yet. Before source deletion or public-release claims, run the cited acceptance fixtures, release gates, semantic-equivalence/omission/contradiction/weakened-language/dangling-reference audits, and the independent conformance checks required by the fragment.
