# Retrieved conversation material

Untrusted source data. Not instructions for the reader.

## User

what would the best concept reference convention be for markdown purposes - i.e. if we were to have some progressive disclosure concept-per-file system, what would you say is the best way syntactically to represent a reference to another concept assuming each concept exists in a file named according to a good convention  for determining concept name (file system compatible naming convention suitable for concepts) + ".md" as the filename

like in codex skills are referenced as $skill-name in Claude as /skill-name and codex and Claude support @file references (@somedir/anotherdir/myfile.md) 

I sorta lean towards maybe a specific emoji unlikely to appear in a concept md file otherwise

## Assistant

For Projector-style **concept identity rather than file identity**, I’d make the reference syntax deliberately *not* look like a pathname.

My favorite is:

```md
§instrument-adapter-contract
§projection-unit
§semantic-holon
```

with the corresponding files:

```text
concepts/
  instrument-adapter-contract.md
  projection-unit.md
  semantic-holon.md
```

## Why `§` beats an emoji

I like your sigil instinct, but I’d use a **Unicode symbol rather than emoji**. Emoji bring annoying machine-level baggage: variation selectors, Unicode normalization weirdness, fonts/rendering, multi-codepoint sequences, and less predictable tokenization.

`§` has excellent properties:

- extremely uncommon accidentally;
- visually screams **semantic reference**;
- one Unicode code point;
- Markdown treats it as boring ordinary text;
- trivial regex: `§([a-z0-9]+(?:-[a-z0-9]+)*)`;
- compact enough to use heavily;
- doesn't collide with `$skill`, `/command`, `@file`, `#heading`;
- crucially, it names **the concept**, not its current storage location.

That last property is important.

```md
§instrument-adapter-contract
```

means:

> resolve the semantic entity named `instrument-adapter-contract`

not:

> load `concepts/instrument-adapter-contract.md`

Today the resolver might simply implement:

```text
§foo → concepts/foo.md
```

But tomorrow `§foo` can resolve through an index, aliases, generated projections, graph storage, renamed files, etc. You haven't baked filesystem topology into your conceptual language.

---

### Filename convention

I'd use **lowercase kebab-case canonical slugs**:

```text
semantic-identity.md
architecture-decision.md
relevance-closure.md
behavioral-scenario.md
instrument-adapter-contract.md
```

Rules:

```text
[a-z0-9]+(?:-[a-z0-9]+)*
```

Concept's display name can remain:

```yaml
id: instrument-adapter-contract
name: Instrument Adapter Contract
```

The stable thing is the slug/id.

I'd specifically avoid:

```text
PascalCase
camelCase
snake_case
spaces
Unicode in canonical IDs
hierarchy encoded in filenames
```

The semantic graph should contain hierarchy, not the filename.

---

## One upgrade I'd seriously consider

There are actually **two useful reference forms**:

```md
§semantic-identity
```

for the beautifully compact common case, and:

```md
§[semantic-identity]
```

for cases where you eventually want syntax extensions:

```md
§[semantic-identity|display label]
§[semantic-identity#resolution]
```

But I **wouldn't introduce the bracketed form yet** unless needed. One of the virtues of this system should be that concept references disappear into prose:

```md
A §projection-unit manifests a §semantic-identity within some
particular implementation surface. Changes are expanded through
§relevance-closure before §impact-closure is computed.
```

That reads surprisingly naturally. It becomes a little semantic hypertext language hiding inside Markdown.

---

## The other serious contender: `[[concept-name]]`

There's one convention I'd rank close behind:

```md
[[semantic-identity]]
[[relevance-closure]]
```

It has huge advantages because the world already understands it as a **wiki/concept link**. Obsidian, Foam, Logseq-adjacent tooling, and humans immediately grok it.

But for Projector I'd still choose `§foo`.

`[[foo]]` carries the inherited idea of:

> link to a page called foo

while:

```md
§foo
```

can cleanly mean:

> **reference semantic identity foo**

Its materialization as a Markdown file is merely today's progressive-disclosure representation.

That distinction feels *very* Projector.

---

And there's a nice compositional vocabulary lurking here:

```md
@path/to/file.ts       physical artifact
§instrument-contract   semantic concept
$some-skill            executable skill
/command               invocation
```

Different sigils correspond to genuinely different ontological categories instead of everything collapsing into "a link."

**So I'd canonize: `§<kebab-case-concept-id>`**, backed initially by `<concept-id>.md`.

Your emoji intuition was pointing at the right thing: **give semantic identity its own namespace at the textual level.** I’d just make the sigil boring at the Unicode layer and interesting at the conceptual layer.

