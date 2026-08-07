# Governance and Projections Roadmap Map

## Requirement Mapping

- **GOV-001** → Phase 01 — Establish canonical, deterministic semantic-first selectors in the foundation.
- **GOV-002** → Phase 01 — Define the complete selector expression algebra as a foundational contract.
- **GOV-003** → Phase 01 — Fix the selector field vocabulary needed by every later slice.
- **GOV-004** → Phase 01 — Fix matcher variants and preserve typed selector values at the boundary.
- **GOV-005** → Phase 01 — Make canonical serialization and deterministic evaluation foundational invariants.
- **GOV-006** → Phase 12 — Harden regex matching against unbounded or unsafe execution.
- **GOV-007** → Phase 07 — Bind structural selector queries to deterministic analyzer adapters.
- **GOV-008** → Phase 04 — Explain selector membership as part of relevance reasoning.
- **GOV-009** → Phase 03 — Make selector dependencies and membership changes explicit invalidation inputs.
- **GOV-010** → Phase 03 — Re-evaluate both entering and leaving members when selectors change.
- **GOV-011** → Phase 03 — Replace global-revision invalidation with dependency-scoped cache invalidation.
- **GOV-012** → Phase 03 — Build complete semantic fingerprints for selector and rule cache identity.
- **GOV-013** → Phase 09 — Carry deterministic query semantics into plans, capsules, and approvals.
- **GOV-014** → Phase 03 — Require current proof beyond the existence of a cache hit.
- **GOV-015** → Phase 03 — Retain revision diagnostics without globally evicting unrelated cache entries.
- **GOV-016** → Phase 03 — Re-evaluate queries whenever dependency keys cannot prove locality.
- **GOV-017** → Phase 08 — Define role-specific ignore selectors, including the coverage denominator.
- **GOV-018** → Phase 08 — Prevent one exclusion from silently removing every semantic role.
- **GOV-019** → Phase 08 — Verify nuanced vendored, generated, and secret-bearing artifact treatment.
- **RULE-001** → Phase 05 — Deliver an executable governance kernel without theorem-prover scope.
- **RULE-002** → Phase 05 — Define the closed rule-effect vocabulary used by governance products.
- **RULE-003** → Phase 05 — Encode the fixed authority-class hierarchy for deterministic composition.
- **RULE-004** → Phase 05 — Require every blocking rule to compile to predicates, permissions, or validators.
- **RULE-005** → Phase 05 — Implement the exact typed normalized-predicate kernel.
- **RULE-006** → Phase 05 — Define the canonical typed Rule entity and its semantic identity.
- **RULE-007** → Phase 05 — Constrain conflict policy to the supported deterministic choices.
- **RULE-008** → Phase 05 — Keep advisory payloads non-authoritative in governance evaluation.
- **RULE-009** → Phase 05 — Fail conservatively when conflicts exceed the representable kernel.
- **RULE-010** → Phase 05 — Record typed, evidence-linked rule conflicts for inspection.
- **RULE-011** → Phase 05 — Materialize deterministic effective bundles with suppression and conflict evidence.
- **RULE-012** → Phase 05 — Apply rules in the fixed nine-level authority order.
- **RULE-013** → Phase 05 — Limit specificity tie-breaking to equivalent authority levels.
- **RULE-014** → Phase 04 — Route architecture-changing user requests through semantic intent.
- **RULE-015** → Phase 09 — Block context compilation before mutually exclusive requirements reach mutation.
- **RULE-016** → Phase 09 — Block compilation on representable require/forbid collisions.
- **RULE-017** → Phase 09 — Block compilation on unordered exclusive transform claims.
- **RULE-018** → Phase 09 — Block lower-authority overrides lacking explicit exceptions.
- **RULE-019** → Phase 09 — Block ambiguous applicability and unresolved projection ownership.
- **RULE-020** → Phase 05 — Compile one canonical rule into its governed downstream products.
- **RULE-021** → Phase 05 — Derive prompts, hooks, validators, and codemods from canonical rules.
- **RULE-022** → Phase 06 — Enforce conceptual governance strata across selectors, lenses, and bundles.
- **RULE-023** → Phase 06 — Prevent authority feedback across architectural classification layers.
- **RULE-024** → Phase 06 — Evaluate declared recursive governance groups with explicit SCC semantics.
- **RULE-025** → Phase 06 — Bound fixed-point evaluation and distinguish convergence from cycles.
- **RULE-026** → Phase 14 — Dogfood comprehensive rule-pressure auditing before release.
- **LENS-001** → Phase 04 — Keep inferred patterns descriptive until an explicit authority decision.
- **LENS-002** → Phase 04 — Model evidence, alternatives, and identity for non-authoritative candidates.
- **LENS-003** → Phase 05 — Define the supported roles by which lenses contribute governance.
- **LENS-004** → Phase 06 — Enforce a single unlayered projection owner in architecture composition.
- **LENS-005** → Phase 06 — Permit cross-cutting lens composition while rejecting ownership collisions.
- **LENS-006** → Phase 05 — Define typed projection expectations for generated and authored surfaces.
- **LENS-007** → Phase 11 — Reconcile handwritten modernization targets by predicates, not exemplar equality.
- **LENS-008** → Phase 05 — Define projection cardinality, control, surface, selector, and expectation.
- **LENS-009** → Phase 05 — Implement the complete versioned Projection Lens contract.
- **LENS-010** → Phase 05 — Constrain the lens lifecycle to its supported statuses.
- **LENS-011** → Phase 05 — Validate active-lens identity, applicability, roles, and expectations.
- **LENS-012** → Phase 07 — Require analyzer-backed recognition and validation for active lenses.
- **LENS-013** → Phase 04 — Bind active lenses to typed governance authority decisions.
- **LENS-014** → Phase 03 — Require Impact Rules for consequences beyond exact derivations.
- **LENS-015** → Phase 11 — Require migration semantics for incompatible lens upgrades.
- **LENS-016** → Phase 11 — Distinguish governed deterministic modernization from prose-only guidance.
- **PROJ-001** → Phase 03 — Define invalidation as loss of current semantic proof, not hash mismatch alone.
- **PROJ-002** → Phase 03 — Model every derivation input with identity, version hash, kind, and role.
- **PROJ-003** → Phase 03 — Persist derivation provenance, signatures, membership, validators, and proof groups.
- **PROJ-004** → Phase 03 — Require explicit scope, normalization, assurance, and limitations per signature profile.
- **PROJ-005** → Phase 03 — Bound each signature claim to the semantics its evidence actually proves.
- **INVAL-001** → Phase 03 — Invalidate derivations when their signature-profile version changes.
- **PROJ-006** → Phase 03 — Prune downstream work only with exact or policy-sufficient validated signatures.
- **PROJ-007** → Phase 03 — Prevent heuristic equality from establishing downstream validity.
- **PROJ-008** → Phase 03 — Represent mutually recursive derivations as proof SCCs.
- **PROJ-009** → Phase 03 — Mark an entire proof group suspect after relevant external change.
- **PROJ-010** → Phase 03 — Iterate declared SCC recomputation until stabilization or a bound.
- **PROJ-011** → Phase 03 — Backdate cyclic derivations only as an adequately assured unit.
- **PROJ-012** → Phase 03 — Propagate from proof groups only when relevant signatures materially change.
- **PROJ-013** → Phase 03 — Emit a typed unresolved-cycle result and widen analysis.
- **INVAL-002** → Phase 03 — Keep exact dependency invalidation distinct from conceptual widening.
- **INVAL-003** → Phase 04 — Keep pre-change relevance closure in its cognition role.
- **INVAL-004** → Phase 04 — Promote relevance evidence only through normal identity and governance paths.
- **INVAL-005** → Phase 03 — Define the versioned typed Impact Rule contract.
- **INVAL-006** → Phase 03 — Define all supported semantic triggers for Impact Rules.
- **INVAL-007** → Phase 03 — Define Impact Rule direction and effect vocabularies.
- **INVAL-008** → Phase 03 — Sequence exact reverse dependencies before conceptual widening.
- **INVAL-009** → Phase 07 — Keep low-confidence topology edges in the possible frontier.
- **INVAL-010** → Phase 03 — Record invalidation causes and snapshot-bound events with typed identity.
- **INVAL-011** → Phase 03 — Separate known, transitive, possible, and unavailable invalidation results.
- **INVAL-012** → Phase 03 — Cover semantic and authority changes as required invalidation causes.
- **INVAL-013** → Phase 03 — Cover repository, tooling, exception, migration, and availability changes.
- **INVAL-014** → Phase 03 — Implement the complete deterministic invalidation and backdating sequence.
- **INVAL-015** → Phase 03 — Guarantee reproducible invalidation for fixed canonical inputs.
- **INVAL-016** → Phase 03 — Backdate unchanged exact interfaces against newly established derivations.
- **INVAL-017** → Phase 03 — Keep heuristic-equal units suspect pending proof or widening.
- **INVAL-018** → Phase 12 — Rebuild derived state cleanly from declared canonical inputs and versions.
- **INVAL-019** → Phase 12 — Compare clean and incremental state to expose invalidation and determinism defects.
- **INVAL-020** → Phase 08 — Keep correlated rebuilds from masquerading as business-correctness evidence.
- **INVAL-021** → Phase 08 — Support independent evidence lanes across compilers, tests, validators, observations, and review.
- **INVAL-022** → Phase 08 — Select assurance and independence requirements by risk class.
- **INVAL-023** → Phase 14 — Dogfood lenses and transforms with historical replay and generated variants.
- **INVAL-024** → Phase 08 — Report rebuild, conformance, and metamorphic oracles as distinct evidence.
- **PROJ-014** → Phase 11 — Define the closed modernization repair-strategy vocabulary.
- **PROJ-015** → Phase 11 — Describe available proof, patch, and generation capabilities before routing repair.
- **PROJ-016** → Phase 11 — Route repair through the ordered cheapest safe eligible strategy.
- **PROJ-017** → Phase 11 — Forbid direct edits to generated projections by default.
- **PROJ-018** → Phase 11 — Repair generated surfaces upstream, regenerate, then validate preservation.
- **PROJ-019** → Phase 11 — Track temporary generated overlays as owned migration debt.
- **PROJ-020** → Phase 11 — Explain why cheaper or safer repair strategies were insufficient.
- **CAPS-001** → Phase 09 — Compile one minimal state-bound execution capsule per work scope.
- **CAPS-002** → Phase 09 — Define typed precedents and operation-scoped grants for capsules.
- **CAPS-003** → Phase 08 — Define measurable completion states, assurance, evidence, artifacts, and cleanliness.
- **CAPS-004** → Phase 08 — Constrain completion unit outcomes to valid, removed, or exception.
- **CAPS-005** → Phase 09 — Implement the complete typed ExecutionCapsule payload and hashes.
- **CAPS-006** → Phase 09 — Supply workers the bounded semantics, scope, dependencies, and proof obligations.
- **CAPS-007** → Phase 04 — Represent consequence-band context compactly by summary or kernel reference.
- **CAPS-008** → Phase 04 — Preserve possible-band identity, rationale, and uncertainty before expansion.
- **CAPS-009** → Phase 04 — Compile context from relevance and impact closure rather than directory proximity.
- **CAPS-010** → Phase 04 — Keep every context item traceable to a relevance or impact reason.
- **CAPS-011** → Phase 09 — Expose deterministic mechanics as concise consequences or executable tools.
- **CAPS-012** → Phase 09 — Keep structured rules, grants, contracts, and kernel hashes authoritative.
- **CAPS-013** → Phase 10 — Select host representation profiles using measured quality and total cost.
- **CAPS-014** → Phase 09 — Recheck capsule state dependencies before packet integration.
- **CAPS-015** → Phase 09 — Re-evaluate bindings after root snapshot changes before recompilation.
- **CAPS-016** → Phase 09 — Rebind unchanged dependency sets without needlessly regenerating context.
- **CAPS-017** → Phase 04 — Re-evaluate closures whenever relevance membership can change.
- **RUNTIME-001** → Phase 01 — Establish small deterministic primitives independent of context compression.
- **RUNTIME-002** → Phase 02 — Provide the package-script update primitive needed by the first repair slice.
- **RUNTIME-003** → Phase 02 — Prefer the governed primitive over a raw misplaced-script write.
- **RUNTIME-004** → Phase 09 — Define the executable preview/apply/verify/rollback transform interface.
- **RUNTIME-005** → Phase 11 — Require idempotence or bounded convergence for modernization transforms.
- **RUNTIME-006** → Phase 09 — Bind mutations to units, scope, preconditions, and dependency state.
- **RUNTIME-007** → Phase 09 — Preview mutation and fail closed on unresolved anchors.
- **RUNTIME-008** → Phase 09 — Preserve unrelated formatting and emit verified operation evidence.
- **RUNTIME-009** → Phase 09 — Provide risk-appropriate rollback, compensation, or irreversibility disclosure.
- **RUNTIME-010** → Phase 12 — Make observation no-exec unless explicitly granted capability.
- **RUNTIME-011** → Phase 10 — Define the full host command contract and resource budgets.
- **RUNTIME-012** → Phase 10 — Constrain host network and side-effect declarations.
- **RUNTIME-013** → Phase 12 — Enforce argv, cwd, environment, write, and network boundaries.
- **RUNTIME-014** → Phase 12 — Subject side-effecting validators to transaction and risk policy.
- **RUNTIME-015** → Phase 11 — Declare transform ordering, exclusion, claims, postconditions, and convergence.
- **RUNTIME-016** → Phase 11 — Block plans with unresolved exclusive transform overlap.
- **RUNTIME-017** → Phase 11 — Permit transform SCCs only with declared convergence.
- **REPR-001** → Phase 05 — Compile canonical semantics and rule bundles into fingerprinted target projections.
- **REPR-002** → Phase 13 — Project canonical requirements and scenarios onto Behavioral/Gherkin surfaces.
- **REPR-003** → Phase 13 — Bind generated behavioral surfaces to canonical hashes without promoting authority.
- **REPR-004** → Phase 05 — Order normalization, protection, rendering, validation, accounting, and fallback.
- **REPR-005** → Phase 05 — Preserve normative force across representation compilation.
- **REPR-006** → Phase 05 — Preserve negation across representation compilation.
- **REPR-007** → Phase 05 — Preserve quantifiers and cardinality across representation compilation.
- **REPR-008** → Phase 05 — Preserve logical connectives across representation compilation.
- **REPR-009** → Phase 05 — Preserve guards and exceptions across representation compilation.
- **REPR-010** → Phase 05 — Preserve semantically meaningful dependencies and ordering.
- **REPR-011** → Phase 13 — Preserve scenario step roles on behavioral external surfaces.
- **REPR-012** → Phase 05 — Preserve semantic scope across representations.
- **REPR-013** → Phase 05 — Preserve stable entity identity and explicit aliasing across projections.
- **REPR-014** → Phase 13 — Exactly preserve protected literals and identifiers on emitted surfaces.
- **REPR-015** → Phase 05 — Reject concrete weakenings of prohibition, biconditional, and cardinality semantics.
- **REPR-016** → Phase 13 — Emit measurable human-facing style signals without granting them authority.
- **REPR-017** → Phase 10 — Measure compact context with the relevant host/model tokenizer.
- **REPR-018** → Phase 10 — Use abbreviations only when host measurements show a clear benefit.
- **REPR-019** → Phase 10 — Apply the ordered safe fallback chain for compact host projections.
- **REPR-020** → Phase 10 — Avoid repeated compression when representation overhead exceeds savings.
- **REPR-021** → Phase 10 — Mark unmeasurable tokenizer savings as heuristic.
- **REPR-022** → Phase 10 — Require measured or conservative bounds for positive token-economics claims.

