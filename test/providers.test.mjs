import { activate, deactivate } from '../plugins/opl-projector/runtime/activation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { observe } from '../plugins/opl-projector/runtime/providers/index.mjs';
import { captureInputs } from '../plugins/opl-projector/runtime/state.mjs';

const range = {start:{line:0,character:0},end:{line:0,character:3}};
const pluginRequire = createRequire(new URL('../plugins/opl-projector/package.json', import.meta.url));
async function fixture(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'projector-providers-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  await activate(root);
  for (const [file,text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});
    await fs.writeFile(path.join(root,file),text);
  }
  return root;
}

test('inactive observation does not inspect source or invoke a configured provider', async t => {
  const root = await fixture(t, {});
  await deactivate(root);
  const result = await observe(root, { provider: 'lsp', files: ['../invalid'], config: { command: 'missing-provider' } });
  assert.equal(result.status, 'inactive');
  assert.equal(result.facts, undefined);
  await assert.rejects(fs.access(path.join(root, '.projector/cache')), { code: 'ENOENT' });
});
async function server(t, mode = 'normal') {
  const root = await fixture(t, {'src/main.rs':'fn main() {}','src/second.rs':'fn second() {}'});
  const rpc = pathToFileURL(pluginRequire.resolve('vscode-jsonrpc/node')).href;
  const script = `
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from ${JSON.stringify(rpc)};
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const mode = ${JSON.stringify(mode)};
const connection = createMessageConnection(new StreamMessageReader(process.stdin),new StreamMessageWriter(process.stdout));
const range = ${JSON.stringify(range)};
connection.onRequest('initialize', () => ({serverInfo:{name:'fixture-language-server',version:'fixture-1'},capabilities:mode === 'unsupported' ? {} : {documentSymbolProvider:true,definitionProvider:true,referencesProvider:true,diagnosticProvider:{interFileDependencies:false,workspaceDiagnostics:false}}}));
connection.onNotification('textDocument/didOpen', async params => { await fs.appendFile('opened.jsonl',JSON.stringify(params.textDocument)+'\\n'); });
connection.onRequest('textDocument/documentSymbol', async params => {
  if (mode === 'exit') process.exit(7);
  if (mode === 'hang') return new Promise(() => {});
  if (mode === 'change') await fs.writeFile(fileURLToPath(params.textDocument.uri),'fn changed() {}');
  if (mode === 'membership') await fs.writeFile('src/new.rs','fn added() {}');
  if (mode === 'partial' && params.textDocument.uri.endsWith('second.rs')) throw new Error('second file rejected');
  return [{name:'main',kind:12,range,selectionRange:range}];
});
connection.onRequest('textDocument/definition', params => mode === 'outside' ? [{uri:new URL('../../outside.rs',params.textDocument.uri).href,range},{uri:params.textDocument.uri,range}] : {uri:params.textDocument.uri,range});
connection.onRequest('textDocument/references', params => [{uri:params.textDocument.uri,range}]);
connection.onRequest('textDocument/diagnostic', () => ({kind:'full',items:[{range,severity:2,message:'fixture diagnostic'}]}));
connection.onRequest('shutdown', async (...args) => {if (args.length !== 1) throw new Error('Shutdown must have no wire parameters (only the native cancellation token)');await fs.writeFile('shutdown.txt','shutdown');return null;});
connection.onNotification('exit', () => process.exit(0));
connection.listen();
`;
  await fs.writeFile(path.join(root,'server.mjs'),script);
  return {root,config:{command:process.execPath,args:[path.join(root,'server.mjs')]}};
}

test('inventory locates literal native seams with paths and ranges', async t => {
  const root = await fixture(t,{'src/main.rs':'#[tauri::command]\nfn open() {}','web/main.ts':'invoke("open");'});
  const result = await observe(root,{provider:'inventory',operation:'relationships',patterns:['src/**/*.rs','web/**/*.ts'],literal:'tauri'});
  assert.equal(result.status,'complete');
  assert.deepEqual(result.facts.find(f => f.kind === 'literal-occurrence').range,{start:{line:0,character:2},end:{line:0,character:7}});
  assert.equal(result.scope.currentness,'current');
  assert.equal(result.scope.semanticCompleteness,'unclaimed');
});

