# Session-relative routing

**Status: new design proposal for the current request.** This is not an installed scheduler, a benchmark result, or a claim that ordinary Codex configuration already enforces the whole policy.

## The missing function

The session selector should choose a **default capability and spending posture**, not a fixed hierarchy of permanent agents. The route should then depend on the task and evidence available.

```text
route(task, evidence, selected_model, selected_effort, runtime_capabilities)
    → tool program, context packet, model/effort, work shape, checks, stop rule
```

A large input is not automatically a hard reasoning problem. A trivial-looking edit is not automatically low risk. Decide what remains uncertain after deterministic inspection and a bounded handoff.

## Meaning of the two controls

**Selected model:** the root model and the default child model. Under the proposed policy, do not silently invoke a more expensive model. Using a different cheaper model is optional and should be a qualified route, not a permanent requirement. Model families do not form a perfectly reliable cost ordering across all settings and tasks.

**Selected effort:** the root's chosen effort and the initial child default. It is not necessarily a ceiling for every child. Increase or decrease a child's effort only to address a specific remaining reasoning need and only when the chosen model supports that effort.

Thus a Luna-medium session can use Luna leaves at supported efforts, tools, external memory, and a bounded work graph. It does not need an Astra manager to be organizationally sophisticated. But more Luna calls or higher effort are not guaranteed to solve a task outside its practical capability.

An Astra session can directly handle a tightly coupled design question while avoiding model delegation for exact work. The expensive root's own inference is not erased by choosing cheaper children.

## The trivial-work fast path

For a commit-and-push request, inspect the current repository state, respect the intended changes and remote, and use ordinary Git commands. No planning committee, scout hierarchy, or permanent review role is needed.

The selected root still has to process a natural-language request. To avoid Astra inference for that request, select Luna before sending it, or run a deterministic command outside the model. A prompt or child configuration cannot retroactively remove the root work already performed.

Do not translate “trivial” into blind execution: unresolved merge conflicts, unexpected staged files, hooks, or a changed remote can make the evidence nontrivial. Handle the actual state without expanding into unrelated work.

## Native Codex foundation

Current documentation says unspecified child model and effort inherit the parent. The current defaults are `agents.default_subagent_model` and `agents.default_subagent_reasoning_effort`; explicit spawn choices can override defaults. Custom-role files can also pin settings. For selector-driven behavior, audit those overrides instead of installing a fixed Astra/Terra role hierarchy. [O1] [O2]

This proposal does not prescribe speculative feature flags or assume a particular installed version. Inspect the actual exposed spawn schema, model/effort support, tools, and effective settings. A flat parent-managed pool is a valid fallback when recursive orchestration is unsupported. Do not assume every selected model can itself operate every subagent tool. [O1] [O2]

## Decision policy

Use tools for exact inspection, enumeration, hashing, transformations, checking, and bookkeeping. Keep work local when a handoff would cost more than finishing it. Delegate a bounded result when it reduces relevant uncertainty or protects context at an acceptable integration cost.

Parallelize only when the shared contracts and read/write assumptions permit independent progress, and the combined route is likely to earn its overhead. Keep concurrency, total attempts, output volume, and retries bounded across the whole job. A cheap model with unlimited fan-out is not a cheap policy.

Pass evidence addresses and only the necessary context. Workers write durable results and return small receipts. The coordinator opens unresolved decisions and relevant evidence rather than ingesting every worker's full output.

When a route fails, first distinguish missing evidence, a bad work boundary, a tool error, an inadequate verifier, and insufficient reasoning capability. Do not repeatedly reassign the same ambiguous task to a stronger model without fixing its information deficit.

A consequential unresolved issue can be returned as a precise escalation request. Complete and preserve independent verified work first. Never silently raise model spending or lower acceptance criteria to conceal the blockage.

## Minimal instruction candidate

This text is a candidate policy to evaluate, not a hard security or quota control:

> Use the user's selected model and effort as the defaults for this session and its children. Do not silently use a more expensive model. Adjust a child's supported effort only for a specific task need. Prefer deterministic tools for exact work, and finish locally when delegation would add more overhead than value. Delegate bounded outcomes with scoped evidence and explicit checks; parallelize only independent work that earns its total cost. Keep intermediate artifacts outside the parent context and return compact result handles. Bound concurrency, attempts, and retries across descendants. Surface unresolved capability limits without weakening acceptance criteria or crossing the user's spending choice.

Do not add this beside contradictory fixed role instructions. Replace the conflicting policy rather than creating a larger instruction pile.

## Soft policy versus hard enforcement

Natural-language instructions guide decisions. They do not prove that a forbidden model cannot be launched. A hard boundary requires enforcement on every enabled launch path, including native descendants and any `codex exec` escape route, with effective model/effort checked rather than merely requested.

Only add that enforcement layer when a hard guarantee is actually needed. Do not build an orchestration framework merely to express defaults that native inheritance already provides.

## Usage accounting

OpenAI describes included Work/Codex usage as a shared allowance, with consumption affected by model, task, context, output, and settings. Switching models does not replenish that pool. Lower-cost routes can stretch usage, but “Astra quota” should not automatically be interpreted as a separate bucket. [O3]

Treat API prices, token totals, and included-allowance consumption as different measurements unless a documented mapping is available. No savings percentage is established by this pack.

## How to decide whether the policy helps

Compare complete results for a trivial Git request, a large mechanical edit, a bounded extraction, a contradictory-document synthesis, and a coupled architecture change. Record actual selected and effective settings where observable, total model work, retries, integration, repair, elapsed time, and missed obligations.

Use a competent selected-model single-owner baseline. The router earns its place only by improving outcomes or total cost, not by producing an impressive tree of workers.

### Official references checked September 16, 2026

[O1]: https://learn.chatgpt.com/docs/agent-configuration/subagents
[O2]: https://learn.chatgpt.com/docs/config-file/config-reference
[O3]: https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex

[O1] Subagents. [O2] Configuration Reference. [O3] Managing usage with GPT-6 Astra in Work and Codex.
