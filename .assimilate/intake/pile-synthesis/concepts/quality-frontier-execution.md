# Quality-frontier execution

`§quality-frontier-execution` · Choose the work shape and the capability together.

## Core

The route is not just a model name. It combines **model, reasoning effort, context scope, tools, work boundaries, execution topology, and verification**.

The goal is a verified result at acceptable total cost, not the cheapest first attempt. A low-cost worker whose output requires substantial reconstruction and rewriting may be the expensive route. An expensive owner that delegates a trivial command can also waste effort.

The primary leverage is to make less work require expensive judgment by resolving ambiguity, preserving reusable understanding, and using deterministic tools where possible.

## Delegate residual uncertainty, not a task label

“Extraction,” “review,” and “implementation” are not reliable capability classes by themselves. Extracting a literal field is different from reconciling conflicting architecture proposals. A tiny patch may change an important ownership contract. A large mechanical rewrite may require little new reasoning.

Assess the uncertainty **remaining after the handoff**. A useful bounded task supplies the governing behavior, current evidence, permitted write surface, unresolved decisions, and checks. Preparing and integrating that task must cost less than simply finishing it locally, or provide a justified quality or latency gain.

## Two gates for parallelism

Semantic independence makes a split eligible: workers can proceed without independently deciding the same unsettled contract or relying on incompatible assumptions.

Economic benefit makes the split worthwhile: expected speed or quality gains exceed setup, duplicate context, contention, verification, integration, and repair.

A worktree isolates files. It does not create semantic independence. Delegation, parallelism, worktree creation, and changing models are separate choices. A sequential specialist may help; parallel test processes may need no model at all.

## Session selection as policy

The current user-selected model and effort should influence default spending and planning behavior. A deliberately selected inexpensive session should not silently appoint a more expensive standing manager.

This does not mean that an inexpensive session loses access to sophisticated external-memory workflows. Scripts, bounded tasks, stable artifacts, evidence queries, and explicit uncertainty are organizational tools, not privileges of a particular model family.

The concrete new policy and current native configuration caveats are in [session-relative routing](../orchestration/session-relative-routing.md). That proposal replaces fixed role-to-model assignments rather than adding another hierarchy on top of them.

## Competence is not silently rationed by remaining quota

Do not degrade the acceptance criteria because allowance is low. A manual resource choice can narrow scope, defer optional work, or request a bounded result. It should not turn unverified work into accepted work.

The normal route should respond to task evidence, capabilities, user preferences, and measured outcomes. Remaining allowance alone does not make a weaker route competent. A stronger route is also not justified merely because allowance is available.

When the selected route cannot settle a consequential issue, preserve completed work and report the precise unresolved question. Request a change in spending authority rather than quietly crossing it or manufacturing confidence.

## Account for the whole route

Charge a route for worker execution, packet preparation, duplicate investigation, verification, integration, owner corrections, and later attributable repair. Keep latency, quota, direct cost, and human attention visible instead of inventing an unsupported conversion into one number.

Qualification should be scoped to actual task families and environments. A model that handles one bounded migration well is not thereby qualified for architecture convergence. Instructions that work for one receiving model may regress another.

Measure full outcomes against a competent no-delegation baseline. Retire routing machinery whose recurring burden exceeds its demonstrated benefit.

## Minimal implementation principle

Begin with native capabilities, a small policy, and deterministic helpers. Add a scheduler, persistent route database, model-specific roles, or custom execution backend only when a recurring failure or useful measured gain warrants it.

A context manifest and a few clear work contracts can be enough. A new “economics engine” that spends more deciding than the task costs is itself a failed route.
