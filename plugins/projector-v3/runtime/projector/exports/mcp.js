import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-DF226XHO.js";
import {
  shutdownCodeIndexRuns
} from "../chunks/shared-KP2KQVTQ.js";
import "../chunks/shared-QC25VWUM.js";
import "../chunks/shared-VSPYHD5H.js";
import "../chunks/shared-IBVT2KG2.js";
import "../chunks/shared-CPHR3K42.js";
import "../chunks/shared-4VMBTM7P.js";
import "../chunks/shared-DGXUSCZI.js";
import "../chunks/shared-ZHCNFIWV.js";
import "../chunks/shared-ZG4NJD52.js";
import "../chunks/shared-EMQJ4CG6.js";
import "../chunks/shared-4GV3JCWN.js";
import "../chunks/shared-WPJ24CHV.js";
import "../chunks/shared-SRZY32OS.js";
import "../chunks/shared-BEDSHOK5.js";
import "../chunks/shared-JM234DST.js";
import {
  ResidentObservationWorkerPool,
  withResidentObservationWorkerPool
} from "../chunks/shared-AIE6IGAJ.js";
import "../chunks/shared-I4PDDX5T.js";
import "../chunks/shared-YP2F3RSX.js";
import "../chunks/shared-3OPGBX4O.js";
import "../chunks/shared-QSFRBEBN.js";
import "../chunks/shared-BGCYVYNK.js";
import "../chunks/shared-XN3IZTFL.js";
import "../chunks/shared-EK2KJXX2.js";
import "../chunks/shared-53BCDAHA.js";
import "../chunks/shared-JRUJSZFM.js";
import "../chunks/shared-RMBXVF7C.js";
import {
  ProjectorOperationInputSchemas,
  ProjectorOperationSchema,
  createProjectorOperationRequestSchema,
  projectorOperationApiVersion
} from "../chunks/shared-Q56AARV7.js";
import "../chunks/shared-WC2OT3WX.js";

// dist/mcp-server.js
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
var readOnlyOperations = /* @__PURE__ */ new Set([
  "status",
  "context.inspect",
  "reconcile",
  "repository.check",
  "repository.integration",
  "coverage",
  "complete",
  "cleanup",
  "verify",
  "representation.inspect",
  "representation.pending",
  "architecture.evaluate",
  "verification.inspect",
  "generated.inspect",
  "code.query",
  "code.index-status",
  "code.index-wait",
  "code.impact",
  "code.tests",
  "code.export"
]);
var buildOperations = /* @__PURE__ */ new Set(["code.index", "code.test-run", "code.evidence", "verification.execute", "verification.builtin", "generated.execute"]);
function annotationsFor(operation) {
  const readOnly = readOnlyOperations.has(operation);
  const build = buildOperations.has(operation);
  return {
    readOnlyHint: readOnly,
    destructiveHint: !readOnly && !build,
    idempotentHint: readOnly,
    openWorldHint: false
  };
}
function descriptionFor(operation) {
  const effect = readOnlyOperations.has(operation) ? "Inspect" : buildOperations.has(operation) ? "Build or verify" : "Run";
  return `${effect} Projector ${operation}. Supply an absolute repositoryRoot. The result includes readiness, operation status, output or an actionable error. Core validates the exact input; caller approval and repository access still govern writes.`;
}
function createProjectorMcpServer(input) {
  const server = new McpServer({ name: "projector", version: "3.0.0" });
  let loadedRunner;
  for (const operation of ProjectorOperationSchema.options) {
    const inputSchema = ProjectorOperationInputSchemas[operation];
    if (inputSchema === void 0)
      continue;
    const requestSchema = createProjectorOperationRequestSchema(operation, inputSchema);
    const toolSchema = requestSchema.omit({ apiVersion: true, operation: true });
    const advertisedSchema = fromJsonSchema(z.toJSONSchema(toolSchema, { io: "input", reused: "ref" }));
    server.registerTool(`projector_${operation.replaceAll(/[.-]/gu, "_")}`, {
      title: `Projector ${operation}`,
      description: descriptionFor(operation),
      inputSchema: advertisedSchema,
      annotations: annotationsFor(operation)
    }, async (args, context) => {
      const request = requestSchema.parse({ ...args, apiVersion: projectorOperationApiVersion, operation });
      const runner = await (loadedRunner ??= input.runner());
      const result = await withResidentObservationWorkerPool(input.pool, () => runner.execute(request, {
        signal: context.mcpReq.signal,
        environment: input.environment ?? process.env
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        ...result.status === "succeeded" ? {} : { isError: true }
      };
    });
  }
  server.server.onclose = () => {
    void shutdownCodeIndexRuns().then(() => input.pool.close()).catch((error) => {
      process.stderr.write(`${JSON.stringify({ event: "projector-mcp-close-error", message: error instanceof Error ? error.message : String(error) })}
`);
    });
  };
  return server;
}
function serveProjectorMcpStdio(input) {
  const pool = new ResidentObservationWorkerPool();
  let runner;
  const getRunner = () => runner ??= createBundledProjectorOperationRunner({ packagedRoot: input.packagedRoot });
  const handle = serveStdio(() => createProjectorMcpServer({ runner: getRunner, pool, ...input.environment === void 0 ? {} : { environment: input.environment } }));
  return { close: async () => {
    await handle.close();
    await shutdownCodeIndexRuns();
    await pool.close();
  } };
}
export {
  createProjectorMcpServer,
  serveProjectorMcpStdio
};
