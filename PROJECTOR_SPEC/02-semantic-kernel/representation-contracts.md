# Semantic Representation Contracts

## Semantic representation contracts

Representation contracts normalize the distinction between source meaning and target encoding. They MUST reuse existing canonical entities rather than creating a parallel ontology of requirements.

```ts
export type RepresentationTarget =
  | "human-technical"
  | "behavior-spec"
  | "agent-context"
  | "machine-invariant";

export type PreservationDimension =
  | "normative-force"
  | "negation"
  | "scope"
  | "quantifier-cardinality"
  | "logical-connective"
  | "condition-guard"
  | "exception"
  | "dependency-order"
  | "behavior-step-role"
  | "concept-identity"
  | "identifier-literal";

export interface SemanticPreservationFingerprint {
  sourceSemanticHash: ContentHash;
  profileId: EntityId;
  profileVersion: string;
  protectedDimensions: PreservationDimension[];
  dimensionHashes: Partial<Record<PreservationDimension, ContentHash>>;
  dimensionAssurance: Partial<Record<PreservationDimension, "exact" | "validated" | "heuristic">>;
  unsupportedDimensions: PreservationDimension[];
  assurance: "exact" | "validated" | "heuristic"; // no stronger than weakest protected dimension
  evidenceIds: EntityId[];
  semanticHash: ContentHash;
}

export interface RepresentationStyleRule {
  key: string;
  kind:
    | "terminology"
    | "sentence-structure"
    | "active-voice"
    | "condition-order"
    | "scenario-structure"
    | "paragraph-structure"
    | "word-choice"
    | "punctuation"
    | "abbreviation"
    | "narration"
    | "filler-removal"
    | "token-optimization"
    | "literal-preservation";
  parameters: Record<string, unknown>;
  blocking: boolean;
}

export interface SemanticRepresentationProfile {
  id: EntityId;
  key: string;
  version: string;
  status: "active" | "deprecated" | "retired";
  target: RepresentationTarget;
  selector: SelectorExpr;
  optimization: "clarity-first" | "token-first" | "machine-first";
  protectedDimensions: PreservationDimension[];
  styleRules: RepresentationStyleRule[];
  generatorId: string;
  validatorIds: string[];
  tokenizerProfileId?: string;
  fallbackProfileId?: EntityId;
  semanticHash: ContentHash;
}

export interface RepresentationTokenAccounting {
  sourceTokens?: number;
  outputTokens?: number;
  profileOverheadTokens?: number;
  estimatedNetTokens?: number;
  tokenizerProfileId?: string;
}

export interface RepresentationProjection {
  id: EntityId;
  profileId: EntityId;
  profileVersion: string;
  target: RepresentationTarget;
  sourceEntityIds: EntityId[];
  sourceSemanticHash: ContentHash;
  boundState: StateBinding;
  contentHash: ContentHash;
  preservation: SemanticPreservationFingerprint;
  tokenAccounting?: RepresentationTokenAccounting;
  status: "valid" | "suspect" | "invalid" | "fallback-used";
  validatorResults: ValidationResult[];
  semanticHash: ContentHash;
}

export interface RepresentationProjectionRef {
  projectionId: EntityId;
  profileId: EntityId;
  profileVersion: string;
  contentHash: ContentHash;
  preservationHash: ContentHash;
}
```

Semantic Representation Profiles govern encoding, not software architecture or product semantics. A profile change does not require an Architecture Decision by default. A durable product or public encoding contract can require one. Profiles MUST NOT turn style preferences into hard software rules.

Selectors scope profiles. No profile rewrites all prose by default. Existing authored prose stays authored unless governance makes it a generated Representation Projection.

Built-in reference behavior:

### `human-technical@1`

`human-technical@1` uses controlled technical prose without claiming certification against an external writing standard. It applies these rules:

1. Use one canonical name for one concept. Use an explicit alias only when the reader needs it.
2. Use short common words when they preserve technical precision.
3. Use an explicit actor when the actor is known and useful. Prefer active voice in that case.
4. Use a direct verb for an action. Avoid needless nominalizations and stacked helper verbs.
5. Keep one main instruction or claim in each sentence. Keep prose sentences at 25 words or fewer.
6. Put a condition before the action that depends on it.
7. Do not use contractions or semicolons in governed technical prose.
8. Do not use marketing language, modal filler, or discourse filler.
9. Keep one topic in each paragraph. Keep paragraphs at six sentences or fewer.
10. Use numbered vertical steps for procedures. Put one action in each step.
11. Preserve code, commands, paths, identifiers, API names, exact errors, numbers, and units.
12. Treat passive-voice and nominalization detectors as review signals, not semantic proof.

The Projector specification MUST pass the blocking mechanical subset of this profile. The blocking subset covers sentence length, semicolons, contractions, marketing language, modal filler, discouraged verbose wording, and paragraph length.

### `behavior-gherkin@1`

`behavior-gherkin@1` MAY compile canonical Requirements and Behavioral Scenarios into executable Gherkin/BDD form. It MUST preserve stable source identities plus scenario step roles and order. It MUST also preserve conditions, exceptions, cardinality, and normative force. Generated `.feature` files remain derived projections or evidence bindings. They are not canonical behavior.

### `agent-compact@1`

`agent-compact@1` removes discourse filler, pleasantries, hedging, repeated explanation, and unnecessary narration. It MAY use fragments only when meaning stays unambiguous. It SHOULD use shorter words only when the target tokenizer shows a real saving.

It MUST preserve code, commands, paths, API names, identifiers, exact errors, numbers, and units. It MUST NOT drop or weaken `no`, `not`, `never`, `only`, `except`, cardinality, conditions, ordering, or normative force. Standard well-known technical acronyms MAY remain. The profile SHOULD NOT invent prose abbreviations unless measurement shows a net token saving and clarity remains acceptable. It SHOULD suppress nonessential tool-call narration when host policy allows direct execution. It SHOULD avoid prose arrows unless tokenizer measurement shows a net saving and the relation stays unambiguous.

Persisted technical documentation SHOULD use `human-technical@1` by default. `agent-compact@1` targets transient agent context or generated host instructions unless repository governance explicitly says otherwise.

### `machine-invariant@1`

`machine-invariant@1` SHOULD serialize the normalized predicate/rule kernel and protected identities with minimal prose. This lane SHOULD provide `exact` preservation assurance when the kernel represents the required semantics.

A natural-language linter proves only mechanical style conformance. It MUST NOT claim that the text is true or semantically equivalent. A model that judges its own rendering supplies only heuristic or supporting evidence unless an independent lane raises assurance.

For high-risk normative agent context, Projector SHOULD carry the exact or validated machine-invariant kernel with compact prose. If the compact form cannot preserve required semantics, Projector MUST use a safer representation or block the projection.


## Contract completeness gate

The repository MUST contain a machine-readable registry of exported normative schemas. CI MUST verify:

- every serialized type has a Zod schema and JSON Schema export where externally visible.
- every cross-package reference resolves.
- semantic hash projections are declared.
- API/schema versions are present.
- no implementation phase is allowed to invent a missing normative type ad hoc.

---


