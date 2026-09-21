# Harnesses and work graphs

**Evidence status:** engineering accounts and practitioner transcripts. Their mechanisms are useful candidates; their strongest generalizations are not automatically established experimental laws.

## Long-running work needs continuity

The supplied Anthropic engineering account separates initialization from later coding sessions. The initializer creates a usable environment and explicit feature goals. Later sessions inspect progress, choose bounded work, verify behavior, and leave a recoverable state.

The useful mechanism is not the literal requirement to maintain hundreds of feature records. It is preventing repeated environment reconstruction, premature completion, and untested handoffs across context windows.

Browser-level checks can reveal failures missed by unit tests or a successful HTTP response. Tools have blind spots too. A check only establishes what its observation mechanism can actually see.

## Incremental work is not tiny-diff dogma

Bound a change by a coherent purpose and acceptance result. A structural repair can require several coordinated edits. Reducing every operation to the smallest textual change can preserve a bad abstraction indefinitely.

The four-stage practitioner workflow is to define product success, establish architecture, design the program enough to resolve consequential interfaces, and then build vertical slices. The amount of design should be proportional to uncertainty and stage, not a mandatory waterfall.

Keep human understanding of product logic and consequential decisions in the loop. A software factory can produce patches faster while making ownership and causality harder to understand.

## Knowledge graphs versus work graphs

A knowledge graph represents relationships among entities, claims, responsibilities, and evidence. A work graph represents dependencies among activities such as investigation, implementation, checks, and integration.

They can inform each other but are not interchangeable. A dependency graph does not automatically create a good schedule; a planner's task graph does not establish the truth of its source knowledge.

The familiar split-and-merge pattern is useful only when branches are independent enough and a reliable merge exists. Short, deterministic work usually does not need it.

## The verification bottleneck

The supplied graph-workflow transcript describes a cheaper reviewer flagging intentional code as defective, while a stronger reviewer produced fewer but more relevant findings. This is an anecdote, not proof that reviewers should always use the strongest model.

Its useful lesson is to evaluate review precision and downstream repair, not comment count. Repeating a weak verification pattern across a graph can multiply error rather than confidence.

Standalone deep review, embedded task checks, and recurring monitoring serve different purposes. Do not run the heaviest review after every incomplete intermediate step.

## Harness controls and recovery

Hooks, lint rules, type checks, contract tests, and constrained tool surfaces can prevent known classes of error. They are useful when they enforce a real property and produce actionable feedback.

The anti-slop transcript's “never fix bad output” rule is best retained as a conditional recovery strategy: diagnose a poisoned run or bad setup, correct the cause, and restart from a clean checkpoint when that is cheaper than repair. It is not a universal reason to discard good work after a local defect.

Detailed specifications can reduce ambiguity, but exact paths and line numbers can become stale. Bind operational details to current evidence. Preserve intent and rationale rather than allowing the specification to become another unchecked transcript.

## A clean environment is an input to future work

Future agents learn from the repository examples they see. Clear ownership, a canonical schema, useful error messages, and one representative implementation can reduce repeated interpretation.

Context is not literal parameter fine-tuning, even when practitioners use that metaphor. It influences the current run; any persistent learning mechanism is a separate claim.

## Adoption principle

Use native agent capabilities, ordinary tools, explicit checkpoints, and a small amount of durable state before adopting a graph framework. If the recurring workflow needs durable execution, recovery, constrained transitions, or high-volume scheduling beyond what native tools supply, that is a concrete reason to add infrastructure.

The desired throughput is verified integrated progress. A busy graph, a large progress file, or a sophisticated harness is not the outcome.
