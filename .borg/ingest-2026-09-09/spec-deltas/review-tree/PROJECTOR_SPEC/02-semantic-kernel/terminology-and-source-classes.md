# Terminology and Source Classes

## Canonical terminology

| Term | Definition |
|---|---|
| **Concept** | Stable semantic identity for a reusable project idea. Examples include capabilities, behaviors, invariants, decisions, ownership boundaries, events, commands, policies, read models, contracts, assumptions, data/interface boundaries, migrations, and constraints. |
| **Requirement** | Stable canonical statement of behavior, obligation, or externally meaningful system property that must remain addressable across wording, file, and implementation changes. |
| **Behavioral Scenario** | Stable observable example or branch that shows one or more Requirements. Gherkin and executable acceptance tests are representations or evidence, not identity. |
| **Semantic Identity Resolution** | Derived decision record that resolves requested meaning against canonical identities before reuse, split, coordinated modification, or new durable identity creation. |
| **Relation** | Typed factual or hypothesized connection between entities. Relations describe what is believed to be true. Governance propagation is modeled separately. |
| **Relevance Closure** | Bounded, provenance-aware, confidence-ranked semantic subgraph describing what existing knowledge may materially affect correct interpretation/planning of a requested change. It is distinct from impact closure. |
| **Analysis Facet** | Versioned change-analysis program that activates extra questions or relevance lanes. Typical concerns include behavior, events, security, realtime, migration, public contracts, and observability. It does not select architecture. |
| **Impact Rule** | Versioned governance rule describing when a known conceptual or structural change should widen, invalidate, revalidate, block, or require analysis beyond exact derivation dependencies. |
| **Impact Closure** | Proof-aware affected set/frontier produced after a semantic delta is known. Impact Closure controls invalidation/planning and MUST NOT be conflated with pre-change Relevance Closure. |
| **Planning Surprise** | Difference between predicted relevance/impact and the semantic closure implied by the actual implementation diff. It may reveal legitimate scope growth, an omitted relation, agent overreach, or a new reusable dependency. |
| **Surface** | Domain in which software meaning manifests: repository, CI, cloud, registry, runtime, app store, website, etc. |
| **Artifact** | Observed object on a Surface, such as a file, workflow, resource, or external record. |
| **Projection Unit** | Smallest stable manifestation Projector can fingerprint, govern, validate, invalidate, and repair independently. |
| **Pattern Candidate** | Descriptive inferred regularity. It is evidence, not authority. |
| **Projection Lens** | Versioned executable architectural mapping with selectors, projection expectations, rules, validators, transforms, and migration behavior. |
| **Projection Expectation** | The kind of state a lens expects: exact output, structured template, predicate-constrained state, observed state, or human procedure. |
| **Control Policy** | Structured policy expressing ownership, mutation mechanism, and actuation/approval for a Projection Unit. |
| **Rule** | Typed requirement, prohibition, preference, validator, transform, routing rule, permission, restriction, or explanation. |
| **Selector** | Serializable deterministic applicability predicate with declared dependencies. |
| **Evidence** | Observation supporting, contradicting, or contextualizing a claim, with reliability, authority, independence, freshness, and causal origin kept separate. |
| **Authority Record** | Inspectable decision establishing whether and why a pattern, lens, rule, or architecture choice should govern future work. |
| **Architecture Concern** | Material question or design force introduced or changed by requirements, constraints, scale, platforms, operations, or accumulated friction. It is a decision obligation, not a solution. |
| **Architecture Decision** | Canonical scoped record of what was chosen for a material concern. Its Authority Record explains why. Its consequences explain what governance changes because of it. |
| **Decision Validity Assessment** | Scope-specific derived result describing whether an accepted decision remains valid, is suspect, contested, or invalid for the scope being changed. |
| **Decision Frontier** | Smallest set of unresolved or suspect architecture decisions that materially constrain the next safe commitment. |
| **Developer Preference** | Explicit non-binding user, organization, or project preference used to rank otherwise viable options. Enforceable requirements are constraints/decisions, not preferences. |
| **Governance Basis** | Typed link that explains why a normative rule or lens may govern. Sources include decisions, hard constraints, adopted standards, migrations, host safety, or authorized lenses. |
| **Semantic Signature** | Versioned semantic fingerprint plus scope and assurance level describing what equality means and how strongly it may be trusted. |
| **Semantic Representation Profile** | Versioned target-specific encoding policy that compiles canonical semantics into human technical prose, compact agent context, or machine-checkable invariant form. |
| **Representation Projection** | Derived rendering that a Semantic Representation Profile produces. It binds to source semantic hashes/state and never gains authority merely because Projector generates or persists it. |
| **Semantic Preservation Fingerprint** | Dimensioned fingerprint used to check or prove protected meaning across representation. It covers normative force, negation, scope, cardinality, conditions, exceptions, dependency/order, and protected literals. |
| **Instruction Efficiency** | Workload-scoped ratio between validated behavioral/conformance utility and total instruction/context cost. The numerator definition MUST be explicit. It is not a universal scalar quality score. |
| **Derivation Record** | Inputs, signatures, rules, and validation evidence that justify the current validity of a Projection Unit. |
| **Divergence** | Difference between governed expectation and observed state. |
| **Anomaly** | Suspicious observation not yet established as divergence. |
| **Observability Class** | Whether a dependency lane is closed, bounded, open, sampled, or unavailable. |
| **Coverage** | Measured accounting of known semantic/physical state and proof strength within an explicitly stated boundary. |
| **Coverage Frontier** | Known edge between modeled/proven state and uncertain, open, stale, or unavailable territory. |
| **Invalidation** | Expiration of a prior validity proof. It does not imply regeneration. |
| **Execution Capsule** | Minimal task-scoped compiled objective, relevant semantic subgraph, rules, scope, state binding, tools, and verification contract. |
| **State Digest** | Global hash-bound identity of a complete repository/canonical/toolchain/external snapshot. It identifies a snapshot but is not by itself the validity dependency for locally scoped work. |
| **State Binding** | Dependency-scoped binding for plans, capsules, approvals, and capabilities. It binds selected values, boundary-defining query results, relevant toolchain inputs, and optional external snapshots. Query dependencies preserve negative-space facts such as selector membership, adjacency, and producer/consumer enumeration. |
| **Work Packet** | Executable unit in a plan referencing an Execution Capsule. |
| **Semantic Transaction** | End-to-end conceptual change through analysis, plan, mutation, verification, reconciliation, and durable receipt/certificate. |
| **Cleanup Plan** | Durable dependency-ordered plan for unresolved true technical debt. |
| **Transaction Receipt** | Compact committed record for material semantic/governance changes, binding the change to before/after state digests and verification summary. |
| **Change Certificate** | Verbose evidence record of what changed, how it was validated, what remains unknown, and how to roll back. |
| **Lineage** | Explicit move/split/merge/delete continuity between stable semantic identities. |

