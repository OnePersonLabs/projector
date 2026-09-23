import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { applyDesignDelta, extractFile, normalizeName, parseDesignDelta, resolveDependencies, resolveReference, selectUnits } from '../src/documents/index.ts';

const digest = (source: string) => createHash('sha256').update(source).digest('hex');
const design = `---
projectorDesign: 1
id: audio/preview
scope: packages/audio
---
# Playback responsibility

## Contract
Own replay timing.

**Applies:** [[spec:audio/preview#Immediate replay]] | {"kind":"path","root":".","glob":"packages/audio/**"} | Every audio artifact participates.

### Guarantees
The retained bytes stay private.

## Decision: retain-buffer
**Choice:** Keep decoded bytes.
**Reason:** Replay needs immediate access.
**Requires:** [[spec:audio/preview#Immediate replay]]
**Realizes:** [[code:packages/audio/player.ts#Player]]
**Evidence:** Replay integration test.

### Invalidations
Drop bytes when input changes.

## Realization
Preserve this odd  spacing and trailing text.
`;

test('T1 normalization pins full Unicode case folding and preserves punctuation', () => {
  assert.equal(normalizeName('Some Type'), 'sometype');
  assert.equal(normalizeName('some_type'), 'sometype');
  assert.equal(normalizeName('Straße Σς'), 'strasseσσ');
  assert.equal(normalizeName('İ'), 'i\u0307');
  assert.notEqual(normalizeName('Some-Type'), normalizeName('SomeType'));
});

test('T1 terms own bare names while explicit code addresses bypass ownership', () => {
  const code = extractFile('src/player.ts', 'export class SomeType { replay() { return 1; } }');
  const term = extractFile('openspec/terms/type.md', '# Some Type\nMeaning.\n');
  assert.equal(resolveReference('some_type', [code, term]).unit?.kind, 'term');
  assert.equal(resolveReference('code:src/player.ts#SomeType', [code, term]).unit?.kind, 'symbol');
  assert.equal(resolveReference('replay', [code]).status, 'unresolved');
  assert.equal(resolveReference('code:src/player.ts#SomeType.replay', [code]).status, 'resolved');
});

test('T1 Markdown duplicate owners error, legal code duplicates are ambiguous, aliases deduplicate', () => {
  const first = extractFile('src/a.ts', 'export function Thing(x:string):string;\nexport function Thing(x:string){return x;}');
  const second = extractFile('src/b.ts', 'export interface Thing { value: string }');
  const alias = extractFile('src/index.ts', "export { Thing } from './a.js';");
  assert.equal(first.units.filter(unit => unit.kind === 'symbol').length, 1);
  assert.equal(resolveReference('Thing', [first, alias]).status, 'resolved');
  assert.equal(resolveReference('Thing', [first, second]).status, 'ambiguous');
  const terms = [extractFile('one.md', '# Thing\nFirst'), extractFile('two.md', '# THING\nSecond')];
  assert.equal(resolveReference('thing', terms).diagnostics[0]?.code, 'duplicate-markdown-owner');
});

test('T1 aliases and package exports resolve through actual module summaries', () => {
  const files = [extractFile('packages/audio/src/player.ts', 'export class Player {}'), extractFile('packages/audio/index.ts', "import { Player as Local } from './src/player.js';\nexport { Local as Preview };"), extractFile('terms.md', '# audio.Preview\nUnrelated prose')];
  const options = { packages: { audio: { root: 'packages/audio', exports: { '.': './index.ts' } } } };
  assert.equal(resolveReference('audio.Preview', files, options).unit?.name, 'Player');
  assert.equal(resolveReference('Preview', files, options).unit?.name, 'Player');
  assert.equal(resolveReference('code:packages/audio/index.ts#Preview', files, options).unit?.name, 'Player');
});

test('T1 encoded address components retain reserved punctuation and nested headings', () => {
  const term = extractFile('terms.md', '# Player Evidence\n## Origin\n### System events\nDetails\n');
  assert.equal(resolveReference('Player Evidence#Origin#System events', [term]).status, 'resolved');
  const code = extractFile('src/a#b.ts', 'export class Thing {}');
  assert.equal(resolveReference('code:src/a%23b.ts#Thing', [code]).status, 'resolved');
  assert.equal(resolveReference('code:src/a#b.ts#Thing', [code]).status, 'unresolved');
  assert.equal(resolveReference('bad%zz', [code]).status, 'unresolved');
});

