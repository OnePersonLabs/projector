+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:reject-weakened-representation-semantics"
key = "reject-weakened-representation-semantics"
lifecycle = "active"

[metadata]
aliases = [ "scenario:51:representation-semantic-fidelity-rejection", "property:25:a-representation-projection-cannot-validate-when-any-required-protected-dimension-fingerprint-differs", "property:26:reducing-text-token-count-cannot-strengthen-a-fidelity-completion-claim", "adversary:29:representation-modal-negation-cardinality-logical-connective-condition-exception-drift" ]
sourceClass = "authored"
+++

# Representation semantic-fidelity rejection

## Given

Acceptance case "Representation semantic-fidelity rejection": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Create a canonical hard rule equivalent to: `MUST_NOT delete production data unless explicit user approval`. Generate a compact representation that says `Avoid deleting production data without approval`. Also seed cases where `A iff B` becomes `A when B`, and `exactly one` becomes `one or more`.

## Then

style/token compression may look good, but protected-dimension validation rejects each weakened/changed representation. The canonical rule remains untouched. A valid compact form may use a deterministic machine-invariant encoding such as `FORBID delete-production-data EXCEPT explicit-user-approval` when the normalized kernel can prove equivalence.

## Then

Property across the applicable input population: a Representation Projection cannot validate when any required protected-dimension fingerprint differs.

## Then

Property across the applicable input population: reducing text/token count cannot strengthen a fidelity/completion claim.

## Given

Adversarial evaluation must exercise this class and reject false success: Representation modal/negation/cardinality/logical-connective/condition/exception drift.

## Then

Unit evaluation must cover: Semantic Preservation Fingerprints across normative force, negation, cardinality, logical connectives, conditions, exceptions, scope, order/dependencies, behavioral step roles, and literals.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:engineering-english"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-representation.md"
contentHash = "sha256:v1:da531331605b94681697c33a4a763da6dfabe19200cc37d73c93798efb1af3b5"
description = """Full acceptance case \"Representation semantic-fidelity rejection\", starting line 3; immutable Git \
  blob 71ed07c17947350b56fb1728be386de2071d1a22. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 25; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact property condition 26; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 29; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 33; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
