# Projector 3

Projector keeps a project's intended behavior and the reasons behind its design
available to Codex across changes and fresh sessions. It connects those records
to source queries and typed relationships, so a changed assumption or a new
consumer can bring the right obligation back into view.

The everyday loop is **retrieve relevant meaning → change with Codex → check
affected meaning and behavior**. Normal edits use Codex's tools. Projector does
not create another task queue or require a controlled execution for every edit.

## Use it

Install the Projector plugin and use Node 24 or later on the host PATH. The bundled
package exposes the `projector` command. The plugin also exposes the same commands
through `node <plugin>/scripts/projector.mjs`.

Ask Codex: “Use $projector to understand this project and help me make this change.”
The owning skills supply the workflow; you do not need to write proposal JSON.

| Command | Purpose |
|---|---|
| `projector init` | Prepare a fresh project's model and local runtime. |
| `projector context "task" --target src/path` | Retrieve applicable meaning, reasons, evidence and open questions. |
| `projector check CONTEXT` | Recheck the checkout and the dependencies of retained context. |
| `projector accept proposal.json --context CONTEXT` | Preview new or revised accepted meaning. Codex prepares the proposal. |
| `projector accept --apply CHANGE --hash HASH` | Apply exactly the reviewed, currently valid plan. |
| `projector resume CONTEXT` | Inspect and recover context in a fresh session, without applying work. |
| `projector inspect ID` | Read a canonical record or retained execution detail. |
| `projector recover APPROVAL` | Explicitly recover an interrupted controlled write. |

Use `--entity ID` to name an exact obligation, `--root PATH` for another checkout,
and `--json` for machine detail. Resume also accepts an actual change or approval
ID. It never guesses “latest,” renews authority or silently retries changes.

## Read the model

Start with [.projector/README.md](.projector/README.md) for Projector's own model.
Concepts, requirements, scenarios, concerns, decisions and their rationale use
Markdown. Their small TOML metadata identifies the record and its scope and
links. Relations and executable policies remain structured TOML. There is one
authored source for each record; hashes are derived, not hand-maintained.

An identity survives renaming a file. A wording change does not itself prove
that two concepts are equivalent. Codex should reuse an existing owner or state
the boundary for a new one. Keep conditions, exceptions and reasons that could
change a future decision. Plain technical English is the default.

Commit the canonical model and configuration. Receipts, retained contexts and
recovery journals live under `.projector/runtime/` and stay off the normal reading
path. Preserve unfinished recovery evidence. Projector 3 has one supported
artifact format; an older repository needs a checked cutover, not an automatic
chain of package-version migrations.

## What a check establishes

A context packet includes complete selected meaning and states what was omitted
or unavailable. Reconciliation distinguishes stale assumptions and new query
members from observed violations. It preserves conclusions whose dependencies
did not change. A successful command does not prove that the design is complete
or that the implementation behaves correctly.

Use $projector-review on an actual candidate diff. It traces producers, storage,
consumers, registration and tests, and supplies concrete failure cases. Run the
relevant behavior checks as well. Application-specific evidence comes through a
host-supplied generic interface; a hash does not prove a claim true.

## Develop and verify Projector

Use the package manager declared by the workspace for developer installs.

`pnpm build` compiles the packages. `pnpm verify` runs type checks, tests, package
boundaries and the advisory prose check. `pnpm release:check` builds and exercises
the installed distribution in a fresh repository. Keep its output as evidence;
use a fresh output path for another run.
