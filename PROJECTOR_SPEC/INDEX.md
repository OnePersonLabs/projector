# Projector Specification Index

This index routes readers and agents to authoritative modules without requiring full-spec ingestion. It is navigation, not an independent source of requirements.

## Module map

### Product

- [Vision and North-Star Behavior](01-product/vision-and-north-star.md) — product behavior, initialization, explain/audit/reconcile/change/complete/upgrade behaviors.
- [Normative Principles and Non-Goals](01-product/principles-and-non-goals.md) — global invariants, proof/authority rules, identity/relevance principles, explicit exclusions.

### Semantic kernel

- [Terminology and Source Classes](02-semantic-kernel/terminology-and-source-classes.md) — canonical vocabulary and authored/derived/observed/inferred separation.
- [Conceptual Architecture](02-semantic-kernel/conceptual-architecture.md) — intent/lens/surface planes, observed shadow, change cognition, semantic ownership vs retrieval.
- [Reference Implementation Architecture](02-semantic-kernel/reference-implementation.md) — ports/composition-root architecture, package topology, technology defaults.
- [Canonical State](02-semantic-kernel/canonical-state.md) — independently addressable canonical files, rebuild closure, version-control contract.
- [Identity, Concepts, and Relations](02-semantic-kernel/identity-and-relations.md) — stable identity, aliases, Requirements, Behavioral Scenarios, Concept/Relation contracts, lineage.
- [Surfaces and Projection Units](02-semantic-kernel/surfaces-and-projection-units.md) — observed artifacts, semantic anchors, Control Policy, code/spec traceability.
- [State Binding and Core Ports](02-semantic-kernel/state-binding-and-ports.md) — global snapshot identity vs dependency-scoped validity, analyzer/graph/runtime/surface ports.
- [Architecture Decision Contracts](02-semantic-kernel/architecture-decision-contracts.md) — concerns, decisions, validity, preferences, governance bases.
- [Semantic Representation Contracts](02-semantic-kernel/representation-contracts.md) — human, behavioral/Gherkin, agent, machine representations and fidelity contracts.

### Knowledge, relevance, and authority

- [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md) — WHAT/WHY vs WHERE/WHAT-ELSE, identity resolution, Relevance Closure, context bands, Analysis Facets, event/contract routing, Planning Surprises.
- [Evidence and Authority](03-knowledge/evidence-and-authority.md) — evidence reliability/authority/independence/freshness, authority vectors/records, reconsideration triggers.
- [Progressive Architecture Commitment](03-knowledge/architecture-decisions.md) — entrypoint for architecture reasoning.
- [Architecture Concerns and Decision Validity](03-knowledge/architecture-concerns-and-validity.md) — preflight, concern discovery/materiality, scoped decision validity/coexistence.
- [Architecture Evidence, Preferences, and Consequences](03-knowledge/architecture-evidence-and-consequences.md) — fresh evidence, preferences, deferral, consequence compilation, convergence/audit.
- [Risk, Approval, and Execution Policy](03-knowledge/risk-and-execution-policy.md) — contextual R0–R4 risk and action policy.

### Governance

- [Pattern Candidates and Projection Lenses](04-governance/lenses.md) — descriptive patterns, lens roles/expectations, active governance contract.
- [Scope, Selectors, and Rules](04-governance/scope-and-rules.md) — scope algebra, dependency-keyed selectors, layered ignore policy, rule kernel/composition.

### Projections and validity

- [Execution Capsules](05-projections/execution-capsules.md) — bounded task context, relevance/requirements/decisions/rules, completion contract.
- [Derivations, Invalidation, and Repair Routing](05-projections/derivations-and-invalidation.md) — signatures, proof groups, Impact Rules, backdating, oracles, repair strategy.
- [Deterministic Runtime and Representation Validation](05-projections/runtime-and-representations.md) — primitives, transforms, commands, representation fidelity.

### Reconciliation and coverage

