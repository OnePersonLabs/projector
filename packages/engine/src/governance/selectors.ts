import {
  canonicalJson,
  hashFramedDomain,
  type ContentHash,
  type ObservabilityClass,
  type ProjectionUnit,
  type SelectorExpr,
} from "@projector/core";

type SelectorField = Extract<SelectorExpr, { op: "atom" }>["field"];

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compareStrings);

export class SelectorEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelectorEvaluationError";
  }
}

export interface SelectorSubject {
  id: string;
  values: Partial<Record<SelectorField, unknown>>;
  dependencyKeys: readonly string[];
}

export interface ProjectionUnitSelectorFacts {
  path?: string;
  language?: string;
  surface?: string;
  package?: string;
  packageKind?: string;
  operation?: string;
  platform?: string | readonly string[];
  migrationPhase?: string;
  risk?: string;
  astPattern?: string | readonly string[];
  relation?: string | readonly string[];
  conceptKinds?: string | readonly string[];
}

export function projectionUnitSelectorSubject(unit: ProjectionUnit, facts: ProjectionUnitSelectorFacts = {}): SelectorSubject {
  return {
    id: unit.id,
    values: {
      path: facts.path ?? unit.anchor.value,
      "artifact-role": unit.role,
      concept: unit.conceptIds,
      "concept-kind": facts.conceptKinds ?? [],
      requirement: unit.requirementIds,
      scenario: unit.scenarioIds,
      lens: unit.lenses.map(({ lensId }) => lensId),
      tag: unit.tags,
      "control-ownership": unit.control.ownership,
      "control-mutation": unit.control.mutation,
      "causal-origin": unit.causalOrigin.kind,
      ...(facts.language === undefined ? {} : { language: facts.language }),
      ...(facts.surface === undefined ? {} : { surface: facts.surface }),
      ...(facts.package === undefined ? {} : { package: facts.package }),
      ...(facts.packageKind === undefined ? {} : { "package-kind": facts.packageKind }),
      ...(facts.operation === undefined ? {} : { operation: facts.operation }),
      ...(facts.platform === undefined ? {} : { platform: facts.platform }),
      ...(facts.migrationPhase === undefined ? {} : { "migration-phase": facts.migrationPhase }),
      ...(facts.risk === undefined ? {} : { risk: facts.risk }),
      ...(facts.astPattern === undefined ? {} : { "ast-pattern": facts.astPattern }),
      ...(facts.relation === undefined ? {} : { relation: facts.relation }),
    },
    dependencyKeys: sortedUnique([
      `projection-unit:${unit.id}`,
      `membership:${unit.id}:${unit.membershipHash}`,
      ...unit.conceptIds.map((id) => `concept:${id}`),
      ...unit.requirementIds.map((id) => `requirement:${id}`),
      ...unit.scenarioIds.map((id) => `scenario:${id}`),
      ...unit.lenses.map(({ lensId, semanticHash }) => `lens:${lensId}:${semanticHash}`),
    ]),
  };
}

function normalizeAtom(atom: Extract<SelectorExpr, { op: "atom" }>): SelectorExpr {
  let value = structuredClone(atom.value);
  if (atom.matcher === "in") {
    if (!Array.isArray(value)) throw new SelectorEvaluationError(`selector ${atom.field} in matcher requires an array`);
    value = [...new Map(value.map((item) => [canonicalJson(item), item])).entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([, item]) => item);
  }
  if (["glob", "regex", "contains"].includes(atom.matcher) && typeof value !== "string") {
    throw new SelectorEvaluationError(`selector ${atom.field} ${atom.matcher} matcher requires a string`);
  }
  return { ...atom, value };
}

export function normalizeSelector(selector: SelectorExpr): SelectorExpr {
  if (selector.op === "atom") return normalizeAtom(selector);
  if (selector.op === "not") {
    const item = normalizeSelector(selector.item);
    return item.op === "not" ? item.item : { op: "not", item };
  }
  const items = selector.items.flatMap((item) => {
    const normalized = normalizeSelector(item);
    return normalized.op === selector.op ? normalized.items : [normalized];
  });
  const unique = new Map(items.map((item) => [canonicalJson(item), item]));
  return {
    op: selector.op,
    items: [...unique.entries()].sort(([left], [right]) => compareStrings(left, right)).map(([, item]) => item),
  };
}

export function selectorHash(selector: SelectorExpr): ContentHash {
  return hashFramedDomain("selector", normalizeSelector(selector));
}

function scalarValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globRegex(glob: string): RegExp {
  if (glob.length > 512 || glob.includes("\u0000")) throw new SelectorEvaluationError("invalid or oversized glob selector");
  let result = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index]!;
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          result += "(?:[^/]+/)*";
        } else {
          result += ".*";
        }
      } else result += "[^/]*";
    } else if (character === "?") result += "[^/]";
    else result += escapeRegex(character);
  }
  return new RegExp(`${result}$`, "u");
}

interface DeterministicRegexToken {
  matches(character: string): boolean;
  repetition: "one" | "optional" | "star";
}

