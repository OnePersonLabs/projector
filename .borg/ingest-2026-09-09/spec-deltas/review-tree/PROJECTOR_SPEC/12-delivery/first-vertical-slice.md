# Mandatory First Vertical Slice

## Mandatory first vertical slice

Fixture:

```text
.codex/
  hooks/
    pre-tool.mjs
    lib/
      hook-state.mjs
      validate-repo.mjs
    validate-repo.test.mjs
scripts/
  build-index.mjs
  build-index.test.mjs
  check-links.mjs
  check-links.test.mjs
package.json
```

Facts:

- `validate-repo.mjs` is invoked directly from package scripts.
- it has no hook lifecycle signature.
- hook code does not import it.
- its test targets repository automation behavior.
- generic repository scripts have colocated tests under `/scripts`.
- hook-private support modules are reachable from hook entrypoints.
- the misplaced location is intentionally misleading local precedent.

Required result:

1. Inventory and classify stable Projection Units without repository execution.
2. Infer descriptive families for repository automation, hook entrypoints, hook-private support, and test colocation.
3. Classify `validate-repo.mjs` as repository automation using role/invocation/dependency evidence stronger than directory proximity.
4. Keep Pattern Candidate and normative Lens authority separate.
5. Make sure generated/Projector-repaired occurrences cannot inflate independent authority evidence.
6. Compile a minimal active/shadow lens and typed rules sufficient for the scenario.
7. Emit placement/test divergences with counterevidence and proof caveats.
8. Preview an R1 deterministic move/reference update.
9. Bind plan/capsule/approval to dependency-scoped `StateBinding` compiled against a global `StateDigest`.
10. Get writer lease and journal transaction.
11. Move implementation and test, update references/package script as required.
12. Run declared independent-enough validators.
13. Reconcile to a fixed point.
14. Produce no material delta for this cluster on the second identical reconciliation.
15. Emit a cleanup plan with no unresolved work for the cluster.
16. Emit a compact transaction receipt and verbose certificate.
17. Prove `state.db` deletion/rebuild preserves the accepted canonical semantics.

This slice proves the central loop:

```text
observe
→ classify
→ infer descriptive pattern
→ establish bounded authority
→ compile governance
→ plan against state
→ deterministic repair
→ independent validation
→ reconcile
→ durable canonical result
```

Do not start with visualization, broad cloud adapters, or a universal semantic model before this passes.

---