- [Reconciliation, Divergence, Exceptions, and Migrations](06-reconciliation/reconciliation-and-divergence.md) — fixed-point reconciliation, Planning Surprise comparison, divergence taxonomy, exceptions/migrations.
- [Coverage and Progressive Completion](06-reconciliation/coverage-and-completion.md) — proof-sensitive coverage, relevance/identity lanes, information-gain completion.

### Change and execution

- [Plans, Revisions, and Rebase](07-change/plans.md) — immutable plans, dependency-scoped bindings, partial completion/rebind/rebase.
- [Semantic Change Compiler](07-change/semantic-change-compiler.md) — request → relevance → behavior delta → architecture → impact → plan.
- [Work Packets, Transactions, and Certificates](07-change/transactions-and-certificates.md) — writer coordination, journal/recovery, receipts/certificates.

### Agents and hosts

- [Agent Orchestration and Model Inference](08-agents/orchestration-and-models.md) — agent roles, model routing, validation independence, replayable inference.
- [Host and MCP Integration](08-agents/hosts-and-mcp.md) — Codex/Claude capabilities, wrappers, generated instructions, state-bound tools.

### Evolution and external surfaces

- [Modernization and External Surfaces](09-evolution/modernization-and-surfaces.md) — evidence-backed upgrades and surface adapter contract.
- [Persistence and Observation](09-evolution/persistence-and-observation.md) — SQLite derived graph, revisions, rebuild, analyzers/init pipeline.
- [Historical Evaluation and Research](09-evolution/historical-evaluation-and-research.md) — shadow-lens evaluation, co-change relevance evidence, current external research boundary.

### Operation

- [CLI, Modes, and Security](10-operation/cli-modes-and-security.md) — command surface, modes, trust/path/authorization rules.
- [Observability, Economics, and Reporting](10-operation/observability-and-reporting.md) — metrics for cost, relevance, semantic complexity, representation, reporting.

### Validation and delivery

- [Testing and Adversarial Evaluation](11-validation/testing-and-adversarial-evaluation.md) — unit/property/fixture/host/live evaluation.
- [Benchmarks and Redesign Criteria](11-validation/benchmarks-and-redesign-criteria.md) — release metrics, engineering gates, kill/redesign criteria.
- [Implementation Plan](12-delivery/implementation-plan.md) — dependency-ordered vertical slices.
- [Mandatory First Vertical Slice](12-delivery/first-vertical-slice.md) — misplaced-script causal-loop proof.
- [Core Acceptance Scenarios](12-delivery/acceptance-core.md) — correctness/recovery/invalidation baseline.
- [Relevance and Semantic Identity Acceptance](12-delivery/acceptance-relevance-and-identity.md) — anti-tunnel-vision, duplicate prevention, state-binding locality, Planning Surprises.
- [Representation Acceptance Scenarios](12-delivery/acceptance-representation.md) — semantic-fidelity and token-economics behavior.
- [Architecture Acceptance Scenarios](12-delivery/acceptance-architecture.md) — progressive architecture commitment and preference isolation.
- [Release, Dogfooding, and Final Directive](12-delivery/release-and-directive.md) — public-release bar, self-governance, implementer checklist, final loop.

---

## Semantic lookup

