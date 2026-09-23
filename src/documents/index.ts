import type { FileRecord } from './types.ts';
import { hash, normalizeName, slash } from './common.ts';
import { extractMarkdown } from './markdown.ts';
import { extractCode } from './code.ts';
export type * from './types.ts';
export { normalizeName, hash } from './common.ts';
export { parseMarkdown, partKey } from './markdown.ts';
export { resolveReference, resolveModule, resolveDependencies } from './resolver.ts';
export { selectUnits } from './selectors.ts';
export type { SelectOptions } from './selectors.ts';
export { parseDesignDelta, applyDesignDelta } from './delta.ts';
export type { DesignDelta, DeltaOperation, DeltaReceipt, DeltaResult } from './delta.ts';

export function extractFile(path: string, source: string): FileRecord {
  path = slash(path);
  const digest = hash(source);
  const record: FileRecord = { path, source, hash: digest, units: [{ id: `file:${path}`, kind: 'file', name: path, key: normalizeName(path), path, address: `code:${path.split('/').map(encodeURIComponent).join('/')}`, body: source, bodyHash: digest, contractHash: digest }], references: [], diagnostics: [], imports: [] };
  if (/\.md$/i.test(path)) { record.language = 'markdown'; extractMarkdown(record); }
  else if (/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(path)) { record.language = 'typescript'; extractCode(record); }
  else record.language = 'opaque';
  const addresses = new Set<string>();
  for (const unit of record.units) {
    if (addresses.has(unit.address)) record.diagnostics.push({ code: 'duplicate-address', message: `The file defines ${unit.address} more than once.`, path, address: unit.address });
    addresses.add(unit.address);
  }
  return record;
}
