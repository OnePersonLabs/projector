# Getting started

This guide takes a repository from plugin installation through one authorized change. Projector needs Node 24 or later on the host `PATH`.

## Contents

- [Install the plugin](#install-the-plugin)
- [Initialize a repository](#initialize-a-repository)
- [Plan the first change](#plan-the-first-change)
- [Authorize execution](#authorize-execution)
- [Inspect the result](#inspect-the-result)
- [Use a terminal](#use-a-terminal)

## Install the plugin

Install **Projector V3** (`projector-v3@projector-v3`) from this repository's Codex marketplace. For a local checkout:

```text
codex plugin marketplace add <checkout-path>
codex plugin add projector-v3@projector-v3
```

The installed plugin includes its compiled runtime. You do not need to build this repository to use it. Installing the plugin does not activate a project.

## Initialize a repository

Open the target repository in Codex and say: “Use `$projector` to initialize this repository.” This creates or checks `.projector/config.toml`, the readable model index, and the model structure. Initialization does not invent requirements from code.

For a new app, start with the behavior you intend to build. For an existing app, identify current behavior, decisions, and boundaries to inspect. An observed implementation is evidence for proposed meaning; it does not become accepted intent merely because it exists. If Projector reports an older unsupported format, keep the old files intact and inspect the cutover before writing new model data.

## Plan the first change

In Codex Plan mode, describe an outcome and invoke `$projector` in chat. For example:

> Use `$projector` to plan reusable clips with independent timeline placements. Each placement needs its own transpose value, and save/reload must preserve the shared clip reference.

Codex should show the actual candidate concepts, requirements, scenarios, relationships, stable IDs, proposed paths, reasons, and implementation consequences in readable form. Revise the plan in conversation. A question about the design is a request for explanation, not authorization. Plan mode does not capture or accept model changes, write canonical files, or implement code.

If the repository already has a model, Codex retrieves the relevant records and checks whether an existing identity owns the change. A behavior repair can preserve accepted meaning. The [Clip/Placement example](examples/clip-placement.md) shows a new model, a revision after feedback, and a later change to the same identities.

## Authorize execution

When the proposal matches the intended outcome, authorize Codex to implement it. Execution must be outside native Plan mode. That authorization covers model acceptance, implementation and verification together; `$projector` carries them through without another implementation prompt or skill invocation. The model lifecycle checks the exact proposed contents and current dependencies and retains recovery evidence.

If implementation reveals a material gap in intended meaning, Codex must show the proposed revision and resolve it before depending on that new meaning. A behavior-preserving code fix can keep the model unchanged.

## Inspect the result

Review the linked `.projector/` records, code diff, behavior checks, Projector context findings, and unresolved evidence. A passing check establishes only the cases it exercised. `$projector-verify` can inspect the actual implementation against the concept, requirement, and scenario, including counterexamples such as two placements sharing one clip and save/reload preserving their separate transpose values.

For source changes made outside this Projector task, use `$projector-reconcile`. For a large, branching set of source documents or chats, use `$projector-assimilate` to prepare a separate working synthesis before taking mature intent into Projector.

## Use a terminal

Skill names such as `$projector` are entered in Codex chat. The bundled terminal entry point is `node <plugin>/scripts/projector.mjs`; the bare `projector` command requires the separately packaged CLI on `PATH`. For example, `node <plugin>/scripts/projector.mjs init` initializes a repository and `node <plugin>/scripts/projector.mjs context "reuse clips in placements"` retrieves a context. The CLI exposes lower-level operations for integrations and exact inspection; it does not replace the conversational Plan mode review and authorization. See the [CLI reference](reference/cli.md).

Continue with [Workflows](workflows.md) or the [worked example](examples/clip-placement.md).
