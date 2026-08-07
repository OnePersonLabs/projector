# Agents and Evolution Roadmap Map

## Requirement assignments

- **PERS-001** → Phase 01 — the derived-state schema is foundational storage for every later slice.
- **PERS-002** → Phase 01 — canonical-file authority and SQLite indexing must be fixed before semantic state is built.
- **PERS-003** → Phase 01 — query independence from a monolithic model is a foundational persistence invariant.
- **SURF-001** → Phase 01 — surface contracts must exist at foundation time even though broad adapters arrive later.
- **OBSV-002** → Phase 01 — the analyzer capability declaration is the common contract all slice analyzers implement.
- **OBSV-003** → Phase 01 — no-exec observation is a foundational safety default for every analyzer.

- **OBSV-004** → Phase 02 — the first misplaced-script analyzer must emit observations plus capability and failure records.
- **OBSV-005** → Phase 02 — first-slice analysis must preserve useful results when one observation capability fails.
- **OBSV-006** → Phase 02 — filesystem, Git, package, and script inventory directly supplies the misplaced-script scenario.
- **OBSV-007** → Phase 02 — discovered ownership and instruction files must be untrusted in the first repository scan.
- **OBSV-015** → Phase 02 — the mandated analyzer rollout begins with the misplaced-script vertical slice and governs all successors.
- **SURF-005** → Phase 02 — repository-local surface rollout begins with precisely the facts needed by Slice 1.

- **PERS-004** → Phase 03 — graph revisions provide snapshot diagnostics for signature and backdating transactions.
- **PERS-005** → Phase 03 — dependency fingerprints, not global revision, are the core invalidation and stale-plan rule.
- **PERS-006** → Phase 03 — consistent reads and atomic revision promotion protect signature/index transactions.
- **MODEL-009** → Phase 03 — inference cache keys must participate in dependency-correct invalidation.
- **MODEL-010** → Phase 03 — recorded inference reuse supports replay without pretending model bytes are deterministic.
- **EVOL-008** → Phase 03 — backdating supplies historical and perturbation evidence before inferred lenses are enforced.
- **EVOL-009** → Phase 03 — the API/backdating slice must evaluate the complete historical and metamorphic evidence set.
- **EVOL-010** → Phase 03 — backdating must exclude Projector-caused migrations from independent support.
- **EVOL-011** → Phase 03 — historical relationships may seed only possible relevance during backdated evaluation.
- **EVOL-012** → Phase 03 — co-change remains contextual evidence rather than an exact semantic dependency.
- **EVOL-013** → Phase 03 — confirmed Planning Surprises outrank mere co-change in historical feedback.
- **EVOL-014** → Phase 03 — shadow-lens backdating must report utility and false-positive behavior.
- **EVOL-015** → Phase 03 — historical reports must expose counts and uncertainty with small samples.
- **OBSV-013** → Phase 03 — semantic signatures must remain stable across excluded formatting changes.

- **AGNT-002** → Phase 04 — this slice implements intent normalization and relevance discovery without selecting implementation.
- **AGNT-003** → Phase 04 — stable identity comparison and adversarial relevance review are the slice’s core responsibilities.
- **MODEL-016** → Phase 04 — intent and relevance inference must operate on bounded graph neighborhoods.
- **MODEL-017** → Phase 04 — identity and relevance programs require the smallest sufficient comparison neighborhood.
- **MODEL-018** → Phase 04 — identity/relevance inference artifacts need alternatives, boundaries, provenance, and missing evidence.
- **MODEL-019** → Phase 04 — sensitive values must be removed before any intent or relevance context is serialized.

- **MODEL-003** → Phase 05 — representation compilation is deterministic first and model-assisted only for semantic residue.
- **MODEL-013** → Phase 05 — inferred representation or rule output remains candidate state until authorized promotion.
- **MODEL-014** → Phase 05 — representation resampling cannot silently rewrite accepted canonical governance.
- **AGNT-010** → Phase 05 — semantic representation fidelity needs deterministic or independently strong validation.
- **AGNT-012** → Phase 05 — agent authority restrictions enforce the governance boundary around rules, scope, exceptions, and identity.
- **AGNT-013** → Phase 05 — structured proposals are separated from the authority required to promote them.

