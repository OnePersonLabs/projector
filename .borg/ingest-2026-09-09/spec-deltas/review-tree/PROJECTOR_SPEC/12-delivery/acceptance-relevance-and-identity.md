# Relevance and Semantic Identity Acceptance Scenarios

## Synonymous request reuses canonical identity

Canonical state already contains `CAP-MIDI-DEVICE-DISCOVERY` with aliases including `midi devices` and `device enumeration`. Request "add wireless MIDI device enumeration." Seed nearby code and docs that use several different phrases.

Expected:

- Semantic Identity Resolution ranks the existing capability as the owner.
- no second capability is created merely because wording differs.
- if BLE-specific behavior is distinct, Projector modifies the existing capability and Requirements or proposes a narrower new identity. The new identity includes owns/excludes boundaries and nearest candidates.
- the resolution remains inspectable.

## Alias change refreshes discovery without semantic invalidation

Add a new accepted synonym to an existing Requirement/Concept without changing its statement, behavioral scope, or other semantic fields.

Expected:

- stable entity ID remains unchanged.
- `discoveryHash` and complete canonical snapshot/document hash change.
- `semanticHash` remains unchanged.
- identity-search/Relevance query dependencies whose results are affected are re-evaluated.
- derivations/plans that bind only the unchanged semantic meaning are not invalidated solely because the synonym changed.
- a later request using the new synonym resolves to the existing identity.

## Superseded/renamed identity is not resurrected as a duplicate

Create a semantic identity, move/rename/supersede it through explicit lineage, then request behavior using terminology associated with the earlier identity.

Expected:

- identity resolution inspects active identities plus relevant aliases, lineage, tombstones, and superseded entities.
- Projector resolves to the surviving/replacement identity or presents an explicit split/new-identity decision.
- it does not mint a fresh identity merely because the old canonical name/path no longer appears among active entities.

---
## Cross-cutting governing concern outside touched package

A request changes Bluetooth MIDI timestamp compensation in a mobile adapter. The canonical Session Clock invariant lives under a different semantic owner and its implementation spans session/network packages.

Expected:

- direct context includes Bluetooth MIDI/timing semantics.
- governing context includes the Session Clock invariant and any applicable architecture decision despite physical separation.
- known downstream multiplayer ordering/recording consumers enter consequence context according to their typed relationships.
- unrelated identity/avatar/UI semantics do not enter the capsule merely because they share the monorepo.

## Encapsulation is not retrieval

Store one invariant in a single canonical semantic file. Bind it to three capabilities in unrelated packages through typed Relations/selectors.

Expected: the invariant is authored once, discovered for each relevant change, and never duplicated into package-local specs solely for discoverability.

## Relevance is not impact

Create a request where several existing concepts are necessary to understand design constraints but only one Projection Unit ultimately changes.

Expected:

- Relevance Closure contains all planning-relevant concepts.
- Impact Closure contains only units/consequences justified by the known delta and active Impact Rules/derivations.
- Projector does not invalidate every relevance entry merely because it was loaded into context.

## Relevance over-expansion refusal

Create a large semantic graph with one localized change and many weak semantic-similarity neighbors.

Expected:

- direct/governing context remains bounded.
- weak neighbors are dropped or retained only in the possible band with concise rationale.
- the Context Compiler does not serialize the entire semantic graph.
- metrics expose irrelevant expansion.

## Event topology discovers non-obvious consumers

Model `MidiNoteCaptured` as an event Concept with known producers/consumers in recording, multiplayer, scoring, and visualization. Request a semantic schema change to the event.

Expected: known consumers enter relevance deterministically from producer/consumer topology before model inference. Missing model recall cannot hide a consumer already present in the graph.

## Contract topology discovers consumers

Change a public API/message/schema contract implemented in one package and consumed by unrelated packages/apps.

Expected: contract producer/consumer edges route relevant consumers into change cognition and, once the semantic delta is known, into Impact Closure with the appropriate proof class.

## Requirement and scenario projections are derived

Create a canonical Requirement and Behavioral Scenario. Compile a human Markdown spec, a Gherkin representation, compact agent context, and a machine-invariant representation where applicable.

Expected:

- all representations bind to the same canonical source identities/hashes.
- editing a generated spec/Gherkin file does not silently rewrite canonical behavior.
- an intentional behavioral edit is reconciled as a proposed semantic change.
- representation wording/format changes do not create new Requirement/Scenario identities.

## WHAT/WHY is protected without WHERE blindness

Request a change phrased partly as a solution. Seed existing code/decisions that make several affected areas non-obvious.

Expected:

