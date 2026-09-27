import { mkdir, mkdtemp, readFile, writeFile, lstat, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildReleasePackage } from "./build-release-package.mjs";
import { buildPluginRuntime } from "./build-plugin-runtime.mjs";
import { executeReleaseCommand, resolveNpmCommand } from "./npm-command.mjs";

const sourceRoot=fileURLToPath(new URL("..",import.meta.url));
const output=resolve(process.argv[2]??join(sourceRoot,".temp/projector-release-check"));
try{await lstat(output);throw new Error(`Retain previous evidence and choose a fresh release check directory: ${output}`);}catch(error){if(error.code!=="ENOENT")throw error;}
await mkdir(output,{recursive:true});
const staging=join(output,"projector-release-package");
const tarball=await buildReleasePackage(staging,join(output,"artifacts"));
const isolated=await mkdtemp(join(tmpdir(),"projector-installed-v3-"));
await writeFile(join(output,"installation.json"),JSON.stringify({isolated,tarball},null,2)+"\n");
const env={...process.env,NODE_PATH:""};
const npm=await resolveNpmCommand(["install",tarball,"--offline","--ignore-scripts","--no-audit","--no-fund","--package-lock=false"]);
await writeFile(join(isolated,"package.json"),JSON.stringify({name:"projector-install-check",private:true,type:"module"}));
await executeReleaseCommand(npm.executable,npm.arguments,{cwd:isolated,env,timeout:120_000,maxBuffer:8*1024*1024});
const installed=join(isolated,"node_modules/@onepersonlabs/projector");
const plugin=join(isolated,"plugin");
await buildPluginRuntime(plugin,{releaseRoot:installed});
const repository=join(isolated,"fresh-project");await mkdir(repository);
const run=(executable,args,cwd=repository)=>executeReleaseCommand(executable,args,{cwd,env,timeout:120_000,maxBuffer:8*1024*1024});
await run("git",["init","--quiet"]);
await writeFile(join(repository,".gitignore"),".projector/runtime/\n.projector/state.db*\n");
await writeFile(join(repository,"README.md"),"# Installed Projector exercise\n");
await mkdir(join(repository,"src"));
await writeFile(join(repository,"src/clock.ts"),"export const now = () => 0;\n");
await run("git",["add","."]);await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit","-qm","Initial project"]);
const transcript=[];
const command=async(args)=>{
 const start=performance.now();const result=await run(process.execPath,[join(plugin,"scripts/projector.mjs"),...args,"--json"]);
 const value=JSON.parse(result.stdout);transcript.push({args,elapsedMs:Math.round(performance.now()-start),value});
 await writeFile(join(output,"installed-transcript.json"),JSON.stringify(transcript,null,2)+"\n");return value;
};
const operation=async(name,input)=>{
 const requestPath=join(output,`${name}-request.json`);
 await writeFile(requestPath,JSON.stringify({apiVersion:"projector.operation/v1",repositoryRoot:repository,operation:name,input}));
 const result=await run(process.execPath,[join(plugin,"scripts/projector-operation.mjs"),requestPath]);
 const value=JSON.parse(result.stdout);transcript.push({operation:name,input,value});
 await writeFile(join(output,"installed-transcript.json"),JSON.stringify(transcript,null,2)+"\n");
 if(value.status!=="succeeded")throw new Error(`${name}: ${JSON.stringify(value.error??value.readiness)}`);
 return value.output;
};
const binResult=await run(process.execPath,[join(installed,"dist/command-main.mjs"),"init","--json"]);
const initialized=JSON.parse(binResult.stdout);transcript.push({args:["init"],entry:"npm package bin",value:initialized});
if(initialized.readiness.status!=="ready")throw new Error("Installed init was not ready");
if(!(await readFile(join(repository,".projector/README.md"),"utf8")).includes("#"))throw new Error("Installed init omitted the human index");
const context=await command(["context","Document the project's clock boundary"]);
const proposal={apiVersion:"projector.change-proposal/v1",requirements:[],scenarios:[],architecture:null,edits:[],validation:{independentNodeTests:[],supplementalNodeTests:[]},analysisFacets:["architecture","behavior"],identityResolution:{contextId:context.id,contextHash:context.contentHash,outcome:"create-new",selectedEntityIds:[],rationale:"The fresh project has no existing clock boundary record.",newBoundary:{owns:["Domain time inputs"],excludes:["Clock implementation and scheduling"],nearestEntityIds:[],rationale:"Record the time input obligation independently of implementation."}},canonicalMutations:[{kind:"concept",operation:"add",expectedAbsent:true,rationale:"Preserve the time boundary for later changes.",payload:{id:"concept:clock",key:"clock",kind:"invariant",name:"Clock boundary",aliases:[],statement:"All domain time enters through the clock port.",status:"active",sourceClass:"authored",confidence:1,tags:["time"],evidence:[]}}]};
const proposalPath=join(output,"clock-proposal.json");await writeFile(proposalPath,JSON.stringify(proposal,null,2));
const preview=await command(["accept",proposalPath,"--context",context.id]);
const applied=await command(["accept","--apply",preview.selector,"--hash",preview.immutablePlanHash]);
if(!["success","succeeded"].includes(applied.outcome))throw new Error("Installed canonical apply failed");
const selected=await command(["context","Change domain time handling","--entity","concept:clock","--target","src/clock.ts"]);
if(!selected.meaning.sections.some(section=>section.text.includes("All domain time")))throw new Error("Installed compact context omitted accepted meaning");
await command(["check",selected.id]);
const resumed=await command(["resume",selected.id]);
if(!resumed.context?.meaning.sections.some(section=>section.text.includes("All domain time")))throw new Error("Fresh-process resume did not restore the accepted clock boundary");
const clock=await command(["inspect","concept:clock"]);
const sourceIdentity=async()=>{
 const listed=await run("git",["ls-files","--cached","--others","--exclude-standard","-z"]);
 const hash=createHash("sha256");
 for(const path of listed.stdout.split("\0").filter(Boolean).sort()){
  hash.update(path);hash.update("\0");hash.update(await readFile(join(repository,path)));hash.update("\0");
 }
 return hash.digest("hex");
};
const beforeAudit=await sourceIdentity();
const audit=await command(["audit","--scope",".","--context",selected.id]);
if(audit.completion.readOnly!==true||audit.completion.execution!=="not-performed")throw new Error("Installed audit did not expose its read-only repair report");
if(await sourceIdentity()!==beforeAudit)throw new Error("Installed audit mutated repository source or canonical meaning");
if(!audit.continuation)throw new Error("Installed audit omitted retained-context continuation");

