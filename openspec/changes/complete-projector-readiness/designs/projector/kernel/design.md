---
designDelta: 1
target: projector/kernel
baseline: 2d704a2f3dbd7a79cbc70242d0b604f5fb5f8c7dfb2cc56c213c15d194be37d9
---
# Projector readiness design delta

## Replace: contract

```markdown
## Contract

The kernel serves explicit revision/current queries, identifies worktrees by canonical Git metadata and incarnation, and records in-flight cooperation before acknowledging a mutation. Currentness is conditional on lifecycle enrollment and the acknowledged writer contract in the selected or explicitly isolated checkout. Filesystem watchers and hook delivery are not proof. Unknown commands invalidate observation before running; a checkpoint independently inventories and seals the candidate.

Applies: [[spec:projector/observation#Honest read modes]] | {"kind":"path","root":".","prefix":"src/kernel/"} | Read modes and mutation admission own currentness.
Applies: [[spec:projector/observation#Coalesced publication]] | {"kind":"path","root":".","prefix":"src/kernel/"} | Dirty generations and shared extraction preserve correctness and cost.
Applies: [[spec:projector/observation#Shared owner and bounded workers]] | {"kind":"path","root":".","prefix":"src/index/"} | Worker queues and index resources must be bounded.
Applies: [[spec:projector/observation#Disposable cache recovery]] | {"kind":"path","root":".","prefix":"src/index/"} | SQLite is a reconstruction cache rather than authored authority.
```

## Replace: decision:qualified-candidates

```markdown
## Decision: qualified-candidates

Choice: Enroll the selected checkout with one lifecycle owner or an explicitly isolated worktree with a cooperating-writer marker; durably record acknowledged batches and require independent checkpoints after observation gaps.
Reason: The checkout location cannot establish observation; enrollment, acknowledged intervals, and independent checkpoints establish the managed contract.
Requires: [[spec:projector/observation#Honest read modes]] [[spec:projector/observation#Disposable cache recovery]]
Consequential: strategy
Alternative: Treat watcher quiet time or expected file lists as a complete observation barrier.
Tradeoff: Arbitrary shell writes require a broad checkpoint. Ordinary settled managed reads remain cheap.
Realizes: [[code:src/kernel/index.ts#Kernel]] [[code:src/index/git.ts]]
Evidence: Kernel tests cover in-flight writes, unknown intervals, stale jobs, historical reads and corrupt-index recovery.
```
