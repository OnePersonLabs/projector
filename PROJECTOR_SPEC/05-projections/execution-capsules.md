# Execution Capsules

## Execution Capsules

The Context Compiler emits a minimal state-bound Execution Capsule per work scope.

```ts
export interface ContextPrecedent {
  unitId: EntityId;
  similarity: Confidence;
  relevance: string;
  evidenceIds: EntityId[];
}

export interface ScopeGrant {
  selector: SelectorExpr;
  operations: string[];
  reason: string;
}

export interface CompletionContract {
  requiredUnitStates: Array<{
    unitId: EntityId;
    state: "valid" | "removed" | "exception";
  }>;
  requiredValidators: string[];
  requiredEvidenceLanes: Array<ValidationResult["evidenceLane"]>;
  minimumValidationAssurance: ValidationResult["assurance"];
  requireIndependentValidation: boolean;
  maximumNewDivergences: number;
  maximumUnknowns: number;
  allowUnavailableExternalActions: boolean;
  requiredArtifacts: string[];
  cleanWorkingTree: boolean;
}

export interface ExecutionCapsule {
  id: EntityId;
  taskId: EntityId;
  objective: string;
  operation: string;
  unitIds: EntityId[];
  boundState: StateBinding;
  relevanceClosureId: EntityId;
  analysisFacetKeys: string[];
  requirementIds: EntityId[];
  scenarioIds: EntityId[];
  conceptSummary: string;
  decisionIds: EntityId[];
  decisionSummary: string;
  unresolvedArchitectureConcerns: EntityId[];
  lensSummary: string;
  effectiveRules: EffectiveRuleBundle[];
  normativeKernelHash: ContentHash;
  representation?: RepresentationProjectionRef;
  relevantPrecedents: ContextPrecedent[];
  allowedWrites: ScopeGrant[];
  forbiddenWrites: ScopeGrant[];
  availablePrimitives: string[];
  requiredValidations: string[];
  upstreamImplications: string[];
  downstreamImplications: string[];
  knownExceptions: string[];
  unknowns: string[];
  risk: RiskAssessment;
  completionContract: CompletionContract;
  contextDependencyHash: ContentHash;
  contextHash: ContentHash;
}
```

The worker MUST receive the bounded semantic context needed for its objective. This includes direct/governing Requirements and Behavioral Scenarios, relevant architecture, unresolved obligations, semantic role, decisions/lenses, mutation scope, dependent projections, and proof requirements. Consequence-band material SHOULD enter as compact summaries/kernel references first. Possible-band material SHOULD normally enter as identity + relevance rationale + uncertainty unless risk or the task requires expansion.

The Context Compiler MUST compile this material from the `RelevanceClosure` and subsequent Impact Closure rather than from repository-directory proximity or an unconditional project-wide semantic dump. Every context item SHOULD remain explainable by a relevance/impact reason.

Deterministically enforced mechanics SHOULD appear in model context as concise consequences or available tools, not repeated prose. The structured `effectiveRules`, scope grants, completion contract, and `normativeKernelHash` remain the semantic source inside the capsule. A compact prose rendering is an optimization layer, not a replacement for them.

The Context Compiler SHOULD select the least-cost Representation Profile that meets the capsule's semantic-preservation and risk policy. If compression is net-negative after profile overhead or lowers measured task/conformance quality, it SHOULD use a less compressed profile.

Before a packet is integrated, the coordinator MUST confirm that the capsule's `StateBinding` still covers the relevant state dependencies. If the snapshot root changed, re-evaluate the binding before recompiling.

A root snapshot change with an unchanged dependency set MAY be rebound without regenerating model context. A change can alter relevance membership without changing loaded entity bodies. Examples include a new invariant, relation, export, event consumer, or selector result. Such a change MUST invalidate or re-evaluate the affected closure/binding.

---


