import type { EvidenceRef } from "../domain/contracts.js";

export function applicationEvidenceBindingIssues(evidence: readonly EvidenceRef[]): readonly { readonly index: number; readonly message: string }[] {
  const latest = new Set<string>();
  const issues: { index: number; message: string }[] = [];
  for (const [index, reference] of evidence.entries()) {
    const binding = reference.applicationPredicate;
    if (binding?.observationRole !== "latest") continue;
    const group = JSON.stringify([binding.adapter.id, binding.adapter.version, binding.scenario.id, binding.case, binding.predicateId]);
    if (latest.has(group)) issues.push({ index, message: "only one latest application observation is allowed for a canonical evidence-owner predicate" });
    latest.add(group);
  }
  return issues;
}