test('HTML service symbols and document highlights; unsupported diagnostics retain sources', async t => {
  const root = await fixture(t,{'page.html':'<main><div id="a">Hello</div></main>'});
  const result = await observe(root,{provider:'html',operation:'symbols',files:['page.html']});
  assert.equal(result.status,'complete');
  assert.ok(result.facts.some(f => f.kind === 'symbol' && f.name.includes('main')));
  const references = await observe(root,{provider:'html',operation:'references',files:['page.html'],position:{line:0,character:2}});
  assert.ok(references.facts.some(f => f.kind === 'document-highlight'));
  assert.ok(references.gaps.some(g => g.code === 'document-local-references'));
  const diagnostics = await observe(root,{provider:'html',operation:'diagnostics',files:['page.html']});
  assert.equal(diagnostics.status,'partial');
  assert.ok(diagnostics.facts.some(f => f.kind === 'source-file'));
  assert.ok(diagnostics.gaps.some(g => g.code === 'unsupported-operation'));
});

test('CSS and SCSS use direct definitions, references, symbols and validation', async t => {
  const root = await fixture(t,{'style.scss':'$tone: red;\n.card { color: $tone; }','bad.css':'.card { colr: red; }'});
  const definitions = await observe(root,{provider:'css',operation:'definitions',files:['style.scss'],position:{line:1,character:17}});
  assert.ok(definitions.facts.some(f => f.kind === 'definition' && f.range.start.line === 0));
  const references = await observe(root,{provider:'css',operation:'references',files:['style.scss'],position:{line:1,character:17}});
  assert.ok(references.facts.filter(f => f.kind === 'reference').length >= 2);
  const symbols = await observe(root,{provider:'css',operation:'symbols',files:['style.scss']});
  assert.ok(symbols.facts.some(f => f.kind === 'symbol'));
  const diagnostics = await observe(root,{provider:'css',operation:'diagnostics',files:['bad.css']});
  assert.ok(diagnostics.facts.some(f => f.kind === 'diagnostic' && f.message.includes('colr')));
});

test('index accepts source-bound facts and rejects stale, unbound, and escaping facts', async t => {
  const root = await fixture(t,{'main.ts':'const value = 1;'});
  const inputs = await captureInputs(root,['main.ts']);
  const write = facts => fs.writeFile(path.join(root,'index.json'),JSON.stringify({version:1,inputs,facts}));
  await write([{kind:'symbol',path:'main.ts',range,name:'value'},{kind:'symbol',path:'../escape.ts',range,name:'escape'}]);
  const request = {provider:'index',operation:'symbols',files:['main.ts'],config:{path:'index.json'}};
  const accepted = await observe(root,request);
  assert.ok(accepted.facts.some(f => f.kind === 'symbol' && f.provenance.sourceHash === inputs[0].hash));
  assert.ok(accepted.gaps.some(g => g.code === 'index-fact-rejected'));
  await fs.writeFile(path.join(root,'main.ts'),'const value = 2;');
  const stale = await observe(root,request);
  assert.ok(!stale.facts.some(f => f.kind === 'symbol'));
  assert.ok(stale.gaps.some(g => g.message.includes('current source')));
  await fs.writeFile(path.join(root,'index.json'),JSON.stringify({version:1,inputs:[],facts:[]}));
  assert.ok((await observe(root,request)).gaps.some(g => g.code === 'provider-failed'));
});

test('LSP stdio negotiates capabilities, opens languages, queries navigation and shuts down', async t => {
  const {root,config} = await server(t);
  for (const operation of ['symbols','definitions','references','diagnostics']) {
    const result = await observe(root,{provider:'lsp',operation,files:['src/main.rs'],position:{line:0,character:3},config,timeoutMs:5000});
    assert.equal(result.status,'complete',JSON.stringify(result.gaps));
    assert.ok(result.facts.some(f => f.kind === {symbols:'symbol',definitions:'definition',references:'reference',diagnostics:'diagnostic'}[operation]));
  }
  assert.equal(await fs.readFile(path.join(root,'shutdown.txt'),'utf8'),'shutdown');
  assert.equal(JSON.parse((await fs.readFile(path.join(root,'opened.jsonl'),'utf8')).trim().split('\n')[0]).languageId,'rust');
});

