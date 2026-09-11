import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildSourceSeveredReleaseBundle } from "./build-source-severed-release-bundle.mjs";
import { installTarball } from "./source-severed-release-acceptance.mjs";
import { readCanonicalReleaseSources } from "./generate-release-artifacts.mjs";
import { createRequire } from "node:module";
const { parse: parseToml } = createRequire(new URL("../packages/testkit/package.json", import.meta.url))("smol-toml");
import { runPackedLifecycleAcceptance } from "./packed-lifecycle-acceptance.mjs";
import { runReleaseBenchmarkAuthority } from "./release-benchmark-authority.mjs";

const execute = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/u, "");
const sha = (value) => `sha256:v1:${createHash("sha256").update(value).digest("hex")}`;
const command = async (file, args, options = {}) => { try { const result = await execute(file, args, { encoding: "utf8", maxBuffer: 20_000_000, ...options }); return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }; } catch (error) { return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? String(error) }; } };
const required = (result, label, allowed = [0]) => { if (!allowed.includes(result.exitCode)) throw new Error(`${label} exited ${result.exitCode}: ${result.stderr || result.stdout}`); return result; };
const publicExports = ["@onepersonlabs/projector/operations", "@onepersonlabs/projector/core", "@onepersonlabs/projector/analyzers", "@onepersonlabs/projector/engine", "@onepersonlabs/projector/engine/architecture", "@onepersonlabs/projector/engine/coverage", "@onepersonlabs/projector/engine/modernization", "@onepersonlabs/projector/runtime", "@onepersonlabs/projector/integrations", "@onepersonlabs/projector/integrations/surfaces", "@onepersonlabs/projector/integrations/models", "@onepersonlabs/projector/integrations/codex", "@onepersonlabs/projector/control-plane", "@onepersonlabs/projector/testkit"];

async function initializeGit(root) { required(await command("git", ["init", "-q"], { cwd: root }), "git init"); required(await command("git", ["add", "."], { cwd: root }), "git add"); required(await command("git", ["-c", "user.name=Release Fixture", "-c", "user.email=release@projector.invalid", "commit", "-qm", "fixture"], { cwd: root }), "git commit"); }
async function filesUnder(root) { const files = []; const visit = async (directory) => { for (const entry of await readdir(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) await visit(path); else if (entry.isFile()) files.push(path); } }; await visit(root); return files.sort(); }
async function observedTreeDigest(root, paths, prefix = "") { const hash = createHash("sha256"); for (const path of [...paths].sort()) hash.update(prefix).update(path.slice(root.length)).update("\0").update(await readFile(path)).update("\0"); return `sha256:v1:${hash.digest("hex")}`; }
async function canonicalFiles(root) { const files = []; const visit = async (directory) => { let entries; try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; } for (const entry of entries) { const path = join(directory, entry.name); if (entry.isDirectory()) await visit(path); else if (entry.isFile() && /\.(?:concept|requirement|scenario|relation|lineage|tombstone|rule|lens|authority|decision|concern|preference|representation|receipt)\.toml$/u.test(entry.name)) files.push(path); } }; await visit(join(root, ".projector")); return files.sort(); }
async function rawCanonicalObservation(root) { const files = await canonicalFiles(root); const hash = createHash("sha256"); const entityIds = []; const kinds = []; const documents = []; const families = new Set(); for (const path of files) { const bytes = await readFile(path); const document = parseToml(bytes.toString("utf8")); entityIds.push(document.id); kinds.push(document.kind); documents.push({ path: path.slice(root.length), bytes: bytes.toString("utf8") }); if (document.kind === "projection-lens") { families.add("lens"); if ((document.payload.migrations?.length ?? 0) > 0) families.add("migration"); } if (document.kind === "authority-record") { families.add("authority"); if (document.payload.conclusion === "exception") families.add("exception"); } if (document.kind === "semantic-representation-profile") families.add("representation"); hash.update(path.slice(root.length)).update("\0").update(bytes).update("\0"); } return { digest: `sha256:v1:${hash.digest("hex")}`, entityIds: entityIds.sort(), kinds: [...new Set(kinds)].sort(), families: [...families].sort(), documents, count: files.length }; }

