---
designDelta: 1
target: projector/workflow
baseline: 30cf99cf89e9db63d87a0eeae329f3db8c643dbc43e8901d5d052890b25886d2
---
# Projector readiness design delta

## Replace: contract

```markdown
## Contract

Own the user's journey from setup and reviewed artifacts through implementation, verification, and integrated completion. Proposed artifacts remain distinct from accepted authority. Preserve unrelated work.

Applies: [[spec:projector/workflow#Installed repository setup]] | {"kind":"path","root":".","prefix":"src/host/"} | Setup must evolve without replacing user-owned authoring rules.
Applies: [[spec:projector/workflow#Agent owned conversational workflow]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Tasks describe the selected work; shared skills own repeatable procedure.
Applies: [[spec:projector/workflow#Safe workflow continuity]] | {"kind":"path","root":".","prefix":"src/change/"} | Requirement revisions and task bookkeeping must preserve partial implementation and valid check results.
Applies: [[spec:projector/workflow#Usable installed entry points]] | {"kind":"path","root":".","prefix":"docs/"} | The installed product must operate independently of the development checkout.
Applies: [[spec:projector/workflow#Reviewed branch integration]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Code and accepted authority must land together without discarding unrelated staged or working changes.
```

## Add: decision:repository-setup

```markdown
## Decision: repository-setup

Choice: Install recognized bundled schemas and upgrade exact previous stock while preserving customized files.
Reason: Setup must evolve without replacing user-owned authoring rules.
Requires: [[spec:projector/workflow#Installed repository setup]]
Consequential: boundary
Alternative: Reject every differing schema as a customization.
Tradeoff: Exact prior hashes permit stock upgrades but require recording every released stock version.
Realizes: [[code:src/host/project.ts]] [[code:test/project-init.test.ts]] [[code:openspec/schemas/projector/schema.yaml]] [[code:openspec/schemas/projector/templates/tasks.md]]
Evidence: Run setup repeatedly, upgrade prior stock, and reject custom files before writes.
```

## Replace: decision:conversational-entrypoints

```markdown
## Decision: conversational-entrypoints

Choice: Provide focused skill entry points with shared artifact-authoring and verification procedures.
Reason: Tasks describe the selected work; shared skills own repeatable procedure.
Requires: [[spec:projector/workflow#Agent owned conversational workflow]]
Consequential: boundary
Alternative: Put a mandatory workflow rubric in every change task list.
Tradeoff: Shared procedure avoids repeated boilerplate but installed skill routing must remain coherent.
Realizes: [[code:plugins/projector/skills/apply/SKILL.md]] [[code:plugins/projector/skills/apply/references/runtime.md]] [[code:plugins/projector/skills/audit/SKILL.md]] [[code:plugins/projector/skills/continue/SKILL.md]] [[code:plugins/projector/skills/explore/SKILL.md]] [[code:plugins/projector/skills/finish/SKILL.md]] [[code:plugins/projector/skills/finish/references/bulk.md]] [[code:plugins/projector/skills/init/SKILL.md]] [[code:plugins/projector/skills/propose/SKILL.md]] [[code:plugins/projector/skills/propose/references/artifacts.md]] [[code:plugins/projector/skills/reconcile/SKILL.md]] [[code:plugins/projector/skills/reconcile/references/import.md]] [[code:plugins/projector/skills/revise/SKILL.md]] [[code:plugins/projector/skills/sync/SKILL.md]] [[code:plugins/projector/skills/verify/SKILL.md]]
Evidence: Exercise fresh behavior, pure refactor, changed impact, and installed routed completion.
```

## Add: decision:lifecycle-continuity

```markdown
## Decision: lifecycle-continuity

Choice: Use the selected checkout by default, optional isolation, and versioned recovery and verification identities.
Reason: Requirement revisions and task bookkeeping must preserve partial implementation and valid check results.
Requires: [[spec:projector/workflow#Safe workflow continuity]]
Consequential: boundary
Alternative: Require a new isolated candidate for every implementation and bind every check to raw task bytes.
Tradeoff: Separate check freshness and review reconciliation require explicit input coverage and state migration.
Realizes: [[code:src/change/index.ts]] [[code:src/change/openspec.ts]] [[code:src/change/types.ts]] [[code:src/host/client.ts]] [[code:src/host/relay.ts]] [[code:src/host/server.ts]] [[code:test/change-sync.test.ts]] [[code:test/host-lifecycle.test.ts]]
Evidence: Verify partial revisions, actual task nodes, long installed checks, and recoverable integration.
```

## Add: decision:installed-guidance

```markdown
## Decision: installed-guidance

Choice: Ship the runtime and skills with concise outcome-oriented entry points and deeper operational guides.
Reason: The installed product must operate independently of the development checkout.
Requires: [[spec:projector/workflow#Usable installed entry points]]
Consequential: boundary
Alternative: Make users install a global CLI and author artifact syntax manually.
Tradeoff: Bundling increases installation size but fixes runtime and schema ownership.
Realizes: [[code:README.md]] [[code:package-lock.json]] [[code:package.json]] [[code:plugins/projector/plugin.json]] [[code:plugins/projector/.codex-plugin/plugin.json]] [[code:src/host/config.ts]] [[code:src/host/index.ts]] [[code:test/host-installed.test.ts]] [[code:docs/README.md]] [[code:docs/development.md]] [[code:docs/existing-projects.md]] [[code:docs/getting-started.md]] [[code:docs/qualification-workflow.md]] [[code:docs/reference/runtime.md]] [[code:docs/reference/workflow-coverage.md]] [[code:docs/revisions-and-recovery.md]] [[code:docs/troubleshooting.md]] [[code:docs/workflows.md]]
Evidence: Run installed discovery and realistic usage outside the development checkout.
```

## Replace: decision:reviewed-branch-integration

```markdown
## Decision: reviewed-branch-integration

Choice: Prepare a pinned reviewed integration in temporary isolation, then use the recoverable selected-change publication path for the target branch and checkout.
Reason: Code and accepted authority must land together without discarding unrelated staged or working changes.
Requires: [[spec:projector/workflow#Reviewed branch integration]]
Consequential: boundary
Alternative: Require a clean user checkout or automatically stash it before integration.
Tradeoff: Prepared index and checkout installation add recovery steps but preserve the user index and disjoint edits.
Realizes: [[code:plugins/projector/skills/merge/SKILL.md]] [[code:plugins/projector/skills/merge/references/conflict-review.md]] [[code:src/change/publication.ts]]
Evidence: Exercise actual overlap, disjoint edits in one file, hooks, target drift, and interrupted installation.
```

## Replace: realization

```markdown
## Realization

Setup owns schema migration. Skills own artifact authoring and shared verification procedure. Lifecycle owns revision, check identities, and selected-change publication. Installed tests and independent review qualify these boundaries.
```
