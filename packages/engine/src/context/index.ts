import {
  canonicalJson,
  hashFramedDomain,
  type AnalysisFacet,
  type BehavioralScenario,
  type ContentHash,
  type RelevanceBand,
  type RelevanceClosure,
  type Requirement,
} from "@projector/core";

import { evaluateSelector, type SelectorSubject } from "../governance/selectors.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export interface ActivatedFacetSet {
  facetKeys: string[];
  questionKeys: string[];
  relevanceRuleIds: string[];
  requiredEvidenceLanes: AnalysisFacet["requiredEvidenceLanes"];
  outputKinds: string[];
  dependencyKeys: string[];
  contentHash: ContentHash;
}

/** Facet activation adds read/verification obligations only; its result cannot express an architecture choice. */
export function activateAnalysisFacets(facets: readonly AnalysisFacet[], subject: SelectorSubject): ActivatedFacetSet {
  const byKey = new Map<string, AnalysisFacet>();
  for (const facet of facets) {
    const existing = byKey.get(facet.key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(facet)) {
      throw new Error(`conflicting Analysis Facet ${facet.key}`);
    }
    byKey.set(facet.key, structuredClone(facet));
  }
  const active = [...byKey.values()]
    .filter((facet) => evaluateSelector(facet.selector, subject).matched)
    .sort((left, right) => compareStrings(left.key, right.key));
  const value = {
    facetKeys: active.map(({ key }) => key),
    questionKeys: sortedUnique(active.flatMap(({ questionKeys }) => questionKeys)),
    relevanceRuleIds: sortedUnique(active.flatMap(({ relevanceRuleIds }) => relevanceRuleIds)),
    requiredEvidenceLanes: sortedUnique(active.flatMap(({ requiredEvidenceLanes }) => requiredEvidenceLanes)) as AnalysisFacet["requiredEvidenceLanes"],
    outputKinds: sortedUnique(active.flatMap(({ outputKinds }) => outputKinds)),
    dependencyKeys: sortedUnique([
      ...subject.dependencyKeys,
      ...active.map(({ key, version }) => `analysis-facet:${key}@${version}`),
    ]),
  };
  return { ...value, contentHash: hashFramedDomain("activated-analysis-facets", value) };
}

export interface ContextSource {
  entityId: string;
  kind: "concept" | "requirement" | "scenario" | "decision" | "projection-unit" | "other";
  semanticHash: ContentHash;
  full: string;
  summary: string;
}

export interface ContextSourcePort {
  load(entityId: string): Promise<ContextSource | undefined>;
}

export interface CompiledContextItem {
  entityId: string;
  sourceSemanticHash: ContentHash;
  kind: ContextSource["kind"];
  band: RelevanceBand;
  disclosure: "full" | "summary" | "identity";
  content: string;
  relevanceScore: number;
}

export interface CompiledSemanticContext {
  sourceClosureId: string;
  items: CompiledContextItem[];
  unknowns: string[];
  estimatedCost: number;
  contentHash: ContentHash;
}

const bandRank: Record<RelevanceBand, number> = { direct: 0, governing: 1, consequence: 2, possible: 3 };

function disclosure(band: RelevanceBand): CompiledContextItem["disclosure"] {
  return band === "direct" || band === "governing" ? "full" : band === "consequence" ? "summary" : "identity";
}

/** Compiles semantic entities, not directories; every item retains the canonical source identity. */
export async function compileContext(
  closure: RelevanceClosure,
  sources: ContextSourcePort,
  policy: { maxCost: number },
): Promise<CompiledSemanticContext> {
  if (!Number.isFinite(policy.maxCost) || policy.maxCost < 0) throw new Error("context maxCost must be a non-negative finite number");
  const entries = [...closure.entries].sort((left, right) =>
    bandRank[left.band] - bandRank[right.band] || right.score - left.score || compareStrings(left.entityId, right.entityId));
  const items: CompiledContextItem[] = [];
  const unknowns = [...closure.unknowns];
  let estimatedCost = 0;
  for (const entry of entries) {
    const source = await sources.load(entry.entityId);
    if (source === undefined) {
      unknowns.push(`context source ${entry.entityId} is unavailable`);
      continue;
    }
    if (source.entityId !== entry.entityId) throw new Error(`context source identity fork for ${entry.entityId}`);
    const mode = disclosure(entry.band);
    const content = mode === "full" ? source.full : mode === "summary" ? source.summary : source.entityId;
    const cost = content.length;
    if (estimatedCost + cost > policy.maxCost && !entry.requiredForPlanning) {
      unknowns.push(`context budget retained ${entry.entityId} on the frontier`);
      continue;
    }
    items.push({
      entityId: source.entityId,
      sourceSemanticHash: source.semanticHash,
      kind: source.kind,
      band: entry.band,
      disclosure: mode,
      content,
      relevanceScore: entry.score,
    });
    estimatedCost += cost;
  }
  const value = {
    sourceClosureId: closure.id,
    items,
    unknowns: sortedUnique(unknowns),
    estimatedCost,
  };
  return { ...value, contentHash: hashFramedDomain("compiled-semantic-context", value) };
}

export type BehaviorViewFormat = "markdown" | "gherkin" | "agent-compact" | "machine-invariant";

export interface DerivedBehaviorView {
  derivedId: string;
  format: BehaviorViewFormat;
  requirementId: string;
  requirementSemanticHash: ContentHash;
  scenarioId: string;
  scenarioSemanticHash: ContentHash;
  content: string;
  contentHash: ContentHash;
}

function renderBehaviorView(requirement: Requirement, scenario: BehavioralScenario, format: BehaviorViewFormat): string {
  const steps = scenario.steps.map(({ role, statement }) => `${role}: ${statement}`);
  if (format === "markdown") return `# ${requirement.title}\n\n${requirement.statement}\n\n## ${scenario.title}\n\n${steps.join("\n")}`;
  if (format === "gherkin") return `Feature: ${requirement.title}\nScenario: ${scenario.title}\n${steps.join("\n")}`;
  if (format === "agent-compact") return `${requirement.id}: ${requirement.statement} | ${scenario.id}: ${steps.join("; ")}`;
  return canonicalJson({ requirement: requirement.statement, scenario: scenario.steps });
}

/** Renderings are content-addressed derived views and cannot mutate or replace their source identities. */
export function deriveBehaviorViews(
  requirement: Requirement,
  scenario: BehavioralScenario,
  formats: readonly BehaviorViewFormat[],
): DerivedBehaviorView[] {
  return sortedUnique(formats).map((format) => {
    const content = renderBehaviorView(requirement, scenario, format as BehaviorViewFormat);
    const contentHash = hashFramedDomain("derived-behavior-view-content", { format, content });
    const identity = {
      format,
      requirementId: requirement.id,
      requirementSemanticHash: requirement.semanticHash,
      scenarioId: scenario.id,
      scenarioSemanticHash: scenario.semanticHash,
    };
    return {
      derivedId: `behavior_view_${hashFramedDomain("derived-behavior-view", identity).slice(-32)}`,
      ...identity,
      content,
      contentHash,
    } as DerivedBehaviorView;
  });
}
