# Projector: Projection-Driven Development

## Authoritative Implementation Specification

**Version:** 2.0.0  
**Status:** Normative implementation handoff  
**Date:** 2026-08-07  
**Product:** Projector  
**Method:** Projection-Driven Development (PDD)  
**Reference implementation:** TypeScript / Node.js 24 / pnpm / SQLite  
**Primary execution hosts:** host-neutral core with Codex and Claude Code adapters  
**Tagline:** **Compile intent. Reconcile reality.**

> **Implementation directive:** Build Projector as a semantic control plane and change-cognition system. Do not treat it as a prompt pack, specification folder, repository map, linter collection, code generator, or giant document retrieval system. Prove the central semantic loop end to end before broad adapters or UI.

---

## Authority and composition

This modular specification is the authoritative implementation contract.

- `SPEC.md` defines product identity, specification-composition rules, the global causal loop, and progressive-disclosure routes.
- The Markdown modules listed in `spec.manifest.json` contain authoritative subsystem requirements and contracts.
- `INDEX.md` is a navigation/index projection. It MUST NOT introduce semantics absent from authoritative modules.
- `PROJECTOR_SPEC.md` is a deterministically generated portable bundle. It has no independent authority. Its source is `SPEC.md` plus manifest-ordered modules.
- No module may silently redefine a canonical contract owned by another module. Cross-module references use the canonical definition rather than copying it.
- If a concise root summary appears less specific than a subsystem requirement, the subsystem requirement governs. A true contradiction is a specification defect and MUST be resolved rather than handled by undocumented precedence.

The specification uses the same architecture it requires from Projector. Canonical knowledge is independently addressable, and explicit links/indexes route cross-cutting relevance. No implementation task should require the full specification when a bounded module set is sufficient.

---

## Product thesis

Projector makes globally coherent software change a property of the control plane rather than a recurring request made to an agent with incomplete context.

For every meaningful requested change, Projector determines which accumulated project semantics matter **before** local implementation reasoning dominates. It maintains stable semantic identity and separates descriptive precedent from normative authority. It progressively commits architecture and compiles bounded execution context. It tracks derivations and impact, verifies with independent evidence when required, reconciles observed reality, and learns reusable relationships and mechanics from successful reasoning.

The development unit is:

```text
semantic transaction
→ intent interpretation
→ semantic identity resolution
→ bounded Relevance Closure
→ Requirement / Behavioral Scenario / constraint delta
→ architecture concern + decision preflight
→ semantic operations
→ Impact Closure
→ dependency-scoped state binding
→ bounded projection work
→ reverse-impact comparison
→ verification
→ reconciliation
→ durable receipt / certificate
```

---

## Global causal loop

```text
observe reality without executing it by default
→ derive deterministic structure
→ interpret WHAT / WHY while independently scouting WHERE / WHAT-ELSE
→ resolve requested meaning against existing stable semantic identities
→ compile a bounded relevant semantic subgraph
→ create/modify durable Requirements and Behavioral Scenarios only where useful
→ resolve newly material architecture concerns without prematurely selecting HOW
→ compile Projection Lenses, Rules, expectations, and Impact Rules
→ bind plans/capsules to the semantic/physical dependencies they actually rely on
→ invalidate exact dependents and widen uncertain impact
→ repair deterministically/upstream where possible
→ dispatch agents only for bounded semantic residue
→ compare predicted relevance/impact with actual implementation impact
→ validate through required evidence lanes
→ reconcile to a fixed point
→ commit fine-grained canonical semantic state
→ turn accepted reasoning and relationships into cheaper executable machinery
```

---

## Semantic architecture at a glance

Projector maintains three authority/manifestation planes plus an observed shadow:

```text
Intent plane
  Concepts · Requirements · Behavioral Scenarios · invariants · decisions
       ↓
Lens plane
  selectors · Projection Lenses · Rules · Impact Rules · validators · transforms
       ↓
Surface plane
  code · tests · contracts · docs · CI · runtime · external systems
       ↓
Observed shadow
  deterministic facts · timestamped observations · explicit hypotheses
```

Change-time cognition traverses these planes rather than becoming a separate authority plane:

```text
request
→ Intent Analysis + Relevance Scout
→ Semantic Identity Resolution
→ Relevance Closure
→ behavior/constraint delta
→ architecture preflight
→ Impact Closure
→ Execution Capsules
→ implementation
→ reverse impact
→ reconciliation
```

