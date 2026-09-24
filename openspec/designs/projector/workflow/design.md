---
projectorDesign: 1
id: projector/workflow
scope: .
---
# Agent operated product workflow

## Contract

The installed plugin owns the user's journey from repository setup and conversational intent through reviewed artifacts, implementation and completion. The agent handles runtime operations and artifact syntax. Existing lifecycle gates remain authoritative.

Applies: [[spec:projector/workflow#Installed repository setup]] | {"kind":"path","root":".","prefix":"src/"} | Setup is implemented behind the installed host.
Applies: [[spec:projector/workflow#Agent owned conversational workflow]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Skills own conversation and routing.
Applies: [[spec:projector/workflow#Safe workflow continuity]] | {"kind":"path","root":".","prefix":"src/change/"} | The lifecycle owns exact synchronization and evidence.
Applies: [[spec:projector/workflow#Usable installed entry points]] | {"kind":"path","root":".","prefix":"docs/"} | User guides explain installed behavior.

## Decision: conversational-entrypoints

Choice: Provide focused skill entry points with shared routed procedures, bundled schema setup and candidate-scoped synchronization.
Reason: Users describe and review work; agents own artifacts and deterministic operations.
Requires: [[spec:projector/workflow#Installed repository setup]] [[spec:projector/workflow#Agent owned conversational workflow]] [[spec:projector/workflow#Safe workflow continuity]] [[spec:projector/workflow#Usable installed entry points]]
Consequential: boundary
Alternative: Keep one delivery skill and ask users to create artifacts or install the old workflow plugin.
Tradeoff: More discoverable skills require shared procedure ownership and installed behavioral checks, but remove the manual setup gap.
Realizes: [[code:README.md]] [[code:package-lock.json]] [[code:package.json]] [[code:plugins/projector/plugin.json]] [[code:src/change/index.ts]] [[code:src/change/openspec.ts]] [[code:src/change/types.ts]] [[code:src/host/config.ts]] [[code:src/host/index.ts]] [[code:src/host/relay.ts]] [[code:src/host/server.ts]] [[code:test/host-installed.test.ts]] [[code:test/host-lifecycle.test.ts]] [[code:docs/README.md]] [[code:docs/development.md]] [[code:docs/existing-projects.md]] [[code:docs/getting-started.md]] [[code:docs/qualification-workflow.md]] [[code:docs/reference/runtime.md]] [[code:docs/reference/workflow-coverage.md]] [[code:docs/revisions-and-recovery.md]] [[code:docs/troubleshooting.md]] [[code:docs/workflows.md]] [[code:plugins/projector/skills/apply/SKILL.md]] [[code:plugins/projector/skills/apply/references/runtime.md]] [[code:plugins/projector/skills/audit/SKILL.md]] [[code:plugins/projector/skills/continue/SKILL.md]] [[code:plugins/projector/skills/explore/SKILL.md]] [[code:plugins/projector/skills/finish/SKILL.md]] [[code:plugins/projector/skills/finish/references/bulk.md]] [[code:plugins/projector/skills/init/SKILL.md]] [[code:plugins/projector/skills/propose/SKILL.md]] [[code:plugins/projector/skills/propose/references/artifacts.md]] [[code:plugins/projector/skills/reconcile/SKILL.md]] [[code:plugins/projector/skills/reconcile/references/import.md]] [[code:plugins/projector/skills/revise/SKILL.md]] [[code:plugins/projector/skills/sync/SKILL.md]] [[code:plugins/projector/skills/verify/SKILL.md]] [[code:src/host/project.ts]] [[code:test/change-sync.test.ts]] [[code:test/project-init.test.ts]]
Evidence: Initialization, synchronization/revision/finish and installed-client tests plus independent workflow review.

## Realization

Skills own conversation and artifact authoring. The host owns safe initialization and plugin discovery. The lifecycle shares exact target materialization across synchronization and finish, retains synchronized Git objects, and preserves adopted configuration. Integration tests and independent review verify these responsibilities.
