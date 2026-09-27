# Documentation guide

This guide sets the writing and structure for Projector's user-facing documentation. It is for contributors who add or revise README and `docs/` content.

## Contents

- [Organize by reader need](#organize-by-reader-need)
- [Write practical stories](#write-practical-stories)
- [Use diagrams with explanations](#use-diagrams-with-explanations)
- [Keep terms precise](#keep-terms-precise)
- [Write in the right voice](#write-in-the-right-voice)
- [Orient readers and link onward](#orient-readers-and-link-onward)
- [Check claims and links](#check-claims-and-links)

## Organize by reader need

- The README states the product promise, shows one practical story, explains one main diagram, and routes readers onward.
- `docs/README.md` helps readers choose a path.
- Getting started takes a new user to a first successful outcome.
- Examples show a real situation, invocation, agent behavior, review point, result, and boundary.
- Workflows explain which route to choose and the steps that matter.
- Concepts explain the model and why it exists.
- Reference pages define exact commands, inputs, outputs, and constraints.
- FAQ and troubleshooting resolve common questions and failures.
- Development material targets Projector contributors.

Do not duplicate full procedures across pages. Link to the page that owns the complete explanation.

## Write practical stories

Each story names the situation, the skill invocation or CLI operation, what Codex does, where a person reviews the result, the resulting artifact or state, and the boundary of the claim. Use actual workflows and invocation syntax from the installed skills. Label example IDs or values as illustrative when they are not copied from a real fixture.

## Use diagrams with explanations

Give each Mermaid diagram one job and keep the node labels readable. Quote every node label with double quotes. Use GitHub-compatible syntax. Explain the sequence and any important boundary in prose immediately after the diagram. Do not use a diagram as a substitute for a workflow description.

## Keep terms precise

Call `$projector`, `$projector-change`, `$projector-review`, `$projector-reconcile`, and `$projector-assimilate` skill invocations. Call `projector context`, `projector check`, and related terminal forms CLI operations. Keep accepted meaning, implementation evidence, retrieved context, and assimilation synthesis distinct.

## Write in the right voice

Use direct, consistent prose for setup steps, operational procedures, CLI references, and contributor rules. Preserve every condition, failure boundary, and exact command. For human-facing explanations and stories, use a natural teaching voice and keep the technical detail the reader needs to act. Do not force a controlled style on prose whose purpose is to explain an idea.

## Orient readers and link onward

Give the README and each substantial guide a manual Contents list. Add one to every guide with six or more main sections. At the end of each guide, link to the next useful reading. Include a brief, factual Related projects note in the README and documentation home so readers can find Projector 4 and Kerf. Keep the note short and secondary to Projector 3; do not turn it into a comparison or duplicate their documentation.

## Check claims and links

Before publishing a doc change, check all relative links, headings, and fragments. Verify command options against `packages/cli/src/public-command.ts` and invocation names against the skill frontmatter. Verify model claims against `.projector/README.md`, schemas, and current source. Avoid claims that a check establishes more than its evidence.

The prose checks are advisory. Read every finding in context and correct only issues that improve accuracy or clarity. Keep Mermaid labels quoted and explain every README diagram directly after the code block.

Continue with [Development](development.md) or return to the [documentation home](README.md).
