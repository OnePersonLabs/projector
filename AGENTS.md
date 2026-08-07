## Environment

This repository is developed in WSL. The Windows `C:\` drive is available at `/mnt/c/`, and the WSL filesystem is available from Windows at `\\wsl.localhost\Ubuntu\`. Use PowerShell when a command must execute natively on Windows, and pass Windows-style paths to PowerShell commands.

## Repository Operations

- Issues and specifications live in GitHub Issues and are managed with the `gh` CLI. Follow `docs/agents/issue-tracker.md`.
- Use the standard triage labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. Follow `docs/agents/triage-labels.md`.
- This is a single-context repository. Domain guidance lives in root `CONTEXT.md` and `docs/adr/`; follow `docs/agents/domain.md`.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Projector**

Projector is a local, host-neutral semantic control plane for software evolution. It compiles requested intent into bounded, state-bound change work; resolves stable semantic identity; determines relevant accumulated project meaning before local implementation reasoning dominates; verifies observed results independently where required; reconciles reality to a fixed point; and preserves durable evidence of governed change.

Projector is bootstrapped from the authoritative `PROJECTOR_SPEC/` corpus. That corpus must be absorbed completely into GSD-managed requirements, decisions, constraints, acceptance criteria, phase context, and plans before the source directory can be removed. The finished system must then ingest those GSD artifacts into Projector's own canonical model, prove semantic coverage, remove its GSD dependency, and govern continued development of its own repository.

**Core Value:** Make globally coherent software change a property of the control plane by compiling intent, relevance, authority, impact, execution, evidence, and reconciliation into one truthful, bounded semantic transaction.

### Constraints

- **Specification authority**: `PROJECTOR_SPEC/SPEC.md` plus its manifest-ordered authoritative modules govern until the verified GSD absorption gate passes — summaries and generated bundles cannot silently override subsystem contracts
- **Complete committed scope**: all implementation slices and public-release obligations are in the committed roadmap — later sequence position means dependency ordering, not optional or v2 work
- **Vertical delivery**: each slice begins with failing fixture/property tests and closes a useful causal loop with inspectable contracts, verification, reconciliation, and explicit proof boundaries — package-completion planning is prohibited
- **Reference stack**: TypeScript, Node.js 24 ESM, pnpm, Zod/JSON Schema, SQLite derived state, Git CLI, Vitest/fast-check, canonical JSON/SHA-256, and host-neutral ports/composition root — deviations require an explicit governed architecture decision
- **Canonical state**: authored intent and governance are fine-grained, independently addressable, version-controlled, and sufficient to rebuild derived state — bounded work must not require a monolithic project model
- **Deterministic first**: exact parsing, hashing, traversal, selection, invalidation, transforms, validation, and recovery remain deterministic where possible — models operate only at semantic uncertainty frontiers
- **Stable identity**: names, paths, wording, and aliases do not define semantic identity — existing identity resolution precedes creation
- **Truthful boundaries**: relevance, impact, completeness, equality, and completion claims expose assurance, stale/failed observations, unavailable/open-world lanes, and unknowns — heuristic similarity cannot masquerade as proof
- **Scoped validity**: plans, capsules, approvals, caches, and capabilities bind to dependency-complete values and query-result fingerprints — a changed global digest alone cannot stale unrelated work
- **Authority integrity**: inference, repetition, co-change, generated conformity, and Projector-caused evidence cannot independently create normative authority — causal independence and provenance are required
- **Governed mutation**: writes are root-constrained, state-bound, risk-classified, previewable, journaled, recoverable, and independently validated where policy requires — R4 actions are never autonomous in 1.x
- **Representation fidelity**: human, behavioral/Gherkin, agent, and machine projections remain derived from canonical semantics and preserve protected dimensions — style lint and token reduction are not semantic proof
- **Self-hosting handoff**: Projector must import and verify the complete GSD bootstrap model before `PROJECTOR_SPEC/`, `.planning/`, or project-local GSD support can be removed — no bootstrap artifact may disappear while it retains unique semantics

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `$gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `$gsd-debug` for investigation and bug fixing
- `$gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `$gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