async function installCanonicalCorpus(consumer, root) {
  const code = `import { hashFramedDomain, withCanonicalHashes } from "@onepersonlabs/projector/core"; import { createRepositoryScriptLens } from "@onepersonlabs/projector/engine"; import { CanonicalFileRepository } from "@onepersonlabs/projector/runtime"; const z="sha256:v1:"+"0".repeat(64); const repo=new CanonicalFileRepository(process.argv[1]); const selector={op:"all",items:[]}; const vector={explicitDecisionAlignment:1,productConstraintFit:1,semanticFit:1,independentOccurrence:1,historicalStability:1,independentValidationSupport:1,boundaryCoherence:1,maintenanceOutcome:1,platformCompatibility:1,externalRationale:0,ecosystemHealth:0,securitySupport:0,reversibility:1,migrationCost:0,counterEvidence:0}; const authorityBase={id:"authority:release",key:"authority:release",subjectId:"lens:release",status:"approved",conclusion:"exception",rationale:"Authenticated release exception and migration fixture",alternatives:[],assumptions:[],reconsiderWhen:[{type:"manual-review"}],vector,assessmentConfidence:"high",evidence:[],governanceRiskClass:"R1",decidedBy:"user",createdAt:"2026-08-08T00:00:00.000Z"}; const authority={...authorityBase,semanticHash:hashFramedDomain("authority-record",authorityBase)}; const created=createRepositoryScriptLens({id:"lens:release",status:"active",authorityRecordId:authority.id,governanceBasis:[]}); const {semanticHash:old,...lensBase}=created; const lensBody={...lensBase,contributions:[...lensBase.contributions,"migration-overlay"],migrations:[{fromVersion:"0",toVersion:"1",transformIds:["migration:release"],validationIds:["validation:release"]}]}; const lens={...lensBody,semanticHash:hashFramedDomain("projection-lens",lensBody)}; const profileBase={id:"representation:release",key:"representation:release",version:"1",status:"active",target:"agent-context",selector,optimization:"clarity-first",protectedDimensions:["exception","concept-identity"],styleRules:[],generatorId:"generator:release",validatorIds:["validator:release"],semanticHash:z}; const profile={...profileBase,semanticHash:hashFramedDomain("semantic-representation-profile",profileBase)}; const docs=[
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"concept",id:"concept:release",key:"concept:release",lifecycle:"active",payload:{id:"concept:release",key:"concept:release",kind:"migration",name:"Release migration",aliases:[],statement:"Release remains governed",status:"active",sourceClass:"authored",confidence:1,tags:[],evidence:[],discoveryHash:z,semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"requirement",id:"requirement:release",key:"requirement:release",lifecycle:"active",payload:{id:"requirement:release",key:"requirement:release",title:"Release",aliases:[],statement:"Release is reproducible",status:"active",sourceClass:"authored",scope:selector,origin:[],evidence:[],discoveryHash:z,semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"behavioral-scenario",id:"scenario:release",key:"scenario:release",lifecycle:"active",payload:{id:"scenario:release",key:"scenario:release",title:"Release",aliases:[],status:"active",sourceClass:"authored",scope:selector,steps:[{role:"trigger",statement:"a fresh consumer installs and invokes the packed kernel"},{role:"expected-outcome",statement:"the installed kernel works"}],evidence:[],discoveryHash:z,semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"relation",id:"relation:release",key:"relation:relation:release",lifecycle:"active",payload:{id:"relation:release",fromId:"requirement:release",toId:"concept:release",type:"requires",sourceClass:"authored",confidence:1,evidence:[],active:true,semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"rule",id:"rule:release",key:"rule:release",lifecycle:"active",payload:{id:"rule:release",key:"rule:release",version:"1",effect:"require",authorityClass:"approved-user-intent",governanceBasis:[],selector,predicates:[],rationale:"release gate",evidence:[],conflictPolicy:"error",validatorIds:[],transformIds:[],semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"authority-record",id:authority.id,key:authority.key,lifecycle:authority.status,payload:authority}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"projection-lens",id:lens.id,key:lens.key,lifecycle:lens.status,payload:lens}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"semantic-representation-profile",id:profile.id,key:profile.key,lifecycle:profile.status,payload:profile}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"architecture-concern",id:"concern:release",key:"release-concern",lifecycle:"resolved",payload:{id:"concern:release",key:"release-concern",title:"Release runtime",question:"Which runtime supports the bounded local release kernel?",scope:{op:"atom",field:"path",matcher:"glob",value:"scripts/*.mjs"},sourceClass:"authored",status:"resolved",materiality:"deferable",activationReasons:[],relatedConceptIds:["concept:release"],relatedRequirementIds:["requirement:release"],decisionIds:["decision:release"],evidence:[],semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"developer-preference",id:"preference:release",key:"release-preference",lifecycle:"active",payload:{id:"preference:release",key:"release-preference",scope:"project",selector,strength:"prefer",statement:"Prefer a bounded local kernel for reproducible release verification.",status:"active",sourceClass:"authored",semanticHash:z}}),
withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"architecture-decision",id:"decision:release",key:"release",lifecycle:"active",payload:{id:"decision:release",key:"release",concernId:"concern:release",title:"Release architecture",decision:"Use the bounded local kernel",selectedOptionKey:"local",scope:{op:"atom",field:"path",matcher:"glob",value:"scripts/*.mjs"},lifecycle:"active",authorityRecordId:authority.id,governanceBasis:[],consequences:[],appliedPreferences:[],supersedesDecisionIds:[],migrationId:"migration:release",semanticHash:z}})]; for(const doc of docs) await repo.write(doc);`;
  required(await command(process.execPath, ["--input-type=module", "-e", code, root], { cwd: consumer }), "full canonical corpus setup");
}
async function installUnrelatedConcept(consumer, root) { const code = `import { withCanonicalHashes } from "@onepersonlabs/projector/core"; import { CanonicalFileRepository } from "@onepersonlabs/projector/runtime"; const z="sha256:v1:"+"0".repeat(64); await new CanonicalFileRepository(process.argv[1]).write(withCanonicalHashes({apiVersion:"projector/v2",schemaVersion:"2.0.0",kind:"concept",id:"concept:unrelated",key:"concept:unrelated",lifecycle:"active",payload:{id:"concept:unrelated",key:"concept:unrelated",kind:"behavior",name:"Unrelated",aliases:[],statement:"An unrelated concept",status:"active",sourceClass:"authored",confidence:1,tags:[],evidence:[],discoveryHash:z,semanticHash:z}}));`; required(await command(process.execPath, ["--input-type=module", "-e", code, root], { cwd: consumer }), "unrelated canonical setup"); }
async function observeDerived(consumer, root, mode, changedId = "") { const code = `import { hashFramedDomain } from "@onepersonlabs/projector/core"; import { CanonicalFileRepository, SqliteDerivedStore } from "@onepersonlabs/projector/runtime"; const root=process.argv[1],mode=process.argv[2],changed=process.argv[3]; const snapshot=await new CanonicalFileRepository(root).snapshot(); const store=new SqliteDerivedStore(root+"/.projector/state.db"); let revision; if(mode==="clean") revision=store.replaceCanonicalSnapshot(snapshot); else { const document=snapshot.documents.find(({id})=>id===changed); if(!document)throw new Error("changed document absent"); revision=store.applyCanonicalUpdate(document,snapshot.rootDigest); } const rows=store.canonicalRows(); const normalized=rows.map(({id,kind,semanticHash,canonicalDocumentHash})=>({id,kind,semanticHash,canonicalDocumentHash})); const semantics=rows.map(({id,kind,semanticHash})=>({id,kind,semanticHash})).sort((a,b)=>a.id.localeCompare(b.id)); const result={derivedDigest:hashFramedDomain("release-derived-state",normalized),semanticDigest:hashFramedDomain("independent-release-semantics",{schemaId:"canonical-envelope-v2",runtimeLane:"node-smol-toml-independent",entities:semantics}),entityIds:rows.map(({id})=>id).sort(),recomputedEntityIds:rows.filter(({indexedRevision})=>indexedRevision===revision.revision).map(({id})=>id).sort(),revision}; store.close(); console.log(JSON.stringify(result));`; const result = required(await command(process.execPath, ["--input-type=module", "-e", code, root, mode, changedId], { cwd: consumer }), `${mode} derived observation`); return JSON.parse(result.stdout); }
/** These observations deliberately leave unsupported installed delivery/recovery links open. */
export async function observeRepresentationClosure({ core, engine, testkit, inventory, sourceRevision, worktreeDigest }) {
  const ownerId = "scenario:verify-representation-end-to-end-closure";
  const selectOwner = (items) => {
    const item = items.find(({ id }) => id === ownerId);
    if (!item || !Array.isArray(item.owner.steps) || item.owner.steps.length === 0) throw new Error(`accepted canonical closure scenario missing: ${ownerId}`);
    return item;
  };
  const rejected = async (operation) => {
    try { await operation(); } catch (error) { return { rejected: true, error: error instanceof Error ? error.message : String(error) }; }
    throw new Error("negative control unexpectedly passed");
  };
  const owner = selectOwner(inventory);
  const authorityFailure = await rejected(() => selectOwner(inventory.filter(({ id }) => id !== ownerId)));
  const body = { sourceEntityIds: [ownerId], statements: [], scenarios: [{ id: ownerId, title: owner.owner.title, steps: owner.owner.steps }] };
  const source = { ...body, sourceSemanticHash: core.hashFramedDomain("canonical-representation-source", body) };
  const artifacts = new Map(); const telemetry = [];
  const store = { put: async (hash, text) => { artifacts.set(hash, text); }, get: async (hash) => artifacts.get(hash) };
  const binding = engine.createStateBinding({ compiledAgainst: { gitBase: sourceRevision, worktreeDigest, canonicalProjectorDigest: owner.semanticHash, toolchainDigest: sha(process.version) }, valueDependencies: [], queryDependencies: [] });
  const compiler = new engine.RepresentationCompiler({ artifacts: store, telemetry: { record: async (event) => { telemetry.push(event); } } });
  const compiled = await compiler.compile({ source, binding, profileKey: "machine-invariant@1" });
  const text = artifacts.get(compiled.projection.contentHash);
  const fidelity = await compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: text });
  const fidelityFailure = await rejected(() => compiler.validateCandidate({ source, profileKey: "machine-invariant@1", candidate: "" }));
  const telemetryFailure = await rejected(() => new engine.RepresentationCompiler({ artifacts: store, telemetry: { record: async () => { throw new Error("release negative: telemetry disconnected"); } } }).compile({ source, binding, profileKey: "machine-invariant@1" }));
  if (!telemetry.some(({ event }) => event === "representation.compiled")) throw new Error("compiler emitted no compilation observation");
  const observations = [
    { stage: "authority", output: { owner, source, fidelity }, failure: { authorityFailure, fidelityFailure }, entrypoint: "accepted canonical inventory / RepresentationCompiler.validateCandidate" },
    { stage: "observability", output: telemetry, failure: telemetryFailure, entrypoint: "RepresentationCompiler.compile / telemetry.record" },
  ].map(({ stage, output, failure, entrypoint }) => ({ obligationId: `representation.${stage}.v1`, stage, producer: "release-acceptance", entrypoint, observedOutputHash: core.hashFramedDomain("release-stage-output", output), failureHash: core.hashFramedDomain("release-stage-negative", failure), severedEdgeRejected: stage === "authority" ? failure.authorityFailure.rejected && failure.fidelityFailure.rejected : failure.rejected }));
  const receipt = testkit.createSubsystemClosureReceipt({ subsystemId: "representation", revision: sourceRevision, worktreeDigest, observations });
  const evaluation = testkit.evaluateSubsystemClosure({ subsystemId: "representation", requiredObligationIds: testkit.SUBSYSTEM_CLOSURE_STAGES.map((stage) => `representation.${stage}.v1`), expectedRevision: sourceRevision, expectedWorktreeDigest: worktreeDigest }, receipt);
  return { receipt, evaluation, fidelity, fidelityFailure };
}
async function runInstalledRepresentationClosure(installedProjector, inventory, sourceRevision, worktreeDigest) {
  const [core, engine, testkit] = await Promise.all(["core", "engine", "testkit"].map((name) => import(pathToFileURL(join(installedProjector, `exports/${name}.js`)).href)));
  const base = await observeRepresentationClosure({ core, engine, testkit, inventory, sourceRevision, worktreeDigest });
  const observedLinks = await observeInstalledRepresentationLinks({ packagedRoot: installedProjector });
  const receipt = testkit.createSubsystemClosureReceipt({ subsystemId: "representation", revision: sourceRevision, worktreeDigest, observations: [...base.receipt.observations, ...observedLinks] });
  const evaluation = testkit.evaluateSubsystemClosure({ subsystemId: "representation", requiredObligationIds: testkit.SUBSYSTEM_CLOSURE_STAGES.map((stage) => `representation.${stage}.v1`), expectedRevision: sourceRevision, expectedWorktreeDigest: worktreeDigest }, receipt);
  return { ...base, receipt, evaluation };
}

