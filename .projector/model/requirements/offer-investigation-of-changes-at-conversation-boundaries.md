+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "projector-requirement_79c7928e16eb5643c8b6778091634417"
key = "boundary-repository-change-check"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Check changed files when context is used

When context is requested or checked, observe the current revision, staged changes, working files, deletions and nonignored new files. Include canonical Projector records and exclude disposable runtime state. Distinguish unchanged, changed, no previous observation and incomplete observation; report bounded paths and limitations. Repeated observation must preserve unresolved findings.

Validate retained knowledge before reuse. Changed files justify scoped reconsideration, not a claim of semantic drift. Quiet session instructions may explain the workflow; do not rescan the checkout or inject repeated reminders at each prompt or tool call. Use the current task and existing authorization to decide whether deeper investigation is needed.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"
items = []

[[origin]]
kind = "document"
locator = "proposal:sha256:v1:598c8dc3878ef3fd2f2bb3750a31d2953534dd2be7f6e361a2fd02af5d5ebb99"
contentHash = "sha256:v1:598c8dc3878ef3fd2f2bb3750a31d2953534dd2be7f6e361a2fd02af5d5ebb99"
description = "Structured interpretation proposed for approval; not a verbatim user request."

```
</details>