## Success Criteria Contributions

### Phase 01

- Selectors round-trip through canonical serialization and evaluate deterministically across the complete expression algebra.
- The foundational rule, lens, derivation, and primitive types reject unsupported enum variants and malformed identities.
- Primitive execution remains independent of any compressed agent-context representation.

### Phase 02

- The misplaced-script scenario is repaired through the package-script primitive rather than a raw file write.
- Re-running the same slice produces no additional semantic change and leaves auditable primitive evidence.

### Phase 03

- A fixed state and policy produce identical dependency fingerprints, invalidation results, and reason trails.
- Exact and sufficiently validated unchanged signatures can be backdated; heuristic equality remains suspect.
- Selector membership and derivation SCC changes invalidate only proven dependents, then widen through Impact Rules.
- Profile, adapter, toolchain, semantic, authority, and repository changes exercise every required invalidation cause.

### Phase 04

- Pattern observations remain non-authoritative until linked to an explicit governed intent or authority decision.
- Every selected context item exposes a relevance or impact explanation, including possible-band uncertainty.
- Relevance membership changes force closure re-evaluation even when already-loaded entity bodies are unchanged.

### Phase 05

- Rules compose in the fixed authority order into stable bundles with predicates, suppressions, conflicts, and hashes.
- Active lens and projection contracts reject incomplete or unsupported governance configurations.
- Representation fidelity tests preserve force, negation, cardinality, logic, guards, order, scope, and identity.
- All downstream policy products trace back to one canonical rule rather than independent copies.

