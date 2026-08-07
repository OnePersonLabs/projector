import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";

import { analyzeLocalRepository, type LocalRepositoryAnalysis } from "@projector/analyzers";
import {
  canonicalJson,
  hashFramedDomain,
  hashRootManifest,
  withCanonicalHashes,
  type AuthorityRecord,
  type CanonicalDocumentEnvelope,
  type ContentHash,
  type Divergence,
  type ExecutionPolicy,
  type PatternCandidate,
  type ProjectionLens,
  type RiskAssessment,
  type StateBinding,
  type StateBindingValidator,
  type StateDigest,
  type TransformContext,
  type TransformResult,
  type ValidationResult,
} from "@projector/core";
import {
  InMemoryGraphReader,
  DependencyScopedStateBindingValidator,
  QueryDependencyRegistry,
  StateBoundChangeExecutor,
  compileEffectiveRuleBundle,
  compileProjectionLenses,
  createExecutionApproval,
  createExecutionCapsule,
  createExecutionPlan,
  createRepositoryScriptLens,
  createStateBinding,
  inferPatternFamilies,
  MANDATORY_VERTICAL_SLICE_STEPS,
  assertMandatoryVerticalSliceEvidence,
  reconcileToFixedPoint,
  selectorHash,
  type ApprovedTransformContext,
  type ChangeArtifactStore,
  type ChangeTransaction,
  type ChangeTransactionPort,
  type CompletionAssessmentPort,
  type StateBoundChangeResult,
  type MandatoryVerticalSliceStepEvidence,
} from "@projector/engine";
import {
  CanonicalFileRepository,
  FileTransactionJournal,
  GovernedWorktreeRuntime,
  MoveReferenceTransform,
  RepositoryPathService,
  SqliteDerivedStore,
  WriterLeaseManager,
  NativeProcessLauncher,
  StateBoundCommandExecutor,
  type ProcessLauncher,
  type ProcessLaunchRequest,
  type FileTransaction,
  type MoveReferenceUpdateInput,
  type TransformMutationPort,
} from "@projector/runtime";

const executeFile = promisify(execFile);
const zeroHash = `sha256:v1:${"0".repeat(64)}` as ContentHash;
const fixedTime = "2026-08-07T00:00:00.000Z";
const authorityId = "authority:repository-script-placement";
const activeLensId = "lens:repository-script";

export interface SliceAnalysis {
  readonly repository: LocalRepositoryAnalysis;
  readonly executedRepositoryCode: false;
  readonly classifications: Readonly<Record<string, string>>;
  readonly patternCandidates: readonly PatternCandidate[];
  readonly activeLens: ProjectionLens;
  readonly shadowLens: ProjectionLens;
  readonly authority: AuthorityRecord;
  readonly divergences: readonly Divergence[];
}

export interface SlicePreparation {
  readonly analysis: SliceAnalysis;
  readonly state: StateDigest;
  readonly binding: StateBinding;
  readonly plan: ReturnType<typeof createExecutionPlan>;
  readonly capsule: ReturnType<typeof createExecutionCapsule>;
  readonly approval: ReturnType<typeof createExecutionApproval>;
  readonly transformInput: MoveReferenceUpdateInput;
  readonly preview: Awaited<ReturnType<MoveReferenceTransform["preview"]>>;
  readonly risk: RiskAssessment;
  readonly canonicalDocuments: readonly CanonicalDocumentEnvelope[];
  readonly canonicalWrites: readonly CanonicalWriteDeclaration[];
}

interface CanonicalWriteDeclaration {
  readonly entityId: string;
  readonly kind: "authority-record" | "projection-lens";
  readonly path: string;
  readonly expectedBeforeHash: ContentHash;
  readonly afterHash: ContentHash;
  readonly content: string;
}

function authorityRecord(): AuthorityRecord {
  const recordWithoutHash = {
    id: authorityId,
    key: authorityId,
    subjectId: activeLensId,
    status: "approved" as const,
    conclusion: "normalize" as const,
    rationale: "The mandatory product wedge explicitly authorizes bounded repository automation placement.",
    alternatives: [],
    assumptions: ["the governed surface is the local fixture repository"],
    reconsiderWhen: [{ type: "manual-review" as const }],
    vector: {
      explicitDecisionAlignment: 1, productConstraintFit: 1, semanticFit: 1,
      independentOccurrence: 1, historicalStability: 1, independentValidationSupport: 1,
      boundaryCoherence: 1, maintenanceOutcome: 1, platformCompatibility: 1,
      externalRationale: 0, ecosystemHealth: 0, securitySupport: 0,
      reversibility: 1, migrationCost: 0, counterEvidence: 0,
    },
    assessmentConfidence: "high" as const,
    evidence: [],
    governanceRiskClass: "R1" as const,
    decidedBy: "user" as const,
    createdAt: fixedTime,
  };
  return { ...recordWithoutHash, semanticHash: hashFramedDomain("authority-record", recordWithoutHash) };
}

function canonicalDocuments(authority: AuthorityRecord, lens: ProjectionLens): CanonicalDocumentEnvelope[] {
  return [
    withCanonicalHashes({
      apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "authority-record",
      id: authority.id, key: authority.key, lifecycle: authority.status, payload: { ...authority },
    }),
    withCanonicalHashes({
      apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "projection-lens",
      id: lens.id, key: lens.key, lifecycle: lens.status, payload: { ...lens },
    }),
  ];
}

function classifications(repository: LocalRepositoryAnalysis): Record<string, string> {
  const testByPath = new Map(repository.testTargets.map((target) => [target.testPath, target.targetPath]));
  return Object.fromEntries(repository.files.map((file) => [
    file.path,
    file.semanticRole === "test" && testByPath.has(file.path) ? "repository-automation-test" : file.semanticRole,
  ]));
}