function parseCharacterClass(source: string): (character: string) => boolean {
  const negated = source.startsWith("^");
  const body = negated ? source.slice(1) : source;
  const singles = new Set<string>();
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < body.length; index += 1) {
    let start = body[index]!;
    if (start === "\\") {
      index += 1;
      if (index >= body.length) throw new SelectorEvaluationError("unterminated character-class escape");
      start = body[index]!;
    }
    if (body[index + 1] === "-" && body[index + 2] !== undefined) {
      let end = body[index + 2]!;
      index += 2;
      if (end === "\\") {
        index += 1;
        if (index >= body.length) throw new SelectorEvaluationError("unterminated character-class range escape");
        end = body[index]!;
      }
      const startPoint = start.codePointAt(0)!;
      const endPoint = end.codePointAt(0)!;
      if (startPoint > endPoint) throw new SelectorEvaluationError("descending character-class ranges are unsupported");
      ranges.push([startPoint, endPoint]);
    } else singles.add(start);
  }
  return (character) => {
    const point = character.codePointAt(0)!;
    const contained = singles.has(character) || ranges.some(([start, end]) => point >= start && point <= end);
    return negated ? !contained : contained;
  };
}

function deterministicRegexTokens(pattern: string): DeterministicRegexToken[] {
  if (pattern.length === 0 || pattern.length > 256) throw new SelectorEvaluationError("regex selector must contain 1..256 characters");
  if (!pattern.startsWith("^") || !pattern.endsWith("$")) {
    throw new SelectorEvaluationError("regex selector must be explicitly anchored");
  }
  const body = pattern.slice(1, -1);
  const tokens: DeterministicRegexToken[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]!;
    let matches: (input: string) => boolean;
    if (character === "\\") {
      index += 1;
      const escaped = body[index];
      if (escaped === undefined || /[1-9dDsSwWbB]/u.test(escaped)) {
        throw new SelectorEvaluationError("regex selector uses an unsupported escape or backreference");
      }
      matches = (input) => input === escaped;
    } else if (character === "[") {
      let end = index + 1;
      let escaped = false;
      while (end < body.length && (body[end] !== "]" || escaped)) {
        escaped = body[end] === "\\" && !escaped;
        if (body[end] !== "\\") escaped = false;
        end += 1;
      }
      if (end >= body.length) throw new SelectorEvaluationError("unterminated regex character class");
      matches = parseCharacterClass(body.slice(index + 1, end));
      index = end;
    } else if (character === ".") matches = () => true;
    else if ("()|{}^$*+?".includes(character)) {
      throw new SelectorEvaluationError(`regex selector uses unsupported operator ${character}`);
    } else matches = (input) => input === character;

    const quantifier = body[index + 1];
    if (quantifier === "*" || quantifier === "+" || quantifier === "?") index += 1;
    if (quantifier === "+") {
      tokens.push({ matches, repetition: "one" }, { matches, repetition: "star" });
    } else {
      tokens.push({ matches, repetition: quantifier === "*" ? "star" : quantifier === "?" ? "optional" : "one" });
    }
  }
  return tokens;
}

function epsilonClosure(states: ReadonlySet<number>, tokens: readonly DeterministicRegexToken[]): Set<number> {
  const closure = new Set(states);
  const pending = [...states];
  while (pending.length > 0) {
    const state = pending.pop()!;
    const token = tokens[state];
    if (token !== undefined && token.repetition !== "one" && !closure.has(state + 1)) {
      closure.add(state + 1);
      pending.push(state + 1);
    }
  }
  return closure;
}

function deterministicRegexMatches(pattern: string, value: string): boolean {
  const tokens = deterministicRegexTokens(pattern);
  let states = epsilonClosure(new Set([0]), tokens);
  for (const character of [...value]) {
    const next = new Set<number>();
    for (const state of states) {
      const token = tokens[state];
      if (token === undefined || !token.matches(character)) continue;
      if (token.repetition === "star") next.add(state);
      else next.add(state + 1);
    }
    states = epsilonClosure(next, tokens);
    if (states.size === 0) return false;
  }
  return epsilonClosure(states, tokens).has(tokens.length);
}

function atomMatches(atom: Extract<SelectorExpr, { op: "atom" }>, actual: unknown): boolean {
  const values = scalarValues(actual);
  switch (atom.matcher) {
    case "exists": {
      const exists = values.length > 0;
      return typeof atom.value === "boolean" ? exists === atom.value : exists;
    }
    case "equals":
      return values.some((value) => canonicalJson(value) === canonicalJson(atom.value));
    case "in": {
      const expected = atom.value as unknown[];
      const expectedKeys = new Set(expected.map(canonicalJson));
      return values.some((value) => expectedKeys.has(canonicalJson(value)));
    }
    case "contains":
      return values.some((value) => typeof value === "string" && value.includes(atom.value as string));
    case "glob": {
      const matcher = globRegex(atom.value as string);
      return values.some((value) => typeof value === "string" && value.length <= 4096 && matcher.test(value.replaceAll("\\", "/")));
    }
    case "regex": {
      const pattern = atom.value as string;
      // Parsing occurs even for an absent field so an unsupported selector always fails closed.
      deterministicRegexTokens(pattern);
      return values.some((value) => typeof value === "string" && value.length <= 4096 && deterministicRegexMatches(pattern, value));
    }
    case "matches-structural-query":
      return values.some((value) => canonicalJson(value) === canonicalJson(atom.value));
  }
}