- **RSCH-001** → Phase 06 — architecture concerns trigger scoped external research when current facts materially affect a decision.
- **RSCH-002** → Phase 06 — architectural research stays concern-scoped rather than becoming an ambient crawl.
- **RSCH-003** → Phase 06 — evidence refresh dirties only decisions whose material basis changed.
- **RSCH-004** → Phase 06 — architecture evidence uses the mandated source-priority order.
- **RSCH-005** → Phase 06 — research claims carry locators, dates, hashes or excerpts, confidence, and applicability.
- **RSCH-006** → Phase 06 — offline architecture work remains functional while honestly lowering evidence authority.

- **OBSV-001** → Phase 07 — the full initialization pipeline orders analyzer, topology, inference, coverage, and cleanup stages.
- **AGNT-004** → Phase 07 — explorer and pattern inference operate on analyzer topology while research supplies rationale.
- **OBSV-008** → Phase 07 — broader TypeScript/JavaScript indexing must preserve semantic units and topology edges.
- **OBSV-009** → Phase 07 — structured-data analysis must preserve stable path units and typed contract relationships.
- **OBSV-010** → Phase 07 — Markdown analysis must preserve sections and code/reference links.
- **OBSV-012** → Phase 07 — Git analysis must preserve history, rename, co-change, and migration topology.
- **OBSV-014** → Phase 07 — unsupported syntax degrades only the affected analyzer capability.
- **OBSV-016** → Phase 07 — structural clustering may combine the specified semantic, structural, historical, and lineage features.
- **OBSV-017** → Phase 07 — topology clustering retains outliers and avoids treating generated copies as independent evidence.

- **AGNT-007** → Phase 08 — coverage needs validation metadata for lane, source, independence, side effects, and strength.
- **AGNT-008** → Phase 08 — R2+ completion can require an independent strong validation lane.
- **AGNT-009** → Phase 08 — implementation-generated tests cannot be the sole independent strong proof.
- **AGNT-011** → Phase 08 — evidence independence is assessed causally, including correlated shared test suites.
- **AGNT-014** → Phase 08 — completion derives from verified state rather than an agent assertion.
- **AGNT-015** → Phase 08 — the completion contract gates on binding, evidence, reconciliation, unknowns, and unavailable actions.
- **MODEL-012** → Phase 08 — exhausted inference retries must explicitly widen dependent coverage.

- **AGNT-001** → Phase 09 — the compiler/executor needs a provider-neutral registry of every logical orchestration role.
- **AGNT-005** → Phase 09 — critic, lens-author, and transform-author responsibilities shape compiled and executed packets.
- **AGNT-006** → Phase 09 — constrained repair, independent validation, reconciliation, and modernization roles complete orchestration.
- **MODEL-001** → Phase 09 — execution routing uses uncertainty, risk, task, context, research, mutation, history, and cost.
- **MODEL-002** → Phase 09 — the executor follows the specified deterministic-to-frontier escalation ladder.
- **MODEL-004** → Phase 09 — the model execution boundary is vendor-neutral and explicitly nondeterministic.
- **MODEL-005** → Phase 09 — compiled structured requests carry the complete typed execution and risk contract.
- **MODEL-006** → Phase 09 — request roles are restricted to the specified compiler/executor vocabulary.
- **MODEL-007** → Phase 09 — structured responses record provider, model, raw hash, attempt, and optional usage metadata.
- **MODEL-008** → Phase 09 — providers implement the typed structured-generation interface consumed by execution.
- **MODEL-011** → Phase 09 — schema-invalid model output is retried only under a bounded executor policy.
- **MODEL-015** → Phase 09 — compiler/executor tests use fake or recorded providers and budget opt-in live evaluation.

