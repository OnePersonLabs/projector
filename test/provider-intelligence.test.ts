import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createDocumentIntelligence, metadataFile, parseArtifactAddress, resolveDependencies, resolveReference } from '../src/documents/index.ts';

test('Rust handler registration takes terminal commands rather than module qualifiers', async () => {
  const service = await createDocumentIntelligence();
  const file = await service.extract('app/src-tauri/src/main.rs', 'fn main(){tauri::Builder::default().invoke_handler(tauri::generate_handler![model_runtime::ready, audio::commands::note_on, local]);}');
  assert.deepEqual(file.units.filter(unit => unit.data?.operation === 'registration').map(unit => unit.data?.target), ['ready', 'note_on', 'local']);
});

test('custom Tauri configuration owns its explicitly configured local frontend', async () => {
  const service = await createDocumentIntelligence();
  const inputs = {
    'platform/native/tauri.conf.json': '{"build":{"frontendDist":"../web"}}',
    'platform/native/main.rs': '#[tauri::command]\nfn available(){}\nfn main(){tauri::generate_handler![available];}',
    'platform/web/bridge.ts': 'import {invoke as nativeInvoke} from "@tauri-apps/api/core"; export const available=()=>nativeInvoke("available");',
    'other/web/bridge.ts': 'import {invoke} from "@tauri-apps/api/core"; export const available=()=>invoke("available");',
  };
  const records = new Map(await Promise.all(Object.entries(inputs).map(async ([name, source]) => [name, await service.extract(name, source)] as const)));
  const resolved = service.resolveRepository(records);
  assert.ok(resolved.get('platform/web/bridge.ts')!.references.some(reference => reference.derived && reference.text === 'artifact:framework:platform/native/main.rs#command:available'));
  assert.equal(resolved.get('other/web/bridge.ts')!.references.filter(reference => reference.derived).length, 0);
  records.set('platform/another/tauri.conf.json', await service.extract('platform/another/tauri.conf.json', inputs['platform/native/tauri.conf.json']));
  const ambiguous = service.resolveRepository(records).get('platform/web/bridge.ts')!;
  assert.equal(ambiguous.references.filter(reference => reference.derived).length, 0);
  assert.equal(ambiguous.capabilities?.crossDomain, 'partial');
});

test('installed WASM providers identify native declarations and resolve static repository imports', async () => {
  const service = await createDocumentIntelligence();
  const inputs = {
    'pkg/main.py': 'from .helper import run\ndef main():\n return run()\n',
    'pkg/helper.py': 'def run():\n return 1\n',
    'native/Cargo.toml': '[package]\nname="native"\nversion="0.1.0"\n',
    'native/src/lib.rs': 'mod worker; pub fn main() {}',
    'native/src/worker.rs': 'pub fn work() {}',
    'managed/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"/>',
    'managed/App.cs': 'namespace App; using Helpers; public class Main { public void Run(int x) {} }',
    'managed/Helper.cs': 'namespace Helpers; public class Helper {}',
  };
  const files = service.resolveRepository(new Map(await Promise.all(Object.entries(inputs).map(async ([path, source]) => [path, await service.extract(path, source)] as const))));
  assert.equal(resolveDependencies(files.get('pkg/main.py')!, [...files.values()]).files[0]?.path, 'pkg/helper.py');
  assert.equal(resolveDependencies(files.get('native/src/lib.rs')!, [...files.values()]).files[0]?.path, 'native/src/worker.rs');
  assert.equal(resolveDependencies(files.get('managed/App.cs')!, [...files.values()]).files[0]?.path, 'managed/Helper.cs');
  assert.equal(resolveReference('code:managed/App.cs#Main.Run(int x)', [...files.values()]).status, 'resolved');
});

