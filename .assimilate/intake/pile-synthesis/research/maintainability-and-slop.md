# Maintainability and slop

**Evidence status:** synthesis of the supplied papers and engineering discussion. Reported numerical results below belong to their studied versions, models, tasks, and protocols; they are not measurements of this pack or the user's current Codex setup.

## Two distinct degradation signals

A project can accumulate structural erosion: complexity concentrated in large functions, duplicate behavior, unnecessary wrappers, and migration residue. It can also accumulate subtle semantic drift: different validation, error types, defaults, ownership, or ordering despite superficially clean code.

A static cleanliness score and a passing task are therefore incomplete measures of maintainability. The cost and reliability of subsequent changes matter.

## SlopCodeBench

The supplied paper describes 36 problems with 196 checkpoints. Agents repeatedly extend their own prior code from evolving external behavior specifications. Hidden tests remain unavailable to the agent; the workspace carries forward instead of being replaced by a reference implementation.

The evaluation separates strict success including regressions, isolated success on the current checkpoint's non-regression tests, and core success on explicitly described behavior. This prevents partial current-feature progress from being confused with a fully correct trajectory.

Its structural metrics distinguish complexity concentration from verbosity and cloning. The verbosity mechanism includes 137 targeted AST rules plus structural duplication; these are proxies for selected undesirable patterns, not a complete definition of software quality.

The reported analysis finds erosion increasing in 77% of trajectories and verbosity in 75.5%. Quality-oriented prompts improve some initial quality levels but do not generally eliminate iterative degradation, and can trade correctness or cost for cleaner structure. Those findings argue for longitudinal evaluation, not a universal claim that all current agents inevitably fail.

The historical-repository comparison is informative but is not a randomized comparison of matched humans and agents performing the same work. Human repository histories have different tasks, selection effects, and assistance histories. Do not interpret the reported difference as an isolated causal effect of authorship.

The exported paper has missing mathematical symbols and flattened tables. This synthesis does not reconstruct absent formulas or treat mangled cells as reliable numerical evidence.

## CodeThread

CodeThread constructs two-step tasks and compares downstream agent work on human-authored versus agent-authored predecessor code. The supplied study covers four benchmarks and four agents, with effects varying by model and task type.

The important result is not merely a static complexity difference. Input-validation and error-handling drift, downstream edit size, and task difficulty help distinguish divergent outcomes where ordinary maintainability metrics do not explain much of the gap.

Examples include substituting an exception type, adding an input gate, or using a default that changes behavior. Such differences may survive into the next change without looking architecturally dramatic.

The study's two-step design cannot directly establish long-horizon accumulation. Filtering out cases where the first patch already solves the follow-on issue can affect the population. Model-based drift attribution is informative but is not the same as a randomized intervention on the suspected cause.

## Practical consequences

Specify consequential boundaries and their reasons. Preserve one clear canonical representation for a recurring concept. Turn repeated failures into executable checks with explanatory errors. Exercise failure behavior, invalid inputs, cancellation, partial completion, ordering, and relevant compatibility, not only happy paths.

Use **small semantic scope with sufficient redesign**, rather than treating minimum diff size as a universal objective. A feature may expose a bad abstraction that deserves one coherent migration instead of another exception.

Keep instructions lean. A long repository overview can duplicate discoverable context and increase reading cost; consequential unusual constraints and targeted disclosure are more defensible. The supplied material cites an instruction-file study as a caution, but its reported results do not establish that all `AGENTS.md` content is harmful.

Measure repeated corrections, widening change surfaces, false-positive review churn, duplicate concepts, and cleanup left behind. “All tests pass” and “the reviewer found many issues” are not standalone success measures.

## What this does and does not support

The research motivates [semantic control](../concepts/semantic-control.md), independent contracts, and [coupled evolution](../experiments/coupled-evolution.md). It does not establish that a persistent neural model, a particular swarm, or more elaborate planning is the best remedy.

**Primary source pointers preserved from the archive:** SlopCodeBench, `arxiv:2603.24755v2`; CodeThread, `arxiv:2606.21804v1`. Source accounting and original locations are in the [audit](../audit/SOURCES.md).
