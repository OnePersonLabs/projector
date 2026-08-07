# Requirements: Projector

**Defined:** 2026-08-07
**Core Value:** Make globally coherent software change a property of the control plane by compiling intent, relevance, authority, impact, execution, evidence, and reconciliation into one truthful, bounded semantic transaction.

## Scope Contract

All requirements below are committed v1 scope. Slice or phase ordering expresses dependency sequencing, not deferral. There are no v2 requirements. Source locators are migration provenance; each requirement is self-contained and does not depend on the continued presence of `PROJECTOR_SPEC/`. Exact source content remains temporarily preserved in `.planning/intel/constraints.md` until the verified deletion gate.

## v1 Requirements

### Product and Semantic Kernel


### Product behavior and causal loop

- [ ] **CORE-001 — Product identity.** Projector MUST be implemented as a semantic control plane and change-cognition system, not as a prompt pack, specification folder, repository map, linter collection, code generator, or giant document-retrieval system. The first implementation objective MUST prove the central semantic loop end to end before broad adapters or UI.  
  Source: `SPEC.md` — “Authoritative Implementation Specification”

- [ ] **CORE-002 — Specification composition.** `SPEC.md` and the Markdown modules listed in `spec.manifest.json` are authoritative. `INDEX.md` MUST NOT introduce absent semantics; `PROJECTOR_SPEC.md` MUST be deterministically generated from `SPEC.md` plus manifest-ordered modules and has no independent authority. A module MUST NOT silently redefine another module's canonical contract; cross-module references MUST use the canonical definition rather than copying it. A less-specific root summary MUST yield to a more-specific subsystem requirement. A true contradiction MUST be resolved as a specification defect; undocumented precedence is forbidden.  
  Source: `SPEC.md` — “Authority and composition”

- [ ] **CORE-003 — Bounded specification use.** Canonical knowledge MUST be independently addressable, with explicit links/indexes routing cross-cutting relevance; no implementation task SHOULD require the full specification when a bounded module set suffices.  
  Source: `SPEC.md` — “Authority and composition”

- [ ] **CORE-004 — Semantic transaction sequence.** Meaningful change MUST support this ordered unit: intent interpretation → semantic identity resolution → bounded Relevance Closure → Requirement/Behavioral Scenario/constraint delta → architecture concern and decision preflight → semantic operations → Impact Closure → dependency-scoped state binding → bounded projection work → reverse-impact comparison → verification → reconciliation → durable receipt/certificate.  
  Source: `SPEC.md` — “Product thesis”

- [ ] **CORE-005 — Global causal loop.** Projector MUST observe without executing by default; derive deterministic structure; independently analyze WHAT/WHY and scout WHERE/WHAT-ELSE; resolve identities; compile bounded relevance; create/modify durable Requirements and Behavioral Scenarios only where useful; resolve newly material concerns without premature HOW; compile lenses/rules/expectations/Impact Rules; bind work to actual dependencies; invalidate exact dependents and widen uncertain impact; repair deterministically/upstream where possible; dispatch agents only for bounded semantic residue; compare predicted and actual impact; validate required evidence lanes; reconcile to a fixed point; commit fine-grained canonical state; and convert accepted reasoning/relationships into cheaper executable machinery.  
  Source: `SPEC.md` — “Global causal loop”

- [ ] **CORE-006 — Plane separation.** Projector MUST preserve the Intent plane (Concepts, Requirements, Behavioral Scenarios, invariants, decisions), Lens plane (selectors, Projection Lenses, Rules, Impact Rules, validators, transforms), Surface plane (code, tests, contracts, docs, CI, runtime, external systems), and observed shadow (deterministic facts, timestamped observations, explicit hypotheses). Change-time cognition is traversal, not another authority plane. Physical package structure, semantic ownership, event/contract topology, and retrieval topology MUST NOT be collapsed into one tree.  
  Source: `SPEC.md` — “Semantic architecture at a glance”

- [ ] **CORE-007 — Conformance invariants.** A conforming implementation MUST preserve all 15 invariants: zero-ceremony value; stable semantic identity independent of names/paths/wording; fine-grained canonical state; relevance before impact; singular semantic ownership with relation/applicability retrieval; evidence before authority; progressive architecture commitment; meaning over encoding; deterministic-first/AI-at-uncertainty; dependency-scoped validity; proof-aware optimization; observed-vs-predicted reconciliation; crash-consistent governed mutation; truthful unavailable/open-world/stale boundaries; and no ontology cathedral.  
  Source: `SPEC.md` — “Core invariants”

- [ ] **CORE-008 — Vertical delivery.** Implementation MUST proceed by vertical slice, each closing a causal loop with failing tests first, inspectable contracts, bounded context, deterministic machinery where possible, verification, reconciliation, and explicit proof boundaries. Broad visualization, cloud adapters, universal language support, and speculative ontology work MUST wait until required local slices pass acceptance scenarios.  
  Source: `SPEC.md` — “Delivery rule”

- [ ] **PROD-001 — Zero-ceremony initialization.** Projector MUST derive useful structure before asking a user to author semantic models. `projector init` MUST provide useful findings before any ontology or architecture ceremony is required. `projector init` MUST, in order or equivalent causally valid staging: detect repository root and Git state; generate minimal `.projector/config.json`; inventory surfaces; build deterministic indexes; classify stable Projection Units; infer candidate concepts/relations; cluster recurring descriptive patterns; inspect Git history for stability, migration direction, and copy ancestry; evaluate high-value pattern authority; produce justified candidate/shadow lenses; calculate multi-dimensional coverage; emit divergence/anomaly report; offer policy-allowed deterministic repairs; generate cleanup plan; install/update requested host adapters; and report the next highest-information unresolved architecture concern, decision, or semantic question. No manual semantic modeling is required before the divergence/anomaly report.  
  Source: `01-product/vision-and-north-star.md` — “Zero-ceremony initialization”

- [ ] **PROD-002 — Init variants and idempotence.** `projector init --audit-only`, `--offline`, `--deep`, `--interactive`, and `--autonomous` MUST exist, and `init` MUST be idempotent.  
  Source: `01-product/vision-and-north-star.md` — “Zero-ceremony initialization”

- [ ] **PROD-003 — Explainability.** `projector explain` MUST address a governed path, `concept:`, `lens:`, `divergence:`, `representation:`, `requirement:`, and `relevance:` target and support `--context-for <target> --operation modify`. Its trace MUST include classification; canonical identity/aliases; governing requirements/scenarios; relevance-entry reasons; applicable lenses; effective rules; selector-match reasons; authority decisions; supporting/contradicting evidence; upstream inputs; downstream dependents; derivation/validity; Control Policy; exceptions; invalidation conditions; compiled context; and, where applicable, representation profile, protected dimensions, and fidelity/token accounting.  
  Source: `01-product/vision-and-north-star.md` — “Explain any governed target”

- [ ] **PROD-004 — Audit under partial coverage.** `projector audit` MUST support `--scope`, `--since`, `--format json`, and `--fail-on severity:high`, and its report MUST remain useful under partial coverage.  
  Source: `01-product/vision-and-north-star.md` — “Audit at any time”

- [ ] **PROD-005 — Reconcile direct work.** `projector reconcile`, `--base`, and `--fix` MUST treat the working tree as observed state regardless of whether Projector performed the work. Every direct edit MUST resolve to exactly one of: conforming existing projection; semantic change requiring graph/model update; legitimate pattern/exception proposal; or unexplained divergence.  
  Source: `01-product/vision-and-north-star.md` — “Reconcile arbitrary agent work”

- [ ] **PROD-006 — Change compilation.** Before impact planning, `projector change`, `projector plan change:<id>`, and `projector apply plan:<id>` workflows MUST resolve requests against existing semantic identities, compile bounded Relevance Closure, and then report exact known impact plus explicit uncertainty. Relevance defines knowledge needed to understand; Impact Closure defines effects of the known delta.  
  Source: `01-product/vision-and-north-star.md` — “Compile and execute semantic changes”

- [ ] **PROD-007 — Progressive completion.** `projector complete` MUST support `--scope` and `--budget`; the user MAY stop at any point, and accepted knowledge/cleanup MUST remain resumable.  
  Source: `01-product/vision-and-north-star.md` — “Complete semantic coverage progressively”

- [ ] **PROD-008 — Modernization grounding.** `projector upgrade` MUST support `--category architecture` and `--scope`; recommendations MUST begin with demonstrated repository friction or platform constraints, not novelty.  
  Source: `01-product/vision-and-north-star.md` — “Recommend and execute modernization”

- [ ] **PROD-009 — Architecture preflight.** A feature/change request MUST trigger preflight when its requirement delta introduces or materially affects concerns. Preflight MUST: separate behavior/constraints from solutions; discover material concerns; identify decisions affected by assumptions/scope/platform/toolchain/evidence; reuse unaffected valid decisions; classify unresolved concerns as exactly `blocking-now`, `material-soon`, or `deferable`; refresh live research only when mutable facts materially matter and evidence freshness is insufficient; assess viable alternatives against hard constraints, local evidence, migration/operational cost, and preferences; show the smallest high-information decision set needed next; compile accepted decisions into rules/lenses/Impact Rules/constraints/migrations or an intentionally empty keep-simple outcome; and block completion only for a concern actually blocking the affected scope. Projector SHOULD avoid premature and accidental architecture.  
  Source: `01-product/vision-and-north-star.md` — “Progressively disclose architecture decisions”

- [ ] **PROD-010 — North-star change result.** Once sufficient coverage exists, a conceptual `projector change` request MUST return normalized intent; identity resolutions/new-identity justifications; relevant requirements/scenarios/invariants/decisions/events/contracts/bindings; bounded relevance with reasons/uncertainty; applicable decisions/lenses; known affected closure; uncertainty frontier; dependency-ordered plan; deterministic repairs; bounded agent residue; validations; truthful completeness; and a change certificate. The causal loop MUST become cheaper as accepted relationships and reasoning become reusable machinery.  
  Source: `01-product/vision-and-north-star.md` — “Executive summary”

- [ ] **PROD-033 — Compounding causal loop.** Projector MUST make the causal loop cheaper over time in this order: observe reality → infer concepts, relationships, and patterns → establish authority → resolve semantic identities before creating new ones → compile behavioral intent and relevance relationships → discover the bounded knowledge subgraph for each requested change → compile executable lenses and rules → compile target-specific semantic representations → record derivations → detect divergence → invalidate minimally → repair deterministically when possible → dispatch agents only for semantic residue → compare predicted and observed impact → verify → reconcile → promote accepted newly learned relationships → certify → convert accepted reasoning into reusable machinery.  
  Source: `01-product/vision-and-north-star.md` — “Executive summary”

### Product principles

- [ ] **PROD-011 — Evidence before authority.** Repetition describes precedent only. Normative authority requires explicit decision, constraint, independently useful evidence, or policy-permitted promotion. Model inference alone MUST NOT authorize a blocking rule, active Projection Lens, or architecture migration.  
  Source: `01-product/principles-and-non-goals.md` — “Evidence before authority”

- [ ] **PROD-012 — Rebuildable accepted intent.** Accepted intent MUST be durable and rebuildable from version-controlled canonical files; observations, indexes, hypotheses, caches, and run state MUST remain rebuildable derived state. Deleting `.projector/state.db` MUST NOT destroy accepted Concepts, Requirements, Behavioral Scenarios, authored Relations, active lenses/rules, decisions, exceptions, or migrations.  
  Source: `01-product/principles-and-non-goals.md` — “Canonical intent and derived state are different things”

- [ ] **PROD-013 — Deterministic-first routing.** Deterministically solvable facts, selectors, transformations, validations, and invalidation dependencies SHOULD become machinery. Repeated successful reasoning SHOULD crystallize into recognizers, rules, transforms, validators, or cached decisions when this lowers cost without weakening correctness. Models are appropriate for semantic classification, competing-pattern interpretation, rationale synthesis, architecture judgment, bounded handwritten-code repair, and adversarial review. Models are not the default mechanism for hashing, parsing, selector evaluation, known dependency traversal, deterministic transforms, or invariant checking; deterministic work MUST remain the default where it is sufficient.  
  Source: `01-product/principles-and-non-goals.md` — “Deterministic first”; “AI at the uncertainty frontier”

- [ ] **PROD-014 — Assurance-bound optimization.** Projector MUST distinguish similarity from proof. Any pruning, validity, or exact-closure optimization MUST state its assurance and evidence lane. Heuristic equality MAY prioritize/narrow analysis but MUST NOT alone prove downstream validity.  
  Source: `01-product/principles-and-non-goals.md` — “Optimization is assurance-bound”

- [ ] **PROD-015 — Truthful completeness.** Every completeness/impact claim MUST identify modeled boundary, known affected set, possible frontier, unavailable/open-world dependency lanes, stale/failed observations, and unknowns.  
  Source: `01-product/principles-and-non-goals.md` — “Exactness without false certainty”

- [ ] **PROD-016 — No synchronization ceremony.** Projector MUST NOT require users to remember to synchronize specs and implementation; reconciliation MUST observe intent→surfaces and surface mutations→semantic state.  
  Source: `01-product/principles-and-non-goals.md` — “No manual synchronization ceremony”

- [ ] **PROD-017 — Reuse without self-justification.** Accepted decisions, lenses, mappings, validators, transforms, and rationale SHOULD be reused until relevant inputs change, but Projector-created conformity MUST NOT independently prove its creating rule/lens correct.  
  Source: `01-product/principles-and-non-goals.md` — “Accepted knowledge compounds without becoming self-justifying”

- [ ] **PROD-018 — Model only consequential semantics.** A modeled entity is justified only if removing it changes planning, applicability, invalidation, transformation, verification, explanation, architecture, authority, or completeness semantics.  
  Source: `01-product/principles-and-non-goals.md` — “No ontology cathedral”

- [ ] **PROD-019 — Governed acceptance.** Agents MAY explore and generate freely inside declared sandboxes. Completion is a system claim, not an agent assertion. Governed completion requires state-bound plans, applicable rules, required independent evidence, reconciliation, and explicit unknowns; an agent assertion is insufficient.  
  Source: `01-product/principles-and-non-goals.md` — “Generation may be aggressive. Acceptance is governed”

- [ ] **PROD-020 — Layered correctness.** Projector MUST distinguish: rebuild correctness, where incremental state agrees with a clean rebuild from the same canonical inputs; independent conformance, where compilers, tests, schemas, runtime evidence, property checks, or independent reviewers support the semantic claim; and historical/metamorphic validity, where lenses and selectors make useful predictions on prior or perturbed states. A clean rebuild using the same analyzer implementation is not independent behavioral proof.  
  Source: `01-product/principles-and-non-goals.md` — “Correctness uses layered oracles”

- [ ] **PROD-021 — Crash consistency.** Plans, work packets, approvals, and Execution Capsules MUST bind to their repository/canonical/toolchain state. Mutating workflows MUST journal enough state for safe process-death/host-interruption recovery.  
  Source: `01-product/principles-and-non-goals.md` — “Semantic transactions are state-bound and crash-consistent”

- [ ] **PROD-022 — Terminating governance.** Applicability, composition, expectations, validity, reconciliation, and decision dependency groups MUST have explicit strata. Cycles require declared fixed-point semantics, cycle detection, and convergence limits. Failure MUST be visible, never an infinite loop or implicit evaluation-order settlement.  
  Source: `01-product/principles-and-non-goals.md` — “Governance must terminate”

- [ ] **PROD-023 — Progressive commitment.** Projector MUST delay decisions until concerns are material, then resolve them before irreversible accidental commitments. Requirements activate questions, not technologies. Existing decisions remain reusable until a typed reconsideration input materially affects scope/justification.  
  Source: `01-product/principles-and-non-goals.md` — “Progressive architecture commitment”

- [ ] **PROD-024 — Inspectable governance chain.** Every material architecture decision MUST expose concern → selected option → authority/rationale → consequences. Every active blocking rule/lens MUST have typed Governance Basis; valid bases include hard constraint, adopted standard, migration overlay, host safety boundary, authorized lens, or architecture decision.  
  Source: `01-product/principles-and-non-goals.md` — “Decisions explain governance consequences”

- [ ] **PROD-025 — Preferences are nonbinding.** Developer/organization preferences are visible decision-support priors and become enforceable only via explicit project decision/constraint. Material preference influence MUST be shown in recommendation explanations.  
  Source: `01-product/principles-and-non-goals.md` — “Preferences inform. Constraints govern”

- [ ] **PROD-026 — Meaning over representation.** Canonical semantic intent, governance, and executable predicates MUST remain authoritative over human-readable and agent-optimized renderings. Human documentation, compact agent context, generated host instructions, and machine-facing invariant serializations are Representation Projections derived from canonical sources. Every Representation Projection MUST identify source semantic state and representation profile. Editing one MUST NOT silently mutate intent: true semantic edits go through semantic-change/authority workflow; otherwise regenerate or classify divergence.  
  Source: `01-product/principles-and-non-goals.md` — “Meaning is authoritative. Encoding is derived”

- [ ] **PROD-027 — Instruction efficiency.** Optimization MUST preserve semantics and verification and account for representation overhead, repeated profile injection, repair/retry, and behavior degradation. Token-saving MAY be skipped when source is terse, overhead exceeds savings, or outcomes worsen.  
  Source: `01-product/principles-and-non-goals.md` — “Optimize instruction efficiency, not token count alone”

- [ ] **PROD-028 — Identity before creation.** Before creating any durable Concept, Requirement, or Behavioral Scenario, Projector MUST attempt resolution against canonical identities. Names, paths, and wording are signals only. A new identity requires an inspectable non-ownership reason.  
  Source: `01-product/principles-and-non-goals.md` — “Resolve identity before creating semantics”

- [ ] **PROD-029 — Relevance before impact.** Relevance discovery and Impact Closure MUST remain distinct. Relevance MAY use confidence-ranked semantic/historical evidence to avoid omission; mutation/completion still requires stronger impact, invalidation, and coverage proof.  
  Source: `01-product/principles-and-non-goals.md` — “Relevance precedes impact”

- [ ] **PROD-030 — Encapsulation and traversal.** Each canonical semantic fact MUST have one authoritative owner/home; cross-cutting semantics MUST NOT be copied into every package or subsystem they affect merely to make them discoverable. Repository hierarchy, semantic ownership, event topology, platform topology, and retrieval topology are separate concerns. Typed relations, applicability, bindings, and bounded traversal retrieve singular truth.  
  Source: `01-product/principles-and-non-goals.md` — “Encapsulation owns. Traversal retrieves”

- [ ] **PROD-031 — Canonical behavior.** Durable behavior SHOULD become canonical Requirements/Behavioral Scenarios when it affects planning, verification, explanation, or closure. Markdown, Gherkin, ticket text, and agent summaries are representation/origin evidence and MAY propose changes, but authority requires normalization through semantic transactions. Correctness MUST NOT depend on an agent browsing a spec directory.  
  Source: `01-product/principles-and-non-goals.md` — “Behavior is canonical. Spec encodings are projections”

- [ ] **PROD-032 — Local validity.** Global repository/canonical-root digests MAY identify snapshots but MUST NOT alone stale independently scoped work. Plans, capsules, approvals, and mutation capabilities MUST bind explicit semantic/physical dependencies and query-result fingerprints.  
  Source: `01-product/principles-and-non-goals.md` — “Snapshot identity is not local validity”

### Canonical state, identity, and graph contracts

- [ ] **KERN-001 — Public schema completeness.** Every public serialized contract MUST have a corresponding Zod schema. A normative block MUST NOT reference an undefined cross-package type. CI MUST load the exported registry and fail if a referenced public schema is absent or is not explicitly marked `extension-defined`. Backward-compatible fields MAY be added, but MUST preserve the specified semantics.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Core contract authority”

- [ ] **KERN-002 — Base types.** Implement exact public types: `EntityId = string`; `Confidence = number` in `0..1` (not calibrated probability unless stated); `ContentHash = \`sha256:v1:${string}\``; `SourceClass = "authored" | "derived" | "observed" | "inferred"`; `EvidenceRef` fields `evidenceId`, stance `supports|contradicts|context`, optional `weight`; and `SemanticSignature` fields `hash`, `profileId`, `profileVersion`, `scope`, assurance `exact|validated|heuristic`, `evidenceIds`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Base identity, source class, and semantic hashing”

- [ ] **KERN-003 — Causal origin contract.** `CausalOrigin.kind` MUST be one of `pre-projector`, `human`, `deterministic-observation`, `model-inference`, `semantic-resolution`, `relevance-analysis`, `planning-surprise`, `lens-transform`, `plan`, `external`, with optional typed causal IDs for lens, rule, transform, semantic change, relevance closure, planning surprise, plan, and packet.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Base identity, source class, and semantic hashing”

- [ ] **KERN-004 — Semantic hashing.** Every entity schema MUST define the exact normalized semantic projection. Timestamps, run IDs, cache paths, and UI metadata MUST be excluded unless explicitly meaningful. Authored IDs persist; derived IDs are deterministic and adapter-namespaced from canonical identity; inferred IDs combine stable semantic key and normalized evidence-set identity; moves preserve ID; split/merge/replace/delete MUST emit lineage and tombstones.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Base identity, source class, and semantic hashing”

- [ ] **KERN-005 — Lineage contracts.** `LineageRecord.kind` MUST be `move|split|merge|replace|delete` and include `id`, `fromIds`, `toIds`, `reason`, `stateDigest`. `Tombstone` MUST include `entityId`, `deletedAtRevision`, `lastSemanticHash`, `replacementIds`, `reason`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Base identity, source class, and semantic hashing”

- [ ] **KERN-006 — Concept contract.** `Concept` MUST expose `id`, `key`, `kind`, `name`, `aliases`, `statement`, `status`, `sourceClass`, `confidence`, `tags`, `evidence`, `discoveryHash`, `semanticHash`; `kind` MUST be one of `capability|behavior|invariant|decision|ownership|obligation|data|interface|event|command|policy|read-model|contract|assumption|migration|constraint`; status MUST be `candidate|active|deprecated|rejected`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-007 — Relation contract.** `Relation` MUST expose `id`, `fromId`, `toId`, `type`, `sourceClass`, `confidence`, `evidence`, `active`, `semanticHash`; type MUST be one of `realizes|requires|constrains|depends-on|has-requirement|demonstrated-by|produces|consumes|triggers|governed-by|applies-to|generates|documents|verifies|deploys-to|publishes-to|observes|owns|incompatible-with|derived-from|supersedes|exception-to|variant-of`. A Relation is fact/hypothesis only and MUST NOT imply mandatory governance; exact invalidation comes from derivation inputs and widening from active `ImpactRule`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-008 — Requirement/scenario contracts.** `Requirement` MUST expose `id,key,title,aliases,statement,status,sourceClass,scope,origin,evidence,discoveryHash,semanticHash`; `BehavioralScenario` MUST expose `id,key,title,aliases,status,sourceClass,scope,steps,evidence,discoveryHash,semanticHash`; both statuses are `candidate|active|deprecated|rejected|superseded`. `IntentOriginRef` MUST expose `kind,locator`, with optional `contentHash` and `description`; `kind` is `user-request|linear|github-issue|document|external`. Each scenario step MUST expose `role` and `statement`; role is `precondition|trigger|expected-outcome|forbidden-outcome`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-009 — Behavioral entity usage.** Requirements/scenarios are canonical only when stable identity changes planning, relevance, verification, explanation, or closure; trivial edits do not require them. Semantic/product dimensions SHOULD define behavioral scope. Implementation-only path/language/AST/control atoms MUST NOT define behavior unless location is an accepted product/compatibility constraint; bindings belong in derived Relations/Projection Units. Scenarios capture observable semantics, not test files or Gherkin syntax trees; `GIVEN`/`WHEN`/`THEN`/`AND`/`BUT`, Cucumber/Behave features, generated test skeletons, and human-readable acceptance specifications MAY be Representation Projections or verification evidence derived from the same scenario identity. Conjunction wording MUST NOT define identity.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-010 — Identity metadata dimensions.** Alias/key/name/title changes MUST NOT create a new entity or imply meaning changed. `discoveryHash` covers resolution/retrieval metadata; `semanticHash` covers meaning/applicability and excludes display metadata unless semantically meaningful; canonical document hash changes for every canonical-field change.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-011 — Heterogeneous graph ownership.** Event/command/policy/read-model/contract topology SHOULD use stable Concepts plus typed Relations, with specialized entities only when they change Projector behavior enough to justify them. Requirement↔Capability and Requirement↔Scenario edges MUST use typed Relations `has-requirement` and `demonstrated-by`, not duplicated authoritative endpoint lists. Derived indexes MAY materialize adjacency arrays for query speed, but remain rebuildable. `Concept` MUST NOT duplicate a Requirement, BehavioralScenario, or ArchitectureDecision. `Concept.kind="decision"` is reserved for durable non-architecture decisions that do not use `ArchitectureDecision`; a `behavior` Concept names reusable behavioral meaning, while a normative obligation belongs in a `Requirement`.  
  Source: `02-semantic-kernel/identity-and-relations.md` — “Concepts and factual relations”

- [ ] **KERN-012 — Canonical directory contract.** Canonical authored/governance state MUST be closed under rebuild. Canonical state MUST use the `.projector/` structure: `config.json`; fine-grained `model/concepts`, `model/requirements`, `model/scenarios`, `model/relations`; `rules`, `lenses`, `representations`, `authorities`, `concerns`, `decisions`, `preferences` (project-adopted only), `exceptions`, `migrations`, `receipts`; and ignored-by-default `plans`, `certificates`, `reports`, `generated` unless opted in, `cache`, and fully derived `state.db`.  
  Source: `02-semantic-kernel/canonical-state.md` — “`.projector/` canonical contract”

- [ ] **KERN-013 — Canonical/derived split.** Canonical defaults are configuration; authored Concepts/Relations; accepted Requirements/scenarios; active or approved rules/lenses/Semantic Representation Profiles; governing authority records; material architecture concerns with durable dispositions; active/superseded decisions; adopted preferences; exceptions; migrations; required R2+ receipts. Representation outputs remain derived even if committed. Undecided concerns, proposals, selector matches, indexes, transient findings, model calls, raw research, caches, observations, and inference MUST remain derived/ignored (SQLite or ignored artifacts). External user/org preference profiles are external inputs and MUST NOT enter repository governance without adoption.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical content”

- [ ] **KERN-014 — Fine-grained addressability.** Canonical semantic state under `.projector/model/` MUST be fine-grained and independently addressable: Concepts, Requirements, Behavioral Scenarios, and authored Relations persist by stable semantic identity, never as a project-wide semantic blob or dump of derived observations. Directory hierarchy is a storage/indexing projection, not semantic authority; moving/sharding by stable-ID prefix MAY occur without semantic effect. Generated indexes and Projector queries MAY support browsing but MUST NOT make path hierarchy define meaning.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical content”

- [ ] **KERN-015 — Canonical document schema.** Every canonical document MUST have API/schema version, stable ID/key, lifecycle, semantic hash over declared projection, discovery hash when needed, and stable-ID references. Complete snapshot identity MUST use deterministic complete canonical-document hashes, not semantic hashes alone. Volatile data MUST NOT affect semantic hashes unless declared meaningful. Format migrations MUST be deterministic, versioned, previewable, and independently testable.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical schema requirements”

- [ ] **KERN-016 — Local canonical operations.** A bounded change MUST NOT require loading or rewriting the complete semantic graph to resolve, modify, validate, or hash dependencies. Physical storage MUST preserve enough semantic locality to avoid needless Git conflicts, context ingestion, cache invalidation, plan invalidation, and review noise. Stable IDs, not filenames or directories, define identity. Multi-document semantic transactions MUST remain journal-atomic. Global digests MUST NOT be the sole validity dependency for local plans, capsules, approvals, or mutation capabilities.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical semantic addressability”

- [ ] **KERN-017 — Canonical root manifest.** A derived manifest MAY be computed deterministically from the sorted `(entityId, canonicalDocumentHash)` set plus other canonical governance files. `canonicalDocumentHash` MUST use deterministic serialization of the complete canonical document, excluding only explicitly noncanonical/volatile fields, and MUST remain distinct from `semanticHash` and `discoveryHash`. Every canonical edit MUST change complete snapshot identity without implying every edit changed behavioral meaning. Serialization MUST be deterministic; the manifest MUST remain rebuildable and MUST NOT be independently edited authority.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical semantic addressability”

- [ ] **KERN-018 — Relation locality.** Each Relation MUST be stored independently unless a future semantically atomic aggregate is defined. A relation and endpoints MUST NOT be required to share directory/package.  
  Source: `02-semantic-kernel/canonical-state.md` — “Canonical locality and relations”

- [ ] **KERN-019 — Version-control defaults.** Commit canonical state. Ignore `state.db`, caches, transient reports, generated host files, verbose certificates, and unfinished local plans unless opted in. R2+ semantic/governance transactions MUST commit compact content-addressed receipts; policy MAY require R1 receipts. Ordinary observations MUST NOT generate one repository event file per fact.  
  Source: `02-semantic-kernel/canonical-state.md` — “Version-control defaults”

- [ ] **KERN-020 — Rebuild inputs.** Deterministic local rebuild MUST use only repository/Git state, committed canonical `.projector/` state, and an explicitly pinned external snapshot if requested. It MUST NOT silently read live external systems.  
  Source: `02-semantic-kernel/canonical-state.md` — “Rebuild inputs”

### Governance, architecture, and representation

- [ ] **KERN-021 — Governance strata.** Default evaluation strata MUST be `L0 physical observations`, `L1 deterministic structure`, `L2 semantic classifications and hypotheses`, `L3 lens memberships`, `L4 effective rules and projection expectations`, `L5 derivations, validity, divergence, and completion state`. Dependencies SHOULD point higher→lower; L0 MUST NOT depend on L4 applicability. Recursive extensions MUST declare participating entities, monotonic update semantics or another well-defined fixed-point rule, strongly connected component evaluation, a state-digest convergence test, maximum iterations/time, and the failure emitted if convergence is not reached. Required failures include `governance-cycle`, `nonconvergent-reconciliation`, and `derivation-cycle-unresolved`.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Governance strata”

- [ ] **KERN-022 — Oracle separation.** Rebuild, independent conformance, and historical/metamorphic oracles MUST NOT be collapsed. The rebuild oracle detects incremental/cache/indexing mistakes by rebuilding from canonical local inputs; the independent conformance oracle supplies semantic evidence from an independent lane such as compiler/type system, pre-existing tests, schemas, runtime observations, property tests, or an independent reviewer; the historical/metamorphic oracle evaluates whether a lens, selector, or transform predicts useful outcomes across historical or systematically perturbed states. Assurance MUST reflect the actual supporting oracle.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Correctness oracles”

- [ ] **KERN-023 — Scope-aware decisions.** Architecture decisions reside in the Intent plane and compile consequences into the Lens plane; they are not a fourth implementation surface. Lifecycle MUST be scope-aware: a mobile target may make a web-only decision suspect for mobile but MUST NOT invalidate it for existing web scope.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Architecture decision lifecycle”

- [ ] **KERN-024 — Change cognition separation.** Derived traversal MUST follow user intent → parallel WHAT/WHY analysis and WHERE/WHAT-ELSE scout → identity resolution → bounded relevance → requirement/scenario/constraint delta → architecture preflight → impact → capsules → implementation → reverse impact → predicted/observed comparison → reconciliation. It MUST NOT become a parallel truth source. Change intake MUST keep distinct: WHAT/WHY (requested behavior, constraints, and intent); WHERE/WHAT-ELSE (existing semantic/code/event/contract neighborhoods that may be implicated); and HOW (architecture and implementation choices, decided only after the first two are sufficiently understood). Protecting WHAT from premature HOW MUST NOT require ignorance of WHERE.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Change cognition: relevance before impact”

- [ ] **KERN-025 — Representation target classes.** Default targets MUST implement: human technical (explicit actors/conditions, one stable name per concept, direct verbs, short single-purpose sentences, structured procedures, with style scoring not treated as semantic proof); agent compact context (measure actual tokens after profile overhead; remove filler, pleasantries, hedging, redundant rationale, and repeated explanations; permit fragments only when protected semantics stay unambiguous; preserve code/commands/paths/API names/numbers/units/identifiers/negation/normative force); and machine invariant (directly serialize normalized rules/predicates/scopes/permissions/dependencies/hashes). Representation MUST derive from canonical source where available. Cross-projection consistency uses common source hashes plus compatible Semantic Preservation Fingerprints, not text similarity.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Semantic representation projections”

- [ ] **KERN-026 — Profile invalidation.** Profile changes MUST invalidate only dependent projections/contexts/derivations unless canonical governance also changes; they MUST NOT dirty the underlying decision/rule solely due to encoding. Third-party writing/compression systems MUST NOT be required runtime dependencies.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Semantic representation projections”

- [ ] **KERN-027 — Architecture concern contract.** Implement `ConcernMateriality = blocking-now|material-soon|deferable`; activation kinds `requirement-delta|scenario-delta|relevance-discovery|planning-surprise|constraint-delta|surface-added|scale-signal|pattern-friction|decision-trigger|research|user-request|inference`; concern status `candidate|active|deferred|resolved|dismissed|superseded`. `ConcernActivationReason` MUST contain `kind`, `subjectIds`, `explanation`, `causalOrigin`. `DecisionDeferral` MUST contain `rationale`, `preserveOptionality`, `forbiddenCommitments`, `reconsiderWhen`, optional `reviewBy`. `ArchitectureConcern` MUST contain `id,key,title,question,scope,sourceClass,status,materiality,activationReasons,relatedConceptIds,relatedRequirementIds`, optional `relevanceClosureId`, `decisionIds`, optional `deferral`, `evidence`, and `semanticHash`.  
  Source: `02-semantic-kernel/architecture-decision-contracts.md` — “Architecture concern, decision, preference, and governance-basis contracts”

- [ ] **KERN-028 — Architecture decision contract.** `DecisionConsequence` MUST contain `kind,targetId?,scope?,payload?,explanation`, with `kind` exactly `activate-governance|deactivate-governance|introduce-constraint|retire-constraint|select-technology|deprecate-technology|require-migration|activate-concern|constrain-decision|advisory`. `ArchitectureDecision` MUST contain `id,key,concernId,title,decision,selectedOptionKey,scope,lifecycle,authorityRecordId,governanceBasis,consequences,appliedPreferences,supersedesDecisionIds`, optional `migrationId`, and `semanticHash`; lifecycle is `active|superseded|retired`.  
  Source: `02-semantic-kernel/architecture-decision-contracts.md` — “Architecture concern, decision, preference, and governance-basis contracts”

- [ ] **KERN-029 — Decision evaluation/validity.** `DecisionOption` MUST contain `key,title,description,hardConstraintStatus,tradeoffs,evidence,preferenceFit`, with `hardConstraintStatus` exactly `passes|fails|unknown`. `DecisionEvaluation` MUST contain `id,concernId,scope,options,eliminatedOptionKeys,recommendedOptionKey?,outcome,hardConstraints,preferenceSnapshotHash,researchEvidenceIds,unknowns,evaluatedAt,semanticHash`, with outcome exactly `recommended|contested|insufficient-evidence`. `DecisionValidityAssessment` MUST contain `decisionId,scope,state,firedTriggers,invalidatedAssumptions,staleEvidenceIds,blocksCurrentChange,explanation`, with scope-specific state exactly `valid|suspect|contested|invalid-for-scope`.  
  Source: `02-semantic-kernel/architecture-decision-contracts.md` — “Architecture concern, decision, preference, and governance-basis contracts”

- [ ] **KERN-030 — Preferences and Governance Basis.** `DeveloperPreference` MUST contain `id,key,scope,selector,strength,statement,status,sourceClass,semanticHash`, optional `rationale`, with `scope` exactly `user|organization|project`, `strength` `prefer|strongly-prefer|avoid`, and `status` `active|retired`. `GovernanceBasis` MUST be exactly one of `{kind:"architecture-decision",decisionId}`, `{kind:"hard-constraint",conceptId}`, `{kind:"adopted-standard",authorityRecordId}`, `{kind:"migration-overlay",migrationId}`, `{kind:"host-safety",key}`, or `{kind:"active-lens",lensId}`. Preferences MUST NOT directly compile into blocking rules; governance requires an independently reviewable accepted constraint/decision.  
  Source: `02-semantic-kernel/architecture-decision-contracts.md` — “Architecture concern, decision, preference, and governance-basis contracts”

- [ ] **KERN-031 — Concern/decision canonicality.** Candidate concerns and Decision Evaluations are derived/inferred by default. A concern becomes canonical only with durable material disposition. `ArchitectureDecision` is the complete schema for `.projector/decisions/*.decision.json`.  
  Source: `02-semantic-kernel/architecture-decision-contracts.md` — “Architecture concern, decision, preference, and governance-basis contracts”

- [ ] **KERN-032 — Representation contracts.** Implement exact `RepresentationTarget = human-technical|behavior-spec|agent-context|machine-invariant`; protected dimensions `normative-force|negation|scope|quantifier-cardinality|logical-connective|condition-guard|exception|dependency-order|behavior-step-role|concept-identity|identifier-literal`. `SemanticPreservationFingerprint` MUST contain `sourceSemanticHash,profileId,profileVersion,protectedDimensions,dimensionHashes,dimensionAssurance,unsupportedDimensions,assurance,evidenceIds,semanticHash`, and overall assurance MUST be no stronger than the weakest protected dimension. Style-rule kind MUST be `terminology|sentence-structure|active-voice|condition-order|scenario-structure|paragraph-structure|word-choice|punctuation|abbreviation|narration|filler-removal|token-optimization|literal-preservation`, with `key,parameters,blocking`. Profile MUST contain `id,key,version,status,target,selector,optimization,protectedDimensions,styleRules,generatorId,validatorIds`, optional `tokenizerProfileId,fallbackProfileId`, and `semanticHash`; status is `active|deprecated|retired`, optimization `clarity-first|token-first|machine-first`. Projection MUST contain `id,profileId,profileVersion,target,sourceEntityIds,sourceSemanticHash,boundState,contentHash,preservation`, optional token accounting, status `valid|suspect|invalid|fallback-used`, `validatorResults,semanticHash`. Its ref contains `projectionId,profileId,profileVersion,contentHash,preservationHash`; token accounting exposes optional `sourceTokens,outputTokens,profileOverheadTokens,estimatedNetTokens,tokenizerProfileId`.  
  Source: `02-semantic-kernel/representation-contracts.md` — “Semantic representation contracts”

- [ ] **KERN-033 — Profile authority boundary.** Representation contracts MUST reuse canonical entities, not a parallel requirement ontology. Profiles govern encoding only, do not require an Architecture Decision by default, MUST NOT harden style preferences into software rules, and apply through selectors rather than rewriting all prose. Existing prose remains authored absent explicit generated-projection governance.  
  Source: `02-semantic-kernel/representation-contracts.md` — “Semantic representation contracts”

- [ ] **KERN-034 — `human-technical@1`.** Apply exactly, without claiming certification against an external writing standard: one canonical name/concept; explicit alias only when needed; short common words when they preserve technical precision; explicit useful actor and active voice; direct verbs while avoiding needless nominalizations and stacked helper verbs; one claim/instruction per sentence; prose sentences ≤25 words; condition before dependent action; no contractions or semicolons; no marketing/modal/discourse filler; one topic per paragraph; paragraphs ≤6 sentences; numbered vertical procedures with one action/step; preserve code, commands, paths, IDs, APIs, exact errors, numbers, units; passive/nominalization detectors are review signals only. The specification MUST pass the blocking mechanical subset: sentence length, semicolons, contractions, marketing language, modal filler, discouraged verbose wording, paragraph length.  
  Source: `02-semantic-kernel/representation-contracts.md` — “`human-technical@1`”

