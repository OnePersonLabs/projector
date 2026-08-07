// Generated from the 147 authoritative exported declarations in PROJECTOR_SPEC.
// Runtime schemas live in ../schemas/contracts.ts; this file is the TypeScript contract authority.

export type ConcernMateriality = "blocking-now" | "material-soon" | "deferable";

export interface ConcernActivationReason {
  kind:
    | "requirement-delta"
    | "scenario-delta"
    | "relevance-discovery"
    | "planning-surprise"
    | "constraint-delta"
    | "surface-added"
    | "scale-signal"
    | "pattern-friction"
    | "decision-trigger"
    | "research"
    | "user-request"
    | "inference";
  subjectIds: Array<EntityId | string>;
  explanation: string;
  causalOrigin: CausalOrigin;
}

export interface DecisionDeferral {
  rationale: string;
  preserveOptionality: string[];
  forbiddenCommitments: string[];
  reconsiderWhen: AuthorityReconsiderTrigger[];
  reviewBy?: string;
}

export interface ArchitectureConcern {
  id: EntityId;
  key: string;
  title: string;
  question: string;
  scope: SelectorExpr;
  sourceClass: SourceClass;
  status: "candidate" | "active" | "deferred" | "resolved" | "dismissed" | "superseded";
  materiality: ConcernMateriality;
  activationReasons: ConcernActivationReason[];
  relatedConceptIds: EntityId[];
  relatedRequirementIds: EntityId[];
  relevanceClosureId?: EntityId;
  decisionIds: EntityId[];
  deferral?: DecisionDeferral;
  evidence: EvidenceRef[];
  semanticHash: ContentHash;
}

export interface DecisionConsequence {
  kind:
    | "activate-governance"
    | "deactivate-governance"
    | "introduce-constraint"
    | "retire-constraint"
    | "select-technology"
    | "deprecate-technology"
    | "require-migration"
    | "activate-concern"
    | "constrain-decision"
    | "advisory";
  targetId?: EntityId;
  scope?: SelectorExpr;
  payload?: Record<string, unknown>;
  explanation: string;
}

export interface AppliedPreferenceRef {
  key: string;
  scope: "user" | "organization" | "project";
  semanticHash: ContentHash;
  influence: string;
}

export interface ArchitectureDecision {
  id: EntityId;
  key: string;
  concernId: EntityId;
  title: string;
  decision: string;
  selectedOptionKey: string;
  scope: SelectorExpr;
  lifecycle: "active" | "superseded" | "retired";
  authorityRecordId: EntityId;
  governanceBasis: GovernanceBasis[];
  consequences: DecisionConsequence[];
  appliedPreferences: AppliedPreferenceRef[];
  supersedesDecisionIds: EntityId[];
  migrationId?: EntityId;
  semanticHash: ContentHash;
}

export interface DecisionOption {
  key: string;
  title: string;
  description: string;
  hardConstraintStatus: "passes" | "fails" | "unknown";
  tradeoffs: string[];
  evidence: EvidenceRef[];
  preferenceFit: AppliedPreferenceRef[];
}

export interface DecisionEvaluation {
  id: EntityId;
  concernId: EntityId;
  scope: SelectorExpr;
  options: DecisionOption[];
  eliminatedOptionKeys: string[];
  recommendedOptionKey?: string;
  outcome: "recommended" | "contested" | "insufficient-evidence";
  hardConstraints: EntityId[];
  preferenceSnapshotHash: ContentHash;
  researchEvidenceIds: EntityId[];
  unknowns: string[];
  evaluatedAt: string;
  semanticHash: ContentHash;
}

export interface DecisionValidityAssessment {
  decisionId: EntityId;
  scope: SelectorExpr;
  state: "valid" | "suspect" | "contested" | "invalid-for-scope";
  firedTriggers: AuthorityReconsiderTrigger[];
  invalidatedAssumptions: string[];
  staleEvidenceIds: EntityId[];
  blocksCurrentChange: boolean;
  explanation: string;
}

export interface DeveloperPreference {
  id: EntityId;
  key: string;
  scope: "user" | "organization" | "project";
  selector: SelectorExpr;
  strength: "prefer" | "strongly-prefer" | "avoid";
  statement: string;
  rationale?: string;
  status: "active" | "retired";
  sourceClass: SourceClass;
  semanticHash: ContentHash;
}

export type GovernanceBasis =
  | { kind: "architecture-decision"; decisionId: EntityId }
  | { kind: "hard-constraint"; conceptId: EntityId }
  | { kind: "adopted-standard"; authorityRecordId: EntityId }
  | { kind: "migration-overlay"; migrationId: EntityId }
  | { kind: "host-safety"; key: string }
  | { kind: "active-lens"; lensId: EntityId };
export type EntityId = string;
export type Confidence = number; // 0..1; inference confidence, not a calibrated probability unless stated
export type ContentHash = `sha256:v1:${string}`;

export type SourceClass =
  | "authored"
  | "derived"
  | "observed"
  | "inferred";

export interface EvidenceRef {
  evidenceId: EntityId;
  stance: "supports" | "contradicts" | "context";
  weight?: number;
}

export interface CausalOrigin {
  kind:
    | "pre-projector"
    | "human"
    | "deterministic-observation"
    | "model-inference"
    | "semantic-resolution"
    | "relevance-analysis"
    | "planning-surprise"
    | "lens-transform"
    | "plan"
    | "external";
  causedByLensId?: EntityId;
  causedByRuleId?: EntityId;
  causedByTransformId?: string;
  causedBySemanticChangeId?: EntityId;
  causedByRelevanceClosureId?: EntityId;
  causedByPlanningSurpriseId?: EntityId;
  causedByPlanId?: EntityId;
  causedByPacketId?: EntityId;
}

