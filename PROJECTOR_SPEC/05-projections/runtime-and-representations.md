# Deterministic Runtime and Representation Validation

## Deterministic runtime and validator execution

## Caveman primitives

`Caveman primitives` here means deliberately small deterministic execution operations. It is independent of the agent-context compression subsystem in [Semantic Representation Contracts](../02-semantic-kernel/representation-contracts.md). The two MUST NOT share authority or state merely because both favor minimal representations.

Required primitive categories:

- inventory.
- read.
- hash/sign.
- parse.
- query.
- structural match.
- insert/replace AST node.
- move artifact.
- rename symbol.
- update structured-data pointer.
- update Markdown section/reference.
- update package export/script.
- update workflow action/version.
- format.
- run declared command.
- validate.
- diff.
- checkpoint.
- rollback/compensate.

Agents SHOULD use primitives rather than raw writes whenever a suitable primitive exists.

## Transform contract

```ts
export interface Transform<TInput = unknown> {
  id: string;
  version: string;
  description: string;
  applies(input: TInput, context: TransformContext): Promise<boolean>;
  preview(input: TInput, context: TransformContext): Promise<TransformPreview>;
  apply(input: TInput, context: TransformContext): Promise<TransformResult>;
  verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]>;
  rollback?(result: TransformResult, context: TransformContext): Promise<void>;
}
```

Mutating transforms MUST:

- be idempotent or declare a bounded convergent fixed point.
- declare touched Projection Units and write scope.
- declare preconditions and dependency-scoped `StateBinding`.
- preview before apply.
- fail closed on unresolved semantic anchors.
- preserve unrelated formatting where practical.
- produce structured operation evidence.
- verify postconditions.
- provide rollback for R1 and compensation/explicit irreversibility for higher risk.

## Declared command/validator contract

Observation is no-exec by default. Running repository code is an explicit capability, not an incidental analyzer behavior.

```ts
export interface CommandSpec {
  id: string;
  argv: string[];
  cwd: string;
  readScope: string[];
  writeScope: string[];
  network: "deny" | "allow";
  environmentKeys: string[];
  sideEffectClass: "none" | "read-only" | "workspace-write" | "external-write";
  timeoutMs: number;
  cpuBudgetMs?: number;
  memoryBudgetMb?: number;
}
```

Command execution MUST use explicit argv arrays where possible, root-constrained cwd validation, controlled environment keys, and policy-aware write/network boundaries. A validator with workspace or external side effects participates in transaction/risk policy. It is not treated as harmless merely because its purpose is "verification".

## Transform composition

Transforms declare:

- predecessor dependencies.
- mutual exclusions.
- commutativity.
- exclusive unit claims.
- postconditions.
- fixed-point/convergence behavior.

Unresolved overlapping exclusive claims block planning. Transform dependency cycles are evaluated as explicit SCCs only when declared convergent. Otherwise they are plan errors.

## Representation compilation and fidelity validation

Representation compilation consumes canonical semantic entities, effective rule bundles, scope, and state binding. It produces a target-specific Representation Projection plus a Semantic Preservation Fingerprint.

Behavioral/Gherkin specifications MAY be compiled from canonical Requirements and Behavioral Scenarios through the same representation pipeline. They MUST bind to source semantic hashes and MUST NOT become a parallel authority merely because an acceptance runner consumes them.

Compilation order SHOULD be:

```text
canonical semantic sources
→ normalize representable semantic kernel
→ compute protected-dimension fingerprints
→ render target representation
→ run deterministic style/literal checks
→ run required semantic-fidelity validators
→ account for tokenizer/profile overhead
→ accept, fall back, or reject
```

Required fidelity checks for protected dimensions include, where applicable:

- normative-force preservation: `require`/`forbid`/`prefer`/permission strength MUST NOT silently weaken or strengthen.
- negation preservation.
- quantifier/cardinality preservation such as exactly/at-least/at-most/all/none.
- logical-connective preservation such as `and`/`or`, implication, and biconditional semantics.
- condition/guard preservation.
- exception preservation.
- dependency and ordering preservation where order is semantic.
- Behavioral Scenario step-role preservation: preconditions/triggers/outcomes/exceptions MUST NOT swap semantic roles when rendered as Gherkin or other behavioral syntax.
- semantic scope preservation.
- stable Concept/Requirement/Behavioral Scenario identity and one-name-per-entity mapping within the projection unless an explicit alias map is present.
- exact preservation of protected identifiers, code, commands, paths, URLs, API names, version numbers, numeric values, and units.

A rendering such as `Avoid deleting production data without approval` MUST NOT validate as equivalent to a canonical `MUST_NOT delete production data unless explicit approval` rule because the normative force changed. Likewise `A when B` cannot represent `A iff B`, and `one or more` cannot represent `exactly one`.

For human-facing technical prose, deterministic style linting SHOULD expose violations per document/word count and category so before/after deltas are measurable. The score is a style signal only.

For compact agent context, token accounting MUST use the tokenizer/profile relevant to the target host/model when available. Character count is not an acceptable substitute when it would change optimization decisions. Shortened spellings or invented abbreviations SHOULD NOT be used unless measured to save tokens and remain clear.

Fallback order for a failed compact projection SHOULD prefer:

1. Exact machine-invariant kernel plus compact advisory prose.
2. Less aggressive compact profile.
3. Human-technical profile.
4. Explicit block/unknown when required semantics still cannot be represented safely.

Projector MUST NOT repeatedly spend model tokens to compress already-small context when the expected savings do not exceed representation overhead. If the target tokenizer cannot be measured, savings estimates MUST be marked heuristic. Automatic selection that claims net-positive token economics requires measured or conservatively bounded accounting.

---


