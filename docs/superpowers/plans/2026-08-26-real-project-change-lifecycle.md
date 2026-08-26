# Real-project change lifecycle implementation plan

**Goal:** Prove one installed, held-out, non-fixture change through the public CLI and `$projector-change`, including explicit approval, interruption recovery, observed impact, reconciliation, and a certificate.

**Architecture:** A CLI-owned `RepositoryChangeLifecycle` composes existing semantic, runtime, and evidence machinery. A proposal interpreter supplies authenticated structured facts for arbitrary prose; an exact-text transform performs only journaled, capability-authorized writes.

**Spec:** `docs/superpowers/specs/2026-08-26-real-project-change-lifecycle-design.md`

## Constraints

- `SemanticChange.id` is the only lifecycle identity and canonical semantics remain authoritative.
- The proposal is strict interpretation input, not a second spec or an arbitrary command surface.
- Preserve existing public commands and fixture compatibility until packed replacement evidence permits deletion.
- Keep MCP mutation unadvertised and GitHub Actions `workflow_dispatch` only.
- No tag, publish, release, or immutable external action.

### Task 1: Prove the generic exact patch primitive

**Files:**
- Add: `packages/runtime/src/transforms/exact-text-patch.test.ts`
- Add: `packages/runtime/src/transforms/exact-text-patch.ts`
- Modify: `packages/runtime/src/transforms/index.ts`
- Modify: `packages/runtime/src/index.ts`

- [x] Add RED tests for create/replace/delete, exact-before mismatch, scope denial, forbidden path, and out-of-transaction refusal.
- [x] Implement preview/apply through `TransformMutationPort` with compiled write authorization.
- [x] Run focused runtime tests, typecheck, and package-boundary checks.

### Task 2: Compile a real repository change

**Files:**
- Add: `packages/cli/src/change-lifecycle/proposal.ts`
- Add: `packages/cli/src/change-lifecycle/repository-observer.ts`
- Add: `packages/cli/src/change-lifecycle/compiler.ts`
- Add focused tests under `packages/cli/src/change-lifecycle/`

- [x] Add RED tests for arbitrary prose, strict proposal parsing, key/alias reuse, duplicate blocking, deterministic new IDs, engine-derived bounded non-authoritative deferral, blocking concern refusal, exact path preconditions, bounded relevance, negative-space binding, and unavailable analysis.
- [x] Keep this initial installed capability fail closed for every blocking concern; canonical-decision reuse is explicitly deferred instead of simulated.
- [x] Compile canonical Requirement/Scenario envelopes, semantic compiler facts, state binding, human representation, plan, packet, capsule, and immutable hashes using existing engine APIs.
- [x] Persist only authenticated operational links under `.projector/runtime/change-lifecycles/`.
- [x] Run focused CLI/engine tests and typechecks.

### Task 3: Add explicit approval and state-bound execution

**Files:**
- Add: `packages/cli/src/change-lifecycle/service.ts`
- Add: `packages/cli/src/change-lifecycle/store.ts`
- Add: `packages/cli/src/change-lifecycle/service.test.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/policy.ts`

- [x] Add RED tests for change/plan/approve/apply parsing and lifecycle results.
- [x] Prove proposal, representation, plan, capsule, approval, state, identity, write-scope, sandbox, and validator-provenance adversaries across their owning module tests.
- [x] Compose real lease, journal, exact patch transform, sandboxed Node tests, real observations, reconciliation, receipt, and certificate.
- [x] Require a Git-base-bound pre-existing validator outside all proposed edits as an independent evidence lane; treat proposal-authored tests as supplemental only.
- [x] Make canonical writes part of the same transaction and require explicit current R2 approval.
- [x] Make repeated committed apply idempotent.
- [x] Keep the legacy magic selector compatible while routing non-fixture selectors to the new service.

### Task 4: Prove interruption, recovery, and resume

**Files:**
- Modify: `packages/cli/src/change-lifecycle/service.ts`
- Modify: `packages/cli/src/cli.ts`
- Add focused crash/recovery integration tests

- [x] Make attempt and transaction IDs durable and unique.
- [x] Make `recover` acquire the writer lease before journal recovery.
- [x] Force a real child-process interruption during sandbox validation, recover the journal, and resume the same approval with a new attempt.
- [x] Prove active lease, stale takeover, third-state content, corrupt journal, and unavailable sandbox boundaries across runtime, lifecycle, and packed tests.

### Task 5: Install the truthful agent-facing workflow

**Files:**
- Modify: `plugins/projector/skills/projector-change/SKILL.md`
- Add: `plugins/projector/scripts/projector-change.mjs`
- Modify: `plugins/projector/scripts/projector-mcp.mjs`
- Modify: plugin manifest/version files
- Modify: `scripts/projector-plugin.test.ts`
- Modify: `scripts/build-release-package.mjs`

- [x] Teach `$projector-change` the one public lifecycle and material-question/approval boundaries.
- [x] Implement a thin deterministic capture/approval/resume script that shells only to the installed CLI, pauses at approval, and emits authenticated invocation/output trace entries.
- [x] Resolve the installed package without source-checkout fallback.
- [x] Bump the plugin version and prove the global Codex cache contains the new version and bytes.
- [x] Keep MCP operational tool advertisement and capability issuance unchanged.

### Task 6: Replace fixture acceptance with held-out packed proof

**Files:**
- Add or modify held-out acceptance fixtures/scripts under `scripts/`
- Modify: `scripts/run-release-acceptance.mjs`
- Modify: traceability generation and expected release evidence

- [x] Install the exact npm tarball plus plugin shell in a disposable repository with Projector source access severed.
- [x] Run the natural request directly through the CLI and through the source-severed installed `$projector-change` script; prove its approval pause, exact change/hash consumption, externally captured invocation transcript, and matching semantic/plan/approval/certificate identities.
- [x] Force `SIGKILL`, recover, resume, and prove exact predicted/observed impact plus fixed-point reconciliation.
- [x] Run all severance cases and prove no mandatory-fixture fallback.

### Task 7: Specify, document, cold-review, and land

**Files:**
- Modify applicable `PROJECTOR_SPEC/` modules only
- Add operator guidance
- Add successor handoff under `.temp/`
- Regenerate release traceability/evidence

- [x] Add normative lifecycle, proposal boundary, approval, observation, interruption/resume, installed-plugin, and held-out acceptance requirements.
- [ ] Independently review implementation against the modular specification and fix material findings test-first.
- [x] Evaluate legacy fixture lifecycle code. Retain it as an isolated compatibility lane because public acceptance and fourteen provenance/tamper adversaries still require it; packed lifecycle proof rejects fallback to it.
- [ ] Run full verify, build, spec check, release artifacts check, packed acceptance, and exact-revision manual GitHub Actions.
- [ ] Commit coherent slices and push the reviewed branch; do not publish or tag.
