# Frequently asked questions

## Starting

### Do I have to write the requirements myself?

The agent writes the proposal, requirements, design, and tasks. You review the behavior and tradeoffs and request corrections. See [getting started](getting-started.md).

### Where do I type a skill invocation?

In your Codex chat, in the repository you want to work on. Use `$projector:propose` or select the skill. The terminal CLI is an internal runtime interface. See [skill invocations](skills.md).

### Is Projector available in a public marketplace?

This checkout documents local Codex plugin installation. Ask the agent to install and verify it; do not assume a public listing. See [development](development.md#local-plugin-installation).

### What if I do not know the solution yet?

Use `$projector:explore` with the problem, constraints, and a concrete example. Exploration reads and compares alternatives. It authors artifacts only when a proposal is also authorized.

## Plans and implementation

### Can I review one artifact at a time?

Ask `$projector:propose` for incremental planning. The next layer is authored and later layers stay absent. `$projector:continue` can advance that frontier.

### Can I authorize the whole run?

Yes. Explicitly request the plan, implementation, checks, and finish together. That carries through interruptions and includes integration. Material ambiguity still needs a decision. Deployment requires its own request.

### Can I change the plan after implementation starts?

Use `$projector:revise`. The agent preserves still-applicable requirements and accounts for contributions to retain, remove, replace, or revise. Relevant evidence can become stale.

### Are checked tasks proof that the feature works?

They record performed work. Executed evidence and an independent review establish the bounded checks used for completion. A task cannot substitute for them or override a requirement.

### Can I bring code I already wrote into Projector?

Use `$projector:reconcile` and identify a coherent patch. It preserves your original worktree and staging state while importing the selected implementation into a candidate for verification.

## Candidates and completion

### Why is my original checkout unchanged after finish?

Finish integrates the result into the selected branch. Use `$projector:merge` for another selected source branch. See [integration](integration.md).

### What is the difference between verify, sync, and finish?

Verify gathers current evidence and independent review. Sync materializes the target requirements and design in the candidate without archiving. Finish executes the completion pipeline and publishes the candidate.

### What happens if finish is interrupted?

Use `$projector:continue` or request finish for the same change. Durable state identifies the candidate, target, and remaining obligations. Moved refs or mismatched targets are reported, not overwritten.

### Can I finish several changes at once?

Name them or explicitly request all eligible changes. A dependent candidate needs its prerequisite result in its baseline. Bulk finish cannot silently integrate sibling branches.

## Boundaries

### Does Projector make its own model calls?

The deterministic runtime makes zero model calls. Your host agent supplies interpretation and independent review. The full workflow therefore includes host-agent work.

### Which projects are qualified?

Local Git repositories with built-in Markdown, JavaScript/TypeScript, C#, Rust, Python, HTML, CSS, and SCSS providers plus static Tauri/React Native relationships. Indented Sass semantics, unproven native wiring, dynamic relationships, OpenSpec stores, and unobserved writes remain explicit limits. See [runtime limits](reference/runtime.md).

### Does setup replace my OpenSpec configuration?

Initialization preserves existing configuration and reports customized schema conflicts. Each new Projector change selects its schema explicitly. See [existing projects](existing-projects.md).

### Does a merge publish or deploy my software?

It integrates a reviewed source branch into the selected working branch. Release publication and deployment are separate actions.

## Next steps

Use [examples](examples.md) for a complete story, [the glossary](glossary.md) for terms, and [troubleshooting](troubleshooting.md) for a specific failure.
