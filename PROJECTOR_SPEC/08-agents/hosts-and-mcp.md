# Host and MCP Integration

## Host integration

## Capability model

Host adapters report capabilities rather than leaking host-brand assumptions into the engine:

- scoped instruction installation.
- lifecycle hooks.
- programmatic task execution.
- subagents.
- isolated worktrees.
- structured result support.
- tool-call observation.
- filesystem/shell observation.
- cancellation.
- state-bound capability/token support.

## Integration levels

1. **Instruction/skill:** the host is taught to invoke Projector.
2. **Lifecycle enforcement:** pre/post mutation and completion gates.
3. **Programmatic orchestration:** Projector dispatches state-bound work packets directly.

Projector MUST remain useful at level 1, but stronger guarantees are only claimed when the host capability actually supports them.

## Wrapper

Where supported:

```bash
projector run codex -- ...
projector run claude -- ...
```

The wrapper:

1. Gets or joins a Projector session.
2. Loads or rebuilds semantic state.
3. Resolves `ExecutionPolicy`.
4. Injects minimal host instructions.
5. Exposes state-bound Projector tools.
6. Resolves semantic identities and compiles bounded Relevance Closure when the host starts a meaningful change.
7. Observes relevant mutation/tool events.
8. Compiles Execution Capsules from the relevance/impact subgraph.
9. Reconciles at checkpoints/session end.
10. Enforces policy only to the degree supported by host capability.
11. Emits coverage/cleanup/receipt/certificate deltas.

## Generated host instructions

Generated instructions are derivative outputs of canonical rules and MUST be regenerable. They SHOULD be concise because deterministic enforcement belongs in Projector machinery. Host instructions and per-task agent context SHOULD use the applicable Semantic Representation Profile and bind to the same source semantic hashes/state as the capsule.

When Projector can supply the structured rule/predicate kernel, a host adapter MUST NOT use compact instructions as the only copy of a hard rule. If a host only supports prose instructions, Projector MUST use the least-compressed representation that satisfies the required preservation assurance and state the weaker enforcement capability.

Example:

```md
## Projector

Before repository modifications:
1. Compile task context with Projector.
2. Stay inside returned write scope.
3. Prefer Projector transforms for mechanical work.
4. Run required validators.
5. Reconcile before completion.
6. Change canonical Projector governance only through Projector commands.
```

Instruction prose is not itself an enforcement guarantee. A passing clarity/token-style lint is also not an enforcement or semantic-equivalence guarantee.

---

## Installed agent change workflow

The installed `$projector-change` workflow is a level-1 host integration over the public repository change lifecycle. Its skill tells the agent to inspect repository authority, author the strict proposal, and ask only about unresolved material ambiguity. The skill and its wrapper MUST NOT compile semantics, edit target files, issue approval, or implement recovery themselves.

The installed wrapper MUST invoke only the installed Projector CLI, or one exact configured CLI path. It MUST NOT search for a Projector source checkout or use a fixture fallback. If the CLI is unavailable, it fails closed.

`start` MUST call public `change` and `plan`, return the preview/change selector/exact plan hash, and stop with `approval-required`. The agent MUST show that exact tuple to the human. It MUST NOT infer approval from broad authorization or prior consent.

After the human supplies the exact hash, `approve` passes the change selector and exact plan hash to the public approval command. `apply`, `recover`, and `resume` pass the approval selector to the corresponding public command. A structured nonzero CLI result, including `recovery-required`, MUST remain machine-readable and keep its original nonzero exit status.

The wrapper MUST be stateless CLI pass-through. It MUST NOT persist continuation, trace, approval, or recovery state. Durable lifecycle authority and evidence belong to the control plane. Release acceptance MAY capture an external invocation transcript.

The installed session hook MAY announce Projector only when it resolves the current repository and the installed CLI boundary. It MUST also validate the strict repository-root activation marker. The hook MUST remain silent when any condition is unavailable. Source-checkout layout, a Git root, or a `.projector/` directory is not activation evidence.

---


## MCP interface and mutation capabilities

Read-first tools:

```text
projector.status
projector.audit
projector.explain
projector.context
projector.coverage
projector.list_divergences
projector.preview_plan
projector.preview_transform
projector.preview_representation
projector.validate_representation
projector.validate
projector.resolve_identity
projector.relevance
projector.requirements
projector.scenarios
projector.impact
```

Controlled mutation tools:

```text
projector.apply_transform
projector.execute_packet
projector.accept_decision
projector.create_exception
projector.apply_plan
```

The tool names above are the canonical capability catalog, not a claim that every capability is operational in every server composition. `tools/list` MUST advertise only tools backed by production handlers in the current authenticated session. A conditional handler, such as a representation tool, MUST remain unadvertised when its required session binding is absent. Projector status output MUST account for every catalog entry and identify declarations that are not operational.

MCP startup MUST bind one repository root from explicit host authority or the authenticated parent host context. Tool arguments MUST NOT retarget that root. Plugin, source, and cache working directories are not repository authority. An ambiguous root binds an inactive neutral context.

In an inactive project, MCP initialization and `projector.status` remain available. Status reports `not-enabled`. Audit and divergence tools report unavailable without invoking analyzers. No inactive tool may infer, persist, or mutate project state.

An unadvertised tool call MUST fail as unknown. It MUST NOT issue or consume authority, invoke a placeholder, or mutate repository state. A controlled tool MUST remain unadvertised until its production handler proves all required authority and scope restrictions. The handler MUST route mutation through the coordinated transaction, observation, and recovery boundary. Projector MUST NOT issue mutation capabilities solely because a controlled tool name exists in the catalog.

Mutation tools MUST require an unforgeable session capability bound to:

- session ID.
- plan/packet ID.
- `StateBinding` plus its compiled-against `StateDigest`.
- allowed operations.
- permitted semantic/write scope.
- maximum risk/approval state.
- expiry or revocation state.

A capability compiled for one worktree/state binding MUST NOT authorize mutation after any dependency in that binding changes or becomes unprovable. If a global snapshot/rebase leaves all bound value and query dependencies unchanged, policy MAY allow rebinding. A root-digest difference alone does not require rejection.

Read-only tools do not require mutation capabilities but still respect secret/context policy.

---
