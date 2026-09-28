import { buildManifest, manifestKey, canonicalJson, hashFramedDomain, type AdapterContext, type ArchitectureDecision, type AuthorityRecord, type CanonicalDocumentEnvelope, type ContentHash, type DerivedObservationBudget, type ProjectionLens, type ProjectionUnit, type SelectorExpr, type StateQueryDependency } from "@projector/core";
import { buildGovernancePopulation, compileEffectiveRuleBundle, lensMembershipFingerprint, prepareIndexedGovernanceEvaluator, type ExternalGovernanceValidatorFinding, type GovernanceBundleEvaluation, type GovernanceObservation, type GovernanceObservationReader, type GovernancePopulationSummary, type ProjectionUnitSelectorFacts, type QueryDependencyRegistry } from "@projector/engine";
import type { IndexedObservationDelta, SqliteObservationStore } from "@projector/runtime";
import type { IndexedObservationDescriptor } from "../observation/indexed-types.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { captureDecisionTriggerObservations, DecisionBaselineReader, type KnowledgeDecisionBaseline } from "./decision-baselines.js";
import { KnowledgeDecisionRun, type KnowledgeDecisionHost } from "./governance.js";
import { KNOWLEDGE_QUERY_PROGRAMS, type KnowledgeGraph } from "./graph.js";
import type { IndexedGovernancePort } from "./indexed-graph.js";
import { compileKnowledgeLensObligation } from "./lens-obligations.js";
import type { KnowledgeLensObligation } from "./types.js";
import type { KnowledgeValidatorRequest } from "./validators.js";

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const selectorKey = (selector: SelectorExpr): ContentHash => hashFramedDomain("governance-selector", selector);
export const governanceManifestNodeKey = (id: string, prefix: string): string => canonicalJson([id, prefix]);
type Row = NonNullable<IndexedObservationDelta["upserts"]>[number];
type LensMembership = ReturnType<KnowledgeGraph["lensMembershipResult"]>;
type DecisionApplicability = ReturnType<KnowledgeGraph["decisionApplicabilityResult"]>;

/** Enroll only from a complete ordinary observation. The delta producer must update these same records. */
export function enrollIndexedGovernance(observation: RepositoryObservationData, graph: KnowledgeGraph): IndexedObservationDelta {
  const upserts: Row[] = [];
  const put = (kind: string, key: string, value: unknown): void => { upserts.push({ kind, key, value }); };
  const governed = graph.governanceObservation();
  const subjects = new Map(governed.subjects.map(subject => [subject.id, subject]));
  for (const subject of governed.subjects) put("governance-subject", subject.id, subject);
  const outgoing = new Map<string, GovernanceObservation["dependencies"][number][]>();
  for (const edge of governed.dependencies) { const values = outgoing.get(edge.fromUnitId) ?? []; values.push(edge); outgoing.set(edge.fromUnitId, values); }
  for (const enumeration of governed.dependencyEnumerations) put("governance-enumeration", enumeration.unitId, enumeration);
  const decisionsByUnit = new Map<string, Array<{ id: string; semanticHash: ContentHash }>>();
  for (const decision of graph.decisions) {
    put("governance-decision-applicability", decision.id, graph.decisionApplicabilityResult(decision.id));
    for (const binding of graph.implementationBindings(decision.id)) {
      const id = String(binding.id), members = decisionsByUnit.get(id) ?? [];
      members.push({ id: decision.id, semanticHash: decision.semanticHash }); decisionsByUnit.set(id, members);
    }
    const authority = graph.authorities.find(({ id }) => id === decision.authorityRecordId);
    if (authority !== undefined) put("governance-decision-observations", decision.id, captureDecisionTriggerObservations(decision, authority, observation.canonical.documents, observation.analysis.files.map(({path}) => path), observation.analysis.surface.kind));
  }
  const selectors = new Map<ContentHash, SelectorExpr>();
  for (const lens of graph.lenses) {
    for (const predicate of lens.rules.flatMap(({predicates}) => predicates)) if (predicate.kind === "cardinality") selectors.set(selectorKey(predicate.selector), predicate.selector);
    if (graph.lensCompilation !== undefined) {
      const manifest = buildManifest((graph.lensCompilation.memberships[lens.id] ?? []).map(id => ({ key: manifestKey(id), value: id })));
      put("governance-lens-root", lens.id, { root: manifest.root, fingerprint: lensMembershipFingerprint(lens.id, manifest.root) });
      for (const [prefix,node] of manifest.nodes) put("governance-lens-manifest", governanceManifestNodeKey(lens.id,prefix),node);
    }
  }
  const units = governed.unitIds.map(id => subjects.get(id)!);
  for (const [key, selector] of selectors) {
    const { summary, manifest } = buildGovernancePopulation(selector, units);
    put("governance-cardinality", key, summary);
    put("governance-cardinality-state", key, { root:manifest.root,selector });
    for (const [prefix,node] of manifest.nodes) put("governance-cardinality-manifest", governanceManifestNodeKey(key,prefix),node);
  }
  const failures = observation.analysis.failures.filter(({analyzerId}) => analyzerId === "projector.filesystem-local").map(({analyzerId,capability,scope}) => `${analyzerId}:${capability}:${scope}`).sort();
  for (const unit of graph.units) {
    put("governance-outgoing", unit.id, outgoing.get(unit.id) ?? []);
    put("governance-lens-membership", unit.id, graph.lensMembershipResult(unit.id));
    put("governance-decision-membership", unit.id, { results: decisionsByUnit.get(unit.id) ?? [], observability: observation.analysis.surface.enumeration.observability, assumptions: [], unavailableLanes: failures, dependencyKeys: ["canonical-decisions", "projection-unit-membership"] });
  }
  put("governance-meta", "lensCompilationUnknown", graph.lensCompilationUnknown ?? null);
  put("population-version", "governance", hashFramedDomain("indexed-governance/v2", {canonical:observation.canonical.rootDigest,worktree:observation.state.worktreeDigest}));
  return { upserts };
}

