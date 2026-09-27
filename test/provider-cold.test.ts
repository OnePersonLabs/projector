import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('simultaneous factory creation shares one cold WASM initialization and grammar load', () => {
  const module = new URL('../src/documents/index.ts', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import {createDocumentIntelligence} from ${JSON.stringify(module)};
    const services = await Promise.all(Array.from({length: 8}, () => createDocumentIntelligence()));
    const records = await Promise.all(services.map(service => service.extract('worker.py', 'def work():\\n return 1')));
    if (!records.every(record => record.units.some(unit => unit.name === 'work'))) throw new Error('Cold concurrent extraction lost declarations.');
    console.log('ready');
  `], { encoding: 'utf8', timeout: 30000 });
  assert.equal(output.trim(), 'ready');
});
