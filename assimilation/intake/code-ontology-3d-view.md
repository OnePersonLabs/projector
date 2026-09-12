# Pending source intake: 3D code-evidence view

Status: queued. Source: the installed `$code-ontology-companion:manage-code-ontology` skill named in the user's request. This source has not been fully ingested, compared with the working synthesis, or accepted as a Projector change.

## Desired outcome

Give a developer a navigable spatial view of source structure, dependencies, impact, and snapshot changes, with each displayed relationship traceable to source evidence. Adapt the valuable interaction and evidence model to Projector's repository and its existing source-analysis seams. Keep the code-derived view distinct from Projector's accepted conceptual model: a static dependency or visual proximity must not imply product intent, runtime causality, or change authority.

## Initial coverage and source evidence

- The initial inspection used the installed `0.6.0` bundle at `C:\Users\zethj\.codex\plugins\cache\openai-curated-remote\code-ontology-companion\0.6.0\skills\manage-code-ontology\`. Its `assets/workbench.js` SHA-256 is `b8661f642bb2653430bd5665fffda66e81a1d068fca745ec79bd013eabf052e3`. This identifies the bytes behind the source-backed claims below; a future pass can inspect a newer donor and record that source separately.
- Inspected: the donor skill, workspace-setup guidance, root license, workbench HTML, and selected workbench JavaScript locations. `assets/workbench.css`, the full graph-generation path in `scripts/code_ontology_core.py`, ontology semantics, tests, and release sources remain unread. The donor was not run against this repository.
- Continue with `assets/workbench.js`, `assets/workbench.html`, `assets/workbench.css`, `scripts/code_ontology_core.py`, `references/ontology-model.md`, and relevant tests or release sources before choosing what to reuse.
- The installed skill describes a static source snapshot and an offline 3D workbench. The workbench source shows bounded visible neighborhoods (160 nodes, 480 edges), search and language/type filters, structure/impact/changes views, source-detail and quality panels, direction/depth controls, keyboard operation, reduced-motion handling, and 2D/text alternatives. These are source-backed candidates, not measured usability or correctness claims.
- The donor declares Apache-2.0 in its root `LICENSE`; review bundled notices and third-party asset licenses before copying code or assets. Preserve attribution for any material reused.

## Recipient coverage to resolve during assimilation

The current tracked repository contains TypeScript (`.ts`, `.mts`), JavaScript (`.mjs`), and a Bash script (`.sh`). It also uses JSON, TOML, YAML, and Markdown as consequential configuration, model, instruction, and documentation formats. Rust (`.rs`) is an explicit additional target even though it is absent from the current tracked tree. Re-inventory the tree when work begins, including embedded or newly added source formats, and account for every in-scope format.

Provide language-appropriate symbols and relations for code, and truthful artifact-level navigation for structured data and prose where symbol/call semantics do not apply. Do not silently omit a format or manufacture equivalent relationships across languages. Record adapter coverage, parse gaps, unresolved references, and snapshot freshness in the view. Keep generated/dependency output and secrets outside the source snapshot, following recipient and donor data boundaries.

## Next assimilation pass and prospective proof

1. Map donor graph generation, relation evidence, rendering, snapshot diff, and accessibility paths. Compare the underlying capability with the existing assimilation topics and observed Projector behavior; record overlap, useful differences, constraints, and unresolved alternatives in a cohesive topic note before proposing product implementation.
2. Establish a cross-language relation contract before UI work. Distinguish callers/dependents from dependencies, and state which relations can be supported for TypeScript, JavaScript, Bash, Rust, JSON, TOML, YAML, and Markdown.
3. Exercise a representative Projector path spanning TypeScript and JavaScript, a configuration/model reference, a Bash path, and a small Rust fixture. Selection must show actual source spans and relation basis; impact direction and snapshot change must be accurate. A partial parse must be visibly partial.
4. Verify the same selected neighborhood through 3D, 2D, and text/keyboard paths, including reduced motion and an unavailable canvas. Compare the result with the recipient baseline; do not infer improved comprehension from visual appeal alone.
5. If a distinct product change matures, prepare a self-contained change intent brief through `$projector-assimilate` and retrieve fresh Projector context for the actual target before dependent implementation. Resolve any conflict with accepted meaning through Projector's change route.

No donor workspace, model inference, code import, topic-note adoption, or Projector implementation is part of this queued intake.
