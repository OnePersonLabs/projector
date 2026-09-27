# Projector documentation

Projector stores accepted project meaning in readable records, retrieves relevant context for work, and checks whether retained conclusions still fit current source and dependencies. This guide routes you by what you need to do.

## Contents

- [Choose a path](#choose-a-path)
- [Learn the model](#learn-the-model)
- [Use Projector](#use-projector)
- [Find an exact contract](#find-an-exact-contract)
- [Related projects](#related-projects)

## Choose a path

| If you want to… | Read… |
|---|---|
| Understand Projector's purpose and limits | [Overview](overview.md) |
| Activate a repository and complete one task | [Getting started](getting-started.md) |
| See complete situations and recoveries | [Examples](examples.md) |
| Choose a workflow for a kind of change | [Workflows](workflows.md) |
| Choose the right skill invocation | [Skills](skills.md) |
| Understand accepted meaning and identity | [Concepts](concepts.md) and [Model and context](model-and-context.md) |
| Revise accepted meaning | [Changing accepted meaning](changing-accepted-meaning.md) |
| Review drift, reconcile external edits, or recover | [Review, reconcile, and recover](review-reconcile-recover.md) |
| Find CLI syntax | [CLI reference](reference/cli.md) |
| Diagnose a problem | [Troubleshooting](troubleshooting.md) or [FAQ](faq.md) |
| Work on Projector itself | [Development](development.md) |
| Improve these docs | [Documentation guide](documentation-guide.md) |

## Learn the model

The repository's [.projector/README.md](../.projector/README.md) is its canonical model index. Read that index when you need to inspect Projector's own accepted meaning. This documentation explains how to use the model; it does not replace or copy its records.

## Use Projector

The normal flow uses `$projector` to retrieve meaning, ordinary Codex tools to make an authorized implementation change, relevant behavior checks, and a Projector check to revisit the retained context. Use `$projector-change` when the intended meaning changes. Use `$projector-review` for consequential candidate diffs, `$projector-reconcile` for outside changes, and `$projector-assimilate` to synthesize large or branching source material.

## Find an exact contract

The [CLI reference](reference/cli.md) lists supported public operations and options. The installed skills define the user-facing workflow. The [operation contract](../plugins/projector-v3/references/operation-contract.md) documents integration details. For Projector's own implementation, source and generated contracts remain authoritative.

## Related projects

[Projector 4](https://github.com/OnePersonLabs/projector/tree/v4) centers on a reviewed proposal-to-integration lifecycle. [Kerf](https://github.com/OnePersonLabs/kerf) centers on a smaller conceptual model and bounded focus workflow.

Continue with [Getting started](getting-started.md) or return to the [Projector 3 README](../README.md).