- [ ] **KERN-035 — `behavior-gherkin@1`.** This profile MAY generate executable Gherkin/BDD but MUST preserve stable source identities, step roles/order, conditions, exceptions, cardinality, and normative force. `.feature` files remain derived projections/evidence, never canonical behavior.  
  Source: `02-semantic-kernel/representation-contracts.md` — “`behavior-gherkin@1`”

- [ ] **KERN-036 — `agent-compact@1`.** This profile removes discourse filler, pleasantries, hedging, repeated explanation, and unnecessary narration; it MAY use unambiguous fragments and SHOULD use shorter words only with measured tokenizer savings. It MUST preserve code, commands, paths, API names, identifiers, exact errors, numbers, units and MUST NOT weaken/drop `no`, `not`, `never`, `only`, `except`, cardinality, conditions, ordering, or normative force. Standard well-known technical acronyms MAY remain. It SHOULD NOT invent prose abbreviations absent net savings and clarity; SHOULD suppress nonessential tool narration when host policy allows direct execution; SHOULD avoid prose arrows absent measured savings and unambiguous relation. Persisted docs SHOULD default to `human-technical@1`; compact output is transient unless governance says otherwise.  
  Source: `02-semantic-kernel/representation-contracts.md` — “`agent-compact@1`”

- [ ] **KERN-037 — `machine-invariant@1` and assurance.** The profile SHOULD serialize normalized predicate/rule kernel and protected identities with minimal prose and SHOULD provide `exact` assurance when representable. A natural-language linter proves only mechanical style conformance and MUST NOT claim truth/equivalence. Self-judged model output is heuristic/supporting only absent an independent lane. High-risk agent context SHOULD carry exact/validated machine kernel plus prose; inability to preserve required semantics MUST trigger safer fallback or blocking.  
  Source: `02-semantic-kernel/representation-contracts.md` — “`machine-invariant@1`”

- [ ] **KERN-038 — Contract completeness CI.** A machine-readable exported schema registry MUST exist. CI MUST verify Zod schemas and externally visible JSON Schema exports for serialized types, resolved cross-package references, declared semantic projections, API/schema versions, and prohibition on ad hoc invention of missing normative types.  
  Source: `02-semantic-kernel/representation-contracts.md` — “Contract completeness gate”

### Surfaces, bindings, ports, and implementation

- [ ] **KERN-039 — Surface contracts.** `ObservabilityClass` MUST be `closed|bounded|open|sampled|unavailable`. `EnumerationContract` MUST contain `observability,method,assumptions,blindSpots,dynamicMechanisms`, optional `freshnessRequirement`. `Surface` MUST contain `id,key,kind,adapter,access,enumeration,capabilities,boundary`; `kind` is `repository|ci|cloud|package-registry|app-store|website|runtime|database|external`; access is `read-write|read-only|declared-only|unavailable`; `SurfaceCapabilities` MUST expose boolean `read,write,watch,transactionalWrites,stableAnchors,humanApprovalRequired`. `Artifact` MUST contain `id,surfaceId,locator,mediaType,contentHash,observedAt,observationRevision,causalOrigin,metadata`, with optional `structuralSignature` and `semanticSignature`. External observations MUST be revisioned; `observedAt` is informational and excluded from local semantic rebuild hashes.  
  Source: `02-semantic-kernel/surfaces-and-projection-units.md` — “Surfaces, observability, and artifacts”

- [ ] **KERN-040 — Projection Unit contracts.** `SemanticAnchor` MUST contain `kind,value`, optional `fallbackSignature`, with `kind` exactly `file|symbol|ast-node|json-pointer|yaml-path|markdown-section|workflow-job|resource-property|external-field`. `ControlPolicy` MUST contain ownership `exclusive|structured|shared|observed`, mutation `replace|transform|agent|external|none`, and actuation `automatic|approval|human|unavailable`. `LensRef` MUST contain `lensId,version,semanticHash`. `ProjectionUnit` MUST contain `id,artifactId,key,role,anchor,control,conceptIds,requirementIds,scenarioIds,lenses,tags,structuralSignature,semanticSignature,membershipHash,validity,confidence,causalOrigin,generatedFromUnitIds`; validity is `valid|suspect|invalid|revalidating|repair-planned|blocked|unreachable`, role is `implementation|contract|test|fixture|documentation|comment|configuration|deployment|publication|telemetry|migration|supporting`. Line numbers MUST NOT be canonical anchors.  
  Source: `02-semantic-kernel/surfaces-and-projection-units.md` — “Stable semantic anchors, control policy, and Projection Units”

- [ ] **KERN-041 — Projection Unit granularity.** Split only when a stable subregion changes independently, has separable governance/verification, and materially reduces work or conflict. Merge units when isolated identity or verification is not stable. `requirementIds` and `scenarioIds` provide direct traceability where known and need not duplicate transitive Concept relationships; a unit may implement a capability Concept while Requirement links derive through that capability. Direct bindings SHOULD be materialized only when they improve relevance, impact, verification, or explanation enough to justify maintenance/derivation cost.  
  Source: `02-semantic-kernel/surfaces-and-projection-units.md` — “Stable semantic anchors, control policy, and Projection Units”

- [ ] **KERN-042 — State binding schema.** `StateDigest` MUST contain `gitBase,worktreeDigest,canonicalProjectorDigest,toolchainDigest`, optional `pinnedExternalSnapshotDigest`; worktree/canonical digests are complete governed snapshot identities. `StateValueDependencyRef` MUST contain `kind,id,versionHash,role`, with kind `canonical-entity|canonical-governance|projection-unit|artifact|toolchain|adapter|signature-profile|representation-profile|external-snapshot`. `StateQuerySpec` MUST contain `id,kind,programId,programVersion,input,semanticHash`, with kind `semantic-identity-search|relation-neighborhood|reverse-derivation|selector-membership|impact-rule-applicability|decision-applicability|implementation-binding|event-topology|contract-topology|verification-binding|package-dependency|surface-enumeration|custom`. `StateQueryResultFingerprint` MUST contain `queryHash,resultHash,resultCount,observability,assumptions,unavailableLanes,dependencyKeys`; `StateQueryDependency` MUST contain `query,priorResult,role`; `StateBinding` MUST contain `compiledAgainst,valueDependencies,queryDependencies,dependencyDigest`; validation status MUST be `current|rebound|stale|suspect|unavailable` with current state, changed dependency IDs, reasons, and optional rebound binding.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-043 — Binding validation algorithm.** A changed snapshot root MUST NOT automatically stale local work. Recompare explicit value dependencies and boundary-defining query fingerprints: no relevant change → rebind; relevant change → stale/recompile/revalidate; unavailable/ambiguous lane → suspect and policy-driven widening. Omitting an applicability dependency is a stale-analysis bug.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-044 — Dependency hash precision.** Value dependency hashes MUST use the role-appropriate dimension: semantic meaning/signature for behavior/derivation, discovery metadata for name/alias consumers, complete document hash for exact identity, or an explicit versioned profile. Consumers MUST NOT bind broader hashes merely for convenience.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-045 — Query/negative-space binding.** Query dependencies MUST bind the discovery operations establishing the selected boundary, including negative-space conclusions such as no additional governing relation/consumer/membership within observable scope. They MUST bind a deterministic versioned query program plus normalized serializable input and MUST capture current result sets including empty sets whenever correctness depends on them. Canonical/query data MUST NOT embed arbitrary code. `resultHash` MUST deterministically cover identity, membership, existence, closure-relevant rank/qualifiers, and declared semantic properties, excluding display data. New concepts/requirements/relations/Projection Units/event consumers/contract consumers/selector matches/implementation bindings that change a result MUST stale or re-evaluate closure.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-046 — Conservative query validation.** After snapshot change, compare value hashes and re-evaluate each query whose dependency keys may have changed; if unchanged cannot be proven, rerun conservatively. Program/version changes invalidate. Failed/unavailable reevaluation yields `suspect`/`unavailable`, never silently current. `dependencyKeys` are optimization only. `dependencyDigest` MUST include normalized value and query dependencies plus query/result fingerprints, not merely returned entities. Global roots MUST NOT be inserted into every local set.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-047 — Observability-bounded absence.** Empty/unchanged results prove absence only for `closed`, or `bounded` while assumptions hold. `open`, `sampled`, and `unavailable` MAY rank relevance/widen frontiers but MUST NOT prove no additional relevant entity.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-048 — Validation/rollback evidence.** `ValidationResult` MUST contain `validatorId,status,summary,evidenceIds,evidenceLane,independenceGroup,assurance,authorSource,sideEffectClass,details,startedAt,completedAt`; status is `passed|failed|skipped|blocked`, lane `compiler|test|schema|runtime|property|representation|architecture|historical|human|independent-agent|same-packet-agent`, assurance `weak|supporting|strong|exact`, side effects `none|read-only|workspace-write|external-write`. `RollbackSpec` MUST contain `kind` `git-checkpoint|inverse-transform|compensation|manual|none`, optional `checkpointId,transformId,instructions`. `OperationEvidence` MUST contain `operationId,executor,unitIds,beforeHashes,afterHashes,evidenceIds,summary`, with executor `transform|agent|manual|external`.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “State binding and execution primitives”

- [ ] **KERN-049 — Core ports.** `AnalyzerCapabilities` MUST expose `analyzerId,adapterVersion,supportedLanguages,supportedSemantics,enumeration,executesRepositoryCode`; `AnalyzerFailure` MUST expose `analyzerId,capability,scope,message,recoverable,affectedClaimKinds`; `AdapterContext` MUST expose `repositoryRoot,stateDigest,config,signal`; `ArtifactFingerprint` MUST expose `contentHash`, optional structural/semantic signatures, and `adapterVersion`. `GraphReader` MUST expose `getConcept`, `getRequirement`, `getBehavioralScenario`, `getProjectionUnit`, directional `getRelations(id,"in"|"out"|"both")`, reverse derivation dependents, derivation inputs, selector dependencies, and optional identity search constrained to `concept|requirement|scenario`. `StateQueryReader.evaluate` and `StateBindingValidator.validate` MUST be asynchronous. `TransformContext` MUST contain `repositoryRoot,stateBinding,allowedUnits,dryRun,signal`; preview MUST contain `applicable,operations,touchedUnitIds,expectedDiff,warnings`; result MUST contain `transformId,changed,touchedUnitIds,operations`, optional `checkpointId`. `SurfaceChange` MUST contain `semanticChangeId,surfaceId,operation,payload`; `SurfacePlan` MUST contain `adapterId,surfaceId,riskClass,operations,requiredApprovals,validatorIds,boundState`; apply result MUST contain `changed,operationEvidence,externalReferences`. `TokenCounter` MUST expose `profileId` and `count(text): number`. Transform/surface execution MUST remain state-bound.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “Analyzer, graph, runtime, and surface ports”

- [ ] **KERN-050 — Supporting contracts.** `RecognizerBinding` MUST contain `id,version,adapterId,query,minimumConfidence`; `ValidatorBinding` MUST contain `id,version,provider,input,required` and optional `requiredIndependenceGroup`; `TransformBinding` MUST contain `id,version,input,exclusiveUnitClaim`; `MigrationBinding` MUST contain `fromVersion,toVersion,transformIds,validationIds`; `LensExample` has optional `unitId,artifactLocator` and required `explanation,evidenceIds`; `AuthorityAlternative` MUST contain `key,description,advantages,disadvantages,rejectedBecause,evidence`.  
  Source: `02-semantic-kernel/state-binding-and-ports.md` — “Lens/validator/transform supporting contracts”

- [ ] **KERN-051 — Ports architecture.** Domain/engine MUST depend on ports, not concrete analyzer/runtime/host/provider/persistence. CLI/application is composition root. Core semantic services MUST be testable with in-memory/fake ports; no host brand, SQLite API, vendor, process runner, or filesystem implementation may be required by domain contracts.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Reference implementation architecture”

- [ ] **KERN-052 — Package dependency direction.** Reference graph MUST be `core -> no workspace dependency`; `engine|analyzers|runtime|integrations -> core`; `cli -> core + engine + analyzers + runtime + integrations`. Integration wrappers MAY use the engine's narrow public facade but MUST NOT import internals. Concrete assembly belongs in CLI/application root. Packages SHOULD split only for justified release, security, performance, or dependency isolation.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Repository/package layout”

- [ ] **KERN-053 — Reference technology defaults.** Defaults are Node.js 24 LTS; strict TypeScript + ESM; pnpm workspaces; Zod + exported JSON Schema; SQLite derived state; TypeScript Compiler API for TS/JS; source-location-preserving structured-data/Markdown parsers; Git subprocess; Vitest + fast-check; canonical JSON + versioned SHA-256; JSONL + optional OpenTelemetry-compatible spans. Each default's stated rationale and reconsideration trigger MUST be materialized as Architecture Decision/Authority information and updated when changed.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”

- [ ] **KERN-054 — Source classes.** Every graph fact MUST identify exactly one class. Authored facts are canonical accepted intent. Derived facts are deterministic, disposable, recomputable. Observed facts come from runtime/external surfaces and MUST carry freshness. Inferred hypotheses MUST carry confidence, evidence, alternatives, uncertainty and MUST NOT silently become authored.  
  Source: `02-semantic-kernel/terminology-and-source-classes.md` — “Four source classes”; “Authored”; “Derived”; “Observed”; “Inferred”

- [ ] **KERN-055 — Canonical terminology semantics.** Implementations MUST preserve the distinctions in the canonical terminology table, especially Relation vs governance propagation, Relevance Closure vs Impact Closure, semantic ownership vs retrieval, state digest vs State Binding, Pattern Candidate vs authority, Invalidation vs regeneration, Representation Projection vs authority, and Coverage vs explicit Coverage Frontier. `Instruction Efficiency` MUST define its workload-specific numerator and MUST NOT be treated as a universal scalar quality score.  
  Source: `02-semantic-kernel/terminology-and-source-classes.md` — “Canonical terminology”

- [ ] **KERN-056 — Required semantic subsystems.** The reference implementation MUST provide all 16 subsystems: deterministic observation and indexing; canonical semantic identity, Requirement, and Behavioral Scenario management; semantic identity resolution and duplicate/overlap prevention; relevance discovery and bounded context-subgraph compilation; inference and Pattern Candidate mining; authority and rationale evaluation; selectors, lenses, and rule compilation; derivation, semantic invalidation, and Impact Closure; semantic representation compilation and fidelity validation; deterministic transformation runtime; semantic change analysis, planner, and packet executor; reverse-impact comparison, reconciliation, and divergence; coverage and information-gain interaction; agent orchestration; Host/MCP integration; and external surface adapter framework.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Reference implementation architecture”


### Knowledge, Relevance, Evidence, Architecture, and Risk


### Relevance and change cognition

- [ ] **KNOW-001 — Separate relevance from impact.** Projector MUST construct a pre-commit Relevance Closure of canonical semantics and observed implementation relationships that may materially affect interpretation or planning, distinct from the later conservative, observability-aware, proof-bound Impact Closure used for invalidation and execution. Relevance discovery MAY be exploratory and confidence-ranked because its failure modes are omission and context waste; Impact Closure MUST remain conservative, observability-aware, and proof-bound because it controls mutation and completion. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Purpose”.
- [ ] **KNOW-002 — Reject local and top-N substitutes.** Projector MUST prevent local reasoning from masquerading as globally coherent reasoning and MUST NOT treat top-N document or vector search as a Relevance Closure. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Purpose”.
- [ ] **KNOW-003 — Preserve cognition boundaries.** Change cognition MUST keep WHAT/WHY (behavior, constraints, goals, non-goals, outcomes), WHERE/WHAT-ELSE (identities, regions, events, contracts, consumers, tests, decisions, invariants, concerns), and HOW (architecture/implementation choices) separate; protecting WHAT from premature HOW MUST NOT require ignorance of WHERE. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “WHAT / WHY, WHERE / WHAT-ELSE, and HOW”.
- [ ] **KNOW-004 — Run parallel read-only cognition when non-trivial.** For non-trivial changes, Projector SHOULD evaluate WHAT/WHY and WHERE/WHAT-ELSE as parallel read-only tracks, merge them at semantic identity resolution, then produce bounded Relevance Closure, behavioral/requirement delta, architecture preflight, and finally Impact Closure in that order. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “WHAT / WHY, WHERE / WHAT-ELSE, and HOW”.
- [ ] **KNOW-005 — Constrain the Relevance Scout.** A Relevance Scout MAY inspect repository structure, semantic indexes, event/contract topology, tests, architecture decisions, and implementation bindings, but MUST NOT infer behavioral intent from implementation precedent or prematurely select a solution. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “WHAT / WHY, WHERE / WHAT-ELSE, and HOW”.
- [ ] **KNOW-006 — Resolve semantic identity before creation.** Names MUST NOT be treated as identities. Before creating a durable Concept, Requirement, Behavioral Scenario, or other canonical identity, Projector MUST resolve requested meaning against existing canonical entities; resolution SHOULD consider stable IDs/keys, names/aliases, similarity, typed Relations, ownership/boundary evidence, Projection Unit and Artifact bindings, event/contract topology, verification bindings, relevant decisions/invariants, and informative historical/co-change evidence. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-007 — Use the closed identity outcome vocabulary.** Semantic identity resolution outcomes MUST use exactly `reuse-existing`, `coordinated-modification`, `split-existing`, `merge-existing`, `replace-existing`, `create-new`, `no-durable-entity`, or `unresolved`. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-008 — Explain and lineage new identities.** `create-new` requires an inspectable explanation of why existing identities do not own the requested meaning; resolution MUST include relevant active, deprecated, superseded, tombstoned, and lineage identities; and split, replace, and merge-like outcomes MUST create explicit lineage rather than relying on naming convention. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-009 — Block unresolved canonical creation by mode.** `unresolved` MUST block automatic canonical identity creation in Govern and Autonomous modes. Guide mode MAY continue only if ambiguity is exposed and no competing authority is silently minted. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-010 — Implement semantic identity contracts exactly.** `SemanticIdentityCandidate` MUST contain `entityId: EntityId`, `entityKind: "concept" | "requirement" | "scenario"`, `similarity: Confidence`, `ownershipFit: Confidence`, `boundaryFit: Confidence`, `evidence: EvidenceRef[]`, and `explanation: string`. `NewSemanticBoundary` MUST contain `owns: string[]`, `excludes: string[]`, `nearestEntityIds: EntityId[]`, and `rationale: string`. `SemanticIdentityResolution` MUST contain `id: EntityId`, `requestedMeaning: string`, `requestedKind: "concept" | "requirement" | "scenario" | "unknown"`, `outcome` with the literals in KNOW-007, `candidates: SemanticIdentityCandidate[]`, `selectedEntityIds: EntityId[]`, optional `newBoundary?: NewSemanticBoundary`, `confidence: Confidence`, `evidence: EvidenceRef[]`, `unknowns: string[]`, `boundState: StateBinding`, and `contentHash: ContentHash`. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-011 — Keep resolution evidentiary, not authoritative.** `SemanticIdentityResolution` MUST be treated as derived/inferred evidence by default; accepted Concept/Requirement/Scenario state is canonical, and the model-produced resolution artifact is not authority merely because it generated the candidate. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-012 — Reconcile aliases and duplicates.** Projector SHOULD propose useful aliases when the same canonical entity appears under recurring alternate terminology; accepting an alias changes discovery metadata, not semantic identity; and successful operation SHOULD prevent most accidental duplicates before the `duplicate-concept` reconciliation defense is needed. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”.
- [ ] **KNOW-013 — Implement relevance contracts exactly.** `RelevanceBand` MUST be `"direct" | "governing" | "consequence" | "possible"`. `RelevanceSeed.kind` MUST be `"request-term" | "semantic-entity" | "projection-unit" | "artifact" | "code-symbol" | "contract" | "event" | "decision" | "manual"`, with optional `subjectId?: EntityId | string`, optional `value?: string`, and required `reason: string`, `confidence: Confidence`. `RelevanceReason.kind` MUST be `"explicit" | "identity-match" | "governs" | "constrains" | "depends-on" | "implementation-binding" | "selector-applicability" | "event-producer-consumer" | "contract-producer-consumer" | "verification-binding" | "package-dependency" | "historical-cochange" | "semantic-similarity" | "model-inference" | "analysis-facet" | "open-world-widening"`, with optional `fromId?: EntityId | string` and required `weight: number`, `provenance: "declared" | "derived" | "observed" | "inferred"`, `confidence: Confidence`, `explanation: string`, and `evidenceIds: EntityId[]`. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance seeds and bands”.
- [ ] **KNOW-014 — Implement closure entry contracts exactly.** `RelevanceEntry` MUST contain `entityId: EntityId`, `band: RelevanceBand`, `score: number`, `requiredForPlanning: boolean`, and `reasons: RelevanceReason[]`. `RelevanceClosure` MUST contain `id: EntityId`, `requestHash: ContentHash`, `seeds: RelevanceSeed[]`, `entries: RelevanceEntry[]`, `activatedFacetKeys: string[]`, `unknowns: string[]`, `unavailableLanes: string[]`, `boundState: StateBinding`, and `contentHash: ContentHash`. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance seeds and bands”.
- [ ] **KNOW-015 — Apply band semantics exactly.** `direct` means explicitly named/requested semantics and directly referenced/touched targets; `governing` means owners, Requirements, invariants, active decisions, applicable contracts/rules constraining direct material; `consequence` means plausibly relevant consumers, dependents, downstream behavior, verification, or other entities that become plausibly relevant because of direct/governing material; `possible` means uncertain but meaningful semantic/historical/model-inferred adjacency retained against silent omission. Bands are progressive-disclosure bands, not proof classes. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance seeds and bands”.
- [ ] **KNOW-016 — Expand by evidence preference.** The reference Relevance Engine SHOULD prefer, in order: explicit semantic IDs and request terms; stable aliases and identity-resolution candidates; typed Relations; Projection Unit and Artifact bindings; selector/applicability dependencies; package/import/call/type topology; event topology; API/message/schema/contract topology; test/verification bindings; Architecture Decision, invariant, assumption, and Governance Basis relationships; git/co-change/migration evidence; then semantic retrieval/model inference at gaps. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance expansion”.
- [ ] **KNOW-017 — Restrict similarity evidence.** Semantic similarity MAY seed discovery or widen `possible`, but MUST NOT silently become an exact derivation or Impact Rule edge. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance expansion”.
- [ ] **KNOW-018 — Make propagation bounded and inspectable.** Relevance propagation SHOULD use relationship-specific weights, evidence confidence, applicability, and decay; every entry reason MUST be inspectable; declared/derived governing edges MUST outrank weak semantic adjacency; expansion MUST stop under explicit thresholds/token budgets; potentially material low-confidence entries MUST remain as summaries/frontier rather than be silently discarded; deterministic graph topology MUST replace model rediscovery where available. Exact numeric weights remain policy/versioned implementation details. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance expansion”.
- [ ] **KNOW-019 — Avoid whole-graph context.** A global semantic graph MAY be queried, but no change may require serializing the whole graph into model context. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance expansion”.
- [ ] **KNOW-020 — Bind closure-sensitive discovery.** A Relevance Closure is valid only while both its selected semantic inputs and the discovery results that bounded the closure remain current. Every planning-affecting search, adjacency, membership, or enumeration—including queries deciding what entered, did not enter, or stopped expansion, plus empty results, omissions, and stop conditions—MUST be stored as a `StateQueryDependency` in its `StateBinding`; binding returned entities alone is insufficient because a new entity/edge can change closure correctness. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Closure-bound discovery dependencies”.
- [ ] **KNOW-021 — Define mandatory query binding.** Projector MUST bind a discovery query when it establishes absence, a stopping condition, an identity decision, a governing/context boundary, or material relevance ranking. It MAY omit a query only when it is weak advisory context whose result cannot affect required planning, context, or unknowns. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Closure-bound discovery dependencies”.
- [ ] **KNOW-022 — Require proof-eligible negative space.** `open`, `sampled`, or `unavailable` discovery lanes MUST NOT justify a negative-space conclusion such as no other consumers/requirements/relations; they MUST contribute an explicit unknown/frontier instead. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Closure-bound discovery dependencies”.
- [ ] **KNOW-023 — Compile least-cost semantic context.** The Context Compiler MUST consume a Relevance Closure and select the least-cost representation preserving needed semantics: full applicable semantic content for `direct` and `governing`; compact summaries/kernel first for `consequence`, expandable on demand; identity, relevance reason, and uncertainty for `possible`, expandable as needed. Risk, ambiguity, token budget, and task phase MAY adjust this policy. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Progressive disclosure and context selection”.
- [ ] **KNOW-024 — Disclose semantic subgraphs, not directories.** Progressive disclosure MUST operate on the relevant semantic subgraph rather than the filesystem directory containing its documents. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Progressive disclosure and context selection”.
- [ ] **KNOW-025 — Compose Analysis Facets.** Projector SHOULD compose versioned Analysis Facets for distinct reasoning lanes rather than use one monolithic methodology. A facet MAY contribute deterministic activation predicates, discovery questions, relevance traversals, required evidence lanes, minimum concern materiality, and required verification classes, but MUST NOT silently select technology or create normative governance merely by activation. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Analysis Facets”.
- [ ] **KNOW-026 — Implement the AnalysisFacet contract exactly.** `AnalysisFacet` MUST contain `key: string`, `version: string`, `selector: SelectorExpr`, `questionKeys: string[]`, `relevanceRuleIds: string[]`, `requiredEvidenceLanes: ValidationResult["evidenceLane"][]`, and `outputKinds: string[]`. Facet definitions are program/configuration artifacts, not automatically canonical project semantics; only a project-specific adopted choice that affects governance becomes canonical. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Analysis Facets”.
- [ ] **KNOW-027 — Route event/contract neighborhoods.** Changing semantics/schema of a known event MUST seed its known producers and consumers into relevance/impact reasoning according to evidence strength. Adapters SHOULD compile producer/consumer relationships for derivable public APIs, OpenAPI/AsyncAPI, exported types, message/persistence schemas, protocols, and package interfaces. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Event and contract topology as relevance routers”.
- [ ] **KNOW-028 — Prefer concepts and typed relations for topology.** Projector SHOULD represent event, command, policy, read-model, and contract nodes as stable Concepts plus typed Relations until a specialized entity type provides additional semantic value. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Event and contract topology as relevance routers”.
- [ ] **KNOW-029 — Keep behavioral identity canonical.** Requirements and Behavioral Scenarios, not Markdown feature files, MUST be canonical behavioral semantics. A Requirement states what must be done/preserved; a Scenario supplies observable examples/branches. One Requirement MAY have multiple scenarios, and one Scenario MAY cover multiple tightly related Requirements when this preserves clearer identity. Representation changes MUST NOT change canonical identity. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Requirements, scenarios, and executable behavior”.
- [ ] **KNOW-030 — Treat tests as evidence.** A scenario-to-test link is evidence; the test file MUST NOT become the scenario identity. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Requirements, scenarios, and executable behavior”.
- [ ] **KNOW-031 — Measure relevance quality independently.** Projector SHOULD measure Relevance Engine quality separately from impact correctness, including known-relevant entity recall on held-out changes, irrelevant context expansion, governing-edge omission rate, average/percentile relevant-subgraph size relative to project semantic graph size, possible-band expansion rate, planning surprises later attributable to missing relevance, and accepted new relationships learned from surprises. Returning the entire repository is unacceptable context usefulness; a tiny closure missing cross-cutting constraints fails the core goal. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance quality and omission pressure”.
- [ ] **KNOW-032 — Compare predicted and observed impact.** After implementation, Projector MUST derive semantic impact from actual diff/observed mutations and compare it with both the Relevance Closure and planned Impact Closure. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Predicted-versus-observed impact and Planning Surprises”.
- [ ] **KNOW-033 — Implement PlanningSurprise exactly.** `PlanningSurprise` MUST contain `id: EntityId`, `planId: EntityId`, `kind: "unpredicted-semantic-impact" | "unpredicted-code-impact" | "missing-relation" | "scope-expansion" | "agent-overreach" | "benign-discovery"`, `predictedEntityIds: EntityId[]`, `observedEntityIds: EntityId[]`, `unexpectedEntityIds: EntityId[]`, `evidence: EvidenceRef[]`, `explanation: string`, `disposition: "accept-and-learn" | "accept-no-model-change" | "repair-plan" | "revert-overreach" | "human-decision" | "unresolved"`, `proposedRelationIds: EntityId[]`, and `contentHash: ContentHash`. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Predicted-versus-observed impact and Planning Surprises”.
- [ ] **KNOW-034 — Govern surprise learning.** Unexpected impact MUST be investigated rather than automatically classified as a defect. Legitimate newly discovered relationships MAY be proposed for canonical/derived graph promotion only through normal evidence/authority rules; agent overreach remains divergence, and one model guess MUST NOT become authority. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Predicted-versus-observed impact and Planning Surprises”.
- [ ] **KNOW-035 — Make closure compilation reproducible.** Given fixed canonical and repository snapshots, adapter/facet sets, and model-inference artifacts, Relevance Closure compilation MUST be reproducible at the structured-result level. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance algorithm”.
- [ ] **KNOW-036 — Preserve reference algorithm ordering.** The Relevance Engine MUST: normalize the user request into intent/constraint statements without choosing implementation; seed explicit semantic entities, terms, named targets, and known code/artifact targets; resolve identity; activate facets; traverse declared/derived governing and implementation relationships; traverse event/contract producer-consumer and verification topology; evaluate selector/applicability matches and architecture-decision/invariant relationships; use semantic/historical/model inference only to fill uncertain gaps; rank entries into `direct`/`governing`/`consequence`/`possible` bands; stop under policy thresholds while preserving material unknowns/frontier; compile `StateValueDependencyRef`s for selected facts and `StateQueryDependency`s for every closure-sensitive search/adjacency/membership/enumeration including empty-result/stop conditions; emit a dependency-scoped `StateBinding`, reasons for every included entry, and explicit unknowns; then compile bounded context for requirement/scenario delta and architecture preflight, in that order. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance algorithm”.
- [ ] **KNOW-037 — Fail discovery visibly.** When a required discovery lane is unavailable, the Relevance Engine MUST fail visibly or widen uncertainty and MUST NOT represent missing semantic/code analysis as an empty relevance result. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance algorithm”.

### Evidence and authority

- [ ] **EVID-001 — Keep authority multidimensional and inspectable.** Authority MUST remain inspectable and MUST NOT be represented as if one scalar answered its distinct questions. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Evidence and authority”.
- [ ] **EVID-002 — Implement EvidenceKind and EvidenceClaim exactly.** `EvidenceKind` MUST be `"explicit-decision" | "repository-structure" | "code-relationship" | "test" | "documentation" | "git-history" | "runtime-observation" | "build-output" | "official-documentation" | "standard" | "research-paper" | "reference-implementation" | "issue-or-incident" | "user-decision" | "agent-inference"`. `EvidenceClaim` MUST contain `subjectKey: string`, `predicate: string`, `object: unknown`, and optional `inferenceConfidence?: Confidence`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Evidence contract”.
- [ ] **EVID-003 — Implement Evidence exactly.** `Evidence` MUST contain `id: EntityId`, `kind: EvidenceKind`, `locator: string`, `capturedAt: string`, optional `sourceDate?: string`, `contentHash: ContentHash`, optional `excerpt?: string`, `claims: EvidenceClaim[]`, `reliability: "mechanically-proven" | "high" | "medium" | "low" | "untrusted"`, `normativeAuthority: "binding-decision" | "hard-constraint" | "authoritative-guidance" | "supporting" | "descriptive-only" | "none"`, `independenceGroup: string`, `applicability: "direct" | "analogous" | "contextual" | "uncertain"`, `freshness: Confidence`, `causalOrigin: CausalOrigin`, and `metadata: Record<string, unknown>`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Evidence contract”.
- [ ] **EVID-004 — Treat content as untrusted data.** Repository text, commit messages, issue content, model responses, and web content MUST be treated as untrusted data and MUST NOT alter Projector permissions or orchestration policy merely by being present. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Evidence contract”.
- [ ] **EVID-005 — Collapse causally dependent copies.** Copies from one template count as one design occurrence unless independent evidence proves otherwise; independence analysis SHOULD use introduction commit, copy/move history, scaffold/generator origin, near-identical AST plus common ancestor, and shared migration source. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Independence and causal origin”.
- [ ] **EVID-006 — Prevent endogenous authority.** A conforming occurrence created by Projector under Lens X MUST NOT independently support Lens X's authority; historical evaluation MUST identify and discount Projector-endogenous changes from the same authority claim. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Independence and causal origin”.
- [ ] **EVID-007 — Implement AuthorityVector exactly.** `AuthorityVector` MUST contain numeric `explicitDecisionAlignment`, `productConstraintFit`, `semanticFit`, `independentOccurrence`, `historicalStability`, `independentValidationSupport`, `boundaryCoherence`, `maintenanceOutcome`, `platformCompatibility`, `externalRationale`, `ecosystemHealth`, `securitySupport`, `reversibility`, `migrationCost`, and `counterEvidence`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Authority vector”.
- [ ] **EVID-008 — Do not mislabel aggregate authority.** `AuthorityVector` is an explainable support profile, not a probability distribution. Aggregate ranking scores MAY be computed for prioritization, but MUST NOT be labeled as calibrated probability unless separately calibrated. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Authority vector”.
- [ ] **EVID-009 — Implement reconsideration triggers exactly.** `AuthorityReconsiderTrigger` MUST support exactly `{ type: "concept-changed"; conceptId: EntityId }`, `{ type: "requirement-changed"; subjectId: EntityId | string }`, `{ type: "scenario-changed"; scenarioId: EntityId }`, `{ type: "relation-changed"; relationId: EntityId }`, `{ type: "constraint-changed"; constraintId: EntityId }`, `{ type: "scope-expanded"; scopeKey: string }`, `{ type: "surface-added"; surfaceKind: Surface["kind"] }`, `{ type: "assumption-falsified"; assumptionKey: string }`, `{ type: "lens-changed"; lensId: EntityId }`, `{ type: "evidence-invalidated"; evidenceId: EntityId }`, `{ type: "evidence-refresh-required"; policyKey: string }`, `{ type: "toolchain-version"; tool: string; constraint: string }`, `{ type: "platform-version"; platform: string; constraint: string }`, `{ type: "project-preference-changed"; preferenceId: EntityId }`, `{ type: "counterevidence-threshold"; subjectId: EntityId; threshold: number }`, `{ type: "date"; at: string }`, or `{ type: "manual-review" }`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Typed reconsideration triggers”.
- [ ] **EVID-010 — Implement EvidenceRefreshPolicy exactly.** `EvidenceRefreshPolicy` MUST contain `key: string`, `mode: "on-trigger" | "version-sensitive" | "max-age" | "manual"`, optional `maxAgeDays?: number`, optional `trackedTechnologies?: string[]`, and `requireOfficialSourceWhenAvailable: boolean`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Typed reconsideration triggers”.
- [ ] **EVID-011 — Implement AuthorityRecord exactly.** `AuthorityRecord` MUST contain `id: EntityId`, `key: string`, `subjectId: EntityId`, `status: "provisional" | "approved" | "auto-approved" | "rejected" | "superseded"`, `conclusion: "preserve" | "normalize" | "migrate" | "exception" | "unknown"`, `rationale: string`, `alternatives: AuthorityAlternative[]`, `assumptions: string[]`, `reconsiderWhen: AuthorityReconsiderTrigger[]`, optional `evidenceRefreshPolicy?: EvidenceRefreshPolicy`, `vector: AuthorityVector`, `assessmentConfidence: "low" | "medium" | "high"`, `evidence: EvidenceRef[]`, `governanceRiskClass: RiskClass`, `decidedBy: "system" | "user" | "policy"`, `createdAt: string`, and `semanticHash: ContentHash`. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Authority records”.
- [ ] **EVID-012 — Preserve two-stage authority.** Descriptive inference (“what regularity exists?”) and normative selection (“what should govern future evolution?”) MUST remain distinct even when one run performs both. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Authority records”.

### Progressive architecture commitment

