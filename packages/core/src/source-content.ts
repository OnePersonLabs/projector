import type { ContentHash } from "./domain/contracts.js";

/** A capture is an immutable, sealed set of source-version references. */
export interface SourceContentCaptureDescriptor {
  readonly schemaVersion: "projector.source-content/v2";
  readonly path: string;
  readonly captureId: string;
  readonly paths?: readonly string[];
}

/** Source metadata is separate from the raw bytes retained by a capture. */
export interface SourceContentEntry {
  readonly path: string;
  readonly kind: "file" | "symlink";
  readonly mediaType: string;
  readonly content: string;
  readonly contentHash: ContentHash;
  readonly generated: boolean;
  readonly generatedReason?: "source-marker";
  readonly symlinkTarget?: string;
}
