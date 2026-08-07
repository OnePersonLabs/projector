import { registerHashProfile, type HashProfile } from "./projections.js";

const profiles: Readonly<Record<string, HashProfile>> = {
  concept: {
    semantic: ["kind", "statement", "status", "tags"],
    discovery: ["key", "name", "aliases"],
    volatile: [],
  },
  requirement: {
    semantic: ["statement", "status", "scope"],
    discovery: ["key", "title", "aliases"],
    volatile: [],
  },
  "behavioral-scenario": {
    semantic: ["status", "scope", "steps"],
    discovery: ["key", "title", "aliases"],
    volatile: [],
  },
  relation: {
    semantic: ["fromId", "toId", "type", "active", "confidence"],
    discovery: [],
    volatile: [],
  },
  lineage: {
    semantic: ["kind", "fromIds", "toIds", "reason", "stateDigest"],
    discovery: [],
    volatile: [],
  },
  tombstone: {
    semantic: ["entityId", "deletedAtRevision", "lastSemanticHash", "replacementIds", "reason"],
    discovery: [],
    volatile: [],
  },
  rule: {
    semantic: ["version", "effect", "authorityClass", "governanceBasis", "selector", "predicates", "advisoryPayload", "conflictPolicy", "validatorIds", "transformIds"],
    discovery: ["key"],
    volatile: [],
  },
  "projection-lens": {
    semantic: ["version", "status", "realizesConceptKinds", "selector", "contributions", "expectedProjections", "rules", "impactRules", "recognizers", "validators", "transforms", "migrations", "conflictsWith", "compatibleWith", "authorityRecordId", "governanceBasis"],
    discovery: ["key"],
    volatile: [],
  },
  "semantic-representation-profile": {
    semantic: ["version", "status", "target", "selector", "optimization", "protectedDimensions", "styleRules", "generatorId", "validatorIds", "tokenizerProfileId", "fallbackProfileId"],
    discovery: ["key"],
    volatile: [],
  },
  "authority-record": {
    semantic: ["subjectId", "status", "conclusion", "assumptions", "reconsiderWhen", "evidenceRefreshPolicy", "vector", "assessmentConfidence", "evidence", "governanceRiskClass", "decidedBy"],
    discovery: ["key"],
    volatile: ["createdAt"],
  },
  "architecture-decision": {
    semantic: ["concernId", "decision", "selectedOptionKey", "scope", "lifecycle", "authorityRecordId", "governanceBasis", "consequences", "appliedPreferences", "supersedesDecisionIds", "migrationId"],
    discovery: ["key", "title"],
    volatile: [],
  },
  "transaction-receipt": {
    semantic: ["planId", "semanticChangeId", "riskClass", "beforeState", "afterState", "changedCanonicalEntityIds", "changedRequirementIds", "changedScenarioIds", "changedUnitIds", "validationSummaryHash", "certificateHash", "rollbackRef"],
    discovery: [],
    volatile: ["createdAt"],
  },
};

for (const [kind, profile] of Object.entries(profiles)) {
  registerHashProfile(kind, profile);
}

export const builtinHashProfiles = profiles;
