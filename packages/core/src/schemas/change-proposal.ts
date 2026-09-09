import { z } from "zod";

import { ArchitectureConcernSchema, ArchitectureDecisionSchema, AuthorityRecordSchema, BehavioralScenarioSchema, ConceptSchema, DeveloperPreferenceSchema, ImpactRuleSchema, ProjectionLensSchema, RelationSchema, RequirementSchema, RuleSchema } from "./generated-contracts.js";

export const changeProposalApiVersion = "projector.change-proposal/v1" as const;
const facets = ["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "workspace-expansion", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"] as const;
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const text = (maximum = 4_096) => z.string().min(1).max(maximum).refine((value) => !value.includes("\0") && value.trim().length > 0, "must be nonblank bounded text").transform((value) => value.normalize("NFKC").trim());
const key = text(160).refine((value) => /^[a-z0-9][a-z0-9._:-]*$/u.test(value.toLocaleLowerCase("en-US")), "must be a stable lowercase key").transform((value) => value.toLocaleLowerCase("en-US"));
const repositoryPath = z.string().min(1).max(1_024).refine((value) => {
  const normalized = value.normalize("NFKC");
  return normalized === value && !normalized.includes("\\") && !normalized.startsWith("/") && !/^[A-Za-z]:/u.test(normalized)
    && !normalized.endsWith("/") && !normalized.includes("//") && normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}, "must be a canonical repository-relative path");
const unique = <T extends z.ZodTypeAny>(schema: T, minimum = 0, maximum = 64) => z.array(schema).min(minimum).max(maximum).superRefine((values, context) => {
  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) context.addIssue({ code: "custom", message: "contains duplicates" });
});

const RevisionSchema = z.object({
  id: text(512),
  expectedSemanticHash: z.string().regex(/^sha256:v1:[a-f0-9]{64}$/u),
  rationale: text(),
}).strict();
const RequirementProposalSchema = z.object({ key, title: text(240), statement: text(), aliases: unique(text(512)).default([]), revision: RevisionSchema.optional() }).strict();
const ScenarioStepSchema = z.object({ role: z.enum(["precondition", "trigger", "expected-outcome", "forbidden-outcome"]), statement: text() }).strict();
const ScenarioStepsSchema = unique(ScenarioStepSchema, 2, 32).superRefine((steps, context) => {
  if (!steps.some(({ role }) => role === "trigger") || !steps.some(({ role }) => role === "expected-outcome" || role === "forbidden-outcome")) context.addIssue({ code: "custom", message: "steps must contain a trigger and an outcome" });
});
const ScenarioProposalSchema = z.object({ key, title: text(240), aliases: unique(text(512)).default([]), steps: ScenarioStepsSchema, revision: RevisionSchema.optional() }).strict();
const DeferralSchema = z.object({ rationale: text(), reconsiderWhen: text(), validUntil: z.iso.datetime(), preservedOptions: unique(text(512), 1), forbiddenCommitments: unique(text(512), 1), forbiddenWritePaths: unique(repositoryPath, 1).superRefine((paths, context) => { if (paths.some((path) => /[*?[\]]/u.test(path))) context.addIssue({ code: "custom", message: "forbidden write paths must contain exact canonical paths, not globs" }); }) }).strict();
const ArchitectureProposalSchema = z.object({ concernKey: key, title: text(240), question: text(), materiality: z.enum(["material-soon", "deferable"]), deferral: DeferralSchema }).strict();
const ExactEditSchema = z.object({ path: repositoryPath.refine((path) => ![".git", ".projector", ".worktrees", "node_modules"].some((root) => path === root || path.startsWith(`${root}/`)), "path is reserved and cannot be edited"), before: z.string().max(4 * 1024 * 1024).nullable(), after: z.string().max(4 * 1024 * 1024).nullable() }).strict().superRefine(({ before, after }, context) => {
  if (before === after) context.addIssue({ code: "custom", message: "edit is a no-op" });
  if ([before, after].some((value) => value?.includes("\0") === true)) context.addIssue({ code: "custom", message: "edit content contains a NUL byte" });
});
const ValidationProposalSchema = z.object({ independentNodeTests: unique(repositoryPath, 0), supplementalNodeTests: unique(repositoryPath).default([]) }).strict().superRefine(({ independentNodeTests, supplementalNodeTests }, context) => {
  for (const path of [...independentNodeTests, ...supplementalNodeTests]) if (!/(?:^|\/)\S+\.test\.(?:mjs|cjs|js)$/u.test(path)) context.addIssue({ code: "custom", message: `Node validator must be a test file: ${path}` });
  if (independentNodeTests.some((path) => supplementalNodeTests.includes(path))) context.addIssue({ code: "custom", message: "validator provenance groups overlap" });
});
const contentHash = z.string().regex(/^sha256:v1:[a-f0-9]{64}$/u);

