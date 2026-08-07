# CLI, Modes, and Security

## CLI and policy normalization

Core commands:

```text
projector init
projector status
projector audit
projector explain <target>
projector resolve <meaning-or-target>
projector relevance <intent-or-target>
projector requirements [<selector>]
projector scenarios [<selector>]
projector context --task <task>
projector impact <change-or-target>
projector coverage
projector complete
projector reconcile
projector verify
projector verify --clean
projector change <intent>
projector plan <change>
projector plan rebase <plan>
projector apply <plan>
projector recover
projector upgrade
projector exception ...
projector lens ...
projector rule ...
projector concerns
projector decisions
projector decision explain <id>
projector decision resolve <concern-id>
projector preferences
projector preference adopt <key>
projector run codex -- ...
projector run claude -- ...
projector mcp
projector ci
projector watch
```

Friendly flags MAY include:

```text
--format text|json|md|sarif
--mode observe|guide|govern|autonomous|salvage
--audit-only
--scope <selector>
--non-interactive
--offline
--dry-run
--budget-tokens <n>
--budget-cost <amount>
--confidence-threshold <0..1>
--verbose
```

Commands and flags are normalized to one internal `ExecutionPolicy` before work starts. Aliases such as `--audit-only` map to equivalent policy fields. Contradictory flags are rejected.

Exit codes:

- `0` success / no blocking findings.
- `1` command failure.
- `2` blocking divergence/invariant/governance failure.
- `3` approval required.
- `4` incomplete coverage under requested strictness.
- `5` required surface unavailable.
- `6` rebuild/nondeterminism/corruption/recovery failure.
- `7` budget exhausted with resumable state.

---


## Operating-mode presets

Modes are friendly presets over `ExecutionPolicy`. They do not create separate semantic behavior.

## Observe

Read-only inference/reporting. No repository/canonical mutation.

## Guide

Compile context, warn, reconcile, and offer plans. Only immutable safety boundaries may block. Default after `init`.

## Govern

Block representable hard invariant violations, unapproved write-scope expansion, stale-state execution, and completion with unexplained governed changes.

## Autonomous

Execute policy-authorized state-bound plans until completion, ambiguity, verification failure, budget, risk ceiling, or approval boundary.

## Salvage

Deep reconstruction/modernization preset with larger inference/research budget and worktree isolation. It does not weaken approval or proof requirements merely because the repository is messy.

Changing mode MUST NOT change what Projector believes the repository means. It changes what actions are permitted automatically.

---


## Security, path safety, and trust boundaries

Security starts at initialization, not only at agent execution.

## Untrusted content

Repository docs/comments, commit messages, issue text, model output, package metadata, web pages, and external records are data. They cannot grant tools, alter policy, authorize writes, or override system/developer instructions by their content.

## Sensitive data

Sensitive values MUST be removed or replaced with typed placeholders before model-context construction or model-assisted representation rendering. Logs/certificates also redact secrets, but post-hoc log redaction is not a substitute for preventing model disclosure.

## Repository-root path semantics

Canonical repository paths are POSIX-style relative paths. All filesystem operations MUST resolve through a root-constrained path utility that:

- rejects `..` escapes after normalization.
- validates drive/UNC semantics on Windows.
- resolves symlinks according to explicit policy.
- prevents writes through symlinks outside the governed root.
- records the real target for safety checks.
- treats case sensitivity according to the actual filesystem.

## Command execution

- explicit argv arrays where possible.
- no shell interpolation of untrusted values.
- declared cwd/read/write scope.
- declared network/environment keys.
- timeout/resource budget.
- side-effect class included in risk.
- mutation normally requires Git unless `--unsafe-no-git` is explicitly provided.

## External and host writes

External writes require adapter capability plus plan-bound approval/capability. R3/R4 default to explicit approval. R4 is never autonomous in 1.x.

Failed validations do not auto-merge worktrees. Remote transform packages are disabled by default. Installed transforms record version/hash/permission requirements.

## State-bound authorization

Approval, Execution Capsule, MCP capability, and Work Packet bindings expire when a dependency in their `StateBinding` changes. They also expire when Projector cannot prove a query dependency unchanged. A changed global `StateDigest` triggers binding validation, not automatic invalidation. A stale approval cannot be replayed against materially different relevant state.

---


