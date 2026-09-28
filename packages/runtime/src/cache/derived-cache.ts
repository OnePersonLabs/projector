import { SqliteObservationStore } from "../sqlite/observation-store.js";
import { ObservationBudget } from "@projector/core";

export const DERIVED_CACHE_MAX_BYTES = 256 * 1024 * 1024;
export interface DerivedCacheBudget { deadline: number; remainingEntries: number; remainingBytes: number }
export interface DerivedCacheWrite { readonly relativePath: string; readonly content: string }
export interface DerivedCacheEntry { readonly relativePath: string; readonly bytes: number; readonly lastUsedMs: number; readonly kind: "context" | "impact" | "staging" }
export interface DerivedCacheOptions { readonly maxBytes?: number; readonly signal?: AbortSignal; readonly deadline?: number; readonly budget?: DerivedCacheBudget }
export interface DerivedCacheSession {
  readonly entries: readonly DerivedCacheEntry[];
  readonly totalBytes: number;
  publish(relativePath: string, content: string): Promise<void>;
  publishAll(writes: readonly DerivedCacheWrite[]): Promise<void>;
  remove(entry: DerivedCacheEntry): Promise<void>;
}
export class DerivedCacheError extends Error {
  constructor(readonly code: "cache-capacity" | "cache-corrupt" | "cache-busy" | "cache-budget", message: string) { super(message); this.name = "DerivedCacheError"; }
}

/** Serializes admission across processes. Every publication accounts for the staging peak first. */
export async function withDerivedCacheAdmission<T>(root: string, body: (session: DerivedCacheSession) => Promise<T>, options: DerivedCacheOptions = {}): Promise<T> {
  return withIndexedCacheAdmission(root,body,options);
}
function classify(path: string): DerivedCacheEntry["kind"] {
  const match = /^\.projector\/runtime\/(knowledge\/contexts\/[0-9a-f]{32}|impact\/[0-9a-f]{64})\.json(\.\d+\.(?:[0-9a-f-]+)\.tmp)?$/u.exec(path);
  if (match === null) throw new DerivedCacheError("cache-corrupt", `Unrecognized disposable cache entry: ${path}`);
  return match[2] !== undefined ? "staging" : path.includes("/contexts/") ? "context" : "impact";
}
export function checkDerivedCacheBudget(budget: DerivedCacheBudget): void {
  if (Date.now() > budget.deadline || budget.remainingEntries < 0 || budget.remainingBytes < 0) throw new DerivedCacheError("cache-budget", "Derived cache maintenance could not complete its bounded safety inspection; no unproven entries may be removed");
}
function checkAdmission(signal?: AbortSignal, deadline?: number): void {
  signal?.throwIfAborted();
  if (deadline !== undefined && Date.now() >= deadline) throw new DerivedCacheError("cache-budget", "Derived cache publication exceeded the operation deadline; retry with an explicit larger observation allowance");
}

