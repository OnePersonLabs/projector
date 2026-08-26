# Strict change proposal

Write JSON with exactly this top-level shape. Unknown fields fail closed.

```json
{
  "apiVersion": "projector.change-proposal/v1",
  "requirements": [
    { "key": "stable-lowercase-key", "title": "Title", "statement": "Required behavior.", "aliases": [] }
  ],
  "scenarios": [
    {
      "key": "stable-scenario-key",
      "title": "Observable scenario",
      "aliases": [],
      "steps": [
        { "role": "precondition", "statement": "The relevant initial state exists." },
        { "role": "trigger", "statement": "The caller performs the action." },
        { "role": "expected-outcome", "statement": "The exact observable result occurs." }
      ]
    }
  ],
  "architecture": null,
  "edits": [
    { "path": "src/example.mjs", "before": "exact current UTF-8 text\n", "after": "exact desired UTF-8 text\n" }
  ],
  "validation": {
    "independentNodeTests": ["test/existing-validator.test.mjs"],
    "supplementalNodeTests": []
  },
  "analysisFacets": ["architecture", "behavior"]
}
```

## Constraints

- Use canonical repository-relative paths with `/`; no absolute paths, `..`, globs, or reserved roots (`.git`, `.projector`, `.worktrees`, `node_modules`).
- `requirements` contains 1--32 items. `scenarios` contains 1--64 items. Keys and aliases must identify one meaning and must not collide.
- Each scenario has 2--32 steps, including a `trigger` and either an `expected-outcome` or `forbidden-outcome`. Roles are `precondition`, `trigger`, `expected-outcome`, and `forbidden-outcome`.
- Each edit is exact text: `before: null` creates a file, `after: null` deletes one, and equal values are rejected. Do not edit an independent validator.
- `independentNodeTests` contains at least one existing `.test.js`, `.test.mjs`, or `.test.cjs` file. `supplementalNodeTests` may be empty. The lists cannot overlap.
- `analysisFacets` must include `architecture` and `behavior`. Other supported facts are `events`, `security`, `realtime`, `migration`, `public-contract`, `workspace-expansion`, `persistence`, `performance`, `observability`, `compatibility`, `distribution`, `cleanup`, and `external-surface`.

When architecture analysis finds a material concern that does not block the current change, replace `architecture: null` with:

```json
{
  "concernKey": "stable-concern-key",
  "title": "Concern title",
  "question": "The unresolved architecture question.",
  "materiality": "material-soon",
  "deferral": {
    "rationale": "Why this change can proceed without selecting an option.",
    "reconsiderWhen": "The concrete event that reopens the question.",
    "validUntil": "2026-09-30T00:00:00.000Z",
    "preservedOptions": ["An option that remains possible."],
    "forbiddenCommitments": ["A commitment this change must not make."],
    "forbiddenWritePaths": ["src/exact-protected-path.mjs"]
  }
}
```

`materiality` is only `material-soon` or `deferable`. All deferral lists must be nonempty; forbidden paths are exact paths and cannot overlap edits. Use a future ISO UTC timestamp. If the concern is blocking now, stop and find or obtain a current canonical decision instead of encoding a deferral.