export interface SemanticSignature {
  hash: ContentHash;
  profileId: string;
  profileVersion: string;
  scope: string;
  assurance: "exact" | "validated" | "heuristic";
  evidenceIds: EntityId[];
}
export interface LineageRecord {
  id: EntityId;
  kind: "move" | "split" | "merge" | "replace" | "delete";
  fromIds: EntityId[];
  toIds: EntityId[];
  reason: string;
  stateDigest: ContentHash;
}

export interface Tombstone {
  entityId: EntityId;
  deletedAtRevision: number;
  lastSemanticHash: ContentHash;
  replacementIds: EntityId[];
  reason: string;
}
export interface Concept {
  id: EntityId;
  key: string;
  kind:
    | "capability"
    | "behavior"
    | "invariant"
    | "decision"
    | "ownership"
    | "obligation"
    | "data"
    | "interface"
    | "event"
    | "command"
    | "policy"
    | "read-model"
    | "contract"
    | "assumption"
    | "migration"
    | "constraint";
  name: string;
  aliases: string[];
  statement: string;
  status: "candidate" | "active" | "deprecated" | "rejected";
  sourceClass: SourceClass;
  confidence: Confidence;
  tags: string[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}

export type RelationType =
  | "realizes"
  | "requires"
  | "constrains"
  | "depends-on"
  | "has-requirement"
  | "demonstrated-by"
  | "produces"
  | "consumes"
  | "triggers"
  | "governed-by"
  | "applies-to"
  | "generates"
  | "documents"
  | "verifies"
  | "deploys-to"
  | "publishes-to"
  | "observes"
  | "owns"
  | "incompatible-with"
  | "derived-from"
  | "supersedes"
  | "exception-to"
  | "variant-of";

export interface Relation {
  id: EntityId;
  fromId: EntityId;
  toId: EntityId;
  type: RelationType;
  sourceClass: SourceClass;
  confidence: Confidence;
  evidence: EvidenceRef[];
  active: boolean;
  semanticHash: ContentHash;
}
export interface IntentOriginRef {
  kind: "user-request" | "linear" | "github-issue" | "document" | "external";
  locator: string;
  contentHash?: ContentHash;
  description?: string;
}

export interface Requirement {
  id: EntityId;
  key: string;
  title: string;
  aliases: string[];
  statement: string;
  status: "candidate" | "active" | "deprecated" | "rejected" | "superseded";
  sourceClass: SourceClass;
  scope: SelectorExpr;
  origin: IntentOriginRef[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}

export interface BehavioralScenarioStep {
  role: "precondition" | "trigger" | "expected-outcome" | "forbidden-outcome";
  statement: string;
}

export interface BehavioralScenario {
  id: EntityId;
  key: string;
  title: string;
  aliases: string[];
  status: "candidate" | "active" | "deprecated" | "rejected" | "superseded";
  sourceClass: SourceClass;
  scope: SelectorExpr;
  steps: BehavioralScenarioStep[];
  evidence: EvidenceRef[];
  discoveryHash: ContentHash;
  semanticHash: ContentHash;
}
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
export interface StateDigest {
  gitBase: string;
  worktreeDigest: ContentHash; // complete governed worktree snapshot identity
  canonicalProjectorDigest: ContentHash; // complete canonical Projector snapshot identity
  toolchainDigest: ContentHash;
  pinnedExternalSnapshotDigest?: ContentHash;
}

export type StateValueDependencyKind =
  | "canonical-entity"
  | "canonical-governance"
  | "projection-unit"
  | "artifact"
  | "toolchain"
  | "adapter"
  | "signature-profile"
  | "representation-profile"
  | "external-snapshot";

export interface StateValueDependencyRef {
  kind: StateValueDependencyKind;
  id: EntityId | string;
  versionHash: ContentHash;
  role: string;
}

export type StateQueryKind =
  | "semantic-identity-search"
  | "relation-neighborhood"
  | "reverse-derivation"
  | "selector-membership"
  | "impact-rule-applicability"
  | "decision-applicability"
  | "implementation-binding"
  | "event-topology"
  | "contract-topology"
  | "verification-binding"
  | "package-dependency"
  | "surface-enumeration"
  | "custom";

export interface StateQuerySpec {
  id: string;
  kind: StateQueryKind;
  programId: string;
  programVersion: string;
  input: Record<string, unknown>;
  semanticHash: ContentHash;
}

export interface StateQueryResultFingerprint {
  queryHash: ContentHash;
  resultHash: ContentHash;
  resultCount: number;
  observability: ObservabilityClass;
  assumptions: string[];
  unavailableLanes: string[];
  dependencyKeys: string[];
}

export interface StateQueryDependency {
  query: StateQuerySpec;
  priorResult: StateQueryResultFingerprint;
  role: string;
}

export interface StateBinding {
  compiledAgainst: StateDigest;
  valueDependencies: StateValueDependencyRef[];
  queryDependencies: StateQueryDependency[];
  dependencyDigest: ContentHash;
}

export interface StateBindingValidation {
  status: "current" | "rebound" | "stale" | "suspect" | "unavailable";
  currentState: StateDigest;
  changedValueDependencyIds: Array<EntityId | string>;
  changedQueryDependencyIds: string[];
  reasons: string[];
  rebound?: StateBinding;
}

export interface ValidationResult {
  validatorId: string;
  status: "passed" | "failed" | "skipped" | "blocked";
  summary: string;
  evidenceIds: EntityId[];
  evidenceLane:
    | "compiler"
    | "test"
    | "schema"
    | "runtime"
    | "property"
    | "representation"
    | "architecture"
    | "historical"
    | "human"
    | "independent-agent"
    | "same-packet-agent";
  independenceGroup: string;
  assurance: "weak" | "supporting" | "strong" | "exact";
  authorSource: string;
  sideEffectClass: "none" | "read-only" | "workspace-write" | "external-write";
  details: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface RollbackSpec {
  kind: "git-checkpoint" | "inverse-transform" | "compensation" | "manual" | "none";
  checkpointId?: string;
  transformId?: string;
  instructions?: string;
}

export interface OperationEvidence {
  operationId: string;
  executor: "transform" | "agent" | "manual" | "external";
  unitIds: EntityId[];
  beforeHashes: ContentHash[];
  afterHashes: ContentHash[];
  evidenceIds: EntityId[];
  summary: string;
}
export interface AnalyzerCapabilities {
  analyzerId: string;
  adapterVersion: string;
  supportedLanguages: string[];
  supportedSemantics: string[];
  enumeration: EnumerationContract;
  executesRepositoryCode: boolean;
}

export interface AnalyzerFailure {
  analyzerId: string;
  capability: string;
  scope: string;
  message: string;
  recoverable: boolean;
  affectedClaimKinds: string[];
}

export interface AdapterContext {
  repositoryRoot: string;
  stateDigest: StateDigest;
  config: Record<string, unknown>;
  signal: AbortSignal;
}

export interface ArtifactFingerprint {
  contentHash: ContentHash;
  structuralSignature?: SemanticSignature;
  semanticSignature?: SemanticSignature;
  adapterVersion: string;
}

export interface GraphReader {
  getConcept(id: EntityId): Concept | undefined;
  getRequirement(id: EntityId): Requirement | undefined;
  getBehavioralScenario(id: EntityId): BehavioralScenario | undefined;
  getProjectionUnit(id: EntityId): ProjectionUnit | undefined;
  getRelations(id: EntityId, direction: "in" | "out" | "both"): Relation[];
  reverseDerivationDependents(subjectId: EntityId | string): EntityId[];
  getDerivationInputs(unitId: EntityId): DerivationInput[];
  querySelectorDependencies(selectorHash: ContentHash): EntityId[];
  searchSemanticIdentities(query: string, kinds?: Array<"concept" | "requirement" | "scenario">): EntityId[];
}

export interface StateQueryReader {
  evaluate(query: StateQuerySpec, context: AdapterContext): Promise<StateQueryResultFingerprint>;
}

export interface StateBindingValidator {
  validate(
    binding: StateBinding,
    currentState: StateDigest,
    context: AdapterContext,
  ): Promise<StateBindingValidation>;
}

export interface TransformContext {
  repositoryRoot: string;
  stateBinding: StateBinding;
  allowedUnits: EntityId[];
  dryRun: boolean;
  signal: AbortSignal;
}

export interface TransformPreview {
  applicable: boolean;
  operations: Array<Record<string, unknown>>;
  touchedUnitIds: EntityId[];
  expectedDiff: string;
  warnings: string[];
}

export interface TransformResult {
  transformId: string;
  changed: boolean;
  touchedUnitIds: EntityId[];
  operations: OperationEvidence[];
  checkpointId?: string;
}

export interface SurfaceChange {
  semanticChangeId: EntityId;
  surfaceId: EntityId;
  operation: string;
  payload: Record<string, unknown>;
}

export interface SurfacePlan {
  adapterId: string;
  surfaceId: EntityId;
  riskClass: RiskClass;
  operations: Array<Record<string, unknown>>;
  requiredApprovals: string[];
  validatorIds: string[];
  boundState: StateBinding;
}

export interface SurfaceApplyResult {
  changed: boolean;
  operationEvidence: OperationEvidence[];
  externalReferences: string[];
}

export interface TokenCounter {
  profileId: string;
  count(text: string): number;
}
export interface RecognizerBinding {
  id: string;
  version: string;
  adapterId: string;
  query: Record<string, unknown>;
  minimumConfidence: Confidence;
}

export interface ValidatorBinding {
  id: string;
  version: string;
  provider: string;
  input: Record<string, unknown>;
  required: boolean;
  requiredIndependenceGroup?: string;
}

export interface TransformBinding {
  id: string;
  version: string;
  input: Record<string, unknown>;
  exclusiveUnitClaim: boolean;
}

export interface MigrationBinding {
  fromVersion: string;
  toVersion: string;
  transformIds: string[];
  validationIds: string[];
}

export interface LensExample {
  unitId?: EntityId;
  artifactLocator?: string;
  explanation: string;
  evidenceIds: EntityId[];
}

export interface AuthorityAlternative {
  key: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  rejectedBecause: string[];
  evidence: EvidenceRef[];
}
export type ObservabilityClass =
  | "closed"
  | "bounded"
  | "open"
  | "sampled"
  | "unavailable";

export interface EnumerationContract {
  observability: ObservabilityClass;
  method: string;
  assumptions: string[];
  blindSpots: string[];
  dynamicMechanisms: string[];
  freshnessRequirement?: string;
}

export interface SurfaceCapabilities {
  read: boolean;
  write: boolean;
  watch: boolean;
  transactionalWrites: boolean;
  stableAnchors: boolean;
  humanApprovalRequired: boolean;
}

export interface Surface {
  id: EntityId;
  key: string;
  kind:
    | "repository"
    | "ci"
    | "cloud"
    | "package-registry"
    | "app-store"
    | "website"
    | "runtime"
    | "database"
    | "external";
  adapter: string;
  access: "read-write" | "read-only" | "declared-only" | "unavailable";
  enumeration: EnumerationContract;
  capabilities: SurfaceCapabilities;
  boundary: Record<string, unknown>;
}

export interface Artifact {
  id: EntityId;
  surfaceId: EntityId;
  locator: string;
  mediaType: string;
  contentHash: ContentHash;
  structuralSignature?: SemanticSignature;
  semanticSignature?: SemanticSignature;
  observedAt: string;
  observationRevision: string;
  causalOrigin: CausalOrigin;
  metadata: Record<string, unknown>;
}
export interface SemanticAnchor {
  kind:
    | "file"
    | "symbol"
    | "ast-node"
    | "json-pointer"
    | "yaml-path"
    | "markdown-section"
    | "workflow-job"
    | "resource-property"
    | "external-field";
  value: string;
  fallbackSignature?: SemanticSignature;
}

export interface ControlPolicy {
  ownership: "exclusive" | "structured" | "shared" | "observed";
  mutation: "replace" | "transform" | "agent" | "external" | "none";
  actuation: "automatic" | "approval" | "human" | "unavailable";
}

export interface LensRef {
  lensId: EntityId;
  version: string;
  semanticHash: ContentHash;
}

export type ValidityState =
  | "valid"
  | "suspect"
  | "invalid"
  | "revalidating"
  | "repair-planned"
  | "blocked"
  | "unreachable";

export interface ProjectionUnit {
  id: EntityId;
  artifactId: EntityId;
  key: string;
  role:
    | "implementation"
    | "contract"
    | "test"
    | "fixture"
    | "documentation"
    | "comment"
    | "configuration"
    | "deployment"
    | "publication"
    | "telemetry"
    | "migration"
    | "supporting";
  anchor: SemanticAnchor;
  control: ControlPolicy;
  conceptIds: EntityId[];
  requirementIds: EntityId[];
  scenarioIds: EntityId[];
  lenses: LensRef[];
  tags: string[];
  structuralSignature: SemanticSignature;
  semanticSignature: SemanticSignature;
  membershipHash: ContentHash;
  validity: ValidityState;
  confidence: Confidence;
  causalOrigin: CausalOrigin;
  generatedFromUnitIds: EntityId[];
}
export type EvidenceKind =
  | "explicit-decision"
  | "repository-structure"
  | "code-relationship"
  | "test"
  | "documentation"
  | "git-history"
  | "runtime-observation"
  | "build-output"
  | "official-documentation"
  | "standard"
  | "research-paper"
  | "reference-implementation"
  | "issue-or-incident"
  | "user-decision"
  | "agent-inference";

export interface EvidenceClaim {
  subjectKey: string;
  predicate: string;
  object: unknown;
  inferenceConfidence?: Confidence;
}

export interface Evidence {
  id: EntityId;
  kind: EvidenceKind;
  locator: string;
  capturedAt: string;
  sourceDate?: string;
  contentHash: ContentHash;
  excerpt?: string;
  claims: EvidenceClaim[];
  reliability:
    | "mechanically-proven"
    | "high"
    | "medium"
    | "low"
    | "untrusted";
  normativeAuthority:
    | "binding-decision"
    | "hard-constraint"
    | "authoritative-guidance"
    | "supporting"
    | "descriptive-only"
    | "none";
  independenceGroup: string;
  applicability: "direct" | "analogous" | "contextual" | "uncertain";
  freshness: Confidence;
  causalOrigin: CausalOrigin;
  metadata: Record<string, unknown>;
}
export interface AuthorityVector {
  explicitDecisionAlignment: number;
  productConstraintFit: number;
  semanticFit: number;
  independentOccurrence: number;
  historicalStability: number;
  independentValidationSupport: number;
  boundaryCoherence: number;
  maintenanceOutcome: number;
  platformCompatibility: number;
  externalRationale: number;
  ecosystemHealth: number;
  securitySupport: number;
  reversibility: number;
  migrationCost: number;
  counterEvidence: number;
}
export type AuthorityReconsiderTrigger =
  | { type: "concept-changed"; conceptId: EntityId }
  | { type: "requirement-changed"; subjectId: EntityId | string }
  | { type: "scenario-changed"; scenarioId: EntityId }
  | { type: "relation-changed"; relationId: EntityId }
  | { type: "constraint-changed"; constraintId: EntityId }
  | { type: "scope-expanded"; scopeKey: string }
  | { type: "surface-added"; surfaceKind: Surface["kind"] }
  | { type: "assumption-falsified"; assumptionKey: string }
  | { type: "lens-changed"; lensId: EntityId }
  | { type: "evidence-invalidated"; evidenceId: EntityId }
  | { type: "evidence-refresh-required"; policyKey: string }
  | { type: "toolchain-version"; tool: string; constraint: string }
  | { type: "platform-version"; platform: string; constraint: string }
  | { type: "project-preference-changed"; preferenceId: EntityId }
  | { type: "counterevidence-threshold"; subjectId: EntityId; threshold: number }
  | { type: "date"; at: string }
  | { type: "manual-review" };

export interface EvidenceRefreshPolicy {
  key: string;
  mode: "on-trigger" | "version-sensitive" | "max-age" | "manual";
  maxAgeDays?: number;
  trackedTechnologies?: string[];
  requireOfficialSourceWhenAvailable: boolean;
}
export interface AuthorityRecord {
  id: EntityId;
  key: string;
  subjectId: EntityId;
  status: "provisional" | "approved" | "auto-approved" | "rejected" | "superseded";
  conclusion: "preserve" | "normalize" | "migrate" | "exception" | "unknown";
  rationale: string;
  alternatives: AuthorityAlternative[];
  assumptions: string[];
  reconsiderWhen: AuthorityReconsiderTrigger[];
  evidenceRefreshPolicy?: EvidenceRefreshPolicy;
  vector: AuthorityVector;
  assessmentConfidence: "low" | "medium" | "high";
  evidence: EvidenceRef[];
  governanceRiskClass: RiskClass;
  decidedBy: "system" | "user" | "policy";
  createdAt: string;
  semanticHash: ContentHash;
}
export interface SemanticIdentityCandidate {
  entityId: EntityId;
  entityKind: "concept" | "requirement" | "scenario";
  similarity: Confidence;
  ownershipFit: Confidence;
  boundaryFit: Confidence;
  evidence: EvidenceRef[];
  explanation: string;
}

export interface NewSemanticBoundary {
  owns: string[];
  excludes: string[];
  nearestEntityIds: EntityId[];
  rationale: string;
}

export interface SemanticIdentityResolution {
  id: EntityId;
  requestedMeaning: string;
  requestedKind: "concept" | "requirement" | "scenario" | "unknown";
  outcome:
    | "reuse-existing"
    | "coordinated-modification"
    | "split-existing"
    | "merge-existing"
    | "replace-existing"
    | "create-new"
    | "no-durable-entity"
    | "unresolved";
  candidates: SemanticIdentityCandidate[];
  selectedEntityIds: EntityId[];
  newBoundary?: NewSemanticBoundary;
  confidence: Confidence;
  evidence: EvidenceRef[];
  unknowns: string[];
  boundState: StateBinding;
  contentHash: ContentHash;
}
export type RelevanceBand =
  | "direct"
  | "governing"
  | "consequence"
  | "possible";

export interface RelevanceSeed {
  kind:
    | "request-term"
    | "semantic-entity"
    | "projection-unit"
    | "artifact"
    | "code-symbol"
    | "contract"
    | "event"
    | "decision"
    | "manual";
  subjectId?: EntityId | string;
  value?: string;
  reason: string;
  confidence: Confidence;
}

export interface RelevanceReason {
  kind:
    | "explicit"
    | "identity-match"
    | "governs"
    | "constrains"
    | "depends-on"
    | "implementation-binding"
    | "selector-applicability"
    | "event-producer-consumer"
    | "contract-producer-consumer"
    | "verification-binding"
    | "package-dependency"
    | "historical-cochange"
    | "semantic-similarity"
    | "model-inference"
    | "analysis-facet"
    | "open-world-widening";
  fromId?: EntityId | string;
  weight: number;
  provenance: "declared" | "derived" | "observed" | "inferred";
  confidence: Confidence;
  explanation: string;
  evidenceIds: EntityId[];
}

export interface RelevanceEntry {
  entityId: EntityId;
  band: RelevanceBand;
  score: number;
  requiredForPlanning: boolean;
  reasons: RelevanceReason[];
}

export interface RelevanceClosure {
  id: EntityId;
  requestHash: ContentHash;
  seeds: RelevanceSeed[];
  entries: RelevanceEntry[];
  activatedFacetKeys: string[];
  unknowns: string[];
  unavailableLanes: string[];
  boundState: StateBinding;
  contentHash: ContentHash;
}
export interface AnalysisFacet {
  key: string;
  version: string;
  selector: SelectorExpr;
  questionKeys: string[];
  relevanceRuleIds: string[];
  requiredEvidenceLanes: ValidationResult["evidenceLane"][];
  outputKinds: string[];
}
export interface PlanningSurprise {
  id: EntityId;
  planId: EntityId;
  kind:
    | "unpredicted-semantic-impact"
    | "unpredicted-code-impact"
    | "missing-relation"
    | "scope-expansion"
    | "agent-overreach"
    | "benign-discovery";
  predictedEntityIds: EntityId[];
  observedEntityIds: EntityId[];
  unexpectedEntityIds: EntityId[];
  evidence: EvidenceRef[];
  explanation: string;
  disposition:
    | "accept-and-learn"
    | "accept-no-model-change"
    | "repair-plan"
    | "revert-overreach"
    | "human-decision"
    | "unresolved";
  proposedRelationIds: EntityId[];
  contentHash: ContentHash;
}
export type RiskClass = "R0" | "R1" | "R2" | "R3" | "R4";

export interface RiskAssessment {
  class: RiskClass;
  inherentOperationRisk: number;
  affectedUnitCount: number;
  affectedSurfaceCount: number;
  publicContractImpact: boolean;
  externalImpact: boolean;
  dataImpact: boolean;
  reversibility: "full" | "strong" | "partial" | "none";
  validationStrength: "weak" | "supporting" | "strong" | "exact";
  closureConfidence: "proven" | "bounded" | "high" | "partial" | "unknown";
  unresolvedIdentityCount: number;
  relevanceFrontierCount: number;
  openWorldDependencies: boolean;
  unresolvedBlockingConcernCount: number;
  suspectDecisionCount: number;
  compensationAvailable: boolean;
  reasons: string[];
}

export interface ExecutionPolicy {
  preset: "observe" | "guide" | "govern" | "autonomous" | "salvage";
  maximumAutomaticRisk: RiskClass;
  network: "deny" | "ask" | "allow";
  externalWrites: "deny" | "approval" | "allow-with-capability";
  requireIndependentValidationAtOrAbove: RiskClass;
  requireWorktreeAtOrAbove: RiskClass;
  allowAutoPromotion: boolean;
  allowAutoMutation: boolean;
  maxChangedUnits?: number;
  maxChangedSurfaces?: number;
  maxCost?: number;
  maxTokens?: number;
}
export interface PatternCandidate {
  id: EntityId;
  key: string;
  purposeHypothesis: string;
  memberUnitIds: EntityId[];
  excludedUnitIds: EntityId[];
  counterExamples: EntityId[];
  independenceGroups: string[];
  alternatives: string[];
  confidence: Confidence;
  evidence: EvidenceRef[];
  semanticHash: ContentHash;
}
export type LensContributionRole =
  | "projection-owner"
  | "constraint-contributor"
  | "validator-contributor"
  | "migration-overlay";
export type ProjectionExpectation =
  | {
      kind: "exact-output";
      generatorId: string;
      expectedSignatureProfile: string;
    }
  | {
      kind: "structured-template";
      structureValidatorId: string;
      authoredHoles: string[];
    }
  | {
      kind: "predicate-constrained";
      predicateIds: string[];
      validatorIds: string[];
    }
  | {
      kind: "observed-state";
      comparisonPolicyId: string;
    }
  | {
      kind: "human-procedure";
      procedureId: string;
      evidenceRequirements: string[];
    };
export interface ProjectionSpec {
  role: ProjectionUnit["role"];
  cardinality: "one" | "zero-or-one" | "many" | "at-least-one";
  surfaceKind: Surface["kind"];
  selector: SelectorExpr;
  control: ControlPolicy;
  expectation: ProjectionExpectation;
}

export interface ProjectionLens {
  id: EntityId;
  key: string;
  version: string;
  status: "candidate" | "shadow" | "active" | "deprecated" | "retired";
  purpose: string;
  realizesConceptKinds: Concept["kind"][];
  selector: SelectorExpr;
  contributions: LensContributionRole[];
  expectedProjections: ProjectionSpec[];
  rules: Rule[];
  impactRules: ImpactRule[];
  recognizers: RecognizerBinding[];
  validators: ValidatorBinding[];
  transforms: TransformBinding[];
  migrations: MigrationBinding[];
  conflictsWith: LensRef[];
  compatibleWith: LensRef[];
  examples: LensExample[];
  counterExamples: LensExample[];
  authorityRecordId: EntityId;
  governanceBasis: GovernanceBasis[];
  semanticHash: ContentHash;
}
export type SelectorExpr =
  | { op: "all"; items: SelectorExpr[] }
  | { op: "any"; items: SelectorExpr[] }
  | { op: "not"; item: SelectorExpr }
  | {
      op: "atom";
      field:
        | "path"
        | "language"
        | "artifact-role"
        | "concept"
        | "concept-kind"
        | "requirement"
        | "scenario"
        | "lens"
        | "surface"
        | "package"
        | "package-kind"
        | "operation"
        | "platform"
        | "migration-phase"
        | "risk"
        | "tag"
        | "control-ownership"
        | "control-mutation"
        | "ast-pattern"
        | "relation"
        | "causal-origin";
      matcher:
        | "equals"
        | "in"
        | "glob"
        | "regex"
        | "contains"
        | "exists"
        | "matches-structural-query";
      value: unknown;
    };
export interface IgnorePolicy {
  inventory: SelectorExpr[];
  inferenceAuthority: SelectorExpr[];
  mutation: SelectorExpr[];
  reporting: SelectorExpr[];
  modelContext: SelectorExpr[];
  coverageDenominator: SelectorExpr[];
}
export type RuleEffect =
  | "require"
  | "forbid"
  | "prefer"
  | "validate"
  | "transform"
  | "route"
  | "grant"
  | "restrict"
  | "explain";

export type AuthorityClass =
  | "host-safety"
  | "platform-constraint"
  | "approved-user-intent"
  | "active-lens"
  | "adopted-external-standard"
  | "migration-overlay"
  | "local-convention"
  | "inferred-candidate"
  | "task-suggestion";
export type NormalizedPredicate =
  | { kind: "path-under"; root: string }
  | { kind: "path-not-under"; root: string }
  | { kind: "relation-required"; relation: RelationType; targetSelector: SelectorExpr }
  | { kind: "relation-forbidden"; relation: RelationType; targetSelector: SelectorExpr }
  | { kind: "cardinality"; selector: SelectorExpr; min?: number; max?: number }
  | { kind: "dependency-allowed"; from: SelectorExpr; to: SelectorExpr }
  | { kind: "dependency-forbidden"; from: SelectorExpr; to: SelectorExpr }
  | { kind: "permission"; operation: string; allowed: boolean }
  | { kind: "unit-state"; state: ValidityState }
  | { kind: "schema-valid"; schemaId: string }
  | { kind: "validator"; validatorId: string };

export interface Rule {
  id: EntityId;
  key: string;
  version: string;
  effect: RuleEffect;
  authorityClass: AuthorityClass;
  governanceBasis: GovernanceBasis[];
  selector: SelectorExpr;
  predicates: NormalizedPredicate[];
  advisoryPayload?: Record<string, unknown>;
  rationale: string;
  evidence: EvidenceRef[];
  conflictPolicy: "error" | "merge" | "higher-authority" | "explicit-exception-only";
  validatorIds: string[];
  transformIds: string[];
  semanticHash: ContentHash;
}
export interface RuleConflict {
  ruleIds: EntityId[];
  unitId: EntityId;
  kind:
    | "require-forbid"
    | "exclusive-transform"
    | "authority-override"
    | "ambiguous-selector"
    | "incompatible-predicate";
  explanation: string;
  evidenceIds: EntityId[];
}

export interface EffectiveRuleBundle {
  unitId: EntityId;
  operation: string;
  rules: Rule[];
  suppressedRules: Array<{ ruleId: EntityId; reason: string; supersededBy?: EntityId }>;
  predicates: NormalizedPredicate[];
  conflicts: RuleConflict[];
  dependencyFingerprint: ContentHash;
  bundleHash: ContentHash;
}
export interface DerivationInput {
  kind:
    | "concept"
    | "requirement"
    | "scenario"
    | "relation"
    | "lens"
    | "rule-bundle"
    | "unit"
    | "artifact"
    | "external-constraint"
    | "toolchain"
    | "adapter"
    | "signature-profile"
    | "representation-profile"
    | "representation-projection";
  id: EntityId | string;
  versionHash: ContentHash;
  role: string;
}

export interface DerivationRecord {
  unitId: EntityId;
  proofGroupId?: EntityId;
  engineVersion: string;
  adapterVersion: string;
  inputs: DerivationInput[];
  ruleBundleHash: ContentHash;
  outputSemanticSignature: SemanticSignature;
  outputStructuralSignature: SemanticSignature;
  membershipHash: ContentHash;
  establishedAt: string;
  validators: ValidationResult[];
}
export interface ImpactRule {
  id: EntityId;
  key: string;
  version: string;
  selector: SelectorExpr;
  trigger:
    | "concept-change"
    | "interface-change"
    | "membership-change"
    | "removal"
    | "lens-change"
    | "rule-change"
    | "decision-change"
    | "concern-resolution"
    | "representation-profile-change"
    | "external-change"
    | "manual";
  direction: "forward" | "reverse" | "both";
  relationTypes?: RelationType[];
  maxDepth?: number;
  effect: "invalidate" | "revalidate" | "widen-analysis" | "advisory" | "block";
  requiredRelationConfidence?: number;
  semanticHash: ContentHash;
}
export interface InvalidationCause {
  eventKind: string;
  subjectId: EntityId | string;
  oldHash?: ContentHash;
  newHash?: ContentHash;
}

export interface InvalidationEvent extends InvalidationCause {
  graphRevision: number;
  stateDigest: StateDigest;
}

export interface InvalidationResult {
  directlyAffected: EntityId[];
  transitivelyAffected: EntityId[];
  possibleFrontier: EntityId[];
  unavailable: EntityId[];
  reasons: Record<EntityId, string[]>;
}
export type RepairStrategy =
  | "reuse"
  | "revalidate"
  | "deterministic-patch"
  | "regenerate"
  | "agent-repair"
  | "widen-analysis"
  | "human-decision";

export interface RepairCapabilities {
  validatorCanProveValidity: boolean;
  deterministicPatch: boolean;
  patchIsReversible: boolean;
  generator: boolean;
  upstreamSourceKnown: boolean;
}
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
export interface CoverageLane {
  key: string;
  observability: ObservabilityClass;
  numerator: number;
  denominator?: number;
  confidence: Confidence;
  assumptions: string[];
  blindSpots: string[];
  analyzerFailures: AnalyzerFailure[];
  staleObservationIds: string[];
  exactClosureProvable: boolean;
}

export interface CoverageSnapshot {
  graphRevision: number;
  boundary: string[];
  lanes: CoverageLane[];
  completeWithinBoundary: boolean;
  allowsBoundedAgentRepair: boolean;
  unknownFrontierIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
  proofStatement: "proven-within-boundary" | "bounded" | "high-confidence" | "partial" | "not-established";
}
export interface Divergence {
  id: EntityId;
  type: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: Confidence;
  leverage: number;
  status: "open" | "auto-fixed" | "planned" | "accepted-exception" | "dismissed" | "blocked";
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
  conceptIds: EntityId[];
  requirementIds: EntityId[];
  scenarioIds: EntityId[];
  unitIds: EntityId[];
  ruleIds: EntityId[];
  evidence: EvidenceRef[];
  counterEvidence: EvidenceRef[];
  rationale: string;
  possibleIntentionality: string[];
  recommendedDisposition: string;
  repairStrategies: RepairStrategy[];
  coverageCaveat: string;
  semanticHash: ContentHash;
}
export interface PlanCheckpoint {
  id: EntityId;
  afterPacketIds: EntityId[];
  requiredValidators: string[];
  rollback: RollbackSpec;
}

export interface ExecutionPlan {
  id: EntityId;
  revision: number;
  supersedesPlanId?: EntityId;
  semanticChangeId?: EntityId;
  sourceRunId: EntityId;
  boundState: StateBinding;
  relevanceClosureId?: EntityId;
  predictedImpactClosureHash?: ContentHash;
  boundary: string[];
  assumptions: string[];
  knownAffectedUnitIds: EntityId[];
  possibleFrontierUnitIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
  packetIds: EntityId[];
  checkpoints: PlanCheckpoint[];
  completionCriteria: CompletionContract;
  recommendedNextChunk?: string;
}
export interface IntentStatement {
  kind: "behavior" | "constraint" | "non-goal" | "assumption" | "implementation-proposal";
  statement: string;
  origin: IntentOriginRef[];
  confidence: Confidence;
}

export interface ChangeIntentAnalysis {
  id: EntityId;
  request: string;
  normalizedIntent: string;
  statements: IntentStatement[];
  ambiguity: string[];
  assumptions: string[];
  contentHash: ContentHash;
}
export interface RequirementDelta {
  subjectType: "requirement";
  kind: "add" | "modify" | "remove" | "supersede";
  requirementId?: EntityId;
  proposedRequirement?: Requirement;
  rationale: string;
}

export interface BehavioralScenarioDelta {
  subjectType: "scenario";
  kind: "add" | "modify" | "remove" | "supersede";
  scenarioId?: EntityId;
  proposedScenario?: BehavioralScenario;
  rationale: string;
}
export interface SemanticOperation {
  kind:
    | "add"
    | "modify"
    | "remove"
    | "replace"
    | "migrate"
    | "adopt-rule"
    | "deprecate-rule"
    | "resolve-divergence";
  subjectType:
    | "concept"
    | "relation"
    | "decision"
    | "lens"
    | "rule"
    | "projection"
    | "surface"
    | "other";
  subjectKey: string;
  subjectId?: EntityId;
  payload: Record<string, unknown>;
}

export type ChangeOperation =
  | SemanticOperation
  | RequirementDelta
  | BehavioralScenarioDelta;

export interface ImpactClosureRef {
  contentHash: ContentHash;
  knownAffectedUnitIds: EntityId[];
  possibleFrontierUnitIds: EntityId[];
  unavailableSurfaceIds: EntityId[];
}

export interface SemanticChange {
  id: EntityId;
  request: string;
  normalizedIntent: string;
  intentAnalysisId: EntityId;
  identityResolutionIds: EntityId[];
  relevanceClosureId: EntityId;
  analysisFacetKeys: string[];
  operations: ChangeOperation[];
  decisionIds: EntityId[];
  assumptions: string[];
  boundary: string[];
  predictedImpact?: ImpactClosureRef;
  risk: RiskAssessment;
  status: "draft" | "analyzed" | "approved" | "executing" | "complete" | "blocked";
}
export interface WorkPacket {
  id: EntityId;
  planId: EntityId;
  title: string;
  strategy: RepairStrategy;
  unitIds: EntityId[];
  dependencies: EntityId[];
  capsuleId: EntityId;
  risk: RiskAssessment;
  executionMode: "deterministic" | "agent" | "manual" | "external";
  transformId?: string;
  validatorIds: string[];
  rollback: RollbackSpec;
  boundState: StateBinding;
  status: "pending" | "running" | "succeeded" | "failed" | "blocked" | "skipped";
}
export type TransactionPhase =
  | "prepared"
  | "workspace-mutating"
  | "workspace-staged"
  | "validating"
  | "canonical-staging"
  | "committing"
  | "committed"
  | "rolling-back"
  | "rolled-back"
  | "recovery-required";

export interface TransactionJournalEntry {
  transactionId: EntityId;
  planId: EntityId;
  phase: TransactionPhase;
  beforeState: StateDigest;
  intendedAfterCanonicalDigest?: ContentHash;
  worktreePath: string;
  checkpointIds: string[];
  touchedPaths: string[];
  externalOperationIds: string[];
  updatedAt: string;
}
export interface TransactionReceipt {
  id: EntityId;
  planId: EntityId;
  semanticChangeId?: EntityId;
  riskClass: RiskClass;
  beforeState: StateDigest;
  afterState: StateDigest;
  changedCanonicalEntityIds: EntityId[];
  changedRequirementIds: EntityId[];
  changedScenarioIds: EntityId[];
  changedUnitIds: EntityId[];
  validationSummaryHash: ContentHash;
  certificateHash?: ContentHash;
  rollbackRef?: string;
  createdAt: string;
  semanticHash: ContentHash;
}
export interface ChangeCertificate {
  id: EntityId;
  planId: EntityId;
  baseGitRevision?: string;
  resultingGitRevision?: string;
  semanticChange?: SemanticChange;
  relevanceClosureHash?: ContentHash;
  predictedImpactClosureHash?: ContentHash;
  observedImpactClosureHash?: ContentHash;
  beforeState: StateDigest;
  afterState?: StateDigest;
  changedConcepts: EntityId[];
  changedRequirements: EntityId[];
  changedScenarios: EntityId[];
  changedRelations: EntityId[];
  changedUnits: EntityId[];
  planningSurpriseIds: EntityId[];
  deterministicOperations: OperationEvidence[];
  agentOperations: OperationEvidence[];
  validations: ValidationResult[];
  divergencesResolved: EntityId[];
  divergencesIntroduced: EntityId[];
  modeledBoundary: string[];
  completeness: "proven-within-boundary" | "bounded" | "high-confidence" | "partial" | "not-established";
  unknowns: string[];
  unavailableActions: string[];
  rollback: RollbackSpec[];
  createdAt: string;
}
// @ts-expect-error The normative request generic is reserved for provider typing.
export interface StructuredModelRequest<T> {
  purpose: string;
  role:
    | "classify"
    | "infer-concepts"
    | "resolve-identity"
    | "discover-relevance"
    | "analyze-intent"
    | "infer-pattern"
    | "research-synthesis"
    | "architecture"
    | "bounded-edit"
    | "representation-render"
    | "representation-review"
    | "adversarial-review"
    | "judge";
  programVersion: string;
  schemaName: string;
  schemaVersion: string;
  schema: unknown;
  input: Record<string, unknown>;
  inputHash: ContentHash;
  executionCapsule?: ExecutionCapsule;
  risk: RiskAssessment;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxCost?: number;
}

export interface StructuredModelResponse<T> {
  value: T;
  provider: string;
  model: string;
  providerRevision?: string;
  inputTokens?: number;
  outputTokens?: number;
  rawResponseHash: ContentHash;
  attempt: number;
}

export interface ModelProvider {
  generateStructured<T>(request: StructuredModelRequest<T>): Promise<StructuredModelResponse<T>>;
}
export interface SurfaceAdapter {
  id: string;
  kind: Surface["kind"];
  capabilities: SurfaceCapabilities;
  enumeration: EnumerationContract;

  discover(context: AdapterContext): Promise<Surface[]>;
  inventory(surface: Surface, context: AdapterContext): Promise<Artifact[]>;
  fingerprint(artifact: Artifact, context: AdapterContext): Promise<ArtifactFingerprint>;

  plan?(change: SurfaceChange, context: AdapterContext): Promise<SurfacePlan>;
  apply?(plan: SurfacePlan, context: AdapterContext): Promise<SurfaceApplyResult>;
  validate?(plan: SurfacePlan, context: AdapterContext): Promise<ValidationResult[]>;
}