- [ ] **ARCH-001 — Decide progressively.** Projector MUST delay architecture decisions until their consequences are material, resolve only the smallest decision frontier needed for safe durable progress, reuse scoped decisions while their basis remains valid, and re-evaluate only when a relevant assumption, constraint, evidence obligation, explicitly adopted project preference, or governed scope changes. Source: `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md` — “Progressive Architecture Commitment”.
- [ ] **ARCH-002 — Consume bounded relevance.** Architecture reasoning MUST consume the bounded Relevance Closure; it MUST NOT reconstruct project context from package proximity or load the entire semantic graph. Source: `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md` — “Progressive Architecture Commitment”.
- [ ] **ARCH-003 — Preserve architecture pipeline ordering.** Architecture reasoning MUST proceed from Relevance Closure to requirement/scenario/constraint delta, concern discovery/materiality, existing-decision validity, decision frontier, evidence/current research when required, preference-aware viable-option evaluation, accept/defer/contest, governance-consequence compilation, and then Impact Closure/implementation planning. Source: `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md` — “Progressive Architecture Commitment”.
- [ ] **ARCH-004 — Run architecture preflight in normal change.** Before a durable semantic-change plan is finalized, Projector MUST run the specified architecture preflight inside ordinary `projector change`; it is not reserved for modernization. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Architecture preflight”.
- [ ] **ARCH-005 — Preserve preflight ordering.** Preflight MUST compile bounded Relevance Closure; normalize requirement/scenario/constraint delta; discover concern candidates; reuse valid scoped decisions; promote materially unresolved concerns; evaluate affected-decision triggers; calculate frontier; refresh evidence when policy requires; evaluate options; accept/defer/contest; compile consequences transactionally; then continue to implementation impact closure. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Architecture preflight”.
- [ ] **ARCH-006 — Gate unresolved blocking concerns by mode.** Observe/Guide MAY allow exploratory work with unresolved concerns, but it MUST NOT become governed completion where a `blocking-now` concern applies. Govern/Autonomous durable R2+ planning MUST resolve or validly defer all blocking concerns in scope. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Architecture preflight”.
- [ ] **ARCH-007 — Discover concerns from closure.** Concern discovery MUST consume bounded Relevance Closure rather than rediscover the project; it MUST combine requirement/scenario/constraint deltas and canonical entities selected by relevance discovery, deterministic platform/constraint/facet rules, accepted decisions and their reconsideration triggers, in-scope friction/divergence evidence, event/contract/public-surface relationships and adapter-declared platform implications, replayable model inference for non-obvious concerns at the remaining frontier, and live research only when discovery depends on a current external capability/constraint. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- [ ] **ARCH-008 — Bind applicability/frontier queries.** Decision-frontier/applicability queries that can materially change whether a decision is valid, suspect, blocking, or absent MUST be closure-sensitive state queries in the plan `StateBinding`; unchanged previously loaded decision documents are insufficient absence proof. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- [ ] **ARCH-009 — Keep concerns technology-neutral.** A concern MUST describe a question/force, not an answer, and MUST NOT automatically imply a monorepo, pnpm, Nx, Turbo, Tauri, React Native, REST, GraphQL, or any other technology. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- [ ] **ARCH-010 — Deduplicate and crystallize concern triggers safely.** Candidate concerns MUST be transient and deduplicated by semantic key + scope + causal context. Repeated reasoning MAY become versioned deterministic triggers, but triggers MUST activate questions and MUST NOT hardcode preferred technology. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- [ ] **ARCH-011 — Preserve concern causal origin.** Projector-generated state MUST NOT independently justify the concern/decision that generated it; endogenous structure MAY satisfy present-state conditions only while causal origin remains visible. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- [ ] **ARCH-012 — Define architecture materiality by consequences.** Architecture concern materiality MUST NOT be treated as a generic importance score. A concern is architecture-level only when viable answers materially change cross-cutting structure/boundaries, public/compatibility contracts, long-lived dependency/toolchain/platform commitment, data ownership/schema/migration, external/distribution obligations, operational/security/reliability posture, reversibility/migration cost, recurring maintenance/DX cost, or significant future change closure. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Materiality and progressive disclosure”.
- [ ] **ARCH-013 — Use exact materiality classes.** Materiality MUST be `blocking-now` (safe durable planning requires resolution), `material-soon` (near-term work requires it but current scope is safe), or `deferable` (real and safely postponable while option value is preserved). Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Materiality and progressive disclosure”.
- [ ] **ARCH-014 — Respect deterministic minimum materiality.** Deterministic hard security/data/platform/public-contract implications MAY establish a minimum; inference MAY raise materiality but MUST NOT lower that minimum. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Materiality and progressive disclosure”.
- [ ] **ARCH-015 — Progressively disclose concerns.** Default UX MUST show blocking decisions first, show `material-soon` as concise foresight, and hide `deferable` until requested. Progressive disclosure MUST serve progressive commitment and MUST NOT become silent omission. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Materiality and progressive disclosure”.
- [ ] **ARCH-016 — Treat validity as scoped proof validity.** Accepted decisions MUST be evaluated for current-change scope. Triggers MAY make them `suspect`, `contested`, or `invalid-for-scope` without mutating canonical decisions. `suspect` means the prior justification no longer proves coverage and MUST NOT be treated as proof the decision is wrong or migration is required; reevaluation MAY reaffirm it unchanged. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Decision validity and dirtying”.
- [ ] **ARCH-017 — Apply dirtying causes and personal-preference exception.** Dirtying MUST recognize requirement/constraint change, target/platform expansion, falsified assumption, incompatible toolchain/platform change, material counterevidence, freshness obligation, explicitly used project preference change, and migration phase change. Personal user preference changes alone MUST NOT dirty accepted project architecture. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Decision validity and dirtying”.
- [ ] **ARCH-018 — Reuse silently and explain both outcomes.** If a valid decision covers new scope and no trigger fired, Projector MUST reuse it silently. `projector explain decision:<id>` MUST explain both why a decision was reconsidered and why it was not. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Decision validity and dirtying”.
- [ ] **ARCH-019 — Support scoped coexistence and supersession.** Disjoint platform/package/runtime scopes MAY have different decisions; old/new decisions MAY coexist during migration via migration-phase selectors. Supersession MUST be scoped, and an old decision may retire only when its governed population is gone or explicitly excepted. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Scope-specific coexistence and supersession”.
- [ ] **ARCH-020 — Block incompatible overlap.** Before activating consequences, the compiler MUST detect incompatible overlapping decision scopes. Compatible layers MAY compose; incompatible overlap MUST block until narrowed, explicitly superseded, migrated, or excepted. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Scope-specific coexistence and supersession”.
- [ ] **ARCH-021 — Require fresh-enough mutable evidence.** A materially affected decision MUST use fresh-enough evidence when its viable option set or constraints depend on mutable external facts. Research is required when current capabilities, support/security/lifecycle, materially changed alternatives, uncertain official constraints, contradictory local evidence, or significant long-lived technology commitment matters to the changed question. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- [ ] **ARCH-022 — Make refresh policy-triggered, not time-automatic.** Research MUST NOT run merely because time passed. `EvidenceRefreshPolicy` MAY be trigger-sensitive, version-sensitive, max-age, or manual, and official documentation/specifications remain preferred evidence. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- [ ] **ARCH-023 — Verify current volatile option sets.** For volatile technology decisions, Projector MUST verify the current option set instead of relying on model recall plus citations; remembered unsupported options remain hypotheses until evidenced. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- [ ] **ARCH-024 — Reassess without forcing migration.** Evidence refresh MUST reassess rather than automatically migrate; keeping current/simple architecture remains valid if supported, and migration cost, operational burden, reversibility, and local fit MUST be core criteria. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- [ ] **ARCH-025 — Handle offline evidence failure.** Offline mode MUST expose cached-evidence freshness. If policy requires fresh evidence for a blocking decision and it cannot be obtained, automatic acceptance MUST be blocked; an explicit user decision MAY proceed only with recorded uncertainty. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- [ ] **ARCH-026 — Scope preferences exactly.** Preferences MUST support `user` (local reusable cross-project), `organization` (shared provider), and `project` (explicitly adopted and committed under `.projector/preferences/`) scopes and MUST remain decision accelerators rather than invisible architecture law. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Developer and organization preferences”.
- [ ] **ARCH-027 — Compose preferences by fixed rules.** Hard product/platform/security constraints MUST dominate preferences; explicit project preferences MUST dominate organization/user preferences for shared recommendations; conflicting soft preferences MUST remain visible; preferences are non-blocking by type; enforced preferences MUST be promoted through an explicit constraint/decision. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Developer and organization preferences”.
- [ ] **ARCH-028 — Record only material preference influence.** Accepted decisions MUST record only preferences that materially influenced evaluation, by semantic hash and concise influence statement. Personal preference changes affect future proposals only and MUST NOT alter accepted project architecture unless explicitly adopted as a project assumption. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Developer and organization preferences”.
- [ ] **ARCH-029 — Evaluate options transparently.** Option evaluation SHOULD use hard-constraint elimination and a tradeoff matrix before optional weighted ranking. Numeric scoring MUST expose weights and MUST NOT be presented as objective probability. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Developer and organization preferences”.
- [ ] **ARCH-030 — Permit only option-preserving deferral.** Deferral is legal only when a neutral or compatibility-preserving path exists. Durable deferral MUST record rationale, scope, required optionality, forbidden commitments, revisit trigger/review condition, and risk/unknowns. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision deferral and option preservation”.
- [ ] **ARCH-031 — Do not hide decisions in guardrails.** Deferral guardrails MAY protect reversibility but MUST NOT secretly select an architecture; any temporary guardrail that materially commits one option MUST be represented as a temporary architecture decision. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision deferral and option preservation”.
- [ ] **ARCH-032 — Compile a small typed consequence kernel.** Acceptance MUST compile a small typed consequence kernel into governance artifacts; consequences MAY affect governance, constraints, technology concepts, migrations, other concerns, or another decision, and MAY constrain another decision or remain advisory, but detailed implementation behavior MUST remain in Rules, Projection Lenses, Impact Rules, and migrations rather than unbounded consequence taxonomy. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision consequences and governance basis”.
- [ ] **ARCH-033 — Expose governance basis.** `Rule` and `ProjectionLens` MUST expose `GovernanceBasis[]` sufficient to trace each rule to its decision, forces, evidence, and the rules/lenses/Impact Rules/migrations/Projection Units affected by supersession. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision consequences and governance basis”.
- [ ] **ARCH-034 — Activate decisions transactionally.** Decision acceptance and required consequence compilation MUST occur in one crash-consistent semantic governance transaction; a decision MUST NOT become active when required consequence products fail validation. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision consequences and governance basis”.
- [ ] **ARCH-035 — Allow explicit no-rule decisions.** A negative/simple decision MAY emit no implementation rule, but MUST still retain explicit reconsideration triggers. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision consequences and governance basis”.
- [ ] **ARCH-036 — Converge decision dependencies deterministically.** Model proposals MUST be sampled outside the deterministic fixed-point loop; each iteration MUST use fixed inputs; stable semantic digest means convergence; repeated non-stable digest means a cycle; iteration/time bounds MUST terminate as `decision-convergence-failure`; and cyclic groups MUST be presented/resolved together when ordering cannot be proven. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision dependencies and convergence”.
- [ ] **ARCH-037 — Stabilize numeric concern thresholds.** Numeric concern thresholds SHOULD use hysteresis or stable trend evidence to prevent oscillation. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision dependencies and convergence”.
- [ ] **ARCH-038 — Unify modernization decision machinery.** Modernization MUST use the same `ArchitectureConcern`, `ArchitectureDecision`, preference, authority, research, validity, and consequence machinery as feature-driven evolution; it MUST NOT operate as a separate decision system that can answer the same forces inconsistently. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Modernization is not a separate decision system”.
- [ ] **ARCH-039 — Explain architecture progressively.** Projector MUST support an explanation chain from user intent through resolved identities/Relevance Closure, behavioral delta, concern/materiality, validity/trigger, options, hard constraints, evidence, material preferences, selected decision/uncertainty, consequences, and resulting rules/lenses/migration. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision explainability and self-audit”.
- [ ] **ARCH-040 — Audit decision-system pathologies.** `projector audit --decisions` MUST detect redundant/equivalent decisions, incompatible overlap, stale unpopulated decisions, low-value open concerns, overbroad triggers causing frequent reopening, unpopulated consequences, rationales no longer affecting governance, excessive decision density/maintenance cost, and architecture context repeatedly pulled without a relevance path/materiality reason. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision explainability and self-audit”.
- [ ] **ARCH-041 — Determine applicability semantically.** Architecture preflight MUST NOT use package location alone as a relevance proxy. Applicability MUST follow decision scope, canonical relationships, and Relevance Closure because one decision can span packages and one package can span domains. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision explainability and self-audit”.

### Risk, approval, and execution

- [ ] **RISK-001 — Use contextual R0–R4.** `RiskClass` MUST be exactly `"R0" | "R1" | "R2" | "R3" | "R4"`, and assessment MUST be contextual rather than an intrinsic property of a file or transform. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-002 — Implement RiskAssessment exactly.** `RiskAssessment` MUST contain `class: RiskClass`, numeric `inherentOperationRisk`, `affectedUnitCount`, `affectedSurfaceCount`, booleans `publicContractImpact`, `externalImpact`, `dataImpact`, `reversibility: "full" | "strong" | "partial" | "none"`, `validationStrength: "weak" | "supporting" | "strong" | "exact"`, `closureConfidence: "proven" | "bounded" | "high" | "partial" | "unknown"`, numeric `unresolvedIdentityCount`, `relevanceFrontierCount`, boolean `openWorldDependencies`, numeric `unresolvedBlockingConcernCount`, `suspectDecisionCount`, boolean `compensationAvailable`, and `reasons: string[]`. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-003 — Implement ExecutionPolicy exactly.** `ExecutionPolicy` MUST contain `preset: "observe" | "guide" | "govern" | "autonomous" | "salvage"`, `maximumAutomaticRisk: RiskClass`, `network: "deny" | "ask" | "allow"`, `externalWrites: "deny" | "approval" | "allow-with-capability"`, `requireIndependentValidationAtOrAbove: RiskClass`, `requireWorktreeAtOrAbove: RiskClass`, booleans `allowAutoPromotion` and `allowAutoMutation`, plus optional numeric `maxChangedUnits?`, `maxChangedSurfaces?`, `maxCost?`, and `maxTokens?`. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-004 — Enforce default class policy.** R0 read-only inference/reporting is automatic; R1 reversible deterministic normalization with strong local proof is automatic only where conservative/guide policy permits; R2 local semantic change with strong rollback/validation may be planned automatically but requires approval before apply; R3 cross-package/public API/schema/CI/architecture/external-surface change requires explicit approval; R4 destructive data/production security boundary/billing/identity/irreversible release action is never autonomous in 1.x. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-005 — Make uncertainty monotonic.** Risk MUST increase or stay equal as uncertainty rises. Unresolved semantic identity/ownership, weak relevance coverage, lower coverage, weaker validation, stale observations, larger unknown frontier, and weaker rollback MAY raise approval requirements and MUST NEVER lower them. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-006 — Assess governance impact.** Lens/rule promotion MUST be risk-assessed by governance impact, not merely mutation mechanics; a mechanically reversible rule that blocks future cross-package work may be R3 governance. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.
- [ ] **RISK-007 — Normalize policy inputs without precedence ambiguity.** CLI flags and friendly modes MUST normalize into one `ExecutionPolicy`; contradictory combinations MUST be errors rather than resolved by precedence. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.


### Governance, Projections, Runtime, and Representations


### Scope, selectors, and ignore policy

- [ ] **GOV-001** — Selectors MUST be canonical serialized deterministic data, MUST NOT be arbitrary executable code, and MUST treat semantic scope as primary while allowing path as a bootstrap dimension. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Scope algebra, selectors, and layered ignore policy”.
- [ ] **GOV-002** — `SelectorExpr` MUST support `all(items[])`, `any(items[])`, `not(item)`, and `atom(field, matcher, value)` operations. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-003** — A selector atom `field` MUST be one of: `path`, `language`, `artifact-role`, `concept`, `concept-kind`, `requirement`, `scenario`, `lens`, `surface`, `package`, `package-kind`, `operation`, `platform`, `migration-phase`, `risk`, `tag`, `control-ownership`, `control-mutation`, `ast-pattern`, `relation`, or `causal-origin`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-004** — A selector atom `matcher` MUST be one of: `equals`, `in`, `glob`, `regex`, `contains`, `exists`, or `matches-structural-query`; its `value` MUST retain the contract’s unconstrained `unknown` type. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-005** — Every selector MUST have a canonical serializable form and deterministic evaluation. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-006** — Regex selector evaluation MUST use a safe regex engine or a strict timeout. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-007** — Structural selector queries MUST be defined by deterministic adapter contracts. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-008** — Selector evaluation MUST produce a match explanation identifying the atoms that matched. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-009** — Selectors MUST declare dependencies sufficient for localized cache invalidation, and selector membership changes MUST be explicit invalidation causes. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-010** — A selector change MUST evaluate both units newly entering the selector and units newly leaving it. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector expression”.
- [ ] **GOV-011** — Selector and rule caches MUST NOT use global graph revision as their primary invalidator. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-012** — Selector/rule cache identity MUST include the selector semantic hash plus fingerprints of unit attributes; Concept, Requirement, Scenario, and lens membership; queried Relations; relevance-affecting query results; adapter/profile versions; and canonical policy. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-013** — When selector or membership results participate in a plan, capsule, or approval boundary, the same deterministic query semantics MUST be representable as a `StateQueryDependency`, including query-program version and closure-sensitive result fingerprints. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-014** — A cache hit MUST NOT itself count as a validity proof. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-015** — Graph revision MAY appear in diagnostics and stale-plan checks, but an unrelated edit MUST NOT evict every cached selector result. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-016** — If dependency keys cannot prove a changed snapshot leaves a bound query untouched, Projector MUST re-evaluate the query rather than assume locality. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- [ ] **GOV-017** — `IgnorePolicy` MUST separately define selector lists for `inventory`, `inferenceAuthority`, `mutation`, `reporting`, `modelContext`, and `coverageDenominator`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Layered ignore policy”.
- [ ] **GOV-018** — Exclusion policy MUST be separated by purpose; a single ignore rule MUST NOT silently erase an artifact from every semantic role. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Layered ignore policy”.
- [ ] **GOV-019** — Ignore policy MUST be able to inventory vendored code for dependencies while excluding it from mutation and pattern authority; include generated outputs in reconciliation while excluding them as independent authority evidence; and structurally inventory secrets/config values while excluding their values from model context. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Layered ignore policy”.

### Rule kernel and governance evaluation

- [ ] **RULE-001** — Rules MUST be executable enough to govern and MUST NOT require a general theorem prover. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule kernel, composition, and governance evaluation”.
- [ ] **RULE-002** — `RuleEffect` MUST be one of: `require`, `forbid`, `prefer`, `validate`, `transform`, `route`, `grant`, `restrict`, or `explain`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule effects and authority classes”.
- [ ] **RULE-003** — `AuthorityClass` MUST be one of, from highest to lowest composition authority: `host-safety`, `platform-constraint`, `approved-user-intent`, `active-lens`, `adopted-external-standard`, `migration-overlay`, `local-convention`, `inferred-candidate`, or `task-suggestion`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule effects and authority classes”; “Composition order”.
- [ ] **RULE-004** — Every hard/blocking rule MUST normalize either to a supported `NormalizedPredicate`/permission form or to an explicit validator contract. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-005** — `NormalizedPredicate` MUST support exactly these typed forms: `path-under(root: string)`, `path-not-under(root: string)`, `relation-required(relation: RelationType, targetSelector: SelectorExpr)`, `relation-forbidden(relation: RelationType, targetSelector: SelectorExpr)`, `cardinality(selector: SelectorExpr, min?: number, max?: number)`, `dependency-allowed(from: SelectorExpr, to: SelectorExpr)`, `dependency-forbidden(from: SelectorExpr, to: SelectorExpr)`, `permission(operation: string, allowed: boolean)`, `unit-state(state: ValidityState)`, `schema-valid(schemaId: string)`, and `validator(validatorId: string)`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-006** — A `Rule` MUST carry typed `id: EntityId`, `key: string`, `version: string`, `effect: RuleEffect`, `authorityClass: AuthorityClass`, `governanceBasis: GovernanceBasis[]`, `selector: SelectorExpr`, `predicates: NormalizedPredicate[]`, `rationale: string`, `evidence: EvidenceRef[]`, `conflictPolicy`, `validatorIds: string[]`, `transformIds: string[]`, and `semanticHash: ContentHash`; `conflictPolicy` MUST be `error|merge|higher-authority|explicit-exception-only`, and it MAY carry `advisoryPayload?: Record<string, unknown>`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-007** — `Rule.conflictPolicy` MUST be one of `error`, `merge`, `higher-authority`, or `explicit-exception-only`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-008** — Opaque `advisoryPayload` MAY inform context or UI but MUST NOT independently block execution or override a hard rule. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-009** — An unknown semantic conflict MUST fail conservatively or require an explicit validator/decision; Projector MUST NOT claim mechanical proof for a conflict it cannot represent. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- [ ] **RULE-010** — `RuleConflict` MUST record typed `ruleIds: EntityId[]`, `unitId: EntityId`, `kind`, `explanation: string`, and `evidenceIds: EntityId[]`; `kind` MUST be one of `require-forbid`, `exclusive-transform`, `authority-override`, `ambiguous-selector`, or `incompatible-predicate`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Effective rule bundle”.
- [ ] **RULE-011** — `EffectiveRuleBundle` MUST record typed `unitId: EntityId`, `operation: string`, applicable `rules: Rule[]`, `suppressedRules: Array<{ ruleId: EntityId; reason: string; supersededBy?: EntityId }>`, normalized `predicates: NormalizedPredicate[]`, `conflicts: RuleConflict[]`, `dependencyFingerprint: ContentHash`, and `bundleHash: ContentHash`. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Effective rule bundle”.
- [ ] **RULE-012** — Rule composition MUST apply in this order: immutable host safety; hard platform constraints; approved user/product intent; active Projection Lens contributions; adopted standards; migration overlays; local conventions; inferred candidate advisories; task suggestions. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Composition order”.
- [ ] **RULE-013** — Specificity MUST break ties only within equivalent authority. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Composition order”.
- [ ] **RULE-014** — A direct user request that changes architecture MUST create or propose semantic intent and MUST NOT operate as a prompt-level bypass around active governance. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Composition order”.
- [ ] **RULE-015** — Context compilation MUST fail before mutation if mutually exclusive requirements apply. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Hard conflicts”.
- [ ] **RULE-016** — Context compilation MUST fail before mutation if a requirement and prohibition target the same representable state. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Hard conflicts”.
- [ ] **RULE-017** — Context compilation MUST fail before mutation if exclusive transforms claim the same unit without declared layering/order. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Hard conflicts”.
- [ ] **RULE-018** — Context compilation MUST fail before mutation if lower authority attempts to override higher authority without an explicit exception. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Hard conflicts”.
- [ ] **RULE-019** — Context compilation MUST fail before mutation if selector ambiguity prevents reproducible applicability or projection-owner lens overlap is unresolved. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Hard conflicts”.
- [ ] **RULE-020** — One canonical rule MAY compile into any combination of: a concise agent-context consequence via an applicable Semantic Representation Profile, machine-invariant normative predicates/permissions, write-scope permission, deterministic validator, transform binding, linter/check, divergence query, Impact Rule dependency, subagent route, and required test. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule products”.
- [ ] **RULE-021** — Prompts, hooks, validators, and codemods MUST derive from canonical rules rather than drift into independent policy copies. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule products”.
- [ ] **RULE-022** — Selectors, lens memberships, and effective rules MUST respect the governance strata defined by the conceptual architecture. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Stratified evaluation and recursion”.
- [ ] **RULE-023** — Cross-cutting constraints MAY depend on lower-layer classifications but MUST NOT create feedback in which a rule changes the facts that make that rule authoritative. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Stratified evaluation and recursion”.
- [ ] **RULE-024** — Declared recursive rule/lens groups MUST be evaluated as SCCs using monotonic semantics or an explicit fixed-point function. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Stratified evaluation and recursion”.
- [ ] **RULE-025** — In recursive evaluation, a repeated state digest MUST mean convergence or a detected cycle, and an iteration limit MUST terminate the run. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Stratified evaluation and recursion”.
- [ ] **RULE-026** — `projector audit --rules` MUST detect contradictions, unreachable selectors, excessive exceptions, duplicate/semantically equivalent rules, overbroad selectors, stale authority triggers, blocking rules lacking executable predicates/validators, deterministic mechanics represented only as prose, transforms lacking idempotency evidence, disproportionate invalidation, and rule/model growth whose maintenance cost exceeds prevented divergence. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule pressure”.

### Pattern candidates and Projection Lenses

- [ ] **LENS-001** — A `PatternCandidate` MUST remain descriptive and non-authoritative. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Pattern Candidate”.
- [ ] **LENS-002** — `PatternCandidate` MUST carry typed `id: EntityId`, `key: string`, `purposeHypothesis: string`, `memberUnitIds: EntityId[]`, `excludedUnitIds: EntityId[]`, `counterExamples: EntityId[]`, `independenceGroups: string[]`, `alternatives: string[]`, `confidence: Confidence`, `evidence: EvidenceRef[]`, and `semanticHash: ContentHash`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Pattern Candidate”.
- [ ] **LENS-003** — `LensContributionRole` MUST be one of `projection-owner`, `constraint-contributor`, `validator-contributor`, or `migration-overlay`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Lens contribution roles”.
- [ ] **LENS-004** — Only one unlayered exclusive `projection-owner` MAY own a given projection role/unit. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Lens contribution roles”.
- [ ] **LENS-005** — Cross-cutting constraint and validator lenses MAY compose, but projection-owner collisions without explicit layering/composition MUST fail lens compilation. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Lens contribution roles”.
- [ ] **LENS-006** — `ProjectionExpectation` MUST be one of: `exact-output(generatorId,expectedSignatureProfile)`, `structured-template(structureValidatorId,authoredHoles[])`, `predicate-constrained(predicateIds[],validatorIds[])`, `observed-state(comparisonPolicyId)`, or `human-procedure(procedureId,evidenceRequirements[])`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection expectation kinds”.
- [ ] **LENS-007** — Shared handwritten code SHOULD normally use `predicate-constrained`; reconciliation MUST NOT compare it with an arbitrary single implementation and label valid alternatives divergent. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection expectation kinds”.
- [ ] **LENS-008** — `ProjectionSpec` MUST carry typed `role: ProjectionUnit["role"]`, `cardinality`, `surfaceKind: Surface["kind"]`, `selector: SelectorExpr`, `control: ControlPolicy`, and `expectation: ProjectionExpectation`; `cardinality` MUST be one of `one`, `zero-or-one`, `many`, or `at-least-one`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-009** — `ProjectionLens` MUST carry typed `id: EntityId`, `key: string`, `version: string`, `status`, `purpose: string`, `realizesConceptKinds: Concept["kind"][]`, `selector: SelectorExpr`, `contributions: LensContributionRole[]`, `expectedProjections: ProjectionSpec[]`, `rules: Rule[]`, `impactRules: ImpactRule[]`, `recognizers: RecognizerBinding[]`, `validators: ValidatorBinding[]`, `transforms: TransformBinding[]`, `migrations: MigrationBinding[]`, `conflictsWith: LensRef[]`, `compatibleWith: LensRef[]`, `examples: LensExample[]`, `counterExamples: LensExample[]`, `authorityRecordId: EntityId`, `governanceBasis: GovernanceBasis[]`, and `semanticHash: ContentHash`; `status` MUST be one of `candidate`, `shadow`, `active`, `deprecated`, or `retired`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-010** — `ProjectionLens.status` MUST be one of `candidate`, `shadow`, `active`, `deprecated`, or `retired`. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-011** — An active lens MUST have stable identity/version, an applicability selector, one or more contribution roles, and projection expectations. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-012** — An active lens MUST have executable or validator-backed constraints, recognition behavior, and validation behavior. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-013** — An active lens MUST have a typed governance basis plus an authority decision/constraint. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-014** — An active lens MUST define invalidation/Impact Rules when conceptual consequences extend beyond exact derivations. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-015** — An active lens MUST define migration semantics for incompatible lens-version changes. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- [ ] **LENS-016** — Transforms are required only when deterministic mutation is supported; a prose-only architecture description MUST NOT qualify as an active lens. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.

### Derivations, semantic signatures, and proof groups

- [ ] **PROJ-001** — Invalidation MUST mean that a prior proof is no longer current; a hash alone MUST NOT count as proof unless its signature profile and assurance make the represented semantics explicit. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivations, semantic signatures, and proof groups”.
- [ ] **PROJ-002** — `DerivationInput.kind` MUST be one of `concept`, `requirement`, `scenario`, `relation`, `lens`, `rule-bundle`, `unit`, `artifact`, `external-constraint`, `toolchain`, `adapter`, `signature-profile`, `representation-profile`, or `representation-projection`; each input MUST also carry typed `id: EntityId | string`, `versionHash: ContentHash`, and `role: string`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation inputs”.
- [ ] **PROJ-003** — `DerivationRecord` MUST carry typed `unitId: EntityId`, `engineVersion: string`, `adapterVersion: string`, `inputs: DerivationInput[]`, `ruleBundleHash: ContentHash`, `outputSemanticSignature: SemanticSignature`, `outputStructuralSignature: SemanticSignature`, `membershipHash: ContentHash`, `establishedAt: string`, and `validators: ValidationResult[]`; it MAY carry `proofGroupId?: EntityId`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation inputs”.
- [ ] **PROJ-004** — Each semantic-signature profile MUST document its represented semantic scope, normalization, intentionally ignored differences, assurance evidence, adapter/profile version, and failures/unsupported constructs. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Signature profiles”.
- [ ] **PROJ-005** — A signature profile MUST NOT claim broader semantics than its evidence supports: formatting-insensitive AST shape MAY be exact for a structural projection but MUST remain heuristic for business behavior; exported TypeScript declaration shape MAY be exact for a public type-surface signature while saying nothing about runtime semantics; and test equivalence MAY validate behavior in the tested domain but MUST NOT prove untested side effects. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Signature profiles”.
- [ ] **INVAL-001** — A semantic-signature profile-version change MUST invalidate every derivation that depends on that profile. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Signature profiles”.
- [ ] **PROJ-006** — Downstream invalidation MAY be pruned only when the relevant semantic signature is `exact`, or is `validated` by evidence satisfying the current policy’s required independence and assurance. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Backdating eligibility”.
- [ ] **PROJ-007** — `heuristic` equality MAY prioritize revalidation or reduce model context but MUST NOT by itself establish downstream validity. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Backdating eligibility”.
- [ ] **PROJ-008** — The derivation graph MAY contain SCCs for mutually recursive semantic units. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.
- [ ] **PROJ-009** — When a relevant external input changes for a derivation SCC, Projector MUST mark the whole proof group suspect before recomputation. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.
- [ ] **PROJ-010** — Projector MUST recompute/revalidate derivation-SCC member signatures using the declared group strategy and iterate until signatures stabilize or the iteration limit is reached. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.
- [ ] **PROJ-011** — Projector MAY backdate a derivation SCC only as a unit and only when every externally visible relevant signature has eligible assurance. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.
- [ ] **PROJ-012** — Projector MUST propagate downstream from a derivation SCC only for signatures that materially changed. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.
- [ ] **PROJ-013** — An unresolved cyclic proof MUST emit `derivation-cycle-unresolved` and widen analysis. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivation cycles”.

### Semantic invalidation and correctness oracles

- [ ] **INVAL-002** — Exact dependency invalidation and conceptual Impact-Rule widening MUST remain separate mechanisms and MUST operate only after a semantic delta is known. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic invalidation and correctness oracles”.
- [ ] **INVAL-003** — Pre-change Relevance Closure is an upstream cognition mechanism and MUST NOT substitute for exact derivation dependencies or Impact Rules. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic invalidation and correctness oracles”.
- [ ] **INVAL-004** — A relevance edge MAY become a canonical/derived relation or Impact Rule only through the normal evidence and governance path. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic invalidation and correctness oracles”.
- [ ] **INVAL-005** — `ImpactRule` MUST carry typed `id: EntityId`, `key: string`, `version: string`, `selector: SelectorExpr`, `trigger`, `direction`, optional `relationTypes?: RelationType[]`, optional `maxDepth?: number`, `effect`, optional `requiredRelationConfidence?: number`, and `semanticHash: ContentHash`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Impact Rules”.
- [ ] **INVAL-006** — `ImpactRule.trigger` MUST be one of `concept-change`, `interface-change`, `membership-change`, `removal`, `lens-change`, `rule-change`, `decision-change`, `concern-resolution`, `representation-profile-change`, `external-change`, or `manual`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Impact Rules”.
- [ ] **INVAL-007** — `ImpactRule.direction` MUST be `forward`, `reverse`, or `both`; `effect` MUST be `invalidate`, `revalidate`, `widen-analysis`, `advisory`, or `block`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Impact Rules”.
- [ ] **INVAL-008** — Exact invalidation MUST first follow reverse `DerivationInput` dependencies; applicable Impact Rules MUST then add architecture-specific conceptual consequences. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Impact Rules”.
- [ ] **INVAL-009** — Low-confidence inferred relations MAY widen the frontier but MUST NOT silently become exact deterministic dependency edges. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Impact Rules”.
- [ ] **INVAL-010** — `InvalidationCause` MUST record typed `eventKind: string` and `subjectId: EntityId | string` and MAY record `oldHash?: ContentHash` and `newHash?: ContentHash`; `InvalidationEvent` MUST additionally record `graphRevision: number` and `stateDigest: StateDigest`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation causes and result”.
- [ ] **INVAL-011** — `InvalidationResult` MUST separately report typed `directlyAffected: EntityId[]`, `transitivelyAffected: EntityId[]`, `possibleFrontier: EntityId[]`, `unavailable: EntityId[]`, and per-entity `reasons: Record<EntityId, string[]>`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation causes and result”.
- [ ] **INVAL-012** — Required invalidation causes MUST include changes to Concepts, Requirements, Behavioral Scenarios, authored Relations, architecture decisions, concern dispositions, lenses, rules, Semantic Representation Profiles, selector membership, and authority. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation causes and result”.
- [ ] **INVAL-013** — Required invalidation causes MUST also include changes to artifacts, units, signature profiles, toolchains, adapters, exceptions, migration phases, pinned observations, and surface availability. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation causes and result”.
- [ ] **INVAL-014** — Invalidation MUST execute in this sequence: (1) find exact reverse derivation dependents; (2) mark their units/proof SCCs suspect; (3) evaluate applicable versioned Impact Rules; (4) add proven Impact-Rule dependencies; (5) place weak/inferred/open-world consequences in the possible frontier; (6) revalidate suspect signatures before expensive downstream propagation; (7) backdate only exact or policy-sufficient independently validated equality; (8) propagate material semantic changes through exact dependents; (9) widen for analyzer failures, open-world lanes, unstable anchors, or insufficient assurance; (10) return known affected, possible frontier, unavailable surfaces, and reasons. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation algorithm”.
- [ ] **INVAL-015** — The invalidation algorithm MUST be deterministic for a fixed canonical state, repository snapshot, pinned external snapshot, adapter/profile set, and policy. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Invalidation algorithm”.
- [ ] **INVAL-016** — When an exact public-interface signature is recomputed unchanged after an internal input change, Projector MUST establish a new derivation against the new input and MAY keep downstream client-generation proof current without regeneration. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic backdating”.
- [ ] **INVAL-017** — If equality assurance is only heuristic, the unit MUST remain `suspect` until an adequate validator proves it or Projector widens the frontier. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic backdating”.
- [ ] **INVAL-018** — `projector verify --clean` MUST rebuild local derived state from the repository/Git snapshot, canonical `.projector/` state, any explicitly requested pinned external observation snapshot, and declared toolchain/adapter/signature-profile versions. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Rebuild oracle”.
- [ ] **INVAL-019** — The clean rebuild oracle MUST compare clean and incremental state and detect stale caches, missing invalidation, revision errors, and nondeterministic rebuild behavior. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Rebuild oracle”.
- [ ] **INVAL-020** — A rebuild using the same semantic extractor MUST NOT alone count as proof of business correctness because it is correlated with incremental state. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Independent conformance oracle”.
- [ ] **INVAL-021** — Independent conformance evidence MAY come from a compiler/type checker, pre-existing or independently designed tests, schema/contract validators, runtime/remote observations, architecture/property/metamorphic checks, or independent human/model review. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Independent conformance oracle”.
- [ ] **INVAL-022** — Validation policy MUST decide the required evidence lanes and independence groups for each risk class. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Independent conformance oracle”.
- [ ] **INVAL-023** — Historical replay and mutation-generated variants SHOULD test whether a lens, selector, transform, or authority decision predicts useful outcomes beyond its originating fixtures. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Historical/metamorphic oracle”.
- [ ] **INVAL-024** — Projector MUST NOT describe rebuild, independent-conformance, and historical/metamorphic oracles as interchangeable proof. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Historical/metamorphic oracle”.

### Repair routing

- [ ] **PROJ-014** — `RepairStrategy` MUST be one of `reuse`, `revalidate`, `deterministic-patch`, `regenerate`, `agent-repair`, `widen-analysis`, or `human-decision`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-015** — `RepairCapabilities` MUST state `validatorCanProveValidity`, `deterministicPatch`, `patchIsReversible`, `generator`, and `upstreamSourceKnown`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-016** — Repair routing MUST choose the first eligible strategy in this order: (1) `reuse` for eligible exact/validated signatures that can be backdated; (2) `revalidate` when a validator can establish sufficient proof; (3) repair upstream and `regenerate` when a generated unit has a known upstream source/generator; (4) `deterministic-patch` for a safely applicable reversible transform on a non-generated governed unit; (5) `agent-repair` for shared handwritten semantics requiring bounded reasoning when policy permits; (6) `widen-analysis` when coverage/proof is insufficient; (7) otherwise `human-decision`. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-017** — Direct editing of a generated output or Representation Projection with a known generator/source MUST be forbidden by default. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-018** — Normal generated repair MUST occur in order: repair upstream canonical semantics/profile, regenerate, then validate the generated result and semantic preservation. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-019** — A temporary generated-output overlay MAY exist only as an explicit migration/debt record with an owner, rationale, invalidation conditions, and exit criteria. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- [ ] **PROJ-020** — Every repair-routing decision MUST record why cheaper or safer strategies were unavailable or insufficient. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.

### Execution Capsules

- [ ] **CAPS-001** — The Context Compiler MUST emit one minimal, state-bound `ExecutionCapsule` per work scope. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-002** — `ContextPrecedent` MUST record typed `unitId: EntityId`, `similarity: Confidence`, `relevance: string`, and `evidenceIds: EntityId[]`; `ScopeGrant` MUST record `selector: SelectorExpr`, `operations: string[]`, and `reason: string`. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-003** — `CompletionContract` MUST record `requiredUnitStates` with `unitId: EntityId` and `state: "valid" | "removed" | "exception"`, `requiredValidators: string[]`, `requiredEvidenceLanes: ValidationResult["evidenceLane"][]`, `minimumValidationAssurance: ValidationResult["assurance"]`, `requireIndependentValidation: boolean`, `maximumNewDivergences: number`, `maximumUnknowns: number`, `allowUnavailableExternalActions: boolean`, `requiredArtifacts: string[]`, and `cleanWorkingTree: boolean`. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-004** — Each required unit state in a completion contract MUST be `valid`, `removed`, or `exception`. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-005** — `ExecutionCapsule` MUST carry typed `id: EntityId`, `taskId: EntityId`, `objective: string`, `operation: string`, `unitIds: EntityId[]`, `boundState: StateBinding`, `relevanceClosureId: EntityId`, `analysisFacetKeys: string[]`, `requirementIds: EntityId[]`, `scenarioIds: EntityId[]`, `conceptSummary: string`, `decisionIds: EntityId[]`, `decisionSummary: string`, `unresolvedArchitectureConcerns: EntityId[]`, `lensSummary: string`, `effectiveRules: EffectiveRuleBundle[]`, `normativeKernelHash: ContentHash`, optional `representation?: RepresentationProjectionRef`, `relevantPrecedents: ContextPrecedent[]`, `allowedWrites: ScopeGrant[]`, `forbiddenWrites: ScopeGrant[]`, `availablePrimitives: string[]`, `requiredValidations: string[]`, `upstreamImplications: string[]`, `downstreamImplications: string[]`, `knownExceptions: string[]`, `unknowns: string[]`, `risk: RiskAssessment`, `completionContract: CompletionContract`, `contextDependencyHash: ContentHash`, and `contextHash: ContentHash`. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-006** — A worker MUST receive the bounded semantic context needed for its objective, including direct/governing Requirements and Behavioral Scenarios, relevant architecture, unresolved obligations, semantic role, decisions/lenses, mutation scope, dependent projections, and proof requirements. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-007** — Consequence-band material SHOULD enter a capsule first as compact summaries or kernel references. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-008** — Possible-band material SHOULD normally enter a capsule as identity, relevance rationale, and uncertainty unless task needs or risk requires expansion. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-009** — The Context Compiler MUST compile capsule material from `RelevanceClosure` and subsequent Impact Closure, not repository-directory proximity or an unconditional project-wide semantic dump. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-010** — Every context item SHOULD remain explainable by a relevance or impact reason. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-011** — Deterministically enforced mechanics SHOULD appear in model context as concise consequences or available tools rather than repeated prose. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-012** — Structured `effectiveRules`, scope grants, completion contract, and `normativeKernelHash` MUST remain the semantic source inside the capsule; compact prose MUST be only an optimization layer and MUST NOT replace them. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-013** — The Context Compiler SHOULD choose the least-cost Representation Profile satisfying capsule semantic-preservation and risk policy; if compression is net-negative after profile overhead or lowers measured task/conformance quality, it SHOULD choose a less-compressed profile. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-014** — Before integrating a packet, the coordinator MUST confirm that the capsule `StateBinding` still covers relevant state dependencies. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-015** — If the snapshot root changed, the coordinator MUST re-evaluate the binding before recompiling. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-016** — A root snapshot change with an unchanged dependency set MAY be rebound without regenerating model context. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- [ ] **CAPS-017** — A change that can alter relevance membership, even without changing loaded entity bodies, MUST invalidate or re-evaluate the affected closure/binding; examples include a new invariant, relation, export, event consumer, or selector result. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.

