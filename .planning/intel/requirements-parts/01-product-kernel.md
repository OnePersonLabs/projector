# Product and Semantic Kernel Requirements

This fragment is self-contained for the product contract and semantic kernel. The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** retain their normative force. Public contract field names, enum literals, commands, paths, failure names, and thresholds shown in backticks are exact.

## v1 Requirements

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

## Locked Constraints and Decisions

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

## Explicit Non-Goals

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

## Source Coverage

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
