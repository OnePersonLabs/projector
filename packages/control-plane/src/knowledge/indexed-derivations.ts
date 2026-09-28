import { canonicalJson } from "@projector/core";

export const reverseDerivationManifestKey = (subject: string, prefix: string): string => canonicalJson([subject, prefix]);