- **HOST-001** → Phase 10 — host integration branches on reported capabilities rather than host brands.
- **HOST-002** → Phase 10 — adapters expose the three locked integration levels.
- **HOST-003** → Phase 10 — host guarantees are limited to capabilities actually present while level 1 remains useful.
- **HOST-004** → Phase 10 — supported wrappers establish or join a session before later stages.
- **HOST-005** → Phase 10 — wrappers load or rebuild state and resolve execution policy.
- **HOST-006** → Phase 10 — wrappers inject minimal instructions and expose state-bound tools.
- **HOST-007** → Phase 10 — meaningful host work resolves identity and bounded relevance before mutation.
- **HOST-008** → Phase 10 — wrappers observe mutation events and compile capsules from the impact subgraph.
- **HOST-009** → Phase 10 — wrappers reconcile and emit policy-scoped completion deltas at checkpoints and session end.
- **HOST-010** → Phase 10 — generated host instructions are regenerable derivatives of canonical rules.
- **HOST-011** → Phase 10 — concise host prose leaves deterministic enforcement in Projector machinery.
- **HOST-012** → Phase 10 — host and task context share representation profiles and state hashes with capsules.
- **HOST-013** → Phase 10 — compact prose cannot be the sole copy of an available structured hard rule.
- **HOST-014** → Phase 10 — prose-only hosts receive the least-compressed adequate representation and weaker guarantee disclosure.
- **HOST-015** → Phase 10 — prose clarity or token lint is never presented as enforcement or semantic equivalence.
- **MCP-001** → Phase 10 — MCP exposes the complete specified read-first operation set.
- **MCP-002** → Phase 10 — MCP visibly separates controlled mutations from read-first operations.
- **MCP-003** → Phase 10 — every mutation requires an unforgeable, scoped, expiring state-bound capability.
- **MCP-004** → Phase 10 — dependency change or uncertainty invalidates the bound mutation capability.
- **MCP-005** → Phase 10 — safe rebinding depends on unchanged bound values and query dependencies, not root digest alone.
- **MCP-006** → Phase 10 — read-only MCP calls remain capability-free but still enforce secret and context policy.

- **EVOL-001** → Phase 11 — modernization recognizes the complete trigger set after the architecture kernel exists.
- **EVOL-002** → Phase 11 — modernization proposals are problem-first rather than technology-first.
- **EVOL-003** → Phase 11 — proposals carry the complete evidence, impact, migration, rollback, risk, and confidence contract.
- **EVOL-004** → Phase 11 — fashion-resistance rejection rules filter weak or uneconomic upgrades.
- **EVOL-005** → Phase 11 — accepted upgrades become semantic changes plus migration overlays.
- **EVOL-006** → Phase 11 — modernization reuses architecture governance instead of creating another ranking authority.
- **EVOL-007** → Phase 11 — triggers dirty Architecture Concerns and recommendations reuse existing decision machinery.

- **PERS-010** → Phase 12 — hardening versions and migrates each persistence, analyzer, kernel, and capability contract independently.
- **PERS-011** → Phase 12 — upgrades declare their reindex, rematch, reconsideration, invalidation, and verification consequences.
- **PERS-012** → Phase 12 — incompatible analyzer or engine changes invalidate obsolete derivation proofs.
- **PERS-013** → Phase 12 — migrations are previewable, deterministic, and recoverable on failure.
- **OBSV-011** → Phase 12 — CI hardening requires GitHub Actions units, dependencies, permissions, I/O, and path filters.

- **SURF-002** → Phase 13 — external surface implementation conforms to the complete adapter identity and read contract.
- **SURF-003** → Phase 13 — external mutations remain optional and use the exact plan/apply/validate signatures.
- **SURF-004** → Phase 13 — read-only or unavailable APIs cannot masquerade as writable adapters.
- **SURF-006** → Phase 13 — external observations are timestamped and adapter-versioned revisions.
- **SURF-007** → Phase 13 — deterministic transactions pin an external snapshot digest in state.
- **SURF-008** → Phase 13 — refresh creates a new revision and invalidates dependent state when required.
- **SURF-009** → Phase 13 — local rebuilds never silently ingest live external state.
- **SURF-010** → Phase 13 — unavailable required surfaces become explicit frontier or manual actions.
- **SURF-011** → Phase 13 — sampled/open adapters disclose blind spots and cannot overclaim proof boundaries.

- **PERS-007** → Phase 14 — dogfood and release verification rebuild derived state from fixed canonical and observation snapshots.
- **PERS-008** → Phase 14 — release rebuilds compare the full authored index and deterministic derived outputs semantically.
- **PERS-009** → Phase 14 — the release oracle ignores only declared volatility and claims consistency, not independent correctness.

