import { canonicalJson, hashFramedDomain, type CompletionContract, type ContentHash, type ExecutionCapsule, type ExecutionPlan, type SemanticChange, type StateBinding, type WorkPacket } from "@projector/core";

import { createExecutionCapsule, createExecutionPlan } from "./index.js";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const stages = ["contract", "bridge", "source", "generated", "consumer", "cutover", "agent", "cleanup"] as const;
export type ChangePacketStage = (typeof stages)[number];
export interface ChangePacketProposal {
  readonly key: string; readonly title: string; readonly stage: ChangePacketStage; readonly executionMode: WorkPacket["executionMode"];
  readonly transformId?: string; readonly unitIds: readonly string[]; readonly semanticOwnerIds: readonly string[]; readonly writeSelectors: readonly string[];
  readonly forbiddenWriteSelectors?: readonly string[]; readonly dependencies: readonly string[]; readonly validatorIds: readonly string[]; readonly convergence?: { readonly group: string; readonly maximumIterations: number };
}
export interface AuthenticatedPacketProposalSet { readonly value: { readonly proposals: readonly ChangePacketProposal[]; readonly completionContract: CompletionContract }; readonly contentHash: ContentHash }
export interface AuthenticatedChangePlanningInput { readonly value: { readonly change: SemanticChange; readonly boundState: StateBinding; readonly compilerFactsHash: ContentHash }; readonly contentHash: ContentHash }
export interface CompiledChangePacket { readonly key: string; readonly packet: Readonly<WorkPacket>; readonly capsule: Readonly<ExecutionCapsule>; readonly packetHash: ContentHash; readonly capsuleHash: ContentHash; readonly semanticOwnerIds: readonly string[]; readonly writeSelectors: readonly string[]; readonly convergence?: { readonly group: string; readonly maximumIterations: number } }
export interface CompiledSemanticChangePlan { readonly plan: Readonly<ExecutionPlan>; readonly packets: readonly CompiledChangePacket[]; readonly executionOrder: readonly CompiledChangePacket[]; readonly packetHash: ContentHash }

const pathRoot = (value: string): string => value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/\*\*.*$/u, "").replace(/\*.*$/u, "").replace(/\/+$/u, "");
const pathOverlap = (left: string, right: string): boolean => { const a = pathRoot(left); const b = pathRoot(right); return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); };
const pathWithin = (candidate: string, boundary: string): boolean => { const child = pathRoot(candidate); const parent = pathRoot(boundary); return parent === "." || child === parent || child.startsWith(`${parent}/`); };

function normalizeProposals(raw: readonly ChangePacketProposal[]): ChangePacketProposal[] {
  const byKey = new Map<string, ChangePacketProposal>();
  for (const item of raw) {
    if (item.key.trim() === "" || item.unitIds.length === 0 || item.writeSelectors.length === 0) throw new Error("change packet requires a stable key, units, and explicit write selectors");
    if (item.convergence !== undefined && (!Number.isSafeInteger(item.convergence.maximumIterations) || item.convergence.maximumIterations < 1)) throw new Error("packet convergence requires positive bounded iterations");
    const proposal = { ...structuredClone(item), unitIds: unique(item.unitIds), semanticOwnerIds: unique(item.semanticOwnerIds), writeSelectors: unique(item.writeSelectors), ...(item.forbiddenWriteSelectors === undefined ? {} : { forbiddenWriteSelectors: unique(item.forbiddenWriteSelectors) }), dependencies: unique(item.dependencies), validatorIds: unique(item.validatorIds) };
    const existing = byKey.get(proposal.key);
    if (existing !== undefined && canonicalJson(existing) !== canonicalJson(proposal)) throw new Error(`conflicting change packet ${proposal.key}`);
    byKey.set(proposal.key, existing ?? proposal);
  }
  const proposals = [...byKey.values()].sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || compare(a.key, b.key));
  for (const proposal of proposals) for (const dependency of proposal.dependencies) if (!byKey.has(dependency)) throw new Error(`packet ${proposal.key} has missing dependency ${dependency}`);
  for (let leftIndex = 0; leftIndex < proposals.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < proposals.length; rightIndex += 1) {
    const left = proposals[leftIndex]!; const right = proposals[rightIndex]!;
    const semanticOverlap = left.unitIds.some((id) => right.unitIds.includes(id)) || left.semanticOwnerIds.some((id) => right.semanticOwnerIds.includes(id));
    const selectorOverlap = left.writeSelectors.some((a) => right.writeSelectors.some((b) => pathOverlap(a, b)));
    if (semanticOverlap || selectorOverlap) throw new Error(`packet semantic/write overlap: ${left.key}, ${right.key}`);
  }
  return proposals;
}