export interface SelectorEvaluation {
  matched: boolean;
  matchedAtoms: string[];
  failedAtoms: string[];
  dependencyKeys: string[];
  inputFingerprint: ContentHash;
}

export function evaluateSelector(selector: SelectorExpr, subject: SelectorSubject): SelectorEvaluation {
  const normalized = normalizeSelector(selector);
  const matchedAtoms: string[] = [];
  const failedAtoms: string[] = [];
  const evaluate = (expression: SelectorExpr): boolean => {
    if (expression.op === "all") return expression.items.every(evaluate);
    if (expression.op === "any") return expression.items.some(evaluate);
    if (expression.op === "not") return !evaluate(expression.item);
    const key = canonicalJson(expression);
    const matched = atomMatches(expression, subject.values[expression.field]);
    (matched ? matchedAtoms : failedAtoms).push(key);
    return matched;
  };
  const matched = evaluate(normalized);
  const dependencyKeys = sortedUnique([
    ...subject.dependencyKeys,
    `selector:${selectorHash(normalized)}`,
    ...Object.keys(subject.values).map((field) => `selector-field:${subject.id}:${field}`),
  ]);
  return {
    matched,
    matchedAtoms: sortedUnique(matchedAtoms),
    failedAtoms: sortedUnique(failedAtoms),
    dependencyKeys,
    inputFingerprint: hashFramedDomain("selector-input", {
      subjectId: subject.id,
      values: subject.values,
      dependencyKeys,
    }),
  };
}

export interface SelectorMembershipOptions {
  observability: ObservabilityClass;
  assumptions?: readonly string[];
  unavailableLanes?: readonly string[];
}

export interface SelectorMembership {
  selectorHash: ContentHash;
  memberIds: string[];
  dependencyKeys: string[];
  membershipFingerprint: ContentHash;
  observability: ObservabilityClass;
  absenceProven: boolean;
  proofCaveats: string[];
}

export function evaluateSelectorMembership(
  selector: SelectorExpr,
  subjects: readonly SelectorSubject[],
  options: SelectorMembershipOptions,
): SelectorMembership {
  const normalized = normalizeSelector(selector);
  const hash = selectorHash(normalized);
  const byId = new Map<string, SelectorSubject>();
  for (const subject of subjects) {
    if (byId.has(subject.id)) throw new SelectorEvaluationError(`duplicate selector subject ${subject.id}`);
    byId.set(subject.id, subject);
  }
  const evaluations = [...byId.values()].map((subject) => ({ subject, evaluation: evaluateSelector(normalized, subject) }));
  const memberIds = evaluations.filter(({ evaluation }) => evaluation.matched).map(({ subject }) => subject.id).sort(compareStrings);
  const dependencyKeys = sortedUnique(evaluations.flatMap(({ evaluation }) => evaluation.dependencyKeys));
  const assumptions = sortedUnique(options.assumptions ?? []);
  const unavailableLanes = sortedUnique(options.unavailableLanes ?? []);
  const proofCaveats: string[] = [];
  if (options.observability === "open" || options.observability === "sampled") {
    proofCaveats.push(`${options.observability} selector membership cannot prove absence`);
  }
  if (options.observability === "unavailable") proofCaveats.push("selector membership is unavailable");
  if (unavailableLanes.length > 0) proofCaveats.push(`unavailable selector lanes: ${unavailableLanes.join(", ")}`);
  if (assumptions.length > 0) proofCaveats.push("selector boundary depends on assumptions");
  return {
    selectorHash: hash,
    memberIds,
    dependencyKeys,
    membershipFingerprint: hashFramedDomain("selector-membership", {
      selectorHash: hash,
      members: memberIds,
      subjects: evaluations
        .map(({ subject, evaluation }) => ({ id: subject.id, inputFingerprint: evaluation.inputFingerprint, matched: evaluation.matched }))
        .sort((left, right) => compareStrings(left.id, right.id)),
      observability: options.observability,
      assumptions,
      unavailableLanes,
    }),
    observability: options.observability,
    absenceProven: memberIds.length === 0 && proofCaveats.length === 0
      && (options.observability === "closed" || options.observability === "bounded"),
    proofCaveats,
  };
}

export function selectorLensDependencies(selector: SelectorExpr): string[] {
  const dependencies: string[] = [];
  const visit = (expression: SelectorExpr): void => {
    if (expression.op === "all" || expression.op === "any") expression.items.forEach(visit);
    else if (expression.op === "not") visit(expression.item);
    else if (expression.field === "lens") {
      if (expression.matcher === "equals" && typeof expression.value === "string") dependencies.push(expression.value);
      if (expression.matcher === "in" && Array.isArray(expression.value)) {
        dependencies.push(...expression.value.filter((item): item is string => typeof item === "string"));
      }
    }
  };
  visit(normalizeSelector(selector));
  return sortedUnique(dependencies);
}