### Phase 06

- Governance evaluation respects architectural strata and rejects authority-producing feedback loops.
- Projection-owner collisions fail unless explicit layering or composition resolves them.
- Declared recursive governance groups converge deterministically or terminate with a detected cycle.

### Phase 07

- Structural queries execute only through versioned deterministic analyzer adapters.
- Active lenses cannot pass without executable recognition and validation behavior.
- Low-confidence inferred topology widens analysis but never becomes an exact dependency edge.

### Phase 08

- Role-specific ignore policy yields separate inventory, authority, mutation, reporting, context, and coverage results.
- Completion contracts enforce required states, validators, evidence lanes, assurance, divergence, unknown, artifact, and cleanliness limits.
- Reports distinguish clean-rebuild, independent-conformance, and historical/metamorphic evidence.
- Risk policy selects required assurance and independent evidence lanes without treating correlated rebuilds as correctness proof.

### Phase 09

- Context compilation emits minimal state-bound capsules whose structured kernel remains authoritative over prose.
- Hard rule conflicts, ambiguous selectors, and exclusive transform claims stop compilation before mutation.
- Transforms preview, obey scoped state bindings, verify postconditions, and provide risk-appropriate recovery evidence.
- Packet integration rechecks or safely rebinds state dependencies after snapshot changes.

