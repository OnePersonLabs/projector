import {localImportCandidates,localSemanticKey,type InventoryEntry} from "@projector/analyzers";
import {hashFramedDomain} from "@projector/core";
import type {IndexedObservationDelta} from "@projector/runtime";
import type {RepositoryObservationData} from "../observation/tasks.js";
type StoreRow={kind:string;key:string;value:unknown};
type Population={selector:string;member:string;present:boolean};
function recordPopulation(rows:StoreRow[],populations:Population[],kind:string,items:readonly unknown[],key:(item:unknown)=>string):void{
  for(const item of items){const id=key(item);rows.push({kind,key:id,value:item});populations.push({selector:kind,member:id,present:true});}
  rows.push({kind:"population-version",key:kind,value:hashFramedDomain("indexed-population-v1",items.map(key))});
}
export function sourceRecords(data:RepositoryObservationData,inventory:readonly InventoryEntry[]):IndexedObservationDelta{
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
  for(const [key,value] of Object.entries(data.analysis))if(!["files","artifacts","projectionUnits","gitIdentities","dependencies","testTargets","javaScript","documents","markdown","actions"].includes(key))rows.push({kind:"analysis-global",key,value:key==="git"?{...data.analysis.git,identities:[]}:value});
  for(const [key,value] of Object.entries(data.analysis.javaScript))if(!["files","dependencies","testTargets"].includes(key))rows.push({kind:"javascript-global",key,value});
  rows.push({kind:"canonical-manifest",key:"entries",value:data.canonical.entries});
  return{upserts:rows,populations,dependencies:[...data.analysis.dependencies.flatMap(item=>localImportCandidates(item.importerPath,item.specifier).map(path=>({consumer:item.importerPath,input:`path:${path}`,present:true}))),...data.analysis.packageScriptInvocations.map(item=>({consumer:item.manifestPath,input:`path:${item.targetPath}`,present:true}))]};
}
