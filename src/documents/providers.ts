import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, matchesGlob, posix } from 'node:path';
import treeSitter from '@vscode/tree-sitter-wasm';
import { parse as parseHtml } from 'parse5';
import postcss from 'postcss';
import scss from 'postcss-scss';
import selectorParser from 'postcss-selector-parser';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import toml from 'toml';
import ts from 'typescript';
import { parseDocument } from 'yaml';
import { addressPath, component, hash, normalizeName, slash } from './common.ts';
import { extractFile } from './index.ts';
import { resolveModule } from './resolver.ts';
import { DECLARATION_QUERIES } from './queries.ts';
import type { FileRecord, Unit } from './types.ts';

export const DOCUMENT_INTELLIGENCE_VERSION = `providers-2:tree-sitter-0.3.1:html-8.0.1:css-8.5.28:${hash(JSON.stringify(DECLARATION_QUERIES))}`;
export interface DocumentProvider {
  id: string; version: string; role: 'primary' | 'supplement';
  claims(path: string): boolean;
  extract(record: FileRecord): void | Promise<void>;
  replaces?: string;
  domains?: string[]; capabilities?: Partial<FileRecord['capabilities']>;
  dispose?(): void;
}
export function parseArtifactAddress(address: string): { domain: string; path: string; key?: string } | undefined {
  const match = /^(?:artifact:([^:]+):|code:)([^#]+)(?:#(.+))?$/.exec(address.replace(/^\[\[|\]\]$/g, ''));
  if (!match) return undefined;
  try { return { domain: match[1] ?? 'code', path: decodeURIComponent(match[2]!), ...(match[3] ? { key: decodeURIComponent(match[3]) } : {}) }; }
  catch { return undefined; }
}
export function metadataFile(path: string, digest: string, byteLength: number): FileRecord {
  path = slash(path);
  const recognized = /\.(?:[cm]?[jt]sx?|md|py|rs|cs|html?|css|scss|sass|json|toml|csproj)$/.test(path);
  return { path, hash: digest, byteLength, source: '', language: 'opaque', providers: [], capabilities: { syntax: 'unknown', units: 'unknown', dependencies: 'unknown', repository: 'unknown', crossDomain: 'unknown' },
    units: [{ id: `file:${path}`, kind: 'file', name: path, key: normalizeName(path), path, address: `code:${addressPath(path)}`, body: '', bodyHash: digest, contractHash: digest, data: { textAvailable: false, byteLength } }], imports: [], references: [], diagnostics: recognized ? [{ code: 'units-unknown', path, message: 'Semantic text is unavailable within the parsing budget.' }] : [] };
}
function add(record: FileRecord, domain: string, name: string, body: string, data: Record<string, unknown> = {}): Unit {
  const address = `${domain === 'code' ? 'code:' : `artifact:${domain}:`}${addressPath(record.path)}#${component(name)}`;
  const existing = record.units.find(unit => unit.address === address);
  if (existing && domain === 'style') { existing.body += `\n${body}`; existing.bodyHash = hash(existing.body); existing.contractHash = existing.bodyHash; return existing; }
  if (existing) record.diagnostics.push({ code: 'units-unknown', path: record.path, address, message: 'Multiple declarations have the same semantic identity.' });
  const unit: Unit = { id: address, address, path: record.path, kind: domain === 'code' ? 'symbol' : 'part', name, key: normalizeName(name), body, bodyHash: hash(body), contractHash: hash(body), data: { domain, ...data } };
  record.units.push(unit); return unit;
}
function incomplete(record: FileRecord, capability: 'syntax' | 'dependencies' | 'repository' | 'crossDomain', reason: string): void {
  record.capabilities = { ...record.capabilities, [capability]: 'partial' };
  record.diagnostics.push({ code: `${capability}-unknown`, message: reason, path: record.path });
}
type SyntaxNode = treeSitter.Node;
type CsItem = { '@_Include'?: string; '@_Remove'?: string; '@_Condition'?: string };
type CsProject = { Project?: { ItemGroup?: { ProjectReference?: CsItem | CsItem[]; Compile?: CsItem | CsItem[] } | { ProjectReference?: CsItem | CsItem[]; Compile?: CsItem | CsItem[] }[]; PropertyGroup?: { EnableDefaultCompileItems?: string } | { EnableDefaultCompileItems?: string }[] } };
function csItems(project: FileRecord, kind: 'Compile' | 'ProjectReference'): CsItem[] {
  const config = project.units[0]?.data?.configuration as CsProject | undefined; const groups = config?.Project?.ItemGroup;
  return (Array.isArray(groups) ? groups : groups ? [groups] : []).flatMap(group => { const item = group[kind]; return Array.isArray(item) ? item : item ? [item] : []; });
}
function csIncludes(project: FileRecord, path: string): boolean {
  const root = posix.dirname(project.path), relative = posix.relative(root, path);
  if (relative.startsWith('../')) return csItems(project, 'Compile').some(item => item['@_Include'] && posix.normalize(posix.join(root, slash(item['@_Include']))) === path);
  const config = project.units[0]?.data?.configuration as CsProject | undefined; const properties = config?.Project?.PropertyGroup;
  const defaults = !(Array.isArray(properties) ? properties : properties ? [properties] : []).some(item => item.EnableDefaultCompileItems === 'false');
  const items = csItems(project, 'Compile');
  if (items.some(item => item['@_Remove']?.split(';').some(pattern => matchesGlob(relative, slash(pattern))))) return false;
  return defaults || items.some(item => item['@_Include']?.split(';').some(pattern => matchesGlob(relative, slash(pattern))));
}
function walk(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void { visitor(node); for (const child of node.namedChildren) if (child) walk(child, visitor); }
function conditionalRust(node: SyntaxNode): boolean {
  for (let ancestor: SyntaxNode | null = node; ancestor; ancestor = ancestor.parent) {
    for (let previous = ancestor.previousNamedSibling; previous?.type === 'attribute_item'; previous = previous.previousNamedSibling) if (/\bcfg(?:_attr)?\b/.test(previous.text)) return true;
  }
  return false;
}
function rustUses(node: SyntaxNode, prefix = ''): string[] {
  if (node.type === 'scoped_use_list') {
    const path = node.childForFieldName('path')?.text; const list = node.childForFieldName('list');
    return list ? list.namedChildren.flatMap(child => child ? rustUses(child, `${prefix}${path ? `${path}::` : ''}`) : []) : [];
  }
  if (node.type === 'use_list') return node.namedChildren.flatMap(child => child ? rustUses(child, prefix) : []);
  if (node.type === 'use_as_clause') return node.childForFieldName('path') ? rustUses(node.childForFieldName('path')!, prefix) : [];
  return [`use:${prefix}${node.text}`];
}
function languageProvider(language: string, parser: treeSitter.Parser): DocumentProvider {
  const extension = { python: '.py', rust: '.rs', 'c-sharp': '.cs' }[language]!;
  const declarations = new Set(['function_definition', 'class_definition', 'function_item', 'struct_item', 'enum_item', 'trait_item', 'type_item', 'const_item', 'static_item', 'mod_item', 'class_declaration', 'interface_declaration', 'struct_declaration', 'enum_declaration', 'method_declaration', 'property_declaration', 'record_declaration', 'delegate_declaration']);
  const query = new treeSitter.Query(parser.language!, DECLARATION_QUERIES[language]!);
  return { id: language, version: `0.3.2/${hash(DECLARATION_QUERIES[language]!)}`, role: 'primary', domains: ['code', ...(language === 'rust' ? ['framework'] : [])], capabilities: { syntax: 'complete', units: 'complete', repository: 'partial', dependencies: 'partial', crossDomain: 'partial' }, claims: path => path.endsWith(extension), dispose() { query.delete(); parser.delete(); }, extract(record) {
    record.language = language; const deadline = performance.now() + 5000;
    const tree = parser.parse(record.source, null, { progressCallback: () => performance.now() > deadline });
    if (!tree) { incomplete(record, 'syntax', 'Parsing exceeded its deadline.'); return; }
    try {
      if (tree.rootNode.hasError) incomplete(record, 'syntax', 'The syntax tree contains incomplete or invalid input.');
      const captures = query.captures(tree.rootNode, { timeoutMicros: Math.max(1, (deadline - performance.now()) * 1000), matchLimit: 4096 });
      if (performance.now() > deadline || query.didExceedMatchLimit()) { incomplete(record, 'syntax', 'Declaration querying exceeded its deadline or match budget.'); return; }
      const captured = new Set(captures.map(capture => capture.node.id));
      walk(tree.rootNode, node => {
        if (performance.now() > deadline) throw new ExtractionDeadline();
        if (captured.has(node.id)) {
          const identifier = node.childForFieldName('name'); if (!identifier) return;
          const owners: string[] = []; let parent = node.parent;
          while (parent) { if (declarations.has(parent.type)) { const name = parent.childForFieldName('name'); if (name) owners.unshift(name.text); } else if (parent.type === 'impl_item') { const type = parent.childForFieldName('type'); if (type) owners.unshift(type.text); } else if (parent.type === 'namespace_declaration') { const name = parent.childForFieldName('name'); if (name) owners.unshift(name.text); } parent = parent.parent; }
          const name = [...owners, identifier.text].join('.');
          const parameters = node.childForFieldName('parameters');
          const key = language === 'c-sharp' && parameters ? `${name}${parameters.text.replace(/\s+/g, ' ')}` : name;
          const exported = language === 'python' ? !identifier.text.startsWith('_') : language === 'rust' ? node.namedChildren.some(child => child?.type === 'visibility_modifier' && child.text === 'pub') : node.namedChildren.some(child => child?.type === 'modifier' && child.text === 'public');
          add(record, 'code', key, node.text, { declarationKind: node.type, topLevel: owners.length === 0, start: node.startIndex, end: node.endIndex });
          record.units.at(-1)!.exported = exported;
        }
        if (language === 'python' && (node.type === 'import_statement' || node.type === 'import_from_statement')) {
          const module = node.childForFieldName('module_name');
          const names = node.namedChildren.filter((child): child is SyntaxNode => Boolean(child && child.id !== module?.id && ['dotted_name', 'aliased_import'].includes(child.type)));
          const relativePackage = module && /^\.+$/.test(module.text);
          if (module && !relativePackage) record.imports.push(module.text);
          let parent = node.parent; let topLevel = true;
          while (parent) { if (['function_definition', 'class_definition'].includes(parent.type)) topLevel = false; parent = parent.parent; }
          for (const child of names) {
            const imported = child.childForFieldName('name')?.text ?? child.text;
            const local = child.childForFieldName('alias')?.text ?? (module ? imported : imported.split('.')[0]!);
            const dependency = module ? relativePackage ? `${module.text}${imported}` : module.text : imported;
            if (!module || relativePackage) record.imports.push(dependency);
            record.bindings ??= [];
            record.bindings.push({ local, imported: !module || relativePackage ? '*' : imported, module: dependency, ...(topLevel && !local.startsWith('_') ? { exported: local } : {}) });
          }
          if (node.namedChildren.some(child => child?.type === 'wildcard_import')) { record.exportStars ??= []; if (module) record.exportStars.push(module.text); }
        }
        if (language === 'rust' && node.type === 'mod_item' && !node.childForFieldName('body')) record.imports.push(`mod:${node.childForFieldName('name')?.text ?? ''}`);
        if (language === 'rust' && node.type === 'use_declaration') {
          const argument = node.childForFieldName('argument'); if (argument) record.imports.push(...rustUses(argument));
          if (argument && node.namedChildren.some(child => child?.type === 'visibility_modifier' && child.text === 'pub')) {
            const path = argument.type === 'use_as_clause' ? argument.childForFieldName('path') : argument;
            const imported = path?.text.split('::').at(-1); const exported = argument.childForFieldName('alias')?.text ?? imported;
            if (imported && exported && path) { record.bindings ??= []; record.bindings.push({ local: exported, imported, module: `use:${path.text}`, exported }); }
          }
        }
        if (language === 'c-sharp' && node.type === 'using_directive') record.imports.push(node.namedChildren.at(-1)?.text ?? '');
        if (language === 'rust' && node.type === 'function_item') {
          let previous = node.previousNamedSibling;
          while (previous?.type === 'attribute_item') {
            if (previous.text.includes('tauri::command')) add(record, 'framework', `command:${node.childForFieldName('name')!.text}`, node.text, { framework: 'tauri', operation: 'command', target: node.childForFieldName('name')!.text, conditional: conditionalRust(node) });
            if (previous.text.includes('cfg')) incomplete(record, 'repository', 'Rust cfg selection requires the build feature and platform configuration.');
            previous = previous.previousNamedSibling;
          }
        }
        if (language === 'rust' && node.type === 'macro_invocation') {
          const macro = node.childForFieldName('macro')?.text;
          if (macro === 'tauri::generate_handler') { for (const child of node.namedChildren.find(child => child?.type === 'token_tree')?.namedChildren ?? []) if (child?.type === 'identifier' && child.nextSibling?.text !== '::') add(record, 'framework', `registration:${child.text}`, node.text, { framework: 'tauri', operation: 'registration', target: child.text, conditional: conditionalRust(node) || /\bcfg(?:_attr)?\b/.test(node.text) }); }
          else incomplete(record, 'repository', 'Macro expansion requires generated evidence.');
        }
        if (language === 'python' && node.type === 'call' && ['__import__', 'importlib.import_module', 'sys.path.insert', 'sys.path.append'].includes(node.childForFieldName('function')?.text ?? '')) incomplete(record, 'repository', 'Dynamic imports or search-path mutation require runtime evidence.');
        if (language === 'c-sharp' && ['namespace_declaration', 'file_scoped_namespace_declaration'].includes(node.type)) record.units[0]!.data = { ...record.units[0]!.data, namespace: node.childForFieldName('name')?.text };
      });
    } catch (error) { if (error instanceof ExtractionDeadline) incomplete(record, 'syntax', 'Semantic extraction exceeded its deadline.'); else throw error; }
    finally { tree.delete(); }
  } };
}
const htmlProvider: DocumentProvider = { id: 'html', version: '8.0.1', role: 'primary', domains: ['markup'], capabilities: { syntax: 'complete', units: 'complete', dependencies: 'partial', repository: 'partial', crossDomain: 'partial' }, claims: path => /\.html?$/.test(path), extract(record) {
  record.language = 'html';
  const document = parseHtml(record.source, { sourceCodeLocationInfo: true, onParseError: error => { if (error.code !== 'missing-doctype') incomplete(record, 'syntax', error.code); } });
  const visit = (node: typeof document | typeof document.childNodes[number]): void => {
    if ('attrs' in node) for (const attribute of node.attrs) {
      if (attribute.name === 'id') add(record, 'markup', attribute.value, '', { tag: node.nodeName });
      if (attribute.name === 'class') for (const name of attribute.value.split(/\s+/).filter(Boolean)) add(record, 'markup', `class:${name}:${record.units.length}`, '', { selector: `.${name}` });
      if (['src', 'href'].includes(attribute.name) && !/^(?:[a-z]+:|\/\/)/i.test(attribute.value)) {
        const [path, anchor] = attribute.value.split('#');
        if (path) record.imports.push(path);
        if (anchor) record.references.push({ text: `artifact:markup:${addressPath(path ? posix.normalize(posix.join(posix.dirname(record.path), path)) : record.path)}#${component(anchor)}`, from: record.units[0]!.id, path: record.path, offset: 0, kind: 'dependency' });
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }; visit(document);
} };
const cssProvider: DocumentProvider = { id: 'stylesheet', version: '8.5.28/4.0.9/7.1.6', role: 'primary', domains: ['style'], capabilities: { syntax: 'complete', units: 'complete', dependencies: 'partial', repository: 'partial', crossDomain: 'partial' }, claims: path => /\.(css|scss)$/.test(path), extract(record) {
  record.language = record.path.endsWith('.scss') ? 'scss' : 'css';
  try {
    const root = record.language === 'scss' ? scss.parse(record.source, { from: record.path }) : postcss.parse(record.source, { from: record.path });
    root.walkRules(rule => { selectorParser(selectors => { selectors.walkClasses(node => { add(record, 'style', node.value, rule.toString(), { selector: `.${node.value}` }); }); selectors.walkIds(node => { add(record, 'style', `id:${node.value}`, rule.toString(), { selector: `#${node.value}` }); }); }).processSync(rule.selector); });
    root.walkDecls(declaration => { if (/^(--|\$)/.test(declaration.prop)) add(record, 'style', declaration.prop, declaration.toString()); });
    root.walkAtRules(rule => { if (['import', 'use', 'forward'].includes(rule.name)) { const match = /^['"]([^'"]+)['"]/.exec(rule.params); if (match) record.imports.push(match[1]!); else incomplete(record, 'dependencies', 'Dynamic stylesheet import.'); } });
    if (record.language === 'scss') incomplete(record, 'crossDomain', 'SCSS compilation and interpolation are not proven by source parsing.');
  } catch (error) { if (error instanceof postcss.CssSyntaxError || error instanceof Error && error.name === 'SyntaxError') incomplete(record, 'syntax', error.message); else throw error; }
} };
const configProvider: DocumentProvider = { id: 'configuration', version: 'xml-5.11.1/toml-5/yaml-2.9.1', role: 'primary', domains: ['configuration', 'framework'], capabilities: { syntax: 'complete', units: 'complete', dependencies: 'partial', repository: 'partial', crossDomain: 'partial' }, claims: path => /\.(json|toml|xml|ya?ml|csproj|props|targets)$/.test(path), extract(record) {
  record.language = 'configuration';
  try {
    if (/\.(xml|csproj|props|targets)$/.test(record.path)) { const validation = XMLValidator.validate(record.source); if (validation !== true) { incomplete(record, 'syntax', validation.err.msg); return; } }
    const yaml = /\.ya?ml$/.test(record.path) ? parseDocument(record.source) : undefined;
    if (yaml?.errors.length) { incomplete(record, 'syntax', yaml.errors.map(error => error.message).join('\n')); return; }
    const value: unknown = yaml ? yaml.toJSON() : record.path.endsWith('.toml') ? toml.parse(record.source) : /\.(xml|csproj|props|targets)$/.test(record.path) ? new XMLParser({ ignoreAttributes: false }).parse(record.source) : JSON.parse(record.source);
    record.units[0]!.data = { ...record.units[0]!.data, configuration: value };
    add(record, 'configuration', 'document', record.source, { configuration: value });
    if (value && typeof value === 'object') {
      if (/tauri\.conf\.(json|toml)$/.test(record.path)) {
        const config = value as { build?: { frontendDist?: string; beforeBuildCommand?: string; beforeDevCommand?: string }; bundle?: { resources?: string[] | Record<string, string> }; plugins?: Record<string, unknown>; app?: { security?: { capabilities?: unknown[] } } };
        for (const [name, target] of Object.entries(config.build ?? {})) add(record, 'framework', `build:${name}`, JSON.stringify(target), { framework: 'tauri', operation: 'build', target });
        for (const resource of Array.isArray(config.bundle?.resources) ? config.bundle.resources : Object.keys(config.bundle?.resources ?? {})) record.imports.push(resource);
        for (const [name, configuration] of Object.entries(config.plugins ?? {})) add(record, 'framework', `plugin:${name}`, JSON.stringify(configuration), { framework: 'tauri', operation: 'plugin-declaration', target: name });
        for (const [index, capability] of (config.app?.security?.capabilities ?? []).entries()) add(record, 'framework', `capability:${index}`, JSON.stringify(capability), { framework: 'tauri', operation: 'capability' });
      }
      if (posix.basename(record.path) === 'package.json') {
        const config = value as { codegenConfig?: unknown; 'react-native'?: string; dependencies?: Record<string, string> };
        if (config.codegenConfig) add(record, 'framework', 'codegen', JSON.stringify(config.codegenConfig), { framework: 'react-native', operation: 'codegen-configuration' });
        if (config['react-native']) record.imports.push(config['react-native']);
      }
      if (record.path.includes('/capabilities/') && record.path.endsWith('.json')) add(record, 'framework', 'capability', record.source, { framework: 'tauri', operation: 'capability' });
    }
  } catch (error) { if (error instanceof Error) incomplete(record, 'syntax', error.message); else throw error; }
} };

let runtimePromise: Promise<Map<string, treeSitter.Language>> | undefined;
function runtime(): Promise<Map<string, treeSitter.Language>> {
  return runtimePromise ??= (async () => {
    const require = createRequire(import.meta.url), wasmRoot = dirname(require.resolve('@vscode/tree-sitter-wasm'));
    await treeSitter.Parser.init({ locateFile: file => join(wasmRoot, file) });
    const languages = new Map<string, treeSitter.Language>();
    for (const name of ['c-sharp', 'rust', 'python']) languages.set(name, await treeSitter.Language.load(join(wasmRoot, `tree-sitter-${name}.wasm`)));
    return languages;
  })();
}
export async function createDocumentIntelligence(options: { providers?: DocumentProvider[] } = {}) {
  const languages = await runtime();
  const parsers = [...languages].map(([language, grammar]) => { const parser = new treeSitter.Parser(); parser.setLanguage(grammar); return languageProvider(language, parser); });
  const legacy: DocumentProvider = { id: 'legacy', version: '1', role: 'primary', domains: ['code', 'markdown'], capabilities: { syntax: 'complete', units: 'complete', dependencies: 'partial', repository: 'partial', crossDomain: 'partial' }, claims: path => /\.(?:md|[cm]?[jt]s|[jt]sx)$/.test(path), extract() {} };
  const supplements: DocumentProvider[] = ['tauri', 'react-native', 'react-web'].map(framework => ({ id: framework, version: '1', role: 'supplement', domains: framework === 'react-native' ? ['framework', 'framework-style'] : framework === 'react-web' ? ['markup', 'style'] : ['framework'], capabilities: { crossDomain: 'partial' }, claims: path => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(path), extract: record => supplementFramework(record, framework) }));
  const providers = [...parsers, legacy, htmlProvider, cssProvider, configProvider, ...supplements, ...(options.providers ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(providers.map(provider => provider.id)).size !== providers.length) throw new Error('Document provider IDs must be unique.');
  return { fingerprint: hash(`${DOCUMENT_INTELLIGENCE_VERSION}\n${providers.map(provider => `${provider.id}:${provider.version}`).join('\n')}`),
    providers: providers.map(provider => ({ id: provider.id, version: provider.version, role: provider.role, domains: provider.domains ?? [], capabilities: provider.capabilities ?? {} })),
    dispose() { for (const provider of providers) provider.dispose?.(); },
    async extract(path: string, input: string | Uint8Array): Promise<FileRecord> {
      const bytes = typeof input === 'string' ? Buffer.from(input) : input; const digest = createHash('sha256').update(bytes).digest('hex');
      if (typeof input !== 'string' && bytes.includes(0)) return metadataFile(path, digest, bytes.byteLength);
      let source: string;
      try { source = typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input); }
      catch (error) { if (error instanceof TypeError) return metadataFile(path, digest, bytes.byteLength); throw error; }
      const record = extractFile(path, source); record.hash = digest; record.byteLength = bytes.byteLength;
      record.units[0]!.bodyHash = digest; record.units[0]!.contractHash = digest; record.units[0]!.data = { textAvailable: true, byteLength: bytes.byteLength };
      record.capabilities = { syntax: 'complete', units: 'complete', dependencies: 'complete', repository: 'complete', crossDomain: 'complete' }; record.providers = [];
      if (record.diagnostics.length) record.capabilities.syntax = 'partial';
      const claimed = providers.filter(provider => provider.claims(path)); const primary = claimed.filter(provider => provider.role === 'primary');
      const chosen = primary.filter(provider => !primary.some(other => other.replaces === provider.id));
      if (chosen.length > 1) throw new Error(`Primary provider conflict for ${path}: ${chosen.map(provider => provider.id).join(', ')}`);
      if (chosen[0]?.replaces === 'legacy') { record.units.splice(1); record.references = []; record.diagnostics = []; record.imports = []; record.bindings = []; record.exportStars = []; }
      for (const provider of [...chosen, ...claimed.filter(provider => provider.role === 'supplement')]) {
        const before = provider.role === 'supplement' ? structuredClone(record) : undefined;
        await provider.extract(record);
        if (before) validateSupplement(before, record, provider.id);
        record.providers.push(`${provider.id}:${provider.version}`);
      }
      if (!chosen.length && record.language === 'opaque') record.capabilities = { syntax: 'unknown', units: 'unknown', dependencies: 'unknown', repository: 'unknown', crossDomain: 'unknown' };
      record.extractionCapabilities = { ...record.capabilities };
      return record;
    }, resolveRepository,
  };
}
class ExtractionDeadline extends Error {}
function validateSupplement(before: FileRecord, after: FileRecord, provider: string): void {
  const additive = ['units', 'references', 'diagnostics', 'imports', 'bindings', 'exportStars'] as const;
  const immutable = (record: FileRecord): object => Object.fromEntries(Object.entries(record).filter(([key]) => ![...additive, 'capabilities'].includes(key)));
  if (JSON.stringify(immutable(before)) !== JSON.stringify(immutable(after))) throw new Error(`Supplement ${provider} overwrote primary metadata for ${before.path}.`);
  for (const key of additive) {
    const old = before[key] ?? [], current = after[key] ?? [];
    if (JSON.stringify(current.slice(0, old.length)) !== JSON.stringify(old)) throw new Error(`Supplement ${provider} overwrote primary ${key} for ${before.path}.`);
  }
  const rank = { complete: 0, partial: 1, unknown: 2 };
  for (const [capability, completeness] of Object.entries(before.capabilities ?? {})) {
    const current = after.capabilities?.[capability as keyof NonNullable<FileRecord['capabilities']>];
    if (!current || !(current in rank) || rank[current] < rank[completeness]) throw new Error(`Supplement ${provider} hid incomplete ${capability} facts for ${before.path}.`);
  }
  const ids = new Set(before.units.map(unit => unit.id)), addresses = new Set(before.units.map(unit => unit.address));
  for (const unit of after.units.slice(before.units.length)) {
    if (unit.path !== before.path) throw new Error(`Supplement ${provider} assigned facts to a different input file: ${unit.path}`);
    if (ids.has(unit.id) || addresses.has(unit.address)) throw new Error(`Supplement ${provider} collided with an existing unit in ${before.path}: ${unit.address}`);
    ids.add(unit.id); addresses.add(unit.address);
  }
}
interface TauriOperation { operation: string; injected?: boolean; roots?: string[] }
function tauriOperations(source: ts.SourceFile, record: FileRecord): Map<string, TauriOperation> {
  const operations = new Map<string, TauriOperation>(), objects = new Set<string>();
  const unprovenWrites = new Set<string>();
  const declarations = new Map<string, number>(); const nodes: ts.Node[] = [];
  const collect = (node: ts.Node): void => {
    nodes.push(node);
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) declarations.set(node.name.text, (declarations.get(node.name.text) ?? 0) + 1);
    ts.forEachChild(node, collect);
  }; collect(source);
  const context = (node: ts.Node): string => { for (let parent: ts.Node | undefined = node; parent; parent = parent.parent) if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) return parent.name?.text ?? `class:${parent.pos}`; return ''; };
  const key = (expression: ts.Node): string => { const text = expression.getText(source); return text.startsWith('this.') ? `${context(expression)}:${text}` : text; };
  const unwrap = (expression: ts.Expression): ts.Expression => ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression) ? unwrap(expression.expression) : expression;
  for (const binding of record.bindings ?? []) if (binding.module.startsWith('@tauri-apps/api/') && !declarations.has(binding.local)) {
    if (['invoke', 'listen', 'emit'].includes(binding.imported)) operations.set(binding.local, { operation: binding.imported, roots: [binding.local] });
    if (binding.imported === '*') for (const operation of ['invoke', 'listen', 'emit']) operations.set(`${binding.local}.${operation}`, { operation, roots: [binding.local] });
  }
  const origin = (expression: ts.Expression): TauriOperation | undefined => {
    expression = unwrap(expression); const known = operations.get(key(expression)); if (known) return known;
    if (ts.isPropertyAccessExpression(expression) && objects.has(key(unwrap(expression.expression))) && ['invoke', 'listen', 'emit'].includes(expression.name.text)) return { operation: expression.name.text, roots: [key(unwrap(expression.expression))] };
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      const fallback = origin(expression.right); if (fallback) return { ...fallback, injected: true };
    }
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
      const body = ts.isBlock(expression.body) && expression.body.statements.length === 1 && ts.isReturnStatement(expression.body.statements[0]!) ? expression.body.statements[0]!.expression : ts.isBlock(expression.body) ? undefined : expression.body;
      if (body && ts.isCallExpression(body) && body.arguments[0]?.getText(source) === expression.parameters[0]?.name.getText(source)) return origin(body.expression);
    }
    return undefined;
  };
  for (let pass = 0; pass < 3; pass++) for (const node of nodes) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && declarations.get(node.name.text) === 1) {
      const value = unwrap(node.initializer);
      if (ts.isPropertyAccessExpression(value) && value.name.text === '__TAURI_INTERNALS__' && unwrap(value.expression).getText(source) === 'window') objects.add(node.name.text);
      const operation = origin(value); if (operation) operations.set(node.name.text, { ...operation, roots: [...new Set([...(operation.roots ?? []), node.name.text])] });
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(source).startsWith('this.')) { const operation = origin(node.right); if (operation) operations.set(key(node.left), { ...operation, roots: [...new Set([...(operation.roots ?? []), key(node.left)])] }); }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      const owner = nodes.find(candidate => ts.isClassDeclaration(candidate) && candidate.name?.text === node.expression.getText(source)) as ts.ClassDeclaration | undefined;
      const constructor = owner?.members.find(ts.isConstructorDeclaration);
      for (const [index, argument] of (node.arguments ?? []).entries()) {
        if (!ts.isObjectLiteralExpression(argument)) continue;
        const parameter = constructor?.parameters[index];
        if (!parameter || !ts.isIdentifier(parameter.name) || !parameter.modifiers?.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind))) continue;
        for (const property of argument.properties) if (ts.isPropertyAssignment(property)) { const operation = origin(property.initializer); const target = `${node.expression.text}:this.${parameter.name.text}.${property.name.getText(source)}`; if (operation) operations.set(target, { ...operation, injected: true, roots: [...new Set([...(operation.roots ?? []), target])] }); }
      }
    }
  }
  for (const node of nodes) if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && (ts.isIdentifier(node.left) || node.left.getText(source).startsWith('this.')) && node.right.kind !== ts.SyntaxKind.NullKeyword && !origin(node.right)) unprovenWrites.add(key(node.left));
  for (const target of unprovenWrites) operations.delete(target);
  // Lookup keys retain the lexical class owner for this-based injected wrappers.
  const result = new Map<string, TauriOperation>();
  for (const node of nodes) if (ts.isCallExpression(node)) { const operation = origin(node.expression); if (operation && !unprovenWrites.has(key(node.expression)) && !operation.roots?.some(root => [...unprovenWrites].some(write => root === write || root.startsWith(`${write}.`)))) result.set(String(node.pos), operation); }
  return result;
}