### Deterministic runtime and transforms

- [ ] **RUNTIME-001** — Caveman primitives MUST be deliberately small deterministic execution operations and MUST remain authority/state-independent from agent-context compression even though both favor minimal representations. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Caveman primitives”.
- [ ] **RUNTIME-002** — The runtime MUST provide primitive categories for inventory, read, hash/sign, parse, query, structural match, AST-node insertion/replacement, artifact move, symbol rename, structured-data-pointer update, Markdown section/reference update, package export/script update, workflow action/version update, format, declared-command execution, validation, diff, checkpoint, and rollback/compensation. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Caveman primitives”.
- [ ] **RUNTIME-003** — Agents SHOULD use a primitive rather than a raw write whenever a suitable primitive exists. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Caveman primitives”.
- [ ] **RUNTIME-004** — `Transform<TInput = unknown>` MUST define `id: string`, `version: string`, `description: string`, async `applies(input: TInput, context: TransformContext): Promise<boolean>`, async `preview(input: TInput, context: TransformContext): Promise<TransformPreview>`, async `apply(input: TInput, context: TransformContext): Promise<TransformResult>`, and async `verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]>`; it MAY define async `rollback?(result: TransformResult, context: TransformContext): Promise<void>`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-005** — A mutating transform MUST be idempotent or declare a bounded convergent fixed point. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-006** — A mutating transform MUST declare touched Projection Units, write scope, preconditions, and a dependency-scoped `StateBinding`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-007** — A mutating transform MUST preview before apply and MUST fail closed on unresolved semantic anchors. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-008** — A mutating transform MUST preserve unrelated formatting where practical, produce structured operation evidence, and verify postconditions. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-009** — A mutating transform MUST provide rollback for R1 risk and compensation or explicit irreversibility for higher risk. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform contract”.
- [ ] **RUNTIME-010** — Observation MUST be no-exec by default; running repository code MUST be an explicit capability rather than incidental analyzer behavior. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- [ ] **RUNTIME-011** — `CommandSpec` MUST define typed `id: string`, `argv: string[]`, `cwd: string`, `readScope: string[]`, `writeScope: string[]`, `network`, `environmentKeys: string[]`, `sideEffectClass`, and `timeoutMs: number`; it MAY define `cpuBudgetMs?: number` and `memoryBudgetMb?: number`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- [ ] **RUNTIME-012** — `CommandSpec.network` MUST be `deny` or `allow`; `sideEffectClass` MUST be `none`, `read-only`, `workspace-write`, or `external-write`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- [ ] **RUNTIME-013** — Command execution MUST use explicit argv arrays where possible, root-constrained cwd validation, controlled environment keys, and policy-aware write/network boundaries. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- [ ] **RUNTIME-014** — A validator with workspace or external side effects MUST participate in transaction/risk policy and MUST NOT be treated as harmless merely because its purpose is `verification`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- [ ] **RUNTIME-015** — Transforms MUST declare predecessor dependencies, mutual exclusions, commutativity, exclusive unit claims, postconditions, and fixed-point/convergence behavior. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform composition”.
- [ ] **RUNTIME-016** — Unresolved overlapping exclusive transform claims MUST block planning. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform composition”.
- [ ] **RUNTIME-017** — Transform dependency cycles MUST be evaluated as explicit SCCs only when declared convergent; otherwise they MUST be plan errors. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Transform composition”.

### Representation compilation and fidelity

- [ ] **REPR-001** — Representation compilation MUST consume canonical semantic entities, effective rule bundles, scope, and state binding, and MUST produce a target-specific Representation Projection plus a Semantic Preservation Fingerprint. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-002** — Behavioral/Gherkin specifications MAY be compiled from canonical Requirements and Behavioral Scenarios through the same representation pipeline. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-003** — Compiled Behavioral/Gherkin specifications MUST bind to source semantic hashes and MUST NOT become parallel authority merely because an acceptance runner consumes them. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-004** — Representation compilation SHOULD execute in this order: canonical semantic sources; normalized representable semantic kernel; protected-dimension fingerprints; target rendering; deterministic style/literal checks; required semantic-fidelity validators; tokenizer/profile overhead accounting; then accept, fall back, or reject. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-005** — Fidelity validation MUST preserve normative force without silent weakening or strengthening among `require`, `forbid`, `prefer`, and permission strength. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-006** — Fidelity validation MUST preserve negation. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-007** — Fidelity validation MUST preserve quantifiers/cardinality, including exactly, at-least, at-most, all, and none. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-008** — Fidelity validation MUST preserve logical connectives, including `and`, `or`, implication, and biconditional semantics. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-009** — Fidelity validation MUST preserve conditions/guards and exceptions. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-010** — Fidelity validation MUST preserve dependencies and ordering wherever order is semantic. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-011** — Behavioral rendering MUST preserve scenario step roles so preconditions, triggers, outcomes, and exceptions do not swap semantic roles in Gherkin or other behavioral syntax. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-012** — Fidelity validation MUST preserve semantic scope. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-013** — Fidelity validation MUST preserve stable Concept, Requirement, and Behavioral Scenario identities and one name per entity within a projection unless an explicit alias map exists. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-014** — Fidelity validation MUST exactly preserve protected identifiers, code, commands, paths, URLs, API names, version numbers, numeric values, and units. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-015** — A rendering of `MUST_NOT delete production data unless explicit approval` MUST NOT validate as equivalent to `Avoid deleting production data without approval`; `A iff B` MUST NOT validate as `A when B`; and `exactly one` MUST NOT validate as `one or more`. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-016** — For human-facing technical prose, deterministic style linting SHOULD report violations per document/word count and category so before/after deltas are measurable; the resulting score MUST be treated only as a style signal. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-017** — Compact agent-context token accounting MUST use the tokenizer/profile relevant to the target host/model when available; character count MUST NOT substitute when doing so would alter optimization decisions. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-018** — Shortened spellings or invented abbreviations SHOULD NOT be used unless measured to save tokens and remain clear. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-019** — A failed compact projection SHOULD fall back in this order: (1) exact machine-invariant kernel plus compact advisory prose; (2) less-aggressive compact profile; (3) human-technical profile; (4) explicit block/unknown when required semantics still cannot be represented safely. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-020** — Projector MUST NOT repeatedly spend model tokens compressing already-small context when expected savings do not exceed representation overhead. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-021** — If the target tokenizer cannot be measured, savings estimates MUST be marked heuristic. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- [ ] **REPR-022** — Automatic selection claiming net-positive token economics MUST use measured or conservatively bounded accounting. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.


### Reconciliation, Coverage, Change, Plans, and Transactions


### Coverage and completion

- [ ] **COVR-001** — Coverage MUST be reported across all of these distinct dimensions: inventory; Projection Unit classification; Concept mapping; relationship; Lens; rule enforceability; derivation; validation/evidence-lane; surface; authority; historical/metamorphic; architecture-decision and decision-frontier state; semantic-identity resolution/overlap; pre-change relevance for supported dependency lanes; representation-projection fidelity and protected dimensions; change-closure confidence; and predicted-versus-observed impact surprise rate for executed changes. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Coverage, observability, and proof boundaries”.
- [ ] **COVR-002** — Every coverage dimension MUST report its observability class and the assumptions behind its denominator; a percentage without its observable universe and evidence assumptions is not a completeness claim. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Coverage, observability, and proof boundaries”.
- [ ] **COVR-003** — A coverage lane MUST carry `key`, `observability`, `numerator`, optional `denominator`, `confidence`, `assumptions`, `blindSpots`, `analyzerFailures`, `staleObservationIds`, and `exactClosureProvable`. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Coverage, observability, and proof boundaries”.
- [ ] **COVR-004** — A coverage snapshot MUST carry `graphRevision`, `boundary`, `lanes`, `completeWithinBoundary`, `allowsBoundedAgentRepair`, `unknownFrontierIds`, `unavailableSurfaceIds`, and a `proofStatement` restricted to `proven-within-boundary`, `bounded`, `high-confidence`, `partial`, or `not-established`. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Coverage, observability, and proof boundaries”.
- [ ] **COVR-005** — The statement `proven-within-boundary` is legal only when every dependency lane required by the claim is either `closed`, or is `bounded` with every stated assumption satisfied. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “`proven-within-boundary`”.
- [ ] **COVR-006** — Any required lane that is `open`, `sampled`, `unavailable`, failed, or stale MUST prevent `proven-within-boundary` and MUST appear in the frontier/unknown statement. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “`proven-within-boundary`”.
- [ ] **COVR-007** — A partial analyzer failure MUST preserve useful observations from unaffected capabilities and MUST lower or widen only coverage and conclusions that depend on the failed capability. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Analyzer failure degradation”.
- [ ] **COVR-026** — A partial analyzer failure MUST NOT invalidate a proven observation from another capability unless that proof depended on the failed capability; for example, Markdown parsing failure MUST NOT invalidate a proven package dependency edge unless that proof depended on Markdown. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Analyzer failure degradation”.
- [ ] **COVR-008** — Complete-within-boundary requires every enumerated artifact to be classified as `managed`, `external/manual`, intentionally excluded from the denominator, or `supporting`. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-009** — Complete-within-boundary requires every governed Projection Unit to map to semantic intent or a justified supporting role. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-010** — Complete-within-boundary requires every active in-scope Concept, Requirement, and Behavioral Scenario to be uniquely resolved or to have an explicit overlap/uncertainty disposition. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-011** — Complete-within-boundary requires every active concept to have expected projections or to be explicitly abstract. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-012** — Complete-within-boundary requires relevance lanes needed by the claimed change class to be closed/bounded enough that omitted governing semantics are not silently treated as absent. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-013** — Complete-within-boundary requires every active Lens to have recognition, validation, impact, and expectation behavior. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-014** — Complete-within-boundary requires every hard rule to be executable or validator-backed. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-015** — Complete-within-boundary requires every external/manual projection to have an owner and procedure. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-016** — Complete-within-boundary requires zero unresolved blocking findings. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-017** — Complete-within-boundary requires zero unknown units for required lanes classified as closed/bounded. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-018** — Complete-within-boundary requires all required validation-independence constraints to be satisfied. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-019** — Complete-within-boundary requires zero unresolved `blocking-now` architecture concerns for the claimed scope and requires accepted decisions needed by that scope to have valid or explicitly bounded validity assessments. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Complete-within-boundary definition”.
- [ ] **COVR-020** — `projector complete` SHOULD rank questions approximately by `(expected_uncertainty_reduction × affected_unit_count × future_change_frequency × divergence_leverage × decision_reuse × architecture_materiality) ÷ (user_effort × ambiguity × risk)`. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.
- [ ] **COVR-021** — Completion questions SHOULD resolve clusters rather than individual artifacts; identity/ownership ambiguities that could fragment canonical semantics and missing relevance relationships that repeatedly surprise planning are high-information questions. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.
- [ ] **COVR-022** — Blocking architecture questions MUST outrank low-value cleanup questions when they constrain the next safe plan. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.
- [ ] **COVR-023** — Projector MUST NOT present non-blocking architecture questions merely because they are interesting. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.
- [ ] **COVR-024** — A completion answer MAY approve, choose an alternative, provide a semantic correction, create an intentional exception, defer, or permit policy selection. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.
- [ ] **COVR-025** — A settled completion question MUST NOT recur unless relevant evidence changes. **Source:** `PROJECTOR_SPEC/06-reconciliation/coverage-and-completion.md` — “Maximum-information-gain completion”.

### Reconciliation, divergence, exceptions, and migrations

- [ ] **RECN-001** — Reconciliation MUST execute in this declared order: load state-bound inputs; index observations; refresh deterministic facts; update semantic classifications/hypotheses; compute Lens memberships; compile rules and projection expectations; refresh invalidated Representation Projections; evaluate derivations/validity; derive reverse semantic impact from actual mutations; compare predicted relevance/impact with observed impact; classify Planning Surprises and propose justified missing relationships; compare governed expectation with observed state; correlate migrations/exceptions; classify divergence/anomaly; optionally plan/execute repairs; reindex affected state; iterate declared SCC/fixed-point groups; verify convergence and required evidence; emit receipt/certificate/report. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Reconciliation loop”.
- [ ] **RECN-002** — A second reconciliation with identical inputs SHOULD produce no material semantic-state delta, new patch, or new finding identity, though it MAY emit a run record or unchanged report. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Reconciliation loop”.
- [ ] **RECN-003** — Every reconciliation iteration MUST calculate a deterministic state digest over the governed incremental state. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-004** — Reconciliation MUST stop when no material semantic state changed, or when all declared fixed-point groups satisfy their convergence criteria. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-005** — Reconciliation MUST fail with `nonconvergent-reconciliation` if an earlier nonterminal state digest repeats. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-006** — Reconciliation MUST fail with `nonconvergent-reconciliation` if a declared SCC exceeds its iteration budget. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-007** — Reconciliation MUST fail with `nonconvergent-reconciliation` if rule/Lens membership oscillates. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-008** — Reconciliation MUST fail with `nonconvergent-reconciliation` if a repair repeatedly recreates the same divergence. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-009** — Evaluation order MUST NOT silently determine the winning state of a cycle. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Termination”.
- [ ] **RECN-010** — The divergence taxonomy MUST include at least `pattern-inconsistency`, `misplaced-artifact`, `missing-projection`, `orphan-projection`, `stale-projection`, `conflicting-authority`, `duplicate-concept`, `semantic-identity-overlap`, `unpredicted-impact`, `accidental-fork`, `dependency-boundary`, `documentation-drift`, `test-projection`, `migration-residue`, `obsolete-technology`, `external-surface-drift`, `unmodeled-surface`, `rule-quality`, `representation-drift`, `representation-fidelity`, `governance-cycle`, `nonconvergent-reconciliation`, `derivation-cycle-unresolved`, and `uncertain-anomaly`. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Divergence taxonomy”.
- [ ] **RECN-011** — A difference MAY be classified as technical debt only when an accepted condition supports that classification, such as an invariant/Lens violation, demonstrated maintenance or security cost, unfinished migration, duplicated responsibility, platform constraint, or accepted-debt record. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Divergence taxonomy”.
- [ ] **RECN-012** — A Divergence MUST carry `id`, `type`, `title`, severity restricted to `info|low|medium|high|critical`, `confidence`, `leverage`, status restricted to `open|auto-fixed|planned|accepted-exception|dismissed|blocked`, `expected`, `observed`, Concept/Requirement/Scenario/Unit/Rule IDs, evidence, counter-evidence, rationale, possible intentionality, recommended disposition, repair strategies, coverage caveat, and semantic hash. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Divergence contract”.
- [ ] **RECN-013** — Every finding MUST explain why its expectation applies. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Divergence contract”.
- [ ] **RECN-014** — Every finding MUST identify the proof/coverage limitations that prevent a stronger claim. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Divergence contract”.
- [ ] **RECN-015** — For every executed plan, reconciliation MUST compare planned Relevance Closure and Impact Closure with the semantic/code closure implied by the actual diff and observed mutations. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-016** — Unexpected impact MUST be classified before being treated as failure, using exactly one justified disposition among: legitimate newly discovered relationship; legitimate scope expansion; agent overreach; analysis deficiency; or benign incidental mutation. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-017** — A legitimate newly discovered relationship MUST be proposed with evidence for acceptance or derived indexing so later changes discover it earlier. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-018** — Legitimate scope expansion MUST refresh/rebase the plan and require any newly applicable governance and validation. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-019** — Agent overreach MUST be repaired or reverted outside the authorized semantic/write scope. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-020** — An analysis deficiency MUST remain recorded as a Planning Surprise and SHOULD improve the relevant analyzer, facet, relation, or relevance rule where justified. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-021** — A benign incidental mutation MUST record why it does not alter semantic closure. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-022** — A single surprise MUST NOT automatically become canonical truth; promotion MUST follow normal source-class, evidence, authority, and causal-independence rules. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Planning Surprise reconciliation”.
- [ ] **RECN-023** — An exception MUST contain a stable ID/key, exact semantic selector, excepted rule/Lens/expectation, rationale, supporting evidence, owner, typed review/expiry trigger, invalidation conditions, and MAY contain remediation/exit criteria. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Exceptions”.
- [ ] **RECN-024** — Broad path-wide suppressions SHOULD be rejected when a narrower semantic selector is available. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Exceptions”.
- [ ] **RECN-025** — Expired or invalidated exceptions MUST re-enter divergence evaluation. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Exceptions”.
- [ ] **RECN-026** — An exception MUST NOT mutate the underlying authority record to hide a conflict; it MUST remain an explicit scoped deviation. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Exceptions”.
- [ ] **RECN-027** — Migration overlays MUST support the ordered phases `proposed → prepared → dual-running → cutover → cleanup → complete`, with `rolled-back` as the rollback terminal phase. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Migration overlays”.
- [ ] **RECN-028** — Migration phase MUST be selector-visible and MAY temporarily alter applicable rules, projection expectations, or compatibility obligations. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Migration overlays”.
- [ ] **RECN-029** — A migration definition MUST contain source and target Lens references, entry and exit criteria, compatibility strategy, allowed temporary divergences, validation obligations, rollback/compensation, and a cleanup-residue detector; it MUST include generated-output overlays when such overlays exist. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Migration overlays”.
- [ ] **RECN-030** — Migration residue MUST be determined from explicit exit criteria, not merely from age. **Source:** `PROJECTOR_SPEC/06-reconciliation/reconciliation-and-divergence.md` — “Migration overlays”.

### Semantic change compilation

- [ ] **CHNG-001** — The Semantic Change Compiler MUST transform a human request into a governed semantic transaction without assuming the request names the correct canonical concepts or repository locations. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Purpose”.
- [ ] **CHNG-002** — Compilation MUST preserve this front-half order and separation: request; parallel WHAT/WHY intent analysis and WHERE/WHAT-ELSE Relevance Scout; semantic identity resolution; bounded Relevance Closure; Requirement/Behavioral Scenario/constraint delta; architecture preflight; semantic operations; Impact Closure; state-bound plan. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Purpose”.
- [ ] **CHNG-003** — The compiler MUST NOT jump directly from request text to file edits or newly named specification entities. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Purpose”.
- [ ] **CHNG-004** — Intent analysis MUST limit extraction to the problem/why, externally meaningful desired outcome, behavior/capability changes, hard constraints, non-goals, explicitly stated assumptions, and available external work-item/origin references. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-005** — Intent analysis MUST NOT silently convert a proposed implementation technology into product intent; before the underlying goal is established it MUST record the technology as an `implementation-proposal` and keep behavioral/constraint statements separate. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-006** — Projector MUST resolve whether an implementation proposal is an explicit user decision or only a candidate solution. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-007** — An IntentStatement kind MUST be one of `behavior`, `constraint`, `non-goal`, `assumption`, or `implementation-proposal`, and MUST carry its statement, origin references, and confidence. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-008** — ChangeIntentAnalysis MUST carry `id`, original `request`, `normalizedIntent`, statements, ambiguity, assumptions, and content hash. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-009** — Intent analysis MUST remain derived work until accepted semantic deltas are committed. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Intent analysis”.
- [ ] **CHNG-010** — In parallel with WHAT/WHY analysis, the Relevance Scout MUST investigate WHERE/WHAT-ELSE without selecting HOW. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Relevance Scout”.
- [ ] **CHNG-011** — The Relevance Scout MAY inspect request-named paths/symbols/artifacts; canonical Concepts, Requirements, Behavioral Scenarios, aliases, and Relations; Projection Unit mappings; package/import/call/type topology; event producers/consumers; public/message/schema contracts and consumers; tests/verification bindings; active Decisions, invariants, assumptions, and Governance Bases; and relevant historical/co-change evidence. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Relevance Scout”.
- [ ] **CHNG-012** — Relevance Scout output MUST seed Semantic Identity Resolution and the Relevance Engine, MUST NOT authorize mutation, and MUST NOT convert descriptive implementation precedent into behavioral requirements. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Relevance Scout”.
- [ ] **CHNG-013** — Before durable semantic entities are created, the compiler MUST resolve requested meaning with `SemanticIdentityResolution` to one existing entity, several coordinated existing entities, an overloaded entity needing a split, a genuinely new entity, no durable semantic identity, or an unresolved ambiguity requiring evidence/user decision. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Identity resolution and Relevance Closure”.
- [ ] **CHNG-014** — Resolved identities plus Relevance Scout output MUST seed a `RelevanceClosure`. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Identity resolution and Relevance Closure”.
- [ ] **CHNG-015** — The compiler MUST NOT treat repository/package containment as sufficient relevance; cross-cutting Requirements, invariants, events, contracts, and Decisions MAY govern unrelated physical locations. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Identity resolution and Relevance Closure”.
- [ ] **CHNG-016** — A human-readable specification or Gherkin form MAY be generated from the resolved Requirement/Scenario subgraph for review, but it MUST be treated as a Representation Projection rather than the durable canonical semantic store; human edits MAY only be interpreted as a proposed semantic change. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Identity resolution and Relevance Closure”.
- [ ] **CHNG-017** — For behaviorally meaningful changes, Projector MUST resolve or create stable Requirements and Behavioral Scenarios before architecture/implementation planning. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-018** — Requirement and Behavioral Scenario deltas MUST remain independent, with canonical many-to-many linkage represented by typed `Relation` operations rather than nested ownership. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-019** — All semantic mutations MUST reside in one `ChangeOperation` stream; behavior deltas MUST be discriminated operation variants rather than duplicated side collections. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-020** — RequirementDelta and BehavioralScenarioDelta MUST respectively use `subjectType: requirement|scenario`, restrict `kind` to `add|modify|remove|supersede`, and carry the applicable optional existing ID, optional proposed entity, and rationale. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-021** — Pattern migrations, mechanical refactors, governance repairs, and other implementation cleanups MAY operate directly on existing Concepts/Lenses/Projection Units without creating a Requirement when no durable behavioral semantic identity would add value. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-022** — Behavioral requirements SHOULD be demonstrable through Behavioral Scenarios when examples or branches materially improve verification; Gherkin MUST remain an optional generated representation, not canonical storage. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Requirement and scenario delta”.
- [ ] **CHNG-023** — SemanticOperation kind MUST be one of `add`, `modify`, `remove`, `replace`, `migrate`, `adopt-rule`, `deprecate-rule`, or `resolve-divergence`; subjectType MUST be one of `concept`, `relation`, `decision`, `lens`, `rule`, `projection`, `surface`, or `other`; and the operation MUST carry subject key, optional subject ID, and payload. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Change contracts”.
- [ ] **CHNG-024** — ImpactClosureRef MUST contain its content hash, known affected Unit IDs, possible frontier Unit IDs, and unavailable Surface IDs. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Change contracts”.
- [ ] **CHNG-025** — SemanticChange MUST contain ID, request, normalized intent, intent-analysis ID, identity-resolution IDs, Relevance Closure ID, analysis-facet keys, operations, decision IDs, assumptions, boundary, optional predicted impact, risk, and status restricted to `draft|analyzed|approved|executing|complete|blocked`. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Change contracts”.
- [ ] **CHNG-026** — The interpreter MUST distinguish behavioral change, implementation-pattern change, technology replacement, architecture-boundary change, migration, cleanup, exception, and external-surface change; ambiguous interpretations MUST remain explicit alternatives. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Change contracts”.
- [ ] **CHNG-027** — An inferred Semantic Change MUST NOT become canonical merely by inference; accepted Requirement/Scenario/Concept/Decision/governance deltas MUST become canonical only through the normal semantic transaction, while transient analyses remain derived/inferred. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Change contracts”.
- [ ] **CHNG-028** — The compiler MUST activate only Analysis Facets relevant to the change; example facet keys are `behavior`, `architecture`, `events`, `security`, `realtime`, `migration`, `public-contract`, `persistence`, `performance`, `observability`, `compatibility`, and `distribution`. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Analysis Facet activation”.
- [ ] **CHNG-029** — Facet activation MAY add questions, relevance lanes, evidence requirements, concern triggers, or verification obligations, but MUST NOT itself select a technology or create a hard rule. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Analysis Facet activation”.
- [ ] **CHNG-030** — Facet selection SHOULD scale process depth to the actual change, and trivial low-risk changes MUST NOT be forced through architecture/event/security ceremony without an applicability reason. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Analysis Facet activation”.
- [ ] **CHNG-031** — Before Impact Closure, the compiler MUST run Progressive Architecture Commitment preflight for material Requirement, Scenario, or constraint deltas. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Architecture preflight”.
- [ ] **CHNG-032** — Architecture preflight MUST consume Relevance Closure plus behavior/constraint delta and SHOULD NOT rescan the entire repository to reconstruct already-compiled context. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Architecture preflight”.
- [ ] **CHNG-033** — SemanticChange MUST record architecture decisions/deferrals that are planning prerequisites and MUST NOT silently treat a model-selected technology as normalized user intent. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Architecture preflight”.
- [ ] **CHNG-034** — A durable plan MAY proceed only when the affected-scope decision frontier has no unresolved `blocking-now` concern, unless policy explicitly permits a recorded override. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Architecture preflight”.
- [ ] **CHNG-035** — After the semantic delta is sufficiently known, Impact Closure MUST combine exact reverse-derivation dependencies, active Lens projection expectations, active Impact Rules, selector membership changes, authored semantic Relations where an Impact Rule makes them relevant, encoded exact/validated or Impact-Rule-governed event/contract producer-consumer topology, external surface mappings, and observability-aware widening. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-036** — Every affected or frontier Unit MUST record why it entered Impact Closure and whether inclusion is `exact`, `rule-derived`, `heuristic`, or `open-world widening`. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-037** — If correctness depends on finding only the current affected set, the plan/capsule StateBinding MUST record all closure-defining bounded query results as `StateQueryDependency` values, including applicable reverse-derivation, Impact Rule, selector-membership, event/contract-consumer, and external-mapping queries. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-038** — A new dependent, consumer, or membership that changes a bound query result MUST stale or revalidate the plan even when every previously affected Unit hash is unchanged. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-039** — An `open`, `sampled`, or `unavailable` lane MUST NOT prove exhaustive absence of impact. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-040** — Relevance Closure membership MUST NOT automatically imply affected-Unit membership, and Impact Closure MAY add affected Units after the exact semantic delta becomes known. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-048** — Impact Closure MUST carry the same negative-space obligation as Relevance Closure: every bounded query on which completeness depends MUST be represented in the proof boundary rather than treating non-discovery as exhaustive absence. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Impact Closure”.
- [ ] **CHNG-041** — After execution, Projector MUST derive observed semantic/code impact from the actual diff and changed external surfaces and compare it with planned Relevance and Impact Closures. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Post-implementation reverse impact”.
- [ ] **CHNG-042** — Unexpected material impact entries MUST produce `PlanningSurprise` records and MUST NOT be silently folded into the plan after execution. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Post-implementation reverse impact”.
- [ ] **CHNG-043** — A Planning Surprise MUST NOT weaken validation or retroactively expand authorized write scope; legitimate new scope MUST require plan refresh/rebase and all newly applicable governance. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Post-implementation reverse impact”.
- [ ] **CHNG-049** — Planning-surprise learning MUST preserve this causal order: identify a missed relevant relationship; observe unexpected semantic impact during implementation; classify the surprise during reconciliation; propose an accepted relationship/analyzer/facet improvement; use that accepted improvement to make future related changes discover the relationship earlier. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Post-implementation reverse impact”.

### Plan construction, revision, and rebase

- [ ] **PLAN-001** — A plan MUST bind to a dependency-scoped `StateBinding` compiled against a global `StateDigest`. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-002** — A plan SHOULD order changed behavior/contracts/schemas before their consumers. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-003** — A plan SHOULD order compatibility bridges before cutover. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-004** — A plan SHOULD order source/generator fixes before generated output. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-005** — A plan SHOULD order deterministic narrowing before agent semantic work. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-006** — A plan SHOULD serialize shared Units and SHOULD parallelize independent surfaces only where safe. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-007** — A plan SHOULD schedule cleanup after validated target behavior. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-008** — Strongly connected semantic work groups MUST use explicit grouped execution rather than a fabricated DAG. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-009** — A plan MUST record both the Relevance Closure used for planning and predicted Impact Closure used for execution so reconciliation can compare them. **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Plan construction”.
- [ ] **PLAN-010** — Every audit, completion, migration, or interrupted semantic transaction MUST be able to emit a resumable cleanup/continuation plan. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-011** — Plans MUST be immutable revisions; revision MUST create a new revision identity rather than mutate a plan referenced by prior approvals or packets. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-012** — A PlanCheckpoint MUST carry ID, preceding packet IDs, required validators, and rollback specification. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-013** — ExecutionPlan MUST carry ID, revision, optional superseded-plan ID, optional semantic-change ID, source-run ID, bound state, optional Relevance Closure ID, optional predicted Impact Closure hash, boundary, assumptions, known affected Unit IDs, possible frontier Unit IDs, unavailable Surface IDs, packet IDs, checkpoints, completion criteria, and optional recommended next chunk. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-014** — A plan MUST support partial execution without violating dependency integrity. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-015** — Resuming against changed repository, canonical, toolchain, or external-snapshot state MUST perform explicit refresh/rebase that first recomputes global StateDigest and validates/rebinds StateBinding. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-016** — Refresh/rebase MUST determine which assumptions and closures remain valid. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-017** — Refresh/rebase MUST recompile stale capsules and packets. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-018** — Refresh/rebase MUST carry forward already-proven completed work only where it remains valid. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-019** — Refresh/rebase MUST emit a new immutable plan revision. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-020** — Refresh/rebase MUST invalidate stale approvals. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-021** — If the global snapshot changed while every bound dependency and query fingerprint remains current, Projector MAY perform a lightweight rebind that emits a new immutable plan revision without recomputing unaffected semantic analysis. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-022** — A lightweight rebind MUST be distinguishable from a semantic rebase that changes relevance, impact, assumptions, or packets. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.
- [ ] **PLAN-023** — Canonical-governance conflicts after branch merge/rebase MUST block Govern/Autonomous execution until explicitly resolved. **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”.

### Work packets and transactions

- [ ] **TXN-001** — Parallel workers MAY inspect, research, validate, or prepare isolated patches, but exactly one transaction coordinator MUST own final mutation of a governed worktree and canonical Projector state. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Work packets, writer coordination, and crash-consistent transactions”.
- [ ] **TXN-002** — A WorkPacket MUST carry ID, plan ID, title, repair strategy, Unit IDs, dependency IDs, capsule ID, risk, execution mode restricted to `deterministic|agent|manual|external`, optional transform ID, validator IDs, rollback specification, bound state, and status restricted to `pending|running|succeeded|failed|blocked|skipped`. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Work packets, writer coordination, and crash-consistent transactions”.
- [ ] **TXN-003** — There MUST be at most one writer lease per governed worktree. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Writer lease”.
- [ ] **TXN-004** — A writer lease MUST contain process/session identity, acquisition time, relevant StateBinding, compiled-against snapshot identity, heartbeat or stale-lock recovery information, and explicit release. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Writer lease”.
- [ ] **TXN-005** — Isolated worktrees MAY run parallel write-heavy packets, but each worktree MUST have its own lease. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Writer lease”.
- [ ] **TXN-006** — Workers MUST NOT write canonical authority/Lens/rule state directly and MUST return proposed deltas for coordinator integration. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Writer lease”.
- [ ] **TXN-007** — Transaction phase MUST be one of `prepared`, `workspace-mutating`, `workspace-staged`, `validating`, `canonical-staging`, `committing`, `committed`, `rolling-back`, `rolled-back`, or `recovery-required`; normal forward order is the listed sequence through `committed`, and rollback/recovery phases represent interruption handling. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction journal”.
- [ ] **TXN-008** — Every transaction-journal entry MUST contain transaction ID, plan ID, phase, before-state digest, optional intended after-canonical digest, worktree path, checkpoint IDs, touched paths, external-operation IDs, and update time. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction journal”.
- [ ] **TXN-009** — Startup MUST scan for incomplete transaction journals and deterministically choose recovery, rollback, or explicit human intervention. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction journal”.
- [ ] **TXN-010** — Transaction durability MUST cover repository files, Git index, external operations, and canonical Projector files; SQLite atomicity alone MUST NOT be treated as sufficient. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction journal”.
- [ ] **TXN-011** — Before packet integration, the coordinator MUST verify allowed write scope. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-012** — Before packet integration, the coordinator MUST validate packet/capsule StateBinding against current dependency hashes and bound query-result fingerprints; a changed global snapshot alone MUST NOT prove staleness. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-013** — Before packet integration, the coordinator MUST refresh/recompile if relevant state changed. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-014** — Before packet integration, the coordinator MUST run required validators with their declared side-effect policy. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-015** — Before packet integration, the coordinator MUST serialize overlapping semantic ownership. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-016** — Before packet integration, the coordinator MUST reconcile the combined diff. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-017** — The coordinator MUST checkpoint before every nontrivial next stage. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- [ ] **TXN-018** — Merge/rebase conflicts in canonical governance state MUST block Govern/Autonomous execution. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.

### Receipts and certificates

- [ ] **CERT-001** — Projector MUST keep the compact committed durability record (transaction receipt) distinct from verbose local audit output and the change certificate. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction receipts and change certificates”.
- [ ] **CERT-002** — A TransactionReceipt MUST contain ID, plan ID, optional semantic-change ID, risk class, before/after StateDigest, changed canonical entity/Requirement/Scenario/Unit IDs, validation-summary hash, optional certificate hash, optional rollback reference, creation time, and semantic hash. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction receipt”.
- [ ] **CERT-003** — Every R2+ semantic/governance transaction MUST commit a receipt under `.projector/receipts/`; R1 receipt commitment MAY be configured by repository policy. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction receipt”.
- [ ] **CERT-004** — Ordinary scans and observations MUST NOT create committed receipts. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction receipt”.
- [ ] **CERT-005** — A ChangeCertificate MUST contain ID, plan ID, optional base/resulting Git revisions, optional SemanticChange, optional Relevance/predicted-impact/observed-impact closure hashes, before StateDigest, optional after StateDigest, changed Concept/Requirement/Scenario/Relation/Unit IDs, Planning Surprise IDs, deterministic and agent operation evidence, validation results, resolved and introduced Divergence IDs, modeled boundary, completeness restricted to `proven-within-boundary|bounded|high-confidence|partial|not-established`, unknowns, unavailable actions, rollback specifications, and creation time. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Change certificate”.
- [ ] **CERT-006** — Every applied plan MUST produce a certificate, including failed and partially applied plans. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Change certificate”.
- [ ] **CERT-007** — A failed plan MUST produce a failure certificate containing its last durable checkpoint and recovery state. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Change certificate”.
- [ ] **CERT-008** — Certificates MUST be ignored by default, but MUST remain exportable, content-addressable, and linkable from transaction receipts and Git commits. **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Change certificate”.


### Agents, Hosts, Evolution, Persistence, Observation, and Research


### Host integration and MCP

- [ ] **HOST-001** — Host adapters MUST report the following capabilities instead of exposing host-brand assumptions to the engine: scoped instruction installation, lifecycle hooks, programmatic task execution, subagents, isolated worktrees, structured result support, tool-call observation, filesystem/shell observation, cancellation, and state-bound capability/token support. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Capability model”.
- [ ] **HOST-002** — Host integration MUST distinguish exactly three capability levels: (1) instruction/skill, where the host is taught to invoke Projector; (2) lifecycle enforcement, with pre/post mutation and completion gates; and (3) programmatic orchestration, where Projector directly dispatches state-bound work packets. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Integration levels”.
- [ ] **HOST-003** — Projector MUST remain useful at integration level 1 and MUST claim stronger guarantees only when the host actually supports the capability needed for those guarantees. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Integration levels”.
- [ ] **HOST-004** — Where wrapper execution is supported, the wrapper MUST get or join a Projector session before performing subsequent wrapper stages. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-005** — Where wrapper execution is supported, the wrapper MUST load or rebuild semantic state and then resolve `ExecutionPolicy`. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-006** — Where wrapper execution is supported, the wrapper MUST inject minimal host instructions and expose state-bound Projector tools. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-007** — When a supported wrapper host begins a meaningful change, the wrapper MUST resolve semantic identities and compile bounded Relevance Closure. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-008** — Where wrapper execution is supported, the wrapper MUST observe relevant mutation/tool events and compile Execution Capsules from the relevance/impact subgraph. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-009** — Where wrapper execution is supported, the wrapper MUST reconcile at checkpoints and session end, enforce policy only to the degree supported by host capability, and emit coverage, cleanup, receipt, and certificate deltas. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Wrapper”.
- [ ] **HOST-010** — Generated host instructions MUST be derivative outputs of canonical rules and MUST be regenerable. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **HOST-011** — Generated host instructions SHOULD be concise because deterministic enforcement belongs in Projector machinery. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **HOST-012** — Host instructions and per-task agent context SHOULD use the applicable Semantic Representation Profile and SHOULD bind to the same source semantic hashes/state as the capsule. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **HOST-013** — When Projector can supply the structured rule/predicate kernel, a host adapter MUST NOT use compact instructions as the only copy of a hard rule. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **HOST-014** — If a host supports only prose instructions, Projector MUST use the least-compressed representation satisfying the required preservation assurance and MUST state the weaker enforcement capability. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **HOST-015** — Instruction prose and passing clarity/token-style lint MUST NOT be represented as enforcement or semantic-equivalence guarantees. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- [ ] **MCP-001** — The MCP interface MUST expose these read-first operations: `projector.status`, `projector.audit`, `projector.explain`, `projector.context`, `projector.coverage`, `projector.list_divergences`, `projector.preview_plan`, `projector.preview_transform`, `projector.preview_representation`, `projector.validate_representation`, `projector.validate`, `projector.resolve_identity`, `projector.relevance`, `projector.requirements`, `projector.scenarios`, and `projector.impact`. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.
- [ ] **MCP-002** — The MCP interface MUST distinguish the controlled mutation operations `projector.apply_transform`, `projector.execute_packet`, `projector.accept_decision`, `projector.create_exception`, and `projector.apply_plan` from read-first operations. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.
- [ ] **MCP-003** — Every mutation-tool invocation MUST require an unforgeable session capability bound to session ID, plan/packet ID, `StateBinding`, the compiled-against `StateDigest`, allowed operations, permitted semantic/write scope, maximum risk/approval state, and expiry or revocation state. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.
- [ ] **MCP-004** — A capability compiled for one worktree/state binding MUST NOT authorize mutation after any dependency in that binding changes or becomes unprovable. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.
- [ ] **MCP-005** — Policy MAY rebind a mutation capability after a global snapshot/rebase only when every bound value and query dependency is unchanged; a root-digest difference by itself MUST NOT require rejection. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.
- [ ] **MCP-006** — Read-only tools MUST NOT require mutation capabilities but MUST still enforce secret/context policy. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “MCP interface and mutation capabilities”.

### Agent orchestration, validation, and completion

