# Projector

## What This Is

Projector is a local, host-neutral semantic control plane for software evolution. It compiles requested intent into bounded, state-bound change work; resolves stable semantic identity; determines relevant accumulated project meaning before local implementation reasoning dominates; verifies observed results independently where required; reconciles reality to a fixed point; and preserves durable evidence of governed change.

Projector is bootstrapped from the authoritative `PROJECTOR_SPEC/` corpus. That corpus must be absorbed completely into GSD-managed requirements, decisions, constraints, acceptance criteria, phase context, and plans before the source directory can be removed. The finished system must then ingest those GSD artifacts into Projector's own canonical model, prove semantic coverage, remove its GSD dependency, and govern continued development of its own repository.

## Core Value

Make globally coherent software change a property of the control plane by compiling intent, relevance, authority, impact, execution, evidence, and reconciliation into one truthful, bounded semantic transaction.

## Requirements

### Validated

- ✓ The normative product and implementation contract exists as a modular, progressively disclosed specification under `PROJECTOR_SPEC/` — existing
- ✓ The specification defines the full causal loop, reference architecture, staged vertical slices, acceptance scenarios, release gates, and explicit non-goals — existing

### Active

- [ ] Absorb every normative clause in `PROJECTOR_SPEC/` into self-contained GSD-managed artifacts with checksummed provenance and clause-level source-to-destination coverage
- [ ] Preserve normative force, negation, scope, cardinality, conditions, exceptions, dependency ordering, exact literals, identity, and proof boundaries during ingestion
- [ ] Deliver every committed implementation slice from foundation through external surfaces; sequencing establishes dependencies and does not defer committed scope
- [ ] Build the reference implementation as a host-neutral TypeScript/Node.js 24, pnpm, Zod, and SQLite system with ports and a composition root
- [ ] Prove the mandatory misplaced-script vertical slice end to end before broad analyzers, host integrations, modernization, or external surfaces
- [ ] Implement fine-grained canonical semantic state, stable identity, derived rebuildable storage, dependency-scoped validity, governance, representations, change compilation, transactions, reconciliation, and truthful completion
- [ ] Implement the full specified CLI, execution policies, security boundaries, observability, validation strategy, adversarial fixtures, benchmarks, and redesign gates
- [ ] Implement capability-aware Codex and Claude Code integrations plus the specified state-bound MCP surface
- [ ] Dogfood Projector on its own repository with active governance and explicit accepted debt only
- [ ] Ingest all GSD bootstrap artifacts into Projector's canonical managed artifacts with semantic-equivalence and coverage evidence
- [ ] Remove `PROJECTOR_SPEC/` only after its authoritative content has self-contained, verified destinations and no remaining references or semantic dependencies
- [ ] Remove the project-local GSD installation only after Projector can plan, execute, verify, reconcile, recover, explain, and continue development of its own repository without GSD

### Out of Scope

- Formal verification of arbitrary business logic — Projector makes proof boundaries explicit but does not promise universal formal correctness
- Perfect recovery of intent without evidence — uncertainty must remain visible rather than being converted into authority
- Universal ontology or programming-language support in 1.x — the reference implementation proves the system on the specified TypeScript/JavaScript-centered surfaces first
- Autonomous destructive production changes — high-risk external actions retain explicit authorization boundaries
- Automatic acceptance of contested architecture — material unresolved decisions remain visible and governed
- A graph database, hosted service, visual-modeling prerequisite, or monolithic canonical semantic document — these contradict the reference architecture and zero-ceremony local product posture
- Replacing compilers, tests, static analysis, security review, or human judgment — Projector coordinates and reasons over evidence rather than impersonating every evidence source
- Treating prompts, generated prose, compact context, repository layout, repeated patterns, or model inference as normative authority — authority remains explicit, sourced, and causally valid

## Context

The current repository is a specification-first brownfield workspace without an implementation package yet. The authoritative source comprises 46 Markdown documents and approximately 14,000 lines under `PROJECTOR_SPEC/`, with `SPEC.md` as the entry point, manifest-ordered subsystem modules as the normative contract, `INDEX.md` as navigation only, and `PROJECTOR_SPEC.md` as a generated portable bundle without independent authority.

The product addresses tunnel vision and context overload in software change. It separates WHAT/WHY interpretation from WHERE/WHAT-ELSE scouting, resolves requested meaning against stable identities, compiles bounded Relevance Closure before Impact Closure, progressively commits architecture, binds plans and capabilities to their actual semantic and physical dependencies, prefers deterministic mechanics, assigns models only bounded semantic uncertainty, compares predicted and observed impact, and reconciles to durable receipts and certificates.

The implementation program is vertical-slice-first. Slice 0 establishes contracts, fine-grained canonical storage, stable hashing and identity, core ports, rebuildable SQLite state, transaction journaling, writer coordination, fixtures, and a minimal CLI. Slice 1 proves the mandatory misplaced-script causal loop. Slices 2–12 then deliver signatures and invalidation, relevance and identity, representation and governance robustness, progressive architecture commitment, broader analyzers, coverage/completion, the full change compiler and executor, host/MCP integrations, modernization, watch/CI/hardening, and external surfaces.

The primary initial user is the Projector maintainer/developer working on Projector's own repository. Individual developers and teams using Codex or Claude Code are required product users as host integration and governance mature. Project completion is not the first vertical slice: completion means the entire specified system is implemented, passes its release and redesign gates, governs its own repository, imports the GSD bootstrap state into its canonical model, and continues without GSD.

Specification ingestion is a migration with proof obligations. During bootstrap, an exact checksummed snapshot remains available as migration evidence while every normative clause is re-expressed into GSD-managed destinations. A coverage ledger must map source clauses to requirements, decisions, constraints, acceptance criteria, phase context, or explicit non-goals. Summary-only ingestion is insufficient. Deletion is allowed only after omission, contradiction, weakened-language, dangling-reference, and semantic-equivalence audits pass.

## Constraints

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Target the complete authoritative specification | The desired product is the entire specified system, not a reduced MVP presented as completion | — Pending |
| Treat Slices 0–12 as committed, dependency-ordered scope | Dependency sequencing preserves causal delivery without creating a vague deferred bucket | — Pending |
| Optimize the bootstrap for the Projector maintainer/developer | Self-governance of Projector's own repository is the decisive end-to-end product proof | — Pending |
| Require Codex and Claude Code integrations before final handoff | They are named primary execution hosts and are necessary parts of the specified operating model | — Pending |
| Use full-fidelity preservation plus full GSD re-expression | Exact temporary evidence prevents loss while actionable GSD artifacts replace the source contract | — Pending |
| Gate deletion on clause-level coverage and semantic equivalence | File movement or summary generation alone cannot prove that the normative specification survived | — Pending |
| Make GSD a removable bootstrap dependency | Projector is complete only when it can absorb the bootstrap model and govern its own continued development | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-07 after initialization*
