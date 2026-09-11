import { z } from "zod";

import { hashFramedDomain } from "../hashing/canonical-json.js";
import { ContentHashSchema } from "./contracts.js";
import { RepresentationProjectionSchema } from "./generated-contracts.js";
import type { ContentHash, RepresentationProjection } from "../domain/contracts.js";

export const durableRepresentationArtifactApiVersion = "projector.representation-artifact/v1" as const;

export const DurableRepresentationArtifactRecordBodySchema = z.strictObject({
  apiVersion: z.literal(durableRepresentationArtifactApiVersion),
  projection: RepresentationProjectionSchema,
});

export type DurableRepresentationArtifactRecordBody = {
  readonly apiVersion: typeof durableRepresentationArtifactApiVersion;
  readonly projection: RepresentationProjection;
};

export function hashDurableRepresentationArtifactRecord(
  input: DurableRepresentationArtifactRecordBody,
): ContentHash {
  return hashFramedDomain("durable-representation-artifact", DurableRepresentationArtifactRecordBodySchema.parse(input));
}

export const DurableRepresentationArtifactRecordSchema = z.strictObject({
  apiVersion: z.literal(durableRepresentationArtifactApiVersion),
  projection: RepresentationProjectionSchema,
  recordHash: ContentHashSchema,
}).superRefine(({ recordHash, ...body }, context) => {
  if (recordHash !== hashDurableRepresentationArtifactRecord(body as DurableRepresentationArtifactRecordBody)) {
    context.addIssue({ code: "custom", path: ["recordHash"], message: "representation artifact record hash is invalid" });
  }
});

export interface DurableRepresentationArtifactRecord extends DurableRepresentationArtifactRecordBody {
  readonly recordHash: ContentHash;
}

export function createDurableRepresentationArtifactRecord(
  projection: RepresentationProjection,
): DurableRepresentationArtifactRecord {
  const body = DurableRepresentationArtifactRecordBodySchema.parse({
    apiVersion: durableRepresentationArtifactApiVersion,
    projection,
  }) as DurableRepresentationArtifactRecordBody;
  return DurableRepresentationArtifactRecordSchema.parse({
    ...body,
    recordHash: hashDurableRepresentationArtifactRecord(body),
  }) as DurableRepresentationArtifactRecord;
}