- [ ] **AGNT-001** — The orchestration model MUST support the provider-neutral logical roles `intent-analyst`, `relevance-scout`, `identity-resolver`, `relevance-critic`, `explorer`, `pattern-inferencer`, `authority-researcher`, `adversarial-critic`, `lens-author`, `transform-author`, `semantic-repairer`, `validator`, `reconciler`, and `modernization-architect`, with the purposes stated in the source role table. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **AGNT-002** — `intent-analyst` MUST normalize WHAT/WHY without selecting implementation, and `relevance-scout` MUST inspect WHERE/WHAT-ELSE across semantic, code, event, and contract topology without selecting HOW. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **AGNT-003** — `identity-resolver` MUST compare requested meaning with existing stable semantic identities/boundaries, while `relevance-critic` MUST adversarially search for omitted cross-cutting semantics and irrelevant context expansion. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **AGNT-004** — `explorer` MUST perform targeted read-only discovery; `pattern-inferencer` MUST propose semantic classification/pattern candidates; and `authority-researcher` MUST gather rationale and alternatives. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **AGNT-005** — `adversarial-critic` MUST attack selectors, assumptions, closure, and authority; `lens-author` MUST propose structured candidate lenses; and `transform-author` MUST implement deterministic transforms and tests. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **AGNT-006** — `semantic-repairer` MUST edit only constrained shared regions; `validator` MUST independently verify postconditions; `reconciler` MUST compare expected and observed final state; and `modernization-architect` MUST propose evidence-backed upgrades. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”.
- [ ] **MODEL-001** — Model routing MUST consider uncertainty, contextual risk, task type, context size, research need, mutation requirement, historical success, and cost policy. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model routing”.
- [ ] **MODEL-002** — Default routing MUST escalate in this order: deterministic engine; low-cost classifier/summarizer; bounded implementation model; frontier architecture/adversarial model. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model routing”.
- [ ] **MODEL-003** — Representation compilation MUST use deterministic rendering/fingerprinting first and MUST use model-assisted rendering only for semantic residue that deterministic profiles cannot adequately express. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model routing”.
- [ ] **AGNT-007** — Each validation result MUST record evidence lane, author/source, independence group, side-effect class, and assurance strength. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”.
- [ ] **AGNT-008** — R2+ completion policy MAY require at least one strong validation lane independent of the implementation packet. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”.
- [ ] **AGNT-009** — When independence is required, a test generated by the implementation packet MAY contribute evidence but MUST NOT be the sole strong proof. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”.
- [ ] **AGNT-010** — A model that generated a prose compression MUST NOT be the sole strong validator of that compression’s semantic fidelity; protected semantic dimensions MUST use deterministic checks or an appropriately independent validation lane, though style self-linting MAY contribute non-strong evidence. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”.
- [ ] **AGNT-011** — Validation independence MUST be assessed causally rather than by model-name diversity; reviewers consuming the same flawed generated test suite MUST be treated as potentially correlated evidence. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”.
- [ ] **AGNT-012** — Agents MUST NOT silently promote a lens/rule, change approved authority, weaken required validators, broaden write scope, persist an exception, modify canonical governance outside coordinator workflow, perform R4 external actions, or redefine concept identity merely to erase a divergence. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Agent authority restrictions”.
- [ ] **AGNT-013** — Agents MAY propose structured changes for explicit promotion or decision, but the proposal MUST NOT itself exercise the restricted authority. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Agent authority restrictions”.
- [ ] **AGNT-014** — An agent’s assertion that work is done MUST have no normative force. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Completion is a verified state”.
- [ ] **AGNT-015** — Completion MUST require the `CompletionContract`, a valid dependency-scoped `StateBinding`, required independent evidence, reconciled unit states, an unknown count allowed by policy, and explicit unavailable external actions all to satisfy policy. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Completion is a verified state”.

### Model-provider and replay contracts

- [ ] **MODEL-004** — The semantic core MUST NOT embed a model vendor and MUST NOT treat repeated model calls as deterministic computation. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”.
- [ ] **MODEL-005** — Every `StructuredModelRequest<T>` MUST carry `purpose: string`, `role: "classify" | "infer-concepts" | "resolve-identity" | "discover-relevance" | "analyze-intent" | "infer-pattern" | "research-synthesis" | "architecture" | "bounded-edit" | "representation-render" | "representation-review" | "adversarial-review" | "judge"`, `programVersion: string`, `schemaName: string`, `schemaVersion: string`, `schema: unknown`, `input: Record<string, unknown>`, `inputHash: ContentHash`, and `risk: RiskAssessment`; it MAY carry `executionCapsule?: ExecutionCapsule`, `maxInputTokens?: number`, `maxOutputTokens?: number`, and `maxCost?: number`. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”.
- [ ] **MODEL-006** — Structured model request `role` MUST be one of `classify`, `infer-concepts`, `resolve-identity`, `discover-relevance`, `analyze-intent`, `infer-pattern`, `research-synthesis`, `architecture`, `bounded-edit`, `representation-render`, `representation-review`, `adversarial-review`, or `judge`. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”.
- [ ] **MODEL-007** — Every `StructuredModelResponse<T>` MUST record `value: T`, `provider: string`, `model: string`, `rawResponseHash: ContentHash`, and `attempt: number`; it MAY record `providerRevision?: string`, `inputTokens?: number`, and `outputTokens?: number`. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”.
- [ ] **MODEL-008** — A model provider MUST expose typed structured generation equivalent to `generateStructured<T>(request: StructuredModelRequest<T>): Promise<StructuredModelResponse<T>>`. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”.
- [ ] **MODEL-009** — Inference cache keys MUST include normalized evidence/input hash, inference program/prompt version, output schema version, provider/model identity, and policy affecting the call. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Inference artifact cache”.
- [ ] **MODEL-010** — An unchanged input MAY reuse a recorded inference artifact, and rerunning it MUST NOT be required to reproduce byte-identical output. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Inference artifact cache”.
- [ ] **MODEL-011** — Schema-invalid output MAY be retried only within a bounded retry policy. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Inference artifact cache”.
- [ ] **MODEL-012** — Retry exhaustion MUST produce an explicit inference failure and MUST lower or widen dependent coverage rather than silently consuming malformed output. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Inference artifact cache”.
- [ ] **MODEL-013** — Model output MUST remain inferred/candidate state until an explicit deterministic promotion rule, policy-permitted authority action, or user decision accepts it into canonical state. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Promotion boundary”.
- [ ] **MODEL-014** — Resampling a model MUST NOT mutate accepted canonical architecture solely because the new answer differs. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Promotion boundary”.
- [ ] **MODEL-015** — Core tests MUST use fake or recorded model providers; live-model evaluation MUST be opt-in and budgeted. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Promotion boundary”.

### Modernization and surfaces

- [ ] **EVOL-001** — The modernization engine MUST recognize these triggers: repeated divergence, repeated agent difficulty, repeated Planning Surprises or missed relevance relationships, high invalidation fan-out, duplicated abstractions, unsupported dependency, security/support issues, slow feedback loop, architecture erosion, frequent migration overlays, platform incompatibility, and user request. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Triggers”.
- [ ] **EVOL-002** — A modernization proposal MUST identify the problem before naming technology. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Recommendation contract”.
- [ ] **EVOL-003** — Every modernization proposal MUST include current state, observed cost, target state, alternatives, evidence/counterevidence, affected Concepts/Requirements and Relevance Closure, estimated affected units, compatibility strategy, migration phases, rollback, cleanup criteria, risk, and confidence. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Recommendation contract”.
- [ ] **EVOL-004** — An upgrade MUST be rejected when the current state meets requirements at lower total cost, target support is immature, migration cost exceeds demonstrated recurring pain, benefit depends on speculative scale, external rationale does not fit local constraints, or reversibility is poor while evidence is weak. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Fashion resistance”.
- [ ] **EVOL-005** — Approved upgrades MUST become semantic changes plus migration overlays. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Fashion resistance”.
- [ ] **EVOL-006** — Modernization MUST NOT maintain a separate architecture-ranking system. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Fashion resistance”.
- [ ] **EVOL-007** — Upgrade triggers MUST create or dirty Architecture Concerns, and recommendations MUST use the Decision Evaluation, research freshness, preference, Authority Record, Governance Basis, and Decision Consequence machinery defined by Progressive Architecture Commitment (`PROJECTOR_SPEC/03-knowledge/architecture-decisions.md`). Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Fashion resistance”.
- [ ] **SURF-001** — Surface contracts MUST exist from the beginning, while broad external implementations MUST remain sequenced after the local correctness kernel. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Surface adapters and external observation snapshots”.
- [ ] **SURF-002** — Every `SurfaceAdapter` MUST expose `id: string`, `kind: Surface["kind"]`, `capabilities: SurfaceCapabilities`, `enumeration: EnumerationContract`, and asynchronous `discover(context: AdapterContext): Promise<Surface[]>`, `inventory(surface: Surface, context: AdapterContext): Promise<Artifact[]>`, and `fingerprint(artifact: Artifact, context: AdapterContext): Promise<ArtifactFingerprint>` operations. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Surface adapters and external observation snapshots”.
- [ ] **SURF-003** — A `SurfaceAdapter` MAY expose these optional asynchronous mutation methods with the exact source signatures: `plan?(change: SurfaceChange, context: AdapterContext): Promise<SurfacePlan>`, `apply?(plan: SurfacePlan, context: AdapterContext): Promise<SurfaceApplyResult>`, and `validate?(plan: SurfacePlan, context: AdapterContext): Promise<ValidationResult[]>`; mutation methods MUST remain optional. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Surface adapters and external observation snapshots”.
- [ ] **SURF-004** — A read-only or unavailable API MUST NOT claim or fake a writable surface implementation. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Surface adapters and external observation snapshots”.
- [ ] **SURF-005** — Repository-local surface rollout MUST begin with filesystem, Git, workspace/package manifests, and the minimal JavaScript/TypeScript structure required by the first vertical slice, then proceed to broader TypeScript/JavaScript, structured data, Markdown, and GitHub Actions in that order. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Initial repository-local surfaces”.
- [ ] **SURF-006** — Every external observation MUST be captured in a timestamped, adapter-versioned observation revision. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “External snapshots”.
- [ ] **SURF-007** — A semantic transaction requiring deterministic comparison MUST pin a specific external snapshot digest in `StateDigest`. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “External snapshots”.
- [ ] **SURF-008** — Refreshing a remote service MUST create a new observation revision and MAY invalidate dependent plans and derivations. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “External snapshots”.
- [ ] **SURF-009** — Live external state MUST NOT be silently included in a local rebuild. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “External snapshots”.
- [ ] **SURF-010** — An unavailable required surface MUST become an explicit frontier/manual action. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Unavailable and open-world surfaces”.
- [ ] **SURF-011** — Open or sampled surfaces MUST state their blind spots and MAY provide drift evidence, but MUST NOT permit `proven-within-boundary` for claims that depend on full enumeration. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Unavailable and open-world surfaces”.

### Persistence, revisions, and upgrades

- [ ] **PERS-001** — Derived SQLite state MUST include these logical tables: `entities`, `requirements`, `behavioral_scenarios`, `relations`, `semantic_identity_resolutions`, `relevance_closures`, `planning_surprises`, `lineage/tombstones`, `evidence`, `artifacts`, `projection_units`, `derivations` and `derivation inputs`, `signature profiles/results`, `selector matches` and `dependency keys`, `rule matches/bundles`, `divergences`, `runs`, `plans/packets`, `validations`, `model inference artifacts`, `analyzer capability/failure records`, `external observation snapshots`, and `transaction journal` and `writer leases`. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “SQLite is derived state”.
- [ ] **PERS-002** — Fine-grained canonical files MUST remain authoritative for authored/governance state, while SQLite MUST index those files into the logical graph for queries. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “SQLite is derived state”.
- [ ] **PERS-003** — No query path MAY require a monolithic canonical model document. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “SQLite is derived state”.
- [ ] **PERS-004** — Every successful semantic/indexing transaction MUST increment a graph revision for diagnostics and snapshot consistency. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Graph revision”.
- [ ] **PERS-005** — Global revision MUST NOT be the primary cache key for selector/rule applicability or the sole stale-plan criterion; dependency fingerprints and `StateBinding` dependencies MUST serve those purposes. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Graph revision”.
- [ ] **PERS-006** — A run MUST read one consistent revision and MUST promote a new revision atomically within SQLite only after the surrounding semantic transaction reaches the appropriate journal phase. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Graph revision”.
- [ ] **PERS-007** — The canonical rebuild test MUST save a fixed repository/Git snapshot and, when used, a pinned external snapshot; delete `state.db` and caches; reload canonical `.projector/` state; and run analyzers under identical adapter, signature-profile, and toolchain versions. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical rebuild invariant”.
- [ ] **PERS-008** — The canonical rebuild test MUST yield semantically equivalent authored-index state—including Concepts, Requirements, Behavioral Scenarios, and Relations—plus deterministic observations, lens memberships, effective rules, derivations, divergences, and coverage. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical rebuild invariant”.
- [ ] **PERS-009** — The canonical rebuild comparison MUST ignore only explicitly volatile operational fields and MUST characterize its oracle as derived-state consistency rather than independent software correctness. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical rebuild invariant”.
- [ ] **PERS-010** — Projector upgrades MUST separately version and migrate the SQLite schema, canonical file schemas, analyzer semantics, semantic-signature profiles, rule/predicate kernel versions, and host/surface capability contracts. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical schema and engine upgrades”.
- [ ] **PERS-011** — Every Projector upgrade MUST declare whether it requires reindex, selector rematch, authority reconsideration, derivation invalidation, or clean verification. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical schema and engine upgrades”.
- [ ] **PERS-012** — Old derivation proofs MUST NOT silently survive an incompatible analyzer, signature-profile, or engine-semantic change. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical schema and engine upgrades”.
- [ ] **PERS-013** — Canonical migrations MUST be previewable and deterministic; a failed migration MUST leave the previous canonical state recoverable. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Canonical schema and engine upgrades”.

### Observation and analyzers

- [ ] **OBSV-001** — Initialization MUST preserve this stage order: Inventory; Deterministic indexing; Structural clustering; Relationship extraction; Semantic classifications; Pattern Candidates; Authority evaluation; Historical/metamorphic checks; Candidate/shadow lenses; Coverage plus proof boundary; Divergence report; Cleanup plan. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Observation, analyzer capabilities, and initialization pipeline”.
- [ ] **OBSV-002** — Every analyzer MUST declare `AnalyzerCapabilities` covering semantic features it can prove, enumeration class, blind spots, adapter version, and whether it executes repository code. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”.
- [ ] **OBSV-003** — Observation MUST be no-exec by default; package scripts, build tools, generated-code commands, or tests MUST run only under explicit declared validator/command policy. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”.
- [ ] **OBSV-004** — Analyzer output MUST include deterministic observations and capability/failure records. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”.
- [ ] **OBSV-005** — Partial analyzer failure MUST preserve unaffected observations and MUST widen only conclusions dependent on the failure. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”.
- [ ] **OBSV-006** — Deterministic inventory SHOULD discover, without executing repository code where possible, packages/workspaces, source roots/languages, manifests/lockfiles, build/test declarations, scripts, generated markers, CI/infrastructure files, docs, ownership/instruction files as untrusted data, deployment manifests, and Git metadata. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Deterministic inventory”.
- [ ] **OBSV-007** — Ownership and instruction files discovered during deterministic inventory MUST be treated as untrusted data. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Deterministic inventory”.
- [ ] **OBSV-008** — When the TypeScript/JavaScript adapter is implemented, it MUST preserve declarations, exports/imports, call/type relationships, test pairings, source locations, stable symbol anchors, structural hashes, public-interface semantic signatures/hashes, and derivable producer/consumer edges for event/contract relevance rather than reducing them to generic file observations. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-009** — When a structured-data adapter is implemented, it MUST preserve stable JSON Pointer/YAML/TOML path units with source locations where parser support permits; recognized schema/contract references SHOULD yield typed producer/consumer or verification relationships. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-010** — When a Markdown adapter is implemented, it MUST preserve stable section units plus code/reference links rather than reducing them to generic file observations. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-011** — When a GitHub Actions adapter is implemented, it MUST preserve workflow/job units, job dependencies, permissions, inputs/outputs, and path filters rather than reducing them to generic file observations. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-012** — When the Git adapter is implemented, it MUST preserve renames, introduction commits, co-change, copy/move clues, and migration-direction clues rather than reducing them to generic file observations. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-013** — Formatting-only changes SHOULD NOT perturb semantic signatures when the declared signature profile excludes formatting. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-014** — Unsupported syntax or unresolved module references MUST explicitly degrade the affected capability and MUST NOT abort unrelated analysis. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Required semantic analyzer outputs”.
- [ ] **OBSV-015** — Analyzer rollout MUST follow this vertical-slice order: (1) filesystem/Git/package facts and minimal JS role features for the misplaced-script scenario; (2) semantic-signature/backdating support for the API scenario; (3) broader TypeScript/JavaScript indexing; (4) structured data; (5) Markdown; (6) GitHub Actions; (7) additional language/surface adapters only as justified. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer rollout”.
- [ ] **OBSV-016** — Structural clustering MAY use semantic-role features, AST shape, path/naming, dependency neighborhood, test relation, package position, co-change history, docs references, and generated lineage. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Structural clustering”.
- [ ] **OBSV-017** — Structural clustering MUST retain outliers and MUST group generated copies causally rather than counting them as independent votes. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Structural clustering”.
- [ ] **MODEL-016** — Models SHOULD receive bounded evidence/graph neighborhoods rather than unrestricted repository content. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Model inference input”.
- [ ] **MODEL-017** — Identity-resolution and relevance programs MUST receive the smallest neighborhood sufficient to compare candidates or probe missing edges. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Model inference input”.
- [ ] **MODEL-018** — Inference artifacts MUST include proposed identity/type, included and excluded entities or units, alternatives, confidence, provenance, and discriminating missing evidence. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Model inference input”.
- [ ] **MODEL-019** — Model-context construction MUST remove sensitive values before serialization; post-receipt log redaction MUST NOT be treated as sufficient protection. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Model inference input”.

### Historical evaluation and research

- [ ] **EVOL-008** — Before an inferred lens becomes active enforcement, Projector SHOULD evaluate it against repository history and generated perturbations where feasible. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-009** — Historical/metamorphic lens evaluation SHOULD examine independent persistence of candidate examples, later equivalent fixes to flagged divergences, co-change of related artifacts, migration direction, common ancestry/copying, tests/incidents favoring alternatives, rejection of intentional variants, and behavior on mutation-generated nearby cases. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-010** — Historical evaluation MUST distinguish exogenous evidence from Projector-endogenous changes; a migration caused by Lens X MUST NOT later count as independent historical support for Lens X. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-011** — Repeated historical/co-change relationships MAY seed only the `possible` band of Relevance Closure when they repeatedly connect semantic neighborhoods that deterministic topology does not explain. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-012** — Historical/co-change evidence MUST remain contextual/inferred; co-change alone MUST NOT become an exact dependency, Impact Rule, or authority claim. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-013** — Planning Surprises SHOULD be treated as stronger feedback than co-change when actual implementation repeatedly confirms the same omitted relationship. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-014** — Shadow-lens evaluation SHOULD report true positives, intentional variants incorrectly flagged, prior defects it might have prevented, transform applicability, and false-positive behavior. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **EVOL-015** — Historical evaluation reports MUST pair small-sample percentages with counts and uncertainty and MUST NOT present them as stable rates. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- [ ] **RSCH-001** — External research MUST trigger when a pattern may become normative; an active Architecture Concern has a material technology/platform/toolchain decision whose viable options depend on current external facts; an accepted decision fires an evidence-refresh trigger; alternatives materially differ; modernization is proposed; platform constraints are uncertain; security/support status matters; or local evidence is contradictory. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.
- [ ] **RSCH-002** — Research MUST remain concern-scoped and MUST NOT become a periodic repository-wide best-practices crawl. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.
- [ ] **RSCH-003** — Current evidence refresh MUST update only decisions whose material basis changed. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.
- [ ] **RSCH-004** — Research sources MUST be prioritized in this order: official documentation/specification; formal standards; maintained first-party reference architectures; primary research; mature reference implementations; high-quality engineering reports; secondary commentary. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.
- [ ] **RSCH-005** — Every research claim MUST record source locator, capture date, source date/version where available, excerpt hash or concise excerpt, confidence, and applicability. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.
- [ ] **RSCH-006** — Offline mode MUST remain functional and MUST lower authority rather than fabricate rationale. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.


### CLI, Security, Operation, Testing, Evaluation, and Benchmarks


### CLI and execution policy

- [ ] **CLI-001**: The CLI MUST provide `projector init`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-002**: The CLI MUST provide `projector status`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-003**: The CLI MUST provide `projector audit`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-004**: The CLI MUST provide `projector explain <target>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-005**: The CLI MUST provide `projector resolve <meaning-or-target>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-006**: The CLI MUST provide `projector relevance <intent-or-target>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-007**: The CLI MUST provide `projector requirements [<selector>]`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-008**: The CLI MUST provide `projector scenarios [<selector>]`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-009**: The CLI MUST provide `projector context --task <task>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-010**: The CLI MUST provide `projector impact <change-or-target>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-011**: The CLI MUST provide `projector coverage`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-012**: The CLI MUST provide `projector complete`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-013**: The CLI MUST provide `projector reconcile`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-014**: The CLI MUST provide `projector verify`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-015**: The CLI MUST provide `projector verify --clean`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-016**: The CLI MUST provide `projector change <intent>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-017**: The CLI MUST provide `projector plan <change>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-018**: The CLI MUST provide `projector plan rebase <plan>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-019**: The CLI MUST provide `projector apply <plan>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-020**: The CLI MUST provide `projector recover`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-021**: The CLI MUST provide `projector upgrade`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-022**: The CLI MUST provide the `projector exception ...` command family. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-023**: The CLI MUST provide the `projector lens ...` command family. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-024**: The CLI MUST provide the `projector rule ...` command family. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-025**: The CLI MUST provide `projector concerns`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-026**: The CLI MUST provide `projector decisions`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-027**: The CLI MUST provide `projector decision explain <id>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-028**: The CLI MUST provide `projector decision resolve <concern-id>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-029**: The CLI MUST provide `projector preferences`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-030**: The CLI MUST provide `projector preference adopt <key>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-031**: The CLI MUST provide `projector run codex -- ...`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-032**: The CLI MUST provide `projector run claude -- ...`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-033**: The CLI MUST provide `projector mcp`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-034**: The CLI MUST provide `projector ci`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-035**: The CLI MUST provide `projector watch`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-036**: Friendly flags MAY include `--format text|json|md|sarif`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-037**: Friendly flags MAY include `--mode observe|guide|govern|autonomous|salvage`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-038**: Friendly flags MAY include `--audit-only`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-039**: Friendly flags MAY include `--scope <selector>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-040**: Friendly flags MAY include `--non-interactive`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-041**: Friendly flags MAY include `--offline`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-042**: Friendly flags MAY include `--dry-run`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-043**: Friendly flags MAY include `--budget-tokens <n>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-044**: Friendly flags MAY include `--budget-cost <amount>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-045**: Friendly flags MAY include `--confidence-threshold <0..1>`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-046**: Friendly flags MAY include `--verbose`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-047**: Before work starts, every command and flag MUST normalize to one internal `ExecutionPolicy`; aliases such as `--audit-only` MUST map to equivalent policy fields. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-048**: Contradictory flags MUST be rejected. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-049**: Exit code `0` MUST mean success / no blocking findings. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-050**: Exit code `1` MUST mean command failure. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-051**: Exit code `2` MUST mean blocking divergence/invariant/governance failure. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-052**: Exit code `3` MUST mean approval required. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-053**: Exit code `4` MUST mean incomplete coverage under requested strictness. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-054**: Exit code `5` MUST mean required surface unavailable. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-055**: Exit code `6` MUST mean rebuild/nondeterminism/corruption/recovery failure. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.
- [ ] **CLI-056**: Exit code `7` MUST mean budget exhausted with resumable state. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`.

### Operating modes

- [ ] **MODE-001**: Modes MUST be friendly presets over `ExecutionPolicy` and MUST NOT create separate semantic behavior. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Operating-mode presets`.
- [ ] **MODE-002**: Observe mode MUST permit read-only inference/reporting and MUST NOT mutate the repository or canonical state. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Observe`.
- [ ] **MODE-003**: Guide mode MUST compile context, warn, reconcile, and offer plans; only immutable safety boundaries may block. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Guide`.
- [ ] **MODE-004**: Guide mode MUST be the default after `init`. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Guide`.
- [ ] **MODE-005**: Govern mode MUST block representable hard invariant violations. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Govern`.
- [ ] **MODE-006**: Govern mode MUST block unapproved write-scope expansion. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Govern`.
- [ ] **MODE-007**: Govern mode MUST block stale-state execution. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Govern`.
- [ ] **MODE-008**: Govern mode MUST block completion with unexplained governed changes. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Govern`.
- [ ] **MODE-009**: Autonomous mode MUST execute policy-authorized, state-bound plans only until completion, ambiguity, verification failure, budget, risk ceiling, or approval boundary. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Autonomous`.
- [ ] **MODE-010**: Salvage mode MUST be a deep reconstruction/modernization preset with a larger inference/research budget and worktree isolation. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Salvage`.
- [ ] **MODE-011**: Salvage mode MUST NOT weaken approval or proof requirements because a repository is messy. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Salvage`.
- [ ] **MODE-012**: Changing mode MUST NOT change what Projector believes the repository means; it changes only what actions are permitted automatically. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Salvage`.

### Security, paths, commands, and authorization

- [ ] **SEC-001**: Security controls MUST apply from initialization, not only during agent execution. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Security, path safety, and trust boundaries`.
- [ ] **SEC-002**: Repository docs/comments, commit messages, issue text, model output, package metadata, web pages, and external records MUST be treated as data and MUST NOT grant tools, alter policy, authorize writes, or override system/developer instructions through their content. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Untrusted content`.
- [ ] **SEC-003**: Sensitive values MUST be removed or replaced with typed placeholders before model-context construction. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Sensitive data`.
- [ ] **SEC-004**: Sensitive values MUST be removed or replaced with typed placeholders before model-assisted representation rendering. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Sensitive data`.
- [ ] **SEC-005**: Logs and certificates MUST redact secrets; post-hoc log redaction MUST NOT substitute for preventing model disclosure. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Sensitive data`.
- [ ] **SEC-006**: Canonical repository paths MUST be POSIX-style relative paths. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-007**: Every filesystem operation MUST resolve through a root-constrained path utility that rejects `..` escapes after normalization. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-008**: The root-constrained path utility MUST validate drive/UNC semantics on Windows. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-009**: The root-constrained path utility MUST resolve symlinks according to explicit policy. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-010**: The root-constrained path utility MUST prevent writes through symlinks outside the governed root. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-011**: The root-constrained path utility MUST record the real target for safety checks. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-012**: The root-constrained path utility MUST treat case sensitivity according to the actual filesystem. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`.
- [ ] **SEC-013**: Command execution MUST use explicit argv arrays where possible. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-014**: Command execution MUST NOT shell-interpolate untrusted values. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-015**: Command execution MUST declare cwd and read/write scope. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-016**: Command execution MUST declare network/environment keys. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-017**: Command execution MUST have a timeout/resource budget. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-018**: Command side-effect class MUST be included in risk. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-019**: Mutation MUST normally require Git; mutation without Git is allowed only when `--unsafe-no-git` is explicitly provided. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`.
- [ ] **SEC-020**: An external write MUST require both adapter capability and plan-bound approval/capability. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-021**: R3 and R4 external writes MUST default to explicit approval. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-022**: R4 MUST never be autonomous in 1.x. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-023**: Failed validations MUST NOT auto-merge worktrees. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-024**: Remote transform packages MUST be disabled by default. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-025**: Installed transforms MUST record version, hash, and permission requirements. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`.
- [ ] **SEC-026**: Approval, Execution Capsule, MCP capability, and Work Packet bindings MUST expire when a dependency in their `StateBinding` changes. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## State-bound authorization`.
- [ ] **SEC-027**: Approval, Execution Capsule, MCP capability, and Work Packet bindings MUST expire when Projector cannot prove a query dependency unchanged. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## State-bound authorization`.
- [ ] **SEC-028**: A changed global `StateDigest` MUST trigger binding validation and MUST NOT cause automatic invalidation by itself. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## State-bound authorization`.
- [ ] **SEC-029**: A stale approval MUST NOT be replayed against materially different relevant state. Source: `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## State-bound authorization`.

### Observability and economics

- [ ] **METR-001**: Every run MUST record the command and resolved `ExecutionPolicy`. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-002**: Every run MUST record the canonical config digest. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-003**: Every run MUST record engine/toolchain versions. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-004**: Every run MUST record Git, worktree, and canonical state digests. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-005**: Every run MUST record graph revision. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-006**: Every run MUST record analyzers and capability failures. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-007**: Every run MUST record model calls, purpose, cache/replay status, and token/cost metadata where available. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-008**: Every run MUST record external snapshot IDs. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-009**: Every run MUST record decisions and authority changes. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-010**: Every run MUST record transforms/agent operations. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-011**: Every run MUST record validations and evidence lanes. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-012**: Every run MUST record transaction journal/recovery events. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-013**: Every run MUST record duration and errors. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-014**: Projector MUST track deterministic compute. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-015**: Projector MUST track selector/rule/derivation cache hit rate. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-016**: Projector MUST track semantic backdating hit rate by assurance class. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-017**: Projector MUST track invalidation fan-out and frontier size. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-018**: Projector MUST track semantic-identity resolution candidate count, reuse/create/split rates, and later duplicate/overlap findings. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-019**: Projector MUST track relevance recall/irrelevant-expansion on evaluated changes. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-020**: Projector MUST track direct/governing/consequence/possible context-band sizes. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-021**: Projector MUST track planning-surprise rate and accepted learned relationships. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-022**: Projector MUST track context tokens versus relevant-subgraph size versus repository size. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-023**: Projector MUST track tokens per accepted semantic change. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-024**: Projector MUST track deterministic mutation percentage. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-025**: Projector MUST track repeated-change marginal cost. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-026**: Projector MUST track downstream work avoided by exact/validated equality. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-027**: Projector MUST track transaction rollback/recovery rate. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-028**: Projector MUST track analyzer failure rate. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-029**: Projector MUST track model inference reuse rate. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-030**: Projector MUST track source versus projected context tokens by Representation Profile. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-031**: Projector MUST track representation-profile overhead tokens and net token delta. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-032**: Projector MUST track representation fallback/rejection rate. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-033**: Projector MUST track protected-dimension fidelity failures by category. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-034**: Projector MUST track task/conformance outcome deltas for compact versus uncompressed context on benchmarked workloads. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-035**: Projector MUST measure active concept count. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-036**: Projector MUST measure active lens/rule count. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-037**: Projector MUST measure exceptions per lens/rule. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-038**: Projector MUST measure average rule pressure per unit. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-039**: Projector MUST measure canonical-state churn. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-040**: Projector MUST measure model-maintenance time/cost. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-041**: Projector MUST measure the number of governance entities removed by simplification. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-042**: For representation optimization, Projector SHOULD report **Instruction Efficiency** only with an explicit workload-specific numerator, such as validated task success, passed conformance obligations, or accepted semantic changes. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-043**: When reported, instruction efficiency SHOULD compare `validated behavioral/conformance utility / total instruction/context tokens consumed (including representation overhead and retries)`. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-044**: Instruction Efficiency MUST NOT reward shorter output that loses required semantic content; correctness/preservation MUST be a constraint before token optimization and MUST NOT be traded to zero. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.
- [ ] **METR-045**: Semantic-model optimization MUST target lower marginal reasoning/review cost at acceptable correctness, not maximum modeling; a semantic model that grows faster than the use it creates MUST be treated as technical debt. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`.

### Reporting

- [ ] **OPER-001**: Reports MUST support terminal format. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-002**: Reports MUST support JSON format. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-003**: Reports MUST support Markdown format. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-004**: Reports MUST support SARIF for findings/CI where practical. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-005**: Every report finding MUST answer what happened. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-006**: Every report finding MUST answer what semantic role was inferred. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-007**: Every report finding MUST identify which canonical identity was resolved or explain why a new one is justified. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-008**: When reporting a change, every report finding MUST explain why the item entered the relevant subgraph. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-009**: Every report finding MUST identify which lens/rules apply. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-010**: Every report finding MUST explain why the item is anomalous. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-011**: Every report finding MUST provide evidence and counterevidence. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-012**: Every report finding MUST provide confidence. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-013**: Every report finding MUST provide the smallest safe repair. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-014**: When applicable, every report finding MUST provide Relevance Closure and affected Impact Closure without conflating them. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-015**: Every report finding MUST provide any predicted-versus-observed Planning Surprise. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-016**: Every report finding MUST provide the deferral consequence. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-017**: When material, every report finding MUST provide the applicable architecture concern/decision chain. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-018**: Every report finding MUST explain why relevant existing decisions were or were not reconsidered. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-019**: Every report finding MUST state material preference influences on a recommendation. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- [ ] **OPER-020**: Every report finding MUST state its coverage caveat. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.

### Unit and property testing

- [ ] **TEST-001**: Testing MUST attack both implementation bugs and Projector's ability to become confidently self-consistent while wrong. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Testing and adversarial evaluation strategy`.
- [ ] **TEST-002**: Unit tests MUST cover canonical serialization and schema-defined semantic hashing. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-003**: Unit tests MUST cover stable IDs, aliases, lineage, and tombstones. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-004**: Unit tests MUST cover fine-grained canonical semantic persistence and deterministic project-root digest construction. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-005**: Unit tests MUST cover Requirement and Behavioral Scenario contracts and semantic hashing. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-006**: Unit tests MUST cover Semantic Identity Resolution candidate ranking/outcome validation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-007**: Unit tests MUST cover Relevance Closure expansion, banding, provenance, budget termination, and dependency fingerprints. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-008**: Unit tests MUST cover Analysis Facet activation without accidental governance. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-009**: Unit tests MUST cover canonical schema migration. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-010**: Unit tests MUST cover Zod/public-contract registry completeness. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-011**: Unit tests MUST cover selectors and dependency-keyed cache invalidation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-012**: Unit tests MUST cover typed rule predicate composition/conflicts. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-013**: Unit tests MUST cover lens overlap/composition. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-014**: Unit tests MUST cover authority independence and reconsideration triggers. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-015**: Unit tests MUST cover Architecture Concern materiality, promotion, and causal deduplication. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-016**: Unit tests MUST cover scope-specific Decision Validity Assessment. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-017**: Unit tests MUST cover decision overlap/SCC convergence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-018**: Unit tests MUST cover preference scope/composition and non-blocking type semantics. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-019**: Unit tests MUST cover research freshness policy and current-option verification. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-020**: Unit tests MUST cover decision consequence atomicity and deferral contracts. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-021**: Unit tests MUST cover semantic-signature assurance. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-022**: Unit tests MUST cover derivations/SCCs/backdating. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-023**: Unit tests MUST cover Impact Rules and frontier widening. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-024**: Unit tests MUST cover strict separation of pre-change Relevance Closure from post-delta Impact Closure. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-025**: Unit tests MUST cover dependency-scoped `StateBinding` validation/rebinding after unrelated root changes. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-026**: Unit tests MUST cover predicted-versus-observed impact comparison and Planning Surprise classification. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-027**: Unit tests MUST cover transaction journal/recovery. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-028**: Unit tests MUST cover risk/policy normalization. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-029**: Unit tests MUST cover transform routing and upstream generated repair. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-030**: Unit tests MUST cover coverage proof rules. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-031**: Unit tests MUST cover plan rebase. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-032**: Unit tests MUST cover receipts/certificates. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-033**: Unit tests MUST cover Semantic Representation Profile compilation and canonical rebuild. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-034**: Unit tests MUST cover Semantic Preservation Fingerprints across normative force, negation, cardinality, logical connectives, conditions, exceptions, scope, order/dependencies, behavioral step roles, and literals. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-035**: Unit tests MUST cover the separation of controlled-technical style linting from semantic-fidelity validation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-036**: Unit tests MUST cover tokenizer/profile overhead accounting and fallback selection. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`.
- [ ] **TEST-037**: Property-based tests MUST prove canonical serialization is independent of object insertion order. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-038**: Property-based tests MUST prove splitting canonical entities into independent files does not alter semantic project-root identity. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-039**: Property-based tests MUST prove unrelated canonical/worktree changes do not invalidate a `StateBinding` whose value dependencies and query-result fingerprints remain unchanged. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-040**: Property-based tests MUST prove adding/changing a bound value dependency always invalidates or revalidates the affected binding. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-041**: Property-based tests MUST prove adding an entity/Relation/membership that changes a bound query result invalidates/revalidates the binding even when every previously returned entity hash is unchanged. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-042**: Property-based tests MUST prove changing a `StateQuerySpec` program/version or closure-sensitive result projection invalidates the corresponding query dependency. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-043**: Property-based tests MUST prove an empty query on an open/sampled/unavailable lane never upgrades a negative-space claim to proof. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-044**: Property-based tests MUST prove stable semantic hash excludes declared volatile metadata. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-045**: Property-based tests MUST prove deterministic derived IDs are stable across repeated indexing. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-046**: Property-based tests MUST prove hard-rule composition is order-independent. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-047**: Property-based tests MUST prove selector/lens/rule applicability is deterministic for fixed dependencies. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-048**: Property-based tests MUST prove lowering evidence/coverage cannot produce a stronger completion claim. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-049**: Property-based tests MUST prove increasing uncertainty cannot lower approval/risk requirements. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-050**: Property-based tests MUST prove idempotent transforms converge. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-051**: Property-based tests MUST prove exact reverse derivation dependencies are never lost. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-052**: Property-based tests MUST prove Relevance Closure never gains exact-impact authority merely from semantic-similarity score. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-053**: Property-based tests MUST prove identity-resolution renames/aliases cannot create a second identity for the same selected entity. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-054**: Property-based tests MUST prove alias/name-only changes alter discovery/canonical-document hashes but not semantic meaning hashes, and therefore refresh affected identity/relevance queries without staling meaning-only derivations. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-055**: Property-based tests MUST prove SCC invalidation/backdating reaches the same fixed point as a clean group recomputation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-056**: Property-based tests MUST prove reconciliation terminates or emits an explicit non-convergence failure. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-057**: Property-based tests MUST prove rollback restores fixture-supported physical and canonical state. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-058**: Property-based tests MUST prove rebuilding SQLite from canonical inputs preserves semantic state. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-059**: Property-based tests MUST prove a Projector-caused conforming occurrence never becomes independent support for its causal lens/rule. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-060**: Property-based tests MUST prove changing only a Representation Profile never changes canonical semantic hashes of its source entities. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-061**: Property-based tests MUST prove a Representation Projection cannot validate when any required protected-dimension fingerprint differs. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-062**: Property-based tests MUST prove reducing text/token count cannot strengthen a fidelity/completion claim. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.
- [ ] **TEST-063**: Property-based tests MUST prove profile selection is deterministic for fixed inputs, tokenizer profile, policy, and measured cost model. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`.

### Fixtures, adversarial tests, hosts, and live evaluation

