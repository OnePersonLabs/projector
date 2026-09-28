import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { hashFramedDomain, type CodeInputBinding } from "@projector/core";

/** Shared byte binding for native, SCIP, SemanticDB, and syntax providers. */
export function codeInputHash(content: string | Uint8Array): string {
  return hashFramedDomain(
    "projector-code-input-v1",
    Buffer.from(content).toString("base64"),
  );
}

/** Rechecks the exact source/config/resolution closure before serving a cached generation. */
export function verifyCodeInputBinding(
  binding: CodeInputBinding,
  repositoryRoot: string,
): boolean {
  if (binding.status !== "verified") return false;
  for (const input of [
    ...binding.sourceInputs,
    ...binding.configInputs,
    ...binding.resolutionInputs,
  ]) {
    try {
      if (
        codeInputHash(readFileSync(resolve(repositoryRoot, input.path))) !==
        input.contentHash
      )
        return false;
    } catch {
      return false;
    }
  }
  for (const probe of binding.resolutionProbes ?? []) {
    let present = false;
    try {
      present = statSync(resolve(repositoryRoot, probe.path)).isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
    }
    if (present !== probe.exists) return false;
  }
  for (const probe of binding.directoryProbes ?? []) {
    let present = false;
    try {
      present = statSync(resolve(repositoryRoot, probe.path)).isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
    }
    if (present !== probe.exists) return false;
  }
  for (const listing of binding.directoryListings ?? []) {
    let directories: string[];
    try {
      directories = readdirSync(resolve(repositoryRoot, listing.path), {
        withFileTypes: true,
      })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
      directories = [];
    }
    if (
      directories.length !== listing.directories.length ||
      directories.some((name, index) => name !== listing.directories[index])
    )
      return false;
  }
  return true;
}
