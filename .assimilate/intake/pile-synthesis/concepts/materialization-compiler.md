# Materialization compiler

`§materialization-compiler` · Turn a semantic decision into a precise, state-bound change program.

## Core

Separate two compilations: **intent into a semantic change**, then **semantic change into repository transformations**. The first determines what should be different and what must remain. The second resolves concrete targets, construction order, checks, and invalidation conditions.

This is a responsibility boundary, not a requirement to build two large compiler frameworks before doing useful work.

A prose instruction such as “replace the implementation and update consumers” leaves the difficult questions unresolved. An executable change program identifies which implementation, which consumers, under which observed state, preserving which obligations, with what evidence of completion.

## Target responsibilities, not just files

A capability can span symbols, declarations, registration tables, schemas, configuration, generated artifacts, tests, and user interfaces. One file can also contain several unrelated responsibilities.

An operation should identify its semantic purpose and its machine-addressable targets. For example:

```text
Operation: migrate callers of an accepted factory interface
Targets: reference set Q at snapshot S
Reads: old and new contracts; query membership; required configuration
Writes: resolved call nodes and imports
Preserve: accepted public behavior and lifecycle ownership
Reject: ambiguous targets or invalidated assumptions
Verify: migrated behavior and absence of obsolete callers
```

Exact resolution and complete impact coverage are different achievements. A perfectly resolved reference set can omit reflection, configuration-driven use, or an unmodeled behavioral expectation.

## Prefer mechanical work after judgment is settled

Use deterministic tools for supported renames, import rewrites, generated outputs, structural transformations, inventories, and checks. Use a model for genuinely new behavior, unresolved design, or unfamiliar semantics.

The useful “satellite” is an execution capability, not necessarily an LLM. It can be a semantic rewriter, generator, compiler, test process, dependency analyzer, or bounded model worker.

Near-determinism is plausible for a supported operation under checked assumptions. It is not a claim that every software intention can be completely formalized or that deterministic execution makes a mistaken plan correct.

## Prepare, validate, then retire

The default construction strategy is:

```text
Establish obligations and affected regions
→ prepare replacement and mechanical migrations
→ compose a candidate in an isolated state
→ check intended behavior and preserved obligations
→ retire obsolete paths and verify their absence
→ validate the final candidate and promote coherently
```

Do not literally destroy the old implementation first because the metaphor says “orbital strike.” Intermediate states should be deliberate and recoverable. Live database or external-service changes require their own migration and recovery protocol; a repository commit cannot make those effects atomic.

“One coordinated pass” means avoiding repeated global rediscovery. Local iteration remains appropriate when evidence reveals a defect.

## Dependencies and conflicts

Disjoint writes do not establish independence. One operation may alter a contract that another reads. Track read dependencies, shared assumptions, query membership, and effects in addition to file overlap.

An ordered sequence may legitimately transform the same region more than once. Represent it as one compound owner or as explicitly ordered operations with intermediate checks. Do not disguise it as independent work merely to fit a scheduler that prohibits overlapping packets.

Invalidate only affected work when possible. Re-run selectors when their basis changes. A fourth newly introduced consumer can invalidate removal even if the original three consumers were untouched.

## Completion and residue

The final check includes intended behavior, compatibility that is still required, removal of obsolete registrations and implementations, generated-artifact consistency, and absence of unjustified migration residue.

Tests are selected from the impact model, but that model can be incomplete. Include broader checks proportionate to the risk of unmodeled dependencies. Avoid both extremes: full-suite repetition after every tiny intermediate edit, and declaring success solely from narrow tests authored beside the patch.

## First useful exercise

Replace an implementation across package boundaries while preserving a public contract, adding one new capability, migrating consumers, and retiring the obsolete path. Include a generated artifact, a configuration-based registration, and a consumer introduced after planning.

The demonstration should identify unknowns, detect the changed query membership, preserve still-valid work, and complete against acceptance criteria established independently of the candidate implementation.

Compare against a competent single-owner agent using ordinary refactoring tools. Five workers doing five jobs is not evidence that the compiler improves total outcomes.