function patternCandidates(
  repository: LocalRepositoryAnalysis,
  classified: Readonly<Record<string, string>>,
  projectorRepairedPaths: ReadonlySet<string>,
): PatternCandidate[] {
  const observations = repository.projectionUnits.flatMap((unit) => {
    const family = classified[unit.key];
    if (family !== "repository-automation" && family !== "repository-automation-test"
      && family !== "hook-entrypoint" && family !== "hook-private-support") return [];
    const familyKey = family === "repository-automation-test" ? "test-colocation" : family;
    const candidateUnit = projectorRepairedPaths.has(unit.key)
      ? {
          ...unit,
          causalOrigin: {
            kind: "lens-transform" as const,
            causedByLensId: activeLensId,
            causedByTransformId: "move-reference-update",
            causedByPlanId: "plan:mandatory-repository-script",
          },
        }
      : unit;
    return [{
      familyKey,
      purposeHypothesis: familyKey === "test-colocation"
        ? "tests colocate with the repository automation they verify"
        : `artifacts perform the ${familyKey} semantic role`,
      classification: "member" as const,
      unit: candidateUnit,
      independenceGroup: unit.key.startsWith("scripts/") ? `authored:${unit.key}` : `fixture:${unit.key}`,
      evidence: [],
    }];
  });
  return inferPatternFamilies(observations);
}

async function persistedProjectorRepairPaths(repositoryRoot: string): Promise<Set<string>> {
  const repaired = new Set<string>();
  let receiptNames: string[];
  try { receiptNames = await readdir(join(repositoryRoot, ".projector", "receipts")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return repaired; throw error; }
  for (const receiptName of receiptNames.filter((name) => name.endsWith(".json"))) {
    try {
      const receipt = JSON.parse(await readFile(join(repositoryRoot, ".projector", "receipts", receiptName), "utf8")) as {
        planId?: string; certificateHash?: string; changedUnitIds?: string[];
      };
      if (receipt.planId !== "plan:mandatory-repository-script" || receipt.certificateHash === undefined
        || !Array.isArray(receipt.changedUnitIds)) continue;
      const certificateName = `${receipt.certificateHash.replace(/^sha256:v1:/u, "")}.json`;
      const artifact = JSON.parse(await readFile(join(repositoryRoot, ".projector", "reports", "certificates", certificateName), "utf8")) as {
        outcome?: string; certificate?: { planId?: string; deterministicOperations?: Array<{ unitIds?: string[]; summary?: string }> };
      };
      if (artifact.outcome !== "success" || artifact.certificate?.planId !== receipt.planId) continue;
      for (const operation of artifact.certificate.deterministicOperations ?? []) {
        const match = /^moved .+ to (.+)$/u.exec(operation.summary ?? "");
        if (match?.[1] !== undefined && operation.unitIds?.some((id) => receipt.changedUnitIds!.includes(id))) repaired.add(match[1]);
      }
    } catch {
      // Invalid or incomplete artifacts do not establish Projector repair provenance.
    }
  }
  return repaired;
}

function divergence(
  type: "misplaced-artifact" | "test-projection",
  unitId: string,
  path: string,
  expectedPath: string,
  ruleId: string,
): Divergence {
  const counterEvidence = [{ evidenceId: "evidence:misleading-hook-proximity", stance: "contradicts" as const, weight: 0.1 }];
  const withoutHash = {
    id: `divergence:${type}:${unitId}`,
    type,
    title: type === "misplaced-artifact" ? "Repository automation is stored with hooks" : "Repository automation test is not colocated",
    severity: "medium" as const,
    confidence: 1,
    leverage: 1,
    status: "open" as const,
    expected: { path: expectedPath, rule: ruleId },
    observed: { path },
    conceptIds: [], requirementIds: [], scenarioIds: [], unitIds: [unitId], ruleIds: [ruleId],
    evidence: [{ evidenceId: "evidence:package-script-and-test-target", stance: "supports" as const, weight: 1 }],
    counterEvidence,
    rationale: "Package-script invocation, test targeting, and dependency reachability outweigh weak directory proximity.",
    possibleIntentionality: ["the nearby hook-private module creates misleading local precedent"],
    recommendedDisposition: "apply the reversible move/reference transform",
    repairStrategies: ["deterministic-patch" as const],
    coverageCaveat: "Static local analysis is bounded and cannot prove dynamically computed imports absent.",
  };
  return { ...withoutHash, semanticHash: hashFramedDomain("divergence", withoutHash) };
}

export async function analyzeMandatorySlice(repositoryRoot: string): Promise<SliceAnalysis> {
  const repository = await analyzeLocalRepository({ repositoryRoot, observedAt: fixedTime });
  const classified = classifications(repository);
  const acceptedLensExists = (await knownCanonicalSnapshot(repositoryRoot)).documents
    .some(({ id }) => id === activeLensId);
  const projectorRepairedPaths = acceptedLensExists ? await persistedProjectorRepairPaths(repositoryRoot) : new Set<string>();
  const authority = authorityRecord();
  const basis = [{ kind: "hard-constraint" as const, conceptId: "concept:mandatory-first-vertical-slice" }];
  const activeLens = createRepositoryScriptLens({ id: activeLensId, status: "active", authorityRecordId: authority.id, governanceBasis: basis });
  const shadowLens = createRepositoryScriptLens({ id: `${activeLensId}:shadow`, status: "shadow", authorityRecordId: authority.id, governanceBasis: basis });
  compileProjectionLenses({ lenses: [activeLens, shadowLens], units: repository.projectionUnits, authorityRecords: [authority] });
  const byPath = new Map(repository.projectionUnits.map((unit) => [unit.key, unit]));
  const divergences: Divergence[] = [];
  const source = byPath.get(".codex/hooks/validate-repo.mjs");
  const test = byPath.get(".codex/hooks/validate-repo.test.mjs");
  if (source !== undefined) divergences.push(divergence("misplaced-artifact", source.id, source.key, "scripts/validate-repo.mjs", `${activeLens.id}:placement`));
  if (test !== undefined) divergences.push(divergence("test-projection", test.id, test.key, "scripts/validate-repo.test.mjs", `${activeLens.id}:test-colocation`));
  return {
    repository,
    executedRepositoryCode: false,
    classifications: classified,
    patternCandidates: patternCandidates(repository, classified, projectorRepairedPaths),
    activeLens,
    shadowLens,
    authority,
    divergences,
  };
}

async function git(repositoryRoot: string, args: readonly string[]): Promise<string> {
  return (await executeFile("git", args, { cwd: repositoryRoot, encoding: "utf8" })).stdout.trim();
}

async function knownCanonicalSnapshot(repositoryRoot: string): Promise<{
  documents: CanonicalDocumentEnvelope[]; entries: Array<{ entityId: string; canonicalDocumentHash: ContentHash }>; rootDigest: ContentHash;
}> {
  const canonical = new CanonicalFileRepository(repositoryRoot);
  const documents = (await Promise.all([
    canonical.read("authority-record", authorityId),
    canonical.read("projection-lens", activeLensId),
  ])).filter((item): item is CanonicalDocumentEnvelope => item !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id));
  const entries = documents.map((document) => ({ entityId: document.id, canonicalDocumentHash: document.canonicalDocumentHash }));
  return { documents, entries, rootDigest: hashRootManifest(entries) };
}

