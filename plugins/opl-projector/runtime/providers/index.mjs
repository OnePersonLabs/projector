import { activeRoot, inactive } from '../activation.mjs';
import { captureScope, captureInputs, projectPath, hash, readJson } from '../state.mjs';
import { fileURLToPath } from 'node:url';
import { inventory, gap } from './common.mjs';
import { direct } from './direct.mjs';
import { importIndex } from './import-index.mjs';
import { lsp } from './lsp.mjs';
const adapterVersion = (await readJson(fileURLToPath(new URL('../../package.json', import.meta.url)))).version;

export async function observe(root, request = {}) {
  const activatedProject = await activeRoot(root);
  if (!activatedProject) return inactive(root);
  root = activatedProject;
  const provider = request.provider ?? 'inventory';
  const operation = request.operation ?? 'symbols';
  const patterns = request.patterns ?? [];
  const files = request.files ?? [];
  if (!Array.isArray(patterns) || !Array.isArray(files)) throw new Error('Provider files and patterns must be arrays');
  for (const file of files) await projectPath(root,file);
  const before = await captureScope(root,patterns,files);
  const context = {root, files:before.inputs.map(input => input.path), inputs:new Map(before.inputs.map(input => [input.path,input])),facts:[],gaps:[],capabilities:[],engine:{name:provider,version:provider === 'inventory' ? adapterVersion : null}};
  // Source inventory remains useful when a semantic provider cannot answer.
  await inventory(context,request.literal ?? request.text);
  try {
    if (provider === 'inventory') {
      context.capabilities = ['symbols','relationships'];
      if (!context.capabilities.includes(operation)) gap(context,'unsupported-operation',`Inventory does not resolve ${operation}`);
    } else if (provider === 'lsp') await lsp(context,{...request,provider,operation});
    else if (provider === 'html' || provider === 'css') await direct(context,{...request,provider,operation});
    else if (provider === 'index') await importIndex(context,{...request,provider,operation});
    else gap(context,'unknown-provider',`Unknown provider: ${provider}`);
  } catch (error) { gap(context,'provider-failed',error.message); }
  const inputs = [...context.inputs.values()].sort((a,b) => a.path.localeCompare(b.path));
  let after = null;
  let current = false;
  try {
    after = await captureScope(root,patterns,files);
    const finalInputs = await captureInputs(root, inputs.map(input => input.path));
    const finalHashes = new Map(finalInputs.map(input => [input.path,input.hash]));
    current = before.fingerprint === after.fingerprint && inputs.every(input => input.hash === finalHashes.get(input.path));
  } catch (error) { gap(context,'currentness-unavailable',error.message); }
  if (!current) gap(context,'source-changed','Source contents or scope membership changed during observation');
  if (before.inputs.some(input => input.hash == null)) gap(context,'missing-source','Declared source scope contains missing inputs');
  if (!context.files.length) gap(context,'empty-scope','No source files were selected');
  const semanticFacts = context.facts.filter(fact => !['source-file','literal-occurrence'].includes(fact.kind));
  const answered = provider === 'inventory' ? context.capabilities.includes(operation) : context.capabilities.includes(operation) && !context.gaps.some(g => ['unsupported-operation','lsp-unconfigured','index-unconfigured','unknown-provider','provider-failed','lsp-failed'].includes(g.code));
  const status = context.gaps.length ? context.facts.length ? 'partial' : 'unavailable' : answered ? 'complete' : semanticFacts.length ? 'partial' : 'unavailable';
  const requestBinding = hash({provider,operation,files,patterns,position:request.position,config:request.config,includeDeclaration:request.includeDeclaration,literal:request.literal ?? request.text});
  return {provider:{id:provider,adapterVersion,engine:context.engine},requestBinding,operation,status,facts:context.facts,inputs,capabilities:context.capabilities,gaps:context.gaps,...(context.serverStderr ? {serverStderr:context.serverStderr} : {}),scope:{patterns,files,before,after,currentness:current && before.inputs.length && before.inputs.every(input => input.hash != null) ? 'current' : 'unresolved',semanticCompleteness:'unclaimed'}};
}
