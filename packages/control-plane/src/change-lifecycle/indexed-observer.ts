import { resolve } from "node:path";
import { lstat } from "node:fs/promises";
import { collectGitPathIdentities, parseGitStatus, localImportCandidates, syntaxProgramVersion, localRepositoryAdapterVersion, localSemanticKey, readInventoryEntry, readObservationFile, collectLocalRepositoryInputs, observationGit, type LocalRepositoryAnalysis, type InventoryEntry, type CollectedLocalRepositoryInputs, type GitIdentityFact, type ModuleDependencyFact, type TestTargetFact } from "@projector/analyzers";
import { buildManifest, updateManifest, manifestKey, hashFramedDomain, ObservationError, type ContentHash } from "@projector/core";
import { RepositoryPathService, checkoutCacheLocation, collectCanonicalSnapshotSources, SqliteObservationStore, withObservationScope, type IndexedObservationDelta, type ObservationScope } from "@projector/runtime";
import { runObservationTask } from "../observation/task-runner.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { INDEXED_OBSERVATION_CONTRACT, type IndexedObservationDescriptor, type IndexedObservationEnrollment, type IndexedObservationMetadata, type IndexedRepositoryObservation } from "../observation/indexed-types.js";
import { enrollWatchman, observeWatchmanChanges, verifyWatchmanChanges, filterSourceWatchmanEvents, type WatchmanBaseline } from "./watchman-observation.js";
import { KnowledgeGraph } from "../knowledge/graph.js";
import { buildRepositoryImpactSnapshot } from "../impact/service.js";
import { enrollIndexedGraph } from "../knowledge/indexed-enrollment.js";
import { enrollIndexedGraphDelta } from "../knowledge/indexed-delta.js";
import { updateIndexedGovernanceDelta } from "../knowledge/indexed-governance-delta.js";
import { governanceManifestNodeKey } from "../knowledge/indexed-governance.js";
import { safeRealizationCandidateIds } from "../knowledge/indexed-selector-incidence.js";
import { reverseDerivationManifestKey } from "../knowledge/indexed-derivations.js";
import { realizeChangeRepositoryData } from "./repository-observer.js";

