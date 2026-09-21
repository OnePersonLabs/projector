+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:lint-human-technical-prose-without-equivalence-claim"
key = "lint-human-technical-prose-without-equivalence-claim"
lifecycle = "active"

[metadata]
aliases = [ "scenario:55:authoritative-specification-human-technical-conformance" ]
sourceClass = "authored"
+++

# Authoritative specification human-technical conformance

## Given

Acceptance case "Authoritative specification human-technical conformance": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Run the specification checker against `SPEC.md`, `INDEX.md`, and every authoritative module.

## Then

- blocking `human-technical@1` errors are zero.
- prose linting does not rewrite code blocks or exact technical literals.
- passive-voice and nominalization heuristics remain review signals when a deterministic rewrite could change meaning.
- the style gate does not claim semantic equivalence or truth.

## Then

After canonical acceptance and Markdown-consumer migration, the human-technical gate applies to derived human specification surfaces. Historical SPEC.md, INDEX.md, and modules remain transitional inputs until that migration; their prose never overrides executable core contract authority.

## Then

Unit evaluation must cover: controlled-technical style linting vs semantic-fidelity validation separation.

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
description = """Full acceptance case \"Authoritative specification human-technical conformance\", starting line 32; \
  immutable Git blob 71ed07c17947350b56fb1728be386de2071d1a22. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 34; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
