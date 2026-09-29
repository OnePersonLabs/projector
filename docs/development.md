# Development

This guide is for contributors changing Projector itself. Repository-wide implementation conventions live in the root `AGENTS.md`; workflow instructions live beside their owning skill under `plugins/projector-v3/skills/`.

## Requirements

Use Node 24 or later and the package manager pinned in `package.json` (`pnpm@10.30.0`). Install dependencies with the workspace package manager.

## Build and checks

- `pnpm build` compiles workspace packages.
- `pnpm typecheck` runs package type checks.
- `pnpm test` runs Vitest.
- `pnpm check:boundaries` checks package boundaries.
- `pnpm spec:check` runs the advisory technical prose check.
- `pnpm verify` runs type checks, tests, package boundaries, and the prose check.
- `pnpm release:check` builds and exercises the installed distribution in a fresh repository.

Use `pnpm verify` for the full repository check after a broad change. Use `pnpm release:check` when the installed package or plugin behavior changes. Keep its generated evidence in the configured output location and use a fresh output path for another run.

## Source boundaries

Core owns contracts and schemas. The control plane composes domain services; runtime owns persistence and native interactions; the CLI exposes the public operation runner. The bundled plugin routes skill invocations to supported operations. Check package ownership before adding a cross-layer dependency.

Canonical records under `.projector/` are the source of accepted meaning. Runtime receipts and journals are evidence and must not be turned into a second authored source. Keep proposal schemas generated from their owner and use the repository's existing checks when changing contracts.

## Documentation changes

Check behavior against source, tests, generated contracts, and installed workflow evidence. Use exact existing identifiers and invocation forms. The prose checks are advisory; review their findings in context. See the [documentation guide](documentation-guide.md) for page roles, stories, diagrams, and link conventions.

## Experiments

The [architecture reasoning workflow trial](experiments/architecture-reasoning-trial-2026-09-29.md) records the paired Psychord-source evaluation used to reject an expensive default reasoning procedure. Keep experiment claims scoped to their fixture, evaluator, and declared adoption rule.

Continue with the [CLI reference](reference/cli.md) for the public interface or return to the [documentation home](README.md).
