---
name: projector
description: Retrieve accepted project meaning, check consequences, and restore context in a repository using Projector.
disable-model-invocation: false
---

# Projector

Use `node <plugin>/scripts/projector.mjs` as `projector` below. Resolve
`<plugin>` from the skill directory. The command requires Node 24 or later. It
works without a repository package-manager command. Use `--root <absolute
repository>` when the target differs from the current directory.
When the installed `projector_*` MCP tools are available, use the matching
operation tool with an explicit absolute `repositoryRoot`. The resident MCP
process uses the same registered operation runner and Core input contracts as
the command. Keep the CLI route for shells and hosts without the MCP connection.

## Everyday work

1. Run `projector context "the requested outcome"`. Name relevant IDs with `--entity` and current source paths with `--target` when known. Read the returned whole sections, typed relationships, rationale, evidence and unknowns. A retrieval candidate does not prove identity or applicability. An omitted obligation or open query is unresolved; use focused context or `inspect` before relying on it. Retain the context ID.
2. Make the authorized change with ordinary Codex tools. If intended meaning changes, use `$projector-change` first. Implementation choices may change while preserving the model. Select existing obligations before inventing new identities. Resolve uncertainty with current source and behavioral evidence.
3. Run relevant behavior checks, then `projector check <context ID>`. Explain the change, obligations checked, concrete results and remaining uncertainty. A changed assumption or newly discovered consumer requires reconsideration; it is not automatically a violation. Preserve unaffected conclusions. A successful command does not establish untested behavior.

The user may already have authorized the whole task. Carry that authorization forward. Ask only about a material decision that cannot be resolved from it and current evidence.

## Start or resume

Run `projector init` only when the user has requested activation. Canonical prose lives in readable Markdown under `.projector`; its TOML metadata holds identity and typed bindings. Independent relations and policies remain TOML. The Markdown index is the human entrypoint. There is one editable source per fact.

Run `projector resume <actual context/change/approval ID>` after a session reset. Read the restored meaning and currentness result before continuing. A stale ID is a route to evidence, not authority. With no known anchor, retrieve fresh context; do not guess the latest one. Resume never applies work or renews approval.

For an interrupted controlled write, inspect its actual approval and use `projector recover <approval ID>` explicitly. Preserve journals and failed attempts. Review a new preview when meaning, scope or dependencies change. Recovery restores consistency; it does not decide to apply again.

## Inspect when necessary

Normal observation has no implicit execution deadline or repository-size ceiling.
A caller may request a finite limit explicitly. If that limit expires, inspect
the reported stage and retained evidence. Fix an obvious recurring inefficiency
when expected savings warrant its implementation and verification. Choose any
subsequent limit to match the user's request and the work. For example,
`projector audit --timeout-ms 120000` explicitly allows two minutes per operation.
Keep coverage, unknowns and authority checks intact. A timeout does not establish
conformance or authorize a mutation. Before retrying a write that may have
stopped, inspect its actual change or approval ID. Use explicit recovery when
required.

Run `projector audit --scope <path> --context <context ID>` to inspect unresolved accepted work. Omit `--context` when no retained context applies. Read evidence availability, repair recommendations and omitted question counts. A current audit observation does not make a stale retained context current. Audit does not edit source or accepted meaning or execute repairs; existing services may create runtime observation artifacts. Implement existing meaning with ordinary Codex tools, obtain missing evidence, or use `$projector-change` when accepted meaning must change. An advertised transform is usable only when the report establishes its executable binding.

`projector inspect <ID>` exposes exact metadata, provenance, hashes and recovery
detail. `--json` gives machine results for a command. Read
[operation-contract.md](../../references/operation-contract.md) only for a
custom integration or a lifecycle detail the short command does not expose. Use
`$projector-review` for a consequential change review and `$projector-assimilate`
for source synthesis that is not yet accepted meaning.

For a concrete question, start with context: what behavior exists, why it exists,
what governs it, what depends on it, or which evidence is missing. Read the
selection reasons and unresolved frontiers beside the selected records. Follow
the displayed exact-record or retained-evidence route when the compact view
omits detail. A focused expansion observes current state; it does not overwrite
the earlier context. Use `context --full` when the full current result is needed.

Use `$projector-verify` to choose checks and maintain their protection. For a
native process check, use `verify check.json`; inspect history with
`verify --inspect [EVENT]` and recover complete pending evidence with
`verify --recover`. For generated files, use `generate generation.json`, inspect
with `generate --inspect producers.json`, and recover with
`generate --recover producers.json`. These operations need no candidate ID.
Read [verification and generation contracts](../../references/operation-contract.md#native-verification-and-generation)
for strict request schemas, complete-input limits and recovery behavior.

For branch or incoming-change integration, run `projector integration --target
REF --incoming REF` against the actual contributions. Use `--result REF` for an
available ordinary or provider merge result. Read altered/lost contributions and
the remaining verification gaps; a completed assessment is not a passing merge
gate. Read [the integration contract](../../references/operation-contract.md#acceptance-and-recovery)
when selecting the base or interpreting calculation limits. Continue through
ordinary Git and the applicable review and verification gates.
`evaluate options.json` exposes concern-scoped option and preference reasoning
without accepting a decision. For interrupted representation publication,
inspect with `inspect --representations` before explicit
`recover --representations`. An uncaptured change remains uncaptured.
