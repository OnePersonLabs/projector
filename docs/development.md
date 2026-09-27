# Development and local installation

This page is for contributors and the agent preparing a local Projector package. Normal use starts with [skill invocations](skills.md).

## Build and check

Use Node 24.19.0. OpenSpec 1.13.1 is bundled through locked dependencies.

```powershell
npm ci
npm run check
```

The combined check builds TypeScript, runs ESLint, and executes the acceptance tests. Tests use real Git worktrees and installed MCP clients. Build before installed tests because the package ships compiled runtime files.

Runtime modules cover documents, indexing, the observation kernel, change lifecycle, and host transport. The application being changed does not import Projector. Exact interfaces and supported source behavior are in the [runtime reference](reference/runtime.md).

For documentation-only work, inspect content and run bounded link, anchor, invocation, and diagram checks. The [documentation guide](documentation-guide.md) describes editorial acceptance.

## Focused checks and complete impact

Use the [canonical verification procedure](../plugins/projector/skills/verify/SKILL.md) with the context that matches the work. Normal development uses repository commands and evidence notes. A prepared change uses its retained candidate and evidence APIs. Branch integration uses the pinned target-to-integration difference and normal commands; `$projector:merge` owns publication. Planning does not require a prepared checkout, but complete artifacts still need strict validation.

Select focused tests from the affected behavior, preserved invariants, boundaries, and dependencies. Run exact files directly with Node. Put Node options before file paths:

```powershell
node --test --test-concurrency=2 test/change.test.ts test/change-recovery.test.ts
node --test --test-concurrency=2 --test-name-pattern="selected test name" test/change.test.ts
```

Replace the name pattern with the actual intended test name. Inspect the output to confirm that every expected named test executed. A no-match name filter can exit with status zero and report a passing file without executing the intended test. That result does not satisfy the selected obligation. Widen the selection when names or dependency coverage are uncertain.

`npm test -- test/change.test.ts` does not narrow this repository's test glob. The npm script already supplies `test/**/*.test.ts`; appended arguments do not replace it. Use the direct commands above for focused execution. Build before checks that consume compiled runtime files.

At the final checkpoint, compare against the actual selected baseline, rather than only the last commit or the unstaged patch:

```powershell
git diff --name-status --find-renames <baseline> --
git ls-files --others --exclude-standard
```

Replace `<baseline>` with the pinned commit for the work. The first command includes committed, staged, and unstaged tracked differences from that baseline. The second identifies untracked files for separate inspection. Inspect the corresponding complete contents and diff, including renames, shared setup, configuration, and hook writes. Deduplicate checks with demonstrated overlapping coverage and widen uncertain selections. Do not discard unrelated work when assessing impact.

Focused checks do not replace required full or release checks, hooks, or review. Use these repository backstops when the change requires full qualification:

```powershell
npm run check
npx openspec validate --all --strict --json
```

The local locked dependency supplies OpenSpec; no global installation is required. Record commands, cases that executed, actual status, evidence locations, pre-existing failures, unexecuted checks, and remaining uncertainty. Reuse prior results only when their relevant code, inputs, configuration, environment, services, and coverage still match.

## Local plugin installation

1. Build and check the checkout.
2. Run `node dist/host/cli.js install <fresh-external-package-directory>`. The destination must be empty and outside the checkout.
3. Create or update a local marketplace entry pointing to that complete package. Preserve other entries. Do not register the unbuilt plugin source directory.
4. Register new marketplaces with `codex plugin marketplace add <marketplace-root> --json`. Keep the identity of an existing Projector marketplace.
5. Run `codex plugin add projector@<marketplace-name> --json`. Codex owns its cache writes.
6. Verify skill discovery and MCP startup in a fresh actual Codex host; exercise installed initialization. Record the returned version and cache path.

The angle-bracket arguments identify local destinations and marketplace identities selected during installation. Replace them with the actual selected values. See the [official package documentation](https://developers.openai.com/plugins/build/plugins). Installed CLI help and actual results establish the local client's supported commands and cache layout.

A user can authorize this procedure in ordinary language, as shown in [getting started](getting-started.md#install-the-plugin). The user does not need to operate the terminal.

## Updating an active owner

Version mismatches are rejected. Settle active operations and release clients before replacing an active owner. Use the old installed authenticated client to send the shutdown operation; let the new client start the updated owner. Do not kill unidentified processes or change the production port to bypass a conflict.

For isolated checks, use a separate `PROJECTOR_HOME` and a free `PROJECTOR_PORT`. These isolate state and endpoint identity from normal user operations.

## Internal tools

`initProject({root})` creates missing scaffolding and returns `ready`, `created`, and `conflicts`. Conflicting schemas return `ready: false` without writing scaffolding. Existing configuration remains; new changes explicitly select Projector.

`syncChange({root,change})` materializes the exact target in the candidate without archive or publication. Later revisions invalidate affected evidence.

MCP is preferred. The equivalent internal CLI accepts `<operation> --json <request-object>`. Users normally express the request through a skill.

Qualification is versioned evidence. [Workflow qualification](qualification-workflow.md) records lifecycle and integration checks; the [documentation home](README.md#evidence) links the full evidence set.
