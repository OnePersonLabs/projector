import {EventEmitter} from "node:events";
import {PassThrough,Writable} from "node:stream";
import {execFile} from "node:child_process";
import {mkdtemp,writeFile,rm,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {promisify} from "node:util";
import {Worker} from "node:worker_threads";
import {afterEach,beforeEach,expect,it,vi} from "vitest";

const feed=vi.hoisted(()=>({events:new Map<string,{name:string;exists:boolean;type:string}[]>(),fresh:false,afterQuery:undefined as ((root:string)=>void)|undefined}));
const filesystemReads=vi.hoisted(()=>[] as string[]);
vi.mock("node:fs/promises",async importOriginal=>{
  const actual=await importOriginal<typeof import("node:fs/promises")>();
  return {...actual,open:(...args:Parameters<typeof actual.open>)=>{filesystemReads.push(String(args[0]));return actual.open(...args);},readFile:(...args:Parameters<typeof actual.readFile>)=>{filesystemReads.push(String(args[0]));return actual.readFile(...args);}};
});
vi.mock("node:child_process",async importOriginal=>{
  const actual=await importOriginal<typeof import("node:child_process")>();
  return{...actual,spawn:(executable:string,args:string[],options:unknown)=>{
    if(!args.includes("--no-spawn"))return actual.spawn(executable,args,options as Parameters<typeof actual.spawn>[2]);
    const child=new EventEmitter() as EventEmitter&{stdout:PassThrough;stderr:PassThrough;stdin:Writable;kill:()=>void};
    child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{queueMicrotask(()=>child.emit("close",null));};
    child.stdin=new Writable({write(chunk,_encoding,callback){
      const request=JSON.parse(String(chunk)) as [string,string,{since?:string}?];const root=resolve(request[1]);const events=feed.events.get(root)??[];
      let reply:unknown;
      if(request[0]==="watch")reply={watch:root};
      else if(request[0]==="get-config")reply={config:{ignore_vcs:root.endsWith(".git")?[]:[".git"]}};
      else if(request[0]==="clock")reply={clock:`c:${events.length}`};
      else reply={clock:`c:${events.length}`,is_fresh_instance:!feed.fresh,files:events.slice(Number(request[2]?.since?.slice(2)??0))};
      // A normal since-query is non-fresh; tests explicitly simulate cursor loss.
      if(request[0]==="query"){(reply as {is_fresh_instance:boolean}).is_fresh_instance=feed.fresh;feed.fresh=false;}
      callback();queueMicrotask(()=>{child.stdout.write(JSON.stringify(reply));child.emit("close",0);if(request[0]==="query")feed.afterQuery?.(root);});
    }});return child;
  }};
});
import {observeIndexedRepository} from "./indexed-observer.js";
import {observeChangeRepository,observeRepositoryState} from "./repository-observer.js";
import {RepositoryKnowledgeService} from "../knowledge/service.js";
import { DerivedObservationBudget, hashFramedDomain, withCanonicalHashes, type AdapterContext, type AuthorityRecord } from "@projector/core";
import { createRepositoryScriptLens } from "@projector/engine";
import { CanonicalFileRepository } from "@projector/runtime";
import { KnowledgeGraph, KNOWLEDGE_QUERY_PROGRAMS } from "../knowledge/graph.js";
import { IndexedKnowledgeGraph } from "../knowledge/indexed-graph.js";
import { IndexedGovernance } from "../knowledge/indexed-governance.js";
const exec=promisify(execFile),roots:string[]=[];
beforeEach(()=>{feed.events.clear();feed.fresh=false;feed.afterQuery=undefined;vi.stubEnv("PROJECTOR_WATCHMAN_EXECUTABLE",process.execPath);vi.stubEnv("PROJECTOR_WATCHMAN_SOCKET","indexed-fixture");});
afterEach(async()=>{vi.unstubAllEnvs();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture(){const root=await mkdtemp(join(tmpdir(),"projector-indexed-observer-"));roots.push(root);const cache=await mkdtemp(join(tmpdir(),"projector-indexed-cache-"));roots.push(cache);vi.stubEnv("PROJECTOR_CACHE_DIRECTORY",cache);await mkdir(join(root,"src"));await writeFile(join(root,"package.json"),'{"type":"module"}\n');await writeFile(join(root,"src","a.mjs"),"export const a = 1;\n");await exec("git",["init","-q"],{cwd:root});await exec("git",["add","."],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","baseline"],{cwd:root});return root;}
function changed(root:string,path:string,exists=true){const events=feed.events.get(resolve(root))??[];events.push({name:path,exists,type:"f"});feed.events.set(resolve(root),events);}

it("ignores untracked output churn in both notification brackets while retaining tracked ignored sources",async()=>{
  const root=await fixture();await writeFile(join(root,".gitignore"),"generated/\n*.log\n");await writeFile(join(root,"tracked.log"),"tracked baseline\n");
  await exec("git",["add",".gitignore"],{cwd:root});await exec("git",["add","-f","tracked.log"],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","ignore fixture"],{cwd:root});
  let observation=await observeIndexedRepository(root);const before=observation.descriptor;observation.close();
  await mkdir(join(root,"generated"));await writeFile(join(root,"generated/output.mjs"),"export const ignored = true;\n");await writeFile(join(root,"activity.log"),"ignored churn\n");
  changed(root,"generated/output.mjs");changed(root,"activity.log");const events=feed.events.get(resolve(root))!;events.push({name:"generated",exists:true,type:"d"});
  filesystemReads.length=0;
  feed.afterQuery=queriedRoot=>{if(queriedRoot!==resolve(root))return;feed.afterQuery=undefined;changed(root,"activity.log");};
  observation=await observeIndexedRepository(root);expect(observation.mode).toBe("unchanged");expect(observation.descriptor.generation).toBe(before.generation);expect(observation.descriptor.metadata.state).toEqual(before.metadata.state);observation.close();
  expect(filesystemReads.some(path=>/(?:generated[/\\]output\.mjs|activity\.log)$/u.test(path))).toBe(false);
  await writeFile(join(root,"tracked.log"),"tracked changed\n");changed(root,"tracked.log");observation=await observeIndexedRepository(root);expect(observation.mode).toBe("delta");const data=observation.materialize();expect(observation.store.getAt<{content:string}>(observation.descriptor.generation,"inventory","tracked.log")?.content).toBe("tracked changed\n");observation.close();
  const full=await observeChangeRepository(root);expect(data.state).toEqual(full.state);expect(data.analysis).toEqual(full.analysis);
  await writeFile(join(root,"generated/new-forced.log"),"new tracked ignored source\n");await exec("git",["add","-f","generated/new-forced.log"],{cwd:root});changed(root,"generated/new-forced.log");feed.events.get(resolve(root))!.push({name:"generated",exists:true,type:"d"});changed(join(root,".git"),"index");
  observation=await observeIndexedRepository(root);const forced=observation.materialize();expect(forced.analysis.files.some(file=>file.path==="generated/new-forced.log")).toBe(true);observation.close();
  const forcedFull=await observeChangeRepository(root);expect(forced.state).toEqual(forcedFull.state);expect(forced.analysis).toEqual(forcedFull.analysis);
});

it("rebuilds the effective population when an ignore rule exposes a previously ignored file",async()=>{
  const root=await fixture();await writeFile(join(root,".gitignore"),"generated/\n");await mkdir(join(root,"generated"));await writeFile(join(root,"generated/output.mjs"),"export const revealed = true;\n");
  await exec("git",["add",".gitignore"],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","ignore fixture"],{cwd:root});
  let observation=await observeIndexedRepository(root);expect(observation.materialize().analysis.files.some(file=>file.path==="generated/output.mjs")).toBe(false);observation.close();
  await writeFile(join(root,".gitignore"),"");changed(root,".gitignore");observation=await observeIndexedRepository(root);expect(observation.mode).toBe("rebuild");const data=observation.materialize();observation.close();
  expect(data.analysis.files.some(file=>file.path==="generated/output.mjs")).toBe(true);const full=await observeChangeRepository(root);expect(data.state).toEqual(full.state);expect(data.analysis).toEqual(full.analysis);
});

it("keeps independent eager state proof current during ignored output churn",async()=>{
  const root=await fixture();await writeFile(join(root,".gitignore"),"*.log\n");await exec("git",["add",".gitignore"],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","ignore proof"],{cwd:root});
  const observation=await observeChangeRepository(root);await writeFile(join(root,"activity.log"),"ignored output\n");changed(root,"activity.log");filesystemReads.length=0;
  feed.afterQuery=queriedRoot=>{if(queriedRoot!==resolve(root))return;feed.afterQuery=undefined;changed(root,"activity.log");};
  expect(await observeRepositoryState(observation)).toEqual(observation.state);
  expect(filesystemReads.some(path=>path.endsWith("activity.log"))).toBe(false);
});

it("retains a completed external baseline and matches an explicit rebuild after an ordinary edit",async()=>{
  const root=await fixture();let observation=await observeIndexedRepository(root);const before=observation.descriptor;observation.close();
  observation=await observeIndexedRepository(root);expect(observation.mode).toBe("unchanged");expect(observation.descriptor.generation).toBe(before.generation);observation.close();
  await writeFile(join(root,"src","a.mjs"),"export const a = 2;\n");changed(root,"src/a.mjs");
  observation=await observeIndexedRepository(root);const mode=observation.mode;const state=observation.descriptor.metadata.state;const indexed=observation.materialize();observation.close();expect(mode).toBe("delta");
  const full=await observeChangeRepository(root);expect(state).toEqual(full.state);expect(indexed.analysis).toEqual(full.analysis);
});
it("performs explicit rediscovery after cursor loss and cannot advance a canceled generation",async()=>{
  const root=await fixture();const before=await observeIndexedRepository(root);const generation=before.descriptor.generation;before.close();feed.fresh=true;
  const rebuilt=await observeIndexedRepository(root);expect(rebuilt.mode).toBe("rebuild");expect(rebuilt.descriptor.generation).toBeGreaterThan(generation);rebuilt.close();
});
it.each([false,true])("preserves the completed baseline when a new directory exceeds admission (child=%s)",async(withFile)=>{
  const root=await fixture();const {withObservationScope,SqliteObservationStore}=await import("@projector/runtime");
  const observed=await withObservationScope({limits:{maxDirectories:2}},()=>observeIndexedRepository(root));const generation=observed.descriptor.generation;observed.close();
  await mkdir(join(root,"src/deep"));if(withFile){await writeFile(join(root,"src/deep/b.mjs"),"export const b = 1;\n");changed(root,"src/deep/b.mjs");}
  const events=feed.events.get(resolve(root))??[];events.push({name:"src/deep",exists:true,type:"d"});feed.events.set(resolve(root),events);
  await expect(withObservationScope({limits:{maxDirectories:2}},()=>observeIndexedRepository(root))).rejects.toMatchObject({code:"observation-limit-exceeded",limit:"maxDirectories"});
  const store=await SqliteObservationStore.open(root);try{expect(store.head()?.generation).toBe(generation);}finally{store.close();}
});
it("drops a previously tracked ignored file after its index membership is removed",async()=>{
  const root=await fixture();await writeFile(join(root,".gitignore"),"src/a.mjs\n");await exec("git",["add",".gitignore"],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","ignore"],{cwd:root});
  let observed=await observeIndexedRepository(root);observed.close();await exec("git",["rm","--cached","src/a.mjs"],{cwd:root});changed(join(root,".git"),"index");
  observed=await observeIndexedRepository(root);const mode=observed.mode,data=observed.materialize();observed.close();expect(mode).toBe("delta");const full=await observeChangeRepository(root);expect(data.analysis).toEqual(full.analysis);expect(data.state).toEqual(full.state);
});
it("updates staged Git identities and advances an ancestral commit with rebuild parity",async()=>{
  const root=await fixture();let observed=await observeIndexedRepository(root);observed.close();await writeFile(join(root,"src/a.mjs"),"export const a = 5;\n");changed(root,"src/a.mjs");observed=await observeIndexedRepository(root);observed.close();
  await exec("git",["add","src/a.mjs"],{cwd:root});changed(join(root,".git"),"index");
  observed=await observeIndexedRepository(root);let data=observed.materialize();let mode=observed.mode;observed.close();expect(mode).toBe("delta");let full=await observeChangeRepository(root);expect(data.analysis).toEqual(full.analysis);expect(data.state).toEqual(full.state);
  await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","advance"],{cwd:root});changed(join(root,".git"),"HEAD");changed(join(root,".git"),"index");
  observed=await observeIndexedRepository(root);data=observed.materialize();mode=observed.mode;observed.close();expect(mode).toBe("delta");full=await observeChangeRepository(root);expect(data.analysis).toEqual(full.analysis);expect(data.state).toEqual(full.state);
});
it("removes a tracked static leaf with complete rebuild parity",async()=>{
  const root=await fixture();let observed=await observeIndexedRepository(root);observed.close();
  await rm(join(root,"src/a.mjs"));changed(root,"src/a.mjs",false);
  observed=await observeIndexedRepository(root);const mode=observed.mode,data=observed.materialize();observed.close();
  expect(mode).toBe("delta");const full=await observeChangeRepository(root);expect(data.state).toEqual(full.state);expect(data.analysis).toEqual(full.analysis);
});
it("enrolls unrelated additions and newly discovered distant consumers with rebuild parity",async()=>{
  const root=await fixture();let observed=await observeIndexedRepository(root);observed.close();
  for(const[path,content]of [["src/unrelated.mjs","export const unrelated = true;\n"],["src/consumer.mjs","import { a } from './a.mjs'; export const consumer = a;\n"]]){
    await writeFile(join(root,path!),content!);changed(root,path!);
    feed.events.get(resolve(root))!.push({name:"src",exists:true,type:"d"});
    observed=await observeIndexedRepository(root);const mode=observed.mode,data=observed.materialize();observed.close();
    expect(mode).toBe("delta");const full=await observeChangeRepository(root);expect(data.state).toEqual(full.state);expect(data.analysis).toEqual(full.analysis);
  }
});

it("runs scoped production contexts through fresh workers after dirty edits and new consumers",async()=>{
  const root=await fixture();
  await writeFile(join(root,"src","unrelated.mjs"),"export const unrelated = true;\n");
  await exec("git",["add","."],{cwd:root});await exec("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","unrelated fixture"],{cwd:root});
  const reads=filesystemReads,messages:unknown[]=[];reads.length=0;
  const originalPost=Worker.prototype.postMessage;
  const workerSpy=vi.spyOn(Worker.prototype,"postMessage").mockImplementation(function(this:Worker,...args:Parameters<Worker["postMessage"]>){messages.push(args[0]);return originalPost.apply(this,args);});
  try{
    const service=await RepositoryKnowledgeService.create(root);
    const retained=await service.context({request:"inspect inbound users",namedTargets:["src/a.mjs"]});
    const coldReads=reads.length;reads.length=0;messages.length=0;
    const warm=await (await RepositoryKnowledgeService.create(root)).context({request:"inspect inbound users",namedTargets:["src/a.mjs"]});
    expect(warm.branches).toEqual(retained.branches);
    expect(reads.some(path=>path.replaceAll("\\","/").endsWith("/src/unrelated.mjs"))).toBe(false);
    const warmReads=reads.length;
    await writeFile(join(root,"src","a.mjs"),"export const a = 2;\n");changed(root,"src/a.mjs");reads.length=0;
    const edited=await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(edited.scopeChanges?.changedSourceEntityIds.length).toBeGreaterThan(0);
    expect(reads.some(path=>path.replaceAll("\\","/").endsWith("/src/unrelated.mjs"))).toBe(false);
    const editReads=reads.length;
    await writeFile(join(root,"src","distant.mjs"),"import { a } from './a.mjs'; export const distant = a;\n");changed(root,"src/distant.mjs");reads.length=0;
    const expanded=await (await RepositoryKnowledgeService.create(root)).reconcile(retained.id);
    expect(expanded.scopeChanges?.addedEntityIds.length).toBeGreaterThan(0);
    expect(reads.some(path=>path.replaceAll("\\","/").endsWith("/src/unrelated.mjs"))).toBe(false);
    const indexedMessages=messages.filter(message=>JSON.stringify(message).includes("indexed-knowledge"));
    expect(indexedMessages.length).toBeGreaterThan(0);
    for(const message of indexedMessages)expect(JSON.stringify(message)).not.toContain('"javascriptFiles":');
    process.stdout.write(`${JSON.stringify({qualification:"production scoped fresh worker",coldReads,warmReads,editReads,newConsumerReads:reads.length,indexedWorkerMessages:indexedMessages.length})}\n`);
  }finally{workerSpy.mockRestore();}
});

it("keeps active lens and cardinality populations exact through matching additions, unrelated additions and deletion", async () => {
  const root = await fixture();
  const canonical = new CanonicalFileRepository(root);
  const authority: AuthorityRecord = {
    id: "authority:source-population", key: "source-population", subjectId: "lens:source-population", status: "approved", conclusion: "normalize",
    rationale: "Require the complete source population.", alternatives: [], assumptions: [], reconsiderWhen: [{ type: "manual-review" }],
    vector: { explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1, independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1, boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1, externalRationale: 0, ecosystemHealth: 0, securitySupport: 0, reversibility: 1, migrationCost: 0, counterEvidence: 0 },
    assessmentConfidence: "high", evidence: [], governanceRiskClass: "R1", decidedBy: "user", createdAt: "2026-09-09T00:00:00.000Z", semanticHash: hashFramedDomain("test-authority", "population"),
  };
  const selector = { op: "atom", field: "path", matcher: "glob", value: "src/*.mjs" } as const;
  const base = createRepositoryScriptLens({ id: authority.subjectId, status: "active", authorityRecordId: authority.id, selector, governanceBasis: [{ kind: "hard-constraint", conceptId: "concept:complete-source-population" }] });
  const rule = { ...base.rules[0]!, id: "rule:population", key: "population", predicates: [{ kind: "cardinality" as const, selector, min: 2 }], validatorIds: [], transformIds: [], semanticHash: hashFramedDomain("test-cardinality", "population") };
  const lens = { ...base, rules: [rule], validators: base.validators.map(validator => ({ ...validator, input: { ruleIds: [rule.id] } })), expectedProjections: base.expectedProjections.map(projection => ({ ...projection, expectation: { kind: "predicate-constrained" as const, predicateIds: [rule.id], validatorIds: [] } })), impactRules: [] };
  await canonical.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "authority-record", id: authority.id, key: authority.key, lifecycle: authority.status, payload: { ...authority } }));
  await canonical.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind: "projection-lens", id: lens.id, key: lens.key, lifecycle: lens.status, payload: { ...lens } }));
  const decisionAuthority = { ...authority, id: "authority:source-choice", key: "source-choice-authority", subjectId: "concern:source-choice", reconsiderWhen: [{ type: "scope-expanded" as const, scopeKey: "src" }] };
  const decision = { id: "decision:source-choice", key: "source-choice", concernId: decisionAuthority.subjectId, title: "Source population choice", decision: "Keep the observed source population.", selectedOptionKey: "complete", scope: selector, lifecycle: "active", authorityRecordId: decisionAuthority.id, governanceBasis: [], consequences: [], appliedPreferences: [], supersedesDecisionIds: [], semanticHash: hashFramedDomain("test-decision", "population") };
  const concern = { id: decision.concernId, key: "source-choice-concern", title: "Source population", question: "Which source units are governed?", scope: selector, sourceClass: "authored", status: "resolved", materiality: "blocking-now", activationReasons: [], relatedConceptIds: [], relatedRequirementIds: [], decisionIds: [decision.id], evidence: [], semanticHash: hashFramedDomain("test-concern", "population") };
  for (const [kind, value, lifecycle] of [["authority-record", decisionAuthority, "approved"], ["architecture-decision", decision, "active"], ["architecture-concern", concern, "resolved"]] as const) {
    await canonical.write(withCanonicalHashes({ apiVersion: "projector/v3", schemaVersion: "3.0.0", kind, id: value.id, key: value.key, lifecycle, payload: { ...value } }));
  }
  const first = await observeIndexedRepository(root);
  let anchorId: string, firstRoot: string;
  try {
    expect(first.store.getAt(first.descriptor.generation, "governance-meta", "lensCompilationUnknown")).toBeNull();
    anchorId = first.store.populationAt(first.descriptor.generation, "unit-path:src/a.mjs")[0]!;
    firstRoot = first.store.getAt<{root:string}>(first.descriptor.generation, "governance-lens-root", lens.id)!.root;
  } finally { first.close(); }
  let matchingRoot: string | undefined;
  for (const change of [
    { path: "src/b.mjs", content: "export const b = 2;\n", count: 2 },
    { path: "unrelated.mjs", content: "export const unrelated = true;\n", count: 2 },
    { path: "src/b.mjs", content: undefined, count: 1 },
  ]) {
    if (change.content === undefined) await rm(join(root, change.path));
    else await writeFile(join(root, change.path), change.content);
    changed(root, change.path, change.content !== undefined);
    const observed = await observeIndexedRepository(root);
    try {
      expect(observed.mode, `${change.path}: ${observed.descriptor.metadata.rebuildReason}`).toBe("delta");
      const full = await observeChangeRepository(root);
      expect(observed.descriptor.metadata.state).toEqual(full.state);
      const budget = new DerivedObservationBudget();
      const host = { now: () => "2026-09-27T12:00:00.000Z", readDecisionBaseline: async () => ({ kind: "unavailable" as const, reason: "No accepted baseline." }) };
      const eager = new KnowledgeGraph(full, host);
      const indexed = new IndexedKnowledgeGraph(observed.descriptor, observed.store, registry => new IndexedGovernance(observed.descriptor, observed.store, registry, host, budget), budget);
      const context: AdapterContext = { repositoryRoot: root, stateDigest: full.state, config: {}, signal: new AbortController().signal };
      const query = eager.registry.createSpec({ id: "active-membership", programId: KNOWLEDGE_QUERY_PROGRAMS.lensMembership, input: { unitId: anchorId } });
      expect(await indexed.registry.evaluateObserved(query, context)).toEqual(await eager.registry.evaluateObserved(query, context));
      for (const subjectId of [lens.id, decision.id, concern.id]) {
        const implementation = eager.registry.createSpec({ id: `active-scope:${subjectId}`, programId: KNOWLEDGE_QUERY_PROGRAMS.implementation, input: { subjectId } });
        expect(await indexed.registry.evaluateObserved(implementation, context)).toEqual(await eager.registry.evaluateObserved(implementation, context));
      }
      expect(await indexed.bindDecisionApplicability(decision.id, context)).toEqual(await eager.bindDecisionApplicability(decision.id, context));
      expect(await indexed.bindDecisionTriggers(decision.id, "change", context)).toEqual(await eager.bindDecisionTriggers(decision.id, "change", context));
      const selected = new Set([anchorId, lens.id]);
      expect(indexed.lensObligations(selected, "change")).toEqual(eager.lensObligations(selected, "change"));
      expect(indexed.governanceEvaluations(selected, "change")).toEqual(eager.governanceEvaluations(selected, "change"));
      const cardinality = observed.store.getAt<{knownCount:number}>(observed.descriptor.generation, "governance-cardinality", hashFramedDomain("governance-selector", selector));
      expect(cardinality?.knownCount).toBe(change.count);
      const rootHash = observed.store.getAt<{root:string}>(observed.descriptor.generation, "governance-lens-root", lens.id)!.root;
      if (change.path === "unrelated.mjs") expect(rootHash).toBe(matchingRoot);
      else if (change.content === undefined) expect(rootHash).toBe(firstRoot);
      else { expect(rootHash).not.toBe(firstRoot); matchingRoot = rootHash; }
      expect(observed.materialize().analysis).toEqual(full.analysis);
    } finally { observed.close(); }
  }
});
