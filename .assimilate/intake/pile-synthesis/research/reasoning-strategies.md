# Reasoning strategies

**Evidence status:** a compact research comparison and a geometric-reasoning interview, interpreted as research leads. The unsourced numerical comparisons in the compact table and broad interview claims are not promoted to verified performance guarantees.

## Choose the computation that addresses the problem

Different strategies trade accuracy, latency, total inference, memory, and preparation cost. No strategy is uniformly preferable simply because it produces more reasoning or uses more agents.

| Strategy | Useful shape | Main cost or limitation |
|---|---|---|
| Direct response or deterministic tool | Clear, bounded, checkable work. | Limited help for unresolved judgment. |
| Sequential deliberation | A tightly coupled reasoning problem. | Longer latency and possible redundant reasoning. |
| Independent candidate sampling | Multiple plausible routes with a useful selector. | Repeated generation and correlated mistakes. |
| Search or tree exploration | Explicit alternatives, backtracking, evaluable intermediate states. | Branching and evaluation can dominate cost. |
| Parallel drafting and refinement | Independent partial work with bounded integration. | Merge quality, duplicate context, and hidden coupling. |
| Adaptive routing | Heterogeneous task difficulty and known tool/model capabilities. | Routing mistakes and policy-maintenance burden. |
| Symbolic or constraint solver | A trustworthy translation into a formal problem. | The translation itself can be wrong or incomplete. |
| Distillation or task-specific training | Repeated work with amortizable learning cost. | Update cost, transfer limits, and distribution shift. |

These are alternatives and combinations, not a sequence every task should traverse.

## More reasoning is not more information

Extra effort can explore implications of available evidence. It cannot reveal a missing file, discover a hidden external fact without a tool, or establish an unstated requirement by confidence alone.

Before increasing effort, distinguish insufficient evidence from insufficient reasoning. A better query, smaller work contract, deterministic enumeration, or clarifying counterexample may eliminate the bottleneck more effectively.

Do not require a weak first attempt merely to justify a stronger route. Conversely, do not use a stronger route for exact work whose result a tool can establish.

## Geometric-reasoning proposal

The supplied interview emphasizes teaching operations and relationships through structured curricula and perturbations rather than relying only on undifferentiated data volume. A task is changed in a way that should reverse or preserve its answer, and the model is assessed on whether it tracks the meaningful change.

This is relevant to [conceptual dynamics](../concepts/conceptual-dynamics.md) and [learning curriculum](../concepts/learning-curriculum.md). It suggests testing operations under controlled transformations and identifying missing distinctions through failure.

The interview also makes sweeping claims about small models outperforming much larger systems by factors ranging from roughly 60 to 1,000. The supplied material does not provide sufficient matched task, metric, compute, and evaluation detail to treat those figures as a general efficiency comparison. Model-size ratios, benchmark performance, and inference savings are not interchangeable.

“Thinking is geometry” is a research framing, not a complete implementation specification. Existing model representations already involve high-dimensional relationships; naming geometry does not establish a unique mechanism or causal advantage.

## What to retain without the hype

Use controlled semantic perturbations. Separate learned operations from memorized answer patterns. Build curricula that expose consequential distinctions. Compare against strong baselines at matched budgets. Preserve independent evidence and counterexamples.

A neuro-symbolic design can be valuable when symbolic structure makes part of the problem exact. A learned design can be valuable when useful generalization is difficult to enumerate. A hybrid should be evaluated by its behavior and full cost, not by category prestige.

## Relation to the session selector

The selected model and effort define an initial operating choice. The decision function should then select the smallest adequate computation within the user's authority: a direct tool, local reasoning, bounded leaves, or a coordinated work graph.

Work shape can remain sophisticated even when the model is inexpensive. The actual capability of that model, its available tools, and the remaining uncertainty still constrain what can be completed reliably.
