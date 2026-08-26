import type { ScopeGrant, SelectorExpr } from "../domain/contracts.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export type RepositoryPathPredicate = Readonly<{
  matcher: "equals" | "glob";
  value: string;
}>;

export interface CompiledWriteAuthorization {
  readonly operation: string;
  readonly enforceable: boolean;
  readonly operationGranted: boolean;
  /** Outer array is grant disjunction; every predicate within one grant is conjunctive. */
  readonly allowedPathScopes: ReadonlyArray<ReadonlyArray<RepositoryPathPredicate>>;
  readonly forbiddenPathScopes: ReadonlyArray<ReadonlyArray<RepositoryPathPredicate>>;
  readonly reasons: readonly string[];
}

export interface RepositoryPathAuthorizationDecision {
  readonly authorized: boolean;
  readonly reason:
    | "authorized"
    | "unsupported-selector"
    | "operation-not-granted"
    | "invalid-repository-path"
    | "outside-allowed-scope"
    | "forbidden-scope";
}

interface CompiledSelectorPathScope {
  readonly supported: boolean;
  readonly satisfiable: boolean;
  readonly predicates: readonly RepositoryPathPredicate[];
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}

function compileCanonicalGlob(glob: string): RegExp {
  if (glob.length === 0 || glob.length > 512 || glob.includes("\u0000")) {
    throw new TypeError("invalid or oversized glob selector");
  }
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
      } else {
        result += "[^/]*";
      }
    } else if (character === "?") {
      result += "[^/]";
    } else {
      result += escapeRegex(character);
    }
  }
  return new RegExp(`${result}$`, "u");
}

export function validateCanonicalGlob(glob: string): void {
  compileCanonicalGlob(glob);
}

export function matchesCanonicalGlob(glob: string, candidate: string): boolean {
  if (candidate.length > 4096) return false;
  try {
    return compileCanonicalGlob(glob).test(candidate.replaceAll("\\", "/"));
  } catch {
    return false;
  }
}

function normalizedRepositoryValue(value: string): string | undefined {
  if (value.length === 0 || value.length > 4096 || value.includes("\u0000")) return undefined;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized.length === 0 || normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized)) return undefined;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return undefined;
  return normalized;
}

export function normalizeRepositoryRelativePath(path: string): string | undefined {
  return normalizedRepositoryValue(path);
}

function normalizePathPredicate(
  matcher: "equals" | "glob",
  value: string,
): RepositoryPathPredicate | undefined {
  const normalized = normalizedRepositoryValue(value);
  if (normalized === undefined) return undefined;
  if (matcher === "glob") {
    try {
      validateCanonicalGlob(normalized);
    } catch {
      return undefined;
    }
  }
  return Object.freeze({ matcher, value: normalized });
}

function compileSelectorPathScope(selector: SelectorExpr, operation: string): CompiledSelectorPathScope {
  if (selector.op === "atom") {
    if (
      selector.field === "path"
      && (selector.matcher === "equals" || selector.matcher === "glob")
      && typeof selector.value === "string"
    ) {
      const predicate = normalizePathPredicate(selector.matcher, selector.value);
      return predicate === undefined
        ? { supported: false, satisfiable: false, predicates: [] }
        : { supported: true, satisfiable: true, predicates: [predicate] };
    }
    if (selector.field === "operation" && selector.matcher === "equals" && typeof selector.value === "string") {
      return { supported: true, satisfiable: selector.value === operation, predicates: [] };
    }
    return { supported: false, satisfiable: false, predicates: [] };
  }
  if (selector.op !== "all") return { supported: false, satisfiable: false, predicates: [] };
  const children = selector.items.map((item) => compileSelectorPathScope(item, operation));
  if (children.some((child) => !child.supported)) {
    return { supported: false, satisfiable: false, predicates: [] };
  }
  const predicates = new Map<string, RepositoryPathPredicate>();
  for (const predicate of children.flatMap((child) => child.predicates)) {
    predicates.set(`${predicate.matcher}\0${predicate.value}`, predicate);
  }
  return {
    supported: true,
    satisfiable: children.every((child) => child.satisfiable),
    predicates: Object.freeze([...predicates.values()].sort((left, right) =>
      compareStrings(left.matcher, right.matcher) || compareStrings(left.value, right.value))),
  };
}

function compileGrants(
  grants: readonly ScopeGrant[],
  operation: string,
): { readonly supported: boolean; readonly scopes: ReadonlyArray<ReadonlyArray<RepositoryPathPredicate>> } {
  const compiled = grants
    .filter((grant) => grant.operations.includes(operation))
    .map((grant) => compileSelectorPathScope(grant.selector, operation));
  return {
    supported: compiled.every((scope) => scope.supported),
    scopes: Object.freeze(compiled
      .filter((scope) => scope.satisfiable)
      .map((scope) => Object.freeze([...scope.predicates]))),
  };
}

export function compileWriteAuthorization(input: {
  readonly operation: string;
  readonly allowedWrites: readonly ScopeGrant[];
  readonly forbiddenWrites: readonly ScopeGrant[];
}): Readonly<CompiledWriteAuthorization> {
  const allowed = compileGrants(input.allowedWrites, input.operation);
  const forbidden = compileGrants(input.forbiddenWrites, input.operation);
  const enforceable = allowed.supported && forbidden.supported;
  const reasons: string[] = [];
  if (!allowed.supported) reasons.push("allowed write selector cannot be enforced deterministically");
  if (!forbidden.supported) reasons.push("forbidden write selector cannot be enforced deterministically");
  const globallyForbidden = forbidden.scopes.some((scope) => scope.length === 0);
  const operationGranted = enforceable && allowed.scopes.length > 0 && !globallyForbidden;
  if (!operationGranted && enforceable) reasons.push(`capsule operation is not granted for mutation: ${input.operation}`);
  return Object.freeze({
    operation: input.operation,
    enforceable,
    operationGranted,
    allowedPathScopes: allowed.scopes,
    forbiddenPathScopes: forbidden.scopes,
    reasons: Object.freeze(reasons),
  });
}

function predicateMatches(predicate: RepositoryPathPredicate, path: string): boolean {
  return predicate.matcher === "equals"
    ? path === predicate.value
    : matchesCanonicalGlob(predicate.value, path);
}

function scopeMatches(scope: readonly RepositoryPathPredicate[], path: string): boolean {
  return scope.every((predicate) => predicateMatches(predicate, path));
}

export function authorizeRepositoryPath(
  authorization: CompiledWriteAuthorization,
  path: string,
): Readonly<RepositoryPathAuthorizationDecision> {
  if (!authorization.enforceable) return Object.freeze({ authorized: false, reason: "unsupported-selector" });
  if (!authorization.operationGranted) return Object.freeze({ authorized: false, reason: "operation-not-granted" });
  const normalized = normalizeRepositoryRelativePath(path);
  if (normalized === undefined) return Object.freeze({ authorized: false, reason: "invalid-repository-path" });
  if (!authorization.allowedPathScopes.some((scope) => scopeMatches(scope, normalized))) {
    return Object.freeze({ authorized: false, reason: "outside-allowed-scope" });
  }
  if (authorization.forbiddenPathScopes.some((scope) => scopeMatches(scope, normalized))) {
    return Object.freeze({ authorized: false, reason: "forbidden-scope" });
  }
  return Object.freeze({ authorized: true, reason: "authorized" });
}
