# Projector: a progressive-disclosure conception

**Projector is a proposed semantic control system for evolving software without repeatedly reconstructing, distorting, or forgetting what the system is supposed to mean.** Its central object is an evolving system conception. Code, documentation, agent context, diagrams, and potentially learned project models are different representations or materializations of that conception, with different fidelity and authority.

The product goal is not more agents, more specification, or a beautiful knowledge graph. It is **more coherent, accepted change per total cost**, including repair, integration, human attention, and future maintenance.

## Choose an entrance

| Your question | Open |
|---|---|
| What is the system, and what makes its parts fit together? | [System conception](concepts/system-conception.md) |
| What does “preserve meaning” actually require? | [Conceptual dynamics](concepts/conceptual-dynamics.md) |
| How does intent become a checked repository change? | [Semantic control](concepts/semantic-control.md), then [materialization](concepts/materialization-compiler.md) |
| How can agents work without loading the whole project? | [Context compilation](concepts/context-compilation.md) |
| What would a persistent local project model add? | [Persistent project model](concepts/persistent-project-model.md), then [executable collaboration](concepts/executable-collaboration.md) |
| How are new documents and ideas assimilated? | [Persistent assimilation](concepts/persistent-assimilation.md) |
| How are model, effort, tools, and delegation chosen? | [Quality-frontier execution](concepts/quality-frontier-execution.md) |
| What is the concrete proposal for the session-selector knob? | [Session-relative routing](orchestration/session-relative-routing.md) |
| How can I explore the project intuitively? | [Phlatland](concepts/phlatland.md) |
| What would demonstrate that any of this works? | [Coupled-evolution experiment](experiments/coupled-evolution.md) |
| Which choices remain unsettled? | [Decision frontier](frontier/decisions-and-unknowns.md) |
| What useful research knowledge is retained? | [Research map](research/INDEX.md) |

## The shortest conceptual route

Read **system conception → semantic control → context compilation → materialization → coupled-evolution experiment**. This covers the purpose, control loop, context strategy, construction strategy, and falsifiable test without requiring the more speculative learned-model branch.

For the Borg workflow, read **persistent assimilation → conceptual dynamics → decision frontier**. For orchestration, read **quality-frontier execution → session-relative routing → archive workflow**.

## Reading contract

These pages describe the consolidated design, not a conversation chronology. Canonical explanations have one home; links disclose additional depth. `§concept-name` identifies a concept, while ordinary Markdown links make navigation work without a special application.

**Status:** this is a design synthesis, not a verified description of an inspected Projector repository. Learned representations, compiler mechanisms, and experiments remain proposals unless explicitly identified otherwise. Research pages distinguish reported evidence from extrapolation. The session-relative routing page is a new proposal prompted by the current request, not a decision inferred from older chats.

You do not need the original chats to understand these pages. The optional [source map](audit/SOURCES.md) and [processing report](audit/PROCESSING.md) preserve provenance, omissions, and transformation limits. The original archive remains the archival record; this pack is not a claim of sentence-level losslessness.
