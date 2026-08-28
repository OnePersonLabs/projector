/** Current canonical-envelope contract accepted and emitted by Projector. */
export const CANONICAL_API_VERSION = "projector/v2" as const;
export const CANONICAL_SCHEMA_VERSION = "2.0.0" as const;

export const CANONICAL_ENVELOPE_VERSION = Object.freeze({
  apiVersion: CANONICAL_API_VERSION,
  schemaVersion: CANONICAL_SCHEMA_VERSION,
});
