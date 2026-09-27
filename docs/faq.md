# FAQ

## Contents

- [Does Projector control every code edit?](#does-projector-control-every-code-edit)
- [Does installing the plugin activate a repository?](#does-installing-the-plugin-activate-a-repository)
- [Is a context packet a complete specification?](#is-a-context-packet-a-complete-specification)
- [Does `check` prove that code is correct?](#does-check-prove-that-code-is-correct)
- [When do I need `$projector-change`?](#when-do-i-need-projector-change)
- [What if a check discovers a new consumer?](#what-if-a-check-discovers-a-new-consumer)
- [Are `.assimilate/` notes Projector concepts?](#are-assimilate-notes-projector-concepts)
- [Can an older format upgrade automatically?](#can-an-older-format-upgrade-automatically)
- [What does recovery do?](#what-does-recovery-do)
- [Where can I find CLI syntax?](#where-can-i-find-cli-syntax)

## Does Projector control every code edit?

No. The normal workflow uses ordinary Codex tools to implement an authorized change. Use `$projector-change` when accepted meaning changes. Controlled execution is a distinct supported route for changes that specifically require Projector's transaction guarantees.

## Does installing the plugin activate a repository?

No. A repository becomes active through the explicit `projector init` operation.

## Is a context packet a complete specification?

It contains complete selected meaning and reports omissions, open queries, and unavailable observations. It is bounded and task-specific. An omitted obligation is unresolved; inspect it or retrieve focused context before relying on the packet.

## Does `check` prove that code is correct?

No. It rechecks retained meaning and dependencies. Run application behavior checks for the changed behavior. A successful operation does not establish that the design is complete or that untested code works.

## When do I need `$projector-change`?

When intended project meaning changes. A refactor or implementation choice can change while preserving accepted meaning. When behavior, assumptions, architecture, or rationale changes, capture and review a canonical change.

## What if a check discovers a new consumer?

Investigate whether the consumer changes an assumption or exposes a violation. A newly relevant source result is not automatically a violation. Reconcile the affected context and revise accepted meaning only if intended meaning changes.

## Are `.assimilate/` notes Projector concepts?

No. Assimilation topics have separate identity, schemas, authority, and lifecycle. They are a working synthesis that may provide evidence for a later Projector change.

## Can an older format upgrade automatically?

Projector 3 supports one artifact format. An older repository requires a checked cutover. The current release does not provide automatic migration across a chain of old formats.

## What does recovery do?

Explicit recovery repairs a recognized interrupted controlled write. It does not reapply the proposal or grant new authority. Resume inspects retained state without applying changes.

## Where can I find CLI syntax?

Run `projector --help` if the separate CLI distribution is on `PATH`, or `node <plugin>/scripts/projector.mjs --help` with the plugin bundle. See the [CLI reference](reference/cli.md) and [Skills](skills.md).

Continue with [Getting started](getting-started.md) or [Troubleshooting](troubleshooting.md).
