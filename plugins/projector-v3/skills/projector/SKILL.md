---
name: projector
description: Develop software through a readable model of its concepts, requirements and decisions. Initialize Projector, explore an idea, plan in Codex Plan mode, or implement a feature or fix with model updates, code and verification handled together.
---

# Projector

Use `node <plugin>/scripts/projector.mjs` as `projector` below. Resolve `<plugin>` from this skill directory. The command requires Node 24 or later and no repository package-manager command. Set `--root <absolute repository>` when the target differs from the current directory.

Use this skill to initialize Projector on request or to work in a repository that already has `.projector/config.toml`. When activation is requested and execution is authorized outside Plan mode, run `projector init` before retrieving context. Installation alone does not authorize activation. The readable canonical Markdown under `.projector` owns accepted intent; TOML holds identities and typed bindings. Independent relations and policies remain TOML. Code, plans, retrieved candidates and assimilation notes are evidence to assess against accepted intent. If Projector is unavailable, read canonical Markdown directly and state the missing assurance.

## Understand the task and model

For an active repository, run `projector context "the requested outcome"`. Add `--entity` for known relevant IDs and `--target` for current source paths. Read the selected whole sections, typed relationships, rationale, evidence, unknowns, selection reasons and unresolved frontiers. A retrieval candidate does not establish identity or applicability. Resolve omitted obligations or open queries with focused context or `inspect`. Retain the context ID. For a concrete question, inspect the model and current source without accepting meaning or editing code.

When planning activation of an inactive repository, inspect its current files and propose setup and initial model artifacts. There is no accepted Projector meaning to retrieve yet. Keep initialization and canonical capture unexecuted until authorized execution outside Plan mode.

Use the context to map affected concepts, requirements, scenarios, relationships and decisions to the actual code. Follow current producers, consumers, persistence, registration and tests. Determine whether the task changes intended meaning or repairs behavior while preserving it. Reuse an existing identity when it owns the intended meaning. Similar wording is only a candidate. A new boundary needs inspected nearest meanings; a split, merge or retirement needs lineage.

## Plan a change

Keep questions and requests to discuss or plan read-only even when the host permits execution. Execution mode alone does not authorize model or code changes.

In native Codex Plan mode, propose concrete model artifact changes before execution. For each affected concept, requirement, scenario, relationship or decision, show its identity, canonical path, proposed content and reason. Show the implementation consequences, preserved commitments, assumptions and unresolved choices. Discuss and revise the proposal in Plan mode. Do not capture or accept canonical meaning or edit application code in Plan mode. `projector accept proposal.json` is a lifecycle capture and plan operation that mutates the capture store, even when used only for its preview; reserve it for execution after authorization.

For a plan revision, compare with the prior plan and account for every still-applicable model, implementation and verification commitment. Preserve future commitments outside the requested implementation scope. A model-only change can preserve a future capability before code exists; name its unimplemented status. A behavior repair can leave accepted meaning unchanged. On leaving native Plan mode, revalidate model identities, hashes and dependencies against current state. The chat plan records intent; it is not a retained Projector approval.

## Carry out authorized work

An authorized implementation task carries the model update, code changes and verification together. Carry existing authorization forward. Ask only about a material unresolved choice or irreversible action beyond it. Do not require a second manual implement prompt or skill invocation. If intended meaning changes, prepare a proposal with [the strict proposal guide](../../references/proposal-schema.md) and [generated schema](../../references/change-proposal.schema.json). Reuse current identities and hashes, or establish a reviewed boundary and lineage. Core validates the proposal. Capture and preview it with `projector accept proposal.json --context <context ID> --request "reason"`. Inspect the changed meaning, scope, affected obligations and unresolved questions. The preview creates capture state; it does not accept meaning. When the exact preview matches the authorization, run `projector accept --apply <change ID> --hash <reviewed hash>`. Read the operation-specific outcome and reasons. An approval binds one exact current plan; changed proposals or dependencies require a new preview. Acceptance creates an obligation, not proof of runtime behavior.

Conditional architectural rationale must retain the assumptions, alternatives, consequences and reconsideration condition that affect later choices. Establish a blocking architectural decision with its constraint or lens products in the same transaction. A bounded deferral states what remains forbidden and when to reconsider; it does not accept the deferred choice.

Implement the authorized scope with ordinary Codex tools. A behavior repair that preserves accepted meaning needs no model transaction. Ordinary host edits need no Projector-controlled execution. If controlled code execution is specifically required, read [executable lens checks](../../references/executable-lenses.md) and [the operation contract](../../references/operation-contract.md); exact patch scope, authenticated validators and recovery still apply. Do not weaken accepted meaning to fit generated or edited code.

Run relevant behavior checks, then `projector check <context ID>`. When acceptance changes that context's identities or dependencies, retrieve focused current context for the affected IDs and targets and reconcile it. Finish the requested implementation only when its applicable decisions, obligations, governance, required application evidence and disclosed scope expansion have no blocking or unknown result. Report broader coverage limits and unrealized future commitments outside that scope separately; they are not claims that this task verified them. Preserve unknown evidence rather than converting an incomplete observation to success. Use [$projector-verify](../projector-verify/SKILL.md) for the shared test procedure and a review of the actual diff against current meaning.

Report the actual model artifact changelog with links to changed canonical records, alongside code changes, checks and remaining uncertainty. If implementation preserves accepted meaning, state that the model was unchanged. Retain a useful new scenario, relation, selector or rationale when implementation discovers one; revise the model again if intended behavior changes.

## Observe and resume safely

Run `projector resume <actual context/change/approval ID>` after a session reset. Read restored meaning and currentness before reusing conclusions. A stale ID routes to evidence, not authority. Without an anchor, retrieve fresh context instead of guessing the latest. Resume only inspects. For an interrupted controlled write, inspect its actual approval and use `projector recover <approval ID>` explicitly when appropriate. Recovery restores consistency; it does not reapply the change. Preserve journals and ambiguous attempts.

Run `projector audit --scope <path> --context <context ID>` when unresolved accepted work or coverage evidence informs the task. Omit `--context` when none applies. Read evidence availability, repair recommendations and omitted question counts. Audit does not edit source or accepted meaning or execute repairs; its current observation does not refresh retained context. An advertised transform is executable only when the report establishes its binding.

Normal observation has no implicit deadline or repository-size ceiling. A caller can request a finite limit, for example `projector audit --timeout-ms 120000`. If it expires, inspect the failed stage and retained evidence. Fix a clear recurring inefficiency when justified, while preserving coverage, currentness and unknown results. Inspect lifecycle state before retrying a write that may have stopped.

`projector inspect <ID>` exposes exact metadata, provenance, hashes and recovery detail; `--json` returns machine results. Read [the operation contract](../../references/operation-contract.md) for integration and lifecycle details. For native process checks, use `verify check.json`, inspect with `verify --inspect [EVENT]`, and recover with `verify --recover`. For generated files, use `generate generation.json`, inspect with `generate --inspect producers.json`, and recover with `generate --recover producers.json`. Read [their strict contracts](../../references/operation-contract.md#native-verification-and-generation) before use.

For branch integration, run `projector integration --target REF --incoming REF` against the actual contributions, with `--result REF` for an available merge result. Read altered or lost contributions and verification gaps. A completed assessment is not a passing merge gate. Continue through ordinary Git and applicable review and checks. `evaluate options.json` exposes option reasoning without accepting a decision. For interrupted representation publication, inspect with `inspect --representations` before explicit `recover --representations`. An uncaptured change remains uncaptured.
