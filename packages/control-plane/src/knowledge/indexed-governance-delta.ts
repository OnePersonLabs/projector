import { canonicalJson, hashFramedDomain, manifestKey, updateManifest, type ContentHash, type ManifestUpdate, type ProjectionUnit } from "@projector/core";
import { governancePopulationEntry, lensMembershipFingerprint, summarizeGovernanceManifest, type GovernanceObservation, type GovernancePopulationSummary, type ProjectionLensCompilation } from "@projector/engine";
import type { IndexedObservationDelta } from "@projector/runtime";
import { captureDecisionTriggerObservations, type KnowledgeDecisionBaseline } from "./decision-baselines.js";
import type { IndexedGraphDeltaInput } from "./indexed-delta.js";
import type { KnowledgeGraph } from "./graph.js";
import { governanceManifestNodeKey } from "./indexed-governance.js";

type Row = NonNullable<IndexedObservationDelta["upserts"]>[number];
type Deletion = NonNullable<IndexedObservationDelta["deletes"]>[number];
type Subject = GovernanceObservation["subjects"][number];
type Applicability = ReturnType<KnowledgeGraph["decisionApplicabilityResult"]>;
type Membership = ReturnType<KnowledgeGraph["lensMembershipResult"]>;
const same = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);

/** Update complete registered populations with a complete affected source component.
 * Global canonical configuration is unchanged. A failed lens compilation requires a rebuild. */
