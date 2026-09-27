---
designDelta: 1
target: projector/change
baseline: a04d615925b7795315878f196a4304bf066002ae7b5639c60149c0901438317c
---
# Projector readiness design delta

## Replace: contract

```markdown
## Contract

Own the accepted baseline, exact prospective target, selected implementation checkout, and evidence-bound completion. OpenSpec owns requirement merge and validation. The host owns working-current observation, including invalidating an enrolled candidate before lifecycle or subprocess writes.

Applies: [[spec:projector/changes#Separate accepted proposed and actual views]] | {"kind":"path","root":".","prefix":"src/change"} | The lifecycle pins and preserves all three views.
Applies: [[spec:projector/changes#Applicability and independent coverage]] | {"kind":"path","root":".","prefix":"src/change"} | Planning compares executable populations, actual changed artifacts, and declared contributions.
Applies: [[spec:projector/changes#Current evidence and contribution disposition]] | {"kind":"path","root":".","prefix":"src/change"} | Evidence and contribution gates control completion.
Applies: [[spec:projector/changes#Coherent recoverable finish]] | {"kind":"path","root":".","prefix":"src/change"} | Archive and expected-old-ref publication share a durable recovery record.
Applies: [[spec:projector/changes#Clean evolution]] | {"kind":"path","root":".","prefix":"src/change"} | Previous contributions across all domains remain explicit through revision and removal review.
```

## Replace: decision:durable-candidate

```markdown
## Decision: durable-candidate

Choice: Default to the selected checkout, allow explicit isolated worktrees, and retain accepted and current/previous targets as Git objects and refs. Store versioned recovery state in the Git directory with an active artifact mirror.
Reason: Actual implementation can diverge temporarily without redefining accepted requirements or losing prior ownership when a disposable cache disappears.
Requires: [[spec:projector/changes#Separate accepted proposed and actual views]]
Consequential: boundary
Alternative: Edit accepted live documents in place and maintain inverse patches during every revision.
Tradeoff: Shared-checkout enrollment requires one owning active change and precise selected-change inventory. Existing isolated sessions migrate without relocation; Git checkpoints preserve partial work without mandatory worktree allocation.
Realizes: [[code:src/change/index.ts#ChangeService]]
Evidence: The lifecycle revision/recovery integration tests inspect exact Git refs and preserved same-file content.
```

## Replace: decision:explicit-gates

```markdown
## Decision: explicit-gates

Choice: Compare actual changed artifacts and domain-specific units against applicability, current bindings, all prior contribution dispositions, and versioned evidence. Parse actual task AST nodes; separate verification input identity from plan/review identity and preserve historical results.
Reason: Links, checkboxes, selectors, and a successful command alone cannot establish behavioral or architectural correctness.
Requires: [[spec:projector/changes#Applicability and independent coverage]], [[spec:projector/changes#Current evidence and contribution disposition]], [[spec:projector/changes#Coherent recoverable finish]], [[spec:projector/changes#Clean evolution]]
Consequential: strategy
Alternative: Treat completed tasks and valid document links as sufficient completion evidence.
Tradeoff: Semantic judgments remain bounded host/reviewer work; deterministic code can reject absent, stale, contradictory, or unsupported records but cannot authenticate an invented narrative.
Realizes: [[code:src/change/index.ts#ChangeService]]
Evidence: Missing-scope, unplanned-file, stale-evidence, task-edit, same-file contribution, and archived-prerequisite tests discriminate unsupported completion.
```

## Add: decision:integrated-publication

```markdown
## Decision: integrated-publication

Choice: Assemble implementation and accepted authority in a temporary detached linked worktree, create the commit through normal hooks, qualify the resulting tree, and conditionally advance the selected target through journaled checkout and index installation.
Reason: Candidate-only archive does not complete delivery, while resetting a dirty target loses user work.
Requires: [[spec:projector/changes#Coherent recoverable finish]]
Consequential: boundary
Alternative: Publish only a permanent candidate branch or require a clean target and automatic stash.
Tradeoff: Branch advancement is atomic but checkout installation needs recovery. Store pinned target and commit, before/after index bytes, touched file identities, and progress; preserve unexpected edits. Hook changes require fresh evidence and review before integration.
Realizes: [[code:src/change/publication.ts]] [[code:src/change/index.ts#ChangeService]] [[code:src/change/types.ts]]
Evidence: Exercise staged and unstaged residual edits, disjoint same-file changes, overlap, hooks, drift, interruption, resume, and settled no-op.
```

## Add: decision:generated-support

```markdown
## Decision: generated-support

Choice: Track relevant generated contributions through producer and input/configuration identities, generation evidence, and tracked/disposable status. Treat removed producers and changed inputs as explicit disposition/regeneration obligations.
Reason: A generated file does not justify its own retention or prove it matches current inputs.
Requires: [[spec:projector/changes#Generated contribution provenance]] [[spec:projector/changes#Clean evolution]]
Alternative: Ignore generated files or accept their existence as proof.
Tradeoff: Missing relevant provenance remains an obligation without imposing a global provenance audit on unrelated artifacts.
Realizes: [[code:src/change/index.ts#ChangeService]] [[code:src/change/types.ts]]
Evidence: Remove a generator, change an input, retain justified tracked output, and reject stale derivation.
```
