import { mkdir, readFile, writeFile, rename, stat, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { extractFile, normalizeName, resolveReference, resolveDependencies, selectUnits } from '../documents/index.ts';
import type { FileRecord, ResolveOptions } from '../documents/index.ts';
import { IndexPool, emptyCounters, git, hash, rootIdentity, safePath, LIMITS } from '../index/index.ts';
import type { Counters, Indexed, IndexBackend } from '../index/index.ts';

type Request = Record<string, unknown>;
type Batch = { id: string; writer: string; paths: string[]; target: string; started: number };
type Snapshot = { revision: string; files: Map<string, FileRecord>; names: Map<string, Set<string>>; addresses: Map<string, Set<string>>; unknowns: Set<string>; configuration: Set<string>; bytes: number };
type Token = { rootId: string; incarnation: string; kernel: string; view: string; revision: string; epoch: number; basis: string };
interface Session {
  root: string; gitDir: string; id: string; incarnation: string; profile: 'revision' | 'managed';
  candidate?: string; generation: number; epoch: number; reason?: string; qualified: boolean;
  batches: Map<string, Batch>; dirty: Map<string, number>; snapshots: Map<string, Snapshot>;
  current?: Snapshot; refresh?: Promise<void>; revisionJobs: Map<string, Promise<Snapshot>>;
  queries: Map<string, { basis: string; value: unknown; revision: string; paths: string[] }>; counters: Counters; warnings: string[];
  bindings: Map<string, string>;
  directory: string; rootStamp: string; clients: number;
}
export interface KernelOptions {
  stateDir?: string; backend?: IndexBackend; now?: () => number;
  beforePublish?: (root: string, indexed: Indexed) => Promise<void>;
}
const execute = promisify(execFile);
function string(request: Request, key: string): string {
  const value = request[key]; if (typeof value !== 'string' || !value) throw new Error(`${key} must be a nonempty string`); return value;
}
function paths(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > LIMITS.files || value.some(item => typeof item !== 'string')) throw new Error('paths must be a bounded array of repository-relative names');
  return [...new Set((value as string[]).map(safePath))];
}
async function stamp(root: string, gitDir: string): Promise<string> {
  const [a, b] = await Promise.all([stat(root), stat(gitDir)]);
  return `${a.dev}:${a.ino}:${a.birthtimeMs}:${b.ino}:${b.birthtimeMs}`;
}
function snapshot(revision: string, files: FileRecord[]): Snapshot {
  const result: Snapshot = { revision, files: new Map(), names: new Map(), addresses: new Map(), unknowns: new Set(), configuration: new Set(), bytes: 0 };
  for (const file of files) putFile(result, file);
  return result;
}
function putFile(view: Snapshot, file: FileRecord): void {
  dropFile(view, file.path); view.files.set(file.path, file);
  view.bytes += Buffer.byteLength(JSON.stringify(file));
  if (view.bytes > LIMITS.snapshotBytes * 4) throw new Error('Semantic snapshot memory budget exceeded');
  for (const unit of file.units) {
    const members = view.names.get(unit.key) ?? new Set<string>(); members.add(file.path); view.names.set(unit.key, members);
    const key = JSON.stringify(unit.address.split('#').map(decodeURIComponent));
    const addressed = view.addresses.get(key) ?? new Set<string>(); addressed.add(file.path); view.addresses.set(key, addressed);
  }
  for (const binding of file.bindings ?? []) if (binding.exported) {
    const key = normalizeName(binding.exported); const members = view.names.get(key) ?? new Set<string>(); members.add(file.path); view.names.set(key, members);
  }
  if (file.diagnostics.some(diagnostic => diagnostic.code.includes('unknown'))) view.unknowns.add(file.path);
  if (/(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|nx\.json|eslint\.config\.[^/]+|\.eslintrc[^/]*|dependency-cruiser[^/]*)$/.test(file.path)) view.configuration.add(file.path);
}
function dropFile(view: Snapshot, file: string): void {
  const previous = view.files.get(file); if (!previous) return;
  view.bytes -= Buffer.byteLength(JSON.stringify(previous)); view.files.delete(file);
  for (const unit of previous.units) {
    const members = view.names.get(unit.key); members?.delete(file); if (!members?.size) view.names.delete(unit.key);
    const key = JSON.stringify(unit.address.split('#').map(decodeURIComponent));
    const addressed = view.addresses.get(key); addressed?.delete(file); if (!addressed?.size) view.addresses.delete(key);
  }
  for (const binding of previous.bindings ?? []) if (binding.exported) { const key = normalizeName(binding.exported); const members = view.names.get(key); members?.delete(file); if (!members?.size) view.names.delete(key); }
  view.unknowns.delete(file);
  view.configuration.delete(file);
}

