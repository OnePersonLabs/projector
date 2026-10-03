import { readJson, captureInputs, projectPath } from '../state.mjs';
import { addFact, sourcePath, validRange, gap } from './common.mjs';

export async function importIndex(context, request) {
  context.capabilities = ['symbols','definitions','references','diagnostics','relationships'];
  const file = request.config?.path;
  if (!file) { gap(context, 'index-unconfigured', 'Index provider requires config.path'); return; }
  for (const input of await captureInputs(context.root, [file])) context.inputs.set(input.path, input);
  const index = await readJson(await projectPath(context.root, file));
  if (index?.version !== 1 || !Array.isArray(index.inputs) || !Array.isArray(index.facts)) throw new Error('Index requires version:1, inputs, and facts');
  if (!index.inputs.length) throw new Error('Index source binding must not be empty');
  context.engine = index.provider ?? {name:'unspecified-index-producer',version:null};
  if (!context.engine.version) gap(context, 'engine-version-unavailable', 'The index does not identify its producer version');
  const declared = new Map();
  for (const input of index.inputs) {
    const relative = await sourcePath(context.root, input.path);
    if (typeof input.hash !== 'string') throw new Error(`Index source hash is missing: ${relative}`);
    declared.set(relative, input.hash);
  }
  const bound = await captureInputs(context.root, [...declared.keys()]);
  const current = new Map(bound.map(input => [input.path, input.hash]));
  for (const input of bound) context.inputs.set(input.path, input);
  // Declared inputs bind the generation, including dependencies whose paths
  // do not appear on an individual fact.
  const stale = bound.filter(input => input.hash !== declared.get(input.path));
  if (stale.length) {
    for (const input of stale) gap(context, 'index-source-stale', `Index is not bound to current source: ${input.path}`);
    return;
  }
  const kinds = {symbols:'symbol',definitions:'definition',references:'reference',diagnostics:'diagnostic',relationships:'relationship'};
  if (!kinds[request.operation]) { gap(context, 'unsupported-operation', `Index cannot provide ${request.operation}`); return; }
  for (let fact of index.facts) {
    if (fact.kind !== kinds[request.operation]) continue;
    try {
      const relative = await sourcePath(context.root, fact.path);
      if (!context.files.includes(relative)) continue;
      if (!declared.has(relative) || current.get(relative) !== declared.get(relative)) throw new Error(`Index is not bound to current source: ${relative}`);
      if (fact.target?.path) {
        const target = await sourcePath(context.root, fact.target.path);
        if (!validRange(fact.target.range)) throw new Error(`Index target range is invalid: ${target}`);
        if (!declared.has(target) || current.get(target) !== declared.get(target)) throw new Error(`Index target is not bound to current source: ${target}`);
        fact = {...fact,target:{...fact.target,path:target}};
      }
      await addFact(context, {...fact, provenance:{provider:'index',index:file,sourceHash:declared.get(relative)}});
    } catch (error) { gap(context, 'index-fact-rejected', error.message); }
  }
}
