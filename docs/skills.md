# Skill invocations

Use these skills in Codex chat in the repository you want to work on. You can type the invocation, select the skill, or explicitly ask the agent to use Projector in ordinary language.

The agent authors the artifacts and operates the runtime. You describe the desired result and review material decisions. Terminal CLI operations and MCP tools belong to the [runtime reference](reference/runtime.md).

## Contents

- [Choose by intent](#choose-by-intent)
- [Initialize and investigate](#initialize-and-investigate)
- [Draft and revise](#draft-and-revise)
- [Implement and check](#implement-and-check)
- [Sync and finish](#sync-and-finish)
- [Resume and reconstruct](#resume-and-reconstruct)
- [Integrate a branch](#integrate-a-branch)
- [Authorization and selection](#authorization-and-selection)

## Choose by intent

| You want to | Skill invocation | Result |
| --- | --- | --- |
| Activate or adopt a local project | `$projector:init` | Preserved configuration and checked schema setup |
| Understand a problem before planning | `$projector:explore` | Grounded alternatives and a recommendation |
| Draft a complete or incremental plan | `$projector:propose` | Proposal, requirement/design deltas, and tasks at the requested frontier |
| Change the plan | `$projector:revise` | Coherent revised artifacts and contribution accounting |
| Implement reviewed work | `$projector:apply` | Implementation in the selected managed candidate |
| Plan or execute checks | `$projector:verify` | Impact-aware protection decisions, actual evidence and review, or explicit obligations |
| Inspect drift | `$projector:audit` | Findings with a fixed basis and evidence limits |
| Materialize candidate authority | `$projector:sync` | Target requirements/design visible in the candidate |
| Complete selected work | `$projector:finish` | Archived target and integrated commit, or a blocker |
| Resume after interruption | `$projector:continue` | The authorized next step from durable state |
| Recover existing edits or task truth | `$projector:reconcile` | A reconstructed change or corrected task accounting |
| Integrate a selected branch | `$projector:merge` | Checked, independently reviewed integration or preserved blocked work |

## Initialize and investigate

`$projector:init` prepares a local Git repository and Projector schema. Existing configuration, custom schemas, and archives are inspected and preserved. Conflicts are reported before replacement. Planning can begin before a baseline commit exists; preparing implementation later requires a valid Git baseline.

`$projector:explore` inspects relevant code, requirements, designs, dependencies, and active work. It compares practical alternatives and presents a recommendation. Exploration does not author artifacts or implement unless those actions are separately requested.

```text
$projector:explore Results lose focus when filtering.
Compare keeping the same result identity with moving to the first result.
```

## Draft and revise

`$projector:propose` normally authors the complete plan in dependency order: proposal, nested requirement deltas, nested concern design deltas, then tasks. It validates complete artifacts and presents them for human review. For incremental planning, request one layer at a time. Missing later layers stay absent.

`$projector:revise` changes existing artifacts while preserving every still-applicable commitment. If implementation has started, it compares targets and accounts for contributions to retain, remove, replace, or revise. Scheduling edits to tasks and amendments to behavior have different meanings.

```text
$projector:propose Add keyboard navigation to search results.
Draft one artifact at a time so I can review each layer.

$projector:revise Keep the last result focused at the boundary.
Preserve activation and search-field typing.
```

Task reconciliation and reverse-task requests also route through revision. Actual implementation is inspected before missing tasks are inferred; unverified work stays unchecked.

## Implement and check

`$projector:apply` prepares or resumes the selected checkout, validates applicability and contributions, and implements through managed batches. Explicit isolated mode is available when useful; requirement revisions do not require another checkout. Changed intent routes through revision.

`$projector:verify` uses the [canonical verification procedure](../plugins/projector/skills/verify/SKILL.md). For fresh work, it inventories behavior, invariants, and boundaries before reading existing assertions. It justifies keep, create, update, refactor, replace, and delete decisions separately from execution selection. It checks a practical baseline and an intended behavioral failure, or records the applicable exception. It executes checks before a slice, after a slice, after test maintenance, and at the final settled result, rather than after every edit.

The procedure has four contexts. Planning derives obligations and validates artifacts without preparing implementation. Ordinary repository work uses normal commands and evidence notes without activating Projector. A prepared change retains its actual root, change, candidate, and baseline; it uses `recordEvidence` and `validatePlan` before authorized finish. Branch integration uses the pinned target-to-integration difference and normal commands, with mandatory independent review. It does not create a managed change or use those evidence APIs. Publication remains with `$projector:merge`.

Verification reassesses the complete baseline difference, broadens uncertain selections, and preserves required repository, release, hook, and review gates. Matching evidence can be reused; checkbox updates do not automatically rerun application tests. Check freshness does not establish overall plan validity. The report names actual executed checks, review attribution, unexecuted checks, and remaining uncertainty. Verification does not archive.

`$projector:audit` compares requirements, designs, tasks, implementation, and evidence at a selected basis. It distinguishes demonstrated defects from risks and unavailable evidence. Audit is read-only unless fixes are also authorized.

```text
$projector:audit Check keyboard navigation against the current candidate.
Distinguish a behavior mismatch from a missing interaction check.
```

## Sync and finish

`$projector:sync` materializes the exact target requirements and design in the managed candidate without archiving, publication, or integration. Subsequent target revisions still invalidate affected verification. The agent uses the single synchronization owner rather than manually copying authority.

`$projector:finish` resolves completion obligations through verification, archives the exact target and integrates reviewed code and accepted authority together. It then repeats settled finish to confirm a substantive no-op. It can resume interrupted completion and can finish several explicitly selected eligible changes.

```text
$projector:sync Show the revised requirements and design in this candidate.
$projector:finish Finish keyboard-navigation.
```

Finish includes integration of the selected change; it does not grant deployment or unrelated scope. See [workflows](workflows.md#finish-several-changes) for prerequisites between changes.

## Resume and reconstruct

`$projector:continue` reads active artifacts and durable state, then routes to drafting, revision, implementation, verification, or completion as appropriate. It preserves prior authorization. A clear active change can be selected directly; several plausible changes require a choice.

`$projector:reconcile` has two uses. For task-only requests, it inspects actual work and corrects task accounting through revision. For existing edits, it selects a coherent patch and reconstructs requirements and design. Default checkout mode leaves that patch in place; explicit isolated mode imports only the selection while preserving source content and staging.

```text
$projector:reconcile Capture my search-list edits as one change.
Keep the unrelated analytics edits outside the candidate.
```

Observed implementation does not automatically become intended behavior. See [existing projects](existing-projects.md).

## Integrate a branch

`$projector:merge` pins one source branch and the original target while preserving unrelated local edits. It constructs an isolated merge, resolves supported conflicts, checks the complete result, and obtains independent adversarial review. The target advances only after revalidation. Uncertain conflicts produce a decision brief; moved targets and actual conflicting local edits preserve the integration.

Its verification baseline is the pinned original `targetHead`. Use the branch-integration context of `$projector:verify` on the actual integration checkout, including corrections and hook writes. Keep command evidence and independent review with the integration record. Do not prepare a Projector change to qualify the merge.

Name the actual source branch to merge, or refer to one unambiguous relevant published result. Finish already integrates the selected change. See [integration](integration.md).

## Authorization and selection

A proposal normally ends at review. A request that explicitly includes planning, implementation, checks, and finish authorizes that complete run. Continuing after interruption preserves that authorization, but does not create approval for an unreviewed plan.

Name the change when several could match. Use the original source repository when addressing a prepared change. The agent retains its fixed candidate identity and target rather than guessing the newest branch.

If skills are absent, follow [troubleshooting](troubleshooting.md#skills-are-missing). [Examples](examples.md) shows these actions in conversation.