test('T1 live designs expose scoped parts, exact requirements and pending evidence', () => {
  const file = extractFile('openspec/designs/audio/preview/design.md', design);
  assert.deepEqual(file.diagnostics, []);
  assert.equal(file.units.find(unit => unit.kind === 'design')?.id, 'design:audio/preview');
  const contract = file.units.find(unit => unit.address.endsWith('#contract'))!;
  assert.equal((contract.data?.applies as unknown[]).length, 1);
  const decision = file.units.find(unit => unit.address.endsWith('#decision:retain-buffer'))!;
  assert.deepEqual(decision.data?.evidence, [{ text: 'Replay integration test.', status: 'pending' }]);
  assert.equal(resolveReference('design:audio/preview#decision:retain-buffer#Invalidations', [file]).status, 'resolved');
  const spec = extractFile('openspec/specs/audio/preview/spec.md', '# Audio\n### Requirement: Immediate replay\nSHALL replay.\n#### Scenario: cached\nGiven bytes.');
  assert.equal(resolveReference('spec:audio/preview#Immediate replay', [spec]).unit?.kind, 'requirement');
  assert.ok(file.references.some(reference => reference.text === 'code:packages/audio/player.ts#Player'));
});

test('T1 malformed designs and consequential fields produce actionable diagnostics', () => {
  const malformed = extractFile('design.md', '---\nprojectorDesign: 1\nid: demo\nscope: src\n---\n# Demo\n## Decision: cache\n**Choice:** Cache.\n**Consequential:** dependency\n');
  const codes = malformed.diagnostics.map(diagnostic => diagnostic.code);
  assert.ok(codes.includes('design-contract-missing'));
  assert.ok(codes.includes('decision-field-missing'));
  assert.ok(codes.includes('decision-consequence-missing'));
  assert.equal(extractFile('bad.md', '---\nid: first\nid: second\n---\n# Bad').diagnostics[0]?.code, 'frontmatter-invalid');
});

test('T1 boundary policy is explicit and private scope does not override configured policy', () => {
  const files = [extractFile('packages/private/src/secret.ts', 'class Secret {}')];
  assert.equal(resolveReference('Secret', files, { fromPath: 'packages/client/main.ts' }).status, 'denied');
  assert.equal(resolveReference('Secret', files, { fromPath: 'packages/client/main.ts', scope: 'packages/private' }).status, 'resolved');
  assert.equal(resolveReference('Secret', files, { scope: 'packages/private', detectedPolicy: 'unimplemented-policy' }).status, 'unknown');
  assert.equal(resolveReference('Secret', files, { scope: 'packages/private', policy: { name: 'test', check: () => ({ status: 'denied', reason: 'The client cannot depend on private.' }) } }).status, 'denied');
  assert.equal(resolveReference('Secret', files, { fromPath: 'packages/client/main.ts', edge: 'observation' }).status, 'resolved');
});

test('T3 new owners, collisions and unsupported syntax cannot yield false uniqueness', () => {
  const code = extractFile('src/a.ts', 'export class Thing {}');
  const previous = resolveReference('Thing', [code]);
  const term = extractFile('term.md', '# Thing\nMeaning.');
  assert.equal(resolveReference('Thing', [code, term], { previousBinding: { id: previous.unit!.id, population: previous.population } }).status, 'rebind');
  const collision = extractFile('src/b.ts', 'export class Thing {}');
  const ambiguous = resolveReference('Thing', [code, collision]);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.notEqual(ambiguous.population, previous.population);
  const unknown = extractFile('src/unknown.ts', 'export const { Thing } = factory();');
  assert.equal(resolveReference('Thing', [code, unknown]).status, 'unknown');
  assert.equal(resolveReference('Thing', [code], { inventoryComplete: false }).status, 'unknown');
});

test('T3 empty path membership records its population and changes when a file arrives', () => {
  const selector = { kind: 'path' as const, root: '.', glob: 'src/**/*.ts' };
  const before = selectUnits(selector, [extractFile('README.md', '# Readme')]);
  const after = selectUnits(selector, [extractFile('README.md', '# Readme'), extractFile('src/new.ts', 'export const newValue = 1;')]);
  assert.equal(before.status, 'known'); assert.deepEqual(before.units, []);
  assert.deepEqual(after.units.map(unit => unit.id), ['file:src/new.ts']);
  assert.notEqual(before.population, after.population);
  assert.equal(selectUnits({ kind: 'implements', name: 'Player' }, []).status, 'unknown');
  assert.equal(selectUnits({ kind: 'path', root: 'missing', glob: '**' }, []).status, 'unknown');
  assert.equal(selectUnits({ kind: 'path', root: '.', glob: '../**' }, []).status, 'unknown');
  assert.equal(selectUnits(selector, [], { inventoryComplete: false }).status, 'unknown');
});

