import {
  createBundledProjectorOperationRunner
} from "../chunks/shared-6367FKMO.js";
import {
  shutdownCodeIndexRuns
} from "../chunks/shared-RQAO52GP.js";
import "../chunks/shared-YZHC7WTJ.js";
import "../chunks/shared-7LB4PVNV.js";
import "../chunks/shared-PMEWHUNO.js";
import "../chunks/shared-D3MXHIAY.js";
import "../chunks/shared-PMEH6UKE.js";
import "../chunks/shared-2B7P2BAO.js";
import "../chunks/shared-PMI2YIJY.js";
import "../chunks/shared-TKNA4UJH.js";
import "../chunks/shared-HUQ6JTJS.js";
import "../chunks/shared-YMMDUUVJ.js";
import "../chunks/shared-VQ4M4TY3.js";
import "../chunks/shared-F7VGIPLU.js";
import "../chunks/shared-SN3OO5CC.js";
import "../chunks/shared-WY2QJ7AR.js";
import {
  ResidentObservationWorkerPool,
  withResidentObservationWorkerPool
} from "../chunks/shared-2INZJVA6.js";
import "../chunks/shared-AHRONKDP.js";
import "../chunks/shared-IVNK7NJ5.js";
import "../chunks/shared-IFEDFPQ4.js";
import "../chunks/shared-EHAKQ7RC.js";
import "../chunks/shared-T66EWDMN.js";
import "../chunks/shared-WYYVWFGB.js";
import "../chunks/shared-3PXVRXWV.js";
import "../chunks/shared-KWLM6SLK.js";
import "../chunks/shared-2U2MJHPJ.js";
import "../chunks/shared-HEBLUKDF.js";
import {
  ProjectorOperationInputSchemas,
  ProjectorOperationSchema,
  createProjectorOperationRequestSchema,
  projectorOperationApiVersion
} from "../chunks/shared-AJ5KBTH5.js";
import "../chunks/shared-WC2OT3WX.js";

// dist/mcp-server.js
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
var readOnlyOperations = /* @__PURE__ */ new Set([
  "status",
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
    server.registerTool(`projector_${operation.replaceAll(/[.-]/gu, "_")}`, {
      title: `Projector ${operation}`,
      description: descriptionFor(operation),
      inputSchema: toolSchema,
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
