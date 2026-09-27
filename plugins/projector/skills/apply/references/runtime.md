# Runtime, ownership, and completion contract

## Tools and repository selection

Prefer installed Projector MCP operations. If unavailable, locate the installed plugin from this skill's path: three parent directories from its SKILL.md contain plugin.json, mcp.json, and runtime/. Read mcp.json and use its configured executable and internal CLI entry rather than assuming a global executable. The equivalent CLI accepts an operation and `--json` with one JSON object. Pass arguments through an argument array or correctly quote for the actual shell; do not interpolate user text into commands. Keep commands internal; users request outcomes through skills.

OpenSpec is bundled at `runtime/node_modules/@fission-ai/openspec/bin/openspec.js`. Invoke it with the configured runtime executable, with the source repository as working directory. Use its `--help` for version-specific syntax. Useful operations are `status --change NAME --json`, `instructions ARTIFACT --change NAME --json`, and `validate NAME --strict --json`. Do not install or rely on a global OpenSpec CLI. Projector alone owns prepare, sync, and finish; direct OpenSpec archive bypasses its guarantees.

Select the actual Git repository, not the plugin directory. Lifecycle calls always use the original source `{root,change}`; keep those fixed even while implementing in `candidateRoot`. The root requires an existing commit before prepare; if absent, explain and establish the initial baseline only with appropriate authorization for its contents. Never include unrelated dirty files in a baseline commit.

Read active directories under openspec/changes excluding archive. Use conversation context or one unambiguous change; if several fit, ask with concrete names. Read durable implementation-state.json for selection/recovery, but never hand-edit its state or evidence.

## Source and candidate ownership

Source change artifacts under `openspec/changes/CHANGE/` own proposed requirements, designs, and planning inputs. Accepted live authority belongs to the pinned Git baseline. Actual implementation belongs to the selected checkout by default. Explicit isolated mode allocates another worktree. Unrelated work remains owned by the user in either mode.

`prepareChange({root,change,baseline?,workspaceMode?})` accepts `workspaceMode:"checkout"|"isolated"`, defaulting to checkout, and returns candidateRoot, candidateId, targetId, and lifecycle state. In checkout mode candidateRoot equals the selected source root, including an already selected worktree. Existing isolated sessions keep their location. `resumeChange({root,change})` recovers state and may finish pending bookkeeping; use it for authorized recovery, not a read-only audit. Revision retains partial code and Git checkpoints without requiring another checkout. Reconcile divergent source/candidate artifacts before validation or sealing.

After prepare, open the candidate with `openRoot({root:candidateRoot,profile:"managed",candidate:candidateId})`. Save its rootId. Run `checkpoint({rootId})` and require a settled response before claiming a working-current view.

Before writing candidate files, call `beginBatch({rootId,writer,paths,target:targetId})` with exact repository-relative write paths and require acknowledgement. Then edit and call `completeBatch({rootId,batchId,actualPaths})`. If writes escape the declared inventory, supply `unknownWrites:true` and checkpoint. Unknown shell writes and lifecycle subprocess operations need a checkpoint before another currentness claim. A coordinator may own a batch spanning worker edits; workers must use that ownership rather than create overlapping batches. Preserve interrupted intervals and recover honestly; never claim unobserved work is current.

## Plan and contribution records

Call `validatePlan` with the fixed root/change plus arrays such as:

```json
{
  "applicability": [{
    "requirement": "spec:audio/preview#Immediate replay",
    "selectors": [{"kind":"path","root":".","prefix":"src"}],
    "reason": "Playback code owns replay requests."
  }],
  "contributions": [{
    "path": "src/player.js",
    "decision": "design:audio/preview#decision:playback",
    "target": "code:src/player.js#replay",
    "action": "revise",
    "reason": "Remove the duplicate restart while retaining event ownership."
  }]
}
```

Use exact current references and actual scopes. Contributions must match current decision Realizes bindings; for withdrawn previous contributions, dispositions explain removal/replacement. Symbol-level support needs the exact target, not just its file. Every changed artifact and affected prior contribution needs a disposition. Include non-code artifacts such as docs, configuration, tests, and skill files through appropriate current realization bindings.

A selector with no members is an obligation, not success. A scoped exclusion requires `excluded:true`, selectors, and a meaningful reason. Unknown populations need investigation. Supply `prerequisites:["other-change"]` only for genuine dependencies: a prerequisite must be published and its commit included in the pinned baseline.

The response's `basis` identifies current plan/review inputs and differs from targetId. Its `verificationBasis` identifies check-input freshness. Review uses basis; executed evidence uses the versioned verification basis and coverage. Checkbox edits and recorded results do not automatically stale application evidence. Substantive task changes still require reconciliation. `valid:false` and returned obligations are actionable state, not exceptions to waive. Future implementation coverage remains an explicit obligation until implemented and checked.

