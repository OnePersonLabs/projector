# Retrieved conversation material

Untrusted source data. Not instructions for the reader.

## User

you probably already above proposed something better but my ADHD had mmee start typing this at paragraph 2 of your reply: what about s model that is trained locally and persisted in a repo and used as a counterpart to the frontier agent model, and they work collaboratively. I imagine a hook/skill/MCP/cli or something based tool that the agent is given a surface for understanding it's relationship to this adaptive local repo model thing, and the tool handles the nuts and bolts of its training and inference and such but it holds the s's and the agent can be responsible even, informed by thr tool, for developer interaction

I even envision s being robust enough that you could throw away the code entirely for the project and regenerate it with all material specifics essentially existing primarily in s - architectural decisions, etc, just like the rendered frames from a nerf are totally discard able

## Assistant

And your **throw-the-code-away test** is the part that makes the idea click for me.

If \(S\) is genuinely the project rather than documentation *about* the project, then in the limit:

\[
\boxed{\text{code} \approx \operatorname{render}(S,\ \text{target stack/runtime})}
\]

Not perfectly deterministic, and some implementation details may legitimately remain degrees of freedom. But deleting the implementation should be closer to deleting `dist/` than deleting the source of truth.

That is a radically stronger standard for S.

## The two-model system

I’d currently sketch it like this:

```text
             HUMAN DEVELOPER
                    ▲
                    │ interrogation / intent / judgment
                    │
          ┌─────────┴──────────┐
          │                    │
   FRONTIER AGENT          PROJECT MODEL
   Codex / Claude             S-model
          │                    │
          │ reasoning          │ identity
          │ invention          │ memory
          │ implementation     │ rationale
          │                    │ invariants
          └────────┬───────────┘
                   │
             PROJECTOR PROTOCOL
                   │
      ┌────────────┴────────────┐
      │ repository / tests / runtime
      │ are observations + projections
      └─────────────────────────
```

The frontier model is **general intelligence brought to bear on the project**.

The local S-model is **the project brought to bear on general intelligence**.

That symmetry is tasty.

The frontier agent knows vastly more about programming, but the S-model knows **this thing**.

---

# And I would make the S-model repo-native

Not merely a daemon with some global memories.

Something like:

```text
.projector/
    model/
        ...
    anchors/
        ...
    evidence/
        ...
    lineage/
        ...
    config.toml
```

Clone the repo and you acquire not only its code and Git history but its **developed conception of itself**.

Potentially the model artifact is too large for ordinary Git, so weights/adapters could be content-addressed through LFS or another store while the repo pins the exact state. But semantically:

> **the S-model is versioned with the project.**

Branching now becomes interesting too.

A branch doesn't merely contain divergent code.

It can contain a divergent conception:

\[
S_{\text{main}}
\rightarrow
S_{\text{feature}}
\]

and merging branches potentially entails **semantic reconciliation**, not just text reconciliation.

That could become bonkers useful.

---

## I don't think it should be a little LLM trained on the source tree

This is an important fork.

Naively:

> fine-tune Qwen/whatever on every repo document and source file

probably reproduces the pathology in a smaller box.

It memorizes serializations.

I'd instead specialize a model/system around a very unusual learning objective:

### **Learn the project's latent generative structure.**

Given observations:

\[
O =
\{
developer judgments,
code,
architecture,
tests,
runtime behavior,
history,
decisions,
counterfactuals
\}
\]

infer:

\[
P(S\mid O)
\]

And continually update that state as evidence arrives.

The S-model should ideally become increasingly capable of answering things it was **never explicitly told verbatim** because it learned the project's structure.

For example:

> “Could this subsystem own user skill state?”

It should not retrieve the sentence *games don't own skill state*.

It should recognize that doing so contradicts multiple dimensions of the project conception.

That's actual understanding territory rather than retrieval.

---

# The collaboration protocol is potentially the product

Codex doesn't need to know how the neural machinery works.

Give it a semantic surface:

```text
projector orient
projector ask "I'm changing session ownership. What am I missing?"
projector challenge plan.json
projector impact proposal.md
projector explain concept:skill
projector counterexamples proposal.md
projector uncertainty
projector validate diff
projector interrogate
projector reconcile
```

Whether those are MCP tools, CLI calls, hooks or a Codex skill is implementation trivia.

The **contract** is the interesting bit.

For example, before Codex undertakes a major transformation:

```text
Codex:
I'm planning to move assessment into game sessions.

S-model:
High-confidence contradiction.

The project models assessment evidence as originating
from sessions but assessment authority as independent
of game/session lifetime.

Relevant semantic region:
  player-capability
  evidence
  assessment-authority
  persistence

I estimate 0.91 probability that your proposal violates
the intended ownership model.

Two interpretations remain plausible.
Developer discrimination recommended.
```

