+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "behavioral-scenario"
id = "scenario:inspect-and-deliver-plan-bound-instructions"
key = "inspect-and-deliver-plan-bound-instructions"
lifecycle = "active"

[metadata]
aliases = [ "scenario:18:operational-mcp-advertisement" ]
sourceClass = "authored"
+++

# Inspect and deliver exact plan-bound instructions

## Given

A planned change has exact rendered instructions and durable provenance; approval may be absent, current or stale.

## When

A fresh installed session requests bounded inspection or authorized delivery of that exact artifact.

## Then

The runner returns exact selected text and separately reports artifact integrity, dependency freshness including relevant dirty edits and profile or query membership, semantic fidelity, approval status and delivery stage. Inspection works before approval; execution proceeds only with current authenticated authority.

## Then

Operation discovery reports registered handler reachability separately from bounded project readiness and directly observed host capabilities, without converting handler presence into an enforcement or availability claim.

## Then

Interrupted delivery remains recoverable without fabricating consumption or rerunning committed effects, and missing advisory notes neither authorize mutation nor block authenticated recovery.

## Must not

A matching content hash, unchanged HEAD, prior approval, stored session consistency or successful delivery is reported as current authorized behavioral completion.

## Must not

A mismatched repository, plan revision, capsule, kernel, rendered text or stale representation profile reaches execution.

## Given

Additional acceptance case: The installed registered runner exposes capability discovery and plan-bound instruction inspection.

## When

Additional acceptance case: Request installed registered-operation capability discovery and attempt an unsupported mutation request; inspect plan-bound instructions before approval and with current or stale approval.

## Then

Additional acceptance case: Discovery derives reachability from registered handlers and separately reports bounded readiness and directly observed host capabilities. Unsupported operations return explicit unavailable or unsupported results without a mutation capability or repository mutation. Inspection is distinct from authorization and execution.

## Must not

Additional acceptance case: A handlerless declaration is presented as operational, handler presence is reported as enforcement or readiness, or instruction inspection silently authorizes mutation.

<details>
<summary>Structured record details</summary>

```toml
evidence = []

[scope]
op = "any"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "packages/control-plane/src/representation/**"

[[scope.items]]
op = "atom"
field = "path"
matcher = "equals"
value = "packages/cli/src/operation-runner.ts"

[[scope.items]]
op = "atom"
field = "path"
matcher = "glob"
value = "plugins/projector/**"

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:PROJECTOR_SPEC/12-delivery/acceptance-core.md"
contentHash = "sha256:v1:5471e7090610ccdf0d8e567ec2ea1cbba53dc726f6ea53d51f9cac52d994d0fc"
description = """Historical acceptance conditions, lines 133-139; immutable Git blob 804692b98650789629c95b699fa20de3b026d634. \
  Content hash is SHA-256 of exact source blob bytes. Source conditions require reviewed disposition, \
  not automatic authority."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/decisions/f1d7f82a89ecaa14199107b9aed7953eba0a14e39b42672b61b3f24db1322d51.decision.json"
contentHash = "sha256:v1:623673cf17762ec9d36c6e364e59e739ee940eb58bf4c1333f37deb6ee3f9210"
description = """Accepted registered in-process runner supersedes standalone MCP and wrapper-to-CLI delivery prescriptions. \
  Immutable Git blob d307af7324bdae70577cbec60042b4fc8ed05db1; exact-byte SHA-256."""

[[origin]]
kind = "document"
locator = "git:e6ac9c766c52e25fca87074dd3fa7d67d28fc7e5:.projector/model/concepts/01561d6546adb32a8afb29429380b0ecdec1bd6a9dd562fbea23a395381ca5b8.concept.json"
contentHash = "sha256:v1:a4dd211d265700ff82bf503b4cedf13661ad8d9ec3aea6f147004e754a9634c3"
description = """Accepted host integrity preserves exact authority, state, provenance, cancellation and recovery without \
  confinement or hostile same-user protection. Immutable Git blob 3ccfee51b0a75179711d6ded3324b17b8279da61; \
  exact-byte SHA-256."""

```
</details>
