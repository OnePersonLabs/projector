+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:preserve-critical-tokens-during-compaction"
key = "preserve-critical-tokens-during-compaction"
lifecycle = "active"

[metadata]
aliases = [ "scenario:56:compact-context-preserves-critical-tokens-and-avoids-false-compression", "adversary:30:token-compression-that-passes-style-lint-while-changing-semantics" ]
sourceClass = "authored"
+++

# Compact context preserves critical tokens and avoids false compression

## Given

Acceptance case "Compact context preserves critical tokens and avoids false compression": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Compile agent context that contains negation, scope limits, ordering, exact code symbols, paths, API names, numbers, units, and a standard acronym.

## When

Seed a candidate compact rendering that drops narration but also invents prose abbreviations or weakens one protected semantic dimension.

## Then

- the profile removes nonessential narration and repeated explanation when host policy permits it.
- exact technical literals, numbers, units, and protected semantic dimensions remain unchanged.
- invented prose abbreviations are rejected unless measured token savings justify them and clarity remains acceptable.
- the compiler uses a less compressed representation when compact output becomes ambiguous, semantically weaker, or net-negative after profile overhead.

## Given

Adversarial evaluation must exercise this class and reject false success: Token compression that passes style lint while changing semantics.

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
description = """Full acceptance case \"Compact context preserves critical tokens and avoids false compression\", starting \
  line 44; immutable Git blob 71ed07c17947350b56fb1728be386de2071d1a22. Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = """Exact adversary condition 30; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157. Hash binds \
  original Git bytes."""

```
</details>
