import fs from 'node:fs/promises';
import { parse } from 'yaml';
import { discover, hash, projectPath } from './state.mjs';

export async function loadMeaning(root) {
  const records = [];
  const ids = new Set();
  for (const file of await discover(root, ['.projector/meaning/**/*.md', '!.projector/meaning/archive/**'])) {
    const source = await fs.readFile(await projectPath(root, file), 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!match) throw new Error(`Missing YAML frontmatter: ${file}`);
    const metadata = parse(match[1], { uniqueKeys: true });
    if (!metadata || typeof metadata.id !== 'string' || !['concept', 'lens', 'pattern'].includes(metadata.kind) || !['accepted', 'candidate', 'retired'].includes(metadata.status) || typeof metadata.title !== 'string') throw new Error(`Invalid meaning metadata: ${file}`);
    if (ids.has(metadata.id)) throw new Error(`Duplicate meaning identity: ${metadata.id}`);
    ids.add(metadata.id);
    if (metadata.kind === 'concept') {
      const conditions = new Set();
      for (const condition of metadata.conditions ?? []) {
        if (!condition.id || !condition.text || !['static', 'runtime'].includes(condition.evidence) || conditions.has(condition.id)) throw new Error(`Invalid or duplicate condition in ${file}`);
        conditions.add(condition.id);
      }
    }
    records.push({ ...metadata, file, body: source.slice(match[0].length), hash: hash(source) });
  }
  return records;
}

export function conditionOf(records, reference) {
  const split = reference.lastIndexOf('#');
  if (split < 1) throw new Error(`Expected concept#condition: ${reference}`);
  const concept = records.find(record => record.id === reference.slice(0, split) && record.kind === 'concept');
  const condition = concept?.conditions?.find(item => item.id === reference.slice(split + 1));
  if (!condition || concept.status !== 'accepted') throw new Error(`No active accepted condition: ${reference}`);
  return { concept, condition };
}

export function selectLenses(records, request) {
  const lenses = records.filter(record => record.kind === 'lens' && record.status === 'accepted' && (!request.lenses?.length || request.lenses.includes(record.id)) && (!request.concepts?.length || record.conditions?.some(ref => request.concepts.includes(ref.split('#')[0]))));
  for (const id of request.lenses ?? []) if (!lenses.some(lens => lens.id === id)) throw new Error(`No active Lens selected: ${id}`);
  for (const lens of lenses) {
    if (!lens.conditions?.length || !lens.selectors?.length) throw new Error(`Lens needs conditions and population selectors: ${lens.id}`);
    for (const ref of lens.conditions) conditionOf(records, ref);
    if (new Set(lens.selectors.map(selector => selector.id)).size !== lens.selectors.length) throw new Error(`Duplicate selector identity in ${lens.id}`);
    for (const selector of lens.selectors) if (!selector.id || !selector.patterns?.length) throw new Error(`Invalid selector in ${lens.id}`);
    for (const check of lens.checks ?? []) {
      if (!check.id || !check.command || !Array.isArray(check.args) || !check.conditions?.length || !check.selectors?.length || !['static', 'runtime'].includes(check.evidence)) throw new Error(`Incomplete check ${check.id} in ${lens.id}`);
      for (const ref of check.conditions) if (!lens.conditions.includes(ref)) throw new Error(`Check references another condition: ${ref}`);
      for (const selector of check.selectors) if (!lens.selectors.some(item => item.id === selector)) throw new Error(`Unknown check population: ${selector}`);
    }
  }
  return lenses;
}