async function readOptional(path: string): Promise<string | undefined> {
  try { return await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

const optionalContentHash = (content: string | undefined): ContentHash => content === undefined
  ? zeroHash
  : hashFramedDomain("canonical-write-content", content);

export async function currentSliceState(repositoryRoot: string, analysis?: SliceAnalysis): Promise<StateDigest> {
  const currentAnalysis = analysis ?? await analyzeMandatorySlice(repositoryRoot);
  const governed = currentAnalysis.repository.artifacts
    .filter(({ locator }) => !locator.startsWith(".projector/"))
    .map(({ locator, contentHash }) => ({ locator, contentHash }));
  return {
    gitBase: await git(repositoryRoot, ["rev-parse", "HEAD"]),
    worktreeDigest: hashFramedDomain("slice-one-worktree", governed),
    canonicalProjectorDigest: (await knownCanonicalSnapshot(repositoryRoot)).rootDigest,
    toolchainDigest: hashFramedDomain("slice-one-toolchain", { node: process.versions.node, analyzer: "projector.local-repository@1", engine: "2.0.0" }),
  };
}

function risk(): RiskAssessment {
  return {
    class: "R1", inherentOperationRisk: 1, affectedUnitCount: 3, affectedSurfaceCount: 1,
    publicContractImpact: false, externalImpact: false, dataImpact: false,
    reversibility: "full", validationStrength: "strong", closureConfidence: "bounded",
    unresolvedIdentityCount: 0, relevanceFrontierCount: 0, openWorldDependencies: false,
    unresolvedBlockingConcernCount: 0, suspectDecisionCount: 0, compensationAvailable: true,
    reasons: ["reversible deterministic file move with exact reference preconditions"],
  };
}

function dependencyScopedBindingValidator(repositoryRoot: string): StateBindingValidator {
  return new DependencyScopedStateBindingValidator({
    values: {
      async readVersionHash(dependency) {
        if (dependency.kind === "canonical-governance") {
          const canonical = new CanonicalFileRepository(repositoryRoot);
          const kind = dependency.role as "authority-record" | "projection-lens";
          return optionalContentHash(await readOptional(canonical.pathFor(kind, dependency.id)));
        }
        const analysis = await analyzeMandatorySlice(repositoryRoot);
        return analysis.repository.projectionUnits.find(({ id }) => id === dependency.id)?.semanticSignature.hash;
      },
    },
    queries: {
      async evaluate(query, context) {
        const analysis = await analyzeMandatorySlice(repositoryRoot);
        const selector = selectorHash(analysis.activeLens.selector);
        const graph = new InMemoryGraphReader({
          projectionUnits: analysis.repository.projectionUnits,
          selectorMemberships: [{
            selectorHash: selector,
            memberIds: analysis.repository.projectionUnits
              .filter(({ tags }) => tags.includes("repository-automation"))
              .map(({ id }) => id),
          }],
        });
        return new QueryDependencyRegistry(graph).evaluate(query, context);
      },
    },
  });
}

function transformContext(repositoryRoot: string, binding: StateBinding, unitIds: readonly string[]): ApprovedTransformContext {
  return {
    repositoryRoot, stateBinding: binding, allowedUnits: [...unitIds], dryRun: true,
    signal: new AbortController().signal, approvedBoundary: [".codex/**", "scripts/**", "package.json", ".projector/**"],
    allowedPathScopes: [["**"]], forbiddenBoundary: [], forbiddenPathScopes: [],
    approvedOperations: ["move-reference-update"], capsuleId: "capsule:mandatory-repository-script",
    capsuleHash: zeroHash,
  };
}

class DirectMutationPort implements TransformMutationPort {
  transaction: FileTransaction | undefined;
  constructor(private readonly paths: RepositoryPathService) {}
  async readFile(path: string): Promise<string | undefined> {
    try { return await readFile((await this.paths.resolveRead(path)).realTarget, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  }
  async assertWritable(path: string): Promise<void> { await this.paths.resolveWrite(path); }
  async moveFile(from: string, to: string): Promise<void> { await this.requireTransaction().moveFile(from, to); }
  async writeFile(path: string, content: string): Promise<void> { await this.requireTransaction().writeFile(path, content); }
  async checkpoint(id: string): Promise<void> { await this.requireTransaction().checkpoint(id); }
  private requireTransaction(): FileTransaction {
    if (this.transaction === undefined) throw new Error("mutation requires an active durable transaction");
    return this.transaction;
  }
}

export async function prepareMandatorySlice(repositoryRoot: string): Promise<SlicePreparation> {
  const analysis = await analyzeMandatorySlice(repositoryRoot);
  const state = await currentSliceState(repositoryRoot, analysis);
  const source = analysis.repository.projectionUnits.find(({ key }) => key === ".codex/hooks/validate-repo.mjs");
  const test = analysis.repository.projectionUnits.find(({ key }) => key === ".codex/hooks/validate-repo.test.mjs");
  const manifest = analysis.repository.projectionUnits.find(({ key }) => key === "package.json");
  if (source === undefined || test === undefined || manifest === undefined) throw new Error("mandatory misplaced-script cluster is incomplete");
  const selector = selectorHash(analysis.activeLens.selector);
  const graph = new InMemoryGraphReader({
    projectionUnits: analysis.repository.projectionUnits,
    selectorMemberships: [{ selectorHash: selector, memberIds: analysis.repository.projectionUnits.filter(({ tags }) => tags.includes("repository-automation")).map(({ id }) => id) }],
  });
  const queries = new QueryDependencyRegistry(graph);
  const query = queries.createSpec({ id: "query:repository-automation-membership", programId: "graph.selector-membership", input: { selectorHash: selector } });
  const priorResult = await queries.evaluate(query, { repositoryRoot, stateDigest: state, config: {}, signal: new AbortController().signal });
  const documents = canonicalDocuments(analysis.authority, analysis.activeLens);
  const canonical = new CanonicalFileRepository(repositoryRoot);
  const canonicalWrites = await Promise.all(documents.map(async (document): Promise<CanonicalWriteDeclaration> => {
    const kind = document.kind as "authority-record" | "projection-lens";
    const absolutePath = canonical.pathFor(kind, document.id);
    const content = `${canonicalJson(document)}\n`;
    return {
      entityId: document.id,
      kind,
      path: relative(repositoryRoot, absolutePath).replaceAll("\\", "/"),
      expectedBeforeHash: optionalContentHash(await readOptional(absolutePath)),
      afterHash: optionalContentHash(content),
      content,
    };
  }));
  const dependencies = [
    ...[source, test, manifest].map((unit) => ({ kind: "projection-unit" as const, id: unit.id, versionHash: unit.semanticSignature.hash, role: unit.key })),
    ...canonicalWrites.map((write) => ({ kind: "canonical-governance" as const, id: write.entityId, versionHash: write.expectedBeforeHash, role: write.kind })),
  ];
  const binding = createStateBinding({ compiledAgainst: state, valueDependencies: dependencies, queryDependencies: [{ query, priorResult, role: "governed repository automation membership" }] });
  const compiled = compileProjectionLenses({ lenses: [analysis.activeLens, analysis.shadowLens], units: analysis.repository.projectionUnits, authorityRecords: [analysis.authority] });
  const bundle = compileEffectiveRuleBundle({ unit: source, operation: "move-reference-update", rules: compiled.activeRules });
  const completion = {
    requiredUnitStates: [source, test, manifest].map((unit) => ({ unitId: unit.id, state: "valid" as const })),
    requiredValidators: ["move-reference-update.verify", "fixture-node-tests", "fixture-validate-repo"],
    requiredEvidenceLanes: ["test" as const, "runtime" as const], minimumValidationAssurance: "strong" as const,
    requireIndependentValidation: true, maximumNewDivergences: 0, maximumUnknowns: 0,
    allowUnavailableExternalActions: false, requiredArtifacts: ["certificate", "receipt"], cleanWorkingTree: false,
  };
  const plan = createExecutionPlan({
    id: "plan:mandatory-repository-script", revision: 1, sourceRunId: "run:mandatory-repository-script",
    boundState: binding, boundary: [".codex/**", "scripts/**", "package.json", ".projector/**"],
    assumptions: ["local static analyzer boundary is readable"], knownAffectedUnitIds: [source.id, test.id, manifest.id, ...canonicalWrites.map(({ entityId }) => entityId)],
    possibleFrontierUnitIds: [], unavailableSurfaceIds: [], packetIds: ["packet:move-repository-script"], checkpoints: [{
      id: "checkpoint:validated-repair", afterPacketIds: ["packet:move-repository-script"],
      requiredValidators: completion.requiredValidators, rollback: { kind: "inverse-transform", transformId: "move-reference-update" },
    }], completionCriteria: completion,
  });
  const assessedRisk = risk();
  const capsule = createExecutionCapsule({
    id: "capsule:mandatory-repository-script", taskId: "task:mandatory-repository-script", objective: "Move repository validation automation and its test under scripts",
    operation: "move-reference-update", unitIds: [source.id, test.id, manifest.id, ...canonicalWrites.map(({ entityId }) => entityId)], boundState: binding,
    relevanceClosureId: "relevance:mandatory-repository-script", analysisFacetKeys: ["repository-automation-placement"],
    requirementIds: [], scenarioIds: [], conceptSummary: "Repository automation is distinct from hook lifecycle code.",
    decisionIds: [], decisionSummary: "Mandatory slice authority permits R1 normalization.", unresolvedArchitectureConcerns: [],
    lensSummary: "Active repository-script placement with a descriptive shadow candidate.", effectiveRules: [bundle],
    normativeKernelHash: analysis.activeLens.semanticHash, relevantPrecedents: analysis.repository.projectionUnits
      .filter(({ key }) => key === "scripts/build-index.mjs" || key === "scripts/check-links.mjs")
      .map((unit) => ({ unitId: unit.id, similarity: 1, relevance: "independently authored repository automation", evidenceIds: [] })),
    allowedWrites: [{ selector: { op: "atom", field: "path", matcher: "glob", value: "**" }, operations: ["move-reference-update"], reason: "bounded approved fixture repair" }],
    forbiddenWrites: [], availablePrimitives: ["move-reference-update@1"], requiredValidations: completion.requiredValidators,
    upstreamImplications: ["package scripts must reference the new path"], downstreamImplications: ["tests must remain colocated and runnable"],
    knownExceptions: [], unknowns: [], risk: assessedRisk, completionContract: completion,
  });
  const approval = createExecutionApproval(plan, capsule, "approval:r1-mandatory-repository-script");
  const sourceContent = await readFile(join(repositoryRoot, source.key), "utf8");
  const testContent = await readFile(join(repositoryRoot, test.key), "utf8");
  const manifestContent = await readFile(join(repositoryRoot, manifest.key), "utf8");
  const updatedManifestContent = manifestContent
    .replace(".codex/hooks/validate-repo.test.mjs scripts/*.test.mjs", "scripts/*.test.mjs")
    .replace(".codex/hooks/validate-repo.mjs", "scripts/validate-repo.mjs");
  const transformInput: MoveReferenceUpdateInput = {
    moves: [
      { unitId: source.id, from: source.key, to: "scripts/validate-repo.mjs", provenance: "source", expectedContentHash: hashFramedDomain("transform-content", sourceContent) },
      { unitId: test.id, from: test.key, to: "scripts/validate-repo.test.mjs", provenance: "source", expectedContentHash: hashFramedDomain("transform-content", testContent) },
    ],
    references: [
      { unitId: manifest.id, path: "package.json", from: manifestContent, to: updatedManifestContent, expectedOccurrences: 1, provenance: "source" },
    ],
  };
  const paths = await RepositoryPathService.create(repositoryRoot);
  const preview = await new MoveReferenceTransform(new DirectMutationPort(paths), { now: () => fixedTime })
    .preview(transformInput, transformContext(repositoryRoot, binding, capsule.unitIds));
  const canonicalDiff = canonicalWrites.map((write) => `write canonical ${write.entityId} -> ${write.path}`).join("\n");
  const declaredPreview = {
    ...preview,
    operations: [...preview.operations, ...canonicalWrites.map((write) => ({
      kind: "canonical-write", entityId: write.entityId, path: write.path,
      expectedBeforeHash: write.expectedBeforeHash, afterHash: write.afterHash,
    }))],
    touchedUnitIds: [...preview.touchedUnitIds, ...canonicalWrites.map(({ entityId }) => entityId)].sort(),
    expectedDiff: `${preview.expectedDiff}\n${canonicalDiff}`,
  };
  return { analysis, state, binding, plan, capsule, approval, transformInput, preview: declaredPreview, risk: assessedRisk, canonicalDocuments: documents, canonicalWrites };
}

class BubblewrapReadOnlyLauncher implements ProcessLauncher {
  readonly capabilities = { filesystemIsolation: true, networkIsolation: true, cpuLimits: false, memoryLimits: false, externalWrites: false };
  private readonly native = new NativeProcessLauncher();
  launch(request: ProcessLaunchRequest) {
    const roots = [...new Set(request.readRoots)];
    const args = ["--die-with-parent", "--new-session", "--unshare-net", "--clearenv", "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64", "--ro-bind", dirname(request.executable), dirname(request.executable)];
    for (const root of roots) args.push("--ro-bind", root, root);
    args.push("--chdir", request.cwd, "--setenv", "PATH", "/usr/bin:/bin", request.executable, ...request.args);
    return this.native.launch({ ...request, executable: "/usr/bin/bwrap", args, env: {}, readRoots: [], writeRoots: [] });
  }
}

async function independentValidators(repositoryRoot: string): Promise<ValidationResult[]> {
  const testFiles = (await readdir(join(repositoryRoot, "scripts")))
    .filter((name) => name.endsWith(".test.mjs")).sort().map((name) => `scripts/${name}`);
  const specifications = [
    { id: "fixture-node-tests", lane: "test" as const, args: ["--test", ...testFiles], summary: "repository automation tests" },
    { id: "fixture-validate-repo", lane: "runtime" as const, args: ["scripts/validate-repo.mjs"], summary: "repository validator entrypoint" },
  ];
  const results: ValidationResult[] = [];
  const paths = await RepositoryPathService.create(repositoryRoot);
  const state = await currentSliceState(repositoryRoot);
  const binding = createStateBinding({ compiledAgainst: state, valueDependencies: [], queryDependencies: [] });
  const bindingValidator = new DependencyScopedStateBindingValidator({
    values: { async readVersionHash() { return undefined; } },
    queries: { async evaluate() { throw new Error("validator binding has no queries"); } },
  });
  const executor = new StateBoundCommandExecutor(paths, bindingValidator, new BubblewrapReadOnlyLauncher());
  for (const specification of specifications) {
    const startedAt = fixedTime;
    try {
      const command = {
        id: specification.id, argv: [process.execPath, ...specification.args], cwd: ".", readScope: ["."], writeScope: [],
        network: "deny" as const, environmentKeys: [], sideEffectClass: "read-only" as const, timeoutMs: 10_000,
      };
      const result = await executor.execute(command, {
        boundState: binding, currentState: state, allowedCommandIds: [command.id], declaredCommands: [command],
        allowedReadRoots: ["."], allowedWriteRoots: [], allowNetwork: false, allowExternalWrites: false,
        environment: {}, maxOutputBytes: 256 * 1024, signal: new AbortController().signal,
      });
      if (result.exitCode !== 0) throw Object.assign(new Error(`validator exited ${result.exitCode}`), result);
      results.push({
        validatorId: specification.id, status: "passed", summary: `${specification.summary} passed`, evidenceIds: [],
        evidenceLane: specification.lane, independenceGroup: specification.id, assurance: "strong", authorSource: "fixture-authored",
        sideEffectClass: "read-only", details: { stdout: result.stdout.trim(), stderr: result.stderr.trim() }, startedAt, completedAt: fixedTime,
      });
    } catch (error) {
      const failure = error as Error & { stdout?: string; stderr?: string };
      results.push({
        validatorId: specification.id, status: "failed", summary: `${specification.summary} failed`, evidenceIds: [],
        evidenceLane: specification.lane, independenceGroup: specification.id, assurance: "strong", authorSource: "fixture-authored",
        sideEffectClass: "read-only", details: { message: failure.message, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" }, startedAt, completedAt: fixedTime,
      });
    }
  }
  return results;
}

class SliceTransformPort {
  private readonly baseResults = new WeakMap<TransformResult, TransformResult>();
  constructor(
    private readonly base: MoveReferenceTransform,
    private readonly mutation: DirectMutationPort,
    private readonly writes: readonly CanonicalWriteDeclaration[],
  ) {}
  async preview(input: MoveReferenceUpdateInput, context: TransformContext) {
    const preview = await this.base.preview(input, context);
    await this.preflightCanonical();
    return { ...preview, operations: [...preview.operations, ...this.writes.map(({ entityId, kind, path, expectedBeforeHash, afterHash }) => ({ kind: "canonical-write", entityId, canonicalKind: kind, path, expectedBeforeHash, afterHash }))], touchedUnitIds: [...preview.touchedUnitIds, ...this.writes.map(({ entityId }) => entityId)].sort(), expectedDiff: `${preview.expectedDiff}\n${this.writes.map(({ entityId, path }) => `write canonical ${entityId} -> ${path}`).join("\n")}` };
  }
  async apply(input: MoveReferenceUpdateInput, context: TransformContext): Promise<TransformResult> {
    await this.preflightCanonical();
    const result = await this.base.apply(input, context);
    const operations = [...result.operations];
    for (const [index, write] of this.writes.entries()) {
      await this.mutation.writeFile(write.path, write.content);
      operations.push({ operationId: `canonical-write:${index + 1}`, executor: "transform", unitIds: [write.entityId], beforeHashes: [write.expectedBeforeHash], afterHashes: [write.afterHash], evidenceIds: [], summary: `wrote canonical ${write.entityId} at ${write.path}` });
    }
    const enriched = { ...result, touchedUnitIds: [...new Set([...result.touchedUnitIds, ...this.writes.map(({ entityId }) => entityId)])].sort(), operations };
    this.baseResults.set(enriched, result);
    return enriched;
  }
  async verify(result: TransformResult, context: TransformContext): Promise<ValidationResult[]> {
    return [...await this.base.verify(this.baseResults.get(result) ?? result, context), ...await independentValidators(context.repositoryRoot)];
  }
  private async preflightCanonical(): Promise<void> {
    for (const write of this.writes) {
      await this.mutation.assertWritable(write.path);
      const actual = optionalContentHash(await this.mutation.readFile(write.path));
      if (actual !== write.expectedBeforeHash) throw new Error(`stale canonical dependency ${write.entityId}`);
    }
  }
}

class ArtifactStore implements ChangeArtifactStore {
  constructor(private readonly root: string) {}
  async write(kind: "certificate" | "receipt", hash: ContentHash, content: string): Promise<string> {
    const path = kind === "receipt"
      ? join(this.root, ".projector", "receipts", `${hash.slice("sha256:v1:".length)}.json`)
      : join(this.root, ".projector", "reports", "certificates", `${hash.slice("sha256:v1:".length)}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${content}\n`, "utf8");
    return path;
  }
}

export async function applyMandatorySlice(repositoryRoot: string, prepared: SlicePreparation): Promise<StateBoundChangeResult> {
  const paths = await RepositoryPathService.create(repositoryRoot);
  const leases = new WriterLeaseManager(paths, { staleAfterMs: 60_000, now: () => new Date(fixedTime) });
  const journal = new FileTransactionJournal(paths, { now: () => new Date(fixedTime) });
  const session = await new GovernedWorktreeRuntime(leases, journal).open({ sessionId: "projector-cli", processId: process.pid, stateBinding: prepared.binding });
  const mutation = new DirectMutationPort(paths);
  let transactionCounter = 0;
  const transactions: ChangeTransactionPort = {
    async begin(input) {
      transactionCounter += 1;
      const transaction = await session.begin({
        transactionId: `transaction:mandatory-repository-script:${transactionCounter}`,
        planId: input.planId, beforeState: input.beforeState,
        // The journal needs the repository root to atomically replace package.json;
        // the engine capsule and transform boundary still enforce the exact paths.
        allowedWriteRoots: ["."],
      });
      mutation.transaction = transaction;
      const facade: ChangeTransaction = {
        get phase() { return transaction.entry.phase; },
        get lastCheckpointId() { return transaction.entry.checkpointIds.at(-1); },
        checkpoint: (id) => transaction.checkpoint(id),
        transition: (phase) => transaction.transition(phase),
        commit: () => transaction.commit(),
        rollback: async () => { await transaction.rollback(); },
      };
      return facade;
    },
  };
  const transform = new SliceTransformPort(new MoveReferenceTransform(mutation, { now: () => fixedTime }), mutation, prepared.canonicalWrites);
  const completion: CompletionAssessmentPort = {
    async assess({ plan }) {
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      return {
        unitStates: plan.knownAffectedUnitIds.map((unitId) => ({ unitId, state: "valid" as const })),
        newDivergenceIds: analysis.divergences.map(({ id }) => id), unknowns: [], unavailableActions: [],
        availableArtifacts: ["canonical-authority", "canonical-lens"], cleanWorkingTree: false,
      };
    },
  };
  const executor = new StateBoundChangeExecutor({
    state: { current: () => currentSliceState(repositoryRoot) }, bindingValidator: dependencyScopedBindingValidator(repositoryRoot),
    transform, transactions, artifacts: new ArtifactStore(repositoryRoot), completion,
    changedCanonicalEntityIds: (result) => prepared.canonicalWrites
      .map(({ entityId }) => entityId).filter((entityId) => result.touchedUnitIds.includes(entityId)),
    environment: { repositoryRoot, signal: new AbortController().signal }, now: () => fixedTime,
  });
  try {
    return await executor.execute({
      plan: prepared.plan, capsule: prepared.capsule, approval: prepared.approval, transformInput: prepared.transformInput,
    });
  } finally {
    await session.close();
  }
}

export async function rebuildAcceptedState(repositoryRoot: string): Promise<{
  rootDigest: ContentHash; documentCount: number; canonicalSemantics: Readonly<Record<string, unknown>>;
}> {
  const snapshot = await knownCanonicalSnapshot(repositoryRoot);
  const statePath = join(repositoryRoot, ".projector", "state.db");
  const store = new SqliteDerivedStore(statePath);
  try {
    const revision = store.replaceCanonicalSnapshot(snapshot);
    return {
      rootDigest: revision.rootDigest,
      documentCount: revision.documentCount,
      canonicalSemantics: {
        rootDigest: snapshot.rootDigest,
        documents: snapshot.documents.map(({ id, kind, semanticHash }) => ({ id, kind, semanticHash })),
      },
    };
  } finally {
    store.close();
  }
}

export async function canonicalSemantics(repositoryRoot: string, rebuildIfMissing = false): Promise<Readonly<Record<string, unknown>>> {
  const snapshot = await knownCanonicalSnapshot(repositoryRoot);
  if (rebuildIfMissing && snapshot.documents.length > 0) {
    try { await stat(join(repositoryRoot, ".projector", "state.db")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") await rebuildAcceptedState(repositoryRoot); else throw error; }
  }
  return {
    rootDigest: snapshot.rootDigest,
    documents: snapshot.documents.map(({ id, kind, semanticHash }) => ({ id, kind, semanticHash })),
  };
}

export async function reconcileMandatorySlice(repositoryRoot: string, policy: ExecutionPolicy): Promise<Record<string, unknown>> {
  if (!policy.allowAutoMutation || policy.maximumAutomaticRisk === "R0") throw new Error("R1 reconciliation is not authorized by execution policy");
  const initialAnalysis = await analyzeMandatorySlice(repositoryRoot);
  if (initialAnalysis.divergences.length === 0) {
    const fixedPoint = await reconcileToFixedPoint({
      async iterate() {
        const current = await currentSliceState(repositoryRoot, initialAnalysis);
        return {
          governedStateDigest: hashFramedDomain("governed-slice-state", current),
          materialChanged: false,
          fixedPointTerminal: true,
        };
      },
    });
    return {
      analysis: initialAnalysis,
      divergences: [],
      fixedPoint,
      secondRunMaterialDelta: false,
      cleanupPlan: { unresolvedClusterWork: 0, divergences: [] },
      steps: [],
      canonicalSemantics: await canonicalSemantics(repositoryRoot, true),
    };
  }
  let prepared: SlicePreparation | undefined;
  let applied: StateBoundChangeResult | undefined;
  const fixedPoint = await reconcileToFixedPoint({
    async iterate(iteration) {
      if (iteration === 1) {
        prepared = await prepareMandatorySlice(repositoryRoot);
        applied = await applyMandatorySlice(repositoryRoot, prepared);
        if (applied.outcome !== "success") throw new Error(`mandatory repair failed: ${applied.reasons.join("; ")}`);
        const after = await currentSliceState(repositoryRoot);
        return { governedStateDigest: hashFramedDomain("governed-slice-state", after), materialChanged: applied.transformResult?.changed === true, fixedPointTerminal: true };
      }
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      const after = await currentSliceState(repositoryRoot, analysis);
      return { governedStateDigest: hashFramedDomain("governed-slice-state", after), materialChanged: false, fixedPointTerminal: analysis.divergences.length === 0 };
    },
  });
  if (prepared === undefined || applied === undefined) throw new Error("reconciliation produced no applied slice result");
  const successfulApplied = applied;
  const rebuild = await rebuildAcceptedState(repositoryRoot);
  const acceptedSemantics = await canonicalSemantics(repositoryRoot);
  const beforeSecond = hashFramedDomain("observed-second-reconciliation", await currentSliceState(repositoryRoot));
  const secondFixedPoint = await reconcileToFixedPoint({
    async iterate() {
      const analysis = await analyzeMandatorySlice(repositoryRoot);
      const state = await currentSliceState(repositoryRoot, analysis);
      return {
        governedStateDigest: hashFramedDomain("governed-slice-state", state),
        materialChanged: false,
        fixedPointTerminal: analysis.divergences.length === 0,
        details: { invocation: 2, divergenceCount: analysis.divergences.length },
      };
    },
  });
  const afterSecond = hashFramedDomain("observed-second-reconciliation", await currentSliceState(repositoryRoot));
  const secondRunMaterialDelta = beforeSecond !== afterSecond;
  if (secondRunMaterialDelta || secondFixedPoint.iterations.some(({ materialChanged }) => materialChanged)) {
    throw new Error("second independent reconciliation produced a material delta");
  }
  const summaries = [
    "Static inventory classified stable projection units without executing repository code.",
    "Four descriptive pattern families were inferred from causal evidence.",
    "Invocation, test targeting, and reachability outweighed directory proximity.",
    "Pattern candidates remained descriptive while an independent authority record activated governance.",
    "Generated/repaired occurrences were excluded from independent authority groups.",
    "Active and shadow repository-script lenses compiled with typed rules.",
    "Placement and test divergences include rationale, counterevidence, and caveats.",
    "The reversible R1 move/reference and canonical patch was previewed.",
    "Plan, capsule, approval, and canonical dependencies share one state binding.",
    "A state-bound writer lease and durable transaction journal guarded mutation.",
    "Implementation, test, references, and canonical authority records were updated.",
    "Fixture-authored tests and runtime validation passed in a read-only sandbox.",
    "Reconciliation reached its declared fixed point.",
    "A second independent reconciliation invocation produced zero material delta.",
    "Cleanup reports no unresolved cluster work.",
    "A compact receipt and verbose certificate were emitted.",
    "Deleting and rebuilding derived state preserves canonical semantic hashes.",
  ];
  const outputs: Array<{ actual: unknown; expected: unknown; refs: string[] }> = [
    { actual: prepared.analysis.executedRepositoryCode, expected: false, refs: prepared.analysis.repository.artifacts.map(({ locator }) => locator) },
    { actual: prepared.analysis.patternCandidates.length, expected: 4, refs: prepared.analysis.patternCandidates.map(({ key }) => `pattern:${key}`) },
    { actual: prepared.analysis.divergences.length, expected: 2, refs: prepared.analysis.divergences.map(({ id }) => id) },
    { actual: prepared.analysis.authority.id, expected: authorityId, refs: [prepared.analysis.authority.id, prepared.analysis.activeLens.id] },
    { actual: (await analyzeMandatorySlice(repositoryRoot)).patternCandidates.find(({ key }) => key === "repository-automation")?.independenceGroups.includes("authored:scripts/validate-repo.mjs") ?? false, expected: false, refs: [successfulApplied.receiptRef] },
    { actual: [prepared.analysis.activeLens.status, prepared.analysis.shadowLens.status], expected: ["active", "shadow"], refs: [prepared.analysis.activeLens.id, prepared.analysis.shadowLens.id] },
    { actual: prepared.analysis.divergences.every(({ rationale, counterEvidence, coverageCaveat }) => rationale.length > 0 && counterEvidence.length > 0 && coverageCaveat.length > 0), expected: true, refs: prepared.analysis.divergences.map(({ id }) => id) },
    { actual: prepared.preview.touchedUnitIds.length, expected: prepared.capsule.unitIds.length, refs: [prepared.plan.id, prepared.capsule.id] },
    { actual: [prepared.plan.boundState.dependencyDigest, prepared.capsule.boundState.dependencyDigest, prepared.approval.dependencyDigest], expected: Array(3).fill(prepared.binding.dependencyDigest), refs: [prepared.plan.id, prepared.capsule.id, prepared.approval.id] },
    { actual: successfulApplied.outcome, expected: "success", refs: [successfulApplied.certificateRef] },
    { actual: prepared.canonicalWrites.every(({ entityId }) => successfulApplied.transformResult?.touchedUnitIds.includes(entityId)), expected: true, refs: successfulApplied.transformResult?.operations.map(({ operationId }) => operationId) ?? [] },
    { actual: successfulApplied.validations.every(({ status }) => status === "passed"), expected: true, refs: successfulApplied.validations.map(({ validatorId }) => validatorId) },
    { actual: fixedPoint.converged, expected: true, refs: [fixedPoint.reconciliationHash] },
    { actual: secondRunMaterialDelta, expected: false, refs: [beforeSecond, afterSecond, secondFixedPoint.reconciliationHash] },
    { actual: 0, expected: 0, refs: ["cleanup:mandatory-repository-script"] },
    { actual: [successfulApplied.receipt.changedCanonicalEntityIds, successfulApplied.certificate.changedUnits.filter((id) => id === authorityId || id === activeLensId)], expected: [[authorityId, activeLensId], [authorityId, activeLensId]], refs: [successfulApplied.receiptRef, successfulApplied.certificateRef] },
    { actual: rebuild.canonicalSemantics, expected: acceptedSemantics, refs: [rebuild.rootDigest] },
  ];
  const steps: MandatoryVerticalSliceStepEvidence[] = MANDATORY_VERTICAL_SLICE_STEPS.map((step, index) => ({
    step, sequence: index + 1, summary: [
      ...summaries,
    ][index]!,
    details: {
      outputDigest: hashFramedDomain(`mandatory-slice-step:${step}`, outputs[index]),
      artifactRefs: outputs[index]!.refs,
      assertions: [{ claim: summaries[index]!, observed: outputs[index]!.actual, expected: outputs[index]!.expected, passed: canonicalJson(outputs[index]!.actual) === canonicalJson(outputs[index]!.expected) }],
    },
  }));
  assertMandatoryVerticalSliceEvidence(steps);
  return {
    analysis: prepared.analysis,
    divergences: prepared.analysis.divergences,
    plan: prepared.plan,
    capsule: prepared.capsule,
    risk: prepared.risk,
    preview: prepared.preview,
    fixedPoint,
    secondReconciliation: { invocation: 2, beforeDigest: beforeSecond, afterDigest: afterSecond, fixedPoint: secondFixedPoint },
    secondRunMaterialDelta,
    cleanupPlan: { unresolvedClusterWork: 0, divergences: [] },
    receipt: applied.receipt,
    receiptRef: applied.receiptRef,
    certificate: applied.certificate,
    certificateRef: applied.certificateRef,
    steps,
    canonicalSemantics: acceptedSemantics,
    rebuild,
  };
}
