# Projector documentation

Projector keeps a reviewed plan and its implementation together through revision, checks, and completion. Start with a story, then choose the guide that matches your current work.

## Contents

- [Pick your path](#pick-your-path)
- [The short path](#the-short-path)
- [User guides](#user-guides)
- [Reference and contribution](#reference-and-contribution)
- [Evidence](#evidence)
- [Related projects](#related-projects)

## Pick your path

| Your situation | Start here |
| --- | --- |
| You have not used Projector yet | [Getting started](getting-started.md) |
| You want the mental model first | [How Projector fits together](overview.md) |
| You learn by watching a complete task | [Practical stories](examples.md) |
| You have a problem but no solution | [Explore before proposing](workflows.md#explore-before-proposing) |
| The agent has drafted your plan | [Reviewing a change](reviewing-a-change.md) |
| You already have specs or code | [Existing projects](existing-projects.md) |
| Your plan changed or the session ended | [Revisions and recovery](revisions-and-recovery.md) |
| A candidate is finished | [Integration](integration.md) |
| Something failed | [Troubleshooting](troubleshooting.md) |

If you read only two pages before starting, use getting started and the [skill guide](skills.md). Skill invocations belong in chat; your agent operates the underlying tools.

## The short path

```text
$projector:init
$projector:propose Add keyboard navigation to search results.
   Review the proposal, requirements, design, and tasks.
$projector:apply
$projector:finish
   Inspect the reported integrated commit and archive.
Use $projector:merge to integrate that branch when ready.
```

The proposal pauses for review unless you explicitly authorize planning, implementation, checks, and finish together. Finish integrates reviewed code and accepted authority together. Use merge for another selected source branch.

## User guides

| Guide | What you learn |
| --- | --- |
| [Getting started](getting-started.md) | Install, initialize, and reach a checked candidate |
| [Overview](overview.md) | Requirements, concern designs, targets, candidates, and evidence |
| [Examples](examples.md) | Features, uncertain ideas, revisions, reconstruction, recovery, and conflicts |
| [Workflows](workflows.md) | Choose the next action, including incremental and bulk work |
| [Skill invocations](skills.md) | All twelve skills, selection, and authorization boundaries |
| [Reviewing a change](reviewing-a-change.md) | Evaluate proposed behavior and implemented results |
| [Existing projects](existing-projects.md) | Adopt OpenSpec or capture selected existing edits |
| [Revisions and recovery](revisions-and-recovery.md) | Preserve useful work and resume the original change |
| [Integration](integration.md) | Resolve and review a merge before the working branch advances |
| [FAQ](faq.md) | Common setup, workflow, completion, and support questions |
| [Troubleshooting](troubleshooting.md) | Concrete failures and next steps |
| [Glossary](glossary.md) | The vocabulary used in artifacts and runtime results |

## Reference and contribution

[Runtime reference](reference/runtime.md) explains CLI operations, MCP tools, source queries, the managed observation protocol, and limits. The [workflow coverage map](reference/workflow-coverage.md) identifies the OpenSpec workflow capabilities covered by Projector.

[Development](development.md) covers build, local packaging, installation, and owner updates. [Writing documentation](documentation-guide.md) records page roles, voice, story structure, diagrams, and review criteria.

## Evidence

[Workflow qualification](qualification-workflow.md) records 4.2 integration and 4.1 lifecycle checks. [Original V4 verification](verification.md), [Codex qualification](qualification-codex.md), [host qualification](qualification-host.md), [OpenSpec qualification](qualification-openspec.md), and [clean evolution](clean-evolution.md) retain their stated versions and conditions. [The evaluation guide](../evaluation/README.md) explains the local clean-evolution campaign.

These records are historical evidence for the checks they describe. They do not establish universal application correctness, support for untested environments, or large-project economic advantage.

## Related projects

[Projector 3](https://github.com/OnePersonLabs/projector/tree/v3) keeps a persistent accepted-meaning model for context and consequence checks during ordinary edits. [Kerf](https://github.com/OnePersonLabs/kerf) uses readable concepts, bounded focus, and local lenses. Projector 4 adds the reviewed change lifecycle and integrated completion described here. Follow each project's own setup and artifact guidance.
