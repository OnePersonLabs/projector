# Reviewing a change

Review first asks whether the proposed result is right. Later, it asks whether the actual implementation and evidence support that result. These are different questions, and you can catch a wrong assumption at either point.

## Contents

- [Read the plan in order](#read-the-plan-in-order)
- [Review observable behavior](#review-observable-behavior)
- [Review the design](#review-the-design)
- [Check the tasks](#check-the-tasks)
- [Give a correction](#give-a-correction)
- [Review the implemented result](#review-the-implemented-result)
- [Decide whether to integrate](#decide-whether-to-integrate)

## Read the plan in order

Open the proposal, requirement deltas, concern designs, and tasks. The proposal should explain the problem in your terms. The deltas should say what changes and what survives. The design should explain ownership and the choices that affect implementation. Tasks should follow from those documents.

For an incremental proposal, some layers may still be absent. That is a drafting frontier, not a finished plan. Ask `$projector:continue` to draft the next layer, or ask for the rest of the proposal.

## Review observable behavior

Consider the keyboard-navigation example:

```markdown
### Requirement: Keyboard result navigation
The results list SHALL support moving focus with Arrow Up and Arrow Down
and activating the focused result with Enter.

#### Scenario: Last result
- **WHEN** the last result has focus and the user presses Arrow Down
- **THEN** focus remains on the last result
```

This is an illustrative requirement excerpt, not a complete delta file. The agent supplies the surrounding artifact format and other surviving scenarios.

Ask what happens with an empty list, a changing result set, and focus inside the search field. Decide which behavior the feature must support. Avoid approving “keyboard support works” when the boundary behavior is still unspecified.

## Review the design

Check where the responsibility lives and why. If the design adds a global keyboard handler, inspect how it distinguishes the list from text inputs. If it proposes a dependency, ask what existing mechanism it replaces and what callers will still use.

Consequential choices need reasons, alternatives, and tradeoffs. Realization bindings should identify the code or supporting artifacts that own the contribution. A plausible file name is not proof that the implementation exists.

The agent can show relevant accepted designs and exact source references. You need to understand the consequence of the choice; you do not need to author selectors or hashes.

## Check the tasks

Tasks should describe outcomes you can recognize: implementing focus movement, preserving input-field behavior, updating supporting docs, and executing appropriate checks.

Checked tasks must reflect actual work. Missing checks stay visible. If task text requests a different behavior from a requirement, the requirement and design must be revised before the task can govern implementation.

## Give a correction

State the intended result directly:

```text
$projector:revise Keep focus on the last result instead of wrapping.
Preserve Enter activation and normal typing in the search field.
```

Before a candidate exists, the agent revises the artifacts. After implementation starts, it also accounts for existing contributions and invalidates affected evidence. See [revisions and recovery](revisions-and-recovery.md).

## Review the implemented result

Use `$projector:verify` to request executed checks and independent review without archiving. Ask what the checks actually exercised, where they ran, and which behavior remains unverified.

For keyboard navigation, a build can establish compilation. A realistic interaction check can establish focus movement and activation. Inspect both the test result and the actual diff, including event registration and other consumers.

Independent review should examine missing concerns, retained structure, concrete counterexamples, and a simpler alternative. The implementing agent cannot invent independence by writing a second review paragraph.

If the result has a causal defect, ask for a repair within the reviewed scope. If your intended behavior changed, use revision. Either can require refreshed evidence.

## Decide whether to integrate

Finish integrates the checked result and accepted authority into the selected branch. Review the reported commit, archive, actual checks, preserved local work, and remaining limitations.

Request finish when you want the reviewed change landed. Its temporary finalization checks the selected result before publication. Use `$projector:merge` for another source branch; that combined result needs its own checks and review.

Continue with [integration](integration.md), or use [examples](examples.md) to see review in context.
