import {mkdtemp,mkdir,writeFile,rm,readFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {afterEach,expect,it} from "vitest";
import {ObservationBudget,hashFramedDomain} from "@projector/core";
import {InventoryContentStore,hydrateInventory,inventoryForTransport,inventoryEntryBytes,inventoryTextHash} from "./inventory-content-store.js";
import {inventoryRepository} from "./inventory.js";
import {analyzeCollectedLocalRepository,collectLocalRepositoryInputs} from "../local-repository.js";

const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){const root=await mkdtemp(join(tmpdir(),"projector-capture-"));roots.push(root);const repository=join(root,"repo");await mkdir(repository);return{root,repository};}
it("captures raw byte identities with bounded chunks and keeps immutable source bytes out of worker messages",async()=>{
  const {root,repository}=await fixture();
  const lengths=[0,1,2,3,65535,65536,65537,131075];
  for(const length of lengths){const bytes=Buffer.alloc(length);for(let i=0;i<length;i++)bytes[i]=i%256;await writeFile(join(repository,`${length}.bin`),bytes);}
  await writeFile(join(repository,"unicode.ts"),"// @generated\nexport const text = '你好☕';\n");
  const capture=InventoryContentStore.create(join(root,"capture"));
  try{
    const inventory=await inventoryRepository(repository,{contentStore:capture});
    for(const entry of inventory.entries){const bytes=await readFile(join(repository,entry.path));expect(entry.contentHash).toBe(hashFramedDomain("repository-artifact-content",bytes.toString("base64")));expect(entry.content).toBe(bytes.toString("utf8"));expect(inventoryEntryBytes(entry)).toBe(bytes.length);expect(inventoryTextHash(entry,"local-unit-fallback")).toBe(hashFramedDomain("local-unit-fallback",bytes.toString("utf8")));}
    expect(inventory.entries.find(entry=>entry.path==="unicode.ts")?.generated).toBe(true);
    const transport=inventoryForTransport(inventory);
    expect(transport.entries).toEqual([]);expect(JSON.stringify(transport).length).toBeLessThan(4000);
    await writeFile(join(repository,"unicode.ts"),"changed after capture");
    const hydrated=hydrateInventory(structuredClone(transport));
    try{expect(hydrated.inventory.entries.find(entry=>entry.path==="unicode.ts")?.content).toContain("你好☕");}finally{hydrated.close();}
    const subset=hydrateInventory(inventoryForTransport({...inventory,entries:inventory.entries.slice(0,2)}));
    try{expect(subset.inventory.entries.map(entry=>entry.path)).toEqual(inventory.entries.slice(0,2).map(entry=>entry.path));}finally{subset.close();}
  }finally{capture.dispose();}
});
it("analyzes opaque assets without requesting a complete source string and preserves old identities",async()=>{
  const {root,repository}=await fixture();await writeFile(join(repository,"asset.bin"),Buffer.from([0xff,0,0xfe,1,2,3]));
  const ordinary=await collectLocalRepositoryInputs({repositoryRoot:repository});
  const expected=analyzeCollectedLocalRepository(ordinary);
  const capture=InventoryContentStore.create(join(root,"capture"));
  try{
    const staged=await collectLocalRepositoryInputs({repositoryRoot:repository,contentStore:capture});
    const entries=staged.inventoryResult.entries.map(entry=>{
      const descriptors=Object.getOwnPropertyDescriptors(entry);
      return Object.defineProperties({},{...descriptors,content:{enumerable:true,get(){throw new Error("Whole opaque source string was requested");}}}) as typeof entry;
    });
    const actual=analyzeCollectedLocalRepository({...staged,inventoryResult:{...staged.inventoryResult,entries}});
    expect(actual).toEqual(expected);
  }finally{capture.dispose();}
});
it("keeps caller-requested byte ceilings and explicit cancellation effective",async()=>{
  const {root,repository}=await fixture();await writeFile(join(repository,"large.bin"),Buffer.alloc(65537));
  const capture=InventoryContentStore.create(join(root,"capture"));
  try{
    await expect(capture.capture("large.bin",join(repository,"large.bin"),"application/octet-stream",new ObservationBudget({maxFileBytes:65536}))).rejects.toMatchObject({limit:"maxFileBytes"});
    const controller=new AbortController();controller.abort(new Error("caller cancellation"));
    await expect(capture.capture("large.bin",join(repository,"large.bin"),"application/octet-stream",new ObservationBudget(),controller.signal)).rejects.toThrow("caller cancellation");
  }finally{capture.dispose();}
});
it("opens captures whose host-selected Windows path exceeds the legacy path length",async()=>{
  const {root,repository}=await fixture();await writeFile(join(repository,"a.ts"),"export const a = 1;");
  const capture=InventoryContentStore.create(join(root,"long-cache-owner-".repeat(8),"nested-cache-owner-".repeat(6)));
  try{expect(capture.descriptor.path.length).toBeGreaterThan(260);const inventory=await inventoryRepository(repository,{contentStore:capture});expect(inventory.entries[0]?.content).toBe("export const a = 1;");}finally{capture.dispose();}
});
