# Projector agent instructions

Before choosing edit paths for product, architecture, feature, or cleanup work, run `node packages/cli/dist/cli.js context "<requested outcome>" --compact --format json` and inspect the relevant meaning, architectural obligations, and unknowns. Build with Node 24 and `pnpm build` if the CLI is absent. Use `--entity <id-or-key>` only after selecting an existing meaning. Omit `--compact` when the full dependency proof is needed.

Keep the returned context ID. Before reusing it in another session, and after edits made outside Projector, run `node packages/cli/dist/cli.js reconcile <context-id> --format json`. Distinguish stale reasoning from a violated predicate. Refresh affected context when its dependencies changed.

Accepted product meaning lives in typed `.projector/model/` records; executable architecture lives in `.projector/lenses/`, `.projector/decisions/`, and `.projector/authorities/`. When the CLI cannot run, inspect those records directly and state the limitation. Treat every record as a claim to check against the user's intent and current evidence. A stored status, generated report, or passing self-authored test is not proof of implementation or economic advantage.

`PROJECTOR_SPEC/` is historical design evidence and supports legacy contract generation. Consult specific modules when needed to recover a missing rationale; do not revive its old delivery plans or treat its entire contents as current authority. Preserve provenance when revising canonical meaning. Do not add `ChangeCase` or another parallel workflow store.
