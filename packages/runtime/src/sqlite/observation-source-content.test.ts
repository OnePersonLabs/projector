import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { afterEach, expect, it } from "vitest";
import { hashFramedDomain, ObservationBudget } from "@projector/core";
import { SqliteObservationStore } from "./observation-store.js";
import { SqliteObservationSourceCapture } from "./observation-source-content.js";
import { collectUnusedSourceVersions, sourceLifetimePath } from "./observation-source-lifetime.js";

function sourceCounts(path: string): {versions:number;captures:number;entries:number} {
  const db=new DatabaseSync(path);
  try {
    const count=(table:string):number => (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {count:number}).count;
    return {versions:count("observation_source_versions"),captures:count("observation_source_captures"),entries:count("observation_source_capture_entries")};
  } finally { db.close(); }
}

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, {recursive:true,force:true}); });

it("stores binary source once, reuses its sealed version, and keeps the published head after capture disposal", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-source-version-")); roots.push(root);
  const path = join(root, "index.sqlite");
  const source = join(root, "binary.dat");
  const bytes = Buffer.from([0, 0xff, 0xc3, 0xa9, 1]);
  await writeFile(source, bytes);
  const store = new SqliteObservationStore(path);
  const first = await SqliteObservationSourceCapture.create(path);
  try {
    const entry = await first.capture("binary.dat", source, "application/octet-stream", new ObservationBudget());
    expect(entry.contentHash).toBe(hashFramedDomain("repository-artifact-content", bytes.toString("base64")));
    await first.finish();
    const workerReader=SqliteObservationSourceCapture.open({...first.descriptor,paths:["binary.dat"]});
    try {
      const restored=workerReader.entries()[0]! as unknown as {contentChunks:()=>Iterable<Uint8Array>};
      expect([...restored.contentChunks()]).toEqual(expect.arrayContaining([bytes]));
    }
    finally { workerReader.close(); }
    const head = store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"inventory",key:"binary.dat",value:entry}]});
    const versionId = (entry as typeof entry & {sourceVersionId:string}).sourceVersionId;
    await first.dispose();
    const second = await SqliteObservationSourceCapture.create(path);
    try {
      const reused = await second.capture("binary.dat", source, "application/octet-stream", new ObservationBudget());
      expect((reused as typeof reused & {sourceVersionId:string}).sourceVersionId).toBe(versionId);
      await second.finish();
      const next = store.publish(head.generation,head,{upserts:[{kind:"inventory",key:"binary.dat",value:reused}]});
      await second.dispose();
      const restored = store.inventoryEntryAt<{contentHash:string;contentChunks:()=>Iterable<Uint8Array>}>(next.generation,"binary.dat")!;
      expect(Buffer.concat([...restored.contentChunks()].map(chunk=>Buffer.from(chunk)))).toEqual(bytes);
      const db = new DatabaseSync(path);
      try {
        expect((db.prepare("SELECT COUNT(*) AS count FROM observation_source_versions WHERE sealed=1").get() as {count:number}).count).toBe(1);
        expect((db.prepare("SELECT COUNT(*) AS count FROM observation_source_capture_entries").get() as {count:number}).count).toBe(0);
      } finally { db.close(); }
    } finally { await second.dispose(); }
  } finally { await first.dispose(); store.close(); }
});

it("rejects an incomplete capture and preserves the preceding head", async () => {
  const root = await mkdtemp(join(tmpdir(), "projector-source-rollback-")); roots.push(root);
  const path = join(root, "index.sqlite");
  const source = join(root, "source.ts");
  await writeFile(source, "export const value = 1;\n");
  const store = new SqliteObservationStore(path);
  const first = store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"marker",key:"old",value:true}]});
  const capture = await SqliteObservationSourceCapture.create(path);
  try {
    const entry = await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
    expect(() => store.publish(first.generation,first,{upserts:[{kind:"inventory",key:"source.ts",value:entry}]})).toThrow("capture is missing or incomplete");
    expect(store.head()?.generation).toBe(first.generation);
    expect(store.get("marker","old")).toBe(true);
  } finally { await capture.dispose(); store.close(); }
});