const NewIdentityBoundarySchema = z.object({
  owns: unique(text(), 1),
  excludes: unique(text(), 1),
  nearestEntityIds: unique(text(512)),
  rationale: text(),
}).strict();
const IdentityResolutionSchema = z.object({
  contextId: text(512),
  contextHash: contentHash,
  outcome: z.enum(["reuse-existing", "coordinated-modification", "split-existing", "merge-existing", "replace-existing", "create-new", "no-durable-entity"]),
  selectedEntityIds: unique(text(512), 0, 64),
  rationale: text(),
  newBoundary: NewIdentityBoundarySchema.optional(),
}).strict().superRefine(({ outcome, selectedEntityIds, newBoundary }, context) => {
  if (["create-new", "split-existing", "replace-existing"].includes(outcome) && newBoundary === undefined) {
    context.addIssue({ code: "custom", message: `${outcome} identity resolution requires a new boundary` });
  }
  if (["reuse-existing", "coordinated-modification", "merge-existing"].includes(outcome) && selectedEntityIds.length === 0) {
    context.addIssue({ code: "custom", message: `${outcome} identity resolution requires selected entities` });
  }
});

function canonicalPayloadWithoutDerivedHashes(schema: z.ZodType, hasDiscoveryHash = false): z.ZodObject {
  if (!(schema instanceof z.ZodLazy)) throw new TypeError("canonical mutation payload schema must be lazy");
  const object = schema.unwrap();
  if (!(object instanceof z.ZodObject)) throw new TypeError("canonical mutation payload schema must unwrap to an object");
  return hasDiscoveryHash ? object.omit({ semanticHash: true, discoveryHash: true }) : object.omit({ semanticHash: true });
}
const canonicalPayloadSchemas = {
  requirement: canonicalPayloadWithoutDerivedHashes(RequirementSchema, true).extend({ key, title: text(240), statement: text(), aliases: unique(text(512)) }),
  "behavioral-scenario": canonicalPayloadWithoutDerivedHashes(BehavioralScenarioSchema, true).extend({ key, title: text(240), aliases: unique(text(512)), steps: ScenarioStepsSchema }),
  concept: canonicalPayloadWithoutDerivedHashes(ConceptSchema, true).extend({ key, name: text(240), statement: text(16_384), aliases: unique(text(512)) }),
  relation: canonicalPayloadWithoutDerivedHashes(RelationSchema),
  "architecture-decision": canonicalPayloadWithoutDerivedHashes(ArchitectureDecisionSchema).extend({ key, title: text(240), decision: text(16_384) }),
  "architecture-concern": canonicalPayloadWithoutDerivedHashes(ArchitectureConcernSchema).extend({ key, title: text(240), question: text() }),
  "developer-preference": canonicalPayloadWithoutDerivedHashes(DeveloperPreferenceSchema).extend({ key, statement: text() }),
  "projection-lens": canonicalPayloadWithoutDerivedHashes(ProjectionLensSchema).extend({
    key, purpose: text(),
    rules: z.array(canonicalPayloadWithoutDerivedHashes(RuleSchema)),
    impactRules: z.array(canonicalPayloadWithoutDerivedHashes(ImpactRuleSchema)),
  }),
  "authority-record": canonicalPayloadWithoutDerivedHashes(AuthorityRecordSchema).extend({ key, rationale: text(16_384) }),
} as const;
const canonicalMutationFor = <K extends keyof typeof canonicalPayloadSchemas>(kind: K, payload: (typeof canonicalPayloadSchemas)[K]) => z.union([
  z.object({ kind: z.literal(kind), operation: z.literal("add"), expectedAbsent: z.literal(true), payload, rationale: text() }).strict(),
  z.object({ kind: z.literal(kind), operation: z.literal("revise"), expectedSemanticHash: contentHash, expectedDocumentHash: contentHash, payload, rationale: text() }).strict(),
]);
const LineageSourceSchema = z.object({
  id: text(512),
  kind: z.enum(["requirement", "behavioral-scenario", "concept"]),
  expectedSemanticHash: contentHash,
  expectedDocumentHash: contentHash,
}).strict();
const LineageMutationSchema = z.object({
  kind: z.literal("lineage"),
  operation: z.literal("add"),
  lineageKind: z.enum(["move", "split", "merge", "replace", "delete"]),
  sources: unique(LineageSourceSchema, 1, 64),
  replacementIds: unique(text(512), 0, 64),
  rationale: text(),
}).strict().superRefine(({ lineageKind, sources, replacementIds }, context) => {
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (replacementIds.some((id) => sourceIds.has(id))) context.addIssue({ code: "custom", message: "lineage source cannot also be a replacement" });
  if (lineageKind === "move" && (sources.length !== 1 || replacementIds.length !== 1)) context.addIssue({ code: "custom", message: "move lineage requires one source and one replacement" });
  if (lineageKind === "split" && (sources.length !== 1 || replacementIds.length < 2)) context.addIssue({ code: "custom", message: "split lineage requires one source and at least two replacements" });
  if (lineageKind === "merge" && (sources.length < 2 || replacementIds.length !== 1)) context.addIssue({ code: "custom", message: "merge lineage requires at least two sources and one replacement" });
  if (lineageKind === "replace" && (sources.length !== 1 || replacementIds.length < 1)) context.addIssue({ code: "custom", message: "replace lineage requires one source and at least one replacement" });
  if (lineageKind === "delete" && replacementIds.length !== 0) context.addIssue({ code: "custom", message: "delete lineage cannot have replacements" });
});
const CanonicalMutationSchema = z.union([
  canonicalMutationFor("requirement", canonicalPayloadSchemas.requirement),
  canonicalMutationFor("behavioral-scenario", canonicalPayloadSchemas["behavioral-scenario"]),
  canonicalMutationFor("concept", canonicalPayloadSchemas.concept),
  canonicalMutationFor("relation", canonicalPayloadSchemas.relation),
  canonicalMutationFor("architecture-decision", canonicalPayloadSchemas["architecture-decision"]),
  canonicalMutationFor("architecture-concern", canonicalPayloadSchemas["architecture-concern"]),
  canonicalMutationFor("developer-preference", canonicalPayloadSchemas["developer-preference"]),
  canonicalMutationFor("projection-lens", canonicalPayloadSchemas["projection-lens"]),
  canonicalMutationFor("authority-record", canonicalPayloadSchemas["authority-record"]),
  LineageMutationSchema,
]);

