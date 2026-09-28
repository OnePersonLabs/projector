# Configured application evidence host

The installed CLI can connect to an explicitly configured assessment host.
The host assesses observations that it owns. This connection does not collect
application observations, start an application, or prove that a host assertion
is true. Without configuration, application evidence remains unavailable.

Set these Windows user environment variables through the Windows environment
settings or `System.Environment.SetEnvironmentVariable` with the `User` target:

| Variable | Required value |
| --- | --- |
| `PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT` | Absolute HTTPS endpoint, or HTTP endpoint on `127.0.0.1` or `[::1]` |
| `PROJECTOR_APPLICATION_EVIDENCE_HOST_ID` | Identity of the trusted assessment host |
| `PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD` | Exact trusted assessment-host build or revision |

Restart the calling host after changing user environment variables so that its
process inherits them. All three values are required when any is set. The URL
cannot contain credentials, a query, or a fragment. Repository configuration
cannot select an endpoint or execute a host module. No repository path is sent.

The endpoint implements `projector-application-evidence-http@1`. Its JSON POST
has exactly three fields: `protocol` with that version string, `host` with the
configured `id` and `build`, and `request`. `request` must be a complete
`ApplicationEvidenceAssessmentRequest` from
`packages/core/src/schemas/application-evidence-assessment.ts`. It binds the
canonical owner, scenario, adapter version, predicate, assertions, observation
role, and evidence IDs. The response has exactly `protocol`, `host`, and
`assessment` fields. `protocol` and `host` must match the request.
`assessment` must satisfy the core `ApplicationEvidenceAssessmentSchema`,
including its exact content hash and exact request binding.
After validation, the CLI adds the reserved artifact dependency
`application-evidence-host:configured-transport` and recomputes the assessment
hash. This dependency hashes the endpoint, host ID, and host build. A change to
any of these changes the retained assessment identity. The host must leave one
of the 256 dependency slots free and must not use that reserved dependency ID.

The host must establish producer identity, artifact custody, collection method,
source or application build, controller state, observation inputs, freshness,
and relevant dependencies before asserting satisfaction or violation. It must
report unknown fulfillment for unavailable custody or noncurrent observation.
The configured host ID and build identify the assessment implementation. They
do not replace the observed application's identity or build. The host owns
application setup, teardown, access credentials, and supported surfaces.

Assessment is a read-only, idempotent operation. The CLI retries only HTTP 502,
503, or 504, once, and emits a structured warning with status and attempt. It
does not retry collection or mutation. The complete assessment has a 10-second
deadline and uses the operation cancellation signal. Request and response
bodies each have a 1 MiB limit. Redirects are rejected. Configuration values,
URLs, request bodies, and response bodies are not logged by this adapter.
Other HTTP errors, invalid JSON, schema violations, mismatched host identities,
mismatched requests, and invalid hashes fail the assessment explicitly.

HTTPS authenticates the configured endpoint through the platform's TLS trust.
Numeric loopback HTTP trusts the local process that owns that port. Host identity
and build echoes detect mismatches; they are not cryptographic host attestation.
The core hash detects response changes and reuse against another request; it
does not prove an observation. Configure only a host whose observation and
custody implementation you trust. An endpoint can learn the canonical evidence
request and must be authorized to receive it.

Real loopback-server tests cover current, violated, stale, missing, mismatched,
tampered, interrupted, oversized, redirected, and transient HTTP responses.
No external application target has been qualified by these tests. Qualification
of a real target requires its owned observation implementation and current
evidence for the actual application surfaces.
