import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { applicationEvidenceDependencies, ApplicationEvidenceAssessmentSchema, hashApplicationEvidenceAssessment, type ApplicationEvidenceAssessmentRequest } from "@projector/core";
import { createConfiguredApplicationEvidencePort } from "./application-evidence-host.js";

const hash = `sha256:v1:${"a".repeat(64)}` as const;
const request: ApplicationEvidenceAssessmentRequest = {
  schemaVersion: "application-evidence-assessment-request@1",
  owner: { kind: "requirement", id: "requirement:example", canonicalDocumentHash: hash },
  binding: { kind: "application-observation", adapter: { id: "example", version: "1" }, scenario: { id: "scenario:example", semanticHash: hash }, case: "example", predicateId: "predicate:example", assertionIds: ["example"], observationRole: "latest" },
  evidenceIds: ["artifact:example"],
};
function assessment(status: "satisfied" | "violated" | "stale" | "missing", exact = request) {
  const basis = { schemaVersion: "application-evidence-assessment@1" as const, request: exact,
    custody: status === "missing" ? { status: "unavailable" as const, reason: "Artifact missing" } : { status: "authenticated" as const, receiptHash: hash },
    currentness: status === "stale" ? { status: "stale" as const, observationHash: hash, reason: "Inputs changed" } : { status: "current" as const, observationHash: hash },
    fulfillment: { status: status === "stale" || status === "missing" ? "unknown" as const : status, reason: "Observed result" }, dependencies: [],
  };
  return { ...basis, contentHash: hashApplicationEvidenceAssessment(basis) };
}
async function withServer(handler: (req: IncomingMessage, res: ServerResponse) => void, run: (environment: NodeJS.ProcessEnv) => Promise<void>) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP address");
  try { await run({ PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT: `http://127.0.0.1:${address.port}/assess`, PROJECTOR_APPLICATION_EVIDENCE_HOST_ID: "owned-host", PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD: "build:1" }); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
describe("configured application evidence HTTP host", () => {
  it("requires complete explicit secure host configuration", () => {
    expect(createConfiguredApplicationEvidencePort({ environment: {}, repositoryRoot: "/repo" })).toBeUndefined();
    expect(() => createConfiguredApplicationEvidencePort({ environment: { PROJECTOR_APPLICATION_EVIDENCE_ENDPOINT: "http://example.com" }, repositoryRoot: "/repo" })).toThrow();
  });
  it.each(["satisfied", "violated", "stale", "missing"] as const)("retains %s from a real HTTP assessment", async (status) => {
    await withServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
        expect(body.request).toEqual(request);
        expect(body).not.toHaveProperty("repositoryRoot");
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ protocol: "projector-application-evidence-http@1", host: body.host, assessment: assessment(status) }));
      });
    }, async (environment) => {
      const port = createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo" })!;
      const result = await port.assess(request, { signal: new AbortController().signal });
      expect(result).toMatchObject({ request, fulfillment: assessment(status).fulfillment, currentness: assessment(status).currentness, custody: assessment(status).custody });
      expect(result.dependencies).toEqual([expect.objectContaining({ id: "application-evidence-host:configured-transport" })]);
      expect(ApplicationEvidenceAssessmentSchema.safeParse(result).success).toBe(true);
      if (status === "satisfied") {
        const changed = await createConfiguredApplicationEvidencePort({ environment: { ...environment, PROJECTOR_APPLICATION_EVIDENCE_HOST_BUILD: "build:2" }, repositoryRoot: "/repo" })!.assess(request, { signal: new AbortController().signal });
        expect(changed.contentHash).not.toBe(result.contentHash);
        expect(applicationEvidenceDependencies(changed)[0]?.versionHash).not.toBe(applicationEvidenceDependencies(result)[0]?.versionHash);
      }
    });
  });
  it("rejects different exact request and tampered hashes", async () => {
    for (const value of [assessment("satisfied", { ...request, evidenceIds: ["artifact:other"] }), { ...assessment("satisfied"), contentHash: `sha256:v1:${"b".repeat(64)}` }]) {
      await withServer((_req, res) => res.end(JSON.stringify({ protocol: "projector-application-evidence-http@1", host: { id: "owned-host", build: "build:1" }, assessment: value })), async (environment) => {
        await expect(createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo" })!.assess(request, { signal: new AbortController().signal })).rejects.toThrow();
      });
    }
  });
  it("interrupts a pending real request", async () => {
    const controller = new AbortController();
    await withServer(() => controller.abort(new Error("Interrupted observation")), async (environment) => {
      await expect(createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo", signal: controller.signal })!.assess(request, { signal: new AbortController().signal })).rejects.toThrow("Interrupted observation");
    });
  });
  it("accepts a valid request and exact response beyond the former transport limit", async () => {
    const largeRequest: ApplicationEvidenceAssessmentRequest = { ...request, binding: { ...(request.binding as Record<string, unknown>), case: "x".repeat(1_048_576) } };
    await withServer((incoming, response) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as { request: typeof largeRequest; host: { id: string; build: string } };
        expect((body.request.binding as { case: string }).case).toHaveLength(1_048_576);
        response.end(JSON.stringify({ protocol: "projector-application-evidence-http@1", host: body.host, assessment: assessment("satisfied", largeRequest) }));
      });
    }, async (environment) => {
      const result = await createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo" })!.assess(largeRequest, { signal: new AbortController().signal });
      expect((result.request.binding as { case: string }).case).toHaveLength(1_048_576);
    });
  });
  it("rejects wrong host builds, invalid JSON, and redirects", async () => {
    const handlers: ((req: IncomingMessage, res: ServerResponse) => void)[] = [
      (_req, res) => res.end(JSON.stringify({ protocol: "projector-application-evidence-http@1", host: { id: "owned-host", build: "build:other" }, assessment: assessment("satisfied") })),
      (_req, res) => res.end("not JSON"),
      (_req, res) => { res.writeHead(302, { location: "/other" }); res.end(); },
    ];
    for (const handler of handlers) await withServer(handler, async (environment) => {
      await expect(createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo" })!.assess(request, { signal: new AbortController().signal })).rejects.toThrow();
    });
  });
  it("retries one transient assessment response and stops after the bound", async () => {
    for (const recover of [true, false]) {
      let calls = 0;
      await withServer((_req, res) => {
        calls++;
        if (calls === 1 || !recover) { res.writeHead(503); res.end(); }
        else res.end(JSON.stringify({ protocol: "projector-application-evidence-http@1", host: { id: "owned-host", build: "build:1" }, assessment: assessment("satisfied") }));
      }, async (environment) => {
        const result = createConfiguredApplicationEvidencePort({ environment, repositoryRoot: "/repo" })!.assess(request, { signal: new AbortController().signal });
        if (recover) await expect(result).resolves.toMatchObject({ fulfillment: { status: "satisfied" } });
        else await expect(result).rejects.toThrow("HTTP 503");
        expect(calls).toBe(2);
      });
    }
  });
});