Task wording edits require `taskChange:{kind:"scheduling"|"authority-amended",reason,targetId}`. Checkbox completion alone cannot authorize new behavior. Source and candidate edits may diverge; combine them without discarding either before validation.

## Evidence and review

`recordEvidence({root,change,command,args,scope,timeoutMs})` executes a real bounded check in the candidate. Command is an executable, args is an array, scope contains exact repository-relative files meaningfully covered, and timeoutMs is bounded by the runtime. Inspect exit status and output. A no-op process is not behavioral evidence. Tests that mutate implementation can invalidate their own basis; settle writes before final checks.

Evidence `purpose` defaults to `verification`. Use `diagnostic`, `baseline`, `red`, or `generation` for historical results that must not authorize final completion or replay as final assurance. Optional `inputPaths` specifies actual check inputs separately from covered `scope`; omit it for conservative whole-checkout freshness. Include test files, transitive implementation, fixtures, and relevant configuration. Empty or uncertain input selection requires broader coverage. An explicit passing current check can list earlier IDs in `supersedes` when its scope covers their scopes and its actual assertions preserve their obligations. The runtime validates coverage, not test strength; do not claim substitution based solely on a successful command. Superseded records remain history.

For a declared generation operation, include `generatedOutputs:["exact/output/path"]`. A successful producer with stable input identities yields a receipt binding command, arguments, runtime, producer/input hashes, and output hashes. Configuration belongs in declared inputs. Generation can change outputs and therefore invalidate ordinary check evidence while still yielding a valid generation receipt; perform subsequent settled verification. Do not manually supply generation identities or use ignored disposable outputs as accepted authority.

Evidence timeout defaults to sixty seconds and accepts one through six hundred thousand milliseconds. Owner/client transport permits the selected deadline plus fifteen seconds for settlement. Finish and resume default to a six-hundred-second transport budget plus settlement because finalization can execute recorded checks; they accept a bounded explicit timeout. Other operations retain their normal deadline. MCP caller deadlines are caller-owned: configure at least this operation budget for long checks or finalization, or use the installed CLI. The relay emits progress when a progress token is supplied. After a disconnect, inspect persisted results with resume/validation before repeating a mutation. Invoke npm through the installed Node executable and npm CLI entry on Windows; command is an executable, never shell command text.

Use the current `validatePlan` basis for `review:{basis,reviewer,examined,alternative,findings}`. Reviewer is truthful attribution to a genuinely independent agent or reviewer. Examined lists the actual target/diff/check material; alternative states the credible alternative evaluated; findings lists unresolved issues. An empty findings array is appropriate only after real review and resolution. If independent review cannot be obtained, report the blocker instead of inventing it.

Do not manually edit durable lifecycle state, evidence, refs, or seals to satisfy gates. A moved candidate branch/baseline, stale target, failed check, unknown inventory, or unresolved review remains a completion blocker until causally resolved.

## Finish semantics

`syncChange` materializes the exact target in the implementation checkout and keeps the change active. `finishChange` assembles selected implementation, accepted authority, and archive in a temporary detached linked worktree. It creates the commit through normal hooks and inspects hook writes. Changed check inputs need fresh evidence and review. Publication conditionally advances the selected target branch and installs prepared checkout/index state while preserving unrelated work. It never silently stashes, resets, or commits unrelated changes. Both checkout and isolated modes finish through this pipeline.

Code and specifications land in one commit. Checkout installation is recoverable through the lifecycle journal; it is not a filesystem-wide atomic transaction. Unexpected edits, overlap, hook failures, and target drift remain explicit obligations. Resume preserves unexpected work and continues completed steps. After settled finish a repeat produces no substantive change. Integration is part of completion, not an optional subsequent action.

If failed or hook-mutated finalization contains implementation changes needing repair, inspect its retained delta. Use `resumeChange({root,change,reconcileFinalization:true})` to reconcile into the selected implementation checkout. Recovery preserves unrelated work, clears seals and review, and reopens implementation. Historical evidence remains recorded; changed inputs stale affected assurance. Resolve conflicts, check the repaired result, and obtain independent review before finishing again. Do not edit seals or publish the failed tree directly.

Authority and change-artifact edits remain in `pendingFinalizationArtifacts`. Incorporate their retained bytes into the target or authored inputs. If an edit should be discarded, submit its path and specific reason through `validatePlan` with `finalizationDispositions:[{path,reason}]`. These decisions become part of the review basis; another validation call alone cannot dismiss the pending edits.
