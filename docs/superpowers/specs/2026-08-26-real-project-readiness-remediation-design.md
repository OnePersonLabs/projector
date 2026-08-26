# Real-project readiness remediation design

## Goal

Ship one coherent Projector control plane that can carry an ordinary repository change from proposal through exact approval, capability-proven mutation, interruption recovery, independent validation, reconciliation, and authenticated release evidence. The installed CLI and Codex plugin must exercise the same lifecycle and the same package artifact.

The modular `PROJECTOR_SPEC/` tree is the sole normative authority. This design records implementation choices; it does not replace the specification.

## Package and ownership model

The public npm package is `@onepersonlabs/projector`; its executable remains `projector`. Internal workspace package names remain `@projector/*`.

Add a private `packages/control-plane` composition package. It may depend on core, engine, analyzers, runtime, and integrations. It owns the durable repository-change application service and its operational records. The CLI parses commands and renders results; it does not own a second compiler, store, or executor. Runtime owns filesystem effects, journal recovery, leasing, and sandbox execution. Engine owns semantic compilation, dependency-scoped currentness, planning, and reconciliation. Core owns strict public contracts.

There is one production lifecycle:

1. `projector change <request> --proposal <path>` captures a strict proposal.
2. `projector plan <semantic-change-id>` emits an immutable plan hash.
3. `projector approve <semantic-change-id> --plan-hash <hash>` records exact human authority.
4. `projector apply <approval-id>` executes the authorized attempt.
5. `projector recover <approval-id>` recovers only that approval's incomplete transactions.
6. `projector resume <approval-id>` revalidates and resumes the same approval.

The production `repair-governed-state` fixture lifecycle, selector-prefix routing, and fixture mutation path are removed. Useful provenance and tamper adversaries move to testkit.

## Contract and validity model

Core exports the strict Zod contract, inferred TypeScript type, and generated JSON Schema for `projector.change-proposal/v1`. The plugin consumes the generated schema; it does not maintain a handwritten copy.

A changed repository root digest triggers validation. It does not stale every approval. Currentness is decided from the binding's exact value and query dependencies. A changed bound dependency stales the approval; an unrelated root change does not.

The initial lifecycle continues to fail closed for every `blocking-now` architecture concern. Canonical-decision reuse is outside this initial capability; neither design prose nor code may imply otherwise.

## Mutation, recovery, and publication

No governed effect starts without current approval, an acquired writer lease, enforceable write authorization, exact path preconditions, and a sandbox backend whose live probe proves the required isolation. Missing or malformed isolation evidence returns unavailable before mutation; native unsandboxed execution is never a fallback.

Recovery is approval-scoped. The store maps an approval to its attempt and journal IDs, and the journal exposes targeted recovery for those authenticated IDs. An incomplete governed transaction blocks a new attempt until it is recovered. Recovering approval A cannot inspect, roll back, or finalize approval B.

After the journal commits, publication errors cannot turn committed success into a terminal failure. The attempt remains a typed `committed-unpublished` checkpoint and recovery idempotently publishes the authenticated prepared certificate and receipt. A committed mutation is never blindly rerun.

Cancellation propagates from CLI signal handling through the control plane and executor. Cancellation during validation rolls back or leaves a recoverable durable attempt according to the observed journal phase.

## Agent and MCP surfaces

`$projector-change` is a stateless wrapper over the public CLI:

- `start --request <text> --proposal <path>`
- `approve --change <id> --plan-hash <hash>`
- `apply|recover|resume --approval <id>`

The wrapper writes no continuation or trace state. Durable lifecycle evidence belongs to the control plane; acceptance captures an external invocation transcript. Structured CLI output and exit codes pass through unchanged.

MCP remains read-only until an authenticated capability-issuance route exists. `projector.list_divergences` returns divergences, not analyzer failures, and operational tool availability is explicit.

## Release evidence

Release gates are named executable experiments, not labels inferred from an unrelated passing suite. Each normative obligation maps to exact test identities and a negative control. Packed evidence recomputes certificate, receipt, transcript, and artifact hashes from bytes; self-reported booleans and hash-shaped strings are not proof.

The held-out lifecycle uses an independently derived Git-base behavioral oracle. The oracle fails before the requested change, passes after it, remains outside the proposal edits, and is bound by Git identity and bytes. Fixed point is proved by an actual second identical reconciliation.

The public package version is `@onepersonlabs/projector@2.1.0`. One build job creates and verifies the exact tarball, plugin bundle, runner, fixtures, and manifest. A fresh no-checkout acceptance job downloads those artifacts, provisions the sandbox, installs them, and runs source-severed acceptance. The workflow remains `workflow_dispatch` only. It uploads the exact tested tarball, plugin, evidence, transcript, and digests; it does not publish, tag, or create a release.

## Completion conditions

- One proposal schema authority and one public lifecycle exist.
- Wrapper paths cannot escape because the wrapper owns no repository state.
- Unrelated changes do not globally stale valid approvals.
- Recovery cannot cross approval boundaries.
- Committed success cannot be rewritten as terminal failure.
- Isolation, state, authority, or recovery unavailability fails before unsafe effect.
- Every release gate has a matching experiment and exact traceability.
- Packed evidence authenticates artifact bytes and independently proves desired behavior and fixed point.
- The scoped tarball is installed globally, and Codex plugin metadata, physical cache version, and source/cache bytes agree at `2.1.0`.
- GitHub Actions remains manual-only.

## Deliberate exclusions

This remediation does not implement every broad 1.x CLI command, publish npm/plugin artifacts, create a tag or GitHub release, or merge the campaign branch. Those actions need separate authority.