/** Coordinates immutable views and explicitly cooperating managed candidates. No model invocation. */
export class Kernel {
  private sessions = new Map<string, Session>();
  private opening = new Map<string, Promise<unknown>>();
  private backend: IndexBackend;
  private stateDir: string;
  private incarnation = randomUUID();
  private mutationOwners = new Set<string>();
  private now: () => number;
  private readonly options: KernelOptions;
  constructor(options: KernelOptions = {}) {
    this.options = options;
    this.backend = options.backend ?? new IndexPool();
    this.stateDir = options.stateDir ?? path.join(process.env.LOCALAPPDATA ?? homedir(), 'Projector', 'indexes');
    this.now = options.now ?? Date.now;
  }
  async invalidateRoot(root: string, reason: string): Promise<void> {
    for (const session of this.sessions.values()) if (session.root === root) {
      session.qualified = false; session.reason = reason; session.epoch++; session.generation++;
      await this.persist(session);
    }
  }
  async acquireMutationExclusion(root: string, reason: string): Promise<() => Promise<void>> {
    if (this.mutationOwners.has(root)) throw new Error('Candidate is reserved by another consequential operation');
    if ([...this.sessions.values()].some(session => session.root === root && (session.batches.size || session.refresh))) throw new Error('Candidate has an acknowledged writer or extraction in flight; settle it before consequential mutation');
    this.mutationOwners.add(root);
    try { await this.invalidateRoot(root, reason); }
    catch (error) { this.mutationOwners.delete(root); throw error; }
    return async () => { this.mutationOwners.delete(root); };
  }
  async handle(request: Request): Promise<unknown> {
    switch (request.op) {
      case 'openRoot': return this.openRoot(request);
      case 'read': return this.read(request);
      case 'inspectStatus': return this.status(this.session(request));
      case 'releaseRoot': {
        const session = this.session(request); session.clients = Math.max(0, session.clients - 1);
        if (!session.clients && !session.batches.size && !session.refresh && !session.revisionJobs.size) {
          await this.persist(session); this.sessions.delete(session.id);
        }
        return { ...this.status(session), released: !this.sessions.has(session.id) };
      }
      case 'beginBatch': return this.beginBatch(request);
      case 'completeBatch': return this.completeBatch(request);
      case 'checkpoint': return this.checkpoint(request);
      case 'invalidateObservation': { const session = this.session(request); session.qualified = false; session.reason = string(request, 'reason'); session.epoch++; session.generation++; await this.persist(session); return this.status(session); }
      default: throw new Error(`Unknown kernel operation: ${String(request.op)}`);
    }
  }
  private session(request: Request): Session {
    const session = this.sessions.get(string(request, 'rootId')); if (!session) throw new Error('Root is not open in this kernel incarnation'); return session;
  }
  private status(session: Session) {
    return { rootId: session.id, root: session.root, incarnation: session.incarnation, profile: session.profile,
      workingCurrent: session.qualified && !session.batches.size ? 'available' : session.batches.size ? 'pending' : 'unavailable',
      reason: session.reason, generation: session.generation, epoch: session.epoch, batches: [...session.batches.values()],
      counters: { ...session.counters }, warnings: session.warnings, clients: session.clients,
      limits: LIMITS, kernel: this.incarnation };
  }
  private async persist(session: Session): Promise<void> {
    await mkdir(session.directory, { recursive: true });
    const target = path.join(session.directory, 'observation.json'); const temporary = `${target}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify({ version: 1, incarnation: session.incarnation, epoch: session.epoch, batches: [...session.batches.values()], reason: session.reason }));
    await rename(temporary, target);
  }
  private async openRoot(request: Request): Promise<unknown> {
    const identity = await rootIdentity(string(request, 'root'));
    const existing = this.sessions.get(identity.id);
    if (existing) {
      if (existing.incarnation !== identity.incarnation) throw new Error('Root was replaced; release the old root and open in a new kernel');
      if (request.profile && request.profile !== existing.profile) throw new Error('Root profile already selected; open a separate allocated candidate');
      existing.clients++; return this.status(existing);
    }
    const pending = this.opening.get(identity.id); if (pending) { await pending; this.sessions.get(identity.id)!.clients++; return this.status(this.sessions.get(identity.id)!); }
    const operation = this.enroll(identity, request); this.opening.set(identity.id, operation);
    try { return await operation; } finally { this.opening.delete(identity.id); }
  }
  private async enroll(identity: Awaited<ReturnType<typeof rootIdentity>>, request: Request): Promise<unknown> {
    if (this.sessions.size + this.opening.size >= LIMITS.roots) throw new Error('Active root budget reached; no active recovery state has been evicted');
    const profile = request.profile ?? 'revision';
    if (profile !== 'revision' && profile !== 'managed') throw new Error('Unsupported observation profile');
    let candidate: string | undefined;
    if (profile === 'managed') {
      const marker = JSON.parse(await readFile(path.join(identity.gitDir, 'projector-candidate.json'), 'utf8')) as Record<string, unknown>;
      if (marker.version !== 1 || marker.writerContract !== 'acknowledged-batches' || marker.root !== identity.root || marker.candidate !== request.candidate) throw new Error('Managed candidate allocation/identity contract does not match');
      if (path.resolve(identity.gitDir) === path.resolve(identity.root, '.git')) throw new Error('An ordinary checkout cannot be asserted to be an isolated managed candidate');
      candidate = String(marker.candidate);
    }
    const directory = path.join(this.stateDir, identity.id);
    const session: Session = { ...identity, directory, profile, candidate, generation: 0, epoch: 0,
      reason: profile === 'managed' ? 'Initial enrollment or owner restart requires an independent checkpoint' : 'Revision-only root has no qualified working observer',
      qualified: false, batches: new Map(), dirty: new Map(), snapshots: new Map(), revisionJobs: new Map(), queries: new Map(), bindings: new Map(),
      counters: emptyCounters(), warnings: [], rootStamp: await stamp(identity.root, identity.gitDir), clients: 1 };
    try {
      const stored = JSON.parse(await readFile(path.join(directory, 'observation.json'), 'utf8')) as { incarnation: string; batches: Batch[]; epoch: number };
      if (stored.incarnation === identity.incarnation) { session.epoch = stored.epoch + 1; for (const batch of stored.batches) session.batches.set(batch.id, batch); }
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new Error('Observation journal is unreadable; explicitly recover it before enrolling', { cause: error }); }
    this.sessions.set(identity.id, session); return this.status(session);
  }
  private async checkIdentity(session: Session): Promise<boolean> {
    session.counters.barriers++;
    try {
      if (await stamp(session.root, session.gitDir) === session.rootStamp) return true;
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    session.qualified = false; session.reason = 'Root/worktree identity changed'; session.epoch++; return false;
  }
  private addCounters(session: Session, indexed: Indexed): void {
    for (const key of Object.keys(indexed.counters) as (keyof Counters)[]) {
      if (key === 'cacheBytes') session.counters[key] = indexed.counters[key]; else session.counters[key] += indexed.counters[key];
    }
    session.warnings.push(...indexed.warnings);
  }
  private async revision(session: Session, revision: string): Promise<Snapshot> {
    // A moving ref must be explicitly resolved each request. Full object IDs can be reused without Git I/O.
    let exact = revision;
    if (!/^[a-f0-9]{40,64}$/.test(exact)) { exact = (await git(session.root, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`])).trim(); session.counters.subprocesses++; }
    const cached = session.snapshots.get(exact); if (cached) return cached;
    const joined = session.revisionJobs.get(exact); if (joined) return joined;
    const job = (async () => {
      const indexed = await this.backend.run({ root: session.root, database: path.join(session.directory, 'index.sqlite'), kind: 'revision', revision: exact });
      this.addCounters(session, indexed); const view = snapshot(indexed.revision, indexed.files);
      if (session.snapshots.size >= LIMITS.history) session.snapshots.delete(session.snapshots.keys().next().value!);
      session.snapshots.set(exact, view); return view;
    })();
    session.revisionJobs.set(exact, job);
    try { return await job; } finally { session.revisionJobs.delete(exact); }
  }
  private unavailable(session: Session, freshness: 'pending' | 'unavailable', reason: string) {
    return { freshness, coverage: 'unknown', conformance: 'unreviewed', transition: freshness === 'pending' ? 'implementing' : 'blocked', reason, rootId: session.id };
  }
  private async refresh(session: Session): Promise<void> {
    if (session.refresh) return session.refresh;
    const operation = (async () => {
      const generations = new Map(session.dirty); if (!generations.size) return;
      const indexed = await this.backend.run({ root: session.root, database: path.join(session.directory, 'index.sqlite'), kind: 'working', paths: [...generations.keys()] });
      this.addCounters(session, indexed); await this.options.beforePublish?.(session.root, indexed);
      if (!session.current) throw new Error('Managed snapshot disappeared');
      for (const file of indexed.files) if (session.dirty.get(file.path) === generations.get(file.path) && ![...session.batches.values()].some(batch => batch.paths.includes(file.path))) {
        putFile(session.current, file); session.dirty.delete(file.path);
      }
      for (const file of indexed.deleted) if (session.dirty.get(file) === generations.get(file)) { dropFile(session.current, file); session.dirty.delete(file); }
      session.current.revision = `managed:${session.candidate}:${session.generation}`;
    })();
    session.refresh = operation;
    try { await operation; } finally { session.refresh = undefined; }
  }
  private relevant(view: Snapshot, request: Request): FileRecord[] {
    if (typeof request.reference !== 'string') return [...view.files.values()];
    const reference = request.reference.replace(/^\[\[|\]\]$/g, '');
    if (reference.startsWith('code:')) {
      const filename = decodeURIComponent(reference.slice(5).split('#')[0]!);
      const file = view.files.get(filename); return file ? [file] : [];
    }
    if (reference.startsWith('spec:') || reference.startsWith('design:')) {
      const addressed = view.addresses.get(JSON.stringify(reference.split('#').map(decodeURIComponent)));
      return [...addressed ?? []].map(file => view.files.get(file)!);
    }
    if (!reference.startsWith('spec:') && !reference.startsWith('design:') && !reference.includes('.')) {
      const candidates = view.names.get(normalizeName(reference.split('#')[0]!));
      return [...new Set([...candidates ?? [], ...view.unknowns])].map(file => view.files.get(file)!);
    }
    return [...view.files.values()];
  }
  private resolutionOptions(view: Snapshot, request: Request): ResolveOptions {
    const packages: NonNullable<ResolveOptions['packages']> = {};
    let detectedPolicy: string | undefined;
    for (const file of view.configuration) {
      if (/package\.json$/.test(file)) {
        try {
          const pkg = JSON.parse(view.files.get(file)!.source) as { name?: string; exports?: unknown };
          if (pkg.name && pkg.exports && typeof pkg.exports === 'object' && !Array.isArray(pkg.exports)) {
            const exports = Object.fromEntries(Object.entries(pkg.exports).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
            packages[pkg.name] = { root: path.posix.dirname(file), exports };
          } else if (pkg.name && typeof pkg.exports === 'string') packages[pkg.name] = { root: path.posix.dirname(file), exports: { '.': pkg.exports } };
        } catch { detectedPolicy = `unreadable package topology (${file})`; }
      }
      if (/(?:eslint|dependency-cruiser|nx\.json)/.test(file)) detectedPolicy = file;
    }
    return { fileMap: view.files, packages, inventoryComplete: true,
      fromPath: typeof request.fromPath === 'string' ? request.fromPath : undefined,
      scope: typeof request.scope === 'string' ? request.scope : undefined,
      edge: request.edge === 'observation' ? 'observation' : request.edge === 'dependency' || request.fromPath ? 'dependency' : 'observation',
      detectedPolicy: request.edge !== 'observation' && (request.edge === 'dependency' || request.fromPath) ? detectedPolicy : undefined };
  }
  private async read(request: Request): Promise<unknown> {
    const session = this.session(request); const mode = string(request, 'view'); let view: Snapshot;
    if (mode === 'revision') view = await this.revision(session, string(request, 'revision'));
    else if (mode === 'current') {
      if (this.mutationOwners.has(session.root)) return this.unavailable(session, 'pending', 'Candidate is reserved by a consequential operation');
      if (!await this.checkIdentity(session)) return this.unavailable(session, 'unavailable', session.reason!);
      if (!session.qualified || !session.current) return this.unavailable(session, 'unavailable', session.reason ?? 'Unqualified observation');
      if (session.batches.size) return this.unavailable(session, 'pending', 'Acknowledged writer batch is still in flight; settle a checkpoint or request its baseline revision');
      await this.refresh(session);
      if (session.batches.size || session.dirty.size || !session.qualified) return this.unavailable(session, 'pending', 'Input generation changed during refresh; retry after the writer settles');
      view = session.current;
    } else throw new Error('view must explicitly select revision or current');
    const bindingKey = JSON.stringify([mode, mode === 'revision' ? view.revision : '', request.reference, request.selector, request.fromPath, request.scope, request.edge]);
    const key = JSON.stringify([bindingKey, request.adoptBinding]);
    const cached = session.queries.get(key);
    const warm = cached?.revision === view.revision;
    const relevant = warm ? cached.paths.map(file => view.files.get(file)!) : this.relevant(view, request);
    const needed = new Map(relevant.map(file => [file.path, file]));
    const options = warm ? undefined : this.resolutionOptions(view, request);
    if (!warm) for (const config of view.configuration) needed.set(config, view.files.get(config)!);
    let unknownDependencies = false;
    const requested = typeof request.reference === 'string' ? request.reference.replace(/^\[\[|\]\]$/g, '') : '';
    const requestedKey = normalizeName(requested.split('#').at(-1)!);
    for (const file of needed.values()) if (!warm && file.imports.length &&
      ((file.bindings ?? []).some(binding => binding.exported) ||
       (requested.startsWith(`code:${file.path}#`) && !file.units.some(unit => unit.address === requested)) ||
       (file.exportStars?.length && !file.units.some(unit => unit.key === requestedKey)))) {
      const dependencies = resolveDependencies(file, relevant, options);
      unknownDependencies ||= dependencies.unknown;
      for (const dependency of dependencies.files) needed.set(dependency.path, dependency);
      if (needed.size > 512) throw new Error('Query dependency budget exceeded; request a bounded explicit scope');
    }
    const files = [...needed.values()];
    const basis = warm ? cached.basis : hash(files.map(file => `${file.path}:${file.hash}`).sort().join('\n'));
    let value = session.queries.get(key)?.basis === basis ? session.queries.get(key)!.value : undefined;
    if (value === undefined) {
      session.counters.dependencyVisits += files.length;
      if (typeof request.reference === 'string') {
        const previous = session.bindings.get(bindingKey);
        value = resolveReference(request.reference, files, {
          ...options, inventoryComplete: !unknownDependencies,
          previousBinding: previous && request.adoptBinding !== previous ? { id: previous } : undefined
        });
        const resolved = value as { status: string; unit?: { id: string }; candidates: { id: string }[] };
        if (resolved.status === 'rebind' && resolved.candidates.length === 1 && request.adoptBinding === resolved.candidates[0]!.id) {
          value = resolveReference(request.reference, files, { ...options, inventoryComplete: !unknownDependencies });
        }
        const accepted = value as { status: string; unit?: { id: string } };
        if (accepted.status === 'resolved' && accepted.unit) {
          if (session.bindings.size >= LIMITS.queries && !session.bindings.has(bindingKey)) throw new Error('Binding subscription budget reached; use an exact address');
          session.bindings.set(bindingKey, accepted.unit.id);
        }
      }
      else if (request.selector) value = selectUnits(request.selector as Parameters<typeof selectUnits>[0], files);
      else value = { status: 'known', units: files.flatMap(file => file.units), diagnostics: files.flatMap(file => file.diagnostics) };
      if (session.queries.size >= LIMITS.queries) session.queries.delete(session.queries.keys().next().value!);
      session.queries.set(key, { basis, value, revision: view.revision, paths: files.map(file => file.path) });
    }
    const token: Token = { rootId: session.id, incarnation: session.incarnation, kernel: this.incarnation, view: mode, revision: view.revision, epoch: session.epoch, basis };
    const serialized = JSON.stringify(value); let result: unknown = value;
    const object = value as { units?: unknown[]; diagnostics?: unknown[]; status?: string };
    const offset = request.cursor ? Number(String(request.cursor).split(':').at(-1)) : 0;
    if (request.cursor && !String(request.cursor).startsWith(`${view.revision}:${basis}:`)) throw new Error('Paging cursor belongs to a different revision or dependency basis');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid paging cursor');
    const limit = Math.min(LIMITS.rows, Math.max(1, Number(request.limit ?? 100)));
    let nextCursor: string | undefined;
    if (object.units) {
      result = { ...object, units: object.units.slice(offset, offset + limit) };
      if (object.units.length > offset + limit) nextCursor = `${view.revision}:${basis}:${offset + limit}`;
    }
    if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.resultBytes) throw new Error('Result byte budget exceeded; request a narrower address or smaller page');
    const partial = files.some(file => file.diagnostics.length > 0) || ['unknown', 'unresolved', 'ambiguous', 'denied', 'rebind'].includes(object.status ?? '');
    const response = { freshness: 'validated', coverage: partial ? 'partial' : 'complete-for-profile', conformance: object.status === 'resolved' || object.status === 'known' ? 'unreviewed' : 'discrepancy', transition: 'settled', token, data: result, nextCursor };
    session.counters.outputBytes += Buffer.byteLength(JSON.stringify(response));
    void serialized;
    return response;
  }
  private async beginBatch(request: Request): Promise<unknown> {
    const session = this.session(request); const writer = string(request, 'writer'); const scope = paths(request.paths);
    if (session.profile !== 'managed') throw new Error('Batches require an allocated managed candidate');
    if (this.mutationOwners.has(session.root)) throw new Error('Candidate is reserved by a consequential operation');
    if (!await this.checkIdentity(session)) throw new Error(session.reason);
    if (this.mutationOwners.has(session.root)) throw new Error('Candidate is reserved by a consequential operation');
    if (!scope.length) throw new Error('A mutation batch must declare a nonempty scope');
    if (session.batches.size >= 32) throw new Error('Writer batch budget reached');
    if ([...session.batches.values()].some(batch => batch.paths.some(file => scope.includes(file)))) throw new Error('Writer scope overlaps an open batch');
    if (request.token) {
      const token = request.token as Token;
      if (token.kernel !== this.incarnation || token.incarnation !== session.incarnation || token.rootId !== session.id || token.epoch !== session.epoch || token.revision !== session.current?.revision) throw new Error('Mutation token is stale; refresh affected inputs');
    }
    const batch: Batch = { id: randomUUID(), writer, paths: scope, target: String(request.target ?? session.candidate), started: this.now() };
    session.generation++; session.epoch++; for (const file of scope) session.dirty.set(file, session.generation);
    session.batches.set(batch.id, batch); await this.persist(session);
    return { batchId: batch.id, generation: session.generation, acknowledged: true };
  }
  private async completeBatch(request: Request): Promise<unknown> {
    const session = this.session(request); const batch = session.batches.get(string(request, 'batchId'));
    if (!batch) throw new Error('Unknown or already completed mutation batch');
    const actual = request.actualPaths ? paths(request.actualPaths) : batch.paths;
    session.generation++; for (const file of new Set([...batch.paths, ...actual])) session.dirty.set(file, session.generation);
    if (request.unknownWrites === true || actual.some(file => !batch.paths.includes(file))) { session.qualified = false; session.reason = 'Unbounded or escaped writer requires independent inventory checkpoint'; }
    session.batches.delete(batch.id); await this.persist(session); return this.status(session);
  }
  private async checkpoint(request: Request): Promise<unknown> {
    const session = this.session(request);
    if (session.profile !== 'managed') throw new Error('Checkpoint needs an explicitly allocated managed candidate');
    if (this.mutationOwners.has(session.root)) return this.unavailable(session, 'pending', 'Candidate is reserved by a consequential operation');
    if (!await this.checkIdentity(session)) throw new Error(session.reason);
    if (this.mutationOwners.has(session.root)) return this.unavailable(session, 'pending', 'Candidate is reserved by a consequential operation');
    if ([...session.batches.values()].some(batch => batch.writer !== request.writer)) return this.unavailable(session, 'pending', 'Another writer still owns an open batch');
    const generation = session.generation; const epoch = session.epoch;
    const indexed = await this.backend.run({ root: session.root, database: path.join(session.directory, 'index.sqlite'), kind: 'working' });
    this.addCounters(session, indexed);
    if (session.generation !== generation || session.epoch !== epoch) return this.unavailable(session, 'pending', 'Mutation or observation basis changed during checkpoint');
    const indexPath = path.join(session.directory, `git-index-${randomUUID()}`);
    const command = async (args: string[]) => {
      session.counters.subprocesses++;
      const { stdout } = await execute('git', ['-C', session.root, ...args], { env: { ...process.env, GIT_INDEX_FILE: indexPath }, windowsHide: true, timeout: 30_000 }); return stdout.trim();
    };
    let revision: string;
    try {
      await command(['read-tree', 'HEAD']); await command(['add', '--all']); const tree = await command(['write-tree']);
      const parent = await command(['rev-parse', 'HEAD']);
      revision = await command(['-c', 'user.name=Projector checkpoint', '-c', 'user.email=checkpoint@localhost', 'commit-tree', tree, '-p', parent, '-m', 'Projector sealed implementation checkpoint']);
      await command(['update-ref', `refs/projector/checkpoints/${session.id}`, revision]);
    } finally { await rm(indexPath, { force: true }); }
    if (session.generation !== generation || session.epoch !== epoch) return this.unavailable(session, 'pending', 'Mutation or observation basis changed while sealing checkpoint');
    // Git clean filters and line-ending normalization can differ from working bytes.
    // The sealed revision is extracted from its Git objects on explicit demand.
    session.current = snapshot(`managed:${session.candidate}:${session.generation}:${session.epoch + 1}`, indexed.files);
    session.batches.clear(); session.dirty.clear(); session.qualified = true; session.reason = undefined; session.epoch++;
    await this.persist(session); return { ...this.status(session), revision, freshness: 'validated', view: 'revision' };
  }
  async close(): Promise<void> { await Promise.all([...this.sessions.values()].map(session => this.persist(session))); await this.backend.close(); }
}

export { extractFile };
