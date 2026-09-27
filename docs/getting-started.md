# Your first Projector change

This guide takes you from local plugin installation to a checked integrated change. You need a local Git project; see the runtime reference for built-in language providers and their limits.

## Contents

- [Install the plugin](#install-the-plugin)
- [Initialize the project](#initialize-the-project)
- [Describe the result](#describe-the-result)
- [Review the plan](#review-the-plan)
- [Implement in the candidate](#implement-in-the-candidate)
- [Verify and finish](#verify-and-finish)
- [Integrate when ready](#integrate-when-ready)

## Install the plugin

If your agent has this checkout, ask:

> Install this Projector checkout as a user-level Codex plugin. Handle prerequisites and local registration, then verify installed skills, MCP startup, and initialization.

The agent follows [local plugin installation](development.md#local-plugin-installation). It builds a complete package and registers it through Codex. This repository documents local delivery, not a public marketplace listing.

Start a fresh Codex session after installation or refresh. Check that the Projector skills are available. Skill discovery and successful tool execution are separate checks; registration alone does not establish readiness.

## Initialize the project

Open the repository you want to change and invoke this in chat:

```text
$projector:init
```

The agent inspects Git status, existing configuration, schemas, active changes, and archives. Initialization adds missing scaffolding and reports conflicts before replacing customized schema files. Repeating setup preserves existing configuration.

Planning can proceed in a repository with no baseline commit. Before implementation, the agent must establish a valid baseline within your authorization and preserve unrelated work. Initialization itself does not silently commit files.

If you already use OpenSpec, read [existing projects](existing-projects.md).

## Describe the result

For an application with a search results list:

```text
$projector:propose Add keyboard navigation to search results.
Arrow Up and Arrow Down move focus. Enter opens the focused result.
Focus stays at the ends instead of wrapping.
Typing in the search field must keep working.
```

The agent reads the project and clarifies material behavior choices. It writes a proposal, nested requirement deltas, nested concern design deltas, and tasks under a named `openspec/changes/` directory.

The proposal explains why and what changes. Requirements state observable behavior. Design states ownership and implementation choices. Tasks describe the work. See [the overview](overview.md) for an example directory.

## Review the plan

Open the linked artifacts and check whether the behavior matches your request. Consider empty results and a focused item that disappears after filtering. Ask for the handling you want rather than assuming the agent chose it.

The agent writes the files; you review their meaning. Use ordinary language or `$projector:revise` for corrections. [Reviewing a change](reviewing-a-change.md) explains what to inspect.

For one artifact at a time, request incremental planning. Use `$projector:continue` to advance the next requested layer. Otherwise, propose drafts the complete plan.

## Implement in the candidate

Once the plan is ready:

```text
$projector:apply
```

The agent pins the baseline and target, enrolls the selected checkout, validates obligations, and implements there. You can request isolated workspace mode when useful. It reports the implementation location. Changes to intended behavior route through revision.

The original working directory and the candidate have different roles. Use the candidate to inspect and exercise implementation. Do not expect new application code in your original checkout before integration.

## Verify and finish

For a progress check without archive:

```text
$projector:verify
```

To verify and complete:

```text
$projector:finish
```

Finish requires current checks and independent review. It assembles the exact result in temporary isolation, runs normal hooks, and integrates code and accepted specifications together with recoverable checkout/index installation. Repeated settled finish is a no-op.

Read the report: actual checks, review provenance, integrated commit, archive, and any unverified behavior. A checkbox or successful compilation alone cannot establish keyboard interaction behavior.

If you want the agent to carry the whole lifecycle without stopping at proposal review, explicitly authorize it:

> Use Projector to add keyboard navigation. Draft the plan, implement it, run the checks, and finish the change.

Material uncertainty still requires clarification. That request does not include integration unless you also ask for it.

## Integrate when ready

Finish already integrates the selected change. Ask for `$projector:merge` with another source branch when needed. The agent checks and reviews the combined result in temporary isolation and preserves unrelated staging and working changes during publication. An uncertain conflict or moved target preserves the integration and produces a concrete next step.

[Integration](integration.md) explains the prerequisites. [Practical stories](examples.md) shows revisions and interruptions. [Troubleshooting](troubleshooting.md) covers setup or completion failures.
