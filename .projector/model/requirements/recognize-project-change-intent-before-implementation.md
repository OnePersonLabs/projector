+++
format = 3
apiVersion = "projector/v3"
schemaVersion = "3.0.0"
kind = "requirement"
id = "projector-requirement_0272e6aa6b6a02aa24572b72939c539d"
key = "host-change-intent-routing"
lifecycle = "active"

[metadata]
aliases = []
sourceClass = "authored"
+++

# Recognize project change intent before implementation

For a Projector-active target, recognize proposed changes to behavior, architecture, requirements, or shipped skills before dependent implementation, including proposals introduced by the agent, a target discovered late in a turn, or a capability change discovered midway through implementation. Retrieve accepted meaning and use the existing canonical change lifecycle when intended meaning changes. Carry forward existing user authorization. Planning-only discussions stay in planning; speculative ideas are not accepted requirements. Hook guidance is advisory and model interpretation owns meaning; do not classify intent through keyword matching or transcript parsing.

Use $projector as the single primary conversational entry point for developing software through its conceptual model. Questions about proposed work retrieve and explain applicable concepts, requirements, scenarios, relationships and decisions without authorizing changes. Native Codex Plan mode proposes concrete artifact changes and implementation consequences for discussion and revision. It must not capture or accept canonical changes or implement code. The conversation plan records intent; it is not a retained Projector approval. Revalidate the model and dependencies when execution becomes authorized and the host permits it.

For an authorized change, automatically carry the requested scope through canonical acceptance, implementation and verification. Preserve exact preview/apply, identity, currentness and recovery requirements. Do not require separate implementation or verification prompts. Retain future model commitments outside the requested implementation scope. A repair that restores accepted behavior can leave the model unchanged. Surface unresolved conceptual choices and material departures before acceptance; implementation difficulty does not authorize weakening the model.

Keep $projector-verify for checking actual code or a candidate diff against the model, including concrete counterexamples, current producers and consumers, persistence, registrations, behavior checks and unavailable evidence. Keep $projector-reconcile for investigating outside edits without treating code as authority, and $projector-assimilate for substantial source synthesis. Main-workflow execution includes the applicable review and verification work automatically. These skills use host execution and delegation without a parallel task queue or planning store.

The conversational workflow exposes the conceptual artifacts it proposes to change. Name affected concepts, requirements, scenarios, relationships and decisions with their stable identities and readable paths. Show proposed additions, revisions, retirements and relationship changes with readable content, rationale and implementation consequences. Preserve existing identities and explain new boundaries. Let the developer discuss and revise proposed meaning before authorizing execution. After execution, report actual artifact changes with links, implementation results, observed verification and unresolved evidence. State explicitly when the model is unchanged. User-facing documentation demonstrates this complete workflow with concrete readable artifact examples.

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
