import { hashFramedDomain } from "../hashing/canonical-json.js";

function slug(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "entity";
}

export interface IncidentalIdentityMetadata {
  readonly path?: string;
  readonly aliases?: readonly string[];
  readonly packageName?: string;
}

export function deriveEntityId(
  adapterNamespace: string,
  semanticKey: string,
  _incidental?: IncidentalIdentityMetadata,
): string {
  const namespace = slug(adapterNamespace);
  const key = semanticKey.normalize("NFKC").trim();
  if (key.length === 0) {
    throw new Error("semantic key cannot be blank");
  }
  const digest = hashFramedDomain("derived-entity-id", { namespace, key });
  return `${namespace}_${digest.slice(-32)}`;
}

export function inferEntityId(
  kind: string,
  semanticKey: string,
  evidenceIds: readonly string[],
): string {
  const normalizedEvidenceIds = [...new Set(evidenceIds)].sort();
  const digest = hashFramedDomain("inferred-entity-id", {
    kind: kind.normalize("NFKC").trim(),
    semanticKey: semanticKey.normalize("NFKC").trim(),
    evidenceIds: normalizedEvidenceIds,
  });
  return `inferred_${digest.slice(-32)}`;
}

export interface LineageShape {
  readonly kind: "move" | "split" | "merge" | "replace" | "delete";
  readonly fromIds: readonly string[];
  readonly toIds: readonly string[];
}

export function validateLineage(lineage: LineageShape): string[] {
  const errors: string[] = [];
  if (new Set(lineage.fromIds).size !== lineage.fromIds.length) {
    errors.push("lineage source IDs must be unique");
  }
  if (new Set(lineage.toIds).size !== lineage.toIds.length) {
    errors.push("lineage destination IDs must be unique");
  }
  if (lineage.fromIds.length === 0) {
    errors.push("lineage requires at least one source");
  }
  if (lineage.kind === "move" && (lineage.fromIds.length !== 1 || lineage.toIds.length !== 1)) {
    errors.push("move lineage requires exactly one source and destination");
  }
  if (lineage.kind === "split" && lineage.toIds.length < 2) {
    errors.push("split lineage requires at least two destinations");
  }
  if (lineage.kind === "merge" && (lineage.fromIds.length < 2 || lineage.toIds.length !== 1)) {
    errors.push("merge lineage requires at least two sources and one destination");
  }
  if (lineage.kind === "replace" && lineage.toIds.length === 0) {
    errors.push("replace lineage requires at least one destination");
  }
  if (lineage.kind === "delete" && lineage.toIds.length !== 0) {
    errors.push("delete lineage cannot have destinations");
  }
  return errors;
}
