# Troubleshooting

Use the exact error and retained ID as evidence. Do not guess which context, approval, or transaction Projector meant.

## Contents

- [Projector says the repository is inactive](#projector-says-the-repository-is-inactive)
- [The context omits an obligation](#the-context-omits-an-obligation)
- [A check reports changed assumptions or new source members](#a-check-reports-changed-assumptions-or-new-source-members)
- [A retained context is stale](#a-retained-context-is-stale)
- [An apply is rejected as stale](#an-apply-is-rejected-as-stale)
- [A controlled operation reports recovery required](#a-controlled-operation-reports-recovery-required)
- [The artifact format is unsupported](#the-artifact-format-is-unsupported)
- [Projector is unavailable](#projector-is-unavailable)
- [The behavior check passes but uncertainty remains](#the-behavior-check-passes-but-uncertainty-remains)

## Projector says the repository is inactive

Installation does not activate a repository. Run `projector init` only when activation is intended. If a valid model already exists, inspect the readiness output and configuration before retrying.

## The context omits an obligation

An omitted item remains unresolved. Retrieve focused context with its exact `--entity ID`, inspect the record, or name the relevant source path with `--target path`. Read the disclosure and open-query details. Do not treat the omission as proof that the obligation is irrelevant.

## A check reports changed assumptions or new source members

Inspect the changed code and new query results. Decide whether the difference is harmless, changes an assumption, reveals a violation, or leaves unavailable evidence. Use `$projector-reconcile` for outside changes and `$projector-review` for a consequential diff. Change accepted meaning only through `$projector-change` when intent changed.

## A retained context is stale

Resume the actual context ID to inspect currentness. If its dependencies changed, retrieve fresh context and reassess. Do not reuse an old conclusion as authority for a changed plan.

## An apply is rejected as stale

The reviewed plan no longer matches current dependencies or the proposal changed. Read the reason, capture a new preview, and review it. Do not substitute a fresh hash onto an old review.

## A controlled operation reports recovery required

Read the actual approval or operation ID. Run `projector resume <ID>` to inspect the retained state. If the journal is recognized and recovery is authorized, use the explicit recovery route. Preserve unknown journals and failed evidence for investigation. Recovery does not retry the operation.

## The artifact format is unsupported

Stop before editing or deleting existing project data. Projector 3 supports one authored format. An older project requires a checked cutover; it does not automatically walk through historic package versions. Read the format decision linked from `.projector/README.md` and determine the supported cutover before proceeding.

## Projector is unavailable

Read canonical Markdown under `.projector/` directly and state that automated retrieval and currentness assurance were unavailable. Continue only when the available evidence and authorization support the work.

## The behavior check passes but uncertainty remains

A passing test establishes its observed behavior. It does not cover untested inputs, dynamic registrations, external systems, or every consumer. Add or run the smallest relevant behavior check, and name unobserved areas in the handoff.

Continue with [Review, reconcile, and recover](review-reconcile-recover.md) or the [CLI reference](reference/cli.md).
