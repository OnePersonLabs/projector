---
designDelta: 1
target: projector/workflow
baseline: e035cc65247bb1d52b4eabcc7f2d260c979b692dbfa21f05f294cd76a9333443
---
# Add reviewed branch integration

## Replace: contract
```markdown
## Contract

The installed plugin owns the user's journey from repository setup and conversational intent through reviewed artifacts, implementation, completion and explicitly requested branch integration. The agent handles runtime operations and artifact syntax. Existing lifecycle gates and Git branch ownership remain authoritative.

Applies: [[spec:projector/workflow#Installed repository setup]] | {"kind":"path","root":".","prefix":"src/"} | Setup is implemented behind the installed host.
Applies: [[spec:projector/workflow#Agent owned conversational workflow]] | {"kind":"path","root":".","prefix":"plugins/projector/"} | Skills own conversation and routing.
Applies: [[spec:projector/workflow#Safe workflow continuity]] | {"kind":"path","root":".","prefix":"src/change/"} | The lifecycle owns exact synchronization and evidence.
Applies: [[spec:projector/workflow#Usable installed entry points]] | {"kind":"path","root":".","prefix":"docs/"} | User guides explain installed behavior.
Applies: [[spec:projector/workflow#Reviewed branch integration]] | {"kind":"path","root":".","prefix":"plugins/projector/skills/merge/"} | The merge skill owns isolated integration and escalation.
```

## Add: decision:reviewed-branch-integration
```markdown
## Decision: reviewed-branch-integration

Choice: Construct a pinned no-fast-forward merge on a temporary branch in a locked linked worktree, review and correct that result, then advance the original unchanged target with a fast-forward-only merge.
Reason: The current branch must remain recoverable and unchanged until conflict resolution, checks and semantic review establish one acceptable combined result.
Requires: [[spec:projector/workflow#Agent owned conversational workflow]] [[spec:projector/workflow#Reviewed branch integration]]
Consequential: boundary
Alternative: Merge directly in the user's working directory and rely on Git abort or an automatic stash.
Tradeoff: An isolated worktree adds temporary Git objects and cleanup, but it avoids mixing local work with unresolved integration state and permits review before publication.
Realizes: [[code:README.md]] [[code:package-lock.json]] [[code:package.json]] [[code:plugins/projector/.codex-plugin/plugin.json]] [[code:plugins/projector/plugin.json]] [[code:plugins/projector/skills/finish/SKILL.md]] [[code:plugins/projector/skills/merge/SKILL.md]] [[code:plugins/projector/skills/merge/references/conflict-review.md]] [[code:src/host/config.ts]] [[code:test/host-installed.test.ts]] [[code:docs/qualification-workflow.md]] [[code:docs/reference/runtime.md]] [[code:docs/reference/workflow-coverage.md]] [[code:docs/troubleshooting.md]] [[code:docs/workflows.md]]
Evidence: Installed package discovery, realistic temporary-repository merge exercises, full repository checks and independent adversarial review.
```