const exclusions=[".git",".worktrees",".projector/runtime"] as const;
const observerPrograms=`projector.local-repository@${localRepositoryAdapterVersion}/indexed-producer@2/query-registry@3/governance-merkle@2/knowledge-lexical@1/realization-incidence@1/git-full-identity@1/git-leaf-proof@1/reverse-derivation-manifest@1/directory-population@1/${syntaxProgramVersion}`;
type StoreRow={kind:string;key:string;value:unknown};
type Population={selector:string;member:string;present:boolean};
function merge(...deltas:readonly IndexedObservationDelta[]):IndexedObservationDelta{
  return{upserts:deltas.flatMap(delta=>delta.upserts??[]),deletes:deltas.flatMap(delta=>delta.deletes??[]),populations:deltas.flatMap(delta=>delta.populations??[]),dependencies:deltas.flatMap(delta=>delta.dependencies??[])};
}
function recordPopulation(rows:StoreRow[],populations:Population[],kind:string,items:readonly unknown[],key:(item:unknown)=>string):void{
  for(const item of items){const id=key(item);rows.push({kind,key:id,value:item});populations.push({selector:kind,member:id,present:true});}
  rows.push({kind:"population-version",key:kind,value:hashFramedDomain("indexed-population-v1",items.map(key))});
}
function sourceRecords(data:RepositoryObservationData,inventory:readonly InventoryEntry[]):IndexedObservationDelta{
  const rows:StoreRow[]=[],populations:Population[]=[];
  const path=(item:unknown):string=>(item as {path:string}).path;
  const id=(item:unknown):string=>(item as {id:string}).id;
  recordPopulation(rows,populations,"inventory",inventory,path);
  recordPopulation(rows,populations,"file",data.analysis.files,path);
  recordPopulation(rows,populations,"artifact",data.analysis.artifacts,id);
  recordPopulation(rows,populations,"unit",data.analysis.projectionUnits,id);
  recordPopulation(rows,populations,"js",data.analysis.javaScript.files,path);
  recordPopulation(rows,populations,"git-identity",data.analysis.gitIdentities,path);
  recordPopulation(rows,populations,"git-full-identity",data.analysis.git.identities,path);
  recordPopulation(rows,populations,"canonical",data.canonical.documents,id);
  recordPopulation(rows,populations,"document",data.analysis.documents,path);
  recordPopulation(rows,populations,"markdown",data.analysis.markdown,path);
  recordPopulation(rows,populations,"actions",data.analysis.actions,path);
  const group=(kind:string,items:readonly unknown[],getKey:(item:unknown)=>string):void=>{
    const groups=new Map<string,unknown[]>();for(const item of items){const key=getKey(item);const existing=groups.get(key)??[];existing.push(item);groups.set(key,existing);}
    recordPopulation(rows,populations,kind,[...groups].map(([key,value])=>({key,value})),item=>(item as {key:string}).key);
    for(const row of rows.filter(row=>row.kind===kind))row.value=(row.value as {value:unknown}).value;
  };
  group("dependency",data.analysis.dependencies,item=>(item as {importerPath:string}).importerPath);
  group("test-target",data.analysis.testTargets,item=>(item as {testPath:string}).testPath);
  group("realization",data.realizations,item=>(item as {entityId:string}).entityId);
  const unitsByArtifact=new Map<string,typeof data.analysis.projectionUnits>();
  for(const unit of data.analysis.projectionUnits){const existing=unitsByArtifact.get(unit.artifactId)??[];unitsByArtifact.set(unit.artifactId,[...existing,unit]);}
  const entriesByPath=new Map(inventory.map(entry=>[entry.path,entry]));
  const jsByPath=new Map(data.analysis.javaScript.files.map(file=>[file.path,file]));
  for(const file of data.analysis.files){
    const units=unitsByArtifact.get(file.artifactId)??[];
    for(const unit of units)populations.push({selector:`unit-path:${file.path}`,member:unit.id,present:true});
    rows.push({kind:"population-version",key:`unit-path:${file.path}`,value:hashFramedDomain("indexed-path-units-v1",units)});
    const entry=entriesByPath.get(file.path);if(entry!==undefined){
      const key=localSemanticKey(entry,jsByPath.get(file.path),file.semanticRole);
      rows.push({kind:"semantic-key",key:file.path,value:key});populations.push({selector:`semantic-key:${key}`,member:file.path,present:true});
    }
  }
  for(const [key,value] of Object.entries(data.analysis))if(!["files","artifacts","projectionUnits","gitIdentities","dependencies","testTargets","javaScript"].includes(key))rows.push({kind:"analysis-global",key,value});
  for(const [key,value] of Object.entries(data.analysis.javaScript))if(!["files","dependencies","testTargets"].includes(key))rows.push({kind:"javascript-global",key,value});
  rows.push({kind:"canonical-manifest",key:"entries",value:data.canonical.entries});
  return{upserts:rows,populations,dependencies:[...data.analysis.dependencies.flatMap(item=>localImportCandidates(item.importerPath,item.specifier).map(path=>({consumer:item.importerPath,input:`path:${path}`,present:true}))),...data.analysis.packageScriptInvocations.map(item=>({consumer:item.manifestPath,input:`path:${item.targetPath}`,present:true}))]};
}
function materialize(store:SqliteObservationStore,descriptor:IndexedObservationDescriptor):RepositoryObservationData{
  return store.readGeneration(descriptor.generation,()=>{
    const list=<T>(kind:string):T[]=>store.population(kind).map(key=>{const value=store.get<T>(kind,key);if(value===undefined)throw new Error(`Indexed observation record missing: ${kind}:${key}`);return value;});
    const grouped=<T>(kind:string):T[]=>list<readonly T[]>(kind).flatMap(value=>value);
    const analysis={} as Record<string,unknown>;
    for(const key of ["observationDescriptor","surface","capabilities","git","gitMoves","packageScriptInvocations","topology","divergences","failures"])analysis[key]=store.get("analysis-global",key);
    const javaScript={} as Record<string,unknown>;
    for(const key of ["events","eventUncertainties","contracts","failures"])javaScript[key]=store.get("javascript-global",key);
    javaScript.files=list("js");javaScript.dependencies=grouped("dependency");javaScript.testTargets=grouped("test-target");
    analysis.files=list("file");analysis.artifacts=list<LocalRepositoryAnalysis["artifacts"][number]>("artifact").map(artifact=>({...artifact,observationRevision:descriptor.metadata.analysisHeader.git.revision})).sort((a,b)=>a.locator.localeCompare(b.locator));analysis.projectionUnits=list("unit");analysis.gitIdentities=list("git-identity");analysis.dependencies=javaScript.dependencies;analysis.testTargets=javaScript.testTargets;analysis.javaScript=javaScript;
    analysis.git={...(analysis.git as LocalRepositoryAnalysis["git"]),revision:descriptor.metadata.analysisHeader.git.revision,identities:list("git-full-identity")};
    const artifactPaths=new Map((analysis.artifacts as LocalRepositoryAnalysis["artifacts"]).map(artifact=>[artifact.id,artifact.locator]));
    analysis.projectionUnits=(analysis.projectionUnits as LocalRepositoryAnalysis["projectionUnits"]).sort((a,b)=>(artifactPaths.get(a.artifactId)??"").localeCompare(artifactPaths.get(b.artifactId)??""));
    analysis.documents=list("document");analysis.markdown=list("markdown");analysis.actions=list("actions");
    return{repositoryRoot:descriptor.repositoryRoot,analysis:analysis as unknown as LocalRepositoryAnalysis,canonical:{documents:list("canonical"),entries:store.get("canonical-manifest","entries")!,rootDigest:descriptor.metadata.canonicalRootDigest},realizations:grouped("realization"),state:descriptor.metadata.state};
  });
}
function handle(store:SqliteObservationStore,metadata:IndexedObservationMetadata,generation:number,mode:IndexedRepositoryObservation["mode"],changedPaths:readonly string[]):IndexedRepositoryObservation{
  const descriptor:IndexedObservationDescriptor={schemaVersion:INDEXED_OBSERVATION_CONTRACT,repositoryRoot:metadata.repositoryRoot,checkoutId:metadata.checkoutId,generation,contractHash:metadata.contractHash,metadata};
  return{descriptor,store,mode,changedPaths,materialize:()=>materialize(store,descriptor),close:()=>store.close()};
}
async function gitDirectories(root:string,budget:Parameters<typeof observationGit>[2],signal:AbortSignal):Promise<string[]>{
  const output=await observationGit(root,["rev-parse","--absolute-git-dir","--git-common-dir"],budget,{signal,stage:"indexed-git-directory"});
  const directories=[...new Set(output.trim().split("\n").map(path=>resolve(root,path)))];
  if(directories.length===0)throw new Error("Git did not provide its checkout metadata directories");
  return directories;
}
async function stagedPaths(root:string,scope:ObservationScope):Promise<string[]>{return(await observationGit(root,["diff","--cached","--no-ext-diff","--no-renames","--name-only","-z"],scope.budget,{signal:scope.signal,stage:"indexed-git-stage-delta"})).split("\0").filter(Boolean);}
function contract(metadata:Pick<IndexedObservationMetadata,"inventoryDescriptor"|"analysisHeader">):ContentHash{
  const {limits:_limits,...descriptor}=metadata.inventoryDescriptor;
  return hashFramedDomain("indexed-observation-contract-v1",{schema:INDEXED_OBSERVATION_CONTRACT,programs:observerPrograms,descriptor,capabilities:metadata.analysisHeader.capabilities});
}
function validMetadata(value:unknown):value is IndexedObservationMetadata{
  if(value===null||typeof value!=="object")return false;
  const metadata=value as Partial<IndexedObservationMetadata>;
  return metadata.schemaVersion===INDEXED_OBSERVATION_CONTRACT&&typeof metadata.checkoutId==="string"&&typeof metadata.repositoryRoot==="string"&&metadata.state!==undefined&&metadata.inventoryDescriptor!==undefined&&metadata.analysisHeader!==undefined&&Array.isArray(metadata.gitWatchmen)&&Array.isArray(metadata.gitDirectories)&&metadata.counts!==undefined;
}
async function effectiveBoundaryUnchanged(root:string,metadata:IndexedObservationMetadata,scope:ObservationScope):Promise<boolean>{
  const effective=metadata.inventoryDescriptor.ignoreSources.find(source=>source.path==="git:effective-config");
  if(effective===undefined)return false;
  const config=await observationGit(root,["config","--show-origin","--null","--list"],scope.budget,{signal:scope.signal,stage:"indexed-ignore-boundary"});
  if(hashFramedDomain("repository-ignore-source",config)!==effective.contentHash)return false;
  for(const source of metadata.inventoryDescriptor.ignoreSources)if(source.path.startsWith("git:core.excludesFile:")){
    const path=resolve(root,source.path.slice("git:core.excludesFile:".length));let stat;
    try{stat=await lstat(path);}catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="ENOENT")return false;throw error;}
    if(!stat.isFile()||stat.isSymbolicLink())return false;
    const bytes=await readObservationFile(path,scope.budget,source.path,scope.signal);
    if(hashFramedDomain("repository-ignore-source",bytes.toString("base64"))!==source.contentHash)return false;
  }
  return true;
}

