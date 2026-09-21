+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:keep-local-preferences-out-of-shared-governance"
key = "keep-local-preferences-out-of-shared-governance"
lifecycle = "active"

[metadata]
aliases = [ "scenario:58:preference-scope-isolation" ]
sourceClass = "authored"
+++

# Preference scope isolation

## Given

Acceptance case "Preference scope isolation": the source fixture and declared dependencies are available; this case does not imply implementation or proof.

## When

Give one developer a local preference for TypeScript and managed infrastructure while the project has no adopted equivalent preference.

## Then

recommendations may rank viable options accordingly for that developer, but no repository rule is created and another developer's accepted project state is unchanged. Explicitly adopting the preference at project scope makes it shared decision input. Enforcing it still requires a constraint/decision.

## Then

Unit evaluation must cover: preference scope/composition and non-blocking type semantics.

<details>
<summary>Structured record details</summary>

```toml
realizations = []
evidence = []

[scope]
op = "atom"
field = "requirement"
matcher = "equals"
value = "requirement:scoped-reconsideration"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-architecture.md"
contentHash = "sha256:v1:5c3b61124058d6743e05a658b5a63da8b930cbc1b716948bcba2170c7f91e74b"
description = """Full acceptance case \"Preference scope isolation\", starting line 21; immutable Git blob 05cc5c84adbe05846b4c779d6d055783f2c321b1. \
  Hash binds original Git bytes."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/11-validation/testing-and-adversarial-evaluation.md"
contentHash = "sha256:v1:07e8c964f8698c9cb85e4dea06a97d1ba867ca00394eaab7d1df04a748113d7e"
description = "Unit coverage family 17; immutable Git blob 130a7cbb9c87d445fe907bbf83efb60ecb066157."

```
</details>
