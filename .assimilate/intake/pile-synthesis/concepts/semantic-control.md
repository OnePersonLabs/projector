# Semantic control

`§semantic-control` · A closed loop between governing meaning, proposed changes, and observed reality.

## The loop

```text
Accepted intent and current conception
                  ↓
Relevant questions, constraints, and evidence
                  ↓
Proposed semantic change
                  ↓
Executable construction and verification plan
                  ↓
Candidate repository state
                  ↓
Independent observations and acceptance checks
                  ↓
Reconcile conception, implementation, and remaining uncertainty
```

The loop can be small. A trivial change does not need a ceremony that costs more than the change. The responsibilities still exist even when one person, one model, and ordinary tools fulfill them.

## Intended, specified, and implemented

Before adding mechanisms, compare three views of Projector itself:

**Intended:** what it is supposed to accomplish and preserve.

**Specified:** what its governing documents and machine-readable contracts actually require.

**Implemented:** what the repository and runtime actually do.

A mismatch can be a specification defect, an implementation defect, a changed intention, or an incomplete observation. Treating every mismatch as “write more code” obscures the actual problem.

This pack does not establish the present implementation state because the repository was not supplied. Claims that a named mechanism already exists require a fresh repository inspection.

## Relevance before impact

Relevance asks which meanings, obligations, relationships, and observed artifacts must be understood to decide the change. Impact asks what must change after the decision is made. These sets overlap but are not identical.

A planner should distinguish confirmed relevance, plausible candidates, and unknown frontiers. A dependency query can establish exact reference membership for a particular representation; it does not prove that every behavioral obligation has been discovered.

When a premise changes, invalidate the conclusions that depend on it. Do not discard unrelated evidence simply because a new commit exists. Conversely, unchanged edited-file hashes do not establish that a plan's assumptions remain valid.

## Three graphs, three jobs

A useful conceptual separation is:

| Graph | Question |
|---|---|
| Semantic relationships | What means, owns, depends on, constrains, or justifies what? |
| Cognition and evidence work | What must be known, decided, or checked, and by which capability? |
| Construction dependencies | What transformations must occur, in what valid order? |

These need not be three graph databases. They prevent conflating information structure, reasoning responsibility, and execution order.

## Consolidation as part of completion

A passing feature can leave duplicated ownership, abandoned adapters, contradictory rules, stale registrations, and tests for behavior that no longer exists. Completion includes reconciling or retiring those residues within the change's justified scope.

This does not authorize unlimited cleanup. A nearby imperfection must still earn work under [work economics](work-economics.md). The objective is a coherent accepted result, not an expanding campaign against everything aesthetically imperfect.

## Semantic hardening

An uncertain requirement should be challenged with concrete distinctions: edge cases, competing ownership assignments, gain-with-loss alternatives, changed premises, and plausible counterexamples. Ask the developer the smallest question whose answer would materially change the design.

Do not force a false binary. “Neither,” “both,” or a new formulation may be the best answer. A developer's correction is evidence about intended meaning, not proof that a proposed mechanism implements it.

The strongest retained outcome is a conditional decision with its reason and reopening condition. Repeated explanation is not additional independent support.

## Verification and reconciliation

Independent checks may include executable contracts, behavior traces, model-independent selectors, regression scenarios, deliberately changed premises, and human assessment of purpose. A verifier must be able to contradict the candidate instead of simply checking agreement with its own generated plan.

Failure should have scope. A failed adapter test may require revising that adapter and its dependents, not reconstructing the whole architecture. A newly discovered shared assumption may justify broadening the plan. The evidence determines which.

**Continue:** [Materialization compiler](materialization-compiler.md) addresses precise construction. [Evidence and review](evidence-and-review.md) explains what makes a check informative.
