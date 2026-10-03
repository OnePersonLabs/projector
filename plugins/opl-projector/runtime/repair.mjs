import { activeRoot, inactive } from './activation.mjs';
import fs from 'node:fs/promises';
import { hash, projectPath, physicalProjectPath, captureInputs, readJson, writeJson, writeText } from './state.mjs';
import { readCheckpoint, updateCheckpoint, workId } from './work.mjs';

async function stateOf(root, output) {
  const [{ hash: current }] = await captureInputs(root, [output.path]);
  return { path: output.path, current, state: current === output.afterHash ? 'after' : current === output.beforeHash ? 'before' : 'other' };
}
function summary(record, states) {
  return { id: record.id, work: record.work, status: record.status, condition: record.condition, states, instruction: states.every(item => item.state === 'after') ? 'Outputs match the applied attempt; revalidate behavior, do not replay' : 'Inspect changed bytes and native task state before continuing' };
}

const ownershipKey = file => process.platform === 'win32' ? file.toLowerCase() : file;
async function hasOwner(root, checkpoint, owner, file) {
  const actual = ownershipKey(await physicalProjectPath(root, file));
  for (const assignment of checkpoint.ownership ?? []) {
    if (assignment.owner !== owner) continue;
    for (const owned of assignment.paths) if (ownershipKey(await physicalProjectPath(root, owned)) === actual) return true;
  }
  return false;
}

export async function repair(root, request) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const id = workId(request.id);
  const recordPath = await projectPath(root, `.projector/work/repairs/${id}/record.json`);
  const mode = request.mode ?? 'apply';
  let existing;
  try { existing = await readJson(recordPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (mode === 'inspect' || mode === 'rollback') {
    if (!existing) throw new Error(`No repair attempt: ${id}`);
    if (mode === 'inspect') return summary(existing, await Promise.all(existing.outputs.map(output => stateOf(root, output))));
    const checkpoint = await readCheckpoint(root, existing.work);
    // Refuse a known conflict before restoring any file. Journal rollback
    // separately because it can also stop after changing only some outputs.
    for (const output of existing.outputs) {
      const state = await stateOf(root, output);
      if (state.state === 'before') continue;
      if (state.state !== 'after') throw new Error(`Rollback refused: ${output.path} contains unrelated edits; inspect ${id}`);
      if (!await hasOwner(root, checkpoint, existing.owner, output.path)) throw new Error(`Rollback ownership changed: ${output.path}`);
    }
    existing.status = 'rollback-prepared';
    await writeJson(recordPath, existing);
    await updateCheckpoint(root, existing.work, { uncertainMutations: [...new Set([...(checkpoint.uncertainMutations ?? []), id])] });
    try {
      for (const output of existing.outputs) {
        const state = await stateOf(root, output);
        if (state.state === 'before') continue;
        if (state.state !== 'after') throw new Error(`Rollback refused: ${output.path} contains unrelated edits; inspect ${id}`);
        const target = await projectPath(root, output.path);
        if (output.beforeHash === null) await fs.unlink(target);
        else await writeText(target, Buffer.from(output.before, 'base64'));
      }
    } catch (error) {
      existing.status = 'rollback-interrupted';
      existing.error = error.message;
      await writeJson(recordPath, existing);
      throw new Error(`Rollback ${id} interrupted; inspect actual state before recovery: ${error.message}`, { cause: error });
    }
    existing.status = 'rolled-back';
    await writeJson(recordPath, existing);
    await updateCheckpoint(root, existing.work, { uncertainMutations: (checkpoint.uncertainMutations ?? []).filter(item => item !== id) });
    return summary(existing, await Promise.all(existing.outputs.map(output => stateOf(root, output))));
  }
  if (mode !== 'apply') throw new Error(`Unknown repair mode: ${mode}`);
  if (existing) return summary(existing, await Promise.all(existing.outputs.map(output => stateOf(root, output))));
  const checkpoint = await readCheckpoint(root, request.work);
  if (!request.owner || !request.outputs?.length) throw new Error('Repair requires an owner and explicit output changes');
  if (checkpoint.uncertainMutations?.length) throw new Error('Inspect unresolved mutations before preparing another automatic repair');
  const seen = new Set();
  const outputs = [];
  for (const output of request.outputs) {
    const actual = ownershipKey(await physicalProjectPath(root, output.path));
    if (seen.has(actual)) throw new Error(`Duplicate repair output: ${output.path}`);
    seen.add(actual);
    const target = await projectPath(root, output.path);
    if (!await hasOwner(root, checkpoint, request.owner, output.path)) throw new Error(`Output is not owned by ${request.owner}: ${output.path}`);
    if (!Object.hasOwn(output, 'expectedHash') || [Object.hasOwn(output, 'content'), !!output.fromFile, !!output.delete].filter(Boolean).length !== 1) throw new Error(`Output needs expectedHash and exactly one content/fromFile/delete: ${output.path}`);
    let before = null;
    try { before = await fs.readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const beforeHash = before === null ? null : hash(before);
    if (beforeHash !== output.expectedHash) throw new Error(`Stale expected content: ${output.path}`);
    const after = output.delete ? null : output.fromFile ? await fs.readFile(await projectPath(root, output.fromFile)) : Buffer.from(output.content);
    outputs.push({ path: output.path, physicalPath: actual, beforeHash, afterHash: after === null ? null : hash(after), before: before?.toString('base64') ?? null, after: after?.toString('base64') ?? null });
  }
  const stateSignature = field => hash(outputs.map(item => ({ path: item.physicalPath, hash: item[field] })).sort((a, b) => a.path.localeCompare(b.path)));
  const beforeState = stateSignature('beforeHash');
  const afterState = stateSignature('afterHash');
  const history = checkpoint.repairHistory ?? [];
  const same = history.filter(item => item.condition === request.condition && item.explanation === request.explanation);
  if (same.slice(-2).length === 2 && same.slice(-2).every(item => item.outcome === 'mismatch')) return { id, status: 'stopped', reason: 'Two matching failed repair attempts; change explanation or resolve meaning', outputs: outputs.map(item => item.path) };
  if (history.some(item => item.condition === request.condition && (item.beforeState === afterState || item.afterState === afterState)) && beforeState !== afterState) return { id, status: 'stopped', reason: 'Proposed output revisits an earlier state; inspect competing explanations' };
  const record = { id, work: request.work, owner: request.owner, condition: request.condition, explanation: request.explanation, beforeState, afterState, status: 'prepared', outputs };
  await writeJson(recordPath, record);
  await updateCheckpoint(root, request.work, { uncertainMutations: [...checkpoint.uncertainMutations ?? [], id] });
  try {
    for (const output of outputs) {
      const state = await stateOf(root, output);
      if (state.current !== output.beforeHash) throw new Error(`Output changed before write: ${output.path}`);
      const target = await projectPath(root, output.path);
      if (output.afterHash === null) { if (output.beforeHash !== null) await fs.unlink(target); }
      else await writeText(target, Buffer.from(output.after, 'base64'));
    }
  } catch (error) {
    record.status = 'interrupted';
    record.error = error.message;
    await writeJson(recordPath, record);
    throw new Error(`Repair ${id} interrupted; inspect actual state before recovery: ${error.message}`, { cause: error });
  }
  record.status = 'applied';
  await writeJson(recordPath, record);
  await updateCheckpoint(root, request.work, { uncertainMutations: [], repairHistory: [...history, { id, condition: request.condition, explanation: request.explanation, beforeState, afterState, outcome: 'unresolved' }] });
  return summary(record, await Promise.all(outputs.map(output => stateOf(root, output))));
}