function supplementFramework(record: FileRecord, framework: string): void {
  if (record.language !== 'typescript') return;
  const native = record.bindings?.some(binding => binding.module === 'react-native') || /\b(?:StyleSheet|NativeModules)\b/.test(record.source);
  const source = ts.createSourceFile(record.path, record.source, ts.ScriptTarget.Latest, true, /tsx$/.test(record.path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const operations = tauriOperations(source, record);
  const visit = (node: ts.Node): void => {
    if (framework === 'react-native' && /(?:metro|babel|react-native|app)\.config\.[cm]?[jt]s$/.test(record.path) && ts.isPropertyAssignment(node)) {
      const key = node.name.getText(source).replace(/^['"]|['"]$/g, '');
      if (['assetExts', 'sourceExts', 'resolver', 'transformer', 'plugins', 'presets', 'assets', 'platforms'].includes(key)) {
        add(record, 'configuration', `${key}:${node.pos}`, node.getText(source), { framework: 'react-native', property: key });
        if (ts.isArrayLiteralExpression(node.initializer) && ['assets'].includes(key)) for (const item of node.initializer.elements) if (ts.isStringLiteralLike(item)) record.imports.push(item.text); else incomplete(record, 'crossDomain', 'Computed native asset configuration.');
      }
    }
    if (framework === 'react-native' && ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'NativeModules') add(record, 'framework', `native-module:${node.name.text}:${node.pos}`, node.getText(source), { framework: 'react-native', operation: 'native-module', target: node.name.text });
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(source);
      if (framework === 'react-native' && expression === 'require' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) { record.imports.push(node.arguments[0].text); add(record, 'framework', `resource:${node.pos}`, node.getText(source), { operation: 'resource', target: node.arguments[0].text }); }
      if (framework === 'react-native' && expression === 'StyleSheet.create' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) for (const property of node.arguments[0].properties) if (property.name) {
        const owner = ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(source) : `anonymous:${node.pos}`;
        add(record, 'framework-style', `${owner}.${property.name.getText(source).replace(/^['"]|['"]$/g, '')}`, property.getText(source), { framework: 'react-native', owner, exported: ts.isVariableDeclaration(node.parent) && ts.isVariableDeclarationList(node.parent.parent) && ts.isVariableStatement(node.parent.parent.parent) && node.parent.parent.parent.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) });
      }
      if (framework === 'tauri' && operations.has(String(node.pos))) {
        const first = node.arguments[0];
        if (first && ts.isStringLiteralLike(first)) add(record, 'framework', `${expression}:${first.text}:${node.pos}`, node.getText(source), { framework: 'tauri', operation: operations.get(String(node.pos))!.operation, injected: operations.get(String(node.pos))!.injected, target: first.text, binding: expression });
        else incomplete(record, 'crossDomain', `Dynamic ${expression} target.`);
      }
    }
    if (framework === 'react-web' && ts.isJsxAttribute(node) && node.name.getText(source) === 'className') {
      if (node.initializer && ts.isStringLiteral(node.initializer)) for (const name of node.initializer.text.split(/\s+/).filter(Boolean)) add(record, 'markup', `class:${name}:${node.pos}`, node.getText(source), { selector: `.${name}` });
      else incomplete(record, 'crossDomain', 'Dynamic JSX class selection.');
    }
    if (framework === 'react-native' && ts.isJsxAttribute(node) && node.name.getText(source) === 'style') {
      const targets: string[] = []; let dynamic = false;
      const style = (expression: ts.Node): void => {
        if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) targets.push(expression.getText(source));
        else if (ts.isObjectLiteralExpression(expression)) add(record, 'framework-style', `inline:${expression.pos}`, expression.getText(source), { framework: 'react-native' });
        else if (ts.isJsxExpression(expression)) { if (expression.expression) style(expression.expression); }
        else if (ts.isArrayLiteralExpression(expression)) expression.elements.forEach(style);
        else if (ts.isStringLiteral(expression)) { /* StatusBar style is a literal prop, not a StyleSheet relation. */ }
        else dynamic = true;
      };
      if (node.initializer) style(node.initializer);
      add(record, 'framework-style', `usage:${node.pos}`, node.getText(source), { framework: native ? 'react-native' : 'react', expression: node.initializer?.getText(source), targets });
      if (dynamic) incomplete(record, 'crossDomain', 'Dynamic style composition requires runtime evidence.');
    }
    ts.forEachChild(node, visit);
  }; visit(source);
}

export function resolveRepository(input: ReadonlyMap<string, FileRecord>): ReadonlyMap<string, FileRecord> {
  const records = new Map<string, FileRecord>([...input].map(([path, record]) => [path, { ...record, references: record.references.filter(reference => !reference.derived), resolvedImports: ['typescript', 'markdown', 'opaque'].includes(record.language ?? 'opaque') ? undefined : {}, diagnostics: record.diagnostics.filter(diagnostic => !diagnostic.code.startsWith('repository-resolution-')), capabilities: { ...(record.extractionCapabilities ?? record.capabilities) } }]));
  const unknown = (record: FileRecord, capability: 'repository' | 'crossDomain', message: string): void => { record.capabilities![capability] = 'partial'; record.diagnostics.push({ code: `repository-resolution-${capability}-unknown`, path: record.path, message }); };
  const files = [...records.values()];
  const fingerprint = hash(`${DOCUMENT_INTELLIGENCE_VERSION}\n${files.filter(file => file.language === 'configuration').map(file => `${file.path}:${file.hash}`).sort().join('\n')}`);
  for (const record of files) {
    record.repositoryFingerprint = fingerprint;
    if (['typescript', 'markdown', 'opaque'].includes(record.language ?? 'opaque')) continue;
    const configs = files.filter(file => file.language === 'configuration');
    const owner = (name: string): FileRecord | undefined => configs.filter(file => posix.basename(file.path) === name && (record.path.startsWith(`${posix.dirname(file.path)}/`) || posix.dirname(file.path) === '.')).sort((a, b) => b.path.length - a.path.length)[0];
    const cargo = owner('Cargo.toml');
    const csProjects = configs.filter(file => file.path.endsWith('.csproj') && (posix.dirname(file.path) === '.' || record.path.startsWith(`${posix.dirname(file.path)}/`))).sort((a, b) => posix.dirname(b.path).length - posix.dirname(a.path).length);
    const csProject = csProjects[0] && csProjects.filter(file => posix.dirname(file.path) === posix.dirname(csProjects[0]!.path)).length === 1 ? csProjects[0] : undefined;
    if (record.language === 'c-sharp' && !csProject) unknown(record, 'repository', 'The owning C# project is missing or ambiguous.');
    if (record.language === 'c-sharp' && csProject) {
      const configuration = csProject.units[0]?.data?.configuration as { Project?: { ItemGroup?: unknown; PropertyGroup?: unknown } } | undefined;
      const text = JSON.stringify(configuration);
      if (/Condition|Import|\$\(|Update/.test(text)) unknown(record, 'repository', 'MSBuild conditions, imported properties, or computed compile items need project evaluation.');
    }
    for (const module of record.imports) {
      let candidates: FileRecord[] = [];
      if (record.language === 'python') {
        const dots = /^\.+/.exec(module)?.[0].length ?? 0; let root = posix.dirname(record.path);
        for (let i = 1; i < dots; i++) root = posix.dirname(root);
        const target = module.slice(dots).replaceAll('.', '/');
        const pyproject = owner('pyproject.toml');
        const config = pyproject?.units[0]?.data?.configuration as { tool?: { setuptools?: { packages?: { find?: { where?: string[] } }; 'package-dir'?: Record<string, string> }; poetry?: { packages?: { from?: string; include?: string }[] }; pyright?: { extraPaths?: string[] } } } | undefined;
        const base = pyproject ? posix.dirname(pyproject.path) : '.';
        const roots = [...new Set([base, ...Object.values(config?.tool?.setuptools?.['package-dir'] ?? {}).map(path => posix.join(base, path)), ...(config?.tool?.setuptools?.packages?.find?.where ?? []).map(path => posix.join(base, path)), ...(config?.tool?.poetry?.packages ?? []).map(item => posix.join(base, item.from ?? '.')), ...(config?.tool?.pyright?.extraPaths ?? []).map(path => posix.join(base, path))])];
        const paths = dots ? [posix.join(root, `${target}.py`), posix.join(root, target, '__init__.py')] : roots.flatMap(directory => [posix.join(directory, `${target}.py`), posix.join(directory, target, '__init__.py')]);
        candidates = files.filter(file => file.language === 'python' && paths.includes(file.path));
      } else if (record.language === 'rust') {
        const name = module.replace(/^(mod|use):/, '').split('::')[0]!;
        const moduleRoot = ['lib.rs', 'main.rs', 'mod.rs'].includes(posix.basename(record.path)) ? posix.dirname(record.path) : posix.join(posix.dirname(record.path), posix.basename(record.path, '.rs'));
        if (module.startsWith('mod:')) candidates = files.filter(file => [posix.join(moduleRoot, `${name}.rs`), posix.join(moduleRoot, name, 'mod.rs')].includes(file.path));
        else {
          const cargoRoot = cargo ? posix.dirname(cargo.path) : posix.dirname(record.path);
          const segment = module.replace(/^use:/, '').split('::');
          const local = ['crate', 'self', 'super'].includes(name);
          const target = segment[local ? 1 : 0];
          if (local) {
            const base = name === 'crate' ? posix.join(cargoRoot, 'src') : name === 'super' ? posix.dirname(moduleRoot) : moduleRoot;
            const paths = [posix.join(base, `${target}.rs`), posix.join(base, target ?? '', 'mod.rs')];
            candidates = files.filter(file => file.language === 'rust' && (paths.includes(file.path) || file.path === record.path && file.units.some(unit => unit.kind === 'symbol' && unit.name === target)));
          }
          else {
            const config = cargo?.units[0]?.data?.configuration as { dependencies?: Record<string, string | { path?: string; workspace?: boolean }>; workspace?: { dependencies?: Record<string, string | { path?: string }> } } | undefined;
            let dependency = config?.dependencies?.[name.replaceAll('_', '-')]; let dependencyRoot = cargoRoot;
            if (dependency && typeof dependency === 'object' && dependency.workspace) {
              const workspace = configs.find(file => posix.basename(file.path) === 'Cargo.toml' && file.units[0]?.data?.configuration && typeof file.units[0].data.configuration === 'object' && 'workspace' in file.units[0].data.configuration);
              dependency = (workspace?.units[0]?.data?.configuration as typeof config)?.workspace?.dependencies?.[name.replaceAll('_', '-')]; dependencyRoot = workspace ? posix.dirname(workspace.path) : cargoRoot;
            }
            if (dependency && typeof dependency === 'object' && dependency.path) candidates = files.filter(file => file.path === posix.join(dependencyRoot, dependency.path!, 'src/lib.rs'));
            else unknown(record, 'repository', 'External Cargo dependency and feature resolution is not established for this import.');
          }
        }
      } else if (record.language === 'c-sharp') {
        const root = csProject ? posix.dirname(csProject.path) : '';
        const references = csProject ? csItems(csProject, 'ProjectReference').flatMap(reference => reference['@_Include'] ? [records.get(posix.normalize(posix.join(root, slash(reference['@_Include']))))].filter((file): file is FileRecord => Boolean(file)) : []) : [];
        candidates = csProject ? files.filter(file => file.language === 'c-sharp' && file.units[0]?.data?.namespace === module && [csProject, ...references].some(project => csIncludes(project, file.path))) : [];
      }
      else {
        const target = posix.normalize(posix.join(posix.dirname(record.path), module));
        const paths = [target];
        if (record.language === 'scss' && !posix.extname(target)) paths.push(`${target}.scss`, `${target}.css`, posix.join(posix.dirname(target), `_${posix.basename(target)}.scss`));
        candidates = files.filter(file => paths.includes(file.path) || record.language === 'configuration' && (module.includes('*') ? matchesGlob(file.path, target) : file.path.startsWith(`${target}/`)));
      }
      record.resolvedImports![module] = candidates.map(file => file.path);
      if (!candidates.length) { record.capabilities!.repository = 'partial'; record.diagnostics.push({ code: 'repository-resolution-unknown', message: `The repository cannot resolve ${module}.`, path: record.path }); }
    }
  }
  for (const record of files) {
    for (const unit of record.units) {
      if (unit.data?.domain === 'markup' && typeof unit.data.selector === 'string') {
        const pending = record.imports.filter(module => module.startsWith('.') || record.language === 'html').map(module => posix.normalize(posix.join(posix.dirname(record.path), module)));
        const reached = new Set<string>();
        while (pending.length) { const path = pending.pop()!; if (reached.has(path)) continue; reached.add(path); const file = records.get(path); if (file?.language === 'css' || file?.language === 'scss') for (const target of Object.values(file.resolvedImports ?? {}).flat()) pending.push(target); }
        const candidates = files.filter(file => reached.has(file.path)).flatMap(file => file.units).filter(candidate => candidate.data?.domain === 'style' && candidate.data.selector === unit.data!.selector);
        for (const candidate of candidates) record.references.push({ text: candidate.address, from: unit.id, path: record.path, offset: 0, kind: 'dependency', derived: true });
        if (!candidates.length) { record.capabilities!.crossDomain = 'partial'; record.diagnostics.push({ code: 'repository-resolution-framework-unknown', path: record.path, address: unit.address, message: 'Markup class has no static declaration in its imported stylesheet graph.' }); }
      }
      if (['react-native', 'react'].includes(String(unit.data?.framework)) && Array.isArray(unit.data?.targets)) for (const target of unit.data!.targets as string[]) {
        const [owner] = target.split('.'); const binding = record.bindings?.find(binding => binding.local === owner);
        let targetFile = binding ? resolveModule(binding.module, record, files) : record;
        if (!targetFile && binding?.module.startsWith('.')) {
          const root = posix.normalize(posix.join(posix.dirname(record.path), binding.module));
          const platform = /\.(android|ios|native)\.[jt]sx?$/.exec(record.path)?.[1];
          const variants = platform ? [`.${platform}.tsx`, `.${platform}.ts`, '.native.tsx', '.native.ts'] : ['.native.tsx', '.native.ts'];
          const paths = [...variants, '.tsx', '.ts', '/index.tsx', '/index.ts'].map(extension => root + extension);
          const found = paths.map(path => records.get(path)).find(file => file !== undefined);
          if (!platform && files.some(file => file.path === `${root}.android.ts` || file.path === `${root}.ios.ts` || file.path === `${root}.android.tsx` || file.path === `${root}.ios.tsx`)) unknown(record, 'crossDomain', 'Platform-specific style files require a selected platform.');
          targetFile = found;
        }
        const declared = targetFile?.units.filter(candidate => candidate.data?.domain === 'framework-style' && candidate.name === (binding ? target.replace(`${owner}.`, `${binding.imported}.`) : target));
        if (declared?.length === 1) record.references.push({ text: declared[0]!.address, from: unit.id, path: record.path, offset: 0, kind: 'dependency', derived: true });
        else { record.capabilities!.crossDomain = 'partial'; record.diagnostics.push({ code: 'repository-resolution-framework-unknown', path: record.path, address: unit.address, message: `Style use ${target} has no unique static declaration.` }); }
      }
      if (unit.data?.framework === 'tauri' && unit.data.operation === 'invoke') {
        const frontendRoot = (file: FileRecord): string => {
          const directory = posix.dirname(file.path);
          if (posix.basename(directory) === 'src-tauri') return posix.dirname(directory);
          const target = file.units.find(candidate => candidate.data?.operation === 'build' && candidate.name === 'build:frontendDist')?.data?.target;
          if (typeof target !== 'string' || /^(?:[a-z]+:|[/\\])/i.test(target)) return directory;
          const configured = posix.normalize(posix.join(directory, target));
          return configured === '..' || configured.startsWith('../') ? directory : configured;
        };
        const configurations = files.filter(file => /tauri\.conf\.(json|toml)$/.test(file.path) && (frontendRoot(file) === '.' || record.path.startsWith(`${frontendRoot(file)}/`))).sort((a, b) => frontendRoot(b).length - frontendRoot(a).length);
        const configuration = configurations[0] && (!configurations[1] || frontendRoot(configurations[0]).length > frontendRoot(configurations[1]).length) ? configurations[0] : undefined;
        const root = configuration ? posix.dirname(configuration.path) : '';
        const eligible = configuration ? files.filter(file => root === '.' || file.path.startsWith(`${root}/`)).flatMap(file => file.units) : [];
        const commands = eligible.filter(candidate => candidate.data?.framework === 'tauri' && candidate.data.operation === 'command' && candidate.data.target === unit.data!.target);
        const registrations = eligible.filter(candidate => candidate.data?.framework === 'tauri' && candidate.data.operation === 'registration' && candidate.data.target === unit.data!.target);
        if (commands.length === 1 && registrations.length === 1 && !commands[0]!.data?.conditional && !registrations[0]!.data?.conditional) {
          record.references.push({ text: commands[0]!.address, from: unit.id, path: record.path, offset: 0, kind: 'dependency', derived: true });
          if (unit.data.injected) { record.capabilities!.crossDomain = 'partial'; record.diagnostics.push({ code: 'repository-resolution-framework-unknown', path: record.path, address: unit.address, message: 'Injected invocation override needs runtime evidence; the static default targets Tauri.' }); }
        }
        else { record.capabilities!.crossDomain = 'partial'; record.diagnostics.push({ code: 'repository-resolution-framework-unknown', path: record.path, address: unit.address, message: 'Tauri invocation needs an unambiguous command declaration and registration.' }); }
      }
      if (unit.data?.operation === 'native-module') { record.capabilities!.crossDomain = 'partial'; record.diagnostics.push({ code: 'repository-resolution-framework-unknown', path: record.path, address: unit.address, message: 'NativeModules access requires platform registration or generated binding evidence.' }); }
    }
  }
  return records;
}
