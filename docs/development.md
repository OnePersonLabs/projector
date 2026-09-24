# Development and local installation

This page is for the agent preparing Projector. Normal users invoke skills.

## Build and check

Use Node 24.19.0. OpenSpec 1.13.1 is bundled through locked dependencies.

```powershell
npm ci
npm run check
```

Tests use real Git worktrees and installed MCP clients. Build before installed tests because the package ships compiled runtime files.

## Local plugin installation

1. Build and check the checkout.
2. Run `node dist/host/cli.js install <fresh-external-package-directory>`. The destination must be empty and outside the checkout.
3. Create or update a local marketplace entry pointing to that complete package. Preserve other entries. Do not register the unbuilt plugin source directory.
4. Register new marketplaces with `codex plugin marketplace add <marketplace-root> --json`. Keep the identity of an existing Projector marketplace.
5. Run `codex plugin add projector@<marketplace-name> --json`. Codex owns its cache writes.
6. Verify skill discovery and MCP startup in a fresh actual Codex host; exercise installed initialization. Record the returned version and cache path.

See the [official package documentation](https://developers.openai.com/plugins/build/plugins). Installed CLI help and actual results establish the local client's supported commands and cache layout.

## Updating an active owner

Version mismatches are rejected. Settle active operations and release clients before replacing an active owner. Use the old installed authenticated client to send the shutdown operation; let the new client start the updated owner. Do not kill unidentified processes or change the production port to bypass a conflict.

For isolated tests, use a separate `PROJECTOR_HOME` and free `PROJECTOR_PORT`.

## Internal tools

`initProject({root})` creates missing scaffolding and returns `ready`, `created`, and `conflicts`. Conflicting schemas return `ready: false` without writing scaffolding. Existing config remains; new changes explicitly select Projector.

`syncChange({root,change})` materializes the exact target in the candidate without archive/publication. Later revisions invalidate affected evidence.

MCP is preferred. The equivalent internal CLI accepts `<operation> --json <request-object>`; users need not run it.