/** A static module component is expanded through exact resolved dependencies,
 * import-candidate absence dependencies and semantic identity collision sets.
 * Unsupported global syntax/configuration still takes the bounded rebuild path.
 */
type GitLeafSnapshot={readonly revision:string;readonly ancestryPreserved:boolean;readonly candidates:IndexedObservationMetadata["moveCandidates"]};
async function leafDelta(store:SqliteObservationStore,descriptor:IndexedObservationDescriptor,paths:readonly string[],scope:ObservationScope,enrollment:IndexedObservationEnrollment|undefined,gitSnapshot?:GitLeafSnapshot):Promise<{metadata:IndexedObservationMetadata;delta:IndexedObservationDelta;paths:readonly string[]}|undefined>{
  const metadata=descriptor.metadata,root=descriptor.repositoryRoot,generation=descriptor.generation;
  if(!metadata.incrementalSupport.globalSyntax||paths.some(path=>path.startsWith(".projector/")||/(?:^|\/)(?:\.gitignore|\.gitattributes|\.watchmanconfig)$/u.test(path)||path.endsWith("package.json")||/(?:^|\/)(?:tsconfig[^/]*\.json|[^/]*config\.[^/]+|[^/]*lock[^/]*)$/u.test(path)))return undefined;
  const changed=new Map<string,InventoryEntry|undefined>();
  for(const path of paths){const parts=path.split("/");for(let depth=1;depth<parts.length;depth++)if(!store.has("inventory-directory",parts.slice(0,depth).join("/")))return undefined;}
  const currentIdentities=new Map<string,GitIdentityFact>();
  const initialPaths=paths.filter(path=>gitSnapshot!==undefined||!store.has("inventory",path));
  const knownInitial=new Map(initialPaths.map(path=>[path,store.getAt<GitIdentityFact>(generation,"git-full-identity",path)]).filter((item):item is [string,GitIdentityFact]=>item[1]!==undefined));
  for(const identity of await collectGitPathIdentities(root,initialPaths,gitSnapshot?.revision??metadata.analysisHeader.git.revision,knownInitial,{budget:scope.budget,signal:scope.signal,ancestryPreserved:gitSnapshot?.ancestryPreserved??true}))currentIdentities.set(identity.path,identity);
  const candidates=paths.filter(path=>(currentIdentities.get(path)??store.getAt<GitIdentityFact>(generation,"git-identity",path))?.tracked!==true);
  const ignored=candidates.length===0?new Set<string>():new Set((await observationGit(root,["check-ignore","-z","--stdin"],scope.budget,{signal:scope.signal,input:candidates.map(path=>`${path}\0`).join(""),allowedExitCodes:[1]})).split("\0").filter(Boolean));
  for(const path of [...new Set(paths)]){
    if(ignored.has(path)){if(store.has("inventory",path))changed.set(path,undefined);continue;}
    changed.set(path,await readInventoryEntry(root,path,scope.budget,scope.signal));
  }
  const removedPaths=[...changed].filter(([,entry])=>entry===undefined).map(([path])=>path);
  const removedTracked=removedPaths.filter(path=>store.getAt<GitIdentityFact>(generation,"git-identity",path)?.tracked===true).length;
  const addedUntracked=[...changed].filter(([path,entry])=>entry!==undefined&&!store.has("inventory",path)).length;
  // A deleted/untracked candidate pair can change move identities outside the
  // static import component. Until that population is indexed, rebuild it.
  if(metadata.moveManifestRoot!==buildManifest([]).root||(metadata.moveCandidates.deleted>0&&addedUntracked>0)||(removedTracked>0&&(metadata.moveCandidates.untracked>0||addedUntracked>0)))return undefined;
  const affected=new Set(changed.keys());
  const expand=():void=>{
    const queue=[...affected];for(let index=0;index<queue.length;index++){
      scope.budget.check("indexed-component");scope.signal.throwIfAborted();const path=queue[index]!;
      const neighbours=[...store.dependentsAt(generation,`path:${path}`),...(store.getAt<ModuleDependencyFact[]>(generation,"dependency",path)??[]).flatMap(item=>item.resolvedPath===undefined?[]:[item.resolvedPath])];
      const key=store.getAt<string>(generation,"semantic-key",path);if(key!==undefined)neighbours.push(...store.populationAt(generation,`semantic-key:${key}`));
      for(const neighbour of neighbours)if(!affected.has(neighbour)){affected.add(neighbour);queue.push(neighbour);}
      if(affected.size>scope.limits.maxFiles)throw new ObservationError("observation-limit-exceeded","indexed-component",".","Affected component exceeds maxFiles","maxFiles",affected.size);
    }
  };
  expand();
  const refreshIdentities=async():Promise<void>=>{const pending=[...affected].filter(path=>!currentIdentities.has(path)&&(gitSnapshot!==undefined||!store.has("inventory",path)));const known=new Map(pending.map(path=>[path,store.getAt<GitIdentityFact>(generation,"git-identity",path)]).filter((item):item is [string,GitIdentityFact]=>item[1]!==undefined));for(const identity of await collectGitPathIdentities(root,pending,gitSnapshot?.revision??metadata.analysisHeader.git.revision,known,{budget:scope.budget,signal:scope.signal,ancestryPreserved:gitSnapshot?.ancestryPreserved??true}))currentIdentities.set(identity.path,identity);};
  await refreshIdentities();
  const collectedFor=():CollectedLocalRepositoryInputs=>{
    const entries=new Map<string,InventoryEntry>();
    for(const path of affected){const entry=changed.has(path)?changed.get(path):store.getAt<InventoryEntry>(generation,"inventory",path);if(entry!==undefined)entries.set(path,entry);
      const segments=path.split("/");for(let depth=0;depth<segments.length;depth++){const manifest=[...segments.slice(0,depth),"package.json"].join("/");const context=store.getAt<InventoryEntry>(generation,"inventory",manifest);if(context!==undefined)entries.set(manifest,context);}
    }
    const identities=[...entries.keys()].map(path=>currentIdentities.get(path)??store.getAt<GitIdentityFact>(generation,"git-identity",path)??{sourceClass:"derived" as const,path,tracked:false,availability:"available" as const,introductionHistory:"not-applicable" as const});
    return{options:{repositoryRoot:root},inventoryResult:{entries:[...entries.values()],failures:[],rootAvailability:"available",observationDescriptor:{...metadata.inventoryDescriptor,limits:scope.limits},enumeration:metadata.enumeration},gitFacts:{availability:"available",revision:gitSnapshot?.revision??metadata.analysisHeader.git.revision,identities,moves:[],failures:[]}};
  };
  let collected=collectedFor();let preliminary=await runObservationTask("analyze-incremental",{collected},scope);
  if(preliminary.javaScript.events.length>0||preliminary.javaScript.contracts.length>0||preliminary.javaScript.eventUncertainties.length>0)return undefined;
  const firstEntries=new Map(collected.inventoryResult.entries.map(entry=>[entry.path,entry])),firstJS=new Map(preliminary.javaScript.files.map(file=>[file.path,file]));
  let extended=false;
  for(const dependency of preliminary.dependencies){
    const target=localImportCandidates(dependency.importerPath,dependency.specifier).find(path=>changed.has(path)?changed.get(path)!==undefined:store.has("inventory",path));
    if(target!==undefined&&!affected.has(target)){affected.add(target);extended=true;}
  }
  for(const file of preliminary.files){if(!affected.has(file.path))continue;const key=localSemanticKey(firstEntries.get(file.path)!,firstJS.get(file.path),file.semanticRole);for(const collision of store.populationAt(generation,`semantic-key:${key}`))if(!affected.has(collision)){affected.add(collision);extended=true;}}
  if(extended){expand();await refreshIdentities();collected=collectedFor();preliminary=await runObservationTask("analyze-incremental",{collected},scope);}
  const entriesByPath=new Map(collected.inventoryResult.entries.map(entry=>[entry.path,entry])),jsByPath=new Map(preliminary.javaScript.files.map(file=>[file.path,file]));
  const counts:Record<string,number>={};const baseKeys=new Map<string,string>();
  for(const file of preliminary.files){const key=localSemanticKey(entriesByPath.get(file.path)!,jsByPath.get(file.path),file.semanticRole);baseKeys.set(file.path,key);}
  for(const key of new Set(baseKeys.values())){
    const unchanged=store.populationAt(generation,`semantic-key:${key}`).filter(path=>!affected.has(path)&&!baseKeys.has(path)).length;
    counts[key]=unchanged+[...baseKeys.values()].filter(candidate=>candidate===key).length;
  }
  const targets:TestTargetFact[]=[...preliminary.testTargets];
  const raw=await runObservationTask("analyze-incremental",{collected,context:{javaScript:preliminary.javaScript,semanticKeyCounts:counts,testTargets:targets}},scope);
  if(raw.failures.length>0)return undefined;
  const artifactIds=new Set(raw.files.filter(file=>affected.has(file.path)).map(file=>file.artifactId));
  const filtered={...raw,files:raw.files.filter(file=>affected.has(file.path)),artifacts:raw.artifacts.filter(artifact=>artifactIds.has(artifact.id)),projectionUnits:raw.projectionUnits.filter(unit=>artifactIds.has(unit.artifactId)),gitIdentities:raw.gitIdentities.filter(identity=>affected.has(identity.path)),javaScript:{...raw.javaScript,files:raw.javaScript.files.filter(file=>affected.has(file.path))},documents:raw.documents.filter(file=>affected.has(file.path)),actions:raw.actions.filter(file=>affected.has(file.path)),markdown:raw.markdown.filter(file=>affected.has(file.path))};
  const realizationIds=safeRealizationCandidateIds({descriptor,store,analysis:filtered,changedPaths:[...affected]});
  const documents=[...new Set([...realizationIds,...["projection-lens","authority-record","architecture-decision","relation","architecture-concern","developer-preference"].flatMap(kind=>store.populationAt(generation,`canonical-kind:${kind}`))])].map(id=>store.getAt<RepositoryObservationData["canonical"]["documents"][number]>(generation,"canonical",id)!);
  const presentCanonical=new Set(documents.map(document=>document.id));
  for(const document of [...documents])for(const basis of (document.payload as {governanceBasis?:readonly {conceptId?:string}[]}).governanceBasis??[]){
    if(basis.conceptId===undefined||presentCanonical.has(basis.conceptId))continue;
    const referenced=store.getAt<RepositoryObservationData["canonical"]["documents"][number]>(generation,"canonical",basis.conceptId);
    if(referenced!==undefined){documents.push(referenced);presentCanonical.add(referenced.id);}
  }
  const partial=realizeChangeRepositoryData(root,filtered,{documents,entries:documents.map(document=>({entityId:document.id,canonicalDocumentHash:document.canonicalDocumentHash})),rootDigest:metadata.canonicalRootDigest});
  const source=sourceRecords(partial,[...changed.values()].filter((entry):entry is InventoryEntry=>entry!==undefined));
  const allowed=new Set(["inventory","file","artifact","unit","js","git-identity","git-full-identity","document","markdown","actions","dependency","test-target","semantic-key"]);
  const upserts=(source.upserts??[]).filter(row=>allowed.has(row.kind));
  const previousUnitIds=new Set([...affected].flatMap(path=>store.populationAt(generation,`unit-path:${path}`)));
  const realizationEntities=new Set(partial.realizations.map(item=>item.entityId));
  for(const entityId of realizationEntities){
    const previous=store.getAt<RepositoryObservationData["realizations"]>(generation,"realization",entityId)??[];
    const values=partial.realizations.filter(item=>item.entityId===entityId).map(next=>{
      const before=previous.find(item=>item.bindingIndex===next.bindingIndex);
      if(before!==undefined&&before.bindingHash!==next.bindingHash)throw new Error("Canonical realization binding changed outside the proved configuration");
      if(next.status==="unsupported"||next.status==="unavailable")return next;
      const memberIds=[...new Set([...(before?.memberIds??[]).filter(id=>!previousUnitIds.has(id)),...next.memberIds])].sort();
      return{...next,memberIds,status:memberIds.length===0?"unmatched" as const:"matched" as const,reason:memberIds.length===0?"Declared realization has no members in the observed repository boundary.":"Declared realization matches observed raw facts; membership does not establish behavioral fulfillment."};
    });
    upserts.push({kind:"realization",key:entityId,value:values});
  }
  const populations=(source.populations??[]).filter(item=>allowed.has(item.selector)||item.selector.startsWith("unit-path:")||item.selector.startsWith("semantic-key:"));
  const deletes:NonNullable<IndexedObservationDelta["deletes"]>[number][]=[];
  for(const path of affected){
    if(changed.has(path)&&changed.get(path)===undefined){deletes.push({kind:"inventory",key:path});populations.push({selector:"inventory",member:path,present:false});}
    const oldFile=store.getAt<LocalRepositoryAnalysis["files"][number]>(generation,"file",path);
    if(oldFile!==undefined){deletes.push({kind:"artifact",key:oldFile.artifactId});populations.push({selector:"artifact",member:oldFile.artifactId,present:false});}
    for(const id of store.populationAt(generation,`unit-path:${path}`)){deletes.push({kind:"unit",key:id});populations.push({selector:"unit",member:id,present:false},{selector:`unit-path:${path}`,member:id,present:false});}
    const oldKey=store.getAt<string>(generation,"semantic-key",path);if(oldKey!==undefined)populations.push({selector:`semantic-key:${oldKey}`,member:path,present:false});
    for(const kind of ["file","js","git-identity","git-full-identity","document","markdown","actions","dependency","test-target","semantic-key"]){deletes.push({kind,key:path});populations.push({selector:kind,member:path,present:false});}
  }
  // Removals precede additions in the same atomic publication, including ID changes.
  const additions=(source.populations??[]).filter(item=>allowed.has(item.selector)||item.selector.startsWith("unit-path:")||item.selector.startsWith("semantic-key:"));
  const orderedPopulations=[...populations.filter(item=>!item.present),...additions];
  const oldDependencies=[...affected].flatMap(path=>(store.getAt<ModuleDependencyFact[]>(generation,"dependency",path)??[]).flatMap(item=>localImportCandidates(item.importerPath,item.specifier).map(target=>({consumer:path,input:`path:${target}`,present:false}))));
  const fileManifest=updateManifest(metadata.fileManifestRoot,[...partial.analysis.files.map(({path,contentHash,mediaType,generated})=>({key:manifestKey(path),value:{path,contentHash,mediaType,generated}})),...removedPaths.map(path=>({key:manifestKey(path)}))],prefix=>store.getAt(generation,"file-manifest",prefix));
  upserts.push(...[...fileManifest.nodes].map(([key,value])=>({kind:"file-manifest",key,value})));deletes.push(...fileManifest.removed.map(key=>({kind:"file-manifest",key})));
  let bytes=metadata.counts.bytes,files=metadata.counts.files;
  for(const[path,entry]of changed){const previous=store.getAt<InventoryEntry>(generation,"inventory",path);if(previous===undefined&&entry!==undefined)files++;if(previous!==undefined&&entry===undefined)files--;bytes+=(entry===undefined?0:Buffer.byteLength(entry.content))-(previous===undefined?0:Buffer.byteLength(previous.content));}
  if(files>scope.limits.maxFiles||bytes>scope.limits.maxTotalBytes)throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Updated inventory exceeds the declared finite limits",files>scope.limits.maxFiles?"maxFiles":"maxTotalBytes",files>scope.limits.maxFiles?files:bytes);
  const state={...metadata.state,gitBase:gitSnapshot?.revision??metadata.state.gitBase,worktreeDigest:hashFramedDomain("repository-change-worktree/v2",{files:fileManifest.root,moves:metadata.moveManifestRoot,surface:metadata.analysisHeader.surface.enumeration})};
  const changedObservation={...partial,state};
  const localGraph=new KnowledgeGraph(changedObservation);
  const governance=updateIndexedGovernanceDelta({descriptor,store,changedPaths:[...affected],changedObservation,graph:localGraph});
  if(governance===undefined)return undefined;
  let enlarged=false;
  for(const row of governance.delta.upserts??[])if(row.kind==="governance-lens-root"){
    const visit=(prefix:string):void=>{
      const node=store.getAt<import("@projector/core").ManifestNode>(generation,"governance-lens-manifest",governanceManifestNodeKey(row.key,prefix));
      if(node===undefined)throw new Error("Indexed lens member manifest is incomplete; rebuild the complete observation");
      if(node.kind==="branch")for(const digit of Object.keys(node.children))visit(prefix+digit);
      else for(const entry of node.entries){const unit=store.getAt<LocalRepositoryAnalysis["projectionUnits"][number]>(generation,"unit",String(entry.value));if(unit===undefined)throw new Error("Lens member refers to missing indexed unit");const artifact=store.getAt<LocalRepositoryAnalysis["artifacts"][number]>(generation,"artifact",unit.artifactId);if(artifact===undefined)throw new Error("Lens member refers to missing indexed artifact");if(!affected.has(artifact.locator)){affected.add(artifact.locator);enlarged=true;}}
    };visit("");
  }
  if(enlarged)return leafDelta(store,descriptor,[...affected],scope,enrollment,gitSnapshot);
  const graph=enrollment?.delta===undefined?enrollIndexedGraphDelta({descriptor,store,changedPaths:[...affected],changedObservation,preparedLensCompilation:{compilation:governance.compilation}}):await enrollment.delta({descriptor,store,changedPaths:[...affected],changedObservation});
  const impact=buildRepositoryImpactSnapshot(changedObservation,new KnowledgeGraph(changedObservation,{},undefined,undefined,{compilation:governance.compilation}));
  const reverse=new Map<string,Array<{key:string;value?:unknown}>>(),derivationDependencies:NonNullable<IndexedObservationDelta["dependencies"]>[number][]=[];
  const reverseChange=(id:string,unitId:string,present:boolean):void=>{const changes=reverse.get(id)??[];changes.push({key:manifestKey(unitId),...(present?{value:unitId}:{})});reverse.set(id,changes);};
  const nextInputs=new Map(impact.records.map(record=>[record.unitId,new Set(record.inputs.map(input=>input.id))]));
  const previousInputs=new Map<string,Set<string>>();
  for(const path of affected)for(const unitId of store.populationAt(generation,`unit-path:${path}`)){
    const inputs=new Set((store.getAt<Array<{id:string}>>(generation,"derivation-inputs",unitId)??[]).map(input=>input.id));previousInputs.set(unitId,inputs);
    for(const id of inputs)if(!nextInputs.get(unitId)?.has(id)){reverseChange(id,unitId,false);derivationDependencies.push({consumer:unitId,input:`derivation:${id}`,present:false});}
    deletes.push({kind:"derivation-inputs",key:unitId});
  }
  for(const record of impact.records){upserts.push({kind:"derivation-inputs",key:record.unitId,value:record.inputs});for(const input of record.inputs)if(!previousInputs.get(record.unitId)?.has(input.id)){reverseChange(input.id,record.unitId,true);derivationDependencies.push({consumer:record.unitId,input:`derivation:${input.id}`,present:true});}}
  for(const[id,changes]of reverse){
    const prior=store.getAt<ContentHash>(generation,"reverse-derivation-root",id);
    if(prior===undefined&&!store.has("population-version","reverse-derivations"))throw new Error("Reverse derivation namespace is not complete; rebuild the observation");
    const empty=prior===undefined?buildManifest([]):undefined;
    const manifest=updateManifest(prior??empty!.root,changes,prefix=>store.getAt(generation,"reverse-derivation-manifest",reverseDerivationManifestKey(id,prefix))??(prefix===""?empty?.nodes.get(""):undefined));
    upserts.push({kind:"reverse-derivation-root",key:id,value:manifest.root},{kind:"query-dependency-version",key:`reverse-derivations:${id}`,value:hashFramedDomain("indexed-graph-dependency",manifest.root)},...[...manifest.nodes].map(([prefix,value])=>({kind:"reverse-derivation-manifest",key:reverseDerivationManifestKey(id,prefix),value})));
    deletes.push(...manifest.removed.map(prefix=>({kind:"reverse-derivation-manifest",key:reverseDerivationManifestKey(id,prefix)})));
  }
  for(const item of source.upserts??[])if(item.kind==="population-version"&&item.key.startsWith("unit-path:"))upserts.push(item);
return{metadata:{...metadata,state,analysisHeader:{...metadata.analysisHeader,git:{...metadata.analysisHeader.git,revision:gitSnapshot?.revision??metadata.analysisHeader.git.revision}},fileManifestRoot:fileManifest.root,counts:{...metadata.counts,files,bytes},moveCandidates:gitSnapshot?.candidates??{deleted:metadata.moveCandidates.deleted+removedPaths.filter(path=>store.getAt<GitIdentityFact>(generation,"git-identity",path)?.tracked===true).length,untracked:metadata.moveCandidates.untracked+addedUntracked-removedPaths.filter(path=>store.getAt<GitIdentityFact>(generation,"git-identity",path)?.tracked===false).length}},delta:merge({upserts,deletes,populations:orderedPopulations,dependencies:[...oldDependencies,...(source.dependencies??[]),...derivationDependencies]},graph,governance.delta),paths:[...affected]};
}