// A new consumer must invalidate old authority even when the selected source is unchanged.
const {semanticHash:_semantic,discoveryHash:_discovery,...clockPayload}=clock.payload;
const revision={apiVersion:"projector.change-proposal/v1",architecture:null,analysisFacets:["behavior","architecture"],canonicalMutations:[{
 kind:"concept",operation:"revise",expectedSemanticHash:clock.semanticHash,expectedDocumentHash:clock.canonicalDocumentHash,
 rationale:"Exercise stale preview refusal through the installed lifecycle.",payload:{...clockPayload,statement:"All domain time enters through the clock port. Consumers preserve the supplied instant."}
}]};
const revisionPath=join(output,"stale-clock-proposal.json");await writeFile(revisionPath,JSON.stringify(revision,null,2));
const stalePreview=await command(["accept",revisionPath,"--context",selected.id]);
const staleApproval=await operation("change.approve",{changeSelector:stalePreview.selector,planHash:stalePreview.immutablePlanHash});
await writeFile(join(repository,"src/consumer.ts"),"import { now } from './clock.js';\nexport const observedNow = now();\n");
const changed=await command(["check",selected.id]);
if(changed.meaning.status!=="stale")throw new Error("A late consumer did not stale the installed retained context");
if(!changed.meaning.branches.some(branch=>["current","rebound"].includes(branch.validation.status)))throw new Error("A late consumer invalidated every branch instead of preserving unaffected meaning");
let staleRefused=false;
try{await operation("change.apply",{approvalSelector:staleApproval.selector});}
catch(error){
 if(!/stale|dependenc|current|changed|before/iu.test(String(error.message)+String(error.stderr)+String(error.stdout)))throw error;
 staleRefused=true;
 transcript.push({operation:"change.apply",input:{approvalSelector:staleApproval.selector},expectedFailure:true,exitCode:error.code,stdout:error.stdout,stderr:error.stderr??error.message});
 await writeFile(join(output,"installed-transcript.json"),JSON.stringify(transcript,null,2)+"\n");
}
if(!staleRefused)throw new Error("Installed apply accepted a stale approval");
if((await command(["inspect","concept:clock"])).semanticHash!==clock.semanticHash)throw new Error("Stale apply changed accepted meaning");

// Semantic identity survives a source rename and a fresh process.
await rename(join(repository,"src/clock.ts"),join(repository,"src/time-port.ts"));
await writeFile(join(repository,"src/consumer.ts"),"import { now } from './time-port.js';\nexport const observedNow = now();\n");
const renamed=await command(["context","Inspect the renamed clock port and its consumers","--entity","concept:clock","--target","src/time-port.ts"]);
if(!renamed.meaning.sections.some(section=>section.entityId==="concept:clock"&&section.text.includes("All domain time")))throw new Error("Source rename lost stable accepted identity");
await command(["resume",renamed.id]);
const bounded=await command(["context","Inspect the clock obligation","--entity","concept:clock","--budget","100"]);
if(!bounded.meaning.sections.some(section=>section.text.includes("All domain time enters through the clock port."))&&bounded.meaning.disclosure.omitted===0)throw new Error("Bounded context silently lost its obligation without omission disclosure");
const report={status:"passed",tarball,plugin,isolated,records:1,checks:["offline npm tarball installation outside the source tree","standalone bundled dependency resolution","npm package bin init and human index","exact preview/apply","Markdown round trip","compact context","check","fresh-process read-only resume","inspect","read-only audit with retained context","late-consumer currentness with unaffected meaning reuse","stale approval refusal without canonical mutation","stable concept identity after source rename","bounded-context omission disclosure"],limitations:["Interruption and committed-result recovery are exercised by the lifecycle and continuation suites; this installed smoke does not establish comparative advantage or domain reconstruction.","Consumer discovery covers supported static imports; re-export dependency edges remain an explicitly disclosed analyzer blind spot."]};
await writeFile(join(output,"result.json"),JSON.stringify(report,null,2)+"\n");
process.stdout.write(JSON.stringify(report,null,2)+"\n");
