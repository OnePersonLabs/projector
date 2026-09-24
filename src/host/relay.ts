import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { call } from './client.ts';
import { MAX_BYTES, VERSION } from './config.ts';

export async function relay(): Promise<McpServer> {
  const server = new McpServer({ name: 'projector', version: VERSION });
  const root = { rootId: z.string() };
  const change = { root: z.string(), change: z.string() };
  const definitions: { name: string; description: string; schema: z.ZodObject; readOnly?: boolean }[] = [
    { name: 'initProject', description: 'Initialize a local Git repository with the bundled Projector schema, preserving existing configuration and reporting conflicts.', schema: z.object({ root: z.string() }) },
    { name: 'openRoot', description: 'Open an exact-revision root or an explicitly allocated managed candidate.', schema: z.object({ root: z.string(), profile: z.enum(['revision', 'managed']).optional(), candidate: z.string().optional() }) },
    { name: 'read', description: 'Query one coherent revision or qualified working-current view. Pending and unavailable responses contain no current payload. Explicit adoption acknowledges the exact proposed binding.', readOnly: true, schema: z.object({ ...root, view: z.enum(['revision', 'current']), revision: z.string().optional(), reference: z.string().optional(), selector: z.record(z.string(), z.unknown()).optional(), fromPath: z.string().min(1).optional(), scope: z.string().min(1).optional(), edge: z.enum(['dependency', 'observation']).optional(), adoptBinding: z.string().min(1).optional(), limit: z.number().int().positive().optional(), cursor: z.string().optional() }) },
    { name: 'inspectStatus', description: 'Inspect observation, pending work and operation counters.', readOnly: true, schema: z.object(root) },
    { name: 'releaseRoot', description: 'Release this root session without terminating the shared owner.', schema: z.object(root) },
    { name: 'beginBatch', description: 'Acknowledge a mutation before a cooperating writer edits the managed candidate.', schema: z.object({ ...root, writer: z.string(), paths: z.array(z.string()), target: z.string().optional(), token: z.record(z.string(), z.unknown()).optional() }) },
    { name: 'completeBatch', description: 'Settle actual known writes, or mark an unknown shell write interval for independent checkpoint validation.', schema: z.object({ ...root, batchId: z.string(), actualPaths: z.array(z.string()).optional(), unknownWrites: z.boolean().optional() }) },
    { name: 'checkpoint', description: 'Independently inventory and seal the candidate after a mutation interval.', schema: z.object({ ...root, writer: z.string().optional() }) },
    { name: 'invalidateObservation', description: 'Report an unobserved writer or interrupted interval; currentness becomes unavailable.', schema: z.object({ ...root, reason: z.string() }) },
    { name: 'prepareChange', description: 'Prepare an isolated candidate and exact nested requirements/design target.', schema: z.looseObject({ ...change, baseline: z.string().optional() }) },
    { name: 'validatePlan', description: 'Validate applicability, contributions and review against the actual target basis.', schema: z.looseObject({ ...change, applicability: z.array(z.unknown()).optional(), contributions: z.array(z.unknown()).optional(), review: z.record(z.string(), z.unknown()).optional() }) },
    { name: 'recordEvidence', description: 'Run a bounded check in the candidate and bind real results to its actual basis.', schema: z.object({ ...change, command: z.string(), args: z.array(z.string()), scope: z.array(z.string()), timeoutMs: z.number().int().positive().optional() }) },
    { name: 'applyChange', description: 'Apply the reviewed deterministic change operations to the isolated candidate.', schema: z.looseObject(change) },
    { name: 'reviseChange', description: 'Rebase planning obligations on revised target inputs while preserving valid contributions.', schema: z.looseObject(change) },
    { name: 'syncChange', description: 'Materialize the exact target in the isolated candidate without archive or publication.', schema: z.object(change) },
    { name: 'finishChange', description: 'Require current completion evidence, materialize and archive the exact target, and publish only the candidate branch.', schema: z.looseObject(change) },
    { name: 'resumeChange', description: 'Recover the active candidate or remaining archive bookkeeping.', schema: z.object(change) },
  ];
  for (const definition of definitions) {
    server.registerTool(definition.name, {
      description: definition.description, inputSchema: definition.schema,
      annotations: { readOnlyHint: definition.readOnly ?? false, openWorldHint: false },
    }, async (input: Record<string, unknown>) => {
      const result = await call({ ...input, op: definition.name });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    });
  }
  // Closing this stdio connection never shuts down the shared owner.
  await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_BYTES }));
  return server;
}
