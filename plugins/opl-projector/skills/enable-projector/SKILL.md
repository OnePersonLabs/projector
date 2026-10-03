---
name: enable-projector
description: Enable, disable, or check OPL Projector in a project when the user asks to activate Projector, turn it off, or inspect its activation. Other Projector skills apply only to activated projects.
---

# Enable Projector

Resolve the current project from the user's request and working directory. Resolve the installed plugin root from this skill's location, two directories above this skill directory. Use its `runtime/cli.mjs`; do not use another Projector installation.

For an explicit enable request, run `node PLUGIN_ROOT/runtime/cli.mjs activate` in the project. For an explicitly selected project directory, pass `--root PROJECT`. The helper uses the nearest Git root by default and creates only `.projector/active`. It does not create speculative Concepts, Lenses, or checks. Activation completes when the helper reports `active` with the selected root.

Tell the user that activated Git projects use reviewable local commits by default. Respect existing commit rules and any request to leave changes uncommitted. Activation does not authorize pushing or rewriting history.

After activation, use Projector on the current directive. Recover relevant existing meaning first. If no meaning exists, retain the user's actual intent when it helps the work. Let ordinary requests select the other skills. Do not require the user to invoke them or prepare JSON requests. Read [the reference guide](../../references/guide.md) when a runtime helper is useful.

For a disable request, run `node PLUGIN_ROOT/runtime/cli.mjs deactivate` at the active project root. This removes only the activation marker. Keep meaning, checkpoints, and recovery records. Stop Projector work in this session and continue ordinary native work. Disabling completes when the helper reports `inactive` for that root.

For a status request, run `node PLUGIN_ROOT/runtime/cli.mjs status` in the requested project and report its result. Global plugin enablement does not activate every project. An inactive project stays inactive until the user asks to enable it.