- [ ] **EVAL-048**: Training/development fixtures MUST include `clean-monorepo`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-049**: Training/development fixtures MUST include `slop-monorepo`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-050**: Training/development fixtures MUST include `incomplete-refactor`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-051**: Training/development fixtures MUST include `copied-slop`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-052**: Training/development fixtures MUST include `cross-platform-product`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-053**: Training/development fixtures MUST include `external-surfaces`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-054**: Training/development fixtures MUST include `selector-membership`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-055**: Training/development fixtures MUST include `semantic-backdating`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-056**: Training/development fixtures MUST include `governance-cycle`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-057**: Training/development fixtures MUST include `transaction-crash`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-058**: Training/development fixtures MUST include `multiple-valid-implementations`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-059**: Training/development fixtures MUST include `generated-upstream`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-060**: Training/development fixtures MUST include `representation-semantic-drift`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-061**: Training/development fixtures MUST include `representation-token-economics`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-062**: Training/development fixtures MUST include `semantic-identity-overlap`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-063**: Training/development fixtures MUST include `cross-cutting-relevance`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-064**: Training/development fixtures MUST include `event-contract-relevance`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-065**: Training/development fixtures MUST include `scoped-state-binding`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-066**: Training/development fixtures MUST include `planning-surprise`. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-002**: Projector MUST maintain held-out fixture repositories and mutation-generated variants whose exact anomalies are not encoded as one-off detectors. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-003**: Release metrics MUST include held-out performance. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`.
- [ ] **EVAL-004**: Adversarial tests MUST cover canonical rebuild closure. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-005**: Adversarial tests MUST cover semantic-signature insufficiency. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-006**: Adversarial tests MUST cover a shared analyzer bug fooling both incremental and rebuild paths. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-007**: Adversarial tests MUST cover a crash at every semantic transaction phase. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-008**: Adversarial tests MUST cover branch/merge canonical-governance conflict. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-009**: Adversarial tests MUST cover Projector-endogenous authority evidence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-010**: Adversarial tests MUST cover governance cycle and non-convergence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-011**: Adversarial tests MUST cover open-world completeness refusal. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-012**: Adversarial tests MUST cover multiple valid handwritten implementations. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-013**: Adversarial tests MUST cover SCC backdating. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-014**: Adversarial tests MUST cover model resampling/idempotence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-015**: Adversarial tests MUST cover correlated/self-authored validator evidence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-016**: Adversarial tests MUST cover generated-output upstream repair. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-017**: Adversarial tests MUST cover localized cache performance. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-018**: Adversarial tests MUST cover Projector engine/signature-profile upgrade invalidation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-019**: Adversarial tests MUST cover misleading local precedent. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-020**: Adversarial tests MUST cover mutation-generated near misses. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-021**: Adversarial tests MUST cover unsupported analyzer capability degradation. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-022**: Adversarial tests MUST cover semantic identity duplicate/overlap creation under synonymous requests. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-023**: Adversarial tests MUST cover cross-cutting governing semantics hidden outside the touched package. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-024**: Adversarial tests MUST cover Relevance over-expansion returning effectively project-wide context. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-025**: Adversarial tests MUST cover event/contract consumer omission despite deterministic topology. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-026**: Adversarial tests MUST cover unrelated root-state mutation incorrectly staling scoped work. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-027**: Adversarial tests MUST cover a missing `StateBinding` value dependency incorrectly preserving stale work. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-028**: Adversarial tests MUST cover a missing negative-space/query dependency incorrectly preserving stale relevance after a newly matching entity/edge appears. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-029**: Adversarial tests MUST cover query-program/version drift silently preserving an old result fingerprint. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-030**: Adversarial tests MUST cover an open/sampled discovery lane incorrectly proving absence. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-031**: Adversarial tests MUST cover predicted-versus-observed impact surprise and relationship learning. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-032**: Adversarial tests MUST cover Representation modal/negation/cardinality/logical-connective/condition/exception drift. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-033**: Adversarial tests MUST cover token compression that passes style lint while changing semantics. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-034**: Adversarial tests MUST cover net-negative representation overhead and fallback selection. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-035**: Adversarial tests MUST cover human/agent/machine/Gherkin projections with different text but one canonical semantic source. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`.
- [ ] **EVAL-036**: Host tests MUST use fake host processes and golden capability/packet/context outputs. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-037**: Default tests MUST NOT require paid models or installed Codex/Claude hosts. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-038**: Host tests MUST test stale dependency-bound capability rejection. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-039**: Host tests MUST test safe rebinding after unrelated root changes. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-040**: Host tests MUST test out-of-scope write detection. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-041**: Host tests MUST test interrupted session recovery. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-042**: Host tests MUST test direct host writes observed outside Projector tools. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`.
- [ ] **EVAL-043**: Live-model/provider evaluation MUST be opt-in. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`.
- [ ] **EVAL-044**: Live-model/provider evaluation MUST be budgeted. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`.
- [ ] **EVAL-045**: Live-model/provider evaluation MUST be reproducible at the input/program/schema level. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`.
- [ ] **EVAL-046**: Live-model/provider evaluation MUST be graded structurally. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`.
- [ ] **EVAL-047**: Live-model/provider evaluation MUST NOT be the only test for semantic behavior. Source: `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`.

### Benchmarks and release gates

- [ ] **BENCH-001**: Release benchmarks MUST measure semantic-identity reuse/create/split accuracy and duplicate/overlap prevention. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-002**: Release benchmarks MUST measure known-relevant semantic entity recall during pre-change discovery. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-003**: Release benchmarks MUST measure irrelevant relevance-context expansion. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-004**: Release benchmarks MUST measure required-change recall. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-005**: Release benchmarks MUST measure irrelevant blast-radius expansion. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-006**: Release benchmarks MUST measure divergence precision/recall. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-007**: Release benchmarks MUST measure secondary projection omissions. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-008**: Release benchmarks MUST measure deterministic event/contract consumer omissions. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-009**: Release benchmarks MUST measure Planning Surprise rate attributable to missed relevance. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-010**: Release benchmarks MUST measure accepted learned-relationship precision. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-011**: Release benchmarks MUST measure intentional-variant false-positive rate. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-012**: Release benchmarks MUST measure pattern violations introduced. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-013**: Release benchmarks MUST measure human review time. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-014**: Release benchmarks MUST measure deterministic mutation percentage. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-015**: Release benchmarks MUST measure model tokens/cost. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-016**: Release benchmarks MUST measure context-size reduction relative to both repository size and full semantic-graph size. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-017**: Release benchmarks MUST measure direct/governing/consequence/possible band distribution. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-018**: Release benchmarks MUST measure scoped-`StateBinding` false-stale and false-current rates. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-019**: Release benchmarks MUST measure clean-vs-incremental agreement. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-020**: Release benchmarks MUST measure independent-validation coverage. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-021**: Release benchmarks MUST measure receipt/certificate accuracy. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-022**: Release benchmarks MUST measure repeated-change marginal cost. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-023**: Release benchmarks MUST measure recovery from deliberate agent slop. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-024**: Release benchmarks MUST measure transaction recovery success. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-025**: Release benchmarks MUST measure exact/validated versus heuristic backdating rates. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-026**: Release benchmarks MUST measure semantic-model complexity/churn. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-027**: Release benchmarks MUST measure held-out repository generalization. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-028**: Release benchmarks MUST measure protected-dimension representation fidelity. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-029**: Release benchmarks MUST measure representation compression ratio and net token savings after profile overhead. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-030**: Release benchmarks MUST measure compact-context task/conformance delta versus uncompressed/human-technical baselines. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-031**: Release benchmarks MUST measure workload-scoped instruction efficiency. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-032**: The initial engineering gate MUST achieve `>=95%` recall on fixture-known required refactor surfaces where the relevant dependency lanes are closed/bounded. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-033**: The initial engineering gate MUST achieve `>=95%` recall of fixture-known governing semantic entities for supported change classes on held-out/high-coverage fixtures. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-034**: The initial engineering gate MUST keep irrelevant impact expansion `<10%` on high-coverage local fixtures. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-035**: The initial engineering gate MUST keep irrelevant semantic-context expansion `<20%` on relevance fixtures after excluding explicitly requested possible-band exploration. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-036**: The initial engineering gate MUST produce zero seeded duplicate canonical identities when an existing identity owns the synonymous requested behavior. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-037**: The initial engineering gate MUST achieve a `>=50%` deterministic mutation rate for supported pattern migrations. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-038**: The initial engineering gate MUST produce zero undetected seeded hard-pattern violations after reconciliation. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-039**: The initial engineering gate MUST achieve a `>=2x` context-size reduction for supported scoped tasks. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-040**: The initial engineering gate MUST produce zero material state-changing output on a second identical reconcile. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-041**: The initial engineering gate MUST produce zero stale-plan/capsule rejection caused solely by an unrelated root-state change when all explicit binding dependencies and bound query-result fingerprints are unchanged. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-042**: The initial engineering gate MUST have zero successful stale binding validations when a required semantic/physical dependency changed. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-043**: The initial engineering gate MUST produce zero false `proven-within-boundary` claims in open/sampled/unavailable fixtures. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-044**: The initial engineering gate MUST achieve 100% recovery or deterministic recovery-required classification for injected transaction crashes. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-045**: The initial engineering gate MUST have no authority-score increase from same-lens Projector-generated conformity. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-046**: The initial engineering gate MUST have no silent preservation of old derivation proof after incompatible engine/signature-profile upgrades. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-047**: The initial engineering gate MUST have zero accepted Representation Projections with a known protected-dimension mismatch. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-048**: Compact agent context MUST NOT be enabled by default when measured profile overhead is net-negative. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-049**: Compact agent context MUST be disabled when measured task/conformance quality materially regresses. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.
- [ ] **BENCH-050**: Broad accuracy claims MUST NOT be based on fixture success alone; held-out/mutation-generated performance MUST be published before making them. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`.

### Kill and redesign criteria

- [ ] **KILL-001**: The semantic-model subsystem or architecture MUST be reconsidered if semantic-model maintenance costs approach or exceed ordinary agent review cost. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-002**: Exact invalidation MUST be reconsidered if high-coverage exact invalidation still misses known dependencies systematically. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-003**: Canonical-state architecture MUST be reconsidered if canonical state cannot rebuild without hidden local history. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-004**: Semantic-signature profiles MUST be reconsidered if they routinely overclaim assurance. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-005**: Independent conformance MUST be reconsidered if it cannot distinguish Projector's own shared bugs. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-006**: Governance MUST be reconsidered if it frequently cycles or requires ad hoc evaluation ordering. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-007**: Branch/canonical collaboration design MUST be reconsidered if conflicts make ordinary collaboration impractical. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-008**: Rule-conflict handling MUST be reconsidered if conflicts require manual prompt surgery. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-009**: The architecture MUST be reconsidered if ordinary repository instructions plus codemods nearly match Projector on held-out benchmarks. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-010**: Execution Capsule design MUST be reconsidered if capsules remain repository-sized or routinely approach full semantic-graph size. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-011**: Relevance Closure design MUST be reconsidered if it requires package-tree duplication of cross-cutting semantics to achieve acceptable recall. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-012**: Semantic identity resolution MUST be reconsidered if it permits recurring synonymous/overlapping canonical entities at rates requiring manual cleanup. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-013**: Scoped state binding MUST be reconsidered if it cannot avoid global false-stale invalidation without unsafe missed dependencies. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-014**: Compact-context profiles MUST be reconsidered if they routinely save tokens only by weakening protected semantics. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-015**: Representation profiles MUST be reconsidered if their overhead is net-negative on workloads where they are enabled. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-016**: Compressed context MUST be reconsidered if it materially reduces task/conformance success compared with the source representation. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-017**: Authority design MUST be reconsidered if authority becomes dominated by Projector-endogenous evidence. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-018**: Divergence detection MUST be reconsidered if precision is too low to remain actionable. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-019**: Generated-output repair MUST be reconsidered if generated outputs routinely require forbidden direct patches. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-020**: Transaction recovery MUST be reconsidered if it cannot guarantee an honest state after interruption. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-021**: Adoption design MUST be reconsidered if adoption requires manual ontology authoring. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-022**: The semantic model/rule architecture MUST be reconsidered if complexity grows without falling marginal reasoning/review cost. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.
- [ ] **KILL-023**: Kill criteria MUST be treated as design feedback and MUST NOT be hidden by adding more rules. Source: `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`.


### Delivery Slices, Acceptance, Release, Dogfooding, and Handoff


### Delivery method and dependency order

- [ ] **DELV-001** Every implementation slice MUST start with failing fixture or property tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-002** Every slice MUST implement the smallest complete causal loop. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-003** Every slice MUST end with tests, an inspectable diff, and a commit. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-004** A slice MUST NOT add speculative adapters or packages that the slice does not require. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-005** Every slice MUST preserve normative contracts or record an explicit architecture decision that changes them. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-006** Every slice MUST leave the repository governable by the next slice and MUST NOT create throwaway parallel machinery. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Vertical-slice-first delivery”.
- [ ] **DELV-007** Slices 0–12 are committed v1 scope; their sequence expresses dependency order, not optional, future, or v2 scope. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Complete committed scope”.

### Slice 0 — foundation and correctness substrate

- [ ] **SLICE-000** Slice 0 MUST deliver monorepo/package boundaries and a composition root. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 — Foundation and correctness substrate”.
- [ ] **SLICE-001** Slice 0 MUST deliver complete Zod-backed normative contracts needed by early slices, including Requirements, Behavioral Scenarios, fine-grained canonical identity, `StateDigest`, `StateBinding`, `StateQuerySpec`/query-result fingerprints, Semantic Representation Profiles/Projections, and preservation fingerprints. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-002** Slice 0 MUST deliver fine-grained canonical `.projector/model/` storage for Concepts, Requirements, Behavioral Scenarios, Relations, rules, lenses, representations, authorities, decisions, exceptions, migrations, and receipts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-003** Slice 0 MUST derive a deterministic canonical-root digest from independently addressable canonical files. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-004** Slice 0 MUST provide schema-defined semantic hashing and stable identity, aliases, and lineage. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-005** Slice 0 MUST deliver core ports. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-006** Slice 0 MUST deliver a SQLite derived store and migrations. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-007** Slice 0 MUST deliver a transaction journal and writer lease. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-008** Slice 0 MUST deliver a fixture harness. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **SLICE-009** Slice 0 MUST deliver a minimal CLI skeleton. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- [ ] **ACC-000** Slice 0 acceptance MUST prove that all public contract references resolve. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-001** Slice 0 acceptance MUST prove canonical state survives `state.db` deletion and rebuild. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-002** Slice 0 acceptance MUST prove a bounded canonical entity can be loaded and updated without loading or rewriting the full semantic graph. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-003** Slice 0 acceptance MUST prove semantic hashes ignore declared volatile metadata. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-004** Slice 0 acceptance MUST prove the deterministic project-root digest is independent of filesystem enumeration order. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-005** Slice 0 acceptance MUST prove an unrelated canonical-entity change alters the root digest without staling an unrelated dependency-scoped `StateBinding`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-006** Slice 0 acceptance MUST prove a newly matching semantic entity, relation, or membership changes a bound query-result fingerprint and stales the affected binding even when every previously selected entity hash is unchanged. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-007** Slice 0 acceptance MUST prove an `open`, `sampled`, or `unavailable` discovery lane cannot establish a negative-space absence proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-008** Slice 0 acceptance MUST prove the transaction crash harness detects or recovers an interrupted empty/sample transaction. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **ACC-009** Slice 0 acceptance MUST pass the package dependency-direction test. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0 / Acceptance”.
- [ ] **SLICE-010** Broad analyzers MUST NOT be built in Slice 0. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.

### Slice 1 — mandatory misplaced-script causal loop

- [ ] **SLICE-011** Slice 1 MUST implement filesystem inventory. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1 — Mandatory misplaced-script loop from start to finish”.
- [ ] **SLICE-012** Slice 1 MUST implement Git identity and move facts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-013** Slice 1 MUST implement package-script invocation facts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-014** Slice 1 MUST implement minimal JavaScript role/lifecycle features. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-015** Slice 1 MUST implement Projection Units and deterministic anchors. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-016** Slice 1 MUST implement Pattern Candidate inference. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-017** Slice 1 MUST distinguish descriptive evidence from normative authority. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-018** Slice 1 MUST implement a minimal selector and blocking-predicate kernel. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-019** Slice 1 MUST implement candidate and active repository-script lenses. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-020** Slice 1 MUST implement placement and test expectations. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-021** Slice 1 MUST implement a deterministic move/reference transform. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-022** Slice 1 MUST implement a dependency-scoped, state-bound plan/capsule. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-023** Slice 1 MUST implement validators. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-024** Slice 1 MUST implement reconciliation. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **SLICE-025** Slice 1 MUST emit a transaction receipt and certificate. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.
- [ ] **ACC-010** Slice 1 MUST prove Projector rejects misleading path proximity and safely repairs the anomaly. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 1”.

The mandatory fixture contains `.codex/hooks/pre-tool.mjs`, `.codex/hooks/lib/hook-state.mjs`, `.codex/hooks/lib/validate-repo.mjs`, `.codex/hooks/validate-repo.test.mjs`, `scripts/build-index.mjs`, `scripts/build-index.test.mjs`, `scripts/check-links.mjs`, `scripts/check-links.test.mjs`, and `package.json`.

- [ ] **ACC-011** The mandatory fixture MUST establish that `validate-repo.mjs` is invoked directly from package scripts. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice / Facts”.
- [ ] **ACC-012** The fixture MUST establish that `validate-repo.mjs` has no hook lifecycle signature. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-013** The fixture MUST establish that hook code does not import `validate-repo.mjs`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-014** The fixture MUST establish that its test targets repository-automation behavior. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-015** The fixture MUST establish that generic repository scripts have colocated tests under `/scripts`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-016** The fixture MUST establish that hook-private support modules are reachable from hook entrypoints. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-017** The fixture MUST make the misplaced location intentionally misleading local precedent. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Facts”.
- [ ] **ACC-018** Step 1: Projector MUST inventory and classify stable Projection Units without executing the repository. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-019** Step 2: Projector MUST infer descriptive families for repository automation, hook entrypoints, hook-private support, and test colocation. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-020** Step 3: Projector MUST classify `validate-repo.mjs` as repository automation using role, invocation, and dependency evidence stronger than directory proximity. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-021** Step 4: Projector MUST keep Pattern Candidate and normative Lens authority separate. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-022** Step 5: Generated or Projector-repaired occurrences MUST NOT inflate independent authority evidence. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-023** Step 6: Projector MUST compile a minimal active/shadow lens and typed rules sufficient for the scenario. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-024** Step 7: Projector MUST emit placement/test divergences with counterevidence and proof caveats. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-025** Step 8: Projector MUST preview an R1 deterministic move/reference update. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-026** Step 9: Projector MUST bind the plan, capsule, and approval to a dependency-scoped `StateBinding` compiled against a global `StateDigest`. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-027** Step 10: Projector MUST obtain the writer lease and journal the transaction. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-028** Step 11: Projector MUST move the implementation and test and update references and the package script as required. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-029** Step 12: Projector MUST run declared independent-enough validators. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-030** Step 13: Projector MUST reconcile to a fixed point. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-031** Step 14: A second identical reconciliation MUST produce no material delta for this cluster. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-032** Step 15: Projector MUST emit a cleanup plan with no unresolved work for the cluster. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-033** Step 16: Projector MUST emit a compact transaction receipt and a verbose certificate. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **ACC-034** Step 17: Projector MUST prove that deleting and rebuilding `state.db` preserves accepted canonical semantics. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Required result”.
- [ ] **SLICE-026** The mandatory first slice MUST close, in order, observe → classify → infer descriptive pattern → establish bounded authority → compile governance → plan against state → deterministic repair → independent validation → reconcile → durable canonical result. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “This slice proves the central loop”.
- [ ] **SLICE-027** Visualization, broad cloud adapters, and a universal semantic model MUST NOT begin before the mandatory first slice passes. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.

### Slices 2–12

- [ ] **SLICE-028** Slice 2 MUST add semantic-signature profiles with assurance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 — Semantic signatures, invalidation, and backdating”.
- [ ] **SLICE-029** Slice 2 MUST add derivation inputs and a reverse index. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-030** Slice 2 MUST add Impact Rules. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-031** Slice 2 MUST add an API-contract fixture. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-032** Slice 2 MUST add exact/validated backdating. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-033** Slice 2 MUST refuse heuristic equality as proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-034** Slice 2 MUST add SCC proof-group support sufficient for fixture tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-035** Slice 2 MUST distinguish the rebuild oracle from independent conformance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-036** Slice 2 MUST add localized `StateBinding` value-dependency and query-dependency validation/rebinding. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **SLICE-037** Slice 2 MUST add deterministic registered query programs and closure-sensitive result fingerprints sufficient for identity, relation-neighborhood, selector-membership, event/contract-consumer, and implementation-binding fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2”.
- [ ] **ACC-035** Slice 2 MUST prevent client regeneration for an unchanged public contract only when assurance policy permits backdating. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 / Acceptance”.
- [ ] **ACC-036** Slice 2 MUST prove unrelated root-state mutations do not stale independent work. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 2 / Acceptance”.
- [ ] **SLICE-038** Slice 3 MUST add canonical Requirement and Behavioral Scenario persistence/querying. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 — Behavioral intent, identity resolution, and Relevance Engine”.
- [ ] **SLICE-039** Slice 3 MUST add Concept, Requirement, and Scenario aliases. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-040** Slice 3 MUST support Semantic Identity Resolution outcomes `reuse`, `coordinated-change`, `split`, `create`, and `no-entity`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-041** Slice 3 MUST prevent duplicate/overlapping canonical identity before creating a new identity. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-042** Slice 3 MUST add WHAT/WHY intent analysis and a read-only WHERE/WHAT-ELSE Relevance Scout. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-043** Slice 3 MUST add bounded Relevance Closure with direct, governing, consequence, and possible bands. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-044** Slice 3 MUST deterministically traverse canonical relations, Projection Unit bindings, selectors, package/code topology, verification bindings, and active decisions/invariants for relevance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-045** Slice 3 MUST add event/contract producer-consumer topology sufficient for fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-046** Slice 3 MUST add an Analysis Facet activation framework. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-047** Slice 3 MUST make the Context Compiler consume Relevance Closure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-048** Slice 3 MUST bind closure-sensitive identity, adjacency, membership, event, and contract queries so negative-space and stopping conditions cannot silently stale. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-049** Slice 3 MUST compare predicted and observed impact and record Planning Surprises. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **SLICE-050** Slice 3 MUST add held-out relevance and over-expansion fixtures. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3”.
- [ ] **ACC-037** Slice 3 MUST modify an existing identity for a synonymous request instead of creating a duplicate. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-038** Slice 3 MUST bring a cross-cutting invariant outside the touched package into governing context through semantic applicability. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-039** Slice 3 MUST keep unrelated semantic domains outside compiled context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-040** Slice 3 MUST bring a known event/contract consumer into relevance without model guessing. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-041** When legitimate implementation exposes a missing relationship, Slice 3 MUST produce a Planning Surprise and propose a reusable relationship instead of silently mutating the plan. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **ACC-042** Slice 3 MUST demonstrate that generated Markdown/Gherkin is derived from Requirement/Scenario identities and is not a second source of truth. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 3 / Acceptance”.
- [ ] **SLICE-051** Slice 4 MUST add a semantic representation compiler with `human-technical@1`, `agent-compact@1`, and `machine-invariant@1` reference profiles. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4 — Governance robustness and representation”.
- [ ] **SLICE-052** Slice 4 MUST add protected-dimension Semantic Preservation Fingerprints. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-053** Slice 4 MUST separate deterministic controlled-prose/style lint and literal-preservation checks from semantic-fidelity proof. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-054** Slice 4 MUST add representation-profile dependency invalidation and fallback policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-055** Slice 4 MUST account for tokenizer/profile cost sufficiently to refuse net-negative compact context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-056** Slice 4 MUST add lens overlap roles. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-057** Slice 4 MUST add projection expectation kinds. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-058** Slice 4 MUST add governance strata and fixed-point failure handling. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-059** Slice 4 MUST add layered ignore policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-060** Slice 4 MUST add dependency-keyed selector/rule caches. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-061** Slice 4 MUST normalize risk and `ExecutionPolicy`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-062** Slice 4 MUST add immutable plan revision/rebase, including lightweight rebind when only unrelated root state changed. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-063** Slice 4 MUST add a canonical engine/schema upgrade protocol. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 4”.
- [ ] **SLICE-064** Slice 5 MUST add complete `ArchitectureConcern`, `ArchitectureDecision`, `DecisionEvaluation`, `DecisionValidityAssessment`, `DeveloperPreference`, and `GovernanceBasis` contracts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 — Progressive architecture commitment”.
- [ ] **SLICE-065** Slice 5 MUST discover/materialize concerns from the already-compiled Relevance Closure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-066** Slice 5 MUST support scope-specific decision reuse and dirtying. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-067** Slice 5 MUST add typed reconsideration and evidence-refresh policy. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-068** Slice 5 MUST add preference providers/composition, with canonical adoption only at project scope. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-069** Slice 5 MUST compile decision consequences with crash-consistent governance activation. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-070** Slice 5 MUST add deferral and optionality contracts. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-071** Slice 5 MUST handle decision overlap and SCC convergence. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-072** Slice 5 MUST run architecture preflight in `projector change`. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-073** Slice 5 MUST deliver `projector decisions`, decision explanation, and decision-pressure audit. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **SLICE-074** Slice 5 MUST include the cross-platform expansion fixture. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5”.
- [ ] **ACC-043** Slice 5 MUST make a single-web-app → cross-platform request produce a concise decision frontier. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 / Acceptance”.
- [ ] **ACC-044** That frontier MUST use current research only for volatile choices, preserve unaffected decisions, avoid preselecting technologies, receive relevant cross-cutting context without unrelated domains, and permit simple tooling until evidence or reconsideration triggers justify more. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 5 / Acceptance”.
- [ ] **SLICE-075** Slice 6 MUST begin only after Slices 0–5 pass. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6 — Broaden analyzers and relevance/divergence topology”.
- [ ] **SLICE-076** Slice 6 MUST deliver full TypeScript/JavaScript semantic indexing. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-077** Slice 6 MUST deliver richer event/public-contract producer-consumer extraction. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-078** Slice 6 MUST analyze structured data. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-079** Slice 6 MUST analyze Markdown. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-080** Slice 6 MUST analyze GitHub Actions. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-081** Slice 6 MUST deliver richer divergence taxonomy/reporting. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-082** Slice 6 MUST degrade truthfully for analyzer capability/failure. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-083** Slice 6 MUST make the Relevance Engine use newly available deterministic lanes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 6”.
- [ ] **SLICE-084** Slice 7 MUST deliver observability-aware coverage snapshots. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7 — Coverage completion and cleanup”.
- [ ] **SLICE-085** Slice 7 MUST deliver semantic-identity/relevance coverage lanes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-086** Slice 7 MUST rank questions by information gain. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-087** Slice 7 MUST support interactive promotion, exception, and defer handling. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-088** Slice 7 MUST deliver resumable cleanup plans. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-089** Slice 7 MUST refuse open-world completeness claims. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-090** Slice 7 MUST deliver Planning Surprise and relevance-quality metrics. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 7”.
- [ ] **SLICE-091** Slice 8 MUST deliver the complete ordered flow: intent analysis + Relevance Scout → identity resolution → Relevance Closure → Requirement/Scenario delta → Analysis Facets → architecture preflight → Impact Closure → packet grouping/SCC handling → checkpoints/rebase → bounded deterministic/agent execution → reverse-impact comparison → reconciliation → receipts/certificates. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 8 — Full Semantic Change Compiler and packet executor”.
- [ ] **SLICE-092** Slice 8 Execution Capsule compilation MUST keep the structured normative kernel authoritative while emitting the least-cost valid Representation Projection for explanatory/task context. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 8”.
- [ ] **SLICE-093** Slice 9 MUST deliver capability-detected Codex and Claude adapters. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9 — Host/MCP integrations”.
- [ ] **SLICE-094** Slice 9 MUST deliver dependency-bound MCP mutation capabilities, relevance/context query tools, direct-write observation, and host tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9”.
- [ ] **SLICE-095** Host adapters MUST consume state-bound representation projections and MUST NOT treat generated compact prose as canonical governance. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 9”.
- [ ] **SLICE-096** Slice 10 MUST deliver friction aggregation, alternative comparison, authority-aware upgrade proposals, migration overlays, and staged execution through the same relevance/architecture/impact machinery as ordinary changes. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 10 — Modernization”.
- [ ] **SLICE-097** Slice 11 MUST deliver incremental watch, CI exit policy, recovery UX, cost/complexity accounting, hostile-content/path hardening, and a benchmark harness. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11 — Watch/CI/hardening”.
- [ ] **SLICE-098** Slice 11 MUST measure relevance recall/context expansion, duplicate prevention, Planning Surprise, scoped state binding, representation fidelity, token economics, and instruction efficiency. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11”.
- [ ] **SLICE-099** Slice 11 MUST disable optimizations that do not earn their cost. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 11”.
- [ ] **SLICE-100** Slice 12 MUST begin only after the local kernel is credible. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12 — External surfaces”.
- [ ] **SLICE-101** Slice 12 MUST implement, in order: (1) GitHub or another high-value external surface, (2) Generic HTTP/JSON, and (3) further providers based on actual demand. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12”.
- [ ] **ACC-045** Each external adapter MUST ship independently only after its observability/capability contract, relevance/impact relationships, drift semantics, snapshot behavior, and truthful unavailable/open-world behavior pass tests. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 12”.

### Architecture acceptance scenarios

- [ ] **ACC-046** For web → desktop/Android/iOS expansion, requirement intent MUST record target capabilities without preselecting a stack. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` — “Architecture expansion: web app → cross-platform product”.
- [ ] **ACC-047** The expansion MUST activate material concerns including workspace topology, cross-platform runtime/shared-code boundary, dependency coherence, API contract, build/test/release, and distribution obligations. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-048** Projector MUST classify concerns as `blocking-now`, `material-soon`, or `deferable` for the requested slice and MUST NOT require every concern immediately. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-049** Prior web decisions MUST remain valid for web unless their assumptions changed. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-050** Volatile technology options MUST be checked against current official or authoritative evidence before recommendation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-051** If pnpm is a viable selected package manager, workspace catalog capability MAY be evaluated for dependency-version coherence, but MUST NOT be independently mandated. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-052** Task orchestration MUST be evaluated, but Nx, Turbo, or another orchestrator MUST NOT be adopted merely because the repository became a monorepo; plain workspace scripts are a valid decision with reconsideration triggers. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-053** User, organization, and project preferences MUST influence only otherwise viable choices, and material influence MUST be shown. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-054** Accepted decisions MUST compile rules, lenses, and migrations transactionally. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-055** Implementation planning MUST start only after the blocking decision frontier is resolved or validly deferred. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.
- [ ] **ACC-056** A local developer preference MAY rank otherwise viable options, but MUST NOT create a repository rule or change another developer's accepted project state; project adoption makes it shared input, while enforcement still requires a constraint/decision. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Preference scope isolation”.
- [ ] **ACC-057** When a platform/version change fires an accepted decision's refresh policy, only affected evidence MUST refresh; broad trend scanning is prohibited, and refresh MAY reaffirm the decision without migration. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Stale architecture research”.
- [ ] **ACC-058** A task-orchestration concern MAY be deferred with explicit optionality-preserving constraints and revisit triggers; if implementation would irreversibly depend on one orchestrator, the concern becomes blocking or requires a temporary explicit decision. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Decision deferral preserves optionality”.
- [ ] **ACC-059** “Do not add a monorepo orchestrator yet” MUST be a valid accepted decision when scripts are fast and ordering is simple; it MUST carry rationale and triggers and MUST NOT require a synthetic implementation rule merely to prove existence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Negative/simple decision”.
- [ ] **ACC-060** Incompatible consequences from unexpectedly overlapping accepted technology decisions MUST block before governance activation until narrowing, supersession, migration, or exception resolves the conflict. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Decision overlap conflict”.
- [ ] **ACC-061** Held-out and mutation-generated architecture fixtures MUST measure concern recall, irrelevant-concern rate, decision-question count, correctly deferred concerns, stale-decision detection, and current-research correctness. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` file — “Held-out concern-discovery robustness”.
- [ ] **ACC-062** Architecture fixture success MUST NOT require fixture-specific names. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` heading.

### Core acceptance scenarios

- [ ] **ACC-063** Deleting `state.db` and caches after authoring independently addressable Concepts, Requirements, Behavioral Scenarios, Relations, rules, active lens/profile, authority, decision, exception, and migration MUST reload all authored/governance semantics identically, reproduce the deterministic canonical-root digest, recompute observations, and require neither hidden run history nor a monolithic model. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Canonical rebuild closure”.
- [ ] **ACC-064** In the fixture where forty generated packages share a weak pattern, two independently authored newer implementations use a better pattern, incidents support the latter, and Projector normalizes several packages under the proposed lens, the forty generated copies MUST collapse into one independence group. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Copied-slop majority and endogenous-evidence defense”.
- [ ] **ACC-065** Projector-normalized copies MUST NOT become independent votes for their causal lens. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-066** Dominant descriptive precedent MUST NOT automatically become normative. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-067** A migration recommendation MUST require stronger independent evidence and approval appropriate to risk. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-068** When two implementations have the same heuristic semantic hash/profile but an observable behavior difference outside that profile, heuristic semantic equality MUST NOT backdate downstream validity; independent revalidation or widened analysis is required. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Semantic-signature insufficiency”.
- [ ] **ACC-069** When an internal API implementation changes but an exact public-interface signature does not, implementation MUST invalidate, the public contract MUST revalidate/backdate, downstream clients MUST remain valid, and client regeneration MUST NOT occur. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Semantic backdating”.
- [ ] **ACC-070** A clean rebuild agreeing with a shared buggy analyzer MUST NOT support strong completion when an independent test/schema/runtime lane contradicts it; the contradiction MUST surface. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Shared-bug rebuild oracle”.
- [ ] **ACC-071** Mutually recursive contract units MUST be evaluated as one SCC proof group to a fixed point; downstream consumers remain valid only after all relevant group signatures regain eligible assurance. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “SCC backdating”.
- [ ] **ACC-072** Making a private symbol public MUST change selector membership, newly apply public API rules/projection expectations, update docs/compatibility/contract closure, and invalidate only affected dependency-keyed caches. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Selector membership change”.
- [ ] **ACC-073** A `predicate-constrained` expectation MUST accept structurally different handwritten implementations that satisfy the same predicates/tests, and Projector MUST NOT invent one exact canonical body. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Multiple valid shared implementations”.
- [ ] **ACC-074** Recursive rule/lens membership without declared fixed-point semantics MUST emit `governance-cycle` and refuse order-dependent resolution. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Governance-cycle detection”.
- [ ] **ACC-075** An explicitly monotonic governance SCC MUST converge deterministically or fail with bounded `nonconvergent-reconciliation`. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` heading.
- [ ] **ACC-076** Failure injection after journal phases prepared, during workspace mutation, staged, validating, canonical staging, commit, and rollback MUST restart by safe resume, rollback, or `recovery-required`; canonical state MUST NOT claim completion while workspace state is partial. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Crash recovery matrix”.
- [ ] **ACC-077** Incompatible active lens/rule changes merged from branches MUST produce canonical conflict, block Govern/Autonomous execution and stale approvals/plans, and require explicit resolution that creates new valid state. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Branch governance conflict”.
- [ ] **ACC-078** A sampled/open-world dependency MUST refuse `proven-within-boundary` for any closure claim requiring complete enumeration, though local work MAY remain high-confidence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Open-world completeness refusal”.
- [ ] **ACC-079** An indicated iOS surface without store credentials MUST be known/unavailable, include human/external action in the plan, allow safe local work, and refuse a global-completeness certificate. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Unreachable external surface”.
- [ ] **ACC-080** Resampling identical normalized evidence into different plausible hypotheses MUST leave accepted canonical state unchanged absent explicit promotion/decision, while inference artifacts remain distinguishable and replayable. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Model resampling idempotence”.
- [ ] **ACC-081** Tests generated by the same wrong packet MUST NOT satisfy an R2+ independent-validation requirement; an independent contract/property/runtime contradiction MUST block completion. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Validator independence”.
- [ ] **ACC-082** A known generated-output defect MUST be repaired in source/generator and regenerated/validated by default; a direct output patch is rejected unless an explicit temporary overlay has debt/migration exit criteria. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Generated-output upstream repair”.
- [ ] **ACC-083** After partial completion, settled decisions MUST persist; if an intervening change touches a bound dependency, the old plan MUST NOT resume blindly and plan rebase MUST carry forward still-valid completed work into a new revision/capsules; only when unrelated snapshot state changed and every `StateBinding` dependency/membership fingerprint is unchanged MAY Projector perform a lightweight rebind without recomputing unaffected semantic work. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Partial completion and plan rebase”.
- [ ] **ACC-084** Changing an unrelated leaf MUST preserve selector/rule caches whose declared dependencies are untouched; graph revision alone MUST NOT trigger near-global recomputation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Localized cache performance”.
- [ ] **ACC-085** Analyzer/signature-profile semantic changes MUST declare reindex/revalidation, make dependent old derivations suspect, and MUST NOT silently preserve old proof. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Engine/signature-profile upgrade”.
- [ ] **ACC-086** Partial Markdown or TypeScript analyzer failure MUST preserve unaffected observations and widen/block only dependent coverage and claims. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Analyzer partial failure”.
- [ ] **ACC-087** Symlink/platform path observation MAY follow policy, but mutation MUST remain repository-root-constrained and refuse out-of-root writes. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Path/symlink escape”.
- [ ] **ACC-088** Semantic role/relationship evidence MUST outrank misleading nearby precedent, and no accidental pattern fork may be created. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Misleading local precedent”.
- [ ] **ACC-089** Alternating repair transforms MUST detect a repeated state digest and fail reconciliation as non-convergent instead of looping. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Projector repair oscillation”.
- [ ] **ACC-090** Held-out, mutation-generated structurally varied repositories MUST keep reported precision/recall and completeness behavior within release thresholds and demonstrate generalization beyond golden-fixture memorization. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Held-out/mutation-generated benchmark”.

### Relevance and semantic identity acceptance scenarios