interface CacheSource { readonly content:string; readonly lastUsedMs:number }
async function withIndexedCacheAdmission<T>(root:string,body:(session:DerivedCacheSession)=>Promise<T>,options:DerivedCacheOptions):Promise<T> {
  checkAdmission(options.signal,options.deadline ?? options.budget?.deadline);
  const deadline=options.deadline ?? options.budget?.deadline ?? Date.now()+5000;
  const store=await SqliteObservationStore.open(root,{ budget:new ObservationBudget({ timeoutMs:Math.max(1,Math.ceil(deadline-Date.now())), ...(options.budget === undefined ? {} : { maxDerivedBytes: options.budget.remainingBytes }) }), ...(options.signal===undefined?{}:{signal:options.signal}), ...(options.maxBytes===undefined?{}:{maxBytes:options.maxBytes}) });
  let active=true, inspected:Map<string,DerivedCacheEntry>|undefined;
  const inspectedHashes=new Map<string,string>();
  const check=():void=>{ if(!active)throw new DerivedCacheError("cache-busy","Cache admission session is closed"); checkAdmission(options.signal,deadline); };
  const session:DerivedCacheSession={
    get totalBytes(){ check();return store.totalBytes; },
    get entries(){
      check(); if(inspected===undefined){ inspected=new Map();inspectedHashes.clear();for(const record of store.cacheEntries()){
        const entry:DerivedCacheEntry={relativePath:record.key,bytes:record.bytes,lastUsedMs:record.lastUsedMs,kind:classify(record.key)};
        if(options.budget!==undefined){options.budget.remainingEntries--;checkDerivedCacheBudget(options.budget);}
        inspected.set(record.key,entry);
        inspectedHashes.set(record.key,record.valueHash);
      }}return [...inspected.values()];
    },
    async publish(relativePath,content){await this.publishAll([{relativePath,content}]);},
    async publishAll(writes){
      check();const unique=new Map<string,string>();const assertions:{kind:string;key:string;expected:unknown}[]=[];
      for(const write of writes){if(classify(write.relativePath)==="staging")throw new DerivedCacheError("cache-corrupt","Cannot publish a staging path");
        if(unique.has(write.relativePath)&&unique.get(write.relativePath)!==write.content)throw new DerivedCacheError("cache-corrupt","Conflicting cache batch addresses");
        const existing=store.get<CacheSource>("cache-source",write.relativePath);
        if(existing!==undefined&&existing.content!==write.content)throw new DerivedCacheError("cache-corrupt",`Derived cache content differs at ${write.relativePath}; inspect this disposable entry before refreshing context`);
        assertions.push({kind:"cache-source",key:write.relativePath,expected:existing});
        unique.set(write.relativePath,write.content);
      }
      const head=store.head();
      try{store.publish(head?.generation??null,head??{contract:"projector-cache-owner/v1",metadata:{}},{upserts:[...unique].map(([key,content])=>({kind:"cache-source",key,value:{content,lastUsedMs:Date.now()}}))},{retainGeneration:true,preserveMetadata:true,assertions,...(options.signal===undefined?{}:{signal:options.signal})});}
      catch(error){if(error instanceof Error&&"code"in error&&error.code==="observation-limit-exceeded")throw new DerivedCacheError("cache-capacity","Shared disposable cache cannot admit the transaction including database and rollback journal peak; finish active operations or maintain the cache before retrying");throw error;}
      inspected=undefined;
    },
    async remove(entry){
      check();if(inspected?.get(entry.relativePath)!==entry)throw new DerivedCacheError("cache-corrupt","Cache deletion did not name an inspected entry");
      const head=store.head()!;
      try { store.publish(head.generation,head,{deletes:[{kind:"cache-source",key:entry.relativePath}]},{retainGeneration:true,preserveMetadata:true,assertions:[{kind:"cache-source",key:entry.relativePath,expectedHash:inspectedHashes.get(entry.relativePath)!}]}); }
      catch(error) { if(error instanceof Error && "code" in error && error.code === "observation-record-changed")throw new DerivedCacheError("cache-corrupt","Cache entry changed after inspection");throw error; }
      inspected!.delete(entry.relativePath);
    },
  };
  try{const result=await body(session);check();return result;}finally{active=false;store.close();}
}
/** New disposable cache reads are addressed SQL lookups. The consumer retains
 * its historical local-file fallback and performs content authentication.
 */
export async function readDerivedCacheSource(root:string,relativePath:string,options:{readonly budget?:ObservationBudget;readonly signal?:AbortSignal}={}):Promise<string|undefined>{
  classify(relativePath);const store=await SqliteObservationStore.open(root,options);
  try{return store.get<CacheSource>("cache-source",relativePath)?.content;}finally{store.close();}
}
export async function touchDerivedCacheEntry(root:string,relativePath:string):Promise<void>{
  classify(relativePath);const store=await SqliteObservationStore.open(root);
  try{const source=store.get<CacheSource>("cache-source",relativePath);if(source===undefined)return;
    const head=store.head()!;store.publish(head.generation,head,{upserts:[{kind:"cache-source",key:relativePath,value:{...source,lastUsedMs:Date.now()}}]},{retainGeneration:true,preserveMetadata:true,assertions:[{kind:"cache-source",key:relativePath,expected:source}]});
  }finally{store.close();}
}