/** Uses the same rule and decision evaluators as KnowledgeGraph, with addressed inputs. */
export class IndexedGovernance implements IndexedGovernancePort {
  readonly lensCompilationUnknown: string | undefined;
  readonly decisionRun: KnowledgeDecisionRun;
  private readonly reader: GovernanceObservationReader;
  constructor(readonly descriptor: IndexedObservationDescriptor, readonly store: SqliteObservationStore, readonly registry: QueryDependencyRegistry, host: KnowledgeDecisionHost, readonly derivedBudget: DerivedObservationBudget) {
    this.required("population-version", "governance");
    this.lensCompilationUnknown = this.required<string | null>("governance-meta", "lensCompilationUnknown") ?? undefined;
    this.reader = {
      unitEnumeration: descriptor.metadata.analysisHeader.surface.enumeration,
      subject: id => this.row<GovernanceObservation["subjects"][number]>("governance-subject", id),
      outgoing: id => this.required<GovernanceObservation["dependencies"]>("governance-outgoing", id),
      enumeration: id => this.row<GovernanceObservation["dependencyEnumerations"][number]>("governance-enumeration", id),
      cardinality: selector => this.row<GovernancePopulationSummary>("governance-cardinality", selectorKey(selector)),
    };
    const baseline = new DecisionBaselineReader({ repositoryRoot: descriptor.repositoryRoot, readDocument: id => this.row<CanonicalDocumentEnvelope>("canonical", id) });
    this.decisionRun = new KnowledgeDecisionRun({
      authority: decision => this.canonical<AuthorityRecord>(decision.authorityRecordId, "authority-record"),
      observations: decision => this.required<KnowledgeDecisionBaseline["observations"]>("governance-decision-observations", decision.id),
      baseline: (decision, authority) => baseline.read(decision, authority),
    }, host);
    this.registerPrograms();
  }
  private row<T>(kind: string, key: string): T | undefined { return this.store.getAt<T>(this.descriptor.generation, kind, key); }
  private required<T>(kind: string, key: string): T {
    const value = this.row<T>(kind,key);
    if (value === undefined) throw new Error(`Indexed governance record ${kind}:${key} is missing; rebuild the complete observation`);
    return value;
  }
  private canonical<T>(id: string, kind: string): T | undefined {
    const document = this.row<CanonicalDocumentEnvelope>("canonical",id);
    return document?.kind === kind ? document.payload as T : undefined;
  }
  private facts(unitId: string): ProjectionUnitSelectorFacts {
    const values = this.reader.subject(unitId)?.values;
    if (values === undefined) throw new Error(`Indexed governance subject ${unitId} is missing`);
    return { ...(typeof values.path === "string" ? {path:values.path}:{}), ...(typeof values.surface === "string" ? {surface:values.surface}:{}), ...(typeof values.package === "string" ? {package:values.package}:{}), ...(typeof values["package-kind"] === "string" ? {packageKind:values["package-kind"]}:{} ) };
  }
  lensObligations(entityIds: ReadonlySet<string>, operation: string): KnowledgeLensObligation[] {
    if (this.lensCompilationUnknown !== undefined) return [];
    const result: KnowledgeLensObligation[] = [];
    for (const id of entityIds) {
      const unit = this.row<ProjectionUnit>("unit", id);
      if (unit === undefined) continue;
      const membership = this.currentLensMembership(id);
      for (const member of membership.results) {
        if (!entityIds.has(member.id)) continue;
        const lens = this.canonical<ProjectionLens>(member.id,"projection-lens");
        if (lens === undefined) throw new Error(`Indexed lens membership references missing lens ${member.id}`);
        this.derivedBudget.reserve(1024 + 2 * (unit.id.length + canonicalJson({ rules:lens.rules,validators:lens.validators,expectedProjections:lens.expectedProjections }).length),"lens-obligation",lens.id);
        result.push(compileKnowledgeLensObligation(lens, unit, member.membershipFingerprint as ContentHash, this.facts(unit.id), operation));
      }
    }
    return result.sort((a,b) => `${a.lensId}\0${a.unitId}` < `${b.lensId}\0${b.unitId}` ? -1 : `${a.lensId}\0${a.unitId}` > `${b.lensId}\0${b.unitId}` ? 1 : 0);
  }
  validatorRequests(entityIds: ReadonlySet<string>, operation: string): KnowledgeValidatorRequest[] {
    const before = this.derivedBudget.usedBytes, obligations = this.lensObligations(entityIds,operation), reserved = this.derivedBudget.usedBytes-before;
    try {
      return obligations.flatMap(obligation => {
        const lens = this.canonical<ProjectionLens>(obligation.lensId,"projection-lens")!;
        return lens.validators.filter(binding => !(binding.provider === "deterministic-governance" && binding.id === "projector.builtin.static-dependency-boundary" && binding.version === "1") && (binding.required || obligation.validatorIds.includes(`${binding.id}@${binding.version}`))).map(binding => {
          const unitPath = this.facts(obligation.unitId).path ?? "";
          this.derivedBudget.reserve(256+2*(canonicalJson(binding).length+obligation.unitId.length+unitPath.length),"validator-request",obligation.lensId);
          return {binding,unitId:obligation.unitId,unitPath};
        });
      });
    } finally { this.derivedBudget.release(reserved); }
  }
  relevantDecisions(entityIds: ReadonlySet<string>): ArchitectureDecision[] {
    const ids = new Set(entityIds);
    for (const id of entityIds) {
      const lens = this.canonical<ProjectionLens>(id,"projection-lens");
      if (lens !== undefined) for (const basis of [...lens.governanceBasis,...lens.rules.flatMap(({governanceBasis}) => governanceBasis)]) if (basis.kind === "architecture-decision") ids.add(basis.decisionId);
    }
    return [...ids].sort().flatMap(id => { const decision=this.canonical<ArchitectureDecision>(id,"architecture-decision"); return decision===undefined ? []:[decision]; });
  }
  bindDecisionApplicability(decisionId: string, context: AdapterContext): Promise<StateQueryDependency> { return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability,`knowledge-decision-applicability:${decisionId}`,{decisionId},"decision-applicability",context); }
  bindDecisionTriggers(decisionId: string, operation: string, context: AdapterContext): Promise<StateQueryDependency> { return this.dependency(KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers,`knowledge-decision-triggers:${decisionId}`,{decisionId,operation},"decision-trigger-observations",context); }
  private async dependency(programId: string,id: string,input: Record<string,unknown>,role:string,context:AdapterContext): Promise<StateQueryDependency> {
    const query=this.registry.createSpec({id,programId,input}); return {query,priorResult:await this.registry.evaluate(query,context),role};
  }
  governanceEvaluations(entityIds: ReadonlySet<string>,operation:string,validatorFindings: readonly ExternalGovernanceValidatorFinding[]=[]): GovernanceBundleEvaluation[] {
    const evaluate=prepareIndexedGovernanceEvaluator(this.reader,validatorFindings);
    const before=this.derivedBudget.usedBytes,obligations=this.lensObligations(entityIds,operation),reserved=this.derivedBudget.usedBytes-before;
    try {
      return obligations.map(obligation => {
        const lens=this.canonical<ProjectionLens>(obligation.lensId,"projection-lens")!, unit=this.row<ProjectionUnit>("unit",obligation.unitId)!;
        this.derivedBudget.reserve(1024+2*canonicalJson({rules:lens.rules,validators:lens.validators,expectedProjections:lens.expectedProjections}).length,"governance-evaluation",lens.id);
        const bundle=compileEffectiveRuleBundle({unit,operation,rules:lens.rules,selectorFacts:{...this.facts(unit.id),operation}});
        return {lensId:lens.id,evaluation:evaluate(bundle,{requiredValidatorIds:unique([...lens.validators.filter(({required})=>required).map(({id,version})=>`${id}@${version}`),...obligation.validatorIds])})};
      }).sort((a,b)=>a.evaluation.unitId<b.evaluation.unitId?-1:a.evaluation.unitId>b.evaluation.unitId?1:a.evaluation.contentHash<b.evaluation.contentHash?-1:a.evaluation.contentHash>b.evaluation.contentHash?1:0).map(({evaluation})=>evaluation);
    } finally { this.derivedBudget.release(reserved); }
  }
  private currentLensMembership(unitId: string): LensMembership {      const value=this.row<LensMembership>("governance-lens-membership",unitId);
      if(value?.observability === "unavailable") return value;
      if(value!==undefined)return { ...value, results: value.results.map(member => ({ ...member, membershipFingerprint: this.required<{fingerprint:ContentHash}>("governance-lens-root",member.id).fingerprint })) };
      if(this.row("population-version","unit")===undefined||this.row("unit",unitId)!==undefined)throw new Error(`Indexed lens membership ${unitId} is missing; rebuild the complete observation`);
      return this.lensCompilationUnknown===undefined?{results:[],observability:"bounded",assumptions:this.descriptor.metadata.analysisHeader.surface.enumeration.assumptions,unavailableLanes:[],dependencyKeys:["canonical-lenses","canonical-authorities","projection-unit-membership",`projection-unit:${unitId}`]}:{results:[],observability:"unavailable",assumptions:[],unavailableLanes:[this.lensCompilationUnknown],dependencyKeys:["canonical-lenses","canonical-authorities",`projection-unit:${unitId}`]};

  }

  private registerPrograms(): void {
    const failures = (): string[] => this.required<Array<{analyzerId:string;capability:string;scope:string}>>("knowledge-global","failures").filter(({analyzerId})=>analyzerId==="projector.filesystem-local").map(({analyzerId,capability,scope})=>`${analyzerId}:${capability}:${scope}`).sort();
    this.registry.register({id:KNOWLEDGE_QUERY_PROGRAMS.lensMembership,version:"2",kind:"selector-membership",normalizeInput:input=>({unitId:String(input.unitId??"")}),evaluate:({input})=>this.currentLensMembership(String(input.unitId))});
    this.registry.register({id:KNOWLEDGE_QUERY_PROGRAMS.decisionMembership,version:"1",kind:"selector-membership",normalizeInput:input=>({unitId:String(input.unitId)}),evaluate:({input})=>{
      const unitId=String(input.unitId),value=this.row<{results:Array<{id:string;semanticHash:ContentHash}>;observability:"closed"|"bounded"|"open"|"sampled"|"unavailable";assumptions:string[];unavailableLanes:string[];dependencyKeys:string[]}>("governance-decision-membership",unitId);
      if(value!==undefined)return value;
      if(this.row("population-version","unit")===undefined||this.row("unit",unitId)!==undefined)throw new Error(`Indexed decision membership ${unitId} is missing; rebuild the complete observation`);
      return {results:[],observability:this.descriptor.metadata.analysisHeader.surface.enumeration.observability,assumptions:[],unavailableLanes:failures(),dependencyKeys:["canonical-decisions","projection-unit-membership"]};
    }});
    this.registry.register({id:KNOWLEDGE_QUERY_PROGRAMS.decisionApplicability,version:"1",kind:"decision-applicability",normalizeInput:input=>({decisionId:String(input.decisionId)}),evaluate:({input})=>{
      const id=String(input.decisionId),value=this.row<DecisionApplicability>("governance-decision-applicability",id);
      if(value!==undefined)return value;
      if(this.row("population-version","canonical")===undefined||this.canonical<ArchitectureDecision>(id,"architecture-decision")!==undefined)throw new Error(`Indexed decision applicability ${id} is missing; rebuild the complete observation`);
      return {results:this.row<Array<Record<string,unknown>>>("knowledge-bindings",id)??[],observability:"unavailable",assumptions:[...this.descriptor.metadata.analysisHeader.surface.enumeration.assumptions,"Applicability is closed over the repository inventory's declared file boundary, not runtime-created or external units."],unavailableLanes:[...failures(),"decision selector requires facts outside the supported repository applicability observer",...(this.descriptor.metadata.analysisHeader.surface.access==="unavailable"?["repository inventory unavailable"]:[])],dependencyKeys:["canonical-decisions","projection-unit-membership"]};
    }});
    this.registry.register({id:KNOWLEDGE_QUERY_PROGRAMS.decisionTriggers,version:"1",kind:"custom",normalizeInput:input=>({decisionId:String(input.decisionId),operation:String(input.operation)}),evaluate:async({input})=>{
      const decision=this.canonical<ArchitectureDecision>(String(input.decisionId),"architecture-decision");
      if(decision===undefined)return {results:[],observability:"unavailable",assumptions:[],unavailableLanes:["decision missing"],dependencyKeys:["canonical-decisions"]};
      const observed=await this.decisionRun.observe(decision,String(input.operation));
      return {results:[{id:decision.id,baseline:observed.baseline,checks:observed.checks,observations:observed.observations}],observability:"closed",assumptions:observed.checks.filter(({status})=>status==="unobserved").map(({reason})=>reason),unavailableLanes:[...observed.unknowns],dependencyKeys:["canonical-decisions","canonical-authorities","decision-trigger-observations"]};
    }});
  }
}
