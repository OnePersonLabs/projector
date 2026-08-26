# Installed repository change lifecycle

This guide operates the first production Projector change path. The modular [Projector specification](../../PROJECTOR_SPEC/SPEC.md) is authoritative. This guide explains the installed CLI and `$projector-change` projection.

## Availability

Install the production `projector` npm package and the Projector Codex plugin. Confirm both boundaries:

```sh
projector --version
codex plugin list --json
```

The plugin version and global cache path in the Codex output must match the intended installation. The plugin does not search a source checkout. Set `PROJECTOR_CLI` only when you need one exact non-PATH executable.

If the CLI, Git identity, capability-proven sandbox, immutable validator overlay, or authenticated repository observation is unavailable, stop. Unavailability is not approval and is not safety evidence.

## Prepare the proposal

Inspect the repository and its authority before edits. Write a strict `projector.change-proposal/v1` JSON document. Use the bundled [proposal schema guide](../../plugins/projector/skills/projector-change/proposal-schema.md).

The proposal records interpreted intent, exact before/after UTF-8 text, validators, and Analysis Facets. It does not grant authority. Keep at least one independent Node validator unchanged in the Git base. A proposed supplemental validator cannot replace that independent evidence.

Ask for user input only when repository evidence cannot resolve a material identity conflict, a blocking architecture choice, or an irreversible boundary.

## Direct CLI path

Run from the target repository root:

```sh
projector change "<natural request>" --proposal change-proposal.json --format json
projector plan <changeSelector> --format json
```

Show the preview, change selector, and exact immutable plan hash to the human. Stop before approval.

After the human supplies that exact hash:

```sh
projector approve <changeSelector> --plan-hash <exact-plan-hash> --format json
projector apply <approvalSelector> --format json
```

A different hash requires a new plan and new approval. General permission does not approve a specific immutable plan.

## Installed agent path

Resolve `scripts/projector-change.mjs` inside the installed plugin. Run:

```sh
node <projector-change.mjs> start --request "<natural request>" --proposal change-proposal.json
```

The command exits `3` and returns structured JSON with `outcome: "approval-required"`, a preview, the change selector, and the exact plan hash. Present those values and stop. The wrapper writes no repository state.

After exact human approval:

```sh
node <projector-change.mjs> approve --change <changeSelector> --plan-hash <exact-plan-hash>
node <projector-change.mjs> apply --approval <approvalSelector>
```

The agent wrapper only transports lifecycle inputs to the installed CLI. It does not implement semantics, mutation, continuation storage, or tracing. Apply, recover, and resume preserve the installed CLI's structured output and exit code.

## Interruption and recovery

Preserve `.projector/runtime/change-lifecycles/` and the approval selector. Do not hand-edit a partially changed target. Run:

```sh
node <projector-change.mjs> recover --approval <approvalSelector>
node <projector-change.mjs> resume --approval <approvalSelector>
```

Recovery waits for or safely takes over the writer lease. It restores exact snapshots or reports `recovery-required` for a third state. Resume recovers first and starts a new attempt under the same still-current approval.

## Completion evidence

Accept completion only when all of these facts agree:

- result outcome is `success`;
- certificate and receipt bind the approved plan;
- the journal is committed and closed;
- independent validation reports `immutable-captured-overlay`;
- predicted and observed changed paths match;
- no unexpected path, canonical identity, analyzer failure, Planning Surprise, or unknown remains;
- a repeated resume returns the same authenticated certificate and receipt.

Durable lifecycle evidence under `.projector/runtime/change-lifecycles/` is written and authenticated by the control plane, not by the wrapper. Release acceptance records the wrapper invocation transcript outside the target repository.
