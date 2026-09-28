import {KnowledgeGraph} from "../knowledge/graph.js";
import {buildRepositoryImpactSnapshot} from "../impact/service.js";
import {randomUUID} from "node:crypto";
import {summarizeColdObservation,type IndexedColdResult} from "./indexed-cold.js";
import {sourceRecords} from "./indexed-source-records.js";
import { dirname, resolve } from "node:path";
import { lstat, mkdir, rm } from "node:fs/promises";
import { inventoryEntryBytes, inventoryEntryChunks, collectGitPathIdentities, collectGitFacts, parseGitStatus, localImportCandidates, syntaxProgramVersion, localRepositoryAdapterVersion, localSemanticKey, readInventoryEntry, readObservationFile, inventoryRepository, inventoryRepositoryIdentities, collectLocalRepositoryInputs, observationGit, detectMechanicalDivergences, type LocalRepositoryAnalysis, type InventoryEntry, type CollectedLocalRepositoryInputs, type GitIdentityFact, type ModuleDependencyFact, type TestTargetFact, type InventoryResult, type JavaScriptFacts } from "@projector/analyzers";
import { buildManifest, updateManifest, manifestKey, hashFramedDomain, ObservationError, observationLimitValue, type ContentHash } from "@projector/core";
import { RepositoryPathService, checkoutCacheLocation, collectCanonicalSnapshotSources, SqliteObservationStore, SqliteObservationSourceCapture, withObservationScope, type ObservationStageDescriptor, type IndexedObservationDelta, type ObservationScope } from "@projector/runtime";
import { runObservationTask } from "../observation/task-runner.js";
import type { RepositoryObservationData } from "../observation/tasks.js";
import { INDEXED_OBSERVATION_CONTRACT, type IndexedObservationDescriptor, type IndexedObservationEnrollment, type IndexedObservationMetadata, type IndexedRepositoryObservation } from "../observation/indexed-types.js";
import { enrollWatchman, observeWatchmanChanges, verifyWatchmanChanges, filterSourceWatchmanEvents, WatchmanSynchronizationUnavailableError, type WatchmanBaseline } from "./watchman-observation.js";
import { enrollIndexedGraphDelta } from "../knowledge/indexed-delta.js";
import { updateIndexedGovernanceDelta } from "../knowledge/indexed-governance-delta.js";
import { governanceManifestNodeKey } from "../knowledge/indexed-governance.js";
import { safeRealizationCandidateIds } from "../knowledge/indexed-selector-incidence.js";
import { reverseDerivationManifestKey } from "../knowledge/indexed-derivations.js";
import { realizeChangeRepositoryData } from "./repository-observer.js";

