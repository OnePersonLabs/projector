import type { Diagnostic } from './types.ts';
import { hash, component, addressPath } from './common.ts';
import { parseMarkdown, partKey } from './markdown.ts';

export interface DeltaOperation { kind: 'add' | 'replace' | 'remove' | 'rename' | 'add-design' | 'remove-design'; address: string; content?: string; to?: string; reason?: string }
export interface DesignDelta { path: string; target: string; baseline: string; operations: DeltaOperation[]; diagnostics: Diagnostic[] }
export interface DeltaReceipt { deltaHash: string; target: string; baseline: string; resultHash: string; renames: Record<string, string> }
export interface DeltaResult { status: 'applied' | 'already-applied' | 'rejected'; source: string; diagnostics: Diagnostic[]; renames: Record<string, string>; receipt?: DeltaReceipt }
export function parseDesignDelta(path: string, source: string): DesignDelta {
  const parsed = parseMarkdown(path, source), diagnostics = [...parsed.diagnostics];
  const target = typeof parsed.metadata.target === 'string' ? parsed.metadata.target : '';
  const baseline = typeof parsed.metadata.baseline === 'string' ? parsed.metadata.baseline : '';
  if (parsed.metadata.designDelta !== 1 || !target || !baseline) diagnostics.push({ code: 'delta-frontmatter-invalid', message: 'A design delta requires designDelta: 1, target and baseline.', path });
  const headers = parsed.sections.filter(section => section.depth === 2 && /^(Add|Replace|Remove|Rename):\s*\S/i.test(section.name));
  const operations: DeltaOperation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const section = headers[i]!, match = /^(Add|Replace|Remove|Rename):\s*(.+)$/i.exec(section.name)!;
    let kind = match[1]!.toLowerCase() as DeltaOperation['kind'];
    const address = match[2]!.trim();
    let body = source.slice(section.contentStart, headers[i + 1]?.start ?? source.length);
    const fence = /^\s*(`{3,}|~{3,})(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n\1\s*$/.exec(body);
    if (fence) body = `${fence[2]}\n`;
    else body = body.replace(/^\r?\n/, '');
    if (address === 'design' && kind === 'add') kind = 'add-design';
    if (address === 'design' && kind === 'remove') kind = 'remove-design';
    const operation: DeltaOperation = { kind, address };
    if (kind === 'add' || kind === 'replace' || kind === 'add-design') operation.content = body;
    else {
      const reason = /^\s*(?:\*\*)?Reason:(?:\*\*)?\s*(.+)$/im.exec(body);
      operation.reason = reason?.[1];
      if (!operation.reason) diagnostics.push({ code: 'delta-reason-missing', message: `${kind} requires a concise Reason field.`, path, address });
      if (kind === 'rename') {
        operation.to = /^\s*(?:\*\*)?To:(?:\*\*)?\s*(.+)$/im.exec(body)?.[1]?.trim();
        if (!operation.to) diagnostics.push({ code: 'delta-rename-target-missing', message: 'Rename requires a To field.', path, address });
      }
    }
    operations.push(operation);
  }
  if (!operations.length) diagnostics.push({ code: 'delta-empty', message: 'The delta contains no explicit operations.', path });
  return { path, target, baseline, operations, diagnostics };
}
function validContent(content: string, address: string): boolean {
  const parsed = parseMarkdown('', content), first = parsed.sections[0];
  if (!first || content.slice(0, first.start).trim()) return false;
  const segments = address.split('#');
  const expectedDepth = segments.length + 1;
  if (first.depth !== expectedDepth) return false;
  const expectedName = segments.length === 1 ? partKey(first.name) : component(first.name);
  return expectedName === segments.at(-1) && !parsed.sections.slice(1).some(section => section.depth <= first.depth);
}
export function applyDesignDelta(source: string, delta: DesignDelta, options: { path?: string; recordedApplication?: DeltaReceipt } = {}): DeltaResult {
  const diagnostics = [...delta.diagnostics], renames: Record<string, string> = {};
  const reject = (code: string, message: string, address?: string): DeltaResult => ({ status: 'rejected', source, renames: {}, diagnostics: [...diagnostics, { code, message, path: options.path ?? delta.path, address }] });
  if (diagnostics.length) return { status: 'rejected', source, renames, diagnostics };
  const deltaHash = hash(JSON.stringify({ target: delta.target, baseline: delta.baseline, operations: delta.operations }));
  const previous = options.recordedApplication;
  if (previous && previous.deltaHash === deltaHash && previous.target === delta.target && previous.baseline === delta.baseline && previous.resultHash === hash(source)) return { status: 'already-applied', source, diagnostics, renames: previous.renames, receipt: previous };
  const absentAdd = delta.baseline === 'absent' && source === '' && delta.operations.length === 1 && delta.operations[0]?.kind === 'add-design';
  if (!absentAdd && hash(source) !== delta.baseline) return reject('delta-stale', 'The expected baseline hash does not match the exact current design.');
  const parsed = parseMarkdown(options.path ?? delta.path, source);
  if (parsed.diagnostics.length) return { status: 'rejected', source, renames, diagnostics: parsed.diagnostics };
  const whole = delta.operations.filter(operation => operation.kind === 'add-design' || operation.kind === 'remove-design');
  let updated: string;
  if (whole.length) {
    if (delta.operations.length !== 1) return reject('delta-overlap', 'Whole-design operations cannot overlap part operations.');
    const operation = whole[0]!;
    if (operation.kind === 'add-design') {
      if (source.length) return reject('delta-target-exists', 'A whole-design add requires an absent design.');
      const content = parseMarkdown(delta.path, operation.content ?? '');
      if (content.metadata.projectorDesign !== 1 || content.metadata.id !== delta.target || !content.sections.some(section => section.depth === 2 && section.address === 'contract')) return reject('delta-content-invalid', 'Whole-design content must identify its target and contain a Contract.');
      updated = operation.content!;
    } else {
      if (parsed.metadata.id !== delta.target) return reject('delta-target-missing', 'Whole-design removal target does not exist.');
      if (!operation.reason) return reject('delta-reason-missing', 'Whole-design removal requires a reason.');
      updated = '';
    }
  } else {
    if (parsed.metadata.projectorDesign !== 1 || parsed.metadata.id !== delta.target) return reject('delta-target-mismatch', 'The current document does not have the delta target design id.');
    const sections = parsed.sections.filter(section => section.depth >= 2), addressCounts = new Map<string, number>();
    for (const section of sections) addressCounts.set(section.address, (addressCounts.get(section.address) ?? 0) + 1);
    if ([...addressCounts.values()].some(count => count > 1)) return reject('delta-duplicate-target', 'The baseline has duplicate part addresses.');
    const operations = delta.operations;
    for (let i = 0; i < operations.length; i++) for (let j = i + 1; j < operations.length; j++) {
      const a = operations[i]!.address, b = operations[j]!.address;
      if (a === b || a.startsWith(`${b}#`) || b.startsWith(`${a}#`)) return reject('delta-overlap', 'Coalesce duplicate or ancestor/descendant operations before applying.', a);
    }
    const edits: { start: number; end: number; content: string }[] = [];
    for (const operation of operations) {
      const target = sections.find(section => section.address === operation.address);
      if (operation.kind === 'add') {
        if (target) return reject('delta-target-exists', 'An add target already exists; no conflicting state is an idempotent success.', operation.address);
        if (!operation.content || !validContent(operation.content, operation.address)) return reject('delta-content-invalid', 'Add must contain the complete addressed Markdown part.', operation.address);
        const parentAddress = operation.address.includes('#') ? operation.address.slice(0, operation.address.lastIndexOf('#')) : undefined;
        const parent = parentAddress ? sections.find(section => section.address === parentAddress) : undefined;
        if (parentAddress && !parent) return reject('delta-parent-missing', 'The subaddress parent does not exist.', operation.address);
        const start = parent?.end ?? source.length;
        const prefix = start && source[start - 1] !== '\n' ? '\n\n' : start && source[start - 2] !== '\n' ? '\n' : '';
        edits.push({ start, end: start, content: prefix + operation.content });
      } else {
        if (!target) return reject('delta-target-missing', 'The addressed part does not exist.', operation.address);
        if (operation.kind === 'replace') {
          if (!operation.content || !validContent(operation.content, operation.address)) return reject('delta-content-invalid', 'Replace must contain the complete addressed Markdown part.', operation.address);
          edits.push({ start: target.start, end: target.end, content: operation.content });
        } else if (operation.kind === 'remove') {
          if (!operation.reason) return reject('delta-reason-missing', 'Removal requires a reason.', operation.address);
          edits.push({ start: target.start, end: target.end, content: '' });
        } else if (operation.kind === 'rename') {
          if (!operation.to || !operation.reason) return reject('delta-rename-invalid', 'Rename needs a new local address and reason.', operation.address);
          const oldParts = operation.address.split('#'), newParts = operation.to.split('#');
          if (oldParts.slice(0, -1).join('#') !== newParts.slice(0, -1).join('#') || oldParts.length !== newParts.length) return reject('delta-rename-invalid', 'Rename preserves the containing part; moving a binding requires an explicit refactor.', operation.address);
          if (sections.some(section => section.address === operation.to) || operations.some(other => other !== operation && (other.address === operation.to || other.to === operation.to))) return reject('delta-target-exists', 'The rename destination already exists.', operation.to);
          const local = newParts.at(-1)!;
          let name: string;
          try { name = newParts.length > 1 ? decodeURIComponent(local) : local.startsWith('decision:') ? `Decision: ${local.slice(9)}` : local[0]!.toUpperCase() + local.slice(1); }
          catch { return reject('delta-address-invalid', 'Invalid percent escape in rename destination.', operation.to); }
          if (newParts.length === 1 && !partKey(name)) return reject('delta-rename-invalid', 'A design part must retain an addressable role.', operation.to);
          const newline = source.slice(target.start, target.contentStart).endsWith('\r\n') ? '\r\n' : '\n';
          edits.push({ start: target.start, end: target.contentStart, content: `${'#'.repeat(target.depth)} ${name}${newline}` });
          renames[`design:${addressPath(delta.target)}#${operation.address}`] = `design:${addressPath(delta.target)}#${operation.to}`;
          for (const child of sections.filter(section => section.address.startsWith(`${operation.address}#`))) renames[`design:${addressPath(delta.target)}#${child.address}`] = `design:${addressPath(delta.target)}#${operation.to}${child.address.slice(operation.address.length)}`;
        }
      }
    }
    updated = source;
    for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) updated = updated.slice(0, edit.start) + edit.content + updated.slice(edit.end);
    const final = parseMarkdown(delta.path, updated);
    if (!final.sections.some(section => section.depth === 2 && section.address === 'contract')) return reject('delta-contract-missing', 'The resulting live design must retain its Contract.');
  }
  const receipt: DeltaReceipt = { deltaHash, target: delta.target, baseline: delta.baseline, resultHash: hash(updated), renames };
  return { status: 'applied', source: updated, diagnostics, renames, receipt };
}
