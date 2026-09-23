import { posix } from 'node:path';
import type { FileRecord, ResolveOptions, Selection, Selector, Unit } from './types.ts';
import { populationHash, slash } from './common.ts';
import { resolveModule } from './resolver.ts';

export interface SelectOptions { roots?: Record<string, string>; inventoryComplete?: boolean; packages?: ResolveOptions['packages'] }
const result = (units: Unit[], unknown = false, message = ''): Selection => ({
  status: unknown ? 'unknown' : 'known', units: [...new Map(units.map(unit => [unit.id, unit])).values()],
  population: populationHash(units.map(unit => `${unit.id}:${unit.path}`)),
  diagnostics: unknown ? [{ code: 'selector-unknown', message: message || 'The selector population is incomplete.' }] : [],
});
function globRegex(glob: string): RegExp {
  let source = '^';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { source += '(?:.*/)?'; i++; } else source += '.*';
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${source}$`);
}
export function selectUnits(selector: Selector | unknown, files: FileRecord[], options: SelectOptions = {}): Selection {
  if (!selector || typeof selector !== 'object' || !('kind' in selector)) return result([], true, 'A supported selector kind is required.');
  const value = selector as Selector, units = files.flatMap(file => file.units), unknown = options.inventoryComplete === false;
  if (value.kind === 'id') return typeof value.id === 'string' ? result(units.filter(unit => unit.id === value.id), unknown) : result([], true, 'An exact id is required.');
  if (value.kind === 'path') {
    if (typeof value.root !== 'string' || (!value.glob && value.prefix === undefined)) return result([], true, 'A path selector needs a named root and glob or prefix.');
    const root = value.root === '.' ? '' : options.roots?.[value.root];
    if (root === undefined) return result([], true, `Unknown root: ${value.root}`);
    if ([root, value.prefix, value.glob].some(path => path !== undefined && (posix.isAbsolute(path) || slash(path).split('/').includes('..')))) return result([], true, 'Path selectors must stay inside the named root.');
    if (value.glob && /[\[\]{}!]/.test(value.glob)) return result([], true, 'Only *, ** and ? glob operators are supported.');
    const regex = value.glob ? globRegex(slash(value.glob)) : undefined;
    const prefix = value.prefix ? slash(value.prefix).replace(/\/$/, '') : '';
    const normalizedRoot = slash(root).replace(/\/$/, '');
    const selected = files.filter(file => {
      if (normalizedRoot && !file.path.startsWith(`${normalizedRoot}/`)) return false;
      const relative = normalizedRoot ? file.path.slice(normalizedRoot.length + 1) : file.path;
      return (!prefix || relative === prefix || relative.startsWith(`${prefix}/`)) && (!regex || regex.test(relative));
    }).flatMap(file => file.units.filter(unit => unit.kind === 'file'));
    return result(selected, unknown);
  }
  if (value.kind === 'and' || value.kind === 'or') {
    if (!Array.isArray(value.selectors) || !value.selectors.length) return result([], true, 'A conjunction or union needs at least one selector.');
    const selected = value.selectors.map(child => selectUnits(child, files, options));
    const combined = value.kind === 'or' ? selected.flatMap(selection => selection.units) : selected[0]!.units.filter(unit => selected.every(selection => selection.units.some(candidate => candidate.id === unit.id)));
    return result(combined, selected.some(selection => selection.status === 'unknown'));
  }
  if (value.kind === 'descendants') {
    const start = value.designId.startsWith('design:') ? value.designId : `design:${value.designId}`;
    if (!units.some(unit => unit.id === start && unit.kind === 'design')) return result([], true, `Unknown concern design ${value.designId}.`);
    const pending = [start], reached = new Set<string>();
    let incomplete = unknown;
    while (pending.length) {
      const id = pending.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const reference of files.flatMap(file => file.references).filter(reference => reference.from === `${id}#subdesigns` && reference.text.startsWith('design:'))) {
        const child = reference.text.split('#')[0]!;
        if (!units.some(unit => unit.id === child && unit.kind === 'design')) incomplete = true;
        else pending.push(child);
      }
    }
    reached.delete(start);
    return result(units.filter(unit => reached.has(unit.id)), incomplete);
  }
  if (value.kind === 'imports' || value.kind === 'consumers') {
    const anchor = units.find(unit => unit.id === value.id);
    if (!anchor) return result([], true, 'The relation anchor is unresolved.');
    const file = files.find(file => file.path === anchor.path)!;
    let incomplete = unknown;
    const selected: FileRecord[] = [];
    const candidates = value.kind === 'imports' ? [file] : files;
    for (const candidate of candidates) for (const module of candidate.imports) {
      const dependency = resolveModule(module, candidate, files, options);
      if (!dependency) { incomplete = true; continue; }
      if (value.kind === 'imports') selected.push(dependency);
      else if (dependency.path === file.path) selected.push(candidate);
    }
    return result(selected.flatMap(selectedFile => selectedFile.units.filter(unit => unit.kind === 'file')), incomplete);
  }
  return result([], true, `Unsupported selector kind: ${String((selector as { kind: unknown }).kind)}`);
}
