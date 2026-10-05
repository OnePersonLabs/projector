import { activeRoot, inactive } from './activation.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hash, projectPath, discover, captureScope, writeJson, optionalJson } from './state.mjs';
import { loadMeaning, conditionOf, selectLenses } from './meaning.mjs';
import { readCheckpoint, updateCheckpoint, checkpointContext } from './work.mjs';
import { observe } from './providers/index.mjs';
export { writeCheckpoint, resume, closeCheckpoint } from './work.mjs';
export { repair } from './repair.mjs';

export async function focus(root, request = {}) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const records = await loadMeaning(root);
  const active = records.filter(item => item.status !== 'retired');
  if (!request.concepts?.length && !request.query && !request.paths?.length && !request.lenses?.length && !request.work) return { index: active.map(({ id, kind, title, file }) => ({ id, kind, title, file })), instruction: 'Select relevant identities, words, or paths; no global graph was loaded into the packet' };
  const words = request.query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const selected = active.filter(item => request.concepts?.includes(item.id) || request.lenses?.includes(item.id) || words.some(word => `${item.title} ${item.id} ${item.body}`.toLowerCase().includes(word)));
  for (const id of request.concepts ?? []) if (!active.some(record => record.id === id)) throw new Error(`Unknown active meaning: ${id}`);
  if (request.paths?.length) {
    for (const lens of active.filter(item => item.kind === 'lens')) {
      const population = await discover(root, (lens.selectors ?? []).flatMap(selector => selector.patterns));
      if (request.paths.some(file => population.includes(file))) {
        if (!selected.includes(lens)) selected.push(lens);
        for (const ref of lens.conditions ?? []) { const concept = active.find(item => item.id === ref.split('#')[0]); if (concept && !selected.includes(concept)) selected.push(concept); }
      }
    }
  }
  const ids = new Set(selected.map(record => record.id));
  const related = active.filter(item => !ids.has(item.id) && ((item.kind === 'lens' && item.conditions?.some(ref => ids.has(ref.split('#')[0]))) || item.concepts?.some(id => ids.has(id)) || selected.some(record => record.relations?.some(link => link.target === item.id))));
  const work = request.work ? await readCheckpoint(root, request.work) : undefined;
  const checkpoint = work && (request.includeWorkDetails === true ? work : checkpointContext(work));
  return { meaning: selected, related: related.map(({ id, kind, title, file }) => ({ id, kind, title, file })), checkpoint, observations: 'Request a provider explicitly when current code facts would help' };
}

async function selections(root, lens) {
  const result = [];
  for (const selector of lens.selectors) {
    try {
      const scope = await captureScope(root, selector.patterns);
      result.push({ ...selector, status: scope.inputs.length ? 'populated' : 'empty', scope, units: scope.inputs.map(input => ({ id: `${lens.id}/${selector.id}/${input.path}`, path: input.path, sourceHash: input.hash, role: selector.role, participatesIn: lens.conditions })) });
    } catch (error) { result.push({ ...selector, status: 'unresolved', units: [], reason: error.message }); }
  }
  return result;
}

export async function revisit(root, request = {}) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  if (!request.lenses?.length && !request.concepts?.length) throw new Error('Revisit needs explicit Lens or Concept identities');
  const records = await loadMeaning(root);
  const results = [];
  for (const lens of selectLenses(records, request)) {
    const previous = await optionalJson(await projectPath(root, `.projector/cache/selections/${hash(lens.id)}.json`));
    const current = await selections(root, lens);
    const prior = new Set(previous?.selectors?.flatMap(selector => selector.units.map(unit => unit.path)) ?? []);
    const now = new Set(current.flatMap(selector => selector.units.map(unit => unit.path)));
    const result = { lens: lens.id, lensHash: lens.hash, selectors: current, added: [...now].filter(file => !prior.has(file)), removed: [...prior].filter(file => !now.has(file)), coverage: 'Declared source population only; runtime/external completeness is unclaimed' };
    await writeJson(await projectPath(root, `.projector/cache/selections/${hash(lens.id)}.json`), result);
    results.push(result);
  }
  const checkpoint = request.work ? await readCheckpoint(root, request.work) : undefined;
  const boundaryPatterns = [...new Set([...(checkpoint?.boundaries ?? []), ...(request.paths ?? [])])];
  const selectedPaths = new Set(results.flatMap(result => result.selectors.flatMap(selector => selector.units.map(unit => unit.path))));
  let boundary;
  const discoveryQuestions = [];
  if (boundaryPatterns.length) {
    const cacheFile = await projectPath(root, `.projector/cache/boundaries/${hash({ work: request.work, patterns: boundaryPatterns })}.json`);
    const previous = await optionalJson(cacheFile) ?? checkpoint?.snapshot;
    const current = await captureScope(root, boundaryPatterns);
    const before = new Map((previous?.inputs ?? []).map(input => [input.path, input.hash]));
    const after = new Map(current.inputs.map(input => [input.path, input.hash]));
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(file => before.get(file) !== after.get(file));
    boundary = { scope: current, changed };
    for (const file of changed.filter(file => !selectedPaths.has(file))) discoveryQuestions.push({ path: file, reason: 'Changed within the directive boundary but outside current Lens selection; investigate relevance and check coverage' });
    await writeJson(cacheFile, current);
  }
  const observations = [];
  for (const lens of selectLenses(records, request)) for (const providerRequest of lens.observations ?? []) observations.push(await observe(root, providerRequest));
  if (request.query) observations.push(await observe(root, { provider: 'inventory', operation: 'relationships', files: [...new Set([...selectedPaths, ...(boundary?.scope.inputs.map(input => input.path) ?? [])])], literal: request.query }));
  return { selections: results, boundary, discoveryQuestions, observations };
}

