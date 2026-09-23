import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MAX_BYTES, PROTOCOL, VERSION, readCredential, settings, type HostSettings } from './config.ts';

export class EndpointError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number, options?: ErrorOptions) { super(message, options); this.status = status; }
}
export async function send(config: HostSettings, body: Record<string, unknown>, token: string | undefined): Promise<unknown> {
  const data = JSON.stringify(body);
  if (Buffer.byteLength(data) > MAX_BYTES) throw new EndpointError('Request exceeds the payload budget.');
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port: config.port, method: 'POST', path: '/', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BYTES) { response.destroy(new EndpointError('Endpoint exceeded the response budget.')); return; } chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
          if (response.statusCode !== 200) { reject(new EndpointError(`Projector endpoint refused the request (${response.statusCode}): ${String(value.error ?? 'unknown endpoint')}`, response.statusCode)); return; }
          resolve(value);
        } catch (error) { reject(new EndpointError('Configured endpoint is not a compatible Projector owner.', response.statusCode, { cause: error })); }
      });
    });
    const timer = setTimeout(() => request.destroy(new EndpointError('Projector request deadline exceeded; inspect status before repeating a mutation.')), config.timeoutMs);
    timer.unref(); request.on('close', () => clearTimeout(timer)); request.on('error', reject); request.end(data);
  });
}
async function handshake(config: HostSettings): Promise<Record<string, unknown>> {
  const result = await send(config, { op: 'hello', protocol: PROTOCOL, version: VERSION }, await readCredential(config)) as Record<string, unknown>;
  if (result.product !== 'projector' || result.protocol !== PROTOCOL || result.version !== VERSION || typeof result.ownerId !== 'string') throw new EndpointError('Configured endpoint belongs to a foreign or incompatible process.');
  return result;
}
function refused(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'; }
async function launch(config: HostSettings): Promise<void> {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli.replace(/\.ts$/, import.meta.url.endsWith('.ts') ? '.ts' : '.js'), 'serve'], {
      env: { ...process.env, PROJECTOR_HOME: config.home, PROJECTOR_PORT: String(config.port) }, detached: true, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let settled = false;
    const timeout = setTimeout(() => { child.kill(); finish(new EndpointError('Projector owner startup timed out.')); }, config.startupMs);
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timeout); if (child.connected) child.disconnect(); child.unref(); if (error) reject(error); else resolve(); };
    child.once('error', finish);
    child.once('message', value => {
      const message = value as { ready?: boolean; occupied?: boolean; error?: string };
      if (message.ready || message.occupied) finish(); else finish(new EndpointError(message.error ?? 'Owner failed to start.'));
    });
    child.once('exit', (code) => { if (!settled) finish(new EndpointError(`Projector owner exited during startup (${code}).`)); });
  });
}
export async function connectOwner(overrides: Partial<HostSettings> = {}): Promise<{ config: HostSettings; identity: Record<string, unknown> }> {
  const config = settings(overrides);
  try { return { config, identity: await handshake(config) }; }
  catch (error) { if (!refused(error) && !(error instanceof EndpointError && error.status === 503)) throw error; }
  await launch(config);
  const started = Date.now();
  while (true) {
    try { return { config, identity: await handshake(config) }; }
    catch (error) {
      if (Date.now() - started > config.startupMs || (!refused(error) && !(error instanceof EndpointError && error.status === 503))) throw error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}
export async function call(request: Record<string, unknown>, overrides: Partial<HostSettings> = {}): Promise<unknown> {
  const { config } = await connectOwner(overrides);
  return send(config, request, await readCredential(config));
}
