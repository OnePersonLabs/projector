import { createSandboxLauncher } from "../packages/runtime/dist/index.js";

const launcher = await createSandboxLauncher();
const { filesystemIsolation, networkIsolation } = launcher.capabilities;
if (!filesystemIsolation || !networkIsolation) {
  throw new Error("Capability-proven sandbox launcher did not advertise filesystem and network isolation");
}

process.stdout.write(`${JSON.stringify({
  platform: process.platform,
  filesystemIsolation,
  networkIsolation,
})}\n`);