function executionKeys(proposals: readonly ChangePacketProposal[]): string[] {
  const byKey = new Map(proposals.map((item) => [item.key, item]));
  const visiting = new Set<string>(); const visited = new Set<string>(); const ordered: string[] = [];
  const visit = (key: string, lineage: string[]): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      const cycle = lineage.slice(lineage.indexOf(key)); const group = byKey.get(key)?.convergence?.group;
      if (group === undefined || cycle.some((id) => byKey.get(id)?.convergence?.group !== group)) throw new Error(`packet dependency cycle is not declared convergent: ${unique(cycle).join(", ")}`);
      for (const id of unique(cycle)) { visited.add(id); ordered.push(id); }
      return;
    }
    visiting.add(key);
    const proposal = byKey.get(key); if (proposal === undefined) throw new Error(`unknown packet ${key}`);
    for (const dependency of proposal.dependencies) visit(dependency, [...lineage, key]);
    visiting.delete(key); if (!visited.has(key)) { visited.add(key); ordered.push(key); }
  };
  for (const proposal of proposals) visit(proposal.key, []);
  return ordered;
}

export async function compileSemanticChangePlan(
  input: { readonly changeId: string; readonly revision: number; readonly sourceRunId: string },
  ports: { readonly changes: { read(changeId: string): Promise<AuthenticatedChangePlanningInput> }; readonly packets: { compile(change: SemanticChange): Promise<AuthenticatedPacketProposalSet> } },
): Promise<CompiledSemanticChangePlan> {
  const authenticatedChange = await ports.changes.read(input.changeId);
  if (authenticatedChange.contentHash !== hashFramedDomain("authenticated-change-planning-input", authenticatedChange.value) || authenticatedChange.value.change.id !== input.changeId) throw new Error("change planning input is unauthenticated or mismatched");
  const proposalsEnvelope = await ports.packets.compile(authenticatedChange.value.change);
  if (proposalsEnvelope.contentHash !== hashFramedDomain("authenticated-change-packet-proposals", proposalsEnvelope.value)) throw new Error("change packet compiler output is unauthenticated");
  const proposals = normalizeProposals(proposalsEnvelope.value.proposals);
  for (const proposal of proposals) {
    if (proposal.writeSelectors.some((selector) => !authenticatedChange.value.change.boundary.some((boundary) => pathWithin(selector, boundary)))) throw new Error(`packet ${proposal.key} write scope is outside the semantic change boundary`);
    if (proposal.writeSelectors.some((selector) => proposal.forbiddenWriteSelectors?.some((forbidden) => pathOverlap(selector, forbidden)) === true)) throw new Error(`packet ${proposal.key} write scope intersects a forbidden selector`);
  }
  const order = executionKeys(proposals);
  const planIdentity = hashFramedDomain("semantic-change-plan-identity", { changeId: input.changeId, revision: input.revision, sourceRunId: input.sourceRunId, proposals, completionContract: proposalsEnvelope.value.completionContract, bindingDigest: authenticatedChange.value.boundState.dependencyDigest });
  const planId = `execution_plan_${planIdentity.slice(-32)}`;
  const normativeKernelHash = hashFramedDomain("semantic-change-normative-kernel", authenticatedChange.value.change);
  const packets = proposals.map((proposal): CompiledChangePacket => {
    const packetId = `work_packet_${hashFramedDomain("semantic-change-packet-identity", { planId, key: proposal.key }).slice(-32)}`;
    const capsule = createExecutionCapsule({ id: `capsule_${hashFramedDomain("semantic-change-capsule-identity", { packetId }).slice(-32)}`, taskId: packetId, objective: proposal.title, operation: proposal.transformId ?? proposal.stage, unitIds: [...proposal.unitIds], boundState: authenticatedChange.value.boundState, relevanceClosureId: authenticatedChange.value.change.relevanceClosureId, analysisFacetKeys: [...authenticatedChange.value.change.analysisFacetKeys], requirementIds: authenticatedChange.value.change.operations.filter((item) => item.subjectType === "requirement").map((item) => item.requirementId!).filter(Boolean), scenarioIds: authenticatedChange.value.change.operations.filter((item) => item.subjectType === "scenario").map((item) => item.scenarioId!).filter(Boolean), conceptSummary: authenticatedChange.value.change.normalizedIntent, decisionIds: [...authenticatedChange.value.change.decisionIds], decisionSummary: "authenticated semantic-change prerequisites", unresolvedArchitectureConcerns: [], lensSummary: "compiled from impact closure", effectiveRules: [], normativeKernelHash, relevantPrecedents: [], allowedWrites: proposal.writeSelectors.map((path) => ({ selector: { op: "atom", field: "path", matcher: path.includes("*") ? "glob" : "equals", value: path }, operations: [proposal.transformId ?? proposal.stage], reason: "compiled packet write scope" })), forbiddenWrites: (proposal.forbiddenWriteSelectors ?? []).map((path) => ({ selector: { op: "atom", field: "path", matcher: path.includes("*") ? "glob" : "equals", value: path }, operations: [proposal.transformId ?? proposal.stage], reason: "compiled packet forbidden scope" })), availablePrimitives: proposal.transformId === undefined ? [] : [proposal.transformId], requiredValidations: [...proposal.validatorIds], upstreamImplications: [...proposal.dependencies], downstreamImplications: proposals.filter(({ dependencies }) => dependencies.includes(proposal.key)).map(({ key }) => key), knownExceptions: [], unknowns: proposal.executionMode === "deterministic" ? [] : ["host continuation required"], risk: authenticatedChange.value.change.risk, completionContract: proposalsEnvelope.value.completionContract });
    const packet: WorkPacket = { id: packetId, planId, title: proposal.title, strategy: proposal.executionMode === "deterministic" ? "deterministic-patch" : proposal.executionMode === "agent" ? "agent-repair" : "human-decision", unitIds: [...proposal.unitIds], dependencies: proposal.dependencies.map((key) => `work_packet_${hashFramedDomain("semantic-change-packet-identity", { planId, key }).slice(-32)}`), capsuleId: capsule.id, risk: authenticatedChange.value.change.risk, executionMode: proposal.executionMode, ...(proposal.transformId === undefined ? {} : { transformId: proposal.transformId }), validatorIds: [...proposal.validatorIds], rollback: { kind: proposal.executionMode === "external" ? "compensation" : "git-checkpoint" }, boundState: authenticatedChange.value.boundState, status: "pending" };
    return { key: proposal.key, packet: Object.freeze(packet), capsule, packetHash: hashFramedDomain("semantic-change-work-packet", packet), capsuleHash: hashFramedDomain("semantic-change-execution-capsule", capsule), semanticOwnerIds: Object.freeze([...proposal.semanticOwnerIds]), writeSelectors: Object.freeze([...proposal.writeSelectors]), ...(proposal.convergence === undefined ? {} : { convergence: Object.freeze({ ...proposal.convergence }) }) };
  });
  const byKey = new Map(packets.map((item) => [item.key, item]));
  const firstPacketId = order[0] === undefined ? undefined : byKey.get(order[0])?.packet.id;
  const predictedImpactClosureHash = authenticatedChange.value.change.predictedImpact?.contentHash;
  const plan = createExecutionPlan({ id: planId, revision: input.revision, semanticChangeId: input.changeId, sourceRunId: input.sourceRunId, boundState: authenticatedChange.value.boundState, relevanceClosureId: authenticatedChange.value.change.relevanceClosureId, ...(predictedImpactClosureHash === undefined ? {} : { predictedImpactClosureHash }), boundary: authenticatedChange.value.change.boundary, assumptions: authenticatedChange.value.change.assumptions, knownAffectedUnitIds: authenticatedChange.value.change.predictedImpact?.knownAffectedUnitIds ?? [], possibleFrontierUnitIds: authenticatedChange.value.change.predictedImpact?.possibleFrontierUnitIds ?? [], unavailableSurfaceIds: authenticatedChange.value.change.predictedImpact?.unavailableSurfaceIds ?? [], packetIds: packets.map(({ packet }) => packet.id), checkpoints: packets.map(({ packet }) => ({ id: `checkpoint:${packet.id}`, afterPacketIds: [packet.id], requiredValidators: [...packet.validatorIds], rollback: packet.rollback })), completionCriteria: proposalsEnvelope.value.completionContract, ...(firstPacketId === undefined ? {} : { recommendedNextChunk: firstPacketId }) });
  return { plan, packets: Object.freeze(packets), executionOrder: Object.freeze(order.map((key) => byKey.get(key)!)), packetHash: hashFramedDomain("semantic-change-packet-set", packets.map(({ packetHash, capsuleHash }) => ({ packetHash, capsuleHash }))) };
}
