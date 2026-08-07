# Historical Evaluation and Research

## Historical and metamorphic evaluation

Before an inferred lens becomes active enforcement, Projector SHOULD evaluate it against repository history and generated perturbations where feasible.

Questions include:

- did candidate examples persist independently?.
- did flagged divergences later receive equivalent fixes?.
- did related artifacts co-change?.
- did migration direction move toward or away from the candidate?.
- are examples copies from one ancestor?.
- did tests/incidents favor an alternative?.
- does the lens reject intentional variants?.
- does it behave sensibly on mutation-generated nearby cases?.

Historical evaluation MUST distinguish exogenous evidence from Projector-endogenous changes. A migration performed because Lens X required it cannot later be counted as independent historical support for X.

Historical/co-change relationships MAY also seed the **possible** band of Relevance Closure when they repeatedly connect semantic neighborhoods that deterministic topology does not explain. Such evidence remains contextual/inferred: co-change alone MUST NOT become an exact dependency, Impact Rule, or authority claim. Planning Surprises provide a stronger feedback signal when actual implementation repeatedly confirms the same omitted relationship.

Shadow-lens evaluation SHOULD report true positives, intentional variants incorrectly flagged, prior defects it might have prevented, transform applicability, and false-positive behavior. Reports MUST pair small-sample percentages with counts and uncertainty instead of treating them as stable rates.

---


## Research boundary

External research is triggered when:

- a pattern may become normative.
- an active architecture concern has a material technology/platform/toolchain decision whose viable options depend on current external facts.
- an accepted decision fires an evidence-refresh trigger.
- alternatives materially differ.
- modernization is proposed.
- platform constraints are uncertain.
- security/support status matters.
- local evidence is contradictory.

Research MUST remain concern-scoped. It is not a periodic repository-wide "best practices" crawl. Current evidence refreshes only the decisions whose material basis changed.

Priority:

1. Official documentation/specification.
2. Formal standards.
3. Maintained first-party reference architectures.
4. Primary research.
5. Mature reference implementations.
6. High-quality engineering reports.
7. Secondary commentary.

Each claim records:

- source locator.
- capture date.
- source date/version where available.
- excerpt hash or concise excerpt.
- confidence.
- applicability.

Offline mode MUST remain functional and lower authority rather than fabricate rationale.

---


