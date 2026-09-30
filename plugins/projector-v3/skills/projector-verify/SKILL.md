---
name: projector-verify
description: Check whether an implementation does what the Projector model says. Review a change or selected behavior, find contradictions or missing behavior, and report the evidence and remaining gaps.
---

# Verify behavior against meaning

Use this skill for an actual candidate change or selected current behavior. Start with the task's relevant accepted meaning and current source. Reuse a current context ID if the main [$projector](../projector/SKILL.md) workflow already retrieved it. Otherwise retrieve focused context. For a candidate change, read the complete actual diff, including committed, staged, unstaged and relevant untracked work. For a behavior audit, inspect the selected current implementation even when there is no diff. In both cases, read the code that produces and consumes the relevant facts. An architecture summary alone is not a review.

Follow [the shared verification procedure](../../references/verification-procedure.md) automatically when selecting tests, maintaining existing assertions and checking the settled result. Its qualification provenance and limitations remain attached to that procedure. Do not infer protection from a passing command with empty selection or from a check that does not exercise the changed behavior.

For each material changed responsibility, trace its inputs, producer, persistence, consumers, registration and behavior checks. Re-run source queries so consumers added since planning are included. Follow applicable typed relationships and conditional rationale. Identify gaps where static analysis cannot cover dynamic registration or external effects. Compare implementation with accepted concepts, requirements, scenarios and decisions. Test assumptions against concrete counterexamples involving identities, ordering, retries, interruption and stale state where relevant.

Use `projector audit --scope <path> --context <context ID>` when coverage or unresolved-work evidence informs review. Distinguish current observation from retained reasoning, observed violations from unavailable checks, and changed assumptions from contradictions. Missing implementation alone does not require a model revision. A recommendation does not authorize a write or establish an executable transform. Conflicting accepted rules need canonical resolution through [$projector](../projector/SKILL.md).

Run available checks or provide a reproducible event trace with the exact failing step. A hypothetical risk without a supported path is not a blocker. For consequential authority, persistence or architectural changes, obtain independent review through the host's normal review route. Give the reviewer the target, complete baseline difference, accepted meaning, test decisions, results and limits. Ask for missing consumers, counterexamples, incomplete migration and the strongest simpler alternative. Resolve material findings and refresh checks affected by repairs.

Report findings in consequence order. Name the obligation, location, trigger, observable consequence and smallest useful repair. Separate demonstrated violations, changed assumptions, missing producers and unavailable evidence. State checked obligations, executed cases, actual review attribution and residual uncertainty. Recommend completion only for the behavior examined. Reviewer confidence, hashes and passing self-authored tests do not establish universal conformance.

When a discovery improves future changes, retain it in the lightest existing owner: a scenario, typed relation, selector, transformation or conditional rationale. Revise accepted meaning through [$projector](../projector/SKILL.md) when the user intends that revision. Keep a rejected hypothesis as evidence only when its reason prevents repeated work. Reconcile affected context after repairs and repeat the checks whose dependencies changed.
