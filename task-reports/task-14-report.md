# Task 14 — Broad analyzer coverage

## Delivery

- Branch: `codex/projector-t14`
- Base: `d794dfb`
- Ownership respected: implementation and public composition remain in `packages/analyzers/**`; no shared package metadata or external barrels changed.

## Material behavior

- TypeScript/JavaScript observation now emits package-scoped semantic declarations, alias/type imports, re-exports, overload markers, literal event producers/consumers, public-contract participants, locations, stable hashes, and explicit dynamic-name/import unknowns without executing repository code.
- JSON, YAML multi-document, and TOML analyzers emit stable-path units and localized duplicate/unsupported-syntax evidence. GitHub Actions observation covers triggers, path filters, permissions, jobs, needs, matrices, environments, reusable workflow uses, inputs/outputs, steps, expressions, and remote-action uncertainty as inert data.
- Markdown observation emits headings, inline/reference links, fence metadata, and declared contract references while excluding fenced examples from topology.
- Authenticated topology derives route-local assurance, completeness, observability, and query version from analyzer capabilities/failures. It preserves bounded siblings beside open dynamic routes and emits bindable zero-consumer routes.
- Local repository analysis publicly composes analyze → topology → relevance. Analyzer-version changes invalidate query fingerprints while stable route identity remains intact.
- Divergence output is restricted to mechanically supported broken static imports, duplicate public exports, Actions `needs` gaps, and directly linked generated/source drift vocabulary, with provenance, assurance, and coverage caveats.

## RED/GREEN evidence

- Grouped RED captured four absent lanes: semantic index, document/workflow parsing, authenticated topology, and public composition.
- Focused GREEN: 8 acceptance assertions across four new suites; complete analyzer package: 39/39 tests; analyzer typecheck passed.

## Frozen gate

- `pnpm verify` — pass: 50 files, 565 tests; all workspace typechecks and package boundaries pass.
- `pnpm build` — pass for all workspace packages.
- Explicit `pnpm check:boundaries`, staged `git diff --check`, and isolated generated-schema comparison — pass.
- Built-package smoke confirmed the public analyze/document/topology/relevance composition exports.

## Residuals

- Parsing is deliberately bounded syntax observation, not compiler/type-checker or full YAML/TOML/Actions evaluation. Dynamic resolution, custom tags/anchors, expressions, remote actions, and inferred workflow behavior remain explicit uncertainty.
- Generated/source drift is emitted only when a future analyzer supplies a direct mechanical linkage; filename proximity is not treated as evidence.

## Independent review — FAIL (`d794dfb..bbfbd3b`)

Focused analyzer tests (39/39), analyzer typecheck, and diff check pass; no-exec fixtures remain intact. Six material public-path gaps remain:

1. **The public topology facade still trusts caller-declared proof.** `compileEventContractTopology` accepts caller-supplied `assurance:"exact"` and a caller-supplied `closed` enumeration, then exposes an empty closed query result. This bypasses the authenticated capability/failure path. The analyzer contract requires proof strength to come from capability/failure evidence; a supported public caller can currently forge proof-strength absence.
2. **A discovered dynamic consumer does not widen its literal sibling route.** A repository containing `bus.emit("changed")` plus `bus.on(eventName, handler)` records the dynamic-name unknown, but the composed topology/query state for `changed` has zero consumers and remains `bounded`; its fingerprint drops the capability blind spots/dynamic mechanisms. This violates observability-bound negative space and can certify a missed consumer as bounded absence.
3. **Re-export aliases are parsed but omitted from contract topology.** With package A exporting `InternalPayload as PublicPayload` and package B importing `PublicPayload`, the public analysis emits only the `InternalPayload` producer and no consumer route. The deterministic contract-topology lane therefore misses a known non-local consumer required by relevance expansion.
4. **Authenticated capability conflicts are input-order dependent.** Passing otherwise identical event-topology capabilities at adapter versions 2 and 3 yields query version 2 or 3 solely from array order, with different topology hashes; no conflict is rejected. This violates fixed-input/set-order determinism and makes query invalidation depend on enumeration order.
5. **Valid supported TypeScript forms produce exact false divergences.** Ordinary overload declarations are emitted as `duplicate-public-export` with `exact` assurance. Separately, a Node-style TS import of `./schema.js` with `schema.ts` present is emitted as an exact `broken-static-import`. The held-out overload/static-import contract and divergence factuality prohibit turning recognized valid syntax or resolver limitations into exact drift facts; these can drive false reconciliation/repair decisions.
6. **Standard Actions filters and permissions disappear without uncertainty.** A workflow using block-list `paths` and scalar `permissions: read-all` emits an empty path filter and no permissions, with no local failure/unknown. The analyzer minimum explicitly includes path filters and permissions and requires unsupported syntax to degrade explicitly; this can omit workflow applicability and permission facts while presenting a normal successful lane.

Direct bases: `09-evolution/persistence-and-observation.md` analyzer contract/minimum outputs; `03-knowledge/relevance-and-change-cognition.md` topology and closure-bound discovery; `02-semantic-kernel/state-binding-and-ports.md` observability-bound negative space; `12-delivery/acceptance-relevance-and-identity.md` consumer and open-world cases; Task 14 matrix/adversarial fixtures. Bounded parser breadth beyond these supported-path failures remains residual.

## Consolidated repair closure

- Closed the six findings with conservative raw proof, dynamic-route uncertainty, alias consumers, fail-closed capability conflicts, supported TS resolution/overloads, and Actions filter/permission preservation.
- Focused closure 24/24; analyzer suite 43/43; typecheck/diff pass. Full gate deferred for targeted review.

## Independent targeted closure — FAIL (`bbfbd3b..4ef4404`)

Five findings closed publicly with identity/version and no-exec green; 43/43 tests, typecheck, and diff check passed. One blocker remained: block-form `paths-ignore:` items were emitted as includes, inverting workflow applicability through public `analyzeDocuments`.

## Ignore-list closure

- `paths-ignore` block context is retained; public RED/GREEN and focused suites pass 6/6 with analyzer typecheck/diff. Commit `fdb83c0`; full gate remains deferred.

## Final narrow closure — PASS (`4ef4404..fdb83c0`)

Public `analyzeDocuments` now emits block-form `paths-ignore` items only in `exclude`; the direct `paths` sibling still emits ordinary items in `include` and `!` items in `exclude`. No material regression found. Analyzer tests pass 44/44; typecheck and diff check pass.
