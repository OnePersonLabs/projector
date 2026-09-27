import { mkdir, readFile, writeFile, realpath, lstat, unlink, mkdtemp, symlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDocumentIntelligence, metadataFile, parseMarkdown, resolveReference, selectUnits } from '../documents/index.ts';
import type { FileRecord } from '../documents/index.ts';
import { workingBytes } from '../index/index.ts';
import { OpenSpecAdapter } from './openspec.ts';
import { atomicJson, canonicalRoot, digest, exclusive, exists, files, git, run, runGit, safePath, textFile } from './io.ts';
import type { Applicability, ChangeServiceOptions, ChangeState, Contribution, Evidence, JsonRequest, Plan, Review, Support } from './types.ts';
import { applyPatch, changedPaths, changeArtifact, replay, selectedTree, workingTree, withIndex } from './workspace.ts';
import { preparePublication, publishPublication } from './publication.ts';
import { captureGenerationInputs, finishGenerationReceipts, validateGenerated } from './generated.ts';
export { preparePublication, publishPublication } from './publication.ts';
export type { PublicationInput } from './publication.ts';
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
const artifact = changeArtifact;
function stateJson(state: ChangeState, additional: JsonRequest = {}): JsonRequest {
  const lifecyclePhase = state.obligations.some(item => /[Bb]locking prerequisite|Baseline does not include/.test(item)) ? 'blocked'
    : state.phase === 'published' ? 'complete' : ['verified', 'archived', 'publishing'].includes(state.phase) ? 'verifying' : state.phase;
  return { ...state, lifecyclePhase, ...additional };
}