/** Fresh processes consume an isolated copy of the actual package. Only exercised links are returned. */
export async function observeInstalledRepresentationLinks({ packagedRoot }) {
  const temporary = await mkdtemp(join(tmpdir(), "projector-representation-links-"));
  const isolatedPackage = join(temporary, "package"), root = join(temporary, "repository");
  try {
    const rejectLinks = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error(`representation package cannot depend on a source link: ${join(directory, entry.name)}`);
        if (entry.isDirectory()) await rejectLinks(join(directory, entry.name));
      }
    };
    if ((await lstat(packagedRoot)).isSymbolicLink()) throw new Error("representation package root cannot be a source link");
    await rejectLinks(packagedRoot);
    await cp(packagedRoot, isolatedPackage, { recursive: true });
    const operationsPath = join(isolatedPackage, "exports/operations.js"), operationBytes = await readFile(operationsPath);
    const [core, runtime, engine, controlPlane] = await Promise.all(["core", "runtime", "engine", "control-plane"].map((name) => import(pathToFileURL(join(isolatedPackage, `exports/${name}.js`)).href)));
    const check = (condition, message) => { if (!condition) throw new Error(`installed representation link: ${message}`); };
    await mkdir(join(root, "src"), { recursive: true }); await mkdir(join(root, "test"));
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    const before = "export const greet = () => 'hello';\n", after = "export const greet = (name) => `hello ${name}`;\n";
    await writeFile(join(root, "src/greeting.mjs"), before);
    await writeFile(join(root, "test/greeting.test.mjs"), "import assert from 'node:assert/strict'; import { greet } from '../src/greeting.mjs'; assert.equal(greet('Ada'), 'hello Ada');\n");
    const requirement = { key: "greeting", title: "Greeting", statement: "The greeting includes the supplied name.", aliases: [] };
    const scenario = { key: "greet-name", title: "Greet a name", steps: [{ role: "precondition", statement: "A caller supplies a name." }, { role: "trigger", statement: "The caller requests a greeting." }, { role: "expected-outcome", statement: "The greeting includes that name." }] };
    const placeholder = core.hashFramedDomain("release-link-probe", "initial");
    for (const [kind, record, id] of [["requirement", requirement, "requirement:greeting"], ["behavioral-scenario", scenario, "scenario:greet-name"]]) {
      const payload = { ...record, id, aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "equals", value: "src/greeting.mjs" }, origin: [], evidence: [], discoveryHash: placeholder, semanticHash: placeholder };
      await new runtime.CanonicalFileRepository(root).write(core.withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind, id, key: record.key, lifecycle: "active", payload }));
    }
    await initializeGit(root);
    const childCode = `import { pathToFileURL } from 'node:url'; const { createBundledProjectorOperationRunner, createInstalledProjectorApplicationEvidenceHost } = await import(pathToFileURL(process.argv[1]).href); const runner=await createBundledProjectorOperationRunner({packagedRoot:process.argv[2],codexDataRoot:process.argv[4],applicationEvidence:createInstalledProjectorApplicationEvidenceHost}); const result=await runner.execute(JSON.parse(process.argv[3]),{signal:new AbortController().signal,environment:process.env}); console.log(JSON.stringify(result)); process.exitCode=result.exitCode;`;
    const invoke = async (operation, input) => {
      const request = { apiVersion: "projector.operation/v1", operation, repositoryRoot: root, requestId: `representation-link:${operation}`, input };
      const processResult = await command(process.execPath, ["--input-type=module", "-e", childCode, operationsPath, isolatedPackage, JSON.stringify(request), join(temporary, "codex")], { cwd: root, env: { ...process.env, NODE_PATH: "" }, timeout: 60_000 });
      let result; try { result = JSON.parse(processResult.stdout); } catch { /* A severed export cannot return an operation envelope. */ }
      return { process: processResult, ...(result === undefined ? {} : { result }) };
    };
    const succeeded = (observed) => { check(observed.process.exitCode === 0 && observed.result?.status === "succeeded", JSON.stringify(observed)); return observed.result.output; };
    succeeded(await invoke("init", {}));
    const proposal = { apiVersion: "projector.change-proposal/v1", requirements: [requirement], scenarios: [scenario], architecture: null, edits: [{ path: "src/greeting.mjs", before, after }], validation: { independentNodeTests: ["test/greeting.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["behavior", "architecture"] };
    const capture = succeeded(await invoke("change.capture", { request: "Change the greeting.", proposal: core.ChangeProposalSchema.parse(proposal) }));
    const plan = succeeded(await invoke("change.plan", { changeSelector: capture.selector }));
    const delivered = succeeded(await invoke("representation.inspect", { changeSelector: capture.selector, view: "content" }));
    check(plan.immutablePlanHash === capture.immutablePlanHash && delivered.association.planHash === plan.immutablePlanHash && delivered.association.planId === plan.plan.id, "representation is not bound to the captured public plan");
    check(delivered.artifactIntegrity.status === "valid" && delivered.semanticFidelity.status === "valid" && delivered.dependencyFreshness.status === "current", "fresh representation failed integrity, fidelity or currentness");
    check(typeof delivered.renderedText === "string" && core.hashFramedDomain("representation-artifact", delivered.renderedText) === delivered.association.representation.contentHash, "delivered bytes do not match the capsule content hash");
    check(delivered.delivery.stage === "operation-runner" && delivered.delivery.deliveredToRunnerBoundary === true && delivered.delivery.agentUnderstandingEstablished === false && delivered.delivery.behavioralCompletionEstablished === false, "delivery assurance does not name the actual runner boundary");
    const wrongCapsule = await invoke("representation.inspect", { changeSelector: capture.selector, capsuleId: `${delivered.association.capsuleId}:severed`, view: "content" });
    check(wrongCapsule.process.exitCode !== 0 && wrongCapsule.result?.status === "failed" && wrongCapsule.result?.error?.message === "requested capsule is not bound to the authenticated lifecycle plan" && !wrongCapsule.result?.output?.renderedText, "severed capsule association was accepted");
    const contentPath = join(root, ".projector/runtime/representations/content", `${delivered.association.representation.contentHash.slice("sha256:v1:".length)}.txt`), exactBytes = await readFile(contentPath);
    await writeFile(contentPath, "release negative: artifact bytes severed");
    let tampered;
    try { tampered = succeeded(await invoke("representation.inspect", { changeSelector: capture.selector, view: "content" })); }
    finally { await writeFile(contentPath, exactBytes); }
    check(tampered.artifactIntegrity.status === "invalid" && tampered.semanticFidelity.status === "invalid" && tampered.renderedText === undefined, "downstream reader leaked unauthenticated instructions");
    await rename(operationsPath, `${operationsPath}.severed`);
    let severedPackage;
    try { severedPackage = await invoke("representation.inspect", { changeSelector: capture.selector, view: "content" }); }
    finally { await rename(`${operationsPath}.severed`, operationsPath); }
    check(severedPackage.process.exitCode !== 0 && severedPackage.result === undefined && severedPackage.process.stderr.includes("ERR_MODULE_NOT_FOUND"), "severed packaged export found a source fallback");
    check((await readFile(operationsPath)).equals(operationBytes), "packaged export did not restore exactly");
    const restored = succeeded(await invoke("representation.inspect", { changeSelector: capture.selector, view: "content" }));
    check(restored.renderedText === delivered.renderedText && restored.artifactIntegrity.status === "valid", "fresh process failed to consume restored exact bytes");
    const recovered = await observeRepresentationProfileRecovery({ root, core, engine, controlPlane, proposal, reconcile: async (input) => succeeded(await invoke("representation.reconcile", input)) });
    check(recovered.result.delivery.stage === "operation-runner" && recovered.result.delivery.deliveredToRunnerBoundary === true, "profile recovery did not cross the packaged runner boundary");
    const observations = [
      { stage: "public-composition", output: { capture, plan, association: delivered.association, fidelity: delivered.semanticFidelity }, negative: wrongCapsule, entrypoint: "change.capture / change.plan / representation.inspect capsule association" },
      { stage: "downstream-consumer", output: delivered, negative: tampered, entrypoint: "representation.inspect content / operation-runner delivery" },
      { stage: "packed-release", output: { exportBytesHash: sha(operationBytes), delivered: restored }, negative: severedPackage, entrypoint: "source-absent copied package exports/operations.js in fresh process" },
    ].map(({ stage, output, negative, entrypoint }) => ({ obligationId: `representation.${stage}.v1`, stage, producer: "release-acceptance", entrypoint, observedOutputHash: core.hashFramedDomain("release-stage-output", output), failureHash: core.hashFramedDomain("release-stage-negative", negative), severedEdgeRejected: true }));
    return [...observations, recovered.observation];
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

/** Real historical capture and public recovery. The final gate supplies a fresh packaged operation invocation. */
export async function observeRepresentationProfileRecovery({ root, core, engine, controlPlane, proposal, reconcile }) {
  const check = (condition, message) => { if (!condition) throw new Error(`representation profile recovery: ${message}`); };
  const rejected = async (input, pattern) => {
    try { await reconcile(input); } catch (error) {
      check(pattern.test(String(error.message)), `negative failed for an unrelated reason: ${error.message}`);
      return { rejected: true, reason: error.message };
    }
    throw new Error("representation profile recovery negative unexpectedly succeeded");
  };
  const request = `Change the greeting while preserving its exact accepted name behavior and repository boundary. ${"Retain authenticated intent. ".repeat(40)}`;
  const knowledge = await controlPlane.RepositoryKnowledgeService.create({ repositoryRoot: root });
  const context = await knowledge.context({ request, entities: ["requirement:greeting"], operation: "change", persist: true });
  const lifecycle = await controlPlane.RepositoryChangeLifecycleService.create(root, { representationProfileKey: "agent-compact@1" });
  const historical = await lifecycle.capture({ request, proposal, knowledgeContextId: context.id });
  const approval = await lifecycle.approve(historical.capture.semanticChangeId, historical.capture.planHash);
  const reference = historical.capture.capsules[0].representation;
  check(reference?.profileId === "profile:agent-compact" && reference.profileVersion === "1", "historical capture did not select authentic compact @1");
  check(engine.BUILT_IN_REPRESENTATION_PROFILES["agent-compact@1"].semanticHash === "sha256:v1:c48716e3554bfc918401ba5b7ba03a39b311030c8cc181da9afd9cc80f5117e5", "historical @1 descriptor changed");
  const historyRoot = join(root, ".projector/runtime/change-lifecycles");
  const existingFiles = [...await filesUnder(join(historyRoot, "captures")), ...await filesUnder(join(historyRoot, "approvals"))];
  const before = new Map(await Promise.all(existingFiles.map(async path => [path, await readFile(path)])));
  const approvalNames = (await readdir(join(historyRoot, "approvals"))).sort();
  const result = await reconcile({ changeSelector: historical.capture.semanticChangeId, approvalSelector: approval.id });
  check(result.profile.fromVersion === "1" && result.profile.toVersion === "2" && result.profile.fromSemanticHash !== result.profile.toSemanticHash, "recovery did not observe the versioned profile transition");
  check(result.replacement.changeSelector !== historical.capture.semanticChangeId && result.replacement.planHash !== historical.capture.planHash, "recovery reused the historical plan or selector");
  check(result.replacement.artifactStatus === "valid" && result.replacement.dependencyStatus === "current" && result.replacement.approvalStatus === "not-supplied" && result.automaticApprovalCreated === false && result.historical.approvalStatus === "authenticated-stale", "replacement or historical approval assurance is incorrect");
  check(["current", "rebound"].includes(result.context.status) && result.context.contextId === context.id && result.context.observedContextId.startsWith("knowledge_context_"), "required retained context was not reconciled");
  const dependentIds = [reference.projectionId, ...historical.capture.capsules.map(({ id }) => id)];
  check(dependentIds.every(id => result.invalidation.invalidatedIds.includes(id) && result.reconciliation.refreshedIds.includes(id)), "recovery omitted a historical projection or capsule");
  check(result.invalidation.preservedCanonicalEntityIds.includes("requirement:greeting"), "recovery omitted preserved canonical authority");
  const sameVersion = await rejected({ changeSelector: result.replacement.changeSelector }, /already current/iu);
  const recordPath = join(root, ".projector/runtime/representations/projections", `${core.hashFramedDomain("representation-projection-path", reference.projectionId).slice("sha256:v1:".length)}.json`);
  const originalRecord = await readFile(recordPath);
  const record = JSON.parse(originalRecord.toString("utf8"));
  const boundState = engine.createStateBinding({ compiledAgainst: record.projection.boundState.compiledAgainst, valueDependencies: record.projection.boundState.valueDependencies.map(dependency => dependency.kind === "representation-profile" ? { ...dependency, versionHash: core.hashFramedDomain("release-severed-profile", null) } : dependency), queryDependencies: record.projection.boundState.queryDependencies });
  const { semanticHash: oldHash, ...basis } = record.projection; void oldHash;
  const altered = { ...basis, boundState }, projection = { ...altered, semanticHash: core.hashFramedDomain("representation-projection", altered) };
  let badBinding, missingArtifact;
  try {
    await writeFile(recordPath, core.canonicalJson(core.createDurableRepresentationArtifactRecord(projection)));
    badBinding = await rejected({ changeSelector: historical.capture.semanticChangeId }, /historical representation profile binding is invalid/iu);
  } finally { await writeFile(recordPath, originalRecord); }
  await rename(recordPath, `${recordPath}.severed`);
  try { missingArtifact = await rejected({ changeSelector: historical.capture.semanticChangeId }, /historical representation artifact is unavailable/iu); }
  finally { await rename(`${recordPath}.severed`, recordPath); }
  for (const [path, bytes] of before) check((await readFile(path)).equals(bytes), `historical lifecycle bytes changed: ${path}`);
  check(core.canonicalJson((await readdir(join(historyRoot, "approvals"))).sort()) === core.canonicalJson(approvalNames), "recovery or a negative created approval authority");
  return { result, observation: { obligationId: "representation.invalidation-recovery.v1", stage: "invalidation-recovery", producer: "release-acceptance", entrypoint: "authentic historical RepositoryChangeLifecycleService capture / representation.reconcile", observedOutputHash: core.hashFramedDomain("release-stage-output", { result, preservedHistory: [...before].map(([path, bytes]) => ({ path: path.slice(root.length), bytesHash: sha(bytes) })) }), failureHash: core.hashFramedDomain("release-stage-negative", { sameVersion, badBinding, missingArtifact }), severedEdgeRejected: sameVersion.rejected && badBinding.rejected && missingArtifact.rejected } };
}

async function persistEvidence(evidence) { const root = join(repositoryRoot, "release/evidence"); await mkdir(root, { recursive: true }); const bytes = `${JSON.stringify(evidence, null, 2)}\n`; const contentPath = join(root, `${evidence.contentHash.slice("sha256:v1:".length)}.json`); try { await writeFile(contentPath, bytes, { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST" || await readFile(contentPath, "utf8") !== bytes) throw error; } const current = { version: 1, evidenceHash: evidence.contentHash, manifest: contentPath.slice(repositoryRoot.length + 1), sourceRevision: evidence.sourceRevision, worktreeDigest: evidence.worktreeDigest, buildDigest: evidence.buildDigest, tarballDigest: evidence.tarballDigest }; const temporary = join(root, `.current-${process.pid}.tmp`); await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`, { flag: "wx" }); await rename(temporary, join(root, "current.json")); return current; }
async function invalidateEvidence(error) { const root = join(repositoryRoot, "release/evidence"); await mkdir(root, { recursive: true }); const current = join(root, "current.json"); try { await rm(join(root, "current.invalid.json"), { force: true }); await rename(current, join(root, "current.invalid.json")); } catch (failure) { if (failure.code !== "ENOENT") throw failure; } await writeFile(join(root, "failure.json"), `${JSON.stringify({ version: 1, status: "invalid", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`); }

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "projector-release-gate-")); const candidateRoot = join(temporary, "release-candidate"); const consumer = join(temporary, "consumer"); const repository = join(temporary, "repository"); const clone = join(temporary, "rebuild-clone"); const cleanMutation = join(temporary, "clean-mutation"); const rawArtifacts = [];
  try {
    const traceability = JSON.parse(await readFile(join(repositoryRoot, "release/traceability.json"), "utf8"));
    const localTestkit = await import("@projector/testkit");
    const authority = JSON.parse(await readFile(join(repositoryRoot, "release/traceability-authority.json"), "utf8"));
    if (authority.version !== 2) throw new Error("canonical release test bindings require reviewed v2 migration");
    const legacyMappings = Object.values(authority.obligations).flatMap(({ obligationId, legacyIds }) => legacyIds.map((legacyId) => ({ legacyId, ownerIds: [obligationId] })));
    const inventory = localTestkit.deriveAcceptanceInventory({ canonical: await readCanonicalReleaseSources(repositoryRoot), legacyMappings });
    const candidate = await buildSourceSeveredReleaseBundle(candidateRoot); const tarball = join(candidate.root, candidate.manifest.tarballPath); await mkdir(consumer); await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}\n'); await installTarball(consumer, tarball, temporary);
    const installedProjector = join(consumer, "node_modules/@onepersonlabs/projector"); for (const name of ["core", "analyzers", "engine", "runtime", "integrations", "testkit"]) if ((await lstat(join(installedProjector, "node_modules/@projector", name))).isSymbolicLink()) throw new Error(`installed ${name} resolved through a source symlink`);
    const importCode = `for(const id of ${JSON.stringify(publicExports)}){const namespace=await import(id);if(Object.keys(namespace).length===0)throw new Error(id+" has no exports");for(const value of Object.values(namespace))void value;} console.log("exports:"+${publicExports.length});`; const imported = required(await command(process.execPath, ["--input-type=module", "-e", importCode], { cwd: consumer }), "installed exports"); rawArtifacts.push({ id: "installed-exports", bytesHash: sha(imported.stdout) });
    const installedControlPlane = await import(pathToFileURL(join(installedProjector, "exports/control-plane.js")).href);
    const candidateFormat = installedControlPlane.createReleaseCandidateProjectDataFormat({
      candidate: {
        packageIdentity: { name: candidate.manifest.release.name, version: candidate.manifest.release.version },
        files: candidate.files.map(({ path, digest }) => ({ path, digest })),
      },
    });
    if (candidateFormat.packageIdentity.name !== candidate.manifest.release.name || candidateFormat.packageIdentity.version !== candidate.manifest.release.version) throw new Error("installed project-data format descriptor does not retain the authenticated candidate identity");
    rawArtifacts.push({ id: "project-data-format-snapshot", bytesHash: candidateFormat.snapshotHash });
    const typeImports = publicExports.map((id, index) => `import * as p${index} from ${JSON.stringify(id)};`).join("\n"); await writeFile(join(consumer, "consumer.ts"), `${typeImports}\nconst namespaces = [${publicExports.map((_, index) => `p${index}`).join(",")}];\nvoid namespaces;\n`); await writeFile(join(consumer, "tsconfig.json"), `${JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", target: "ES2023", strict: true, noEmit: true, skipLibCheck: false }, files: ["consumer.ts"] }, null, 2)}\n`); required(await command(process.execPath, [join(repositoryRoot, "node_modules/typescript/bin/tsc"), "-p", join(consumer, "tsconfig.json")], { cwd: consumer }), "strict NodeNext consumer compile");
    const packedLifecycle = await runPackedLifecycleAcceptance({ temporaryRoot: temporary, candidateRoot: candidate.root }); rawArtifacts.push({ id: "packed-held-out-lifecycle", bytesHash: packedLifecycle.evidenceHash, runId: packedLifecycle.runId }, { id: "packed-held-out-lifecycle-transcript", bytesHash: packedLifecycle.transcriptHash, runId: packedLifecycle.runId });

    await mkdir(repository); await writeFile(join(repository, "package.json"), '{"private":true}\n'); await installCanonicalCorpus(consumer, repository);
    const originalRaw = await rawCanonicalObservation(repository); await mkdir(join(clone, ".projector"), { recursive: true }); for (const directory of ["model", "rules", "lenses", "authorities", "decisions", "concerns", "preferences", "representations", "receipts"]) { const source = join(repository, ".projector", directory); try { await cp(source, join(clone, ".projector", directory), { recursive: true }); } catch (error) { if (error.code !== "ENOENT") throw error; } } await writeFile(join(clone, "package.json"), "{\"private\":true}\n"); await initializeGit(clone); const rebuiltRaw = await rawCanonicalObservation(clone); if (rebuiltRaw.digest !== originalRaw.digest) throw new Error("separate-root raw corpus disagrees"); const requiredKinds = ["concept", "requirement", "behavioral-scenario", "relation", "rule", "projection-lens", "authority-record", "semantic-representation-profile", "architecture-decision", "architecture-concern", "developer-preference"]; const requiredFamilies = ["lens", "authority", "exception", "migration", "representation"]; if (requiredKinds.some((kind) => !rebuiltRaw.kinds.includes(kind)) || requiredFamilies.some((family) => !rebuiltRaw.families.includes(family))) throw new Error(`full canonical/governance family missing: ${rebuiltRaw.kinds.join(",")} / ${rebuiltRaw.families.join(",")}`);
    const baselineDerived = await observeDerived(consumer, clone, "clean"); await installUnrelatedConcept(consumer, clone); const incrementalDerived = await observeDerived(consumer, clone, "incremental", "concept:unrelated"); await mkdir(join(cleanMutation, ".projector"), { recursive: true }); for (const directory of ["model", "rules", "lenses", "authorities", "decisions", "concerns", "preferences", "representations", "receipts"]) { const source = join(clone, ".projector", directory); try { await cp(source, join(cleanMutation, ".projector", directory), { recursive: true }); } catch (error) { if (error.code !== "ENOENT") throw error; } } await writeFile(join(cleanMutation, "package.json"), "{\"private\":true}\n"); await initializeGit(cleanMutation); const cleanDerived = await observeDerived(consumer, cleanMutation, "clean"); const mutationRaw = await rawCanonicalObservation(cleanMutation); if (baselineDerived.entityIds.includes("concept:unrelated") || incrementalDerived.recomputedEntityIds.join(",") !== "concept:unrelated") throw new Error("incremental locality recomputed outside the changed entity");

    const testkit = await import(pathToFileURL(join(installedProjector, "exports/testkit.js")).href);
    const traceabilityVerification = await testkit.verifyTraceabilityManifest(traceability, inventory, { repositoryRoot }); rawArtifacts.push({ id: "traceability-test-run", bytesHash: traceabilityVerification.runEvidenceHash });
    const benchmark = await runReleaseBenchmarkAuthority(repositoryRoot); if (!benchmark.releaseAllowed) throw new Error(`release benchmark gates failed: ${JSON.stringify(benchmark.failures)}`); for (const observation of benchmark.rawObservations) rawArtifacts.push({ id: `benchmark:${observation.fixtureId}`, bytesHash: observation.outputHash });
    const conformance = testkit.evaluateIndependentConformance({ clean: cleanDerived, incremental: incrementalDerived, rawDocuments: mutationRaw.documents, schemaId: "canonical-envelope-v2", runtimeLane: "node-smol-toml-independent", locality: { changedEntityIds: ["concept:unrelated"], recomputedEntityIds: incrementalDerived.recomputedEntityIds }, evidenceIds: benchmark.rawObservations.map(({ outputHash }) => outputHash) }); if (!conformance.passed) throw new Error(`release conformance failed: ${conformance.reasons.join(", ")}`);

    const tarballDigest = sha(await readFile(tarball)); const sourceRevision = required(await command("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot }), "source revision").stdout.trim(); const listed = required(await command("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: repositoryRoot }), "worktree inventory").stdout.split("\0").filter(Boolean).map((path) => join(repositoryRoot, path)); const worktreeDigest = await observedTreeDigest(repositoryRoot, listed, required(await command("git", ["status", "--porcelain=v1"], { cwd: repositoryRoot }), "worktree status").stdout); const representationClosure = await runInstalledRepresentationClosure(installedProjector, inventory, sourceRevision, worktreeDigest); if (representationClosure.evaluation.status !== "closed") throw new Error(`representation closure remains unproved: ${representationClosure.evaluation.blockers.join("; ")}`); rawArtifacts.push({ id: "representation-subsystem-closure", bytesHash: representationClosure.receipt.receiptHash }); const buildFiles = (await Promise.all(["core", "analyzers", "engine", "runtime", "integrations", "testkit", "cli"].map((name) => filesUnder(join(repositoryRoot, `packages/${name}/dist`))))).flat(); const buildDigest = await observedTreeDigest(repositoryRoot, buildFiles); rawArtifacts.push({ id: "tarball", bytesHash: tarballDigest }, { id: "canonical-raw", bytesHash: originalRaw.digest }, { id: "rebuild-raw", bytesHash: rebuiltRaw.digest }); const deviations = JSON.parse(await readFile(join(repositoryRoot, "release/deviations.json"), "utf8")); const evidence = testkit.compileReleaseEvidence({ sourceRevision, worktreeDigest, toolchainDigest: sha(process.version), buildDigest, tarballDigest, rawArtifacts, traceability, traceabilityVerification, inventory, benchmark, rebuildDigest: cleanDerived.derivedDigest, conformance, deviations, subsystemClosureReceipts: [representationClosure.receipt] }); const current = await persistEvidence(evidence); if (current.evidenceHash !== evidence.contentHash || JSON.parse(await readFile(join(repositoryRoot, current.manifest), "utf8")).contentHash !== evidence.contentHash) throw new Error("durable release evidence current pointer disagrees"); await rm(join(repositoryRoot, "release/evidence/failure.json"), { force: true }); process.stdout.write(`${JSON.stringify({ status: "release-accepted", tarballDigest, evidenceHash: evidence.contentHash, representationClosureHash: representationClosure.receipt.receiptHash, packedLifecycleHash: packedLifecycle.evidenceHash, inventoryOwners: inventory.length, exports: publicExports.length, evidencePath: current.manifest })}\n`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { try { await main(); } catch (error) { await invalidateEvidence(error); throw error; } }
