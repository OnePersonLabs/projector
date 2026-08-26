# Capsule write authorization implementation plan

**Goal:** Replace divergent operation/path authorization with one fail-closed core contract used at every mutation boundary.

**Architecture:** Compile capsule grants into serializable core data, evaluate observed paths with the same pure core matcher, and leave real filesystem containment in runtime ports.

**Spec:** `docs/superpowers/specs/2026-08-26-capsule-write-authorization-design.md`

## Constraints

- Preserve persisted capsule and session shapes.
- Do not broaden the supported mutation-selector algebra implicitly.
- Do not move filesystem or host composition into core.
- GitHub Actions remains `workflow_dispatch` only.

### Task 1: Prove the core contract

**Files:**
- Add: `packages/core/src/authorization/write-scope.test.ts`
- Add: `packages/core/src/authorization/write-scope.ts`
- Modify: `packages/core/src/index.ts`

- [ ] Add RED tests for exact/glob matches, conjunction, operation mismatch, forbidden precedence, global forbid, malformed paths, and unsupported selectors.
- [ ] Implement deterministic path/pattern normalization, canonical glob matching, compilation, and authorization.
- [ ] Run focused core tests and typecheck.

### Task 2: Replace local interpretations

**Files:**
- Modify: `packages/engine/src/governance/selectors.ts`
- Modify: `packages/engine/src/change/index.ts`
- Modify: `packages/runtime/src/transforms/index.ts`
- Modify: `packages/runtime/src/execution/packet-coordinator.ts`
- Modify: `packages/cli/src/host-cli.ts`
- Modify: focused tests in those packages

- [ ] Make governance delegate canonical glob matching to core.
- [ ] Make change preflight compile and pass the core authorization object.
- [ ] Make deterministic transforms, packet observation checks, and host observation checks authorize with the core object.
- [ ] Add wrong-operation, forbidden-write, unsupported-selector, and rollback regressions.
- [ ] Run focused tests, typecheck, and package-boundary checks.

### Task 3: Specify, verify, and land

**Files:**
- Modify: `PROJECTOR_SPEC/05-projections/execution-capsules.md`
- Modify: `PROJECTOR_SPEC/07-change/transactions-and-certificates.md`
- Modify: affected traceability/evidence fixtures if required

- [ ] Add normative single-semantics, fail-closed, forbidden-precedence, and observed-write requirements.
- [ ] Run continuity review and fix material findings test-first.
- [ ] Run `pnpm verify && pnpm build && pnpm release:artifacts:check && pnpm release:acceptance && git diff --check`.
- [ ] Commit the slice independently and run packed acceptance against the committed revision.