/** Durable change authority is Git checkpoints and the authored implementation record. */
export class ChangeService {
  private readonly adapter: OpenSpecAdapter;
  private readonly options: ChangeServiceOptions;
  private readonly extractionCache = new Map<string, FileRecord>();
  private documentPromise?: ReturnType<typeof createDocumentIntelligence>;
  private get documents() { return this.documentPromise ??= createDocumentIntelligence(); }
  constructor(options: ChangeServiceOptions = {}) { this.options = options; this.adapter = new OpenSpecAdapter(options); }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private async context(request: JsonRequest): Promise<{ root: string; change: string }> {
    const root = await canonicalRoot(required(request.root, 'root'));
    const change = required(request.change, 'change');
    if (!/^[a-z][a-z0-9-]{0,100}$/.test(change)) throw new Error('change must be a lowercase hyphenated local name');
    return { root, change };
  }
  private async load(root: string, change: string): Promise<ChangeState> {
    const privateFile = await this.stateFile(root, change);
    const file = await exists(privateFile) ? privateFile : safePath(root, stateRelative(change));
    if (!await exists(file)) throw new Error(`Change ${change} is not prepared; run prepareChange`);
    const value = JSON.parse(await textFile(file)) as ChangeState;
    if (![1, 2].includes(value.version) || value.root !== root || value.change !== change) throw new Error('Implementation state identity mismatch');
    if (await realpath(value.candidateRoot) !== value.candidateRoot) throw new Error('Candidate identity changed');
    if (value.version === 1) {
      value.version = 2; value.workspaceMode = 'isolated';
      value.targetBranch = await git(root, ['symbolic-ref', 'HEAD']);
      value.integrationHead = await git(root, ['rev-parse', 'HEAD']); value.authorityBase = value.baseline;
      if (!value.initialTree) {
        const current = await workingTree(value.candidateRoot, change);
        const provisioned = (await changedPaths(root, value.baseline, current)).filter(name => name === 'openspec/config.yaml' || name.startsWith('openspec/schemas/'));
        value.initialTree = await replay(root, value.baseline, value.baseline, current, provisioned);
      }
      value.selectionTree ??= value.baseline;
      value.initialIndex = await git(root, ['write-tree']);
      value.evidence = value.evidence.map(item => ({ ...item, verificationBasis: undefined }));
      if (value.plan) value.plan.review = undefined;
      if (['verified', 'archived', 'publishing', 'published'].includes(value.phase)) {
        const active = safePath(value.candidateRoot, `openspec/changes/${change}`);
        if (!await exists(path.join(active, 'tasks.md'))) {
          const source = safePath(root, `openspec/changes/${change}`);
          const recovery = await exists(path.join(source, 'tasks.md')) ? source : value.archivePath;
          if (!recovery || !await exists(path.join(recovery, 'tasks.md'))) throw new Error('Legacy finalization has no recoverable change inputs; restore its source or archive before resume');
          for (const name of await files(recovery)) if (name !== 'implementation-state.json') {
            const destination = safePath(active, name); await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, await readFile(safePath(recovery, name)));
          }
        }
        value.candidateHead = await git(value.candidateRoot, ['rev-parse', 'HEAD']);
        await this.verifyTarget(value); value.synchronizedTarget = value.targetId;
        value.phase = 'implementing'; value.publication = undefined; value.archivePath = undefined;
        value.implementationSeal = undefined; value.candidateInputsHash = undefined; value.verifiedTasksHash = undefined;
        value.obligations = ['Legacy candidate retained; renew verification and independent review before integration'];
      }
      await this.save(value);
    }
    if (value.workspaceMode === 'checkout' && value.candidateRoot !== root) throw new Error('Checkout state must name the selected root');
    if (value.workspaceMode === 'isolated' && !value.candidateBranch.startsWith(`refs/heads/projector/${change}-`)) throw new Error('Invalid candidate branch in implementation state');
    if (await git(root, ['rev-parse', '--verify', value.targetRef]) !== value.targetId) throw new Error('Durable target reference does not match implementation state');
    return value;
  }
  private async stateFile(root: string, change: string): Promise<string> {
    return path.join(await git(root, ['rev-parse', '--absolute-git-dir']), 'projector-changes', `${change}.json`);
  }
  private async save(state: ChangeState): Promise<void> {
    await atomicJson(await this.stateFile(state.root, state.change), state);
    if (!['archived', 'publishing', 'published'].includes(state.phase)) await atomicJson(safePath(state.root, stateRelative(state.change)), state);
  }
  private async fingerprint(state: ChangeState): Promise<{ basis: string; verificationBasis: string; changes: string[] }> {
    const selected = await selectedTree(state);
    const tasks = await this.tasks(state);
    const plan = state.plan ? { ...state.plan, review: undefined, tasksHash: undefined, tasksText: tasks.text } : undefined;
    const verificationBasis = await this.checkBasis(state, state.candidateRoot, undefined, selected.working);
    return { basis: digest(JSON.stringify({ version: 2, target: state.targetId, tree: selected.tree, plan, recovery: state.finalizationDispositions })), verificationBasis, changes: selected.changes };
  }
  private async checkBasis(state: ChangeState, root = state.candidateRoot, inputPaths?: string[], tree?: string): Promise<string> {
    tree ??= await workingTree(root, state.change);
    const entries = (await runGit(['ls-tree', '-rz', tree, '--', ...(inputPaths ?? [])], root)).stdout.split('\0').filter(Boolean).filter(entry => {
      const name = entry.slice(entry.indexOf('\t') + 1);
      return !name.startsWith(`openspec/changes/${state.change}/`) && !(name.startsWith('openspec/changes/archive/') && name.split('/')[3]?.endsWith(`-${state.change}`));
    });
    return digest(JSON.stringify({ version: 2, target: state.targetId, inputs: inputPaths?.slice().sort(), entries }));
  }
  private async eligibleEvidence(state: ChangeState, verificationBasis?: string): Promise<Evidence[]> {
    verificationBasis ??= await this.checkBasis(state);
    const latest = new Map<string, Evidence>();
    for (const item of state.evidence) if ((item.purpose ?? 'verification') === 'verification' && (!item.executionRoot || item.executionRoot === state.candidateRoot)) latest.set(JSON.stringify([item.command, item.args, item.inputPaths]), item);
    const current: Evidence[] = [];
    for (const item of latest.values()) if (item.passed && item.runtime === process.version && item.basisVersion === 2 && item.verificationBasis === (item.inputPaths ? await this.checkBasis(state, state.candidateRoot, item.inputPaths) : verificationBasis)) current.push(item);
    const superseded = new Set(current.flatMap(item => item.supersedes ?? []));
    return current.filter(item => !superseded.has(item.id));
  }
  private async implementationSeal(state: ChangeState): Promise<string> {
    const changed = (await runGit(['diff', '--name-only', '-z', state.baseline, '--'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
    const added = (await runGit(['ls-files', '--others', '--exclude-standard', '-z'], state.candidateRoot)).stdout.split('\0').filter(Boolean);
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
    let tracked = 0, incomplete = 0; const descriptions: string[] = [];
    const visit = (node: unknown): void => {
      const record = node as { type?: string; position?: { start: { offset?: number }; end: { offset?: number } }; children?: unknown[] };
      if (record.type === 'listItem') {
        const text = source.slice(record.position?.start.offset, record.position?.end.offset);
        const marker = /^(?:[-+*]|\d+[.)])\s+\[([^\]]*)\]/.exec(text);
        if (marker) {
          tracked++; if (!/^\s*x\s*$/i.test(marker[1]!)) incomplete++;
          // Only the task's own paragraph is its instruction. Result notes and fenced examples are bookkeeping.
          const paragraph = record.children?.[0] as typeof record | undefined;
          const instruction = source.slice(paragraph?.position?.start.offset, paragraph?.position?.end.offset);
          descriptions.push(instruction.replace(/^\[[^\]]*\]\s*/, ''));
        }
      }
      for (const child of record.children ?? []) visit(child);
    };
    visit(tree);
    return { hash: digest(source), text: JSON.stringify(descriptions), complete: tracked > 0 && incomplete === 0, tracked };
  }
  async prepareChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      if (await exists(await this.stateFile(root, change)) || await exists(safePath(root, stateRelative(change)))) {
        const old = await this.load(root, change);
        if (await this.adapter.inputHash(root, change) !== old.inputHash) return stateJson(old, { requiresRevision: true });
        return stateJson(old, { reused: true });
      }
      const baseline = await git(root, ['rev-parse', '--verify', '--end-of-options', `${typeof request.baseline === 'string' ? request.baseline : 'HEAD'}^{commit}`]);
      const mode = request.workspaceMode ?? 'checkout';
      if (mode !== 'checkout' && mode !== 'isolated') throw new Error('workspaceMode must be checkout or isolated');
      const targetBranch = await git(root, ['symbolic-ref', 'HEAD']);
      const rootGitDir = await git(root, ['rev-parse', '--absolute-git-dir']);
      const markerPath = path.join(rootGitDir, 'projector-candidate.json');
      if (mode === 'checkout' && await exists(markerPath)) {
        const marker = JSON.parse(await textFile(markerPath)) as { change?: string };
        if (marker.change && marker.change !== change) {
          const prior = await this.load(root, marker.change);
          if (prior.phase !== 'published') throw new Error(`Checkout already belongs to active change ${marker.change}; use isolation for concurrent work`);
        }
      }
      const initialIndex = await git(root, ['write-tree']);
      const projected = await this.adapter.target(root, change, baseline);
      const candidateId = randomUUID(); const branch = `projector/${change}-${candidateId.slice(0, 8)}`;
      const candidateRoot = mode === 'checkout' ? root : path.join(await mkdtemp(path.join(tmpdir(), 'projector-checkout-')), 'worktree');
      if (mode === 'isolated') await git(root, ['-c', 'core.autocrlf=false', 'worktree', 'add', '-b', branch, candidateRoot, baseline]);
      // Revision design hashes name Git bytes. Checkout EOL filters are not part of that identity.
      const authorityPaths = (await git(root, ['ls-tree', '-r', '--name-only', baseline, '--', 'openspec/specs', 'openspec/designs', 'openspec/terms'])).split('\n').filter(Boolean);
      if (mode === 'isolated') for (const name of authorityPaths) await writeFile(safePath(candidateRoot, name), (await runGit(['show', `${baseline}:${name}`], root)).stdout);
      await this.adapter.copyInputs(root, candidateRoot, change);
      const gitDir = await git(candidateRoot, ['rev-parse', '--absolute-git-dir']);
      await atomicJson(path.join(gitDir, 'projector-candidate.json'), { version: 1, mode, change, candidate: candidateId, root: await realpath(candidateRoot), baseline, writerContract: 'acknowledged-batches' });
      const initialTree = await workingTree(candidateRoot, change);
      const selectionTree = await applyPatch(root, baseline, typeof request.selectedPatch === 'string' ? request.selectedPatch : '');
      for (const [name, tree] of Object.entries({ initial: initialTree, selection: selectionTree, index: initialIndex })) await git(root, ['update-ref', `refs/projector/${change}/${name}`, tree]);
      const targetRef = `refs/projector/${change}/target`;
      await git(root, ['update-ref', targetRef, projected.targetId, '0000000000000000000000000000000000000000']);
      const state: ChangeState = { version: 2, workspaceMode: mode, targetBranch, integrationHead: baseline, authorityBase: baseline,
        authorityPaths: (await changedPaths(root, baseline, projected.targetId)).filter(name => /^openspec\/(specs|designs)\//.test(name)), initialTree, initialIndex, selectionTree, root, change, baseline, candidateRoot: await realpath(candidateRoot), candidateBranch: mode === 'checkout' ? targetBranch : `refs/heads/${branch}`, candidateId,
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
      if (state.pendingSynchronization) throw new Error('Synchronization was interrupted; run syncChange before revising');
      if (state.synchronizedTarget) await git(root, ['update-ref', `refs/projector/${change}/synchronized/${state.synchronizedTarget}`, state.synchronizedTarget]);
      const inputHash = await this.adapter.inputHash(root, change);
      const implementationInputs = await this.adapter.inputHash(state.candidateRoot, change);
      if (state.workspaceMode === 'isolated' && implementationInputs !== state.inputHash && implementationInputs !== inputHash) throw new Error('Source and isolated change artifacts diverged; reconcile both copies before revision');
      if (inputHash === state.inputHash) return stateJson(state, { reused: true });
      const projected = await this.adapter.target(root, change, state.authorityBase ?? state.baseline, state.targetId);
      state.authorityPaths = [...new Set([...(state.authorityPaths ?? []), ...(await changedPaths(root, state.authorityBase ?? state.baseline, projected.targetId)).filter(name => /^openspec\/(specs|designs)\//.test(name))])];
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
      state.requirements = projected.requirements; state.phase = 'implementing'; state.plan = undefined;
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
      if (request.finalizationDispositions !== undefined) {
        for (const entry of objects(request.finalizationDispositions, 'finalizationDispositions')) {
          const name = required(entry.path, 'path'), reason = required(entry.reason, 'reason');
          if (!state.pendingFinalizationArtifacts?.some(item => item.path === name)) throw new Error(`No unresolved finalization artifact: ${name}`);
          state.finalizationDispositions = [...(state.finalizationDispositions ?? []), { path: name, reason }];
          state.pendingFinalizationArtifacts = state.pendingFinalizationArtifacts.filter(item => item.path !== name);
        }
      }
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
      if (await git(root, ['symbolic-ref', 'HEAD']) !== state.targetBranch) throw new Error('The selected checkout switched target branches; reconcile the intended integration branch');
      const integrationHead = await git(root, ['rev-parse', 'HEAD']);
      if (integrationHead !== (state.integrationHead ?? state.baseline)) {
        const tree = await replay(root, integrationHead, state.authorityBase ?? state.baseline, state.targetId, await this.ownedAuthority(state));
        const target = await git(root, ['commit-tree', tree, '-p', integrationHead, '-m', `Refresh authority for ${change}`]);
        await git(root, ['update-ref', state.targetRef, target, state.targetId]);
        state.targetId = target; state.authorityBase = integrationHead;
        if (state.plan) { state.plan.targetId = target; state.plan.review = undefined; }
      }
      state.integrationHead = integrationHead;
      if (state.workspaceMode === 'checkout') state.candidateHead = integrationHead;
      state.plan = this.plan(request, state.targetId, tasks.hash, tasks.text, state.plan);
      const { obligations, basis, verificationBasis, changes } = await this.gates(state, false);
      state.obligations = obligations; await this.save(state);
      return stateJson(state, { valid: obligations.length === 0, basis, verificationBasis, changedArtifacts: changes, note: 'Task text is scheduling/proposed amendment input; target requirements and decisions retain authority.' });
    });
  }
  private async declaredApplicability(state: ChangeState, _changed: string[], inventoryRoot = state.candidateRoot): Promise<{ applicability: Applicability[]; requirements: Set<string>; decisions: Set<string>; records: FileRecord[] }> {
    const applicability: Applicability[] = []; const requirements = new Set<string>(), decisions = new Set<string>();
    const records: FileRecord[] = [];
    const paths = (await git(state.root, ['ls-tree', '-r', '--name-only', state.targetId, '--', 'openspec/designs', 'openspec/specs'])).split('\n').filter(Boolean);
    for (const name of paths) {
      const key = `${state.root}\0${state.targetId}\0${name}`;
      let record = this.extractionCache.get(key);
      if (!record) {
        record = await (await this.documents).extract(name, (await runGit(['show', `${state.targetId}:${name}`], state.root)).stdoutBytes);
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
    const inventory = (await runGit(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], inventoryRoot)).stdout.split('\0').filter(Boolean);
    for (const name of [...new Set(inventory)]) {
      if (name.startsWith('openspec/specs/') || name.startsWith('openspec/designs/') || name.startsWith('openspec/changes/') || name.startsWith('openspec/schemas/')) continue;
      const location = safePath(inventoryRoot, name);
      if (!await exists(location)) continue;
      const info = await lstat(location);
      if (info.isSymbolicLink()) throw new Error(`Cannot claim a complete symlink inventory: ${name}`);
      const bytes = await workingBytes(location);
      const host = await this.documents;
      const key = `${host.fingerprint}\0${name}\0${bytes.hash}`;
      let record = this.extractionCache.get(key);
      if (!record) {
        record = bytes.content ? await host.extract(name, bytes.content) : metadataFile(name, bytes.hash, bytes.size);
        this.extractionCache.set(key, record);
      }
      records.push(record);
    }
    // This is a derived bounded extraction cache; recovery depends only on the files and Git objects.
    let cachedBytes = [...this.extractionCache.values()].reduce((sum, record) => sum + Buffer.byteLength(record.source), 0);
    while (this.extractionCache.size > 4096 || cachedBytes > 32 * 1024 * 1024) {
      const oldest = this.extractionCache.keys().next().value!;
      cachedBytes -= Buffer.byteLength(this.extractionCache.get(oldest)!.source); this.extractionCache.delete(oldest);
    }
    return { applicability, requirements, decisions, records: [...(await this.documents).resolveRepository(new Map(records.map(record => [record.path, record]))).values()] };
  }
  private async gates(state: ChangeState, completing: boolean, inventoryRoot?: string): Promise<{ obligations: string[]; basis: string; verificationBasis: string; changes: string[] }> {
    const { basis, verificationBasis, changes } = await this.fingerprint(state); const obligations: string[] = [];
    for (const item of state.pendingFinalizationArtifacts ?? []) {
      let bytes: Buffer | undefined;
      if (/^openspec\/(specs|designs)\//.test(item.path)) {
        const result = await runGit(['show', `${state.targetId}:${item.path}`], state.root, { allowFailure: true });
        if (result.code === 0) bytes = result.stdoutBytes;
      } else if (await exists(safePath(state.root, item.path))) bytes = await readFile(safePath(state.root, item.path));
      if ((bytes ? digest(bytes) : null) !== item.hash) obligations.push(`Unresolved finalization artifact: ${item.path}; incorporate its retained bytes or record a finalizationDispositions reason for discarding them`);
    }
    if (await this.adapter.inputHash(state.root, state.change) !== state.inputHash) obligations.push('Target inputs changed; run reviseChange');
    if (await this.adapter.inputHash(state.candidateRoot, state.change) !== state.inputHash) obligations.push('Implementation change artifacts differ from the reviewed source; reconcile both copies before revision or finish');
    if (digest(await textFile(safePath(state.root, `openspec/changes/${state.change}/tasks.md`))) !== state.sourceTasksHash) obligations.push('Source task edits have not been reconciled; run validatePlan');
    if (!state.plan) return { obligations: [...obligations, 'No reviewed implementation plan'], basis, verificationBasis, changes };
    if (state.plan.targetId !== state.targetId) obligations.push('Plan target is stale');
    const tasks = await this.tasks(state);
    if (tasks.hash !== state.plan.tasksHash) obligations.push('Task edits need plan reconciliation; task text cannot amend product meaning');
    if (tasks.text !== state.plan.tasksText) obligations.push('Task wording changed: classify scheduling edits or amend their owning authority; task text cannot authorize behavior changes');
    if (state.taskConflict) obligations.push(state.taskConflict);
    if (completing && !tasks.complete) obligations.push('Implementation tasks are incomplete or contain no tracked tasks');
    const declared = await this.declaredApplicability(state, changes, inventoryRoot);
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
    const implementations = changes.filter(name => !artifact(state.change, name));
    const baselinePaths = implementations.length ? new Set((await runGit(['ls-tree', '-r', '--name-only', '-z', state.baseline, '--', ...implementations], state.root)).stdout.split('\0').filter(Boolean)) : new Set<string>();
    const renamed = (decision: string) => canonicalReference(Object.entries(state.bindingRenames ?? {}).find(([old]) => canonicalReference(old) === canonicalReference(decision))?.[1] ?? decision);
    const matches = (item: Support, contribution: Contribution) => item.path === contribution.path && renamed(item.decision) === renamed(contribution.decision) && (!item.target?.includes('#') || canonicalReference(item.target) === contribution.target);
    for (const contribution of state.plan.contributions) {
      safePath(state.candidateRoot, contribution.path);
      const withdrawsPrior = ['remove', 'replace'].includes(contribution.action) && state.previousSupport.some(item => matches(item, contribution));
      const removesBaselineFile = contribution.action === 'remove' && baselinePaths.has(contribution.path) && !await exists(safePath(state.candidateRoot, contribution.path));
      if (!withdrawsPrior && !declared.decisions.has(renamed(contribution.decision))) obligations.push(`Contribution refers to no current decision: ${contribution.decision}`);
      if (!withdrawsPrior && !removesBaselineFile && !support.some(item => matches(item, contribution))) obligations.push(`Contribution lacks a current Realizes binding: ${contribution.path} (${contribution.decision})`);
    }
    if (state.pendingSynchronization) obligations.push('Synchronization was interrupted; run syncChange');
    for (const name of await this.authorityConflicts(state)) obligations.push(`Live authority was edited inside the candidate; express this change in its target delta: ${name}`);
    for (const name of implementations) {
      const removed = !await exists(safePath(state.candidateRoot, name));
      if (!state.plan.contributions.some(item => item.path === name && (removed ? item.action === 'remove' || item.action === 'replace' : item.action !== 'remove' && support.some(target => matches(target, item))))) obligations.push(`Changed artifact has no current contribution disposition: ${name}`);
      const current = declared.records.find(record => record.path === name);
      if (!removed && current && current.units.some(unit => unit.kind !== 'file')) {
        if (current.capabilities?.units === 'unknown' || current.capabilities?.units === 'partial' || current.diagnostics.some(item => /syntax|duplicate/.test(item.code))) obligations.push(`Changed semantic unit inventory is unknown: ${name}`);
        const previous = baselinePaths.has(name) ? (await (await this.documents).extract(name, (await runGit(['show', `${state.baseline}:${name}`], state.root)).stdoutBytes)).units : [];
        const currentSupport = support.filter(item => item.path === name && state.plan!.contributions.some(contribution => contribution.action !== 'remove' && matches(item, contribution)));
        for (const unit of current.units.filter(item => item.kind !== 'file')) {
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
      const privateLocation = await this.stateFile(state.root, prerequisite);
      const location = await exists(privateLocation) ? privateLocation : safePath(state.root, stateRelative(prerequisite));
      const prior: ChangeState[] = [];
      if (await exists(location)) prior.push(JSON.parse(await textFile(location)) as ChangeState);
      else {
        const archivedRoot = safePath(state.root, 'openspec/changes/archive');
        for (const name of (await files(archivedRoot)).filter(item => item.endsWith('/implementation-state.json'))) {
          const archived = JSON.parse(await textFile(safePath(archivedRoot, name))) as ChangeState;
          if (archived.change === prerequisite) prior.push(archived);
        }
      }
      const publications = prior.filter(item => item.phase === 'published' && item.publication).map(item => item.publication!);
      // A committed receipt cannot contain its own commit hash. Derive publication from the
      // target branch history so prerequisites remain usable after cloning the repository.
      for (const name of (await files(safePath(state.root, 'openspec/changes/archive'))).filter(item => item.endsWith('/implementation-state.json'))) {
        const relative = `openspec/changes/archive/${name}`;
        const receipt = JSON.parse(await textFile(safePath(state.root, relative))) as ChangeState;
        if (receipt.version !== 2 || receipt.change !== prerequisite || !receipt.candidateId || !receipt.targetId) continue;
        const commits = (await git(state.root, ['log', '--format=%H', '--diff-filter=A', state.targetBranch!, '--', relative])).split('\n').filter(Boolean);
        for (const commit of commits) {
          const committed = JSON.parse((await runGit(['show', `${commit}:${relative}`], state.root)).stdout) as ChangeState;
          if (committed.change === prerequisite && committed.candidateId === receipt.candidateId && committed.targetId === receipt.targetId && ['verified', 'archived', 'published'].includes(committed.phase)) publications.push(commit);
        }
      }
      if (!publications.length) obligations.push(`Blocking prerequisite is not published: ${prerequisite}`);
      else if (!(await Promise.all(publications.map(commit => runGit(['merge-base', '--is-ancestor', commit, state.integrationHead ?? state.baseline], state.root, { allowFailure: true })))).some(result => result.code === 0)) {
        obligations.push(`Baseline does not include published prerequisite: ${prerequisite}`);
      }
    }
    if (completing) {
      const previousRecords = new Map<string, FileRecord>();
      for (const [name, source] of await this.authorityTree(state, state.previousTarget ?? state.baseline)) previousRecords.set(name, await (await this.documents).extract(name, source));
      const changedAuthority = (await runGit(['diff', '--name-only', '-z', state.previousTarget ?? state.baseline, state.targetId, '--', 'openspec/designs'], state.root)).stdout.split('\0').filter(Boolean);
      obligations.push(...validateGenerated({ records: new Map(declared.records.map(record => [record.path, record])), previousRecords,
        changedPaths: [...implementations, ...changedAuthority], support, previousSupport: state.previousSupport, receipts: state.evidence.flatMap(item => item.generated ?? []) }));
      for (const old of affected) {
        const disposition = state.plan.contributions.find(item => matches(old, item));
        const survivingSupport = support.some(item => item.path === old.path && (!item.target?.includes('#')
          || canonicalReference(item.target) === canonicalReference(old.target ?? '')
          || (item.target.startsWith('code:') && canonicalReference(old.target ?? '').startsWith(`${canonicalReference(item.target)}.`))));
        if (disposition && ['remove', 'replace'].includes(disposition.action) && old.target && !survivingSupport) {
          if (declared.records.flatMap(item => item.units).some(unit => canonicalReference(unit.address) === canonicalReference(old.target!))) obligations.push(`Withdrawn contribution remains without current support: ${old.target}`);
        }
      }
      for (const record of declared.records.filter(item => item.path.startsWith('openspec/designs/'))) {
        for (const reference of record.references) {
          const resolution = resolveReference(reference.text, declared.records, { fromPath: record.path, inventoryComplete: true });
          if (resolution.status !== 'resolved') obligations.push(`Target design reference ${resolution.status}: [[${reference.text}]] in ${record.path}`);
        }
      }
      const eligible = await this.eligibleEvidence(state, verificationBasis);
      for (const name of [...new Set([...implementations, ...affected.map(item => item.path)])]) {
        if (!eligible.some(item => item.scope.includes(name))) obligations.push(`Missing current executed evidence: ${name}`);
      }
      if (!eligible.length) obligations.push('At least one current executed verification is required');
      const review = state.plan.review;
      if (!review || review.basis !== basis || !review.examined.length || !review.alternative.trim()) obligations.push('Independent review must examine current diff, missing concerns, retained structure, and a credible alternative');
      else if (review.findings.length) obligations.push(...review.findings.map(finding => `Unresolved review finding: ${finding}`));
    }
    return { obligations: [...new Set(obligations)], basis, verificationBasis, changes };
  }
  async recordEvidence(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (!state.plan || ['archived', 'publishing', 'published'].includes(state.phase)) throw new Error('Evidence requires an active reviewed plan');
      const command = required(request.command, 'command'), args = strings(request.args ?? [], 'args'), scope = strings(request.scope, 'scope');
      if (!scope.length) throw new Error('Evidence scope cannot be empty');
      for (const name of scope) safePath(state.candidateRoot, name);
      const purpose = request.purpose ?? 'verification';
      if (!['verification', 'diagnostic', 'baseline', 'red', 'generation'].includes(String(purpose))) throw new Error('Unknown evidence purpose');
      const supersedes = request.supersedes === undefined ? undefined : strings(request.supersedes, 'supersedes');
      for (const id of supersedes ?? []) {
        const prior = state.evidence.find(item => item.id === id);
        if (!prior || prior.scope.some(name => !scope.includes(name))) throw new Error('A superseding check must cover every path of an existing evidence record');
      }
      const before = await this.fingerprint(state);
      const inputPaths = request.inputPaths === undefined ? undefined : strings(request.inputPaths, 'inputPaths');
      if (inputPaths) { if (!inputPaths.length) throw new Error('inputPaths cannot be empty; omit it for conservative whole-checkout coverage'); for (const name of inputPaths) safePath(state.candidateRoot, name); }
      const beforeCheck = inputPaths ? await this.checkBasis(state, state.candidateRoot, inputPaths) : before.verificationBasis;
      const generatedOutputs = request.generatedOutputs === undefined ? [] : strings(request.generatedOutputs, 'generatedOutputs');
      const generation = generatedOutputs.length ? await captureGenerationInputs(state.candidateRoot,
        new Map((await this.declaredApplicability(state, before.changes)).records.map(record => [record.path, record])), generatedOutputs) : undefined;
      const timeoutMs = typeof request.timeoutMs === 'number' ? request.timeoutMs : 60_000;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error('timeoutMs must be between 1 and 600000');
      await this.options.beforeCandidateMutation?.(state.candidateRoot, 'recordEvidence');
      const invocation = process.platform === 'win32' && /^(npm|npx)(?:\.cmd)?$/i.test(command)
        ? { command: process.execPath, args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', /^npx/i.test(command) ? 'npx-cli.js' : 'npm-cli.js'), ...args] }
        : { command, args };
      const result = await run(invocation.command, invocation.args, state.candidateRoot, { allowFailure: true, timeoutMs });
      const after = await this.fingerprint(state);
      const afterCheck = inputPaths ? await this.checkBasis(state, state.candidateRoot, inputPaths) : after.verificationBasis;
      const generated = generation ? await finishGenerationReceipts(state.candidateRoot, generation, { command, args, runtime: process.version, exitCode: result.code },
        new Map((await this.declaredApplicability(state, after.changes)).records.map(record => [record.path, record])), await this.adapter.support(state.root, state.targetId)) : undefined;
      const output = `${result.stdout}${result.stderr}`;
      const evidence: Evidence = { id: randomUUID(), basis: before.basis, basisVersion: 2, verificationBasis: beforeCheck, inputPaths, timeoutMs, purpose: purpose as Evidence['purpose'], supersedes, generated, command, args, scope, passed: result.code === 0 && beforeCheck === afterCheck,
        exitCode: result.code, output: output.slice(-16000), outputHash: digest(output), durationMs: result.durationMs, runtime: process.version, executionRoot: state.candidateRoot, recordedAt: new Date(this.now()).toISOString() };
      state.evidence.push(evidence); await this.save(state);
      return { evidence, basis: after.basis, verificationBasis: afterCheck, changedDuringRun: beforeCheck !== afterCheck };
    });
  }
  private async verifyTarget(state: ChangeState): Promise<void> {
    const expected = await this.authorityTree(state, state.targetId);
    for (const name of await this.ownedAuthority(state)) {
      const actual = await exists(safePath(state.candidateRoot, name)) ? await textFile(safePath(state.candidateRoot, name)) : undefined;
      if (expected.get(name) !== actual) throw new Error(`Materialized target differs from reviewed bytes: ${name}`);
    }
  }
  private async ownedAuthority(state: ChangeState): Promise<string[]> {
    return state.authorityPaths ?? (await changedPaths(state.root, state.authorityBase ?? state.baseline, state.targetId)).filter(name => /^openspec\/(specs|designs)\//.test(name));
  }
  private async authorityTree(state: ChangeState, revision: string): Promise<Map<string, string>> {
    const names = (await runGit(['ls-tree', '-r', '--name-only', '-z', revision, '--', 'openspec/specs', 'openspec/designs'], state.root)).stdout.split('\0').filter(Boolean);
    const result = new Map<string, string>();
    for (const name of names) result.set(name, (await runGit(['show', `${revision}:${name}`], state.root)).stdout);
    return result;
  }
  private async candidateAuthority(state: ChangeState): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const directory of ['openspec/specs', 'openspec/designs']) for (const relative of await files(safePath(state.candidateRoot, directory))) {
      const name = `${directory}/${relative}`;
      result.set(name, await textFile(safePath(state.candidateRoot, name)));
    }
    return result;
  }
  private async authorityConflicts(state: ChangeState): Promise<string[]> {
    const expected = await this.authorityTree(state, state.synchronizedTarget ?? state.baseline);
    const actual = await this.candidateAuthority(state);
    return (await this.ownedAuthority(state)).filter(name => expected.get(name) !== actual.get(name));
  }
  private async materializeTarget(state: ChangeState): Promise<void> {
    const before = await this.authorityTree(state, state.synchronizedTarget ?? state.baseline);
    const after = await this.authorityTree(state, state.targetId);
    const actual = await this.candidateAuthority(state);
    // Validate every file before writing any. Only a durable interrupted operation permits a mix of old and target bytes.
    if (state.pendingSynchronization && state.pendingSynchronization !== state.targetId) throw new Error('Pending synchronization target no longer matches the current target');
    for (const name of await this.ownedAuthority(state)) {
      if (actual.get(name) !== before.get(name) && (!state.pendingSynchronization || actual.get(name) !== after.get(name))) {
        throw new Error(`Live authority changed outside the synchronized target: ${name}`);
      }
    }
    await git(state.root, ['update-ref', `refs/projector/${state.change}/synchronized/${state.targetId}`, state.targetId]);
    state.pendingSynchronization = state.targetId; await this.save(state);
    for (const name of await this.ownedAuthority(state)) {
      const target = after.get(name), destination = safePath(state.candidateRoot, name);
      if (actual.get(name) === target) continue;
      if (target === undefined) await unlink(destination);
      else { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, target); }
      await this.options.fault?.('after-sync-file');
    }
    await this.verifyTarget(state);
    state.synchronizedTarget = state.targetId; state.pendingSynchronization = undefined; await this.save(state);
  }
  async syncChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (['verified', 'archived', 'publishing', 'published'].includes(state.phase)) throw new Error('A finishing or published change cannot be synchronized');
      const requiresRevision = await this.adapter.inputHash(root, change) !== state.inputHash;
      if (requiresRevision && !state.pendingSynchronization) throw new Error('Target inputs changed; run reviseChange');
      if (await git(root, ['rev-parse', state.candidateBranch]) !== state.candidateHead) throw new Error('Candidate branch moved before synchronization; scoped refresh required');
      const reused = state.synchronizedTarget === state.targetId && !state.pendingSynchronization;
      await this.options.beforeCandidateMutation?.(state.candidateRoot, 'syncChange');
      await this.materializeTarget(state);
      if (!reused) {
        if (state.plan) state.plan.review = undefined;
        state.obligations = requiresRevision ? ['Interrupted synchronization recovered; target inputs changed, run reviseChange']
          : ['Authority synchronized: execute verification and independent review against the current candidate'];
        await this.save(state);
      }
      return stateJson(state, { synchronized: true, reused, requiresRevision, basis: (await this.fingerprint(state)).basis });
    });
  }
  async finishChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => this.finish(await this.load(root, change)));
  }
  private async cleanupFinalization(state: ChangeState): Promise<void> {
    const directory = state.finalizationRoot;
    if (!directory) return;
    const archive = state.archivePath ? path.relative(directory, state.archivePath) : undefined;
    if (await exists(directory)) await git(state.root, ['worktree', 'remove', '--force', directory]);
    if (archive && !archive.startsWith('..') && !path.isAbsolute(archive)) state.archivePath = safePath(state.root, archive.replaceAll('\\', '/'));
    state.finalizationRoot = undefined; await this.save(state);
  }
  private async finish(state: ChangeState): Promise<JsonRequest> {
    if (state.phase === 'published') {
      const target = state.targetBranch ?? state.candidateBranch;
      if ((await runGit(['merge-base', '--is-ancestor', state.publication!, target], state.root, { allowFailure: true })).code !== 0) throw new Error('Published result is not integrated in the intended branch');
      await this.cleanupFinalization(state);
      return stateJson(state, { complete: true, reused: true });
    }
    await this.options.beforeCandidateMutation?.(state.candidateRoot, 'finishChange');
    const recovering = !!state.publicationTransaction;
    if (!state.publicationTransaction) {
      const integrationHead = state.integrationHead ?? state.baseline;
      if (await git(state.root, ['rev-parse', state.targetBranch!]) !== integrationHead) throw new Error('Target branch moved before finish; run validatePlan for scoped refresh');
      if (state.workspaceMode === 'isolated' && await git(state.root, ['rev-parse', state.candidateBranch]) !== state.candidateHead) throw new Error('Candidate branch moved before finish; reconcile its committed changes before publication');
      if (!state.finalizationRoot) {
        const gate = await this.gates(state, true); state.obligations = gate.obligations;
        if (gate.obligations.length) { await this.save(state); return stateJson(state, { complete: false, basis: gate.basis, verificationBasis: gate.verificationBasis }); }
        state.implementationSeal = await this.implementationSeal(state);
        state.candidateInputsHash = await this.adapter.inputHash(state.candidateRoot, state.change);
        state.verifiedTasksHash = (await this.tasks(state)).hash;
        const selected = await selectedTree(state);
        const directory = path.join(await mkdtemp(path.join(tmpdir(), 'projector-finish-')), 'worktree');
        await git(state.root, ['-c', 'core.autocrlf=false', 'worktree', 'add', '--detach', directory, integrationHead]);
        await git(directory, ['read-tree', '--reset', '-u', selected.tree]);
        await this.adapter.copyInputs(state.root, directory, state.change);
        const after = await this.authorityTree(state, state.targetId);
        for (const name of await this.ownedAuthority(state)) {
          const destination = safePath(directory, name), content = after.get(name);
          if (content === undefined) { if (await exists(destination)) await unlink(destination); }
          else { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, content); }
        }
        state.finalizationRoot = directory; state.phase = 'verified'; await this.save(state);
      }
      if (state.implementationSeal !== await this.implementationSeal(state)
        || state.candidateInputsHash !== await this.adapter.inputHash(state.candidateRoot, state.change)
        || state.verifiedTasksHash !== (await this.tasks(state)).hash
        || state.inputHash !== await this.adapter.inputHash(state.root, state.change)) throw new Error('Sealed inputs changed; preserve finalization and reconcile before publication');
      const directory = state.finalizationRoot;
      const finalView = { ...state, candidateRoot: directory };
      const selectedGate = await this.gates(state, true, directory);
      if (selectedGate.obligations.length) {
        state.obligations = selectedGate.obligations; await this.save(state);
        throw new Error(`Selected implementation does not satisfy its target; reconcile finalization before retry: ${selectedGate.obligations.join('; ')}`);
      }
      if (state.phase === 'verified') {
        const active = safePath(directory, `openspec/changes/${state.change}`);
        if (!await exists(active)) {
          const archives = safePath(directory, 'openspec/changes/archive'); const matches: string[] = [];
          for (const name of (await files(archives)).filter(name => name.endsWith('/implementation-state.json'))) {
            const receipt = JSON.parse(await textFile(safePath(archives, name))) as ChangeState;
            if (receipt.change === state.change && receipt.candidateId === state.candidateId && receipt.targetId === state.targetId) matches.push(path.dirname(safePath(archives, name)));
          }
          if (matches.length !== 1) throw new Error('Interrupted archive has no unique matching recovery receipt');
          state.archivePath = matches[0];
        } else {
          await atomicJson(path.join(active, 'implementation-state.json'), { ...state, phase: 'verified', obligations: [], finalizationRoot: undefined });
          const archived = await this.adapter.invoke(directory, ['archive', state.change, '--yes', '--skip-specs', '--json']);
          const data = archived.archive as { path?: string; change?: string } | undefined;
          if (!data?.path || data.change !== state.change) throw new Error('OpenSpec archive returned an unexpected identity');
          state.archivePath = data.path;
        }
        state.phase = 'archived'; await this.save(state); await this.options.fault?.('after-archive');
      }
      await this.verifyTarget(finalView);
      await this.adapter.invoke(directory, ['validate', '--specs', '--strict', '--json']);
      // Reuse provisioned dependencies only when their manifests match the selected tree.
      if (await exists(path.join(state.candidateRoot, 'node_modules')) && !await exists(path.join(directory, 'node_modules'))) {
        for (const name of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']) {
          const from = path.join(state.candidateRoot, name), to = path.join(directory, name);
          if (await exists(from) !== await exists(to) || (await exists(from) && digest(await readFile(from)) !== digest(await readFile(to)))) throw new Error(`Finalization dependencies need provisioning for the selected ${name}`);
        }
        await symlink(path.join(state.candidateRoot, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      }
      const verified = await this.eligibleEvidence(state);
      for (const item of verified) {
        const finalBasis = await this.checkBasis(state, directory, item.inputPaths);
        if (finalBasis === item.verificationBasis) continue;
        const previous = state.evidence.findLast(record => record.executionRoot === directory && record.command === item.command
          && JSON.stringify(record.args) === JSON.stringify(item.args) && JSON.stringify(record.inputPaths) === JSON.stringify(item.inputPaths));
        if (previous?.passed && previous.runtime === process.version && previous.verificationBasis === finalBasis) continue;
        const invocation = process.platform === 'win32' && /^(npm|npx)(?:\.cmd)?$/i.test(item.command)
          ? { command: process.execPath, args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', /^npx/i.test(item.command) ? 'npx-cli.js' : 'npm-cli.js'), ...item.args] }
          : { command: item.command, args: item.args };
        const result = await run(invocation.command, invocation.args, directory, { allowFailure: true, timeoutMs: item.timeoutMs ?? 60_000 });
        const output = result.stdout + result.stderr;
        const evidence = { ...item, id: randomUUID(), executionRoot: directory, verificationBasis: finalBasis, passed: result.code === 0 && finalBasis === await this.checkBasis(state, directory, item.inputPaths), exitCode: result.code,
          output: output.slice(-16000), outputHash: digest(output), durationMs: result.durationMs, recordedAt: new Date(this.now()).toISOString() };
        state.evidence.push(evidence); await this.save(state);
        if (!evidence.passed) throw new Error(`Selected-tree verification failed: ${item.command}; preserve finalization and correct the failure`);
      }
      if (!state.finalizationCommit) {
        await git(directory, ['add', '--all']);
        state.finalizationExpectedTree ??= await git(directory, ['write-tree']); await this.save(state);
        const head = await git(directory, ['rev-parse', 'HEAD']);
        if (head === integrationHead) await git(directory, ['commit', '-m', `Complete Projector change: ${state.change}`], { timeoutMs: 600_000 });
        else if (await git(directory, ['rev-parse', 'HEAD^']) !== integrationHead || await git(directory, ['rev-parse', 'HEAD^{tree}']) !== state.finalizationExpectedTree) throw new Error('Finalization branch changed outside its recorded commit');
        state.finalizationCommit = await git(directory, ['rev-parse', 'HEAD']); await this.save(state);
      }
      if (await git(directory, ['rev-parse', `${state.finalizationCommit}^{tree}`]) !== state.finalizationExpectedTree || await git(directory, ['status', '--porcelain'])) throw new Error('Hook changed the selected commit or left changes; reconcile those changes and renew verification and review before finish');
      state.publication = state.finalizationCommit;
      state.publicationTransaction = await preparePublication({ root: state.root, targetBranch: state.targetBranch!, targetHead: integrationHead, commit: state.publication, directory, change: state.change,
        materializedAuthority: state.workspaceMode === 'checkout' && state.synchronizedTarget ? { tree: state.synchronizedTarget, paths: await this.ownedAuthority(state) } : undefined });
      state.phase = 'publishing'; await this.save(state);
    }
    await publishPublication(state.root, state.publicationTransaction, { save: () => this.save(state), fault: this.options.fault });
    state.phase = 'published'; state.obligations = []; await this.save(state);
    await this.cleanupFinalization(state);
    return stateJson(state, { complete: true, ...(recovering ? { recovered: true } : {}) });
  }
  async resumeChange(request: JsonRequest): Promise<JsonRequest> {
    const { root, change } = await this.context(request);
    return exclusive(root, change, async () => {
      const state = await this.load(root, change);
      if (request.reconcileFinalization === true) {
        if (!state.finalizationRoot || state.publicationTransaction || state.phase === 'published') throw new Error('Only unpublished finalization can be reopened; resume an existing publication transaction first');
        const directory = state.finalizationRoot;
        const actual = await workingTree(directory, change);
        const expected = state.finalizationExpectedTree;
        if (expected) {
          const changed = await changedPaths(root, expected, actual);
          const implementation = changed.filter(name => !artifact(change, name));
          const current = await workingTree(state.candidateRoot, change);
          const merged = await replay(root, current, expected, actual, implementation);
          const present = new Set((await runGit(['ls-tree', '-rz', '--name-only', merged], root)).stdout.split('\0').filter(Boolean));
          await withIndex(state.candidateRoot, merged, async env => {
            const writes = implementation.filter(name => present.has(name));
            if (writes.length) await git(state.candidateRoot, ['checkout-index', '--force', '-z', '--stdin'], { env, input: writes.join('\0') + '\0' });
            for (const name of implementation.filter(name => !present.has(name))) if (await exists(safePath(state.candidateRoot, name))) await unlink(safePath(state.candidateRoot, name));
          });
          state.pendingFinalizationArtifacts = [];
          for (const name of changed.filter(name => artifact(change, name))) {
            const activeName = name.replace(/^openspec\/changes\/archive\/[^/]+\//, `openspec/changes/${change}/`);
            state.pendingFinalizationArtifacts.push({ path: activeName, hash: present.has(name) ? digest((await runGit(['show', `${actual}:${name}`], root)).stdoutBytes) : null });
          }
          state.obligations = state.pendingFinalizationArtifacts.map(item => `Finalization changed an authority or change artifact; reconcile its retained bytes into the authored delta before finishing: ${item.path}`);
        }
        state.recoveryContexts = [...(state.recoveryContexts ?? []), directory];
        state.finalizationRoot = undefined; state.finalizationExpectedTree = undefined; state.finalizationCommit = undefined;
        state.archivePath = undefined; state.publication = undefined; state.phase = 'implementing';
        state.implementationSeal = undefined; state.candidateInputsHash = undefined; state.verifiedTasksHash = undefined;
        if (state.plan) state.plan.review = undefined;
        state.obligations.push('Finalization reopened; renew verification and independent review'); await this.save(state);
        return stateJson(state, { recovered: true, basis: (await this.fingerprint(state)).basis });
      }
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
