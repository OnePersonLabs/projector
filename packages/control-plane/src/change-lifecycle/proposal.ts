import type { BehavioralScenarioStep } from "@projector/core";

export const changeProposalApiVersion = "projector.change-proposal/v1" as const;

export interface ProposedRequirement {
  readonly key: string;
  readonly title: string;
  readonly statement: string;
  readonly aliases: readonly string[];
}

export interface ProposedScenario {
  readonly key: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly steps: readonly BehavioralScenarioStep[];
}

export interface BoundedArchitectureDeferral {
  readonly concernKey: string;
  readonly title: string;
  readonly question: string;
  readonly materiality: "material-soon" | "deferable";
  readonly deferral: {
    readonly rationale: string;
    readonly reconsiderWhen: string;
    readonly validUntil: string;
    readonly preservedOptions: readonly string[];
    readonly forbiddenCommitments: readonly string[];
    readonly forbiddenWritePaths: readonly string[];
  };
}

export interface ProposedExactTextEdit {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface ChangeProposal {
  readonly apiVersion: typeof changeProposalApiVersion;
  readonly requirements: readonly ProposedRequirement[];
  readonly scenarios: readonly ProposedScenario[];
  readonly architecture: BoundedArchitectureDeferral | null;
  readonly edits: readonly ProposedExactTextEdit[];
  readonly validation: {
    readonly independentNodeTests: readonly string[];
    readonly supplementalNodeTests: readonly string[];
  };
  readonly analysisFacets: readonly string[];
}

type JsonRecord = Record<string, unknown>;
const allowedFacets = new Set(["behavior", "architecture", "events", "security", "realtime", "migration", "public-contract", "workspace-expansion", "persistence", "performance", "observability", "compatibility", "distribution", "cleanup", "external-surface"]);
const scenarioRoles = new Set(["precondition", "trigger", "expected-outcome", "forbidden-outcome"]);

function record(value: unknown, label: string, allowedKeys: readonly string[]): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const result = value as JsonRecord;
  const unknown = Object.keys(result).filter((key) => !allowedKeys.includes(key)).sort();
  if (unknown.length > 0) throw new Error(`${label} has unknown field ${unknown.join(", ")}`);
  return result;
}

function list(value: unknown, label: string, minimum = 0, maximum = 64): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must contain ${minimum}-${maximum} items`);
  }
  return value;
}

function text(value: unknown, label: string, maximum = 4_096): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > maximum || normalized.includes("\0")) throw new Error(`${label} must be nonblank bounded text`);
  return normalized;
}

function key(value: unknown, label: string): string {
  const normalized = text(value, label, 160).toLocaleLowerCase("en-US");
  if (!/^[a-z0-9][a-z0-9._:-]*$/u.test(normalized)) throw new Error(`${label} must be a stable lowercase key`);
  return normalized;
}

function repositoryPath(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a repository-relative path`);
  const normalized = value.normalize("NFKC");
  if (normalized.length === 0 || normalized.length > 1_024
    || normalized !== normalized.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/").replace(/\/$/u, "")
    || normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized)
    || normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label} must be a canonical repository-relative path`);
  }
  return normalized;
}

function uniqueTextList(value: unknown, label: string, minimum = 0): string[] {
  const values = list(value, label, minimum).map((item, index) => text(item, `${label}[${index}]`, 512));
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicates`);
  return [...values].sort();
}

function aliases(value: unknown, label: string): string[] {
  const normalized = uniqueTextList(value, label).map((alias) => alias.toLocaleLowerCase("en-US"));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicate normalized aliases`);
  return normalized.sort();
}

function uniquePaths(value: unknown, label: string, minimum = 0): string[] {
  const values = list(value, label, minimum).map((item, index) => repositoryPath(item, `${label}[${index}]`));
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate paths`);
  return [...values].sort();
}

