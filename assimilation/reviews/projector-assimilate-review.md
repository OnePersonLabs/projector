# Projector assimilate skill review

Scope: the new `plugins/projector/skills/projector-assimilate/` package, its two references, local Projector operation and proposal contracts, and three independent bounded behavioral trials. This is a skill-design review, not proof that full multi-chat assimilation is complete.

## `$skill-judge`

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Knowledge delta | 18/20 | Branch reconciliation, durable source intake, topic/Projector identity separation, and source-independent synthesis are specific to this problem. |
| Thinking and procedure | 13/15 | Strong decision criteria and handoff ownership; the first full-corpus run will expose procedural gaps. |
| Anti-patterns | 13/15 | Calls out source instruction capture, repeated-branch authority, fake identity matches, ignored intake, quota downgrade, and source archaeology. |
| Specification and description | 14/15 | Name and description are discriminating; metadata and invocation policy agree. The generic validator does not recognize the repository's `disable-model-invocation` key. |
| Progressive disclosure | 13/15 | Entry is under 50 physical lines, with intake and handoff references loaded at their decision points. It still carries substantial shared guidance. |
| Freedom calibration | 14/15 | Flexible on interpretation and work allocation; strict at the Projector identity and acceptance boundary. |
| Pattern | 9/10 | A compact process entrypoint with two conditional references. |
| Usability | 13/15 | The targeted source-boundary retest succeeded; a realistic large-corpus/resume run is still required. |
| **Total** | **107/120** | **B -- usable for a bounded full-corpus pass, with scale claims still unproved.** |

The entrypoint was trimmed after the first trial to shift detailed intake and change procedure into references. One trial topic note narrated “the earlier branch proposed” where the resolved authority constraint should stand alone. The second trial exposed a more serious failure: a source handoff demanded source IDs, and the generated topic notes and change brief repeated them even though they remained understandable without the source. The skill now explicitly forbids source-ID scaffolding and source-format directives in normal output, while retaining exact evidence in intake. A fresh third trial produced topic notes without source-ID citations and declined to create a change brief because the supplied material did not establish a distinct gap in Projector's existing context behavior.

## `$skill-review` audit

1. **Pre-review/discovery:** the source plugin manifest exposes `./skills/`; the runtime builder copies the source skill directory. `scripts/projector-plugin.test.ts` passed all 5 focused tests. A final runtime build succeeded, and the four shipped skill files match source hashes. A newly installed-plugin discovery run was not performed.
2. **Standards:** YAML parsing of the skill frontmatter and `agents/openai.yaml` passed. `name` matches the directory, the description states what/when, references exist, and `disable-model-invocation: false` agrees with `allow_implicit_invocation: true`. The generic `$skill-creator` validator rejected only the extra `disable-model-invocation` key; this is the expected validator limitation for this repository's paired invocation fields, not a syntax defect.
3. **Current contracts:** local Projector `operation-contract.md` and `$projector-change` proposal guidance confirm the named `context`, `change.capture`, `change.plan`, `change.approve`, and `change.apply` path. The skill defines no third-party API calls or dependency versions of its own. No external documentation claim was needed to validate the local operation route.
4. **Examples and resources:** references have no executable code or templates. The linked `workspace.md` and `change-handoff.md` exist and address distinct stages. The skill's default `assimilation/` location matches the existing unignored workspace. The source capture manifest has 56 resolvable turn paths and 31 resolvable attachment references from 12 sources.
5. **Cross-file consistency:** intake remains durable; Markdown topic notes do not share Projector concept identity; a change intent brief is candidate evidence. No reference requires auto-promotion, a new canonical store, or an automatic low-quota model downgrade.
6. **Dependencies/version drift:** no new executable dependency. Projector's current local packaged operation contract is the runtime authority; the skill defers to it instead of copying schema JSON. The generic `$skill-review` bundled shell scripts and report template were not present at their advertised paths, so equivalent manual checks were used.
7. **Severity:** the second trial found a high-impact source-boundary defect: untrusted handoff citation demands leaked into output form. The targeted repair passed a fresh negative-case trial. The remaining medium risk is untested behavior on the full, highly coupled corpus.
8. **Fixes:** shortened the entrypoint, tightened reference-loading conditions, and added explicit rules against source chronology, source IDs, and source-specific output directives in normal topic notes and change briefs. No version bump or changelog is appropriate for a newly created skill; no commit was made.
9. **Verification:** three independent forward trials produced resumable workspaces without mutating Projector's accepted state. The first two produced candidate briefs; the third appropriately stopped at a working synthesis. The first trial's links and capture fingerprint and the second trial's local links were checked by their evaluators. The second output retains unwanted source-ID citations as a pre-repair counterexample; the third output contains no such citations in normal topic notes. All trials intentionally used isolated `.temp/` directories, which are ignored; the real long-running intake is in unignored `assimilation/intake/`.

The retained 12-source pile now has direct review dispositions for all captured turn units and attachment hashes, and the two material omissions found in that gap pass were added to topic notes. A separate source-severed cold reader recovered the assimilation/Projector identity boundary, quality/economics requirement, learned-understanding versus context-delivery distinction, and change-intent maturity boundary without intake. This is bounded fidelity and usability evidence, not proof of recovery for upstream missing material, arbitrary-scale coherence, or economic benefit.

Next evaluation: add a genuinely new branch or source to this ongoing workspace, interrupt and resume, and compare the resulting change intent with Projector's current accepted meaning. Only observed failures should drive further skill changes.
