import { createServer, type Server, type ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { realpath } from 'node:fs/promises';
import { initProject } from './project.ts';
import { MAX_BYTES, PROTOCOL, VERSION, ownerCredential, claimConfiguredEndpoint, settings, type HostSettings } from './config.ts';

export type Request = Record<string, unknown> & { op: string };
export interface Dispatcher { handle(request: Request): Promise<unknown>; close(): Promise<void> }
const changeOperations = new Set(['prepareChange', 'validatePlan', 'recordEvidence', 'finishChange', 'resumeChange', 'reviseChange', 'applyChange', 'syncChange']);
export const operations = new Set(['initProject', 'openRoot', 'read', 'inspectStatus', 'releaseRoot', 'beginBatch', 'completeBatch', 'checkpoint', 'invalidateObservation', ...changeOperations]);
export async function productDispatcher(config: HostSettings): Promise<Dispatcher> {
  const { Kernel } = await import('../kernel/index.ts');
  const { ChangeService } = await import('../change/index.ts');
  const kernel = new Kernel({ stateDir: config.home });
  const mutationLeases = new AsyncLocalStorage<Map<string, () => Promise<void>>>();
  const changes = new ChangeService({ beforeCandidateMutation: async (root, operation) => {
    const leases = mutationLeases.getStore();
    if (!leases) throw new Error('Lifecycle mutation requires an owning host request.');
    if (!leases.has(root)) leases.set(root, await kernel.acquireMutationExclusion(root, `Lifecycle operation ${operation} may mutate the candidate; independent checkpoint required`));
  } });
  return {
    async handle(request) {
      if (request.op === 'initProject') {
        if (typeof request.root !== 'string' || !request.root.trim()) throw new Error('root must be a nonempty string');
        const root = await realpath(request.root);
        const release = await kernel.acquireMutationExclusion(root, 'Repository setup requires an independent checkpoint');
        try { return await initProject({ root }); }
        finally { await release(); }
      }
      if (changeOperations.has(request.op)) {
        const method = changes[request.op as keyof typeof changes];
        if (typeof method !== 'function') throw new Error(`Unsupported change operation: ${request.op}`);
        return mutationLeases.run(new Map(), async () => {
          try { return await method.call(changes, request); }
          finally { for (const release of mutationLeases.getStore()!.values()) await release(); }
        });
      }
      return kernel.handle(request);
    },
    async close() { await kernel.close(); },
  };
}
export interface Owner { server: Server; ownerId: string; close(): Promise<void> }
export async function startOwner(options: Partial<HostSettings> = {}, factory: (config: HostSettings) => Dispatcher | Promise<Dispatcher> = productDispatcher): Promise<Owner> {
  const config = settings(options);
  if (process.version !== 'v24.19.0') throw new Error(`This Projector build requires its qualified Node 24.19.0 runtime; found ${process.version}.`);
  const ownerId = randomUUID();
  let token = '', dispatcher: Dispatcher | undefined, closing = false, active = 0;
  const respond = (response: ServerResponse, status: number, result: unknown) => {
    const encoded = JSON.stringify(result);
    if (Buffer.byteLength(encoded) > MAX_BYTES) { response.writeHead(413).end(JSON.stringify({ error: 'Response exceeds the result budget; narrow or page the query.' })); return; }
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(encoded);
  };
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: config.timeoutMs, headersTimeout: Math.min(10000, config.timeoutMs) }, async (request, response) => {
    if (request.headers.origin !== undefined) { respond(response, 403, { error: 'Browser origins are forbidden.' }); return; }
    if (request.method !== 'POST' || request.url !== '/' || request.headers.host !== `127.0.0.1:${config.port}`) { respond(response, 400, { error: 'Use the configured loopback endpoint.' }); return; }
    if (!dispatcher || closing) { respond(response, 503, { error: 'Owner is initializing or closing.' }); return; }
    const supplied = Buffer.from(request.headers.authorization?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { respond(response, 401, { error: 'Projector credential required.' }); return; }
    if (request.headers['content-type'] !== 'application/json') { respond(response, 415, { error: 'JSON required.' }); return; }
    if (Number(request.headers['content-length'] ?? 0) > MAX_BYTES) { respond(response, 413, { error: 'Request exceeds the payload budget.' }); return; }
    if (active >= 64) { respond(response, 429, { error: 'Owner request budget exceeded; retry after active operations settle.' }); return; }
    active++;
    const deadline = setTimeout(() => response.destroy(new Error('Owner request deadline exceeded.')), config.timeoutMs);
    deadline.unref();
    try {
      const parts: Buffer[] = []; let size = 0;
      for await (const part of request) {
        const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part as string); size += buffer.length;
        if (size > MAX_BYTES) { respond(response, 413, { error: 'Request exceeds the payload budget.' }); return; }
        parts.push(buffer);
      }
      const body: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body)) { respond(response, 400, { error: 'Expected an operation object.' }); return; }
      const input = body as Request;
      if (input.op === 'hello') {
        if (input.protocol !== PROTOCOL || input.version !== VERSION) { respond(response, 409, { error: 'Incompatible Projector protocol/version; stop the existing owner before upgrading.' }); return; }
        respond(response, 200, { product: 'projector', protocol: PROTOCOL, version: VERSION, ownerId, pid: process.pid, runtime: process.version, platform: process.platform, architecture: process.arch }); return;
      }
      if (input.op === 'shutdown') {
        if (active > 1) { respond(response, 409, { error: 'Active operations must settle before shutting down the owner.' }); return; }
        respond(response, 200, { stopping: true, ownerId }); setImmediate(() => { void close().catch(error => { process.stderr.write(`${JSON.stringify({ level: 'error', event: 'owner-close', message: String(error) })}\n`); }); }); return;
      }
      if (!operations.has(input.op)) { respond(response, 400, { error: `Unknown operation: ${String(input.op)}` }); return; }
      respond(response, 200, await dispatcher.handle(input));
    } catch (error) {
      if (!response.headersSent) respond(response, error instanceof SyntaxError ? 400 : 422, { error: error instanceof Error ? error.message : String(error) });
    } finally { clearTimeout(deadline); active--; }
  });
  const close = async () => {
    if (closing) return; closing = true;
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); });
    await dispatcher?.close();
  };
  server.maxConnections = 128;
  server.maxRequestsPerSocket = 128;
  server.keepAliveTimeout = 5000;
  // The OS-held bind is won before credentials, Kernel, SQLite or root state starts.
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port: config.port, exclusive: true }, () => { server.removeListener('error', reject); resolve(); }); });
  try { token = await ownerCredential(config); await claimConfiguredEndpoint(config); dispatcher = await factory(config); }
  catch (error) { await close(); throw error; }
  return { server, ownerId, close };
}
