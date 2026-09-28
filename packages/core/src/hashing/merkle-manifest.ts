import { hashFramedDomain } from "./canonical-json.js";
import type { ContentHash } from "../domain/contracts.js";

export interface ManifestEntry { readonly key:string; readonly value:unknown }
interface ManifestRef { readonly digest:ContentHash; readonly count:number }
export type ManifestNode = ManifestRef & ({readonly kind:"leaf";readonly entries:readonly ManifestEntry[]} | {readonly kind:"branch";readonly children:Readonly<Record<string,ManifestRef>>});
export interface ManifestUpdate { readonly root:ContentHash; readonly nodes:ReadonlyMap<string,ManifestNode>; readonly removed:readonly string[] }
const bucketSize=32;
export function manifestKey(path:string):string{return hashFramedDomain("projector-manifest-key/v1",path).slice("sha256:v1:".length);}
function leaf(prefix:string,entries:readonly ManifestEntry[]):ManifestNode{
  const sorted=[...entries].sort((a,b)=>a.key.localeCompare(b.key));
  return{kind:"leaf",entries:sorted,count:sorted.length,digest:hashFramedDomain("projector-manifest-leaf/v1",{prefix,entries:sorted})};
}
function branch(prefix:string,children:Readonly<Record<string,ManifestRef>>):ManifestNode{
  const ordered=Object.fromEntries(Object.entries(children).sort(([a],[b])=>a.localeCompare(b)));
  return{kind:"branch",children:ordered,count:Object.values(ordered).reduce((sum,child)=>sum+child.count,0),digest:hashFramedDomain("projector-manifest-branch/v1",{prefix,children:ordered})};
}
function build(prefix:string,entries:readonly ManifestEntry[],nodes:Map<string,ManifestNode>):ManifestNode{
  if(entries.length<=bucketSize){const node=leaf(prefix,entries);nodes.set(prefix,node);return node;}
  if(prefix.length>=64)throw new Error("Manifest hash collision exceeds bounded leaf capacity");
  const groups=new Map<string,ManifestEntry[]>();
  for(const entry of entries){const digit=entry.key[prefix.length]!;const group=groups.get(digit)??[];group.push(entry);groups.set(digit,group);}
  const children:Record<string,ManifestRef>={};for(const[digit,group]of groups){const node=build(prefix+digit,group,nodes);children[digit]={digest:node.digest,count:node.count};}
  const node=branch(prefix,children);nodes.set(prefix,node);return node;
}
export function buildManifest(entries:readonly ManifestEntry[]):ManifestUpdate{
  if(entries.some(entry=>!/^[0-9a-f]{64}$/u.test(entry.key))||new Set(entries.map(entry=>entry.key)).size!==entries.length)throw new Error("Manifest contains invalid or duplicate keys");
  const nodes=new Map<string,ManifestNode>();const root=build("",entries,nodes);return{root:root.digest,nodes,removed:[]};
}
/** Recompute only affected radix paths and bounded leaf buckets. Parent hashes
 * authenticate addressed nodes before cached values participate in a new root.
 */
export function updateManifest(root:ContentHash,changes:readonly {readonly key:string;readonly value?:unknown}[],read:(prefix:string)=>unknown):ManifestUpdate{
  const nodes=new Map<string,ManifestNode>(),removed=new Set<string>();
  const load=(prefix:string,expected:ManifestRef):ManifestNode=>{
    const value=nodes.get(prefix)??read(prefix);
    if(value===null||typeof value!=="object")throw new Error(`Manifest node missing: ${prefix}`);
    const node=value as ManifestNode;
    if(!Number.isSafeInteger(node.count)||node.count<0||node.digest!==expected.digest||node.count!==expected.count)throw new Error(`Manifest node identity mismatch: ${prefix}`);
    let computed:ManifestNode;
    if(node.kind==="leaf"&&Array.isArray(node.entries)){
      if(node.entries.length!==node.count||node.entries.some(entry=>typeof entry.key!=="string"||!/^[0-9a-f]{64}$/u.test(entry.key)||!entry.key.startsWith(prefix))||new Set(node.entries.map(entry=>entry.key)).size!==node.entries.length)throw new Error(`Manifest leaf invalid: ${prefix}`);
      computed=leaf(prefix,node.entries);
    }else if(node.kind==="branch"&&node.children!==null&&typeof node.children==="object"){
      if(prefix.length>=64||Object.entries(node.children).some(([digit,child])=>!/^[0-9a-f]$/u.test(digit)||!Number.isSafeInteger(child.count)||child.count<1||typeof child.digest!=="string"))throw new Error(`Manifest branch invalid: ${prefix}`);
      computed=branch(prefix,node.children);
    }else throw new Error(`Manifest node invalid: ${prefix}`);
    if(computed.digest!==expected.digest||computed.count!==expected.count)throw new Error(`Manifest node content mismatch: ${prefix}`);
    return node;
  };
  const collect=(prefix:string,reference:ManifestRef):ManifestEntry[]=>{
    const node=load(prefix,reference);removed.add(prefix);nodes.delete(prefix);
    return node.kind==="leaf"?[...node.entries]:Object.entries(node.children).flatMap(([digit,child])=>collect(prefix+digit,child));
  };
  const apply=(prefix:string,reference:ManifestRef,change:{readonly key:string;readonly value?:unknown}):ManifestNode=>{
    const node=load(prefix,reference);
    if(node.kind==="leaf"){
      const entries=node.entries.filter(entry=>entry.key!==change.key);if("value"in change)entries.push({key:change.key,value:change.value});
      return build(prefix,entries,nodes);
    }
    const digit=change.key[prefix.length]!,children={...node.children},prior=children[digit];
    let next:ManifestNode;
    if(prior===undefined){if(!("value"in change))return node;next=build(prefix+digit,[{key:change.key,value:change.value}],nodes);}
    else next=apply(prefix+digit,prior,change);
    if(next.count===0){delete children[digit];removed.add(prefix+digit);nodes.delete(prefix+digit);}else children[digit]={digest:next.digest,count:next.count};
    const count=Object.values(children).reduce((sum,child)=>sum+child.count,0);
    if(count<=bucketSize){const entries=Object.entries(children).flatMap(([childDigit,child])=>collect(prefix+childDigit,child));return build(prefix,entries,nodes);}
    const updated=branch(prefix,children);nodes.set(prefix,updated);return updated;
  };
  const rootValue=read("") as ManifestNode|undefined;if(rootValue===undefined||rootValue.digest!==root)throw new Error("Manifest root unavailable");
  let reference:ManifestRef={digest:root,count:rootValue.count};
  for(const change of changes){if(!/^[0-9a-f]{64}$/u.test(change.key))throw new Error("Manifest change key invalid");const node=apply("",reference,change);reference={digest:node.digest,count:node.count};}
  return{root:reference.digest,nodes,removed:[...removed].filter(prefix=>!nodes.has(prefix))};
}
