import path from 'node:path';
import { hash, safePath, workingBytes } from '../index/index.ts';
import { parseArtifactAddress, resolveReference } from '../documents/index.ts';
import type { FileRecord } from '../documents/index.ts';
import type { Support } from './types.ts';

export interface GeneratedDeclaration { output: string; producer: string; inputs: string[]; retention: 'tracked' | 'disposable'; owner: string; ownerHash: string; ownerPath: string }
export interface GeneratedReceipt {
  output: string; outputHash: string; owner: string; ownerHash: string; producer: string;
  inputs: Record<string, string>; command: string; args: string[]; runtime: string; identity: string;
}
export interface GenerationSnapshot { declarations: GeneratedDeclaration[]; inputs: Record<string, Record<string, string>> }
const referencePath = (value: string): string => {
  const parsed = parseArtifactAddress(value);
  if (parsed) return safePath(parsed.path);
  if (value.startsWith('artifact:') || value.startsWith('code:') || value.includes('://') || value.includes('#')) throw new Error(`Invalid generated reference: ${value}`);
  return safePath(value);
};
function present(value: string, records: ReadonlyMap<string, FileRecord>): boolean {
  const parsed = parseArtifactAddress(value);
  if (!parsed) return records.has(referencePath(value));
  return resolveReference(value, [...records.values()], { edge: 'observation', fileMap: records }).status === 'resolved';
}
export function collectGenerated(records: ReadonlyMap<string, FileRecord>): { declarations: GeneratedDeclaration[]; obligations: string[] } {
  const declarations: GeneratedDeclaration[] = []; const obligations: string[] = [];
  for (const file of records.values()) {
    for (const diagnostic of file.diagnostics) if (diagnostic.code === 'generated-declaration-invalid') obligations.push(`${diagnostic.address ?? file.path}: ${diagnostic.message}`);
    for (const unit of file.units) {
      const values = unit.data?.generated;
      if (values === undefined) continue;
      if (!Array.isArray(values) || !unit.address.startsWith('design:') || !unit.address.includes('#decision:')) { obligations.push(`Invalid generated owner ${unit.address}`); continue; }
      for (const value of values) {
        try {
          if (!value || typeof value !== 'object' || typeof value.output !== 'string' || typeof value.producer !== 'string' || !Array.isArray(value.inputs) || !value.inputs.every((input: unknown) => typeof input === 'string') || !['tracked', 'disposable'].includes(value.retention)) throw new Error('Expected output, producer, inputs and retention');
          if (parseArtifactAddress(value.output)?.key) throw new Error('Generated output must identify a whole file');
          const output = referencePath(value.output); referencePath(value.producer);
          const inputs = [...new Set(value.inputs as string[])].sort(); for (const input of inputs) referencePath(input);
          if ([value.producer, ...inputs].some(input => referencePath(input) === output)) throw new Error('Generated output cannot be its own producer or input');
          declarations.push({ output, producer: value.producer, inputs, retention: value.retention, owner: unit.address, ownerHash: unit.bodyHash, ownerPath: unit.path });
        } catch (error) { obligations.push(`${unit.address}: ${error instanceof Error ? error.message : String(error)}`); }
      }
    }
  }
  for (const output of new Set(declarations.map(item => item.output))) if (declarations.filter(item => item.output === output).length !== 1) obligations.push(`Generated output ${output} has ambiguous provenance`);
  return { declarations, obligations };
}
function owned(declaration: GeneratedDeclaration, support: readonly Support[]): boolean {
  return support.some(binding => binding.path === declaration.output && binding.decision === declaration.owner);
}
function currentInputs(declaration: GeneratedDeclaration, records: ReadonlyMap<string, FileRecord>): Record<string, string> {
  return Object.fromEntries([declaration.producer, ...declaration.inputs].map(reference => [reference, records.get(referencePath(reference))?.hash ?? 'missing']));
}
export function validateGenerated(options: {
  records: ReadonlyMap<string, FileRecord>; previousRecords?: ReadonlyMap<string, FileRecord>;
  changedPaths: readonly string[]; support: readonly Support[]; previousSupport?: readonly Support[];
  receipts: readonly GeneratedReceipt[]; knownGeneratedOutputs?: readonly string[]; authoredPaths?: ReadonlySet<string>;
}): string[] {
  const collected = collectGenerated(options.records); const previous = options.previousRecords ? collectGenerated(options.previousRecords).declarations : [];
  const changed = new Set(options.changedPaths); const authored = options.authoredPaths ?? new Set(options.records.keys());
  const relevant = (item: GeneratedDeclaration) => changed.has(item.output) || changed.has(item.ownerPath) || [item.producer, ...item.inputs].some(reference => changed.has(referencePath(reference))) ||
    previous.some(old => old.output === item.output && (old.ownerHash !== item.ownerHash || old.owner !== item.owner || JSON.stringify(old.inputs) !== JSON.stringify(item.inputs) || old.producer !== item.producer));
  const obligations = collected.obligations.filter(problem => collected.declarations.some(item => relevant(item) && (problem.includes(item.owner) || problem.includes(item.output))) ||
    [...options.records.values()].some(record => changed.has(record.path) && (problem.includes(record.path) || record.units.some(unit => problem.includes(unit.address)))));
  for (const output of options.knownGeneratedOutputs ?? []) if (changed.has(output) && !collected.declarations.some(item => item.output === output)) obligations.push(`Generated output ${output} has no declared provenance`);
  for (const old of previous) if (old.retention === 'tracked' && options.records.has(old.output) && !collected.declarations.some(item => item.output === old.output) && !options.support.some(binding => binding.path === old.output && binding.decision !== old.owner)) obligations.push(`Retired generated output ${old.output} remains without a surviving binding`);
  for (const declaration of collected.declarations) {
    if (declaration.retention === 'disposable' && !authored.has(declaration.output)) continue;
    if (!relevant(declaration)) continue;
    if (!owned(declaration, options.support)) obligations.push(`Generated output ${declaration.output} needs current Realizes support from ${declaration.owner}`);
    if (!options.records.has(declaration.output)) obligations.push(`Declared generated output ${declaration.output} is absent`);
    if (![declaration.producer, ...declaration.inputs].every(reference => present(reference, options.records))) { obligations.push(`Generated output ${declaration.output} has missing or unresolved producer/input references`); continue; }
    const inputs = currentInputs(declaration, options.records);
    if (!options.receipts.some(receipt => receipt.output === declaration.output && receipt.owner === declaration.owner && receipt.ownerHash === declaration.ownerHash && receipt.producer === declaration.producer && receipt.outputHash === options.records.get(declaration.output)?.hash && JSON.stringify(receipt.inputs) === JSON.stringify(inputs) && receipt.identity === hash(JSON.stringify({ command: receipt.command, args: receipt.args, runtime: receipt.runtime, producer: receipt.producer, inputs: receipt.inputs })))) obligations.push(`Generated output ${declaration.output} needs an eligible regeneration receipt`);
  }
  return [...new Set(obligations)];
}
async function inputHashes(root: string, declaration: GeneratedDeclaration): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const reference of [declaration.producer, ...declaration.inputs]) result[reference] = (await workingBytes(path.join(root, referencePath(reference)))).hash;
  return result;
}
export async function captureGenerationInputs(root: string, records: ReadonlyMap<string, FileRecord>, outputs: readonly string[]): Promise<GenerationSnapshot> {
  const collected = collectGenerated(records);
  const declarations = outputs.map(output => {
    const matches = collected.declarations.filter(item => item.output === referencePath(output));
    if (matches.length !== 1) throw new Error(`Generated output ${output} needs unambiguous provenance`);
    const declaration = matches[0]!;
    const problems = collected.obligations.filter(problem => problem.includes(declaration.owner) || problem.includes(declaration.output));
    if (problems.length) throw new Error(problems.join('\n'));
    if (![declaration.producer, ...declaration.inputs].every(reference => present(reference, records))) throw new Error(`Generated output ${output} has missing or unresolved inputs`);
    return declaration;
  });
  const inputs: GenerationSnapshot['inputs'] = {};
  for (const declaration of declarations) inputs[declaration.output] = await inputHashes(root, declaration);
  return { declarations, inputs };
}
/** Call after the existing evidence runner executes the real command. */
export async function finishGenerationReceipts(root: string, before: GenerationSnapshot,
  execution: { command: string; args: string[]; runtime: string; exitCode: number | null },
  records: ReadonlyMap<string, FileRecord>, support: readonly Support[]): Promise<GeneratedReceipt[]> {
  if (execution.exitCode !== 0) return [];
  const current = collectGenerated(records);
  const receipts: GeneratedReceipt[] = [];
  for (const old of before.declarations) {
    const declaration = current.declarations.find(item => item.output === old.output && item.ownerHash === old.ownerHash && item.owner === old.owner && item.producer === old.producer && JSON.stringify(item.inputs) === JSON.stringify(old.inputs));
    if (!declaration || current.obligations.some(problem => problem.includes(declaration.owner) || problem.includes(declaration.output)) || !records.has(declaration.output) || !owned(declaration, support) || ![declaration.producer, ...declaration.inputs].every(reference => present(reference, records))) continue;
    const inputs = await inputHashes(root, declaration);
    if (JSON.stringify(inputs) !== JSON.stringify(before.inputs[declaration.output])) continue;
    const outputHash = (await workingBytes(path.join(root, declaration.output))).hash;
    const identity = hash(JSON.stringify({ command: execution.command, args: execution.args, runtime: execution.runtime, producer: declaration.producer, inputs }));
    receipts.push({ output: declaration.output, outputHash, owner: declaration.owner, ownerHash: declaration.ownerHash, producer: declaration.producer, inputs, command: execution.command, args: [...execution.args], runtime: execution.runtime, identity });
  }
  return receipts;
}
