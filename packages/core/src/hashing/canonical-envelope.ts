import type { ContentHash } from "../domain/contracts.js";
import { getHashProfile, hashCanonicalDocument, hashDiscovery, hashSemantic } from "./projections.js";

export interface CanonicalDocumentEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly apiVersion: string;
  readonly schemaVersion: string;
  readonly kind: string;
  readonly id: string;
  readonly key: string;
  readonly lifecycle: string;
  readonly payload: TPayload;
  readonly semanticHash: ContentHash;
  readonly discoveryHash?: ContentHash;
  readonly canonicalDocumentHash: ContentHash;
}

export type UnhashedCanonicalDocument<TPayload extends Record<string, unknown>> = Omit<
  CanonicalDocumentEnvelope<TPayload>,
  "semanticHash" | "discoveryHash" | "canonicalDocumentHash"
>;

export function withCanonicalHashes<TPayload extends Record<string, unknown>>(
  document: UnhashedCanonicalDocument<TPayload>,
): CanonicalDocumentEnvelope<TPayload> {
  const semanticHash = hashSemantic(document.kind, document.payload);
  const discoveryHash = getHashProfile(document.kind).discovery.length === 0
    ? undefined
    : hashDiscovery(document.kind, document.payload);
  const payload = {
    ...document.payload,
    ...(Object.hasOwn(document.payload, "semanticHash") ? { semanticHash } : {}),
    ...(Object.hasOwn(document.payload, "discoveryHash") && discoveryHash !== undefined ? { discoveryHash } : {}),
  } as TPayload;
  const withoutDocumentHash = {
    ...document,
    payload,
    semanticHash,
    ...(discoveryHash === undefined ? {} : { discoveryHash }),
  };
  return {
    ...withoutDocumentHash,
    canonicalDocumentHash: hashCanonicalDocument(document.kind, withoutDocumentHash),
  };
}

export function verifyCanonicalEnvelope(document: CanonicalDocumentEnvelope): string[] {
  const errors: string[] = [];
  if (document.apiVersion.trim().length === 0 || document.schemaVersion.trim().length === 0) {
    errors.push("canonical envelope versions cannot be blank");
  }
  if (typeof document.payload.id === "string" && document.payload.id !== document.id) {
    errors.push("envelope ID must match payload ID");
  }
  if (typeof document.payload.key === "string" && document.payload.key !== document.key) {
    errors.push("envelope key must match payload key");
  }
  const derivedKey = document.kind === "relation" ? `relation:${document.id}`
    : document.kind === "lineage" ? `lineage:${document.id}`
      : document.kind === "tombstone" && typeof document.payload.entityId === "string" ? `tombstone:${document.payload.entityId}`
        : document.kind === "transaction-receipt" ? `receipt:${document.id}`
          : undefined;
  if (derivedKey !== undefined && document.key !== derivedKey) {
    errors.push(`canonical key must be ${derivedKey}`);
  }
  const payloadLifecycle = typeof document.payload.lifecycle === "string"
    ? document.payload.lifecycle
    : typeof document.payload.status === "string"
      ? document.payload.status
      : document.kind === "relation" && typeof document.payload.active === "boolean"
        ? document.payload.active ? "active" : "inactive"
        : document.kind === "lineage" || document.kind === "rule" ? "active"
          : document.kind === "tombstone" ? "deleted"
            : document.kind === "transaction-receipt" ? "committed"
              : undefined;
  if (payloadLifecycle !== undefined && payloadLifecycle !== document.lifecycle) {
    errors.push("envelope lifecycle must match payload lifecycle");
  }
  const expected = withCanonicalHashes({
    apiVersion: document.apiVersion,
    schemaVersion: document.schemaVersion,
    kind: document.kind,
    id: document.id,
    key: document.key,
    lifecycle: document.lifecycle,
    payload: document.payload,
  });
  if (document.semanticHash !== expected.semanticHash) errors.push("semantic hash mismatch");
  if (document.discoveryHash !== expected.discoveryHash) errors.push("discovery hash mismatch");
  if (document.canonicalDocumentHash !== expected.canonicalDocumentHash) errors.push("canonical document hash mismatch");
  return errors;
}
