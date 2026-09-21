+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "concept"
id = "concept:safe-project-data-readiness"
key = "safe-project-data-readiness"
lifecycle = "active"

[metadata]
kind = "constraint"
aliases = [ "format readiness", "recoverable cutover", "operation access" ]
sourceClass = "authored"
confidence = 1
tags = [ "readiness", "migration", "backup", "recovery" ]
+++

# Safe project-data readiness

Before loading strict project data, report bounded readiness and obtain the required cooperative operation access. Inactive, unsupported-format, busy, unavailable and recovery-required states remain explicit. Initialization publishes configuration last. Projector 3 makes one checked cutover from its self-hosted v2 data: preserve a verified snapshot and unfinished evidence, validate staged records and ID/path bindings, and publish recoverably only after controlled transactions are resolved. Inspection and resume do not apply changes or reclaim ambiguous ownership. Shipped v3 operations accept the current format without retaining old release-by-release migration chains or legacy readers. Package patch versions do not by themselves change authored meaning or require a metadata migration. Nonparticipating old processes must be quiescent before cutover.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

```
</details>