export const ChangeProposalSchema = z.object({
  apiVersion: z.literal(changeProposalApiVersion),
  requirements: unique(RequirementProposalSchema, 0, 32).default([]),
  scenarios: unique(ScenarioProposalSchema, 0, 64).default([]),
  identityResolution: IdentityResolutionSchema.optional(),
  canonicalMutations: unique(CanonicalMutationSchema, 0, 64).optional(),
  architecture: ArchitectureProposalSchema.nullable(),
  edits: unique(ExactEditSchema, 0, 256).default([]),
  validation: ValidationProposalSchema.default({ independentNodeTests: [], supplementalNodeTests: [] }),
  analysisFacets: unique(z.enum(facets), 2),
}).strict().superRefine((proposal, context) => {
  const assertClaims = (label: string, items: readonly { key: string; aliases: readonly string[] }[]) => { const claims = new Set<string>(); for (const item of items) for (const claim of [item.key, ...item.aliases.map((value) => value.toLocaleLowerCase("en-US"))]) { if (claims.has(claim)) context.addIssue({ code: "custom", message: `duplicate ${label} identity claim: ${claim}` }); claims.add(claim); } };
  assertClaims("requirement", proposal.requirements); assertClaims("scenario", proposal.scenarios);
  const edited = proposal.edits.map(({ path }) => path);
  if (new Set(edited).size !== edited.length) context.addIssue({ code: "custom", message: "proposal has duplicate edit paths" });
  if (proposal.validation.independentNodeTests.some((path) => edited.includes(path))) context.addIssue({ code: "custom", message: "independent Node tests cannot be edited" });
  if ((proposal.architecture?.deferral.forbiddenWritePaths ?? []).some((path) => edited.includes(path))) context.addIssue({ code: "custom", message: "architecture deferral forbidden write paths overlap proposed edits" });
  const hasModelMutation = proposal.requirements.length > 0 || proposal.scenarios.length > 0 || (proposal.canonicalMutations?.length ?? 0) > 0;
  if (proposal.edits.length === 0 && !hasModelMutation) context.addIssue({ code: "custom", message: "proposal must contain a code edit or canonical semantic mutation" });
  if (proposal.edits.length > 0) {
    if (proposal.requirements.length === 0 || proposal.scenarios.length === 0) context.addIssue({ code: "custom", message: "code-edit proposals require at least one requirement and behavioral scenario" });
    if (proposal.validation.independentNodeTests.length === 0) context.addIssue({ code: "custom", message: "code-edit proposals require an independent Node test" });
  } else if (proposal.validation.independentNodeTests.length > 0 || proposal.validation.supplementalNodeTests.length > 0) {
    context.addIssue({ code: "custom", message: "canonical-only proposals cannot claim runtime validation" });
  }
  const mutationClaims = new Set<string>();
  for (const mutation of proposal.canonicalMutations ?? []) {
    if (mutation.kind === "lineage") {
      const claim = `lineage:${mutation.lineageKind}:${mutation.sources.map(({ id }) => id).sort(compare).join(",")}:${mutation.replacementIds.join(",")}`;
      if (mutationClaims.has(claim)) context.addIssue({ code: "custom", message: `duplicate canonical mutation: ${claim}` });
      mutationClaims.add(claim);
      continue;
    }
    const id = typeof mutation.payload.id === "string" ? mutation.payload.id : undefined;
    if (id === undefined || id.trim().length === 0) context.addIssue({ code: "custom", message: `${mutation.kind} mutation payload requires an id` });
    else {
      const claim = `${mutation.kind}:${id}`;
      if (mutationClaims.has(claim)) context.addIssue({ code: "custom", message: `duplicate canonical mutation: ${claim}` });
      mutationClaims.add(claim);
    }
  }
  if (!proposal.analysisFacets.includes("behavior") || !proposal.analysisFacets.includes("architecture")) context.addIssue({ code: "custom", message: "analysis facets must include behavior and architecture" });
}).transform((proposal) => ({ ...proposal, requirements: proposal.requirements.map((item) => ({ ...item, aliases: [...item.aliases].sort(compare) })), scenarios: proposal.scenarios.map((item) => ({ ...item, aliases: [...item.aliases].sort(compare) })), ...(proposal.canonicalMutations === undefined ? {} : { canonicalMutations: [...proposal.canonicalMutations].sort((left, right) => compare(canonicalMutationSortKey(left), canonicalMutationSortKey(right))) }), edits: [...proposal.edits].sort((left, right) => compare(left.path, right.path)), validation: { independentNodeTests: [...proposal.validation.independentNodeTests].sort(compare), supplementalNodeTests: [...proposal.validation.supplementalNodeTests].sort(compare) }, analysisFacets: [...proposal.analysisFacets].sort(compare) }));

function canonicalMutationSortKey(mutation: z.infer<typeof CanonicalMutationSchema>): string {
  return mutation.kind === "lineage"
    ? `lineage:${mutation.lineageKind}:${mutation.sources.map(({ id }) => id).sort(compare).join(",")}:${mutation.replacementIds.join(",")}`
    : `${mutation.kind}:${String(mutation.payload.id)}`;
}

export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;
export type ProposedRequirement = ChangeProposal["requirements"][number];
export type ProposedScenario = ChangeProposal["scenarios"][number];
export type ProposedIdentityResolution = NonNullable<ChangeProposal["identityResolution"]>;
export type ProposedCanonicalMutation = NonNullable<ChangeProposal["canonicalMutations"]>[number];
export function parseChangeProposal(value: unknown): ChangeProposal { return ChangeProposalSchema.parse(value); }