test('index rejects facts when a declared dependency changes outside the fact location', async t => {
  const root = await fixture(t,{'main.ts':'const value = 1;', 'config.json':'{"value":1}'});
  const inputs = await captureInputs(root,['main.ts','config.json']);
  await fs.writeFile(path.join(root,'index.json'),JSON.stringify({version:1,inputs,facts:[{kind:'symbol',path:'main.ts',range,name:'value'}]}));
  await fs.writeFile(path.join(root,'config.json'),'{"value":2}');
  const result = await observe(root,{provider:'index',operation:'symbols',files:['main.ts'],config:{path:'index.json'}});
  assert.ok(!result.facts.some(f => f.kind === 'symbol'));
  assert.ok(result.gaps.some(g => g.code === 'index-source-stale' && g.message.includes('config.json')));
  assert.ok(result.facts.some(f => f.kind === 'source-file'));
});

test('unconfigured and unsupported LSP preserve independent source findings', async t => {
  const {root,config} = await server(t,'unsupported');
  for (const selectedConfig of [undefined,config]) {
    const result = await observe(root,{provider:'lsp',operation:'definitions',files:['src/main.rs'],config:selectedConfig});
    assert.equal(result.status,'partial');
    assert.ok(result.facts.some(f => f.kind === 'source-file'));
    assert.ok(result.gaps.length);
  }
});

test('LSP captures source edits and membership changes without discarding facts', async t => {
  for (const mode of ['change','membership']) {
    const {root,config} = await server(t,mode);
    const result = await observe(root,{provider:'lsp',operation:'symbols',patterns:['src/**/*.rs'],config,timeoutMs:5000});
    assert.equal(result.scope.currentness,'unresolved');
    assert.ok(result.facts.some(f => f.kind === 'symbol'));
    assert.ok(result.gaps.some(g => g.code === 'source-changed'));
  }
});

test('LSP early exit, request failure, budget and cancellation retain partial findings', async t => {
  for (const mode of ['exit','partial','hang']) {
    const {root,config} = await server(t,mode);
    const result = await observe(root,{provider:'lsp',operation:'symbols',files:['src/main.rs','src/second.rs'],config,timeoutMs:mode === 'hang' ? 200 : 5000});
    assert.equal(result.status,'partial');
    assert.ok(result.gaps.some(g => g.code === 'lsp-request-failed'));
    if (mode === 'partial') assert.ok(result.facts.some(f => f.kind === 'symbol'));
  }
  const {root,config} = await server(t,'hang');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),200);
  const cancelled = await observe(root,{provider:'lsp',operation:'symbols',files:['src/main.rs'],config,signal:controller.signal});
  clearTimeout(timer);
  assert.ok(cancelled.gaps.some(g => g.message.includes('cancelled')));
});

test('declared source targets cannot escape the root', async t => {
  const root = await fixture(t,{'main.rs':'fn main() {}'});
  await assert.rejects(observe(root,{files:['../outside.rs']}),/escapes/);
  const empty = await observe(root,{provider:'inventory',files:[]});
  assert.equal(empty.scope.currentness,'unresolved');
  assert.equal(empty.status,'unavailable');
});

test('outside-root LSP navigation is rejected without losing valid locations', async t => {
  const {root,config} = await server(t,'outside');
  const result = await observe(root,{provider:'lsp',operation:'definitions',files:['src/main.rs'],position:{line:0,character:3},config,timeoutMs:5000});
  assert.ok(result.gaps.some(g => g.code === 'fact-rejected' && g.message.includes('escapes')));
  assert.deepEqual(result.facts.filter(f => f.kind === 'definition').map(f => f.path),['src/main.rs']);
});

test('LSP maps source languages at the shared stdio boundary', async t => {
  const {root,config} = await server(t);
  const files = {'main.py':'python','main.cs':'csharp','main.js':'javascript','main.ts':'typescript','main.jsx':'javascriptreact','main.tsx':'typescriptreact'};
  for (const file of Object.keys(files)) await fs.writeFile(path.join(root,file),'source');
  const result = await observe(root,{provider:'lsp',operation:'symbols',files:Object.keys(files),config,timeoutMs:5000});
  assert.equal(result.status,'complete',JSON.stringify(result.gaps));
  const opened = (await fs.readFile(path.join(root,'opened.jsonl'),'utf8')).trim().split('\n').map(line => JSON.parse(line));
  for (const [file,id] of Object.entries(files)) assert.equal(opened.find(document => document.uri.endsWith('/'+file)).languageId,id);
});