test('static consumers, concern descendants and conjunctive selectors expose real memberships', () => {
  const files = [extractFile('src/a.ts', 'export class A {}'), extractFile('src/b.ts', "import { A } from './a.js'; export const b = new A();")];
  assert.deepEqual(selectUnits({ kind: 'consumers', id: 'file:src/a.ts' }, files).units.map(unit => unit.id), ['file:src/b.ts']);
  assert.deepEqual(selectUnits({ kind: 'and', selectors: [{ kind: 'imports', id: 'file:src/b.ts' }, { kind: 'path', root: '.', prefix: 'src' }] }, files).units.map(unit => unit.id), ['file:src/a.ts']);
  const root = extractFile('root.md', '---\nprojectorDesign: 1\nid: root\nscope: src\n---\n# Root\n## Contract\nOwn root.\n## Subdesigns\n[[design:child]]');
  const child = extractFile('child.md', '---\nprojectorDesign: 1\nid: child\nscope: src\n---\n# Child\n## Contract\nOwn child.');
  assert.deepEqual(selectUnits({ kind: 'descendants', designId: 'root' }, [root, child]).units.map(unit => unit.id), ['design:child']);
});

test('exact replacement preserves unrelated formatting and recorded retries require exact result', () => {
  const delta = parseDesignDelta('delta.md', `---\ndesignDelta: 1\ntarget: audio/preview\nbaseline: ${digest(design)}\n---\n# Changes\n## Replace: decision:retain-buffer#Invalidations\n### Invalidations\nDrop bytes when identity changes.\n\n`);
  const applied = applyDesignDelta(design, delta);
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  assert.equal(applied.source, design.replace('Drop bytes when input changes.', 'Drop bytes when identity changes.'));
  assert.equal(applyDesignDelta(applied.source, delta, { recordedApplication: applied.receipt }).status, 'already-applied');
  assert.equal(applyDesignDelta(applied.source, delta).status, 'rejected');
  assert.equal(applyDesignDelta(`${applied.source}unrelated edit`, delta, { recordedApplication: applied.receipt }).diagnostics[0]?.code, 'delta-stale');
});

test('deltas reject overlap, stale baselines, missing targets and conflicting additions', () => {
  const base = { path: 'delta.md', target: 'audio/preview', baseline: digest(design), diagnostics: [] };
  assert.equal(applyDesignDelta(design, { ...base, operations: [{ kind: 'remove', address: 'decision:retain-buffer', reason: 'Retired.' }, { kind: 'remove', address: 'decision:retain-buffer#Invalidations', reason: 'Retired.' }] }).diagnostics[0]?.code, 'delta-overlap');
  assert.equal(applyDesignDelta(design, { ...base, baseline: 'old', operations: [{ kind: 'remove', address: 'realization', reason: 'Retired.' }] }).diagnostics[0]?.code, 'delta-stale');
  assert.equal(applyDesignDelta(design, { ...base, operations: [{ kind: 'remove', address: 'decision:missing', reason: 'Retired.' }] }).diagnostics[0]?.code, 'delta-target-missing');
  assert.equal(applyDesignDelta(design, { ...base, operations: [{ kind: 'add', address: 'contract', content: '## Contract\nChanged.' }] }).diagnostics[0]?.code, 'delta-target-exists');
  assert.equal(applyDesignDelta(design, { ...base, operations: [{ kind: 'replace', address: 'contract', content: 'Please change the contract.' }] }).diagnostics[0]?.code, 'delta-content-invalid');
});

test('explicit rename returns binding maps including subaddresses and preserves body text', () => {
  const delta = parseDesignDelta('delta.md', `---\ndesignDelta: 1\ntarget: audio/preview\nbaseline: ${digest(design)}\n---\n# Rename\n## Rename: decision:retain-buffer\nTo: decision:reuse-bytes\nReason: Clarify responsibility.\n`);
  const result = applyDesignDelta(design, delta);
  assert.equal(result.status, 'applied', JSON.stringify(result.diagnostics));
  assert.equal(result.source, design.replace('## Decision: retain-buffer', '## Decision: reuse-bytes'));
  assert.deepEqual(result.renames, { 'design:audio/preview#decision:retain-buffer': 'design:audio/preview#decision:reuse-bytes', 'design:audio/preview#decision:retain-buffer#Invalidations': 'design:audio/preview#decision:reuse-bytes#Invalidations' });
});

