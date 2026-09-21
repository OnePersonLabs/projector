---
name: projector-review
description: Review an actual candidate change against accepted project meaning, current dependencies, and concrete failure traces.
disable-model-invocation: false
---

# Project-aware review

Retrieve the task's relevant meaning with `$projector`, or resume its actual context ID and inspect currentness. Read the candidate diff and the current code that produces and consumes its facts. An architecture summary is not a completed review.

For each material changed responsibility, trace its inputs, producer, persistence, consumers, registration and behavior checks. Re-run source queries so consumers added after planning are included. Follow applicable typed relationships and conditional rationale; name gaps when static analysis cannot cover dynamic registration or external effects.

Try concrete counterexamples that could falsify the design. Use the project's actual identities, ordering, retries, interruption and stale-state behavior when relevant. Execute available checks or give a reproducible event trace with the exact failing step. A hypothetical risk without a supported path is not a blocker.

Report findings in consequence order. Each finding names the obligation, location, trigger, observable consequence and smallest useful repair. Separate demonstrated violations, changed assumptions, missing producers and unavailable evidence. Include false alarms you resolved only when the distinction changes a decision. State checked obligations and residual uncertainty in plain language.

When a discovery improves future changes, retain it in the lightest existing owner: a scenario, typed relation, selector, transformation or conditional rationale. Use `$projector-change` for accepted meaning. Keep rejected hypotheses as evidence only when their reason prevents repeated work. Reconcile affected retained context after repairs and repeat only the checks their dependencies require.

Recommend completion only for the behavior actually examined. Reviewer confidence, hashes and passing self-authored tests do not establish universal conformance or comparative advantage.
