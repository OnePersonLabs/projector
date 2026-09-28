import { assessApplicationEvidence, applicationEvidenceDependencies, ApplicationEvidenceAssessmentRequestSchema, hashApplicationEvidenceAssessment, hashFramedDomain, type ApplicationEvidenceAssessment, type ApplicationEvidencePort } from "@projector/core";
import { z } from "zod";

const protocol = "projector-application-evidence-http@1";
const identity = z.string().min(1).max(512).regex(/^[^\0\r\n]+$/u);
const responseSchema = z.strictObject({ protocol: z.literal(protocol), host: z.strictObject({ id: identity, build: identity }), assessment: z.unknown() });

/** Explicit host configuration is a trust decision; repository files cannot configure this port. */
export function createConfiguredApplicationEvidencePort(input: { readonly environment?: NodeJS.ProcessEnv; readonly signal?: AbortSignal; readonly repositoryRoot: string }): ApplicationEvidencePort | undefined {
  const environment = input.environment ?? process.env;
  const endpoint = environment.PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT;
  const id = environment.PROJECTOR_APPLICATION_EVIDENCE_HOST_ID;
  const build = environment.PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD;
  if (endpoint === undefined && id === undefined && build === undefined) return undefined;
  if (!endpoint || !id || !build) throw new Error("Application evidence requires endpoint, host ID, and host build configuration");
  const host = z.strictObject({ id: identity, build: identity }).parse({ id, build });
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("Application evidence endpoint must be an absolute HTTPS or loopback HTTP URL"); }
  if (url.username || url.password || url.hash || url.search || !(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Application evidence endpoint requires HTTPS or numeric loopback HTTP, without credentials, query, or fragment");
  }
  return {
    async assess(request, context) {
      const exact = ApplicationEvidenceAssessmentRequestSchema.parse(request);
      const signal = AbortSignal.any([context.signal, ...(input.signal === undefined ? [] : [input.signal])]);
      signal.throwIfAborted();
      const body = JSON.stringify({ protocol, host, request: exact });
      const assessment = await assessApplicationEvidence({ async assess() {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const response = await fetch(url, { method: "POST", redirect: "error", headers: { "content-type": "application/json", accept: "application/json" }, body, signal });
          if ([502, 503, 504].includes(response.status) && attempt === 1) {
            await response.body?.cancel();
            console.warn(JSON.stringify({ event: "application_evidence_assessment_retry", status: response.status, attempt }));
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`Application evidence host returned HTTP ${response.status}`);
          }
          const reader = response.body?.getReader();
          if (reader === undefined) throw new Error("Application evidence host returned no response body");
          const chunks: Uint8Array[] = [];
          try {
            for (;;) {
              const item = await reader.read();
              if (item.done) break;
              chunks.push(item.value);
            }
          } catch (error) {
            try { await reader.cancel(); }
            catch { console.warn(JSON.stringify({ event: "application_evidence_response_cleanup_failed" })); }
            throw error;
          }
          finally { reader.releaseLock(); }
          let decoded: unknown;
          try { decoded = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
          catch { throw new Error("Application evidence host returned invalid JSON"); }
          const envelope = responseSchema.parse(decoded);
          if (envelope.host.id !== host.id || envelope.host.build !== host.build) throw new Error("Application evidence host identity or build does not match configuration");
          // Core performs strict assessment parsing, exact hashing, and request binding.
          return envelope.assessment as ApplicationEvidenceAssessment;
        }
        throw new Error("Application evidence host assessment retry exhausted");
      } }, exact, { signal });
      const dependencyId = "application-evidence-host:configured-transport";
      const dependencies = applicationEvidenceDependencies(assessment);
      if (dependencies.length >= 256 || dependencies.some((item) => item.id === dependencyId)) {
        throw new Error("Application evidence host must reserve one dependency slot for configured transport identity");
      }
      const { contentHash: _contentHash, ...basis } = assessment;
      const bound = { ...basis, dependencies: [...dependencies, { kind: "artifact" as const, id: dependencyId, versionHash: hashFramedDomain("application-evidence-http-host/v1", { endpoint: url.href, host }), role: "Explicit host endpoint, identity, and build configuration" }] };
      return { ...bound, contentHash: hashApplicationEvidenceAssessment(bound) };
    },
  };
}
