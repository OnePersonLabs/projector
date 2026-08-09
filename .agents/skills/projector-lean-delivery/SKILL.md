---
name: projector-lean-delivery
description: Execute the Projector implementation DAG with high assurance and low token burn. Use for remaining Projector tasks, review/fix loops, task handoffs, worktree orchestration, verification, or workflow decisions in /home/zethj/dev/projector.
---

# Projector Lean Delivery

Optimize for shipped, acceptance-backed behavior per token. Do not pursue process ceremony or theoretical completeness that lacks a realistic Projector failure path.

## Ground rules

- Keep one Sol-medium implementor and one separate Sol-medium continuity reviewer for a delivery phase. Reuse them across repair work; do not make fresh agents reload the same domain each round.
- Use Luna xhigh only for a bounded, low-risk, mechanically specified edit. Use Sol for semantics, authority, state, security, persistence, or cross-module work.
- Treat the task worktree, DAG, and tests as durable context. Do not restate the whole conversation in agent prompts.
- Create no giant review-package copy of a diff. Give the reviewer the worktree, exact commit range, compact acceptance matrix, and report path; let it inspect `git diff` directly.
- Keep the task report concise. Record decisions, failures, commands, SHAs, and residuals; do not paste repeated logs or restate the specification.

## Phase setup

1. Read the DAG node, existing implementation seams, and only the authoritative spec sections needed for the phase.
2. Write a compact context capsule (target: 2–5 KB) with:
   - owned files and package boundaries;
   - existing APIs to reuse;
   - 5–12 acceptance behaviors;
   - material trust boundaries;
   - exact verification commands.
3. Split an XL DAG node into internal vertical slices of at most about five production files each. Preserve one task branch and one continuity implementor so integration stays simple.
4. Before production edits, have the continuity reviewer challenge the acceptance matrix once. Batch missing sibling cases now.

## Material acceptance matrix

Cover only behavior that can affect real Projector outcomes:

- happy path and required fallback;
- stale/current/rebound state;
- missing, duplicate, conflicting, empty, and reordered inputs where set semantics matter;
- forged or caller-controlled authority/proof boundaries;
- deterministic IDs/hashes and cross-platform persistence when relevant;
- failure before mutation and durable recovery when relevant;
- direct public/composition-root path, not isolated unused helpers.

A review blocker requires all three:

1. a direct normative or acceptance requirement;
2. a runnable repro through a supported/public path;
3. a material consequence such as wrong semantic output, stale authorization, data loss, escape, corruption acceptance, or required workflow failure.

Put style issues, speculative hardening, impossible internal misuse, and low-impact overconstraint in a residual backlog. They do not trigger another repair loop.

## Implementation loop

1. Establish RED for the matrix, grouped by vertical slice.
2. Implement the coherent invariant, not one patch per failing example.
3. Run focused tests and affected-package typecheck while iterating.
4. When all slices are green, run one frozen full gate: `pnpm verify`, `pnpm build`, boundaries, diff check, and any task-specific acceptance command.
5. Commit the implementation once.

Do not run the full repository gate after every small edit. Do not reread the entire spec during fixes. Read the issue packet and exact relevant source section only.

## Review and repair

1. The continuity reviewer performs one comprehensive review against the pre-agreed matrix and exact diff. It should finish sibling probes before reporting.
2. Consolidate all material findings into one repair batch.
3. The same implementor fixes the batch with RED/GREEN focused tests and one repair commit.
4. The same reviewer performs a targeted closure review only on the findings and likely regressions.
5. Run the full gate once after closure. Integrate if clean.

Ordinary limit: one comprehensive review and one consolidated repair/closure cycle. Exceed it only for a newly demonstrated material blocker meeting the three-part test. Do not reopen broad review scope during closure.

Use a fresh independent reviewer only at a major release/acceptance boundary, or when the continuity reviewer edited production code (normally forbidden).

## Remaining Projector continuity phases

Prefer continuity across these groups while keeping DAG commits separate:

- Phase A: Tasks 13–14 (architecture commitment and broad analyzers).
- Phase B: Tasks 15–16 (coverage/completion and semantic change execution).
- Phase C: Tasks 17–18 (host integrations and modernization surfaces; parallelize only genuinely independent ownership).
- Phase D: Tasks 19–21 (operations/dogfood, full acceptance, demand-selected adapters).

At each task boundary, update the DAG and compact capsule. Do not discard the phase agents' context.

## Token and time controls

- Prefer `rg`, targeted file reads, and line ranges. Never feed all authoritative modules to every fix agent.
- Prompts should reference local artifacts instead of duplicating them.
- Avoid parallel agents when they duplicate reading or review. Parallelize only independent file ownership with a clear join contract.
- Do not generate prose updates more often than needed for user visibility.
- Do not recreate already passing runtime repros in every subsequent round; keep them as tests.
- Treat full-test runtime as cheap and context ingestion as expensive.

## Completion

Integrate when:

- the agreed acceptance matrix passes;
- no material blocker remains;
- public package/composition paths are wired;
- the frozen full gate passes;
- residual nonblocking hardening is recorded compactly.

Do not seek an abstract proof that no further bug exists. Seek strong evidence that specified real-world Projector workflows are correct and fail closed at material boundaries.