function parseRequirement(value: unknown, index: number): ProposedRequirement {
  const label = `requirements[${index}]`;
  const item = record(value, label, ["key", "title", "statement", "aliases"]);
  return {
    key: key(item.key, `${label}.key`),
    title: text(item.title, `${label}.title`, 240),
    statement: text(item.statement, `${label}.statement`),
    aliases: item.aliases === undefined ? [] : aliases(item.aliases, `${label}.aliases`),
  };
}

function parseScenario(value: unknown, index: number): ProposedScenario {
  const label = `scenarios[${index}]`;
  const item = record(value, label, ["key", "title", "aliases", "steps"]);
  const steps = list(item.steps, `${label}.steps`, 2, 32).map((value, stepIndex): BehavioralScenarioStep => {
    const stepLabel = `${label}.steps[${stepIndex}]`;
    const step = record(value, stepLabel, ["role", "statement"]);
    if (typeof step.role !== "string" || !scenarioRoles.has(step.role)) throw new Error(`${stepLabel}.role is unsupported`);
    return { role: step.role as BehavioralScenarioStep["role"], statement: text(step.statement, `${stepLabel}.statement`) };
  });
  if (!steps.some(({ role }) => role === "trigger") || !steps.some(({ role }) => role === "expected-outcome" || role === "forbidden-outcome")) {
    throw new Error(`${label}.steps must contain a trigger and an outcome`);
  }
  return {
    key: key(item.key, `${label}.key`),
    title: text(item.title, `${label}.title`, 240),
    aliases: item.aliases === undefined ? [] : aliases(item.aliases, `${label}.aliases`),
    steps,
  };
}

function parseArchitecture(value: unknown): BoundedArchitectureDeferral {
  const item = record(value, "architecture", ["concernKey", "title", "question", "materiality", "deferral"]);
  if (item.materiality === "blocking-now") throw new Error("blocking-now architecture concerns require a current canonical decision");
  if (item.materiality !== "material-soon" && item.materiality !== "deferable") throw new Error("architecture.materiality must be material-soon or deferable");
  const deferral = record(item.deferral, "architecture.deferral", ["rationale", "reconsiderWhen", "validUntil", "preservedOptions", "forbiddenCommitments", "forbiddenWritePaths"]);
  const validUntil = text(deferral.validUntil, "architecture.deferral.validUntil", 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(validUntil) || !Number.isFinite(Date.parse(validUntil))) {
    throw new Error("architecture.deferral.validUntil must be an ISO UTC timestamp");
  }
  const forbiddenWritePaths = uniquePaths(deferral.forbiddenWritePaths, "architecture.deferral.forbiddenWritePaths", 1);
  if (forbiddenWritePaths.some((path) => /[*?[\]]/u.test(path))) {
    throw new Error("architecture.deferral.forbiddenWritePaths must contain exact canonical paths, not globs");
  }
  return {
    concernKey: key(item.concernKey, "architecture.concernKey"),
    title: text(item.title, "architecture.title", 240),
    question: text(item.question, "architecture.question"),
    materiality: item.materiality,
    deferral: {
      rationale: text(deferral.rationale, "architecture.deferral.rationale"),
      reconsiderWhen: text(deferral.reconsiderWhen, "architecture.deferral.reconsiderWhen"),
      validUntil,
      preservedOptions: uniqueTextList(deferral.preservedOptions, "architecture.deferral.preservedOptions", 1),
      forbiddenCommitments: uniqueTextList(deferral.forbiddenCommitments, "architecture.deferral.forbiddenCommitments", 1),
      forbiddenWritePaths,
    },
  };
}

function parseEdit(value: unknown, index: number): ProposedExactTextEdit {
  const label = `edits[${index}]`;
  const item = record(value, label, ["path", "before", "after"]);
  const before = item.before === null ? null : typeof item.before === "string" ? item.before : undefined;
  const after = item.after === null ? null : typeof item.after === "string" ? item.after : undefined;
  if (before === undefined || after === undefined) throw new Error(`${label} before/after must be UTF-8 text or null`);
  if ([before, after].some((content) => content !== null && (Buffer.byteLength(content, "utf8") > 4 * 1024 * 1024 || content.includes("\0")))) {
    throw new Error(`${label} before/after must be bounded UTF-8 text without NUL bytes`);
  }
  if (before === after) throw new Error(`${label} is a no-op`);
  const path = repositoryPath(item.path, `${label}.path`);
  if ([".git", ".projector", ".worktrees", "node_modules"].some((root) => path === root || path.startsWith(`${root}/`))) {
    throw new Error(`${label}.path is reserved and cannot be edited by a proposal: ${path}`);
  }
  return { path, before, after };
}