async function captureStore(root:string,scope:ObservationScope):Promise<SqliteObservationSourceCapture>{
  const location=await checkoutCacheLocation(root),paths=await RepositoryPathService.create(location.cacheRoot);
  const target=await paths.resolveWrite(".projector/runtime/observations/index.sqlite");
  const capture=await SqliteObservationSourceCapture.create(target.realTarget,scope.budget,scope.signal);
  scope.registerCleanup(async()=>{await capture.dispose();});
  return capture;
}
async function verifyCapturedInventory(root:string,expected:InventoryResult,scope:ObservationScope):Promise<void>{
    const current=await inventoryRepositoryIdentities(root,{budget:scope.budget,signal:scope.signal});
    const {limits:_beforeLimits,...beforeBoundary}=expected.observationDescriptor;
    const {limits:_afterLimits,...afterBoundary}=current.observationDescriptor;
    const matches=expected.entries.length===current.entries.length&&expected.entries.every((entry,index)=>{
      const actual=current.entries[index]!;
      return entry.path===actual.path&&entry.kind===actual.kind&&entry.contentHash===actual.contentHash&&entry.mediaType===actual.mediaType&&entry.generated===actual.generated;
    });
    if(!matches||hashFramedDomain("indexed-inventory-boundary",beforeBoundary)!==hashFramedDomain("indexed-inventory-boundary",afterBoundary)||
      hashFramedDomain("indexed-directory-boundary",expected.directories)!==hashFramedDomain("indexed-directory-boundary",current.directories))
      throw new Error("Repository source changed during indexed computation; the previous completed generation remains current");
}
const exclusions=[".git",".worktrees",".projector/runtime"] as const;
const observerPrograms=`projector.local-repository@${localRepositoryAdapterVersion}/indexed-producer@4/source-versions@2/query-registry@3/governance-merkle@2/knowledge-lexical@1/realization-incidence@1/git-full-identity@1/git-leaf-proof@1/reverse-derivation-manifest@1/directory-population@1/${syntaxProgramVersion}`;
function merge(...deltas:readonly IndexedObservationDelta[]):IndexedObservationDelta{
  return{upserts:deltas.flatMap(delta=>delta.upserts??[]),deletes:deltas.flatMap(delta=>delta.deletes??[]),populations:deltas.flatMap(delta=>delta.populations??[]),dependencies:deltas.flatMap(delta=>delta.dependencies??[])};
}
function materialize(store:SqliteObservationStore,descriptor:IndexedObservationDescriptor):RepositoryObservationData{
  return store.readGeneration(descriptor.generation,()=>{
    const byPath=(left:string,right:string):number=>Buffer.compare(Buffer.from(left,"utf8"),Buffer.from(right,"utf8"));
    const list=<T>(kind:string):T[]=>store.population(kind).map(key=>{const value=store.get<T>(kind,key);if(value===undefined)throw new Error(`Indexed observation record missing: ${kind}:${key}`);return value;});
    const grouped=<T>(kind:string):T[]=>list<readonly T[]>(kind).flatMap(value=>value);
    const analysis={} as Record<string,unknown>;
    for(const key of ["observationDescriptor","surface","capabilities","git","gitMoves","packageScriptInvocations","topology","divergences","failures"])analysis[key]=store.get("analysis-global",key);
    const javaScript={} as Record<string,unknown>;
    for(const key of ["events","eventUncertainties","contracts","failures"])javaScript[key]=store.get("javascript-global",key);
    javaScript.files=list("js");javaScript.dependencies=grouped("dependency");javaScript.testTargets=grouped("test-target");
    analysis.files=list("file");analysis.artifacts=list<LocalRepositoryAnalysis["artifacts"][number]>("artifact").map(artifact=>({...artifact,observationRevision:descriptor.metadata.analysisHeader.git.revision})).sort((a,b)=>byPath(a.locator,b.locator));analysis.projectionUnits=list("unit");analysis.gitIdentities=list("git-identity");analysis.dependencies=javaScript.dependencies;analysis.testTargets=javaScript.testTargets;analysis.javaScript=javaScript;
    analysis.git={...(analysis.git as LocalRepositoryAnalysis["git"]),revision:descriptor.metadata.analysisHeader.git.revision,identities:list("git-full-identity")};
    const artifactPaths=new Map((analysis.artifacts as LocalRepositoryAnalysis["artifacts"]).map(artifact=>[artifact.id,artifact.locator]));
    analysis.projectionUnits=(analysis.projectionUnits as LocalRepositoryAnalysis["projectionUnits"]).sort((a,b)=>byPath(artifactPaths.get(a.artifactId)??"",artifactPaths.get(b.artifactId)??""));
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
  return metadata.schemaVersion===INDEXED_OBSERVATION_CONTRACT&&typeof metadata.checkoutId==="string"&&typeof metadata.repositoryRoot==="string"&&metadata.state!==undefined&&metadata.inventoryDescriptor!==undefined&&metadata.analysisHeader!==undefined&&Array.isArray(metadata.gitWatchmen)&&Array.isArray(metadata.gitDirectories)&&metadata.counts!==undefined&&typeof metadata.canonicalSourceHash==="string"&&typeof metadata.gitSourceHash==="string";
}
function canonicalSourceHash(sources:readonly {relativePath:string;source:string}[]):ContentHash{
  return hashFramedDomain("indexed-canonical-source-v1",sources.map(({relativePath,source})=>({relativePath,source})));
}
async function gitSource(root:string,scope:ObservationScope):Promise<{hash:ContentHash;revision:string;status:string}>{
  const [head,index,status]=await Promise.all([
    observationGit(root,["rev-parse","--verify","--quiet","HEAD"],scope.budget,{signal:scope.signal,allowedExitCodes:[1],stage:"indexed-git-source"}),
    observationGit(root,["ls-files","--stage","-z"],scope.budget,{signal:scope.signal,stage:"indexed-git-source"}),
    observationGit(root,["status","--porcelain=v1","--untracked-files=all","-z"],scope.budget,{signal:scope.signal,stage:"indexed-git-source"})
  ]);
  const revision=head.trim()||"unborn";
  return{hash:hashFramedDomain("indexed-git-source-v1",{revision,index,status}),revision,status};
}
function inventoryChanges(store:SqliteObservationStore,generation:number,inventory:InventoryResult,metadata:IndexedObservationMetadata):string[]|undefined{
  if(inventory.directories?.length!==metadata.counts.directories)return undefined;
  const previous=store.inventorySummariesAt(generation);
  if(previous.length!==metadata.counts.files)return undefined;
  const previousSet=new Set(previous.map(entry=>entry.path));
  const entries=new Map(inventory.entries.map(entry=>[entry.path,entry]));
  const paths=new Set<string>();
  for(const prior of previous){
    const current=entries.get(prior.path);
    if(current===undefined||current.contentHash!==prior.contentHash||current.kind!==prior.kind||current.mediaType!==prior.mediaType||current.generated!==prior.generated)paths.add(prior.path);
  }
  for(const path of entries.keys())if(!previousSet.has(path))paths.add(path);
  for(const path of inventory.directories??[])if(!store.has("inventory-directory",path))return undefined;
  return [...paths];
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
function syntaxAffectedPaths(store:SqliteObservationStore,generation:number,next:JavaScriptFacts):string[]{
  const paths=new Map<string,Set<string>>();
  const include=(file:JavaScriptFacts["files"][number]):void=>{const members=paths.get(file.participantId)??new Set<string>();members.add(file.path);paths.set(file.participantId,members);};
  for(const file of next.files)include(file);
  for(const path of store.populationAt(generation,"js")){const file=store.getAt<JavaScriptFacts["files"][number]>(generation,"js",path);if(file!==undefined)include(file);}
  const participants=new Set<string>();
  for(const key of ["events","eventUncertainties","contracts"] as const){
    for(const fact of store.getAt<Array<{participantId:string}>>(generation,"javascript-global",key)??[])participants.add(fact.participantId);
    for(const fact of next[key])participants.add(fact.participantId);
  }
  return [...new Set([...participants].flatMap(id=>[...(paths.get(id)??[])]))];
}
async function syntaxLane(descriptor:IndexedObservationDescriptor,scope:ObservationScope,inventory?:InventoryResult):Promise<{facts:JavaScriptFacts;inventory:InventoryResult}|undefined>{
  const scanned=inventory??await inventoryRepository(descriptor.repositoryRoot,{budget:scope.budget,signal:scope.signal});
  const {limits:_limits,...boundary}=scanned.observationDescriptor,{limits:_priorLimits,...prior}=descriptor.metadata.inventoryDescriptor;
  if(hashFramedDomain("indexed-inventory-boundary",boundary)!==hashFramedDomain("indexed-inventory-boundary",prior))return undefined;
  const facts=await runObservationTask("analyze-javascript",{inventory:scanned},scope);
  if(facts.failures.length>0)return undefined;
  return{facts,inventory:scanned};
}
async function leafDelta(store:SqliteObservationStore,descriptor:IndexedObservationDescriptor,paths:readonly string[],scope:ObservationScope,enrollment:IndexedObservationEnrollment|undefined,gitSnapshot?:GitLeafSnapshot,globalSyntax?:JavaScriptFacts):Promise<{metadata:IndexedObservationMetadata;delta:IndexedObservationDelta;paths:readonly string[]}|undefined>{
  const metadata=descriptor.metadata,root=descriptor.repositoryRoot,generation=descriptor.generation;
  if(globalSyntax!==undefined&&(store.getAt<LocalRepositoryAnalysis["failures"]>(generation,"analysis-global","failures")??[]).length>0)return undefined;
  if(paths.some(path=>path.startsWith(".projector/")||/(?:^|\/)(?:\.gitignore|\.gitattributes|\.watchmanconfig)$/u.test(path)||path.endsWith("package.json")||/(?:^|\/)(?:tsconfig[^/]*\.json|[^/]*config\.[^/]+|[^/]*lock[^/]*)$/u.test(path)))return undefined;
  // Event and contract facts are global within a package. An unrelated static
  // document may still use the scoped lane, while source edits rebuild that lane.
  if(!metadata.incrementalSupport.globalSyntax&&globalSyntax===undefined&&paths.some(path=>/\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path)||store.has("js",path)))return undefined;
  const capture=await captureStore(root,scope);
  const retained=new Map<string,InventoryEntry>();
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
    const entry=await readInventoryEntry(root,path,scope.budget,scope.signal,capture);
    changed.set(path,entry);if(entry!==undefined)retained.set(path,entry);
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
      if(affected.size>observationLimitValue(scope.limits.maxFiles))throw new ObservationError("observation-limit-exceeded","indexed-component",".","Affected component exceeds maxFiles","maxFiles",affected.size);
    }
  };
  expand();
  const refreshIdentities=async():Promise<void>=>{const pending=[...affected].filter(path=>!currentIdentities.has(path)&&(gitSnapshot!==undefined||!store.has("inventory",path)));const known=new Map(pending.map(path=>[path,store.getAt<GitIdentityFact>(generation,"git-identity",path)]).filter((item):item is [string,GitIdentityFact]=>item[1]!==undefined));for(const identity of await collectGitPathIdentities(root,pending,gitSnapshot?.revision??metadata.analysisHeader.git.revision,known,{budget:scope.budget,signal:scope.signal,ancestryPreserved:gitSnapshot?.ancestryPreserved??true}))currentIdentities.set(identity.path,identity);};
  await refreshIdentities();
  const collectedFor=async():Promise<CollectedLocalRepositoryInputs>=>{
    await capture.beginAppend();
    const retain=async(entry:InventoryEntry):Promise<InventoryEntry>=>{
      const existing=retained.get(entry.path);if(existing!==undefined)return existing;
      const fields=Object.fromEntries(Object.keys(entry).filter(key=>key!=="content").map(key=>[key,(entry as unknown as Record<string,unknown>)[key]])) as Omit<InventoryEntry,"content">;
      const metadata={...fields,contentBytes:inventoryEntryBytes(entry)};
      const sourceVersionId=(entry as InventoryEntry&{sourceVersionId?:string}).sourceVersionId;
      const copied=sourceVersionId===undefined?await capture.putChunks(metadata,inventoryEntryChunks(entry)):capture.linkExisting(metadata,sourceVersionId);
      retained.set(entry.path,copied);return copied;
    };
    const entries=new Map<string,InventoryEntry>();
    for(const path of affected){const entry=changed.has(path)?changed.get(path):store.inventoryEntryAt<InventoryEntry>(generation,path);if(entry!==undefined)entries.set(path,await retain(entry));
      const segments=path.split("/");for(let depth=0;depth<segments.length;depth++){const manifest=[...segments.slice(0,depth),"package.json"].join("/");const context=store.inventoryEntryAt<InventoryEntry>(generation,manifest);if(context!==undefined)entries.set(manifest,await retain(context));}
    }
    const identities=[...entries.keys()].map(path=>currentIdentities.get(path)??store.getAt<GitIdentityFact>(generation,"git-identity",path)??{sourceClass:"derived" as const,path,tracked:false,availability:"available" as const,introductionHistory:"not-applicable" as const});
    await capture.finish();
    return{options:{repositoryRoot:root},inventoryResult:{contentStore:capture.descriptor,entries:[...entries.values()],failures:[],rootAvailability:"available",observationDescriptor:{...metadata.inventoryDescriptor,limits:scope.limits},enumeration:metadata.enumeration},gitFacts:{availability:"available",revision:gitSnapshot?.revision??metadata.analysisHeader.git.revision,identities,moves:[],failures:[]}};
  };
  let collected=await collectedFor();let preliminary=await runObservationTask("analyze-incremental",{collected,...(globalSyntax===undefined?{}:{context:{javaScript:globalSyntax}})},scope);
  if(globalSyntax===undefined&&(preliminary.javaScript.events.length>0||preliminary.javaScript.contracts.length>0||preliminary.javaScript.eventUncertainties.length>0))return undefined;
  const firstEntries=new Map(collected.inventoryResult.entries.map(entry=>[entry.path,entry])),firstJS=new Map(preliminary.javaScript.files.map(file=>[file.path,file]));
  let extended=false;
  for(const dependency of preliminary.dependencies){
    const target=localImportCandidates(dependency.importerPath,dependency.specifier).find(path=>changed.has(path)?changed.get(path)!==undefined:store.has("inventory",path));
    if(target!==undefined&&!affected.has(target)){affected.add(target);extended=true;}
  }
  for(const file of preliminary.files){if(!affected.has(file.path))continue;const key=localSemanticKey(firstEntries.get(file.path)!,firstJS.get(file.path),file.semanticRole);for(const collision of store.populationAt(generation,`semantic-key:${key}`))if(!affected.has(collision)){affected.add(collision);extended=true;}}
  if(extended){expand();await refreshIdentities();collected=await collectedFor();preliminary=await runObservationTask("analyze-incremental",{collected,...(globalSyntax===undefined?{}:{context:{javaScript:globalSyntax}})},scope);}
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
  const filtered={...raw,files:raw.files.filter(file=>affected.has(file.path)),artifacts:raw.artifacts.filter(artifact=>artifactIds.has(artifact.id)),projectionUnits:raw.projectionUnits.filter(unit=>artifactIds.has(unit.artifactId)),gitIdentities:raw.gitIdentities.filter(identity=>affected.has(identity.path)),dependencies:raw.dependencies.filter(item=>affected.has(item.importerPath)),testTargets:raw.testTargets.filter(item=>affected.has(item.testPath)),javaScript:{...raw.javaScript,files:raw.javaScript.files.filter(file=>affected.has(file.path)),dependencies:raw.javaScript.dependencies.filter(item=>affected.has(item.importerPath)),testTargets:raw.javaScript.testTargets.filter(item=>affected.has(item.testPath))},documents:raw.documents.filter(file=>affected.has(file.path)),actions:raw.actions.filter(file=>affected.has(file.path)),markdown:raw.markdown.filter(file=>affected.has(file.path))};
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
  if(globalSyntax!==undefined){
    for(const key of ["events","eventUncertainties","contracts","failures"] as const)upserts.push({kind:"javascript-global",key,value:globalSyntax[key]});
    const allActions=store.populationAt(generation,"actions").map(path=>store.getAt<LocalRepositoryAnalysis["actions"][number]>(generation,"actions",path)).filter((item):item is LocalRepositoryAnalysis["actions"][number]=>item!==undefined);
    upserts.push({kind:"analysis-global",key:"topology",value:raw.topology},{kind:"analysis-global",key:"divergences",value:detectMechanicalDivergences(globalSyntax,allActions)});
  }
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
  for(const[path,entry]of changed){const previous=store.inventoryEntryAt<InventoryEntry>(generation,path);if(previous===undefined&&entry!==undefined)files++;if(previous!==undefined&&entry===undefined)files--;bytes+=(entry===undefined?0:inventoryEntryBytes(entry))-(previous===undefined?0:inventoryEntryBytes(previous));}
  if(files>observationLimitValue(scope.limits.maxFiles)||bytes>observationLimitValue(scope.limits.maxTotalBytes))throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Updated inventory exceeds the declared finite limits",files>observationLimitValue(scope.limits.maxFiles)?"maxFiles":"maxTotalBytes",files>observationLimitValue(scope.limits.maxFiles)?files:bytes);
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
  if(enlarged)return leafDelta(store,descriptor,[...affected],scope,enrollment,gitSnapshot,globalSyntax);
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
return{metadata:{...metadata,state,analysisHeader:{...metadata.analysisHeader,git:{...metadata.analysisHeader.git,revision:gitSnapshot?.revision??metadata.analysisHeader.git.revision}},incrementalSupport:{...metadata.incrementalSupport,globalSyntax:globalSyntax===undefined?metadata.incrementalSupport.globalSyntax:globalSyntax.events.length===0&&globalSyntax.contracts.length===0&&globalSyntax.eventUncertainties.length===0},fileManifestRoot:fileManifest.root,counts:{...metadata.counts,files,bytes},moveCandidates:gitSnapshot?.candidates??{deleted:metadata.moveCandidates.deleted+removedPaths.filter(path=>store.getAt<GitIdentityFact>(generation,"git-identity",path)?.tracked===true).length,untracked:metadata.moveCandidates.untracked+addedUntracked-removedPaths.filter(path=>store.getAt<GitIdentityFact>(generation,"git-identity",path)?.tracked===false).length}},delta:merge({upserts,deletes,populations:orderedPopulations,dependencies:[...oldDependencies,...(source.dependencies??[]),...derivationDependencies]},graph,governance.delta),paths:[...affected]};
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
      let scannedInventory:InventoryResult|undefined;
      if(options.rebuild!==true&&head!==undefined&&validMetadata(head.metadata)&&head.metadata.checkoutId===location.checkoutId&&head.metadata.repositoryRoot===root&&head.contract===head.metadata.contractHash&&head.contract===contract(head.metadata)){
        const previous=head.metadata;
        if(previous.counts.files>observationLimitValue(scope.limits.maxFiles))throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxFiles","maxFiles",previous.counts.files);
        if(previous.counts.directories>observationLimitValue(scope.limits.maxDirectories))throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxDirectories","maxDirectories",previous.counts.directories);
        if(previous.counts.bytes>observationLimitValue(scope.limits.maxTotalBytes))throw new ObservationError("observation-limit-exceeded","indexed-population-admission",".","Indexed population exceeds maxTotalBytes","maxTotalBytes",previous.counts.bytes);
        if(previous.watchman===undefined&&previous.gitWatchmen.length===0){
          const warmCapture=await captureStore(root,scope);
          const inventory=await inventoryRepository(root,{budget:scope.budget,signal:scope.signal,contentStore:warmCapture,deferContentStoreFinish:true});
          scannedInventory=inventory;
          const {limits:_limits,...boundary}=inventory.observationDescriptor;
          const {limits:_previousLimits,...priorBoundary}=previous.inventoryDescriptor;
          if(hashFramedDomain("indexed-inventory-boundary",boundary)===hashFramedDomain("indexed-inventory-boundary",priorBoundary)&&inventory.enumeration.method===previous.enumeration.method){
            const canonical=canonicalSourceHash(await collectCanonicalSnapshotSources(root,scope.budget,scope.signal));
            const git=previous.analysisHeader.git.availability==="available"?await gitSource(root,scope):undefined;
            const gitHash=git?.hash??hashFramedDomain("indexed-no-git-source",inventory.enumeration.method);
            const paths=inventoryChanges(store,head.generation,inventory,previous);
            if(paths!==undefined&&canonical===previous.canonicalSourceHash){
              scope.signal.throwIfAborted();scope.budget.check("indexed-source-currentness");
              if(paths.length===0&&gitHash===previous.gitSourceHash)return handle(store,previous,head.generation,"unchanged",[]);
              await warmCapture.finish();
              // The complete scan proves the source population. Scoped publication
              // still requires supported Git identities and syntax dependencies.
              if(git!==undefined&&git.revision===previous.analysisHeader.git.revision){
                const status=parseGitStatus(git.status);
                const statusPaths:string[]=[];
                for(const record of git.status.split("\0"))if(record.length>=4)statusPaths.push(record.slice(3));
                const stages=await stagedPaths(root,scope),oldStages=store.populationAt(head.generation,"git-staged-path");
                const affected=[...new Set(gitHash===previous.gitSourceHash?paths:[...paths,...statusPaths,...stages,...oldStages])].filter(path=>!exclusions.some(prefix=>path===prefix||path.startsWith(`${prefix}/`)));
                const descriptor:IndexedObservationDescriptor={schemaVersion:INDEXED_OBSERVATION_CONTRACT,repositoryRoot:root,checkoutId:location.checkoutId,generation:head.generation,contractHash:head.contract as ContentHash,metadata:previous};
                const snapshot={revision:git.revision,ancestryPreserved:true,candidates:{deleted:status.deleted.length,untracked:status.untracked.length}};
                let changed=status.moves.length===0&&!(status.deleted.length>0&&status.untracked.length>0)&&affected.length>0?await leafDelta(store,descriptor,affected,scope,options.enrollment,snapshot):undefined;
                if(changed===undefined&&affected.some(path=>/\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path))&&status.moves.length===0){
                  const lane=await syntaxLane(descriptor,scope,inventory);
                  if(lane!==undefined)changed=await leafDelta(store,descriptor,[...new Set([...affected,...syntaxAffectedPaths(store,head.generation,lane.facts)])],scope,options.enrollment,snapshot,lane.facts);
                }
                if(changed!==undefined){
                  await verifyCapturedInventory(root,inventory,scope);
                  const verified=await gitSource(root,scope);
                  if(verified.hash!==git.hash||canonicalSourceHash(await collectCanonicalSnapshotSources(root,scope.budget,scope.signal))!==canonical)throw new Error("Source boundary changed during indexed delta; retry observation");
                  scope.signal.throwIfAborted();scope.budget.check("indexed-generation-publication");
                  const metadata={...changed.metadata,canonicalSourceHash:canonical,gitSourceHash:gitHash};
                  const stageDelta:IndexedObservationDelta={populations:[...oldStages.map(member=>({selector:"git-staged-path",member,present:false})),...stages.map(member=>({selector:"git-staged-path",member,present:true}))]};
                  const published=await store.publishWhenReady(head.generation,{contract:head.contract,metadata},merge(changed.delta,stageDelta),{signal:scope.signal});
                  return handle(store,metadata,published.generation,"delta",changed.paths);
                }
              }
            }
          }
          await warmCapture.finish();
          reason="changed-or-unknown-source-boundary";
        }
        try {
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
            let changed=gitSupported&&!directoryChanged&&(paths.length>0||gitChanged)?await leafDelta(store,descriptor,paths,scope,options.enrollment,gitSnapshot):undefined;
            if(changed===undefined&&gitSupported&&!directoryChanged&&paths.some(path=>/\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(path))){
              const lane=await syntaxLane(descriptor,scope);
              if(lane!==undefined)changed=await leafDelta(store,descriptor,[...new Set([...paths,...syntaxAffectedPaths(store,head.generation,lane.facts)])],scope,options.enrollment,gitSnapshot,lane.facts);
            }
            if(!gitSupported||directoryChanged||((paths.length>0||gitChanged)&&changed===undefined)){reason="unsupported-source-or-git-delta";}else{
            const verifiedGitSource=previous.analysisHeader.git.availability==="available"?await gitSource(root,scope):undefined;
            const watchman=await verifyWatchmanChanges(delta.baseline,scope.budget,scope.signal,exclusions,true);
            const gitWatchmen:WatchmanBaseline[]=[];for(const result of gitDeltas)if(result.kind==="delta")gitWatchmen.push(await verifyWatchmanChanges(result.baseline,scope.budget,scope.signal));
            if(!await effectiveBoundaryUnchanged(root,previous,scope))throw new Error("Effective Git ignore/configuration boundary changed during indexed observation; retry the complete observation");
            const metadata={...(changed?.metadata??previous),watchman,gitWatchmen,gitSourceHash:verifiedGitSource?.hash??previous.gitSourceHash};
            scope.signal.throwIfAborted();const published=await store.publishWhenReady(head.generation,{contract:head.contract,metadata},merge(changed?.delta??{},stageDelta),{retainGeneration:changed===undefined,signal:scope.signal});
            return handle(store,metadata,published.generation,changed===undefined?"unchanged":"delta",changed?.paths??[]);
            }
          }
          reason=paths.length>0?"known-source-delta":"changed-or-unknown-git-inputs";
        }else reason=delta.kind==="rediscovery"?delta.reason:"incomplete-provider-coverage";
        } catch (error) {
          if (!(error instanceof WatchmanSynchronizationUnavailableError)) throw error;
          reason="watchman-synchronization-unavailable";
        }
      }
      const watchman=await enrollWatchman(root,scope.budget,scope.signal);
      let directories:string[]=[];
      try{directories=await gitDirectories(root,scope.budget,scope.signal);}catch(error){
        try{await lstat(resolve(root,".git"));throw error;}catch(markerError){if(!(typeof markerError==="object"&&markerError!==null&&"code"in markerError&&markerError.code==="ENOENT"))throw markerError;}
      }
      const gitWatchmen:WatchmanBaseline[]=[];for(const directory of directories){const enrolled=await enrollWatchman(directory,scope.budget,scope.signal);if(enrolled!==undefined)gitWatchmen.push(enrolled);}
      const capturedGitSource=directories.length===0?undefined:await gitSource(root,scope);
      const collected=scannedInventory===undefined?await collectLocalRepositoryInputs({repositoryRoot:root,budget:scope.budget,signal:scope.signal,contentStore:await captureStore(root,scope)}):{
        options:{repositoryRoot:root},inventoryResult:scannedInventory,
        gitFacts:await collectGitFacts(root,scannedInventory.entries.map(entry=>entry.path),{budget:scope.budget,signal:scope.signal,entries:scannedInventory.entries,...(scannedInventory.contentStore===undefined?{}:{contentStore:scannedInventory.contentStore}),confirmedNonGit:scannedInventory.enumeration.method==="recursive-filesystem-fallback"})
      };
      const canonicalSources=await collectCanonicalSnapshotSources(root,scope.budget,scope.signal);
      let summary:IndexedColdResult, prepared:IndexedObservationDelta, stage:ObservationStageDescriptor|undefined;
      if(options.enrollment===undefined){
        const target=await (await RepositoryPathService.create(location.cacheRoot)).resolveWrite(`.projector/runtime/observations/index.sqlite.temporary/${randomUUID().replaceAll("-", "")}.db`);
        await mkdir(dirname(target.realTarget),{recursive:true});
        stage={schemaVersion:"projector.observation-stage/v1",path:target.realTarget};
        const stagePath=stage.path;
        scope.registerCleanup(async()=>{for(const suffix of ["","-journal","-wal","-shm"])await rm(stagePath+suffix,{force:true});});
        summary=await runObservationTask("observe-indexed",{collected,canonicalSources,stage},scope);
        prepared={upserts:collected.inventoryResult.entries.map(value=>({kind:"inventory",key:value.path,value}))};
      }else{
        const data=await runObservationTask("observe",{collected,canonicalSources},scope);
        const summarized=summarizeColdObservation(data,collected.inventoryResult);
        summary=summarized.summary;
        prepared=merge(sourceRecords(data,collected.inventoryResult.entries),await options.enrollment.cold(data),summarized.manifestDelta);
      }
      const stages=summary.analysisHeader.git.availability==="available"?await stagedPaths(root,scope):[];
      let completedWatchman=watchman;
      const completedGit:WatchmanBaseline[]=[];
      try {
        if(watchman!==undefined)completedWatchman=await verifyWatchmanChanges(watchman,scope.budget,scope.signal,exclusions,summary.analysisHeader.git.availability==="available");
        for(const baseline of gitWatchmen)completedGit.push(await verifyWatchmanChanges(baseline,scope.budget,scope.signal));
      } catch (error) {
        if (!(error instanceof WatchmanSynchronizationUnavailableError)) throw error;
        completedWatchman=undefined;
        completedGit.length=0;
      }
      if(completedWatchman===undefined)await verifyCapturedInventory(root,collected.inventoryResult,scope);
      const verifiedCanonical=canonicalSourceHash(await collectCanonicalSnapshotSources(root,scope.budget,scope.signal));
      if(verifiedCanonical!==canonicalSourceHash(canonicalSources))throw new Error("Canonical sources changed during indexed computation; retry before publication");
      const verifiedGitSource=summary.analysisHeader.git.availability==="available"?await gitSource(root,scope):undefined;
      if(capturedGitSource?.hash!==verifiedGitSource?.hash||verifiedGitSource!==undefined&&verifiedGitSource.revision!==summary.analysisHeader.git.revision)
        throw new Error("Git source boundary changed during indexed computation; retry before publication");
      const metadata:IndexedObservationMetadata={...summary,
        moveCandidates:{deleted:collected.gitFacts.pendingMoveCandidates?.deleted.length??0,untracked:collected.gitFacts.pendingMoveCandidates?.untracked.length??0},
        schemaVersion:INDEXED_OBSERVATION_CONTRACT,checkoutId:location.checkoutId,repositoryRoot:root,
        inventoryDescriptor:collected.inventoryResult.observationDescriptor,enumeration:collected.inventoryResult.enumeration,
        canonicalSourceHash:canonicalSourceHash(canonicalSources),
        gitSourceHash:verifiedGitSource?.hash??hashFramedDomain("indexed-no-git-source",collected.inventoryResult.enumeration.method),
        contractHash:"" as ContentHash,...(completedWatchman===undefined?{}:{watchman:completedWatchman}),gitWatchmen:completedGit,gitDirectories:directories,rebuildReason:reason};
      const completed={...metadata,contractHash:contract(metadata)};
      scope.signal.throwIfAborted();scope.budget.check("indexed-generation-publication");
      const published=await store.publishWhenReady(head?.generation??null,{contract:completed.contractHash,metadata:completed},{...merge(prepared,{upserts:(collected.inventoryResult.directories??[]).map(key=>({kind:"inventory-directory",key,value:true})),populations:stages.map(member=>({selector:"git-staged-path",member,present:true}))}),rebuild:true},{signal:scope.signal,...(stage===undefined?{}:{stage})});
      return handle(store,completed,published.generation,"rebuild",[]);
    }catch(error){store.close();throw error;}
  });
}