export function updateIndexedGovernanceDelta(input: IndexedGraphDeltaInput & { readonly graph: KnowledgeGraph }): { readonly delta: IndexedObservationDelta; readonly compilation: ProjectionLensCompilation } | undefined {
  const { descriptor, store, changedObservation: observation, graph } = input;
  const generation = descriptor.generation;
  const read = <T>(kind: string, key: string): T | undefined => store.getAt<T>(generation,kind,key);
  const required = <T>(kind: string, key: string): T => {
    const value=read<T>(kind,key);
    if(value===undefined)throw new Error(`Indexed governance delta lacks ${kind}:${key}; rebuild the complete observation`);
    return value;
  };
  if (observation.canonical.rootDigest !== descriptor.metadata.canonicalRootDigest) throw new Error("Governance configuration changed; rebuild its populations");
  if (required<string|null>("governance-meta","lensCompilationUnknown") !== null || graph.lensCompilation === undefined) return undefined;
  const upserts: Row[] = [], deletes: Deletion[] = [];
  const put = (kind: string,key: string,value: unknown): void => { upserts.push({kind,key,value}); };
  const paths = new Set([...input.changedPaths,...observation.analysis.files.map(({path})=>path)]);
  const oldUnits = new Map<string,ProjectionUnit>();
  for(const path of paths) for(const id of store.populationAt(generation,`unit-path:${path}`)) oldUnits.set(id,required<ProjectionUnit>("unit",id));
  const newUnits = new Map(graph.units.map(unit=>[unit.id,unit]));
  const ids = [...new Set([...oldUnits.keys(),...newUnits.keys()])].sort();
  const oldSubjects = new Map([...oldUnits.keys()].map(id=>[id,required<Subject>("governance-subject",id)]));
  const governed = graph.governanceObservation();
  const newSubjects = new Map(governed.subjects.map(subject=>[subject.id,subject]));
  const oldMemberships = new Map([...oldUnits.keys()].map(id=>[id,required<Membership>("governance-lens-membership",id)]));
  const writeManifest = (kind: string,id: string,manifest: ManifestUpdate): void => {
    for(const[prefix,node]of manifest.nodes)put(kind,governanceManifestNodeKey(id,prefix),node);
    for(const prefix of manifest.removed)deletes.push({kind,key:governanceManifestNodeKey(id,prefix)});
  };
  const membershipFingerprints = {...graph.lensCompilation.membershipFingerprints};
  for(const lens of graph.lenses){
    const prior=required<{root:ContentHash;fingerprint:ContentHash}>("governance-lens-root",lens.id);
    const members=new Set(graph.lensCompilation.memberships[lens.id]??[]);
    const changes=ids.flatMap(id=>{
      const before=oldMemberships.get(id)?.results.some(member=>member.id===lens.id)??false;
      const after=members.has(id);
      return before===after?[]:[{key:manifestKey(id),...(after?{value:id}:{})}];
    });
    if(changes.length===0){membershipFingerprints[lens.id]=prior.fingerprint;continue;}
    const manifest=updateManifest(prior.root,changes,prefix=>read("governance-lens-manifest",governanceManifestNodeKey(lens.id,prefix)));
    membershipFingerprints[lens.id]=lensMembershipFingerprint(lens.id,manifest.root);
    writeManifest("governance-lens-manifest",lens.id,manifest);
    put("governance-lens-root",lens.id,{root:manifest.root,fingerprint:membershipFingerprints[lens.id]});
  }
  const selectors=new Map(graph.lenses.flatMap(lens=>lens.rules.flatMap(rule=>rule.predicates.flatMap(predicate=>predicate.kind==="cardinality"?[[hashFramedDomain("governance-selector",predicate.selector),predicate.selector] as const]:[]))));
  for(const[key,selector]of selectors){
    const prior=required<GovernancePopulationSummary>("governance-cardinality",key);
    const state=required<{root:ContentHash}>("governance-cardinality-state",key);
    let known=prior.knownCount,unknown=prior.unknownCount;
    const changes: Array<{key:string;value?:unknown}> = [];
    for(const id of ids){
      const before=oldSubjects.get(id),after=newUnits.has(id)?newSubjects.get(id):undefined;
      const old=before===undefined?undefined:governancePopulationEntry(selector,before);
      const next=after===undefined?undefined:governancePopulationEntry(selector,after);
      if(same(old??null,next??null))continue;
      if(old?.value.matched===true)known--;else if(old!==undefined)unknown--;
      if(next?.value.matched===true)known++;else if(next!==undefined)unknown++;
      changes.push({key:manifestKey(id),...(next===undefined?{}:{value:next.value})});
    }
    if(changes.length===0)continue;
    const manifest=updateManifest(state.root,changes,prefix=>read("governance-cardinality-manifest",governanceManifestNodeKey(key,prefix)));
    if(known<0||unknown<0)throw new Error("Indexed governance cardinality accounting is inconsistent");
    writeManifest("governance-cardinality-manifest",key,manifest);
    put("governance-cardinality",key,summarizeGovernanceManifest(manifest.root,known,unknown));
    put("governance-cardinality-state",key,{root:manifest.root,selector});
  }
  const outgoing=new Map<string,GovernanceObservation["dependencies"][number][]>();
  for(const edge of governed.dependencies){const values=outgoing.get(edge.fromUnitId)??[];values.push(edge);outgoing.set(edge.fromUnitId,values);}
  for(const subject of governed.subjects)put("governance-subject",subject.id,subject);
  for(const enumeration of governed.dependencyEnumerations)put("governance-enumeration",enumeration.unitId,enumeration);
  const failures=observation.analysis.failures.filter(({analyzerId})=>analyzerId==="projector.filesystem-local").map(({analyzerId,capability,scope})=>`${analyzerId}:${capability}:${scope}`).sort();
  const decisionsByUnit=new Map<string,Array<{id:string;semanticHash:ContentHash}>>();
  const oldDecisions=new Set<string>();
  for(const id of oldUnits.keys())for(const decision of required<{results:Array<{id:string}>}>("governance-decision-membership",id).results)oldDecisions.add(decision.id);
  const applicabilityByDecision=new Map<string,Applicability>();
  for(const decision of graph.decisions){
    const local=graph.decisionApplicabilityResult(decision.id);
    for(const member of local.results){const id=String(member.id),members=decisionsByUnit.get(id)??[];members.push({id:decision.id,semanticHash:decision.semanticHash});decisionsByUnit.set(id,members);}
    if(local.results.length===0&&!oldDecisions.has(decision.id))continue;
    const previous=required<Applicability>("governance-decision-applicability",decision.id);
    const results=[...previous.results.filter(member=>!oldUnits.has(String(member.id))),...local.results].sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
    if(!same(results,previous.results))applicabilityByDecision.set(decision.id,{...previous,results});
  }
  for(const[id,value]of applicabilityByDecision)put("governance-decision-applicability",id,value);
  for(const unit of graph.units){
    put("governance-outgoing",unit.id,outgoing.get(unit.id)??[]);
    const membership=graph.lensMembershipResult(unit.id);
    put("governance-lens-membership",unit.id,membership.observability==="unavailable"?membership:{...membership,results:membership.results.map(member=>({...member,membershipFingerprint:membershipFingerprints[member.id]}))});
    put("governance-decision-membership",unit.id,{results:decisionsByUnit.get(unit.id)??[],observability:observation.analysis.surface.enumeration.observability,assumptions:[],unavailableLanes:failures,dependencyKeys:["canonical-decisions","projection-unit-membership"]});
  }
  for(const id of oldUnits.keys())if(!newUnits.has(id))for(const kind of ["governance-subject","governance-outgoing","governance-enumeration","governance-lens-membership","governance-decision-membership"])deletes.push({kind,key:id});
  const nextPaths=new Set(observation.analysis.files.map(({path})=>path));
  const changedPaths=[...paths].filter(path=>(read("file",path)!==undefined)!==nextPaths.has(path));
  if(changedPaths.length>0)for(const decision of graph.decisions){
    const authority=graph.authorities.find(({id})=>id===decision.authorityRecordId);
    if(authority===undefined)continue;
    const prior=required<KnowledgeDecisionBaseline["observations"]>("governance-decision-observations",decision.id);
    const local=captureDecisionTriggerObservations(decision,authority,observation.canonical.documents,[...nextPaths],observation.analysis.surface.kind);
    const updated=local.map(item=>{
      const value=item.value as {paths?:unknown};
      if(!Array.isArray(value.paths))return item;
      const previous=prior.find(({key})=>key===item.key)?.value as {paths?:unknown}|undefined;
      if(!Array.isArray(previous?.paths))throw new Error(`Decision ${decision.id} lacks its completed scope population`);
      return {...item,value:{paths:[...new Set([...previous.paths.filter((path):path is string=>typeof path==="string"&&!paths.has(path)),...value.paths])].sort()}};
    });
    if(!same(prior,updated))put("governance-decision-observations",decision.id,updated);
  }
  return {delta:{upserts,deletes},compilation:{...graph.lensCompilation,membershipFingerprints}};
}
