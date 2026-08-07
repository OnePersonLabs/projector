# Progressive Architecture Commitment

Projector delays architecture decisions until their consequences become material, then resolves only the smallest decision frontier required for safe durable progress. Existing scoped decisions are reused until relevant assumptions, constraints, evidence obligations, preferences explicitly adopted by the project, or governed scope change.

Architecture reasoning consumes the bounded Relevance Closure produced during change cognition. It does not reconstruct project context from package proximity or load the entire semantic graph.

```text
Relevance Closure
→ Requirement / Scenario / constraint delta
→ concern discovery + materiality
→ existing decision validity
→ decision frontier
→ evidence / current research when required
→ preference-aware viable-option evaluation
→ accept / defer / contest
→ compile governance consequences
→ Impact Closure + implementation planning
```

The following modules divide authoritative detail by responsibility:

- [Architecture Concerns and Decision Validity](architecture-concerns-and-validity.md) — preflight, concern activation/materiality, scoped validity, coexistence/supersession.
- [Architecture Evidence, Preferences, and Consequences](architecture-evidence-and-consequences.md) — research freshness, preference scope, deferral, consequence compilation, convergence, explanation/audit.
- [Risk, Approval, and Execution Policy](risk-and-execution-policy.md) — contextual R0–R4 assessment and automatic-action policy.
- [Architecture Decision Contracts](../02-semantic-kernel/architecture-decision-contracts.md) — serialized normative contracts.

The governing rule is:

> Make a decision when the forces that make it consequential become material. Preserve and reuse it while its basis remains valid. Re-evaluate it only when a relevant basis changes.