async function checkScope(root, lens, check) {
  const patterns = [...new Set([...lens.selectors.filter(selector => check.selectors.includes(selector.id)).flatMap(selector => selector.patterns), ...(check.inputs ?? []), 'package.json', 'Cargo.toml', 'pyproject.toml', '*.csproj', 'tsconfig*.json', '.projector/config.json'])];
  const files = [];
  for (const arg of [check.command, ...check.args]) {
    if (typeof arg !== 'string' || path.isAbsolute(arg) || arg.startsWith('-')) continue;
    try { const file = await projectPath(root, arg); if ((await fs.stat(file)).isFile()) files.push(arg); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return captureScope(root, patterns, files);
}

function checkBinding(lens, concept, check) {
  return hash({ lens: lens.hash, concept: concept.hash, check, node: process.version, platform: process.platform, environment: hash(process.env) });
}

async function executeCheck(root, lens, concept, check) {
  const before = await checkScope(root, lens, check);
  const binding = checkBinding(lens, concept, check);
  const id = randomUUID();
  const directory = await projectPath(root, `.projector/cache/checks/${id}`);
  await fs.mkdir(directory, { recursive: true });
  const stdout = await fs.open(path.join(directory, 'stdout.log'), 'w');
  const stderr = await fs.open(path.join(directory, 'stderr.log'), 'w');
  let outcome;
  try {
    outcome = await new Promise(resolve => {
      const child = spawn(check.command, check.args, { cwd: root, env: { ...process.env, ...(check.env ?? {}) }, stdio: ['ignore', stdout.fd, stderr.fd], windowsHide: true, shell: false });
      child.once('error', error => resolve({ exitCode: null, error: error.message }));
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });
  } finally { await stdout.close(); await stderr.close(); }
  const after = await checkScope(root, lens, check);
  const current = before.fingerprint === after.fingerprint;
  const receipt = { id, lens: lens.id, check: check.id, binding, scope: before, target: check.target ?? process.platform, evidence: check.evidence, conditions: check.conditions, selectors: check.selectors, coverage: check.coverage, ...outcome, current, status: !current || outcome.error || outcome.signal || outcome.exitCode === null ? 'unresolved' : outcome.exitCode === 0 ? 'supported' : 'mismatch', stdout: `.projector/cache/checks/${id}/stdout.log`, stderr: `.projector/cache/checks/${id}/stderr.log` };
  await writeJson(path.join(directory, 'receipt.json'), receipt);
  await writeJson(await projectPath(root, `.projector/cache/latest/${hash(`${lens.id}/${check.id}`)}.json`), receipt);
  return receipt;
}

async function obtainCheck(root, lens, concept, check, run) {
  if (run) return executeCheck(root, lens, concept, check);
  const previous = await optionalJson(await projectPath(root, `.projector/cache/latest/${hash(`${lens.id}/${check.id}`)}.json`));
  if (!previous) return { check: check.id, status: 'unresolved', reason: 'No check receipt; use runChecks to execute an applicable native check' };
  const current = await checkScope(root, lens, check);
  if (previous.binding !== checkBinding(lens, concept, check) || previous.scope.fingerprint !== current.fingerprint || !previous.current) return { ...previous, status: 'unresolved', current: false, reason: 'Source, membership, condition, Lens/check, environment, or target changed' };
  for (const file of [previous.stdout, previous.stderr]) { try { await fs.access(await projectPath(root, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; return { ...previous, status: 'unresolved', reason: 'Cached evidence was removed; rerun check' }; } }
  return previous;
}

function coveragePaths(lens, check, selector) {
  if (check.coverage === 'selection') return selector.units.map(unit => unit.path);
  if (Array.isArray(check.coverage)) return check.coverage;
  return lens.selectors.filter(item => check.selectors.includes(item.id)).flatMap(item => item.patterns.filter(pattern => !/[!*?{[\]]/.test(pattern)));
}

export async function reconcile(root, request = {}) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  if (!request.lenses?.length && !request.concepts?.length) throw new Error('Reconcile needs explicit Lens or Concept identities');
  const records = await loadMeaning(root);
  const lenses = selectLenses(records, request);
  const discovery = await revisit(root, request);
  const observations = discovery.observations;
  const receipts = [];
  const verdicts = [];
  const observedMismatches = [];
  const independent = await captureScope(root, request.paths ?? lenses.flatMap(lens => lens.selectors.flatMap(selector => selector.patterns)));
  const checksByLens = new Map();
  for (const lens of lenses) {
    const lensCheckResults = [];
    for (const check of lens.checks ?? []) {
      const binding = { hash: hash(check.conditions.map(reference => conditionOf(records, reference).concept.hash)) };
      const receipt = await obtainCheck(root, lens, binding, check, request.runChecks === true);
      receipts.push(receipt);
      lensCheckResults.push({ check, receipt });
    }
    checksByLens.set(lens.id, lensCheckResults);
  }
  // Publish only after all selected Lenses have finished. A later Lens can
  // change an earlier Lens's dependency even when their selectors are disjoint.
  for (const lens of lenses) {
    const selection = discovery.selections.find(item => item.lens === lens.id);
    const lensCheckResults = checksByLens.get(lens.id);
    // Later checks can change an earlier check's inputs. Revalidate the whole
    // authored evidence scope before using any receipt in a current verdict.
    let authorityChanged = false;
    for (const record of [lens, ...lens.conditions.map(reference => conditionOf(records, reference).concept)]) {
      try { if (hash(await fs.readFile(await projectPath(root, record.file))) !== record.hash) authorityChanged = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; authorityChanged = true; }
    }
    for (const { check, receipt } of lensCheckResults) {
      const currentScope = await checkScope(root, lens, check);
      if (authorityChanged || (receipt.scope && currentScope.fingerprint !== receipt.scope.fingerprint)) {
        receipt.observedStatus ??= receipt.status;
        receipt.status = 'unresolved';
        receipt.current = false;
        receipt.reason = authorityChanged ? 'Meaning or Lens changed during reconciliation' : 'Check inputs changed after this observation';
      }
      if (receipt.status === 'mismatch' || receipt.observedStatus === 'mismatch') {
        for (const reference of check.conditions) {
          const { concept, condition } = conditionOf(records, reference);
          if (check.evidence !== condition.evidence) continue;
          const hashes = new Map((receipt.scope?.inputs ?? []).map(input => [input.path, input.hash]));
          const participants = selection.selectors.filter(selector => check.selectors.includes(selector.id)).flatMap(selector => selector.units.filter(unit => coveragePaths(lens, check, selector).includes(unit.path)).map(unit => ({selector:selector.id,unit:{...unit,sourceHash:hashes.get(unit.path)},selection:'populated',status:'mismatch',evidence:[receipt.id],reason:'Participant in the observed failing check scope; refresh current applicability separately'})));
          observedMismatches.push({condition:reference,lens:lens.id,meaningHash:concept.hash,lensHash:lens.hash,participants,status:'mismatch',receipt:{id:receipt.id,check:check.id,binding:receipt.binding,scope:receipt.scope,evidence:receipt.evidence,target:receipt.target,exitCode:receipt.exitCode},scope:'Original observed discrepancy; current verdict may be unresolved after subsequent changes'});
        }
      }
    }
    for (const reference of lens.conditions) {
      const { concept, condition } = conditionOf(records, reference);
      const checkResults = lensCheckResults.filter(item => item.check.conditions.includes(reference));
      const participants = [];
      for (const selector of selection.selectors) {
        if (selector.status !== 'populated') {
          const supported = selector.status === 'empty' && condition.allowsAbsence === true;
          participants.push({ selector: selector.id, selection: selector.status, status: supported ? 'supported' : 'unresolved', evidence: [], reason: supported ? 'Absence permitted within the discovered scope' : selector.reason ?? 'Required realization was not discovered; absence is not satisfaction' });
          continue;
        }
        for (const unit of selector.units) {
          const applicable = checkResults.filter(({ check }) => check.selectors.includes(selector.id) && check.evidence === condition.evidence && coveragePaths(lens, check, selector).includes(unit.path));
          const failed = applicable.find(({ receipt }) => receipt.status === 'mismatch');
          const passed = applicable.find(({ receipt }) => receipt.status === 'supported');
          participants.push({ selector: selector.id, unit, selection: 'populated', status: failed ? 'mismatch' : passed ? 'supported' : 'unresolved', evidence: applicable.map(item => item.receipt.id).filter(Boolean), reason: failed ? 'An applicable native check failed' : passed ? 'Applicable check supports this participant and condition in the captured scope' : 'No current check of the required evidence kind covers this participant' });
        }
      }
      // A writer may move after discovery or after an earlier check; never publish a mixed-state verdict.
      for (const selector of selection.selectors.filter(item => item.scope)) {
        const now = await captureScope(root, selector.patterns);
        if (now.fingerprint !== selector.scope.fingerprint) for (const participant of participants.filter(item => item.selector === selector.id)) { participant.status = 'unresolved'; participant.reason = 'Selected source changed during reconciliation'; }
      }
      if (authorityChanged) for (const participant of participants) { participant.status = 'unresolved'; participant.reason = 'Meaning or Lens changed during reconciliation'; }
      const status = participants.some(item => item.status === 'mismatch') ? 'mismatch' : participants.some(item => item.status === 'unresolved') ? 'unresolved' : 'supported';
      verdicts.push({ condition: reference, lens: lens.id, meaningHash: concept.hash, lensHash: lens.hash, participants, status, scope: 'Only this condition and selected participants; no whole-Concept or application certificate' });
    }
  }
  const result = { verdicts, receipts, observations, discovery, independentSource: independent, status: !verdicts.length || verdicts.some(item => item.status === 'unresolved') ? 'unresolved' : verdicts.some(item => item.status === 'mismatch') ? 'mismatch' : 'supported' };
  if (verdicts.some(item => item.status === 'mismatch')) result.status = 'mismatch';
  if (!verdicts.length) result.reason = 'No accepted Lens observes the selected meaning';
  if (request.work) {
    const checkpoint = await readCheckpoint(root, request.work);
    const existing = checkpoint.mismatches ?? [];
    const mismatches = [...observedMismatches, ...verdicts.filter(item => item.status === 'mismatch')];
    const retained = [...existing];
    for (const mismatch of mismatches) if (!retained.some(item => item.condition === mismatch.condition && item.lens === mismatch.lens)) retained.push(mismatch);
    const changes = retained.map(previous => {
      const current = verdicts.find(item => item.condition === previous.condition && item.lens === previous.lens);
      if (!current) return { condition: previous.condition, removedFromSelection: true };
      const units = verdict => verdict.participants.filter(item => item.unit).map(item => ({ selector: item.selector, path: item.unit.path, hash: item.unit.sourceHash }));
      return { condition: previous.condition, meaningChanged: previous.meaningHash !== current.meaningHash, lensOrCheckerChanged: previous.lensHash !== current.lensHash, realizationOrPopulationChanged: hash(units(previous)) !== hash(units(current)), currentStatus: current.status };
    });
    const history = checkpoint.repairHistory ?? [];
    const latest = history.at(-1);
    if (latest) { const verdict = verdicts.find(item => item.condition === latest.condition); if (verdict) latest.outcome = verdict.status; }
    await updateCheckpoint(root, request.work, { lastReconciliation: { status: result.status, verdicts, observations: observations.map(item => ({ provider: item.provider, status: item.status, gaps: item.gaps })), receipts: receipts.map(item => ({ id: item.id, status: item.status, observedStatus: item.observedStatus, stdout: item.stdout, stderr: item.stderr })), discovery: discovery.selections.map(item => ({ lens: item.lens, added: item.added, removed: item.removed })), discoveryQuestions: discovery.discoveryQuestions, changes }, mismatches: retained, repairHistory: history });
  }
  return result;
}
