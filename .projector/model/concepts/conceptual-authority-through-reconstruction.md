+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "concept"
id = "concept:reconstruction-authority"
key = "reconstruction-authority"
lifecycle = "active"

[metadata]
kind = "policy"
aliases = [ "fresh-repository-control" ]
sourceClass = "authored"
confidence = 1
tags = [ "reconstruction", "conceptual-authority" ]
+++

# Conceptual authority through reconstruction

Projector retains accepted conceptual meaning, unrealized commitments, and architectural rationale independently of any current implementation. It can govern a fresh repository whose implementation replaces the old one. Historical code, specifications, and commit history provide evidence for explicit acceptance or revision; their existence does not grant them authority.

Reconstruction preserves Psychord specification meaning: intended behavior, constraints, relationships, exceptions, rationale, and future commitments. Wording, document organization, and implementation may change. Resolve conflicting or ambiguous evidence explicitly and retain provenance; implementation absence or difficulty does not authorize conceptual loss.

Before rejecting Projector, distinguish a failed premise from a failed design, implementation, or evaluation. Assess whether a plausible bounded correction can fulfill the intended purpose and change the decision. Seek reasonable engineering confidence from relevant evidence; do not require a completed Psychord rebuild or universal proof.

Rejecting Projector completes this effort only if a viable alternative route to building Psychord from scratch is delivered under the same conceptual-preservation standard. Both routes must address coherence as interacting specifications grow, bounded context, progressive disclosure, and retrieval of applicable existing meaning before planning changes. A small-task baseline success or a hypothetical tool combination does not establish that alternative.

Projector is a standalone conceptual control plane for complex software projects. Psychord is its motivating and first demanding use case, not the scope of its machinery. Keep project configuration and accepted conceptual artifacts with the project repository so accepted meaning, relationships, decisions, lenses, and provenance remain portable. Reconcile this with established storage and caching decisions; do not force derived indexes, caches, local execution state, or live capabilities into Git or redesign their storage merely to satisfy repository portability.

The user selected delivery of a promising working Projector while accepting that remaining limits may emerge during Psychord redevelopment. Use lean delivery: complete useful changes, verify relevant behavior, consolidate concrete adversarial-review repairs, and ship. Do not require an additional comparative trial or proof of long-term superiority before delivery. Decompose implementation work without reducing the accepted design or deleting its future commitments.

When facts, selectors, transformations, validation or invalidation dependencies can be handled deterministically, prefer machinery over repeated model reasoning. Repeated successful reasoning should crystallize into recognizers, rules, transforms, validators or cached decisions only when this lowers future cost without weakening correctness. Models remain appropriate for semantic classification, competing-pattern interpretation, rationale synthesis, architecture judgment, bounded handwritten-code repair and adversarial review; they are not the default parser, hasher, selector evaluator, known-dependency traverser or invariant checker. Broad autonomous synthesis or promotion beyond supported workflows remains explicitly unrealized; reconsider a specific mechanism only when a recurring judgment, deterministic specification and comparative cost/correctness evidence exist.

Projector does not promise formal verification of arbitrary business logic, perfect recovery of intent that left no evidence, a universal ontology, ownership of all source bytes, universal language support, autonomous destructive production changes, or automatic acceptance of contested architecture. It does not require a graph database, one monolithic canonical document loaded or rewritten as a unit, a repository/package tree as ontology or retrieval boundary, a conventional spec-folder workflow depending on voluntary document discovery, hosted SaaS, or visual modeling. It does not promise arbitrary handwritten-line rewriting, replacement of compilers/tests/static analysis/security review/human product judgment, canonicalization of every repeated style detail, prose or generated host instructions as canonical authority, natural-language equivalence from compression/paraphrase alone, or lock-in to one model vendor or agent host. These limit supported claims and prerequisites; they are not promises to implement excluded capabilities later. Revising a limit requires explicit scope, rationale, evidence and acceptance.

Installed help, context and completion expose practical limits through the accepted registered runner. Historical command names, standalone MCP delivery and sandbox/confinement requirements do not become current commitments through ingestion: accepted host permissions and shared-runner decisions govern. Executable acceptance-inventory and consumer migration is separate from enriching meaning/provenance.

Every graph fact identifies authored, derived, observed or inferred source class. Accepted authored intent is canonical; deterministic derived facts are disposable and recomputable. Runtime or external observations carry freshness. Model or heuristic inferences carry confidence, evidence, alternatives and uncertainty, and never silently become authored authority. Classification, provenance and hash consistency cannot substitute for explicit acceptance, observation or independent proof; exact serialized contracts remain owned by the executable core.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/01-product/principles-and-non-goals.md"
contentHash = "sha256:v1:e821d0b1d1d7efefaba2af27178e21073efb45bf0172b2f921a6122d081413e7"
description = """Historical deterministic allocation and product limits; obsolete implementation prescriptions are not \
  accepted. Source range 23-31,135-157; Git blob ee1f764560565d31b8c3e2098de37316bbe0a7e7; content hash \
  is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/decisions/f1d7f82a89ecaa14199107b9aed7953eba0a14e39b42672b61b3f24db1322d51.decision.json"
contentHash = "sha256:v1:623673cf17762ec9d36c6e364e59e739ee940eb58bf4c1333f37deb6ee3f9210"
description = """Accepted registered runner supersedes obsolete wrapper-to-CLI, standalone MCP and task17 dispatch delivery. \
  Source range complete accepted record; Git blob d307af7324bdae70577cbec60042b4fc8ed05db1; content \
  hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/model/concepts/01561d6546adb32a8afb29429380b0ecdec1bd6a9dd562fbea23a395381ca5b8.concept.json"
contentHash = "sha256:v1:a4dd211d265700ff82bf503b4cedf13661ad8d9ec3aea6f147004e754a9634c3"
description = """Accepted host integrity: ordinary processes and hashes do not exclude malicious same-user interference; \
  no mandatory confinement or WSL bridge. Source range complete accepted record; Git blob 3ccfee51b0a75179711d6ded3324b17b8279da61; \
  content hash is SHA-256 of exact blob bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/02-semantic-kernel/terminology-and-source-classes.md"
contentHash = "sha256:v1:4f4dcb11b9e7e6eddd3a2b2e23ab542510ffcaea8ab49448b77b6c79902056d5"
description = """Historical source-class boundaries; executable field/type definitions remain owned by core. Source range \
  59-126; immutable Git blob 4ab4e468cafafed5a8d68633f1249586e578f4ac; content hash is SHA-256 of exact \
  blob bytes."""

```
</details>