### Phase 10

- Declared host commands enforce typed argv, scope, network, environment, side-effect, timeout, CPU, and memory policy.
- Compact projections use the target tokenizer when available and label unavailable measurements heuristic.
- Profile selection accounts for overhead, avoids net-negative compression, and follows the safe fallback order.

### Phase 11

- Repair routing selects the first eligible safe strategy and records why earlier strategies could not apply.
- Generated outputs repair upstream and regenerate; any direct overlay is explicit owned migration debt.
- Modernization transforms are idempotent or bounded, declare composition constraints, and reject unresolved overlaps or cycles.
- Handwritten code is reconciled against governed predicates rather than arbitrary exemplar equality.

### Phase 12

- Clean rebuild and incremental state comparisons detect stale caches, missed invalidation, revision errors, and nondeterminism.
- Observation executes no repository code without an explicit capability.
- Regex, command, and side-effecting validator execution stay within enforced time, root, environment, write, network, and risk bounds.

### Phase 13

- Behavioral/Gherkin projections remain hash-bound derivatives of canonical requirements and scenarios.
- External renderings preserve scenario roles plus protected identifiers, commands, paths, URLs, versions, numbers, and units exactly.
- Human-facing style reports are measurable while remaining explicitly non-authoritative.

### Phase 14

- Rule auditing detects every specified contradiction, reachability, exception, duplication, authority, executability, idempotency, invalidation, and maintenance-pressure class.
- Historical replay and mutation-generated fixtures demonstrate that selectors, lenses, transforms, and authority decisions generalize beyond origin examples.
- Release evidence records rule-audit and historical/metamorphic outcomes for GSD handoff.
