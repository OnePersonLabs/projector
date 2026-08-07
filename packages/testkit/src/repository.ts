import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { copyFixtureTree, snapshotFilesystem, type FilesystemSnapshotEntry } from "./filesystem.js";
import { mandatoryMisplacedRepositoryScriptFixture } from "./fixtures.js";

const executeFile = promisify(execFile);
const deterministicGitDate = "2000-01-01T00:00:00.000Z";

export interface CreateTempGitRepositoryOptions {
  fixture?: string;
  commitMessage?: string;
}

export interface TempGitRepository {
  root: string;
  fixture: string;
  initialRevision: string;
  git(argv: readonly string[]): Promise<string>;
  snapshot(): Promise<FilesystemSnapshotEntry[]>;
  dispose(): Promise<void>;
}

export async function createTempGitRepository(
  options: CreateTempGitRepositoryOptions = {},
): Promise<TempGitRepository> {
  const fixture = path.resolve(options.fixture ?? mandatoryMisplacedRepositoryScriptFixture);
  const root = await mkdtemp(path.join(tmpdir(), "projector-fixture-"));
  try {
    await copyFixtureTree(fixture, root);
    const runGit = async (argv: readonly string[]): Promise<string> => {
      const result = await executeFile("git", [
        "-c", "core.autocrlf=false",
        "-c", "core.filemode=false",
        ...argv,
      ], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_EMAIL: "testkit@projector.invalid",
          GIT_AUTHOR_NAME: "Projector Testkit",
          GIT_AUTHOR_DATE: deterministicGitDate,
          GIT_COMMITTER_EMAIL: "testkit@projector.invalid",
          GIT_COMMITTER_NAME: "Projector Testkit",
          GIT_COMMITTER_DATE: deterministicGitDate,
          GIT_CONFIG_GLOBAL: path.join(root, ".projector-testkit-no-global-gitconfig"),
          GIT_CONFIG_NOSYSTEM: "1",
          LC_ALL: "C",
          TZ: "UTC",
        },
      });
      return result.stdout.trimEnd();
    };
    await runGit(["init", "--quiet", "--initial-branch=main"]);
    await runGit(["add", "--all"]);
    await runGit([
      "-c", "user.name=Projector Testkit",
      "-c", "user.email=testkit@projector.invalid",
      "commit", "--quiet", "--no-gpg-sign", "-m", options.commitMessage ?? "fixture: initial state",
    ]);
    const initialRevision = await runGit(["rev-parse", "HEAD"]);
    let disposed = false;
    return {
      root,
      fixture,
      initialRevision,
      git: runGit,
      async snapshot() {
        return snapshotFilesystem(root);
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
