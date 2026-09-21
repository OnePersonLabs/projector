# Work economics

`§work-economics` · Decide whether useful work is worth doing now, and when to stop.

## Core

Relevance does not automatically authorize work. A concern can be real while the proposed response is premature, too expensive, or less valuable than a smaller intervention.

Optimize marginal verified progress over a useful horizon, subject to the user's constraints. Returns can include user value, risk reduction, future work eliminated, reusable capability, information, or options preserved. Costs include inference, tools, latency, context reconstruction, review, repair, coordination, and permanent maintenance burden.

These are often vectors, not reliably commensurable quantities. Apply hard constraints first, then compare plausible choices using explicit assumptions. Do not produce decorative precision for uncertain estimates.

## A proportional decision loop

For obvious low-risk work, use a fast path. For consequential work, identify the decision, expected benefit, relevant costs, timing, and uncertainty. Ask whether a cheap observation could actually change the decision.

Useful dispositions include execute, probe, defer, bundle, skip, and escalate. Each can be a good outcome.

A probe should target the uncertainty that could flip the decision. A deferral should carry an activation condition, such as an API stabilizing, a second consumer appearing, or a repeated failure becoming material. “Later” without a trigger is not much of a scheduling policy.

## Economics applies to evidence gathering

Research, planning, adversarial review, and evaluating the economics of a choice are work too. Stop gathering evidence when additional information is unlikely to change the action enough to justify its cost.

Bound costly investigations with an output, a stopping condition, and a fallback. A failed probe can be valuable if it rules out an expensive commitment. An endless succession of increasingly elaborate probes can be worse than a reversible implementation.

## Amortization and timing

An expensive action may be justified if it eliminates repeated work across many future changes. The benefit depends on actual recurrence, a plausible horizon, and maintenance costs. A speculative future reuse story does not automatically justify infrastructure.

Batch related changes when it reduces repeated migration or review without hiding unacceptable delay. Do not batch independent decisions into a large irreversible commitment merely to make accounting look efficient.

A backlog is a portfolio of contingent opportunities. Keep activation predicates and dependency information where they improve decisions; avoid maintaining a detailed ledger of hypothetical work that nobody will use.

## Adapt without thrashing

Use observed outcomes to refine expectations, including failures and repair. Avoid switching policy after every noisy run. A route that performed poorly because its input was incomplete should not be misdiagnosed as a universal model failure.

Preserve enough attribution to distinguish packet quality, worker capability, tool reliability, integration difficulty, and verification defects. This need not become exhaustive surveillance or a second project-management system.

## Assimilation at minimum permanent weight

An external repository can offer a useful invariant, heuristic, validator, transform, fixture, or design distinction without warranting import of its entire architecture.

Identify the advantage, test it cheaply, and implement the smallest native mechanism that preserves it. “Assimilate the idea” can be the right result. No adoption is also legitimate when the existing system already captures the benefit.

Independent review, graph tooling, learned context, and multi-agent orchestration all face this same test. Their sophistication is not evidence of their value.

## Relation to execution

[Quality-frontier execution](quality-frontier-execution.md) applies these principles to model, effort, context, and work topology. Work economics is the broader discipline: it also governs what not to build, when to learn more, and when a partial but coherent deliverable is better than unfinished ambition.
