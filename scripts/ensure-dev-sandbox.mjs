#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUBBLEWRAP_EXECUTABLE = "/usr/bin/bwrap";
const APT_GET_EXECUTABLE = "/usr/bin/apt-get";
const SUDO_EXECUTABLE = "/usr/bin/sudo";
const INSTALL_EXECUTABLE = "/usr/bin/install";
const APPARMOR_PARSER_EXECUTABLE = "/usr/sbin/apparmor_parser";
const OS_RELEASE_PATH = "/etc/os-release";
const USER_NAMESPACE_RESTRICTION_PATH = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";
const PACKAGED_BUBBLEWRAP_PROFILE = "/usr/share/apparmor/extra-profiles/bwrap-userns-restrict";
const LOADED_BUBBLEWRAP_PROFILE = "/etc/apparmor.d/bwrap-userns-restrict";

async function defaultExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function defaultReadText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function defaultRun(executable, args) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(executable, args, { stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${executable} failed with ${code === null ? `signal ${signal ?? "unknown"}` : `exit code ${code}`}`));
    });
  });
}

function parseOsRelease(source) {
  return Object.fromEntries(source.split(/\r?\n/u).flatMap((line) => {
    const match = /^([A-Z_]+)=(.*)$/u.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) return [];
    const value = match[2].replace(/^(?:"(.*)"|'(.*)')$/u, (_whole, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? "");
    return [[match[1], value]];
  }));
}

function isAptBased(osRelease) {
  const id = osRelease.ID?.toLowerCase();
  const related = new Set((osRelease.ID_LIKE ?? "").toLowerCase().split(/\s+/u).filter(Boolean));
  return id === "ubuntu" || id === "debian" || related.has("debian") || related.has("ubuntu");
}

export async function ensureDevelopmentSandbox(overrides = {}) {
  const dependencies = {
    platform: process.platform,
    uid: typeof process.getuid === "function" ? process.getuid() : -1,
    nodeExecutable: process.execPath,
    probeScript: fileURLToPath(new URL("./probe-sandbox.mjs", import.meta.url)),
    exists: defaultExists,
    readText: defaultReadText,
    run: defaultRun,
    write: (message) => process.stdout.write(`${message}\n`),
    ...overrides,
  };

  if (dependencies.platform !== "linux") {
    throw new Error("Automatic Bubblewrap provisioning is supported only on apt-based Linux; configure a capability-proven fallback backend on this host");
  }

  if (!await dependencies.exists(BUBBLEWRAP_EXECUTABLE)) {
    const source = await dependencies.readText(OS_RELEASE_PATH);
    if (source === undefined || !isAptBased(parseOsRelease(source))) {
      throw new Error("Bubblewrap is missing and automatic installation supports only apt-based Linux development hosts");
    }
    if (!await dependencies.exists(APT_GET_EXECUTABLE)) {
      throw new Error(`Bubblewrap is missing and ${APT_GET_EXECUTABLE} is unavailable`);
    }

    const restrictedUserNamespaces = (await dependencies.readText(USER_NAMESPACE_RESTRICTION_PATH))?.trim() === "1";
    const packages = ["bubblewrap", ...(restrictedUserNamespaces ? ["apparmor-profiles"] : [])];
    let runPrivileged;
    if (dependencies.uid === 0) {
      runPrivileged = (executable, args) => dependencies.run(executable, args);
    } else {
      if (!await dependencies.exists(SUDO_EXECUTABLE)) {
        throw new Error("Bubblewrap installation requires root or an available sudo command");
      }
      runPrivileged = (executable, args) => dependencies.run(SUDO_EXECUTABLE, [executable, ...args]);
    }

    dependencies.write("Bubblewrap is missing; installing the development sandbox dependency...");
    await runPrivileged(APT_GET_EXECUTABLE, ["update"]);
    await runPrivileged(APT_GET_EXECUTABLE, ["install", "--yes", "--no-install-recommends", ...packages]);

    if (restrictedUserNamespaces) {
      if (!await dependencies.exists(PACKAGED_BUBBLEWRAP_PROFILE) || !await dependencies.exists(APPARMOR_PARSER_EXECUTABLE)) {
        throw new Error("Bubblewrap was installed, but Ubuntu's packaged AppArmor profile or parser is unavailable");
      }
      await runPrivileged(INSTALL_EXECUTABLE, ["--mode=0644", PACKAGED_BUBBLEWRAP_PROFILE, LOADED_BUBBLEWRAP_PROFILE]);
      await runPrivileged(APPARMOR_PARSER_EXECUTABLE, ["--replace", LOADED_BUBBLEWRAP_PROFILE]);
    }
  }

  await dependencies.run(dependencies.nodeExecutable, [dependencies.probeScript]);
  dependencies.write("Projector development sandbox is ready.");
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  ensureDevelopmentSandbox().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
