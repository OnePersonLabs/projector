# Real-project readiness remediation implementation plan

**Spec:** `docs/superpowers/specs/2026-08-26-real-project-readiness-remediation-design.md`

**Authority:** `NORTH_STAR.md` and the modular `PROJECTOR_SPEC/` tree.

## Global constraints

- Work only on `architecture/real-project-readiness` in the linked architecture worktree.
- Use RED/GREEN tests for every behavior change and focused verification while iterating.
- Preserve manual-only GitHub Actions and keep MCP mutation unadvertised.
- Commit each coherent wave. Do not publish, tag, release, or merge.
- Treat the scoped package name and version `@onepersonlabs/projector@2.1.0` as one release identity.

## Task 1: Freeze authority and extract the control plane

- Update the applicable normative package, lifecycle, agent, recovery, and release requirements.
- Correct the older lifecycle design so it does not claim canonical-decision reuse in the initial capability.
- Add private `packages/control-plane` and move the repository lifecycle compiler, query programs, observer, store, executor, and service from CLI without changing behavior.
- Replace substring package-boundary assertions with TypeScript import-graph checks and curated export snapshots.
- Verify focused tests, typechecks, spec checks, and boundaries.
- Commit `refactor: extract projector control plane`.

## Task 2: Close lifecycle recovery and publication boundaries

- Add RED integration cases for unrelated root rebound, bound dependency staleness, certificate-success/receipt-failure recovery, cross-approval recovery isolation, incomplete-transaction admission blocking, and cancellation during validation.
- Use dependency-scoped binding validation.
- Add authenticated transaction-targeted recovery APIs and block new attempts while an incomplete governed transaction exists.
- Preserve a typed committed-unpublished attempt after post-commit publication failure; recover it idempotently from prepared success.
- Propagate abort signals through the public lifecycle.
- Commit `fix: close lifecycle recovery and publication boundaries`.

## Task 3: Converge on one public change lifecycle

- Export the strict proposal Zod contract, inferred type, and JSON Schema from core; generate the plugin proposal schema from it.
- Apply strict schemas to durable control-plane records.
- Delete the production fixture lifecycle, prefix routing, and fixture mutation implementation; migrate useful adversaries to testkit.
- Make CLI help, selectors, outcomes, and exit codes agree with the single lifecycle.
- Return real divergences from MCP.
- Replace the agent wrapper with stateless CLI pass-through commands and preserve structured output/exit codes.
- Commit `refactor: converge on one public change lifecycle`.

## Task 4: Replace release labels with executable evidence

- Build an explicit registry for all 17 release gates and their real experiments.
- Bind every normative release obligation to exact test identities and negative controls.
- Recompute packed evidence hashes from artifact bytes and reject self-reported proof.
- Use an independent Git-base desired-behavior oracle that fails before and passes after the change.
- Prove fixed point by rerunning reconciliation.
- Bind dogfood to the full manifest-addressed specification root.
- Commit `test: replace release labels with executable evidence`.

## Task 5: Establish scoped source-severed release artifacts

- Make version `2.1.0` coherent across package, CLI, plugin, MCP, manifests, and expected evidence.
- Build `@onepersonlabs/projector` once and verify the exact tarball.
- Keep the workflow `workflow_dispatch` only. Build/upload in one job and accept in a fresh no-checkout job.
- Delete the privileged namespace keeper and its `unshare`, `nsenter`, PID-polling, and teardown branches.
- Install the downloaded tarball/plugin in acceptance and upload the exact tested artifacts, transcript, evidence, and digests.
- Commit `build: establish scoped source-severed release artifacts`.

## Task 6: Review, repair, install, and land the campaign branch

- Run one independent comprehensive review against the acceptance matrix and exact commit range.
- Consolidate all material findings into one RED/GREEN repair commit and obtain targeted closure review.
- Run: `python3 PROJECTOR_SPEC/scripts/check_spec.py`, `pnpm verify`, `pnpm build`, `pnpm release:artifacts:check`, `pnpm release:acceptance`, and `git diff --check`.
- Install the exact scoped `2.1.0` tarball globally; remove the unrelated/stale global bare package.
- Refresh Codex with `codex plugin remove projector@personal` then `codex plugin add projector@personal --json`.
- Verify reported version `2.1.0`, physical cache directory `~/.codex/plugins/cache/personal/projector/2.1.0`, matching source/cache bytes, cached MCP handshake/tools, session hook, ordinary-repository behavior, and a fresh process with no old-cache dependency.
- Commit closure separately, push the campaign branch, run the exact-revision manual workflow, inspect uploaded artifacts, and write a successor handoff.

