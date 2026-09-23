export interface Diagnostic { code: string; message: string; path?: string; address?: string }
export interface Unit {
  id: string; kind: 'file' | 'term' | 'requirement' | 'design' | 'part' | 'symbol';
  name: string; key: string; path: string; address: string; body: string;
  contractHash: string; bodyHash: string; parent?: string; exported?: boolean; scope?: string;
  data?: Record<string, unknown>;
}
export interface Reference { text: string; from: string; path: string; offset: number; kind: 'dependency' | 'observation' }
export interface ModuleBinding { local: string; imported: string; module: string; exported?: string }
export interface FileRecord {
  path: string; hash: string; units: Unit[]; references: Reference[]; diagnostics: Diagnostic[]; imports: string[];
  source: string; bindings?: ModuleBinding[]; exportStars?: string[]; language?: 'markdown' | 'typescript' | 'opaque';
}
export interface PolicyAdapter {
  name: string;
  check(context: { fromPath?: string; fromScope?: string; target: Unit; edge: 'dependency' | 'observation' }):
    { status: 'allowed' | 'denied' | 'unknown'; reason?: string };
}
export interface ResolveOptions {
  fromPath?: string; scope?: string; edge?: 'dependency' | 'observation'; policy?: PolicyAdapter;
  detectedPolicy?: string; inventoryComplete?: boolean; previousBinding?: { id: string; population?: string };
  packages?: Record<string, { root: string; exports: Record<string, string> }>;
  fileMap?: ReadonlyMap<string, FileRecord>;
}
export type Resolution = {
  status: 'resolved' | 'unresolved' | 'ambiguous' | 'denied' | 'unknown' | 'rebind';
  unit?: Unit; candidates: Unit[]; population: string; diagnostics: Diagnostic[];
};
export type Selector =
  | { kind: 'id'; id: string }
  | { kind: 'path'; root: string; prefix?: string; glob?: string }
  | { kind: 'descendants'; designId: string }
  | { kind: 'imports' | 'consumers'; id: string }
  | { kind: 'and' | 'or'; selectors: Selector[] };
export interface Selection { status: 'known' | 'unknown'; units: Unit[]; population: string; diagnostics: Diagnostic[] }
export interface Applicability { requirement: string; selector: Selector; reason: string }
