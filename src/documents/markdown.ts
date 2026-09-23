import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root, RootContent, Heading } from 'mdast';
import { parseDocument } from 'yaml';
import type { Applicability, Diagnostic, FileRecord, Unit } from './types.ts';
import { addressPath, component, hash, normalizeName } from './common.ts';

export interface Section { name: string; depth: number; start: number; contentStart: number; end: number; address: string; parent?: Section }
export interface MarkdownDocument { source: string; tree: Root; metadata: Record<string, unknown>; offset: number; sections: Section[]; diagnostics: Diagnostic[] }
function text(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const value = node as { value?: string; children?: unknown[] };
  return value.value ?? value.children?.map(text).join('') ?? '';
}
export function partKey(name: string): string | undefined {
  if (/^(contract|realization|subdesigns)$/i.test(name)) return name.toLowerCase();
  const decision = /^Decision:\s*(\S(?:.*\S)?)$/i.exec(name);
  return decision ? `decision:${decision[1]}` : undefined;
}
export function parseMarkdown(path: string, source: string): MarkdownDocument {
  const diagnostics: Diagnostic[] = [];
  let metadata: Record<string, unknown> = {}, offset = 0;
  if (/^---\r?\n/.test(source)) {
    const ending = /^---\s*$/m.exec(source.slice(source.indexOf('\n') + 1));
    if (!ending) diagnostics.push({ code: 'frontmatter-unclosed', message: 'YAML frontmatter has no closing delimiter.', path });
    else {
      const begin = source.indexOf('\n') + 1, close = begin + ending.index;
      const parsed = parseDocument(source.slice(begin, close), { uniqueKeys: true });
      for (const error of parsed.errors) diagnostics.push({ code: 'frontmatter-invalid', message: error.message, path });
      if (!parsed.errors.length) {
        const value: unknown = parsed.toJS({ maxAliasCount: 50 });
        if (value && typeof value === 'object' && !Array.isArray(value)) metadata = value as Record<string, unknown>;
        else diagnostics.push({ code: 'frontmatter-invalid', message: 'Frontmatter must be a mapping.', path });
      }
      const newline = source.indexOf('\n', close + ending[0].length);
      offset = newline < 0 ? source.length : newline + 1;
    }
  }
  const tree = fromMarkdown(source.slice(offset)), sections: Section[] = [];
  for (const node of tree.children) {
    if (node.type !== 'heading') continue;
    const heading = node as Heading, name = text(heading), start = offset + heading.position!.start.offset!;
    const lineEnd = source.indexOf('\n', offset + heading.position!.end.offset!);
    const parent = [...sections].reverse().find(section => section.depth < heading.depth);
    const role = heading.depth === 2 ? partKey(name) : undefined;
    const address = role ?? (parent && heading.depth > 2 ? `${parent.address}#${component(name)}` : component(name));
    sections.push({ name, depth: heading.depth, start, contentStart: lineEnd < 0 ? source.length : lineEnd + 1, end: source.length, address, parent });
  }
  for (let i = 0; i < sections.length; i++) {
    sections[i]!.end = sections.slice(i + 1).find(next => next.depth <= sections[i]!.depth)?.start ?? source.length;
  }
  return { source, tree, metadata, offset, sections, diagnostics };
}
function labeledFields(nodes: RootContent[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  function visit(node: RootContent): void {
    if (node.type === 'paragraph') {
      const value = text(node);
      // Soft line breaks permit readable fields without requiring a list.
      for (const line of value.split(/\r?\n/)) {
        const match = /^(Choice|Reason|Requires|Constraints|Alternative|Tradeoff|Realizes|Evidence|Reopen|Applies|Consequential):\s*(.+)$/i.exec(line.trim());
        if (match) (fields[match[1]!.toLowerCase()] ??= []).push(match[2]!);
      }
    } else if ('children' in node) for (const child of node.children) visit(child as RootContent);
  }
  for (const node of nodes) visit(node);
  return fields;
}
function applicability(fields: Record<string, string[]>, path: string, diagnostics: Diagnostic[]): Applicability[] {
  const result: Applicability[] = [];
  for (const entry of fields.applies ?? []) {
    const match = /^\[\[([^\]]+)\]\]\s*\|\s*(\{.*\})\s*\|\s*(.+)$/.exec(entry);
    if (!match) { diagnostics.push({ code: 'applies-invalid', message: 'Applies needs [[requirement]] | JSON selector | reason.', path }); continue; }
    try {
      const selector: unknown = JSON.parse(match[2]!);
      if (!selector || typeof selector !== 'object' || !('kind' in selector)) throw new Error('A selector kind is required.');
      result.push({ requirement: match[1]!, selector: selector as Applicability['selector'], reason: match[3]! });
    } catch (error) { diagnostics.push({ code: 'applies-invalid', message: `Invalid Applies selector: ${String(error)}`, path }); }
  }
  return result;
}
export function extractMarkdown(record: FileRecord): void {
  const parsed = parseMarkdown(record.path, record.source);
  record.diagnostics.push(...parsed.diagnostics);
  const { metadata, sections } = parsed, isDesign = metadata.projectorDesign === 1;
  const scope = typeof metadata.scope === 'string' ? metadata.scope : undefined;
  const rootHeading = sections.find(section => section.depth === 1);
  const designId = typeof metadata.id === 'string' ? metadata.id : '';
  const specMatch = /(?:^|\/)openspec\/specs\/(.+)\/spec\.md$/.exec(record.path) ?? /^openspec\/changes\/[^/]+\/specs\/(.+)\/spec\.md$/.exec(record.path);
  const add = (section: Section, kind: Unit['kind'], address: string, parent?: string): Unit => {
    const body = record.source.slice(section.start, section.end);
    const unit: Unit = { id: kind === 'term' || (!isDesign && kind === 'part') ? `term:${addressPath(record.path)}#${address}` : address, kind, name: section.name, key: normalizeName(section.name.replace(/^Requirement:\s*/i, '')), path: record.path, address, body,
      bodyHash: hash(body), contractHash: hash(body), scope, parent, data: { start: section.start, end: section.end, contentStart: section.contentStart, depth: section.depth } };
    record.units.push(unit); return unit;
  };
  if (isDesign) {
    if (!designId) record.diagnostics.push({ code: 'design-id-missing', message: 'Design frontmatter needs a stable id.', path: record.path });
    if (!scope) record.diagnostics.push({ code: 'design-scope-missing', message: 'Design frontmatter needs an ownership scope.', path: record.path });
    if (!rootHeading) record.diagnostics.push({ code: 'design-title-missing', message: 'A design needs an H1 title.', path: record.path });
    const root = rootHeading ? add(rootHeading, 'design', `design:${addressPath(designId)}`) : undefined;
    if (root) root.data = { ...root.data, metadata };
    const seen = new Set<string>();
    if (!sections.some(section => section.depth === 2 && section.address === 'contract')) record.diagnostics.push({ code: 'design-contract-missing', message: 'A design needs a Contract part.', path: record.path });
    for (const section of sections.filter(section => section.depth >= 2)) {
      if (section.depth === 2 && !partKey(section.name)) { record.diagnostics.push({ code: 'design-part-invalid', message: `Unknown H2 part: ${section.name}`, path: record.path }); continue; }
      const address = `design:${addressPath(designId)}#${section.address}`;
      if (seen.has(address)) record.diagnostics.push({ code: 'duplicate-part', message: `Duplicate address ${address}`, path: record.path, address });
      seen.add(address);
      const unit = add(section, 'part', address, section.parent?.depth === 1 ? root?.id : `design:${addressPath(designId)}#${section.parent?.address}`);
      const nodes = parsed.tree.children.filter(node => parsed.offset + node.position!.start.offset! >= section.contentStart && parsed.offset + node.position!.start.offset! < section.end);
      const fields = labeledFields(nodes);
      unit.data = { ...unit.data, fields };
      if (section.depth === 2 && section.address === 'contract') unit.data.applies = applicability(fields, record.path, record.diagnostics);
      if (section.depth === 2 && section.address.startsWith('decision:')) {
        for (const required of ['choice', 'reason']) if (!fields[required]?.length) record.diagnostics.push({ code: 'decision-field-missing', message: `${section.name} needs ${required}.`, path: record.path, address });
        const consequential = fields.consequential?.some(value => /^(true|yes|boundary|dependency|abstraction|strategy)$/i.test(value));
        if (consequential) for (const required of ['alternative', 'tradeoff']) if (!fields[required]?.length) record.diagnostics.push({ code: 'decision-consequence-missing', message: `${section.name} declares a consequential choice and needs ${required}.`, path: record.path, address });
        if (fields.evidence) unit.data.evidence = fields.evidence.map(value => ({ text: value, status: 'pending' }));
      }
    }
    if (root) root.contractHash = record.units.find(unit => unit.address === `${root.address}#contract`)?.bodyHash ?? hash('');
  } else if (specMatch) {
    for (const section of sections.filter(section => /^Requirement:\s*/i.test(section.name))) {
      const name = section.name.replace(/^Requirement:\s*/i, '');
      const unit = add(section, 'requirement', `spec:${addressPath(specMatch[1]!)}#${component(name)}`);
      unit.name = name;
    }
  } else if (metadata.designDelta !== 1 && !record.path.startsWith('openspec/changes/')) {
    for (const section of sections) {
      if (section.depth === 1) add(section, 'term', component(section.name));
      else {
        const owner = sections.find(candidate => candidate.depth === 1 && candidate.start < section.start && candidate.end > section.start);
        if (owner) {
          const lineage: string[] = [component(section.name)]; let ancestor = section.parent;
          while (ancestor && ancestor.depth > 1) { lineage.unshift(component(ancestor.name)); ancestor = ancestor.parent; }
          add(section, 'part', `${component(owner.name)}#${lineage.join('#')}`, component(owner.name));
        }
      }
    }
  }
  // References in code fences and inline code are examples, not dependency claims.
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as { type: string; value?: string; position?: { start: { offset: number } }; children?: unknown[] };
    if (value.type === 'code' || value.type === 'inlineCode') return;
    if (value.type === 'text' && value.value) for (const match of value.value.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
      const offset = parsed.offset + (value.position?.start.offset ?? 0) + match.index;
      const owner = [...record.units].reverse().find(unit => Number(unit.data?.start) <= offset && Number(unit.data?.end) > offset);
      record.references.push({ text: match[1]!, from: owner?.id ?? record.units[0]!.id, path: record.path, offset, kind: 'dependency' });
    }
    for (const child of value.children ?? []) visit(child);
  };
  visit(parsed.tree);
}