- Intent Analysis separates behavioral goal/constraints from implementation proposal.
- Relevance Scout may inspect code/graph topology to find WHERE/WHAT-ELSE.
- architecture choice is not accepted merely because nearby code uses one technology.
- the resulting Relevance Closure informs architecture preflight without contaminating the Requirement with implementation detail.

## Unrelated canonical change does not stale local work

Compile an Execution Capsule for a MIDI change. Then change an unrelated avatar Requirement, causing the global canonical-root digest to change.

Expected:

- Projector notices the global snapshot changed.
- all bound semantic/physical/query dependencies for the MIDI capsule are unchanged.
- the binding is safely rebound or remains usable according to policy without recomputing the MIDI semantic plan.
- global snapshot identity remains different and receipts still distinguish the snapshots.

## Bound dependency change does stale local work

Compile the same MIDI capsule, then modify a Session Clock invariant included in its StateBinding.

Expected: binding validation fails/revalidates. The capsule cannot execute under the old approval until relevance/impact/context are refreshed as required.

## Membership-changing fact invalidates context even when loaded entities are unchanged

Compile a capsule whose applicable rules depend on whether a symbol is public. Change only the export membership so a new public-contract rule applies.

Expected: the selector/query membership dependency changes, invalidating/recompiling the capsule even if the previously loaded Requirement/Concept bodies are byte-identical.


## Newly relevant semantic state invalidates negative-space proof

Compile a Relevance Closure whose bound identity, relation-adjacency, and selector-membership queries establish the current relevant subgraph. Keep every entity already present in that closure unchanged. Add a new canonical Relation or semantic entity that now matches one bound query. The new result makes another governing concern relevant.

Expected:

- hashes of the previously selected entities may remain unchanged.
- the corresponding `StateQueryDependency.priorResult.resultHash` changes when the deterministic query is re-evaluated.
- the prior Relevance Closure/StateBinding is not treated as current merely because its previously returned entities are unchanged.
- Projector recomputes the affected closure and includes the newly relevant semantic state.
- unrelated additions that do not change any bound query result do not stale the closure.

## Query semantics are part of state binding

Compile a closure, then change the registered query program/version or its declared closure-sensitive result projection while repository/canonical entities remain otherwise unchanged.

Expected: the old query dependency is stale. Projector cannot compare the new query using the old semantic contract and call the binding current. Recompile/rebind is required according to policy.

## Open-world emptiness is not absence proof

Run an event/contract-consumer discovery lane whose enumeration is `sampled` or `open` and returns no additional consumers.

Expected:

- the empty result may contribute supporting context.
- Projector records the lane/assumptions in the query-result fingerprint and Relevance Closure unknown/frontier.
- Projector MUST NOT conclude that no other consumers exist or use the empty result to produce a proof-strength closure claim.
- changing the lane to `closed`/eligible `bounded` and re-evaluating may establish the stronger absence result.

---
## Planning Surprise learns a missing relationship

Plan a MIDI timing change whose Relevance/Impact Closure omits replay normalization. During legitimate implementation, deterministic reverse analysis shows replay semantics were necessarily affected.

Expected:

- reconciliation emits a Planning Surprise instead of silently pretending the original plan predicted replay.
- Projector classifies whether this is legitimate scope growth, a missing Relation/analyzer/facet, or agent overreach.
- if evidence supports a reusable relationship, it is proposed through normal source-class/authority rules.
- a future equivalent change discovers replay earlier.

## Planning Surprise rejects agent overreach

Plan a localized MIDI timing change. The agent also refactors unrelated avatar code.

Expected: reverse-impact comparison identifies unexplained unexpected impact, classifies it as overreach absent a legitimate relevance path, and repair/revert policy applies. The system does not "learn" a false MIDI/avatar relation merely because one agent touched both.

## Fine-grained canonical merge locality

Make two concurrent branches: one modifies a MIDI Requirement. The other modifies an unrelated avatar Requirement.

Expected: canonical persistence gives the changes independent files/semantic identities and avoids a synthetic conflict caused solely by both editing one project-wide model document. Global semantic root hashes differ appropriately after each transaction.

## Semantic storage path does not define meaning

Move a canonical Concept file to a deterministic shard directory without changing its stable ID or semantic fields.

Expected: semantic identity, relationships, relevance, and semantic hash remain unchanged. Only storage/index metadata changes.

## Analysis Facets compose without methodology lock-in

Run one simple behavior-only change and one realtime event/public-contract change.

Expected:

- the first activates only the minimal useful facets.
- the second activates behavior + events + realtime + public-contract facets because their predicates apply.
- facet activation adds discovery/verification obligations but does not preselect an implementation technology.