- [ ] **ACC-091** When canonical state contains `CAP-MIDI-DEVICE-DISCOVERY` with aliases including `midi devices` and `device enumeration`, a request to “add wireless MIDI device enumeration” MUST rank that existing capability as owner and MUST NOT create a duplicate merely due to wording, even with nearby code/docs using different phrases. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Synonymous request reuses canonical identity”.
- [ ] **ACC-092** If BLE behavior is distinct, Projector MUST modify the existing capability/Requirements or propose a narrower identity with owns/excludes boundaries and nearest candidates, and the resolution MUST remain inspectable. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` heading.
- [ ] **ACC-093** Adding only an accepted synonym MUST preserve stable ID and `semanticHash`, change `discoveryHash` and complete snapshot/document hash, reevaluate affected identity-search/Relevance queries, preserve derivations bound only to unchanged meaning, and resolve later synonymous requests to the existing identity. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Alias change refreshes discovery without semantic invalidation”.
- [ ] **ACC-094** Identity resolution after rename/move/supersession MUST inspect active identities, aliases, lineage, tombstones, and superseded entities; it MUST resolve to the survivor/replacement or expose split/new-identity choice and MUST NOT resurrect a duplicate due to absent old name/path. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Superseded/renamed identity is not resurrected as a duplicate”.
- [ ] **ACC-095** Bluetooth-MIDI timing context MUST include direct timing semantics, the physically separate Session Clock invariant/applicable decision as governing context, typed downstream multiplayer/recording consumers as consequence context, and MUST exclude unrelated identity/avatar/UI domains. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Cross-cutting governing concern outside touched package”.
- [ ] **ACC-096** An invariant authored once and bound to three capabilities through Relations/selectors MUST be discovered for all three and MUST NOT be duplicated into package-local specs for discoverability. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Encapsulation is not retrieval”.
- [ ] **ACC-097** Relevance Closure MUST contain all planning-relevant concepts, Impact Closure only justified changed units/consequences, and context loading MUST NOT itself invalidate relevance entries. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Relevance is not impact”.
- [ ] **ACC-098** Localized relevance MUST remain bounded, weak neighbors MUST be dropped or placed only in the possible band with rationale, whole-graph serialization is prohibited, and metrics MUST expose irrelevant expansion. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Relevance over-expansion refusal”.
- [ ] **ACC-099** Known `MidiNoteCaptured` consumers in recording, multiplayer, scoring, and visualization MUST enter relevance deterministically before model inference; model recall failure MUST NOT hide graph-known consumers. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Event topology discovers non-obvious consumers”.
- [ ] **ACC-100** Public API/message/schema producer-consumer edges MUST route unrelated consumers into change cognition and then Impact Closure with the appropriate proof class once the delta is known. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Contract topology discovers consumers”.
- [ ] **ACC-101** Human Markdown, Gherkin, compact-agent, and applicable machine-invariant projections MUST bind to the same canonical Requirement/Scenario identities/hashes; generated edits MUST NOT silently rewrite behavior, intentional edits MUST reconcile as proposed semantic changes, and wording/format changes MUST NOT mint identities. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Requirement and scenario projections are derived”.
- [ ] **ACC-102** Intent Analysis MUST separate behavioral goal/constraints from implementation proposal; Relevance Scout MAY inspect code/topology for WHERE/WHAT-ELSE; nearby technology MUST NOT decide architecture; Relevance Closure MUST inform preflight without contaminating Requirements with HOW. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “WHAT/WHY is protected without WHERE blindness”.
- [ ] **ACC-103** An unrelated canonical change MUST change global snapshot identity while permitting safe rebind/use when every bound semantic/physical/query dependency remains unchanged; receipts MUST distinguish snapshots without recomputing the semantic plan. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Unrelated canonical change does not stale local work”.
- [ ] **ACC-104** Changing a bound Session Clock invariant MUST fail/revalidate binding and MUST block execution under old approval until required relevance/impact/context refresh completes. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Bound dependency change does stale local work”.
- [ ] **ACC-105** Export-membership change MUST invalidate/recompile a capsule when a new selector-dependent rule applies even if previously loaded entity bodies are byte-identical. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Membership-changing fact invalidates context even when loaded entities are unchanged”.
- [ ] **ACC-106** Adding newly query-matching semantic state MUST change the query result hash, stale and recompute the prior closure/binding, and include the new state even if old selected hashes are unchanged; unrelated additions that change no bound query result MUST NOT stale it. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Newly relevant semantic state invalidates negative-space proof”.
- [ ] **ACC-107** Changing a registered query program/version or declared closure-sensitive projection MUST stale the old query dependency and require policy-driven recompile/rebind even when entities are unchanged. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Query semantics are part of state binding”.
- [ ] **ACC-108** Empty results from a `sampled` or `open` event/consumer lane MAY support context but MUST record lane/assumptions and unknown frontier, MUST NOT prove absence, and MAY become stronger only after eligible `closed`/`bounded` reevaluation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Open-world emptiness is not absence proof”.
- [ ] **ACC-109** Legitimate reverse impact omitted from predicted MIDI timing closure MUST emit a Planning Surprise, classify scope growth vs missing relation/analyzer/facet vs overreach, propose reusable relations only through authority rules, and improve future discovery. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Planning Surprise learns a missing relationship”.
- [ ] **ACC-110** Unrelated avatar refactoring during a MIDI task MUST be identified as unexplained impact/overreach, trigger repair/revert policy absent a valid relevance path, and MUST NOT manufacture a MIDI/avatar relation. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Planning Surprise rejects agent overreach”.
- [ ] **ACC-111** Concurrent unrelated Requirement edits MUST remain in independent canonical files/identities and avoid synthetic monolithic-model conflicts; semantic root hashes MUST differ appropriately. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Fine-grained canonical merge locality”.
- [ ] **ACC-112** Moving a canonical Concept to a deterministic shard without semantic change MUST preserve identity, relationships, relevance, and semantic hash; only storage/index metadata may change. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Semantic storage path does not define meaning”.
- [ ] **ACC-113** A simple behavior change MUST activate only minimal useful Analysis Facets; a realtime event/public-contract change MUST activate behavior, events, realtime, and public-contract facets; facets add discovery/verification without preselecting technology. Source: `PROJECTOR_SPEC/12-delivery/acceptance-relevance-and-identity.md` — “Analysis Facets compose without methodology lock-in”.

### Representation acceptance scenarios

- [ ] **ACC-114** Compacting `MUST_NOT delete production data unless explicit user approval` into weaker force, `A iff B` into `A when B`, or `exactly one` into `one or more` MUST fail protected-dimension validation and leave canonical rules untouched; a provably equivalent deterministic invariant encoding MAY pass, such as `FORBID delete-production-data EXCEPT explicit-user-approval` when the normalized kernel proves equivalence. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Representation semantic-fidelity rejection”.
- [ ] **ACC-115** Valid `human-technical@1`, `agent-compact@1`, and `machine-invariant@1` projections MAY differ textually but MUST share source semantic hash and compatible preservation fingerprints; derived edits MUST regenerate or reconcile as proposed semantic change and MUST NOT mutate source directly. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Cross-projection consistency”.
- [ ] **ACC-116** When compact-profile instruction/tokenizer overhead exceeds savings, the Context Compiler MUST select source/less-compressed representation; it MAY select compact mode later only when measured net cost improves without fidelity loss. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Net-negative compact-context fallback”.
- [ ] **ACC-117** Changing only `agent-compact@1` MUST suspect/regenerate dependent agent projections/capsules, preserve independent human/machine projections, and MUST NOT dirty canonical source hashes or architecture decisions. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Representation-profile invalidation”.
- [ ] **ACC-118** The authoritative `SPEC.md`, `INDEX.md`, and every authoritative module MUST have zero blocking `human-technical@1` errors; lint MUST NOT rewrite code blocks/literals, passive voice and nominalization remain review signals where deterministic rewrites risk meaning, and style MUST NOT claim semantic equivalence or truth. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Authoritative specification human-technical conformance”.
- [ ] **ACC-119** Compact context MUST preserve negation, scope, order, exact code symbols, paths, API names, numbers, units, a standard acronym, and all protected dimensions; it MAY remove nonessential narration/repetition when host policy permits, MUST reject invented prose abbreviations unless measured token savings justify them and clarity remains acceptable, and MUST fall back when ambiguity, semantic weakening, or net-negative profile overhead occurs. Source: `PROJECTOR_SPEC/12-delivery/acceptance-representation.md` — “Compact context preserves critical tokens and avoids false compression”.

### Public release criteria

- [ ] **REL-001** A new user MUST be able to install one package. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”, item 1.
- [ ] **REL-002** A new user MUST be able to run `projector init` in a TypeScript/JavaScript monorepo. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 2.
- [ ] **REL-003** Initialization MUST produce useful findings without handwritten modeling. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 3.
- [ ] **REL-004** A user MUST be able to inspect why a finding and expectation exist. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 4.
- [ ] **REL-005** A user MUST be able to distinguish Pattern Candidate from active authority. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 5.
- [ ] **REL-006** Projector MUST persist independently addressable Concepts, Requirements, Behavioral Scenarios, and Relations and rebuild the derived graph from them. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 6.
- [ ] **REL-007** Different terminology MUST resolve to an existing semantic identity rather than create a duplicate. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 7.
- [ ] **REL-008** A cross-cutting request MUST produce bounded Relevance Closure that finds governing semantics outside the touched package without unrelated domains. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 8.
- [ ] **REL-009** Users MUST separately inspect why something was relevant and why it entered Impact Closure. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 9.
- [ ] **REL-010** Architecture-expanding work MUST produce a concise decision frontier with prior decisions, required research, alternatives, preference influence, and consequences. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 10.
- [ ] **REL-011** Execution Capsule context MUST be selected from the relevant semantic subgraph, not the complete graph. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 11.
- [ ] **REL-012** Unrelated canonical/repository change MUST demonstrate safe `StateBinding` rebind without global staleness. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 12.
- [ ] **REL-013** Projector MUST auto-fix supported R1 divergences through dependency-bound journaled transactions. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 13.
- [ ] **REL-014** Projector MUST resume/rebase a partially completed plan. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 14.
- [ ] **REL-015** Projector MUST reconcile a deliberate coding-agent fixture mistake. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 15.
- [ ] **REL-016** Projector MUST compile one cross-file semantic change with narrow invalidation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 16.
- [ ] **REL-017** Projector MUST compare predicted and actual impact and surface Planning Surprise for a missed relationship or exceeded scope. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 17.
- [ ] **REL-018** Projector MUST demonstrate exact/validated semantic backdating and heuristic refusal. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 18.
- [ ] **REL-019** Projector MUST run `verify --clean` and an independent conformance check. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 19.
- [ ] **REL-020** Projector MUST recover correctly from injected transaction interruption. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 20.
- [ ] **REL-021** Projector MUST refuse false completeness on open/unavailable surfaces. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 21.
- [ ] **REL-022** Projector MUST emit a compact R2+ transaction receipt and truthful certificate. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 22.
- [ ] **REL-023** Rebuilding `state.db` from canonical state MUST preserve equivalent semantics. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 23.
- [ ] **REL-024** One canonical scope MUST compile to applicable human-technical, Gherkin/human behavioral, agent-compact, and machine-invariant representations and reject seeded protected-semantic drift. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 24.
- [ ] **REL-025** Compact context selection MUST use measured net utility/cost rather than token count alone and MUST include a net-negative fallback case. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md`, item 25.
- [ ] **REL-026** A release primarily producing Markdown, prompts, static graphs, or advice MUST NOT qualify as Projector. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”.

### Dogfooding obligations

- [ ] **DOG-001** Before public release, Projector MUST govern its own workspace package boundaries with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Dogfooding requirement”.
- [ ] **DOG-002** It MUST govern analyzer implementation with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-003** It MUST govern CLI commands with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-004** It MUST govern transform implementation and tests with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-005** It MUST govern serialized contract changes with an active lens. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-006** It MUST govern its own Requirements, Behavioral Scenarios, and semantic identity resolution. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-007** It MUST govern Relevance Closure and context compilation for Projector feature work. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-008** It MUST govern applicable event/public-contract relationships. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-009** It MUST govern DB migrations. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-010** It MUST govern host-adapter generation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-011** It MUST govern documentation references. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-012** It MUST govern semantic representation profiles for its human docs, agent capsules/host instructions, and machine-invariant rule products. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-013** Projector's self-audit MUST be clean or contain explicit accepted debt. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-014** The authoritative specification MUST pass the blocking `human-technical@1` mechanical style gate; code blocks and exact technical literals are outside that prose gate, while passive voice and nominalization remain review signals when a deterministic checker cannot identify a better actor or verb safely. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-015** Before public release, the reference technology and package choices in `Reference Implementation Architecture` (`PROJECTOR_SPEC/02-semantic-kernel/reference-implementation.md`) MUST be represented as Projector Architecture Decisions, Authority Records, and Governance Bases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-016** Projector MUST explain its package, runtime, storage, test, and analyzer choices. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DOG-017** Projector MUST show the rules/lenses those choices produce and the typed reconsideration triggers. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.

### Final implementer checklist and directive

- [ ] **REL-027** Before any slice/release completion claim, verify zero-ceremony value still exists. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Final implementer checklist”.
- [ ] **REL-028** Verify canonical authored/governance state is closed under rebuild. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-029** Verify canonical semantic entities are independently addressable and no bounded change requires loading or rewriting a monolithic project model. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-030** Verify global canonical/worktree digests identify snapshots but are not the sole local-validity dependency. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-031** Verify every plan/capsule/approval/capability uses dependency-complete `StateBinding` with explicit query dependencies. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-032** Verify every public normative contract is schema-defined. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-033** Verify package dependencies follow ports plus composition-root architecture. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-034** Verify semantic hashes use explicit schema projections. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-035** Verify stable semantic identity does not depend on filename, package location, or mutable wording, and aliases do not create identities. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-036** Verify durable semantics resolve against existing identities before creation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-037** Verify Requirements/Scenarios exist only where they materially improve planning, relevance, verification, or explanation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-038** Verify semantic equality states profile and assurance. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-039** Verify canonical semantics remain authoritative over every Representation Projection. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-040** Verify human/agent/machine representations bind to source semantic hashes and explicit profile version. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-041** Verify rendering/compression cannot silently drift protected normative force, negation, scope, cardinality, logical connectives, conditions, exceptions, dependency/order, behavioral step roles, concept identity, or literals. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-042** Verify style/clarity lint is never labeled semantic-equivalence proof. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-043** Verify compact context accounts for tokenizer/profile overhead and falls back when net-negative or behaviorally worse. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-044** Verify heuristic equality never independently prunes downstream validity. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-045** Verify Relevance Closure remains distinct from Impact Closure and exact invalidation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-046** Verify bounded relevance, not hierarchy or whole-graph dumping, selects context. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-047** Verify deterministic event/contract/implementation topology is preferred over model rediscovery. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-048** Verify exact invalidation follows derivation inputs and versioned Impact Rules widen conceptually. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-049** Verify predicted and observed impact reconcile and Planning Surprises never silently rewrite the plan. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-050** Verify governance strata and recursive SCCs have termination semantics. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-051** Verify architecture concerns are materiality-gated and transient unless durably dispositioned. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-052** Verify accepted architecture decisions are scoped and have explicit Authority Records and Governance Bases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-053** Verify decision validity reevaluates only when typed relevant inputs fire. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-054** Verify local/user preferences are non-blocking and cannot silently become repository governance. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-055** Verify live research is concern-scoped, freshness-aware, and never automatically migrates. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-056** Verify unresolved `blocking-now` concerns cannot disappear through implementation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-057** Verify decision consequences activate atomically and overlapping scoped decisions are conflict-checked. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-058** Verify Projector-generated conformity cannot vote independently for its causal rule/lens/decision. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-059** Verify risk cannot decrease as uncertainty increases. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-060** Verify plans, packets, approvals, and MCP mutation capabilities are dependency-scoped/state-bound and safely rebind only for unrelated root change. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-061** Verify transaction journal/recovery paths at every phase. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-062** Verify generated outputs are repaired upstream by default. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-063** Verify selector/rule caches are dependency-keyed. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-064** Verify analyzer failure degrades only dependent claims. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-065** Verify external live state enters deterministic work only through pinned snapshots. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-066** Verify blocking rules normalize to the supported predicate kernel or an explicit validator. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-067** Verify R2+ independent-validation policy is satisfiable and tested. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-068** Verify multiple valid shared implementations are not falsely canonicalized. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-069** Verify merge/rebase canonical conflicts block stale automation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-070** Verify engine/schema/signature upgrades invalidate old proofs when required. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-071** Verify sensitive data is removed before model-context construction. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-072** Verify path/symlink boundaries prevent out-of-root mutation. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-073** Verify the second identical reconciliation has no material semantic delta. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-074** Verify held-out/mutation-generated evaluation accompanies golden fixtures. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-075** Verify semantic-model complexity is measured against use. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-076** Verify no unsupported `proven-within-boundary` claim is emitted. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **REL-077** Verify a representation-profile-only change invalidates dependent projections/contexts without mutating canonical intent. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DELV-008** The final system MUST implement the full ordered control loop in “Final implementation directive”: observe reality without executing it by default; derive deterministic structure; interpret WHAT/WHY while independently scouting WHERE/WHAT-ELSE; resolve requested meaning against existing stable semantic identities; compile a bounded Relevance Closure across semantic, code, event, contract, decision, invariant, and verification topology; create or modify canonical Requirements and Behavioral Scenarios only where they add durable semantic value; normalize requirement/scenario/constraint deltas without preselecting HOW; disclose newly material architecture concerns; reuse valid scoped decisions and dirty only affected decision bases; refresh current evidence and evaluate preferences only where decision materiality requires it; accept/defer architecture decisions and compile their governance consequences; infer semantic classifications and Pattern Candidates; establish authority from independent, causally valid evidence; compile Projection Lenses, typed rules, expectations, and Impact Rules; compile human, behavioral/Gherkin, agent, and machine representations from the same canonical semantic kernel; reject or fall back from any representation that weakens protected semantics or loses net utility; bind plans/capsules/approvals to explicit semantic/physical dependencies rather than a global snapshot alone; record derivations and semantic signatures; calculate Impact Closure, invalidate exact dependents, and widen uncertain impact; backdate only with sufficient assurance; repair upstream and deterministically where possible; dispatch bounded agents only for semantic residue; derive reverse impact from actual mutations and compare it with predicted relevance/impact; classify Planning Surprises and propose learned relationships without manufacturing authority; validate through required independent evidence lanes; reconcile to an explicit fixed point; commit fine-grained canonical intent plus a material transaction receipt; preserve a resumable cleanup frontier; and turn repeated reasoning and newly proven relationships into cheaper executable machinery. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` file — “Final implementation directive”.
- [ ] **DELV-009** The control plane MUST own globally coherent change reasoning, determine relevant accumulated intent and architecture before local agent reasoning dominates, and verify what reality touched. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading.
- [ ] **DELV-010** Aggressive optimization is permitted only when all five conditions hold: the evidence lane is named; the action binds to analyzed dependencies; required semantic dimensions are preserved; sufficiency of the relevant subgraph is explained; and remaining uncertainty is stated. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` heading — “The governing constraint”.

### GSD bootstrap handoff

- [ ] **HANDOFF-001** Before source removal, every normative clause in `PROJECTOR_SPEC/` MUST be absorbed into self-contained GSD requirements, decisions, constraints, acceptance criteria, phase context, and plans with checksummed provenance and clause-level source-to-destination coverage. Source: `.planning/PROJECT.md` — “What This Is”, “Requirements / Active”, and “Context”.
- [ ] **HANDOFF-002** The complete GSD bootstrap artifact set MUST be ingested into Projector's canonical managed model after the implementation can represent it. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-003** Projector MUST produce semantic-equivalence and coverage evidence showing that imported canonical artifacts preserve all GSD bootstrap semantics, including normative force, negation, scope, cardinality, conditions, exceptions, ordering, literals, identity, and proof boundaries. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Context”.
- [ ] **HANDOFF-004** `PROJECTOR_SPEC/` MUST NOT be removed until every authoritative clause has a self-contained verified destination, no remaining references or semantic dependencies exist, and omission, contradiction, weakened-language, dangling-reference, and semantic-equivalence audits pass with no unique semantics remaining. Source: `.planning/PROJECT.md` — “Requirements / Active”, “Context”, and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-005** The project-local GSD installation, `.planning/`, and project-local GSD support MUST NOT be removed until Projector can plan, execute, verify, reconcile, recover, explain, and continue development of its repository without GSD and no bootstrap artifact retains unique semantics. Source: `.planning/PROJECT.md` — “Requirements / Active” and “Constraints / Self-hosting handoff”.
- [ ] **HANDOFF-006** After both semantic-equivalence removal gates pass, Projector MUST continue self-development under its own canonical governance without GSD. Source: `.planning/PROJECT.md` — “What This Is” and “Context”.
- [ ] **HANDOFF-007** Before final handoff, Projector MUST provide the named primary execution-host integrations for Codex and Claude Code, using capability-detected adapters. Source: `.planning/PROJECT.md` — “Key Decisions” (Require Codex and Claude Code integrations before final handoff).
- [ ] **HANDOFF-008** The bootstrap and end-to-end proof MUST optimize for the Projector maintainer/developer, whose self-governance of Projector’s own repository is the decisive product proof. Source: `.planning/PROJECT.md` — “Key Decisions” (Optimize the bootstrap for the Projector maintainer/developer).


## Locked Constraints and Decisions

### Product and Semantic Kernel


- **CORE-LOCK-001 — Reference identity.** Version is `2.0.0`; status is `Normative implementation handoff`; product is `Projector`; method is `Projection-Driven Development (PDD)`; tagline is `Compile intent. Reconcile reality.`; reference runtime is TypeScript / Node.js 24 / pnpm / SQLite; core is host-neutral with Codex and Claude Code adapters.  
  Source: `SPEC.md` — “Authoritative Implementation Specification”

- **CORE-LOCK-002 — Reading routes.** `INDEX.md` is the complete semantic index. The task-to-module routes in the root table are the prescribed progressive-disclosure entry points and MUST remain accurate as navigation metadata.  
  Source: `SPEC.md` — “Progressive-disclosure reading routes”

- **PROD-LOCK-001 — Hidden choices prohibited.** Feature intent MUST NOT hide a technology choice; suspicion about an old decision MUST NOT itself prove migration is required.  
  Source: `01-product/vision-and-north-star.md` — “Executive summary”

- **PROD-LOCK-002 — Semantic fidelity dimensions.** Derived representations MUST preserve normative force, negation, scope, cardinality, conditions, exceptions, dependency/order, and protected identifiers/literals; compressed/polished text MUST NOT gain authority from convenience or cost.  
  Source: `01-product/vision-and-north-star.md` — “Executive summary”

- **PROD-LOCK-003 — Semantic precedent.** Textual proximity is weak precedent absent matching semantic role, relationships, and governing lens.  
  Source: `01-product/principles-and-non-goals.md` — “Semantic precedent over textual proximity”

- **KERN-LOCK-001 — Plane contents.** Intent owns capabilities, Requirements, scenarios, material event/command/policy/contract relations, invariants/obligations, ownership, architecture decisions, data/interfaces, compatibility, platforms, migrations. Lens owns lenses, selectors, expectations, Rules/Impact Rules, recognizers, validators, transforms, overlays, exceptions. Surface owns manifestations. Observed shadow owns deterministic facts, timestamped observations, and explicit hypotheses.  
  Source: `02-semantic-kernel/conceptual-architecture.md` — “Intent plane”; “Lens plane”; “Surface plane”; “Observed shadow graph”

- **KERN-LOCK-002 — Repository layout.** Initial package layout MUST preserve the documented tree: `packages/core/src/domain`, `src/schemas`, `src/ports`, `src/hashing`, `src/identity`; `packages/engine/src/inference`, `src/authority`, `src/governance`, `src/representation`, `src/invalidation`, `src/reconciliation`, `src/coverage`, `src/change`, `src/planning`; `packages/analyzers/src/filesystem`, `src/git`, `src/typescript`, `src/structured-data`, `src/markdown`, `src/github-actions`; `packages/runtime/src/primitives`, `src/transforms`, `src/execution`, `src/journal`, `src/worktrees`; `packages/integrations/src/codex`, `src/claude`, `src/mcp`, `src/models`, `src/surfaces`; `packages/cli`; `packages/testkit`; plus `fixtures`, `examples`, `docs`, `scripts`, and `AGENTS.md`.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Repository/package layout”

- **KERN-LOCK-003 — Architecture defaults are revisable decisions.** Reference technologies are defaults, not eternal doctrine. Implementation work SHOULD materialize them as Projector Architecture Decisions with Authority Records and reconsideration triggers; changes require typed reconsideration against those explicit triggers rather than undocumented substitution.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”


### Knowledge, Relevance, Evidence, Architecture, and Risk


- **KNOW-LOCK-001.** Relevance Closure precedes requirement/scenario delta and architecture preflight; Impact Closure follows the known semantic delta. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Purpose”, “Relevance algorithm”.
- **KNOW-LOCK-002.** Canonical semantics are stable Concepts, Requirements, Behavioral Scenarios, and typed Relations; files, model artifacts, facets, aliases, and tests are representations/evidence/configuration unless separately adopted through authority/governance. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Semantic identity resolution”, “Analysis Facets”, “Requirements, scenarios, and executable behavior”.
- **EVID-LOCK-001.** Evidence authority is vector-valued, causally independent, freshness-aware, and two-stage; scalar ranking never becomes calibrated probability without separate calibration. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Independence and causal origin”, “Authority vector”, “Authority records”.
- **ARCH-LOCK-001.** Progressive commitment is the governing architecture rule: decide when forces become material, preserve/reuse while basis remains valid, and reconsider only on relevant basis change. Source: `PROJECTOR_SPEC/03-knowledge/architecture-decisions.md` — “Progressive Architecture Commitment”.
- **ARCH-LOCK-002.** Architecture preflight is part of ordinary `projector change`, and modernization shares the identical decision machinery. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Architecture preflight”; `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Modernization is not a separate decision system”.
- **ARCH-LOCK-003.** Required decision consequences and activation form one crash-consistent transaction. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision consequences and governance basis”.
- **RISK-LOCK-001.** R4 is never autonomous in 1.x, and uncertainty is monotonic with respect to risk/approval. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.


### Governance, Projections, Runtime, and Representations


- **GOV-LOCK-001** — Semantic scope is primary; path is only a bootstrap dimension. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Scope algebra, selectors, and layered ignore policy”.
- **GOV-LOCK-002** — Ignore policy is role-specific rather than global. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Layered ignore policy”.
- **RULE-LOCK-001** — Governance authority ordering is fixed to the nine-level order in RULE-012, and specificity cannot cross authority levels. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Composition order”.
- **LENS-LOCK-001** — Pattern Candidates are observations, not authority; only governed active lenses impose projection behavior. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Pattern Candidate”; “Projection Lens contract”.
- **PROJ-LOCK-001** — Hash equality without an explicit profile and sufficient assurance is not proof. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Derivations, semantic signatures, and proof groups”; “Backdating eligibility”.
- **INVAL-LOCK-001** — Exact derivation invalidation precedes and remains distinct from Impact-Rule widening. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic invalidation and correctness oracles”; “Impact Rules”.
- **PROJ-LOCK-002** — Generated repair is upstream-first; direct downstream edits are exceptional migration debt. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Repair routing and upstream-first generated repair”.
- **CAPS-LOCK-001** — Structured semantic capsule fields remain authoritative; prose rendering is only an optimization. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- **RUNTIME-LOCK-001** — Observation is no-exec by default, and execution requires an explicit scoped capability. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- **REPR-LOCK-001** — Canonical semantic entities remain authoritative over all generated representations. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.


### Reconciliation, Coverage, Change, Plans, and Transactions


- Canonical mutation is coordinator-owned and single-writer per governed worktree (`TXN-001`, `TXN-003`–`TXN-006`).
- Coverage proof is boundary- and observability-sensitive; unknown, failed, stale, sampled, open, or unavailable required lanes cannot be erased to claim proof, and analyzer failures cannot invalidate independent proofs (`COVR-002`, `COVR-005`–`COVR-007`, `COVR-026`).
- Reconciliation is digest-driven, fixed-point aware, and cannot let incidental evaluation order resolve cycles (`RECN-001`, `RECN-003`–`RECN-009`).
- Semantic identity, Relevance Closure, behavior/constraint delta, architecture preflight, Impact Closure, and state binding precede governed mutation (`CHNG-002`, `CHNG-003`, `CHNG-013`–`CHNG-019`, `CHNG-031`, `CHNG-035`, `PLAN-001`).
- Plans are immutable, dependency-scoped revisions; global snapshot drift alone is not semantic staleness (`PLAN-011`, `PLAN-015`–`PLAN-022`, `TXN-012`).
- Planning surprises never silently enlarge authority or become canonical truth (`RECN-022`, `CHNG-042`, `CHNG-043`).
- Canonical governance merge/rebase conflicts are blocking in Govern/Autonomous modes (`PLAN-023`, `TXN-018`).
- Transaction durability spans workspace, Git, external operations, and canonical state; receipts and certificates provide distinct proof artifacts (`TXN-008`–`TXN-010`, `CERT-001`–`CERT-008`).


### Agents, Hosts, Evolution, Persistence, Observation, and Research


- **HOST-016** — Capability reporting, not host-brand branching, is the locked abstraction boundary for host integration. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Capability model”.
- **AGNT-016** — Logical orchestration roles are provider-neutral and authority remains outside silent agent action. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Logical roles”; “Agent authority restrictions”.
- **MODEL-020** — Model inference is replayable through recorded artifacts but is not deterministic computation; canonical promotion is a separate deterministic/authorized boundary. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Model provider and replayable inference”; “Promotion boundary”.
- **PERS-014** — Fine-grained canonical files are authoritative and SQLite is rebuildable derived/index state. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “SQLite is derived state”; “Canonical rebuild invariant”.
- **OBSV-018** — Repository observation is no-exec by default, with explicit command/validator policy as the only execution gate. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”.
- **SURF-012** — External state enters deterministic reasoning only through pinned observation revisions, never as implicit live state. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “External snapshots”.
- **EVOL-016** — Modernization reuses Architecture Concern and decision-governance machinery instead of introducing an independent ranking authority. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Fashion resistance”.
- **RSCH-007** — Research is concern-scoped, freshness-sensitive evidence, not ambient authority. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.


### CLI, Security, Operation, Testing, Evaluation, and Benchmarks


- Modes are policy presets, never alternate semantic interpretations: **MODE-001**, **MODE-012**.
- Observe is read-only and Guide is the post-`init` default: **MODE-002**, **MODE-004**.
- Salvage never weakens approval or proof requirements: **MODE-011**.
- R4 is never autonomous in 1.x: **SEC-022**.
- Authorization is dependency/query-result bound, not invalidated solely by a global digest change: **SEC-026**–**SEC-029**.
- Sensitive data prevention occurs before model context/rendering; log redaction alone is insufficient: **SEC-003**–**SEC-005**.
- Canonical repository paths are POSIX-style relative paths resolved through a root-constrained utility: **SEC-006**–**SEC-012**.
- Failed validation never auto-merges a worktree, and remote transforms are disabled by default: **SEC-023**, **SEC-024**.
- Correctness and semantic preservation constrain token optimization: **METR-044**, **BENCH-047**–**BENCH-049**.
- Default tests do not depend on paid models or installed Codex/Claude hosts; live evaluation is opt-in and supplementary: **EVAL-037**, **EVAL-043**–**EVAL-047**.
- Held-out and mutation-generated evidence is required before broad accuracy claims: **EVAL-002**, **EVAL-003**, **BENCH-050**.


### Delivery Slices, Acceptance, Release, Dogfooding, and Handoff


- **DELV-011** The vertical-slice-first sequence and all Slice 0–12 deliverables are locked committed v1 scope; implementation MUST NOT reinterpret later slices as deferred or v2 work. Source: `.planning/PROJECT.md` — “Constraints / Complete committed scope” and “Key Decisions”.
- **DELV-012** The mandatory misplaced-script loop is the first broadening gate and MUST pass before broad analyzers, host integration, modernization, or external surfaces. Source: `.planning/PROJECT.md` — “Requirements / Active” and `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.
- **DELV-013** Completion means the entire specified system passes release and redesign gates, governs its own repository, imports GSD bootstrap state, and continues without GSD; the first slice alone is not project completion. Source: `.planning/PROJECT.md` — “Context”.
- **DELV-014** Source deletion is an audited semantic migration, not file cleanup; an exact checksummed source snapshot MUST remain available as migration evidence until full GSD re-expression and equivalence gates pass. Source: `.planning/PROJECT.md` — “Context” and “Key Decisions”.
- **DELV-015** GSD is a removable bootstrap dependency and MUST NOT remain a permanent runtime or development dependency after the self-hosting handoff. Source: `.planning/PROJECT.md` — “Key Decisions”.


## v2 Requirements

(None. The full authoritative specification is committed v1 scope.)

## Out of Scope

### Product and Semantic Kernel


- **PROD-NG-001.** Projector 1.x does not promise formal verification of arbitrary business logic.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-002.** It does not promise perfect recovery of intent that left no evidence.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-003.** It does not promise a universal ontology.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-004.** It does not promise ownership of all source bytes.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-005.** It does not promise universal support for all languages.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-006.** It does not promise autonomous destructive production changes.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-007.** It does not promise automatic acceptance of contested architecture.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-008.** It does not require a graph database.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-009.** It does not promise one monolithic canonical semantic document that must be loaded or rewritten as a unit.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-010.** It does not promise a repository/package tree serving as the semantic ontology or context-retrieval boundary.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-011.** It does not promise a conventional spec-folder workflow whose correctness depends on agents voluntarily discovering relevant documents.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-012.** It does not require hosted SaaS.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-013.** It does not require visual modeling.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-014.** It does not promise automatic rewriting of arbitrary handwritten line ranges.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-015.** It does not replace compilers, tests, static analysis, security review, or human product judgment.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-016.** It does not canonicalize every repeated style detail.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-017.** It does not promise treating controlled technical prose, compressed agent language, or generated host instructions as canonical semantic authority.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-018.** It does not prove arbitrary natural-language equivalence from compression or paraphrase alone.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **PROD-NG-019.** It does not lock in one model vendor or agent host.  
  Source: `01-product/principles-and-non-goals.md` — “Explicit non-goals”
- **KERN-NG-001.** Initial implementation MUST NOT require a graph database.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”
- **KERN-NG-002.** Initial implementation MUST NOT require a daemon.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”
- **KERN-NG-003.** Initial implementation MUST NOT require a message broker.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”
- **KERN-NG-004.** Initial implementation MUST NOT require a hosted service.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”
- **KERN-NG-005.** Initial implementation MUST NOT require embeddings for initial clustering.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”
- **KERN-NG-006.** Initial implementation MUST NOT require generic Tree-sitter before the TypeScript/structured-data vertical slice works.  
  Source: `02-semantic-kernel/reference-implementation.md` — “Technology choices”


### Knowledge, Relevance, Evidence, Architecture, and Risk


- **KNOW-NG-001.** Relevance discovery is not top-N document/vector retrieval, full-repository context loading, or whole-graph serialization. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Purpose”, “Relevance expansion”.
- **KNOW-NG-002.** Relevance Scout, semantic similarity, model inference, Analysis Facets, aliases, and tests do not independently create behavioral intent, exact derivation edges, governance, canonical identity, or authority. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “WHAT / WHY, WHERE / WHAT-ELSE, and HOW”, “Semantic identity resolution”, “Relevance expansion”, “Analysis Facets”, “Requirements, scenarios, and executable behavior”.
- **KNOW-NG-003.** Progressive disclosure is not filesystem-directory selection and does not permit silent loss of material low-confidence or unavailable-lane context. Source: `PROJECTOR_SPEC/03-knowledge/relevance-and-change-cognition.md` — “Relevance expansion”, “Closure-bound discovery dependencies”, “Progressive disclosure and context selection”.
- **EVID-NG-001.** Untrusted source content cannot grant permissions or modify orchestration policy, and Projector-generated conformance cannot manufacture its own authority. Source: `PROJECTOR_SPEC/03-knowledge/evidence-and-authority.md` — “Evidence contract”, “Independence and causal origin”.
- **ARCH-NG-001.** Architecture concern discovery does not preselect monorepos, package managers, build tools, runtimes, mobile frameworks, or API styles. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Concern discovery”.
- **ARCH-NG-002.** `suspect` decision validity is not proof that the prior decision is wrong and does not itself require migration. Source: `PROJECTOR_SPEC/03-knowledge/architecture-concerns-and-validity.md` — “Decision validity and dirtying”.
- **ARCH-NG-003.** Research refresh is not automatic on elapsed time and does not automatically mandate migration. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Current research and evidence freshness”.
- **ARCH-NG-004.** Preferences are not invisible architecture law, objective probability, or blocking constraints unless explicitly promoted into a constraint/decision. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Developer and organization preferences”.
- **ARCH-NG-005.** Deferral is not permission to hide architecture commitment in a temporary guardrail. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision deferral and option preservation”.
- **ARCH-NG-006.** Modernization is not a separate architecture decision system. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Modernization is not a separate decision system”.
- **ARCH-NG-007.** Package location alone is not a proxy for architecture-decision relevance. Source: `PROJECTOR_SPEC/03-knowledge/architecture-evidence-and-consequences.md` — “Decision explainability and self-audit”.
- **RISK-NG-001.** Risk is not intrinsic to a file/transform, physical reversibility alone does not determine governance risk, and contradictory policy inputs do not use implicit precedence. Source: `PROJECTOR_SPEC/03-knowledge/risk-and-execution-policy.md` — “Risk, approval, and execution policy”.


### Governance, Projections, Runtime, and Representations


- **GOV-NG-001** — Arbitrary executable selector code is out of scope. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Scope algebra, selectors, and layered ignore policy”.
- **GOV-NG-002** — Global graph-revision invalidation of all selector/rule caches is not the primary cache model. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Selector dependency keys”.
- **RULE-NG-001** — The rule kernel is not a general theorem prover. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Rule kernel, composition, and governance evaluation”.
- **RULE-NG-002** — Opaque advisory prose/data is not an independent blocking or override mechanism. Source: `PROJECTOR_SPEC/04-governance/scope-and-rules.md` — “Blocking predicate kernel”.
- **LENS-NG-001** — A prose-only architecture description is not an active Projection Lens. Source: `PROJECTOR_SPEC/04-governance/lenses.md` — “Projection Lens contract”.
- **PROJ-NG-001** — Heuristic equality is not sufficient proof for downstream backdating. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Backdating eligibility”.
- **INVAL-NG-001** — Pre-change Relevance Closure is not an invalidation substitute, and weak inferred relations are not exact dependency edges. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Semantic invalidation and correctness oracles”; “Impact Rules”.
- **INVAL-NG-002** — A correlated clean rebuild is not by itself proof of business correctness, and the three oracle classes are not interchangeable. Source: `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` — “Independent conformance oracle”; “Historical/metamorphic oracle”.
- **CAPS-NG-001** — Repository-directory proximity and unconditional project-wide semantic dumps are not valid capsule-context compilation strategies. Source: `PROJECTOR_SPEC/05-projections/execution-capsules.md` — “Execution Capsules”.
- **RUNTIME-NG-001** — Validator intent does not make workspace/external side effects harmless. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Declared command/validator contract”.
- **REPR-NG-001** — Generated Behavioral/Gherkin files are not parallel semantic authority. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.
- **REPR-NG-002** — Character counts are not a substitute for relevant tokenizer measurements when the choice affects optimization, and repeated compression with non-positive expected savings is out of scope. Source: `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` — “Representation compilation and fidelity validation”.


### Reconciliation, Coverage, Change, Plans, and Transactions


