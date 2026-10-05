#!/usr/bin/env node
import path from 'node:path';
import { focus, revisit, reconcile, writeCheckpoint, resume, closeCheckpoint, repair } from './projector.mjs';
import { observe } from './providers/index.mjs';
import { readJson } from './state.mjs';
import { checkpointContext } from './work.mjs';
import { activate, deactivate, activationStatus, projectRoot, activeRoot, inactive } from './activation.mjs';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    console.log('OPL Projector (V5)\nCommands: activate, deactivate, status, focus, revisit, reconcile, observe, checkpoint, resume, close, repair\nUsage: opl-projector COMMAND [--root PATH] [--request REQUEST.json]\nProjector runs only in activated projects. The agent handles ordinary requests through the installed skills.');
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--root', '--request'].includes(args[index]) || !args[index + 1]) throw new Error(`Unknown or incomplete option: ${args[index]}`);
    options[args[index].slice(2)] = args[index + 1];
  }
  const root = options.root ? path.resolve(options.root) : await projectRoot(process.cwd());
  const operations = { activate, deactivate, status: activationStatus, focus, revisit, reconcile, observe, checkpoint: writeCheckpoint, resume: (root, request) => resume(root, request.id), close: (root, request) => closeCheckpoint(root, request.id), repair };
  if (!operations[command]) throw new Error(`Unknown command: ${command}`);
  if (!['activate', 'deactivate', 'status'].includes(command) && !await activeRoot(root)) {
    console.log(JSON.stringify(inactive(root), null, 2));
    return;
  }
  const request = options.request ? await readJson(path.resolve(options.request)) : {};
  // Output selection is a transport option, not saved task state.
  const { includeWorkDetails, ...checkpointRequest } = request;
  const result = await operations[command](root, command === 'checkpoint' ? checkpointRequest : request);
  const output = ['checkpoint', 'resume'].includes(command) && result.status !== 'inactive' && includeWorkDetails !== true
    ? checkpointContext(result) : result;
  console.log(JSON.stringify(output, null, 2));
  if (result.status === 'mismatch') process.exitCode = 1;
  else if (['unresolved', 'stopped', 'unavailable', 'interrupted'].includes(result.status)) process.exitCode = 2;
}
main().catch(error => { console.error(`🚨 ERRROR: ${error.message}`); process.exitCode = 2; });