it("keeps a legacy source readable until a verified version replaces it", async () => {
  const root=await mkdtemp(join(tmpdir(),"projector-source-migration-"));roots.push(root);
  const path=join(root,"index.sqlite"),source=join(root,"source.ts");
  const old="export const value=1;\n",replacement="export const value=2;\n";
  await writeFile(source,replacement);
  const store=new SqliteObservationStore(path);
  const legacy={path:"source.ts",kind:"file",mediaType:"text/typescript",content:old,
    contentHash:hashFramedDomain("repository-artifact-content",Buffer.from(old).toString("base64")),generated:false};
  const head=store.publish(null,{contract:"v1",metadata:{}},{upserts:[{kind:"inventory",key:"source.ts",value:legacy}]});
  const capture=await SqliteObservationSourceCapture.create(path);
  try{
    const next=await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
    expect(store.get<{content:string}>("inventory","source.ts")?.content).toBe(old);
    expect(() => store.publish(head.generation,{contract:"v2",metadata:{}},
      {upserts:[{kind:"inventory",key:"source.ts",value:next}]})).toThrow("capture is missing or incomplete");
    expect(store.get<{content:string}>("inventory","source.ts")?.content).toBe(old);
    await capture.finish();
    store.publish(head.generation,{contract:"v2",metadata:{}},
      {upserts:[{kind:"inventory",key:"source.ts",value:next}]});
    await capture.dispose();
    expect(store.get<{content:string}>("inventory","source.ts")?.content).toBe(replacement);
  }finally{await capture.dispose();store.close();}
});

it("cancels capture admission without changing the completed observation",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-admission-"));roots.push(root);
  const path=join(root,"index.sqlite");
  const store=new SqliteObservationStore(path);
  const head=store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"marker",key:"old",value:true}]});
  const rival=new DatabaseSync(path,{timeout:0});
  try{
    rival.exec("BEGIN IMMEDIATE");
    const controller=new AbortController();
    const pending=SqliteObservationSourceCapture.create(path,new ObservationBudget(),controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    rival.exec("COMMIT");
    expect(store.head()?.generation).toBe(head.generation);
    expect(store.get("marker","old")).toBe(true);
  }finally{if(rival.isTransaction)rival.exec("ROLLBACK");rival.close();store.close();}
});

it("collects replaced and deleted versions while preserving the current source",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-collect-"));roots.push(root);
  const path=join(root,"index.sqlite"),source=join(root,"source.ts");
  const store=new SqliteObservationStore(path);
  try {
    let generation:number|null=null;
    for(const content of ["first", "second", "third"]){
      await writeFile(source,content);
      const capture=await SqliteObservationSourceCapture.create(path);
      try {
        const entry=await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
        await capture.finish();
        generation=store.publish(generation,{contract:"test",metadata:{}},{upserts:[{kind:"inventory",key:"source.ts",value:entry}]}).generation;
      } finally { await capture.dispose(); }
      expect(sourceCounts(path)).toEqual({versions:1,captures:0,entries:0});
      expect(store.get<{content:string}>("inventory","source.ts")?.content).toBe(content);
    }
    store.publish(generation,{contract:"test",metadata:{}},{deletes:[{kind:"inventory",key:"source.ts"}]});
    expect(sourceCounts(path)).toEqual({versions:0,captures:0,entries:0});
  } finally { store.close(); }
});

it("keeps capture entries while a separate reader outlives the creator",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-reader-"));roots.push(root);
  const path=join(root,"index.sqlite"),source=join(root,"source.ts");
  await writeFile(source,"retained");
  const store=new SqliteObservationStore(path);
  const capture=await SqliteObservationSourceCapture.create(path);
  let reader:SqliteObservationSourceCapture|undefined;
  try {
    const entry=await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
    await capture.finish();
    reader=SqliteObservationSourceCapture.open(capture.descriptor);
    await capture.dispose();
    expect(reader.read("source.ts")).toBe("retained");
    expect(sourceCounts(path)).toEqual({versions:1,captures:1,entries:1});
    store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"inventory",key:"source.ts",value:entry}]});
    reader.close(); reader=undefined;
    expect(sourceCounts(path)).toEqual({versions:1,captures:0,entries:0});
  } finally { reader?.close(); await capture.dispose(); store.close(); }
});

