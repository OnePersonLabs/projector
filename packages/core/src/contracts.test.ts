import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ContentHashSchema,
  ChangeProposalSchema,
  CanonicalDocumentEnvelopeByKindSchema,
  CanonicalDocumentEnvelopeSchema,
  CommandSpecSchema,
  ConceptSchema,
  EntityIdSchema,
  GitRealizationLocatorSchema,
  LineageRecordSchema,
  LegacyUnversionedProjectorConfigSchema,
  PreparedProjectorConfigSchema,
  PendingProjectDataMigrationSchema,
  ProjectDataFormatSnapshotSchema,
  ProjectDataMigrationDraftSchema,
  ProjectDataMigrationChainSchema,
  ProjectDataMigrationManifestSchema,
  ProjectDataMigrationReceiptSchema,
  PortableRelativePathSchema,
  ProjectorOperationRequestSchema,
  RealizationBindingSchema,
  RequirementSchema,
  RequirementDeltaSchema,
  contractRegistry,
  exportContractJsonSchemas,
  validateJsonSchemaReferences,
  validateContractRegistry,
  createProjectorOperationResultSchema,
  createProjectorOperationRequestSchema,
  createProjectDataMigrationReceipt,
  applicationEvidenceBindingIssues,
  withCanonicalHashes,
  parseChangeProposal,
  type ContentHash,
  type EvidenceRef,
  type ApplicationEvidencePredicateBinding,
} from "./index.js";