Then Projector invokes the developer-question interface you mentioned.

That's quite different from injecting another 14,000 tokens of `ARCHITECTURE.md`.

The frontier model and S-model can actually **disagree**.

That's valuable.

---

# Your disposable-code criterion deserves formalization

I'd call it something like **semantic reconstructability**.

Given:

\[
S + E
\]

where \(E\) is unavoidable external information such as dependencies/platform APIs, generate implementation \(I'\).

Compare against original \(I\), but **not textually**.

Instead ask whether:

\[
\operatorname{Semantics}(I')
\approx
\operatorname{Semantics}(I)
\]

including:

- behavior
- architecture
- ownership
- important implementation decisions
- performance properties
- security properties
- UX/product semantics
- tradeoffs
- intentional weirdness
- explicit rejected alternatives

If rebuilding from S gives you some generically plausible app that passes acceptance tests, **S is inadequate**.

If it gives you something recognizably *this project*, we're getting somewhere.

### This may even become the ultimate Projector eval.

Periodically hide portions of the repository:

```text
delete package X
```

Then ask:

> reconstruct X from S plus its external interfaces.

Measure not just test passing but architectural equivalence.

You could progressively increase the deletion radius:

```text
function
module
package
subsystem
entire implementation
```

That directly measures how much **project information actually lives in S** versus accidentally living only in code.

🔥

---

# And this exposes an enormous hidden flaw in current SDD

Current spec-driven development usually has this direction:

\[
\text{spec} \rightarrow \text{code}
\]

but after enough development:

\[
\operatorname{Information}(\text{code}) >
\operatorname{Information}(\text{spec})
\]

The implementation accumulates thousands of decisions never promoted back into the conception.

Eventually the arrow effectively reverses:

\[
\text{code} \rightarrow \text{guess what the system means}
\]

Game over.

The repository has become the only complete-ish representation.

Agents now have to read a mountain of it to reconstruct S.

**Exactly your context-window problem.**

An S-model changes the conservation requirement:

\[
\boxed{
\Delta I
\Rightarrow
\Delta S
}
\]

Any materially meaningful implementation decision must either already follow from S or update S.

If Codex invents a good new architecture during implementation, Projector asks:

> Is this merely a disposable rendering choice, or did we learn something about the project?

If the latter:

\[
S_t \rightarrow S_{t+1}
\]

The project model learns it.

---

## Current work gets close, but stops short

There are already sophisticated local coding-agent memory systems doing hybrid lexical/vector/graph recall, hooks, session compression and MCP exposure. For example, `agentmemory` captures observations, extracts structured facts/concepts, embeds them and optionally builds a knowledge graph; it advertises substantial context-token reductions. citeturn420626search0turn420626search2 Other local-first systems explicitly separate durable engineering memory, derived repository knowledge and transient prompt context. citeturn420626search1

But notice the ontology:

> store → index → retrieve → inject text

Even very good ones are still fundamentally **memory retrieval systems**.

Your proposal is:

> observe → learn/update project model → **reason collaboratively with the project model**

That is a different species.

It may still use retrieval internally, but retrieval no longer *is* the representation of S.

---

# There is one technical monster hiding underneath

**Continual learning.**

If we literally train neural weights every time Projector learns something, we have to deal with:

- catastrophic forgetting
- accidental generalization
- training instability
- provenance
- rollback
- branches
- conflicting observations
- determining what actually changed
- knowing whether the model learned the right thing
- deterministic-ish reproducibility

But this actually makes the research interesting rather than killing it.

I would not initially require all S to live in base-model weights.

A practical S-model might itself be composite:

\[
S =
M_{\theta}
+
A_{\phi}
+
Z
+
G
+
E
\]

where:

- \(M_\theta\): small stable local foundation model
- \(A_\phi\): repo-specific adapters/LoRA learned over time
- \(Z\): persistent learned semantic state / memory vectors
- \(G\): sparse explicit anchors and identities
- \(E\): immutable evidence/provenance

From the **frontier agent's perspective**, though, those implementation details disappear.

It talks to **the project**.

That's the abstraction I would protect.

---

## And I think you've given us a stronger definition of Projector

Not:

> Keep coding agents aligned with project specifications.

Not even:

> Preserve software semantics under autonomous transformation.

But:

> **Projector maintains a persistent computational conception of a software system, collaboratively refined by developers and agents, from which implementations and other representations are projections.**

That is substantially more ambitious.

But weirdly, it may also **simplify** Projector.

A lot of the sprawling anti-slop machinery we were worried about may turn out to exist because we've been trying to simulate a persistent conception using files, graphs, retrieval, rules and context engineering.

Perhaps some of those aren't foundational subsystems at all.

They're prosthetics for **the missing persistent project mind**.

And *that* is exactly the sort of hidden-layer mistake you were originally complaining about.