it("releases a source read transaction when a chunk iterator ends early",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-iterator-"));roots.push(root);
  const path=join(root,"index.sqlite"),source=join(root,"source.ts");
  await writeFile(source,"first chunk");
  const store=new SqliteObservationStore(path);
  const capture=await SqliteObservationSourceCapture.create(path);
  try {
    await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
    await capture.finish();
    for(const _chunk of capture.chunks("source.ts"))break;
    await capture.dispose();
    expect(sourceCounts(path)).toEqual({versions:0,captures:0,entries:0});
  } finally { await capture.dispose(); store.close(); }
});

it("reclaims finished and unfinished captures after a process dies without cleanup",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-crash-"));roots.push(root);
  const path=join(root,"index.sqlite"),source=join(root,"source.ts");
  await writeFile(source,"published");
  const store=new SqliteObservationStore(path);
  const capture=await SqliteObservationSourceCapture.create(path);
  try {
    const entry=await capture.capture("source.ts",source,"text/typescript",new ObservationBudget());
    await capture.finish();
    store.publish(null,{contract:"test",metadata:{}},{upserts:[{kind:"inventory",key:"source.ts",value:entry}]});
  } finally { await capture.dispose(); store.close(); }
  const script=`
    import { DatabaseSync } from 'node:sqlite';
    const path=process.argv[1];
    const lease=new DatabaseSync(path+'.source-lifetime.sqlite');
    lease.exec('BEGIN');lease.prepare('SELECT COUNT(*) FROM sqlite_schema').get();
    const db=new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys=ON');
    for(const [id,sealed] of [['finished',1],['unfinished',0]]) {
      db.prepare('INSERT INTO observation_source_captures VALUES(?,?)').run(id,sealed);
      db.prepare('INSERT INTO observation_source_versions VALUES(?,?,?,?,?,?)').run(id,'file',id,3,sealed,id);
      db.prepare('INSERT INTO observation_source_chunks VALUES(?,?,?)').run(id,0,Buffer.from('old'));
      if(sealed)db.prepare('INSERT INTO observation_source_capture_entries VALUES(?,?,?,?)').run(id,id+'.ts',id,'{}');
    }
    process.stdout.write('ready\\n');
    setInterval(()=>{},1000);
  `;
  const child=spawn(process.execPath,["--input-type=module","-e",script,path],{stdio:["ignore","pipe","pipe"]});
  try {
    await new Promise<void>((resolve,reject)=>{
      child.stdout.once("data",data=>String(data).includes("ready")?resolve():reject(new Error(String(data))));
      child.once("exit",code=>reject(new Error(`Crash fixture exited early: ${code}`)));
    });
    expect(sourceCounts(path)).toEqual({versions:3,captures:2,entries:1});
    expect(collectUnusedSourceVersions(path)).toBe(false);
  } finally {
    child.kill();
    if(child.exitCode===null&&child.signalCode===null)
      await new Promise<void>(resolve=>child.once("exit",()=>resolve()));
  }
  const recovered=new SqliteObservationStore(path);
  try {
    expect(sourceCounts(path)).toEqual({versions:1,captures:0,entries:0});
    expect(recovered.get<{content:string}>("inventory","source.ts")?.content).toBe("published");
  } finally { recovered.close(); }
});

it("waits for an exclusive collector lock and cancels admission without pinning a capture",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-source-admission-lock-"));roots.push(root);
  const path=join(root,"index.sqlite");
  const store=new SqliteObservationStore(path);
  const guard=new DatabaseSync(sourceLifetimePath(path),{timeout:0});
  try {
    guard.exec("BEGIN EXCLUSIVE");
    const controller=new AbortController();
    const cancelled=SqliteObservationSourceCapture.create(path,new ObservationBudget(),controller.signal);
    await new Promise(resolve=>setTimeout(resolve,60));
    controller.abort();
    await expect(cancelled).rejects.toThrow();
    expect(sourceCounts(path)).toEqual({versions:0,captures:0,entries:0});
    const waiting=SqliteObservationSourceCapture.create(path);
    await new Promise(resolve=>setTimeout(resolve,60));
    guard.exec("COMMIT");
    const capture=await waiting;
    await capture.dispose();
    expect(sourceCounts(path)).toEqual({versions:0,captures:0,entries:0});
  } finally { if(guard.isTransaction)guard.exec("ROLLBACK");guard.close();store.close(); }
});
