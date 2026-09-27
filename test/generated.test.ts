import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fixture } from './helpers.ts';
import { createDocumentIntelligence, metadataFile } from '../src/documents/index.ts';
import { workingBytes } from '../src/index/index.ts';
import type { FileRecord } from '../src/documents/index.ts';
import { captureGenerationInputs, collectGenerated, finishGenerationReceipts, validateGenerated } from '../src/change/generated.ts';

const execute = promisify(execFile);
const owner = 'design:styles/theme#decision:generate';
const designPath = 'openspec/designs/styles/theme/design.md';
const declaration = { output: 'theme.css', producer: 'code:generate.mjs', inputs: ['code:theme.json'], retention: 'tracked' };
const design = (generated: unknown[]) => `---\nprojectorDesign: 1\nid: styles/theme\nscope: .\n---\n# Theme\n\n## Contract\nOwn theme generation.\n\n## Decision: generate\n**Choice:** Generate stylesheet.\n**Reason:** The theme owns colors.\n**Realizes:** [[code:theme.css]]\n${generated.map(item => '**Generated:** ' + JSON.stringify(item)).join('\n')}\n`;
const producer = "import{readFile,writeFile}from'node:fs/promises';const config=JSON.parse(await readFile('theme.json','utf8'));await writeFile('theme.css',process.argv.includes('--large')?Buffer.alloc(2*1024*1024,255):'.theme { color: '+config.color+'; }');\n";
const support = [{ path: 'theme.css', decision: owner, target: 'code:theme.css' }];
async function setup() { return fixture({ [designPath]: design([declaration]), 'generate.mjs': producer, 'theme.json': '{"color":"red"}', 'theme.css': '.theme { color: red; }' }); }
async function records(root: string): Promise<Map<string, FileRecord>> {
  const host = await createDocumentIntelligence(); const result = new Map<string, FileRecord>();
  for (const file of [designPath, 'generate.mjs', 'theme.json', 'theme.css']) {
    try { const bytes = await workingBytes(path.join(root, file)); result.set(file, bytes.content ? await host.extract(file, bytes.content) : metadataFile(file, bytes.hash, bytes.size)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return result;
}

test('real stylesheet generation records stable inputs and input changes invalidate its receipt', async () => {
  const f = await setup();
  try {
    const before = await records(f.root);
    await writeFile(path.join(f.root, 'theme.json'), '{"color":"blue"}');
    const current = await records(f.root); const captured = await captureGenerationInputs(f.root, current, ['theme.css']);
    await execute(process.execPath, ['generate.mjs'], { cwd: f.root, windowsHide: true });
    const after = await records(f.root);
    const receipts = await finishGenerationReceipts(f.root, captured, { command: process.execPath, args: ['generate.mjs'], runtime: process.version, exitCode: 0 }, after, support);
    assert.equal(receipts.length, 1); assert.equal(await readFile(path.join(f.root, 'theme.css'), 'utf8'), '.theme { color: blue; }');
    assert.deepEqual(validateGenerated({ records: after, previousRecords: before, changedPaths: ['theme.json', 'theme.css'], support, receipts }), []);
    await writeFile(path.join(f.root, 'theme.json'), '{"color":"green"}');
    const changed = await records(f.root);
    assert.ok(validateGenerated({ records: changed, previousRecords: before, changedPaths: ['theme.json'], support, receipts }).some(item => item.includes('regeneration receipt')));
    assert.deepEqual(await finishGenerationReceipts(f.root, captured, { command: process.execPath, args: ['generate.mjs'], runtime: process.version, exitCode: 0 }, changed, support), []);
    assert.deepEqual(await finishGenerationReceipts(f.root, captured, { command: process.execPath, args: ['generate.mjs'], runtime: process.version, exitCode: 1 }, changed, support), []);
  } finally { await f.cleanup(); }
});

test('retired producers and declarations cannot leave tracked generated output unsupported', async () => {
  const f = await setup();
  try {
    const before = await records(f.root); await unlink(path.join(f.root, 'generate.mjs'));
    assert.ok(validateGenerated({ records: await records(f.root), previousRecords: before, changedPaths: ['generate.mjs'], support, receipts: [] }).some(item => item.includes('missing or unresolved')));
    await writeFile(path.join(f.root, designPath), design([]));
    assert.ok(validateGenerated({ records: await records(f.root), previousRecords: before, changedPaths: [designPath, 'generate.mjs'], support: [], receipts: [] }).some(item => item.includes('Retired generated output')));
    await unlink(path.join(f.root, 'theme.css'));
    assert.deepEqual(validateGenerated({ records: await records(f.root), previousRecords: before, changedPaths: [designPath, 'generate.mjs', 'theme.css'], support: [], receipts: [] }), []);
  } finally { await f.cleanup(); }
});

test('ambiguous and missing provenance are explicit while ignored disposable output is not authored', async () => {
  const f = await setup();
  try {
    await writeFile(path.join(f.root, designPath), design([declaration, declaration]));
    const ambiguous = await records(f.root);
    assert.ok(collectGenerated(ambiguous).obligations.some(item => item.includes('ambiguous provenance')));
    await assert.rejects(captureGenerationInputs(f.root, ambiguous, ['theme.css']), /unambiguous provenance/);
    await writeFile(path.join(f.root, designPath), design([]));
    assert.ok(validateGenerated({ records: await records(f.root), changedPaths: ['theme.css'], support, receipts: [], knownGeneratedOutputs: ['theme.css'] }).some(item => item.includes('no declared provenance')));
    await writeFile(path.join(f.root, designPath), design([{ ...declaration, retention: 'disposable' }]));
    const disposable = await records(f.root); disposable.delete('theme.css');
    assert.deepEqual(validateGenerated({ records: disposable, changedPaths: ['theme.json'], support: [], receipts: [], authoredPaths: new Set(disposable.keys()) }), []);
    await writeFile(path.join(f.root, designPath), design([{ ...declaration, output: '../outside.css' }]));
    assert.ok(collectGenerated(await records(f.root)).obligations.some(item => item.includes('Invalid repository-relative path')));
    assert.deepEqual(validateGenerated({ records: await records(f.root), changedPaths: ['unrelated.ts'], support: [], receipts: [] }), []);
  } finally { await f.cleanup(); }
});

test('large generated outputs use raw byte receipts without text decoding', async () => {
  const f = await setup();
  try {
    const captured = await captureGenerationInputs(f.root, await records(f.root), ['theme.css']);
    await execute(process.execPath, ['generate.mjs', '--large'], { cwd: f.root, windowsHide: true });
    const after = await records(f.root);
    const receipts = await finishGenerationReceipts(f.root, captured, { command: process.execPath, args: ['generate.mjs', '--large'], runtime: process.version, exitCode: 0 }, after, support);
    assert.equal(receipts.length, 1); assert.equal(receipts[0]!.outputHash, after.get('theme.css')!.hash); assert.equal(after.get('theme.css')!.source, '');
    assert.deepEqual(validateGenerated({ records: after, changedPaths: ['theme.css'], support, receipts }), []);
  } finally { await f.cleanup(); }
});