- **CHNG-044** — The compiler is not a request-to-file-edit shortcut and does not assume user wording identifies canonical entities or locations (`CHNG-001`, `CHNG-003`). **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Purpose”.
- **CHNG-045** — The Relevance Scout does not select implementation HOW, authorize mutation, or elevate descriptive precedent into behavioral requirements (`CHNG-010`, `CHNG-012`). **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Relevance Scout”.
- **CHNG-046** — Generated human-readable/Gherkin representations are not the durable canonical semantic store (`CHNG-016`, `CHNG-022`). **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Identity resolution and Relevance Closure”; “Requirement and scenario delta”.
- **CHNG-047** — Analysis Facet activation does not itself choose technology or create hard rules (`CHNG-029`). **Source:** `PROJECTOR_SPEC/07-change/semantic-change-compiler.md` — “Analysis Facet activation”.
- **PLAN-024** — Version 1.x does not require automatic semantic Git conflict resolution or automatic semantic merge; canonical-governance conflicts remain blocking (`PLAN-023`, `TXN-018`). **Source:** `PROJECTOR_SPEC/07-change/plans.md` — “Cleanup plans, immutable revisions, and rebase”; `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Integration rules”.
- **CERT-009** — Ordinary scans/observations do not produce committed transaction receipts (`CERT-004`). **Source:** `PROJECTOR_SPEC/07-change/transactions-and-certificates.md` — “Transaction receipt”.


### Agents, Hosts, Evolution, Persistence, Observation, and Research


- **HOST-017** — Level-1 host integration is not intended to imply lifecycle or programmatic-orchestration guarantees unsupported by the host. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Integration levels”.
- **HOST-018** — Generated prose instructions and style/token lints are not an enforcement mechanism or semantic-equivalence proof. Source: `PROJECTOR_SPEC/08-agents/hosts-and-mcp.md` — “Generated host instructions”.
- **AGNT-017** — Agent self-report is not a completion authority, and same-packet evidence is not sufficient independent proof where policy requires independence. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Validation independence”; “Completion is a verified state”.
- **MODEL-021** — Byte-identical replay of an unchanged model call is not required, and a differing resample is not permission to rewrite canonical architecture. Source: `PROJECTOR_SPEC/08-agents/orchestration-and-models.md` — “Inference artifact cache”; “Promotion boundary”.
- **EVOL-017** — Modernization is not a technology-first recommendation system and does not maintain a separate architecture-ranking system. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Recommendation contract”; “Fashion resistance”.
- **SURF-013** — Broad external adapters are not part of the initial local correctness kernel, and read-only/unavailable APIs are not to be presented as writable. Source: `PROJECTOR_SPEC/09-evolution/modernization-and-surfaces.md` — “Surface adapters and external observation snapshots”.
- **PERS-015** — The rebuild oracle does not prove independent correctness of the software, and Projector does not require a monolithic canonical model document. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “SQLite is derived state”; “Canonical rebuild invariant”.
- **OBSV-019** — Deterministic inventory is not authorization to execute repository code, and unsupported syntax in one capability is not grounds to abort unrelated analysis. Source: `PROJECTOR_SPEC/09-evolution/persistence-and-observation.md` — “Analyzer contract”; “Required semantic analyzer outputs”.
- **EVOL-018** — Co-change alone is not an exact dependency, Impact Rule, authority claim, or independent evidence for Projector-induced migrations. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Historical and metamorphic evaluation”.
- **RSCH-008** — External research is not a periodic repository-wide best-practices crawl, and offline operation must not fabricate rationale. Source: `PROJECTOR_SPEC/09-evolution/historical-evaluation-and-research.md` — “Research boundary”.


### CLI, Security, Operation, Testing, Evaluation, and Benchmarks


- HTML/graph UI is optional post-core and is not a v1 required report surface. Source: `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`.
- Modes do not create separate semantic behavior. Source: **MODE-001**.
- Changing modes does not change repository meaning. Source: **MODE-012**.
- Salvage is not a mechanism for weakening approval or proof. Source: **MODE-011**.
- Post-hoc log redaction is not a substitute for preventing model disclosure. Source: **SEC-005**.
- A changed global `StateDigest` is not, by itself, automatic authorization invalidation. Source: **SEC-028**.
- Maximum modeling is not the optimization target. Source: **METR-045**.
- Shorter output is not rewarded when semantic content is lost. Source: **METR-044**.
- Fixture-only success is not sufficient evidence for broad accuracy claims. Source: **BENCH-050**.
- Live-model/provider evaluation is not the sole test of semantic behavior. Source: **EVAL-047**.


### Delivery Slices, Acceptance, Release, Dogfooding, and Handoff


- **DELV-016** Package-completion planning is prohibited; delivery is by complete causal vertical slices. Source: `.planning/PROJECT.md` — “Constraints / Vertical delivery”.
- **DELV-017** Visualization, broad cloud adapters, and a universal semantic model are not valid starting points before the mandatory vertical slice passes. Source: `PROJECTOR_SPEC/12-delivery/first-vertical-slice.md` — “Mandatory first vertical slice”.
- **DELV-018** Broad analyzers are not Slice 0 scope. Source: `PROJECTOR_SPEC/12-delivery/implementation-plan.md` — “Slice 0”.
- **DELV-019** External surfaces are not permitted before the local kernel is credible. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Slice 12 — External surfaces”.
- **DELV-020** A Markdown-, prompt-, static-graph-, or advice-primary release is explicitly insufficient. Source: `PROJECTOR_SPEC/12-delivery/release-and-directive.md` — “Minimum credible public release”.
- **DELV-021** Fixture-specific names are not an acceptable mechanism for architecture concern-discovery success. Source: `PROJECTOR_SPEC/12-delivery/acceptance-architecture.md` — “Held-out concern-discovery robustness”.
- **DELV-022** Golden-fixture memorization is not an acceptable benchmark strategy; held-out mutation-generated generalization is required. Source: `PROJECTOR_SPEC/12-delivery/acceptance-core.md` — “Held-out/mutation-generated benchmark”.


## Source Coverage

Every H1, H2, and H3 heading in the 44 authoritative inputs is mapped below to requirement, constraint, decision, non-goal, or retained context IDs. `INDEX.md` and generated `PROJECTOR_SPEC.md` were intentionally excluded because they have no independent authority.

### Product and Semantic Kernel


Every assigned H1/H2/H3 is mapped below. `CONTEXT` means the heading contains framing/definitions rather than an additional obligation; its unique context is retained in the cited requirement or locked item.

### `SPEC.md`

- `# Projector: Projection-Driven Development` → CORE-LOCK-001
- `## Authoritative Implementation Specification` → CORE-001, CORE-LOCK-001
- `## Authority and composition` → CORE-002, CORE-003
- `## Product thesis` → CORE-004
- `## Global causal loop` → CORE-005
- `## Semantic architecture at a glance` → CORE-006
- `## Core invariants` → CORE-007
- `## Progressive-disclosure reading routes` → CORE-LOCK-002
- `## Delivery rule` → CORE-008

### `01-product/vision-and-north-star.md`

- `# Vision and North-Star Behavior` → CONTEXT: product north star retained by PROD-001–010
- `## Executive summary` → PROD-010, PROD-033, PROD-LOCK-001, PROD-LOCK-002
- `## North-star product behavior` → CONTEXT: command-centered acceptance frame retained by PROD-001–009
- `## Zero-ceremony initialization` → PROD-001, PROD-002
- `## Explain any governed target` → PROD-003
- `## Audit at any time` → PROD-004
- `## Reconcile arbitrary agent work` → PROD-005
- `## Compile and execute semantic changes` → PROD-006
- `## Complete semantic coverage progressively` → PROD-007
- `## Recommend and execute modernization` → PROD-008
- `## Progressively disclose architecture decisions` → PROD-009

### `01-product/principles-and-non-goals.md`

- `# Normative Principles and Non-Goals` → CONTEXT: normative force retained in fragment preamble
- `## Normative principles` → CONTEXT: RFC-style keyword force retained in fragment preamble
- `## Value before declaration` → PROD-001
- `## Evidence before authority` → PROD-011
- `## Canonical intent and derived state are different things` → PROD-012
- `## Deterministic first` → PROD-013
- `## AI at the uncertainty frontier` → PROD-013
- `## Optimization is assurance-bound` → PROD-014
- `## Exactness without false certainty` → PROD-015
- `## Semantic precedent over textual proximity` → PROD-LOCK-003
- `## No manual synchronization ceremony` → PROD-016
- `## Accepted knowledge compounds without becoming self-justifying` → PROD-017
- `## No ontology cathedral` → PROD-018
- `## Generation may be aggressive. Acceptance is governed` → PROD-019
- `## Correctness uses layered oracles` → PROD-020
- `## Semantic transactions are state-bound and crash-consistent` → PROD-021
- `## Governance must terminate` → PROD-022
- `## Progressive architecture commitment` → PROD-023
- `## Decisions explain governance consequences` → PROD-024
- `## Preferences inform. Constraints govern` → PROD-025
- `## Meaning is authoritative. Encoding is derived` → PROD-026
- `## Optimize instruction efficiency, not token count alone` → PROD-027
- `## Resolve identity before creating semantics` → PROD-028
- `## Relevance precedes impact` → PROD-029
- `## Encapsulation owns. Traversal retrieves` → PROD-030
- `## Behavior is canonical. Spec encodings are projections` → PROD-031
- `## Snapshot identity is not local validity` → PROD-032
- `## Explicit non-goals` → PROD-NG-001–019

### `02-semantic-kernel/architecture-decision-contracts.md`

- `# Architecture Decision Contracts` → KERN-027–031
- `## Architecture concern, decision, preference, and governance-basis contracts` → KERN-027–031

### `02-semantic-kernel/canonical-state.md`

- `# Canonical State` → KERN-012–020
- ``## `.projector/` canonical contract`` → KERN-012
- `## Canonical content` → KERN-013, KERN-014
- `## Canonical schema requirements` → KERN-015
- `## Canonical semantic addressability` → KERN-016, KERN-017
- `## Canonical locality and relations` → KERN-018
- `## Version-control defaults` → KERN-019
- `## Rebuild inputs` → KERN-020

### `02-semantic-kernel/conceptual-architecture.md`

- `# Conceptual Architecture` → CORE-006, KERN-021–026
- `## Conceptual architecture` → CORE-006
- `## Intent plane` → KERN-LOCK-001
- `## Lens plane` → KERN-LOCK-001
- `## Surface plane` → KERN-LOCK-001
- `## Observed shadow graph` → KERN-LOCK-001
- `## Governance strata` → KERN-021
- `## Correctness oracles` → KERN-022
- `## Architecture decision lifecycle` → KERN-023
- `## Change cognition: relevance before impact` → KERN-024
- `## Semantic ownership and retrieval topology` → PROD-030
- `## Semantic representation projections` → KERN-025, KERN-026

### `02-semantic-kernel/identity-and-relations.md`

- `# Identity, Concepts, and Relations` → KERN-001–011
- `## Core contract authority` → KERN-001
- `## Base identity, source class, and semantic hashing` → KERN-002–005
- `## Concepts and factual relations` → KERN-006–011

### `02-semantic-kernel/reference-implementation.md`

- `# Reference Implementation Architecture` → KERN-051–053, KERN-LOCK-002–003, KERN-NG-001–006
- `## Reference implementation architecture` → KERN-051, KERN-056
- `## Repository/package layout` → KERN-052, KERN-LOCK-002
- `## Technology choices` → KERN-053, KERN-LOCK-003, KERN-NG-001–006

### `02-semantic-kernel/representation-contracts.md`

- `# Semantic Representation Contracts` → KERN-032–038
- `## Semantic representation contracts` → KERN-032, KERN-033
- ``### `human-technical@1``` → KERN-034
- ``### `behavior-gherkin@1``` → KERN-035
- ``### `agent-compact@1``` → KERN-036
- ``### `machine-invariant@1``` → KERN-037
- `## Contract completeness gate` → KERN-038

### `02-semantic-kernel/state-binding-and-ports.md`

- `# State Binding and Core Ports` → KERN-042–050
- `## State binding and execution primitives` → KERN-042–048
- `## Analyzer, graph, runtime, and surface ports` → KERN-049
- `## Lens/validator/transform supporting contracts` → KERN-050

### `02-semantic-kernel/surfaces-and-projection-units.md`

- `# Surfaces and Projection Units` → KERN-039–041
- `## Surfaces, observability, and artifacts` → KERN-039
- `## Stable semantic anchors, control policy, and Projection Units` → KERN-040, KERN-041

### `02-semantic-kernel/terminology-and-source-classes.md`

- `# Terminology and Source Classes` → KERN-054, KERN-055
- `## Canonical terminology` → KERN-055
- `## Four source classes` → KERN-054
- `## Authored` → KERN-054
- `## Derived` → KERN-054
- `## Observed` → KERN-054
- `## Inferred` → KERN-054

### Knowledge, Relevance, Evidence, Architecture, and Risk


Every authoritative H1/H2/H3 heading is mapped below; `CONTEXT` means the heading contributes framing retained in the listed locked rule and/or child requirements rather than a separate normative obligation.

| Source heading | Requirement IDs or retained context |
|---|---|
| `architecture-concerns-and-validity.md` — H1 “Architecture Concerns and Decision Validity” | CONTEXT: ARCH-004–ARCH-020, ARCH-LOCK-002 |
| H2 “Architecture preflight” | ARCH-004–ARCH-006, ARCH-LOCK-002 |
| H2 “Concern discovery” | ARCH-007–ARCH-011, ARCH-NG-001 |
| H2 “Materiality and progressive disclosure” | ARCH-012–ARCH-015 |
| H2 “Decision validity and dirtying” | ARCH-016–ARCH-018, ARCH-NG-002 |
| H2 “Scope-specific coexistence and supersession” | ARCH-019–ARCH-020 |
| `architecture-decisions.md` — H1 “Progressive Architecture Commitment” | ARCH-001–ARCH-003, ARCH-LOCK-001 |
| `architecture-evidence-and-consequences.md` — H1 “Architecture Evidence, Preferences, and Consequences” | CONTEXT: ARCH-021–ARCH-041 |
| H2 “Current research and evidence freshness” | ARCH-021–ARCH-025, ARCH-NG-003 |
| H2 “Developer and organization preferences” | ARCH-026–ARCH-029, ARCH-NG-004 |
| H2 “Decision deferral and option preservation” | ARCH-030–ARCH-031, ARCH-NG-005 |
| H2 “Decision consequences and governance basis” | ARCH-032–ARCH-035, ARCH-LOCK-003 |
| H2 “Decision dependencies and convergence” | ARCH-036–ARCH-037 |
| H2 “Modernization is not a separate decision system” | ARCH-038, ARCH-LOCK-002, ARCH-NG-006 |
| H2 “Decision explainability and self-audit” | ARCH-039–ARCH-041, ARCH-NG-007 |
| `evidence-and-authority.md` — H1 “Evidence and Authority” | CONTEXT: EVID-001–EVID-012, EVID-LOCK-001 |
| H2 “Evidence and authority” | EVID-001 |
| H2 “Evidence contract” | EVID-002–EVID-004, EVID-NG-001 |
| H2 “Independence and causal origin” | EVID-005–EVID-006, EVID-LOCK-001, EVID-NG-001 |
| H2 “Authority vector” | EVID-007–EVID-008, EVID-LOCK-001 |
| H2 “Typed reconsideration triggers” | EVID-009–EVID-010 |
| H2 “Authority records” | EVID-011–EVID-012, EVID-LOCK-001 |
| `relevance-and-change-cognition.md` — H1 “Relevance and Change Cognition” | CONTEXT: KNOW-001–KNOW-037, KNOW-LOCK-001–KNOW-LOCK-002 |
| H2 “Purpose” | KNOW-001–KNOW-002, KNOW-LOCK-001, KNOW-NG-001 |
| H2 “WHAT / WHY, WHERE / WHAT-ELSE, and HOW” | KNOW-003–KNOW-005, KNOW-NG-002 |
| H2 “Semantic identity resolution” | KNOW-006–KNOW-012, KNOW-LOCK-002 |
| H2 “Relevance seeds and bands” | KNOW-013–KNOW-015 |
| H2 “Relevance expansion” | KNOW-016–KNOW-019, KNOW-NG-001, KNOW-NG-003 |
| H3 “Closure-bound discovery dependencies” | KNOW-020–KNOW-022, KNOW-NG-003 |
| H2 “Progressive disclosure and context selection” | KNOW-023–KNOW-024, KNOW-NG-003 |
| H2 “Analysis Facets” | KNOW-025–KNOW-026, KNOW-LOCK-002, KNOW-NG-002 |
| H2 “Event and contract topology as relevance routers” | KNOW-027–KNOW-028 |
| H2 “Requirements, scenarios, and executable behavior” | KNOW-029–KNOW-030, KNOW-LOCK-002, KNOW-NG-002 |
| H2 “Relevance quality and omission pressure” | KNOW-031 |
| H2 “Predicted-versus-observed impact and Planning Surprises” | KNOW-032–KNOW-034 |
| H2 “Relevance algorithm” | KNOW-035–KNOW-037, KNOW-LOCK-001 |
| `risk-and-execution-policy.md` — H1 “Risk, Approval, and Execution Policy” | CONTEXT: RISK-001–RISK-007, RISK-LOCK-001, RISK-NG-001 |
| H2 “Risk, approval, and execution policy” | RISK-001–RISK-007, RISK-LOCK-001, RISK-NG-001 |

### Governance, Projections, Runtime, and Representations


Every source H1/H2/H3 heading is mapped below; `CONTEXT` means the heading introduces or groups requirements captured under a nearer child heading.

| Source | Heading | Mapping |
|---|---|---|
| `PROJECTOR_SPEC/04-governance/lenses.md` | H1 “Pattern Candidates and Projection Lenses” | CONTEXT: LENS-001–LENS-016 |
| `PROJECTOR_SPEC/04-governance/lenses.md` | H2 “Pattern Candidate and Projection Lens” | CONTEXT: LENS-001–LENS-016 |
| `PROJECTOR_SPEC/04-governance/lenses.md` | H2 “Pattern Candidate” | LENS-001–LENS-002, LENS-NG-001 |
| `PROJECTOR_SPEC/04-governance/lenses.md` | H2 “Lens contribution roles” | LENS-003–LENS-005 |
| `PROJECTOR_SPEC/04-governance/lenses.md` | H2 “Projection expectation kinds” | LENS-006–LENS-007 |
| `PROJECTOR_SPEC/04-governance/lenses.md` | H2 “Projection Lens contract” | LENS-008–LENS-016, LENS-LOCK-001, LENS-NG-001 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H1 “Scope, Selectors, and Rules” | CONTEXT: GOV-001–GOV-019, RULE-001–RULE-026 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Scope algebra, selectors, and layered ignore policy” | GOV-001, GOV-LOCK-001, GOV-NG-001 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Selector expression” | GOV-002–GOV-010 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Selector dependency keys” | GOV-011–GOV-016, GOV-NG-002 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Layered ignore policy” | GOV-017–GOV-019, GOV-LOCK-002 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Rule kernel, composition, and governance evaluation” | RULE-001, RULE-NG-001 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Rule effects and authority classes” | RULE-002–RULE-003 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Blocking predicate kernel” | RULE-004–RULE-009, RULE-NG-002 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Effective rule bundle” | RULE-010–RULE-011 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Composition order” | RULE-003, RULE-012–RULE-014, RULE-LOCK-001 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Hard conflicts” | RULE-015–RULE-019 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Rule products” | RULE-020–RULE-021 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Stratified evaluation and recursion” | RULE-022–RULE-025 |
| `PROJECTOR_SPEC/04-governance/scope-and-rules.md` | H2 “Rule pressure” | RULE-026 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H1 “Derivations, Invalidation, and Repair Routing” | CONTEXT: PROJ-001–PROJ-020, INVAL-001–INVAL-024 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Derivations, semantic signatures, and proof groups” | PROJ-001, PROJ-LOCK-001 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Derivation inputs” | PROJ-002–PROJ-003 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Signature profiles” | PROJ-004–PROJ-005, INVAL-001 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Backdating eligibility” | PROJ-006–PROJ-007, PROJ-NG-001 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Derivation cycles” | PROJ-008–PROJ-013 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Semantic invalidation and correctness oracles” | INVAL-002–INVAL-004, INVAL-LOCK-001, INVAL-NG-001 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Impact Rules” | INVAL-005–INVAL-009, INVAL-LOCK-001, INVAL-NG-001 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Invalidation causes and result” | INVAL-010–INVAL-013 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Invalidation algorithm” | INVAL-014–INVAL-015 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Semantic backdating” | INVAL-016–INVAL-017 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Rebuild oracle” | INVAL-018–INVAL-019 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Independent conformance oracle” | INVAL-020–INVAL-022, INVAL-NG-002 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Historical/metamorphic oracle” | INVAL-023–INVAL-024, INVAL-NG-002 |
| `PROJECTOR_SPEC/05-projections/derivations-and-invalidation.md` | H2 “Repair routing and upstream-first generated repair” | PROJ-014–PROJ-020, PROJ-LOCK-002 |
| `PROJECTOR_SPEC/05-projections/execution-capsules.md` | H1 “Execution Capsules” | CONTEXT: CAPS-001–CAPS-017 |
| `PROJECTOR_SPEC/05-projections/execution-capsules.md` | H2 “Execution Capsules” | CAPS-001–CAPS-017, CAPS-LOCK-001, CAPS-NG-001 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H1 “Deterministic Runtime and Representation Validation” | CONTEXT: RUNTIME-001–RUNTIME-017, REPR-001–REPR-022 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Deterministic runtime and validator execution” | CONTEXT: RUNTIME-001–RUNTIME-017 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Caveman primitives” | RUNTIME-001–RUNTIME-003 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Transform contract” | RUNTIME-004–RUNTIME-009 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Declared command/validator contract” | RUNTIME-010–RUNTIME-014, RUNTIME-LOCK-001, RUNTIME-NG-001 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Transform composition” | RUNTIME-015–RUNTIME-017 |
| `PROJECTOR_SPEC/05-projections/runtime-and-representations.md` | H2 “Representation compilation and fidelity validation” | REPR-001–REPR-022, REPR-LOCK-001, REPR-NG-001–REPR-NG-002 |

### Reconciliation, Coverage, Change, Plans, and Transactions


Every H1/H2/H3 source heading is mapped below. `CONTEXT` means the heading contributes scope/organization but contains no additional unique normative statement beyond the cited child headings.

| Source heading | Requirement IDs or disposition |
|---|---|
| `06-reconciliation/coverage-and-completion.md` — H1 “Coverage and Progressive Completion” | CONTEXT: aggregate scope retained by COVR-001–COVR-026 |
| H2 “Coverage, observability, and proof boundaries” | COVR-001–COVR-004 |
| H2 “`proven-within-boundary`” | COVR-005–COVR-006 |
| H2 “Analyzer failure degradation” | COVR-007, COVR-026 |
| H2 “Complete-within-boundary definition” | COVR-008–COVR-019 |
| H2 “Maximum-information-gain completion” | COVR-020–COVR-025 |
| `06-reconciliation/reconciliation-and-divergence.md` — H1 “Reconciliation, Divergence, Exceptions, and Migrations” | CONTEXT: aggregate scope retained by RECN-001–RECN-030 |
| H2 “Reconciliation, convergence, and divergence” | CONTEXT: section umbrella; unique meaning retained in its child headings RECN-001–RECN-022 |
| H2 “Reconciliation loop” | RECN-001–RECN-002 |
| H2 “Termination” | RECN-003–RECN-009 |
| H2 “Divergence taxonomy” | RECN-010–RECN-011 |
| H2 “Divergence contract” | RECN-012–RECN-014 |
| H2 “Planning Surprise reconciliation” | RECN-015–RECN-022 |
| H2 “Exceptions and migrations” | CONTEXT: section umbrella; unique meaning retained in RECN-023–RECN-030 |
| H2 “Exceptions” | RECN-023–RECN-026 |
| H2 “Migration overlays” | RECN-027–RECN-030 |
| `07-change/semantic-change-compiler.md` — H1 “Semantic Change Compiler” | CONTEXT: aggregate scope retained by CHNG-001–CHNG-049 and PLAN-001–PLAN-009 |
| H2 “Purpose” | CHNG-001–CHNG-003, CHNG-044 |
| H2 “Intent analysis” | CHNG-004–CHNG-009 |
| H2 “Relevance Scout” | CHNG-010–CHNG-012, CHNG-045 |
| H2 “Identity resolution and Relevance Closure” | CHNG-013–CHNG-016, CHNG-046 |
| H2 “Requirement and scenario delta” | CHNG-017–CHNG-022, CHNG-046 |
| H2 “Change contracts” | CHNG-023–CHNG-027 |
| H2 “Analysis Facet activation” | CHNG-028–CHNG-030, CHNG-047 |
| H2 “Architecture preflight” | CHNG-031–CHNG-034 |
| H2 “Impact Closure” | CHNG-035–CHNG-040, CHNG-048 |
| H2 “Plan construction” | PLAN-001–PLAN-009 |
| H2 “Post-implementation reverse impact” | CHNG-041–CHNG-043, CHNG-049 |
| `07-change/plans.md` — H1 “Plans, Revisions, and Rebase” | CONTEXT: aggregate scope retained by PLAN-010–PLAN-024 |
| H2 “Cleanup plans, immutable revisions, and rebase” | PLAN-010–PLAN-024 |
| `07-change/transactions-and-certificates.md` — H1 “Work Packets, Transactions, and Certificates” | CONTEXT: aggregate scope retained by TXN-001–TXN-018 and CERT-001–CERT-009 |
| H2 “Work packets, writer coordination, and crash-consistent transactions” | TXN-001–TXN-002 |
| H2 “Writer lease” | TXN-003–TXN-006 |
| H2 “Transaction journal” | TXN-007–TXN-010 |
| H2 “Integration rules” | TXN-011–TXN-018, PLAN-024 |
| H2 “Transaction receipts and change certificates” | CERT-001 |
| H2 “Transaction receipt” | CERT-002–CERT-004, CERT-009 |
| H2 “Change certificate” | CERT-005–CERT-008 |

### Agents, Hosts, Evolution, Persistence, Observation, and Research


| Source heading | Requirement IDs / disposition |
|---|---|
| `08-agents/hosts-and-mcp.md` — H1 “Host and MCP Integration” | CONTEXT: section title; covered by HOST-001–018 and MCP-001–006 |
| H2 “Host integration” | CONTEXT: grouping heading for capability, levels, wrapper, and generated instructions |
| H2 “Capability model” | HOST-001, HOST-016 |
| H2 “Integration levels” | HOST-002–003, HOST-017 |
| H2 “Wrapper” | HOST-004–009 |
| H2 “Generated host instructions” | HOST-010–015, HOST-018 |
| H2 “Projector” | CONTEXT: example-only H2 inside the generated Markdown instruction block; normative example steps are subsumed by HOST-004–015 and the canonical contracts they summarize |
| H2 “MCP interface and mutation capabilities” | MCP-001–006 |
| `08-agents/orchestration-and-models.md` — H1 “Agent Orchestration and Model Inference” | CONTEXT: section title; covered by AGNT-001–017 and MODEL-001–021 |
| H2 “Agent orchestration and independent validation” | CONTEXT: grouping heading |
| H2 “Logical roles” | AGNT-001–006, AGNT-016 |
| H2 “Model routing” | MODEL-001–003 |
| H2 “Validation independence” | AGNT-007–011, AGNT-017 |
| H2 “Agent authority restrictions” | AGNT-012–013, AGNT-016 |
| H2 “Completion is a verified state” | AGNT-014–015, AGNT-017 |
| H2 “Model provider and replayable inference” | MODEL-004–008, MODEL-020 |
| H2 “Inference artifact cache” | MODEL-009–012, MODEL-021 |
| H2 “Promotion boundary” | MODEL-013–015, MODEL-020–021 |
| `09-evolution/modernization-and-surfaces.md` — H1 “Modernization and External Surfaces” | CONTEXT: section title; covered by EVOL-001–007, EVOL-016–017, and SURF-001–013 |
| H2 “Modernization engine” | CONTEXT: grouping heading |
| H2 “Triggers” | EVOL-001 |
| H2 “Recommendation contract” | EVOL-002–003, EVOL-017 |
| H2 “Fashion resistance” | EVOL-004–007, EVOL-016–017 |
| H2 “Surface adapters and external observation snapshots” | SURF-001–004, SURF-013 |
| H2 “Initial repository-local surfaces” | SURF-005 |
| H2 “External snapshots” | SURF-006–009, SURF-012 |
| H2 “Unavailable and open-world surfaces” | SURF-010–011 |
| `09-evolution/persistence-and-observation.md` — H1 “Persistence and Observation” | CONTEXT: section title; covered by PERS-001–015, OBSV-001–019, and MODEL-016–019 |
| H2 “Persistence, revisions, transactions, and Projector upgrades” | CONTEXT: grouping heading |
| H2 “SQLite is derived state” | PERS-001–003, PERS-014–015 |
| H2 “Graph revision” | PERS-004–006 |
| H2 “Canonical rebuild invariant” | PERS-007–009, PERS-014–015 |
| H2 “Canonical schema and engine upgrades” | PERS-010–013 |
| H2 “Observation, analyzer capabilities, and initialization pipeline” | OBSV-001 |
| H2 “Analyzer contract” | OBSV-002–005, OBSV-018–019 |
| H2 “Deterministic inventory” | OBSV-006–007 |
| H2 “Required semantic analyzer outputs” | OBSV-008–014, OBSV-019 |
| H2 “Analyzer rollout” | OBSV-015 |
| H2 “Structural clustering” | OBSV-016–017 |
| H2 “Model inference input” | MODEL-016–019 |
| `09-evolution/historical-evaluation-and-research.md` — H1 “Historical Evaluation and Research” | CONTEXT: section title; covered by EVOL-008–015, EVOL-018, and RSCH-001–008 |
| H2 “Historical and metamorphic evaluation” | EVOL-008–015, EVOL-018 |
| H2 “Research boundary” | RSCH-001–008 |

### CLI, Security, Operation, Testing, Evaluation, and Benchmarks


- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `# CLI, Modes, and Security`: **CLI-001**–**CLI-056**, **MODE-001**–**MODE-012**, **SEC-001**–**SEC-029**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## CLI and policy normalization`: **CLI-001**–**CLI-056**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Operating-mode presets`: **MODE-001**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Observe`: **MODE-002**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Guide`: **MODE-003**–**MODE-004**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Govern`: **MODE-005**–**MODE-008**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Autonomous`: **MODE-009**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Salvage`: **MODE-010**–**MODE-012**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Security, path safety, and trust boundaries`: **SEC-001**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Untrusted content`: **SEC-002**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Sensitive data`: **SEC-003**–**SEC-005**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Repository-root path semantics`: **SEC-006**–**SEC-012**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## Command execution`: **SEC-013**–**SEC-019**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## External and host writes`: **SEC-020**–**SEC-025**.
- `PROJECTOR_SPEC/10-operation/cli-modes-and-security.md` — `## State-bound authorization`: **SEC-026**–**SEC-029**.
- `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `# Observability, Economics, and Reporting`: **METR-001**–**METR-045**, **OPER-001**–**OPER-020**.
- `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Observability, cost accounting, and semantic-model economics`: **METR-001**–**METR-045**.
- `PROJECTOR_SPEC/10-operation/observability-and-reporting.md` — `## Reporting`: **OPER-001**–**OPER-020**, CONTEXT (HTML/graph UI optional post-core).
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `# Testing and Adversarial Evaluation`: **TEST-001**–**TEST-063**, **EVAL-002**–**EVAL-066**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Testing and adversarial evaluation strategy`: **TEST-001**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Unit tests`: **TEST-002**–**TEST-036**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Property-based tests`: **TEST-037**–**TEST-063**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Golden and held-out fixture repositories`: **EVAL-048**–**EVAL-066**, **EVAL-002**–**EVAL-003**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Anti-self-deception tests`: **EVAL-004**–**EVAL-035**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Host tests`: **EVAL-036**–**EVAL-042**.
- `PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md` — `## Live evaluation`: **EVAL-043**–**EVAL-047**.
- `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `# Benchmarks and Redesign Criteria`: **BENCH-001**–**BENCH-050**, **KILL-001**–**KILL-023**.
- `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Benchmarks and release metrics`: **BENCH-001**–**BENCH-050**.
- `PROJECTOR_SPEC/11-validation/benchmarks-and-redesign-criteria.md` — `## Kill / redesign criteria`: **KILL-001**–**KILL-023**.

### Delivery Slices, Acceptance, Release, Dogfooding, and Handoff


Every H1/H2/H3 heading in `PROJECTOR_SPEC/12-delivery/*.md` is mapped below. `CONTEXT` means the heading is structural and its substantive descendants are mapped to requirement IDs.

| Source heading | Requirement IDs / disposition |
|---|---|
| `acceptance-architecture.md` — H1 Architecture Acceptance Scenarios | CONTEXT: ACC-046–ACC-062 |
| H2 Architecture expansion: web app → cross-platform product | ACC-046–ACC-055 |
| H2 Preference scope isolation | ACC-056 |
| H2 Stale architecture research | ACC-057 |
| H2 Decision deferral preserves optionality | ACC-058 |
| H2 Negative/simple decision | ACC-059 |
| H2 Decision overlap conflict | ACC-060 |
| H2 Held-out concern-discovery robustness | ACC-061–ACC-062, DELV-021 |
| `acceptance-core.md` — H1 Core Acceptance Scenarios | CONTEXT: ACC-063–ACC-090 |
| H2 Canonical rebuild closure | ACC-063 |
| H2 Copied-slop majority and endogenous-evidence defense | ACC-064–ACC-067 |
| H2 Semantic-signature insufficiency | ACC-068 |
| H2 Semantic backdating | ACC-069 |
| H2 Shared-bug rebuild oracle | ACC-070 |
| H2 SCC backdating | ACC-071 |
| H2 Selector membership change | ACC-072 |
| H2 Multiple valid shared implementations | ACC-073 |
| H2 Governance-cycle detection | ACC-074–ACC-075 |
| H2 Crash recovery matrix | ACC-076 |
| H2 Branch governance conflict | ACC-077 |
| H2 Open-world completeness refusal | ACC-078 |
| H2 Unreachable external surface | ACC-079 |
| H2 Model resampling idempotence | ACC-080 |
| H2 Validator independence | ACC-081 |
| H2 Generated-output upstream repair | ACC-082 |
| H2 Partial completion and plan rebase | ACC-083 |
| H2 Localized cache performance | ACC-084 |
| H2 Engine/signature-profile upgrade | ACC-085 |
| H2 Analyzer partial failure | ACC-086 |
| H2 Path/symlink escape | ACC-087 |
| H2 Misleading local precedent | ACC-088 |
| H2 Projector repair oscillation | ACC-089 |
| H2 Held-out/mutation-generated benchmark | ACC-090, DELV-022 |
| `acceptance-relevance-and-identity.md` — H1 Relevance and Semantic Identity Acceptance Scenarios | CONTEXT: ACC-091–ACC-113 |
| H2 Synonymous request reuses canonical identity | ACC-091–ACC-092 |
| H2 Alias change refreshes discovery without semantic invalidation | ACC-093 |
| H2 Superseded/renamed identity is not resurrected as a duplicate | ACC-094 |
| H2 Cross-cutting governing concern outside touched package | ACC-095 |
| H2 Encapsulation is not retrieval | ACC-096 |
| H2 Relevance is not impact | ACC-097 |
| H2 Relevance over-expansion refusal | ACC-098 |
| H2 Event topology discovers non-obvious consumers | ACC-099 |
| H2 Contract topology discovers consumers | ACC-100 |
| H2 Requirement and scenario projections are derived | ACC-101 |
| H2 WHAT/WHY is protected without WHERE blindness | ACC-102 |
| H2 Unrelated canonical change does not stale local work | ACC-103 |
| H2 Bound dependency change does stale local work | ACC-104 |
| H2 Membership-changing fact invalidates context even when loaded entities are unchanged | ACC-105 |
| H2 Newly relevant semantic state invalidates negative-space proof | ACC-106 |
| H2 Query semantics are part of state binding | ACC-107 |
| H2 Open-world emptiness is not absence proof | ACC-108 |
| H2 Planning Surprise learns a missing relationship | ACC-109 |
| H2 Planning Surprise rejects agent overreach | ACC-110 |
| H2 Fine-grained canonical merge locality | ACC-111 |
| H2 Semantic storage path does not define meaning | ACC-112 |
| H2 Analysis Facets compose without methodology lock-in | ACC-113 |
| `acceptance-representation.md` — H1 Representation Acceptance Scenarios | CONTEXT: ACC-114–ACC-119 |
| H2 Representation semantic-fidelity rejection | ACC-114 |
| H2 Cross-projection consistency | ACC-115 |
| H2 Net-negative compact-context fallback | ACC-116 |
| H2 Representation-profile invalidation | ACC-117 |
| H2 Authoritative specification human-technical conformance | ACC-118, DOG-014 |
| H2 Compact context preserves critical tokens and avoids false compression | ACC-119 |
| `first-vertical-slice.md` — H1 Mandatory First Vertical Slice | CONTEXT: ACC-011–ACC-034, SLICE-026–SLICE-027 |
| H2 Mandatory first vertical slice | ACC-011–ACC-034, SLICE-026–SLICE-027, DELV-012, DELV-017 |
| `implementation-plan.md` — H1 Implementation Plan | CONTEXT: DELV-001–DELV-007, SLICE-000–SLICE-101, ACC-000–ACC-045 |
| H2 Vertical-slice-first delivery | DELV-001–DELV-006 |
| H2 Slice 0 — Foundation and correctness substrate | SLICE-000–SLICE-010, ACC-000–ACC-009, DELV-018 |
| H2 Slice 1 — Mandatory misplaced-script loop from start to finish | SLICE-011–SLICE-025, ACC-010 |
| H2 Slice 2 — Semantic signatures, invalidation, and backdating | SLICE-028–SLICE-037, ACC-035–ACC-036 |
| H2 Slice 3 — Behavioral intent, identity resolution, and Relevance Engine | SLICE-038–SLICE-050, ACC-037–ACC-042 |
| H2 Slice 4 — Governance robustness and representation | SLICE-051–SLICE-063 |
| H2 Slice 5 — Progressive architecture commitment | SLICE-064–SLICE-074, ACC-043–ACC-044 |
| H2 Slice 6 — Broaden analyzers and relevance/divergence topology | SLICE-075–SLICE-083 |
| H2 Slice 7 — Coverage completion and cleanup | SLICE-084–SLICE-090 |
| H2 Slice 8 — Full Semantic Change Compiler and packet executor | SLICE-091–SLICE-092 |
| H2 Slice 9 — Host/MCP integrations | SLICE-093–SLICE-095 |
| H2 Slice 10 — Modernization | SLICE-096 |
| H2 Slice 11 — Watch/CI/hardening | SLICE-097–SLICE-099 |
| H2 Slice 12 — External surfaces | SLICE-100–SLICE-101, ACC-045, DELV-019 |
| `release-and-directive.md` — H1 Release, Dogfooding, and Final Directive | CONTEXT: REL-001–REL-077, DOG-001–DOG-017, DELV-008–DELV-010 |
| H2 Minimum credible public release | REL-001–REL-026, DELV-020 |
| H2 Dogfooding requirement | DOG-001–DOG-017 |
| H2 Final implementer checklist | REL-027–REL-077 |
| H2 Final implementation directive | DELV-008–DELV-010 |

## Traceability

Phase mapping is populated during roadmap creation. Every v1 requirement must map to exactly one owning phase; cross-phase validation dependencies are recorded separately and do not create duplicate ownership.

**Coverage:**
- v1 requirements: 1319 total
- Mapped to phases: 0
- Unmapped: 1319 (roadmap pending)

---
*Requirements defined: 2026-08-07*
*Last updated: 2026-08-07 after independent specification-fidelity audit*
