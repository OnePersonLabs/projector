+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "concept"
id = "concept:human-readable-persisted-artifacts"
key = "human-readable-persisted-artifacts"
lifecycle = "active"

[metadata]
kind = "constraint"
aliases = [ "readable canonical Markdown", "typed authored metadata", "semantic artifact hashing" ]
sourceClass = "authored"
confidence = 1
tags = [ "persistence", "readability", "markdown", "hashing" ]
+++

# Human-readable persisted artifacts

Use Markdown as the sole authored source for concepts, requirements, scenarios, concerns, decisions and rationale. Keep stable identity, lifecycle, scope, typed references and evidence bindings in TOML metadata; independent relations, executable policies and configuration remain structured TOML. Use readable filenames independently of stable identities and provide an ordinary Markdown index. Parse into the existing executable Core contracts without an editable mirror. Preserve exact authored meaning during format conversion before separate semantic cleanup. Semantic currentness derives from normalized parsed values. Exact bytes remain bound for reviewed mutation, executable input and recovery. Keep hashes, journals and detailed history off the ordinary reading path, available through inspection. Hash agreement does not establish truth, acceptance or fidelity.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

```
</details>
