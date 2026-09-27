# Writing Projector documentation

This guide is for contributors updating the README and docs. The documentation structure adapts OpenSpec's reader journey: show a practical result, route readers by their task, explain concepts, then provide exact reference and help.

## Contents

- [Choose the page role](#choose-the-page-role)
- [Write a practical story](#write-a-practical-story)
- [Use precise invocation terms](#use-precise-invocation-terms)
- [Draw relationships](#draw-relationships)
- [Provide navigation](#provide-navigation)
- [Keep claims grounded](#keep-claims-grounded)
- [Review a documentation change](#review-a-documentation-change)

## Choose the page role

| Page role | Reader question | Projector home |
| --- | --- | --- |
| README | What does this do, and can I picture using it? | Repository entry point |
| Documentation home | Where should I start for my situation? | `docs/README.md` |
| Getting started | How do I reach my first checked candidate? | `getting-started.md` |
| Examples | What would I say and see in a real situation? | `examples.md` |
| Workflow guide | Which action should I choose next? | `workflows.md`, recovery and integration guides |
| Concepts | Why do these artifacts and boundaries exist? | `overview.md` |
| Reference | What are the exact interfaces and limits? | `skills.md`, `reference/runtime.md` |
| Help | What does this problem mean, and what can I do? | FAQ, troubleshooting, glossary |
| Evidence | What was actually checked, under which conditions? | Qualification and verification pages |

Keep one main purpose per page. Link to the full procedure instead of maintaining several copies. Retain product-specific pages when a shared category needs a different shape; page counts need not match another project.

## Write a practical story

State the situation and the desired behavior. Show the user invocation, the agent's meaningful response, the human review point, and the resulting artifact or state. Explain the important boundary before the reader could mistake it.

Label hypothetical transcripts as illustrative. Use an actual retained result only when its evidence supports the claim. Do not invent a successful check, branch hash, or review attribution.

The search-navigation story should explain list boundaries and text input. A recovery story should show how to resume the same candidate. A merge story should explain why the original target remains unchanged during an unresolved conflict.

## Use precise invocation terms

Call `$projector:propose` and its peers skill invocations. They belong in host-agent chat. Call terminal runtime requests CLI operations; call MCP requests tools.

Use exact installed skill names. Do not borrow another product's command namespace or assume a CLI executable has the same user role as a skill. Keep internal selectors and evidence fields in reference material unless they help the reader make a concrete decision.

## Draw relationships

Use Mermaid when a workflow, ownership boundary, or state change needs a picture. Give each diagram one job and explain its relationships in prose immediately afterward.

Use quoted node labels, as in `C["Managed candidate"]`. Use words as well as arrows to distinguish branches. Avoid color-only meaning, host-specific features, and large diagrams that require zooming.

Useful Projector diagrams show proposed versus accepted authority, selected-checkout implementation, check-input freshness during revision, and recoverable publication after temporary finalization. They must reflect implemented behavior.

## Provide navigation

Every repository README needs a manual contents list. Add one to a guide with six or more major sections. Link only real headings; do not include headings inside fenced examples.

The docs home routes by reader intent and includes the full page map. Finish a guide with the next useful destination. Keep the README docs map compact.

Related-project orientation stays brief and factual. Use repository URLs so readers can follow links without sibling checkouts. Do not make a full comparison or imply artifact compatibility.

## Keep claims grounded

Check skill behavior against packaged skills and runtime guarantees against implementation and existing qualification. Preserve conditions, quantities, exception scope, and exact syntax.

Human explanations should use concrete examples and ordinary verbs. Procedures should name the actor and action. Requirements or implementation instructions should retain their original force.

Keep historical evidence at its recorded version. A passing build does not establish interaction behavior. A successful plugin registration does not establish tool execution. State the current local Git and language qualification alongside the relevant guides.

## Review a documentation change

1. Read the complete affected page as a newcomer and follow its suggested path.
2. Check file links, heading anchors, contents lists, and next destinations.
3. Compare invocation names and options with their owning interfaces.
4. Check Mermaid syntax, quoted labels, and adjacent explanations.
5. Inspect claims and transcripts for unsupported success or missing limitations.
6. Run the available writing advisory checks and review their findings in context.

Do not add a permanent validator merely to check one documentation edit. Use bounded checks and preserve unrelated work. See [development](development.md) for the repository checks and [documentation home](README.md) for the reader-facing map.
