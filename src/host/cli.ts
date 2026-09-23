#!/usr/bin/env node
import { call } from './client.ts';
import { startOwner } from './server.ts';
import { relay } from './relay.ts';
import { install } from './install.ts';
import { VERSION } from './config.ts';

async function main(): Promise<void> {
  const [operation, ...args] = process.argv.slice(2);
  if (operation === '--version') { process.stdout.write(`projector ${VERSION}\n`); return; }
  if (operation === 'serve') {
    try {
      const owner = await startOwner();
      process.send?.({ ready: true, ownerId: owner.ownerId });
      const stop = () => { void owner.close().catch(error => { process.stderr.write(`${JSON.stringify({ level: 'error', event: 'owner-close', message: String(error) })}\n`); process.exitCode = 1; }); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        if (process.send) { process.send({ occupied: true }); return; }
        throw new Error('The configured Projector endpoint is occupied; use a client command to authenticate with its owner or inspect the conflicting process.');
      }
      process.send?.({ error: error instanceof Error ? error.message : String(error) }); throw error;
    }
    return;
  }
  if (operation === 'relay') { await relay(); return; }
  if (operation === 'install') { if (!args[0]) throw new Error('Usage: projector install <fresh-plugin-directory>'); process.stdout.write(`${JSON.stringify(await install(args[0]))}\n`); return; }
  if (!operation || operation === '--help') { process.stdout.write('projector <operation> --json <request-object>\nprojector relay | serve | install <fresh-plugin-directory> | --version\n'); return; }
  const index = args.indexOf('--json');
  const input: unknown = index < 0 ? {} : JSON.parse(args[index + 1] ?? '');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('--json must be an object.');
  process.stdout.write(`${JSON.stringify(await call({ ...input, op: operation }))}\n`);
}
await main().catch(error => { process.stderr.write(`${JSON.stringify({ level: 'error', event: 'projector-command', message: error instanceof Error ? error.message : String(error) })}\n`); process.exitCode = 1; });
