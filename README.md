# Projector

Projector keeps accepted product meaning, architectural decisions and their reasons with a software repository. Agents retrieve relevant meaning before changing code and reconcile retained context against later changes. Code and plans are revisable realizations; implementation discoveries can justify explicit revisions to the model.

## Use the installed plugin

The plugin runs independently of this checkout on native Windows and direct WSL. Install Node 24 through the host's normal PATH. Each host has its own plugin installation; Windows does not require a WSL bridge.

Projector has its own local `projector` marketplace rooted at this checkout. Use `$opl:refresh-local-plugins` to refresh both user-level Codex homes. Its helper runs this checkout's `plugin:prepare-local` package script before comparing or installing bundles, so compilation and standalone bundle assembly happen as part of refresh. A failed build stops installation. The OPL push/pull hook directs the agent to this same skill after successful Git operations. The helper registers the marketplace when needed and verifies installed hook trust; start a fresh Codex session to load updated components. For direct CLI installation, first run `pnpm plugin:prepare-local`, then `codex plugin marketplace add .` and `codex plugin add projector@projector`. Installation does not establish that a project is initialized or that its checks pass.

The installed `projector` skill's `operation-contract.md` describes the versioned request protocol and locates its sibling `../../scripts/projector-operation.mjs`. Invoke that runner with `node`, passing one UTF-8 JSON request file or the same object on standard input. For example, the context request for this repository is:

```json
{
  "apiVersion": "projector.operation/v1",
  "operation": "context",
  "repositoryRoot": "C:/dev/projects/projector",
  "requestId": "next-change",
  "input": {
    "request": "Retrieve the accepted behavior and architecture for the next change",
    "persist": true
  }
}
```

Use the absolute root of the intended project. Read returned readiness, operation status and operation-owned output separately. Candidate matches are hypotheses; inspect applicable meaning, unknowns and disclosure bounds before relying on them. Retain the context ID and reconcile it before reuse. A stale binding, a violated predicate and an unavailable check are different results.

| Need | Operations |
| --- | --- |
| Inspect readiness; initialize or upgrade an authorized project | `status`, `init` |
| Retrieve meaning; check saved reasoning | `context`, `reconcile` |
| Establish or revise accepted meaning; inspect the exact proposed change | `change.capture`, `change.plan`, `representation.inspect` |
| Authorize and execute a reviewed immutable plan | `change.approve`, `change.apply` |
| Continue interrupted work or refresh a historical representation | `change.recover`, `change.resume`, `representation.reconcile` |
| Inspect unresolved obligations and bounded continuation | `coverage`, `complete`, `cleanup` |
| Check supported operational behavior | `verify` |
| Observe the supported Psychord application workflow | `application.observe` |

Inspection grants no execution authority. An approval binds the exact reviewed plan and required state. Ordinary authorized host edits can implement existing meaning without replaying those edits through a second execution; reconcile their affected context and check the changed behavior. A successful controlled apply requires `output.outcome` to indicate success, not merely a successful transport status.

## Project data and recovery

Commit `.projector/config.toml`, typed `.projector/model/` records, architecture and applicable schemas. Core executable schemas own exact machine shapes. Authored TOML needs no hand-maintained fingerprints; semantic reuse follows parsed meaning, while reviewed writes, validators and recovery retain exact-byte checks.

`init` prepares recognized older data through authenticated migration steps. One pre-upgrade backup preserves the starting Projector data, including uncommitted changes, across the whole upgrade chain. Keep it for recovery. Commit a successful upgrade together; do not replace its backup after every migration version. When an operation reports recovery required, follow its registered recovery action before starting another conflicting write. Do not delete unfinished runtime journals or edit migration receipts by hand. An incompatible old process may need to stop and restart.

Local `.projector/runtime/` contains derived state, retained context and execution/application observations. A clone can reconstruct from accepted meaning but cannot reuse uncopied local IDs or observations. Missing evidence remains unavailable. Back up personal application data independently; a Projector metadata upgrade does not migrate browser storage or a music archive.

## Development and release

Use `pnpm install --frozen-lockfile`, `pnpm build`, and the relevant checks. `pnpm verify` is the integrated test/type/boundary gate. `pnpm release:artifacts` regenerates release traceability from canonical owners and test bindings; `pnpm release:acceptance` exercises the packaged runtime, installed lifecycle, direct representation checks, benchmarks and reconstruction. Stage the intended deletions before running that worktree-bound release check.

Build a standalone candidate with `node scripts/build-source-severed-release-bundle.mjs` followed by an absolute output directory ending in `release-candidate`. Its package, plugin and acceptance runner travel together. The manual CI workflow uses the same candidate in separate Windows and Linux jobs. Release and registry publication are separate actions; these commands do not publish to a registry.

Verify concrete behavior and consequential failures. Reuse checks whose dependencies are unchanged. Independent review belongs at consequential integration boundaries; new reports, transcript parsers and repeated certificates are not ordinary development requirements.

## Current limits

This is cooperative integrity under the host's permissions, not operating-system confinement or protection from hostile same-user code. Native CPU/memory limit enforcement is unavailable. Dynamic/runtime dependencies and open relevance populations can remain unknown. General autonomous research, repair selection, modernization, multi-packet orchestration and arbitrary application adapters are not established public workflows; accepted future commitments retain their own reopening conditions.

The Psychord adapter observes browser/controller behavior with owned setup and cleanup. It does not prove acoustic output, device routing, latency, learning or mastery. Fidelity checks and hashes do not establish arbitrary semantic equivalence, agent understanding or economic superiority. The next implementation should use the model's relevant requirements and actual observations, preserving these limits.