/** Persistent producer. Complete arrays are confined to explicit rebuild and
 * legacy materialization. Cursor loss never turns into an unchanged result.
 */
export async function observeIndexedRepository(repositoryRoot:string,options:{readonly enrollment?:IndexedObservationEnrollment;readonly rebuild?:boolean}={}):Promise<IndexedRepositoryObservation>{
  return withObservationScope({},async scope=>{
    const location=await checkoutCacheLocation(repositoryRoot),root=location.checkoutRoot;
    const store=await SqliteObservationStore.open(root,{budget:scope.budget,signal:scope.signal});
    try{
      const head=store.head();let reason=options.rebuild===true?"explicit-rebuild":"missing-completed-baseline";
      if(options.rebuild!==true&&head!==undefined&&validMetadata(head.metadata)&&head.metadata.checkoutId===location.checkoutId&&head.metadata.repositoryRoot===root&&head.contract===head.metadata.contractHash&&head.contract===contract(head.metadata)){
        const previous=head.metadata;
        if(previous.counts.files>scope.limits.maxFiles)throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxFiles","maxFiles",previous.counts.files);
        if(previous.counts.directories>scope.limits.maxDirectories)throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxDirectories","maxDirectories",previous.counts.directories);
        if(previous.counts.bytes>scope.limits.maxTotalBytes)throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxTotalBytes","maxTotalBytes",previous.counts.bytes);
        const delta=await observeWatchmanChanges(previous.watchman,scope.budget,scope.signal);
        if(delta.kind==="delta"&&delta.baseline.uncoveredPrefixes.every(prefix=>exclusions.some(excluded=>prefix===excluded||prefix.startsWith(`${excluded}/`)))){
          const gitDeltas=await Promise.all(previous.gitWatchmen.map(baseline=>observeWatchmanChanges(baseline,scope.budget,scope.signal)));
          const sourceEvents=previous.analysisHeader.git.availability==="available"?await filterSourceWatchmanEvents(root,delta.events.filter(event=>!exclusions.some(prefix=>event.path===prefix||event.path.startsWith(`${prefix}/`))),scope.budget,scope.signal):delta.events;
          let paths=sourceEvents.filter(event=>event.type!=="d").map(event=>event.path).filter(path=>!exclusions.some(prefix=>path===prefix||path.startsWith(`${prefix}/`)));
          const revision=(await observationGit(root,["rev-parse","--verify","--quiet","HEAD"],scope.budget,{signal:scope.signal,allowedExitCodes:[1]})).trim()||"unborn";
          if(previous.analysisHeader.git.availability==="available"&&previous.gitWatchmen.length===previous.gitDirectories.length&&gitDeltas.every(result=>result.kind==="delta"&&result.baseline.uncoveredPrefixes.length===0)&&await effectiveBoundaryUnchanged(root,previous,scope)){
            const gitChanged=revision!==previous.analysisHeader.git.revision||gitDeltas.some(result=>result.kind==="delta"&&result.events.length>0);
            let gitSnapshot:GitLeafSnapshot|undefined,stageDelta:IndexedObservationDelta={};let gitSupported=true;
            if(gitChanged){
              const status=parseGitStatus(await observationGit(root,["status","--porcelain=v1","--untracked-files=all","-z"],scope.budget,{signal:scope.signal,stage:"indexed-git-population-proof"}));
              gitSupported=status.moves.length===0&&!(status.deleted.length>0&&status.untracked.length>0)&&previous.moveManifestRoot===buildManifest([]).root;
              let ancestryPreserved=revision===previous.analysisHeader.git.revision;
              // Bind immutable merge-base identity; empty stdout alone cannot
              // distinguish is-ancestor's successful and negative exit codes.
              if(revision!==previous.analysisHeader.git.revision&&revision!=="unborn"&&previous.analysisHeader.git.revision!=="unborn")ancestryPreserved=(await observationGit(root,["merge-base",previous.analysisHeader.git.revision,revision],scope.budget,{signal:scope.signal,stage:"indexed-git-history-proof",allowedExitCodes:[1]})).trim()===previous.analysisHeader.git.revision;
              gitSupported&&=ancestryPreserved;
              if(gitSupported){
                const stages=await stagedPaths(root,scope),oldStages=store.populationAt(head.generation,"git-staged-path");
                const treePaths=revision===previous.analysisHeader.git.revision?[]:(await observationGit(root,["diff-tree","--no-ext-diff","--no-renames","--name-only","-r","-z",previous.analysisHeader.git.revision,revision],scope.budget,{signal:scope.signal,stage:"indexed-git-tree-delta"})).split("\0").filter(Boolean);
                paths=[...new Set([...paths,...stages,...oldStages,...treePaths])].filter(path=>!exclusions.some(prefix=>path===prefix||path.startsWith(`${prefix}/`)));
                gitSnapshot={revision,ancestryPreserved,candidates:{deleted:status.deleted.length,untracked:status.untracked.length}};
                stageDelta={populations:[...oldStages.map(member=>({selector:"git-staged-path",member,present:false})),...stages.map(member=>({selector:"git-staged-path",member,present:true}))]};
              }
            }
            const descriptor:IndexedObservationDescriptor={schemaVersion:INDEXED_OBSERVATION_CONTRACT,repositoryRoot:root,checkoutId:location.checkoutId,generation:head.generation,contractHash:head.contract as ContentHash,metadata:previous};
            let directoryChanged=false;
            const directoryEvents=sourceEvents.filter(event=>event.type==="d"&&!exclusions.some(prefix=>event.path===prefix||event.path.startsWith(`${prefix}/`)));
            if(directoryEvents.length>0){
              const repositoryPaths=await RepositoryPathService.create(root);
              for(const event of directoryEvents){
                scope.budget.check("indexed-directory-currentness",event.path);scope.signal.throwIfAborted();
                if(!event.exists||!store.has("inventory-directory",event.path)){directoryChanged=true;break;}
                const resolved=await repositoryPaths.resolveRead(event.path);
                let stat;try{stat=await lstat(resolved.realTarget);}catch(error){if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="ENOENT"){directoryChanged=true;break;}throw error;}
                if(!stat.isDirectory()||stat.isSymbolicLink()){directoryChanged=true;break;}
              }
            }
            const changed=gitSupported&&!directoryChanged&&(paths.length>0||gitChanged)?await leafDelta(store,descriptor,paths,scope,options.enrollment,gitSnapshot):undefined;
            if(!gitSupported||directoryChanged||((paths.length>0||gitChanged)&&changed===undefined)){reason="unsupported-source-or-git-delta";}else{
            const watchman=await verifyWatchmanChanges(delta.baseline,scope.budget,scope.signal,exclusions,true);
            const gitWatchmen:WatchmanBaseline[]=[];for(const result of gitDeltas)if(result.kind==="delta")gitWatchmen.push(await verifyWatchmanChanges(result.baseline,scope.budget,scope.signal));
            if(!await effectiveBoundaryUnchanged(root,previous,scope))throw new Error("Effective Git ignore/configuration boundary changed during indexed observation; retry the complete observation");
            const metadata={...(changed?.metadata??previous),watchman,gitWatchmen};
            scope.signal.throwIfAborted();const published=store.publish(head.generation,{contract:head.contract,metadata},merge(changed?.delta??{},stageDelta),{retainGeneration:changed===undefined,signal:scope.signal});
            return handle(store,metadata,published.generation,changed===undefined?"unchanged":"delta",changed?.paths??[]);
            }
          }
          reason=paths.length>0?"known-source-delta":"changed-or-unknown-git-inputs";
        }else reason=delta.kind==="rediscovery"?delta.reason:"incomplete-provider-coverage";
      }
      const watchman=await enrollWatchman(root,scope.budget,scope.signal);
      let directories:string[]=[];
      try{directories=await gitDirectories(root,scope.budget,scope.signal);}catch(error){
        try{await lstat(resolve(root,".git"));throw error;}catch(markerError){if(!(typeof markerError==="object"&&markerError!==null&&"code"in markerError&&markerError.code==="ENOENT"))throw markerError;}
      }
      const gitWatchmen:WatchmanBaseline[]=[];for(const directory of directories){const enrolled=await enrollWatchman(directory,scope.budget,scope.signal);if(enrolled!==undefined)gitWatchmen.push(enrolled);}
      const collected=await collectLocalRepositoryInputs({repositoryRoot:root,budget:scope.budget,signal:scope.signal});
      const canonicalSources=await collectCanonicalSnapshotSources(root,scope.budget,scope.signal);
      const data=await runObservationTask("observe",{collected,canonicalSources},scope);
      const stages=data.analysis.git.availability==="available"?await stagedPaths(root,scope):[];
      const coldGraph=options.enrollment===undefined?new KnowledgeGraph(data):undefined;
      const graphDelta=coldGraph===undefined?await options.enrollment!.cold(data):enrollIndexedGraph(data,buildRepositoryImpactSnapshot(data,coldGraph),coldGraph);
      let completedWatchman=watchman;
      if(watchman!==undefined)completedWatchman=await verifyWatchmanChanges(watchman,scope.budget,scope.signal,exclusions,data.analysis.git.availability==="available");
      const completedGit:WatchmanBaseline[]=[];for(const baseline of gitWatchmen)completedGit.push(await verifyWatchmanChanges(baseline,scope.budget,scope.signal));
      const {surface,capabilities,observationDescriptor}=data.analysis;
      const fileManifest=buildManifest(data.analysis.files.map(({path,contentHash,mediaType,generated})=>({key:manifestKey(path),value:{path,contentHash,mediaType,generated}})));
      const moveManifest=buildManifest(data.analysis.gitMoves.map(move=>({key:manifestKey(move.fromPath),value:move})));
const metadata:IndexedObservationMetadata={moveCandidates:{deleted:collected.gitFacts.pendingMoveCandidates?.deleted.length??0,untracked:collected.gitFacts.pendingMoveCandidates?.untracked.length??0},schemaVersion:INDEXED_OBSERVATION_CONTRACT,checkoutId:location.checkoutId,repositoryRoot:root,state:data.state,inventoryDescriptor:collected.inventoryResult.observationDescriptor,enumeration:collected.inventoryResult.enumeration,analysisHeader:{surface,capabilities,observationDescriptor,git:{availability:data.analysis.git.availability,revision:data.analysis.git.revision}},canonicalRootDigest:data.canonical.rootDigest,contractHash:"" as ContentHash,...(completedWatchman===undefined?{}:{watchman:completedWatchman}),gitWatchmen:completedGit,gitDirectories:directories,counts:{files:collected.inventoryResult.entries.length,bytes:collected.inventoryResult.entries.reduce((sum,item)=>sum+Buffer.byteLength(item.content),0),directories:collected.inventoryResult.directories?.length??0},rebuildReason:reason,incrementalSupport:{globalSyntax:data.analysis.javaScript.events.length===0&&data.analysis.javaScript.contracts.length===0&&data.analysis.javaScript.eventUncertainties.length===0,hookReachability:!data.analysis.files.some(file=>file.lifecycleExports.length>0||file.semanticRole==="hook-private-support")},fileManifestRoot:fileManifest.root,moveManifestRoot:moveManifest.root};
      const completed={...metadata,contractHash:contract(metadata)};
      scope.signal.throwIfAborted();scope.budget.check("indexed-generation-publication");
      const manifestDelta:IndexedObservationDelta={upserts:[...fileManifest.nodes].map(([key,value])=>({kind:"file-manifest",key,value})).concat([...moveManifest.nodes].map(([key,value])=>({kind:"move-manifest",key,value})))};
      const published=store.publish(head?.generation??null,{contract:completed.contractHash,metadata:completed},{...merge(sourceRecords(data,collected.inventoryResult.entries),graphDelta,manifestDelta,{upserts:(collected.inventoryResult.directories??[]).map(key=>({kind:"inventory-directory",key,value:true})),populations:stages.map(member=>({selector:"git-staged-path",member,present:true}))}),rebuild:true},{signal:scope.signal});
      return handle(store,completed,published.generation,"rebuild",[]);
    }catch(error){store.close();throw error;}
  });
}
