# Runtime, ownership, and completion contract

## Tools and repository selection

Prefer installed Projector MCP operations. If unavailable, locate the installed plugin from this skill's path: three parent directories from its SKILL.md contain plugin.json, mcp.json, and runtime/. Read mcp.json and use its configured executable and internal CLI entry rather than assuming a global executable. The equivalent CLI accepts an operation and `--json` with one JSON object. Pass arguments through an argument array or correctly quote for the actual shell; do not interpolate user text into commands. Keep commands internal; users request outcomes through skills.

OpenSpec is bundled at `runtime/node_modules/@fission-ai/openspec/bin/openspec.js`. Invoke it with the configured runtime executable, with the source repository as working directory. Use its `--help` for version-specific syntax. Useful operations are `status --change NAME --json`, `instructions ARTIFACT --change NAME --json`, and `validate NAME --strict --json`. Do not install or rely on a global OpenSpec CLI. Projector alone owns prepare, sync, and finish; direct OpenSpec archive bypasses its guarantees.

Select the actual Git repository, not the plugin directory. Lifecycle calls always use the original source `{root,change}`; keep those fixed even while implementing in `candidateRoot`. The root requires an existing commit before prepare; if absent, explain and establish the initial baseline only with appropriate authorization for its contents. Never include unrelated dirty files in a baseline commit.

Read active directories under openspec/changes excluding archive. Use conversation context or one unambiguous change; if several fit, ask with concrete names. Read durable implementation-state.json for selection/recovery, but never hand-edit its state or evidence.

## Source and candidate ownership

Source change artifacts under `openspec/changes/CHANGE/` own proposed requirements, designs, and planning inputs. Accepted live authority belongs to the pinned Git baseline. Actual implementation belongs to the allocated candidate worktree. The source worktree may contain unrelated work and remains separate.

`prepareChange({root,change,baseline?})` returns candidateRoot, candidateId, targetId, and lifecycle state. `resumeChange({root,change})` recovers existing state. It may finish pending bookkeeping; use it for authorized recovery, not a read-only audit.

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

The response's `basis` identifies actual current implementation inputs and differs from targetId. Review/evidence must use that basis. `valid:false` and returned obligations are actionable state, not exceptions to waive. Some future implementation coverage cannot be complete before code exists; keep it as an explicit obligation and resolve it before finish.

Task wording edits require `taskChange:{kind:"scheduling"|"authority-amended",reason,targetId}`. Checkbox completion alone cannot authorize new behavior. Source and candidate edits may diverge; combine them without discarding either before validation.

## Evidence and review

`recordEvidence({root,change,command,args,scope,timeoutMs})` executes a real bounded check in the candidate. Command is an executable, args is an array, scope contains exact repository-relative files meaningfully covered, and timeoutMs is bounded by the runtime. Inspect exit status and output. A no-op process is not behavioral evidence. Tests that mutate implementation can invalidate their own basis; settle writes before final checks.

Use the current `validatePlan` basis for `review:{basis,reviewer,examined,alternative,findings}`. Reviewer is truthful attribution to a genuinely independent agent or reviewer. Examined lists the actual target/diff/check material; alternative states the credible alternative evaluated; findings lists unresolved issues. An empty findings array is appropriate only after real review and resolution. If independent review cannot be obtained, report the blocker instead of inventing it.

Do not manually edit durable lifecycle state, evidence, refs, or seals to satisfy gates. A moved candidate branch/baseline, stale target, failed check, unknown inventory, or unresolved review remains a completion blocker until causally resolved.

## Finish semantics

`syncChange` materializes only the exact target in the managed candidate and keeps the change active. `finishChange` verifies, materializes, archives through bundled OpenSpec, and publishes only the allocated candidate branch with an expected-old-ref check. Neither merges into the source branch. After a settled successful finish, a repeat must produce no substantive changes. Report precise remaining recovery on failure and preserve the candidate.
