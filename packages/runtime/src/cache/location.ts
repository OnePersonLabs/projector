import { lstat, mkdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { hashFramedDomain } from "@projector/core";
import { RepositoryPathService } from "../security/repository-path.js";

export interface CheckoutCacheLocation { readonly checkoutId: string; readonly checkoutRoot: string; readonly cacheRoot: string; }

/** Physical checkout identity isolates independent clones and directory replacements.
 * No persistent authority or authored record is created in this disposable owner.
 */
export async function checkoutCacheLocation(repositoryRoot: string): Promise<CheckoutCacheLocation> {
  const checkoutRoot = await realpath(repositoryRoot);
  const identity = await lstat(checkoutRoot, { bigint: true });
  if (!identity.isDirectory() || identity.isSymbolicLink()) throw new Error("Checkout cache requires a real checkout directory");
  const checkoutId = hashFramedDomain("projector-checkout-cache-v1", { root: checkoutRoot, device: String(identity.dev), inode: String(identity.ino), created: String(identity.birthtimeNs) }).slice("sha256:v1:".length);
  const configured = process.env.PROJECTOR_CACHE_DIRECTORY;
  const base = configured ?? (process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Projector", "cache")
    : process.platform === "darwin" ? join(homedir(), "Library", "Caches", "Projector")
      : join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "projector"));
  if (!isAbsolute(base)) throw new Error("Projector user cache directory must be absolute");
  const cacheRoot = join(base, "checkouts", checkoutId);
  await mkdir(cacheRoot, { recursive: true });
  // Refuse links in the application-owned portion before constructing cache paths.
  for (const directory of [base, join(base, "checkouts"), cacheRoot]) {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Projector user cache directory is redirected through a symbolic link");
  }
  return { checkoutId, checkoutRoot, cacheRoot };
}

/** Existing derived addresses are virtual names; their physical owner is the user cache. */
export async function resolveDerivedCachePath(repositoryRoot: string, relativePath: string): Promise<string> {
  if (!/^\.projector\/runtime\/(?:knowledge\/contexts\/|impact\/|observations\/)/u.test(relativePath)) throw new Error("Path is not a disposable Projector cache address");
  const { cacheRoot } = await checkoutCacheLocation(repositoryRoot);
  const paths = await RepositoryPathService.create(cacheRoot);
  return (await paths.resolveWrite(relativePath)).realTarget;
}