**Encapsulation defines where canonical truth is owned. Relevance traversal determines when that truth must be considered.**

Projector does not collapse physical package structure, semantic ownership, event/contract topology, and retrieval topology into one tree.

---

## Core invariants

An implementation of Projector is not conforming unless it preserves these invariants:

1. **Zero-ceremony value:** `projector init` produces useful findings before manual ontology authoring.
2. **Stable semantic identity:** names, paths, and wording do not define identity. New durable semantics are resolved against existing identities first.
3. **Fine-grained canonical state:** bounded work does not require loading or rewriting a project-wide semantic blob.
4. **Relevance before impact:** Projector separately determines what must be understood and what a known delta actually affects.
5. **Semantic ownership without retrieval blindness:** cross-cutting truth is authored once and discovered through relationships/applicability.
6. **Evidence before authority:** repetition/inference is not normative by itself.
7. **Progressive architecture commitment:** concerns activate when material. Valid scoped decisions are reused until relevant basis changes.
8. **Meaning over encoding:** Markdown, Gherkin, agent context, and machine forms are representations of canonical semantics where Projector governs them.
9. **Deterministic first, AI at uncertainty:** deterministic computation owns exact mechanics. Models operate at semantic uncertainty frontiers.
10. **Dependency-scoped validity:** global snapshot digests identify snapshots but do not globally stale unrelated local work.
11. **Proof-aware optimization:** heuristic similarity cannot masquerade as exact semantic proof.
12. **Observed-vs-predicted reconciliation:** implementation surprises are surfaced, classified, and learned from rather than hidden.
13. **Crash-consistent governed mutation:** plans, approvals, transactions, rollback/recovery, and completion claims are state-bound and journaled.
14. **Truthful boundaries:** completeness, impact, and certainty claims expose unavailable/open-world/stale lanes.
15. **No ontology cathedral:** semantic machinery must reduce future reasoning/review cost enough to justify itself.

---

## Progressive-disclosure reading routes

Use [INDEX.md](INDEX.md) for the complete semantic index. For common tasks, start here:

| Task | Read first | Then |
|---|---|---|
| Understand Projector's product contract | [Vision and North-Star](01-product/vision-and-north-star.md) | [Principles and Non-Goals](01-product/principles-and-non-goals.md) |
| Implement canonical semantics/storage | [Canonical State](02-semantic-kernel/canonical-state.md) | [Identity, Concepts, and Relations](02-semantic-kernel/identity-and-relations.md), [State Binding and Core Ports](02-semantic-kernel/state-binding-and-ports.md) |
| Implement SDD/change cognition | [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md) | [Semantic Change Compiler](07-change/semantic-change-compiler.md), [Execution Capsules](05-projections/execution-capsules.md) |
| Implement architecture decisions | [Progressive Architecture Commitment](03-knowledge/architecture-decisions.md) | concern/validity + evidence/consequence + risk modules linked there |
| Implement Projection Lenses/rules | [Lenses](04-governance/lenses.md) | [Scope, Selectors, and Rules](04-governance/scope-and-rules.md) |
| Implement invalidation/backdating | [Derivations and Invalidation](05-projections/derivations-and-invalidation.md) | [Reconciliation and Divergence](06-reconciliation/reconciliation-and-divergence.md) |
| Implement planning/execution | [Semantic Change Compiler](07-change/semantic-change-compiler.md) | [Plans](07-change/plans.md), [Transactions and Certificates](07-change/transactions-and-certificates.md) |
| Implement analyzers/derived state | [Persistence and Observation](09-evolution/persistence-and-observation.md) | [Conceptual Architecture](02-semantic-kernel/conceptual-architecture.md) |
| Implement Codex/Claude integration | [Agent Orchestration](08-agents/orchestration-and-models.md) | [Hosts and MCP](08-agents/hosts-and-mcp.md) |
| Implement/verify a delivery slice | [Implementation Plan](12-delivery/implementation-plan.md) | relevant acceptance modules under `12-delivery/`, then [Testing](11-validation/testing-and-adversarial-evaluation.md) |

---

## Delivery rule

Implement by vertical slice, not by package completion. Each slice must close a causal loop with failing tests first, inspectable contracts, bounded context, deterministic machinery where possible, verification, reconciliation, and explicit proof boundaries.

Do not start broad visualization, cloud adapters, universal language support, or speculative ontology work before required local slices pass their acceptance scenarios.
