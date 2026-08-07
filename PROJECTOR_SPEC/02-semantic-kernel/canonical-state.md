# Canonical State

## `.projector/` canonical contract

Canonical authored/governance state MUST be closed under rebuild.

```text
.projector/
├─ config.json
├─ model/
│  ├─ concepts/
│  │  └─ <stable-id>.concept.json
│  ├─ requirements/
│  │  └─ <stable-id>.requirement.json
│  ├─ scenarios/
│  │  └─ <stable-id>.scenario.json
│  └─ relations/
│     └─ <stable-id>.relation.json
├─ rules/
│  └─ *.rule.json
├─ lenses/
│  └─ *.lens.json
├─ representations/
│  └─ *.representation.json
├─ authorities/
│  └─ *.authority.json
├─ concerns/
│  └─ *.concern.json
├─ decisions/
│  └─ *.decision.json
├─ preferences/
│  └─ *.preference.json      # project-adopted preferences only
├─ exceptions/
│  └─ *.exception.json
├─ migrations/
│  └─ *.migration.json
├─ receipts/
│  └─ *.receipt.json
├─ plans/                    # ignored by default
├─ certificates/             # ignored by default
├─ reports/                  # ignored by default
├─ generated/                # ignored unless repository opts in
├─ cache/                    # ignored
└─ state.db                  # ignored. Fully derived.
```

## Canonical content

Canonical semantic state under `.projector/model/` is **fine-grained and independently addressable**. Projector persists Concepts, Requirements, Behavioral Scenarios, and authored Relations by stable semantic identity instead of collecting them in one project-wide semantic blob. The canonical model MUST NOT become a dump of derived repository observations.

The physical directory hierarchy is a storage/indexing projection, not semantic authority. Moving a canonical entity file does not change its identity. Repositories MAY deterministically shard a large kind directory by stable-ID prefix without semantic effect. Generated indexes and Projector queries support human/domain browsing without making path hierarchy define meaning.

Canonical by default:

- configuration.
- authored Concepts and Relations.
- accepted Requirements and Behavioral Scenarios.
- active/approved rules.
- active/approved lenses.
- active/approved Semantic Representation Profiles.
- authority records that govern active state.
- material architecture concerns with durable dispositions.
- active/superseded architecture decisions.
- project-adopted preferences.
- exceptions.
- migrations.
- required R2+ transaction receipts.

Representation Projection outputs are derived even when a repository elects to persist them under `.projector/generated/` or another governed surface. Committing a generated rendering does not make it authoritative. Its canonical source remains the profile plus referenced semantic entities.

Store derived and inferred observations in SQLite or ignored artifacts. This includes undecided concerns, decision proposals, selector matches, index state, transient findings, model calls, raw research, and caches. User and organization preference profiles are external inputs. Projector MUST NOT copy them into repository governance unless the project adopts them.

## Canonical schema requirements

Every canonical document MUST include:

- `apiVersion` and/or schema version.
- stable ID and canonical key.
- lifecycle state.
- semantic hash calculated over a schema-defined semantic projection.
- discovery hash when the entity participates in identity/retrieval metadata whose changes must be distinguishable from semantic changes.
- references by stable IDs, never path coincidence alone.

Complete canonical snapshot identity MUST be based on deterministic canonical-document content hashes, not only semantic hashes. Semantic/discovery hashes exist to localize *which dimension* changed. The canonical document hash exists to prove the exact canonical snapshot changed.

Volatile fields include timestamps, run IDs, local paths, and UI metadata. These fields MUST NOT affect semantic hashes unless the schema declares them meaningful.

Canonical format migrations MUST be deterministic, versioned, previewable, and independently testable.

## Canonical semantic addressability

Canonical semantic storage MUST satisfy all of the following:

- Canonical storage MUST NOT require a bounded change to load or rewrite the complete semantic graph to resolve, modify, validate, or hash its dependencies.
- Physical storage preserves enough semantic locality to avoid needless Git conflicts, context ingestion, cache invalidation, plan invalidation, or review noise.
- Stable IDs, not filenames or directories, define identity.
- Multi-entity semantic transactions remain atomic through Projector's transaction journal even though their canonical documents are physically independent.
- Global canonical-root digests MAY identify complete snapshots and support rebuild/audit. They MUST NOT be the sole validity dependency for local plans, capsules, approvals, or mutation capabilities.

A derived canonical-root manifest MAY be computed deterministically from the sorted `(entityId, canonicalDocumentHash)` set plus other canonical governance files. `canonicalDocumentHash` is computed from deterministic canonical serialization of the complete canonical document (excluding only explicitly noncanonical/volatile fields). It is distinct from schema-defined `semanticHash` and `discoveryHash`. This makes every canonical edit change complete snapshot identity without claiming that every edit changed behavioral meaning. The manifest is rebuildable and MUST NOT become an independently edited source of truth.

## Canonical locality and relations

Projector persists each Relation independently by stable ID unless a future schema defines an aggregate whose atomicity has semantic value. Projector MUST NOT require a relation and both endpoint entities to share a directory or package. Cross-cutting relations are precisely how canonical truth remains singular while retrieval crosses encapsulation boundaries.

## Version-control defaults

Commit canonical state. Ignore by default:

- `state.db`.
- cache.
- transient reports.
- generated host files.
- verbose certificates.
- unfinished local plans unless repository policy opts in.

R2+ semantic or governance transactions MUST commit a compact content-addressed receipt. Repository policy MAY require committing R1 receipts. Ordinary observations MUST NOT create one repository event file per fact.

## Rebuild inputs

A deterministic local rebuild uses only:

1. Repository/Git state.
2. Committed canonical `.projector/` state.
3. An explicitly pinned external observation snapshot, if the requested operation includes one.

Live external systems are never silently read as part of the rebuild oracle.

---


