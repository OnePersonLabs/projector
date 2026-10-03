---
id: clip-playback
kind: lens
title: Clip playback isolation
status: accepted
conditions:
  - clip#playback-isolation
  - clip#persistence-source
selectors:
  - id: js-playback
    patterns: [js/*.mjs]
    role: playback-and-export
  - id: python-persistence
    patterns: [python/*.py]
    role: persistence
  - id: rust-playback
    patterns: [rust/*.rs]
    role: playback
  - id: frontend
    patterns: [frontend/*.tsx, frontend/*.ts, frontend/*.html, frontend/*.css, frontend/*.scss]
    role: presentation
  - id: csharp-consumer
    patterns: [csharp/*.cs]
    role: consumer
checks:
  - id: js-behavior
    command: node
    args: [checks/playback.mjs]
    selectors: [js-playback]
    conditions: [clip#playback-isolation]
    evidence: runtime
    coverage: [js/playback.mjs, js/export.mjs]
    inputs: [checks/playback.mjs, shared/clip.json]
  - id: python-save
    command: python
    args: [-B, checks/persistence.py]
    selectors: [python-persistence]
    conditions: [clip#playback-isolation, clip#persistence-source]
    evidence: runtime
    coverage: [python/persistence.py]
    inputs: [checks/persistence.py, shared/clip.json]
  - id: rust-behavior
    command: node
    args: [checks/rust-playback.mjs]
    selectors: [rust-playback]
    conditions: [clip#playback-isolation]
    evidence: runtime
    coverage: [rust/playback.rs]
    inputs: [checks/rust-playback.mjs]
observations:
  - provider: inventory
    operation: symbols
    patterns: [rust/*.rs, csharp/*.cs, frontend/*.tsx, frontend/*.ts]
  - provider: html
    operation: symbols
    files: [frontend/index.html]
  - provider: css
    operation: diagnostics
    files: [frontend/clip.css, frontend/clip.scss]
---

Selectors identify participants before checks examine the conditions. New JS exports enter `js-playback` through discovery. The JS check covers the authored playback functions and export function; it does not prove every future JS function is correct merely because its file is selected.

The Python check tests playback, a save after playback, and an explicit committed edit. The Rust check compiles and executes the playback seam when `rustc` is available. Inventory facts only identify source candidates. C#, frontend rendering, CSS, and SCSS have no runtime behavior receipt in this fixture. Their condition coverage remains unresolved until a suitable native check is added and run.

Do not infer shared Clip isolation from presentation diagnostics. CSS, SCSS, and HTML observations can supply presentation evidence within their own scope. The example excludes indented `.sass`.