describe("normative contract registry", () => {
  it("models command network access as declared need rather than enforced denial", () => {
    const command = {
      id: "test",
      argv: ["node", "test.mjs"],
      cwd: ".",
      readScope: ["src/**"],
      writeScope: [],
      requiresNetwork: false,
      environmentKeys: [],
      sideEffectClass: "read-only",
      timeoutMs: 1_000,
    };

    expect(CommandSpecSchema.safeParse(command).success).toBe(true);
    expect(CommandSpecSchema.safeParse({ ...command, network: "deny" }).success).toBe(false);
  });

  it("represents every exported normative declaration exactly once", () => {
    expect(Object.keys(contractRegistry)).toHaveLength(166);
    expect(validateContractRegistry()).toEqual([]);
  });

  it("exports strict JSON Schemas whose references resolve", () => {
    const schemas = exportContractJsonSchemas();
    expect(Object.keys(schemas)).toHaveLength(157);
    expect(validateJsonSchemaReferences(schemas)).toEqual([]);
    for (const schema of Object.values(schemas)) {
      expect(schema).toMatchObject({ $schema: expect.any(String) });
    }
  });

  it("exports canonical editor validation with exact payload schemas for every kind", () => {
    const malformedConcept = {
      apiVersion: "projector/v2",
      schemaVersion: "2.0.0",
      kind: "concept",
      id: "concept:malformed",
      key: "malformed",
      lifecycle: "active",
      payload: { id: "concept:malformed", key: "malformed" },
      semanticHash: "sha256:v1:" + "0".repeat(64),
      canonicalDocumentHash: "sha256:v1:" + "1".repeat(64),
    };

    expect(CanonicalDocumentEnvelopeSchema.safeParse(malformedConcept).success).toBe(false);
    expect(CanonicalDocumentEnvelopeByKindSchema.safeParse(malformedConcept).success).toBe(false);

    type JsonSchema = { $ref?: string; $defs?: Record<string, JsonSchema>; anyOf?: JsonSchema[]; const?: string; properties?: Record<string, JsonSchema>; required?: string[]; additionalProperties?: boolean };
    const exported = exportContractJsonSchemas().CanonicalDocumentEnvelopeByKind as JsonSchema;
    const dereference = (value: JsonSchema): JsonSchema => {
      if (value.$ref === undefined) return value;
      const key = value.$ref.match(/^#\/\$defs\/(.+)$/u)?.[1];
      if (key === undefined || exported.$defs?.[key] === undefined) throw new Error(`unresolved test schema reference ${value.$ref}`);
      return exported.$defs[key]!;
    };
    const conceptArm = exported.anyOf?.find((arm) => dereference(arm.properties!.kind!).const === "concept");
    const conceptPayload = dereference(conceptArm!.properties!.payload!);
    expect(conceptPayload).toMatchObject({
      additionalProperties: false,
      required: expect.arrayContaining(["id", "key", "kind", "name", "statement", "status"]),
    });
    expect(conceptPayload.required!.every((field) => Object.hasOwn(malformedConcept.payload, field))).toBe(false);
  });

  it("owns the strict public change proposal contract", () => {
    const proposal = { apiVersion: "projector.change-proposal/v1", requirements: [{ key: "useful", title: "Useful", statement: "It is useful.", aliases: [] }], scenarios: [{ key: "observe-useful", title: "Observe useful", aliases: [], steps: [{ role: "trigger", statement: "A caller observes it." }, { role: "expected-outcome", statement: "It is useful." }] }], architecture: null, edits: [{ path: "src/value.mjs", before: "old", after: "new" }], validation: { independentNodeTests: ["test/value.test.mjs"], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] };
    expect(parseChangeProposal(proposal)).toEqual(proposal);
    expect(ChangeProposalSchema.safeParse({ ...proposal, hidden: true }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...proposal, scenarios: [{ ...proposal.scenarios[0], steps: [{ ...proposal.scenarios[0]!.steps[0], hidden: true }, proposal.scenarios[0]!.steps[1]] }] }).success).toBe(false);
    for (const path of ["../escape", "/absolute", "C:/absolute", "src\\value.mjs", ".projector/runtime/forged.json"]) expect(ChangeProposalSchema.safeParse({ ...proposal, edits: [{ ...proposal.edits[0], path }] }).success).toBe(false);
    const supplementalPath = "test/supplemental.test.mjs";
    const withSupplemental = { ...proposal, edits: [...proposal.edits, { path: supplementalPath, before: "old", after: "new" }], validation: { ...proposal.validation, supplementalNodeTests: [supplementalPath] } };
    expect(ChangeProposalSchema.safeParse(withSupplemental).success).toBe(true);
    expect(ChangeProposalSchema.safeParse({ ...withSupplemental, edits: proposal.edits }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...withSupplemental, edits: [...proposal.edits, { path: supplementalPath, before: "old", after: null }] }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...withSupplemental, validation: { ...withSupplemental.validation, supplementalNodeTests: ["test/other.test.mjs"] } }).success).toBe(false);
  });

  it("accepts explicit model-only additions while rejecting empty and unauthenticated revisions", () => {
    const base = { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] };
    const addition = { ...base, canonicalMutations: [{ kind: "concept", operation: "add", expectedAbsent: true, rationale: "Establish the future obligation before implementation.", payload: { id: "concept:clock", key: "clock", kind: "invariant", name: "Clock boundary", aliases: [], statement: "All domain time enters through the clock port.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [] } }] };
    expect(parseChangeProposal(addition).canonicalMutations).toHaveLength(1);
    expect(ChangeProposalSchema.safeParse(base).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...addition, canonicalMutations: [{ ...addition.canonicalMutations[0], operation: "revise", expectedAbsent: undefined }] }).success).toBe(false);
    const publicSchema = JSON.stringify(exportContractJsonSchemas().ChangeProposal);
    expect(publicSchema).toContain("realizesConceptKinds");
    expect(publicSchema).toContain("selectedOptionKey");
    expect(publicSchema).toContain("requiredIndependenceGroup");
  });

  it("keeps full canonical meaning as strict as shorthand intent", () => {
    const base = { apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"] };
    const common = { id: "scenario:future", key: "future", title: "Future behavior", aliases: [], status: "active", sourceClass: "authored", scope: { op: "atom", field: "path", matcher: "glob", value: "future/**" }, evidence: [] };
    const steps = [{ role: "trigger", statement: "The user requests it." }, { role: "expected-outcome", statement: "The accepted behavior is available." }];
    const parse = (kind: string, payload: object) => ChangeProposalSchema.safeParse({ ...base, canonicalMutations: [{ kind, operation: "add", expectedAbsent: true, rationale: "Preserve this future commitment.", payload }] }).success;
    expect(parse("behavioral-scenario", { ...common, steps })).toBe(true);
    for (const invalid of [[], [steps[0]], [{ ...steps[0], statement: " " }, steps[1]], [{ ...steps[0], role: "precondition" }, steps[1]]]) expect(parse("behavioral-scenario", { ...common, steps: invalid })).toBe(false);
    expect(parse("behavioral-scenario", { ...common, title: " ", steps })).toBe(false);
    expect(parse("requirement", { ...common, id: "requirement:future", statement: " ", origin: [] })).toBe(false);
    expect(parse("requirement", { ...common, id: "requirement:future", statement: "Retain the future commitment.", origin: [] })).toBe(true);
  });

  it("binds application evidence to one declared requirement predicate without inferring fulfillment", () => {
    const hash = `sha256:v1:${"a".repeat(64)}` as ContentHash;
    const applicationPredicate: ApplicationEvidencePredicateBinding = { kind: "application-observation", adapter: { id: "psychord", version: "1" }, scenario: { id: "scenario:keep-reload", semanticHash: hash }, case: "keep-reload-replay", predicateId: "predicate:archive-persists", assertionIds: ["assertion:archive-bytes", "assertion:replay-visible"], observationRole: "latest" };
    const requirement = { id: "requirement:archive", key: "archive", title: "Archive", aliases: [], statement: "The archive survives reload.", status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, origin: [], evidence: [{ evidenceId: "artifact:psychord-run-1", stance: "supports", applicationPredicate }], discoveryHash: hash, semanticHash: hash };
    expect(RequirementSchema.safeParse(requirement).success).toBe(true);
    const duplicateLatest: EvidenceRef[] = [{ evidenceId: "artifact:psychord-run-1", stance: "supports", applicationPredicate }, { evidenceId: "artifact:psychord-run-2", stance: "supports", applicationPredicate }];
    expect(applicationEvidenceBindingIssues(duplicateLatest)).toEqual([{ index: 1, message: "only one latest application observation is allowed for a requirement predicate" }]);
    expect(RequirementSchema.safeParse({ ...requirement, evidence: duplicateLatest }).success).toBe(false);
    const revisedHashLatest = duplicateLatest.map((reference, index) => index === 1 ? { ...reference, applicationPredicate: { ...reference.applicationPredicate!, scenario: { ...reference.applicationPredicate!.scenario, semanticHash: `sha256:v1:${"b".repeat(64)}` as ContentHash } } } : reference);
    expect(RequirementSchema.safeParse({ ...requirement, evidence: revisedHashLatest }).success).toBe(false);
    const { semanticHash: _semanticHash, discoveryHash: _discoveryHash, ...payload } = requirement;
    const proposal = { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"], canonicalMutations: [{ kind: "requirement", operation: "add", expectedAbsent: true, rationale: "Bind reviewed application evidence.", payload }] };
    expect(ChangeProposalSchema.safeParse(proposal).success).toBe(true);
    expect(ChangeProposalSchema.safeParse({ ...proposal, canonicalMutations: [{ ...proposal.canonicalMutations[0], payload: { ...payload, evidence: duplicateLatest } }] }).success).toBe(false);
    expect(RequirementSchema.safeParse({ ...requirement, evidence: [{ ...requirement.evidence[0]!, applicationPredicate: { ...applicationPredicate, assertionIds: [] } }] }).success).toBe(false);
    expect(RequirementSchema.safeParse({ ...requirement, evidence: [{ ...requirement.evidence[0]!, applicationPredicate: { ...applicationPredicate, observationRole: "prior" } }] }).success).toBe(true);
  });

  it("accepts exact lineage dispositions and explicit identity-resolution evidence", () => {
    const hash = `sha256:v1:${"a".repeat(64)}`;
    const base = { apiVersion: "projector.change-proposal/v1", requirements: [], scenarios: [], architecture: null, edits: [], validation: { independentNodeTests: [], supplementalNodeTests: [] }, analysisFacets: ["architecture", "behavior"] };
    const lineage = {
      kind: "lineage", operation: "add", lineageKind: "replace",
      sources: [{ id: "requirement:old", kind: "requirement", expectedSemanticHash: hash, expectedDocumentHash: hash }],
      replacementIds: ["requirement:new"], rationale: "Replace the old responsibility with the accepted boundary.",
    };
    const identityResolution = {
      contextId: "knowledge_context_1", contextHash: hash, outcome: "replace-existing",
      selectedEntityIds: ["requirement:old"], rationale: "The old identity no longer owns the revised boundary.",
      newBoundary: { owns: ["new responsibility"], excludes: ["old responsibility"], nearestEntityIds: ["requirement:old"], rationale: "The ownership boundary changed." },
    };
    expect(parseChangeProposal({ ...base, canonicalMutations: [lineage], identityResolution })).toMatchObject({ canonicalMutations: [lineage], identityResolution });
    expect(ChangeProposalSchema.safeParse({ ...base, canonicalMutations: [{ ...lineage, replacementIds: [] }] }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...base, canonicalMutations: [{ ...lineage, lineageKind: "delete", replacementIds: ["requirement:new"] }] }).success).toBe(false);
    expect(ChangeProposalSchema.safeParse({ ...base, canonicalMutations: [lineage], identityResolution: { ...identityResolution, newBoundary: undefined } }).success).toBe(false);
    const publicSchema = JSON.stringify(exportContractJsonSchemas().ChangeProposal);
    expect(publicSchema).toContain("lineageKind");
    expect(publicSchema).toContain("identityResolution");
  });

  it("rejects malformed content hashes", () => {
    expect(ContentHashSchema.safeParse("sha256:v1:abc").success).toBe(false);
    expect(
      ContentHashSchema.safeParse(`sha256:v1:${"A".repeat(64)}`).success,
    ).toBe(false);
    expect(
      ContentHashSchema.safeParse(`sha256:v1:${"a".repeat(64)}`).success,
    ).toBe(true);
  });

  it("rejects path-like, blank, or whitespace-padded entity IDs", () => {
    for (const value of ["", " entity", "entity ", "a/b", "a\\b", ".", ".."]) {
      expect(EntityIdSchema.safeParse(value).success).toBe(false);
    }
    expect(EntityIdSchema.safeParse("req_checkout-v2").success).toBe(true);
  });

  it("rejects unknown object fields instead of silently stripping them", () => {
    expect(ConceptSchema.safeParse({ unexpected: true }).error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unrecognized_keys" })]),
    );
  });

  it("limits authored realization bindings to raw implementation facts and immutable origin", () => {
    const origin = { kind: "git", locator: `git:${"a".repeat(40)}:PROJECTOR_SPEC/01-product/vision-and-north-star.md` };
    expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin }).success).toBe(true);
    for (const field of ["concept", "requirement", "scenario", "lens", "relation"]) {
      expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field, matcher: "equals", value: "semantic-id" }, origin }).success).toBe(false);
    }
    expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin: { kind: "content", locator: "PROJECTOR_SPEC/01-product/vision-and-north-star.md" } }).success).toBe(false);
    expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin: { kind: "git", locator: "git:abc123:PROJECTOR_SPEC/01-product/vision-and-north-star.md" } }).success).toBe(false);
    expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin: { ...origin, kind: "user-request" } }).success).toBe(false);
    expect(RealizationBindingSchema.safeParse({ selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin, bindingHash: `sha256:v1:${"b".repeat(64)}` }).success).toBe(false);
    const commit = "a".repeat(40);
    const exported = exportContractJsonSchemas().GitRealizationLocator as { pattern?: string };
    expect(exported.pattern).toBeTypeOf("string");
    const exportedPattern = new RegExp(exported.pattern!, "u");
    expect(GitRealizationLocatorSchema.safeParse(`git:${commit}:a`).success).toBe(true);
    expect(exportedPattern.test(`git:${commit}:a`)).toBe(true);
    for (const path of [".", "..", "./a", "../a", "a/.", "a/..", "a/../b", "/a", "a/", "a//b", "a\\b"]) {
      const locator = `git:${commit}:${path}`;
      expect(GitRealizationLocatorSchema.safeParse(locator).success, locator).toBe(false);
      expect(exportedPattern.test(locator), locator).toBe(false);
    }
  });

  it("keeps realization provenance outside semantic identity and inside document identity", () => {
    const origin = { kind: "document", locator: `git:${"a".repeat(40)}:PROJECTOR_SPEC/01-product/vision-and-north-star.md`, contentHash: `sha256:v1:${"a".repeat(64)}` } as const;
    const realizationOrigin = { kind: "git", locator: `git:${"a".repeat(40)}:PROJECTOR_SPEC/01-product/vision-and-north-star.md` } as const;
    const realization = { selector: { op: "atom", field: "path", matcher: "glob", value: "packages/core/**" }, origin: realizationOrigin } as const;
    const base = { apiVersion: "projector.change-proposal/v1", architecture: null, analysisFacets: ["behavior", "architecture"] };
    const common = { key: "retained", title: "Retained", aliases: [], status: "active", sourceClass: "authored", scope: { op: "all", items: [] }, evidence: [], origin: [origin], realizations: [realization] };
    const mutations = [
      { kind: "concept", operation: "add", expectedAbsent: true, rationale: "Retain implementation provenance.", payload: { id: "concept:retained", key: "retained", kind: "constraint", name: "Retained", aliases: [], statement: "Retain the accepted behavior.", status: "active", sourceClass: "authored", confidence: 1, tags: [], evidence: [], origin: [origin], realizations: [realization] } },
      { kind: "requirement", operation: "add", expectedAbsent: true, rationale: "Retain implementation provenance.", payload: { ...common, id: "requirement:retained", statement: "Retain the accepted behavior." } },
      { kind: "behavioral-scenario", operation: "add", expectedAbsent: true, rationale: "Retain implementation provenance.", payload: { ...common, id: "scenario:retained", steps: [{ role: "trigger", statement: "The behavior is requested." }, { role: "expected-outcome", statement: "The behavior remains available." }] } },
    ];
    expect(ChangeProposalSchema.safeParse({ ...base, canonicalMutations: mutations }).success).toBe(true);
    expect(ChangeProposalSchema.safeParse({ ...base, canonicalMutations: mutations.map((mutation) => ({ ...mutation, payload: { ...mutation.payload, ...(mutation.kind === "requirement" ? {} : { origin: undefined }), realizations: undefined } })) }).success).toBe(true);

    const payload = mutations[0]!.payload;
    const legacy = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: payload.id, key: payload.key, lifecycle: "active", payload: { ...payload, origin: undefined, realizations: undefined } });
    const mapped = withCanonicalHashes({ apiVersion: "projector/v2", schemaVersion: "2.0.0", kind: "concept", id: payload.id, key: payload.key, lifecycle: "active", payload });
    expect(mapped.semanticHash).toBe(legacy.semanticHash);
    expect(mapped.discoveryHash).toBe(legacy.discoveryHash);
    expect(mapped.canonicalDocumentHash).not.toBe(legacy.canonicalDocumentHash);
  });

  it("keeps operation requests exact and requires a concrete service output schema", () => {
    const context = { apiVersion: "projector.operation/v1", operation: "context", repositoryRoot: "C:/repo", input: { request: "Explain checkout.", entities: ["requirement:checkout"], persist: false } };
    expect(ProjectorOperationRequestSchema.safeParse(context).success).toBe(true);
    expect(ProjectorOperationRequestSchema.safeParse({ ...context, input: { ...context.input, compact: true } }).success).toBe(false);
    expect(ProjectorOperationRequestSchema.safeParse({ ...context, operation: "representation.inspect" }).success).toBe(false);
    expect(ProjectorOperationRequestSchema.safeParse({ ...context, operation: "application.observe" }).success).toBe(false);
    const applicationRequestSchema = createProjectorOperationRequestSchema("application.observe", z.strictObject({ plan: z.strictObject({ schemaVersion: z.literal("test-application-plan@1"), runId: z.string() }) }));
    const applicationRequest = { apiVersion: "projector.operation/v1", operation: "application.observe", repositoryRoot: ".", input: { plan: { schemaVersion: "test-application-plan@1", runId: "run:1" } } };
    expect(applicationRequestSchema.safeParse(applicationRequest).success).toBe(true);
    expect(applicationRequestSchema.safeParse({ ...applicationRequest, input: { ...applicationRequest.input, selector: "invented" } }).success).toBe(false);
    const hardenedLooseInput = createProjectorOperationRequestSchema("application.observe", z.looseObject({ plan: z.strictObject({ schemaVersion: z.literal("test-application-plan@1"), runId: z.string() }) }));
    expect(hardenedLooseInput.safeParse({ ...applicationRequest, input: { ...applicationRequest.input, selector: "invented" } }).success).toBe(false);
    const refinedInput = createProjectorOperationRequestSchema("application.observe", z.strictObject({ expectedRunId: z.string(), plan: z.strictObject({ runId: z.string() }) }).superRefine(({ expectedRunId, plan }, context) => {
      if (expectedRunId !== plan.runId) context.addIssue({ code: "custom", message: "run binding mismatch" });
    }));
    expect(refinedInput.safeParse({ ...applicationRequest, input: { expectedRunId: "run:other", plan: { runId: "run:1" } } }).success).toBe(false);

    const schema = createProjectorOperationResultSchema("context", z.strictObject({ contextId: z.string().min(1) }));
    const base = { apiVersion: "projector.operation-result/v1", operation: "context", package: { name: "projector", version: "2.1.0" }, exitCode: 0, readiness: { status: "ready", package: { name: "projector", version: "2.1.0" } } };
    expect(schema.safeParse({ ...base, status: "succeeded", output: { contextId: "knowledge_context_1" } }).success).toBe(true);
    expect(schema.safeParse({ ...base, status: "succeeded", output: { contextId: "knowledge_context_1", inventedEvidence: [] } }).success).toBe(false);
    expect(schema.safeParse({ ...base, status: "unavailable" }).success).toBe(false);
  });

  it("separates the prepared config from the one explicit legacy baseline", () => {
    const legacy = { apiVersion: "projector.config/v1", enabled: true };
    const prepared = { ...legacy, projectorVersion: "2.1.0" };
    expect(LegacyUnversionedProjectorConfigSchema.safeParse(legacy).success).toBe(true);
    expect(LegacyUnversionedProjectorConfigSchema.safeParse(prepared).success).toBe(false);
    expect(PreparedProjectorConfigSchema.safeParse(prepared).success).toBe(true);
    expect(PreparedProjectorConfigSchema.safeParse({ ...prepared, projectorVersion: "2.1.0-0.alpha+build.7" }).success).toBe(true);
    for (const projectorVersion of ["2.1", "02.1.0", "2.1.0-01", "latest"]) {
      expect(PreparedProjectorConfigSchema.safeParse({ ...prepared, projectorVersion }).success).toBe(false);
    }
  });

  it("models ordered project-data migrations without implying review or approval", () => {
    const hash = `sha256:v1:${"a".repeat(64)}`;
    const snapshot = {
      apiVersion: "projector.project-data-format-snapshot/v1",
      packageIdentity: { name: "projector", version: "2.1.0" },
      preparedConfig: { apiVersion: "projector.config/v1", projectorVersion: "2.1.0", semanticHash: hash },
      canonical: { envelopeApiVersion: "projector/v2", schemaBundleHash: hash, semanticSetHash: hash },
      runtimeEvidence: { schemaVersion: "1.0.0", semanticHash: hash },
      sqlite: { schemaVersion: 1, derivationHash: hash },
      snapshotHash: hash,
    } as const;
    const ref = { id: "transform:config-v2", relativePath: "migrations/config-v2.mjs", contentHash: hash };
    const manifest = {
      apiVersion: "projector.project-data-migration-manifest/v1",
      id: "migration:2.1.0-to-2.2.0",
      fromVersion: "2.1.0",
      toVersion: "2.2.0",
      sourceSnapshotHash: hash,
      targetSnapshotHash: hash,
      manifestHash: hash,
      kind: "transform",
      transforms: [ref],
      validations: [{ ...ref, id: "validation:config-v2" }],
    } as const;

    expect(ProjectDataFormatSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(ProjectDataMigrationManifestSchema.safeParse(manifest).success).toBe(true);
    for (const [fromVersion, toVersion] of [["2.1.0", "2.1.0"], ["2.2.0", "2.1.0"], ["2.1.0", "2.1.0-alpha"]]) {
      expect(ProjectDataMigrationManifestSchema.safeParse({ ...manifest, fromVersion, toVersion }).success).toBe(false);
    }
    expect(ProjectDataMigrationManifestSchema.safeParse({ ...manifest, fromVersion: "2.1.0-alpha.9", toVersion: "2.1.0-alpha.10" }).success).toBe(true);
    const { transforms: _transforms, validations: _validations, ...manifestBase } = manifest;
    expect(ProjectDataMigrationManifestSchema.safeParse({ ...manifestBase, kind: "no-data-change" }).success).toBe(true);
    expect(ProjectDataMigrationManifestSchema.safeParse({ ...manifest, kind: "no-data-change" }).success).toBe(false);
    expect(ProjectDataMigrationManifestSchema.safeParse({ ...manifest, transforms: [] }).success).toBe(false);

    const nextManifest = { ...manifestBase, id: "migration:2.2.0-to-4.0.0", fromVersion: "2.2.0", toVersion: "4.0.0", sourceSnapshotHash: manifest.targetSnapshotHash, kind: "no-data-change" } as const;
    const chain = { apiVersion: "projector.data-migration-chain/v1", manifests: [manifest, nextManifest] } as const;
    expect(ProjectDataMigrationChainSchema.safeParse(chain).success).toBe(true);
    expect(ProjectDataMigrationChainSchema.safeParse({ ...chain, manifests: [manifest, { ...nextManifest, fromVersion: "3.0.0" }] }).success).toBe(false);
    expect(ProjectDataMigrationChainSchema.safeParse({ ...chain, manifests: [manifest, { ...nextManifest, sourceSnapshotHash: `sha256:v1:${"b".repeat(64)}` }] }).success).toBe(false);
    expect(ProjectDataMigrationChainSchema.safeParse({ ...chain, manifests: [manifest, { ...nextManifest, id: manifest.id }] }).success).toBe(false);

    const draft = { apiVersion: "projector.project-data-migration-draft/v1", sourceSnapshot: snapshot, targetSnapshot: { ...snapshot, packageIdentity: { ...snapshot.packageIdentity, version: "2.2.0" } }, operations: [], customTransforms: [], validations: [] };
    expect(ProjectDataMigrationDraftSchema.safeParse(draft).success).toBe(true);
    expect(ProjectDataMigrationDraftSchema.safeParse({ ...draft, approvalId: "invented" }).success).toBe(false);

    const pending = { apiVersion: "projector.pending-project-data-migration/v1", migrationId: manifest.id, sourceSnapshotHash: hash, targetSnapshotHash: hash, manifestHash: hash, backup: { id: "backup:2.1.0", location: { kind: "codex-data-relative", path: "projector/backups/2.1.0" }, manifestHash: hash }, stagingLocation: ".projector.staging/2.2.0", phase: "staged", createdAt: "2026-09-10T12:00:00Z" };
    expect(PendingProjectDataMigrationSchema.safeParse(pending).success).toBe(true);
    expect(PendingProjectDataMigrationSchema.safeParse({ ...pending, markerHash: hash }).success).toBe(false);
    const invalidPaths = ["../escape", "./staging", "/absolute", "C:/absolute", "a/../b", "a\\b", "migrations/step.mjs:payload", ".projector.staging/state:stream", "state.", "state ", "CON", "con.txt", "nested/PRN.log", "nested/COM1"];
    for (const path of invalidPaths) {
      expect(PendingProjectDataMigrationSchema.safeParse({ ...pending, stagingLocation: path }).success).toBe(false);
    }

    const validPending = PendingProjectDataMigrationSchema.parse(pending);
    const contentHash = ContentHashSchema.parse(hash);
    const receipt = createProjectDataMigrationReceipt({
      apiVersion: "projector.project-data-migration-receipt/v1",
      migrationId: manifest.id,
      manifestHash: contentHash,
      sourceSnapshotHash: contentHash,
      targetSnapshotHash: contentHash,
      journalId: "journal:migration-2.1.0-to-2.2.0",
      journalHash: ContentHashSchema.parse(`sha256:v1:${"b".repeat(64)}`),
      backup: validPending.backup,
      outcome: "completed",
      completedAt: "2026-09-10T12:30:00Z",
    });
    expect(ProjectDataMigrationReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(ProjectDataMigrationReceiptSchema.safeParse({ ...receipt, journalHash: hash }).success).toBe(false);
    expect(ProjectDataMigrationReceiptSchema.safeParse({ ...receipt, targetPaths: [] }).success).toBe(false);
    expect(ProjectDataMigrationReceiptSchema.safeParse({ ...receipt, approvalId: "invented" }).success).toBe(false);

    const exported = exportContractJsonSchemas();
    for (const name of ["ProjectDataFormatSnapshot", "ProjectDataMigrationManifest", "ProjectDataMigrationChain", "ProjectDataMigrationDraft", "PendingProjectDataMigration", "ProjectDataMigrationReceipt"]) {
      expect(exported[name]).toMatchObject({ $schema: expect.any(String) });
    }
    const portablePathPattern = (exported.PortableRelativePath as { pattern?: string }).pattern;
    expect(portablePathPattern).toBeTypeOf("string");
    for (const path of invalidPaths) {
      expect(PortableRelativePathSchema.safeParse(path).success, path).toBe(false);
      expect(new RegExp(portablePathPattern!, "u").test(path), path).toBe(false);
    }
  });

  it("enforces operation-specific behavior delta presence rules", () => {
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "remove",
      requirementId: "req_checkout",
      rationale: "retired behavior",
    }).success).toBe(true);
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "remove",
      rationale: "missing existing identity",
    }).success).toBe(false);
    expect(RequirementDeltaSchema.safeParse({
      subjectType: "requirement",
      kind: "add",
      requirementId: "req_checkout",
      rationale: "invalid existing identity",
    }).success).toBe(false);
  });

  it("enforces lineage cardinality in the public schema", () => {
    const common = {
      id: "lineage_a",
      reason: "refactor",
      stateDigest: `sha256:v1:${"a".repeat(64)}`,
    };
    expect(LineageRecordSchema.safeParse({ ...common, kind: "split", fromIds: ["a"], toIds: ["b"] }).success).toBe(false);
    expect(LineageRecordSchema.safeParse({ ...common, kind: "split", fromIds: ["a"], toIds: ["b", "c"] }).success).toBe(true);
  });
});
