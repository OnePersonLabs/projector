import { posix } from 'node:path';
import ts from 'typescript';
import type { FileRecord, Resolution, ResolveOptions, Unit } from './types.ts';
import { component, normalizeName, populationHash, slash } from './common.ts';

function moduleResolution(specifier: string, from: FileRecord, files: FileRecord[], options: ResolveOptions): { file?: FileRecord; reason?: string } {
  const fileMap = options.fileMap ?? new Map(files.map(file => [file.path, file]));
  const base = '/projector';
  const aliases = Object.entries(options.packages ?? {}).map(([name, pkg]) => ({ prefix: `node_modules/${name}`, ...pkg }));
  const physical = (fileName: string): string => {
    const relative = posix.relative(base, slash(fileName));
    const alias = aliases.find(candidate => relative.startsWith(`${candidate.prefix}/`));
    return alias ? posix.join(alias.root, relative.slice(alias.prefix.length + 1)) : relative;
  };
  const readFile = (fileName: string): string | undefined => {
    const relative = posix.relative(base, slash(fileName));
    const alias = aliases.find(candidate => relative === `${candidate.prefix}/package.json`);
    return fileMap.get(physical(fileName))?.source ?? (alias ? JSON.stringify({ type: 'module', exports: alias.exports }) : undefined);
  };
  let compilerOptions: ts.CompilerOptions = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, allowJs: true };
  for (let directory = posix.dirname(from.path); ; directory = posix.dirname(directory)) {
    const config = fileMap.get(posix.join(directory, 'tsconfig.json'));
    if (config) {
      const parsed = ts.parseConfigFileTextToJson(config.path, config.source);
      if (parsed.error) return { reason: 'The owning tsconfig is malformed.' };
      const json: unknown = parsed.config;
      if (!json || typeof json !== 'object') return { reason: 'The owning tsconfig is not a JSON object.' };
      if ('extends' in json || 'references' in json) return { reason: 'tsconfig inheritance and project-reference topology require an explicit adapter.' };
      const converted = ts.convertCompilerOptionsFromJson('compilerOptions' in json ? json.compilerOptions : {}, posix.join(base, directory));
      if (converted.errors.length) return { reason: 'The owning tsconfig compiler options could not be resolved.' };
      compilerOptions = { ...compilerOptions, ...converted.options };
      break;
    }
    if (directory === '.') break;
  }
  const host: ts.ModuleResolutionHost = { fileExists: fileName => readFile(fileName) !== undefined, readFile, realpath: fileName => posix.join(base, physical(fileName)), getCurrentDirectory: () => base, useCaseSensitiveFileNames: true };
  const resolved = ts.resolveModuleName(specifier, posix.join(base, from.path), compilerOptions, host, undefined, undefined, /\.[cm][jt]s$/.test(from.path) && /\.c/.test(from.path) ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext).resolvedModule;
  return resolved ? { file: fileMap.get(physical(resolved.resolvedFileName)) } : { reason: `TypeScript could not resolve ${specifier} in the indexed module topology.` };
}
export function resolveModule(specifier: string, from: FileRecord, files: FileRecord[], options: ResolveOptions = {}): FileRecord | undefined {
  return moduleResolution(specifier, from, files, options).file;
}
export function resolveDependencies(from: FileRecord, files: FileRecord[], options: ResolveOptions = {}): { files: FileRecord[]; unknown: boolean; diagnostics: Resolution['diagnostics'] } {
  const resolved = from.imports.map(specifier => moduleResolution(specifier, from, files, options));
  return { files: [...new Map(resolved.flatMap(result => result.file ? [[result.file.path, result.file] as const] : [])).values()], unknown: resolved.some(result => !result.file), diagnostics: resolved.flatMap(result => result.file ? [] : [{ code: 'module-topology-unknown', message: result.reason ?? 'Resolved dependency is outside the indexed inventory.', path: from.path }]) };
}
function exportsOf(file: FileRecord, name: string, files: FileRecord[], options: ResolveOptions, seen = new Set<string>()): { units: Unit[]; unknown: boolean } {
  const key = `${file.path}#${name}`;
  if (seen.has(key)) return { units: [], unknown: true };
  const next = new Set(seen).add(key);
  const direct = file.units.filter(unit => unit.kind === 'symbol' && unit.data?.topLevel && unit.name === name && unit.exported);
  let unknown = file.diagnostics.some(diagnostic => /unknown/.test(diagnostic.code));
  const units = [...direct];
  for (const binding of file.bindings ?? []) if (binding.exported === name) {
    if (binding.module) {
      const target = resolveModule(binding.module, file, files, options);
      if (!target) unknown = true;
      else { const result = exportsOf(target, binding.imported, files, options, next); units.push(...result.units); unknown ||= result.unknown; }
    } else {
      const local = file.units.filter(unit => unit.kind === 'symbol' && unit.name === binding.local);
      units.push(...local);
      if (!local.length) {
        const alias = file.bindings?.find(candidate => candidate.local === binding.local && !candidate.exported);
        const target = alias && resolveModule(alias.module, file, files, options);
        if (alias && target) { const result = exportsOf(target, alias.imported, files, options, next); units.push(...result.units); unknown ||= result.unknown; }
        else unknown = true;
      }
    }
  }
  for (const module of units.length || name === 'default' ? [] : file.exportStars ?? []) {
    const target = resolveModule(module, file, files, options);
    if (!target) unknown = true;
    else { const result = exportsOf(target, name, files, options, next); units.push(...result.units); unknown ||= result.unknown; }
  }
  return { units: [...new Map(units.map(unit => [unit.id, unit])).values()], unknown };
}
const allUnits = (files: FileRecord[]) => files.flatMap(file => file.units);
function packageOf(path: string, options: ResolveOptions): string | undefined {
  return Object.entries(options.packages ?? {}).find(([, pkg]) => path === pkg.root || path.startsWith(`${pkg.root}/`))?.[0] ?? /^(packages\/[^/]+)\//.exec(path)?.[1];
}
function exportedTargets(file: FileRecord, files: FileRecord[], options: ResolveOptions, seen = new Set<string>()): { units: Unit[]; unknown: boolean } {
  if (seen.has(file.path)) return { units: [], unknown: true };
  const next = new Set(seen).add(file.path);
  const units = file.units.filter(unit => unit.kind === 'symbol' && unit.exported && unit.data?.topLevel);
  let unknown = false;
  for (const binding of file.bindings ?? []) if (binding.exported) {
    const result = exportsOf(file, binding.exported, files, options); units.push(...result.units); unknown ||= result.unknown;
  }
  for (const module of file.exportStars ?? []) {
    const target = resolveModule(module, file, files, options);
    if (!target) unknown = true;
    else { const result = exportedTargets(target, files, options, next); units.push(...result.units); unknown ||= result.unknown; }
  }
  return { units, unknown };
}
function allowed(unit: Unit, files: FileRecord[], options: ResolveOptions): { status: 'allowed' | 'denied' | 'unknown'; reason?: string } {
  if (options.detectedPolicy && !options.policy) return { status: 'unknown', reason: `Configured policy ${options.detectedPolicy} has no supported adapter.` };
  const policy = options.policy?.check({ fromPath: options.fromPath, fromScope: options.scope, target: unit, edge: options.edge ?? 'dependency' });
  if (policy && policy.status !== 'allowed') return policy;
  const owns = options.scope && (unit.path === options.scope || unit.path.startsWith(`${options.scope.replace(/\/$/, '')}/`));
  const fromPackage = options.fromPath && packageOf(options.fromPath, options), toPackage = packageOf(unit.path, options);
  if (unit.kind === 'symbol' && fromPackage !== toPackage && toPackage && !owns && options.edge !== 'observation') {
    if (!unit.exported) return { status: 'denied', reason: 'Cross-package implementation dependencies require a public target or ownership of its private scope.' };
    const pkg = options.packages?.[toPackage];
    if (!pkg) return { status: 'unknown', reason: 'No configured public export boundary is available for the referenced package.' };
    const from = files.find(file => file.path === options.fromPath) ?? { path: options.fromPath ?? 'consumer.ts' } as FileRecord;
    let incomplete = false;
    for (const key of Object.keys(pkg.exports)) {
      if (key.includes('*')) { incomplete = true; continue; }
      const entry = resolveModule(key === '.' ? toPackage : `${toPackage}${key.slice(1)}`, from, files, options);
      if (!entry) { incomplete = true; continue; }
      const exported = exportedTargets(entry, files, options);
      const targetId = unit.parent ?? unit.id;
      if (exported.units.some(candidate => candidate.id === targetId)) return { status: 'allowed' };
      incomplete ||= exported.unknown;
    }
    return incomplete ? { status: 'unknown', reason: 'The package export boundary cannot be proven from the indexed topology.' } : { status: 'denied', reason: 'The referenced declaration is not reachable through a declared package export.' };
  }
  return { status: 'allowed' };
}
export function resolveReference(input: string, files: FileRecord[], options: ResolveOptions = {}): Resolution {
  const address = input.replace(/^\[\[|\]\]$/g, '');
  const units = allUnits(files); let candidates: Unit[] = [], unknown = options.inventoryComplete === false, markdownDuplicate = false;
  const diagnostics: Resolution['diagnostics'] = [];
  let decoded: string, decodedParts: string[];
  try { decodedParts = address.split('#').map(part => decodeURIComponent(part)); decoded = decodedParts.join('#'); }
  catch { return { status: 'unresolved', candidates: [], population: populationHash([]), diagnostics: [{ code: 'address-invalid', message: 'Invalid percent escape in reference.', address }] }; }
  if (/^(code|spec|design):/.test(address)) {
    candidates = units.filter(unit => {
      try { return JSON.stringify(unit.address.split('#').map(part => decodeURIComponent(part))) === JSON.stringify(decodedParts); } catch { return false; }
    });
    if (address.startsWith('code:')) {
      const [path, name] = [decodedParts[0]!.slice(5), decodedParts[1]];
      const file = files.find(file => file.path === slash(path!));
      // An exact file address identifies bytes even when symbol inference is
      // incomplete. Keep those diagnostics; do not certify its declarations.
      if (name) unknown ||= Boolean(file?.diagnostics.some(diagnostic => /unknown/.test(diagnostic.code)));
      else if (file) diagnostics.push(...file.diagnostics);
      if (file && name && !candidates.length) { const result = exportsOf(file, name, files, options); candidates = result.units; unknown ||= result.unknown; }
    }
  } else {
    const pieces = address.split('#').map(value => decodeURIComponent(value));
    const key = normalizeName(pieces[0]!);
    const qualifiedPackage = Object.keys(options.packages ?? {}).sort((a, b) => b.length - a.length).find(name => decoded.startsWith(`${name}.`));
    const terms = qualifiedPackage ? [] : units.filter(unit => unit.kind === 'term' && unit.key === key);
    if (terms.length) {
      markdownDuplicate = terms.length > 1;
      if (pieces.length > 1) candidates = terms.flatMap(owner => units.filter(unit => unit.path === owner.path && unit.address === `${owner.address}#${pieces.slice(1).map(component).join('#')}`));
      else candidates = terms;
    } else {
      if (qualifiedPackage) {
        const from = files.find(file => file.path === options.fromPath) ?? { path: options.fromPath ?? 'consumer.ts' } as FileRecord;
        const file = resolveModule(qualifiedPackage, from, files, options);
        if (file) { const result = exportsOf(file, decoded.slice(qualifiedPackage.length + 1), files, options); candidates = result.units; unknown ||= result.unknown; }
        else unknown = true;
      } else if (pieces.length === 1) {
        candidates = units.filter(unit => unit.kind === 'symbol' && unit.data?.topLevel && unit.key === key);
        unknown ||= files.some(file => file.language === 'typescript' && file.diagnostics.some(diagnostic => /unknown/.test(diagnostic.code)));
        // Export aliases enter the population only through a resolved logical declaration.
        for (const file of files) for (const binding of file.bindings ?? []) if (binding.exported && normalizeName(binding.exported) === key) {
          const result = exportsOf(file, binding.exported, files, options); candidates.push(...result.units); unknown ||= result.unknown;
        }
      }
    }
  }
  const duplicateOwners = candidates.some((unit, index) => unit.kind !== 'symbol' && candidates.slice(index + 1).some(other => other.id === unit.id));
  candidates = [...new Map(candidates.map(unit => [`${unit.id}:${unit.path}`, unit])).values()];
  const population = populationHash(candidates.map(unit => `${unit.id}:${unit.path}`));
  const result = (status: Resolution['status'], code: string, message: string): Resolution => ({ status, candidates, population, diagnostics: [...diagnostics, { code, message, address }] });
  if (markdownDuplicate || duplicateOwners || candidates.length > 1) return result('ambiguous', markdownDuplicate || duplicateOwners ? 'duplicate-markdown-owner' : 'reference-ambiguous', 'More than one logical declaration owns this reference.');
  if (unknown) return result('unknown', 'reference-inventory-unknown', 'The candidate inventory or module topology is incomplete.');
  const unit = candidates[0];
  if (!unit) return result('unresolved', 'reference-unresolved', 'No eligible declaration owns this reference.');
  const boundary = allowed(unit, files, options);
  if (boundary.status !== 'allowed') return result(boundary.status, `boundary-${boundary.status}`, boundary.reason ?? 'The reference is not permitted by the configured dependency boundary.');
  if (options.previousBinding && options.previousBinding.id !== unit.id) return result('rebind', 'reference-rebinding', `Previously bound to ${options.previousBinding.id}; explicit adoption or qualification is required.`);
  return { status: 'resolved', unit, candidates, population, diagnostics };
}
