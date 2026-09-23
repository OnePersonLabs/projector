import { mkdir, readFile, writeFile, realpath, lstat, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { extractFile, parseMarkdown, resolveReference, selectUnits } from '../documents/index.ts';
import type { FileRecord } from '../documents/index.ts';
import { OpenSpecAdapter } from './openspec.ts';
import { atomicJson, canonicalRoot, digest, exclusive, exists, files, git, run, safePath, textFile } from './io.ts';
import type { Applicability, ChangeServiceOptions, ChangeState, Contribution, Evidence, JsonRequest, Plan, Review, Support } from './types.ts';
export type * from './types.ts';

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a nonempty string`);
  return value;
}
function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error(`${field} must be an array of strings`);
  return value as string[];
}
function objects(value: unknown, field: string): JsonRequest[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error(`${field} must be an array of objects`);
  return value as JsonRequest[];
}
const stateRelative = (change: string) => `openspec/changes/${change}/implementation-state.json`;
const unwrap = (value: string) => value.replace(/^\[\[|\]\]$/g, '');
const canonicalReference = (value: string) => unwrap(value).split('#').map(part => decodeURIComponent(part)).join('#');
function artifact(change: string, name: string): boolean {
  if (name === 'openspec/config.yaml' || name.startsWith('openspec/schemas/projector/')) return true;
  if (/^openspec\/(specs|designs)\/.+\/(spec|design)\.md$/.test(name)) return true;
  const prefix = `openspec/changes/${change}/`;
  if (!name.startsWith(prefix)) return false;
  return /^(proposal\.md|tasks\.md|design\.md|\.openspec\.yaml|implementation-state\.json|(?:specs|designs)\/.+\/(?:spec|design)\.md)$/.test(name.slice(prefix.length));
}
function stateJson(state: ChangeState, additional: JsonRequest = {}): JsonRequest {
  const lifecyclePhase = state.obligations.some(item => /[Bb]locking prerequisite|Baseline does not include/.test(item)) ? 'blocked'
    : state.phase === 'published' ? 'ready-for-integration' : ['verified', 'archived', 'publishing'].includes(state.phase) ? 'verifying' : state.phase;
  return { ...state, lifecyclePhase, ...additional };
}

/** Durable change authority is Git checkpoints and the authored implementation record. */
export class ChangeService {
  private readonly adapter: OpenSpecAdapter;
  private readonly options: ChangeServiceOptions;
  private readonly extractionCache = new Map<string, FileRecord>();
  constructor(options: ChangeServiceOptions = {}) { this.options = options; this.adapter = new OpenSpecAdapter(options); }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private async context(request: JsonRequest): Promise<{ root: string; change: string }> {
    const root = await canonicalRoot(required(request.root, 'root'));
    const change = required(request.change, 'change');
    if (!/^[a-z][a-z0-9-]{0,100}$/.test(change)) throw new Error('change must be a lowercase hyphenated local name');
    return { root, change };
  }
  private async load(root: string, change: string): Promise<ChangeState> {
    const file = safePath(root, stateRelative(change));
    if (!await exists(file)) throw new Error(`Change ${change} is not prepared; run prepareChange`);
    const value = JSON.parse(await textFile(file)) as ChangeState;
    if (value.version !== 1 || value.root !== root || value.change !== change) throw new Error('Implementation state identity mismatch');
    if (await realpath(value.candidateRoot) !== safePath(root, path.relative(root, value.candidateRoot))) throw new Error('Candidate identity changed');
    if (!value.candidateBranch.startsWith(`refs/heads/projector/${change}-`)) throw new Error('Invalid candidate branch in implementation state');
    if (await git(root, ['rev-parse', '--verify', value.targetRef]) !== value.targetId) throw new Error('Durable target reference does not match implementation state');
    return value;
  }
  private async save(state: ChangeState): Promise<void> { await atomicJson(safePath(state.root, stateRelative(state.change)), state); }
  private async fingerprint(state: ChangeState): Promise<{ basis: string; changes: string[] }> {
    const changed = (await run('git', ['diff', '--name-only', '-z', state.baseline, '--'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    const added = (await run('git', ['ls-files', '--others', '--exclude-standard', '-z'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    const names = [...new Set([...changed, ...added])].filter(name => name !== stateRelative(state.change)).sort();
    const content: string[] = [];
    for (const name of names) {
      const location = safePath(state.candidateRoot, name);
      if (!await exists(location)) { content.push(name, 'deleted'); continue; }
      const info = await lstat(location);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Changed artifact is not an ordinary file: ${name}`);
      content.push(name, digest(await readFile(location)));
    }
    const plan = state.plan ? { ...state.plan, review: undefined } : undefined;
    return { basis: digest(JSON.stringify({ target: state.targetId, baseline: state.baseline, plan, content })), changes: names };
  }
  private async implementationSeal(state: ChangeState): Promise<string> {
    const changed = (await run('git', ['diff', '--name-only', '-z', state.baseline, '--'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    const added = (await run('git', ['ls-files', '--others', '--exclude-standard', '-z'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    const entries: string[] = [];
    for (const name of [...new Set([...changed, ...added])].sort()) {
      if (artifact(state.change, name) || (state.archivePath && name.startsWith(path.relative(state.candidateRoot, state.archivePath).replaceAll('\\', '/') + '/'))) continue;
      const location = safePath(state.candidateRoot, name);
      entries.push(name, await exists(location) ? digest(await readFile(location)) : 'deleted');
    }
    return digest(JSON.stringify(entries));
  }
  private async tasks(state: ChangeState): Promise<{ hash: string; text: string; complete: boolean; tracked: number }> {
    const source = await textFile(safePath(state.candidateRoot, `openspec/changes/${state.change}/tasks.md`));
    const tree = parseMarkdown('tasks.md', source).tree;
    // The Markdown AST excludes fenced examples. List items' source slices preserve task markers.
    let tracked = 0, incomplete = 0;
    const visit = (node: unknown): void => {
      const record = node as { type?: string; position?: { start: { offset?: number }; end: { offset?: number } }; children?: unknown[] };
      if (record.type === 'listItem') {
        const text = source.slice(record.position?.start.offset, record.position?.end.offset);
        const marker = /^(?:[-+*]|\d+[.)])\s+\[([^\]]*)\]/.exec(text);
        if (marker) { tracked++; if (!/^\s*x\s*$/i.test(marker[1]!)) incomplete++; }
      }
      for (const child of record.children ?? []) visit(child);
    };
    visit(tree);
    return { hash: digest(source), text: source.replace(/^(\s*(?:[-+*]|\d+[.)])\s+)\[[^\]]*\]/gm, '$1[]'), complete: tracked > 0 && incomplete === 0, tracked };
  }
  async prepareChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      if (await exists(safePath(root, stateRelative(change)))) {
        const old = await this.load(root, change);
        if (await this.adapter.inputHash(root, change) !== old.inputHash) return stateJson(old, { requiresRevision: true });
        return stateJson(old, { reused: true });
      }
      const baseline = await git(root, ['rev-parse', '--verify', '--end-of-options', `${typeof request.baseline === 'string' ? request.baseline : 'HEAD'}^{commit}`]);
      const projected = await this.adapter.target(root, change, baseline);
      const candidateId = randomUUID(); const branch = `projector/${change}-${candidateId.slice(0, 8)}`;
      const candidateRoot = safePath(root, `.worktrees/${branch.replaceAll('/', '-')}`);
      await mkdir(path.dirname(candidateRoot), { recursive: true });
      await git(root, ['-c', 'core.autocrlf=false', 'worktree', 'add', '-b', branch, candidateRoot, baseline]);
      // Revision design hashes name Git bytes. Checkout EOL filters are not part of that identity.
      const authorityPaths = (await git(root, ['ls-tree', '-r', '--name-only', baseline, '--', 'openspec/specs', 'openspec/designs', 'openspec/terms'])).split('\n').filter(Boolean);
      for (const name of authorityPaths) await writeFile(safePath(candidateRoot, name), (await run('git', ['show', `${baseline}:${name}`], root)).stdout);
      await this.adapter.copyInputs(root, candidateRoot, change);
      const gitDir = await git(candidateRoot, ['rev-parse', '--absolute-git-dir']);
      await atomicJson(path.join(gitDir, 'projector-candidate.json'), { version: 1, candidate: candidateId, root: await realpath(candidateRoot), baseline, writerContract: 'acknowledged-batches' });
      const targetRef = `refs/projector/${change}/target`;
      await git(root, ['update-ref', targetRef, projected.targetId, '0000000000000000000000000000000000000000']);
      const state: ChangeState = { version: 1, root, change, baseline, candidateRoot: await realpath(candidateRoot), candidateBranch: `refs/heads/${branch}`, candidateId,
        candidateHead: baseline, targetId: projected.targetId, targetRef, previousSupport: projected.previousSupport, requirements: projected.requirements,
        inputHash: await this.adapter.inputHash(root, change), sourceTasksHash: digest(await textFile(safePath(root, `openspec/changes/${change}/tasks.md`))),
        candidateTasksAtSync: digest(await textFile(safePath(candidateRoot, `openspec/changes/${change}/tasks.md`))), bindingRenames: projected.renames,
        phase: 'prepared', evidence: [], obligations: ['Plan applicability, contribution dispositions, and required evidence have not been supplied'] };
      await this.save(state); await this.options.fault?.('after-target');
      return stateJson(state);
    });
  }
  async reviseChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (['archived', 'publishing', 'published'].includes(state.phase)) throw new Error('A finishing or published change cannot be revised');
      const inputHash = await this.adapter.inputHash(root, change);
      if (inputHash === state.inputHash) return stateJson(state, { reused: true });
      const projected = await this.adapter.target(root, change, state.baseline, state.targetId);
      const oldTarget = state.targetId;
      await git(root, ['update-ref', `refs/projector/${change}/previous`, oldTarget]);
      await git(root, ['update-ref', state.targetRef, projected.targetId, oldTarget]);
      // Only authored change inputs are refreshed. Existing implementation edits stay available for disposition.
      const existing = safePath(state.candidateRoot, `openspec/changes/${change}`);
      const sourceFiles = new Set(await files(safePath(root, `openspec/changes/${change}`)));
      await this.options.beforeCandidateMutation?.(state.candidateRoot, 'reviseChange');
      for (const name of await files(existing)) if (name !== 'implementation-state.json' && name !== 'tasks.md' && !sourceFiles.has(name)) await unlink(safePath(existing, name));
      const candidateTasks = await textFile(safePath(existing, 'tasks.md'));
      await this.adapter.copyInputs(root, state.candidateRoot, change);
      // Candidate task edits are proposals/scheduling input and are never overwritten by target regeneration.
      await writeFile(safePath(existing, 'tasks.md'), candidateTasks);
      state.previousTarget = oldTarget; state.targetId = projected.targetId; state.inputHash = inputHash;
      state.bindingRenames = projected.renames;
      state.previousSupport = [...new Map([...state.previousSupport, ...projected.previousSupport].map(item => [`${item.decision}\0${item.target}\0${item.basis}`, item])).values()];
      state.requirements = projected.requirements; state.phase = 'implementing'; state.plan = undefined; state.evidence = [];
      state.obligations = ['Target changed: review the scoped plan diff and account for previous contributions'];
      await this.save(state);
      const diff = await git(root, ['diff', '--stat', oldTarget, state.targetId, '--', 'openspec/specs', 'openspec/designs']);
      return stateJson(state, { targetDiff: diff });
    });
  }
  async applyChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (!state.plan) throw new Error('Validate a plan before applying implementation');
      if (await this.adapter.inputHash(root, change) !== state.inputHash) throw new Error('Target inputs changed; run reviseChange');
      if ((await this.tasks(state)).hash !== state.plan.tasksHash) throw new Error('Tasks changed: preserve the edits and run validatePlan to review their basis');
      state.phase = 'implementing'; await this.save(state);
      return stateJson(state, { instruction: 'Apply the plan in candidateRoot through acknowledged begin/end mutation batches. Revalidate user task edits and record real evidence before finish.' });
    });
  }
  private plan(request: JsonRequest, targetId: string, tasksHash: string, tasksText: string, prior?: Plan): Plan {
    const applicability = request.applicability === undefined && prior ? prior.applicability : objects(request.applicability ?? [], 'applicability').map(item => ({
      requirement: canonicalReference(required(item.requirement, 'applicability.requirement')), selectors: Array.isArray(item.selectors) ? item.selectors : [], reason: required(item.reason, 'applicability.reason'), excluded: item.excluded === true
    }));
    const contributions = request.contributions === undefined && prior ? prior.contributions : objects(request.contributions ?? [], 'contributions').map(item => {
      const action = required(item.action, 'contribution.action');
      if (!['retain', 'remove', 'replace', 'revise'].includes(action)) throw new Error(`Unknown contribution action: ${action}`);
      return { path: required(item.path, 'contribution.path'), decision: canonicalReference(required(item.decision, 'contribution.decision')), target: item.target === undefined ? undefined : canonicalReference(required(item.target, 'contribution.target')), action: action as Contribution['action'], reason: required(item.reason, 'contribution.reason') };
    });
    let review: Review | undefined = prior?.review;
    if (request.review !== undefined) {
      const item = request.review as JsonRequest;
      review = { basis: required(item.basis, 'review.basis'), reviewer: required(item.reviewer, 'review.reviewer'), findings: strings(item.findings, 'review.findings'),
        examined: strings(item.examined, 'review.examined'), alternative: required(item.alternative, 'review.alternative') };
    }
    let taskChange = prior?.tasksText === tasksText ? prior.taskChange : undefined;
    if (request.taskChange !== undefined) {
      const item = request.taskChange as JsonRequest;
      if (!['scheduling', 'authority-amended'].includes(String(item.kind))) throw new Error('Task change requires scheduling or authority-amended disposition');
      taskChange = { kind: item.kind as 'scheduling' | 'authority-amended', reason: required(item.reason, 'taskChange.reason'), targetId: required(item.targetId, 'taskChange.targetId') };
    }
    const text = prior && prior.tasksText !== tasksText && (!taskChange || taskChange.targetId !== targetId) ? prior.tasksText : tasksText;
    return { targetId, tasksHash, tasksText: text, taskChange, applicability, contributions, prerequisites: request.prerequisites === undefined ? prior?.prerequisites ?? [] : strings(request.prerequisites, 'prerequisites'), review };
  }
  async validatePlan(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (['archived', 'publishing', 'published'].includes(state.phase)) throw new Error('Finishing plans are sealed');
      const sourceTasks = await textFile(safePath(root, `openspec/changes/${change}/tasks.md`));
      if (digest(sourceTasks) !== state.sourceTasksHash) {
        const candidateTasks = safePath(state.candidateRoot, `openspec/changes/${change}/tasks.md`);
        const candidateHash = digest(await textFile(candidateTasks));
        if (candidateHash === state.candidateTasksAtSync || candidateHash === digest(sourceTasks)) {
          await this.options.beforeCandidateMutation?.(state.candidateRoot, 'taskInput');
          await writeFile(candidateTasks, sourceTasks); state.sourceTasksHash = digest(sourceTasks); state.candidateTasksAtSync = state.sourceTasksHash; state.taskConflict = undefined;
        } else state.taskConflict = 'Source and candidate task edits diverged; reconcile both requests in candidate tasks and source tasks before validating';
      }
      const tasks = await this.tasks(state);
      state.plan = this.plan(request, state.targetId, tasks.hash, tasks.text, state.plan);
      const { obligations, basis, changes } = await this.gates(state, false);
      state.obligations = obligations; await this.save(state);
      return stateJson(state, { valid: obligations.length === 0, basis, changedArtifacts: changes, note: 'Task text is scheduling/proposed amendment input; target requirements and decisions retain authority.' });
    });
  }
  private async declaredApplicability(state: ChangeState, changed: string[]): Promise<{ applicability: Applicability[]; requirements: Set<string>; decisions: Set<string>; records: FileRecord[] }> {
    const applicability: Applicability[] = []; const requirements = new Set<string>(), decisions = new Set<string>();
    const records: FileRecord[] = [];
    const paths = (await git(state.root, ['ls-tree', '-r', '--name-only', state.targetId, '--', 'openspec/designs', 'openspec/specs'])).split('\n').filter(Boolean);
    for (const name of paths) {
      const key = `${state.root}\0${state.targetId}\0${name}`;
      let record = this.extractionCache.get(key);
      if (!record) {
        record = extractFile(name, (await run('git', ['show', `${state.targetId}:${name}`], state.root)).stdout);
        this.extractionCache.set(key, record);
      }
      records.push(record);
      if (record.diagnostics.length) throw new Error(`Target document invalid: ${record.diagnostics.map(item => item.message).join('; ')}`);
      for (const unit of record.units) {
        if (unit.kind === 'requirement') requirements.add(canonicalReference(unit.address));
        if (unit.kind === 'part') decisions.add(canonicalReference(unit.address));
        for (const item of (unit.data?.applies ?? []) as { requirement: string; selector: unknown; reason: string }[]) {
          applicability.push({ requirement: canonicalReference(item.requirement), selectors: [item.selector], reason: item.reason });
        }
      }
    }
    const inventory = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    for (const name of [...new Set(inventory)]) {
      if (name.startsWith('openspec/specs/') || name.startsWith('openspec/designs/') || name.startsWith('openspec/changes/') || name.startsWith('openspec/schemas/')) continue;
      const location = safePath(state.candidateRoot, name);
      if (!await exists(location)) continue;
      const info = await lstat(location);
      if (info.isSymbolicLink()) throw new Error(`Cannot claim a complete symlink inventory: ${name}`);
      if (info.size > 2 * 1024 * 1024) throw new Error(`Planning extraction exceeds the 2 MiB per-file limit: ${name}`);
      const key = `${state.candidateRoot}\0${state.baseline}\0${name}`;
      let record = !changed.includes(name) ? this.extractionCache.get(key) : undefined;
      if (!record) {
        record = extractFile(name, await textFile(location));
        if (!changed.includes(name)) this.extractionCache.set(key, record);
      }
      records.push(record);
    }
    // This is a derived bounded extraction cache; recovery depends only on the files and Git objects.
    let cachedBytes = [...this.extractionCache.values()].reduce((sum, record) => sum + Buffer.byteLength(record.source), 0);
    while (this.extractionCache.size > 4096 || cachedBytes > 32 * 1024 * 1024) {
      const oldest = this.extractionCache.keys().next().value!;
      cachedBytes -= Buffer.byteLength(this.extractionCache.get(oldest)!.source); this.extractionCache.delete(oldest);
    }
    return { applicability, requirements, decisions, records };
  }
  private async gates(state: ChangeState, completing: boolean): Promise<{ obligations: string[]; basis: string; changes: string[] }> {
    const { basis, changes } = await this.fingerprint(state); const obligations: string[] = [];
    if (await this.adapter.inputHash(state.root, state.change) !== state.inputHash) obligations.push('Target inputs changed; run reviseChange');
    if (digest(await textFile(safePath(state.root, `openspec/changes/${state.change}/tasks.md`))) !== state.sourceTasksHash) obligations.push('Source task edits have not been reconciled; run validatePlan');
    if (!state.plan) return { obligations: [...obligations, 'No reviewed implementation plan'], basis, changes };
    if (state.plan.targetId !== state.targetId) obligations.push('Plan target is stale');
    const tasks = await this.tasks(state);
    if (tasks.hash !== state.plan.tasksHash) obligations.push('Task edits need plan reconciliation; task text cannot amend product meaning');
    if (tasks.text !== state.plan.tasksText) obligations.push('Task wording changed: classify scheduling edits or amend their owning authority; task text cannot authorize behavior changes');
    if (state.taskConflict) obligations.push(state.taskConflict);
    if (completing && !tasks.complete) obligations.push('Implementation tasks are incomplete or contain no tracked tasks');
    const declared = await this.declaredApplicability(state, changes);
    for (const requirement of state.requirements.map(canonicalReference).filter(item => declared.requirements.has(item))) {
      const entries = [...state.plan.applicability, ...declared.applicability].filter(item => canonicalReference(item.requirement) === requirement);
      let disposed = false;
      for (const entry of entries) {
        if (!entry.reason.trim() || !entry.selectors.length) continue;
        for (const selector of entry.selectors) {
          const selected = selectUnits(selector, declared.records, { inventoryComplete: true });
          if (selected.status === 'unknown') obligations.push(`Applicability selector is unknown: ${requirement}: ${selected.diagnostics.map(item => item.message).join('; ')}`);
          else if (selected.units.length || entry.excluded) disposed = true;
          else obligations.push(`Applicability selector currently has no members; provide a scoped exclusion or implementing scope: ${requirement}`);
        }
      }
      if (!disposed) obligations.push(`Missing applicability disposition: ${requirement}`);
    }
    const support = await this.adapter.support(state.root, state.targetId);
    const renamed = (decision: string) => canonicalReference(Object.entries(state.bindingRenames ?? {}).find(([old]) => canonicalReference(old) === canonicalReference(decision))?.[1] ?? decision);
    const matches = (item: Support, contribution: Contribution) => item.path === contribution.path && renamed(item.decision) === renamed(contribution.decision) && (!item.target?.includes('#') || canonicalReference(item.target) === contribution.target);
    for (const contribution of state.plan.contributions) {
      safePath(state.candidateRoot, contribution.path);
      const withdrawsPrior = ['remove', 'replace'].includes(contribution.action) && state.previousSupport.some(item => matches(item, contribution));
      if (!withdrawsPrior && !declared.decisions.has(renamed(contribution.decision))) obligations.push(`Contribution refers to no current decision: ${contribution.decision}`);
      if (!withdrawsPrior && !support.some(item => matches(item, contribution))) obligations.push(`Contribution lacks a current Realizes binding: ${contribution.path} (${contribution.decision})`);
    }
    for (const name of changes.filter(item => /^openspec\/(specs|designs)\//.test(item))) obligations.push(`Live authority was edited inside the candidate; express this change in its target delta: ${name}`);
    const implementations = changes.filter(name => !artifact(state.change, name));
    const baselinePaths = implementations.length ? new Set((await run('git', ['ls-tree', '-r', '--name-only', '-z', state.baseline, '--', ...implementations], state.root)).stdout.split('\0').filter(Boolean)) : new Set<string>();
    for (const name of implementations) {
      const removed = !await exists(safePath(state.candidateRoot, name));
      if (!state.plan.contributions.some(item => item.path === name && (removed ? item.action === 'remove' || item.action === 'replace' : item.action !== 'remove' && support.some(target => matches(target, item))))) obligations.push(`Changed artifact has no current contribution disposition: ${name}`);
      const current = declared.records.find(record => record.path === name);
      if (!removed && current?.language === 'typescript') {
        if (current.diagnostics.length) obligations.push(`Changed semantic unit inventory is unknown: ${name}`);
        const previous = baselinePaths.has(name) ? extractFile(name, (await run('git', ['show', `${state.baseline}:${name}`], state.root)).stdout).units : [];
        const currentSupport = support.filter(item => item.path === name && state.plan!.contributions.some(contribution => contribution.action !== 'remove' && matches(item, contribution)));
        for (const unit of current.units.filter(item => item.kind === 'symbol')) {
          const original = previous.find(item => item.id === unit.id);
          if (original?.bodyHash === unit.bodyHash && original.exported === unit.exported) continue;
          const address = canonicalReference(unit.address);
          const covered = currentSupport.some(item => {
            const target = canonicalReference(item.target ?? `code:${item.path}`);
            return !target.includes('#') || target === address || address.startsWith(`${target}.`);
          });
          if (!covered) obligations.push(`Changed semantic unit has no current realization: ${unit.address}`);
        }
      }
    }
    const affected = state.previousSupport.filter(item => implementations.includes(item.path) || !support.some(current => current.target === item.target && current.decision === item.decision && current.basis === item.basis));
    for (const old of affected) {
      const disposition = state.plan.contributions.find(item => matches(old, item));
      if (!disposition) obligations.push(`Previous contribution needs retain/remove/replace/revise: ${old.decision} -> ${old.target ?? old.path}`);
      else if (disposition.action === 'retain' && !support.some(item => matches(item, disposition))) obligations.push(`Retention has no surviving design support: ${old.path}`);
    }
    for (const prerequisite of state.plan.prerequisites) {
      if (!/^[a-z][a-z0-9-]{0,100}$/.test(prerequisite)) throw new Error('Invalid prerequisite name');
      const location = safePath(state.root, stateRelative(prerequisite));
      if (!await exists(location)) obligations.push(`Blocking prerequisite is not published: ${prerequisite}`);
      else {
        const prior = JSON.parse(await textFile(location)) as ChangeState;
        if (prior.phase !== 'published' || !prior.publication) obligations.push(`Blocking prerequisite is not published: ${prerequisite}`);
        else if ((await run('git', ['merge-base', '--is-ancestor', prior.publication, state.baseline], state.root, { allowFailure: true })).code !== 0) obligations.push(`Baseline does not include published prerequisite: ${prerequisite}`);
      }
    }
    if (completing) {
      for (const old of affected) {
        const disposition = state.plan.contributions.find(item => matches(old, item));
        if (disposition && ['remove', 'replace'].includes(disposition.action) && old.target && !support.some(item => canonicalReference(item.target ?? '') === canonicalReference(old.target!))) {
          if (declared.records.flatMap(item => item.units).some(unit => canonicalReference(unit.address) === canonicalReference(old.target!))) obligations.push(`Withdrawn contribution remains without current support: ${old.target}`);
        }
      }
      for (const record of declared.records.filter(item => item.path.startsWith('openspec/designs/'))) {
        for (const reference of record.references) {
          const resolution = resolveReference(reference.text, declared.records, { fromPath: record.path, inventoryComplete: true });
          if (resolution.status !== 'resolved') obligations.push(`Target design reference ${resolution.status}: [[${reference.text}]] in ${record.path}`);
        }
      }
      for (const name of [...new Set([...implementations, ...affected.map(item => item.path)])]) {
        if (!state.evidence.some(item => item.passed && item.basis === basis && item.scope.includes(name))) obligations.push(`Missing current executed evidence: ${name}`);
      }
      if (!state.evidence.some(item => item.passed && item.basis === basis)) obligations.push('At least one current executed verification is required');
      const review = state.plan.review;
      if (!review || review.basis !== basis || !review.examined.length || !review.alternative.trim()) obligations.push('Independent review must examine current diff, missing concerns, retained structure, and a credible alternative');
      else if (review.findings.length) obligations.push(...review.findings.map(finding => `Unresolved review finding: ${finding}`));
    }
    return { obligations: [...new Set(obligations)], basis, changes };
  }
  async recordEvidence(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (!state.plan || ['archived', 'publishing', 'published'].includes(state.phase)) throw new Error('Evidence requires an active reviewed plan');
      const command = required(request.command, 'command'), args = strings(request.args ?? [], 'args'), scope = strings(request.scope, 'scope');
      if (!scope.length) throw new Error('Evidence scope cannot be empty');
      for (const name of scope) safePath(state.candidateRoot, name);
      const before = await this.fingerprint(state);
      const timeoutMs = typeof request.timeoutMs === 'number' ? request.timeoutMs : 60_000;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error('timeoutMs must be between 1 and 600000');
      await this.options.beforeCandidateMutation?.(state.candidateRoot, 'recordEvidence');
      const result = await run(command, args, state.candidateRoot, { allowFailure: true, timeoutMs });
      const after = await this.fingerprint(state);
      const output = `${result.stdout}${result.stderr}`;
      const evidence: Evidence = { id: randomUUID(), basis: before.basis, command, args, scope, passed: result.code === 0 && before.basis === after.basis,
        exitCode: result.code, output: output.slice(-16000), outputHash: digest(output), durationMs: result.durationMs, runtime: process.version, recordedAt: new Date(this.now()).toISOString() };
      state.evidence = state.evidence.filter(item => item.basis === before.basis).slice(-31); state.evidence.push(evidence); await this.save(state);
      return { evidence, basis: after.basis, changedDuringRun: before.basis !== after.basis };
    });
  }
  private async verifyTarget(state: ChangeState): Promise<void> {
    const targetPaths = (await git(state.root, ['ls-tree', '-r', '--name-only', state.targetId, '--', 'openspec/specs', 'openspec/designs'])).split('\n').filter(Boolean);
    const actualPaths = (await files(safePath(state.candidateRoot, 'openspec/specs'))).map(name => `openspec/specs/${name}`)
      .concat((await files(safePath(state.candidateRoot, 'openspec/designs'))).map(name => `openspec/designs/${name}`)).sort();
    if (JSON.stringify([...targetPaths].sort()) !== JSON.stringify(actualPaths)) throw new Error('Materialized target document inventory mismatch');
    for (const name of targetPaths) {
      const expected = (await run('git', ['show', `${state.targetId}:${name}`], state.root)).stdout;
      if (expected !== await textFile(safePath(state.candidateRoot, name))) throw new Error(`Materialized target differs from reviewed bytes: ${name}`);
    }
  }
  private async materializeDesignTarget(state: ChangeState): Promise<void> {
    const before = (await git(state.root, ['ls-tree', '-r', '--name-only', state.baseline, '--', 'openspec/designs'])).split('\n').filter(Boolean);
    const after = (await git(state.root, ['ls-tree', '-r', '--name-only', state.targetId, '--', 'openspec/designs'])).split('\n').filter(Boolean);
    for (const name of [...new Set([...before, ...after])]) {
      const destination = safePath(state.candidateRoot, name);
      const current = await exists(destination) ? await textFile(destination) : undefined;
      const old = before.includes(name) ? (await run('git', ['show', `${state.baseline}:${name}`], state.root)).stdout : undefined;
      const target = after.includes(name) ? (await run('git', ['show', `${state.targetId}:${name}`], state.root)).stdout : undefined;
      if (current !== old && current !== target) throw new Error(`Design changed outside the sealed target: ${name}`);
      if (current === target) continue;
      if (target === undefined) await unlink(destination);
      else { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, target); }
    }
  }
  async finishChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => this.finish(await this.load(root, change)));
  }
  private async finish(state: ChangeState): Promise<JsonRequest> {
    if (state.phase === 'published') {
      if (await git(state.root, ['rev-parse', state.candidateBranch]) !== state.publication) throw new Error('Published candidate branch moved; exact prior publication remains available');
      return stateJson(state, { reused: true });
    }
    await this.options.beforeCandidateMutation?.(state.candidateRoot, 'finishChange');
    if (state.phase !== 'publishing' && await git(state.root, ['rev-parse', state.candidateBranch]) !== state.candidateHead) throw new Error('Candidate branch moved before finish; scoped refresh required');
    if (state.phase === 'publishing') {
      const current = await git(state.root, ['rev-parse', state.candidateBranch]);
      if (current === state.publication) { state.phase = 'published'; state.obligations = []; await this.save(state); return stateJson(state, { recovered: true }); }
      if (current !== state.candidateHead) throw new Error('Candidate branch moved before publication; scoped refresh required');
    }
    if (!['archived', 'publishing'].includes(state.phase)) {
      if (state.phase !== 'verified') {
        const gate = await this.gates(state, true); state.obligations = gate.obligations;
        if (gate.obligations.length) { await this.save(state); return stateJson(state, { complete: false, basis: gate.basis }); }
        state.implementationSeal = await this.implementationSeal(state);
        state.candidateInputsHash = await this.adapter.inputHash(state.candidateRoot, state.change);
        state.verifiedTasksHash = (await this.tasks(state)).hash;
        state.phase = 'verified'; await this.save(state);
      } else if (state.implementationSeal !== await this.implementationSeal(state)
        || state.candidateInputsHash !== await this.adapter.inputHash(state.candidateRoot, state.change)
        || state.verifiedTasksHash !== (await this.tasks(state)).hash
        || state.inputHash !== await this.adapter.inputHash(state.root, state.change)) {
        throw new Error('Sealed candidate inputs changed during finish recovery');
      }
      const active = safePath(state.candidateRoot, `openspec/changes/${state.change}`);
      await atomicJson(path.join(active, 'implementation-state.json'), { ...state, phase: 'verified', obligations: [] });
      await this.materializeDesignTarget(state);
      const archived = await this.adapter.invoke(state.candidateRoot, ['archive', state.change, '--yes', '--json']);
      const data = archived.archive as { path?: string; change?: string } | undefined;
      if (!data?.path || data.change !== state.change) throw new Error('OpenSpec archive returned an unexpected identity');
      state.archivePath = data.path;
      await this.verifyTarget(state);
      await this.adapter.invoke(state.candidateRoot, ['validate', '--specs', '--strict', '--json']);
      state.phase = 'archived'; await this.save(state); await this.options.fault?.('after-archive');
    }
    await this.verifyTarget(state);
    if (!state.implementationSeal || state.implementationSeal !== await this.implementationSeal(state)) throw new Error('Implementation changed after evidence was sealed; publication refused');
    if (!state.publication) {
      await atomicJson(safePath(state.candidateRoot, path.relative(state.candidateRoot, path.join(state.archivePath!, 'implementation-state.json'))), { ...state, phase: 'archived', obligations: [] });
      await git(state.candidateRoot, ['add', '--all']);
      const tree = await git(state.candidateRoot, ['write-tree']);
      state.publication = await git(state.candidateRoot, ['commit-tree', tree, '-p', state.candidateHead, '-m', `Complete Projector change: ${state.change}`], { env: {
        GIT_AUTHOR_NAME: 'Projector', GIT_AUTHOR_EMAIL: 'projector@localhost', GIT_COMMITTER_NAME: 'Projector', GIT_COMMITTER_EMAIL: 'projector@localhost'
      } });
      state.phase = 'publishing'; await this.save(state);
    }
    await this.options.fault?.('before-publication');
    await git(state.root, ['update-ref', state.candidateBranch, state.publication, state.candidateHead]);
    await this.options.fault?.('after-publication');
    state.phase = 'published'; state.obligations = []; await this.save(state);
    return stateJson(state, { complete: true });
  }
  async resumeChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (['archived', 'publishing', 'published'].includes(state.phase)) return this.finish(state);
      const active = safePath(state.candidateRoot, `openspec/changes/${change}`);
      if (!await exists(active)) {
        const archivedRoot = safePath(state.candidateRoot, 'openspec/changes/archive');
        const candidates = (await files(archivedRoot)).filter(name => name.endsWith('/implementation-state.json'));
        for (const name of candidates) {
          const archived = JSON.parse(await textFile(safePath(archivedRoot, name))) as ChangeState;
          if (archived.change === change && archived.targetId === state.targetId && archived.candidateId === state.candidateId) {
            state.archivePath = path.dirname(safePath(archivedRoot, name)); await this.verifyTarget(state);
            state.phase = 'archived'; await this.save(state); return this.finish(state);
          }
        }
        throw new Error('Active candidate artifacts disappeared without a matching exact archive');
      }
      if (state.phase === 'verified') return this.finish(state);
      const gate = await this.gates(state, false); state.obligations = gate.obligations; await this.save(state);
      return stateJson(state, { recovered: true, basis: gate.basis });
    });
  }
}