test('whole design creation and deletion are explicit and baseline guarded', () => {
  const create = parseDesignDelta('delta.md', `---\ndesignDelta: 1\ntarget: audio/preview\nbaseline: absent\n---\n# Create\n## Add: design\n\`\`\`markdown\n${design}\`\`\`\n`);
  const added = applyDesignDelta('', create);
  assert.equal(added.status, 'applied', JSON.stringify(added.diagnostics));
  assert.equal(added.source, design);
  assert.equal(applyDesignDelta(design, create).status, 'rejected');
  const remove = parseDesignDelta('delta.md', `---\ndesignDelta: 1\ntarget: audio/preview\nbaseline: ${digest(design)}\n---\n# Remove\n## Remove: design\nReason: Responsibility was retired.\n`);
  assert.equal(applyDesignDelta(design, remove).source, '');
});

test('implementation bodies invalidate body hashes without inventing public signature changes', () => {
  const before = extractFile('src/a.ts', 'export function value(): number { return 1; }');
  const after = extractFile('src/a.ts', 'export function value(): number { return 2; }');
  const previous = before.units.find(unit => unit.kind === 'symbol')!, current = after.units.find(unit => unit.kind === 'symbol')!;
  assert.equal(previous.contractHash, current.contractHash);
  assert.notEqual(previous.bodyHash, current.bodyHash);
});

test('real TypeScript module resolution obeys path mappings and conditional package exports', () => {
  const importer = extractFile('src/main.ts', "import { Thing } from 'audio/public'; import { Shared } from '@shared/value';");
  const files = [importer, extractFile('src/shared/value.ts', 'export interface Shared {}'), extractFile('packages/audio/player.ts', 'export class Thing {}'), extractFile('packages/audio/package.json', JSON.stringify({ name: 'audio', type: 'module', exports: { './public': { import: './player.js' } } })), extractFile('tsconfig.json', JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', paths: { '@shared/*': ['./src/shared/*.js'] } } }))];
  const options = { fileMap: new Map(files.map(file => [file.path, file])), packages: { audio: { root: 'packages/audio', exports: { './public': './player.js' } } } };
  const dependencies = resolveDependencies(importer, [importer], options);
  assert.equal(dependencies.unknown, false, JSON.stringify(dependencies.diagnostics));
  assert.deepEqual(dependencies.files.map(file => file.path), ['packages/audio/player.ts', 'src/shared/value.ts']);
  const inherited = extractFile('tsconfig.json', '{"extends":"./base.json"}');
  assert.equal(resolveDependencies(importer, [...files.filter(file => file.path !== 'tsconfig.json'), inherited]).unknown, true);
});

test('cross-package explicit code references enforce declared export reachability', () => {
  const files = [extractFile('packages/audio/index.ts', "export { Player as PublicPlayer } from './player.js';"), extractFile('packages/audio/player.ts', 'export class Player {}'), extractFile('packages/audio/private.ts', 'export class Internal {}')];
  const options = { fromPath: 'packages/client/main.ts', packages: { audio: { root: 'packages/audio', exports: { '.': './index.ts' } } } };
  assert.equal(resolveReference('code:packages/audio/player.ts#Player', files, options).status, 'resolved');
  assert.equal(resolveReference('code:packages/audio/private.ts#Internal', files, options).status, 'denied');
  assert.equal(resolveReference('code:packages/audio/private.ts#Internal', files, { ...options, scope: 'packages/audio' }).status, 'resolved');
});

test('unsupported CommonJS and illegal duplicate declarations are explicit unknowns', () => {
  const duplicate = extractFile('src/a.ts', 'export class Thing {} export class Thing {}');
  assert.equal(resolveReference('Thing', [duplicate]).status, 'unknown');
  const commonjs = extractFile('src/a.cjs', 'module.exports = { Thing: class Thing {} };');
  assert.equal(resolveReference('code:src/a.cjs#Thing', [commonjs]).status, 'unknown');
  const exactFile = resolveReference('code:src/a.cjs', [commonjs]);
  assert.equal(exactFile.status, 'resolved');
  assert.equal(exactFile.unit?.kind, 'file');
  assert.ok(exactFile.diagnostics.some(diagnostic => diagnostic.code.includes('unknown')));
});