function assertUniqueKeys(kind: string, items: readonly { key: string; aliases: readonly string[] }[]): void {
  const claims = new Set<string>();
  for (const item of items) {
    for (const claim of [item.key, ...item.aliases]) {
      if (claims.has(claim)) throw new Error(`duplicate ${kind} identity claim: ${claim}`);
      claims.add(claim);
    }
  }
}

export function parseChangeProposal(value: unknown): ChangeProposal {
  const root = record(value, "proposal", ["apiVersion", "requirements", "scenarios", "architecture", "edits", "validation", "analysisFacets"]);
  if (root.apiVersion !== changeProposalApiVersion) throw new Error(`unsupported proposal apiVersion: ${String(root.apiVersion)}`);
  const requirements = list(root.requirements, "requirements", 1, 32).map(parseRequirement);
  const scenarios = list(root.scenarios, "scenarios", 1, 64).map(parseScenario);
  const architecture = root.architecture === null ? null : parseArchitecture(root.architecture);
  assertUniqueKeys("requirement", requirements);
  assertUniqueKeys("scenario", scenarios);
  const edits = list(root.edits, "edits", 1, 256).map(parseEdit).sort((left, right) => left.path.localeCompare(right.path, "en-US"));
  if (new Set(edits.map(({ path }) => path)).size !== edits.length) throw new Error("proposal has duplicate edit paths");
  const validation = record(root.validation, "validation", ["independentNodeTests", "supplementalNodeTests"]);
  const independentNodeTests = uniquePaths(validation.independentNodeTests, "validation.independentNodeTests", 1);
  const supplementalNodeTests = uniquePaths(validation.supplementalNodeTests ?? [], "validation.supplementalNodeTests");
  for (const path of [...independentNodeTests, ...supplementalNodeTests]) {
    if (!/(?:^|\/)\S+\.test\.(?:mjs|cjs|js)$/u.test(path)) throw new Error(`Node validator must be a .test.mjs/.cjs/.js file: ${path}`);
  }
  const edited = new Set(edits.map(({ path }) => path));
  const forbiddenOverlap = (architecture?.deferral.forbiddenWritePaths ?? []).filter((path) => edited.has(path));
  if (forbiddenOverlap.length > 0) throw new Error(`architecture deferral forbidden write paths overlap proposed edits: ${forbiddenOverlap.join(", ")}`);
  const editedIndependent = independentNodeTests.filter((path) => edited.has(path));
  if (editedIndependent.length > 0) throw new Error(`independent Node tests cannot be edited by the proposal: ${editedIndependent.join(", ")}`);
  const overlap = independentNodeTests.filter((path) => supplementalNodeTests.includes(path));
  if (overlap.length > 0) throw new Error(`validator provenance groups overlap: ${overlap.join(", ")}`);
  const analysisFacets = uniqueTextList(root.analysisFacets, "analysisFacets", 2).map((facet) => facet.toLocaleLowerCase("en-US"));
  if (analysisFacets.some((facet) => !allowedFacets.has(facet))) throw new Error("proposal has unsupported analysis facet");
  if (!analysisFacets.includes("behavior") || !analysisFacets.includes("architecture")) throw new Error("proposal analysis facets must include behavior and architecture");
  return {
    apiVersion: changeProposalApiVersion,
    requirements,
    scenarios,
    architecture,
    edits,
    validation: { independentNodeTests, supplementalNodeTests },
    analysisFacets: [...new Set(analysisFacets)].sort(),
  };
}
