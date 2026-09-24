---
name: explore
description: Explore an idea, investigate a problem, or compare designs in a Projector repository before proposing or implementing a change.
---

1. Read repository instructions and inspect relevant code, accepted requirements, concern designs, and related active changes. Trace affected callers and dependencies instead of treating local similarity as proof of correctness.
2. Clarify the user's desired outcome, constraints, and examples. Answer discoverable questions from the repository; ask only for material intent or tradeoffs that remain unknown.
3. Compare the strongest practical alternatives, identify silent failures and interactions with existing work, and explain consequences in plain language.
4. Present a recommendation with the smallest useful scope and concrete acceptance examples. Distinguish observed facts from proposed behavior.
5. Exploration does not author artifacts or implement code. If the user has also authorized a proposal, continue with $projector:propose using these findings; otherwise report the recommendation and remaining decision.

Completion: the user understands the alternatives and there is enough grounded context to propose a coherent change, or a specific unresolved question is identified.
