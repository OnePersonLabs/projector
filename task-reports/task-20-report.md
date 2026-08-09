# Task 20 — release acceptance

## Result

Task 20 acceptance/publication is implemented on `codex/projector-t20`. The packed source-free install imports all 12 exports, strictly compiles their declarations, exercises the installed public workflow and fake/local integrations, verifies independent rebuild/locality, and publishes atomic content-addressed release evidence. No semantic engine or live adapter was added.

## Acceptance matrix

- Derives the authoritative 59 scenario / 27 property / 32 adversary identities from specification headings. Every mapping binds an existing public facade and exact source anchor.
- Runs mapped Vitest files and binds each entry to a recomputed suite artifact containing its exact identity, assertion statuses, output hash, and artifact hash. Forged hashes, failures, absent anchors, relabeling, duplicates, and stale sources fail closed.
- Generates all 17 benchmark gates from content-bound held-out, mutation, and structural-variant executions. The evaluator derives aggregates from raw samples and requires all three immutable fixture classes.
- Independently parses raw canonical fixture bytes under the declared schema/runtime lane and recomputes semantic identity/digest. An identical wrong clean/incremental digest is contradicted.
- Clean and incremental stores run in separate roots/processes across model, rule, lens, authority, exception, migration, decision, and representation families; incremental recomputation remains local.
- Canonical scanning explicitly excludes authenticated operational namespaces (`runtime`, task16 selections, task17 journals/sessions/capabilities, task18 upgrades, telemetry, watch) while retaining fail-closed treatment of other JSON. The installed lifecycle runs init again after upgrade, host, and MCP artifacts exist.
- Packed production install imports all 12 exports, compiles a strict NodeNext consumer, and runs init/audit/explain/change/plan/apply/reconcile/verify plus coverage, complete, upgrade, fake-host run, MCP transport, CI, watch, and recover.
- Durable evidence binds revision/worktree/build/tarball/raw artifacts, traceability, full benchmark results, conformance, and non-waiving deviations; current-pointer replacement and failure invalidation are atomic.

## Verification

- Focused RED: four public groups failed for unauthenticated test evidence, self-shaped benchmark inputs, shared-wrong semantic results, and task17/task18 operational artifacts.
- Focused GREEN: 3 files / 29 tests; testkit and runtime typechecks; diff check.
- Packed acceptance GREEN with 59/27/32 inventory, 12 exports, 19 public workflow/command steps, plus post-lifecycle init.
- Frozen gate: `pnpm verify && pnpm build && pnpm release:artifacts:check && pnpm release:acceptance && git diff --check`.
- Frozen result: 72 files / 645 tests; all seven package typechecks/builds; dependency boundaries, artifact drift, packed acceptance, and diff check passed.
- Tarball: `sha256:v1:fc4934593391f3d0c73368848d16be1c875d82ea134214a13875c024a078206a`.
- Evidence: `sha256:v1:b98e70a6d9b6b0bb2ddb391451a4bb440cc93a4047500037c1b3be287bd85f08`.

## Residual

Only the planned Task 21 live-adapter deferral remains; it waives no gate. Fake/local resources only.

## Final authority closure

- Traceability authority now consumes and independently parses raw Vitest JSON reporter output; the public artifact-construction/self-rehash path was removed. Exact file, suite/full name, status, source, and complete passing run are bound into evidence.
- Benchmark manifests now hash the immutable fixture bytes themselves. Gate evidence carries those bytes and samples, and the evaluator reparses/recomputes fixture hashes, sample hashes, numerators, denominators, and required held-out/mutation/structural participation. Detached favorable sample maps fail.
- Focused: 2 files / 7 tests plus testkit typecheck and diff check passed. Packed and frozen gates passed again at 72 files / 645 tests, all builds/boundaries/artifact checks.
- Final tarball: `sha256:v1:b2d923e7bcc5dd48a302ae2d7b03706cb0b47d4012050f294a05d78364c2af70`; evidence: `sha256:v1:180f5bdefb5b9d140d207865c245201c74395754d8b7d45393d1656f2299ecfb`.

## Root authority closure

Removed every exported result-construction/evaluation input. Traceability now accepts only immutable manifest/inventory plus repository root, spawns the pinned mapped Vitest command itself, and binds/persists its raw reporter output. Benchmark authority is a release-only root executable: it creates fixed-seed held-out/mutation/structural repositories, invokes the real analyzer twice, derives all 17 gates from those observations, and persists raw analyzer outputs. Testkit retains definitions only; dependency boundaries remain unchanged. Fabricated inputs are rejected before execution and malformed analyzed behavior changes a protected gate.