## Observable success criteria by phase

### Phase 01

- A fresh repository can load fine-grained canonical files into the declared SQLite logical schema without a monolithic model document.
- Analyzer and surface interfaces compile with explicit capability metadata, and observation defaults to no-exec.

### Phase 02

- The misplaced-script fixture is inventoried from filesystem, Git, package, and minimal JavaScript facts without executing repository code.
- A partial analyzer failure preserves unaffected observations and records the degraded capability.
- Ownership or instruction files discovered by inventory are represented as untrusted input.

### Phase 03

- Formatting-only edits leave the selected API semantic signature unchanged, while a bound dependency edit invalidates the affected plan or artifact.
- Historical lens evaluation separates exogenous from Projector-induced changes and reports counts plus uncertainty.
- A semantic/index transaction reads one revision and atomically publishes the next only at the correct journal phase.

### Phase 04

- Intent output states WHAT/WHY without prescribing HOW, and identity/relevance results list included, excluded, alternative, and missing-evidence candidates.
- Model context is bounded to the smallest sufficient graph neighborhood and contains no serialized sensitive values.

### Phase 05

- Deterministic representation rendering and fingerprinting run before any model-assisted residue rendering.
- Candidate rules or representations cannot enter canonical governance without an explicit authorized promotion.
- Protected semantic dimensions pass deterministic or causally independent validation.

### Phase 06

- A material architecture concern produces a concern-scoped research packet with source priority, provenance, freshness, confidence, and applicability.
- Offline execution completes without fabricated rationale and visibly lowers the resulting evidence authority.

### Phase 07

- TypeScript/JavaScript, structured-data, Markdown, and Git fixtures retain their specified semantic units and typed topology relationships.
- Unsupported syntax degrades only its affected capability, while outliers and generated-copy causality remain visible in clustering.
- Initialization executes the required stage order from inventory through cleanup planning.

### Phase 08

- An R2+ completion attempt fails when its only strong proof is causally tied to the implementation packet.
- Completion succeeds only when the contract, state binding, independent evidence, reconciled units, unknown policy, and unavailable actions all pass.
- Exhausted inference retries produce an explicit failure and a measurable widening of dependent coverage.

### Phase 09

- Every logical role can be compiled into a provider-neutral work packet with the specified authority boundary.
- Recorded/fake providers validate request and response schemas, bounded retries, replay metadata, and routing escalation without live-model dependence.
- Routing decisions account for risk and mutation scope and escalate in the mandated order.

### Phase 10

- Capability fixtures for all three host integration levels produce only the guarantees each fixture supports.
- A wrapper session resolves state, policy, identity, relevance, and capsules before mutation, then reconciles and emits deltas.
- MCP mutation calls reject absent, expired, out-of-scope, or stale capabilities, while read calls still apply secret/context policy.
- Generated host instructions can be regenerated from canonical rules and never overclaim prose assurance.

### Phase 11

- Every modernization trigger creates or dirties an Architecture Concern and yields a problem-first proposal with all required fields.
- Weak, speculative, uneconomic, or poorly reversible upgrades are rejected by the stated fashion-resistance rules.
- An accepted upgrade is represented as governed semantic change plus migration overlay, with no separate ranking system.

### Phase 12

- An upgrade manifest reports independent version changes and all required reindex/rematch/reconsider/invalidate/verify actions.
- Incompatible analyzer or signature changes invalidate old proofs, and failed canonical migrations restore the prior state.
- GitHub Actions analysis exposes workflow/job topology, permissions, inputs/outputs, and path filters.

### Phase 13

- Read-only, writable, sampled, and unavailable adapter fixtures expose truthful capabilities and exact optional mutation behavior.
- External refresh creates a versioned observation revision whose digest can be pinned and whose dependents can be invalidated.
- A local rebuild does not access live external state, and sampled or unavailable surfaces yield explicit proof-boundary/frontier results.

### Phase 14

- Dogfood release verification deletes derived caches and rebuilds semantically equivalent state from fixed repository and pinned external snapshots.
- Rebuild comparison ignores only declared volatile fields and reports itself as a derived-state consistency oracle.