| Concept / question | Canonical definition / primary module | Important consumers |
|---|---|---|
| Concept / stable identity / aliases | [Identity, Concepts, and Relations](02-semantic-kernel/identity-and-relations.md) | relevance, projection units, governance, reconciliation |
| Requirement / Behavioral Scenario | [Identity, Concepts, and Relations](02-semantic-kernel/identity-and-relations.md) | relevance, change compiler, representations, verification |
| Semantic Identity Resolution | [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md) | change compiler, completion, testing |
| Relevance Closure | [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md) | architecture preflight, capsules, plans, reporting |
| Impact Closure / Impact Rule | [Derivations and Invalidation](05-projections/derivations-and-invalidation.md) | semantic change compiler, reconciliation, certificates |
| Planning Surprise | [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md) | reconciliation, observability, acceptance tests |
| Fine-grained canonical persistence | [Canonical State](02-semantic-kernel/canonical-state.md) | persistence/rebuild, transactions, Slice 0 |
| StateDigest | [State Binding and Core Ports](02-semantic-kernel/state-binding-and-ports.md) | receipts, certificates, rebuild diagnostics |
| StateBinding | [State Binding and Core Ports](02-semantic-kernel/state-binding-and-ports.md) | plans, capsules, transforms, MCP capabilities |
| Projection Unit | [Surfaces and Projection Units](02-semantic-kernel/surfaces-and-projection-units.md) | lenses, derivations, repair, coverage |
| Projection Lens | [Pattern Candidates and Projection Lenses](04-governance/lenses.md) | selectors/rules, derivations, reconciliation |
| Rule / Selector | [Scope, Selectors, and Rules](04-governance/scope-and-rules.md) | capsules, transformations, governance |
| Architecture Concern / Decision | [Progressive Architecture Commitment](03-knowledge/architecture-decisions.md) | semantic change compiler, modernization, rules/lenses |
| Evidence / Authority | [Evidence and Authority](03-knowledge/evidence-and-authority.md) | patterns, decisions, research, validation |
| Representation Projection | [Semantic Representation Contracts](02-semantic-kernel/representation-contracts.md) | capsules, host instructions, Gherkin/human specs |
| Derivation / Semantic Signature | [Derivations and Invalidation](05-projections/derivations-and-invalidation.md) | invalidation, backdating, coverage |
| Reconciliation / Divergence | [Reconciliation and Divergence](06-reconciliation/reconciliation-and-divergence.md) | completion, repair, certificates |
| Execution Capsule | [Execution Capsules](05-projections/execution-capsules.md) | packets, hosts, agents |
| Semantic Change | [Semantic Change Compiler](07-change/semantic-change-compiler.md) | plans, transactions, architecture preflight |
| Transaction / Receipt / Certificate | [Transactions and Certificates](07-change/transactions-and-certificates.md) | recovery, audit, release evidence |

---

## Change-type reading routes

### A feature or behavior change

1. [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md)
2. [Semantic Change Compiler](07-change/semantic-change-compiler.md)
3. [Progressive Architecture Commitment](03-knowledge/architecture-decisions.md) when material
4. [Execution Capsules](05-projections/execution-capsules.md)
5. [Derivations and Invalidation](05-projections/derivations-and-invalidation.md)
6. [Reconciliation and Divergence](06-reconciliation/reconciliation-and-divergence.md)

### A pattern/refactor/governance change

1. [Pattern Candidates and Projection Lenses](04-governance/lenses.md)
2. [Scope, Selectors, and Rules](04-governance/scope-and-rules.md)
3. [Derivations and Invalidation](05-projections/derivations-and-invalidation.md)
4. [Deterministic Runtime](05-projections/runtime-and-representations.md)
5. [Reconciliation and Divergence](06-reconciliation/reconciliation-and-divergence.md)

### A cross-platform or architecture-expanding change

1. [Relevance and Change Cognition](03-knowledge/relevance-and-change-cognition.md)
2. [Architecture Concerns and Decision Validity](03-knowledge/architecture-concerns-and-validity.md)
3. [Architecture Evidence, Preferences, and Consequences](03-knowledge/architecture-evidence-and-consequences.md)
4. [Risk and Execution Policy](03-knowledge/risk-and-execution-policy.md)
5. [Semantic Change Compiler](07-change/semantic-change-compiler.md)

### Canonical storage / identity work

1. [Canonical State](02-semantic-kernel/canonical-state.md)
2. [Identity, Concepts, and Relations](02-semantic-kernel/identity-and-relations.md)
3. [State Binding and Core Ports](02-semantic-kernel/state-binding-and-ports.md)
4. [Persistence and Observation](09-evolution/persistence-and-observation.md)
5. [Relevance Acceptance](12-delivery/acceptance-relevance-and-identity.md)

### Host/agent integration

1. [Execution Capsules](05-projections/execution-capsules.md)
2. [Agent Orchestration and Model Inference](08-agents/orchestration-and-models.md)
3. [Host and MCP Integration](08-agents/hosts-and-mcp.md)
4. [CLI, Modes, and Security](10-operation/cli-modes-and-security.md)