---


## Four source classes

Every graph fact MUST identify one source class.

## Authored

Accepted semantic intent:

- explicit user/product decisions.
- accepted Requirements and Behavioral Scenarios.
- approved invariants.
- active Projection Lenses.
- approved rules.
- exceptions.
- migrations.
- approved Semantic Representation Profiles.

Authored facts are canonical.

## Derived

Deterministically extracted facts:

- imports.
- exports.
- symbols.
- AST relationships.
- paths.
- package graph.
- test pairing.
- workflow graph.
- documentation links.
- Semantic Identity Resolutions, Relevance Closures, and Planning Surprise analyses unless explicitly promoted into canonical relationships.
- Representation Projections and Semantic Preservation Fingerprints.

Derived facts are disposable and recomputable.

## Observed

State read from runtime or external surfaces:

- remote resource properties.
- deployment settings.
- app-store metadata.
- runtime behavior.
- telemetry.
- package registry state.

Observed facts MUST include freshness.

## Inferred

Model- or heuristic-generated hypotheses:

- concept candidates.
- candidate aliases and duplicate/overlap matches.
- possible relevance relationships.
- likely roles.
- pattern candidates.
- probable migrations.
- suspected stale docs.
- candidate rationale.

Inferred facts MUST carry confidence, evidence, alternatives, and uncertainty.

Inferred facts MUST NOT silently become authored facts.

---


