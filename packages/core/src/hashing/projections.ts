import { canonicalJson, hashFramedDomain } from "./canonical-json.js";

export interface HashProfile {
  /** Semantic, discovery, and exact-document paths may overlap each other. */
  readonly semantic: readonly string[];
  readonly discovery: readonly string[];
  /**
   * Volatile paths must be disjoint from every persisted projection, including
   * ancestor/descendant overlap. A volatile value can never influence a hash.
   */
  readonly volatile: readonly string[];
  readonly exactDocument?: readonly string[];
}

const profiles = new Map<string, HashProfile>();

function normalizeProfile(profile: HashProfile): HashProfile {
  return {
    semantic: [...new Set(profile.semantic)].sort(),
    discovery: [...new Set(profile.discovery)].sort(),
    volatile: [...new Set(profile.volatile)].sort(),
    ...(profile.exactDocument === undefined
      ? {}
      : { exactDocument: [...new Set(profile.exactDocument)].sort() }),
  };
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

function validateProfile(kind: string, profile: HashProfile): void {
  const persistedProjections = [
    ["semantic", profile.semantic],
    ["discovery", profile.discovery],
    ["exact-document", profile.exactDocument ?? []],
  ] as const;
  for (const volatilePath of profile.volatile) {
    for (const [projectionName, projectionPaths] of persistedProjections) {
      const projectionPath = projectionPaths.find((path) => pathsOverlap(volatilePath, path));
      if (projectionPath !== undefined) {
        throw new Error(
          `hash profile ${kind} volatile path "${volatilePath}" overlaps ${projectionName} path "${projectionPath}"`,
        );
      }
    }
  }
}

export function registerHashProfile(kind: string, profile: HashProfile): void {
  const normalized = normalizeProfile(profile);
  validateProfile(kind, normalized);
  const existing = profiles.get(kind);
  if (existing !== undefined && canonicalJson(existing) !== canonicalJson(normalized)) {
    throw new Error(`hash profile ${kind} is already registered differently`);
  }
  profiles.set(kind, normalized);
}

export function getHashProfile(kind: string): HashProfile {
  const profile = profiles.get(kind);
  if (profile === undefined) {
    throw new Error(`no registered hash projection for ${kind}`);
  }
  return profile;
}

function atPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function select(value: unknown, paths: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("hash projections require an object");
  }
  return Object.fromEntries(paths.map((path) => [path, atPath(value, path)]));
}

function exactProjection(value: unknown, profile: HashProfile): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("canonical documents require an object");
  }
  if (profile.exactDocument !== undefined) {
    return select(value, profile.exactDocument);
  }
  const result = { ...value } as Record<string, unknown>;
  const omit = (target: Record<string, unknown>, path: string): void => {
    const [head, ...tail] = path.split(".");
    if (head === undefined) return;
    if (tail.length === 0) {
      delete target[head];
      return;
    }
    const child = target[head];
    if (typeof child !== "object" || child === null || Array.isArray(child)) return;
    const cloned = { ...child } as Record<string, unknown>;
    target[head] = cloned;
    omit(cloned, tail.join("."));
  };
  omit(result, "canonicalDocumentHash");
  for (const path of profile.volatile) {
    omit(result, path);
    if (typeof result.payload === "object" && result.payload !== null) {
      omit(result, `payload.${path}`);
    }
  }
  return result;
}

export function hashSemantic(kind: string, value: unknown): `sha256:v1:${string}` {
  const profile = getHashProfile(kind);
  return hashFramedDomain("semantic", { kind, projection: select(value, profile.semantic) });
}

export function hashDiscovery(kind: string, value: unknown): `sha256:v1:${string}` {
  const profile = getHashProfile(kind);
  return hashFramedDomain("discovery", { kind, projection: select(value, profile.discovery) });
}

export function hashCanonicalDocument(kind: string, value: unknown): `sha256:v1:${string}` {
  const profile = getHashProfile(kind);
  return hashFramedDomain("canonical-document", { kind, document: exactProjection(value, profile) });
}

export interface RootManifestEntry {
  readonly entityId: string;
  readonly canonicalDocumentHash: `sha256:v1:${string}`;
}

export function hashRootManifest(entries: readonly RootManifestEntry[]): `sha256:v1:${string}` {
  const sorted = [...entries].sort((left, right) =>
    Buffer.compare(Buffer.from(left.entityId), Buffer.from(right.entityId)) ||
    Buffer.compare(Buffer.from(left.canonicalDocumentHash), Buffer.from(right.canonicalDocumentHash)),
  );
  const duplicate = sorted.find((entry, index) => entry.entityId === sorted[index - 1]?.entityId);
  if (duplicate !== undefined) {
    throw new Error(`duplicate canonical root entity ID: ${duplicate.entityId}`);
  }
  return hashFramedDomain("canonical-root", sorted);
}
