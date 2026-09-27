# Getting started

This guide takes a repository from plugin installation to one checked implementation change. Projector requires Node 24 or later on the host `PATH`.

## Contents

- [1. Install the plugin](#1-install-the-plugin)
- [2. Activate the repository](#2-activate-the-repository)
- [3. Establish the first accepted meaning](#3-establish-the-first-accepted-meaning)
- [4. Retrieve meaning before editing](#4-retrieve-meaning-before-editing)
- [5. Make and check the change](#5-make-and-check-the-change)
- [6. Keep the right record](#6-keep-the-right-record)
- [First-use checklist](#first-use-checklist)

## 1. Install the plugin

Install **Projector V3** (`projector-v3@projector-v3`) from this repository's marketplace and use Node 24 or later. The shipping plugin at `plugins/projector-v3` includes its compiled runtime; installation requires no build, `pnpm install`, or dependency download. For a local checkout, register the repository with `codex plugin marketplace add <checkout-path>`, then run `codex plugin add projector-v3@projector-v3`. The plugin's skills invoke `node <plugin>/scripts/projector.mjs`; the bare `projector` command requires the separately packaged CLI on the host `PATH`.

Contributors run `pnpm install` and `pnpm plugin:prepare-local` after runtime changes. That command stages the plugin under `.build/local-marketplace/plugins/projector-v3` and updates the shipping runtime under `plugins/projector-v3/runtime`. Include that generated runtime with the source change so GitHub installations receive the current code. `.build/` remains ignored by Git.

## 2. Activate the repository

Ask Codex: “Use `$projector` to initialize this repository.” The skill invokes the bundled CLI. If you run commands in a terminal, `node <plugin>/scripts/projector.mjs init` works with the plugin bundle; `projector init` requires the separate CLI distribution on `PATH`. Initialization creates or validates the Projector configuration and canonical model structure. Installing the plugin alone does not activate a repository.

If Projector reports an unsupported authored format, stop and inspect the format boundary. Do not rename or rewrite older data to make initialization pass. The current release supports one artifact format and requires a checked cutover from an older format.

Initialization creates the configuration, runtime structure, and model index. It does not invent project obligations. A new project still needs accepted meaning based on user intent and inspected project evidence.

## 3. Establish the first accepted meaning

If the model has no authored obligations, ask the user which existing behavior and boundaries must govern future work. Inspect the implementation and available product decisions as evidence, then use `$projector-change` to propose the first relevant concepts, requirements, and observable scenarios. Capture and review that proposal through the skill. From a terminal, run `node <plugin>/scripts/projector.mjs accept proposal.json --request "Record the existing replay contract"`, or use `projector accept proposal.json --request "Record the existing replay contract"` after installing the separate CLI distribution. Apply only the reviewed change ID and hash. Initialization does not seed a model from code automatically.

If the model already has accepted meaning, move to the next step. For a behavior-preserving first task, ask Codex: “Use `$projector` to retrieve the replay duplicate-handling contract and help me fix the reconnect bug without changing that behavior.”

## 4. Retrieve meaning before editing

The skill retrieves a context packet for the requested outcome. Name relevant record IDs with `--entity` or known source paths with `--target` when direct CLI use is appropriate. Read complete selected sections, relationships, reasons, evidence, omissions, and unknowns. Keep the returned context ID for the later check. The direct CLI examples in this guide use `projector` shorthand only when the separate CLI distribution is on `PATH`; otherwise, prefix the operation with `node <plugin>/scripts/projector.mjs`.

## 5. Make and check the change

For a behavior-preserving change, Codex inspects current code and makes authorized edits with ordinary tools. Run the behavior checks that exercise the changed path. Then check the retained context with `projector check <context ID>` or ask `$projector` to do so. Explain which obligations were examined and what remains uncertain. If the requested behavior itself changes, pause implementation and use `$projector-change` to review and accept the new meaning first.

If source membership or an assumption changed, investigate it; that is not automatically a violation.

## 6. Keep the right record

When the task discovers a durable constraint, scenario, relationship, or reason that will help future work, use `$projector-change` to propose a model update. Do not record every implementation choice. Projector's model should retain facts that can change a future decision or help check an obligation.

## First-use checklist

- The repository has an active `.projector/config.toml` and canonical `.projector/model/`.
- Context output has a retained context ID.
- The implementation was inspected and relevant behavior checks ran.
- The context check's findings and unknowns were reviewed.
- Any intended meaning change was handled through a reviewed canonical change.

Continue with the [everyday workflow](workflows.md) or browse complete [examples](examples.md).
