import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { ensureDevelopmentSandbox } from "./ensure-dev-sandbox.mjs";

const BWRAP = "/usr/bin/bwrap";
const APT_GET = "/usr/bin/apt-get";
const SUDO = "/usr/bin/sudo";
const PROBE = "/workspace/scripts/probe-sandbox.mjs";

function harness(options: {
  readonly platform?: NodeJS.Platform;
  readonly uid?: number;
  readonly present?: readonly string[];
  readonly files?: Readonly<Record<string, string>>;
} = {}) {
  const present = new Set(options.present ?? [APT_GET, SUDO]);
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  const output: string[] = [];
  return {
    calls,
    output,
    dependencies: {
      platform: options.platform ?? "linux",
      uid: options.uid ?? 1000,
      nodeExecutable: "/usr/bin/node",
      probeScript: PROBE,
      exists: async (path: string) => present.has(path),
      readText: async (path: string) => options.files?.[path],
      run: async (executable: string, args: readonly string[]) => {
        calls.push({ executable, args: [...args] });
      },
      write: (message: string) => output.push(message),
    },
  };
}

describe("development sandbox provisioning", () => {
  it("runs automatically for development tests and release acceptance", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };

    expect(manifest.scripts["sandbox:ensure"]).toBe("node scripts/ensure-dev-sandbox.mjs");
    expect(manifest.scripts.test).toMatch(/^pnpm sandbox:ensure && /u);
    expect(manifest.scripts["release:acceptance"]).toMatch(/^pnpm sandbox:ensure && /u);
  });

  it("does not invoke a package manager when Bubblewrap is already installed", async () => {
    const test = harness({ present: [BWRAP] });

    await ensureDevelopmentSandbox(test.dependencies);

    expect(test.calls).toEqual([
      { executable: "/usr/bin/node", args: [PROBE] },
    ]);
    expect(test.output.join("\n")).toMatch(/ready/iu);
  });

  it("installs missing Bubblewrap through sudo on apt-based development hosts and then proves it", async () => {
    const test = harness({ files: { "/etc/os-release": "ID=ubuntu\nID_LIKE=debian\n" } });

    await ensureDevelopmentSandbox(test.dependencies);

    expect(test.calls).toEqual([
      { executable: SUDO, args: [APT_GET, "update"] },
      { executable: SUDO, args: [APT_GET, "install", "--yes", "--no-install-recommends", "bubblewrap"] },
      { executable: "/usr/bin/node", args: [PROBE] },
    ]);
  });

  it("installs directly when the developer is already root", async () => {
    const test = harness({ uid: 0, present: [APT_GET], files: { "/etc/os-release": "ID=debian\n" } });

    await ensureDevelopmentSandbox(test.dependencies);

    expect(test.calls.slice(0, 2)).toEqual([
      { executable: APT_GET, args: ["update"] },
      { executable: APT_GET, args: ["install", "--yes", "--no-install-recommends", "bubblewrap"] },
    ]);
  });

  it("fails clearly instead of mutating unsupported development hosts", async () => {
    const test = harness({ platform: "darwin", present: [] });

    await expect(ensureDevelopmentSandbox(test.dependencies)).rejects.toThrow(/Linux|fallback/iu);
    expect(test.calls).toEqual([]);
  });

  it("requires an available privilege path before attempting installation", async () => {
    const test = harness({ present: [APT_GET], files: { "/etc/os-release": "ID=ubuntu\n" } });

    await expect(ensureDevelopmentSandbox(test.dependencies)).rejects.toThrow(/sudo|root/iu);
    expect(test.calls).toEqual([]);
  });

  it("loads Ubuntu's packaged Bubblewrap profile when restricted user namespaces are enabled", async () => {
    const profile = "/usr/share/apparmor/extra-profiles/bwrap-userns-restrict";
    const test = harness({
      present: [APT_GET, SUDO, profile, "/usr/sbin/apparmor_parser"],
      files: {
        "/etc/os-release": "ID=ubuntu\nID_LIKE=debian\n",
        "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1\n",
      },
    });

    await ensureDevelopmentSandbox(test.dependencies);

    expect(test.calls).toContainEqual({
      executable: SUDO,
      args: [APT_GET, "install", "--yes", "--no-install-recommends", "bubblewrap", "apparmor-profiles"],
    });
    expect(test.calls).toContainEqual({
      executable: SUDO,
      args: ["/usr/bin/install", "--mode=0644", profile, "/etc/apparmor.d/bwrap-userns-restrict"],
    });
    expect(test.calls).toContainEqual({
      executable: SUDO,
      args: ["/usr/sbin/apparmor_parser", "--replace", "/etc/apparmor.d/bwrap-userns-restrict"],
    });
  });

  it("propagates installation failures and never claims readiness", async () => {
    const test = harness({ files: { "/etc/os-release": "ID=ubuntu\n" } });
    test.dependencies.run = vi.fn(async (executable: string, args: readonly string[]) => {
      test.calls.push({ executable, args: [...args] });
      if (args.includes("install")) throw new Error("package installation failed");
    });

    await expect(ensureDevelopmentSandbox(test.dependencies)).rejects.toThrow(/installation failed/iu);
    expect(test.calls.some(({ args }) => args.includes(PROBE))).toBe(false);
    expect(test.output.join("\n")).not.toMatch(/ready/iu);
  });
});
