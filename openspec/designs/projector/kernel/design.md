---
projectorDesign: 1
id: projector/kernel
scope: src
---
# Shared revision and observation kernel

## Contract

The kernel serves explicit revision/current queries, identifies worktrees by canonical Git metadata and incarnation, and records in-flight cooperation before acknowledging a mutation. Currentness is conditional on writers using the allocated candidate contract. Filesystem watchers and hook delivery are not proof. Unknown commands invalidate observation before running; a checkpoint independently inventories and seals the candidate.

Applies: [[spec:projector/observation#Honest read modes]] | {"kind":"path","root":".","prefix":"src/kernel/"} | Read modes and mutation admission own currentness.
Applies: [[spec:projector/observation#Coalesced publication]] | {"kind":"path","root":".","prefix":"src/kernel/"} | Dirty generations and shared extraction preserve correctness and cost.
Applies: [[spec:projector/observation#Shared owner and bounded workers]] | {"kind":"path","root":".","prefix":"src/index/"} | Worker queues and index resources must be bounded.
Applies: [[spec:projector/observation#Disposable cache recovery]] | {"kind":"path","root":".","prefix":"src/index/"} | SQLite is a reconstruction cache rather than authored authority.

## Decision: worker-owned-sqlite

Choice: Execute parsing and synchronous node:sqlite calls in at most two persistent worker threads; serialize each root and rotate queued roots fairly.
Reason: Blocking database and parsing work must not stop another root's coordinator or retain locks across agent reasoning.
Requires: [[spec:projector/observation#Shared owner and bounded workers]]
Consequential: strategy
Alternative: A separate database sidecar or synchronous coordinator database.
Tradeoff: Worker messaging has a measurable cost, but avoids a native binding installation and coordinator stalls.
Realizes: [[code:src/index/index.ts#IndexPool]] [[code:src/index/worker.ts]] [[code:src/index/types.ts]]
Evidence: Host qualification measures concurrent coordinator progress; resource tests exercise failure and background-independent work.

## Decision: qualified-candidates

Choice: Allocate a linked Git worktree with a cooperating-writer marker; durably record acknowledged batches and require independent checkpoints after observation gaps.
Reason: An arbitrary editor worktree cannot promise that all mutations have been observed.
Requires: [[spec:projector/observation#Honest read modes]] [[spec:projector/observation#Disposable cache recovery]]
Consequential: strategy
Alternative: Treat watcher quiet time or expected file lists as a complete observation barrier.
Tradeoff: Arbitrary shell writes require a broad checkpoint. Ordinary settled managed reads remain cheap.
Realizes: [[code:src/kernel/index.ts#Kernel]] [[code:src/index/git.ts]]
Evidence: Kernel tests cover in-flight writes, unknown intervals, stale jobs, historical reads and corrupt-index recovery.
