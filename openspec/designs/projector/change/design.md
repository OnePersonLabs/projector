---
projectorDesign: 1
id: projector/change
scope: src/change
---
# Managed change lifecycle

## Contract

Own the accepted baseline, exact prospective target, isolated implementation candidate, and evidence-bound completion. OpenSpec owns requirement merge and validation. The host owns working-current observation, including invalidating an enrolled candidate before lifecycle or subprocess writes.

Applies: [[spec:projector/changes#Separate accepted proposed and actual views]] | {"kind":"path","root":".","prefix":"src/change"} | The lifecycle pins and preserves all three views.
Applies: [[spec:projector/changes#Applicability and independent coverage]] | {"kind":"path","root":".","prefix":"src/change"} | Planning compares executable populations, actual changed artifacts, and declared contributions.
Applies: [[spec:projector/changes#Current evidence and contribution disposition]] | {"kind":"path","root":".","prefix":"src/change"} | Evidence and contribution gates control completion.
Applies: [[spec:projector/changes#Coherent recoverable finish]] | {"kind":"path","root":".","prefix":"src/change"} | Archive and expected-old-ref publication share a durable recovery record.
Applies: [[spec:projector/changes#Clean evolution]] | {"kind":"path","root":".","prefix":"src/change"} | Previous symbol contributions remain explicit through revision and removal review.

## Decision: durable-candidate

Choice: Allocate a linked worktree and candidate branch, retaining the accepted baseline and current/previous target as Git objects and refs.
Reason: Actual implementation can diverge temporarily without redefining accepted requirements or losing prior ownership when a disposable cache disappears.
Requires: [[spec:projector/changes#Separate accepted proposed and actual views]]
Consequential: boundary
Alternative: Edit accepted live documents in place and maintain inverse patches during every revision.
Tradeoff: Worktree allocation has measurable Git and disk cost, but avoids repeated live unsync and preserves ordinary source/build behavior.
Realizes: [[code:src/change/index.ts#ChangeService]]
Evidence: The lifecycle revision/recovery integration tests inspect exact Git refs and preserved same-file content.

## Decision: supported-merge

Choice: Project exact requirement targets using the pinned OpenSpec CLI and apply design deltas through the document module.
Reason: OpenSpec has no exported merge API in the qualified version; its CLI owns requirement semantics and archive validation.
Requires: [[spec:projector/changes#Coherent recoverable finish]]
Consequential: dependency
Alternative: Import undocumented merge internals or recreate OpenSpec merging.
Tradeoff: A bounded subprocess is required during target projection and finish; the implementation counts it as real work and checks exact outputs.
Realizes: [[code:src/change/openspec.ts#OpenSpecAdapter]]
Evidence: Nested add/modify/archive integration uses the real pinned CLI and verifies both spec and design bytes.

## Decision: explicit-gates

Choice: Compare actual changed artifacts, independently extracted changed declarations, and prior symbol contributions with executable applicability, current realization bindings, executed checks, and attributed review.
Reason: Links, checkboxes, selectors, and a successful command alone cannot establish behavioral or architectural correctness.
Requires: [[spec:projector/changes#Applicability and independent coverage]], [[spec:projector/changes#Current evidence and contribution disposition]], [[spec:projector/changes#Clean evolution]]
Consequential: strategy
Alternative: Treat completed tasks and valid document links as sufficient completion evidence.
Tradeoff: Semantic judgments remain bounded host/reviewer work; deterministic code can reject absent, stale, contradictory, or unsupported records but cannot authenticate an invented narrative.
Realizes: [[code:src/change/index.ts#ChangeService]]
Evidence: Missing-scope, unplanned-file, stale-evidence, task-edit, and same-file contribution tests discriminate unsupported completion.

## Realization

Process execution, exact hashes, bounded output, path containment, atomic state writes, and per-change queues inside the shared process owner support the lifecycle decisions. The host's OS-held endpoint owns process lifetime; direct library callers must provide an equivalent single-owner boundary. A stale PID file cannot supply cross-process exclusion.
Realizes: [[code:src/change/io.ts]]
