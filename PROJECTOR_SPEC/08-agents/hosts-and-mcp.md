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


