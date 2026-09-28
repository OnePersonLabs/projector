import { mkdir, mkdtemp, readFile, writeFile, lstat, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
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
// pnpm lifecycle environments export the host allowlist as an npm CLI policy.
// npm rejects that policy for project installs; this check disables all scripts.
const installEnvironment=Object.fromEntries(Object.entries(env).filter(([key])=>!/^npm_config_allow[-_]scripts$/iu.test(key)));
await executeReleaseCommand(npm.executable,npm.arguments,{cwd:isolated,env:installEnvironment,timeout:120_000,maxBuffer:8*1024*1024});
const installed=join(isolated,"node_modules/@onepersonlabs/projector");
const plugin=join(isolated,"plugin");
await buildPluginRuntime(plugin,{releaseRoot:installed});
let repository=join(isolated,"fresh-project");await mkdir(repository);
env.PROJECTOR_VERIFICATION_EVIDENCE_STORE=join(isolated,"retained-execution-evidence");
const run=(executable,args,cwd=repository)=>executeReleaseCommand(executable,args,{cwd,env,timeout:120_000,maxBuffer:8*1024*1024});
await run("git",["init","--quiet"]);
await writeFile(join(repository,".gitignore"),".projector/runtime/\n.projector/state.db*\n");
await writeFile(join(repository,"README.md"),"# Installed Projector exercise\n");
await mkdir(join(repository,"src"));
await writeFile(join(repository,"src/clock.ts"),"export const now = () => 0;\n");
await run("git",["add","."]);await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit","-qm","Initial project"]);
const transcript=[];
const command=async(args,cwd=repository)=>{
 const start=performance.now();const result=await run(process.execPath,[join(plugin,"scripts/projector.mjs"),...args,"--json"],cwd);
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
const verifySkill="skills/projector-verify/SKILL.md";
if((await readFile(join(plugin,verifySkill),"utf8"))!==(await readFile(join(sourceRoot,"plugins/projector-v3",verifySkill),"utf8")))throw new Error("Installed verification procedure differs from its canonical source");
const checkInput=join(output,"verification-check.json");
await writeFile(checkInput,JSON.stringify({executable:process.execPath,args:["--input-type=module","--eval","import { readFileSync } from 'node:fs'; if (!readFileSync('src/time-port.ts','utf8').includes('=> 0')) process.exit(1);"],inputPaths:["src/time-port.ts"],populations:[],environment:[],timeoutMs:10000,completeInputs:true}));
const checked=await command(["verify",checkInput]);
if(checked.status!=="passed"||checked.profile!=="native-observed/v1")throw new Error("Installed native check did not retain its observed result");
await writeFile(join(repository,"unrelated.txt"),"Independent target movement\n");
await run("git",["add","unrelated.txt"]);await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit","-qm","Independent target movement"]);
const retainedVerification=await command(["verify","--inspect",checked.id]);
if(!retainedVerification.records.some(check=>check.id===checked.id&&check.status==="passed"&&check.contentHash===checked.contentHash))throw new Error("Installed native observation did not survive a fresh process and unrelated target movement");
if(!Array.isArray(await command(["inspect","--representations"])))throw new Error("Installed representation recovery inspection is unavailable");
await writeFile(join(repository,"derive-clock.mjs"),"import { readFileSync, writeFileSync } from 'node:fs'; writeFileSync('generated-clock.ts',readFileSync('src/time-port.ts'));\n");
const generationPath=join(output,"generation.json");
await writeFile(generationPath,JSON.stringify({producerId:"producer:clock-copy",executable:process.execPath,sourcePath:"derive-clock.mjs",args:[],inputPaths:["src/time-port.ts"],populations:[],outputs:[{path:"generated-clock.ts",ownership:"retained"}],environment:[],timeoutMs:10000,completeInputs:true}));
const generated=await command(["generate",generationPath]);
if(generated.check.status!=="passed"||!generated.after["generated-clock.ts"])throw new Error("Installed generation did not retain output evidence");
const producersPath=join(output,"active-producers.json");
await writeFile(producersPath,JSON.stringify({activeProducerIds:["producer:clock-copy"]}));
const outputs=await command(["generate","--inspect",producersPath]);
if(outputs.records[0]?.current!==true||outputs.records[0]?.outputs[0]?.observation!=="changed-after-invocation")throw new Error("Installed generated-output inspection lost execution or currentness");
// Set up canonical fixtures with the installed writer, then exercise the public consumers.
const { CanonicalFileRepository } = await import(pathToFileURL(join(installed,"exports/runtime.js")).href);
const { withCanonicalHashes, hashSemantic, hashDiscovery, hashFramedDomain, hashApplicationEvidenceAssessment } = await import(pathToFileURL(join(installed,"exports/core.js")).href);
const canonical = new CanonicalFileRepository(repository);
const writeFixture = async (kind,suppliedPayload) => {
 const payload={...suppliedPayload,key:`${kind}-${suppliedPayload.key}`};
 const hashedPayload={...payload,semanticHash:hashSemantic(kind,payload),...(kind==="architecture-concern"?{}:{discoveryHash:hashDiscovery(kind,payload)})};
 const document=withCanonicalHashes({apiVersion:"projector/v3",schemaVersion:"3.0.0",kind,id:payload.id,key:payload.key,lifecycle:payload.status,payload:hashedPayload});
 await canonical.write(document); return document;
};
const scenario=await writeFixture("behavioral-scenario",{id:"scenario:installed-clock",key:"installed-clock",title:"Read the installed clock",aliases:[],status:"active",sourceClass:"authored",scope:{op:"all",items:[]},steps:[{role:"trigger",statement:"Call the clock port."},{role:"expected-outcome",statement:"The clock returns zero."}],evidence:[]});
await writeFixture("requirement",{id:"requirement:installed-clock",key:"installed-clock",title:"Observed clock result",aliases:[],statement:"The clock port returns zero in this exercise.",status:"active",sourceClass:"authored",scope:{op:"all",items:[]},origin:[],evidence:[{evidenceId:"artifact:installed-clock",stance:"supports",applicationPredicate:{kind:"application-observation",adapter:{id:"installed-clock",version:"1"},scenario:{id:scenario.id,semanticHash:scenario.payload.semanticHash},case:"clock",predicateId:"predicate:clock-zero",assertionIds:["clock-zero"],observationRole:"latest"}}]});
await writeFixture("architecture-concern",{id:"concern:installed-clock",key:"installed-clock",title:"Clock provider",question:"Which clock provider meets the boundary?",scope:{op:"all",items:[]},sourceClass:"authored",status:"active",materiality:"blocking-now",activationReasons:[],relatedConceptIds:["concept:clock"],relatedRequirementIds:[],decisionIds:[],evidence:[]});
const evaluationPath=join(output,"architecture-evaluation.json");
await writeFile(evaluationPath,JSON.stringify({concernId:"concern:installed-clock",options:[{key:"fixed",title:"Fixed clock",description:"Return a fixed instant",hardConstraintStatus:"passes",tradeoffs:[],evidence:[],preferenceFit:[]}]}));
const evaluated=await command(["evaluate",evaluationPath]);
if(evaluated.acceptanceBlocked!==true||evaluated.canonicalMutationAuthorized!==false)throw new Error("Installed evaluation granted acceptance without required research");
let observations=0;
let hostFailure;
const server=createServer(async(req,res)=>{
 try {
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks).toString());
  if("repositoryRoot" in body)throw new Error("Host request exposed the repository root");
  const {now}=await import(`${pathToFileURL(join(repository,"src/time-port.ts")).href}?observation=${++observations}`);
  const value=now();
  const observationHash=hashFramedDomain("installed-clock-observation",value);
  const basis={schemaVersion:"application-evidence-assessment@1",request:body.request,custody:{status:"authenticated",receiptHash:observationHash},currentness:{status:"current",observationHash},fulfillment:{status:value===0?"satisfied":"violated",reason:`Executed clock returned ${value}.`},dependencies:[]};
  res.setHeader("content-type","application/json");
  res.end(JSON.stringify({protocol:"projector-application-evidence-http@1",host:body.host,assessment:{...basis,contentHash:hashApplicationEvidenceAssessment(basis)}}));
 } catch(error) {hostFailure=error;res.writeHead(500);res.end("Fixture observation failed");}
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const address=server.address();
if(address===null||typeof address==="string")throw new Error("Installed host has no TCP address");
env.PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT=`http://127.0.0.1:${address.port}/assess`;
env.PROJECTOR_APPLICATION_EVIDENCE_HOST_ID="installed-clock-host";
env.PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD="fixture:1";
try {
 const observed=await command(["context","Observe the clock result","--entity","requirement:installed-clock","--full"]);
 const assessments=observed.branches.flatMap(branch=>branch.applicationEvidence);
 if(!assessments.some(item=>item.status==="assessed"&&item.assessment.fulfillment.status==="satisfied"))throw new Error("Installed context did not consume the successful HTTP observation");
 await writeFile(join(repository,"src/time-port.ts"),"export const now = () => 1;\n");
 const violated=await command(["context","Observe the changed clock result","--entity","requirement:installed-clock","--full"]);
 if(!violated.branches.flatMap(branch=>branch.applicationEvidence).some(item=>item.status==="assessed"&&item.assessment.fulfillment.status==="violated"))throw new Error("Installed context masked the violated application predicate");
 if(hostFailure)throw hostFailure;
 if(observations<2)throw new Error("Installed application host was not called for both observations");
} finally {
 delete env.PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT;delete env.PROJECTOR_APPLICATION_EVIDENCE_HOST_ID;delete env.PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD;
 server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
// Independent clones contribute through ordinary Git. The installed assessment
// must use fetched objects after both source execution environments are gone.
// Keep the completed generator/application fixture intact. Its copied exports
// and executable provider are not inputs to this independent static exercise.
repository=join(isolated,"integration-project");await mkdir(repository);
await run("git",["init","--quiet"]);
await writeFile(join(repository,".gitignore"),".projector/runtime/\n.projector/state.db*\n");
await mkdir(join(repository,"src"));
await command(["init"]);
await writeFile(join(repository,"src","shared.ts"),"export const shared = 0;\n");
await run("git",["add","."]);
await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit","-qm","Installed integration baseline"]);
const integrationBase=(await run("git",["rev-parse","HEAD"])).stdout.trim();
const clonePaths=[join(isolated,"cloud-a"),join(isolated,"cloud-b")];
const branchCommits=[];
const cloneExecutions=[];
const cloneBuiltins=[];
env.PROJECTOR_VERIFICATION_TRUST_POLICY="projector.canonical-integrity/v1";
for(const [index,clone] of clonePaths.entries()){
 const side=index===0?"a":"b";
 await run("git",["clone","--quiet","--no-hardlinks",repository,clone],isolated);
 const payload={id:`concept:cloud-${side}`,key:`cloud-${side}`,kind:"invariant",name:`Cloud contribution ${side}`,aliases:[],statement:`Preserve the independent ${side} contribution.`,status:"active",sourceClass:"authored",confidence:1,tags:[],evidence:[]};
 const document=withCanonicalHashes({apiVersion:"projector/v3",schemaVersion:"3.0.0",kind:"concept",id:payload.id,key:payload.key,lifecycle:payload.status,payload:{...payload,semanticHash:hashSemantic("concept",payload),discoveryHash:hashDiscovery("concept",payload)}});
 await new CanonicalFileRepository(clone).write(document);
 await writeFile(join(clone,"src",`cloud-${side}.ts`),`export const contribution${side.toUpperCase()} = '${side}';\n`);
 if(side==="a")await writeFile(join(clone,"src","shared.ts"),"export const shared = 1;\n");
 else await writeFile(join(clone,"src","shared-consumer.ts"),"export { shared as sharedThroughConsumer } from './shared.js';\n");
 const cloneCheckPath=join(output,`cloud-${side}-check.json`);
 await writeFile(cloneCheckPath,JSON.stringify({executable:process.execPath,args:["--input-type=module","--eval",`import { readFileSync } from 'node:fs'; if (!readFileSync('src/cloud-${side}.ts','utf8').includes("'${side}'")) process.exit(1);`],inputPaths:[`src/cloud-${side}.ts`],populations:[],environment:[],timeoutMs:10000}));
 const observed=await command(["verify",cloneCheckPath],clone);
 if(observed.status!=="passed")throw new Error(`Installed independent ${side} execution failed`);
 cloneExecutions.push(observed);
 await run("git",["add","."],clone);
 await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit","-qm",`Independent contribution ${side}`],clone);
 const commit=(await run("git",["rev-parse","HEAD"],clone)).stdout.trim();
 await run("git",["fetch","--quiet","--no-tags",clone,commit]);
 branchCommits.push(commit);
 const builtin=await command(["verify","--builtin","--target",commit],clone);
 if(builtin.status!=="passed")throw new Error(`Installed closed canonical check failed for ${side}`);
 cloneBuiltins.push(builtin);
}
for(const clone of clonePaths){
 if(dirname(resolve(clone))!==resolve(isolated))throw new Error("Refusing to remove a fixture outside the installed test directory");
 await rm(clone,{recursive:true,force:false});
}
for(const observed of cloneExecutions){
 const retained=await command(["verify","--inspect",observed.id]);
 if(retained.records.length!==1||retained.records[0]?.contentHash!==observed.contentHash)throw new Error("Installed execution history depends on a deleted source clone");
}
for(const [index,observed] of cloneBuiltins.entries()){
 const retained=await command(["verify","--builtin","--assess",observed.id,"--target",branchCommits[index]]);
 if(retained.reusable!==true||retained.authorization!==false||retained.scope!=="projector.canonical-integrity/v1")throw new Error("Installed named canonical evidence did not survive source deletion with its narrow reuse contract");
}
await writeFile(join(repository,"local-uncommitted.txt"),"Preserve the destination overlay.\n");
const beforeIntegration=await sourceIdentity();
const beforeIntegrationIndex=(await run("git",["ls-files","--stage","-z"])).stdout;
const merged=await command(["integration","--target",branchCommits[0],"--incoming",branchCommits[1],"--base",integrationBase]);
const reverseMerged=await command(["integration","--target",branchCommits[1],"--incoming",branchCommits[0],"--base",integrationBase]);
for(const result of [merged,reverseMerged]){
 for(const side of ["a","b"]){
  if(!result.contributions.some(c=>c.entityId===`concept:cloud-${side}`&&c.status==="preserved"))throw new Error(`Installed integration lost semantic contribution ${side}`);
  if(!result.codeContributions.some(c=>c.path===`src/cloud-${side}.ts`&&c.status==="preserved"))throw new Error(`Installed integration lost code contribution ${side}`);
 }
 if(result.canonicalValidation.status!=="passed"||result.requiresReview!==true||result.verificationGaps.length===0)throw new Error("Installed integration masked its verification limits");
 const consumers=result.resultReconciliation.consumerQueries.find(query=>query.dependencyPath==="src/shared.ts");
 if(!consumers?.newlyRelevantConsumers.includes("src/shared-consumer.ts"))throw new Error("Installed result reconciliation missed the re-export consumer introduced by the other branch");
 if(result.resultReconciliation.behavior.reusable!==false)throw new Error("Static integration observation was treated as behavioral reuse authority");
}
if(merged.resultTree!==reverseMerged.resultTree)throw new Error("Disjoint installed contributions differ by merge order");
const squash=(await run("git",["-c","user.name=Projector Check","-c","user.email=check@example.invalid","commit-tree",merged.resultTree,"-p",integrationBase,"-m","Ordinary squash integration"])).stdout.trim();
const squashed=await command(["integration","--target",branchCommits[0],"--incoming",branchCommits[1],"--base",integrationBase,"--result",squash]);
if(squashed.resultTree!==merged.resultTree||squashed.resultCommit!==squash)throw new Error("Installed squash changed the content-based integration assessment");
let droppedContribution;
try{await command(["integration","--target",branchCommits[0],"--incoming",branchCommits[1],"--base",integrationBase,"--result",branchCommits[0]]);}
catch(error){
 if(Number(error.code)!==6)throw error;
 droppedContribution=JSON.parse(error.stdout);
 transcript.push({operation:"repository.integration",expectedFailure:true,reason:"Supplied result drops incoming contribution",value:droppedContribution});
 await writeFile(join(output,"installed-transcript.json"),JSON.stringify(transcript,null,2)+"\n");
}
if(!droppedContribution?.contributions.some(c=>c.entityId==="concept:cloud-b"&&c.status==="lost"))throw new Error("Installed integration failed to detect a silently dropped contribution");
if(await sourceIdentity()!==beforeIntegration||(await run("git",["ls-files","--stage","-z"])).stdout!==beforeIntegrationIndex||(await run("git",["rev-parse","HEAD"])).stdout.trim()!==integrationBase)throw new Error("Integration assessment changed destination source, index or HEAD");
const report={status:"passed",tarball,plugin,isolated,records:1,checks:["offline npm tarball installation outside the source tree","standalone bundled dependency resolution","npm package bin init and human index","exact preview/apply","Markdown round trip","compact context","check","fresh-process read-only resume","inspect","read-only audit with retained context","late-consumer currentness with unaffected meaning reuse","stale approval refusal without canonical mutation","stable concept identity after source rename","bounded-context omission disclosure"],limitations:["Interruption and committed-result recovery are exercised by the lifecycle and continuation suites; this installed smoke does not establish comparative advantage or domain reconstruction.","Consumer discovery covers static imports and re-exports; dynamic resolution and unsupported runtime mechanisms remain unknown.","Git integration checks contribution preservation, canonical integrity and static result consumers; named canonical-integrity evidence is separately reusable, while arbitrary behavioral reuse and dynamic governance remain unqualified."]};
report.checks.push("installed verification procedure byte parity","native check observation survives a fresh process and unrelated target movement","read-only representation publication inspection");
report.checks.push("installed architecture evaluation refuses missing required research","installed HTTP host executes and reports satisfied and violated application predicates");
report.checks.push("installed generation directly invokes the declared source and retains observed output evidence");
report.checks.push("independent Git clone contributions survive source clone deletion in both integration orders","supplied squash result preserves content-based contributions","lost incoming contribution fails without changing destination HEAD, index or dirty files");
report.checks.push("independent execution observations survive source clone deletion through host-configured immutable retention");
report.checks.push("installed closed canonical evidence remains reusable after source clone deletion without transferring authority","installed result reconciliation detects a re-export consumer in both merge orders");
await writeFile(join(output,"result.json"),JSON.stringify(report,null,2)+"\n");
process.stdout.write(JSON.stringify(report,null,2)+"\n");
