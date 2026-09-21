# Evidence and review

`§evidence-and-review` · Make a result challengeable without building a permanent committee.

## Core

A proposal is not strengthened simply because several agents repeat it. Evidence is useful when it can reveal a specific failure, discriminate between alternatives, or independently establish an obligation.

Separate observation, interpretation, and judgment. These can be called witness, router, and judge responsibilities, but the names do not require three agents or three services. Independence comes from information and authority boundaries, not job titles.

## What makes a check independent

A test derived solely from a generated implementation can certify the implementation's own misunderstanding. A reviewer primed with the author's conclusion can reproduce the same assumption. Multiple models using the same flawed fixture are not independent evidence of correctness.

Use external contracts, independently curated cases, actual behavior, held-out scenarios, and explicit counterexamples where they are appropriate. Record the basis of consequential claims. A reviewer should be able to reject a candidate for a reason the author did not anticipate.

## Constrained adversarial review

For a consequential unresolved choice, distinct review responsibilities can challenge assumptions, construct the strongest rival, and inspect what would falsify the preferred design. Consensus may emerge, but it is an outcome rather than an objective to force.

Bound the review. Require concrete objections and evidence, not stylistic preferences or endless new hypotheticals. A structured verdict can distinguish supported, unsupported, contradicted, and insufficient evidence. Abstention is preferable to invented certainty.

A metajudgment should assess the evidence and scope of disagreement, not tally votes. Separate review before a commitment from checks after implementation. Passing the first does not imply passing the second.

## Borrowing without importing a bureaucracy

The retained consensus-review research suggests useful donor ideas: independent perspectives, restricted verdicts, explicit abstention, evidence-linked objections, and mirrored pre/post checks.

These ideas do not justify a fixed five-agent review for every edit. The cited donor repository and commit are research provenance, not a verified current dependency. The smallest useful import may be one acceptance scenario or one review invariant.

## Perturbation as an oracle

A useful review asks how conclusions should change when a premise changes. Preserve the words but alter authority; change names without altering obligations; introduce a consumer after planning; reverse a formerly governing constraint.

Check both positive sensitivity and negative stability. Catching a violation is valuable, but so is allowing a legitimate improvement instead of blocking all change.

These probes complement ordinary tests and static analysis. They do not supply complete semantic coverage.

## Verification backpressure

When candidate generation outruns reliable integration and checking, more workers can increase the queue without increasing accepted progress. Limit work admission by the actual verification bottleneck.

Keep results bounded and distinguish ready, blocked, invalidated, and accepted work. Resolve shared-contract questions before multiplying implementers that depend on them.

The relevant throughput is accepted coherent change, not number of generated patches or review comments.

## Calibrating evaluators

Use deterministic checks when the property is mechanically decidable. Use model judgment for genuinely semantic or subjective properties, with examples, references, order control, and comparison against human judgments where warranted.

Do not present a judge's confidence as a calibrated probability without evidence. Inspect false positives, false negatives, ambiguous tasks, and grader defects. Stronger models can still share assumptions or reward fluent explanations over correct behavior.

The research implications and specific reported studies are collected in [evaluation engineering](../research/evaluation-engineering.md).

## Blocking authority and formalization

An objection should block a change only when it has an applicable normative basis, sufficient current evidence, and a basis that has not been falsified. Otherwise it is advisory, unresolved, or an explicit assumption. This prevents an ungrounded concern from holding the change indefinitely.

Useful opposing perspectives include natural responsibility boundaries and proportional containment of complexity. Their objections should terminate in concrete criteria and evidence, not a ceremonial demand for unanimity or a binary judgment of “beauty.”

For a small consequential kernel, link normative prose to an executable semantic object and mechanical property checks. Formal verification can prove properties of that object; it cannot by itself prove that the object faithfully expresses the intended prose. Whole-spec duplication into a formal language is not required. Escalate formalization only where the invariant and expected value warrant it.
