import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StatementSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { readDerivedCacheSource, touchDerivedCacheEntry, withDerivedCacheAdmission } from "./derived-cache.js";
const context = `.projector/runtime/knowledge/contexts/${"a".repeat(32)}.json`;
const impact = `.projector/runtime/impact/${"b".repeat(64)}.json`;
const roots:string[]=[];
afterEach(async()=>{vi.unstubAllEnvs();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function project(){const root=await mkdtemp(join(tmpdir(),"projector-cache-"));roots.push(root);const cache=await mkdtemp(join(tmpdir(),"projector-cache-owner-"));roots.push(cache);vi.stubEnv("PROJECTOR_CACHE_DIRECTORY",cache);return root;}
it("reserves the complete batch before publishing any context or dependency",async()=>{
  const root=await project();await expect(withDerivedCacheAdmission(root,cache=>cache.publishAll([{relativePath:impact,content:"a".repeat(400)},{relativePath:context,content:"b".repeat(400)}]),{maxBytes:700})).rejects.toMatchObject({code:"cache-capacity"});
  expect(await readDerivedCacheSource(root,context)).toBeUndefined();expect(await readDerivedCacheSource(root,impact)).toBeUndefined();
});
it("accounts shared row overhead and admits only the fitting concurrent writer",async()=>{
  const root=await project();const results=await Promise.allSettled([withDerivedCacheAdmission(root,cache=>cache.publish(context,"a".repeat(200)),{maxBytes:700}),withDerivedCacheAdmission(root,cache=>cache.publish(impact,"b".repeat(200)),{maxBytes:700})]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);expect(results.filter(result=>result.status==="rejected")).toHaveLength(1);
  await withDerivedCacheAdmission(root,async cache=>{expect(cache.totalBytes).toBeGreaterThan(200);expect(cache.entries).toHaveLength(1);});
});
it("reuses identical content and refuses a conflicting immutable cache address",async()=>{
  const root=await project();await withDerivedCacheAdmission(root,cache=>cache.publish(context,"same bytes"));await withDerivedCacheAdmission(root,cache=>cache.publish(context,"same bytes"));
  await expect(withDerivedCacheAdmission(root,cache=>cache.publish(context,"different"))).rejects.toMatchObject({code:"cache-corrupt"});expect(await readDerivedCacheSource(root,context)).toBe("same bytes");
});
it("preserves historical local evidence and interrupted staging without enrolling it",async()=>{
  const root=await project();await mkdir(join(root,".projector/runtime/knowledge/contexts"),{recursive:true});await writeFile(join(root,context),"historical");await writeFile(join(root,`${context}.123.456.tmp`),"interrupted");
  await withDerivedCacheAdmission(root,async cache=>{expect(cache.entries).toEqual([]);expect(cache.totalBytes).toBe(0);await cache.publish(context,"new external");});
  expect(await readFile(join(root,context),"utf8")).toBe("historical");expect(await readFile(join(root,`${context}.123.456.tmp`),"utf8")).toBe("interrupted");expect(await readDerivedCacheSource(root,context)).toBe("new external");
});
it("rejects removal after a concurrent reader touch and permits fresh inspected removal",async()=>{
  const root=await project();await withDerivedCacheAdmission(root,cache=>cache.publish(context,"same bytes"));
  await withDerivedCacheAdmission(root,async cache=>{const inspected=cache.entries[0]!;vi.spyOn(Date,"now").mockReturnValue(inspected.lastUsedMs+1);try{await touchDerivedCacheEntry(root,context);}finally{vi.restoreAllMocks();}await expect(cache.remove(inspected)).rejects.toMatchObject({code:"cache-corrupt"});});
  await withDerivedCacheAdmission(root,async cache=>cache.remove(cache.entries[0]!));expect(await readDerivedCacheSource(root,context)).toBeUndefined();
});
it("does not publish after deadline or cancellation",async()=>{
  const root=await project();await expect(withDerivedCacheAdmission(root,cache=>cache.publish(context,"too late"),{deadline:Date.now()-1})).rejects.toMatchObject({code:"cache-budget"});await expect(withDerivedCacheAdmission(root,cache=>cache.publish(context,"canceled"),{signal:AbortSignal.abort(new Error("interrupted"))})).rejects.toThrow("interrupted");expect(await readDerivedCacheSource(root,context)).toBeUndefined();
});
it("removes an unprotected payload larger than the current derived allowance using bounded digest chunks",async()=>{
  const root=await project();await withDerivedCacheAdmission(root,cache=>cache.publish(context,"large serialized payload".repeat(10_000)));
  const original=StatementSync.prototype.get;let maximumReturnedBytes=0,chunks=0;
  const spy=vi.spyOn(StatementSync.prototype,"get").mockImplementation(function(this:StatementSync,...args){
    const result=original.apply(this,args);
    for(const value of Object.values(result??{})){if(typeof value==="string")maximumReturnedBytes=Math.max(maximumReturnedBytes,Buffer.byteLength(value));else if(value instanceof Uint8Array){maximumReturnedBytes=Math.max(maximumReturnedBytes,value.byteLength);chunks++;}}
    return result;
  });
  try { await withDerivedCacheAdmission(root,async cache=>{const inspected=cache.entries[0]!;expect(inspected.bytes).toBeGreaterThan(4096);await cache.remove(inspected);},{budget:{deadline:Date.now()+10_000,remainingBytes:4096,remainingEntries:10}}); }
  finally { spy.mockRestore(); }
  expect(chunks).toBeGreaterThan(1);expect(maximumReturnedBytes).toBeLessThanOrEqual(4096);
  expect(await readDerivedCacheSource(root,context)).toBeUndefined();
});
