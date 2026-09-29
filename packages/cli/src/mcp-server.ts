import { fromJsonSchema, McpServer, type JsonSchemaType } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  ProjectorOperationInputSchemas,
  ProjectorOperationSchema,
  createProjectorOperationRequestSchema,
  projectorOperationApiVersion,
  type ProjectorOperation,
} from "@projector/core";
import { ResidentObservationWorkerPool, shutdownCodeIndexRuns, withResidentObservationWorkerPool } from "@projector/control-plane";
import { z } from "zod";
import { createBundledProjectorOperationRunner } from "./operation-runner.js";

type BundledRunner = Awaited<ReturnType<typeof createBundledProjectorOperationRunner>>;

const readOnlyOperations = new Set<string>([
  "status", "context.inspect", "reconcile", "repository.check", "repository.integration", "coverage", "complete", "cleanup", "verify",
  "representation.inspect", "representation.pending", "architecture.evaluate", "verification.inspect",
  "generated.inspect", "code.query", "code.index-status", "code.index-wait", "code.impact", "code.tests", "code.export",
]);
const buildOperations = new Set<string>(["code.index", "code.test-run", "code.evidence", "verification.execute", "verification.builtin", "generated.execute"]);

function annotationsFor(operation: ProjectorOperation) {
  const readOnly = readOnlyOperations.has(operation);
  const build = buildOperations.has(operation);
  return {
    readOnlyHint: readOnly,
    destructiveHint: !readOnly && !build,
    idempotentHint: readOnly,
    openWorldHint: false,
  };
}

function descriptionFor(operation: ProjectorOperation): string {
  const effect = readOnlyOperations.has(operation) ? "Inspect" : buildOperations.has(operation) ? "Build or verify" : "Run";
  return `${effect} Projector ${operation}. Supply an absolute repositoryRoot. The result includes readiness, operation status, output or an actionable error. Core validates the exact input; caller approval and repository access still govern writes.`;
}

/** The stdio connection owns one runner and pool; each tool call retains its own access scope. */
export function createProjectorMcpServer(input: {
  readonly runner: () => Promise<BundledRunner>;
  readonly pool: ResidentObservationWorkerPool;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): McpServer {
  const server = new McpServer({ name: "projector", version: "3.0.0" });
  let loadedRunner: Promise<BundledRunner> | undefined;
  for (const operation of ProjectorOperationSchema.options) {
    const inputSchema = (ProjectorOperationInputSchemas as Readonly<Record<string, z.ZodObject>>)[operation];
    if (inputSchema === undefined) continue;
    const requestSchema = createProjectorOperationRequestSchema(operation, inputSchema);
    const toolSchema = requestSchema.omit({ apiVersion: true, operation: true });
    // Several Projector contracts reuse substantial nested Zod schemas. Emit
    // local JSON Schema definitions so tool discovery does not repeat them.
    // The handler below still parses the authoritative Core request schema.
    const advertisedSchema = fromJsonSchema<z.input<typeof toolSchema>>(
      z.toJSONSchema(toolSchema, { io: "input", reused: "ref" }) as unknown as JsonSchemaType,
    );
    server.registerTool(`projector_${operation.replaceAll(/[.-]/gu, "_")}`, {
      title: `Projector ${operation}`,
      description: descriptionFor(operation),
      inputSchema: advertisedSchema,
      annotations: annotationsFor(operation),
    }, async (args, context) => {
      const request = requestSchema.parse({ ...args, apiVersion: projectorOperationApiVersion, operation });
      const runner = await (loadedRunner ??= input.runner());
      const result = await withResidentObservationWorkerPool(input.pool, () => runner.execute(request, {
        signal: context.mcpReq.signal,
        environment: input.environment ?? process.env,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        structuredContent: result as unknown as Record<string, unknown>,
        ...(result.status === "succeeded" ? {} : { isError: true }),
      };
    });
  }
  server.server.onclose = () => {
    void shutdownCodeIndexRuns().then(() => input.pool.close()).catch(error => {
      process.stderr.write(`${JSON.stringify({ event: "projector-mcp-close-error", message: error instanceof Error ? error.message : String(error) })}\n`);
    });
  };
  return server;
}

export function serveProjectorMcpStdio(input: { readonly packagedRoot: string; readonly environment?: Readonly<Record<string, string | undefined>> }) {
  const pool = new ResidentObservationWorkerPool();
  // Loading package identity and project services begins only when the first tool runs;
  // protocol initialization and tool discovery stay responsive.
  let runner: Promise<BundledRunner> | undefined;
  const getRunner = () => runner ??= createBundledProjectorOperationRunner({ packagedRoot: input.packagedRoot });
  const handle = serveStdio(() => createProjectorMcpServer({ runner: getRunner, pool, ...(input.environment === undefined ? {} : { environment: input.environment }) }));
  return { close: async () => { await handle.close(); await shutdownCodeIndexRuns(); await pool.close(); } };
}
