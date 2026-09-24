# Projector

**Describe a change. Review the plan. Let your coding agent do the work.**

Projector keeps what you asked for, the design, and the implementation together. Your agent writes the requirements and tasks, implements the change, runs checks, and brings you back a verified result. When the plan changes, it updates the work without losing what still belongs.

## Get started

Install the **Projector** plugin in Codex. For a local checkout, ask your agent:

> Install this Projector checkout as a user-level Codex plugin and verify it works.

The agent handles the build and registration. [Installation help](docs/getting-started.md#installation).

Open the repository you want to work on, then type:

```text
$projector:init
$projector:propose Add dark mode that remembers my preference.
```

Your agent explores the code and drafts the proposal, requirements, design, and tasks. **You review the plan; you do not write those files.**

When it looks right:

```text
$projector:apply
$projector:finish
```

Projector checks the work and archives the completed change. The result is on an isolated branch, ready to review and integrate into your working branch.

To integrate a finished candidate after reviewing the combined result:

```text
$projector:merge projector/my-change-12345678
```

Projector builds the merge in an isolated worktree, resolves conflicts it can justify, runs checks, obtains an independent adversarial review, and advances your working branch only when the result is ready. Uncertain conflicts come back as a self-contained decision brief.

## Still figuring it out?

```text
$projector:explore How could we make playback feel instant?
```

Already know what you want and want the whole workflow handled? Say:

> Use Projector to add keyboard navigation. Draft the plan, implement it, verify it, and finish the change.

That explicitly authorizes the full run. Otherwise, planning pauses for your review.

## Pick up where you left off

- **Resume:** `$projector:continue`
- **Change the plan:** `$projector:revise`
- **Check for drift:** `$projector:audit`
- **Bring existing edits into the workflow:** `$projector:reconcile`
- **Integrate a finished branch:** `$projector:merge`

Projector includes its own workflow skills and OpenSpec tooling; you do not need the old OpenSpec plugin alongside it. The currently qualified implementation profile is local Git repositories with JavaScript/TypeScript and Markdown.

[Start your first change](docs/getting-started.md) · [All workflows](docs/workflows.md) · [Existing OpenSpec projects](docs/existing-projects.md) · [Documentation](docs/README.md)
