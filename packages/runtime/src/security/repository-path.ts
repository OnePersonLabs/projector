import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";

export type PathSecurityErrorCode =
  | "invalid-path"
  | "root-escape"
  | "scope-refused"
  | "symlink-refused";

export class PathSecurityError extends Error {
  readonly code: PathSecurityErrorCode;

  constructor(code: PathSecurityErrorCode, message: string) {
    super(message);
    this.name = "PathSecurityError";
    this.code = code;
  }
}

export type SymlinkPolicy = "reject" | "follow-inside";

export interface ResolvedRepositoryPath {
  canonicalPath: string;
  realTarget: string;
}

export class RepositoryPathService {
  readonly root: string;

  private constructor(root: string) {
    this.root = root;
  }

  static async create(root: string): Promise<RepositoryPathService> {
    return new RepositoryPathService(await realpath(root));
  }

  resolveRead(path: string, symlinks: SymlinkPolicy = "reject"): Promise<ResolvedRepositoryPath> {
    return this.resolve(path, symlinks);
  }

  resolveWrite(path: string, symlinks: SymlinkPolicy = "reject"): Promise<ResolvedRepositoryPath> {
    return this.resolve(path, symlinks);
  }

  async resolveScopedRead(
    path: string,
    scopes: readonly string[],
    symlinks: SymlinkPolicy = "reject",
  ): Promise<ResolvedRepositoryPath> {
    this.assertDeclaredScope(path, scopes);
    return this.resolveRead(path, symlinks);
  }

  async resolveScopedWrite(
    path: string,
    scopes: readonly string[],
    symlinks: SymlinkPolicy = "reject",
  ): Promise<ResolvedRepositoryPath> {
    this.assertDeclaredScope(path, scopes);
    return this.resolveWrite(path, symlinks);
  }

  canonicalize(path: string): string {
    if (
      path.length === 0 ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.startsWith("/") ||
      /^[A-Za-z]:/u.test(path) ||
      /^\/{2}/u.test(path)
    ) {
      throw new PathSecurityError("invalid-path", `Not a canonical repository path: ${path}`);
    }

    const normalized = posix.normalize(path);
    if (normalized === ".." || normalized.startsWith("../") || normalized !== path) {
      throw new PathSecurityError("root-escape", `Repository path escapes or is not normalized: ${path}`);
    }
    return normalized;
  }

  private assertDeclaredScope(path: string, scopes: readonly string[]): void {
    const canonicalPath = this.canonicalize(path);
    const allowed = scopes.some((scope) => {
      const canonicalScope = this.canonicalize(scope);
      return canonicalScope === "." || canonicalPath === canonicalScope || canonicalPath.startsWith(`${canonicalScope}/`);
    });
    if (!allowed) {
      throw new PathSecurityError("scope-refused", `${canonicalPath} is outside the declared scope`);
    }
  }

  private async resolve(path: string, symlinks: SymlinkPolicy): Promise<ResolvedRepositoryPath> {
    const canonicalPath = this.canonicalize(path);
    const segments = canonicalPath === "." ? [] : canonicalPath.split("/");
    let cursor = this.root;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment === undefined) {
        throw new PathSecurityError("invalid-path", `Invalid repository path: ${path}`);
      }
      const candidate = join(cursor, segment);
      try {
        const status = await lstat(candidate);
        if (status.isSymbolicLink()) {
          if (symlinks === "reject") {
            throw new PathSecurityError("symlink-refused", `Symbolic links are not allowed for ${canonicalPath}`);
          }
          cursor = await realpath(candidate);
          this.assertInsideRoot(cursor, canonicalPath);
        } else {
          cursor = candidate;
        }
      } catch (error) {
        if (isMissingPathError(error)) {
          cursor = join(cursor, ...segments.slice(index));
          this.assertInsideRoot(cursor, canonicalPath);
          break;
        }
        throw error;
      }
    }

    this.assertInsideRoot(cursor, canonicalPath);
    return { canonicalPath, realTarget: cursor };
  }

  private assertInsideRoot(target: string, canonicalPath: string): void {
    const fromRoot = relative(this.root, target);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new PathSecurityError("root-escape", `${canonicalPath} resolves outside the governed root`);
    }
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
