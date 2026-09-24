# Getting started

## Installation

Install Projector from the local Codex marketplace your agent registered. If you have this repository but no marketplace entry, ask:

> Install this Projector checkout as a user-level Codex plugin. Handle the prerequisites and registration, then verify the installed skills and tools.

The agent follows [the installation procedure](development.md#local-plugin-installation). You do not need to build it or run runtime commands. This repository does not claim a public marketplace listing.

After installation or refresh, start a fresh Codex session to discover the updated skills. Type a skill name or select it in the skill picker.

## Initialize your project

Open your project's Git repository and invoke `$projector:init`.

The agent adds OpenSpec folders and the Projector schema while preserving existing specs and configuration. Repeating initialization is safe. Conflicting custom schema files are reported before replacement.

For an empty project, the agent helps establish the Git baseline needed for isolated implementation. It does not silently commit unrelated work.

## Describe your change

```text
$projector:propose Add a dark mode toggle and remember the choice.
```

The agent reads your project, clarifies consequential choices, and writes the proposal, requirements, designs, and tasks under `openspec/changes/`. It presents a short summary and links to the artifacts.

Review the behavior and tradeoffs. Ask for revisions in ordinary language. You do not need to learn artifact syntax.

## Implement and finish

Use `$projector:apply` when the plan is ready. Changes happen in a separate working directory so incomplete implementation stays isolated.

Use `$projector:verify` for a progress check, or `$projector:finish` to verify and complete the change. Finish requires actual checks and independent review.

The agent reports the resulting branch. Finishing does not merge into your working branch or deploy. Ask it to integrate the result when you want that action.

To authorize planning, implementation, verification, and finish at once, say so in your original request.
