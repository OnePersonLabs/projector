# Queued assimilation: 3D code-evidence view

Status: queued. This item asks for a future assimilation of the 3D view capability; it does not authorize or claim a Projector product change today.

## Desired outcome

Give a developer a navigable spatial view of source structure, dependencies, impact, and snapshot changes, with each displayed relationship traceable to source evidence. Adapt the valuable interaction and evidence model to Projector's repository and its existing source-analysis seams. Keep the code-derived view distinct from Projector's accepted conceptual model: a static dependency or visual proximity must not imply product intent, runtime causality, or change authority.

## Donor and initial evidence

- Donor: the installed `$code-ontology-companion:manage-code-ontology` skill. Inspect its current contents when the assimilation begins.
- Start with `assets/workbench.js`, `assets/workbench.html`, `assets/workbench.css`, `scripts/code_ontology_core.py`, `references/ontology-model.md`, and relevant tests or release sources before choosing what to reuse.
- The installed skill describes a static source snapshot and an offline 3D workbench. The workbench source shows bounded visible neighborhoods (160 nodes, 480 edges), search and language/type filters, structure/impact/changes views, source-detail and quality panels, direction/depth controls, keyboard operation, reduced-motion handling, and 2D/text alternatives. These are source-backed candidates, not measured usability or correctness claims.
- The donor declares Apache-2.0 in its root `LICENSE`; review bundled notices and third-party asset licenses before copying code or assets. Preserve attribution for any material reused.

## Recipient coverage to resolve during assimilation

The current tracked repository contains TypeScript (`.ts`, `.mts`), JavaScript (`.mjs`), and a Bash script (`.sh`). It also uses JSON, TOML, YAML, and Markdown as consequential configuration, model, instruction, and documentation formats. Rust (`.rs`) is an explicit additional target even though it is absent from the current tracked tree. Re-inventory the tree when work begins, including embedded or newly added source formats, and account for every in-scope format.

Provide language-appropriate symbols and relations for code, and truthful artifact-level navigation for structured data and prose where symbol/call semantics do not apply. Do not silently omit a format or manufacture equivalent relationships across languages. Record adapter coverage, parse gaps, unresolved references, and snapshot freshness in the view. Keep generated/dependency output and secrets outside the source snapshot, following recipient and donor data boundaries.

## Questions and proof for the future work

1. Map donor graph generation, relation evidence, rendering, snapshot diff, and accessibility paths; compare them with Projector's current static-dependency and knowledge representations. Decide which capability belongs in existing seams and whether any new owner is justified.
2. Establish a cross-language relation contract before UI work. Distinguish callers/dependents from dependencies, and state which relations can be supported for TypeScript, JavaScript, Bash, Rust, JSON, TOML, YAML, and Markdown.
3. Exercise a representative Projector path spanning TypeScript and JavaScript, a configuration/model reference, a Bash path, and a small Rust fixture. Selection must show actual source spans and relation basis; impact direction and snapshot change must be accurate. A partial parse must be visibly partial.
4. Verify the same selected neighborhood through 3D, 2D, and text/keyboard paths, including reduced motion and an unavailable canvas. Compare the result with the recipient baseline; do not infer improved comprehension from visual appeal alone.
5. Before dependent product implementation, retrieve fresh Projector context for the actual target, resolve any conflict with accepted meaning, and use the Projector change route if intended behavior changes.

No donor workspace, model inference, code import, or Projector implementation is part of this queued intake.
