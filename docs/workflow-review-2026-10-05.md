# Psychord workflow review

Date: 2026-10-05. Psychord was paused for this review. The user subsequently
resumed implementation; its current task record is in Psychord's
`.projector/work/current-work.md`.

## Recommendation

Do not irreversibly erase Psychord. Ending work on it is a legitimate decision;
the time already spent creates no obligation to continue. A frozen archive
provides that exit while preserving the option to recover an idea or recording.
Permanent erasure would destroy that option without establishing whether the
musical idea is feasible.

The audit identifies specific avoidable costs in the development approach.
It does not establish that most effort was wasted, that the dream is impossible,
that its complete scope is feasible, or that it is commercially worthwhile.
Another unbounded rewrite has not earned a recommendation.

My assessment is that Projector was over-applied in this recovery. Its net
benefit over Git, focused design notes, and a short current task record remains
unproven. Retain a helper only where its mapping, evidence reuse, or recovery
answers a concrete question more cheaply. Projector adoption is not a condition
for resuming useful musical work.

## What explains the overhead

The root session log from 2026-10-04 16:03 UTC through 2026-10-05 08:06:12 UTC
contains:

| Observation | Count |
| --- | ---: |
| Agent launches | 23 |
| Reviewer launches, included above | 16 |
| Follow-up assignments | 47 |
| Agent messages sent | 137 |
| Context compactions | 12 |
| Root execution-tool calls | 784 |
| Tool results returned to root | 1,061 |
| Characters in those tool results | 6,012,655 |
| Repeated full Projector guidance injections | 33 |

These are coordination and context-volume measurements. They are not a billing
estimate, a quota estimate, unique content, child-agent totals, or a breakdown
of wasted hours. Twenty-three launches in roughly 16 hours is about 1.4 per
hour. The roughly 70 agents across the full session include the earlier
recovery phases. These counts do not establish excessive delegation, repeated
investigation, or wasted time. Several independent reviews found real defects.
Evaluate assignments by useful work, defects caught, and total coordination
cost; minimizing launches is not the objective. The verified excesses are the
large default context packets and the specific repeated-test/review rules below.

Source: root session `01a100b0-9ff6-72f0-8004-e239128f6684`. The local metadata
counter and output are in `.verification/workflow-review/`. They print counts,
not conversation bodies or account data. They are scratch evidence, not part
of the distributed plugin.

## Findings and applied changes

| Finding | Applied change |
| --- | --- |
| Routine lookup returned entire checkpoints, including machine inventories. | Default checkpoint output now returns navigation, open questions, changed paths where applicable, and links to complete evidence. Full records remain available. |
| Each prompt received the full Projector instructions. | Session start and resume load the full guidance. Prompt hooks check activation and provide a short reminder with a path to the instructions. |
| OPL required suites after each executable edit. | Focused checks resolve immediate questions; integration and regression checks run in coherent batches. Relevant changes still invalidate affected evidence. |
| Review guidance encouraged repeated setup and could expand into unrelated edits. | Reuse reviewers for repairs. Review the changed behavior, affected consumers, and invalidated evidence. Keep independent review for consequential results. |
| Audit findings needed another review before authorized repairs could begin. | The parent evaluates source-backed findings; consequential resulting changes receive independent review. |
| Skill maintenance mandated AI evaluations despite permission constraints. | AI comparisons require explicit permission and a material uncertainty. Package validation and instruction review remain. |
| Human understanding was only a readability preference. | Comprehensibility is now required for acceptance. Names, interfaces, comments, and plain explanations must expose assumptions and consequential behavior. |

One read-only comparison used Psychord's actual recovery checkpoint. The full
record serialized to 395,590 bytes; the new navigation response serialized to
1,106 bytes, about 99.7% less. This measures response size only. The detailed
record remains intact and must be consulted for exact decisions, exceptions,
ownership, and recovery actions.

The relevant implementation is in `runtime/work.mjs`, `runtime/projector.mjs`,
`runtime/cli.mjs`, and `hooks/projector-context.mjs` under
`plugins/opl-projector/`. The response contract is in
[interfaces.md](interfaces.md). OPL changes are committed locally as
`124ad841434be07bf9e623a208918567ad665488`.

## The defensible job of hashes

A hash answers whether selected bytes match earlier bytes. Its useful consumers
here are concrete:

| Consumer | Decision enabled |
| --- | --- |
| Provider facts and cached checks | Whether a result still applies to its declared source and configuration. |
| Resume | Which selected files changed since the saved state. |
| Repair and rollback | Whether contents still match what that operation expects before replacing them. |
| Backup or asset integrity | Whether a copy matches its expected bytes. |

Hashes do not establish correct musical behavior, sufficient coverage, user
intent, or comprehensibility. Repair checks are cooperative checks, not atomic
locks against a concurrent process. Ordinary code review can usually identify
its input with a Git commit or scoped diff. Additional hand-maintained hash
inventories need a real consumer; duplicating runtime inventories earns no
extra assurance.

## Large files and human understanding

A file becomes difficult when a reader must understand several unrelated
behaviors to change one of them. Line count is a useful warning. Splitting it
into many small files can preserve the same problem while adding navigation.

Acceptance now asks whether the user can follow what the system does, where
state changes, why the design makes a consequential choice, and what happens
when it fails. Local comments should explain reasons and constraints. Agent
approval and a successful test suite cannot establish the user's understanding.

This workflow update does not restructure Psychord's existing large files or
establish that the user understands its current implementation.

## Verification and limits

- Projector: `npm test`, 39 passed, zero failed.
- OPL: `npm run test:installed -- --plugin opl` passed contract checks,
  repository tool tests, 27 plugin unit-test files, installed-source comparison,
  role discovery, and trust checks for 26 hooks in a separate test home.
- After one wording alignment, the OPL package/discovery check passed again
  with `--package-only`; unchanged unit results were reused.
- One independent reviewer examined the source changes and affected consumers.
  The same reviewer checked the repair wording. No findings remain in that scope.
- Whitespace checks passed. The prose lint was advisory; its possessive and
  sentence-length notices do not certify or disprove clarity.
- No AI behavioral evaluations were run. Reduced elapsed time, quota use,
  improved instruction following, and actual user comprehension remain unmeasured.

Source changes and isolated installation checks are complete. The user's active
installed plugins and personal instruction file were not replaced. These
changes have not been pushed. Psychord product code and saved playing data were
not changed by this workflow review.

Persistent checkpoint files can still be large. The patch reduces default
retrieval and changes future authoring guidance; it does not migrate stored
recovery data. Broad adoption should depend on demonstrated usefulness, not
the existence of more machinery to maintain.

## Pause handoff

At audit handoff, the next decision was whether Psychord should resume. The user
has since authorized continuation. Keep the recovered intended scope and select a
connected musical behavior that the user can play and understand. Exercise its
recognition, assessment, challenge response, and visible explanation together
before extending dependent systems. That demonstration would be evidence about
the product, not permission to declare the complete project finished.
