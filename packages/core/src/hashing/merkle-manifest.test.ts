import { expect,it } from "vitest";
import { buildManifest, updateManifest, type ManifestNode } from "./merkle-manifest.js";
const entry=(index:number)=>({key:index.toString(16).padStart(64,"0"),value:{path:`source-${index}`,content:`bytes-${index}`}});
it("matches cold roots through edits, additions, deletions, splits and collapse/re-enrollment",()=>{
  let entries=Array.from({length:100},(_,index)=>entry(index));
  let baseline=buildManifest(entries);const stored=new Map(baseline.nodes);
  const changes=[...Array.from({length:90},(_,index)=>({key:entry(index).key})),...Array.from({length:90},(_,index)=>entry(index+100))];
  entries=[...entries.slice(90),...Array.from({length:90},(_,index)=>entry(index+100))];
  const next=updateManifest(baseline.root,changes,prefix=>stored.get(prefix));
  for(const prefix of next.removed)stored.delete(prefix);for(const[prefix,node]of next.nodes)stored.set(prefix,node);
  expect(next.root).toBe(buildManifest(entries).root);
  const repeated=updateManifest(next.root,[{key:entry(100).key,value:{path:"source-100",content:"edited-again"}}],prefix=>stored.get(prefix));
  expect(repeated.root).toBe(buildManifest(entries.map(item=>item.key===entry(100).key?{...item,value:{path:"source-100",content:"edited-again"}}:item)).root);
});
it("rejects duplicate keys and corrupt addressed nodes",()=>{
  expect(()=>buildManifest([entry(1),{...entry(1),value:"collision"}])).toThrow("duplicate");
  const baseline=buildManifest([entry(1)]);
  const root={...baseline.nodes.get("")!,entries:[entry(2)]} as ManifestNode;
  expect(()=>updateManifest(baseline.root,[entry(3)],()=>root)).toThrow("content mismatch");
});
