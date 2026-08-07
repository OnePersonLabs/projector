# Observability, Economics, and Reporting

## Observability, cost accounting, and semantic-model economics

Every run records:

- command and resolved `ExecutionPolicy`.
- canonical config digest.
- engine/toolchain versions.
- Git/worktree/canonical state digests.
- graph revision.
- analyzers and capability failures.
- model calls, purpose, cache/replay status, token/cost metadata where available.
- external snapshot IDs.
- decisions and authority changes.
- transforms/agent operations.
- validations and evidence lanes.
- transaction journal/recovery events.
- duration and errors.

Track at minimum:

- deterministic compute.
- selector/rule/derivation cache hit rate.
- semantic backdating hit rate by assurance class.
- invalidation fan-out and frontier size.
- semantic-identity resolution candidate count, reuse/create/split rates, and later duplicate/overlap findings.
- relevance recall/irrelevant-expansion on evaluated changes.
- direct/governing/consequence/possible context-band sizes.
- planning-surprise rate and accepted learned relationships.
- context tokens vs relevant-subgraph size vs repository size.
- tokens per accepted semantic change.
- deterministic mutation percentage.
- repeated-change marginal cost.
- downstream work avoided by exact/validated equality.
- transaction rollback/recovery rate.
- analyzer failure rate.
- model inference reuse rate.
- source vs projected context tokens by Representation Profile.
- representation-profile overhead tokens and net token delta.
- representation fallback/rejection rate.
- protected-dimension fidelity failures by category.
- task/conformance outcome deltas for compact vs uncompressed context on benchmarked workloads.

Projector MUST also measure the cost of its own semantic machinery:

- active concept count.
- active lens/rule count.
- exceptions per lens/rule.
- average rule pressure per unit.
- canonical-state churn.
- model-maintenance time/cost.
- number of governance entities removed by simplification.

For representation optimization, Projector SHOULD report **Instruction Efficiency** only with an explicit workload-specific numerator. Examples include validated task success, passed conformance obligations, or accepted semantic changes. A useful comparison is:

```text
instruction efficiency = validated behavioral/conformance utility / total instruction/context tokens consumed (including representation overhead and retries)
```

The metric MUST NOT reward shorter output that loses required semantic content. Correctness/preservation is a constraint before token optimization, not a term that can be traded to zero.

The target is not maximum modeling. The target is lower marginal reasoning/review cost at acceptable correctness. A semantic model that grows faster than the use it creates is itself technical debt.

---


## Reporting

Required formats:

- terminal.
- JSON.
- Markdown.
- SARIF for findings/CI where practical.

HTML/graph UI is optional post-core.

Every report finding answers:

- what happened.
- what semantic role was inferred.
- which canonical identity was resolved or why a new one is justified.
- why the item entered the relevant subgraph when reporting a change.
- which lens/rules apply.
- why anomalous.
- evidence and counterevidence.
- confidence.
- smallest safe repair.
- Relevance Closure and affected Impact Closure, when applicable, without conflating them.
- any predicted-versus-observed Planning Surprise.
- deferral consequence.
- applicable architecture concern/decision chain when material.
- why relevant existing decisions were or were not reconsidered.
- material preference influences on a recommendation.
- coverage caveat.

---


