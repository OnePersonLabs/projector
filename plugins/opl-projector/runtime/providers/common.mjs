import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { projectPath, captureInputs } from '../state.mjs';

export async function uri(root, relative) { return pathToFileURL(await projectPath(root, relative)).href; }
export async function sourcePath(root, target) {
  const absolute = target.startsWith('file:') ? fileURLToPath(target) : await projectPath(root, target);
  const relative = path.relative(path.resolve(root), absolute).replaceAll('\\', '/');
  await projectPath(root, relative);
  return relative;
}
export function validRange(range) {
  const point = p => p && Number.isInteger(p.line) && p.line >= 0 && Number.isInteger(p.character) && p.character >= 0;
  return range && point(range.start) && point(range.end) && (range.end.line > range.start.line || (range.end.line === range.start.line && range.end.character >= range.start.character));
}
export const languageId = file => ({ '.rs':'rust', '.py':'python', '.cs':'csharp', '.js':'javascript', '.mjs':'javascript', '.cjs':'javascript', '.jsx':'javascriptreact', '.ts':'typescript', '.tsx':'typescriptreact', '.html':'html', '.htm':'html', '.css':'css', '.scss':'scss', '.less':'less' }[path.extname(file).toLowerCase()] ?? 'plaintext');
export async function readSource(root, file) { return readFile(await projectPath(root, file), 'utf8'); }
export async function addFact(context, fact) {
  const file = await sourcePath(context.root, fact.path);
  if (!validRange(fact.range)) throw new Error(`Invalid source range for ${file}`);
  if (!context.inputs.has(file)) {
    for (const input of await captureInputs(context.root, [file])) context.inputs.set(input.path, input);
  }
  if (context.inputs.get(file)?.hash == null) throw new Error(`Source target is missing: ${file}`);
  context.facts.push({ ...fact, path: file });
}
export function gap(context, code, message, file) { context.gaps.push({ code, message, ...(file ? { path: file } : {}) }); }
export async function inventory(context, literal) {
  for (const file of context.files) {
    try {
      const text = await readSource(context.root, file);
      await addFact(context, { kind:'source-file', path:file, range:{ start:{line:0,character:0}, end:{line:0,character:0} }, languageId:languageId(file) });
      if (typeof literal === 'string' && literal.length) {
        const lines = text.split(/\r?\n/);
        for (let line = 0; line < lines.length; line++) {
          let offset = 0;
          while ((offset = lines[line].indexOf(literal, offset)) !== -1) {
            await addFact(context, { kind:'literal-occurrence', path:file, range:{start:{line,character:offset},end:{line,character:offset + literal.length}}, literal, semantics:'literal-only' });
            offset += literal.length;
          }
        }
      }
    } catch (error) { gap(context, 'source-unavailable', error.message, file); }
  }
}
export async function symbols(context, values, fallbackPath) {
  for (const symbol of values ?? []) {
    try { await addFact(context, { kind:'symbol', path:symbol.location?.uri ?? fallbackPath, range:symbol.location?.range ?? symbol.selectionRange ?? symbol.range, name:symbol.name, symbolKind:symbol.kind }); }
    catch (error) { gap(context,'fact-rejected',error.message); }
    if (symbol.children) await symbols(context, symbol.children, fallbackPath);
  }
}
export async function locations(context, values, kind) {
  for (const location of Array.isArray(values) ? values : values ? [values] : []) {
    try { await addFact(context, {kind, path:location.uri ?? location.targetUri, range:location.range ?? location.targetSelectionRange ?? location.targetRange}); }
    catch (error) { gap(context,'fact-rejected',error.message); }
  }
}