test('binary ownership hashes raw bytes and semantic domains never become bare symbols', async () => {
  const service = await createDocumentIntelligence(); const bytes = Uint8Array.from([0xff, 0, 1, 2]);
  const binary = await service.extract('sound.bank', bytes);
  assert.equal(binary.hash, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(binary.source, ''); assert.equal(binary.byteLength, 4);
  const stylesheet = await service.extract('styles.css', '.button { color: red; }');
  assert.equal(resolveReference('button', [stylesheet]).status, 'unresolved');
  assert.equal(resolveReference('artifact:style:styles.css#button', [stylesheet]).status, 'resolved');
  assert.deepEqual(parseArtifactAddress('artifact:style:styles.css#button'), { domain: 'style', path: 'styles.css', key: 'button' });
  assert.equal(metadataFile('large.rs', 'digest', 2000000).diagnostics[0]?.code, 'units-unknown');
  assert.equal(metadataFile('large.bank', 'digest', 2000000).diagnostics.length, 0);
});

test('malformed and dynamic source stays scoped unknown; recomposition resolves newly present files', async () => {
  const service = await createDocumentIntelligence();
  assert.equal((await service.extract('bad.py', 'def broken(')).capabilities?.syntax, 'partial');
  assert.equal((await service.extract('dynamic.py', '__import__(name)')).capabilities?.repository, 'partial');
  assert.equal((await service.extract('styles.sass', '.a\n  color: red')).capabilities?.units, 'unknown');
  const source = await service.extract('pkg/main.py', 'from .helper import go');
  const first = service.resolveRepository(new Map([[source.path, source]]));
  assert.equal(first.get(source.path)?.capabilities?.repository, 'partial');
  const helper = await service.extract('pkg/helper.py', 'def go():\n pass');
  const second = service.resolveRepository(new Map([...first, [helper.path, helper]]));
  assert.equal(second.get(source.path)?.capabilities?.repository, 'complete');
});

test('provider composition detects primary conflicts and preserves additive facts independent of order', async () => {
  const providers = ['a', 'b'].map(id => ({ id, version: '1', role: 'supplement' as const, claims: (path: string) => path.endsWith('.css'), extract: (record: { diagnostics: { code: string; message: string }[] }) => { record.diagnostics.push({ code: id, message: id }); } }));
  const one = await createDocumentIntelligence({ providers }); const two = await createDocumentIntelligence({ providers: [...providers].reverse() });
  assert.deepEqual((await one.extract('x.css', '.x {}')).diagnostics, (await two.extract('x.css', '.x {}')).diagnostics);
  const conflict = await createDocumentIntelligence({ providers: [{ ...providers[0]!, role: 'primary' }] });
  await assert.rejects(conflict.extract('x.css', '.x {}'), /Primary provider conflict/);
});

test('Tauri command registration and React Native style facts use separate artifact domains', async () => {
  const service = await createDocumentIntelligence();
  const rust = await service.extract('main.rs', '#[tauri::command]\nfn greet() {}\nfn main(){tauri::Builder::default().invoke_handler(tauri::generate_handler![greet]);}');
  assert.ok(rust.units.some(unit => unit.address === 'artifact:framework:main.rs#command:greet'));
  assert.ok(rust.units.some(unit => unit.address === 'artifact:framework:main.rs#registration:greet'));
  const react = await service.extract('App.tsx', 'const styles = StyleSheet.create({screen: {flex:1}}); const app=<View style={[styles.screen,{opacity:1}]} />;');
  assert.ok(react.units.some(unit => unit.address === 'artifact:framework-style:App.tsx#styles.screen'));
  assert.ok(react.units.some(unit => unit.data?.expression === '{[styles.screen,{opacity:1}]}'));
});

test('project source roots, referenced projects, compile exclusions and Cargo workspace paths bound repository relations', async () => {
  const service = await createDocumentIntelligence();
  const source = {
    'py/pyproject.toml': '[tool.setuptools.packages.find]\nwhere=["src"]',
    'py/src/main.py': 'from tools.worker import run',
    'py/src/tools/worker.py': 'def run():\n pass',
    'py/other/tools/worker.py': 'def run():\n pass',
    'cs/App/App.csproj': '<Project><ItemGroup><ProjectReference Include="../Lib/Lib.csproj"/><Compile Remove="Ignored.cs"/></ItemGroup></Project>',
    'cs/App/App.cs': 'namespace App; using Shared; class App {}',
    'cs/App/Ignored.cs': 'namespace Shared; class Ignored {}',
    'cs/Lib/Lib.csproj': '<Project/>',
    'cs/Lib/Lib.cs': 'namespace Shared; class Shared {}',
    'rust/Cargo.toml': '[workspace.dependencies]\nhelper={path="helper"}\n[workspace]\nmembers=["app","helper"]',
    'rust/app/Cargo.toml': '[package]\nname="app"\nversion="0.1.0"\n[dependencies]\nhelper={workspace=true}',
    'rust/app/src/main.rs': 'use helper::go; fn main() {}',
    'rust/helper/Cargo.toml': '[package]\nname="helper"\nversion="0.1.0"',
    'rust/helper/src/lib.rs': 'pub fn go() {}',
  };
  const files = service.resolveRepository(new Map(await Promise.all(Object.entries(source).map(async ([path, text]) => [path, await service.extract(path, text)] as const))));
  assert.deepEqual(files.get('py/src/main.py')?.resolvedImports?.['tools.worker'], ['py/src/tools/worker.py']);
  assert.deepEqual(files.get('cs/App/App.cs')?.resolvedImports?.Shared, ['cs/Lib/Lib.cs']);
  assert.deepEqual(files.get('rust/app/src/main.rs')?.resolvedImports?.['use:helper::go'], ['rust/helper/src/lib.rs']);
});

test('framework repository composition links imported styles and aliased/injected Tauri invocations, preserves missing native registration', async () => {
  const service = await createDocumentIntelligence();
  const input = {
    'app/mobile/styles.ts': 'export const styles=StyleSheet.create({status:{color:"red"}});',
    'app/mobile/Status.tsx': 'import {styles} from "./styles"; const status=<View style={[styles.status,{opacity:0.5}]}/>;',
    'app/desktop/src-tauri/tauri.conf.json': '{"build":{"frontendDist":"../dist"}}',
    'app/desktop/src-tauri/src/main.rs': '#[tauri::command]\nfn ready() {}\nfn main(){tauri::Builder::default().invoke_handler(tauri::generate_handler![ready]);}',
    'app/desktop/src/runtime.ts': 'import {invoke as tauriInvoke} from "@tauri-apps/api/core"; tauriInvoke("ready"); class Runtime { constructor(private config: {invoke: typeof tauriInvoke}) {} ready(){ this.config.invoke("ready"); } } new Runtime({invoke:tauriInvoke});',
    'app/mobile/native.ts': 'import {NativeModules} from "react-native"; const m=NativeModules.PsychordAudio;',
  };
  const files = service.resolveRepository(new Map(await Promise.all(Object.entries(input).map(async ([path, text]) => [path, await service.extract(path, text)] as const))));
  assert.ok(files.get('app/mobile/Status.tsx')?.references.some(reference => reference.text === 'artifact:framework-style:app/mobile/styles.ts#styles.status'));
  assert.equal(files.get('app/desktop/src/runtime.ts')?.references.filter(reference => reference.text.includes('command:ready')).length, 2);
  assert.equal(files.get('app/mobile/native.ts')?.capabilities?.crossDomain, 'partial');
  const again = service.resolveRepository(files);
  assert.equal(again.get('app/mobile/Status.tsx')?.references.length, files.get('app/mobile/Status.tsx')?.references.length);
});

test('supplements cannot replace metadata, bindings, completeness, or duplicate primary identities', async () => {
  const attacks = [
    (record: import('../src/documents/index.ts').FileRecord) => { record.source = 'forged'; },
    (record: import('../src/documents/index.ts').FileRecord) => { record.hash = 'forged'; },
    (record: import('../src/documents/index.ts').FileRecord) => { record.language = 'opaque'; },
    (record: import('../src/documents/index.ts').FileRecord) => { record.bindings = []; },
    (record: import('../src/documents/index.ts').FileRecord) => { record.capabilities = { units: 'complete' }; },
    (record: import('../src/documents/index.ts').FileRecord) => { record.units.push({ ...record.units.at(-1)!, body: 'forged' }); },
  ];
  for (const extract of attacks) {
    const service = await createDocumentIntelligence({ providers: [{ id: 'attack', version: '1', role: 'supplement', claims: () => true, extract }] });
    await assert.rejects(service.extract('file.ts', 'import {X} from "./dep.js"; export class Y {}'), /Supplement attack/);
  }
  const source = 'def broken(';
  const service = await createDocumentIntelligence({ providers: [{ id: 'forged-completeness', version: '1', role: 'supplement', claims: () => true, extract(record) { record.capabilities!.syntax = 'complete'; } }] });
  await assert.rejects(service.extract('file.py', source), /hid incomplete syntax/);
});

test('Tauri relationships require proven API origin and owning application config; cfg remains unknown', async () => {
  const service = await createDocumentIntelligence();
  const inputs = {
    'app/src-tauri/tauri.conf.json': '{}',
    'app/src-tauri/main.rs': '#[cfg(feature="audio")]\n#[tauri::command]\nfn ping() {}\nfn main(){tauri::generate_handler![ping];}',
    'app/src/socket.ts': 'socket.invoke("ping");',
    'app/src/reassigned.ts': 'import {invoke} from "@tauri-apps/api/core"; let call=invoke; call=socket.invoke; const forward=(name:string)=>call(name); forward("ping");',
    'app/src/invoke.ts': 'import {invoke} from "@tauri-apps/api/core"; invoke("ping");',
    'elsewhere.ts': 'import {invoke} from "@tauri-apps/api/core"; invoke("ping");',
  };
  const records = service.resolveRepository(new Map(await Promise.all(Object.entries(inputs).map(async ([path, source]) => [path, await service.extract(path, source)] as const))));
  assert.equal(records.get('app/src/socket.ts')?.units.some(unit => unit.data?.framework === 'tauri'), false);
  assert.equal(records.get('app/src/reassigned.ts')?.units.some(unit => unit.data?.framework === 'tauri'), false);
  assert.equal(records.get('app/src/invoke.ts')?.references.length, 0);
  assert.equal(records.get('app/src/invoke.ts')?.capabilities?.crossDomain, 'partial');
  assert.equal(records.get('elsewhere.ts')?.references.length, 0);
});

test('root C# projects respect compile exclusions and do not import nested projects without a reference', async () => {
  const service = await createDocumentIntelligence();
  const inputs = {
    'Root.csproj': '<Project><ItemGroup><Compile Remove="other/**"/></ItemGroup></Project>',
    'Root.cs': 'namespace Root; using Foreign; class Root {}',
    'other/Other.csproj': '<Project/>',
    'other/Other.cs': 'namespace Foreign; public class Other {}',
  };
  const records = service.resolveRepository(new Map(await Promise.all(Object.entries(inputs).map(async ([path, source]) => [path, await service.extract(path, source)] as const))));
  assert.deepEqual(records.get('Root.cs')?.resolvedImports?.Foreign, []);
  assert.equal(records.get('Root.cs')?.capabilities?.repository, 'partial');
  const updated = await service.extract('Root.csproj', '<Project><ItemGroup><Compile Remove="other/**"/><ProjectReference Include="other/Other.csproj"/></ItemGroup></Project>');
  const repaired = service.resolveRepository(new Map([...records, [updated.path, updated]]));
  assert.deepEqual(repaired.get('Root.cs')?.resolvedImports?.Foreign, ['other/Other.cs']);
  assert.equal(repaired.get('Root.cs')?.capabilities?.repository, 'complete');
});

test('Python relative package imports and class re-exports resolve through modules and aliases', async () => {
  const service = await createDocumentIntelligence();
  const inputs = { 'pkg/__init__.py': 'from .models import Widget as PublicWidget', 'pkg/client.py': 'from . import models', 'pkg/models.py': 'class Widget:\n pass' };
  const records = service.resolveRepository(new Map(await Promise.all(Object.entries(inputs).map(async ([path, source]) => [path, await service.extract(path, source)] as const))));
  assert.deepEqual(records.get('pkg/client.py')?.resolvedImports?.['.models'], ['pkg/models.py']);
  assert.equal(resolveReference('code:pkg/__init__.py#PublicWidget', [...records.values()]).unit?.address, 'code:pkg/models.py#Widget');
  assert.equal(resolveReference('code:style.sass#Thing', [await service.extract('style.sass', '.Thing\n color: red')]).status, 'unknown');
});