Focused 3 files / 6 tests and package boundary passed. Frozen gate: 73 files / 644 tests, all typechecks/builds/boundaries/artifact checks/packed acceptance/diff passed. Final tarball `sha256:v1:da2bfdd30fea3e456e37afb73603a7e9b2fe02255f4356b05511847db181c8bb`; evidence `sha256:v1:41705707e2dceea9dd3b818a302f8b18872c5930317a36a25c2f9f9e3c63a5f6`.

## Final exact closure verification — FAIL (`21134a5..f322c56`)

The independent raw-byte oracle now rejects an identical shared-wrong semantic digest, the scanner excludes the three exact Task17/18 operational namespaces, and packed acceptance succeeds through post-host/MCP/upgrade `init` (59/27/32, 12 exports, 19 commands; evidence `sha256:v1:b1cc7e62207dab629bd789aef5535ff7d5b561545a2ba26ba619eb5a4a30c77a`). Focused 29 tests and affected typechecks pass. Two exact material blockers remain:

1. Traceability artifacts are still caller-rehashable rather than bound to the executed Vitest JSON. Using the exported `createTraceabilityTestArtifact`, fabricated passing assertions for all nine manifest refs were recomputed and accepted by `verifyTraceabilityManifest` (`FABRICATED_REHASH_ACCEPTED true`) without any test execution. Thus the 59/27/32 release proof can still be certified by caller-shaped results.
2. Benchmark fixture hashes authenticate only fixture IDs/classes, not the samples attributed to them. Using the exported manifest/metric APIs, arbitrary favorable samples attached to nominal held-out, mutation, and structural fixture hashes produced `CALLER_SHAPED_17_ACCEPTED true 17 0`. The packed runner likewise reuses one partly hard-coded sample map for all three fixture classes, so the required generated held-out/mutation observations are not content-bound and can falsely pass release.

## Absolute final authority verification — FAIL (`f322c56..41e023b`)

Focused 7 tests, testkit typecheck, diff check, and packed acceptance pass (59/27/32, 12 exports, 19 commands; evidence `sha256:v1:860c8a5c797cd89364098ae7fb0ab58742e1c33c45b4e60b1e162d74d58b4236`), but both exact self-authentication gaps remain under replacement inputs:

1. Removing `createTraceabilityTestArtifact` does not make reporter output trusted. A caller-authored JSON string claiming complete passing Vitest results for the nine mapped suites was accepted by `verifyTraceabilityManifest` without execution (`FABRICATED_RAW_REPORTER_ACCEPTED true`). The verifier hashes the supplied claim but has no runner-issued/raw-artifact binding, so fabricated 59/27/32 proof remains possible.
2. Fixture bytes now hash their embedded samples, but the samples are not recomputed from the embedded execution artifact. Caller-created bytes containing `observed:false`, a failing artifact exit code, and favorable samples passed every exported gate (`CALLER_SHAPED_BYTES_17_ACCEPTED true 17 0`). The packed runner similarly serializes the same partly hard-coded sample map beside each held-out/mutation/structural artifact rather than deriving class-specific measurements from those artifacts. Content-addressing a claim does not authenticate the claimed observation.

## Root-cause exact closure verification — PASS (`41e023b..7f6536d`)

Both authority gaps are closed at their root. The built `projector/testkit` export contains no reporter/artifact constructor or benchmark fixture/sample/evaluator authority; caller reporter fields are rejected before execution. Trace verification now launches the repository's mapped Vitest executable itself and binds its direct JSON output. Benchmark authority is confined to the root release executable, creates its own fixed-seed held-out/mutation/structural repositories, runs the public analyzer twice, and derives the 17 measurements from those analyzer results; its malicious malformed-artifact sibling changes a protected gate and makes release fail. The exact hostile channels no longer exist (`FORBIDDEN_PUBLIC_EXPORTS []`; fabricated reporter rejected), package boundaries remain valid, focused 3 files / 6 tests and testkit typecheck pass, and packed acceptance returns 59/27/32, 12 exports, and 19 commands with evidence `sha256:v1:9ca35cbee8756e675df0be538b5155759de8c0c8b1d55fbcf3a5bc2f3657917a`. Frozen 644/build remains relied upon.
