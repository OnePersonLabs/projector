import { hashFramedDomain, withCanonicalHashes, type SelectorExpr } from "@projector/core";
import { CanonicalFileRepository } from "@projector/runtime";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateSelector, type SelectorSubject } from "@projector/engine";
import { expect, it } from "vitest";
import { realizationSelectorGates, safeRealizationCandidateIds } from "./indexed-selector-incidence.js";
import { observeIndexedRepository } from "../change-lifecycle/indexed-observer.js";
import { observeChangeRepository } from "../change-lifecycle/repository-observer.js";

it("never excludes a match through conjuncts, alternatives, negation or glob gates", () => {
  const atoms: SelectorExpr[] = [
    {op:"atom",field:"path",matcher:"equals",value:"src/new.mjs"},
    {op:"atom",field:"path",matcher:"in",value:["src/new.mjs","apps/ui/new.mjs"]},
    {op:"atom",field:"path",matcher:"glob",value:"src/**"},
    {op:"atom",field:"path",matcher:"glob",value:"**/*.mjs"},
    {op:"atom",field:"path",matcher:"glob",value:"**/new.mjs"},
    {op:"atom",field:"path",matcher:"regex",value:"^.*$"},
    {op:"atom",field:"tag",matcher:"contains",value:"selected"},
    {op:"atom",field:"package",matcher:"equals",value:"apps/ui"},
    {op:"atom",field:"language",matcher:"equals",value:"javascript"},
  ];
  const expressions = [...atoms,...atoms.map(item=>({op:"not" as const,item})),...atoms.flatMap(left=>atoms.flatMap(right=>[{op:"all" as const,items:[left,right]},{op:"any" as const,items:[left,right]}])),{op:"all" as const,items:[]},{op:"any" as const,items:[]}];
  let matched=0;
  for(const path of ["src/new.mjs","src/old.ts","apps/ui/new.mjs","new.mjs","dist/output.js"]){
    const subject:SelectorSubject={id:path,values:{path,tag:["selected"],...(path.startsWith("apps/")?{package:"apps/ui"}:{})},dependencyKeys:[]};
    for(const selector of expressions){
      if(!evaluateSelector(selector,subject).matched)continue;
      matched++;
      const gates=realizationSelectorGates(selector);
      if(gates===undefined)continue;
      const possible=gates.some(gate=>{
        const value=subject.values[gate.field as keyof typeof subject.values];
        if(value===undefined)return true;
        return (Array.isArray(value)?value:[value]).some(item=>gate.mode==="value"?item===gate.value:typeof item==="string"&&typeof gate.value==="string"&&(gate.mode==="prefix"?item.startsWith(gate.value):item.endsWith(gate.value)));
      });
      expect(possible,JSON.stringify({selector,path,gates})).toBe(true);
    }
  }
  expect(matched).toBeGreaterThan(100);
});

it("addresses an initially empty realization among unrelated canonical declarations",async()=>{
  const root=await mkdtemp(join(tmpdir(),"projector-incidence-"));
  let baseline:Awaited<ReturnType<typeof observeIndexedRepository>>|undefined;
  try{
    await mkdir(join(root,"src"));await writeFile(join(root,"package.json"),'{"type":"module"}');await writeFile(join(root,"src/a.mjs"),"export const a = 1;\n");
    execFileSync("git",["init","-q"],{cwd:root});execFileSync("git",["add","."],{cwd:root});execFileSync("git",["-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","fixture"],{cwd:root});
    for(let index=0;index<25;index++){
      const id=`requirement:incidence-${index}`,hash=hashFramedDomain("incidence-fixture",id);
      const payload={id,key:id,title:id,aliases:[],statement:"Keep the declared realization observable.",status:"active",sourceClass:"authored",scope:{op:"all",items:[]},origin:[],evidence:[],semanticHash:hash,discoveryHash:hash,realizations:[{selector:{op:"atom",field:"path",matcher:"glob",value:index===0?"src/new.mjs":`unrelated-${index}/**`},origin:{kind:"content",locator:"fixture",contentHash:hash}}]};
      await new CanonicalFileRepository(root).write(withCanonicalHashes({apiVersion:"projector/v3",schemaVersion:"3.0.0",kind:"requirement",id,key:id,lifecycle:"active",payload}));
    }
    baseline=await observeIndexedRepository(root);
    expect(baseline.store.getAt<Array<{memberIds:string[]}>>(baseline.descriptor.generation,"realization","requirement:incidence-0")?.[0]?.memberIds).toEqual([]);
    await writeFile(join(root,"src/new.mjs"),"export const next = true;\n");
    const full=await observeChangeRepository(root),file=full.analysis.files.find(file=>file.path==="src/new.mjs")!;
    const analysis={...full.analysis,files:[file],projectionUnits:full.analysis.projectionUnits.filter(unit=>unit.artifactId===file.artifactId)};
    const before=baseline.store.metrics.rowsRead;
    const candidates=safeRealizationCandidateIds({descriptor:baseline.descriptor,store:baseline.store,analysis,changedPaths:[file.path]});
    expect(candidates).toEqual(["requirement:incidence-0"]);
    expect(full.realizations.find(observation=>observation.entityId===candidates[0])?.status).toBe("matched");
    expect(baseline.store.metrics.rowsRead-before).toBeLessThan(160);
  }finally{baseline?.close();await rm(root,{recursive:true,force:true});}
});
