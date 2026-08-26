# Real-project change lifecycle design

## Goal

Let an installed Projector package carry one held-out, non-Projector repository change from an arbitrary natural-language request to a state-bound specification, explicit approval, capability-proven execution, interruption recovery, reconciliation, and a truthful certificate. The public CLI and the installed `$projector-change` skill must drive the same lifecycle.

## Problem

The current `change`, `plan`, and `apply` surface is a convincing fixture, not a product path. It accepts one magic intent, synthesizes the misplaced-script facts and impact closure, wraps the real fixture transaction in a no-op packet transaction, fabricates observations, and invokes fixture validators. Packed acceptance also rediscoveries the Projector source checkout. A second fixture would increase apparent coverage without creating a reusable product.

Projector also cannot honestly turn unrestricted prose into code without an interpreter. The deterministic package must not hide a model dependency or encode request-specific prose rules. The public boundary therefore separates human intent from an authenticated structured proposal: an operator or agent interprets the request, while Projector owns validation, identity continuity, state binding, planning, approval, mutation, observation, recovery, and evidence.

## Product boundary

The first production lifecycle supports UTF-8 exact-content patches and Node test validation in a local Git repository. It is intentionally not a general code generator.

The public sequence is:

1. `projector change "<natural-language request>" --proposal <proposal.json>`
2. `projector plan <change-selector>`
3. `projector approve <plan-selector> --plan-hash <displayed-hash>`
4. `projector apply <approval-selector>`
5. after interruption, `projector recover`, then repeat step 4

`change` accepts arbitrary nonblank UTF-8 text as one argv value. The proposal is a versioned, strict JSON document containing:

- one or more requirement and behavioral-scenario proposals with stable keys;
- a response to a material architecture concern discovered from the requested facets and repository boundary;
- exact UTF-8 edits as repository-relative paths with expected before content or absence and desired after content or absence; and
- repository-relative Node test files. Projector chooses the executable and arguments. A proposal cannot nominate an arbitrary command, environment value, network access, or external write.

The proposal is authenticated by its canonical content hash and bound to the natural-language request. It is interpretation input, not a second semantic authority. The resulting `SemanticChange` and canonical Requirement/BehavioralScenario records are authoritative.

## One lifecycle identity

`SemanticChange.id` is the durable lifecycle identity. No parallel change-case aggregate is introduced. Operational records under `.projector/runtime/change-lifecycles/` link the proposal, identity resolutions, relevance closure, representation, plan, approval, attempts, journal records, observations, receipt, and certificate by authenticated IDs and hashes. Operational records are excluded from canonical semantic snapshots.

Requirement and scenario identity resolution searches the current canonical snapshot by stable ID, key, and alias. Exactly one match is reused; no match creates a deterministic ID from kind and key; multiple matches or a conflicting stable ID block with a material question. Every resolution includes the searched candidate set and canonical-root dependency. Canonical creation is refused if the bound search result is stale. This prevents a duplicate from appearing between capture and commit.

## State and relevance

A repository observer derives one `StateDigest` from Git base, no-exec file inventory, canonical root digest, and analyzer/toolchain versions. It excludes operational Projector state. The change binding includes:

- exact before hashes for every edited path;
- exact canonical envelopes reused or proposed by the change;
- analyzer versions;
- the canonical identity-search result; and
- an authenticated relevance query over edited units and known reverse dependants.

Existing edited files are mapped to analyzer projection units. New files receive deterministic proposed unit IDs. Known reverse dependants enter the exact affected set. Analyzer failures that intersect the requested boundary are recorded as unavailable surfaces and block when they prevent an exact write or identity claim. Negative-space query results are part of the binding, so a newly discovered dependant makes the plan stale.

This initial lifecycle may record a bounded deferral for a `material-soon` or `deferable` concern. It does not reuse or accept canonical ArchitectureDecisions. Decision reuse requires the canonical decision, authority, governance, validity, and consequence-compilation path and is outside this slice. Every `blocking-now` concern blocks.

A bounded deferral includes rationale, an explicit reconsideration condition, a validity horizon, preserved options, forbidden commitments, and at least one machine-enforceable forbidden write path. It is authenticated operational evidence, never affirmative architecture authority. Its consequences can only narrow the plan: they become assumptions, forbidden writes, independent validation obligations, unavailable actions, and a reconsideration query in the StateBinding. Architecture preflight derives concerns from supported change signals and repository evidence without using the proposal's model-inference lane. A proposal may omit an architecture response when no blocking concern is derived. A supplied response must exactly match one engine-derived key, title, question, and materiality. Preflight verifies a nonblocking bounded deferral, compiles its narrowing consequences, and blocks if the response is invented, mismatched, stale, contradicts an exact edit, or attempts to authorize a technology choice. A derived `blocking-now` concern requires a current canonical decision.

## Projection, planning, and approval

The existing semantic change compiler, human-technical `RepresentationCompiler`, and semantic plan compiler remain the canonical pipeline. The representation and preservation hashes are persisted and reverified before approval and execution.

The plan contains one deterministic `exact-text-patch` packet in this initial boundary. Its capsule permits only the exact proposed workspace and computed canonical paths. `.git/**` and operational Projector state are forbidden. Completion requires all declared Node tests, authoritative after-observation, zero out-of-scope writes, zero new relevant analyzer failures, reconciliation, certificate, and receipt.

`approve` requires the displayed immutable plan hash and current state. It persists a state-, plan-, packet-, capsule-, and representation-bound approval. `apply` accepts only that approval selector. This is explicit R2 authorization for the canonical requirement/scenario writes; it is not automatic mutation policy.

## Mutation and validation

Add a generic runtime `ExactTextPatchTransform`. Preview and apply both verify the exact before content/absence. Apply writes only through the active `FileTransaction`; canonical envelopes are ordinary exact writes in that same transaction. The transform evaluates the precompiled capsule authorization and repository path service before each operation.

The CLI composition owns one deep `RepositoryChangeLifecycle` service because it may depend on analyzer, engine, runtime, and integration packages. It composes:

- `WriterLeaseManager` and `GovernedWorktreeRuntime`;
- `FileTransactionJournal` with a unique content-addressed attempt/transaction ID;
- `StateBoundChangeExecutor`;
- `StateBoundCommandExecutor` with the capability-proven sandbox launcher;
- real before/after repository and canonical observations; and
- content-addressed operational lifecycle and artifact stores.

Node tests run read-only inside proven isolation with network denied, no inherited environment, bounded output, and a timeout. If no backend proves the required isolation, execution stops before mutation. Validation failure rolls the transaction back.

Validation has two provenance groups. Proposal-authored or proposal-modified tests are `change-author` evidence and may demonstrate local intent, but they never satisfy the independent vote. At least one `repository-independent` Node test must exist in the bound Git base before capture, remain outside every edit, and be selected in the explicit approval. Projector binds its Git identity and exact content hash, executes it separately, and rejects a certificate when the independent lane is absent, changed, skipped, or authored by the same change. The completion contract requires both the runtime exact-postcondition lane and this independent test lane; same-proposal tests are supplemental.

## Interruption, recovery, and resume

The attempt record is durable before transaction start and references the journal ID. A process loss can leave the journal incomplete. `recover` must acquire or take over the same writer lease before rolling an incomplete local transaction back; an active writer, third-state path, corrupt record, or pending external compensation fails closed.

After successful rollback, reapplying the same approval creates a new attempt and transaction ID, revalidates its state binding, and records `resumedFromAttemptId`. A committed attempt is idempotent: repeated apply returns its authenticated certificate and never reruns the patch. No transaction ID is reused.

## Observed impact and certificate

Before and after observations hash actual repository paths, canonical entities, analyzer unit states, and state digests. Claimed writes are not observations. Reconciliation compares predicted and observed paths and units, classifies additions as planning surprises, reruns relevant analysis to a fixed point, and emits a certificate and receipt linked to exact journal bytes. Success is impossible unless the journal commit, certificate, receipt, and final lifecycle checkpoint are durable and mutually authenticated.

## Agent-facing surface

The installed `$projector-change` skill is the single agent-facing mutation entry. It tells the agent to inspect the target repository, author the strict proposal, present only unresolved material questions, request human approval for the exact plan hash, and use recovery after interruption. It must not implement lifecycle semantics itself.

The plugin ships an executable, deterministic `$projector-change` orchestration script. The stateless script invokes only the installed public CLI and writes no repository trace or continuation. Its capture phase runs `change` and `plan`, returns the change identity and exact plan hash, and stops with `approval-required`. Its approval phase requires the human-supplied change identity and exact plan hash. Apply, recover, and resume pass the approval identity directly to the CLI and preserve its JSON and exit code. This thin shell has no semantic compiler, mutation implementation, or hidden fallback.

MCP remains read-only/status-only. No lifecycle mutation tool is advertised until the production service has an authenticated MCP handler and a separately approved capability issuance path.

The plugin launcher must resolve the installed npm package, not a Projector source checkout. Packed acceptance installs the exact npm tarball and plugin shell into a disposable held-out repository with source fallback severed.

## Acceptance

1. Arbitrary natural-language input is accepted without a magic selector or request-specific parser.
2. One `SemanticChange.id` links capture, representation, plan, approval, attempts, reconciliation, and certificate.
3. Requirement/scenario reuse and creation are deterministic; ambiguous or stale searches fail before canonical mutation.
4. Relevance includes edited units, known reverse dependants, bound negative space, and explicit unavailable surfaces.
5. The human-technical representation is state-bound, preservation-checked, and stale/tamper-resistant.
6. Approval authenticates the current immutable plan, packet, capsule, proposal, and representation.
7. Every workspace and canonical write passes exact preconditions, compiled capsule authorization, path containment, a writer lease, and the durable journal.
8. Validators run only through capability-proven, fail-closed isolation. Sandbox unavailability leaves the repository unchanged.
9. A real `SIGKILL` during validation is recovered and resumed with a new attempt; committed work is not repeated.
10. Predicted and observed impact come from real repository observations; reconciliation and certificate hashes authenticate the result.
11. A held-out TypeScript repository completes the installed packed CLI path without fixture fallback or Projector-source access.
12. A source-severed installed `$projector-change` script is actually invoked: it captures and plans, pauses at approval, consumes the exact approved hash, survives interruption, resumes, and produces the same semantic, plan, approval, and certificate hashes as direct CLI use. The acceptance harness records the invocation transcript outside the target repository.
13. MCP continues to advertise only operational handlers and issues no mutation capability.
14. Approval, state, proposal, identity, worktree, write-scope, sandbox, independent-validation, journal, and representation severance tests fail closed with actionable errors.
15. GitHub Actions remains manual-only.

## Authority

- [Projector north star](../../../NORTH_STAR.md)
- [Vision and north-star behavior](../../../PROJECTOR_SPEC/01-product/vision-and-north-star.md)
- [Semantic change pipeline](../../../PROJECTOR_SPEC/07-change/semantic-change-pipeline.md)
- [Transactions and certificates](../../../PROJECTOR_SPEC/07-change/transactions-and-certificates.md)
- [CLI modes and security](../../../PROJECTOR_SPEC/10-operation/cli-modes-and-security.md)
- [Release definition](../../../PROJECTOR_SPEC/12-delivery/release-and-directive.md)
